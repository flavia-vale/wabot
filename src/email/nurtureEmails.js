// Builders puros dos e-mails da trilha de nutrição de leads (BOTinho).
//
// Espelha o padrão de welcomeEmail.js: funções puras (sem env/rede), pt-BR,
// marca BOTinho. O passo 0 é coberto pelo e-mail de boas-vindas existente
// (buildWelcomeEmail) — o builder de dia 0 aqui existe apenas como definição
// dormente, para o caso de um dia-0 próprio no futuro; a passada diária só
// dispara os passos 2, 5 e 7.
//
// Contrato de conteúdo garantido por teste: todo `text` e `html` MUST conter
// o `unsubscribeUrl` recebido — nenhum passo pode omitir o link de
// descadastro (FR-004, SC-004).

const BRAND_NAME = 'BOTinho'
const DEFAULT_DASHBOARD_URL = 'https://espelhagrupos.com.br'

function resolveDashboardUrl() {
  const raw = (process.env.DASHBOARD_URL || process.env.API_URL || DEFAULT_DASHBOARD_URL).trim()
  return raw.replace(/\/+$/, '')
}

function greetingFor(name) {
  const firstName = (name || '').trim().split(/\s+/)[0] || ''
  return firstName ? `Olá, ${firstName}!` : 'Olá!'
}

function footerText(unsubscribeUrl) {
  return [
    '',
    '—',
    `Você recebeu este e-mail porque criou uma conta no ${BRAND_NAME}.`,
    `Não quer mais receber esta sequência? Descadastre-se: ${unsubscribeUrl}`,
  ].join('\n')
}

function footerHtml(unsubscribeUrl) {
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px" />
    <p style="font-size:12px;line-height:1.6;color:#9ca3af">
      Você recebeu este e-mail porque criou uma conta no ${BRAND_NAME}.<br/>
      Não quer mais receber esta sequência?
      <a href="${unsubscribeUrl}" style="color:#6b7280">Descadastre-se aqui</a>.
    </p>`
}

function wrapHtml({ title, bodyHtml, unsubscribeUrl }) {
  return `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">${title}</h1>
    ${bodyHtml}
    ${footerHtml(unsubscribeUrl)}
  </div>
</body>
</html>`
}

/** Definição imutável dos 4 passos da trilha (dia-marco = identificador estável). */
export const NURTURE_STEPS = Object.freeze([
  Object.freeze({ step: 0, milestoneDays: 0, theme: 'entrega' }),
  Object.freeze({ step: 2, milestoneDays: 2, theme: 'valor' }),
  Object.freeze({ step: 5, milestoneDays: 5, theme: 'teste' }),
  Object.freeze({ step: 7, milestoneDays: 7, theme: 'ativacao' }),
])

function buildStep0({ name, unsubscribeUrl, dashboardUrl }) {
  // Dormente: o passo 0 é coberto pelo e-mail de boas-vindas existente
  // (buildWelcomeEmail). Definido aqui só para completude do contrato.
  const greeting = greetingFor(name)
  const loginUrl = `${dashboardUrl}/login`
  const subject = `Bem-vinda ao ${BRAND_NAME}!`
  const text = [
    greeting,
    '',
    `Sua conta no ${BRAND_NAME} está pronta.`,
    `Acesse o painel: ${loginUrl}`,
  ].join('\n') + footerText(unsubscribeUrl)
  const html = wrapHtml({
    title: greeting,
    bodyHtml: `<p style="font-size:15px;line-height:1.6">Sua conta no <strong>${BRAND_NAME}</strong> está pronta.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${loginUrl}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Acessar o painel</a>
    </p>`,
    unsubscribeUrl,
  })
  return { subject, text, html }
}

function buildStep2({ name, unsubscribeUrl, dashboardUrl }) {
  const greeting = greetingFor(name)
  const loginUrl = `${dashboardUrl}/login`
  const subject = `${BRAND_NAME}: 3 jeitos rápidos de tirar mais proveito do robô`
  const text = [
    greeting,
    '',
    `Já faz 2 dias que você conheceu o ${BRAND_NAME}. Um lembrete rápido de valor:`,
    '',
    '1. Conecte o WhatsApp e marque os grupos de origem/destino.',
    '2. Cadastre seus IDs de afiliada (Mercado Livre, Amazon, Shopee).',
    '3. Acompanhe os envios em tempo real pela tela de Logs.',
    '',
    `Acesse o painel: ${loginUrl}`,
  ].join('\n') + footerText(unsubscribeUrl)
  const html = wrapHtml({
    title: greeting,
    bodyHtml: `<p style="font-size:15px;line-height:1.6">Já faz 2 dias que você conheceu o <strong>${BRAND_NAME}</strong>. Um lembrete rápido de valor:</p>
    <ol style="font-size:15px;line-height:1.6;padding-left:20px">
      <li style="margin-bottom:8px">Conecte o WhatsApp e marque os grupos de origem/destino.</li>
      <li style="margin-bottom:8px">Cadastre seus IDs de afiliada (Mercado Livre, Amazon, Shopee).</li>
      <li style="margin-bottom:8px">Acompanhe os envios em tempo real pela tela de Logs.</li>
    </ol>
    <p style="text-align:center;margin:28px 0">
      <a href="${loginUrl}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Acessar o painel</a>
    </p>`,
    unsubscribeUrl,
  })
  return { subject, text, html }
}

function buildStep5({ name, unsubscribeUrl, dashboardUrl }) {
  const greeting = greetingFor(name)
  const loginUrl = `${dashboardUrl}/login`
  const subject = `${BRAND_NAME}: já testou o robô enviando uma oferta de verdade?`
  const text = [
    greeting,
    '',
    `Se você ainda não testou, esse é o momento: cadastre uma oferta e veja o ${BRAND_NAME}`,
    'enviar automaticamente para seus grupos de destino.',
    '',
    `Acesse o painel: ${loginUrl}`,
    '',
    'Travou em algum passo? A gente te ajuda pessoalmente pelo suporte no painel.',
  ].join('\n') + footerText(unsubscribeUrl)
  const html = wrapHtml({
    title: greeting,
    bodyHtml: `<p style="font-size:15px;line-height:1.6">Se você ainda não testou, esse é o momento: cadastre uma oferta e veja o <strong>${BRAND_NAME}</strong> enviar automaticamente para seus grupos de destino.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${loginUrl}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Acessar o painel</a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#4b5563">Travou em algum passo? A gente te ajuda pessoalmente pelo suporte no painel.</p>`,
    unsubscribeUrl,
  })
  return { subject, text, html }
}

