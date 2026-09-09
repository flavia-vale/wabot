// Frente C do plano de ativação de 2026-09-08 — "conectou e não cadastrou loja".
//
// 18 das 114 pessoas que não pagaram nos 60 dias medidos conectaram o WhatsApp
// e nunca cadastraram loja nenhuma. Sem etiqueta o robô se RECUSA a publicar
// (`skip:no_valid_conversions`), para não dar a comissão ao afiliado do grupo de
// origem — mas do lado de fora isso parece produto quebrado.
//
// Dois consertos, guardados aqui:
//   C2 — a tela diz por onde o caminho é curto quando não há NENHUMA loja;
//   C4 — o save que destrava o robô anuncia o marco, em vez de "atualizado com
//        sucesso".
//
// Puro: sem banco, sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  describeSaveSessionCheck,
  FIRST_CREDENTIAL_HEADLINE,
} from '../src/credentialSaveCheck.js'
import {
  AFFILIATE_PLATFORMS,
  isQuickSetupPlatform,
  quickSetupPlatforms,
} from '../dashboard/lib/painel/affiliatePlatforms.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

// --- C2: por onde começar ----------------------------------------------------

test('as lojas "mais rápidas" têm mesmo UM campo obrigatório', () => {
  // O rótulo é uma promessa verificável, não decoração: se alguém acrescentar
  // um campo obrigatório a essas lojas, o rótulo passa a mentir.
  const rapidas = quickSetupPlatforms()
  assert.ok(rapidas.length > 0)
  for (const p of rapidas) {
    const obrigatorios = p.fields.filter((f) => f.required !== false)
    assert.equal(obrigatorios.length, 1, `${p.label} tem ${obrigatorios.length} campos obrigatórios`)
  }
})

test('Shopee e Amazon NÃO são anunciadas como rápidas', () => {
  // Shopee pede App ID + chave secreta geradas num painel de API; Amazon pede
  // quatro campos. Chamar qualquer uma das duas de "1 campo" mandaria a pessoa
  // justamente para o caminho mais longo.
  const porId = Object.fromEntries(AFFILIATE_PLATFORMS.map((p) => [p.id, p]))
  assert.equal(isQuickSetupPlatform(porId.shopee), false)
  assert.equal(isQuickSetupPlatform(porId.amazon), false)
})

test('Mercado Livre não é rápida — o código de acesso segue obrigatório', () => {
  // Não reintroduzir o "modo sem cookie": ele foi removido a pedido da própria
  // cliente (AGENTS.md, "Credenciais de afiliado"). Sem o código o link nunca
  // sai curto, e a expectativa do produto é link curto sempre.
  const ml = AFFILIATE_PLATFORMS.find((p) => p.id === 'mercadolivre')
  assert.equal(isQuickSetupPlatform(ml), false)
})

test('o aviso de "comece por aqui" só aparece sem NENHUMA loja', () => {
  const page = read('../dashboard/app/painel/ids-afiliada/page.js')
  // Carregando ou falha de rede (`credMap === null`) não pode acusar falta de
  // cadastro — mandaria refazer um cadastro que já existe.
  assert.match(page, /credMap !== null && Object\.keys\(credMap\)\.length === 0/)
  assert.match(page, /<StartHereCard platforms=\{quickSetupPlatforms\(\)\}/)
})

test('o aviso explica que a recusa é proteção, não defeito', () => {
  const page = read('../dashboard/app/painel/ids-afiliada/page.js')
  const bloco = page.slice(page.indexOf('function StartHereCard'), page.indexOf('function PlatformCard'))
  assert.ok(/não publica nenhuma oferta/.test(bloco), 'não diz a consequência')
  assert.ok(/de propósito/.test(bloco) && /não é defeito/.test(bloco), 'não reenquadra a recusa')
  assert.ok(/comissão/.test(bloco), 'não diz de quem seria a comissão')
  for (const jargao of ['no_valid_conversions', 'credential', 'tag=', 'cookie de sessão']) {
    assert.ok(!bloco.includes(jargao), `jargão na tela: ${jargao}`)
  }
})

// --- C4: o save que destrava o robô -----------------------------------------

