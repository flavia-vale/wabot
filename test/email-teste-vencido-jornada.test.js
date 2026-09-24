// Jornada de quem fez o teste grátis, não assinou e o acesso venceu.
//
// Antes de 2026-09-19 existia UM e-mail só (`teste_acabou`) e depois dele a
// conta nunca mais recebia nada — era o buraco declarado no AGENTS.md. Estes
// testes travam o que a jornada nova precisa garantir: cobertura sem buraco nas
// janelas, o voucher com o mesmo código nos dois e-mails, e o desligamento no
// fim (insistir para sempre faz a pessoa marcar como spam, e aí a gente perde
// também os avisos que ela precisa receber).

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPIRED_TRIAL_JOURNEY,
  EXPIRED_TRIAL_JOURNEY_LAST_DAY,
  resolveExpiredTrialEmail,
} from '../src/emailTriggers/expiredTrialJourney.js'
import { decideLifecycleEmail } from '../src/emailTriggers/lifecyclePolicy.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-19T12:00:00Z')

function testeAcabouHa(dias, extra = {}) {
  return {
    id: 'u1',
    name: 'Juliane',
    email: 'juliane@exemplo.com',
    status: 'active',
    plan: 'trial',
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    // Meio-dia de folga para o arredondamento por dia cheio não empurrar a data
    // para a janela vizinha.
    accessExpiresAt: new Date(NOW.getTime() - dias * DAY - 0.5 * DAY),
    waEverConnected: true,
    waConnected: false,
    hasMonitorGroup: true,
    hasPostGroup: true,
    lastSuccessAt: new Date(NOW.getTime() - 20 * DAY),
    isAffiliate: false,
    affiliateAvailableCents: 0,
    minPayoutCents: 5000,
    ...extra,
  }
}

// ------------------------------------------------------------------ a tabela

test('a jornada tem o aviso do fim do teste e mais três e-mails depois dele', () => {
  assert.equal(EXPIRED_TRIAL_JOURNEY[0].slug, 'teste_acabou')
  assert.equal(EXPIRED_TRIAL_JOURNEY.length, 4)
})

// Pedido da dona do produto (2026-09-19): dias 1, 3, 5 e 7 depois do fim do
// teste, com o voucher nos dois últimos.
test('a jornada cobre os dias 1, 3, 5 e 7 do fim do teste', () => {
  for (const [dia, slug] of [
    [1, 'teste_acabou'],
    [3, 'teste_acabou_lembrete'],
    [5, 'teste_voucher'],
    [7, 'teste_voucher_ultimos_dias'],
  ]) {
    assert.equal(resolveExpiredTrialEmail(dia), slug, `dia ${dia} depois do teste`)
  }
})

test('só os dois últimos são marcados como voucher', () => {
  const comVoucher = EXPIRED_TRIAL_JOURNEY.filter((etapa) => etapa.voucher).map((etapa) => etapa.slug)
  assert.deepEqual(comVoucher, ['teste_voucher', 'teste_voucher_ultimos_dias'])
})

test('nenhuma janela é de um dia só e nenhuma se sobrepõe', () => {
  let anterior = null
  for (const etapa of EXPIRED_TRIAL_JOURNEY) {
    assert.ok(etapa.ate > etapa.de, `${etapa.slug}: janela de um dia só some se a passada falhar`)
    if (anterior) assert.ok(etapa.de > anterior.ate, `${etapa.slug} se sobrepõe a ${anterior.slug}`)
    anterior = etapa
  }
})

test('cada dia da jornada devolve no máximo um e-mail, e sempre o mesmo', () => {
  for (let dia = 0; dia <= EXPIRED_TRIAL_JOURNEY_LAST_DAY; dia += 1) {
    const encontrados = EXPIRED_TRIAL_JOURNEY.filter((etapa) => dia >= etapa.de && dia <= etapa.ate)
    assert.ok(encontrados.length <= 1, `dia ${dia} cai em duas janelas`)
    assert.equal(resolveExpiredTrialEmail(dia), encontrados[0]?.slug ?? null, `dia ${dia}`)
  }
})

