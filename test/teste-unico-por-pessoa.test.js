import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { getTemplateDefinition } from '../src/email/registry.js'
import { ANALYTICS_EVENTS } from '../src/analytics.js'
import { DEFAULT_TERMS_VERSION, DEFAULT_TERMS_DOCUMENT } from '../src/legalTerms.js'
import { checkDuplicateTrialAtSignup } from '../src/domain/signup/duplicateTrialAlert.js'

const ler = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('o sinal de teste repetido está na allowlist — fora dela some sem erro', () => {
  assert.ok(ANALYTICS_EVENTS.has('signup_duplicate_trial_suspect'))
})

test('o aviso interno existe, é do grupo interno e é endereçado à admin', () => {
  const t = getTemplateDefinition('admin_teste_repetido')
  assert.ok(t)
  assert.equal(t.group, 'interno')
  assert.equal(t.audience, 'admin')
  // Nunca prometer bloqueio automático: a decisão é de uma pessoa.
  assert.match(t.body, /Nada foi bloqueado/i)
})

test('o cadastro AVISA e nunca bloqueia — a rota não pode ganhar um caminho de recusa', () => {
  const auth = ler('../src/api/routes/auth.js')
  assert.match(auth, /checkDuplicateTrialAtSignup/)
  // A checagem é best-effort: precisa ter catch próprio, senão uma falha dela
  // derruba o cadastro de uma cliente legítima.
  assert.match(auth, /checkDuplicateTrialAtSignup\(\{[\s\S]{0,400}\}\)\s*\.catch\(/)
})

test('a checagem avisa quando reconhece o padrão, com db e e-mail injetados', async () => {
  const eventos = []
  const alertas = []
  const dbFake = {
    user: { findMany: async () => ([{ id: 'antiga', name: 'Fulana Silva Souza', email: 'fulanasilvasouza2@x.com', accessExpiresAt: new Date(Date.now() - 86400000) }]) },
    $queryRaw: async () => [],
  }
  const decisao = await checkDuplicateTrialAtSignup({
    db: dbFake,
    user: { id: 'nova', name: 'Outro Nome', email: 'fulanasilvasouza4@x.com', createdAt: new Date() },
    trackEvent: (ev) => eventos.push(ev),
    sendAdminAlert: async (payload) => { alertas.push(payload); return { sent: true } },
  })
  assert.equal(decisao.suspeito, true)
  assert.equal(eventos.length, 1)
  assert.equal(eventos[0].event, 'signup_duplicate_trial_suspect')
  assert.equal(alertas[0].slug, 'admin_teste_repetido')
})

test('cadastro sem par anterior não gera aviso nenhum', async () => {
  const eventos = []
  const dbFake = { user: { findMany: async () => [] }, $queryRaw: async () => [] }
  const decisao = await checkDuplicateTrialAtSignup({
    db: dbFake,
    user: { id: 'nova', name: 'Alguem', email: 'pessoaqualquer@x.com', createdAt: new Date() },
    trackEvent: (ev) => eventos.push(ev),
    sendAdminAlert: async () => ({ sent: true }),
  })
  assert.equal(decisao.suspeito, false)
  assert.equal(eventos.length, 0)
})

test('os termos dizem que o teste é uma vez por pessoa, e a versão acompanhou', () => {
  const texto = JSON.stringify(DEFAULT_TERMS_DOCUMENT)
  assert.match(texto, /teste gratuito é liberado uma vez por pessoa/i)
  // Mudou o texto, muda a versão: senão o registro de aceite aponta para uma
  // versão cujo conteúdo é outro.
  assert.notEqual(DEFAULT_TERMS_VERSION, '2026-06-09-whatsapp-risk-acceptance')
  const front = ler('../dashboard/lib/api.js')
  assert.ok(front.includes(DEFAULT_TERMS_VERSION), 'front e backend precisam registrar a MESMA versão')
})

test('o motivo do bloqueio chega à cliente no login e no painel', () => {
  const auth = ler('../src/api/routes/auth.js')
  // Login: o motivo escrito ganha do texto genérico.
  assert.match(auth, /blockedReason[\s\S]{0,200}Conta bloqueada\. Entre em contato com o suporte\./)
  // /me precisa devolver o campo, senão o painel não tem o que mostrar.
  assert.match(auth, /blockedReason: true/)
  const shell = ler('../dashboard/app/painel/PainelShell.js')
  assert.match(shell, /BlockedReasonBanner/)
  // Sem motivo escrito, a tela não muda.
  assert.match(shell, /if \(!motivo\) return null/)
})

test('a rota de bloqueio exige motivo escrito e é auditada', () => {
  const admin = ler('../src/api/routes/admin.js')
  assert.match(admin, /users\/:id\/block/)
  assert.match(admin, /Escreva o motivo — ele é mostrado para a cliente/)
  assert.match(admin, /admin\.user\.block/)
  assert.match(admin, /admin\.user\.unblock/)
})
