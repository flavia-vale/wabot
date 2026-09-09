import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  decidePhoneReuse,
  normalizeWaPhone,
  maskEmailForNotice,
  buildPhoneReuseNotice,
  describePhoneReuseBlock,
  resolvePhoneReuseMode,
  isPayingPlan,
} from '../src/domain/session/phoneReuse.js'
import { ANALYTICS_EVENTS } from '../src/analytics.js'

const ler = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const anterior = (over = {}) => ({ userId: 'antiga', email: 'antiga@x.com', plan: 'trial', paid: false, ...over })

test('a trava nasce desligada e valor inválido cai em desligado', () => {
  assert.equal(resolvePhoneReuseMode(undefined), 'off')
  assert.equal(resolvePhoneReuseMode('qualquer'), 'off')
  assert.equal(resolvePhoneReuseMode('block'), 'block')
})

test('desligada, nada é decidido nem com histórico sujo', () => {
  const r = decidePhoneReuse({ phone: '5511999998888', currentUser: { id: 'nova', plan: 'trial' }, previousOwners: [anterior()], mode: 'off' })
  assert.equal(r.acao, 'permitir')
})

test('número já usado em outra conta de teste é recusado', () => {
  const r = decidePhoneReuse({ phone: '5511999998888', currentUser: { id: 'nova', plan: 'trial' }, previousOwners: [anterior()], mode: 'block' })
  assert.equal(r.acao, 'bloquear')
  assert.equal(r.motivo, 'teste_repetido')
  assert.deepEqual(r.contas, ['antiga@x.com'])
})

test('conta PAGANTE nunca é bloqueada, só avisada', () => {
  for (const plano of ['basic', 'pro']) {
    const r = decidePhoneReuse({ phone: '5511999998888', currentUser: { id: 'nova', plan: plano }, previousOwners: [anterior()], mode: 'block' })
    assert.equal(r.acao, 'avisar', `plano ${plano} não pode ser bloqueado`)
  }
  assert.equal(isPayingPlan('trial'), false)
})

test('número de quem já pagou tem motivo próprio — a conversa é de renovação', () => {
  const r = decidePhoneReuse({ phone: '5511999998888', currentUser: { id: 'nova', plan: 'trial' }, previousOwners: [anterior({ paid: true })], mode: 'block' })
  assert.equal(r.motivo, 'numero_de_ex_pagante')
  assert.match(describePhoneReuseBlock(r.motivo), /já usou o Espelha Grupos/i)
})

test('modo aviso nunca bloqueia', () => {
  const r = decidePhoneReuse({ phone: '5511999998888', currentUser: { id: 'nova', plan: 'trial' }, previousOwners: [anterior()], mode: 'warn' })
  assert.equal(r.acao, 'avisar')
})

test('fail-safe: sem número confiável ou sem histórico, conecta', () => {
  assert.equal(decidePhoneReuse({ phone: '', currentUser: { id: 'n', plan: 'trial' }, previousOwners: [anterior()], mode: 'block' }).acao, 'permitir')
  assert.equal(decidePhoneReuse({ phone: '123', currentUser: { id: 'n', plan: 'trial' }, previousOwners: [anterior()], mode: 'block' }).acao, 'permitir')
  assert.equal(decidePhoneReuse({ phone: '5511999998888', currentUser: { id: 'n', plan: 'trial' }, previousOwners: [], mode: 'block' }).acao, 'permitir')
  assert.equal(normalizeWaPhone('+55 (11) 99999-8888'), '5511999998888')
})

test('a própria conta reconectando não conta como repetição', () => {
  const r = decidePhoneReuse({
    phone: '5511999998888',
    currentUser: { id: 'mesma', plan: 'trial' },
    previousOwners: [anterior({ userId: 'mesma' })],
    mode: 'block',
  })
  assert.equal(r.acao, 'permitir')
})

test('o e-mail completo NUNCA chega ao navegador', () => {
  assert.equal(maskEmailForNotice('mara_liv@hotmail.com'), 'mar***@hotmail.com')
  const aviso = buildPhoneReuseNotice({ motivo: 'teste_repetido', previousEmail: 'mara_liv@hotmail.com' })
  assert.equal(aviso.emailMascarado, 'mar***@hotmail.com')
  // O endereço completo existe no aviso gravado, para o botão de recuperar
  // senha disparar do servidor — e a rota de status precisa filtrá-lo.
  assert.equal(aviso.emailCompleto, 'mara_liv@hotmail.com')
  const session = ler('../src/api/routes/session.js')
  assert.match(session, /podeRecuperarSenha: Boolean\(aviso\.emailCompleto\)/)
  assert.doesNotMatch(session, /emailCompleto: aviso\.emailCompleto/)
})

test('o texto da recusa oferece saída e não usa jargão', () => {
  for (const motivo of ['teste_repetido', 'numero_de_ex_pagante']) {
    const texto = describePhoneReuseBlock(motivo)
    assert.match(texto, /escolha um plano/i, 'a recusa precisa oferecer a saída')
    assert.match(texto, /continua salvo/i, 'o medo real é perder a configuração')
    for (const jargao of [/sess[ãa]o/i, /trial/i, /bloque/i, /conta banida/i]) {
      assert.doesNotMatch(texto, jargao, `jargão na tela: ${jargao}`)
    }
  }
})

test('a recusa encerra a sessão sem apagar credencial', () => {
  const worker = ler('../src/bot-worker.js')
  const inicio = worker.indexOf('async function handlePhoneOwnership')
  const fim = worker.indexOf('async function loadConfig')
  assert.ok(inicio > 0 && fim > inicio)
  const bloco = worker.slice(inicio, fim)
  // Auto-cura que vira re-pareamento seria muito pior que o problema.
  for (const proibido of [/rm\(/, /auth_reset/, /requestPairingCode/, /AUTH_DIR/]) {
    assert.doesNotMatch(bloco, proibido, `a recusa não pode mexer em credencial: ${proibido}`)
  }
  assert.match(bloco, /sock\?\.end\?\./)
})

test('os sinais estão na allowlist — fora dela somem sem erro', () => {
  assert.ok(ANALYTICS_EVENTS.has('ops_wa_phone_reuse_detected'))
  assert.ok(ANALYTICS_EVENTS.has('ops_wa_phone_reuse_blocked'))
})

test('a tela oferece recuperar senha e falar com o suporte', () => {
  const painel = ler('../dashboard/app/painel/whatsapp/page.js')
  assert.match(painel, /PhoneReuseBlockedCard/)
  assert.match(painel, /Recuperar senha dessa conta/)
  assert.match(painel, /Falar com o suporte/)
  assert.match(painel, /SUPPORT_WHATSAPP_URL/)
})

test('os números aparecem nas duas telas do admin', () => {
  assert.match(ler('../dashboard/app/admin/clientes/page.js'), /Números ligados/)
  assert.match(ler('../dashboard/app/admin/clientes/[id]/page.js'), /Números de WhatsApp já ligados/)
  // Carregamento em LOTE: uma consulta por página, nunca uma por linha.
  assert.match(ler('../src/domain/admin/service.js'), /waPhoneOwnership\.findMany\(\{\s*where: \{ userId: \{ in: userIds \} \}/)
})