test('a primeira loja salva anuncia que o robô já pode publicar', () => {
  const feedback = describeSaveSessionCheck({
    platform: 'magazineluiza',
    validation: { configured: true, label: 'Magazine Luiza', warnings: [] },
    probe: null,
    fallbackMessage: 'Tudo certo!',
    isFirstCredential: true,
  })
  assert.equal(feedback.tone, 'success')
  assert.equal(feedback.firstCredential, true)
  assert.ok(feedback.message.startsWith(FIRST_CREDENTIAL_HEADLINE), feedback.message)
})

test('a segunda loja NÃO repete o marco', () => {
  const feedback = describeSaveSessionCheck({
    platform: 'magazineluiza',
    validation: { configured: true, label: 'Magazine Luiza', warnings: [] },
    probe: null,
    fallbackMessage: 'Tudo certo!',
    isFirstCredential: false,
  })
  assert.ok(!feedback.message.includes(FIRST_CREDENTIAL_HEADLINE))
  assert.ok(!feedback.firstCredential)
})

test('loja com sondagem: o marco entra junto do "testamos e funcionou"', () => {
  const feedback = describeSaveSessionCheck({
    platform: 'shopee',
    validation: { configured: true, warnings: [] },
    probe: { alive: true },
    fallbackMessage: 'x',
    isFirstCredential: true,
  })
  assert.ok(feedback.message.startsWith(FIRST_CREDENTIAL_HEADLINE), feedback.message)
  assert.ok(feedback.message.includes('aceitou sua chave'))
})

test('chave RECUSADA nunca anuncia que o robô já pode publicar', () => {
  // Anunciar destravamento junto de uma credencial que a loja recusou é a
  // mentira mais cara da tela: a pessoa sai achando que terminou.
  for (const platform of ['shopee', 'mercadolivre', 'amazon']) {
    const feedback = describeSaveSessionCheck({
      platform,
      validation: { configured: true, warnings: [] },
      probe: { alive: false },
      fallbackMessage: 'x',
      isFirstCredential: true,
    })
    assert.equal(feedback.tone, 'error')
    assert.ok(!feedback.message.includes(FIRST_CREDENTIAL_HEADLINE), platform)
  }
})

test('sondagem inconclusiva também não anuncia o marco', () => {
  // "Não deu para testar" continua sendo dúvida — e dúvida não vira festa.
  const feedback = describeSaveSessionCheck({
    platform: 'mercadolivre',
    validation: { configured: true, warnings: [] },
    probe: { alive: null },
    fallbackMessage: 'x',
    isFirstCredential: true,
  })
  assert.equal(feedback.tone, 'warn')
  assert.ok(!feedback.message.includes(FIRST_CREDENTIAL_HEADLINE))
})

test('a rota descobre "primeira loja" ANTES de gravar', () => {
  // Depois do upsert a resposta seria sempre "não" — e o marco sumiria para
  // todo mundo, em silêncio.
  const rota = read('../src/api/routes/credentials.js')
  const posContagem = rota.indexOf('db.credential.count')
  const posUpsert = rota.indexOf('db.credential.upsert')
  assert.ok(posContagem > 0, 'a rota não conta as lojas existentes')
  assert.ok(posContagem < posUpsert, 'a contagem ficou depois do upsert — o marco nunca dispara')
})

test('falha ao contar as lojas não derruba o save', () => {
  const rota = read('../src/api/routes/credentials.js')
  const trecho = rota.slice(rota.indexOf('let isFirstCredential'), rota.indexOf('const encryptedData'))
  assert.match(trecho, /try \{/)
  assert.match(trecho, /catch/)
})

test('o marco fala em linguagem de gente', () => {
  const texto = FIRST_CREDENTIAL_HEADLINE.toLowerCase()
  for (const jargao of ['credential', 'etiqueta de afiliado', 'tag', 'conversão', 'skip']) {
    assert.ok(!texto.includes(jargao), `"${jargao}" em: ${FIRST_CREDENTIAL_HEADLINE}`)
  }
  assert.ok(texto.includes('robô') && texto.includes('publicar'))
})