function buildStep7({ name, unsubscribeUrl, dashboardUrl }) {
  const greeting = greetingFor(name)
  const loginUrl = `${dashboardUrl}/login`
  const subject = `${BRAND_NAME}: seu teste grátis está perto de acabar`
  const text = [
    greeting,
    '',
    `Já se passou uma semana desde que você conheceu o ${BRAND_NAME}. Ative o robô agora`,
    'para não perder nenhuma oferta enquanto seu teste grátis ainda está valendo.',
    '',
    `Acesse o painel: ${loginUrl}`,
  ].join('\n') + footerText(unsubscribeUrl)
  const html = wrapHtml({
    title: greeting,
    bodyHtml: `<p style="font-size:15px;line-height:1.6">Já se passou uma semana desde que você conheceu o <strong>${BRAND_NAME}</strong>. Ative o robô agora para não perder nenhuma oferta enquanto seu teste grátis ainda está valendo.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${loginUrl}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Acessar o painel</a>
    </p>`,
    unsubscribeUrl,
  })
  return { subject, text, html }
}

const BUILDERS_BY_STEP = {
  0: buildStep0,
  2: buildStep2,
  5: buildStep5,
  7: buildStep7,
}

/**
 * Monta o conteúdo do e-mail do passo indicado. Função pura.
 * @param {0|2|5|7} step
 * @param {{ name?: string, unsubscribeUrl: string, dashboardUrl?: string }} params
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildNurtureEmail(step, { name, unsubscribeUrl, dashboardUrl = resolveDashboardUrl() } = {}) {
  const builder = BUILDERS_BY_STEP[step]
  if (!builder) throw new Error(`Passo de nutrição desconhecido: ${step}`)
  return builder({ name, unsubscribeUrl, dashboardUrl })
}
