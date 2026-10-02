// Classifica o `<ack>` embutido num `stream:error` (o ack que o servidor
// ESPERAVA e não recebeu) pelo tipo de chat da mensagem culpada. É o balde que
// decide qual patch do Baileys falta: canal (RCA 2026-09-24), DM (PR #2112),
// status, grupo… Puro: usado pelo `scripts/diag-quedas-500.mjs` (aceite dos
// patches) e pelo detector de ciclo do worker.

export function chatKindOfJid(jid) {
  const j = String(jid || '')
  if (!j) return 'desconhecido'
  if (j === 'status@broadcast') return 'status'
  if (j.endsWith('@newsletter')) return 'canal'
  if (j.endsWith('@g.us')) return 'grupo'
  if (j.endsWith('@s.whatsapp.net') || j.endsWith('@lid')) return 'dm'
  return 'desconhecido'
}

// Node do stream:error → dados do ack. Aceita o objeto (worker) ou a linha
// JSON do bot.log (pino: `{"node":{…},"msg":"stream errored out"}`).
export function extractStreamErrorAck(nodeOrLine) {
  let node = nodeOrLine
  if (typeof nodeOrLine === 'string') {
    try { node = JSON.parse(nodeOrLine)?.node } catch { return null }
  }
  if (!node || node.tag !== 'stream:error' || !Array.isArray(node.content)) return null
  const ack = node.content.find((c) => c?.tag === 'ack')
  if (!ack?.attrs) return null
  const { id = null, class: ackClass = null, type = null, from = null } = ack.attrs
  return { id, ackClass, type, jid: from && String(from).includes('@') ? String(from) : null }
}

// Tipo de chat do ack: class=status é status por definição; senão o `from` do
// ack, senão o jid que o worker logou para o MESMO id (descarte/recepção).
export function classifyStuckAck(ack, jidByMsgId = new Map()) {
  if (!ack) return 'desconhecido'
  if (ack.ackClass === 'status') return 'status'
  const jid = ack.jid || (ack.id ? jidByMsgId.get(ack.id) : null)
  return chatKindOfJid(jid)
}

// Varre o texto do bot.log: acha os acks recusados e cruza o id com qualquer
// linha que traga `"msgId":"<id>"` e `"jid":"…"` (ex.: "Mensagem descartada").
export function tallyStuckAcksFromLog(texto) {
  const linhas = String(texto || '').split('\n')
  const acks = []
  for (const l of linhas) {
    if (!l.includes('"stream errored out"')) continue
    const ack = extractStreamErrorAck(l)
    if (ack) acks.push(ack)
  }
  const procurados = new Set(acks.map((a) => a.id).filter(Boolean))
  const jidByMsgId = new Map()
  if (procurados.size) {
    for (const l of linhas) {
      const mId = l.match(/"msgId":"([^"]+)"/)
      if (!mId || !procurados.has(mId[1]) || jidByMsgId.has(mId[1])) continue
      const mJid = l.match(/"(?:jid|remoteJid)":"([^"]+@[^"]+)"/)
      if (mJid) jidByMsgId.set(mId[1], mJid[1])
    }
  }
  const porTipo = {}
  const porClasse = {}
  for (const a of acks) {
    const tipo = classifyStuckAck(a, jidByMsgId)
    porTipo[tipo] = (porTipo[tipo] || 0) + 1
    const classe = a.ackClass || '?'
    porClasse[classe] = (porClasse[classe] || 0) + 1
  }
  return { total: acks.length, idsDistintos: procurados.size, porTipo, porClasse }
}

// Linhas de WaConnectionEvent → por dia (UTC): quedas 500, quantas com
// stuckMsg, conexões abertas e a razão de aceite (500 com stuckMsg ÷ opens).
export function dailyStuck500Ratio(rows) {
  const porDia = new Map()
  const dia = (d) => new Date(d).toISOString().slice(0, 10)
  const get = (k) => {
    if (!porDia.has(k)) porDia.set(k, { dia: k, quedas500: 0, stuckMsg: 0, opens: 0 })
    return porDia.get(k)
  }
  for (const r of rows || []) {
    const k = dia(r.occurredAt)
    if (r.type === 'connected' || r.type === 'reconnect_success') {
      get(k).opens += 1
    } else if (r.type === 'disconnect' && String(r.code) === '500') {
      const d = get(k)
      d.quedas500 += 1
      let meta = r.metadata
      if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch { meta = {} } }
      if (meta?.stuckMsg === true) d.stuckMsg += 1
    }
  }
  return [...porDia.values()]
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .map((d) => ({ ...d, razao: d.opens ? Number((d.stuckMsg / d.opens).toFixed(3)) : null }))
}
