// Jornada de e-mails de quem deixou o plano vencer e não renovou.
//
// Antes existiam só dois e-mails depois do vencimento (dia 0 e semana 1) e o
// assunto morria ali. Estes testes travam o que a jornada precisa garantir:
// cobertura sem buraco nas janelas, espaçamento de verdade entre elas, e o
// desligamento no fim (insistir para sempre faz a pessoa marcar como spam).

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPIRED_PLAN_JOURNEY,
  EXPIRED_PLAN_JOURNEY_LAST_DAY,
  resolveExpiredPlanEmail,
} from '../src/emailTriggers/expiredPlanJourney.js'
import { decideLifecycleEmail } from '../src/emailTriggers/lifecyclePolicy.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-07T12:00:00Z')

function vencidoHa(dias, extra = {}) {
  return {
    id: 'u1',
    name: 'Juliane',
    email: 'juliane@exemplo.com',
    status: 'active',
    plan: 'pro',
    createdAt: new Date(NOW.getTime() - 200 * DAY),
    // Meio-dia de folga para o arredondamento por dia cheio não empurrar a data
    // para a janela vizinha.
    accessExpiresAt: new Date(NOW.getTime() - dias * DAY - 0.5 * DAY),
    waEverConnected: true,
    waConnected: false,
    hasMonitorGroup: true,
    hasPostGroup: true,
    lastSuccessAt: new Date(NOW.getTime() - 30 * DAY),
    isAffiliate: false,
    affiliateAvailableCents: 0,
    minPayoutCents: 5000,
    ...extra,
  }
}

// ------------------------------------------------------------------ a tabela

test('a jornada tem o aviso do vencimento e mais sete e-mails depois dele', () => {
  assert.equal(EXPIRED_PLAN_JOURNEY[0].slug, 'plano_venceu')
  assert.equal(EXPIRED_PLAN_JOURNEY.length, 8, 'aviso do vencimento + 7 da jornada')
})

// Pedido da dona do produto (2026-09-19): os quatro primeiros e-mails saem nos
// dias 1, 3, 5 e 7 do vencimento, e os dois últimos desses quatro levam o
// voucher de desconto. Se alguém espaçar de novo o bloco inicial, este teste
// avisa.
test('o bloco inicial cobre os dias 1, 3, 5 e 7 do vencimento', () => {
  for (const [dia, slug] of [
    [1, 'plano_venceu'],
    [3, 'plano_vencido_primeiros_dias'],
    [5, 'plano_vencido_voucher'],
    [7, 'plano_vencido_voucher_ultimos_dias'],
  ]) {
    assert.equal(resolveExpiredPlanEmail(dia), slug, `dia ${dia} do vencimento`)
  }
})

test('só os dois e-mails do voucher são marcados como voucher', () => {
  const comVoucher = EXPIRED_PLAN_JOURNEY.filter((etapa) => etapa.voucher).map((etapa) => etapa.slug)
  assert.deepEqual(comVoucher, ['plano_vencido_voucher', 'plano_vencido_voucher_ultimos_dias'])
})

// Pedido explícito da dona do produto (2026-09-07): a jornada inteira cabe em
// ~3 semanas. Quem não voltou nesse prazo não volta por insistência, e cada
// e-mail a mais depois daqui custa mais reputação de domínio do que traz
// cliente. Se alguém esticar a jornada de novo, este teste avisa.
test('o último e-mail começa na terceira semana e a jornada acaba ali', () => {
  const ultimo = EXPIRED_PLAN_JOURNEY[EXPIRED_PLAN_JOURNEY.length - 1]
  assert.equal(ultimo.slug, 'plano_vencido_ultimo_aviso')
  assert.ok(ultimo.de >= 20, 'o último aviso não pode subir para o começo da jornada')
  assert.ok(EXPIRED_PLAN_JOURNEY_LAST_DAY <= 22, 'a jornada não pode passar de três semanas')
})

test('toda etapa existe no catálogo, é automática e fala de plano', () => {
  for (const etapa of EXPIRED_PLAN_JOURNEY) {
    const definition = getTemplateDefinition(etapa.slug)
    assert.ok(definition, `catálogo não tem ${etapa.slug}`)
    assert.equal(definition.trigger, 'auto', `${etapa.slug} precisa ser automático`)
    assert.equal(definition.group, 'plano', `${etapa.slug} precisa ficar no grupo de plano`)
  }
})

