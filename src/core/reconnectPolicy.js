// Política de reconexão do socket WhatsApp (Baileys), extraída como módulo
// PURO (sem I/O, sem timers, sem Baileys) para ser testável de forma
// determinística. O bot-worker.js orquestra os timers/efeitos; aqui mora só
// a matemática de backoff e a decisão sobre o "ping-pong" de socket
// substituído (connectionReplaced / 440).
//
// Contexto: cada vez que o socket faz um `open` novo, o WhatsApp mostra no
// celular a notificação "A sincronização ... foi concluída". Reconexões em
// loop = spam dessa notificação. As duas defesas:
//   1) Backoff exponencial com jitter para closes genéricos.
//   2) Cooldown LONGO + detecção de surto para o caso `connectionReplaced`,
//      onde duas instâncias disputam a MESMA credencial (worker duplicado /
//      double-possession). Sem isso, cada socket reabre a cada poucos segundos
//      e o backoff normal nunca atua (o `open` zera o contador a cada ciclo).

// Delay de backoff exponencial com jitter simétrico (±jitterRatio).
// `attempt` é 0-based: attempt=0 → ~baseMs, attempt=1 → ~2*baseMs, ... cap em maxMs.
export function calcBackoffDelayMs(attempt, { baseMs, maxMs, jitterRatio = 0.2, random = Math.random } = {}) {
  const safeAttempt = Math.max(0, Number(attempt) || 0)
  const base = Math.min(baseMs * Math.pow(2, safeAttempt), maxMs)
  const jitter = base * jitterRatio * (random() * 2 - 1)
  return Math.max(0, Math.round(base + jitter))
}

// Registra um evento `connectionReplaced` na janela deslizante e decide se é
// um surto (ping-pong ativo entre sockets duplicados). NÃO é resetada por um
// `open` curto — é justamente nesse caso que o `open` acontece a cada ciclo;
// só o envelhecimento dos timestamps (windowMs) limpa a janela.
//
// Retorna a nova lista de timestamps (imutável: não muta a entrada), a contagem
// na janela e `escalate` quando atinge o limiar.
export function registerReplacedAndDecide(timestamps, now, { windowMs, giveUpThreshold }) {
  const recent = (timestamps || []).filter(ts => now - ts <= windowMs)
  recent.push(now)
  return {
    timestamps: recent,
    count: recent.length,
    escalate: recent.length >= giveUpThreshold,
  }
}

// Generaliza o registro acima para closes de QUALQUER código (500 badSession,
// 428 connectionClosed, 408 timeout, ...) e detecta "flapping": muitos closes
// numa janela curta. Sintoma em produção: o socket abre (dispara o push
// "A sincronização foi concluída" no celular), cai em poucos segundos/minutos e
// repete. O backoff exponencial sozinho NÃO contém isso porque um `open` curto
// zerava o contador a cada ciclo (ver shouldResetBackoff). Mesma forma do
// replaced, mas o booleano de saída fala de flap (→ cooldown), não de
// give-up. Imutável: não muta a entrada.
export function registerCloseAndDecide(timestamps, now, { windowMs, flapThreshold }) {
  const recent = (timestamps || []).filter(ts => now - ts <= windowMs)
  recent.push(now)
  return {
    timestamps: recent,
    count: recent.length,
    flapping: recent.length >= flapThreshold,
  }
}

// Decide se o backoff de reconexão deve ser ZERADO quando o socket fecha. Só
// zera quando a conexão que acabou de cair ficou ESTÁVEL por >= minStableMs —
// uma queda pontual de um chip saudável recomeça do backoff base (reconexão
// rápida). Já um `open` curto (típico de flap) NÃO zera, deixando o contador
// subir para o backoff escalar de fato. openedAt nulo/0 (nunca abriu nesta
// tentativa) ⇒ não estável.
export function shouldResetBackoff(openedAt, now, minStableMs) {
  if (!openedAt) return false
  return now - openedAt >= minStableMs
}

