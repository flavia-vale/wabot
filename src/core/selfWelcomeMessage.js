/**
 * Mensagens pelo PRÓPRIO WhatsApp, em momentos-chave da 1ª semana de conta
 * (2026-09-23/24 — plano de reforço de ativação na 1ª semana).
 *
 * Por que existe: `diag-motivo-nao-renovou.mjs` mostrou que quem conecta o
 * WhatsApp e cadastra loja na 1ª semana renova muito mais que quem não (100%
 * x 33%, amostra pequena). O único empurrão que existe hoje pra isso é
 * e-mail — e a cliente não lê e-mail. O painel só ajuda quem volta a abrir o
 * navegador. Falta um canal que ela decidiu abrir agora mesmo: o próprio
 * WhatsApp que ela acabou de conectar.
 *
 * Quatro momentos (todos restritos ao PILOTO — ver `resolveSelfWelcomePilotEmails`):
 *
 * 1. `buildSelfWelcomeMessageText` — 1ª conexão do WhatsApp.
 * 2. `buildFirstOfferPublishedMessageText` — 1ª oferta publicada com sucesso
 *    (prova de valor instantânea).
 * 3. `buildMissingCredentialNudgeText` — conectou há mais de 24h e ainda não
 *    cadastrou etiqueta de afiliada.
 * 4. `buildMissingGroupsNudgeText` — tem etiqueta, mas ainda não escolheu os
 *    grupos (origem e/ou destino).
 *
 * PILOTO, restrito por e-mail: só dispara para as contas em
 * `resolveSelfWelcomePilotEmails()` — por padrão, só a conta da dona do
 * produto. Alargar o piloto é editar a env, nunca o código. Cada momento só
 * dispara UMA vez na vida de cada conta (decisão de quem chama, olhando o
 * histórico da própria conta).
 *
 * NUNCA manda para grupo/canal/contato — só para o número que ACABOU DE
 * CONECTAR, na conversa "Mensagens para você mesmo" do próprio WhatsApp. Isso
 * não viola a promessa "ele não fala com ninguém por você"
 * (`src/domain/painel/whatsappSafety.js`): lá a garantia é sobre CONTATOS e
 * GRUPOS de terceiros, nunca sobre a própria conta falando consigo mesma. A
 * mensagem 4 fala em "grupos" no sentido de CONFIGURAÇÃO do produto, não de
 * mandar mensagem para um grupo.
 *
 * Módulo PURO: sem banco, sem rede, sem Baileys. Quem chama (bot-worker.js)
 * resolve e-mail/telefone/histórico e manda de fato.
 */

import { DEFAULT_SUPPORT_WHATSAPP } from '../email/layout.js'

const BRAND_NAME = 'Espelha Grupos'

/**
 * "(32) 99984-4020", derivado de `DEFAULT_SUPPORT_WHATSAPP`
 * (`https://wa.me/5532999844020`) — nunca duplicar o número em dois lugares.
 */