test('fora da jornada não sai nada', () => {
  assert.equal(resolveExpiredTrialEmail(-1), null)
  assert.equal(resolveExpiredTrialEmail(EXPIRED_TRIAL_JOURNEY_LAST_DAY + 1), null)
  assert.equal(resolveExpiredTrialEmail(365), null)
  assert.equal(resolveExpiredTrialEmail(null), null)
  assert.equal(resolveExpiredTrialEmail(Number.NaN), null)
})

// ------------------------------------------------------------------ o catálogo

test('toda etapa existe no catálogo, é automática e fica no grupo da conta', () => {
  for (const etapa of EXPIRED_TRIAL_JOURNEY) {
    const definition = getTemplateDefinition(etapa.slug)
    assert.ok(definition, `catálogo não tem ${etapa.slug}`)
    assert.equal(definition.trigger, 'auto', `${etapa.slug} precisa ser automático`)
    assert.equal(definition.group, 'conta', `${etapa.slug} precisa ficar no grupo da conta`)
  }
})

// O aviso do fim do teste é obrigação de serviço (o robô parou agora). Os três
// de recuperação são divulgação: quem não quer mais ser chamada de volta precisa
// conseguir sair sem perder os avisos da conta.
test('só o aviso do fim do teste é obrigação de serviço', () => {
  assert.equal(getTemplateDefinition('teste_acabou').category, 'transactional')
  for (const etapa of EXPIRED_TRIAL_JOURNEY.slice(1)) {
    assert.equal(getTemplateDefinition(etapa.slug).category, 'marketing', `${etapa.slug} precisa respeitar descadastro`)
  }
})

test('nenhum e-mail da jornada usa pressão falsa ou culpa', () => {
  const PROIBIDO = [/última chance/i, /culpa sua/i, /garantimos/i, /vamos apagar/i, /perderá? (?:tudo|seus dados)/i]
  for (const etapa of EXPIRED_TRIAL_JOURNEY) {
    const definition = getTemplateDefinition(etapa.slug)
    const visivel = `${definition.subject}\n${definition.title ?? ''}\n${definition.body}`
    for (const proibido of PROIBIDO) {
      assert.doesNotMatch(visivel, proibido, `pressão indevida em ${etapa.slug}`)
    }
  }
})

