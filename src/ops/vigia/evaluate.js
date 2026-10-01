// Decisão pura do vigia (scripts/vigia.mjs): recebe MEDIÇÕES já coletadas e
// devolve um veredito por assunto. Não lê banco, Redis, disco nem processo.
//
// Regra de ouro: o que não foi medido NUNCA vira "ok" — vira `unknown`
// (⚪). "Não consegui olhar" é diferente de "está tudo bem".

export const LEVEL = { OK: 'ok', WARN: 'warn', RED: 'red', UNKNOWN: 'unknown' }
export const ICON = { ok: '🟢', warn: '🟡', red: '🔴', unknown: '⚪' }

export const DEFAULTS = Object.freeze({
  swapWarnGb: 0.1,
  swapRedGb: 1,
  memAvailWarnGb: 4,
  memAvailRedGb: 2,
  diskWarnFreePct: 15,
  diskRedFreePct: 7,
  restartsWarn: 1,
  restartsRed: 3,
  staleHeartbeatMs: 5 * 60_000,
  staleSessionsWarnPct: 5,
  staleSessionsRedPct: 20,
  sendErrWarnPct: 10,
  sendErrRedPct: 30,
  sendMinSample: 20,
  stuckSendsWarn: 5,
  stuckSendsRed: 30,
  queueBacklogWarn: 20,
  queueBacklogRed: 100,
  waReconnectWarn: 30,
  waReconnectRed: 150,
  backupMaxAgeH: 26,
})

const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const check = (id, level, title, detail) => ({ id, level, title, detail })
const unknown = (id, title, why) => check(id, LEVEL.UNKNOWN, title, `Não consegui medir (${why}).`)

function evalPm2(pm2, prevRestarts, t) {
  const title = 'Processos do servidor'
  if (!Array.isArray(pm2)) return unknown('pm2', title, 'pm2 não respondeu')
  const down = pm2.filter(p => p.status !== 'online')
  if (down.length) return check('pm2', LEVEL.RED, title, `Fora do ar: ${down.map(p => `${p.name} (${p.status})`).join(', ')}.`)
  if (!prevRestarts) return check('pm2', LEVEL.OK, title, `${pm2.length} processos no ar (primeira leitura, sem comparação de reinícios).`)
  const worse = pm2
    .map(p => ({ name: p.name, delta: num(p.restarts) !== null && num(prevRestarts[p.name]) !== null ? p.restarts - prevRestarts[p.name] : 0 }))
    .filter(p => p.delta >= t.restartsWarn)
  const list = worse.map(p => `${p.name} (+${p.delta})`).join(', ')
  if (worse.some(p => p.delta >= t.restartsRed)) return check('pm2', LEVEL.RED, title, `Reiniciando em loop desde a última leitura: ${list}.`)
  if (worse.length) return check('pm2', LEVEL.WARN, title, `Reiniciou desde a última leitura: ${list}.`)
  return check('pm2', LEVEL.OK, title, `${pm2.length} processos no ar, sem reinícios novos.`)
}

function evalMemory(mem, t) {
  const title = 'Memória'
  if (!mem) return unknown('memoria', title, 'sem leitura de memória')
  const swap = num(mem.swapUsedGb)
  const avail = num(mem.availableGb)
  // Swap é o sinal que decide (AGENTS.md): servidor usando disco como memória.
  if (swap !== null && swap >= t.swapRedGb) return check('memoria', LEVEL.RED, title, `Usando ${swap.toFixed(1)} GB de swap — o servidor está sem memória de verdade.`)
  if (avail !== null && avail < t.memAvailRedGb) return check('memoria', LEVEL.RED, title, `Só ${avail.toFixed(1)} GB livres.`)
  if (swap !== null && swap >= t.swapWarnGb) return check('memoria', LEVEL.WARN, title, `Começou a usar swap (${swap.toFixed(2)} GB).`)
  if (avail !== null && avail < t.memAvailWarnGb) return check('memoria', LEVEL.WARN, title, `${avail.toFixed(1)} GB livres — folga baixa.`)
  if (swap === null || avail === null) return unknown('memoria', title, 'faltou swap ou memória livre')
  return check('memoria', LEVEL.OK, title, `${avail.toFixed(1)} GB livres, swap ${swap.toFixed(2)} GB.`)
}

function evalDisk(freePct, t) {
  const title = 'Espaço em disco'
  const v = num(freePct)
  if (v === null) return unknown('disco', title, 'sem leitura de disco')
  if (v <= t.diskRedFreePct) return check('disco', LEVEL.RED, title, `Só ${v.toFixed(0)}% livre — pode parar de gravar.`)
  if (v <= t.diskWarnFreePct) return check('disco', LEVEL.WARN, title, `${v.toFixed(0)}% livre.`)
  return check('disco', LEVEL.OK, title, `${v.toFixed(0)}% livre.`)
}

function evalApi(apiReady) {
  const title = 'Site/API'
  if (apiReady === null || apiReady === undefined) return unknown('api', title, 'API não consultada')
  return apiReady
    ? check('api', LEVEL.OK, title, 'Respondendo.')
    : check('api', LEVEL.RED, title, 'Não respondeu ao teste de saúde (/ready).')
}

function evalSupervisor(alive) {
  const title = 'Gerenciador de robôs'
  if (alive === null || alive === undefined) return unknown('supervisor', title, 'Redis não consultado')
  return alive
    ? check('supervisor', LEVEL.OK, title, 'Batendo o coração (heartbeat recente).')
    : check('supervisor', LEVEL.RED, title, 'Sem sinal de vida — ninguém está cuidando dos robôs.')
}

