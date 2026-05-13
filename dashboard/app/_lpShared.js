import '../app/landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { getSiteUrl } from '@/lib/site-url'

export const LP_CONFIG = {
  'espelhar-grupos-whatsapp-sao-paulo': { title: 'Espelhar grupos WhatsApp em São Paulo | wabot', description: 'Automatize sua rotina de ofertas em grupos de São Paulo com o wabot e reduza trabalho manual.', uniqueHeadline: 'Operação em São Paulo: volume alto, rotina estável.', uniqueBody: 'Em SP, a disputa por atenção é maior e os grupos giram rápido. O wabot ajuda você a manter constância sem perder tempo no copia-e-cola.', uniqueBullets: ['Padronize campanhas em múltiplos bairros e públicos.', 'Evite atrasos nas postagens de ofertas relâmpago.', 'Mantenha frequência diária mesmo em horários de pico.'], faq: [{ q: 'Quanto tempo para ativar em São Paulo?', a: 'Normalmente no mesmo dia: conexão por QR Code, escolha dos grupos e regras básicas.' }, { q: 'Posso separar grupos por bairro?', a: 'Sim. Você pode organizar fontes e destinos por região e tipo de público.' }], howTo: ['Conecte seu WhatsApp de operação e valide os grupos de origem.', 'Defina os grupos de destino e o intervalo ideal para o público paulista.', 'Ative regras por horário para manter consistência nos picos de tráfego.'] },
  'espelhar-grupos-whatsapp-rio-de-janeiro': { title: 'Espelhar grupos WhatsApp no Rio de Janeiro | wabot', description: 'Ganhe escala de publicação em grupos do Rio de Janeiro com operação previsível usando o wabot.', uniqueHeadline: 'No Rio, consistência vence improviso.', uniqueBody: 'Para campanhas no RJ, o diferencial está na repetição com timing certo. O wabot automatiza esse fluxo e reduz falhas de execução.', uniqueBullets: ['Mantenha cadência de ofertas por turno.', 'Distribua campanhas para grupos com perfis diferentes.', 'Reduza falhas manuais em dias de alto movimento.'], faq: [{ q: 'Funciona para operação no Rio inteiro?', a: 'Sim. Você pode segmentar grupos por cidade, zona e perfil de oferta.' }, { q: 'Preciso equipe para operar?', a: 'Não necessariamente. Muitas operações começam com uma pessoa e o bot ativo 24/7.' }], howTo: ['Mapeie grupos de origem com melhor volume no RJ.', 'Configure destinos por categoria de campanha.', 'Ative alertas e acompanhe logs para ajustar performance semanal.'] },
  'espelhar-grupos-whatsapp-belo-horizonte': { title: 'Espelhar grupos WhatsApp em Belo Horizonte | wabot', description: 'Padronize e acelere campanhas em grupos de Belo Horizonte com espelhamento automatizado.', uniqueHeadline: 'BH com processo enxuto e previsível.', uniqueBody: 'Em Belo Horizonte, operações menores podem ganhar escala quando padronizam fluxo, mensagem e frequência com automação.', uniqueBullets: ['Fluxo previsível para campanhas diárias.', 'Menos retrabalho na publicação de ofertas.', 'Mais controle sobre quais grupos recebem cada tema.'], faq: [{ q: 'O bot ajuda a padronizar copy?', a: 'Sim. A operação fica consistente e evita variação manual em cada postagem.' }, { q: 'Consigo começar com poucos grupos?', a: 'Sim. Você pode iniciar com 2 ou 3 grupos e expandir gradualmente.' }], howTo: ['Escolha grupos de origem com melhor taxa de cliques.', 'Defina mensagens-padrão para campanhas recorrentes.', 'Escalone para novos grupos após uma semana de dados.'] },
  'espelhar-grupos-whatsapp-curitiba': { title: 'Espelhar grupos WhatsApp em Curitiba | wabot', description: 'Reduza esforço operacional e aumente consistência de postagens em grupos de Curitiba.', uniqueHeadline: 'Curitiba: menos operação manual, mais previsibilidade.', uniqueBody: 'Se sua rotina depende de copiar e colar links, a automação reduz ruído e mantém a régua de qualidade das campanhas.', uniqueBullets: ['Automatize campanhas sem perder controle.', 'Mantenha padrão de postagem por nicho.', 'Use histórico de logs para otimizar horários.'], faq: [{ q: 'Dá para operar múltiplos nichos em Curitiba?', a: 'Sim. Separe grupos por nicho e crie rotinas dedicadas para cada um.' }, { q: 'Como evitar spam?', a: 'Com intervalos e regras por grupo de destino para reduzir repetição.' }], howTo: ['Conecte os grupos principais da sua operação em Curitiba.', 'Ajuste filtros por palavras-chave e horários.', 'Revise relatórios semanais para evoluir campanhas.'] },
  'espelhar-grupos-whatsapp-porto-alegre': { title: 'Espelhar grupos WhatsApp em Porto Alegre | wabot', description: 'Automatize a distribuição de ofertas em Porto Alegre e mantenha uma rotina estável de divulgação.', uniqueHeadline: 'Porto Alegre com rotina de ofertas sem gargalo.', uniqueBody: 'O wabot transforma uma operação dependente de esforço manual em um fluxo contínuo com registro e controle.', uniqueBullets: ['Distribuição rápida para grupos de destino.', 'Menor risco de esquecer ofertas importantes.', 'Mais tempo para analisar resultados e criativos.'], faq: [{ q: 'Existe suporte no onboarding?', a: 'Sim. O início pode ser guiado para reduzir tempo de configuração.' }, { q: 'Funciona para operação diária?', a: 'Sim. A proposta é justamente manter constância com menor esforço humano.' }], howTo: ['Defina as fontes de ofertas mais confiáveis.', 'Crie destinos por segmento e prioridade.', 'Ative o espelhamento e ajuste regras com base nos logs.'] },

  'espelhar-grupos-whatsapp-recife': { title: 'Espelhar grupos WhatsApp em Recife | wabot', description: 'Automatize campanhas em grupos de Recife com uma rotina previsível de espelhamento.', uniqueHeadline: 'Recife: operação regional com cadência diária.', uniqueBody: 'Em Recife, campanhas de ofertas precisam acompanhar horários de maior atenção sem depender de cópia manual. O wabot mantém o fluxo ativo e organizado.', uniqueBullets: ['Distribua ofertas para grupos por região e interesse.', 'Reduza atrasos em campanhas de alta concorrência.', 'Acompanhe logs para ajustar horários com mais resposta.'], faq: [{ q: 'Como ativar uma operação em Recife?', a: 'Conecte o WhatsApp, selecione grupos de origem e destino e valide as primeiras regras no onboarding.' }, { q: 'Posso separar campanhas por público?', a: 'Sim. Você pode organizar destinos por bairro, categoria ou perfil de compra.' }], howTo: ['Mapeie os grupos de Recife com maior volume de oportunidades.', 'Defina destinos por região, categoria e prioridade.', 'Ative a rotina e revise os primeiros logs de publicação.'] },
  'espelhar-grupos-whatsapp-salvador': { title: 'Espelhar grupos WhatsApp em Salvador | wabot', description: 'Ganhe consistência na divulgação em grupos de Salvador com automação para WhatsApp.', uniqueHeadline: 'Salvador com campanhas constantes e menos retrabalho.', uniqueBody: 'Operações locais em Salvador podem escalar quando deixam de depender de postagens manuais e passam a seguir uma rotina de distribuição controlada.', uniqueBullets: ['Mantenha frequência mesmo em horários de pico.', 'Padronize mensagens para diferentes grupos locais.', 'Escalone campanhas sem contratar equipe adicional.'], faq: [{ q: 'Funciona para grupos de ofertas em Salvador?', a: 'Sim. O fluxo foi pensado para monitorar fontes, espelhar mensagens e manter consistência em grupos de destino.' }, { q: 'Como reduzir risco de repetição excessiva?', a: 'Use intervalos, filtros e segmentação por grupo para controlar a cadência.' }], howTo: ['Escolha fontes confiáveis de ofertas para Salvador.', 'Separe grupos de destino por perfil de audiência.', 'Configure intervalos e monitore a consistência da operação.'] },
  'espelhar-grupos-whatsapp-fortaleza': { title: 'Espelhar grupos WhatsApp em Fortaleza | wabot', description: 'Automatize a publicação em grupos de Fortaleza e reduza falhas de rotina com o wabot.', uniqueHeadline: 'Fortaleza: distribuição ágil sem operação pesada.', uniqueBody: 'Quando a rotina cresce, o gargalo aparece no copia-e-cola. O wabot ajuda operações em Fortaleza a publicar com velocidade e controle.', uniqueBullets: ['Acelere ofertas relâmpago para grupos prioritários.', 'Organize destinos por nicho, região ou ticket.', 'Mantenha histórico de envios para decisões semanais.'], faq: [{ q: 'Dá para começar com poucos grupos?', a: 'Sim. A recomendação é iniciar enxuto, validar o fluxo e ampliar com base nos dados.' }, { q: 'Preciso ficar online para postar?', a: 'Depois de configurado, o bot mantém a rotina conforme as regras definidas.' }], howTo: ['Conecte o número usado na operação de Fortaleza.', 'Defina origem, destino e regras de intervalo.', 'Acompanhe os envios iniciais e ajuste os grupos prioritários.'] },
  'espelhar-grupos-whatsapp-brasilia': { title: 'Espelhar grupos WhatsApp em Brasília | wabot', description: 'Padronize campanhas em grupos de Brasília com espelhamento automatizado para WhatsApp.', uniqueHeadline: 'Brasília: previsibilidade para múltiplos públicos.', uniqueBody: 'Com audiências distribuídas por regiões administrativas, a automação ajuda a manter mensagem, frequência e controle sem aumentar a operação manual.', uniqueBullets: ['Crie rotinas por região administrativa ou nicho.', 'Evite falhas em campanhas recorrentes.', 'Ganhe clareza com logs de publicação e ajustes por grupo.'], faq: [{ q: 'Posso organizar grupos por região administrativa?', a: 'Sim. Você pode separar grupos de destino e ajustar a cadência por conjunto.' }, { q: 'O onboarding ajuda na primeira configuração?', a: 'Sim. O trial guiado foi desenhado para acelerar o primeiro espelhamento.' }], howTo: ['Liste fontes e destinos relevantes para Brasília.', 'Configure regras por grupo e prioridade de campanha.', 'Valide o primeiro espelhamento e acompanhe a rotina diária.'] },
  'espelhar-grupos-whatsapp-goiania': { title: 'Espelhar grupos WhatsApp em Goiânia | wabot', description: 'Escale a divulgação em grupos de Goiânia com automação e menos trabalho manual.', uniqueHeadline: 'Goiânia: campanha local com execução consistente.', uniqueBody: 'O wabot ajuda operações em Goiânia a manter presença diária em grupos sem depender de uma sequência manual de postagens.', uniqueBullets: ['Distribua ofertas por categoria e perfil de público.', 'Reduza esquecimentos em campanhas de maior giro.', 'Use o histórico para refinar horários e destinos.'], faq: [{ q: 'Funciona para afiliados em Goiânia?', a: 'Sim. Você pode organizar ofertas e espelhar mensagens para grupos de destino com regras de operação.' }, { q: 'Como controlar a frequência?', a: 'Defina intervalos e revise logs para ajustar a cadência ideal.' }], howTo: ['Mapeie os grupos com maior aderência em Goiânia.', 'Crie rotinas por tipo de oferta e grupo de destino.', 'Ative a automação e ajuste a frequência após os primeiros dados.'] },
  'espelhar-grupos-whatsapp-campinas': { title: 'Espelhar grupos WhatsApp em Campinas | wabot', description: 'Automatize ofertas em grupos de Campinas e mantenha uma operação previsível com o wabot.', uniqueHeadline: 'Campinas: escala regional com processo simples.', uniqueBody: 'Para operações que atendem Campinas e região, o wabot reduz retrabalho e mantém campanhas rodando com padrão de mensagem e frequência.', uniqueBullets: ['Organize grupos por Campinas e cidades próximas.', 'Mantenha rotina estável para ofertas recorrentes.', 'Ganhe tempo para analisar criativos e resultados.'], faq: [{ q: 'Posso incluir cidades próximas de Campinas?', a: 'Sim. A estrutura de grupos permite separar destinos por cidade ou região atendida.' }, { q: 'Quanto tempo leva para testar?', a: 'O objetivo do trial guiado é colocar o primeiro espelhamento no ar rapidamente após o setup.' }], howTo: ['Separe grupos de origem e destino da região de Campinas.', 'Defina regras de postagem por campanha.', 'Monitore os primeiros envios e expanda para novos grupos.'] },
  'espelhar-grupos-whatsapp-manaus': { title: 'Espelhar grupos WhatsApp em Manaus | wabot', description: 'Reduza trabalho manual em grupos de Manaus com espelhamento automatizado de campanhas.', uniqueHeadline: 'Manaus: rotina de divulgação sem depender do improviso.', uniqueBody: 'Em operações com muitos grupos, a consistência pesa mais que esforço pontual. O wabot cria uma rotina de espelhamento para manter campanhas ativas.', uniqueBullets: ['Publique com cadência em grupos prioritários.', 'Organize mensagens por categoria e audiência.', 'Evite perder ofertas por falha ou atraso operacional.'], faq: [{ q: 'O wabot ajuda em campanhas diárias?', a: 'Sim. A automação mantém a rotina conforme as regras configuradas.' }, { q: 'Consigo revisar o que foi enviado?', a: 'Sim. Os logs ajudam a acompanhar envios e ajustar a operação.' }], howTo: ['Identifique fontes com bom volume para Manaus.', 'Configure grupos de destino por prioridade.', 'Ative o espelhamento e revise os registros de envio.'] },
  'espelhar-grupos-whatsapp-belem': { title: 'Espelhar grupos WhatsApp em Belém | wabot', description: 'Organize e escale divulgação em grupos de Belém com automação de WhatsApp.', uniqueHeadline: 'Belém: consistência para campanhas locais de ofertas.', uniqueBody: 'A operação local ganha previsibilidade quando fontes, destinos e frequência deixam de depender de tarefa manual repetitiva.', uniqueBullets: ['Padronize campanhas para diferentes grupos locais.', 'Aumente velocidade em ofertas com validade curta.', 'Acompanhe resultados iniciais por rotina e categoria.'], faq: [{ q: 'Dá para segmentar grupos em Belém?', a: 'Sim. Você pode criar conjuntos de destino por interesse, região ou categoria de campanha.' }, { q: 'Como saber se a rotina está funcionando?', a: 'Acompanhe logs de envio e indicadores de resposta para ajustar horários e mensagens.' }], howTo: ['Defina os grupos de origem mais confiáveis.', 'Agrupe destinos por perfil de audiência em Belém.', 'Configure a cadência e otimize após os primeiros envios.'] },
  'espelhar-grupos-whatsapp-florianopolis': { title: 'Espelhar grupos WhatsApp em Florianópolis | wabot', description: 'Mantenha campanhas em grupos de Florianópolis com rotina automatizada e controle operacional.', uniqueHeadline: 'Florianópolis: operação enxuta para públicos segmentados.', uniqueBody: 'Com grupos segmentados por região e interesse, a automação ajuda a entregar mensagens certas com menos esforço manual.', uniqueBullets: ['Separe campanhas por ilha, continente ou nicho.', 'Controle intervalos para preservar qualidade da audiência.', 'Use dados de envio para refinar a rotina semanal.'], faq: [{ q: 'Funciona para operação regional em Florianópolis?', a: 'Sim. É possível organizar grupos por região, nicho e prioridade de campanha.' }, { q: 'O trial inclui orientação de setup?', a: 'Sim. A proposta do trial guiado é acelerar a ativação inicial.' }], howTo: ['Mapeie grupos por região e tipo de oferta.', 'Defina regras de cadência para cada conjunto.', 'Ative o fluxo e revise os resultados da primeira semana.'] },
  'espelhar-grupos-whatsapp-vitoria': { title: 'Espelhar grupos WhatsApp em Vitória | wabot', description: 'Automatize a distribuição em grupos de Vitória e ganhe consistência nas campanhas.', uniqueHeadline: 'Vitória: divulgação local com controle e repetição.', uniqueBody: 'O wabot transforma a rotina de postar manualmente em grupos de Vitória em um processo controlado, rastreável e mais previsível.', uniqueBullets: ['Mantenha presença diária sem sobrecarga manual.', 'Organize destinos por perfil de oferta e audiência.', 'Reduza falhas em campanhas recorrentes ou sazonais.'], faq: [{ q: 'Como começar em Vitória?', a: 'Conecte o número de operação, selecione grupos e configure a primeira regra de espelhamento.' }, { q: 'Posso ajustar grupos depois?', a: 'Sim. A operação pode começar simples e evoluir com novos destinos e filtros.' }], howTo: ['Selecione fontes e destinos da operação em Vitória.', 'Configure mensagens, intervalos e prioridade de grupos.', 'Valide o primeiro espelhamento e acompanhe os logs.'] },
  'bot-ofertas-supermercado-whatsapp': { title: 'Bot de ofertas para supermercado no WhatsApp | wabot', description: 'Organize e acelere campanhas de supermercado em grupos com automação inteligente.', uniqueHeadline: 'Supermercado: calendário de ofertas com ritmo diário.', uniqueBody: 'Campanhas de supermercado exigem frequência e velocidade. O wabot ajuda a publicar com consistência e menos retrabalho.', uniqueBullets: ['Destaque ofertas sazonais sem atraso.', 'Padronize mensagens por categoria de produto.', 'Mantenha fluxo contínuo nos dias de maior demanda.'], faq: [{ q: 'Como organizar o calendário semanal?', a: 'Com rotinas por dia e categoria, mantendo previsibilidade para o público.' }, { q: 'Consigo separar ofertas por perfil?', a: 'Sim. Você pode dividir destinos por interesse e ticket médio.' }], howTo: ['Defina categorias principais (hortifruti, limpeza, mercearia).', 'Organize grupos de destino por perfil de compra.', 'Automatize disparos e monitore clique por categoria.'] },
  'bot-ofertas-farmacia-whatsapp': { title: 'Bot de ofertas para farmácia no WhatsApp | wabot', description: 'Padronize publicação de ofertas de farmácia no WhatsApp com o wabot.', uniqueHeadline: 'Farmácia: campanhas recorrentes com precisão.', uniqueBody: 'No nicho farma, repetição inteligente gera confiança. O wabot facilita distribuição constante e organizada.', uniqueBullets: ['Campanhas por linha de cuidado e bem-estar.', 'Mais consistência em promoções recorrentes.', 'Menos falhas operacionais em horários críticos.'], faq: [{ q: 'Dá para priorizar categorias de alta saída?', a: 'Sim. Você pode ajustar prioridades por linha e período.' }, { q: 'O bot ajuda em campanhas mensais?', a: 'Sim. A automação reduz esforço para manter calendário ativo.' }], howTo: ['Separe ofertas por categoria farmacêutica.', 'Configure públicos por faixa de interesse.', 'Ajuste frequência para evitar repetição excessiva.'] },
  'bot-ofertas-eletronicos-whatsapp': { title: 'Bot de ofertas para eletrônicos no WhatsApp | wabot', description: 'Mantenha constância e velocidade na divulgação de eletrônicos com automação para grupos.', uniqueHeadline: 'Eletrônicos: timing é margem.', uniqueBody: 'Para eletrônicos, atraso custa conversão. O wabot acelera distribuição e ajuda você a aproveitar janelas curtas de preço.', uniqueBullets: ['Publicação rápida para promoções-relâmpago.', 'Rotina estável em lançamentos e datas promocionais.', 'Melhor controle de campanhas por ticket e categoria.'], faq: [{ q: 'Como evitar perder oferta relâmpago?', a: 'Com automação ativa e grupos de destino prontos por categoria.' }, { q: 'Posso segmentar por faixa de preço?', a: 'Sim. Você pode separar mensagens por perfil de público.' }], howTo: ['Priorize fontes com maior volume de eletrônicos.', 'Separe destinos por ticket (entrada, intermediário, premium).', 'Monitore horários de maior conversão e ajuste regras.'] },
  'bot-ofertas-moda-whatsapp': { title: 'Bot de ofertas para moda no WhatsApp | wabot', description: 'Aumente previsibilidade das campanhas de moda com uma rotina automatizada.', uniqueHeadline: 'Moda: consistência que vira hábito de compra.', uniqueBody: 'No nicho moda, recorrência e curadoria fazem diferença. O wabot organiza a distribuição para manter engajamento contínuo.', uniqueBullets: ['Campanhas por coleção e sazonalidade.', 'Mensagens consistentes para fortalecer marca.', 'Mais escala sem aumentar operação manual.'], faq: [{ q: 'Como manter frequência sem cansar o público?', a: 'Com regras de intervalo e segmentação por interesse.' }, { q: 'Posso separar campanhas por estilo?', a: 'Sim. Você pode criar rotinas por subnicho e persona.' }], howTo: ['Estruture grupos por estilo e público-alvo.', 'Defina janelas de postagem por campanha.', 'Refine mensagens com base no desempenho semanal.'] },
  'bot-ofertas-beleza-whatsapp': { title: 'Bot de ofertas para beleza no WhatsApp | wabot', description: 'Acelere campanhas de beleza no WhatsApp com processos de distribuição em escala.', uniqueHeadline: 'Beleza: operação contínua para campanhas de alta recorrência.', uniqueBody: 'Produtos de beleza pedem constância e timing promocional. O wabot automatiza a rotina para manter presença e conversão.', uniqueBullets: ['Rotina de divulgação para skincare, make e haircare.', 'Padronização de mensagens para aumentar confiança.', 'Escala com menos esforço no dia a dia.'], faq: [{ q: 'Como começar rápido no nicho beleza?', a: 'Comece com poucos grupos, valide resposta e amplie com dados.' }, { q: 'Como medir ROI inicial?', a: 'Acompanhe cliques, comissão e frequência por categoria.' }], howTo: ['Crie trilhas por categoria de beleza.', 'Ative distribuição para grupos com maior engajamento.', 'Ajuste ofertas por sazonalidade e campanhas temáticas.'] },
}

