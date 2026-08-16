// Catálogo dos e-mails do BOTinho: o TEXTO PADRÃO de cada um mora aqui, no
// código. O painel admin só grava OVERRIDE (tabela EmailTemplate) — sem linha
// lá, vale o que está aqui. Assim o sistema nunca fica sem texto, e um erro de
// edição no painel se conserta apagando o override.
//
// Puro: sem banco, sem rede. O corpo usa o formato descrito em markup.js.
//
// `category` decide a regra de consentimento:
//   transactional — obrigação de serviço (cobrança, vencimento, segurança).
//                   Sempre envia, sem descadastro no rodapé.
//   marketing     — divulgação. Respeita descadastro e leva o link no rodapé.

export const EMAIL_CATEGORIES = Object.freeze(['transactional', 'marketing'])

export const EMAIL_GROUPS = Object.freeze({
  conta: 'Conta e teste grátis',
  plano: 'Plano e pagamento',
  saude: 'Saúde do robô',
  afiliados: 'Programa de afiliados',
  marketing: 'Marketing e avisos',
})

// Variáveis que TODO e-mail recebe, sem precisar declarar.
export const STANDARD_VARIABLES = Object.freeze([
  { name: 'primeiro_nome', description: 'Primeiro nome do cliente', example: 'Juliane' },
  { name: 'nome', description: 'Nome completo do cliente', example: 'Juliane Pumuceno' },
  { name: 'link_painel', description: 'Endereço do painel', example: 'https://espelhagrupos.com.br/painel' },
  { name: 'link_login', description: 'Endereço da tela de entrada', example: 'https://espelhagrupos.com.br/login' },
  { name: 'link_planos', description: 'Endereço da tela de planos', example: 'https://espelhagrupos.com.br/painel/planos' },
  { name: 'email_suporte', description: 'E-mail de suporte', example: 'contato@espelhagrupos.com.br' },
  { name: 'whatsapp_suporte', description: 'WhatsApp de suporte', example: 'https://wa.me/5532999844020' },
  { name: 'marca', description: 'Nome da marca', example: 'BOTinho' },
])

const DEFINITIONS = [
  {
    slug: 'boas_vindas',
    name: 'Conta criada + 7 dias grátis',
    description: 'Sai no cadastro. Confirma a conta e diz até quando vale o teste grátis.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 365,
    variables: [
      { name: 'fim_do_teste', description: 'Data em que o teste grátis acaba', example: '23/08/2026' },
    ],
    title: 'Bem-vinda ao {{marca}}!',
    subject: 'Bem-vinda ao {{marca}}! Seus 7 dias grátis já começaram 🎉',
    body: `Olá, {{primeiro_nome}}! Sua conta está pronta e seu teste grátis vale até **{{fim_do_teste}}**.

Para o robô começar a trabalhar hoje, siga estes 5 passos (leva uns 4 minutos):

1. Conecte seu WhatsApp (de preferência um chip só para isso, não o pessoal).
2. Marque os grupos ou canais de ONDE as ofertas vêm.
3. Marque os grupos ou canais PARA ONDE as ofertas vão.
4. Cadastre suas etiquetas de afiliada (Mercado Livre, Amazon, Shopee).
5. Ligue o robô e acompanhe os envios na tela de Histórico.

[[botao:Acessar o painel|{{link_login}}]]

Travou em algum passo? A gente te ajuda pessoalmente pelo e-mail {{email_suporte}} ou pelo WhatsApp {{whatsapp_suporte}}.`,
  },
  {
    slug: 'teste_acaba_em_3_dias',
    name: 'Teste grátis: faltam 3 dias',
    description: 'Sai quando faltam 3 dias para o teste grátis acabar.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [
      { name: 'fim_do_teste', description: 'Data em que o teste grátis acaba', example: '19/08/2026' },
      { name: 'dias_restantes', description: 'Quantos dias faltam', example: '3' },
    ],
    title: 'Faltam {{dias_restantes}} dias do seu teste grátis',
    subject: 'Faltam {{dias_restantes}} dias do seu teste grátis no {{marca}}',
    body: `Olá, {{primeiro_nome}}! Seu teste grátis vai até **{{fim_do_teste}}**.

Depois dessa data o robô para de enviar suas ofertas. Para não perder nenhum envio, escolha um plano antes do fim do teste — leva menos de dois minutos e você continua exatamente de onde parou.

[[botao:Escolher meu plano|{{link_planos}}]]

Ficou com dúvida sobre qual plano serve para você? Responde este e-mail que a gente te ajuda a escolher.`,
  },
  {
    slug: 'promocao_relampago',
    name: 'Promoção relâmpago (manual)',
    description: 'Você dispara pelo painel. Serve para campanha de desconto por tempo limitado.',
    group: 'marketing',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 7,
    variables: [
      { name: 'oferta', description: 'O que está sendo oferecido', example: '40% de desconto no plano Pro' },
      { name: 'validade', description: 'Até quando vale', example: 'só até domingo' },
    ],
    title: 'Promoção relâmpago no {{marca}}',
    subject: '{{oferta}} no {{marca}} — {{validade}}',
    body: `Olá, {{primeiro_nome}}! Estamos com uma condição especial: **{{oferta}}**, {{validade}}.

O robô volta a espelhar suas ofertas assim que o plano estiver ativo — seus grupos, suas etiquetas de afiliada e suas configurações continuam salvos, do jeito que você deixou.

[[botao:Aproveitar agora|{{link_planos}}]]`,
  },
]

const BY_SLUG = new Map(DEFINITIONS.map((definition) => [definition.slug, Object.freeze(definition)]))

export function listTemplateDefinitions() {
  return DEFINITIONS.map((definition) => Object.freeze(definition))
}

export function getTemplateDefinition(slug) {
  return BY_SLUG.get(String(slug ?? '')) ?? null
}

export function templateExists(slug) {
  return BY_SLUG.has(String(slug ?? ''))
}

/**
 * Todas as variáveis que um e-mail aceita (padrão + próprias).
 * @param {string} slug
 * @returns {Array<{name: string, description: string, example: string}>}
 */
export function variablesForTemplate(slug) {
  const definition = getTemplateDefinition(slug)
  return [...STANDARD_VARIABLES, ...(definition?.variables ?? [])]
}
