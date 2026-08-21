// Moldura visual única de todo e-mail do BOTinho (cabeçalho, corpo, rodapé).
//
// Puro. A admin edita só o miolo pelo painel; a moldura fica aqui para que
// nenhum texto editado consiga quebrar o layout — e para trocar a identidade
// visual em um lugar só.

import { escapeHtml, renderBody } from './markup.js'

export const BRAND_NAME = 'BOTinho'
export const DEFAULT_DASHBOARD_URL = 'https://espelhagrupos.com.br'
export const DEFAULT_SUPPORT_EMAIL = 'contato@espelhagrupos.com.br'
export const DEFAULT_SUPPORT_WHATSAPP = 'https://wa.me/5532999844020'

// Vídeo-aula de cadastro das etiquetas de afiliada (Shopee, Mercado Livre,
// Amazon e Magalu). É o MESMO vídeo linkado no painel, em
// `dashboard/app/painel/checklist/page.js` — a constante existe para os dois
// lados não derivarem: se o vídeo for refeito, muda aqui e no painel, e o
// teste de e-mail reprova link colado na mão.
export const VIDEO_CADASTRO_ETIQUETAS_URL =
  process.env.VIDEO_CREDENCIAIS_URL || 'https://youtu.be/6F2AUM88FKk'

// Capítulos do vídeo, em SEGUNDOS. Mandar a pessoa para "o vídeo" e deixá-la
// procurar o trecho da loja dela é onde ela desiste — cada loja tem endereço
// próprio aqui.
//
// Tabela única de propósito: o minuto e a URL saem do mesmo lugar, então não
// existe o caso de alguém corrigir um e esquecer o outro. Se o vídeo for
// regravado, mexe-se AQUI e em `VIDEO_CADASTRO_ETIQUETAS_URL`, e todos os
// links se ajustam sozinhos.
//
// Os rótulos ficam em linguagem de gente por obrigação (`JARGAO_PROIBIDO` em
// `test/email-engine.test.js`): o capítulo 3:15 é a instalação de uma extensão
// cujo nome contém uma palavra que não pode chegar à tela da cliente — quem
// nomeia a ferramenta é o vídeo, não o e-mail.
export const VIDEO_ETIQUETAS_CAPITULOS = Object.freeze([
  { chave: 'shopee_pedir', segundos: 15, rotulo: 'Pedir seu acesso de afiliada na Shopee' },
  { chave: 'shopee', segundos: 103, rotulo: 'Copiar a chave da Shopee' },
  { chave: 'extensao', segundos: 195, rotulo: 'Instalar o programinha que o vídeo indica' },
  { chave: 'amazon', segundos: 250, rotulo: 'Pegar o código de acesso da Amazon' },
  { chave: 'mercadolivre', segundos: 371, rotulo: 'Pegar o código de acesso do Mercado Livre' },
  { chave: 'vitrine_ml', segundos: 500, rotulo: 'Cadastrar o link da sua vitrine do Mercado Livre' },
  { chave: 'magalu', segundos: 562, rotulo: 'Pegar a etiqueta de afiliada da Magalu' },
])

/**
 * Link do vídeo já posicionado no segundo indicado. Usa `URL` de propósito:
 * assim funciona tanto no formato curto (`youtu.be/ID?t=15`) quanto no longo
 * (`watch?v=ID&t=15`), e o override por env não quebra o separador.
 */
export function videoEtiquetasEm(segundos, base = VIDEO_CADASTRO_ETIQUETAS_URL) {
  try {
    const url = new URL(base)
    url.searchParams.set('t', String(Math.max(0, Math.floor(Number(segundos) || 0))))
    return url.toString()
  } catch {
    return base
  }
}

/** `{ video_shopee: 'https://...?t=103', ... }` — pronto para as variáveis. */
export function videoEtiquetasVars() {
  return Object.fromEntries(
    VIDEO_ETIQUETAS_CAPITULOS.map((c) => [`video_${c.chave}`, videoEtiquetasEm(c.segundos)])
  )
}

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