// O aviso do vencimento é obrigação de serviço (o robô parou). Os cinco de
// recuperação são divulgação: quem não quer mais ser chamada de volta precisa
// conseguir sair sem perder os avisos da conta.
test('só o aviso do vencimento é obrigação de serviço; o resto respeita descadastro', () => {
  assert.equal(getTemplateDefinition('plano_venceu').category, 'transactional')
  for (const etapa of EXPIRED_PLAN_JOURNEY.slice(1)) {
    assert.equal(getTemplateDefinition(etapa.slug).category, 'marketing', `${etapa.slug} precisa respeitar descadastro`)
  }
})

// A janela de um dia só é o defeito que não pode voltar: a passada roda 1x/dia
// e um dia de API fora do ar pularia a data exata para sempre.
//
// O espaçamento mudou em 2026-09-19. Antes NENHUMA janela podia encostar na
// seguinte; hoje o bloco inicial (dias 1, 3, 5 e 7, pedido da dona do produto)
// encosta de propósito, porque cadência de dois em dois dias não cabe em janela
// com folga. O RABO da jornada, que é recuperação lenta, mantém a folga: ali
// dois assuntos em dias seguidos continuam sendo só spam.
const PRIMEIRO_DO_RABO = 'plano_vencido_volta'

test('nenhuma janela é de um dia só, e o rabo da jornada mantém a folga', () => {
  const inicioDoRabo = EXPIRED_PLAN_JOURNEY.findIndex((etapa) => etapa.slug === PRIMEIRO_DO_RABO)
  assert.ok(inicioDoRabo > 0, `${PRIMEIRO_DO_RABO} precisa existir na jornada`)
  let anterior = null
  for (const [indice, etapa] of EXPIRED_PLAN_JOURNEY.entries()) {
    assert.ok(etapa.ate > etapa.de, `${etapa.slug}: janela de um dia só some se a passada falhar`)
    if (anterior) {
      assert.ok(etapa.de > anterior.ate, `${etapa.slug} se sobrepõe a ${anterior.slug}`)
      if (indice >= inicioDoRabo) {
        assert.ok(etapa.de > anterior.ate + 1, `${etapa.slug} encosta em ${anterior.slug} — dois e-mails em dias seguidos`)
      }
    }
    anterior = etapa
  }
})

test('cada dia da jornada devolve no máximo um e-mail, e sempre o mesmo', () => {
  for (let dia = 0; dia <= EXPIRED_PLAN_JOURNEY_LAST_DAY; dia += 1) {
    const encontrados = EXPIRED_PLAN_JOURNEY.filter((etapa) => dia >= etapa.de && dia <= etapa.ate)
    assert.ok(encontrados.length <= 1, `dia ${dia} cai em duas janelas`)
    assert.equal(resolveExpiredPlanEmail(dia), encontrados[0]?.slug ?? null, `dia ${dia}`)
  }
})

test('fora da jornada não sai nada: antes do vencimento e depois do último aviso', () => {
  assert.equal(resolveExpiredPlanEmail(-1), null)
  assert.equal(resolveExpiredPlanEmail(EXPIRED_PLAN_JOURNEY_LAST_DAY + 1), null)
  assert.equal(resolveExpiredPlanEmail(365), null)
  assert.equal(resolveExpiredPlanEmail(null), null)
  assert.equal(resolveExpiredPlanEmail(Number.NaN), null)
})

// ------------------------------------------------------------------ na política

test('a política entrega o e-mail certo em cada etapa da jornada', () => {
  for (const etapa of EXPIRED_PLAN_JOURNEY) {
    for (const dia of [etapa.de, etapa.ate]) {
      const decision = decideLifecycleEmail(vencidoHa(dia), NOW)
      assert.equal(decision?.slug, etapa.slug, `plano vencido há ${dia} dias`)
    }
  }
})

test('no intervalo entre duas etapas a política não manda e-mail de plano', () => {
  // Dia 13 fica entre a etapa de "voltar" e a de duas semanas.
  const decision = decideLifecycleEmail(vencidoHa(13), NOW)
  assert.notEqual(getTemplateDefinition(decision?.slug ?? '')?.group, 'plano')
})

