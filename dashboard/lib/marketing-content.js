// Hierarquia de marca (decisão de 2026-08, P1 do estudo de inbound).
//
// Antes o site renderizava "BOTinho" num domínio "espelhagrupos.com.br" e as
// duas coisas apareciam como marcas concorrentes. Para o Google e sobretudo
// para as IAs, entidade é tudo: uma IA só cita com confiança uma marca que ela
// consegue identificar de forma consistente, e não havia nada ligando um nome
// ao outro. Como o domínio fica, "Espelha Grupos" passa a ser a MARCA
// (Organization, title template, publisher) e "BOTinho" o NOME DO PRODUTO
// (SoftwareApplication, corpo do texto, painel, mensagens).
//
// Não renomear as rotas que têm "botinho" no slug (/protecao-antiban-botinho,
// /bot-comum-vs-botinho, etc.): trocar URL descarta o histórico que o Google já
// acumulou nelas, que é justamente o ativo que estamos tentando crescer.
export const BRAND_ORG_NAME = 'Espelha Grupos'
export const BRAND_PRODUCT_NAME = 'BOTinho'

// Aliases históricos — os pontos de uso já aplicavam a semântica correta
// (BRAND_NAME no corpo do texto = produto; BRAND_SHORT_NAME em eyebrow/Brand =
// marca), então mantê-los evita reescrever dezenas de arquivos sem ganho.
export const BRAND_NAME = BRAND_PRODUCT_NAME
export const BRAND_SHORT_NAME = BRAND_ORG_NAME
export const BRAND_LEGAL_CITATION = 'Espelha Grupos / BOTinho'

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

// Perfis oficiais da marca. Entram no `sameAs` do schema Organization: é assim
// que o Google e as IAs ligam o site aos perfis de fora e tratam tudo como a
// MESMA entidade. Sem isso, o canal do YouTube e o site são duas coisas
// desconexas — e o estudo mediu que marca é citada por IA ~6,5x mais via fonte
// de terceiro do que pelo próprio site.
// Canal oficial (verificado em 04/08/2026). Fica como default no código, e não
// só em env, para não depender de editar `.env.local` no VPS + delete/start do
// pm2 (pegadinha #1 do AGENTS.md) — é URL pública, não é segredo. A env segue
// existindo como override caso o canal mude de endereço.
export const BRAND_YOUTUBE_URL =
  process.env.NEXT_PUBLIC_BRAND_YOUTUBE_URL || 'https://www.youtube.com/@botinhoafiliado'

export const BRAND_SAME_AS = [
  SUPPORT_WHATSAPP_URL,
  BRAND_YOUTUBE_URL,
].filter(Boolean)

export const PRODUCT_DEFINITION = 'O BOTinho é um software web para afiliados, curadores de ofertas e admins de grupos e canais que organiza grupos e/ou canais de origem e destino, converte links suportados e ajuda a distribuir mensagens de WhatsApp com revisão humana, cadência responsável e histórico de logs.'

export const PRODUCT_LIMITATIONS = [
  'Não prometemos ganho financeiro, comissão ou aumento garantido de vendas.',
  'Não deve ser usado para spam, disparos sem consentimento ou burlar regras do WhatsApp e das plataformas de afiliados.',
  'Preço, cupom, estoque, tag de afiliado e regras de cada plataforma devem ser revisados pela operação antes da divulgação.',
]

// Fallback dos planos públicos. A fonte dinâmica é a tabela LpPlan (editável
// pelo admin, atualizada por migration aditiva) — manter os DOIS em sincronia.
export const DEFAULT_LANDING_PLANS = [
  {
    id: 'trial',
    name: 'Teste grátis',
    price: 'R$0',
    priceValue: 0,
    period: '7 dias de validação inicial',
    desc: 'Experimente por 7 dias tudo do Pro: grupos, canais, ofertas automáticas, filas e o Módulo de Preservação Avançada.',
    cta: 'Começar teste grátis',
    features: ['Tudo do plano Pro por 7 dias', 'Espelhamento em grupos e canais', 'Ofertas automáticas e filas de envio', 'Módulo de Preservação Avançada', 'Relatórios de envio completos'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 'R$39',
    priceValue: 39,
    period: '30 dias',
    desc: 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.',
    cta: 'Assinar Basic',
    features: ['Espelhamento de grupos (monitor → destinos)', 'Conversão de links: Mercado Livre, Amazon, Shopee e Magalu', 'Criar oferta a partir de link (título, preço e imagem)', 'Envio imediato e agendado', 'Templates de mensagem personalizáveis', 'Relatórios de envio com histórico completo'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$69',
    priceValue: 69,
    period: '30 dias',
    desc: 'Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e Módulo de Preservação Avançada.',
    cta: 'Assinar Pro',
    highlight: true,
    features: ['Tudo do Basic', 'Monitoramento e envio em canais', 'Ofertas automáticas da Shopee (palavra-chave, filtros e dedup inteligente)', 'Filas de ofertas com limites por hora e por dia', 'Módulo de Preservação Avançada (cadência, horários de descanso, variação de copy e limites)'],
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
  {
    id: 'faq_seed_security',
    question: 'Meus dados de afiliado ficam seguros?',
    answer: 'Sim. As credenciais das suas contas de afiliado e sua chave PIX ficam criptografadas em repouso (AES-256-GCM), não em texto puro no banco. O login também tem proteção contra tentativas de força bruta.',
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
