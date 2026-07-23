// Política de "ignorar mensagens de grupos NÃO-monitorados" na camada do socket
// Baileys (opção `shouldIgnoreJid`).
//
// RCA 2026-07 (clientes Vanessa `vanessascar12@gmail.com` e juliane): um grupo
// `@g.us` que o cliente participa mas o robô NÃO monitora, com a sender-key do
// Signal dessincronizada, gera falha de decrypt → o Baileys pede reenvio
// (retry receipt) → o WhatsApp reoferece a MESMA mensagem → chega `stream:error`
// (code 500, `stuckMsg:true`) → a sessão CAI e reconecta. Isso se repete a cada
// ~50min o dia inteiro, sem ação do cliente, e é individual da conta (só quem
// participa do grupo quebrado sofre).
//
// Confirmado na FONTE do Baileys instalado
// (`@whiskeysockets/baileys` Socket/messages-recv.js → `handleMessage`): quando
// `shouldIgnoreJid(node.attrs.from)` retorna `true`, a mensagem é apenas ACKada
// (`sendMessageAck`) e a função RETORNA **antes** de `decrypt()` e de
// `sendRetryRequest()`. Logo: sem Bad MAC, sem retry receipt → o WhatsApp fica
// satisfeito com o ack, NÃO reoferece → o stream não cai. Como o robô nunca
// espelha esses grupos, ignorá-los não perde absolutamente nada.
//
// Blast radius mínimo DE PROPÓSITO: só entram na regra de ignore os jids de
// GRUPO (`@g.us`) fora do allowlist. Newsletters (`@newsletter`, alimenta
// "Canais que sigo"), DMs (`@s.whatsapp.net`), `status@broadcast` e o próprio
// número NUNCA são ignorados — mesmo fora do allowlist. Mensagens travadas de
// @newsletter continuam cobertas pela blindagem existente do
// `msgRetryCounterCache` (limite de 5 tentativas por mensagem).

const GROUP_JID_SUFFIX = '@g.us'

// Mesma normalização de `normalizeJidForMatch` no bot-worker: remove o sufixo
// de device (`:12@...`) para casar o jid do socket com o jid persistido no banco.
export function normalizeJid(jid) {
  if (typeof jid !== 'string') return ''
  return jid.trim().replace(/:\d+(?=@)/, '')
}

// Constrói o Set normalizado de jids "permitidos" (monitor + destino +
// canal-botão). Tudo que estiver aqui NUNCA é ignorado.
export function buildAllowedJidSet(jids = []) {
  const set = new Set()
  for (const jid of jids) {
    const normalized = normalizeJid(jid)
    if (normalized) set.add(normalized)
  }
  return set
}

// Decide se o socket deve IGNORAR mensagens deste jid de chat.
// - `enabled`: flag mestre (`WA_IGNORE_UNMONITORED_GROUPS`). Default OFF.
// - `ready`: o allowlist já foi populado ao menos 1x. Enquanto false, NUNCA
//   ignora (default seguro no boot — não descartar mensagem de grupo monitorado
//   só porque a config ainda não carregou).
// - `allowedJids`: Set normalizado de jids permitidos.
export function shouldIgnoreChatJid(jid, { allowedJids, enabled = false, ready = false } = {}) {
  if (!enabled || !ready) return false
  const normalized = normalizeJid(jid)
  if (!normalized) return false
  // Só grupos @g.us entram na regra de ignore. Qualquer outro tipo de jid
  // (newsletter, DM, status, próprio número) é sempre processado.
  if (!normalized.endsWith(GROUP_JID_SUFFIX)) return false
  if (allowedJids && allowedJids.has(normalized)) return false
  return true
}
