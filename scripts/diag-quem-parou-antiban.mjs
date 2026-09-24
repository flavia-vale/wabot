#!/usr/bin/env node
/**
 * READ-ONLY. Responde: "quem foi SEGURADO pelo piso anti-banimento
 * (antiBanFloor.js) enquanto ele esteve ligado, mas NÃO teria sido segurado
 * pela própria configuração?"
 *
 * O piso nunca grava nada no banco — só muda o valor EFETIVO na hora do
 * envio. Por isso dá pra saber, depois do fato, quem foi afetado: comparamos
 * a config GRAVADA de cada destino (sem o piso) contra os eventos de defer
 * que de fato aconteceram no bot.log.
 *
 * Um defer é causado pelo PISO (não pela própria config) quando:
 *   - o destino tem throttleEnabled=false GRAVADO (proteção desligada por
 *     escolha) e mesmo assim sofreu defer de burst_cap OU min_interval
 *     (só o piso liga isso de volta — ver "recomeçar do padrão" em
 *     antiBanFloor.js); OU
 *   - o destino tem throttleEnabled=true mas burstCap/burstWindowSec
 *     GRAVADOS mais frouxos que o piso (6 a cada 600s) e sofreu defer de
 *     burst_cap (min_interval não muda nesse caso — o piso só mexe em
 *     burstCap/burstWindowSec quando throttleEnabled já era true).
 *
 * daily_cap e quiet_hours NUNCA são causados pelo piso (antiBanFloor.js não
 * mexe em dailyCap/operatingHours quando throttleEnabled já era true; quando
 * era false, o piso zera dailyCap para "sem limite", nunca cria um limite
 * novo) — por isso esses dois reasons são ignorados aqui.
 *
 * Uso (no VPS, dentro de ~/wabot):
 *   node scripts/diag-quem-parou-antiban.mjs
 *   node scripts/diag-quem-parou-antiban.mjs --desde="2026-09-23 00:00" --ate="2026-09-24 23:59"
 *   node scripts/diag-quem-parou-antiban.mjs --log=/caminho/para/bot.log
 */
import 'dotenv/config'
import { createReadStream, existsSync } from 'fs'
import readline from 'readline'
import { join } from 'path'
import db from '../src/db.js'
import { getLogsBaseDir } from '../src/paths.js'
import { resolveDestinationPreservation } from '../src/core/preservationConfig.js'
import { ANTI_BAN_FLOOR } from '../src/core/antiBanFloor.js'

