/* NOME ÚNICO: Espelha Grupos (decisão de 2026-09-02).
 *
 * Antes havia TRÊS nomes circulando ao mesmo tempo: "Espelha Grupos" (marca no
 * schema e no domínio), "BOTinho" (nome do produto no corpo do texto) e
 * "Bot Conversor" (no rodapé de todas as páginas, sobra de uma nomeação ainda
 * mais antiga). A tentativa de 08/2026 foi manter dois e amarrá-los; a medição
 * de citação por IA de 01/09 mostrou que não funcionou:
 *
 *  - o ChatGPT trata "Espelha Grupos" e "BOTinho" como PRODUTOS CONCORRENTES —
 *    ofereceu "uma comparação objetiva BOTinho x Espelha Grupos" e listou os
 *    dois lado a lado com o Promium, como três empresas diferentes;
 *  - "BOTinho" sozinho é lido como CALÇADO INFANTIL por três das quatro IAs
 *    (Gemini, Perplexity e Google AI Overviews devolvem botinha de bebê e preço
 *    de loja de sapato para a consulta "BOTinho preço").
 *
 * Por que o nome que fica é Espelha Grupos, e não o contrário:
 *  - é o domínio que temos (espelhagrupos.com.br); "botinho.com.br" não está
 *    disponível, e marca em nome diferente do endereço é o problema que a
 *    auditoria de funil de 2026-08-05 (§1.2) já tinha apontado;
 *  - `botinho` teve UMA impressão em 3 meses de Search Console. Não há marca a
 *    perder — ninguém procura por esse nome;
 *  - ganhar a palavra "botinho" sozinha exigiria superar páginas de produto de
 *    loja de calçado (Pittol, Centauro, Amazon), que têm estoque, preço e dados
 *    estruturados. Caro e lento, por uma palavra cujo domínio não podemos ter.
 *
 * O nome antigo NÃO é apagado do mundo:
 *  - continua como `alternateName` no schema, para o Google e as IAs ligarem as
 *    citações antigas a esta mesma entidade;
 *  - continua no PAINEL (área logada), onde a pessoa já sabe onde está e não
 *    existe ambiguidade nenhuma;
 *  - as ROTAS que carregavam o nome antigo no endereço foram RENOMEADAS em
 *    19/09/2026 (decisão da dona do produto), com redirect permanente em
 *    `next.config.mjs` (LEGACY_ROUTE_REDIRECTS). Somavam 27 impressões e 1
 *    clique em 3 meses; o redirect preserva o pouco histórico que havia.
 *
 * Regra de escrita em superfície PÚBLICA (decisão de 19/09/2026): só
 * "Espelha Grupos". Nem o nome antigo sozinho, nem emparelhado ("X é o nome do
 * robô do Espelha Grupos") — a versão emparelhada existiu de 11/09 a 19/09 em
 * seis páginas e foi retirada. A ligação com as citações antigas fica SÓ no
 * schema (`alternateName`) e na linha de "nome anterior" do llms.txt.
 * Guarda: test/nome-antigo-fora-do-texto-publico.test.js.
 */
export const BRAND_ORG_NAME = 'Espelha Grupos'
export const BRAND_PRODUCT_NAME = 'Espelha Grupos'

// Nome anterior. Só existe para entrar no `alternateName` do schema — é o que
// faz uma citação antiga a "BOTinho" continuar apontando para esta entidade.
// Não usar em texto novo de superfície pública.
export const BRAND_LEGACY_NAME = 'BOTinho'

// Aliases históricos — os pontos de uso continuam funcionando sem reescrita.
export const BRAND_NAME = BRAND_ORG_NAME
export const BRAND_SHORT_NAME = BRAND_ORG_NAME
export const BRAND_LEGAL_CITATION = 'Espelha Grupos'

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
  process.env.NEXT_PUBLIC_BRAND_YOUTUBE_URL || 'https://www.youtube.com/@espelhagrupos'

// Perfil oficial no Instagram (confirmado pela dona do produto em 19/09/2026:
// @espelhagrupos). Mesma regra do YouTube: URL pública, default no código, env
// só como override.
export const BRAND_INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_BRAND_INSTAGRAM_URL || 'https://www.instagram.com/espelhagrupos'

// Perfil oficial no TikTok (confirmado pela dona do produto em 20/09/2026:
// @espelhagrupos). Mesma regra do YouTube/Instagram: URL pública, default no
// código, env só como override.
export const BRAND_TIKTOK_URL =
  process.env.NEXT_PUBLIC_BRAND_TIKTOK_URL || 'https://www.tiktok.com/@espelhagrupos'

// Página da EMPRESA no LinkedIn (confirmada pela dona do produto em
// 20/09/2026). Vai no `sameAs` da Organization — é distinta do perfil PESSOAL
// dela, que vai em FOUNDER_SAME_AS (a mesma separação Organization/Person já
// documentada no comentário de BRAND_SAME_AS).
export const BRAND_LINKEDIN_URL =
  process.env.NEXT_PUBLIC_BRAND_LINKEDIN_URL || 'https://www.linkedin.com/company/145208936/'