const LP_TYPE_THEME = {
  city: {
    badge: 'Operação por cidade',
    tone: 'direto',
    eyebrow: 'Modo Cidade',
    panelBg: 'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-strong) 35%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-3) 42%, white), transparent)',
  },
  niche: {
    badge: 'Operação por nicho',
    tone: 'animado',
    eyebrow: 'Modo Nicho',
    panelBg: 'color-mix(in oklab, var(--accent-3) 50%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-2) 30%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 24%, white), transparent)',
  },
  default: {
    badge: 'Operação programática',
    tone: 'amigavel',
    eyebrow: 'Experimente grátis!',
    panelBg: 'var(--surface)',
    panelBorder: 'var(--line)',
    heroBg: 'transparent',
  },
}

function getLpType(slug) {
  if (slug?.startsWith('espelhar-grupos-whatsapp-')) return 'city'
  if (slug?.startsWith('bot-ofertas-')) return 'niche'
  return 'default'
}

function getHeroCopy(cfg, lpType) {
  if (lpType === 'city') {
    return {
      headline: <><span>Escala local com execução</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>consistente todo dia.</span></>,
      sub: `${cfg.description} Fluxo pensado para operação regional com menor retrabalho.`,
    }
  }
  if (lpType === 'niche') {
    return {
      headline: <><span>Seu nicho com campanhas</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>mais rápidas e previsíveis.</span></>,
      sub: `${cfg.description} Estruture rotinas por categoria e publique com frequência sem sobrecarga manual.`,
    }
  }
  return {
    headline: null,
    sub: null,
  }
}