const args = process.argv.slice(2)
const opt = (nome, padrao) => {
  const hit = args.find((a) => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}

function parseDataArg(v, fallback) {
  if (!v) return fallback
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? fallback : d
}

const hoje0h = new Date()
hoje0h.setHours(0, 0, 0, 0)
const desde = parseDataArg(opt('desde', null), hoje0h)
const ate = parseDataArg(opt('ate', null), new Date())
const logPath = opt('log', join(getLogsBaseDir(), 'bot.log'))

const FLOOR_RELEVANT_REASONS = new Set(['burst_cap', 'min_interval'])
const DEFER_LOG_MESSAGES = new Set([
  'Defer longo: re-enfileirando job com notBefore (não congela a fila serial)',
  'Velocity scheduler: aguardando janela curta de throttle do destino',
])

async function main() {
  console.log('='.repeat(72))
  console.log('Quem foi segurado pelo piso anti-banimento (não pela própria config)')
  console.log(`Janela: ${desde.toISOString()} até ${ate.toISOString()}`)
  console.log(`Log: ${logPath}`)
  console.log('='.repeat(72))

  if (!existsSync(logPath)) {
    console.error(`\nFALHA: bot.log não encontrado em ${logPath}.`)
    console.error('Passe --log=<caminho> se o BOT_LOG_DIR deste ambiente for outro.')
    process.exitCode = 1
    return
  }

  // 1) Varre o bot.log em STREAM (nunca carrega o arquivo inteiro — ele é
  // compartilhado por todas as contas e pode ter GBs).
  const eventos = [] // { logId, destJid, reason, ts }
  const rl = readline.createInterface({ input: createReadStream(logPath), crlfDelay: Infinity })
  let linhasLidas = 0
  for await (const linha of rl) {
    linhasLidas++
    if (!linha.includes('"logId"')) continue // filtro barato antes do JSON.parse
    let obj
    try { obj = JSON.parse(linha) } catch { continue }
    if (!DEFER_LOG_MESSAGES.has(obj.msg)) continue
    if (!FLOOR_RELEVANT_REASONS.has(obj.reason)) continue
    if (!obj.logId || !obj.destJid) continue
    const ts = obj.time ? new Date(obj.time) : null
    if (!ts || Number.isNaN(ts.getTime())) continue
    if (ts < desde || ts > ate) continue
    eventos.push({ logId: obj.logId, destJid: obj.destJid, reason: obj.reason, ts })
  }
  console.log(`\nLinhas lidas do bot.log: ${linhasLidas}`)
  console.log(`Eventos de defer (burst_cap/min_interval) na janela: ${eventos.length}`)
  if (eventos.length === 0) {
    console.log('\nNenhum defer de burst_cap/min_interval nessa janela — nada a investigar.')
    return
  }

  // 2) Busca os MessageLog citados para saber a conta (userId) de cada evento.
  let linhas
  try {
    linhas = await db.messageLog.findMany({
      where: { id: { in: [...new Set(eventos.map((e) => e.logId))] } },
      select: { id: true, userId: true },
    })
  } catch (err) {
    console.error('\nFALHA ao consultar MessageLog pelos logId do bot.log:', err?.message || err)
    console.error('Não é possível continuar sem essa consulta — corrija o acesso ao banco antes de confiar em qualquer número.')
    process.exitCode = 1
    return
  }
  const userIdPorLogId = new Map(linhas.map((l) => [l.id, l.userId]))

  // 3) Para cada destino citado, resolve a config GRAVADA (sem piso) para
  // decidir se o defer foi causado pelo piso.
  const destJids = [...new Set(eventos.map((e) => e.destJid))]
  let destinos
  try {
    destinos = await db.group.findMany({
      where: { role: 'post', waJid: { in: destJids } },
      select: {
        id: true, userId: true, waJid: true, kind: true, name: true,
        throttleEnabled: true, minIntervalSec: true, burstCap: true, burstWindowSec: true,
        dailyCap: true, queueMaxAgeMin: true, operatingHoursEnabled: true, operatingHoursJson: true,
        preservationPresetId: true, preservationPreset: true,
        user: { select: { email: true } },
      },
    })
  } catch (err) {
    console.error('\nFALHA ao consultar os destinos citados no log:', err?.message || err)
    process.exitCode = 1
    return
  }
  // status@broadcast e afins não têm linha em Group — ficam de fora (não são
  // destino-post configurável, não passam pela config por destino).
  const destinoPorChave = new Map(destinos.map((d) => [`${d.userId}:${d.waJid}`, d]))

  // Presets default por conta (fallback quando o destino não tem preset
  // próprio) — uma consulta só, reaproveitada por todos os destinos da conta.
  const userIds = [...new Set(destinos.map((d) => d.userId))]
  let defaultPresets = []
  try {
    defaultPresets = await db.preservationPreset.findMany({ where: { userId: { in: userIds }, isDefault: true } })
  } catch (err) {
    console.error('\nFALHA ao consultar presets default — seguindo sem fallback de preset (pode subestimar quem tinha proteção desligada).', err?.message || err)
  }
  const defaultPresetPorUsuario = new Map(defaultPresets.map((p) => [p.userId, p]))

  // 4) Cruza: para cada evento, a config gravada permitiria isso SEM o piso?
  const achados = new Map() // email -> { motivos: Map(destino -> {count, storedThrottleEnabled, storedBurstCap, storedBurstWindowSec}) }
  let semDestinoCadastrado = 0
  for (const ev of eventos) {
    const userId = userIdPorLogId.get(ev.logId)
    if (!userId) continue
    const destino = destinoPorChave.get(`${userId}:${ev.destJid}`)
    if (!destino) { semDestinoCadastrado++; continue }

    const semPiso = resolveDestinationPreservation(destino, {
      preset: destino.preservationPreset,
      defaultPreset: defaultPresetPorUsuario.get(userId) ?? null,
      env: { ANTI_BAN_FLOOR: 'off' },
    })

    const causadoPeloPiso = destino.throttleEnabled === false
      ? true // qualquer defer burst_cap/min_interval só existe porque o piso religou
      : (ev.reason === 'burst_cap' && (semPiso.burstCap > ANTI_BAN_FLOOR.burstCap || semPiso.burstWindowSec < ANTI_BAN_FLOOR.burstWindowSec))

    if (!causadoPeloPiso) continue

    const email = destino.user?.email || `(userId ${userId})`
    if (!achados.has(email)) achados.set(email, new Map())
    const porDestino = achados.get(email)
    const chaveDestino = `${destino.name || destino.kind} (${destino.waJid})`
    if (!porDestino.has(chaveDestino)) {
      porDestino.set(chaveDestino, {
        count: 0, primeiroEm: ev.ts, ultimoEm: ev.ts,
        storedThrottleEnabled: destino.throttleEnabled,
        storedBurstCap: destino.burstCap, storedBurstWindowSec: destino.burstWindowSec,
      })
    }
    const acc = porDestino.get(chaveDestino)
    acc.count++
    if (ev.ts < acc.primeiroEm) acc.primeiroEm = ev.ts
    if (ev.ts > acc.ultimoEm) acc.ultimoEm = ev.ts
  }

  console.log(`\nEventos sem destino cadastrado (ex.: status@broadcast, destino já apagado): ${semDestinoCadastrado}`)
  console.log(`\nContas afetadas pelo PISO (teriam saído normal com a própria config): ${achados.size}`)
  console.log('='.repeat(72))
  for (const [email, porDestino] of achados) {
    console.log(`\n${email}`)
    for (const [destino, info] of porDestino) {
      const cfg = info.storedThrottleEnabled === false
        ? 'tinha os limites DESLIGADOS'
        : `burstCap gravado=${info.storedBurstCap ?? 'herdando'}, burstWindowSec gravado=${info.storedBurstWindowSec ?? 'herdando'}`
      console.log(`  - ${destino}: ${info.count} vez(es) segurado — ${cfg}`)
      console.log(`    primeiro: ${info.primeiroEm.toISOString()} · último: ${info.ultimoEm.toISOString()}`)
    }
  }
}

main()
  .catch((err) => {
    console.error('\nFALHA inesperada:', err?.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    try { await db.$disconnect() } catch {}
  })