// Tutorial oficial de criação de conta. É a prova social VERIFICÁVEL que
// substituiu os números inventados do bloco `Social` (auditoria de funil
// 2026-08-05, §1.1) — qualquer visitante confere no canal. `-nocookie` evita
// cookie de rastreio do YouTube antes de o vídeo ser tocado.
export const BRAND_YOUTUBE_TUTORIAL_ID =
  process.env.NEXT_PUBLIC_BRAND_YOUTUBE_TUTORIAL_ID || '_Sy6BAdN2hI'
export const BRAND_YOUTUBE_TUTORIAL_URL = `https://www.youtube.com/watch?v=${BRAND_YOUTUBE_TUTORIAL_ID}`
export const BRAND_YOUTUBE_TUTORIAL_EMBED_URL = `https://www.youtube-nocookie.com/embed/${BRAND_YOUTUBE_TUTORIAL_ID}?rel=0`

// Endereço público do Cuponito, usado no `sameAs` da Organization, no `sameAs`
// da Person e no link visível de /quem-somos — um lugar só, para as três pontas
// nunca discordarem.
export const CUPONITO_URL = 'https://www.cuponito.com.br'
export const CUPONITO_ABOUT_URL = `${CUPONITO_URL}/quem-somos`

// ⚠️ Decisão da dona do produto (18/09/2026): o Cuponito entra TAMBÉM aqui, no
// `sameAs` da Organization, e não só no `sameAs` da Person.
// A leitura estrita de schema.org é a contrária — `sameAs` quer dizer "mesma
// entidade", e Cuponito e Espelha Grupos são duas empresas; o que é a mesma
// entidade nos dois sites é a PESSOA (por isso `founder` → Person → `sameAs`
// continua existindo e continua sendo a ligação principal). Registrado aqui para
// a escolha ficar explícita: se a Search Console acusar entidade confusa, o
// primeiro item a tirar é esta linha, não o `founder`.
export const BRAND_SAME_AS = [
  SUPPORT_WHATSAPP_URL,
  BRAND_YOUTUBE_URL,
  BRAND_INSTAGRAM_URL,
  BRAND_TIKTOK_URL,
  BRAND_LINKEDIN_URL,
  CUPONITO_ABOUT_URL,
].filter(Boolean)

// Perfis da FUNDADORA em outros sites da mesma dona. Esta é a ligação
// PRINCIPAL: `sameAs` significa "mesma entidade", e o que é a mesma entidade
// nos três sites é a PESSOA, não a empresa (o Cuponito também entra no `sameAs`
// da Organization desde 18/09/2026, por decisão da dona do produto — ver o
// comentário em BRAND_SAME_AS —, mas é este aqui que carrega o sentido) — e é isso que as IAs liam partido
// (ChatGPT tratou Espelha Grupos e BOTinho como concorrentes; medição de
// 01/09). Os dois endereços são os `@id` de Person que os outros sites já
// publicam no próprio JSON-LD (verificado em 18/09/2026).
// Perfil PESSOAL dela no LinkedIn (confirmado 20/09/2026) — distinto da
// página da empresa (BRAND_LINKEDIN_URL, acima). Vai aqui porque `sameAs`
// da Person é a ligação principal da entidade única.
export const FOUNDER_LINKEDIN_URL =
  process.env.NEXT_PUBLIC_FOUNDER_LINKEDIN_URL || 'https://www.linkedin.com/in/flaviavale/'

export const FOUNDER_SAME_AS = [
  `${CUPONITO_ABOUT_URL}#person`,
  CUPONITO_ABOUT_URL,
  'https://aulasdematematicabh.com.br/#flavia',
  FOUNDER_LINKEDIN_URL,
]

// Caminho do `@id` da Person. É CITADO DE FORA: o JSON-LD do Cuponito aponta a
// autoria dos posts e o `founder` de lá para <site>/quem-somos#person. Trocar
// este caminho (ou voltar para '#founder', como estava até 18/09/2026) quebra a
// ligação em silêncio — o Cuponito afirma e o Espelha Grupos não confirma.
export const FOUNDER_PERSON_ID_PATH = '/quem-somos#person'

export const PRODUCT_DEFINITION = 'O Espelha Grupos é um software web para afiliados, curadores de ofertas e admins de grupos e canais que organiza grupos e/ou canais de origem e destino, converte links suportados e ajuda a distribuir mensagens de WhatsApp com revisão humana, cadência responsável e histórico de logs.'

// Lojas com conversão de link suportada. Fonte ÚNICA para texto público,
// schema e FAQ: em 2026-09-18 a página de preços, a API pública de planos e a
// FAQ pública ainda diziam 4 lojas enquanto o produto já cobria 6.
export const SUPPORTED_STORES = ['Shopee', 'Mercado Livre', 'Amazon', 'Magalu', 'SHEIN', 'AliExpress']