export function getLpMetadata(slug) {
  const cfg = LP_CONFIG[slug]
  if (!cfg) return {}

  const siteUrl = getSiteUrl()
  const canonicalUrl = `${siteUrl}/${slug}`

  return {
    title: cfg.title,
    description: cfg.description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title: cfg.title,
      description: cfg.description,
      url: canonicalUrl,
      siteName: 'BOTinho',
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: cfg.title,
      description: cfg.description,
    },
  }
}

export function LpTemplate({ slug }) {
  const cfg = LP_CONFIG[slug]
  const lpType = getLpType(slug)
  const theme = LP_TYPE_THEME[lpType] ?? LP_TYPE_THEME.default
  const heroCopy = getHeroCopy(cfg, lpType)
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: cfg.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) }
  const howToJsonLd = { '@context': 'https://schema.org', '@type': 'HowTo', name: `Como configurar ${cfg.title.replace(' | wabot', '')}`, step: cfg.howTo.map((text, index) => ({ '@type': 'HowToStep', name: `Passo ${index + 1}`, text })) }
  const productJsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: 'wabot', description: cfg.description, image: [`${getSiteUrl()}/wabot-logo.svg`], brand: { '@type': 'Brand', name: 'wabot' }, offers: { '@type': 'Offer', url: `${getSiteUrl()}/login?mode=register`, priceCurrency: 'BRL', price: '0.00', availability: 'https://schema.org/InStock', category: 'SoftwareSubscription', shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'BRL' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BR' }, deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' } } }, hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted', applicableCountry: 'BR' } }, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.8, reviewCount: 127, bestRating: 5, worstRating: 1 } }

  return (
    <div className="landing-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <Hero
        tone={theme.tone}
        primaryCtaLabel="Entrar na Lista VIP"
        eyebrowLabel={theme.eyebrow}
        headlineOverride={heroCopy.headline}
        subOverride={heroCopy.sub}
        heroStyle={{ background: theme.heroBg, borderRadius: 24, paddingInline: 20 }}
      />
      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.panelBorder}`, borderRadius: 24, padding: '28px 28px 22px', boxShadow: 'var(--shadow-soft)' }}>
            <span className="pill" style={{ marginBottom: 12 }}><span className="dot" />{theme.badge}</span>
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 42px)', lineHeight: 1.1, marginBottom: 10 }}>{cfg.uniqueHeadline}</h2>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 14 }}>{cfg.uniqueBody}</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
              {cfg.uniqueBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          </div>
        </div>
      </section>
      <How />
      <Features />
      <Social />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
