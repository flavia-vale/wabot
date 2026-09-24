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
// Blast radius mínimo DE PROPÓSITO: só entram nesta regra PREVENTIVA os jids
// de GRUPO (`@g.us`) fora do allowlist. Newsletters (`@newsletter`, alimenta
// "Canais que sigo"), DMs (`@s.whatsapp.net`), `status@broadcast` e o próprio
// número NUNCA são ignorados por ELA — mesmo fora do allowlist.
//
// ⚠️ Esta linha dizia que canal (`@newsletter`) travado "continua coberto pela
// blindagem existente do msgRetryCounterCache (limite de 5 tentativas)" — era
// uma suposição, e a investigação de 2026-09-23 mediu que ela é FALSA: a
// blindagem por msgId só ajuda quando o MESMO id repete, e um canal
// dessincronizado publica conteúdo NOVO (id novo) a cada falha, então o
// limite de 5 tentativas nunca chega a valer. Canal continua fora DESTA regra
// preventiva (ela nunca soube diferenciar canal saudável de quebrado), mas
// ganhou uma regra REATIVA própria — `shouldIgnoreDesyncedChannel`, abaixo —
// que só age depois que um canal específico prova estar quebrado.

const GROUP_JID_SUFFIX = '@g.us'
const NEWSLETTER_JID_SUFFIX = '@newsletter'

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

// Camada 3-B (RCA 2026-09-23, contas tecnicotelecom10@gmail.com e outras —
// medido: 63% da frota com o mesmo sintoma): um CANAL (@newsletter) com a
// sessão de chave dessincronizada NUNCA é curado pela blindagem que existia —
// cada mensagem NOVA que o canal publica falha ao decifrar com um messageId
// DIFERENTE (o comentário acima, que dizia que @newsletter travado "continua
// coberto pelo msgRetryCounterCache (limite de 5 tentativas)", presumia que a
// MESMA mensagem repetiria; na prática o WhatsApp não reoferece o mesmo
// conteúdo — publica o próximo, que falha de novo). Sem correção, toda
// mensagem nova reabre decrypt-fail -> retry-receipt -> stream:error 500 ->
// queda, pra sempre: medido em produção, dois canais diferentes derrubaram a
// MESMA conta duas vezes em menos de 2h.
//
// Diferente do WA_IGNORE_UNMONITORED_GROUPS (preventivo, cobre todo grupo
// fora do allowlist de saída), esta regra é REATIVA e por canal: só ignora um
// canal ESPECÍFICO depois que ele já provou estar quebrado (mesmo detector de
// falhas usado no auto-refresh de grupo, `registerStuckMessageAndDecide`), e
// só por um tempo (a janela expira e o canal volta a ser processado
// normalmente — a sessão pode se resincronizar sozinha). Canal na allowlist
// (fonte monitorada de propósito) nunca entra aqui, mesmo em quarentena.
export function shouldIgnoreDesyncedChannel(jid, { enabled = false, quarantinedAt, now = Date.now(), ttlMs = 0, allowedJids } = {}) {
  if (!enabled || !quarantinedAt) return false
  const normalized = normalizeJid(jid)
  if (!normalized || !normalized.endsWith(NEWSLETTER_JID_SUFFIX)) return false
  if (allowedJids && allowedJids.has(normalized)) return false
  if (ttlMs > 0 && now - quarantinedAt > ttlMs) return false
  return true
}
