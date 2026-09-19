import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { convertPerPlatformSerially } from '../src/core/conversionScheduler.js'

const here = dirname(fileURLToPath(import.meta.url))
const BOT_WORKER = readFileSync(join(here, '..', 'src', 'bot-worker.js'), 'utf8')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('preserva a ordem do texto, não a ordem de conclusão', async () => {
  const links = [
    { platform: 'amazon', url: 'a1' },
    { platform: 'shopee', url: 's1' },
    { platform: 'amazon', url: 'a2' },
    { platform: 'mercadolivre', url: 'm1' },
  ]
  const out = await convertPerPlatformSerially(links, async ({ url }) => {
    await sleep(url === 'a1' ? 30 : 1)
    return url.toUpperCase()
  })
  assert.deepEqual(out, ['A1', 'S1', 'A2', 'M1'])
})

// RCA 2026-09-17: dentro de UMA loja os conversores dividem a mesma sessão de
// afiliado (cookie do SiteStripe / `ssid` do ML são rotacionados a cada
// chamada). Chamada concorrente ali não acelera nada — vira disputa e falha.
test('links da MESMA loja nunca rodam ao mesmo tempo', async () => {
  const emVoo = new Map()
  const picos = new Map()
  const links = [
    { platform: 'amazon', url: 'a1' },
    { platform: 'amazon', url: 'a2' },
    { platform: 'amazon', url: 'a3' },
    { platform: 'amazon', url: 'a4' },
  ]
  await convertPerPlatformSerially(links, async ({ platform }) => {
    const atual = (emVoo.get(platform) ?? 0) + 1
    emVoo.set(platform, atual)
    picos.set(platform, Math.max(picos.get(platform) ?? 0, atual))
    await sleep(5)
    emVoo.set(platform, emVoo.get(platform) - 1)
    return null
  })
  assert.equal(picos.get('amazon'), 1)
})

// A serialização é POR LOJA. Serializar tudo numa fila só faria uma loja lenta
// atrasar as outras — que é exatamente o que o paralelismo original resolvia.
test('lojas DIFERENTES continuam em paralelo', async () => {
  const links = [
    { platform: 'amazon', url: 'a1' },
    { platform: 'shopee', url: 's1' },
    { platform: 'mercadolivre', url: 'm1' },
  ]
  const comecou = Date.now()
  await convertPerPlatformSerially(links, async () => { await sleep(60) })
  // Em série seriam ~180ms. Folga larga para não ficar sensível a máquina lenta.
  assert.ok(Date.now() - comecou < 150, 'lojas diferentes não podem ter sido serializadas')
})

test('lista vazia e entrada não-array não quebram', async () => {
  assert.deepEqual(await convertPerPlatformSerially([], async () => 1), [])
  assert.deepEqual(await convertPerPlatformSerially(null, async () => 1), [])
})

// Guarda estrutural: o worker não pode voltar a disparar a lista inteira de
// links de uma vez (era o que rotacionava o cookie da Amazon em disputa e
// estourava a trava de credencial do ML).
test('bot-worker converte pelo agendador, não por Promise.all na lista de links', () => {
  assert.ok(
    BOT_WORKER.includes('convertPerPlatformSerially(links,'),
    'o worker precisa converter os links pelo agendador por loja',
  )
  assert.ok(
    !/Promise\.all\(\s*links\.map/.test(BOT_WORKER),
    'Promise.all(links.map(...)) reintroduz a disputa pela sessão de afiliado',
  )
})