// Sites-irmãos da mesma fundadora, citados em /quem-somos com link normal
// (sem nofollow: é relação real, declarada dos dois lados).
export const SISTER_SITES = [
  { name: 'Cuponito', url: `${CUPONITO_URL}/`, description: `site brasileiro de cupons de desconto verificados para ${SUPPORTED_STORES.join(', ')}` },
]

export const PRICING_PRODUCT_DESCRIPTION = `Robô que converte links de afiliado de ${SUPPORTED_STORES.length} lojas (${SUPPORTED_STORES.join(', ')}) para o código da afiliada e publica as ofertas em grupos e canais do WhatsApp.`

export const PRODUCT_LIMITATIONS = [
  'Não prometemos ganho financeiro, comissão ou aumento garantido de vendas.',
  'Não deve ser usado para spam, disparos sem consentimento ou burlar regras do WhatsApp e das plataformas de afiliados.',
  'Preço, cupom, estoque, tag de afiliado e regras de cada plataforma devem ser revisados pela operação antes da divulgação.',
]

// Fallback dos planos públicos. A fonte dinâmica é a tabela LpPlan (editável
// pelo admin, atualizada por migration aditiva) — manter os DOIS em sincronia.
/* Converte o preço EXIBIDO ("R$39", "R$ 1.299,90") no número que vai para o
 * schema Offer. Antes, `priceValue` vinha sempre do default hardcoded, nos DOIS
 * caminhos de merge (lib/plans-server.js no servidor e components/landing/
 * Pricing.jsx no cliente): trocar o preço no painel admin mudava o que a pessoa
 * lê e NÃO mudava o que o Google e as IAs leem — as duas pontas passavam a
 * discordar em silêncio. Formato inesperado devolve null e o chamador cai no
 * default; nunca publica preço inventado.
 *
 * Mora aqui, e não no componente, porque `plans-server.js` roda no SERVIDOR:
 * importar de um módulo 'use client' arrastaria a fronteira de cliente para
 * dentro do render estático.
 */
export function parsePriceValue(price) {
  if (typeof price !== 'string') return null
  const limpo = price.replace(/[^\d.,]/g, '')
  if (!limpo) return null
  const n = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export const DEFAULT_LANDING_PLANS = [
  {
    id: 'trial',
    name: 'Teste grátis',
    price: 'R$0',
    priceValue: 0,
    period: '7 dias de validação inicial',
    desc: 'Experimente por 7 dias tudo do Pro: grupos, canais, garimpo automático de ofertas, filas e controle do ritmo dos envios.',
    cta: 'Começar teste grátis',
    features: ['Tudo do plano Pro por 7 dias', 'Espelhamento em grupos e canais', 'Garimpo automático de ofertas e filas de envio', 'Painel de vendas e comissão da Shopee', 'Marca d\u2019água e card de oferta clicável', 'Relatórios de envio completos'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 'R$39',
    priceValue: 39,
    period: '30 dias',
    desc: 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.',
    cta: 'Assinar Basic',
    features: ['Espelhamento de grupos (monitor → destinos)', 'Conversão de links em 6 lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Painel de vendas e comissão da Shopee (pedidos, valor vendido e comissão)', 'Marca d\u2019água com o seu nome na foto da oferta', 'Card de oferta clicável: tocar no card abre a loja', 'Mensagem reescrita do seu jeito, não copiada da origem', 'Criar oferta a partir de link (título, preço e imagem)', 'Envio imediato e agendado', 'Relatórios de envio com histórico completo'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$69',
    priceValue: 69,
    period: '30 dias',
    desc: 'Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e controle de ritmo dos envios.',
    cta: 'Assinar Pro',
    highlight: true,
    features: ['Tudo do Basic', 'Monitoramento e envio em canais', 'Garimpo automático de ofertas da Shopee: o robô acha as ofertas por palavra-chave e filtros, você não precisa colar link', 'Filas de ofertas com intervalo definido e limites por hora e por dia', 'Controle do ritmo dos envios por grupo (Módulo de Preservação Avançada): intervalo, horário de descanso, limite diário e variação do texto'],
  },
]

export const CORE_FAQ_ITEMS = [
  {
    id: 'faq_seed_whatsapp_ban',
    question: 'Vou ser banida do WhatsApp?',
    answer: 'O Espelha Grupos permite intervalos configuráveis, filtros anti-spam e revisão da operação, mas nenhum software elimina risco de bloqueio. Use apenas grupos e canais autorizados, mensagens relevantes e cadência responsável.',
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
    answer: 'Hoje o fluxo é focado em links suportados de seis lojas: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress. Cadastre as credenciais exigidas para as lojas que você usa e revise cada oferta antes de divulgar.',
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
