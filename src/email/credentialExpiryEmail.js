// Aviso por e-mail de "o código de acesso da loja venceu".
//
// Builder puro (sem env obrigatória, sem rede) — espelha welcomeEmail.js.
// Quando as duas lojas vencem juntas, sai UM e-mail só listando as duas.
//
// REDAÇÃO (regra canônica do AGENTS.md, com teste que falha se regredir):
// "código de acesso" (nunca cookie/SSID/token), "etiqueta de afiliada" (nunca
// tag), "link mais comprido" (nunca ?tag=/partner_id/amzn.to), "venceu" (nunca
// "sessão expirada"). E NUNCA dizer que o envio parou: o plano B continua
// enviando e a comissão continua sendo dela — dizer o contrário assusta à toa.

const BRAND_NAME = 'BOTinho'
const DEFAULT_DASHBOARD_URL = 'https://espelhagrupos.com.br'
const CREDENTIALS_PATH = '/painel/ids-afiliada'

const STORE_LABELS = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
}

// O que muda, na prática, em cada loja quando o código vence. Só o Mercado
// Livre perde a conversão de cupom sem produto; na Amazon o cupom continua
// saindo com a comissão dela.
const STORE_EFFECTS = {
  mercadolivre: 'no Mercado Livre, o cupom que não aponta para um produto deixa de ser convertido',
  amazon: 'na Amazon, tudo o mais continua igual',
}

function resolveDashboardUrl() {
  const raw = (process.env.DASHBOARD_URL || process.env.API_URL || DEFAULT_DASHBOARD_URL).trim()
  return raw.replace(/\/+$/, '')
}

function greetingFor(name) {
  const firstName = (name || '').trim().split(/\s+/)[0] || ''
  return firstName ? `Olá, ${firstName}!` : 'Olá!'
}

function labelsFor(platforms) {
  return platforms.map((platform) => STORE_LABELS[platform] ?? platform)
}

function joinFriendly(items = []) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/**
 * Monta o aviso de código de acesso vencido. Função pura.
 * @param {{ name?: string, platforms: string[], dashboardUrl?: string }} params
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildCredentialExpiryEmail({ name, platforms = [], dashboardUrl = resolveDashboardUrl() } = {}) {
  const lojas = platforms.filter((platform) => STORE_LABELS[platform])
  if (!lojas.length) throw new Error('buildCredentialExpiryEmail: nenhuma loja informada')

  const nomes = joinFriendly(labelsFor(lojas))
  const varias = lojas.length > 1
  const link = `${dashboardUrl}${CREDENTIALS_PATH}`
  const greeting = greetingFor(name)

  const subject = varias
    ? `Seus códigos de acesso (${nomes}) venceram — suas ofertas continuam saindo`
    : `Seu código de acesso da ${nomes} venceu — suas ofertas continuam saindo`

  const abertura = varias
    ? `Os códigos de acesso que você cadastrou para ${nomes} venceram. Isso acontece de tempos em tempos e não é erro seu.`
    : `O código de acesso que você cadastrou para a ${nomes} venceu. Isso acontece de tempos em tempos e não é erro seu.`

  const efeitos = lojas.map((platform) => STORE_EFFECTS[platform]).filter(Boolean)
  const diferenca = `A única diferença é que o link das ofertas dessa(s) loja(s) sai mais comprido — e ${joinFriendly(efeitos)}.`

  const text = [
    greeting,
    '',
    abertura,
    '',
    'Fique tranquila: suas ofertas CONTINUAM saindo normalmente e a comissão CONTINUA sendo sua.',
    diferenca,
    '',
    'Como resolver (leva menos de um minuto):',
    '1. Abra o painel e vá em "Minhas credenciais".',
    `2. Escolha ${varias ? 'cada loja da lista acima' : `a ${nomes}`}.`,
    '3. Cole o código de acesso novo e salve. A gente testa na hora e avisa se ficou certo.',
    '',
    `Abrir minhas credenciais: ${link}`,
    '',
    `Equipe ${BRAND_NAME}`,
  ].join('\n')

  const listaHtml = lojas.map((platform) => `<li style="margin-bottom:6px"><strong>${STORE_LABELS[platform]}</strong></li>`).join('')

  const html = `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">${greeting}</h1>
    <p style="font-size:15px;line-height:1.6">${abertura}</p>
    <ul style="font-size:15px;line-height:1.6;padding-left:20px">${listaHtml}</ul>
    <p style="font-size:15px;line-height:1.6">Fique tranquila: suas ofertas <strong>continuam saindo</strong> normalmente e a comissão <strong>continua sendo sua</strong>.</p>
    <p style="font-size:15px;line-height:1.6">${diferenca}</p>
    <p style="font-size:15px;line-height:1.6;margin-top:24px"><strong>Como resolver</strong> (leva menos de um minuto):</p>
    <ol style="font-size:15px;line-height:1.6;padding-left:20px">
      <li style="margin-bottom:8px">Abra o painel e vá em "Minhas credenciais".</li>
      <li style="margin-bottom:8px">Escolha ${varias ? 'cada loja da lista acima' : `a ${nomes}`}.</li>
      <li style="margin-bottom:8px">Cole o código de acesso novo e salve. A gente testa na hora e avisa se ficou certo.</li>
    </ol>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Abrir minhas credenciais</a>
    </p>
    <p style="font-size:14px;line-height:1.6;margin-top:24px">Equipe ${BRAND_NAME}</p>
  </div>
</body>
</html>`

  return { subject, text, html }
}
