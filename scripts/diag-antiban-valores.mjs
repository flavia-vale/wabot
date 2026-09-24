#!/usr/bin/env node
/**
 * Diagnóstico READ-ONLY do Anti-banimento (specs/018-unificar-protecao-anti-ban).
 *
 * Responde duas perguntas antes do cutover em produção:
 *
 *   PARTE A — quem muda de comportamento com o piso de 3 campos fixos
 *   (burstCap, burstWindowSec, throttleEnabled)? Por campo, quantas contas
 *   ficam mais conservadoras (o piso protege mais que o valor gravado),
 *   quantas passam ao piso (o valor gravado era menos conservador) e quantas
 *   já estavam iguais/herdando. Isso é o que prova SC-005 com dado real, não
 *   suposição.
 *
 *   PARTE B — o "Intervalo entre destinos" (ex-"Atraso entre canais") tem
 *   valor provisório em 20s (migration 20260728120000). Antes de aprovar esse
 *   valor em definitivo, é preciso saber: quantos destinos cada conta tem,
 *   quanto isso atrasa a ÚLTIMA saída de uma oferta, e se esse atraso chega
 *   perto do teto de descarte por idade da fila (`queueMaxAgeMin`) de alguma
 *   conta — o que faria a mudança de valor DESCARTAR oferta que hoje sai.
 *
 * Este script NUNCA decide o valor final — só mede. A decisão (T061 do
 * tasks.md) é da dona do produto, com esta saída em mãos.
 *
 * Não escreve nada no banco, não envia nada, não imprime telefone (só
 * e-mail). Toda consulta que falhar é IMPRESSA — nunca vira "zero" ou "nenhuma
 * conta encontrada" (lição do diag-assinatura-recusada.mjs: `.catch(() => [])`
 * transforma "não consegui procurar" em "não achei", que é uma conclusão
 * diferente e errada).
 *
 * Uso (no VPS, DENTRO do diretório do ambiente):
 *   cd ~/wabot-staging && node scripts/diag-antiban-valores.mjs
 *   cd ~/wabot && node scripts/diag-antiban-valores.mjs --detalhes
 *   cd ~/wabot && node scripts/diag-antiban-valores.mjs --intervalo=15
 */
import 'dotenv/config'
import db from '../src/db.js'
import { canUseAdvancedPreservation } from '../src/billing/plans.js'
import { ANTI_BAN_FLOOR, isAntiBanFloorEnabled } from '../src/core/antiBanFloor.js'
import { resolveDestinationPreservation, HARD_DEFAULT_PRESERVATION } from '../src/core/preservationConfig.js'
import { toDestinationIntervalMs } from '../src/core/destinationSpacing.js'
import { shouldDropExpiredQueueJob, DEFAULT_QUEUE_MAX_AGE_MIN } from '../src/core/queueExpiry.js'
import {
  percentiles,
  classifyFixedFieldValue,
  classifyQueueAgeRisk,
  projectedLastDestinationDelayMs,
  theoreticalDestinationsPerHour,
} from '../src/domain/antiban/diagnostics.js'