export function formatSupportPhoneDisplay(supportWhatsapp = DEFAULT_SUPPORT_WHATSAPP) {
  const digits = String(supportWhatsapp ?? '').replace(/\D/g, '').replace(/^55/, '')
  const ddd = digits.slice(0, 2)
  const resto = digits.slice(2)
  if (!ddd || resto.length < 8) return supportWhatsapp
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`
}

/** Editar aqui exige deploy; prefira a env para ampliar o piloto. */
export const DEFAULT_SELF_WELCOME_PILOT_EMAILS = Object.freeze(['flavia.vale@usp.br'])

/**
 * Lista efetiva de e-mails do piloto.
 * env ausente  -> lista padrão do código (hoje: só a dona do produto).
 * env presente -> SUBSTITUI (string vazia = piloto desligado pra todo mundo).
 */
export function resolveSelfWelcomePilotEmails(env = process.env) {
  const raw = env?.SELF_WELCOME_MESSAGE_PILOT_EMAILS
  if (raw === undefined || raw === null) return [...DEFAULT_SELF_WELCOME_PILOT_EMAILS]
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/** Fail-safe: sem e-mail confiável ou piloto vazio, `false`. */
export function isPilotEmail(accountEmail, pilotEmails) {
  if (!Array.isArray(pilotEmails) || !pilotEmails.length) return false
  const email = String(accountEmail ?? '').trim().toLowerCase()
  if (!email) return false
  return pilotEmails.includes(email)
}

/**
 * @param {string|null} accountEmail e-mail da conta, como está no banco
 * @param {boolean} hadPhoneBefore `WaSession.phone` já tinha valor ANTES desta
 *   conexão — sinal durável de "já conectou alguma vez" (mesmo usado por
 *   `waEverConnected` nos gatilhos de e-mail). `true` = não é a primeira vez.
 * @param {string[]} pilotEmails lista já resolvida (ver `resolveSelfWelcomePilotEmails`)
 */
export function shouldSendSelfWelcomeMessage({ accountEmail, hadPhoneBefore, pilotEmails } = {}) {
  if (hadPhoneBefore) return false
  return isPilotEmail(accountEmail, pilotEmails)
}

/**
 * Decide o nudge de ativação (24h depois de conectar, sem loja OU sem
 * grupos). Prioridade igual à dos e-mails de ciclo de vida
 * (`lifecyclePolicy.js`): falta de credencial vem ANTES de falta de grupo —
 * é o bloqueio mais grave e o mais invisível.
 *
 * Cada tipo dispara UMA vez (`sentCredentialNudge`/`sentGroupsNudge`, que quem
 * chama resolve olhando o histórico da própria conta).
 *
 * @param {number|null} connectedForMs há quanto tempo esta conta conectou por
 *   trás da 1ª vez (sinal durável — não reseta em reconexão)
 */
export function decideActivationNudge({
  accountEmail,
  pilotEmails,
  connectedForMs,
  minDelayMs = 24 * 60 * 60 * 1000,
  hasCredential,
  hasGroups,
  sentCredentialNudge = false,
  sentGroupsNudge = false,
} = {}) {
  if (!isPilotEmail(accountEmail, pilotEmails)) return null
  if (connectedForMs == null || connectedForMs < minDelayMs) return null
  if (!hasCredential) return sentCredentialNudge ? null : 'missing_credential'
  if (!hasGroups) return sentGroupsNudge ? null : 'missing_groups'
  return null
}

/**
 * Moldura comum das 4 mensagens: título resumido em negrito, subtítulo em
 * itálico identificando a marca, corpo, vídeo opcional e rodapé com o
 * suporte — nunca a frase antiga sobre "não falar com mais ninguém".
 */
export function buildSelfMessageEnvelope({ titulo, corpo, videoUrl } = {}) {
  const linhas = [
    `*${titulo}*`,
    `_Essa é uma mensagem do ${BRAND_NAME}_`,
    '',
    corpo,
    videoUrl ? `\n🎥 Vídeo mostrando como: ${videoUrl}` : null,
    `\nEssa mensagem é automática, só pra você. Qualquer dúvida acione nosso suporte no número ${formatSupportPhoneDisplay()}.`,
  ].filter((linha) => linha !== null)
  return linhas.join('\n')
}

/** Momento 1 — 1ª conexão do WhatsApp. */
export function buildSelfWelcomeMessageText({ videoUrl } = {}) {
  return buildSelfMessageEnvelope({
    titulo: '✅ WhatsApp conectado!',
    corpo: 'Falta um passo pro robô começar a publicar ofertas: cadastrar sua etiqueta de afiliada (Shopee, Mercado Livre, Amazon ou Magalu) no painel.',
    videoUrl,
  })
}

/** Momento 2 — 1ª oferta publicada com sucesso (prova de valor). */
export function buildFirstOfferPublishedMessageText() {
  return buildSelfMessageEnvelope({
    titulo: '🎉 Sua primeira oferta foi publicada!',
    corpo: 'Seu robô já está funcionando: a primeira oferta convertida com sua etiqueta saiu no grupo. A partir de agora, toda comissão das vendas fica com você.',
  })
}

/** Momento 3 — 24h conectada e ainda sem etiqueta de afiliada. */
export function buildMissingCredentialNudgeText({ videoUrl } = {}) {
  return buildSelfMessageEnvelope({
    titulo: '⚠️ Falta 1 passo pro robô funcionar',
    corpo: 'Você conectou o WhatsApp, mas ainda não cadastrou sua etiqueta de afiliada. Sem ela, o robô não consegue publicar nenhuma oferta. Cadastre agora no painel — leva menos de 2 minutos.',
    videoUrl,
  })
}

/** Momento 4 — tem etiqueta, mas ainda não escolheu os grupos. */
export function buildMissingGroupsNudgeText({ videoUrl } = {}) {
  return buildSelfMessageEnvelope({
    titulo: '⚠️ Falta escolher seus grupos',
    corpo: 'Você conectou o WhatsApp, mas ainda não escolheu de onde o robô vai puxar as ofertas e para onde ele vai publicar. Sem isso, ele fica esperando.',
    videoUrl,
  })
}

/**
 * Momento 5 — mensagem MANUAL, escrita pela admin no painel (aba "Contato
 * com cliente"), para uma conta com a sessão conectada AGORA. Não passa pelo
 * piloto (`isPilotEmail`): é ação humana e deliberada, não experimento.
 */
export function buildAdminSupportMessageText({ corpo } = {}) {
  return buildSelfMessageEnvelope({ titulo: '💬 Mensagem do suporte', corpo: String(corpo ?? '').trim() })
}