test('todo e-mail da jornada leva a pessoa para algum lugar', () => {
  for (const etapa of EXPIRED_TRIAL_JOURNEY) {
    assert.match(getTemplateDefinition(etapa.slug).body, /\[\[botao:/, `${etapa.slug} sem botão`)
  }
})

test('o último e-mail diz que é o último', () => {
  const definition = getTemplateDefinition('teste_voucher_ultimos_dias')
  assert.match(`${definition.subject}\n${definition.body}`, /último/i)
})

// ------------------------------------------------------------------ na política

test('a política entrega o e-mail certo em cada etapa da jornada', () => {
  for (const etapa of EXPIRED_TRIAL_JOURNEY) {
    for (const dia of [etapa.de, etapa.ate]) {
      assert.equal(decideLifecycleEmail(testeAcabouHa(dia), NOW)?.slug, etapa.slug, `teste acabou há ${dia} dias`)
    }
  }
})

test('depois do último e-mail a conta para de receber cobrança automática', () => {
  const decision = decideLifecycleEmail(testeAcabouHa(EXPIRED_TRIAL_JOURNEY_LAST_DAY + 3), NOW)
  assert.ok(!decision || !['conta', 'plano'].includes(getTemplateDefinition(decision.slug)?.group))
})

test('quem assinou sai da jornada na hora', () => {
  const assinou = testeAcabouHa(5, { plan: 'pro', accessExpiresAt: new Date(NOW.getTime() + 25 * DAY) })
  const decision = decideLifecycleEmail(assinou, NOW)
  // Ela pode receber outro gatilho (convite de afiliada, por exemplo) — o que
  // não pode é continuar sendo chamada de volta de um acesso que está ativo.
  const slugs = EXPIRED_TRIAL_JOURNEY.map((etapa) => etapa.slug)
  assert.ok(!slugs.includes(decision?.slug), `ainda na jornada: ${decision?.slug}`)
})

test('plano pago não entra na jornada do teste', () => {
  for (const etapa of EXPIRED_TRIAL_JOURNEY.slice(1)) {
    const decision = decideLifecycleEmail(testeAcabouHa(etapa.de, { plan: 'pro' }), NOW)
    assert.notEqual(decision?.slug, etapa.slug, `plano pago caiu na jornada do teste (dia ${etapa.de})`)
  }
})

// ------------------------------------------------------------------ o voucher

test('os dois e-mails do voucher levam o mesmo código, com o prazo que sobrou', () => {
  const conta = testeAcabouHa(5)
  const cinco = decideLifecycleEmail(conta, NOW)
  const sete = decideLifecycleEmail(conta, new Date(NOW.getTime() + 2 * DAY))

  assert.equal(cinco?.slug, 'teste_voucher')
  assert.equal(sete?.slug, 'teste_voucher_ultimos_dias')
  assert.match(cinco.vars.codigo_voucher, /^VOLTA20-[A-Z0-9]{6}$/)
  assert.equal(
    cinco.vars.codigo_voucher,
    sete.vars.codigo_voucher,
    'o segundo e-mail precisa repetir o código do primeiro'
  )
  assert.equal(cinco.vars.desconto_voucher, '20%')
  assert.equal(sete.vars.dias_do_voucher, '3')
})

test('conta sem id não recebe e-mail de voucher em vez de receber código inventado', () => {
  assert.notEqual(decideLifecycleEmail(testeAcabouHa(5, { id: null }), NOW)?.slug, 'teste_voucher')
})

test('os dois e-mails do voucher trazem o WhatsApp para a cliente resgatar', () => {
  for (const slug of ['teste_voucher', 'teste_voucher_ultimos_dias']) {
    const body = getTemplateDefinition(slug).body
    assert.match(body, /\{\{whatsapp_suporte\}\}/, `${slug} sem WhatsApp — o resgate é por conversa`)
    assert.match(body, /\{\{codigo_voucher\}\}/, `${slug} sem o código`)
  }
})

// -------------------------------------------------- prova de valor (2026-09-23)

test('quem já teve oferta publicada recebe a prova em vez do aviso genérico', () => {
  const comProva = testeAcabouHa(1, { offersPublished: 12, destGroupCount: 3 })
  const decision = decideLifecycleEmail(comProva, NOW)
  assert.equal(decision?.slug, 'teste_acabou_com_prova')
  assert.equal(decision.vars.ofertas_publicadas, '12')
  assert.equal(decision.vars.grupos, '3')
  assert.equal(decision.vars.mensagens_poupadas, '36')
})

test('sem nenhuma oferta publicada, continua saindo o aviso genérico', () => {
  const semProva = testeAcabouHa(1, { offersPublished: 0 })
  assert.equal(decideLifecycleEmail(semProva, NOW)?.slug, 'teste_acabou')

  const semDado = testeAcabouHa(1)
  assert.equal(decideLifecycleEmail(semDado, NOW)?.slug, 'teste_acabou')
})

test('a prova só troca o passo teste_acabou — os outros três da jornada não mudam', () => {
  for (const etapa of EXPIRED_TRIAL_JOURNEY.slice(1)) {
    const decision = decideLifecycleEmail(testeAcabouHa(etapa.de, { offersPublished: 40, destGroupCount: 2 }), NOW)
    assert.equal(decision?.slug, etapa.slug, `${etapa.slug} não pode virar prova`)
  }
})

test('o e-mail com prova está no catálogo, é automático, fica no grupo da conta e é obrigação de serviço', () => {
  const definition = getTemplateDefinition('teste_acabou_com_prova')
  assert.ok(definition, 'catálogo não tem teste_acabou_com_prova')
  assert.equal(definition.trigger, 'auto')
  assert.equal(definition.group, 'conta')
  assert.equal(definition.category, 'transactional', 'é o mesmo aviso de conta que teste_acabou, não divulgação')
  assert.match(definition.body, /\[\[botao:/, 'sem botão')
  assert.match(definition.body, /\{\{ofertas_publicadas\}\}/)
  assert.match(definition.body, /\{\{mensagens_poupadas\}\}/)
})

test('o e-mail com prova não usa pressão falsa ou culpa', () => {
  const definition = getTemplateDefinition('teste_acabou_com_prova')
  const visivel = `${definition.subject}\n${definition.title ?? ''}\n${definition.body}`
  for (const proibido of [/última chance/i, /culpa sua/i, /garantimos/i, /vamos apagar/i, /perderá? (?:tudo|seus dados)/i]) {
    assert.doesNotMatch(visivel, proibido)
  }
})