const args = process.argv.slice(2)
const detalhes = args.includes('--detalhes')
const opt = (nome, padrao) => {
  const hit = args.find((a) => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
// Valor PROVISÓRIO em produção hoje (migration 20260728120000). Passado por
// --intervalo=<segundos> só para simular "e se fosse outro valor?" — não
// muda nada no banco.
const intervaloSimuladoSec = Number(opt('intervalo', '')) || null
const janelaDiasVazao = Number(opt('dias', '7')) || 7

function pct(n, total) {
  if (!total) return '0%'
  return `${Math.round((n / total) * 1000) / 10}%`
}

async function main() {
  console.log('='.repeat(72))
  console.log('Diagnóstico Anti-banimento — valores do piso e do intervalo entre destinos')
  console.log(`Ambiente: ${process.env.APP_ENV || '(APP_ENV não definido)'} · ${new Date().toISOString()}`)
  console.log('='.repeat(72))

  // ---------------------------------------------------------------
  // PARTE A — quem muda com o piso de 3 campos fixos
  // ---------------------------------------------------------------
  console.log('\n### PARTE A — piso anti-banimento (3 campos fixos) ###\n')

  let destinos
  try {
    destinos = await db.group.findMany({
      where: { role: 'post' },
      select: {
        id: true, userId: true, kind: true, name: true,
        throttleEnabled: true, burstCap: true, burstWindowSec: true,
        minIntervalSec: true, dailyCap: true, queueMaxAgeMin: true,
        preservationPresetId: true,
        user: { select: { email: true, plan: true, accessExpiresAt: true } },
      },
    })
  } catch (err) {
    console.error('FALHA ao consultar destinos (Group role=post):', err?.message || err)
    console.error('Parte A não pôde ser calculada — corrija o acesso ao banco antes de confiar em qualquer número abaixo.')
    destinos = null
  }

  if (destinos) {
    const floorEnabled = isAntiBanFloorEnabled(process.env)
    console.log(`Piso ligado neste ambiente (ANTI_BAN_FLOOR): ${floorEnabled ? 'sim' : 'NÃO (env=off)'}`)
    console.log(`Total de destinos (role=post): ${destinos.length}`)

    const campos = [
      { chave: 'burstCap', label: 'Tamanho da rajada (burstCap)', floor: ANTI_BAN_FLOOR.burstCap, regra: 'menor-vence' },
      { chave: 'burstWindowSec', label: 'Janela da rajada (burstWindowSec)', floor: ANTI_BAN_FLOOR.burstWindowSec, regra: 'maior-vence' },
    ]

    for (const campo of campos) {
      const contagem = { herdando: 0, igual: 0, mais_conservador: 0, menos_conservador: 0 }
      const contasAfetadas = { comAcesso: new Set(), semAcesso: new Set() }
      for (const d of destinos) {
        const classe = classifyFixedFieldValue(d[campo.chave], campo.floor, campo.regra)
        contagem[classe]++
        if (classe === 'menos_conservador') {
          const temAcesso = canUseAdvancedPreservation({ plan: d.user?.plan, accessExpiresAt: d.user?.accessExpiresAt })
          ;(temAcesso ? contasAfetadas.comAcesso : contasAfetadas.semAcesso).add(d.userId)
        }
      }
      console.log(`\n${campo.label} (fixo = ${campo.floor}):`)
      console.log(`  herdando (sem valor próprio): ${contagem.herdando}`)
      console.log(`  igual ao fixo: ${contagem.igual}`)
      console.log(`  já mais conservador que o fixo (mantém o próprio valor): ${contagem.mais_conservador}`)
      console.log(`  menos conservador que o fixo (VAI MUDAR para o fixo): ${contagem.menos_conservador}`)
      console.log(`    contas afetadas com acesso ao plano: ${contasAfetadas.comAcesso.size}`)
      console.log(`    contas afetadas SEM acesso ao plano (config antiga, congelada): ${contasAfetadas.semAcesso.size}`)
    }

    // Liga/desliga (Achado C′): destinos com limites desligados hoje.
    const desligados = destinos.filter((d) => d.throttleEnabled === false)
    console.log(`\nLiga/desliga dos limites do destino (throttleEnabled):`)
    console.log(`  destinos com limites DESLIGADOS hoje: ${desligados.length} (vão RECOMEÇAR DO PADRÃO ao ligar o piso)`)
    if (detalhes && desligados.length) {
      for (const d of desligados) {
        console.log(`    - ${d.name || d.id} (${d.user?.email || 'sem e-mail'}): minIntervalSec=${d.minIntervalSec}, dailyCap=${d.dailyCap} → viram ${HARD_DEFAULT_PRESERVATION.minIntervalSec}/${HARD_DEFAULT_PRESERVATION.dailyCap ?? 'sem limite'}`)
      }
    }

    // Antes × depois do efetivo (nenhuma linha pode ficar MENOS conservadora).
    let antesMenosConservador = 0
    for (const d of destinos) {
      const depois = resolveDestinationPreservation(d, { preset: null, defaultPreset: null })
      const antes = resolveDestinationPreservation(d, { preset: null, defaultPreset: null, env: { ANTI_BAN_FLOOR: 'off' } })
      if (depois.burstCap > antes.burstCap || depois.burstWindowSec < antes.burstWindowSec) antesMenosConservador++
    }
    console.log(`\nVerificação SC-005 (nenhum destino pode ficar MENOS conservador com o piso): ${antesMenosConservador === 0 ? 'OK — nenhuma regressão' : `⚠️ ${antesMenosConservador} destino(s) regrediram — INVESTIGAR`}`)
  }

  // ---------------------------------------------------------------
  // PARTE B — vazão do intervalo entre destinos
  // ---------------------------------------------------------------
  console.log('\n### PARTE B — intervalo entre destinos (vazão) ###\n')

  let contas
  try {
    contas = await db.user.findMany({
      select: {
        id: true, email: true, plan: true, accessExpiresAt: true,
        botConfig: { select: { channelStaggerJitterMs: true, postToStatus: true } },
      },
    })
  } catch (err) {
    console.error('FALHA ao consultar contas para a Parte B:', err?.message || err)
    console.error('Parte B não pôde ser calculada.')
    contas = null
  }

  // queueMaxAgeMin por destino, agrupado por conta — reaproveita `destinos`
  // (já consultado na Parte A) em vez de fazer uma segunda ida ao banco pelo
  // mesmo dado; se a Parte A falhou, cai numa consulta própria mais enxuta.
  let queueMaxAgeMinPorConta = new Map()
  if (destinos) {
    for (const d of destinos) {
      if (!queueMaxAgeMinPorConta.has(d.userId)) queueMaxAgeMinPorConta.set(d.userId, [])
      queueMaxAgeMinPorConta.get(d.userId).push(d.queueMaxAgeMin)
    }
  } else {
    try {
      const linhas = await db.group.findMany({ where: { role: 'post' }, select: { userId: true, queueMaxAgeMin: true } })
      for (const l of linhas) {
        if (!queueMaxAgeMinPorConta.has(l.userId)) queueMaxAgeMinPorConta.set(l.userId, [])
        queueMaxAgeMinPorConta.get(l.userId).push(l.queueMaxAgeMin)
      }
    } catch (err) {
      console.error('FALHA ao consultar queueMaxAgeMin por conta (fallback):', err?.message || err)
    }
  }

  if (contas) {
    // Quantos destinos cada conta tem — grupos + canais + status@broadcast
    // (quando postToStatus). groupsPost é a relação reversa de Group role=post
    // (ver `relation` abaixo); se o schema não expuser esse nome de relação,
    // caímos para uma segunda consulta agrupada.
    let destinosPorConta = new Map()
    try {
      const porConta = await db.group.groupBy({ by: ['userId'], where: { role: 'post' }, _count: { _all: true } })
      for (const linha of porConta) destinosPorConta.set(linha.userId, linha._count._all)
    } catch (err) {
      console.error('FALHA ao contar destinos por conta:', err?.message || err)
    }

    const contagens = contas.map((c) => (destinosPorConta.get(c.id) || 0) + (c.botConfig?.postToStatus ? 1 : 0))
    const { p50, p90, max, n } = percentiles(contagens)
    console.log(`Destinos por conta (grupos + canais + status quando ligado): p50=${p50} · p90=${p90} · máximo=${max} · contas medidas=${n}`)

    const top10 = contas
      .map((c, i) => ({ email: c.email, n: contagens[i] }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
    console.log('Top 10 contas por número de destinos:')
    for (const t of top10) console.log(`  ${t.n.toString().padStart(4)}  ${t.email}`)

    const intervaloAtualSec = intervaloSimuladoSec ?? 20 // 20s é o padrão provisório vigente (migration 20260728120000)
    console.log(`\nSimulando intervalo entre destinos de ${intervaloAtualSec}s (${intervaloSimuladoSec ? '--intervalo informado' : 'padrão provisório vigente'}):`)
    const teorico = theoreticalDestinationsPerHour(intervaloAtualSec)
    console.log(`  vazão teórica: ${teorico} destinos/hora`)

    // Pico de envios success/hora nos últimos N dias, por conta (observado).
    let picoObservadoPorConta = new Map()
    try {
      const desde = new Date(Date.now() - janelaDiasVazao * 24 * 60 * 60 * 1000)
      const envios = await db.messageLog.findMany({
        where: { status: 'success', sentAt: { gte: desde } },
        select: { userId: true, sentAt: true },
      })
      const baldes = new Map() // userId -> Map(horaTruncada -> contagem)
      for (const e of envios) {
        const hora = Math.floor(new Date(e.sentAt).getTime() / 3_600_000)
        if (!baldes.has(e.userId)) baldes.set(e.userId, new Map())
        const m = baldes.get(e.userId)
        m.set(hora, (m.get(hora) || 0) + 1)
      }
      for (const [userId, m] of baldes) picoObservadoPorConta.set(userId, Math.max(...m.values()))
    } catch (err) {
      console.error(`FALHA ao medir pico de envios/hora dos últimos ${janelaDiasVazao} dias:`, err?.message || err)
    }

    const contasAcimaDoTeorico = []
    for (const c of contas) {
      const pico = picoObservadoPorConta.get(c.id)
      if (Number.isFinite(pico) && Number.isFinite(teorico) && pico > teorico) {
        contasAcimaDoTeorico.push({ email: c.email, pico, teorico })
      }
    }
    console.log(`  contas com pico observado ACIMA da vazão teórica: ${contasAcimaDoTeorico.length}`)
    if (detalhes) {
      for (const c of contasAcimaDoTeorico) console.log(`    - ${c.email}: pico=${c.pico}/h vs teórico=${c.teorico}/h`)
    }

    // Proximidade com o descarte por idade (item 4): atraso projetado da
    // ÚLTIMA saída (N destinos da conta) comparado ao MENOR queueMaxAgeMin
    // efetivo entre os destinos daquela conta.
    const classificacao = { ok: 0, atencao: 0, descartaria: 0, sem_teto: 0, sem_dado: 0 }
    const emRisco = []
    for (const c of contas) {
      const nDestinos = contagens[contas.indexOf(c)]
      const atrasoMs = projectedLastDestinationDelayMs(nDestinos, intervaloAtualSec * 1000)
      const tetos = (queueMaxAgeMinPorConta.get(c.id) || [])
        .map((v) => v ?? DEFAULT_QUEUE_MAX_AGE_MIN)
        .filter((v) => Number.isFinite(v) && v > 0)
      const menorTeto = tetos.length ? Math.min(...tetos) : null
      const risco = classifyQueueAgeRisk(atrasoMs, menorTeto)
      classificacao[risco.nivel] = (classificacao[risco.nivel] || 0) + 1
      if (risco.nivel === 'atencao' || risco.nivel === 'descartaria') {
        emRisco.push({ email: c.email, nDestinos, atrasoMs, menorTeto, ...risco })
      }
    }
    console.log('\nProximidade do descarte por idade da fila (atraso projetado × menor teto da conta):')
    console.log(`  ok (< 50% do teto): ${classificacao.ok}`)
    console.log(`  atenção (>= 50%): ${classificacao.atencao}`)
    console.log(`  descartaria (>= 100% — a mudança FARIA a oferta ser descartada): ${classificacao.descartaria}`)
    console.log(`  sem teto configurado: ${classificacao.sem_teto}`)
    if (emRisco.length) {
      console.log('  Contas em atenção/descartaria:')
      for (const r of emRisco) {
        console.log(`    - ${r.email}: ${r.nDestinos} destinos, atraso projetado ${Math.round(r.atrasoMs / 1000)}s, teto ${r.menorTeto}min (${r.percentualDoTeto}% do teto) → ${r.nivel}`)
      }
    }

    // Sanity check do fail-safe do descarte (nunca descarta sem enqueuedAt).
    const semEnqueuedAt = shouldDropExpiredQueueJob({ enqueuedAt: null, queueMaxAgeMin: 300 })
    console.log(`\n(sanity check) shouldDropExpiredQueueJob sem enqueuedAt confiável: drop=${semEnqueuedAt.drop} (esperado: false)`)
  }

  console.log('\n' + '='.repeat(72))
  console.log('Resumo em linguagem simples:')
  console.log('- Parte A mostra quantas contas terão o RITMO POR DESTINO puxado para')
  console.log('  o mais seguro (nunca para o mais arriscado) quando o piso entrar.')
  console.log('- Parte B mostra se o valor provisório do "Intervalo entre destinos"')
  console.log('  (hoje 20s) é seguro para as contas com mais grupos/canais, ou se')
  console.log('  alguma delas passaria a descartar oferta por causa da fila. Se')
  console.log('  aparecer QUALQUER conta em "atenção" ou "descartaria" acima, decida')
  console.log('  entre: (a) um valor menor, (b) rever o teto de descarte dessa conta,')
  console.log('  ou (c) aceitar como está — essa decisão é da dona do produto (T061).')
  console.log('='.repeat(72))
}

main()
  .catch((err) => {
    console.error('Erro inesperado ao rodar o diagnóstico:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    try { await db.$disconnect() } catch { /* ignore */ }
  })
