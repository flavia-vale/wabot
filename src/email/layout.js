// Moldura visual única de todo e-mail do Espelha Grupos (cabeçalho, corpo, rodapé).
//
// Puro. A admin edita só o miolo pelo painel; a moldura fica aqui para que
// nenhum texto editado consiga quebrar o layout — e para trocar a identidade
// visual em um lugar só.

import { escapeHtml, renderBody } from './markup.js'

export const BRAND_NAME = 'Espelha Grupos'
export const DEFAULT_DASHBOARD_URL = 'https://espelhagrupos.com.br'
export const DEFAULT_SUPPORT_EMAIL = 'contato@espelhagrupos.com.br'
export const DEFAULT_SUPPORT_WHATSAPP = 'https://wa.me/5532999844020'

// Vídeo-aula de cadastro das etiquetas de afiliada: a fonte única virou
// `src/tutorialVideo.js` (módulo leaf), para o painel usar EXATAMENTE o mesmo
// endereço e os mesmos capítulos que os e-mails. Re-exportado aqui para não
// quebrar quem já importava de `src/email/layout.js`.
export {
  VIDEO_CADASTRO_ETIQUETAS_URL,
  VIDEO_ETIQUETAS_CAPITULOS,
  videoEtiquetasEm,
  videoEtiquetasVars,
  videoEtiquetasParaLoja,
} from '../tutorialVideo.js'

export function resolveDashboardUrl() {
  const raw = (process.env.DASHBOARD_URL || process.env.API_URL || DEFAULT_DASHBOARD_URL).trim()
  return raw.replace(/\/+$/, '')
}

export function resolveSupportEmail() {
  return (process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim()
}

// Rodapé de e-mail de MARKETING: descadastro obrigatório (LGPD). E-mail
// transacional (cobrança, vencimento, segurança) não leva descadastro — é
// obrigação de serviço, não divulgação.
function marketingFooterText(unsubscribeUrl) {
  return [
    '',
    '—',
    `Você recebe este aviso porque tem conta no ${BRAND_NAME}.`,
    `Não quer mais receber e-mails como este? Descadastre-se: ${unsubscribeUrl}`,
  ].join('\n')
}

function marketingFooterHtml(unsubscribeUrl) {
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
    <p style="font-size:12px;line-height:1.6;color:#9ca3af">
      Você recebe este aviso porque tem conta no ${BRAND_NAME}.<br/>
      Não quer mais receber e-mails como este?
      <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280">Descadastre-se aqui</a>.
    </p>`
}

function signatureText() {
  return `\n\nEquipe ${BRAND_NAME}`
}

function signatureHtml() {
  return `<p style="font-size:14px;line-height:1.6;margin-top:24px">Equipe ${BRAND_NAME}</p>`
}

/**
 * Monta o e-mail final a partir do corpo já com variáveis trocadas.
 * @param {{ title?: string, body: string, category?: string, unsubscribeUrl?: string }} params
 * @returns {{ text: string, html: string }}
 */
export function wrapEmail({ title = '', body = '', category = 'transactional', unsubscribeUrl = '' } = {}) {
  const { text, html } = renderBody(body)
  const isMarketing = category === 'marketing'
  const showFooter = isMarketing && Boolean(unsubscribeUrl)

  const fullText = [
    title,
    title ? '' : null,
    text,
  ].filter((part) => part !== null).join('\n') + signatureText() + (showFooter ? marketingFooterText(unsubscribeUrl) : '')

  const fullHtml = `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    ${title ? `<h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(title)}</h1>` : ''}
    ${html}
    ${signatureHtml()}
    ${showFooter ? marketingFooterHtml(unsubscribeUrl) : ''}
  </div>
</body>
</html>`

  return { text: fullText.trim(), html: fullHtml }
}
