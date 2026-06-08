export const BRAND_NAME = 'BOTinho'
export const BRAND_SHORT_NAME = 'Espelha Grupos'
export const BRAND_LEGAL_CITATION = 'BOTinho / Espelha Grupos'

export const SUPPORT_WHATSAPP_NUMBER = '5532999844020'
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`
// E-mail de suporte: configurável por env (NEXT_PUBLIC_SUPPORT_EMAIL) para
// trocar num lugar só quando houver caixa/encaminhamento. Default usa o
// domínio de produção já registrado (espelhagrupos.com.br) — sem nova compra.
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'contato@espelhagrupos.com.br'
// Janela de atendimento exibida ao usuário (SLA informal da fase atual).
export const SUPPORT_HOURS = 'Segunda a sexta, das 9h às 18h (horário de Brasília)'
export const SUPPORT_RESPONSE_SLA = 'Respondemos em até 1 dia útil'

export const BRAND_SAME_AS = [
  SUPPORT_WHATSAPP_URL,
]

export const PRODUCT_DEFINITION = 'O BOTinho, do Espelha Grupos, é um software web para afiliados, curadores de ofertas e admins de grupos e canais que organiza grupos e/ou canais de origem e destino, converte links suportados e ajuda a distribuir mensagens de WhatsApp com revisão humana, cadência responsável e histórico de logs.'

export const PRODUCT_LIMITATIONS = [
  'Não promete ganho financeiro, comissão ou aumento garantido de vendas.',
  'Não deve ser usado para spam, disparos sem consentimento ou burlar regras do WhatsApp e das plataformas de afiliados.',
  'Preço, cupom, estoque, tag de afiliado e regras de cada plataforma devem ser revisados pela operação antes da divulgação.',
]

export const DEFAULT_LANDING_PLANS = [
  {
    id: 'trial',
    name: 'Teste grátis',
    price: 'R$0',
    priceValue: 0,
    period: '7 dias de validação inicial',
    desc: 'Teste por 7 dias os recursos completos do Pro: grupos, canais e Módulo de Preservação Avançada.',
    cta: 'Começar teste grátis',
    features: ['Conversão de links suportados', 'Monitoramento de grupos e canais', 'Envio para grupos e canais', 'Módulo de Preservação Avançada', 'Histórico de logs'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 'R$39',
    priceValue: 39,
    period: '30 dias',
    desc: 'Plano focado em grupos, com canais disponíveis no Pro: operação essencial com cadência e filtros básicos.',
    cta: 'Assinar Basic',
    features: ['Conversão de links suportados', 'Monitoramento e envio em grupos', 'Canais disponíveis no Pro', 'Delay e filtros básicos', 'Histórico de logs'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$69',
    priceValue: 69,
    period: '30 dias',
    desc: 'Tudo do Basic + canais + Módulo de Preservação Avançada para operar com mais controle.',
    cta: 'Assinar Pro',
    highlight: true,
    features: ['Tudo do Basic', 'Monitoramento e envio em canais', 'Módulo de Preservação Avançada', 'Warmup, limites e cadência avançada', 'Histórico de logs'],
  },
]

export const CORE_FAQ_ITEMS = [
  {
    id: 'faq_seed_whatsapp_ban',
    question: 'Vou ser banida do WhatsApp?',
    answer: 'O BOTinho permite intervalos configuráveis, filtros anti-spam e revisão da operação, mas nenhum software elimina risco de bloqueio. Use apenas grupos e canais autorizados, mensagens relevantes e cadência responsável.',
  },
  {
    id: 'faq_seed_cancel',
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim. Você pode interromper o uso quando quiser e não precisa falar com call center para parar sua operação.',
  },
  {
    id: 'faq_seed_phone',
    question: 'Preciso deixar meu celular ligado?',
    answer: 'Depois de conectar a sessão pelo QR Code, o bot roda no servidor e continua monitorando conforme sua configuração.',
  },
  {
    id: 'faq_seed_programs',
    question: 'Funciona com quais programas de afiliados?',
    answer: 'Hoje o fluxo é focado em links suportados de Shopee, Mercado Livre, Amazon e Magalu. Cadastre as credenciais exigidas para as plataformas que você usa e revise cada oferta antes de divulgar.',
  },
  {
    id: 'faq_seed_text',
    question: 'Posso controlar os envios?',
    answer: 'Sim. Você define grupos e/ou canais de origem e destino, filtros por palavras, plataformas permitidas e acompanha os envios pelo histórico de logs.',
  },
]

export const RESPONSIBLE_OPERATION_POINTS = [
  {
    title: 'Revisão humana antes da escala',
    body: 'Valide preço, estoque, cupom, regra da plataforma e link monetizado antes de automatizar qualquer mensagem.',
  },
  {
    title: 'Cadência em vez de spam',
    body: 'Use intervalos, grupos e canais autorizados e mensagens relevantes para reduzir ruído e proteger a experiência da comunidade.',
  },
  {
    title: 'Logs para aprender com a operação',
    body: 'Acompanhe histórico de envios e falhas para ajustar grupos/canais, horários e campanhas com evidência operacional.',
  },
]
