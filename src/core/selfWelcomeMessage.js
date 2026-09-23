/**
 * Mensagem de boas-vindas pelo PRÓPRIO WhatsApp, na primeira vez que a conta
 * conecta (2026-09-23 — plano de reforço de ativação na 1ª semana).
 *
 * Por que existe: `diag-motivo-nao-renovou.mjs` mostrou que quem conecta o
 * WhatsApp e cadastra loja na 1ª semana renova muito mais que quem não (100%
 * x 33%, amostra pequena). O único empurrão que existe hoje pra isso é
 * e-mail — e a cliente não lê e-mail. O painel só ajuda quem volta a abrir o
 * navegador. Falta um canal que ela decidiu abrir agora mesmo: o próprio
 * WhatsApp que ela acabou de conectar.
 *
 * PILOTO, restrito por e-mail: só dispara para as contas em
 * `resolveSelfWelcomePilotEmails()` — por padrão, só a conta da dona do
 * produto. Alargar o piloto é editar a env, nunca o código, e cada conta só
 * pode receber a mensagem UMA vez na vida (decisão de quem chama, olhando o
 * histórico da própria conta).
 *
 * NUNCA manda para grupo/canal/contato — só para o número que ACABOU DE
 * CONECTAR, na conversa "Mensagens para você mesmo" do próprio WhatsApp. Isso
 * não viola a promessa "ele não fala com ninguém por você"
 * (`src/domain/painel/whatsappSafety.js`): lá a garantia é sobre CONTATOS e
 * GRUPOS de terceiros, nunca sobre a própria conta falando consigo mesma.
 *
 * Módulo PURO: sem banco, sem rede, sem Baileys. Quem chama (bot-worker.js)
 * resolve e-mail/telefone/histórico e manda de fato.
 */

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

/**
 * Decide se esta conta, agora, deve receber a mensagem.
 *
 * Fail-safe é NUNCA MANDAR na dúvida: sem e-mail confiável ou sem telefone
 * resolvido, `false` — mandar mensagem errada pro número errado é pior que
 * perder uma oportunidade de ativação.
 *
 * @param {string|null} accountEmail e-mail da conta, como está no banco
 * @param {boolean} hadPhoneBefore `WaSession.phone` já tinha valor ANTES desta
 *   conexão — sinal durável de "já conectou alguma vez" (mesmo usado por
 *   `waEverConnected` nos gatilhos de e-mail). `true` = não é a primeira vez.
 * @param {string[]} pilotEmails lista já resolvida (ver `resolveSelfWelcomePilotEmails`)
 */
export function shouldSendSelfWelcomeMessage({ accountEmail, hadPhoneBefore, pilotEmails } = {}) {
  if (hadPhoneBefore) return false
  if (!Array.isArray(pilotEmails) || !pilotEmails.length) return false
  const email = String(accountEmail ?? '').trim().toLowerCase()
  if (!email) return false
  return pilotEmails.includes(email)
}

/**
 * Texto da mensagem. Linguagem simples, deixa claro que é automática e que a
 * conta não fala com mais ninguém por causa disso — a mesma garantia da tela
 * de conexão, pra não soar como uma exceção estranha à regra.
 */
export function buildSelfWelcomeMessageText({ videoUrl } = {}) {
  const linhas = [
    '✅ *WhatsApp conectado!*',
    '',
    'Falta um passo pro robô começar a publicar ofertas: cadastrar sua etiqueta de afiliada (Shopee, Mercado Livre, Amazon ou Magalu) no painel.',
    videoUrl ? `\n🎥 Vídeo mostrando como: ${videoUrl}` : null,
    '\nEssa mensagem é automática, só pra você — o robô continua sem falar com mais ninguém por sua conta.',
  ].filter((linha) => linha !== null)
  return linhas.join('\n')
}
