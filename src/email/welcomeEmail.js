// E-mail de boas-vindas enviado logo após o cadastro (signup).
//
// O builder do template é puro (não depende de env nem de rede) para ser
// testável isoladamente. O envio passa por sendMail(), que é no-op quando
// SMTP não está configurado — então chamar sendWelcomeEmail num ambiente
// sem SMTP é seguro e não lança.

import { sendMail } from './mailer.js'

const BRAND_NAME = 'BOTinho'
const DEFAULT_DASHBOARD_URL = 'https://espelhagrupos.com.br'
const DEFAULT_SUPPORT_EMAIL = 'contato@espelhagrupos.com.br'
const DEFAULT_SUPPORT_WHATSAPP = 'https://wa.me/5532999844020'

function resolveDashboardUrl() {
  const raw = (process.env.DASHBOARD_URL || process.env.API_URL || DEFAULT_DASHBOARD_URL).trim()
  return raw.replace(/\/+$/, '')
}

function resolveSupportEmail() {
  return (process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim()
}

const ACTIVATION_STEPS = [
  'Conecte seu WhatsApp (de preferência um chip dedicado, não o pessoal).',
  'Marque os grupos/canais de ORIGEM que você quer monitorar.',
  'Marque os grupos/canais de DESTINO para onde as ofertas vão.',
  'Cadastre seus IDs de afiliada (Mercado Livre, Amazon, Shopee).',
  'Ative o bot e acompanhe os envios pela tela de Logs.',
]

/**
 * Monta o conteúdo do e-mail de boas-vindas. Função pura.
 * @param {{ name?: string, dashboardUrl?: string, supportEmail?: string, supportWhatsappUrl?: string }} params
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildWelcomeEmail({
  name,
  dashboardUrl = resolveDashboardUrl(),
  supportEmail = resolveSupportEmail(),
  supportWhatsappUrl = DEFAULT_SUPPORT_WHATSAPP,
} = {}) {
  const firstName = (name || '').trim().split(/\s+/)[0] || ''
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!'
  const loginUrl = `${dashboardUrl}/login`

  const subject = `Bem-vinda ao ${BRAND_NAME}! Seus 7 dias grátis começaram 🎉`

  const stepsText = ACTIVATION_STEPS.map((step, i) => `${i + 1}. ${step}`).join('\n')
  const text = [
    greeting,
    '',
    `Sua conta no ${BRAND_NAME} está pronta e seu período de teste de 7 dias já começou.`,
    'Para sair do papel rápido, siga estes 5 passos (leva uns 4 minutos):',
    '',
    stepsText,
    '',
    `Acesse o painel: ${loginUrl}`,
    '',
    'Travou em algum passo? A gente te ajuda pessoalmente:',
    `- E-mail: ${supportEmail}`,
    `- WhatsApp: ${supportWhatsappUrl}`,
    '',
    `Boas ofertas!`,
    `Equipe ${BRAND_NAME}`,
  ].join('\n')

  const stepsHtml = ACTIVATION_STEPS.map((step) => `<li style="margin-bottom:8px">${step}</li>`).join('')
  const html = `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">${greeting}</h1>
    <p style="font-size:15px;line-height:1.6">Sua conta no <strong>${BRAND_NAME}</strong> está pronta e seu <strong>período de teste de 7 dias</strong> já começou.</p>
    <p style="font-size:15px;line-height:1.6">Para sair do papel rápido, siga estes 5 passos (leva uns 4 minutos):</p>
    <ol style="font-size:15px;line-height:1.6;padding-left:20px">${stepsHtml}</ol>
    <p style="text-align:center;margin:28px 0">
      <a href="${loginUrl}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Acessar o painel</a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#4b5563">Travou em algum passo? A gente te ajuda pessoalmente:</p>
    <ul style="font-size:14px;line-height:1.6;color:#4b5563;padding-left:20px">
      <li>E-mail: <a href="mailto:${supportEmail}" style="color:#16a34a">${supportEmail}</a></li>
      <li>WhatsApp: <a href="${supportWhatsappUrl}" style="color:#16a34a">${supportWhatsappUrl}</a></li>
    </ul>
    <p style="font-size:14px;line-height:1.6;margin-top:24px">Boas ofertas!<br/>Equipe ${BRAND_NAME}</p>
  </div>
</body>
</html>`

  return { subject, text, html }
}

/**
 * Envia o e-mail de boas-vindas. Seguro de chamar sem SMTP (vira no-op).
 * Nunca lança por causa de e-mail — erros são capturados e devolvidos.
 * @returns {Promise<{ skipped: boolean, error?: string, messageId?: string }>}
 */
export async function sendWelcomeEmail({ to, name } = {}) {
  if (!to) return { skipped: true }
  try {
    const { subject, text, html } = buildWelcomeEmail({ name })
    return await sendMail({ to, subject, text, html })
  } catch (err) {
    return { skipped: true, error: String(err?.message ?? err) }
  }
}
