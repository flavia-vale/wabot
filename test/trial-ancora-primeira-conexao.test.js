// A1 do plano de ativação de 2026-09-08 — contar o teste a partir da PRIMEIRA
// CONEXÃO, não do cadastro.
//
// Puro + carregador com db injetado: roda sem banco e sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  decideTrialAnchor,
  trialAnchorEnabled,
  TRIAL_ANCHOR_MAX_SIGNUP_AGE_DAYS,
} from '../src/domain/painel/trialAnchor.js'
import {
  anchorTrialOnFirstConnection,
  resetTrialAnchorCache,
  TRIAL_ANCHOR_EVENT,
} from '../src/domain/painel/trialAnchorApply.js'
import { ANALYTICS_EVENTS } from '../src/analytics.js'

const NOW = new Date('2026-09-08T12:00:00Z')
// Precisa esperar o corpo assíncrono terminar antes de devolver a env — senão
// o `finally` desliga o interruptor no meio do teste e ele testa o oposto.
const ligado = async (fn) => {
  const antes = process.env.TRIAL_ANCHOR_ON_CONNECT
  process.env.TRIAL_ANCHOR_ON_CONNECT = 'true'
  try { return await fn() } finally {
    if (antes === undefined) delete process.env.TRIAL_ANCHOR_ON_CONNECT
    else process.env.TRIAL_ANCHOR_ON_CONNECT = antes
  }
}

const base = {
  plan: 'trial',
  createdAt: '2026-09-06T12:00:00Z',
  accessExpiresAt: '2026-09-13T12:00:00Z',
  trialDays: 7,
  now: NOW,
}

// --- O interruptor -----------------------------------------------------------

test('desligado por padrão — nada muda sem decisão explícita', () => {
  // Isto dá dias de produto de graça. Entra em produção por escolha, depois de
  // validado em staging, nunca por deploy.
  assert.equal(trialAnchorEnabled(), false)
  assert.equal(decideTrialAnchor(base).anchor, false)
  assert.equal(decideTrialAnchor(base).reason, 'desligado')
})

test('só o valor exato "true" liga', () => {
  for (const valor of ['1', 'on', 'sim', 'TRUE', '']) {
    process.env.TRIAL_ANCHOR_ON_CONNECT = valor
    assert.equal(trialAnchorEnabled(), false, `"${valor}" ligou sem querer`)
  }
  delete process.env.TRIAL_ANCHOR_ON_CONNECT
})

// --- A decisão ---------------------------------------------------------------

test('primeira conexão de conta nova reancora o teste', () => ligado(() => {
  const d = decideTrialAnchor(base)
  assert.equal(d.anchor, true)
  assert.equal(d.reason, 'primeira_conexao')
  // 7 dias A PARTIR DE AGORA, não do cadastro.
  assert.equal(d.until.toISOString(), '2026-09-15T12:00:00.000Z')
}))

test('NUNCA encurta o acesso', () => ligado(() => {
  // Acesso que já vale mais que a nova âncora fica como está. Encurtar seria
  // tirar da cliente algo que ela já tinha.
  const d = decideTrialAnchor({ ...base, accessExpiresAt: '2026-10-30T12:00:00Z' })
  assert.equal(d.anchor, false)
  assert.equal(d.reason, 'ja_vale_mais')
}))

test('reconectar não renova o teste de novo', () => ligado(() => {
  // Sem isso, desconectar e reconectar viraria teste infinito.
  const d = decideTrialAnchor({ ...base, alreadyAnchored: true })
  assert.equal(d.anchor, false)
  assert.equal(d.reason, 'ja_ancorado')
}))

test('conta antiga não ganha teste novo ao conectar', () => ligado(() => {
  // A regra encontra uma base já formada: sem teto, todo mundo que se cadastrou
  // meses atrás e conectasse hoje ganharia sete dias. Mesma lição do RCA
  // "gatilho ancorado no cadastro não pode ser retroativo".
  const d = decideTrialAnchor({ ...base, createdAt: '2026-05-01T12:00:00Z', accessExpiresAt: null })
  assert.equal(d.anchor, false)
  assert.equal(d.reason, 'conta_antiga')
  assert.ok(TRIAL_ANCHOR_MAX_SIGNUP_AGE_DAYS <= 30, 'a janela ficou larga demais para ser "conta nova"')
}))

test('conta paga nunca é tocada', () => ligado(() => {
  for (const plan of ['pro', 'basic', null, undefined]) {
    const d = decideTrialAnchor({ ...base, plan })
    assert.equal(d.anchor, false, `plano ${plan}`)
    assert.equal(d.reason, 'nao_e_teste')
  }
}))

