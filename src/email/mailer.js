// Transporte de e-mail transacional provider-agnóstico (SMTP via nodemailer).
//
// Filosofia: o e-mail é OPCIONAL. Se as envs SMTP_* não estiverem
// configuradas, todas as funções viram no-op silencioso (retornam
// { skipped: true }) — signup nunca quebra por falta de e-mail, e os
// testes seguem db-free / env-free sem precisar de um servidor SMTP.
//
// Envs lidas:
//   SMTP_HOST      host do servidor SMTP (ex.: smtp.gmail.com)
//   SMTP_PORT      porta (default 587)
//   SMTP_SECURE    'true' para conexão TLS direta (porta 465); default false
//   SMTP_USER      usuário de autenticação
//   SMTP_PASS      senha / app password
//   SMTP_FROM      remetente exibido (default: SMTP_USER)
//
// Qualquer provedor que fale SMTP funciona (Gmail, Zoho, SES, Mailgun...).

import nodemailer from 'nodemailer'

let cachedTransport
let cachedSignature

function readSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim()
  const user = (process.env.SMTP_USER || '').trim()
  const pass = process.env.SMTP_PASS || ''
  if (!host || !user || !pass) return null

  const port = Number(process.env.SMTP_PORT) || 587
  const secure = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true' || port === 465
  const from = (process.env.SMTP_FROM || '').trim() || user
  return { host, port, secure, user, pass, from }
}

export function isEmailConfigured() {
  return readSmtpConfig() !== null
}

function getTransport(config) {
  // Recria o transporte só quando a config muda (ou no primeiro uso).
  const signature = `${config.host}|${config.port}|${config.secure}|${config.user}`
  if (cachedTransport && cachedSignature === signature) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  })
  cachedSignature = signature
  return cachedTransport
}

// Apenas para testes: limpa o transporte memoizado.
export function _resetMailerCache() {
  cachedTransport = undefined
  cachedSignature = undefined
}

/**
 * Envia um e-mail. No-op quando SMTP não está configurado.
 * @returns {Promise<{skipped: true} | {skipped: false, messageId?: string}>}
 */
export async function sendMail({ to, subject, html, text }) {
  const config = readSmtpConfig()
  if (!config) return { skipped: true }
  if (!to) return { skipped: true }

  const transport = getTransport(config)
  const info = await transport.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
  })
  return { skipped: false, messageId: info?.messageId }
}
