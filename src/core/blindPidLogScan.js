// Varredura do bot.log de UM robô (pid) para a pergunta "conectada e cega: a
// mensagem de grupo chega ao socket?" (RCA 2026-10-03). Puro: recebe o texto da
// cauda do log e o pid; devolve contagens e um veredito por hipótese. Usado por
// `scripts/diag-cega-pid.mjs`. Não depende do censo de entrada estar no ar —
// com robô antigo responde com o que o log já tinha (upsert, decrypt, escopo) e
// diz que o censo falta.

import { extractStreamErrorAck, chatKindOfJid } from './stuckAckClassifier.js'

const CORTE = 260

function parse(line) {
  try { return JSON.parse(line) } catch { return null }
}

function ts(line) {
  const m = line.match(/"time":(\d{13})/)
  return m ? Number(m[1]) : null
}

export function scanPidLog(text, pid) {
  const marca = `"pid":${Number(pid)},`
  const marca2 = `"pid":${Number(pid)}}`
  const r = {
    pid: Number(pid),
    linhas: 0,
    primeiraTs: null,
    ultimaTs: null,
    aceitas: 0,
    upserts: 0,
    upsertsNotify: 0,
    decryptFails: 0,
    decryptFailsGrupo: 0,
    retryReceipts: 0,
    outroAparelhoChegou: 0,
    outroAparelhoRecipients: {},
    offlineHandled: 0,
    dmOutroAparelhoDescartada: 0,
    escopoDescartes: 0,
    freioEmergencia: 0,
    streamErrors: 0,
    streamErrorAcks: {},
    censoLinhas: 0,
    censoGrupoChegou: 0,
    censoGrupoDescartado: 0,
    censoGrupoFalhou: 0,
    censoGrupoUpsert: 0,
    censoUltimo: null,
    amostrasGrupo: 0,
    cegueiraSinais: 0,
    cegueiraUltima: null,
    filtros: null,
    offlinePreviews: [],
    filaOffline: [],
  }
  for (const line of text.split('\n')) {
    if (line.length < 20 || !(line.includes(marca) || line.includes(marca2))) continue
    r.linhas += 1
    const t = ts(line)
    if (t) {
      if (r.primeiraTs == null || t < r.primeiraTs) r.primeiraTs = t
      if (r.ultimaTs == null || t > r.ultimaTs) r.ultimaTs = t
    }
    if (line.includes('"msg":"mensagem recebida"')) r.aceitas += 1
    else if (line.includes('"msg":"messages.upsert recebido"')) {
      r.upserts += 1
      if (line.includes('"type":"notify"')) r.upsertsNotify += 1
    } else if (line.includes('failed to decrypt')) {
      r.decryptFails += 1
      if (line.includes('@g.us')) r.decryptFailsGrupo += 1
    } else if (line.includes('sent retry receipt')) r.retryReceipts += 1
    else if (line.includes('mensagem de outro aparelho da conta chegou ao socket')) {
      r.outroAparelhoChegou += 1
      const m = line.match(/"recipient":"([^"]*)"/)
      const dest = m ? m[1] : '(sem recipient)'
      r.outroAparelhoRecipients[dest] = (r.outroAparelhoRecipients[dest] || 0) + 1
    } else if (line.includes('handled ') && line.includes(' offline messages')) r.offlineHandled += 1
    else if (line.includes('fora do escopo confirmada com ack, sem abrir')) r.dmOutroAparelhoDescartada += 1
    else if (line.includes('Conversa fora da lista de escolhidos')) r.escopoDescartes += 1
    else if (line.includes('FREIO DE EMERG')) r.freioEmergencia += 1
    else if (line.includes('"msg":"stream errored out"')) {
      r.streamErrors += 1
      const ack = extractStreamErrorAck(line)
      if (ack) {
        const kind = ack.ackClass === 'status' ? 'status' : chatKindOfJid(ack.jid)
        r.streamErrorAcks[kind] = (r.streamErrorAcks[kind] || 0) + 1
      }
    } else if (line.includes('"msg":"Censo de entrada do socket na janela"')) {
      const o = parse(line)
      if (o) {
        r.censoLinhas += 1
        r.censoGrupoChegou += Number(o.arrivals?.grupo) || 0
        for (const [k, v] of Object.entries(o.ignored || {})) if (k.startsWith('grupo:')) r.censoGrupoDescartado += Number(v) || 0
        r.censoGrupoFalhou += Number(o.decryptFailures?.grupo) || 0
        r.censoGrupoUpsert += Number(o.upserts?.grupo) || 0
        r.censoUltimo = { time: o.time, arrivals: o.arrivals, ignored: o.ignored, decryptFailures: o.decryptFailures, upserts: o.upserts, accepted: o.accepted, conectado: o.conectado, cegueira: o.cegueira?.kind ?? null }
      }
    } else if (line.includes('Censo de entrada: nó de mensagem chegou ao socket (amostra)')) {
      if (line.includes('"kind":"grupo"')) r.amostrasGrupo += 1
    } else if (line.includes('"msg":"Sessão conectada e SEM receber mensagens"')) {
      r.cegueiraSinais += 1
      const o = parse(line)
      if (o) r.cegueiraUltima = { time: o.time, motivo: o.motivo, cegueira: o.cegueira?.kind ?? null, quedasComMensagemTravada: o.quedasComMensagemTravada ?? null }
    } else if (line.includes('"msg":"Filtros de recepção deste robô"')) {
      const o = parse(line)
      if (o) r.filtros = { ignoreUnmonitoredGroups: o.ignoreUnmonitoredGroups, chatScopeMode: o.chatScopeMode, inboundCensusIntervalMs: o.inboundCensusIntervalMs ?? null }
    } else if (line.includes('offline preview received')) {
      const o = parse(line)
      const msg = o?.msg ?? line
      r.offlinePreviews.push({ time: o?.time ?? t, msg: String(msg).slice(0, CORTE) })
      if (r.offlinePreviews.length > 3) r.offlinePreviews.shift()
    } else if (line.includes('fila offline do WhatsApp')) {
      const o = parse(line)
      if (o) r.filaOffline.push({ time: o.time, phase: o.phase, offlineCount: o.offlineCount, appendUpserts: o.appendUpserts, notifyUpserts: o.notifyUpserts, acceptedSinceOpen: o.acceptedSinceOpen })
      if (r.filaOffline.length > 2) r.filaOffline.shift()
    }
  }
  return r
}