// badSession (500): a credencial Signal pode estar corrompida. Só sinalizamos
// reset de auth (forçar re-pareamento) quando o 500 REPETE na janela E a sessão
// que caiu NÃO estava estável (`hadStableOpen=false`). Sem essa segunda guarda,
// um 500 transitório — que em produção se recupera sozinho e volta a conectar —
// apagaria a credencial de um chip que funciona, forçando QR à toa. resetThreshold
// <= 0 desliga o reset (a guarda fica no chamador). Imutável: não muta a entrada.
export function registerBadSessionAndDecide(timestamps, now, { windowMs, resetThreshold, hadStableOpen }) {
  const recent = (timestamps || []).filter(ts => now - ts <= windowMs)
  recent.push(now)
  return {
    timestamps: recent,
    count: recent.length,
    shouldResetAuth: resetThreshold > 0 && recent.length >= resetThreshold && !hadStableOpen,
  }
}

// Decide se um badSession (500) deve APAGAR o auth_info (forçar re-pareamento —
// QR novo no celular do cliente). É a única ação que quebra a promessa de
// "conectar 1× e rodar liso", então tratamos com camadas de proteção:
//   1. resetThreshold <= 0 desliga o auto-reset (guarda no chamador).
//   2. `stuckMsgId` presente ⇒ o 500 é o fallback do Baileys para um stream:error
//      de mensagem travada (RCA "Loop de retry-receipt travado"), NÃO corrupção
//      de credencial. Nunca conta para wipe — o loop se resolve pelo
//      msgRetryCounterCache + observabilidade `ops_wa_stuck_message_retry`.
//   3. `keepEstablishedAuth` (flag) ⇒ se a sessão JÁ conectou de forma estável
//      alguma vez neste worker (`everHadStableOpen`), a credencial é válida por
//      definição — uma rajada de 500 posterior é transitória/protocolo, não
//      corrupção. Nesse modo o único gatilho legítimo de re-pareamento passa a
//      ser loggedOut (401), tratado à parte. Default OFF (comportamento
//      histórico) até validar em staging.
//   4. `hadStableOpen` (queda atual foi estável) ⇒ 500 transitório de chip
//      saudável que se recupera; não apaga.
// Só apaga quando o 500 REPETE (>= threshold) numa sessão que nunca ficou
// estável e sem nenhuma explicação mais benigna acima. Puro: sem I/O.
export function shouldResetAuthForBadSession({
  count = 0,
  resetThreshold = 0,
  hadStableOpen = false,
  everHadStableOpen = false,
  stuckMsgId = null,
  keepEstablishedAuth = false,
} = {}) {
  if (resetThreshold <= 0) return false
  if (stuckMsgId) return false
  if (keepEstablishedAuth && everHadStableOpen) return false
  if (hadStableOpen) return false
  return count >= resetThreshold
}

// Quedas "tipo relógio": produção mostrou sessões que ficam estáveis por ~50min
// e caem com 500/428/408 em cadência quase exata. Isso NÃO é flap curto, então o
// detector de flap não deve disparar; mas reconectar imediatamente também gera
// um novo `open` a cada ciclo e, portanto, uma nova notificação no celular. Este
// helper registra apenas closes que vieram de uma conexão estável e aplica um
// cooldown quando eles se repetem dentro de uma janela maior.
export function registerStableCloseAndDecide(timestamps, now, { windowMs, cooldownThreshold, hadStableOpen }) {
  if (!hadStableOpen) {
    return {
      timestamps: timestamps || [],
      count: (timestamps || []).length,
      shouldCooldown: false,
    }
  }
  const recent = (timestamps || []).filter(ts => now - ts <= windowMs)
  recent.push(now)
  return {
    timestamps: recent,
    count: recent.length,
    shouldCooldown: cooldownThreshold > 0 && recent.length >= cooldownThreshold,
  }
}

// Decide se um close deve entrar na política de "queda periódica de sessão
// estável". `stuckMsgId` representa uma causa raiz específica (retry-receipt
// travado extraído do stream:error); nesse caso aplicar cooldown de stable-close
// só aumenta downtime sem tratar o loop, então deixamos o worker reconectar pelo
// backoff normal e confiamos na observabilidade `ops_wa_stuck_message_retry`.
export function shouldConsiderStableCloseCooldown({ hadStableOpen = false, code = null, stuckMsgId = null, eligibleCodes = [] } = {}) {
  if (!hadStableOpen) return false
  if (stuckMsgId) return false
  return eligibleCodes.includes(code)
}