function evalSessions(s, t, now) {
  const title = 'Sessões do WhatsApp'
  if (!s || !Number.isFinite(s.total)) return unknown('sessoes', title, 'banco não respondeu')
  if (s.total === 0) return check('sessoes', LEVEL.OK, title, 'Nenhuma sessão ativa.')
  const stale = s.stale ?? 0
  const pct = (stale / s.total) * 100
  const base = `${s.connected ?? 0} conectadas de ${s.total} que deveriam estar ligadas; ${stale} sem sinal há mais de ${Math.round(t.staleHeartbeatMs / 60_000)} min.`
  if (pct >= t.staleSessionsRedPct) return check('sessoes', LEVEL.RED, title, base)
  if (pct >= t.staleSessionsWarnPct) return check('sessoes', LEVEL.WARN, title, base)
  return check('sessoes', LEVEL.OK, title, base)
}

function evalSends(s, t) {
  const title = 'Envios (última hora)'
  if (!s || !Number.isFinite(s.total)) return unknown('envios', title, 'banco não respondeu')
  const stuck = s.stuck ?? 0
  const finished = (s.success ?? 0) + (s.error ?? 0)
  const errPct = finished > 0 ? ((s.error ?? 0) / finished) * 100 : 0
  const rest = s.restarted ? ` (+${s.restarted} interrompidos por reinício do robô, reenfileirados — não contam como erro)` : ''
  const base = `${s.success ?? 0} enviados, ${s.error ?? 0} com erro${rest}, ${stuck} parados na fila há mais de ${s.stuckMin ?? 15} min.`
  if (stuck >= t.stuckSendsRed) return check('envios', LEVEL.RED, title, base)
  if (finished >= t.sendMinSample && errPct >= t.sendErrRedPct) return check('envios', LEVEL.RED, title, `${base} Erro em ${errPct.toFixed(0)}%.`)
  if (stuck >= t.stuckSendsWarn) return check('envios', LEVEL.WARN, title, base)
  if (finished >= t.sendMinSample && errPct >= t.sendErrWarnPct) return check('envios', LEVEL.WARN, title, `${base} Erro em ${errPct.toFixed(0)}%.`)
  return check('envios', LEVEL.OK, title, base)
}

function evalQueue(backlog, t) {
  const title = 'Fila de comandos dos robôs'
  const v = num(backlog)
  if (v === null) return unknown('fila', title, 'Redis não consultado')
  if (v >= t.queueBacklogRed) return check('fila', LEVEL.RED, title, `${v} pedidos esperando — o gerenciador não está dando conta.`)
  if (v >= t.queueBacklogWarn) return check('fila', LEVEL.WARN, title, `${v} pedidos esperando.`)
  return check('fila', LEVEL.OK, title, `${v} pedido(s) esperando.`)
}

function evalWa(wa, t) {
  const title = 'Quedas de conexão (última hora)'
  if (!wa || !Number.isFinite(wa.reconnects)) return unknown('quedas', title, 'banco não respondeu')
  const base = `${wa.reconnects} tentativas de reconexão, ${wa.forbidden ?? 0} bloqueios (403), ${wa.replaced ?? 0} sessões substituídas.`
  if (wa.reconnects >= t.waReconnectRed || (wa.forbidden ?? 0) >= 5) return check('quedas', LEVEL.RED, title, base)
  if (wa.reconnects >= t.waReconnectWarn || (wa.forbidden ?? 0) >= 1) return check('quedas', LEVEL.WARN, title, base)
  return check('quedas', LEVEL.OK, title, base)
}

function evalBackup(ageH, t) {
  const title = 'Backup'
  const v = num(ageH)
  if (v === null) return unknown('backup', title, 'marcador de backup não encontrado')
  if (v > t.backupMaxAgeH) return check('backup', LEVEL.RED, title, `Último backup há ${v.toFixed(0)} h (limite ${t.backupMaxAgeH} h).`)
  return check('backup', LEVEL.OK, title, `Último backup há ${v.toFixed(0)} h.`)
}

/** @returns {{level:string, checks:object[]}} pior nível entre as checagens (unknown não rebaixa um red/warn, mas nunca vira ok). */
export function evaluateVigia(snapshot = {}, thresholds = {}, now = Date.now()) {
  const t = { ...DEFAULTS, ...thresholds }
  const checks = [
    evalPm2(snapshot.pm2, snapshot.prevRestarts, t),
    evalApi(snapshot.apiReady),
    evalSupervisor(snapshot.supervisorAlive),
    evalMemory(snapshot.mem, t),
    evalDisk(snapshot.diskFreePct, t),
    evalSessions(snapshot.sessions, t, now),
    evalSends(snapshot.sends, t),
    evalQueue(snapshot.queueBacklog, t),
    evalWa(snapshot.wa, t),
    evalBackup(snapshot.backupAgeH, t),
  ]
  const has = l => checks.some(c => c.level === l)
  const level = has(LEVEL.RED) ? LEVEL.RED : has(LEVEL.WARN) ? LEVEL.WARN : has(LEVEL.UNKNOWN) ? LEVEL.UNKNOWN : LEVEL.OK
  return { level, checks }
}

export function formatVigia({ level, checks }, { onlyProblems = false } = {}) {
  const shown = onlyProblems ? checks.filter(c => c.level !== LEVEL.OK) : checks
  const lines = shown.map(c => `${ICON[c.level]} ${c.title}: ${c.detail}`)
  const head = { red: '🔴 ATENÇÃO: há problema agora.', warn: '🟡 Tem algo para olhar.', unknown: '⚪ Sem problema visível, mas faltou medir algo.', ok: '🟢 Tudo certo.' }[level]
  return [head, ...lines].join('\n')
}
