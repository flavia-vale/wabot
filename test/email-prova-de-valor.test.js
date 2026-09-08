// D1/D2 e C5 do plano de ativação de 2026-09-08.
//
// D1/D2 — 32 das 114 pessoas que não pagaram VIRAM oferta sair e nunca abriram
// o pagamento. O produto funcionou para elas; o que faltou foi alguém mostrar o
// que elas ganharam. O aviso com a prova existia só DENTRO do painel, que é
// onde essa cliente não entra justamente porque está tudo funcionando sozinho.
//
// C5 — 18 conectaram e nunca cadastraram loja. Sem etiqueta o robô se recusa a
// publicar, e do lado de fora isso parece produto quebrado.
//
// Puro: sem banco, sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'

import { decideLifecycleEmail } from '../src/emailTriggers/lifecyclePolicy.js'
import {
  buildTrialProofVars,
  shouldSendTrialProof,
  TRIAL_PROOF_DAYS_LEFT,
} from '../src/emailTriggers/trialProof.js'
import { readFileSync } from 'node:fs'
import { listTemplateDefinitions } from '../src/email/registry.js'

const NOW = new Date('2026-09-08T12:00:00Z')
const byslug = Object.fromEntries(listTemplateDefinitions().map((t) => [t.slug, t]))

/** Conta em teste, conectada, configurada, com o teste acabando em N dias. */
const emTeste = (diasRestantes, extra = {}) => ({
  status: 'active',
  plan: 'trial',
  createdAt: new Date(NOW.getTime() - 4 * 86400000),
  accessExpiresAt: new Date(NOW.getTime() + diasRestantes * 86400000 - 3600000),
  waEverConnected: true,
  waConnected: true,
  hasMonitorGroup: true,
  hasPostGroup: true,
  hasAnyCredential: true,
  offersPublished: 47,
  destGroupCount: 3,
  ...extra,
})

// --- D2: a prova é medida na moeda dela ---------------------------------------

test('a prova traduz ofertas em mensagens que ela não digitou', () => {
  // "47 ofertas" é métrica nossa e ela não tem com o que comparar; "141
  // mensagens que você não digitou" é o serviço que o robô prestou.
  const vars = buildTrialProofVars({ offersPublished: 47, destGroupCount: 3 })
  assert.equal(vars.ofertas_publicadas, '47')
  assert.equal(vars.grupos, '3')
  assert.equal(vars.mensagens_poupadas, '141')
})

test('sem destino conhecido a conta não é inflada', () => {
  // Um grupo é o piso. O número precisa sobreviver à cliente conferindo no
  // celular dela.
  const vars = buildTrialProofVars({ offersPublished: 10, destGroupCount: 0 })
  assert.equal(vars.mensagens_poupadas, '10')
})

test('sem oferta publicada NÃO existe prova', () => {
  assert.equal(buildTrialProofVars({ offersPublished: 0, destGroupCount: 3 }), null)
  assert.equal(shouldSendTrialProof({ plan: 'trial', daysLeft: TRIAL_PROOF_DAYS_LEFT, offersPublished: 0 }), false)
})

// --- D1: quando a prova sai ---------------------------------------------------

test('a prova sai no 3º dia do teste', () => {
  const decisao = decideLifecycleEmail(emTeste(TRIAL_PROOF_DAYS_LEFT), NOW)
  assert.equal(decisao.slug, 'teste_prova_de_valor')
  assert.equal(decisao.vars.ofertas_publicadas, '47')
  assert.equal(decisao.vars.mensagens_poupadas, '141')
})

test('a prova não rouba o lugar da contagem regressiva', () => {
  // A regra da casa é UM e-mail por passada. Nos últimos três dias quem manda é
  // a contagem — o aviso mais urgente ganha.
  for (const restam of [3, 2, 1]) {
    const decisao = decideLifecycleEmail(emTeste(restam), NOW)
    assert.match(decisao.slug, /^teste_acaba_em_/, `dia com ${restam} restantes`)
  }
})

test('quem nunca viu oferta sair não recebe a prova', () => {
  // Mandar "veja o que o robô fez" para quem não viu nada acontecer confirma
  // para ela que o produto não funciona.
  const decisao = decideLifecycleEmail(emTeste(TRIAL_PROOF_DAYS_LEFT, { offersPublished: 0 }), NOW)
  assert.notEqual(decisao?.slug, 'teste_prova_de_valor')
})

test('conta paga não recebe a prova do teste', () => {
  const decisao = decideLifecycleEmail(emTeste(TRIAL_PROOF_DAYS_LEFT, { plan: 'pro' }), NOW)
  assert.notEqual(decisao?.slug, 'teste_prova_de_valor')
})

// --- C5: conectou e não cadastrou loja ---------------------------------------

test('sem nenhuma loja, o aviso sai um dia depois de conectar', () => {
  const decisao = decideLifecycleEmail(emTeste(6, { hasAnyCredential: false }), NOW)
  assert.equal(decisao.slug, 'sem_loja_cadastrada')
})