// Veredito por hipótese do RCA. `conectado` e `espelhavaAntes` vêm do banco.
export function verdictFromScan(r, { conectado = null, espelhavaAntes = null } = {}) {
  const linhas = []
  if (!r || r.linhas === 0) return { nivel: 'sem_dado', texto: 'nenhuma linha deste pid na cauda lida do bot.log — aumente --log-mb ou confira o pid', linhas }
  if (r.aceitas > 0) return { nivel: 'ok', texto: `${r.aceitas} mensagem(ns) aceita(s) neste pid — o robô recebe; o problema não é cegueira de recepção`, linhas }
  if (r.filtros && r.filtros.inboundCensusIntervalMs == null) linhas.push('robô SEM o censo de entrada (código antigo): separar as hipóteses exige o deploy + restart do bot-supervisor')
  if (r.censoLinhas > 0) {
    if (r.censoGrupoChegou === 0) {
      return {
        nivel: 'nada_chega',
        texto: `${r.censoLinhas} resumo(s) do censo e NENHUM nó de grupo chegou ao socket${conectado ? ' com a sessão conectada' : ''} — o WhatsApp não entrega grupo a este aparelho (hipótese a/d). Reconectar e reiniciar o robô não resolvem: a ação é a cliente parear de novo`,
        linhas,
      }
    }
    if (r.censoGrupoUpsert > 0) return { nivel: 'filtro_worker', texto: `grupo chegou (${r.censoGrupoChegou}) e abriu (${r.censoGrupoUpsert}) mas nada foi aceito — filtro do worker (fromMe/frescor/dedup); ver 'Mensagem descartada'`, linhas }
    if (r.censoGrupoFalhou >= r.censoGrupoDescartado) return { nivel: 'nao_abre', texto: `grupo chegou (${r.censoGrupoChegou}) e falhou ao abrir (${r.censoGrupoFalhou}) — chave de grupo ruim (hipótese b); Reconectar/refresh de grupos`, linhas }
    return { nivel: 'descartada', texto: `grupo chegou (${r.censoGrupoChegou}) e foi descartado por regra nossa (${r.censoGrupoDescartado}) — hipótese c; conferir lista de monitorados e modo de escopo (${r.filtros?.chatScopeMode ?? '?'})`, linhas }
  }
  // Sem censo: o que o log antigo permite dizer.
  // RCA 2026-10-03 (doritosmms): cópia fromMe para a Meta AI (@bot) confirmada com <ack> sem
  // `type`, reentregue 5× por conexão, fila offline nunca fechada → nada de grupo chega.
  if (r.outroAparelhoChegou > 0 && r.offlineHandled === 0 && r.upserts === 0) {
    const top = Object.entries(r.outroAparelhoRecipients).sort((a, b) => b[1] - a[1])[0]
    return {
      nivel: 'fila_offline_presa',
      texto: `${r.outroAparelhoChegou} cópia(s) de outro aparelho da conta (destino principal ${top ? `${top[0]} ×${top[1]}` : '?'}), fila offline nunca encerrada (0 "handled offline") e 0 upsert — mensagem sem ack aceito segurando a fila (RCA 2026-10-03, ack sem type); confirmar o patch do ack no robô (uptime do bot-supervisor)`,
      linhas,
    }
  }
  if (r.decryptFailsGrupo > 0) return { nivel: 'nao_abre', texto: `${r.decryptFailsGrupo} falha(s) de decrypt de grupo e 0 aceitas — chave de grupo ruim (hipótese b)`, linhas }
  if (r.upsertsNotify > 0) return { nivel: 'filtro_worker', texto: `${r.upsertsNotify} upsert(s) ao vivo e 0 aceitas — mensagens abrem e o worker descarta (ver 'Mensagem descartada')`, linhas }
  linhas.push(`sem censo não dá para separar "o servidor não manda" de "chega e é descartada antes de abrir"${espelhavaAntes ? ' — a conta espelhava antes, então o silêncio não é fonte parada' : ''}`)
  return { nivel: 'indeterminado', texto: '0 aceitas, 0 upserts, 0 decrypt de grupo — nada rastreável chegou; deploy do censo decide', linhas }
}