test('depois do último aviso a conta para de receber cobrança automática', () => {
  const decision = decideLifecycleEmail(vencidoHa(EXPIRED_PLAN_JOURNEY_LAST_DAY + 10), NOW)
  assert.notEqual(getTemplateDefinition(decision?.slug ?? '')?.group, 'plano')
})

test('quem renovou sai da jornada na hora', () => {
  const renovou = vencidoHa(5, { accessExpiresAt: new Date(NOW.getTime() + 25 * DAY) })
  assert.equal(decideLifecycleEmail(renovou, NOW), null)
})

test('a jornada é só de plano pago — teste grátis tem trilha própria', () => {
  for (const dia of EXPIRED_PLAN_JOURNEY.map((etapa) => etapa.de)) {
    const decision = decideLifecycleEmail(vencidoHa(dia, { plan: 'trial' }), NOW)
    assert.notEqual(decision?.slug, resolveExpiredPlanEmail(dia), `trial não entra na jornada (dia ${dia})`)
  }
})

// ------------------------------------------------------------------ o texto

test('nenhum e-mail da jornada usa pressão falsa ou culpa', () => {
  const PROIBIDO = [/última chance/i, /culpa sua/i, /garantimos/i, /vamos apagar/i, /perderá? (?:tudo|seus dados)/i]
  for (const etapa of EXPIRED_PLAN_JOURNEY) {
    const definition = getTemplateDefinition(etapa.slug)
    const visivel = `${definition.subject}\n${definition.title ?? ''}\n${definition.body}`
    for (const proibido of PROIBIDO) {
      assert.doesNotMatch(visivel, proibido, `pressão indevida em ${etapa.slug}`)
    }
  }
})

test('todo e-mail da jornada leva a pessoa para algum lugar', () => {
  for (const etapa of EXPIRED_PLAN_JOURNEY) {
    assert.match(getTemplateDefinition(etapa.slug).body, /\[\[botao:/, `${etapa.slug} sem botão`)
  }
})

test('o último aviso diz que é o último', () => {
  const definition = getTemplateDefinition('plano_vencido_ultimo_aviso')
  assert.match(`${definition.subject}\n${definition.body}`, /último/i)
})

// ------------------------------------------------------------- o voucher

test('as duas etapas do voucher levam o mesmo código, com o prazo que sobrou', () => {
  const venceu = new Date(NOW.getTime() - 5.5 * DAY)
  const conta = vencidoHa(5, { accessExpiresAt: venceu })
  const cinco = decideLifecycleEmail(conta, NOW)
  const sete = decideLifecycleEmail(conta, new Date(NOW.getTime() + 2 * DAY))

  assert.equal(cinco?.slug, 'plano_vencido_voucher')
  assert.equal(sete?.slug, 'plano_vencido_voucher_ultimos_dias')
  assert.match(cinco.vars.codigo_voucher, /^VOLTA20-[A-Z0-9]{6}$/)
  assert.equal(
    cinco.vars.codigo_voucher,
    sete.vars.codigo_voucher,
    'o segundo e-mail precisa repetir o código do primeiro — senão a cliente tem dois códigos e nenhum confere'
  )
  assert.equal(cinco.vars.desconto_voucher, '20%')
  assert.equal(cinco.vars.voucher_vale_ate, sete.vars.voucher_vale_ate)
  // O prazo é calculado, nunca escrito no texto: a janela tem dois dias.
  assert.equal(sete.vars.dias_do_voucher, '3')
})

test('conta sem id não recebe e-mail de voucher em vez de receber código inventado', () => {
  const semId = vencidoHa(5, { id: null })
  assert.notEqual(decideLifecycleEmail(semId, NOW)?.slug, 'plano_vencido_voucher')
})

test('os dois e-mails do voucher trazem o WhatsApp para a cliente resgatar', () => {
  for (const slug of ['plano_vencido_voucher', 'plano_vencido_voucher_ultimos_dias']) {
    const body = getTemplateDefinition(slug).body
    assert.match(body, /\{\{whatsapp_suporte\}\}/, `${slug} sem WhatsApp — o resgate é por conversa`)
    assert.match(body, /\{\{codigo_voucher\}\}/, `${slug} sem o código`)
  }
})