// RCA 2026-07 (AGENTS.md, "Loop de retry-receipt travado"): quando o WhatsApp
// rejeita a confirmação de uma mensagem específica, ele fecha o stream com um
// `stream:error` que embute o node de `ack` daquela mensagem. `code` sozinho
// não distingue isso de qualquer outro close genérico — só o conteúdo bruto
// do node revela a mensagem específica travada. Extrai o id do ack de
// mensagem de um node de stream:error, ou null se o node não for desse tipo
// (ex.: closes com `attrs.code` explícito, como 515 de pareamento, não têm
// esse conteúdo). Puro: só leitura de estrutura, sem I/O.
export function extractAckMessageIdFromStreamErrorNode(node) {
  if (!node || node.tag !== 'stream:error' || !Array.isArray(node.content)) return null
  const ackChild = node.content.find(child => child?.tag === 'ack' && child?.attrs?.class === 'message')
  return ackChild?.attrs?.id ?? null
}

// Rastreia, por messageId, quantas vezes o MESMO ack apareceu embutido num
// stream:error dentro da janela — sinal de que uma mensagem específica está
// travada num loop de reentrega (o Baileys deveria desistir sozinho depois de
// `maxMsgRetryCount`, mas se isso não estiver acontecendo — ex.: regressão da
// fiação do msgRetryCounterCache — o mesmo id volta a aparecer indefinidamente).
// Poda por mensagem (janela) E poda entradas totalmente expiradas do Map, para
// não crescer sem limite ao longo da vida do processo. Imutável: devolve um
// novo Map, não muta a entrada.
export function registerStuckMessageAndDecide(stateByMsgId, msgId, now, { windowMs, threshold }) {
  const next = new Map(stateByMsgId instanceof Map ? stateByMsgId : [])
  for (const [id, timestamps] of next) {
    const stillRecent = timestamps.filter(ts => now - ts <= windowMs)
    if (stillRecent.length === 0) next.delete(id)
    else next.set(id, stillRecent)
  }
  const recent = (next.get(msgId) || []).filter(ts => now - ts <= windowMs)
  recent.push(now)
  next.set(msgId, recent)
  return {
    state: next,
    count: recent.length,
    stuck: threshold > 0 && recent.length >= threshold,
  }
}

// Auto-heal de grupo dessincronizado (issue #1216, Camada 3): quando o Baileys loga uma
// falha de decrypt (Bad MAC / SessionError / MessageCounterError / "sent retry receipt"),
// o remoteJid do chat/grupo vem embutido em algum lugar do objeto de contexto passado ao
// logger — não em posição fixa (varia por tipo de erro/versão da lib). Confirmado
// empiricamente em produção (grep no bot.log real durante a investigação do RCA) que o
// campo `remoteJid` aparece nesses logs; como a lib não garante caminho fixo, fazemos uma
// busca em largura, rasa e limitada (poucos níveis, poucos nós, guarda contra ciclo) em vez
// de acessar um caminho fixo. Retorna null se não achar. Puro: só leitura, sem I/O.
export function extractRemoteJidFromLogArgs(args, { maxDepth = 4, maxNodes = 200 } = {}) {
  if (!Array.isArray(args)) return null
  const seen = new Set()
  const queue = []
  for (const arg of args) {
    if (arg && typeof arg === 'object') queue.push({ node: arg, depth: 0 })
  }
  let visited = 0
  while (queue.length > 0 && visited < maxNodes) {
    const { node, depth } = queue.shift()
    if (!node || typeof node !== 'object' || seen.has(node)) continue
    seen.add(node)
    visited++
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (key === 'remoteJid' && typeof value === 'string' && value.length > 0) return value
      if (value && typeof value === 'object' && depth < maxDepth) {
        queue.push({ node: value, depth: depth + 1 })
      }
    }
  }
  return null
}