test('falta de loja vem ANTES de falta de grupo', () => {
  // É o bloqueio mais grave e o mais invisível: com grupos escolhidos e sem
  // etiqueta, o painel fica verde e nada chega ao grupo.
  const decisao = decideLifecycleEmail(
    emTeste(6, { hasAnyCredential: false, hasMonitorGroup: false, hasPostGroup: false }),
    NOW,
  )
  assert.equal(decisao.slug, 'sem_loja_cadastrada')
})

test('"não sei" não vira acusação de falta de cadastro', () => {
  // hasAnyCredential === null é consulta que falhou. Acusar por dúvida manda a
  // cliente refazer um cadastro que já existe.
  const decisao = decideLifecycleEmail(emTeste(6, { hasAnyCredential: null }), NOW)
  assert.notEqual(decisao?.slug, 'sem_loja_cadastrada')
})

test('quem nunca conectou não recebe o aviso de loja', () => {
  // Para ela o e-mail certo é o de conectar o WhatsApp.
  const decisao = decideLifecycleEmail(
    emTeste(6, { hasAnyCredential: false, waEverConnected: false, waConnected: false }),
    NOW,
  )
  assert.equal(decisao.slug, 'onboarding_conecte_whatsapp')
})

test('o aviso de loja não é retroativo', () => {
  // Conta antiga não recebe hoje um e-mail de primeiros passos.
  const antiga = emTeste(6, {
    hasAnyCredential: false,
    createdAt: new Date(NOW.getTime() - 200 * 86400000),
  })
  const decisao = decideLifecycleEmail(antiga, NOW)
  assert.notEqual(decisao?.slug, 'sem_loja_cadastrada')
})

// --- Os textos ---------------------------------------------------------------

test('os dois e-mails novos existem no catálogo e disparam sozinhos', () => {
  for (const slug of ['teste_prova_de_valor', 'sem_loja_cadastrada']) {
    const t = byslug[slug]
    assert.ok(t, `${slug} não está no catálogo`)
    assert.equal(t.trigger, 'auto')
    assert.equal(t.category, 'transactional')
    assert.ok(t.dedupDays >= 7, `${slug} pode repetir cedo demais`)
  }
})

test('o aviso de loja herda a trava de conta parada', () => {
  // O grupo `saude` é o que passa pela checagem de "essa conta está usando o
  // robô agora?" no despachante. Sem isso, conta parada há semanas receberia.
  assert.equal(byslug.sem_loja_cadastrada.group, 'saude')
})

test('o aviso de loja NÃO promete que as ofertas continuam saindo', () => {
  // Esse texto é verdade quando o código de acesso VENCEU (o plano B continua
  // enviando) e mentira aqui, onde nada é publicado.
  const corpo = byslug.sem_loja_cadastrada.body.toLowerCase()
  assert.ok(!corpo.includes('continuam saindo'))
  assert.ok(corpo.includes('não publica nenhuma oferta'))
  assert.ok(corpo.includes('não é defeito'))
})

test('o texto do grupo "contato e escuta" continua MANUAL', () => {
  // Aquele grupo tem contrato de nunca disparar sozinho; o irmão automático é o
  // sem_loja_cadastrada.
  assert.equal(byslug.contato_sem_etiqueta_nada_sai.trigger, 'manual')
})

test('os dois falam em linguagem de gente', () => {
  for (const slug of ['teste_prova_de_valor', 'sem_loja_cadastrada']) {
    const texto = `${byslug[slug].subject} ${byslug[slug].title} ${byslug[slug].body}`.toLowerCase()
    for (const jargao of ['credential', 'no_valid_conversions', 'trial', 'churn', 'cookie', 'ssid']) {
      assert.ok(!texto.includes(jargao), `"${jargao}" em ${slug}`)
    }
  }
})

test('a foto do cliente só paga as consultas novas em conta de teste', () => {
  const sweep = readFileSync(new URL('../src/emailTriggers/lifecycleSweep.js', import.meta.url), 'utf8')
  // A passada roda sobre a base inteira todo dia: consulta a mais por cliente
  // pagante é custo puro sem decisão nova.
  assert.match(sweep, /const precisaDeAtivacao = emTeste && acessoValendo/)
  assert.match(sweep, /if \(precisaDeAtivacao\) \{/)
})

test('modelo ausente no banco não derruba a foto do cliente', async () => {
  // Se `db.credential` não existir, a chamada estoura ANTES de virar promessa e
  // o `.catch()` não pega — levando junto o aviso de cobrança daquele cliente,
  // que não tem nada a ver com ativação.
  const { buildUserSnapshot } = await import('../src/emailTriggers/lifecycleSweep.js')
  const db = {
    waSession: { findUnique: async () => null },
    group: { findFirst: async () => null },
    messageLog: { findFirst: async () => null },
    payment: { findFirst: async () => null },
    affiliateProfile: { findUnique: async () => null },
    // credential e os `count` não existem de propósito.
  }
  const snapshot = await buildUserSnapshot({
    db,
    user: { id: 'u1', plan: 'trial', accessExpiresAt: new Date(NOW.getTime() + 5 * 86400000), createdAt: NOW },
    now: NOW,
  })
  assert.equal(snapshot.hasAnyCredential, null)
  assert.equal(snapshot.offersPublished, 0)
})
