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
  'bot-ofertas-supermercado-whatsapp': { title: 'Bot de ofertas para supermercado no WhatsApp | wabot', description: 'Organize e acelere campanhas de supermercado em grupos com automação inteligente.', uniqueHeadline: 'Supermercado: calendário de ofertas com ritmo diário.', uniqueBody: 'Campanhas de supermercado exigem frequência e velocidade. O wabot ajuda a publicar com consistência e menos retrabalho.', uniqueBullets: ['Destaque ofertas sazonais sem atraso.', 'Padronize mensagens por categoria de produto.', 'Mantenha fluxo contínuo nos dias de maior demanda.'], faq: [{ q: 'Como organizar o calendário semanal?', a: 'Com rotinas por dia e categoria, mantendo previsibilidade para o público.' }, { q: 'Consigo separar ofertas por perfil?', a: 'Sim. Você pode dividir destinos por interesse e ticket médio.' }], howTo: ['Defina categorias principais (hortifruti, limpeza, mercearia).', 'Organize grupos de destino por perfil de compra.', 'Automatize disparos e monitore clique por categoria.'] },
  'bot-ofertas-farmacia-whatsapp': { title: 'Bot de ofertas para farmácia no WhatsApp | wabot', description: 'Padronize publicação de ofertas de farmácia no WhatsApp com o wabot.', uniqueHeadline: 'Farmácia: campanhas recorrentes com precisão.', uniqueBody: 'No nicho farma, repetição inteligente gera confiança. O wabot facilita distribuição constante e organizada.', uniqueBullets: ['Campanhas por linha de cuidado e bem-estar.', 'Mais consistência em promoções recorrentes.', 'Menos falhas operacionais em horários críticos.'], faq: [{ q: 'Dá para priorizar categorias de alta saída?', a: 'Sim. Você pode ajustar prioridades por linha e período.' }, { q: 'O bot ajuda em campanhas mensais?', a: 'Sim. A automação reduz esforço para manter calendário ativo.' }], howTo: ['Separe ofertas por categoria farmacêutica.', 'Configure públicos por faixa de interesse.', 'Ajuste frequência para evitar repetição excessiva.'] },
  'bot-ofertas-eletronicos-whatsapp': { title: 'Bot de ofertas para eletrônicos no WhatsApp | wabot', description: 'Mantenha constância e velocidade na divulgação de eletrônicos com automação para grupos.', uniqueHeadline: 'Eletrônicos: timing é margem.', uniqueBody: 'Para eletrônicos, atraso custa conversão. O wabot acelera distribuição e ajuda você a aproveitar janelas curtas de preço.', uniqueBullets: ['Publicação rápida para promoções-relâmpago.', 'Rotina estável em lançamentos e datas promocionais.', 'Melhor controle de campanhas por ticket e categoria.'], faq: [{ q: 'Como evitar perder oferta relâmpago?', a: 'Com automação ativa e grupos de destino prontos por categoria.' }, { q: 'Posso segmentar por faixa de preço?', a: 'Sim. Você pode separar mensagens por perfil de público.' }], howTo: ['Priorize fontes com maior volume de eletrônicos.', 'Separe destinos por ticket (entrada, intermediário, premium).', 'Monitore horários de maior conversão e ajuste regras.'] },
  'bot-ofertas-moda-whatsapp': { title: 'Bot de ofertas para moda no WhatsApp | wabot', description: 'Aumente previsibilidade das campanhas de moda com uma rotina automatizada.', uniqueHeadline: 'Moda: consistência que vira hábito de compra.', uniqueBody: 'No nicho moda, recorrência e curadoria fazem diferença. O wabot organiza a distribuição para manter engajamento contínuo.', uniqueBullets: ['Campanhas por coleção e sazonalidade.', 'Mensagens consistentes para fortalecer marca.', 'Mais escala sem aumentar operação manual.'], faq: [{ q: 'Como manter frequência sem cansar o público?', a: 'Com regras de intervalo e segmentação por interesse.' }, { q: 'Posso separar campanhas por estilo?', a: 'Sim. Você pode criar rotinas por subnicho e persona.' }], howTo: ['Estruture grupos por estilo e público-alvo.', 'Defina janelas de postagem por campanha.', 'Refine mensagens com base no desempenho semanal.'] },
  'bot-ofertas-beleza-whatsapp': { title: 'Bot de ofertas para beleza no WhatsApp | wabot', description: 'Acelere campanhas de beleza no WhatsApp com processos de distribuição em escala.', uniqueHeadline: 'Beleza: operação contínua para campanhas de alta recorrência.', uniqueBody: 'Produtos de beleza pedem constância e timing promocional. O wabot automatiza a rotina para manter presença e conversão.', uniqueBullets: ['Rotina de divulgação para skincare, make e haircare.', 'Padronização de mensagens para aumentar confiança.', 'Escala com menos esforço no dia a dia.'], faq: [{ q: 'Como começar rápido no nicho beleza?', a: 'Comece com poucos grupos, valide resposta e amplie com dados.' }, { q: 'Como medir ROI inicial?', a: 'Acompanhe cliques, comissão e frequência por categoria.' }], howTo: ['Crie trilhas por categoria de beleza.', 'Ative distribuição para grupos com maior engajamento.', 'Ajuste ofertas por sazonalidade e campanhas temáticas.'] },
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
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: cfg.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) }
  const howToJsonLd = { '@context': 'https://schema.org', '@type': 'HowTo', name: `Como configurar ${cfg.title.replace(' | wabot', '')}`, step: cfg.howTo.map((text, index) => ({ '@type': 'HowToStep', name: `Passo ${index + 1}`, text })) }
  const productJsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: 'wabot', description: cfg.description, image: [`${getSiteUrl()}/wabot-logo.svg`], brand: { '@type': 'Brand', name: 'wabot' }, offers: { '@type': 'Offer', url: `${getSiteUrl()}/login?mode=register`, priceCurrency: 'BRL', price: '0.00', availability: 'https://schema.org/InStock', category: 'SoftwareSubscription', shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'BRL' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BR' }, deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' } } }, hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted', applicableCountry: 'BR' } }, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.8, reviewCount: 127, bestRating: 5, worstRating: 1 } }

  return (
    <div className="landing-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <Hero tone="amigavel" primaryCtaLabel="Entrar na Lista VIP" />
      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '28px 28px 22px' }}>
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
