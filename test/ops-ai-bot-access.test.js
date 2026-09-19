import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACCESS_VERDICTS,
  AI_BOT_PROFILES,
  BOT_ROLES,
  CONTROL_PROFILE,
  classifyBotAccess,
  describeAccessVerdict,
} from '../src/ops/aiBotAccess.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const bot = (name, role, status, owner = '') => ({ name, role, status, owner })

test('o caso do RCA: busca passa, treino barrado → aviso, não reprovação', () => {
  const r = classifyBotAccess({
    control: { status: 200 },
    bots: [
      bot('OAI-SearchBot', BOT_ROLES.SEARCH, 200),
      bot('ChatGPT-User', BOT_ROLES.CLICK, 200),
      bot('GPTBot', BOT_ROLES.TRAINING, 403),
      bot('ClaudeBot', BOT_ROLES.TRAINING, 403),
      bot('PerplexityBot', BOT_ROLES.SEARCH, 200),
    ],
  })
  assert.equal(r.verdict, ACCESS_VERDICTS.TRAINING_BLOCKED)
  assert.deepEqual(r.blockedTraining.map((b) => b.name), ['GPTBot', 'ClaudeBot'])
  assert.equal(r.blockedSearch.length, 0)
  assert.equal(r.passed.length, 3)
})

test('robô de BUSCA barrado reprova — é o que faz a IA parar de citar', () => {
  const r = classifyBotAccess({
    control: { status: 200 },
    bots: [bot('OAI-SearchBot', BOT_ROLES.SEARCH, 403), bot('GPTBot', BOT_ROLES.TRAINING, 200)],
  })
  assert.equal(r.verdict, ACCESS_VERDICTS.SEARCH_BLOCKED)
  assert.deepEqual(r.blockedSearch.map((b) => b.name), ['OAI-SearchBot'])
})

test('robô de CLIQUE barrado também reprova — a citação existe e o clique dá erro', () => {
  const r = classifyBotAccess({
    control: { status: 200 },
    bots: [bot('ChatGPT-User', BOT_ROLES.CLICK, 401)],
  })
  assert.equal(r.verdict, ACCESS_VERDICTS.SEARCH_BLOCKED)
  assert.deepEqual(r.blockedClick.map((b) => b.name), ['ChatGPT-User'])
})

test('quem chama pode decidir que treino barrado reprova', () => {
  const r = classifyBotAccess(
    { control: { status: 200 }, bots: [bot('GPTBot', BOT_ROLES.TRAINING, 403)] },
    { trainingBlocks: true },
  )
  assert.equal(r.verdict, ACCESS_VERDICTS.SEARCH_BLOCKED)
})

test('fail-safe: sem controle ou site fora, nenhum bloqueio é afirmado', () => {
  const down = classifyBotAccess({ control: { status: 503 }, bots: [bot('OAI-SearchBot', BOT_ROLES.SEARCH, 403)] })
  assert.equal(down.verdict, ACCESS_VERDICTS.SITE_DOWN)
  assert.equal(down.blockedSearch.length, 0)

  const noData = classifyBotAccess({ control: { status: null }, bots: [bot('OAI-SearchBot', BOT_ROLES.SEARCH, 403)] })
  assert.equal(noData.verdict, ACCESS_VERDICTS.NO_DATA)
})

test('fail-safe: rede fora (status null) e 5xx viram "sem medição", nunca bloqueio', () => {
  const r = classifyBotAccess({
    control: { status: 200 },
    bots: [bot('OAI-SearchBot', BOT_ROLES.SEARCH, null), bot('PerplexityBot', BOT_ROLES.SEARCH, 502)],
  })
  assert.equal(r.verdict, ACCESS_VERDICTS.NO_DATA)
  assert.equal(r.unmeasured.length, 2)
  assert.equal(r.blockedSearch.length, 0)
})

test('429 é limitação, não bloqueio', () => {
  const r = classifyBotAccess({
    control: { status: 200 },
    bots: [bot('OAI-SearchBot', BOT_ROLES.SEARCH, 429), bot('ChatGPT-User', BOT_ROLES.CLICK, 200)],
  })
  assert.equal(r.verdict, ACCESS_VERDICTS.OK)
  assert.deepEqual(r.throttled.map((b) => b.name), ['OAI-SearchBot'])
})

test('redirect (3xx) no controle conta como site de pé', () => {
  const r = classifyBotAccess({ control: { status: 301 }, bots: [bot('OAI-SearchBot', BOT_ROLES.SEARCH, 200)] })
  assert.equal(r.verdict, ACCESS_VERDICTS.OK)
})

test('o catálogo mantém os robôs de que o placar de citação depende', () => {
  const names = new Set(AI_BOT_PROFILES.map((p) => p.name))
  for (const obrigatorio of ['OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'PerplexityBot', 'Googlebot', 'bingbot', 'ClaudeBot']) {
    assert.ok(names.has(obrigatorio), `faltou ${obrigatorio}`)
  }
  for (const p of AI_BOT_PROFILES) {
    assert.ok(Object.values(BOT_ROLES).includes(p.role), `${p.name} sem papel válido`)
    assert.ok(p.userAgent.includes(p.name), `${p.name}: o User-Agent precisa carregar o nome do robô`)
  }
  assert.ok(!CONTROL_PROFILE.userAgent.match(/bot/i), 'o controle tem que ser um navegador comum')
})

test('texto leigo: nada de WAF, UA, crawler ou user-agent na frase para a pessoa', () => {
  for (const v of Object.values(ACCESS_VERDICTS)) {
    const texto = describeAccessVerdict(v)
    assert.ok(texto.length > 20)
    assert.doesNotMatch(texto, /\b(WAF|UA|user-agent|crawler|HTTP)\b/i, `${v}: ${texto}`)
  }
})

test('o script de diagnóstico usa a regra pura, não reimplementa', () => {
  const src = fs.readFileSync(path.join(here, '..', 'scripts', 'diag-acesso-robos-ia.mjs'), 'utf8')
  assert.match(src, /from '\.\.\/src\/ops\/aiBotAccess\.js'/)
  assert.match(src, /classifyBotAccess\(/)
  assert.doesNotMatch(src, /prisma|\.\/db\.js|dotenv/, 'read-only, sem banco e sem segredo')
})