test('dado ruim não estende nada (fail-safe)', () => ligado(() => {
  assert.equal(decideTrialAnchor({ ...base, createdAt: 'ontem' }).reason, 'sem_data_de_cadastro')
  assert.equal(decideTrialAnchor({ ...base, createdAt: null }).reason, 'sem_data_de_cadastro')
  assert.equal(decideTrialAnchor({ ...base, trialDays: 0 }).reason, 'duracao_invalida')
  assert.equal(decideTrialAnchor({ ...base, trialDays: 'sete' }).reason, 'duracao_invalida')
}))

// --- O carregador ------------------------------------------------------------

function fakeDb({ user, marcador = null, onUpdate } = {}) {
  return {
    user: {
      findUnique: async () => user,
      update: async (args) => { onUpdate?.(args); return { ...user, ...args.data } },
    },
    analyticsEvent: { findFirst: async () => marcador },
  }
}

test('desligado NÃO toca no banco', async () => {
  let tocou = false
  const db = { user: { findUnique: async () => { tocou = true; return null } }, analyticsEvent: {} }
  const r = await anchorTrialOnFirstConnection({ db, userId: 'u1', trialDays: 7, now: NOW })
  assert.equal(r.anchored, false)
  assert.equal(r.reason, 'desligado')
  assert.equal(tocou, false, 'consultou o banco com o interruptor desligado')
})

test('ligado: grava o novo fim do acesso', async () => ligado(async () => {
  resetTrialAnchorCache()
  let gravado = null
  const db = fakeDb({
    user: { plan: 'trial', createdAt: new Date('2026-09-06T12:00:00Z'), accessExpiresAt: new Date('2026-09-13T12:00:00Z') },
    onUpdate: (args) => { gravado = args.data.accessExpiresAt },
  })
  const r = await anchorTrialOnFirstConnection({ db, userId: 'u1', trialDays: 7, now: NOW })
  assert.equal(r.anchored, true)
  assert.equal(gravado.toISOString(), '2026-09-15T12:00:00.000Z')
}))

test('a segunda chamada não consulta o banco de novo', async () => ligado(async () => {
  resetTrialAnchorCache()
  let consultas = 0
  const db = {
    user: {
      findUnique: async () => { consultas += 1; return { plan: 'pro', createdAt: new Date(), accessExpiresAt: null } },
      update: async () => {},
    },
    analyticsEvent: { findFirst: async () => null },
  }
  await anchorTrialOnFirstConnection({ db, userId: 'u2', trialDays: 7, now: NOW })
  await anchorTrialOnFirstConnection({ db, userId: 'u2', trialDays: 7, now: NOW })
  await anchorTrialOnFirstConnection({ db, userId: 'u2', trialDays: 7, now: NOW })
  // O status da sessão é consultado a cada poucos segundos pelo painel: uma
  // consulta por chamada seria caro à toa.
  assert.equal(consultas, 1)
}))

test('falha no banco não derruba o status da sessão', async () => ligado(async () => {
  resetTrialAnchorCache()
  const db = {
    user: { findUnique: async () => { throw new Error('SQLITE_BUSY') } },
    analyticsEvent: { findFirst: async () => null },
  }
  const r = await anchorTrialOnFirstConnection({ db, userId: 'u3', trialDays: 7, now: NOW })
  assert.equal(r.anchored, false)
  assert.equal(r.reason, 'falhou')
}))

test('o marcador só é gravado DEPOIS do update dar certo', async () => ligado(async () => {
  resetTrialAnchorCache()
  const db = fakeDb({
    user: { plan: 'trial', createdAt: new Date('2026-09-06T12:00:00Z'), accessExpiresAt: null },
  })
  db.user.update = async () => { throw new Error('falhou ao gravar') }
  const r = await anchorTrialOnFirstConnection({ db, userId: 'u4', trialDays: 7, now: NOW })
  assert.equal(r.anchored, false)
  // Marcar como feito algo que não foi deixaria a conta sem o teste para sempre.
  resetTrialAnchorCache()
}))

// --- Fiação ------------------------------------------------------------------

test('o evento está nas allowlists — senão o marcador some em silêncio', () => {
  assert.ok(ANALYTICS_EVENTS.has(TRIAL_ANCHOR_EVENT))
})

test('a âncora roda no status da sessão, sem travar a resposta', () => {
  const rota = readFileSync(new URL('../src/api/routes/session.js', import.meta.url), 'utf8')
  assert.match(rota, /anchorTrialOnFirstConnection\(/)
  // Dispare-e-esqueça: a rota mais quente do painel não pode esperar por isso.
  assert.match(rota, /\}\)\.catch\(\(\) => \{\}\)/)
  assert.match(rota, /session\?\.status === 'connected'/)
})
