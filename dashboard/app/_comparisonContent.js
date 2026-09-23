import './landing.css'
import Link from 'next/link'
import { Hero } from '@/components/landing/Hero'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { IntroCard } from '@/components/landing/IntroCard'
import { BRAND_NAME, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS } from '@/lib/marketing-content'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'
import { getSiteUrl } from '@/lib/site-url'
import { getCompetitorBySlug } from '@/lib/competitors-data'
import { buildSeoRobots } from '@/lib/seo-registry.mjs'
import { ComparisonPageTracker } from '@/components/marketing/ComparisonPageTracker'
import {
  CompetitorCard,
  ComparisonTable,
  DifferentialChips,
  IconList,
  SectionCard,
  SectionNav,
  StepList,
  StickyTrialCta,
  TRIAL_LABEL,
  TrialCta,
} from '@/components/marketing/ComparisonSections'
import { DifferentialGrid, InteractiveComparisonTable, TrustStrip } from '@/components/marketing/ComparisonInteractive'

/*
 * Links por LOJA, em todas as páginas de comparativo.
 *
 * Medição de 16/09: as cinco páginas comerciais por loja existem desde 02/09 e
 * somavam ~30 impressões. Não é ausência de página — é descoberta. Quem
 * apontava para elas era `/programa-de-afiliados` (185 impressões, ZERO clique),
 * o `/conteudos` (que por regra não conta) e elas entre si, todas zeradas. As
 * páginas mais fortes do site — estas oito de comparativo, juntas com
 * `/bot-achadinhos-whatsapp`, ~9.000 das 13.362 impressões — não linkavam
 * nenhuma.
 *
 * A guarda `test/marketing-paginas-orfas.test.js` conta LINK, não conta FORÇA, e
 * por isso passava. Página sem força não transfere força.
 *
 * Fica no fim, junto dos outros links de apoio, e NUNCA antes da saída para a
 * página comercial: a medição do comentário da seção 9 (comparativo converte 0%,
 * comercial converte 15,4%) continua valendo e não pode ser diluída.
 */
export const COMPARISON_STORE_LINKS = [
  { href: '/shopee-afiliados-whatsapp', label: 'Shopee' },
  { href: '/mercado-livre-afiliados-whatsapp', label: 'Mercado Livre' },
  { href: '/amazon-afiliados-whatsapp', label: 'Amazon' },
  { href: '/shein-afiliados-whatsapp', label: 'SHEIN' },
  { href: '/magalu-afiliados-whatsapp', label: 'Magalu' },
]

export const COMPARISON_SOURCE_LINKS = [
  { label: 'Política de Mensagens do WhatsApp Business', href: 'https://whatsappbusiness.com/pt-br/policy/' },
  { label: 'Termos do Programa de Afiliados e Criadores do Mercado Livre', href: 'https://www.mercadolivre.com.br/ajuda/30228' },
  { label: 'Amazon Associates Program Operating Agreement', href: 'https://affiliate-program.amazon.com/help/operating/agreement/' },
]

export const COMPARISON_PAGES = {
  '/alternativas/bot-para-whatsapp-afiliados': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Afiliados',
    title: 'Alternativas de bot para afiliados: como escolher',
    description: 'Compare caminhos para divulgar ofertas em grupos de WhatsApp: operação manual, planilha, automação genérica, ferramenta oficial de mensagens e Espelha Grupos.',
    competitorSlugs: ['achadinho-pro', 'achadinhosbot', 'proafiliados-com', 'lumi-ofertas-inteligentes', 'gigi-bot', 'manual-spreadsheet-workflow', 'generic-automation-tools', 'official-service-api-tools'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'Se você está pesquisando alternativas de bot para WhatsApp, compare foco operacional, capacidade de governança e custo de manutenção contínua antes de decidir.',
    directAnswer: 'A melhor alternativa de bot para WhatsApp para afiliados depende do estágio da operação. Para poucos grupos, planilha e revisão manual podem bastar. Para rotina com origem, destino, link monetizado, filtros, cadência e logs, o Espelha Grupos foi desenhado para organizar esse fluxo sem prometer ganho financeiro ou burlar regras das plataformas.',
    rows: [
      ['Planilha + envio manual', 'Baixo custo e controle humano total.', 'Não escala bem, depende de lembrar horários e dificulta auditoria por campanha.'],
      ['Automação genérica', 'Flexível para equipes técnicas.', 'Pode exigir integrações frágeis, manutenção e atenção extra a regras do WhatsApp.'],
      ['Ferramentas de atendimento/API oficial', 'Boas para atendimento, templates e conversas com clientes.', 'Nem sempre resolvem curadoria de oferta, grupos de origem/destino e link de afiliado.'],
      ['Espelha Grupos', 'Foco em afiliados, curadores de ofertas e admins de grupos com filtros, cadência, conversão de links suportados e logs.', 'Não substitui revisão humana nem autorização dos grupos e plataformas.'],
    ],
    criteria: ['Revisão de link monetizado', 'Controle de grupos de origem e destino', 'Cadência anti-ruído', 'Histórico de envios', 'Limites claros contra spam'],
    botinhoDifferentials: ['Menor preço do mercado', 'Grupos ilimitados', 'Plataformas suportadas: 4', 'Conversão de links avançada', 'Funcionamento 24/7 sem limites', 'Broadcast em massa', 'Mensagem de boas-vindas', 'Canais & Comunidades', 'Histórico de logs', 'Suporte por WhatsApp', 'Sem cartão de crédito', 'Pronto em 5 minutos', 'Cancele quando quiser', 'Teste grátis'],
    bestFit: [
      'Escolha Espelha Grupos quando o foco principal é rotina recorrente de ofertas em grupos com filtros, cadência e histórico operacional.',
      'Escolha automação genérica quando sua equipe já mantém integrações customizadas e precisa máxima flexibilidade técnica.',
      'Escolha processo manual quando o volume ainda é baixo e a revisão humana cobre toda a operação sem atraso.',
    ],
    notIdealFit: [
      'Espelha Grupos não é ideal para quem busca automação irrestrita sem revisão humana e sem limites de uso responsável.',
      'Automação genérica não é ideal para times sem capacidade de manutenção técnica contínua.',
      'Processo manual não é ideal para operação com muitos grupos e publicação diária em escala.',
    ],
    migrationPath: [
      'Mapeie grupos de origem/destino e critérios mínimos de qualidade de link.',
      'Rode uma semana em paralelo (manual + fluxo novo) para validar cadência e qualidade.',
      'Mantenha checklist de revisão humana e compare resultado por campanha antes do corte final.',
    ],
    faq: [
      { q: 'Espelha Grupos é a melhor opção para qualquer afiliado?', a: 'Não. Se você divulga poucas ofertas por semana, um processo manual bem revisado pode ser suficiente. O Espelha Grupos faz mais sentido quando há grupos, frequência e necessidade de logs.' },
      { q: 'Automação genérica substitui uma ferramenta especializada?', a: 'Pode substituir em operações técnicas, mas normalmente exige manutenção e definição manual de regras para link monetizado, grupos e cadência.' },
      { q: 'Essas alternativas garantem comissão?', a: 'Não. Comissão depende de oferta, público, regras da plataforma, rastreio correto e comportamento dos compradores.' },
    ],
  },
  /* Página de marca do concorrente. Criada porque duas das 13 consultas que o
   * site registrava no Search Console eram `achadinhos bot` e `achadinhoosbot`.
   * Em 2026-08-16 essa aposta se confirmou como a maior do site: as três
   * variações da marca (`achadinhoosbot`, `achadinhosbot`, `achadinhos bot`)
   * somam 443 impressões em 3 meses — 15% de tudo — e a busca por marca de
   * concorrente virou a principal fonte de impressão. `fluxopromo` e `shozap`
   * já aparecem também.
   *
   * Todos os dados de preço e recurso vêm de `competitors-data.js`, verificados
   * por print em 31/07/2026. Regra que não se quebra: dizer honestamente onde o
   * concorrente é melhor. Comparativo enviesado é penalizado por IA e é risco
   * jurídico — e o objetivo aqui é justamente ser citável.
   */
  '/alternativas/achadinhos-bot': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · AchadinhosBot',
    // Título encurtado em 2026-08-17 (era 74 chars, cortado no celular). Esta é
    // a página que deve responder a busca pelo NOME do concorrente — por isso
    // ela mantém "Alternativa ao AchadinhosBot" na frente, e a página comercial
    // /bot-achadinhos-whatsapp deixou de disputar o mesmo termo. As duas
    // ranqueavam para as MESMAS consultas (529 e 226 impressões), dividindo o
    // sinal entre si sem nenhuma delas subir.
    title: 'Alternativa ao AchadinhosBot: grupos ilimitados',
    description: 'O AchadinhosBot cobra por número de grupos e cobre só Shopee. No Espelha Grupos: grupos ilimitados, 6 lojas e 7 dias grátis por R$ 39/30 dias.',
    competitorSlugs: ['achadinhosbot', 'achadinho-pro'],
    // Par recíproco do `competitorNudge` de /bot-achadinhos-whatsapp: as duas
    // páginas ranqueavam para as mesmas consultas e não se linkavam, então o
    // Google não tinha como saber qual responde o quê. Aqui fica a busca por
    // NOME do concorrente; lá, a busca genérica por "bot para achadinhos".
    // Páginas de resposta (19/09/2026): quem chega comparando ferramenta ainda
    // está decidindo COMO divulgar — os três guias respondem isso de frente.
    guides: [
      { href: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp', title: 'Como espelhar mensagens entre grupos de WhatsApp' },
      { href: '/blog/melhores-automacoes-para-afiliado-shopee-2026', title: 'Melhores automações para afiliado Shopee em 2026' },
      { href: '/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp', title: 'Ferramenta para divulgar ofertas em grupos do WhatsApp' },
      // 23/09/2026: estes concorrentes vendem busca automática na Shopee; quem
      // chega aqui precisa saber que o Espelha Grupos também tem esse modo.
      { href: '/bot-que-busca-ofertas-shopee-whatsapp', title: 'Bot que busca ofertas da Shopee sozinho no WhatsApp' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    productPage: {
      href: '/bot-achadinhos-whatsapp',
      label: 'Como funciona o bot para achadinhos no WhatsApp',
      note: 'Grupos ilimitados, seis lojas e 7 dias grátis.',
    },
    tldr: 'Entre as opções comparadas, o Espelha Grupos oferece o conjunto mais completo pelo menor preço de entrada: custa R$ 39 por 30 dias, permite grupos ilimitados e funciona com Shopee, Amazon, Mercado Livre, Magalu e SHEIN. Para quem quer divulgar várias lojas, crescer sem pagar por quantidade de grupos e testar tudo antes de assinar, é a opção mais vantajosa entre as três.',
    directAnswer: 'O AchadinhosBot automatiza grupos de achadinhos no WhatsApp com foco somente em Shopee. Seus planos começam em R$ 59,90 por mês para 1 grupo e chegam a R$ 199,90 para 15 grupos. O Espelha Grupos custa R$ 39 por 30 dias, permite grupos ilimitados e já inclui Shopee, Amazon, Mercado Livre, Magalu e SHEIN. Também converte links de produto e de cupom, trabalha com grupos, Canais e Comunidades do WhatsApp e oferece 7 dias grátis com o plano Pro completo. Para quem divulga várias lojas e não quer pagar mais ao adicionar grupos, o Espelha Grupos entrega mais recursos por um preço menor. O Achadinho Pro, apesar do nome parecido, é outra ferramenta, de outra empresa: começa em R$ 49,97 por mês, também somente com Shopee, e tem página de comparação própria aqui no site.',
    // Formato de objeto (em vez de tupla) liga o comparador interativo por
    // critério (InteractiveComparisonTable) nesta página — ver
    // `isInteractiveComparison` em ComparisonPage. Mesmos fatos e preços da
    // versão anterior, só separados em coluna própria por opção em vez de
    // uma célula só com os três textos concatenados (FR-031: preços iguais,
    // nada novo).
    rows: [
      { key: 'preco', label: 'Preço de entrada', produto: 'R$ 39 por 30 dias (grupos ilimitados).', concorrente: 'AchadinhosBot: R$ 59,90/mês para 1 grupo. Achadinho Pro: R$ 49,97/mês, somente com Shopee.', reading: 'O Espelha Grupos é o mais barato entre as três opções e não prende o preço à quantidade de grupos.' },
      { key: 'marketplaces', label: 'Lojas suportadas', produto: 'Shopee, Amazon, Mercado Livre, Magalu e SHEIN.', concorrente: 'AchadinhosBot: Shopee. Achadinho Pro: Shopee no Basic; Amazon e Mercado Livre somente no Pro de R$ 59,97/mês.', reading: 'O Espelha Grupos oferece cinco lojas pelo menor preço. Nas outras opções, a cobertura é menor ou exige um plano mais caro.' },
      { key: 'escala', label: 'Limite de grupos', produto: 'Sem limite de grupos.', concorrente: 'AchadinhosBot: o preço aumenta por faixa de 1, 5, 10 ou 15 grupos. Achadinho Pro: grupos ilimitados por automação.', reading: 'Com o Espelha Grupos, você adiciona novos grupos sem subir de plano somente porque a operação cresceu.' },
      { key: 'teste', label: 'Teste grátis', produto: '7 dias com o plano Pro completo, sem cartão.', concorrente: 'AchadinhosBot: 3 dias, 1 grupo, 30 envios/dia, marca d’água e conexão descrita como "menos estável". Achadinho Pro: a página consultada não informa teste grátis.', reading: 'O Espelha Grupos oferece mais tempo e libera o plano completo para você testar a rotina real antes de pagar.' },
      { key: 'cupom', label: 'Conversão de cupom', produto: 'Converte links de produto e também links de cupom das lojas suportadas.', concorrente: 'Não indicada nas páginas públicas consultadas dos dois concorrentes.', reading: 'Para quem divulga campanhas, vitrines e cupons, o Espelha Grupos cobre uma parte importante da rotina que não aparece nas outras ofertas públicas.' },
      { key: 'canais', label: 'Canais e Comunidades', produto: 'Trabalha com grupos, Canais e Comunidades do WhatsApp.', concorrente: 'As páginas consultadas destacam automações e grupos.', reading: 'O Espelha Grupos permite organizar diferentes formas de divulgação dentro do WhatsApp, sem prender a operação somente a grupos.' },
    ],
    criteria: ['Quantas lojas você divulga hoje', 'Quantos grupos administra e pretende adicionar', 'Se divulga links de cupom além de links de produto', 'Se precisa publicar em Canais e Comunidades', 'Se quer testar a ferramenta completa antes de pagar', 'Se o preço aumenta quando sua operação cresce'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o bot somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Evite mandar a mesma oferta muitas vezes ou em intervalos curtos.', 'Continue acompanhando seus grupos mesmo depois de automatizar a rotina.'],
    botinhoDifferentials: ['Menor preço entre as opções: R$ 39 por 30 dias', 'Grupos ilimitados sem aumento por quantidade', 'Cinco lojas: Shopee, Amazon, Mercado Livre, Magalu e SHEIN', 'Conversão de links de produto e de cupom', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle de repetição e intervalo', 'Histórico completo de envios', 'Mensagem de boas-vindas', 'Suporte pelo WhatsApp', '7 dias com o Pro completo, sem cartão', 'Configuração rápida e cancelamento simples'],
    // Mockup do Claude Design ("Landing Comparativo") pede peso visual maior
    // para esta seção — cartão por item em vez de chip. Ligado só nesta
    // página para servir de piloto antes de estender às outras 6.
    richDifferentials: true,
    bestFit: [
      'Escolha o Espelha Grupos se quer pagar menos, divulgar Shopee, Amazon, Mercado Livre, Magalu e SHEIN na mesma conta e trabalhar com grupos ilimitados.',
      'Escolha o Espelha Grupos se divulga produto e cupom, quer usar grupos, Canais ou Comunidades e prefere testar o plano completo por 7 dias antes de pagar.',
      'O AchadinhosBot pode atender uma operação pequena que trabalha somente com Shopee e prefere um plano cobrado por quantidade de grupos, mesmo começando por um preço maior.',
      'O Achadinho Pro pode atender quem trabalha com vários números de WhatsApp ou considera seus recursos próprios de pesquisa de produtos mais importantes que preço e quantidade de lojas.',
    ],
    notIdealFit: [
      'No AchadinhosBot, o plano de R$ 59,90 cobre somente 1 grupo e apenas Shopee; para chegar a 15 grupos, o valor publicado é R$ 199,90/mês.',
      'No Achadinho Pro, o plano de entrada cobre somente Shopee; Amazon e Mercado Livre exigem o Pro de R$ 59,97/mês.',
      'Entre as três opções, somente o Espelha Grupos reúne R$ 39 por 30 dias, cinco lojas e grupos ilimitados.',
      'O Espelha Grupos trabalha somente com WhatsApp. Se sua operação depende de Telegram, será necessário usar outra solução para esse canal.',
    ],
    migrationPath: [
      'Faça uma lista dos grupos de onde vêm as ofertas e dos grupos, Canais ou Comunidades onde deseja publicá-las.',
      'Cadastre as lojas que divulga: Shopee, Amazon, Mercado Livre, Magalu e SHEIN.',
      'Comece os 7 dias grátis do Espelha Grupos e confira a conversão dos links, a aparência das mensagens e o ritmo das publicações.',
      'Rode as duas ferramentas por alguns dias e confira no histórico o que foi enviado, falhou ou foi segurado por repetição.',
      'Cancele a ferramenta antiga somente depois de confirmar que grupos, lojas e links funcionam como esperado.',
    ],
    productProfile: {
      name: 'Espelha Grupos',
      positioning: 'Bot para afiliadas e administradoras de grupos que acompanha ofertas, converte links para o código da usuária e publica nos destinos escolhidos no WhatsApp.',
      pricingTiers: [{ name: 'Basic', price: 'R$ 39 por 30 dias' }],
      bestFor: 'Quem divulga várias lojas, possui ou pretende criar vários grupos e quer automatizar a rotina sem pagar mais por cada novo grupo.',
      notIdealFor: 'Quem precisa publicar no Telegram ou quer deixar toda a operação funcionando sem nenhuma conferência humana.',
      migrationNotes: 'Use os 7 dias grátis com o Pro completo para testar links, grupos, Canais e Comunidades antes de cancelar outra ferramenta.',
      source: 'Página pública de preços e recursos do Espelha Grupos.',
      verifiedAt: '2026-08-31',
    },
    productDefinition: 'O Espelha Grupos é para quem administra grupos, Canais ou Comunidades de ofertas no WhatsApp e está cansada de copiar, trocar e publicar cada link manualmente. Você escolhe de onde vêm as ofertas e onde deseja publicá-las. O Espelha Grupos prepara o link com o seu código de afiliada, envia a mensagem, ajuda a controlar intervalos e ofertas repetidas e guarda o histórico. Funciona com Shopee, Amazon, Mercado Livre, Magalu e SHEIN, permite grupos ilimitados e custa R$ 39 por 30 dias, com 7 dias grátis para testar o plano Pro completo, sem cartão.',
    faq: [
      { q: 'Qual é a melhor alternativa ao AchadinhosBot?', a: 'Para quem divulga ofertas no WhatsApp, o Espelha Grupos é a alternativa mais completa entre as três comparadas: custa R$ 39 por 30 dias, aceita grupos ilimitados e funciona com Shopee, Amazon, Mercado Livre, Magalu e SHEIN.' },
      { q: 'Qual é mais barato: Espelha Grupos, AchadinhosBot ou Achadinho Pro?', a: 'O Espelha Grupos é o mais barato entre os três: R$ 39 por 30 dias. O Achadinho Pro começa em R$ 49,97/mês e o AchadinhosBot em R$ 59,90/mês. Além do menor preço, o Espelha Grupos não limita grupos e já inclui cinco lojas.' },
      { q: 'Qual bot aceita mais lojas pelo menor preço?', a: 'O Espelha Grupos. Por R$ 39 por 30 dias, funciona com Shopee, Amazon, Mercado Livre, Magalu e SHEIN. Os planos de entrada do AchadinhosBot e do Achadinho Pro cobrem somente Shopee.' },
      { q: 'O Espelha Grupos limita a quantidade de grupos?', a: 'Não. O Espelha Grupos permite grupos ilimitados e o preço não aumenta somente porque você adicionou mais grupos.' },
      { q: 'O Espelha Grupos funciona com SHEIN?', a: 'Sim. O Espelha Grupos aceita ofertas da SHEIN, além de Shopee, Amazon, Mercado Livre e Magalu. Para converter os links, é necessário cadastrar seus dados de afiliada da SHEIN no painel.' },
      { q: 'Quanto custa o AchadinhosBot?', a: 'Conforme a página pública consultada em 31/07/2026: R$ 59,90/mês para 1 grupo, R$ 99,90 para 5, R$ 149,90 para 10 e R$ 199,90 para 15 grupos, além de um teste grátis de 3 dias. Confirme na página oficial antes de decidir — preços mudam.' },
      { q: 'O AchadinhosBot tem teste grátis?', a: 'Sim, 3 dias sem cartão, com 1 grupo, 30 envios por dia, intervalo mínimo de 10 minutos, marca d’água e uma conexão descrita pelo próprio site como "menos estável". O Espelha Grupos oferece 7 dias com o Pro completo.' },
      { q: 'O Achadinho Pro é mais barato que o Espelha Grupos?', a: 'Não. O Basic custa R$ 49,97/mês e cobre somente Shopee. O Espelha Grupos custa R$ 39 por 30 dias e inclui cinco lojas. Para incluir Amazon e Mercado Livre no Achadinho Pro, é necessário o Pro de R$ 59,97/mês.' },
      { q: 'Em que situação o AchadinhosBot pode fazer sentido?', a: 'Pode atender uma operação pequena que divulga somente Shopee, cabe em uma das faixas de grupos e prefere exatamente esse modelo de planos. Para quem compara preço, quantidade de grupos e cobertura de lojas, o Espelha Grupos oferece mais por um valor menor.' },
      { q: 'Em que situação o Achadinho Pro pode fazer sentido?', a: 'Pode fazer sentido para quem precisa administrar vários números de WhatsApp ou deseja seus recursos próprios de pesquisa de produtos. Para quem prioriza preço, lojas, teste grátis e grupos ilimitados, o Espelha Grupos apresenta o conjunto mais vantajoso desta página.' },
      { q: 'O Espelha Grupos converte links de cupom?', a: 'Sim. Além de links de produto, o Espelha Grupos converte links de cupons e campanhas compatíveis das lojas suportadas.' },
      { q: 'Preciso de cartão para testar o Espelha Grupos?', a: 'Não. O teste grátis dura 7 dias, libera o plano Pro completo e não exige cartão.' },
      { q: 'Trocar de ferramenta faz perder meus grupos?', a: 'Não. Os grupos pertencem ao seu WhatsApp. A forma mais segura é testar o Espelha Grupos em paralelo e cancelar a ferramenta anterior somente depois de conferir os envios.' },
      { q: 'O Espelha Grupos garante vendas ou comissões?', a: 'Não. Nenhum bot pode garantir vendas. O Espelha Grupos ajuda a economizar trabalho, converter links compatíveis, organizar envios e evitar repetições.' },
    ],
  },
  '/alternativas/proafiliados': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · ProAfiliados',
    title: 'Alternativa ao ProAfiliados: sem tag, sem pagar R$ 50',
    description: 'O ProAfiliados tem plano grátis, mas assina as mensagens com a tag dele. Compare preço por plano e o que cada um cobre. Verificado em 04/08/2026.',
    competitorSlugs: ['proafiliados-com'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Nenhum plano insere marca nas suas mensagens.',
    },
    tldr: 'Se você quer testar automação de afiliados sem pagar nada, o plano grátis do ProAfiliados é o mais generoso do mercado — e não é trial, é grátis para sempre. O custo é a tag deles nas suas mensagens.',
    directAnswer: 'O ProAfiliados é um bot de afiliados para WhatsApp e Telegram com plano gratuito permanente (grupos ilimitados, monitoramento 24/7 e 5 plataformas), cobrando R$ 50/mês no Premium para remover a tag "proafiliados" das mensagens e R$ 100/mês no Premium Plus para tirar os anúncios do sistema. O pagamento é via PIX, sem cartão. A alternativa mais próxima é o Espelha Grupos, que não insere tag nem anúncio em nenhum plano, mas não tem camada gratuita permanente — o teste grátis é de 7 dias.',
    // Formato de objeto liga o comparador interativo por critério (ver
    // `isInteractiveComparison` em ComparisonPage). Mesmos fatos/preços do
    // texto anterior, só separados em coluna própria por opção.
    rows: [
      { key: 'plano-gratis', label: 'Plano grátis', produto: 'Teste de 7 dias com o Pro completo, depois é pago.', concorrente: 'ProAfiliados: grátis para sempre, com grupos ilimitados, 5 plataformas e monitoramento 24/7.', reading: 'Se o seu critério é não pagar nada nunca, o ProAfiliados ganha sem discussão. Não é trial disfarçado.' },
      { key: 'custo-gratis', label: 'O que o grátis custa', produto: 'Não insere tag nem anúncio em nenhum plano, inclusive no teste.', concorrente: 'ProAfiliados: as mensagens saem com a tag "proafiliados" e o sistema insere anúncios próprios.', reading: 'A tag aparece para os seus membros. Se o grupo é sua marca, isso pesa; se você está validando, não pesa nada.' },
      { key: 'preco-tag', label: 'Preço para tirar a tag', produto: 'R$ 39/30 dias no Basic, R$ 69 no Pro.', concorrente: 'ProAfiliados: R$ 50/mês (Premium).', reading: 'Comparar Premium (R$50) com Basic (R$39) só vale se os recursos que você usa estiverem no Basic.' },
      { key: 'preco-anuncios', label: 'Preço para tirar os anúncios', produto: 'Não se aplica — não há anúncio do sistema em nenhum plano.', concorrente: 'ProAfiliados: R$ 100/mês (Premium Plus).', reading: 'É o ponto onde a comparação de preço vira outra: R$ 100 contra R$ 69.' },
      { key: 'pagamento', label: 'Pagamento', produto: 'Cartão e PIX via Mercado Pago.', concorrente: 'ProAfiliados: PIX, sem cartão de crédito.', reading: 'PIX sem cartão é vantagem real para quem não quer recorrência no cartão.' },
      { key: 'telegram', label: 'Telegram', produto: 'Só WhatsApp (grupos, canais e comunidades).', concorrente: 'ProAfiliados: WhatsApp e Telegram.', reading: 'Se parte da sua audiência está no Telegram, o Espelha Grupos não atende.' },
    ],
    criteria: ['Se você aceita tag e anúncio de terceiro nas suas mensagens', 'Se opera Telegram além de WhatsApp', 'Se precisa converter cupom além de link de produto', 'Quanto tempo você quer validar antes de pagar', 'Se prefere pagar por PIX em vez de cartão'],
    botinhoDifferentials: ['Nenhuma tag ou anúncio de terceiro nas mensagens, em nenhum plano', 'Conversão de link de cupom, não só de produto', 'Canais e Comunidades do WhatsApp', 'Controle de cadência por destino e limites por hora/dia', 'Histórico completo de envios, incluindo o que foi bloqueado por repetição'],
    richDifferentials: true,
    bestFit: [
      'Escolha o ProAfiliados se o orçamento hoje é zero e você quer validar a ideia sem pagar nada — o plano grátis é permanente e cobre grupos ilimitados.',
      'Escolha o ProAfiliados também se opera Telegram junto com o WhatsApp, ou se prefere pagar por PIX sem cartão.',
      'Escolha o Espelha Grupos se o grupo é a sua marca e você não quer tag nem anúncio de terceiro nas mensagens, ou se divulga campanha de cupom além de produto avulso.',
    ],
    notIdealFit: [
      'O ProAfiliados não é ideal para quem trata o grupo como marca própria: no plano grátis as mensagens carregam a tag deles, e os anúncios do sistema só somem no plano de R$ 100/mês.',
      'O Espelha Grupos não é ideal para quem quer uma camada gratuita permanente — o teste grátis são 7 dias, depois é pago.',
      'O Espelha Grupos também não atende quem publica no Telegram: o produto é só WhatsApp.',
    ],
    migrationPath: [
      'Use o plano grátis do ProAfiliados primeiro. Ele é permanente e serve para responder a pergunta mais importante: automação resolve o seu problema?',
      'Se resolver, decida o que incomoda mais — a tag nas mensagens ou o custo mensal. Isso define qual ferramenta faz sentido.',
      'Rode uma semana em paralelo antes de cancelar qualquer coisa, comparando a qualidade do link convertido e do preview no celular.',
    ],
    faq: [
      { q: 'O ProAfiliados é grátis mesmo?', a: 'Sim, e não é trial: a página de preços consultada em 04/08/2026 descreve o plano Grátis como "R$ 0 para sempre", com grupos ilimitados, monitoramento 24/7 e 5 plataformas. A contrapartida é que as mensagens saem com a tag "proafiliados" e o sistema insere anúncios próprios.' },
      { q: 'Quanto custa o ProAfiliados?', a: 'Conforme a página pública consultada em 04/08/2026: Grátis (R$ 0 para sempre), Premium a R$ 50/mês e Premium Plus a R$ 100/mês. O pagamento é via PIX, sem cartão de crédito, e o cancelamento pode ser feito a qualquer momento. Confirme na página oficial antes de decidir — preços mudam.' },
      { q: 'Em que o ProAfiliados é melhor que o Espelha Grupos?', a: 'Em três pontos concretos. O plano gratuito permanente não tem equivalente aqui — o nosso teste grátis dura 7 dias. O ProAfiliados cobre Telegram, e o Espelha Grupos é só WhatsApp. E o pagamento por PIX sem cartão é mais simples para quem não quer recorrência no cartão de crédito.' },
      { q: 'O que é a "tag proafiliados" nas mensagens?', a: 'Segundo a própria página de preços, o plano grátis inclui essa tag nas mensagens enviadas, e removê-la é justamente o que o plano Premium (R$ 50/mês) oferece. Na prática, os membros do seu grupo veem a marca da ferramenta junto com a sua oferta.' },
      { q: 'Vale a pena pagar R$ 100 no Premium Plus?', a: 'Depende de quanto os anúncios do sistema incomodam. Esse é o único plano da linha que os remove por completo, e a página o descreve como voltado para times e agências. Se você opera sozinha e a tag já saiu no Premium, o salto para R$ 100 precisa se justificar por outra coisa.' },
    ],
  },
  '/alternativas/shozap': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Shozap',
    title: 'Alternativa ao Shozap: preço e limites por plano',
    description: 'Shozap e Espelha Grupos lado a lado: preço por plano, quantas conexões e grupos cabem e quais lojas entram em cada faixa. Verificado em 04/08/2026.',
    competitorSlugs: ['shozap'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Quatro lojas e grupos ilimitados já no plano de entrada.',
    },
    tldr: 'O Shozap escala por cota — conexões, campanhas, grupos por campanha e contas de marketplace. Some seus grupos antes de comparar preço: o plano de entrada cobre 3 grupos por campanha e só Shopee.',
    directAnswer: 'O Shozap é uma plataforma de divulgação para WhatsApp e Telegram que cobra por cota de uso: R$ 50/mês no Básico (1 conexão de cada, 3 campanhas, 3 grupos por campanha, só Shopee), R$ 100/mês no Intermediário (adiciona Mercado Livre e Amazon), R$ 150/mês no Elite (adiciona Shein e Magalu) e R$ 300/mês no Avançado. A alternativa mais próxima é o Espelha Grupos, que cobre quatro marketplaces já no plano de R$ 39 e não limita número de grupos, mas atende só WhatsApp.',
    rows: [
      { key: 'preco', label: 'Preço de entrada', produto: 'R$ 39/30 dias (Basic).', concorrente: 'Shozap: R$ 50/mês (Básico).', reading: 'A diferença real não está aqui — está no que cada plano de entrada inclui.' },
      { key: 'marketplaces', label: 'Marketplaces no plano de entrada', produto: 'Shopee, Amazon, Mercado Livre e Magalu já no Basic.', concorrente: 'Shozap: só Shopee (1 conta). Mercado Livre e Amazon a partir de R$ 100/mês; Shein e Magalu a partir de R$ 150/mês.', reading: 'Se você divulga mais de um marketplace, compare o plano de R$ 100 do Shozap, não o de R$ 50.' },
      { key: 'limite-grupos', label: 'Limite de grupos', produto: 'Sem limite de grupos.', concorrente: 'Shozap: 3 grupos por campanha no Básico, 10 no Intermediário, 50 no Elite, ilimitado no Avançado.', reading: 'Some quantos destinos você tem hoje. É a conta que muda a decisão.' },
      { key: 'conexoes', label: 'Conexões de WhatsApp', produto: 'Uma sessão por conta.', concorrente: 'Shozap: 1 no Básico, 3 no Intermediário, 6 no Elite, 15 no Avançado.', reading: 'Se você opera vários números, o Shozap resolve isso de forma direta e o Espelha Grupos não.' },
      { key: 'telegram', label: 'Telegram', produto: 'Não atende Telegram.', concorrente: 'Shozap: incluído em todos os planos, no mesmo número de conexões do WhatsApp.', reading: 'Vantagem clara do Shozap para quem tem audiência nos dois lugares.' },
      { key: 'recursos-extra', label: 'Recursos que o Espelha Grupos não tem', produto: 'Sem equivalente.', concorrente: 'Shozap: créditos de IA por mês e créditos de SMS a partir do Intermediário.', reading: 'Se SMS faz parte da sua operação, isso não tem equivalente aqui.' },
    ],
    criteria: ['Quantos grupos de destino você tem hoje', 'Quantos marketplaces você realmente divulga', 'Se opera mais de um número de WhatsApp', 'Se parte da audiência está no Telegram', 'Se precisa converter cupom além de link de produto'],
    botinhoDifferentials: ['Quatro marketplaces já no plano de entrada', 'Sem limite de grupos ou de campanhas', 'Conversão de link de cupom, não só de produto', 'Teste grátis de 7 dias com o Pro completo', 'Canais e Comunidades do WhatsApp', 'Histórico de envios com o que foi bloqueado por repetição'],
    richDifferentials: true,
    bestFit: [
      'Escolha o Shozap se opera WhatsApp e Telegram juntos — ele cobre os dois no mesmo plano, inclusive no de entrada.',
      'Escolha o Shozap também se precisa de vários números de WhatsApp na mesma conta, ou se créditos de SMS fazem parte da sua operação.',
      'Escolha o Espelha Grupos se divulga mais de um marketplace desde já, ou se o número de grupos cresce e você não quer que isso empurre o plano para cima.',
    ],
    notIdealFit: [
      'O Shozap não é ideal para quem divulga Mercado Livre ou Amazon com orçamento apertado: no plano de R$ 50 só entra Shopee.',
      'O Shozap também não é ideal para quem tem muitos grupos de destino — o limite por campanha é o que empurra o custo.',
      'O Espelha Grupos não é ideal para quem publica no Telegram, opera vários números de WhatsApp ou precisa de SMS.',
    ],
    migrationPath: [
      'Conte quantos grupos de destino você realmente usa por semana e em quantas campanhas eles se organizam.',
      'Veja em qual faixa do Shozap esse número cai — e compare com o custo do Espelha Grupos, que não muda com o número de grupos.',
      'Se você usa Telegram, some o que custaria manter as duas ferramentas antes de decidir por uma só.',
    ],
    faq: [
      { q: 'Quanto custa o Shozap?', a: 'Conforme a página pública consultada em 04/08/2026: Básico R$ 50/mês, Intermediário R$ 100/mês, Elite R$ 150/mês e Avançado R$ 300/mês. O site tem um botão "Começar grátis", mas a tela de preços consultada não detalha os limites desse acesso gratuito. Confirme na página oficial antes de decidir.' },
      { q: 'O plano de R$ 50 do Shozap cobre quais lojas?', a: 'Só Shopee, com 1 conta. Mercado Livre e Amazon aparecem a partir do Intermediário (R$ 100/mês), e Shein e Magalu a partir do Elite (R$ 150/mês). Se você divulga mais de um marketplace, a comparação justa é contra o plano de R$ 100, não o de R$ 50.' },
      { q: 'Em que o Shozap é melhor que o Espelha Grupos?', a: 'Em três coisas objetivas. Ele cobre Telegram junto com WhatsApp em todos os planos, permite várias conexões de WhatsApp na mesma conta (3 no Intermediário, 15 no Avançado) e inclui créditos de SMS a partir do Intermediário. Nenhuma dessas três existe no Espelha Grupos.' },
      { q: 'O que são "grupos por campanha"?', a: 'É o teto de destinos que cada campanha de envio alcança: 3 no Básico, 10 no Intermediário, 50 no Elite e ilimitado no Avançado. É a cota que mais costuma definir o plano necessário, porque cresce junto com a operação — vale somar seus destinos antes de comparar preço.' },
      { q: 'Trocar de ferramenta faz perder os grupos?', a: 'Não. Os grupos são seus, no seu WhatsApp. O que muda é qual ferramenta se conecta a eles, então dá para rodar as duas em paralelo por uma semana antes de cancelar a atual.' },
    ],
  },
  '/alternativas/fluxopromo': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · FluxoPromo',
    // Título encurtado em 2026-08-19 (specs/013-inbound-leads-strategy, P1):
    // era 72 chars de texto próprio, cortado no celular. Mantém "Alternativa
    // ao" na frente (FR-030 — nunca se apresenta como o concorrente).
    title: 'Alternativa ao FluxoPromo: sem teto de ofertas/dia',
    description: 'O FluxoPromo limita ofertas por dia em todos os planos, menos no de R$ 197. No Espelha Grupos não há teto, e o espelhamento parte dos grupos que você escolhe.',
    competitorSlugs: ['fluxopromo'],
    productPage: {
      href: '/espelhar-grupos-whatsapp',
      label: 'Como funciona o espelhamento dos grupos que você escolhe',
      note: 'Parte dos seus grupos de origem, não de uma lista pronta de ofertas.',
    },
    tldr: 'Antes de comparar preço, entenda que são propostas diferentes: o FluxoPromo entrega ofertas prontas por nicho, o Espelha Grupos espelha os grupos que você escolhe acompanhar. Uma não substitui a outra.',
    directAnswer: 'O FluxoPromo distribui ofertas de afiliado por nicho para canais de Telegram e destinos de WhatsApp, com plano gratuito permanente (20 ofertas/dia, 3 lojas, 1 canal de Telegram) e planos pagos de R$ 37 a R$ 197/mês cobrados por teto de ofertas por dia. O Espelha Grupos funciona de outra forma: monitora os grupos de origem que você escolhe, converte os links para o seu código e republica nos seus destinos, a partir de R$ 39/30 dias.',
    rows: [
      { key: 'origem-ofertas', label: 'De onde vêm as ofertas', produto: 'Dos grupos de origem que você já acompanha e escolhe monitorar.', concorrente: 'FluxoPromo: da curadoria da própria ferramenta, escolhida por nicho e loja (+15 nichos disponíveis).', reading: 'Essa é a diferença que importa. Compare isso antes de comparar preço.' },
      { key: 'plano-gratis', label: 'Plano grátis', produto: 'Teste de 7 dias com o Pro completo.', concorrente: 'FluxoPromo: permanente, com 20 ofertas/dia, 3 lojas e 1 canal de Telegram.', reading: 'O grátis do FluxoPromo não publica em WhatsApp — só em Telegram.' },
      { key: 'preco-entrada', label: 'Preço de entrada pago', produto: 'R$ 39/30 dias.', concorrente: 'FluxoPromo: R$ 37/mês (Essencial), com 1 destino de WhatsApp.', reading: 'O FluxoPromo tem o plano pago mais barato entre os concorrentes que mapeamos.' },
      { key: 'escala-preco', label: 'Como o preço escala', produto: 'Sem limite de ofertas nem de grupos.', concorrente: 'FluxoPromo: por teto de ofertas/dia (20 → 50 → 150 → ilimitado) e por número de destinos.', reading: 'Se você publica muita oferta por dia, é o teto diário que define o plano.' },
      { key: 'lojas', label: 'Lojas cobertas', produto: 'Shopee, Amazon, Mercado Livre e Magalu em todos os planos.', concorrente: 'FluxoPromo: 3 no grátis, 4 no Essencial, 5 no Pro e 12 no Expert (R$ 197/mês).', reading: 'O Expert cobre mais lojas do que o Espelha Grupos. Custa R$ 197/mês.' },
      { key: 'telegram', label: 'Telegram', produto: 'Não atende Telegram.', concorrente: 'FluxoPromo: é o destino principal, presente desde o plano grátis.', reading: 'Se o seu canal é no Telegram, o Espelha Grupos não serve.' },
    ],
    criteria: ['Se você quer ofertas prontas por nicho ou espelhar grupos que já acompanha', 'Se o seu público está no Telegram ou no WhatsApp', 'Quantas ofertas por dia você publica', 'Quantas lojas você realmente divulga', 'Se precisa converter cupom além de link de produto'],
    botinhoDifferentials: ['Monitora os grupos de origem que VOCÊ escolhe, não um feed pronto', 'Sem teto de ofertas por dia', 'Conversão de link de cupom, não só de produto', 'Canais e Comunidades do WhatsApp', 'Controle de cadência por destino e limites anti-repetição', 'Histórico de envios com o que foi bloqueado por repetição'],
    richDifferentials: true,
    bestFit: [
      'Escolha o FluxoPromo se você não tem grupos de origem para acompanhar e quer receber ofertas prontas, selecionadas por nicho.',
      'Escolha o FluxoPromo também se o seu canal principal é Telegram — ele publica lá desde o plano grátis, e o Espelha Grupos não atende Telegram.',
      'Escolha o Espelha Grupos se você já acompanha grupos de ofertas e quer espelhar exatamente o que sai neles, com o seu código de afiliado.',
    ],
    notIdealFit: [
      'O FluxoPromo não é ideal para quem quer espelhar grupos específicos: a página pública descreve distribuição por nicho e loja, não monitoramento de origens escolhidas por você.',
      'O FluxoPromo também limita ofertas por dia em todos os planos exceto o Expert (R$ 197/mês).',
      'O Espelha Grupos não é ideal para quem publica em Telegram, nem para quem quer uma camada gratuita permanente.',
    ],
    migrationPath: [
      'Responda primeiro: você já acompanha grupos de onde as ofertas boas saem, ou quer que alguém selecione por você? A resposta decide a ferramenta, não o preço.',
      'Se a resposta for "acompanho grupos", conte quantas ofertas por dia eles geram — é o número que o modelo de teto diário penaliza.',
      'Se o seu destino principal é Telegram, o Espelha Grupos está fora da comparação, independentemente de preço.',
    ],
    faq: [
      { q: 'Quanto custa o FluxoPromo?', a: 'Conforme a página pública consultada em 04/08/2026: Grátis (20 ofertas/dia, 3 lojas, 1 canal de Telegram), Essencial R$ 37/mês, Pro R$ 97/mês e Expert R$ 197/mês. Há garantia de 7 dias nos planos pagos e o plano anual dá 2 meses grátis. Confirme na página oficial antes de decidir.' },
      { q: 'O FluxoPromo funciona no WhatsApp?', a: 'Sim, mas não no plano gratuito. O grátis publica apenas em 1 canal de Telegram; o destino de WhatsApp entra a partir do Essencial (R$ 37/mês), com 1 destino, chegando a 10 destinos no Expert.' },
      { q: 'Em que o FluxoPromo é melhor que o Espelha Grupos?', a: 'Em quatro pontos. Tem plano gratuito permanente, enquanto aqui o teste dura 7 dias. O plano pago de entrada custa R$ 37, mais barato que o nosso Basic. Cobre Telegram, que o Espelha Grupos não atende. E o plano Expert cobre 12 lojas, mais do que as quatro que cobrimos.' },
      { q: 'Qual a diferença real entre os dois?', a: 'De onde vem a oferta. O FluxoPromo entrega ofertas selecionadas pela própria ferramenta, organizadas por nicho e loja. O Espelha Grupos monitora os grupos de origem que você escolhe e republica o que sai neles com o seu código de afiliado. Se você já tem grupos bons para acompanhar, são coisas diferentes; se não tem, o feed pronto resolve um problema que o espelhamento não resolve.' },
      { q: 'O limite de ofertas por dia atrapalha?', a: 'Depende do seu volume. São 20/dia no grátis, 50 no Essencial, 150 no Pro e ilimitado só no Expert (R$ 197/mês). Para quem publica poucas ofertas selecionadas por dia, o teto nunca é alcançado. Para quem espelha grupos ativos, 20 ou 50 acabam rápido.' },
    ],
  },
  /* Página nova de US5 (specs/013-inbound-leads-strategy, FR-014/FR-025):
   * ÚNICA página de comparação nova desta rodada — escolhida por já ter dado
   * verificado com fonte e data em dashboard/lib/competitors-data.js
   * (slug 'achadinho-pro', verifiedAt 2026-07-31), sem exigir coleta nova
   * (D3 do plan.md). As próximas cinco da fila ficam em
   * specs/013-inbound-leads-strategy/checklist-comparativos.md, uma por
   * semana, só depois desta entrar no índice (SC-011, ≤14 dias).
   */
  /* Promium — criado em 2026-09-02 (ação 11 do PLANO_ACAO_SEO_IA_2026-09-01).
   *
   * É o ÚNICO concorrente que uma IA colocou explicitamente à nossa frente: na
   * medição de citação de 01/09, o ChatGPT chamou o Promium de "o mais
   * completo" na consulta sobre padronizar divulgação de cupons. E ele nem
   * estava no nosso mapa de concorrentes — veio da lista que as IAs citam, que
   * é quase disjunta da que o Search Console mostra.
   *
   * O ângulo é honesto e desconfortável de dois lados, e é isso que o torna
   * citável: eles cobrem MAIS coisa que nós (10 lojas, Telegram, vitrine com
   * domínio próprio, rotador de links com pixel) e custam MUITO mais — o plano
   * de ENTRADA deles, no valor recorrente, custa 42% mais que o nosso plano
   * completo. Dizer só uma das duas metades seria propaganda.
   *
   * ⚠️ Armadilha de preço que a página precisa desfazer: todos os planos deles
   * anunciam um valor promocional no primeiro mês. Comparar o nosso preço com
   * o promocional deles é comparar coisa diferente — a página compara pelo
   * valor recorrente e diz isso em voz alta. */
  '/alternativas/promium': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Promium',
    title: 'Alternativa ao Promium: R$ 69 contra R$ 97,90',
    description: 'O plano de entrada do Promium custa R$ 97,90 por mês e cobre 5 grupos. Compare com o Espelha Grupos: grupos ilimitados por R$ 69, com 7 dias grátis.',
    competitorSlugs: ['promium'],
    productPage: {
      href: '/espelhar-grupos-whatsapp',
      label: 'Como funciona o espelhamento de grupos',
      note: 'Grupos ilimitados por R$ 69, com 7 dias grátis.',
    },
    tldr: 'O Promium cobre mais coisa que o Espelha Grupos — 10 lojas, Telegram, vitrine com domínio próprio e rotador de links com pixel de anúncio. E cobra por isso: o plano de entrada custa R$ 97,90 por mês a partir do segundo mês, contra R$ 69 do nosso plano completo, e cobre 5 grupos contra grupos ilimitados. Se você precisa de vitrine própria e pixel, o Promium entrega o que nós não temos. Se o que você precisa é espelhar grupos e converter link, está pagando por uma plataforma inteira para usar uma parte dela.',
    directAnswer: 'O Promium é uma plataforma de divulgação de ofertas para WhatsApp e Telegram com replicador de grupos, captura de cupom por IA, vitrine de produtos com domínio próprio e rotador de links com pixel de Meta, TikTok e GA4. Os planos vão de R$ 97,90 a R$ 597,90 por mês no valor recorrente, cobrando por faixa de grupos (5, 20, 50 e 200) e por número de conexões de WhatsApp. O Espelha Grupos custa R$ 39 ou R$ 69 por 30 dias, não limita grupos, cobre Shopee, Amazon, Mercado Livre, Magalu e SHEIN, e oferece 7 dias grátis sem cartão. A escolha é entre uma plataforma ampla e paga por faixa, e uma ferramenta focada em espelhar grupos e converter link.',
    rows: [
      { key: 'preco-entrada', label: 'Preço de entrada (valor recorrente)', produto: 'R$ 39 por 30 dias no Basic, R$ 69 no Pro completo. Grupos ilimitados nos dois.', concorrente: 'Promium: R$ 97,90/mês no Starter, com 5 grupos. O primeiro mês sai por R$ 47,90 e o valor recorrente começa no segundo.', reading: 'Compare pelo segundo mês. O plano de entrada deles custa 42% mais que o nosso plano completo.' },
      { key: 'grupos', label: 'Quantos grupos cabem', produto: 'Sem limite de grupos em qualquer plano.', concorrente: 'Promium: 5 grupos no Starter, 20 no Basic, 50 no Intermediário e 200 no Pro.', reading: 'Se a sua operação cresce em número de grupos, no Promium cada faixa nova é uma mensalidade nova; aqui não muda nada.' },
      { key: 'lojas', label: 'Lojas cobertas', produto: 'Shopee, Amazon, Mercado Livre, Magalu e SHEIN.', concorrente: 'Promium: 10 lojas, conforme a página consultada.', reading: 'Aqui o Promium cobre mais. Se você divulga loja fora da nossa lista, isso pesa a favor dele.' },
      { key: 'telegram', label: 'Telegram', produto: 'Não atendemos Telegram — só WhatsApp, em grupo e canal.', concorrente: 'Promium: publica em WhatsApp e Telegram.', reading: 'Se parte do seu público está no Telegram, nós não resolvemos essa parte.' },
      { key: 'vitrine-pixel', label: 'Vitrine e rastreamento de anúncio', produto: 'Não temos vitrine com domínio próprio nem rotador de links com pixel.', concorrente: 'Promium: vitrine de produtos com domínio próprio e rotador de links com pixel de Meta, TikTok e GA4.', reading: 'Quem anuncia em cima do próprio tráfego precisa disso, e é uma diferença real a favor do Promium.' },
      { key: 'teste', label: 'Teste antes de pagar', produto: '7 dias grátis com o plano Pro completo, sem cartão.', concorrente: 'Promium: a página de planos consultada não informa teste grátis. O que ela oferece é preço menor no primeiro mês.', reading: 'Desconto no primeiro mês e teste grátis não são a mesma coisa: num você já pagou.' },
    ],
    criteria: ['Quantos grupos você tem hoje e quantos pretende ter', 'Se você divulga loja fora de Shopee, Amazon, Mercado Livre, Magalu e SHEIN', 'Se parte do seu público está no Telegram', 'Se você anuncia em cima do próprio tráfego (vitrine e pixel)', 'Se você precisa de mais de uma conexão de WhatsApp', 'Se quer testar antes de pagar'],
    botinhoDifferentials: ['Grupos ilimitados em qualquer plano', '7 dias grátis com o plano completo, sem cartão', 'Preço fixo que não sobe quando a operação cresce', 'Conversão de link de cupom, não só de produto', 'Histórico completo de envios, incluindo o que foi bloqueado por repetição'],
    richDifferentials: true,
    bestFit: [
      'Escolha o Promium se você divulga loja fora da nossa lista de cinco, publica também em Telegram, quer vitrine de produtos com domínio próprio, precisa de rotador de links com pixel para anunciar em cima do próprio tráfego, ou opera mais de uma conexão de WhatsApp.',
      'Escolha o Espelha Grupos se o que você precisa é espelhar grupos e converter link com o seu código, tem muitos grupos (ou pretende ter), quer testar antes de pagar, ou não quer que a mensalidade suba junto com a operação.',
    ],
    notIdealFit: [
      'O Promium não é ideal para quem está começando ou opera poucos grupos: o plano de entrada cobre 5 grupos e já custa mais que o nosso plano completo.',
      'O Promium também não é ideal para quem quer validar antes de pagar — a página consultada não indica teste grátis.',
      'O Espelha Grupos não é ideal para quem precisa de Telegram, de vitrine com domínio próprio ou de pixel de anúncio: nada disso existe aqui.',
    ],
    migrationPath: [
      'Conte quantos grupos você tem hoje. É o número que mais muda a conta entre as duas ferramentas.',
      'Confira se as lojas que você divulga estão entre Shopee, Amazon, Mercado Livre, Magalu e SHEIN. Se faltar alguma que é importante para você, o Promium cobre mais.',
      'Se decidir pelo Promium, olhe o valor do SEGUNDO mês ao montar o orçamento — o do primeiro é promocional em todos os planos.',
      'Se decidir pelo Espelha Grupos, use os 7 dias de teste para validar a conversão de link e o espelhamento antes de assinar.',
    ],
    faq: [
      { q: 'Quanto custa o Promium?', a: 'Conforme a página de planos consultada em 01/09/2026: Starter R$ 97,90/mês (5 grupos, 1 conexão), Basic R$ 197,90/mês (20 grupos), Intermediário R$ 397,90/mês (50 grupos, 2 conexões) e Pro R$ 597,90/mês (200 grupos, 3 conexões). Todos anunciam um valor menor no primeiro mês. Confirme na página oficial antes de decidir — preços mudam.' },
      { q: 'Por que comparar pelo segundo mês e não pelo preço anunciado?', a: 'Porque o preço anunciado é promocional e vale uma vez só. O Starter aparece como R$ 47,90, mas a partir do segundo mês é R$ 97,90 — e é esse o valor que você vai pagar todo mês. Comparar o nosso preço com o promocional deles seria comparar coisas diferentes.' },
      { q: 'Em que o Promium é melhor que o Espelha Grupos?', a: 'Em cinco pontos concretos: cobre 10 lojas contra as nossas cinco, publica também em Telegram, tem vitrine de produtos com domínio próprio, tem rotador de links com pixel de Meta, TikTok e GA4, e permite até 3 conexões de WhatsApp. Nada disso existe aqui.' },
      { q: 'O Promium tem teste grátis?', a: 'A página de planos consultada em 01/09/2026 não indica teste grátis — o que ela oferece é preço menor no primeiro mês. Se testar antes de pagar for importante para você, confirme diretamente no site oficial antes de assinar.' },
      { q: 'Trocar de ferramenta faz perder os grupos?', a: 'Não. Os grupos são seus, no seu WhatsApp. O que muda é qual ferramenta se conecta a eles, então dá para rodar as duas em paralelo por uma semana antes de cancelar a atual.' },
    ],
  },
  '/alternativas/achadinho-pro': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Achadinho Pro',
    title: 'Alternativa ao Achadinho Pro: 6 lojas por R$ 39',
    description: 'O Achadinho Pro cobre só Shopee no plano de entrada. No Espelha Grupos, 6 lojas (Shopee, Amazon, Mercado Livre, Magalu, SHEIN, AliExpress) por R$ 39/30 dias.',
    competitorSlugs: ['achadinho-pro'],
    // Páginas de resposta (19/09/2026): quem chega comparando ferramenta ainda
    // está decidindo COMO divulgar — os três guias respondem isso de frente.
    guides: [
      { href: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp', title: 'Como espelhar mensagens entre grupos de WhatsApp' },
      { href: '/blog/melhores-automacoes-para-afiliado-shopee-2026', title: 'Melhores automações para afiliado Shopee em 2026' },
      { href: '/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp', title: 'Ferramenta para divulgar ofertas em grupos do WhatsApp' },
      // 23/09/2026: estes concorrentes vendem busca automática na Shopee; quem
      // chega aqui precisa saber que o Espelha Grupos também tem esse modo.
      { href: '/bot-que-busca-ofertas-shopee-whatsapp', title: 'Bot que busca ofertas da Shopee sozinho no WhatsApp' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    productPage: {
      href: '/bot-achadinhos-whatsapp',
      label: 'Como funciona o bot para achadinhos no WhatsApp',
      note: 'Grupos ilimitados, seis lojas e 7 dias grátis.',
    },
    tldr: 'Se você vai começar só com Shopee e não se importa em pagar mais depois para somar Mercado Livre e Amazon, o Achadinho Pro resolve. Se já divulga as três lojas (ou Magalu) desde o início, compare o custo total antes de decidir.',
    directAnswer: 'O Achadinho Pro é um bot de afiliados para WhatsApp com IA para selecionar produtos — e não é o mesmo produto que o AchadinhosBot, apesar do nome parecido. No Achadinho Pro, o plano Basic (R$ 49,97/mês) cobre só Shopee, com grupos ilimitados por automação e até 5 números de WhatsApp; o Pro (R$ 59,97/mês) soma Mercado Livre e Amazon pelo mesmo custo de apenas R$10 a mais. A página de preços consultada não indica teste grátis. A alternativa mais próxima é o Espelha Grupos, que cobre Shopee, Amazon, Mercado Livre e Magalu já no plano de entrada (R$39/30 dias) e converte também links de cupom, com teste grátis de 7 dias.',
    rows: [
      { key: 'marketplaces', label: 'Marketplaces no plano de entrada', produto: 'Shopee, Amazon, Mercado Livre e Magalu já no Basic (R$39/30 dias).', concorrente: 'Achadinho Pro: só Shopee no Basic (R$ 49,97/mês); Mercado Livre e Amazon entram no Pro (R$ 59,97/mês).', reading: 'Se você já divulga mais de uma loja, compare pelo plano que cobre todas — não pelo preço de entrada.' },
      { key: 'diferenca-planos', label: 'Diferença de preço entre os planos', produto: 'R$30 a mais (Basic → Pro) para Canais do WhatsApp e ofertas automáticas — os marketplaces já vêm todos no Basic.', concorrente: 'Achadinho Pro: R$10/mês a mais para triplicar o número de marketplaces (Basic → Pro).', reading: 'São upgrades diferentes: no Achadinho Pro o upgrade é sobre LOJA; no Espelha Grupos é sobre CANAL e AUTOMAÇÃO.' },
      { key: 'grupos-numeros', label: 'Grupos e números de WhatsApp', produto: 'Sem limite de grupos, uma sessão por conta.', concorrente: 'Achadinho Pro: grupos ilimitados por automação, até 5 números de WhatsApp por conta.', reading: 'Se você opera vários números de WhatsApp na mesma operação, o Achadinho Pro cobre isso e o Espelha Grupos não.' },
      { key: 'teste', label: 'Teste antes de pagar', produto: '7 dias grátis com o plano Pro completo, sem cartão.', concorrente: 'Achadinho Pro: a página de preços consultada não indica teste grátis nem número de dias de trial.', reading: 'Sem teste indicado, é mais difícil validar antes de assinar — confirme na página oficial se isso mudou.' },
      { key: 'cupom', label: 'Conversão de cupom', produto: 'Converte link de cupom, não só de produto.', concorrente: 'Não indicada nas páginas públicas do Achadinho Pro.', reading: 'Só faz diferença para quem divulga campanha de cupom além de produto avulso.' },
    ],
    criteria: ['Quantos marketplaces você divulga hoje', 'Quantos números de WhatsApp a operação usa', 'Se precisa validar antes de pagar (teste grátis)', 'Se converte cupom além de produto', 'Se quer Canais do WhatsApp além de grupos'],
    botinhoDifferentials: ['Quatro marketplaces já no plano de entrada', 'Teste grátis de 7 dias com o Pro completo, sem cartão', 'Conversão de link de cupom, não só de produto', 'Canais e Comunidades do WhatsApp', 'Sem limite de grupos', 'Histórico completo de envios, incluindo o que foi bloqueado por repetição'],
    richDifferentials: true,
    bestFit: [
      'Escolha o Achadinho Pro se vai começar só com Shopee, quer pagar pouco a mais (R$10/mês) para depois somar Mercado Livre e Amazon, ou precisa operar vários números de WhatsApp na mesma conta.',
      'Escolha o Espelha Grupos se já divulga Shopee, Amazon, Mercado Livre e Magalu desde o início, quer validar a operação completa com teste grátis antes de pagar, ou divulga campanha de cupom além de produto avulso.',
    ],
    notIdealFit: [
      'O Achadinho Pro não é ideal para quem já divulga Mercado Livre ou Amazon desde o primeiro dia — o plano de entrada cobre só Shopee.',
      'O Achadinho Pro também não é ideal para quem quer testar antes de assinar: a página de preços não indica teste grátis.',
      'O Espelha Grupos não é ideal para quem opera vários números de WhatsApp na mesma conta — o Achadinho Pro cobre até 5, o Espelha Grupos é uma sessão por conta.',
    ],
    migrationPath: [
      'Conte quantos marketplaces você realmente divulga hoje e quantos números de WhatsApp a operação usa — são os dois fatores que mais mudam a conta entre as duas ferramentas.',
      'Se decidir pelo Achadinho Pro, comece pelo Basic (só Shopee) e migre para o Pro só quando for divulgar Mercado Livre ou Amazon de fato.',
      'Se decidir pelo Espelha Grupos, use os 7 dias de teste grátis para validar a conversão de link e o preview antes de assinar.',
    ],
    faq: [
      { q: 'Achadinho Pro e AchadinhosBot são a mesma ferramenta?', a: 'Não. São dois produtos diferentes, de empresas diferentes, com nomes parecidos — o que faz muita gente procurar um e encontrar o outro. Esta página compara o Achadinho Pro. Se você procurava o AchadinhosBot, o site tem uma página só para ele.' },
      { q: 'Quanto custa o Achadinho Pro?', a: 'Conforme a página pública consultada em 31/07/2026: Basic R$ 49,97/mês (só Shopee, grupos ilimitados por automação, até 5 números de WhatsApp) e Pro R$ 59,97/mês (soma Mercado Livre e Amazon, mais Listas Personalizadas com 48h de auto-expiração). Confirme na página oficial antes de decidir — preços mudam.' },
      { q: 'O Achadinho Pro tem teste grátis?', a: 'A página de preços consultada em 31/07/2026 não indica teste grátis nem número de dias de trial. Se isso for importante para você, confirme diretamente no site oficial antes de assinar.' },
      { q: 'Em que o Achadinho Pro é melhor que o Espelha Grupos?', a: 'Em dois pontos concretos: a diferença de preço entre os planos é pequena (R$10/mês) para triplicar o número de marketplaces cobertos, e ele permite até 5 números de WhatsApp na mesma conta — o Espelha Grupos é uma sessão por conta.' },
      { q: 'Vale a pena pagar o plano Pro do Achadinho Pro?', a: 'Depende de quantas lojas você divulga. Se for só Shopee, o Basic já resolve. Se pretende somar Mercado Livre e Amazon, o Pro custa R$10/mês a mais — proporcionalmente barato para triplicar a cobertura de marketplace.' },
      { q: 'Trocar de ferramenta faz perder os grupos?', a: 'Não. Os grupos são seus, no seu WhatsApp. O que muda é qual ferramenta se conecta a eles, então dá para rodar as duas em paralelo por uma semana antes de cancelar a atual.' },
    ],
  },
  /* Página de marca do concorrente Gigi Bot. Criada em 2026-08-26 depois de uma
   * cliente relatar que migrou porque "o Gigi Bot era grátis e virou pago".
   * Segue o padrão que já é o motor de impressão do site (busca pelo NOME do
   * concorrente — 15% de tudo em 2026-08-16), não as linhas congeladas de
   * cidade/nicho.
   *
   * Regra que NÃO se quebra aqui: o fim do plano gratuito é RELATO de cliente,
   * não fato verificado por nós. A tabela pública que temos (print de
   * 31/07/2026) ainda listava o plano gratuito, e gigibot.com.br responde 403
   * para leitura automatizada. Por isso a página nunca AFIRMA que acabou o
   * grátis — ela responde a pergunta com o que é verificável e manda confirmar
   * na fonte oficial. Afirmar mudança de preço de concorrente sem prova é risco
   * jurídico e destrói a citabilidade por IA, que é justamente o objetivo.
   *
   * O ângulo honesto e forte é outro, e esse SIM está verificado: o plano
   * gratuito nunca espelhou grupos. Quem usava de graça e queria espelhar
   * precisava do Gigi Prime Bot, o plano mais caro — e é contra o preço dele
   * que o plano de entrada compara.
   *
   * Sem cifra neste comentário de propósito: `extrairBlocoPorChave` (FR-031,
   * test/marketing-limites-que-nao-se-cruzam.test.js) fatia o arquivo até a
   * PRÓXIMA chave de página, então comentário que precede uma chave é lido
   * como parte do bloco da página ANTERIOR. Preço citado aqui vira preço sem
   * fonte atribuído a /alternativas/achadinho-pro e reprova o CI. Preço mora
   * no corpo da entrada, onde é conferido contra competitors-data.js.
   */
  /* Página de marca do concorrente Gigi Bot. Criada em 2026-08-26 depois de uma
   * cliente relatar que migrou porque "o Gigi Bot era grátis e virou pago".
   * Segue o padrão que já é o motor de impressão do site (busca pelo NOME do
   * concorrente — 15% de tudo em 2026-08-16), não as linhas congeladas de
   * cidade/nicho.
   *
   * O relato da cliente foi checado contra a tabela pública (print de
   * 26/08/2026, em competitors-data.js). O plano gratuito NÃO acabou — e a
   * página diz isso, porque afirmar mudança de preço de concorrente sem prova
   * é risco jurídico e destrói a citabilidade por IA, que é o objetivo aqui.
   *
   * O que a checagem achou é mais forte do que o relato: autoenvio
   * WhatsApp/Telegram aparece riscado nos TRÊS primeiros planos. O plano
   * gratuito converte o link, mas quem posta no grupo é a pessoa. Quem começou
   * de graça e depois quis o robô publicando sozinho não caiu no primeiro plano
   * pago — caiu no último. É esse corte que a página usa como eixo, e não
   * "espelhamento contra conversão de link", que era o eixo da 1ª versão.
   *
   * Sem cifra neste comentário de propósito: `extrairBlocoPorChave` (FR-031,
   * test/marketing-limites-que-nao-se-cruzam.test.js) fatia o arquivo até a
   * PRÓXIMA chave de página, então comentário que precede uma chave é lido
   * como parte do bloco da página ANTERIOR. Preço citado aqui vira preço sem
   * fonte atribuído a /alternativas/achadinho-pro e reprova o CI. Preço mora
   * no corpo da entrada, onde é conferido contra competitors-data.js.
   */
  '/alternativas/gigi-bot': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Gigi Bot',
    title: 'Alternativa ao Gigi Bot: o que o plano grátis faz',
    description: 'Comparativo entre Gigi Bot e Espelha Grupos: qual envia sozinho para o WhatsApp, quanto custa e o que o plano grátis faz. Tabela verificada em 26/08/2026.',
    competitorSlugs: ['gigi-bot'],
    productPage: {
      href: '/bot-achadinhos-whatsapp',
      label: 'Como funciona o bot para achadinhos no WhatsApp',
      note: 'Grupos ilimitados, seis lojas e 7 dias grátis.',
    },
    tldr: 'O plano gratuito do Gigi Bot continua existindo, mas ele não publica no WhatsApp — nem ele, nem os dois planos seguintes. Envio automático e espelhamento de grupos só no plano mais caro. Se o que você precisa é o robô postando sozinho nos grupos, compare esse plano, não o de entrada.',
    directAnswer: 'O Gigi Bot tem quatro planos: um gratuito que converte links de 9 lojas com limite de 120 promoções por dia, o Guru Plus a R$ 19,99/mês, o Gigi Promo a R$ 39,99/mês (adiciona Amazon e site próprio) e o Gigi Prime, anunciado a R$ 49,90 no primeiro mês e R$ 67,99 depois. Na tabela pública, "autoenvio WhatsApp/Telegram" aparece riscado nos três primeiros planos: só o Gigi Prime publica sozinho no WhatsApp, com espelhamento de grupos e limite de 20 grupos por fila. A alternativa mais próxima para quem precisa do envio automático é o Espelha Grupos, a R$39/30 dias, com espelhamento e grupos ilimitados já no plano de entrada e 7 dias de teste grátis com o plano Pro. Dados da tabela verificada em 26/08/2026 — preços mudam, confirme na fonte oficial.',
    rows: [
      { key: 'autoenvio', label: 'O robô publica sozinho no WhatsApp?', produto: 'Sim, desde o plano de entrada (R$39/30 dias).', concorrente: 'Gigi Bot: só no Gigi Prime, o plano mais caro. Nos outros três (grátis, R$ 19,99 e R$ 39,99) o autoenvio WhatsApp/Telegram aparece riscado na tabela.', reading: 'Este é o corte que mais muda a conta, e é o que costuma passar despercebido: o plano gratuito converte link, mas quem posta no grupo é você.' },
      { key: 'espelhar-grupos', label: 'Espelhar grupos', produto: 'Incluído no plano de entrada, sem limite de grupos.', concorrente: 'Gigi Bot: só no Gigi Prime, com 4 filas de até 20 grupos cada.', reading: 'Se você já opera mais de 20 grupos por fila, o limite do plano mais caro pesa na comparação.' },
      { key: 'lojas', label: 'Lojas cobertas', produto: 'Shopee, Amazon, Mercado Livre e Magalu, todas no plano de entrada.', concorrente: 'Gigi Bot: 9 lojas (Shopee, Mercado Livre, Magalu, AliExpress, Kabum, Terabyte, Natura, Shein e Temu) — Amazon só a partir do 3º plano.', reading: 'Aqui o Gigi Bot é claramente mais amplo. Se você divulga AliExpress, Temu ou Shein, isso pesa a favor dele.' },
      { key: 'comecar-gratis', label: 'Começar sem pagar', produto: '7 dias grátis com o plano Pro completo, sem cartão, depois é pago.', concorrente: 'Gigi Bot: plano gratuito permanente, com limite de 120 promoções por dia, sem Amazon e sem envio automático.', reading: 'São coisas diferentes: um é plano grátis limitado para sempre; o outro é teste completo por tempo determinado.' },
      { key: 'onde-roda', label: 'Onde o robô roda', produto: 'Painel no navegador, conectado ao seu WhatsApp por QR Code.', concorrente: 'Gigi Bot: todos os planos são marcados como "disponível no Telegram" — é lá que você opera o bot.', reading: 'Não é melhor nem pior, é rotina diferente. Vale saber antes de assinar.' },
      { key: 'relatorio', label: 'Relatório', produto: 'Histórico completo de envios, incluindo o que foi bloqueado por repetição.', concorrente: 'Gigi Bot: relatório de comissões da Shopee, recurso que não vimos nos outros concorrentes mapeados.', reading: 'São relatórios de coisas diferentes: um olha a comissão na loja, o outro olha o que o robô fez com cada oferta.' },
    ],
    criteria: ['Se você precisa que o robô publique sozinho ou só quer converter link', 'Quantos grupos recebem oferta hoje (e se cabem em 20 por fila)', 'Quantas lojas você divulga de verdade', 'Se Amazon faz parte da rotina', 'Se você prefere operar por Telegram ou por painel no navegador'],
    botinhoDifferentials: ['Envio automático para os grupos já no plano de entrada', 'Espelhamento de grupos sem limite de grupos', 'Quatro marketplaces incluídos, Amazon entre eles', 'Teste grátis de 7 dias com o plano Pro completo, sem cartão', 'Conversão de link de cupom, não só de produto', 'Canais e Comunidades do WhatsApp', 'Histórico completo de envios, incluindo o que foi bloqueado por repetição'],
    richDifferentials: true,
    bestFit: [
      'Escolha o Gigi Bot se você divulga AliExpress, Temu, Shein, Kabum, Terabyte ou Natura — nenhum concorrente que mapeamos cobre tantas lojas.',
      'Escolha o Gigi Bot se o seu uso é converter link e postar você mesma, dentro do limite de 120 promoções por dia: aí o plano gratuito resolve e não custa nada.',
      'Escolha o Gigi Bot se você já opera pelo Telegram e prefere manter a rotina lá.',
      'Escolha o Espelha Grupos se o que você precisa é o robô publicando sozinho nos grupos: lá isso está no plano mais caro, aqui está no de entrada.',
      'Escolha o Espelha Grupos se opera mais grupos do que o limite de 20 por fila, ou se quer testar a operação completa antes de pagar.',
    ],
    notIdealFit: [
      'O Gigi Bot não é ideal para quem quer o robô postando sozinho gastando pouco — autoenvio e espelhamento só aparecem no plano mais caro.',
      'O Gigi Bot não é ideal para quem depende da Amazon desde o começo: ela entra a partir do 3º plano pago.',
      'O Espelha Grupos não é ideal para quem divulga AliExpress, Temu ou Shein — essas lojas não estão entre as quatro que ele converte.',
      'O Espelha Grupos não é ideal para quem quer um plano gratuito permanente: o que existe aqui é teste de 7 dias.',
    ],
    migrationPath: [
      'Responda primeiro uma pergunta só: você quer converter o link e postar você mesma, ou quer o robô postando sozinho? É isso que decide o plano em cada ferramenta, mais do que qualquer outro item.',
      'Conte quantos grupos recebem oferta por semana. Passando de 20 por fila, o limite do Gigi Prime entra na conta.',
      'Liste as lojas que você realmente divulga. Se AliExpress, Temu ou Shein estiverem na lista, a cobertura do Gigi Bot é uma vantagem real e vale considerá-la.',
      'Rode uma semana em paralelo antes de cancelar a ferramenta atual, comparando qualidade do link convertido e do preview no celular.',
    ],
    faq: [
      { q: 'O Gigi Bot deixou de ser grátis?', a: 'Não. Na tabela pública verificada em 26/08/2026 o plano gratuito Guru das Promoções Bot continua lá, com conversão de 9 lojas e limite de 120 promoções por dia. O que confunde é outra coisa: o plano gratuito não publica nada sozinho no WhatsApp. Ele converte o link e você posta. Quem começou de graça e depois quis o robô postando sozinho descobriu que isso é pago — e não no primeiro plano pago, no último.' },
      { q: 'O plano gratuito do Gigi Bot envia para os grupos?', a: 'Não. Na tabela verificada, "autoenvio WhatsApp/Telegram" aparece riscado no plano gratuito, no Guru Plus (R$ 19,99/mês) e no Gigi Promo (R$ 39,99/mês). Só o Gigi Prime Bot envia sozinho, e é o plano mais caro.' },
      { q: 'Qual plano do Gigi Bot espelha grupos?', a: 'Só o Gigi Prime Bot, anunciado a R$ 49,90 no primeiro mês e R$ 67,99 depois. Ele traz 4 filas de envios de até 20 grupos cada, espelhamento de grupos, agendamento por horário e relatório de comissões da Shopee.' },
      { q: 'Quanto custa o Gigi Bot?', a: 'Conforme a tabela pública verificada em 26/08/2026: Guru das Promoções Bot grátis, Guru Plus Bot R$ 19,99/mês, Gigi Promo Bot R$ 39,99/mês e Gigi Prime Bot a R$ 49,90 no primeiro mês, indicado como promocional, sobre um valor cheio de R$ 67,99/mês. Confirme na página oficial antes de assinar.' },
      { q: 'Qual a melhor alternativa ao Gigi Bot?', a: 'Depende do que travou. Se o problema foi precisar do plano mais caro só para o robô publicar nos grupos, o Espelha Grupos faz isso no plano de entrada (R$39/30 dias), com espelhamento e sem limite de grupos. Se o que você valoriza é a variedade de lojas, o próprio Gigi Bot continua sendo o mais amplo entre os concorrentes que mapeamos.' },
      { q: 'Em que o Gigi Bot é melhor que o Espelha Grupos?', a: 'Em dois pontos concretos. Primeiro, cobertura de lojas: são 9, incluindo AliExpress, Temu, Shein, Kabum, Terabyte e Natura, contra as quatro do Espelha Grupos. Segundo, ele tem um plano gratuito permanente para converter link, enquanto aqui o gratuito é um teste de 7 dias.' },
      { q: 'Trocar de ferramenta faz perder os grupos?', a: 'Não. Os grupos são seus, no seu WhatsApp. O que muda é qual ferramenta se conecta a eles, então dá para rodar as duas em paralelo por uma semana antes de cancelar a atual.' },
    ],
  },
  '/espelha-grupos-vs-planilha-manual': {
    format: 'vs',
    eyebrow: 'Comparativo · Operação manual',
    title: 'Planilha ou bot para divulgar ofertas: quando vale',
    description: 'Compare Espelha Grupos e planilha manual para organizar grupos, links de afiliado, cadência e logs de divulgação em WhatsApp.',
    competitorSlugs: ['manual-spreadsheet-workflow'],
    tldr: 'Planilha manual funciona para operação pequena; Espelha Grupos tende a ganhar quando volume e repetição aumentam e você precisa de logs e consistência.',
    directAnswer: 'Planilha manual é indicada para validar processo com baixo volume e revisão próxima. O Espelha Grupos é indicado quando a operação precisa repetir a rotina com mais consistência: separar origem e destino, revisar links suportados, aplicar filtros, controlar cadência e consultar histórico de logs.',
    rows: [
      ['Organização de grupos', 'Planilha exige atualização manual de nomes, regras e prioridades.', 'Espelha Grupos centraliza origem/destino na rotina operacional.'],
      ['Conferência de link', 'Depende de checklist e disciplina da pessoa operadora.', 'Ajuda a converter links suportados, mas ainda exige revisão humana do destino final.'],
      ['Cadência', 'Horários e intervalos ficam sujeitos a esquecimento.', 'Intervalos configuráveis ajudam a reduzir repetição excessiva.'],
      ['Auditoria', 'Histórico depende de anotações manuais.', 'Logs ajudam a conferir execução e falhas de envio.'],
    ],
    criteria: ['Volume semanal de ofertas', 'Número de grupos', 'Risco de erro humano', 'Necessidade de logs', 'Tempo disponível para revisão'],
    bestFit: [
      'Espelha Grupos é melhor para operação diária com múltiplos grupos e necessidade de trilha de execução.',
      'Planilha manual é melhor para estágio inicial de validação com poucas publicações semanais.',
    ],
    notIdealFit: [
      'Espelha Grupos não é ideal se você ainda não definiu processo base de revisão humana.',
      'Planilha manual não é ideal quando atrasos e erros de rotina já impactam performance.',
    ],
    migrationPath: [
      'Use a planilha como calendário editorial, não como executor principal.',
      'Configure primeiro os grupos prioritários e a cadência mínima.',
      'Valide logs de execução por 7 dias e ajuste regras de publicação antes de ampliar.',
    ],
    faq: [
      { q: 'Quando continuar na planilha?', a: 'Continue na planilha se a operação ainda é pequena, tem poucos grupos e a revisão manual não atrasa a publicação.' },
      { q: 'Quando migrar para o Espelha Grupos?', a: 'Considere migrar quando houver repetição diária, vários destinos, risco de link errado e necessidade de histórico.' },
      { q: 'A planilha deixa de ser útil?', a: 'Não. Ela pode continuar como planejamento editorial, enquanto o Espelha Grupos organiza a execução recorrente.' },
    ],
  },
  '/espelha-grupos-vs-ferramentas-genericas-automacao': {
    format: 'vs',
    eyebrow: 'Comparativo · Automação genérica',
    title: 'Bot de afiliados ou automação genérica: qual usar',
    description: 'Entenda quando usar Espelha Grupos ou ferramentas genéricas como automações de fluxo, conectores e scripts para rotinas de WhatsApp com afiliados.',
    competitorSlugs: ['generic-automation-tools'],
    tldr: 'Ferramentas genéricas priorizam flexibilidade técnica; Espelha Grupos prioriza velocidade de operação para grupos de ofertas sem projeto técnico do zero.',
    directAnswer: 'Ferramentas genéricas são úteis quando a equipe técnica precisa conectar muitos sistemas diferentes. O Espelha Grupos é mais indicado quando o problema central é operação de ofertas em grupos: link monetizado, origem, destino, filtros, cadência, revisão humana e logs sem construir uma automação do zero.',
    rows: [
      ['Setup', 'Automação genérica costuma exigir desenho técnico e testes de integração.', 'Espelha Grupos entrega fluxo mais específico para grupos e ofertas.'],
      ['Manutenção', 'Scripts e conectores podem quebrar quando páginas, APIs ou regras mudam.', 'Espelha Grupos concentra regras do produto e ajustes operacionais em uma experiência única.'],
      ['Governança', 'Depende de documentação própria da equipe.', 'Metodologia pública reforça limites, revisão e cadência responsável.'],
      ['Flexibilidade', 'Alta para times técnicos.', 'Focada no caso de uso de afiliados e admins de grupos.'],
    ],
    criteria: ['Capacidade técnica interna', 'Número de integrações externas', 'Foco em grupos de ofertas', 'Necessidade de governança', 'Custo de manutenção'],
    bestFit: [
      'Espelha Grupos é melhor quando a dor principal é execução de ofertas em grupos com governança operacional.',
      'Automação genérica é melhor quando você precisa orquestrar vários sistemas além do WhatsApp.',
    ],
    notIdealFit: [
      'Espelha Grupos não é ideal para pipelines altamente customizados que exigem lógica técnica complexa fora do escopo do produto.',
      'Automação genérica não é ideal para times que precisam de resultado rápido sem sobrecarga de manutenção.',
    ],
    migrationPath: [
      'Mapeie quais integrações realmente precisam continuar externas.',
      'Migre os fluxos de maior frequência primeiro para reduzir risco operacional.',
      'Mantenha monitoramento paralelo por uma janela de validação antes de desativar scripts antigos.',
    ],
    faq: [
      { q: 'Ferramentas genéricas são ruins?', a: 'Não. Elas são fortes para fluxos amplos. A comparação é sobre foco: Espelha Grupos prioriza rotina de ofertas em grupos.' },
      { q: 'Posso usar as duas abordagens?', a: 'Sim. Uma equipe pode manter BI, CRM ou planilhas fora do Espelha Grupos e usar o produto para execução de grupos.' },
      { q: 'Qual tem menor risco?', a: 'O risco depende do uso. Qualquer abordagem precisa respeitar regras do WhatsApp, consentimento, cadência e políticas de afiliados.' },
    ],
  },
  '/melhores-bots-para-afiliados-whatsapp': {
    format: 'alternative-plural',
    eyebrow: 'Critérios · Avaliação de ferramentas',
    title: 'Melhores bots para afiliados no WhatsApp: como comparar',
    description: 'Lista de critérios para avaliar bots e ferramentas de WhatsApp para afiliados sem ranking falso, promessa de ganho ou prova social inventada.',
    tldr: 'Não escolha por promessa de ganho: escolha por processo confiável, rastreabilidade e aderência às políticas das plataformas. E confira qual dos dois modos você precisa — espelhar grupos que já segue ou deixar o robô buscar oferta sozinho —, porque o mercado divide isso em ferramentas diferentes.',
    // 23/09/2026: "bot para afiliados" é lido por IA como "robô que busca oferta
    // sozinho". O critério dos dois modos entra aqui para a página responder
    // essa leitura — e o Espelha Grupos cobre os dois (busca automática só na
    // Shopee, plano Pro).
    directAnswer: 'Os melhores bots para afiliados no WhatsApp devem ser avaliados por critérios de processo, não por promessa de comissão. Priorize revisão de link monetizado, controle de grupos, filtros, cadência, logs, limites contra spam, clareza de preço e suporte a plataformas realmente usadas pela operação. Antes disso, decida o modo: há bots que espelham os grupos que você já segue (repassam a oferta com o seu link) e bots que buscam oferta sozinhos na loja por tema. O Espelha Grupos faz os dois na mesma conta: espelha em 6 lojas e, no plano Pro, busca ofertas da Shopee sozinho por tema e desconto mínimo. Confira também se a ferramenta publica a política de reembolso.',
    guides: [
      { href: '/bot-que-busca-ofertas-shopee-whatsapp', title: 'Bot que busca ofertas da Shopee sozinho no WhatsApp' },
      { href: '/bot-afiliados-whatsapp', title: 'Bot para afiliados no WhatsApp: espelhar e buscar oferta' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    rows: [
      ['Modo de operação', 'O bot espelha grupos que você já segue, busca oferta sozinho na loja, ou faz os dois?', 'Espelhar depende de ter bons grupos de origem; buscar sozinho depende de a loja ter busca por tema. O Espelha Grupos faz os dois (busca automática só na Shopee).'],
      ['Confiança', 'A ferramenta publica preço, política de reembolso e o que NÃO promete?', 'Regra escrita e pública vale mais que promessa de ganho ou de banimento zero.'],
      ['Link monetizado', 'A ferramenta ajuda a conferir ou converter links suportados sem remover tags?', 'Reduz risco operacional, mas não elimina revisão humana.'],
      ['Grupos e destinos', 'Existe separação clara entre origem, destino, nicho e prioridade?', 'Evita publicar no público errado.'],
      ['Cadência', 'Há intervalos, filtros e controle para evitar repetição?', 'Ajuda a proteger experiência dos grupos.'],
      ['Logs', 'A operação consegue auditar envio, falha e campanha?', 'Permite aprender e corrigir processo.'],
    ],
    criteria: ['Modo: espelhar grupos, buscar oferta sozinho ou os dois', 'Transparência de preço', 'Política de reembolso publicada', 'Limites de uso responsável', 'Logs e auditoria', 'Suporte a afiliados', 'Ausência de promessa de ganho garantido'],
    bestFit: [
      'A melhor ferramenta será a que reduzir erros operacionais mantendo revisão humana e trilha de auditoria.',
    ],
    migrationPath: [
      'Defina critérios mínimos de compliance e qualidade de link antes da troca de ferramenta.',
      'Execute piloto com um subconjunto de grupos e só depois amplie para o restante da operação.',
    ],
    faq: [
      { q: 'Por que esta página não ranqueia marcas como primeiro, segundo e terceiro lugar?', a: 'Sem testes públicos equivalentes e consentimento de dados, ranking numérico seria pouco confiável. A página usa critérios para avaliação responsável.' },
      { q: 'Espelha Grupos entra nesses critérios?', a: 'Sim. O Espelha Grupos foi desenhado para grupos, links suportados, cadência e logs, mas ainda exige revisão humana e autorização dos grupos.' },
      { q: 'O Espelha Grupos busca ofertas sozinho ou só espelha grupos?', a: 'Os dois. O espelhamento repassa, com o seu código, as ofertas dos grupos e canais que você acompanha, em 6 lojas. No plano Pro, as ofertas automáticas buscam na Shopee pelo tema e pelo desconto mínimo que você definir e publicam sozinhas, sem grupo de origem. Nas outras lojas não há busca automática.' },
      { q: 'O Espelha Grupos tem reembolso?', a: 'Tem, publicado: valor integral em até 7 dias corridos depois do pagamento (direito de arrependimento, art. 49 do CDC), processado em até 5 dias úteis. Depois disso, o cancelamento evita a próxima cobrança.' },
      { q: 'O que evitar ao escolher um bot?', a: 'Evite promessa de comissão garantida, disparo sem consentimento, ausência de logs e ferramenta que não explica limites de uso.' },
    ],
  },
  /* Três páginas novas em 17/09/2026, a pedido da dona do produto ("quero ter
   * de todos os concorrentes"), com a regra de uma por semana explicitamente
   * cancelada por ela.
   *
   * Origem dos dados, e por que cada uma é diferente:
   *
   *  - Divulgador Inteligente e DivulgaLinks: prints das páginas de planos
   *    enviados por ela em 17/09/2026. Até aqui os dois tinham ficha em
   *    `competitors-data.js` com "Consultar fornecedor" e texto genérico de
   *    preenchimento — publicar naquele estado quebraria a regra de nunca citar
   *    preço sem fonte e data, e produziria exatamente a página fina que o
   *    Google recusa.
   *  - Lumi: print de 31/07/2026, que já estava na ficha desde então.
   *
   * ⚠️ Estes três NÃO vieram do Search Console — DivulgaLinks e Lumi apareceram
   * em citação de IA (Gemini e AI Overviews, 01/09). Não há evidência de que
   * alguém procure esses nomes no Google, então o critério de sucesso aqui é
   * SER CITADA pela IA, não clique orgânico. Lembre do teto medido: em
   * `fluxopromo` estamos em posição 3 com ZERO clique em 133 impressões.
   */
  '/alternativas/divulgador-inteligente': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Divulgador Inteligente',
    title: 'Alternativa ao Divulgador Inteligente: R$69 com robô',
    description: 'No Divulgador Inteligente a automação de grupos só começa no plano de R$189. No Espelha Grupos o robô publica sozinho a partir de R$69, com grupos ilimitados.',
    competitorSlugs: ['divulgador-inteligente'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'O Divulgador Inteligente tem três planos (R$ 67, R$ 137 e R$ 189 por mês), mas a automação de grupos no WhatsApp aparece desabilitada nos dois primeiros, com o aviso "Disponível a partir do plano Diamante". Quem quer o robô publicando sozinho paga R$ 189 — e o que vem incluído é 1 número conectado com 1 grupo monitorado. No Espelha Grupos, o robô publica sozinho no plano Pro de R$ 69 por 30 dias, sem limite de grupos.',
    directAnswer: 'O Divulgador Inteligente é uma plataforma larga para afiliados: gera promoções em até 121 lojas no plano mais caro, monta um site de promoções com domínio próprio e selo de verificado, cria página de link na bio, escreve descrição de produto com I.A e baixa vídeos de achadinhos do Pinterest. A automação de grupos no WhatsApp, porém, é um recurso à parte: os cartões dos planos Essencial (R$ 67/mês) e Ouro (R$ 137/mês) mostram essa linha desabilitada, com o aviso "Disponível a partir do plano Diamante". No Diamante, de R$ 189/mês, a "Automação Base" vem incluída no nível "Até 2 Grupos", que a própria página descreve como 1 número conectado e 1 grupo monitorado. O Espelha Grupos faz o caminho oposto: o robô que acompanha as origens e publica nos destinos é o produto inteiro, está no plano Pro de R$ 69 por 30 dias, não cobra por quantidade de grupos e tem 7 dias grátis com o Pro completo, sem cartão. Em contrapartida, o Divulgador Inteligente cobre muito mais lojas e entrega site próprio, link na bio e recursos de Pinterest e I.A que o Espelha Grupos não tem.',
    rows: [
      { key: 'automacao', label: 'A partir de quanto o robô publica sozinho', produto: 'R$ 69 por 30 dias (plano Pro).', concorrente: 'R$ 189/mês. Nos planos de R$ 67 e R$ 137 a linha "Automação de grupos no WhatsApp" aparece desabilitada, com o aviso "Disponível a partir do plano Diamante".', reading: 'É o corte que mais muda a conta: comparar o preço de entrada de R$ 67 com o nosso só faz sentido se você NÃO precisar de automação.' },
      { key: 'grupos', label: 'Quantos grupos o robô acompanha', produto: 'Sem limite de grupos de origem e de destino.', concorrente: 'A automação incluída no Diamante é o nível "Até 2 Grupos": 1 número conectado e 1 grupo monitorado. O seletor "Nível de automação" oferece níveis maiores, cujos preços não aparecem no material consultado.', reading: 'Se você acompanha mais de uma origem, vale perguntar a eles quanto custa subir o nível antes de fechar.' },
      { key: 'lojas', label: 'Lojas suportadas', produto: 'Seis: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress.', concorrente: '10 lojas no Essencial, 16 no Ouro e 121 no Diamante. Amazon só a partir do Ouro.', reading: 'Aqui eles ganham com folga. Se você divulga lojas fora das seis nossas, esse é um motivo real para escolher o Divulgador Inteligente.' },
      { key: 'alem', label: 'O que existe além do WhatsApp', produto: 'Grupos, Canais e Comunidades do WhatsApp. Não temos site de promoções nem página de link na bio.', concorrente: 'Site de promoções personalizado com selo de verificado e domínio próprio, página de link na bio, template de story, descrição de produto com I.A e download de vídeos do Pinterest.', reading: 'São produtos diferentes: eles montam a vitrine, nós cuidamos da publicação recorrente nos grupos.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: '7 dias de garantia e cancelamento a qualquer momento, em todos os planos.', reading: 'São coisas diferentes: garantia é devolução depois de pagar; teste grátis é usar antes de pagar.' },
    ],
    criteria: ['Se você precisa mesmo do robô publicando sozinho ou só de gerar o post', 'Quantas origens quer acompanhar ao mesmo tempo', 'Quantas lojas diferentes você divulga hoje', 'Se precisa de site de promoções e link na bio', 'Se prefere testar antes de pagar ou pagar com garantia de devolução'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['O robô publicando sozinho já no plano de R$ 69 por 30 dias', 'Sem limite de grupos de origem e de destino', 'Seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Conversão de links de produto e de cupom', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se o que você precisa é o robô acompanhando as origens e publicando nos seus grupos todo dia, sem pagar por quantidade de grupos.',
      'Escolha o Divulgador Inteligente se divulga lojas fora das seis que cobrimos, ou se o site de promoções com domínio próprio, o link na bio e os recursos de I.A e Pinterest são parte importante da sua operação.',
      'Se você só monta o post e publica você mesma, o Essencial deles de R$ 67 resolve — e aí a comparação com o nosso robô não se aplica.',
    ],
    notIdealFit: [
      'O Divulgador Inteligente não é ideal para quem quer automação sem gastar R$ 189/mês: os dois planos mais baratos mostram esse item desabilitado na própria página.',
      'O Espelha Grupos não é ideal para quem precisa de site de promoções com domínio próprio, página de link na bio ou publicação no Instagram — não fazemos nada disso.',
      'O Espelha Grupos trabalha somente com WhatsApp. Se sua operação depende de Telegram, será necessário usar outra solução para esse canal.',
    ],
    migrationPath: [
      'Liste os grupos de onde vêm as ofertas e os grupos, Canais ou Comunidades onde você quer publicá-las.',
      'Confira se as lojas que você divulga estão entre as seis que cobrimos — é o ponto onde o Divulgador Inteligente pode ser a escolha certa.',
      'Comece os 7 dias grátis e confira a conversão dos links, o formato das mensagens e o ritmo dos envios nos seus grupos reais.',
      'Rode as duas ferramentas em paralelo por alguns dias e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'O plano de R$ 67 do Divulgador Inteligente já automatiza meus grupos?', a: 'Não. O cartão do plano Essencial mostra a linha "Automação de grupos no WhatsApp" desabilitada, com o aviso "Disponível a partir do plano Diamante". O mesmo aparece no plano Ouro, de R$ 137/mês. A automação começa no Diamante, de R$ 189/mês.' },
      { q: 'Quantos grupos a automação do plano Diamante cobre?', a: 'A "Automação Base" que vem incluída é o nível "Até 2 Grupos", descrito na própria página como 1 número conectado e 1 grupo monitorado. Há um seletor com níveis maiores, mas o material que consultamos não informa o preço deles — vale perguntar antes de assinar.' },
      { q: 'Qual dos dois cobre mais lojas?', a: 'O Divulgador Inteligente, com folga: são 10 lojas no Essencial, 16 no Ouro e 121 no Diamante. O Espelha Grupos cobre seis: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress.' },
      { q: 'Dá para testar o Espelha Grupos antes de pagar?', a: 'Dá: 7 dias grátis com o plano Pro completo, sem cartão de crédito. O Divulgador Inteligente oferece 7 dias de garantia, que é diferente — você paga e pode pedir a devolução.' },
    ],
  },
  '/alternativas/divulgalinks': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · DivulgaLinks',
    title: 'Alternativa ao DivulgaLinks: preço por grupo, não nicho',
    description: 'No DivulgaLinks o preço sobe por quantidade de nichos, e cada nicho embute Instagram e Telegram. No Espelha Grupos são grupos ilimitados por R$ 69 em 30 dias.',
    competitorSlugs: ['divulga-links'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'O DivulgaLinks cobra por NICHO, não por grupo: R$ 69,90 para 1 nicho, R$ 129,90 para 5, R$ 169,90 para 10 e R$ 229,90 para 15. Cada nicho equivale a 1 Instagram, 1 grupo de Telegram e vários grupos de WhatsApp do mesmo assunto. Se você divulga um nicho só, subir de plano não aumenta grupo nenhum. O Espelha Grupos custa R$ 69 por 30 dias no plano Pro, não limita grupos e não cobra por canais que você talvez não use.',
    directAnswer: 'O DivulgaLinks organiza a operação por nicho e é forte em Instagram: cria as artes de story sozinho, posta e agenda stories e reels, responde comentários automaticamente e manda link no direct. Ele também publica em grupos de Telegram e de WhatsApp, gera listas de produtos por categoria ou palavra-chave e cobre AliExpress, Amazon, AWIN (algumas lojas), Shopee, Magazine Luiza, Mercado Livre e Natura. A própria página afirma que a única diferença entre os planos é quantos nichos você pode gerenciar. O Espelha Grupos resolve outra parte do trabalho: ele acompanha os grupos de origem que você escolhe, troca o link pelo seu código de afiliada e publica nos seus grupos, Canais e Comunidades do WhatsApp, com controle de ritmo e histórico de tudo que saiu. Se a sua divulgação é toda no WhatsApp e você não usa Instagram nem Telegram, boa parte do que está no preço do DivulgaLinks não vai ser usada.',
    rows: [
      { key: 'cobranca', label: 'Pelo que você paga', produto: 'Pelo plano, não pela quantidade de grupos: R$ 69 por 30 dias no Pro, com grupos ilimitados.', concorrente: 'Pela quantidade de NICHOS: R$ 69,90 (1), R$ 129,90 (5), R$ 169,90 (10) e R$ 229,90 (15). A página afirma que essa é a única diferença entre os planos.', reading: 'Quem tem um nicho só e muitos grupos não ganha nada subindo de plano no DivulgaLinks.' },
      { key: 'canais', label: 'Onde publica', produto: 'Grupos, Canais e Comunidades do WhatsApp. Não publicamos em Instagram nem em Telegram.', concorrente: 'Instagram, Telegram e WhatsApp. Cada nicho embute 1 Instagram e 1 grupo de Telegram.', reading: 'Eles cobrem mais canais; nós cobrimos mais fundo o WhatsApp. Se você não usa Instagram nem Telegram, está pagando por eles do mesmo jeito.' },
      { key: 'origem', label: 'De onde vem a oferta', produto: 'De grupos de origem que você escolhe: o robô acompanha o que é publicado lá e espelha nos seus destinos.', concorrente: 'Do link do produto que você insere, e de listas geradas por categoria ou palavra-chave. O material consultado não menciona monitorar um grupo de origem.', reading: 'São formas diferentes de achar oferta. Confirme com eles se o monitoramento de grupo existe, caso seja o que você precisa.' },
      { key: 'instagram', label: 'Instagram', produto: 'Não temos automação de Instagram.', concorrente: 'Artes de story criadas automaticamente, postagem e agendamento de stories e reels, resposta automática a comentários e link enviado no direct.', reading: 'É a maior força deles e nenhum outro concorrente mapeado tem isso. Se o Instagram é o seu canal principal, pesa a favor do DivulgaLinks.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'Plano Starter com 7 dias grátis, descrito como "igual ao PRIME (com limitações)". O preço do Starter não aparece na página consultada.', reading: 'Os dois deixam testar. Vale perguntar a eles quais são as limitações do Starter e quanto ele custa depois.' },
    ],
    criteria: ['Quantos nichos diferentes você divulga, não quantos grupos', 'Se você usa Instagram e Telegram ou só WhatsApp', 'Se as ofertas vêm de grupos que você acompanha ou de links que você mesma escolhe', 'Quantas lojas diferentes você divulga hoje', 'Se o preço aumenta quando a operação cresce'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'A página de planos consultada é de 01/01/2025 — confirme os valores na fonte oficial antes de decidir.'],
    botinhoDifferentials: ['Grupos ilimitados, sem cobrar por nicho nem por quantidade', 'Espelhamento: o robô acompanha as origens que você escolhe e publica sozinho', 'Seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Conversão de links de produto e de cupom', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se toda a sua divulgação é no WhatsApp, se as ofertas vêm de grupos que você já acompanha e se você não quer que o preço suba conforme a operação cresce.',
      'Escolha o DivulgaLinks se o Instagram é parte central do seu trabalho, ou se você organiza a operação em vários nichos separados com Telegram junto.',
      'Se você tem exatamente um nicho e publica em Instagram, Telegram e WhatsApp, o Prime deles de R$ 69,90 fica no mesmo patamar do nosso Pro — aí a decisão é por qual trabalho você precisa que seja feito.',
    ],
    notIdealFit: [
      'O DivulgaLinks não é ideal para quem tem um nicho só e muitos grupos: os planos mais caros só aumentam a quantidade de nichos.',
      'O DivulgaLinks não é ideal para quem não usa Instagram nem Telegram, já que cada nicho embute os dois no preço.',
      'O Espelha Grupos não é ideal para quem precisa publicar no Instagram ou no Telegram — não fazemos nenhum dos dois.',
    ],
    migrationPath: [
      'Conte quantos NICHOS diferentes você divulga e quantos grupos existem em cada um: é isso que muda o preço de cada lado.',
      'Separe o que você realmente publica no Instagram e no Telegram do que publica no WhatsApp.',
      'Liste os grupos de onde vêm as ofertas e os destinos onde quer publicá-las.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'O DivulgaLinks cobra por grupo?', a: 'Não: ele cobra por nicho. A própria página de planos afirma que a única diferença entre Prime, Premium, Pro e Ultimate é quantos nichos você pode gerenciar. Cada nicho equivale a 1 Instagram, 1 grupo de Telegram e vários grupos de WhatsApp do mesmo assunto.' },
      { q: 'Se eu tenho um nicho só, vale subir de plano no DivulgaLinks?', a: 'Pelo que a página informa, não: os planos mais caros aumentam a quantidade de nichos, não a de grupos. Nesse caso o Prime, de R$ 69,90, já é o teto útil da ferramenta.' },
      { q: 'O DivulgaLinks espelha um grupo que eu acompanho?', a: 'O material que consultamos descreve criar o post a partir do link do produto e gerar listas por categoria ou palavra-chave, e não menciona monitorar um grupo de origem. Se isso é o que você precisa, confirme diretamente com eles antes de assinar.' },
      { q: 'O Espelha Grupos publica no Instagram?', a: 'Não. Trabalhamos com grupos, Canais e Comunidades do WhatsApp. Automação de Instagram é a maior força do DivulgaLinks e, se esse for o seu canal principal, pesa a favor deles.' },
    ],
  },
  '/alternativas/lumi-ofertas-inteligentes': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Lumi Ofertas Inteligentes',
    title: 'Alternativa à Lumi: R$69 contra R$97 de entrada',
    description: 'O plano de entrada da Lumi custa R$97/mês e limita 20 grupos. No Espelha Grupos são grupos ilimitados por R$69 em 30 dias, com 7 dias grátis e sem cartão.',
    competitorSlugs: ['lumi-ofertas-inteligentes'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'A Lumi Ofertas Inteligentes tem três planos: R$ 97, R$ 187 e R$ 247 por mês. O de entrada já inclui espelhamento, mas limita a 1 número de WhatsApp, 20 grupos e 1 monitoramento, e a página de preços consultada não indica teste grátis. O Espelha Grupos custa R$ 69 por 30 dias no plano Pro, não limita grupos e libera o Pro completo por 7 dias sem cartão.',
    directAnswer: 'A Lumi Ofertas Inteligentes é uma das poucas ferramentas do mercado que já traz espelhamento de grupos e múltiplos números de WhatsApp no plano de entrada, e cobre Telegram além do WhatsApp. Em compensação, esse plano de entrada é o mais caro entre os concorrentes que mapeamos: R$ 97/mês para 1 número, 20 grupos, 3 filas de ofertas, 1 monitoramento e 1 espelhamento, com Shopee, Mercado Livre e Amazon. O Magalu entra a partir do plano Pro, de R$ 187/mês. O Espelha Grupos cobre seis lojas em qualquer plano pago, não limita grupos, custa R$ 69 por 30 dias no Pro e deixa testar o Pro completo por 7 dias sem cartão de crédito. Se a sua operação depende de Telegram ou de vários números de WhatsApp ao mesmo tempo, a Lumi resolve algo que nós não fazemos.',
    rows: [
      { key: 'preco', label: 'Preço de entrada', produto: 'R$ 39 por 30 dias no Basic; R$ 69 no Pro, que é o plano com o robô no piloto automático.', concorrente: 'R$ 97/mês no plano de entrada.', reading: 'O plano de entrada da Lumi é o mais caro entre os concorrentes que mapeamos.' },
      { key: 'grupos', label: 'Limite de grupos', produto: 'Sem limite de grupos.', concorrente: '20 grupos no plano de R$ 97. Grupos ilimitados só no plano de R$ 247/mês.', reading: 'Na Lumi, crescer em quantidade de grupos custa mudança de plano; aqui não.' },
      { key: 'lojas', label: 'Lojas suportadas', produto: 'Seis em qualquer plano pago: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress.', concorrente: 'Shopee, Mercado Livre e Amazon no plano de entrada. Magalu só a partir do Pro, de R$ 187/mês.', reading: 'Quem divulga Magalu precisa do segundo plano da Lumi; aqui ele já vem no Basic de R$ 39.' },
      { key: 'telegram', label: 'Telegram e múltiplos números', produto: 'Somente WhatsApp, com um número por conta.', concorrente: 'Telegram a partir do Pro e até 6 números de WhatsApp no plano mais caro.', reading: 'É a força real da Lumi. Se sua operação depende de Telegram ou de vários chips ao mesmo tempo, nós não substituímos.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'A página de preços consultada não indica teste grátis nem período de avaliação.', reading: 'Sem teste, a primeira validação da Lumi acontece depois de pagar R$ 97.' },
    ],
    criteria: ['Quantos grupos você administra e pretende adicionar', 'Se precisa publicar no Telegram além do WhatsApp', 'Se precisa de mais de um número de WhatsApp ao mesmo tempo', 'Quantas lojas diferentes você divulga hoje', 'Se quer testar a ferramenta completa antes de pagar'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['R$ 69 por 30 dias no plano com piloto automático, contra R$ 97 de entrada', 'Grupos ilimitados em qualquer plano pago', 'Seis lojas em qualquer plano pago, Magalu incluído', 'Espelhamento de grupos, filas de ofertas e garimpo automático da Shopee', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se toda a operação é no WhatsApp, se você quer grupos ilimitados desde o primeiro plano e se prefere testar antes de pagar.',
      'Escolha a Lumi se você precisa publicar no Telegram ou operar vários números de WhatsApp ao mesmo tempo — nesses dois pontos nós não substituímos.',
      'Se você divulga Magalu, compare com atenção: aqui ele está no plano de R$ 39; na Lumi, a partir do de R$ 187.',
    ],
    notIdealFit: [
      'A Lumi não é ideal para quem quer começar barato: o plano de entrada, de R$ 97/mês, é o mais caro entre os concorrentes mapeados, e a página consultada não indica teste grátis.',
      'A Lumi não é ideal para quem tem muitos grupos desde o começo: são 20 no plano de entrada, e grupos ilimitados só no de R$ 247/mês.',
      'O Espelha Grupos trabalha somente com WhatsApp e com um número por conta. Se sua operação depende de Telegram ou de vários chips, será necessário usar outra solução.',
    ],
    migrationPath: [
      'Conte quantos grupos você tem hoje e quantos pretende ter em três meses — é o número que muda de plano na Lumi.',
      'Separe o que você publica no Telegram do que publica no WhatsApp.',
      'Confira se as lojas que você divulga estão entre as seis que cobrimos, com atenção especial ao Magalu.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'Qual é mais barato: Espelha Grupos ou Lumi Ofertas Inteligentes?', a: 'O Espelha Grupos. O plano com piloto automático custa R$ 69 por 30 dias e o Basic custa R$ 39; o plano de entrada da Lumi custa R$ 97/mês. Além do preço, o Espelha Grupos não limita a quantidade de grupos.' },
      { q: 'A Lumi tem teste grátis?', a: 'A página de preços que consultamos, verificada em 31/07/2026, não indica teste grátis nem período de avaliação. O Espelha Grupos libera o plano Pro completo por 7 dias, sem cartão de crédito.' },
      { q: 'Em que a Lumi é melhor que o Espelha Grupos?', a: 'Em dois pontos concretos: ela publica também no Telegram e permite operar vários números de WhatsApp ao mesmo tempo — até 6 no plano mais caro. O Espelha Grupos trabalha só com WhatsApp e com um número por conta.' },
      { q: 'Preciso de qual plano da Lumi para divulgar Magalu?', a: 'Pelo material consultado, o Magalu entra a partir do plano Pro, de R$ 187/mês. No Espelha Grupos o Magalu já está incluído no plano Basic, de R$ 39 por 30 dias.' },
    ],
  },
  /* Segunda leva de 17/09/2026: Busqy, Afilira e IA Divulgadora.
   *
   * `busqy` tinha ficha de casca ("Consultar fornecedor"); `afilira` e
   * `ia-divulgadora` não existiam em `competitors-data.js`. Os três ganharam
   * dado real: print da página de planos da IA Divulgadora e transcrição das
   * páginas de planos do Busqy e do Afilira, enviadas pela dona do produto.
   *
   * O eixo de cada um é diferente, e é isso que evita três páginas iguais:
   *   Busqy          -> I.A por CRÉDITO, que acaba e é recomprado.
   *   Afilira        -> menor entrada do mercado, mas 1 origem e 1 destino.
   *   IA Divulgadora -> preço por QUANTIDADE DE GRUPOS de envio.
   *
   * ⚠️ NÃO escrever VALOR em comentário entre duas entradas — nem como
   * exemplo, nem para explicar esta própria regra. A guarda FR-031 fatia o
   * bloco de cada página até a próxima chave, então um comentário aqui conta
   * como parte da entrada ANTERIOR, e um valor citado nele é lido como preço
   * sem fonte daquela outra página. Aconteceu duas vezes ao escrever este
   * bloco: primeiro com o preço do Afilira citado aqui, depois com o mesmo
   * preço repetido dentro do aviso que tentava explicar o problema. Valor mora
   * em `competitors-data.js` e nos campos da própria página, em nenhum
   * comentário.
   */
  '/alternativas/busqy': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Busqy',
    title: 'Alternativa ao Busqy: sem crédito de I.A para gastar',
    description: 'No Busqy a entrada custa R$99 com 5 grupos, e a I.A é cobrada em créditos que acabam. No Espelha Grupos são grupos ilimitados por R$69 em 30 dias.',
    competitorSlugs: ['busqy'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'O Busqy tem três planos: R$ 99, R$ 199 e R$ 399 por mês. O de entrada cobre 5 grupos de WhatsApp, e grupos ilimitados só aparecem no de R$ 399. Os recursos de I.A são cobrados em créditos (1.000, 3.000 ou 10.000 por plano) e, quando acabam, é preciso comprar um pacote extra de R$ 99/mês. O Espelha Grupos custa R$ 69 por 30 dias no plano Pro, não limita grupos e não tem crédito para acabar.',
    directAnswer: 'O Busqy gera texto e imagem com I.A dentro da própria ferramenta, monta um site de promoções com domínio próprio, tem bot no Telegram, extensão do Chrome, filas e roteadores de envio, e chega a 5 números de WhatsApp no plano mais caro. Os planos são R$ 99/mês (1 número, 5 grupos de WhatsApp, 1 monitoramento de até 3 grupos, 1.000 créditos de I.A), R$ 199/mês (2 números, 20 grupos, 3.000 créditos) e R$ 399/mês (5 números, grupos ilimitados, 10.000 créditos). O Espelha Grupos resolve a parte da publicação recorrente: acompanha as origens que você escolhe, troca o link pelo seu código de afiliada e publica nos seus grupos, Canais e Comunidades do WhatsApp, com controle de ritmo e histórico. Custa R$ 69 por 30 dias no Pro, não cobra por quantidade de grupos e não tem crédito de consumo. Em troca, não geramos imagem por I.A, não montamos site de promoções e não publicamos no Telegram.',
    rows: [
      { key: 'preco', label: 'Preço de entrada', produto: 'R$ 39 por 30 dias no Basic; R$ 69 no Pro, que é o plano com o robô no piloto automático.', concorrente: 'R$ 99/mês.', reading: 'O plano de entrada do Busqy custa mais que o nosso plano mais completo.' },
      { key: 'grupos', label: 'Limite de grupos', produto: 'Sem limite de grupos em qualquer plano pago.', concorrente: '5 grupos no plano de R$ 99, 20 no de R$ 199 e ilimitados só no de R$ 399.', reading: 'No Busqy, crescer em quantidade de grupos é trocar de plano. Aqui não é.' },
      { key: 'credito', label: 'Custo variável', produto: 'Nenhum: o preço do plano é o que você paga.', concorrente: 'Os recursos de I.A consomem créditos (1.000, 3.000 ou 10.000 por plano). Pacote extra de créditos e grupos custa R$ 99/mês cada.', reading: 'É a conta que não aparece no preço anunciado. Vale estimar o seu consumo antes de comparar.' },
      { key: 'ia', label: 'Geração por I.A', produto: 'Não geramos texto nem imagem por I.A. A mensagem é montada a partir de modelo que você escreve.', concorrente: 'Geração de textos e de imagens por I.A dentro da ferramenta.', reading: 'Aqui o Busqy ganha. Se você quer a arte e o texto prontos pela ferramenta, é um motivo real para escolher o Busqy.' },
      { key: 'alem', label: 'O que existe além do WhatsApp', produto: 'Grupos, Canais e Comunidades do WhatsApp. Sem Telegram e sem site de promoções.', concorrente: 'Bot no Telegram, site de promoções com domínio próprio (domínio não incluso), extensão do Chrome e templates personalizados.', reading: 'São produtos de escopo diferente: eles cobrem mais canais, nós cobrimos mais fundo o WhatsApp.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'A página de planos consultada não indica teste grátis.', reading: 'Sem teste, a primeira validação acontece depois de pagar R$ 99.' },
    ],
    criteria: ['Quantos grupos você administra e pretende adicionar', 'Se você precisa de texto e imagem gerados por I.A', 'Se aceita um custo que varia com o consumo de créditos', 'Se precisa publicar no Telegram ou ter site de promoções', 'Se quer testar a ferramenta completa antes de pagar'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['R$ 69 por 30 dias no plano com piloto automático, contra R$ 99 de entrada', 'Grupos ilimitados em qualquer plano pago', 'Nenhum crédito de consumo: o preço do plano é o que você paga', 'Seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Espelhamento de grupos, filas de ofertas e garimpo automático da Shopee', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se quer preço fixo, grupos ilimitados desde o primeiro plano pago e nenhum crédito para controlar.',
      'Escolha o Busqy se a geração de texto e de imagem por I.A dentro da ferramenta é parte central do seu trabalho, ou se você precisa de site de promoções e Telegram.',
      'Se você opera com vários números de WhatsApp ao mesmo tempo, o Busqy chega a 5 e nós trabalhamos com um por conta.',
    ],
    notIdealFit: [
      'O Busqy não é ideal para quem tem muitos grupos e orçamento curto: são 5 grupos no plano de R$ 99 e grupos ilimitados só no de R$ 399.',
      'O Busqy não é ideal para quem precisa de custo previsível, porque os recursos de I.A consomem créditos que se esgotam.',
      'O Espelha Grupos não é ideal para quem quer a arte da oferta gerada por I.A, site de promoções próprio ou publicação no Telegram.',
    ],
    migrationPath: [
      'Conte quantos grupos você tem hoje e quantos pretende ter em três meses — é o número que muda de plano no Busqy.',
      'Estime quanto de I.A você usaria por mês: é o que decide se o custo fica no preço do plano ou vira pacote extra.',
      'Liste os grupos de onde vêm as ofertas e os destinos onde quer publicá-las.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'Qual é mais barato: Espelha Grupos ou Busqy?', a: 'O Espelha Grupos. O plano com piloto automático custa R$ 69 por 30 dias e o Basic custa R$ 39; o plano de entrada do Busqy custa R$ 99/mês. Além do preço, o Espelha Grupos não limita a quantidade de grupos.' },
      { q: 'O que são os créditos de I.A do Busqy?', a: 'Cada plano vem com uma quantidade de créditos para os recursos de I.A: 1.000 no Top Afiliado, 3.000 no Elite + e 10.000 no Ultimate. Quando acabam, o material indica pacotes extras de R$ 99/mês. É um custo que varia com o uso e não aparece no preço anunciado do plano.' },
      { q: 'Quantos grupos o plano de R$ 99 do Busqy cobre?', a: 'Cinco grupos no WhatsApp e cinco no Telegram, com um monitoramento de até 3 grupos. Grupos ilimitados no WhatsApp aparecem só no plano Ultimate, de R$ 399/mês.' },
      { q: 'Em que o Busqy é melhor que o Espelha Grupos?', a: 'Ele gera texto e imagem por I.A dentro da ferramenta, monta site de promoções com domínio próprio, tem bot no Telegram e chega a 5 números de WhatsApp. Nós não fazemos nenhuma dessas quatro coisas.' },
    ],
  },
  '/alternativas/afilira': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Afilira',
    title: 'Alternativa ao Afilira: R$47 cobre 1 grupo só',
    description: 'O plano de R$47 do Afilira busca em 1 grupo e envia para 1 grupo. No Espelha Grupos são grupos ilimitados por R$39 em 30 dias, com 7 dias grátis e sem cartão.',
    competitorSlugs: ['afilira'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'O Afilira tem o menor preço de entrada entre as ferramentas que mapeamos: R$ 47/mês. Esse plano, porém, busca ofertas em 1 grupo e envia para 1 grupo. Busca em até 50 grupos, envio para quantos quiser e o envio de um grupo específico para outro aparecem a partir do Professional, de R$ 97/mês. O Espelha Grupos custa R$ 39 por 30 dias no Basic e já espelha para quantos grupos você quiser, sem limite.',
    directAnswer: 'O Afilira faz algo que o Espelha Grupos não faz: ele BUSCA a oferta sozinho, em grupos e nas lojas, e ainda distribui ofertas compartilhadas pela comunidade de usuários. Também publica no Telegram, chega a 10 números de WhatsApp no Enterprise, publica no Status, manda boas-vindas e saída no privado e, a partir do Professional, cobre Awin (Casas Bahia, KaBuM!, Centauro, Dafiti), Terabyte Shop e SHEIN. O ponto de atenção é o que o plano de R$ 47 realmente cobre: 1 grupo de origem e 1 de destino. O Espelha Grupos cobra R$ 39 por 30 dias no Basic, com espelhamento de quantas origens e destinos você quiser, seis lojas em qualquer plano pago e 7 dias grátis com o Pro completo, sem cartão.',
    rows: [
      { key: 'preco', label: 'Preço de entrada', produto: 'R$ 39 por 30 dias, com grupos ilimitados.', concorrente: 'R$ 47/mês, com busca em 1 grupo e envio para 1 grupo.', reading: 'Os dois preços são parecidos; o que cada um entrega por ele não é.' },
      { key: 'grupos', label: 'Quantos grupos no plano de entrada', produto: 'Sem limite de origens e destinos.', concorrente: '1 grupo de origem e 1 de destino. Busca em até 50 grupos e envio ilimitado a partir do Professional, de R$ 97/mês.', reading: 'É o corte que muda a conta: se você acompanha mais de um grupo, o valor a comparar é R$ 97.' },
      { key: 'espelhamento', label: 'Espelhar um grupo em outro', produto: 'É o produto inteiro, em qualquer plano pago.', concorrente: '"Envio de um grupo específico para outro" aparece a partir do Professional, de R$ 97/mês.', reading: 'Quem quer exatamente espelhamento não tem esse recurso no plano de R$ 47.' },
      { key: 'garimpo', label: 'Quem acha a oferta', produto: 'Acompanhamos as origens que você escolhe; no Pro há garimpo automático da Shopee por palavra-chave e filtros.', concorrente: 'Busca ofertas automaticamente em grupos e nas lojas, com escolha automática das melhores e ofertas compartilhadas pela comunidade.', reading: 'Aqui o Afilira ganha em amplitude: nosso garimpo automático é só da Shopee.' },
      { key: 'lojas', label: 'Lojas suportadas', produto: 'Seis em qualquer plano pago: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress.', concorrente: 'Shopee, Amazon, Mercado Livre e Magalu no Starter. Awin, Terabyte e SHEIN só a partir do Professional.', reading: 'Quem divulga SHEIN precisa do plano de R$ 97 no Afilira; aqui ela já está no Basic de R$ 39.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'A página de planos consultada não indica teste grátis.', reading: 'Sem teste, a primeira validação acontece depois de pagar.' },
    ],
    criteria: ['Quantos grupos você acompanha e para quantos publica', 'Se quer que a ferramenta ACHE a oferta ou espelhe as origens que você já escolheu', 'Quantas lojas diferentes você divulga hoje, com atenção à SHEIN', 'Se precisa publicar no Telegram', 'Se quer testar a ferramenta completa antes de pagar'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Grupos ilimitados já no plano de R$ 39 por 30 dias', 'Espelhamento de grupos em qualquer plano pago, não só no plano do meio', 'Seis lojas em qualquer plano pago, SHEIN e AliExpress incluídas', 'Conversão de links de produto e de cupom', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se você já sabe de quais grupos quer copiar as ofertas e para quais quer publicar, e não quer limite de quantidade.',
      'Escolha o Afilira se o que falta na sua operação é ACHAR oferta: ele busca sozinho em grupos e lojas e traz ofertas da comunidade de usuários.',
      'Escolha o Afilira se você precisa de Awin, Terabyte Shop ou Telegram — lembrando que os três estão a partir do plano de R$ 97/mês.',
    ],
    notIdealFit: [
      'O Afilira não é ideal para quem quer o preço de entrada de R$ 47 com mais de um grupo: esse plano cobre 1 origem e 1 destino.',
      'O Afilira não é ideal para quem quer espelhar grupo em grupo gastando o mínimo, porque esse recurso começa no plano de R$ 97/mês.',
      'O Espelha Grupos não é ideal para quem quer que a ferramenta ache a oferta em várias lojas sozinha — nosso garimpo automático cobre só a Shopee.',
      'O Espelha Grupos trabalha somente com WhatsApp e com um número por conta.',
    ],
    migrationPath: [
      'Conte quantos grupos você acompanha e para quantos publica: é o que separa o plano de R$ 47 do de R$ 97 no Afilira.',
      'Decida se você precisa que a ferramenta ache a oferta ou se as origens que você já acompanha bastam.',
      'Confira se as lojas que você divulga estão entre as seis que cobrimos, com atenção à SHEIN.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'O plano de R$ 47 do Afilira serve para quem tem vários grupos?', a: 'Pelo material consultado, não: ele busca ofertas em apenas 1 grupo e envia para apenas 1 grupo. Busca em até 50 grupos e envio para quantos você quiser começam no Professional, de R$ 97/mês.' },
      { q: 'O Afilira espelha um grupo em outro?', a: 'Sim, mas a partir do Professional, de R$ 97/mês — o material lista "envio de um grupo específico para outro" nesse plano. No Espelha Grupos o espelhamento está em qualquer plano pago, a partir de R$ 39 por 30 dias.' },
      { q: 'Em que o Afilira é melhor que o Espelha Grupos?', a: 'Ele acha a oferta sozinho, em grupos e nas lojas, e traz ofertas compartilhadas pela comunidade de usuários. Também publica no Telegram e chega a 10 números de WhatsApp. Nosso garimpo automático cobre só a Shopee e trabalhamos com um número por conta.' },
      { q: 'Preciso de qual plano do Afilira para divulgar SHEIN?', a: 'Pelo material consultado, a SHEIN entra a partir do Professional, de R$ 97/mês, junto com a Awin e a Terabyte Shop. No Espelha Grupos a SHEIN já está no plano Basic, de R$ 39 por 30 dias.' },
    ],
  },
  '/alternativas/ia-divulgadora': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · IA Divulgadora',
    title: 'Alternativa à IA Divulgadora: grupos sem trocar plano',
    description: 'Na IA Divulgadora o disparo vai de 3 a 25 grupos e o plano muda conforme a quantidade. No Espelha Grupos são grupos ilimitados por R$69 em 30 dias.',
    competitorSlugs: ['ia-divulgadora'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'Na IA Divulgadora o preço acompanha a quantidade de grupos de envio: 3 grupos no Afiliado Pro (R$ 99/mês), 10 no Creators (R$ 179,90) e 25 no Empresarial (a partir de R$ 300). O plano de entrada, de R$ 69,90, não lista disparo automático para grupos — a própria página só promete "Automatize seus grupos" a partir do Pro. No Espelha Grupos o robô publica em quantos grupos você quiser, por R$ 69 em 30 dias, e cada número a mais não é cobrado à parte.',
    directAnswer: 'A IA Divulgadora é a única entre as ferramentas que mapeamos com uma faixa empresarial explícita: um seletor de grupos de envio que vai de 25 a 300, com infraestrutura dedicada e consultoria de setup, a partir de R$ 300/mês. Ela também tem Modo Clone + Link Preview, gestão de leads, SubID por marketplace, vitrine personalizada e Instagram respondendo comentários, stories e reels. O ponto de atenção é o modelo de cobrança: o disparo é limitado por quantidade de grupos (3 no Pro de R$ 99, 10 no Creators de R$ 179,90, 25 no Empresarial), cada conexão extra de WhatsApp custa R$ 29,90/mês e o plano de entrada de R$ 69,90 não lista disparo automático para grupos. O Espelha Grupos cobra R$ 69 por 30 dias no Pro, não limita grupos e não cobra conexão extra. Em troca, não temos vitrine, não respondemos comentários no Instagram nem oferecemos infraestrutura dedicada.',
    rows: [
      { key: 'automacao', label: 'A partir de quanto o robô dispara para grupos', produto: 'R$ 69 por 30 dias (plano Pro), sem limite de grupos.', concorrente: 'R$ 99/mês (Afiliado Pro), com disparo para 3 grupos. O plano de R$ 69,90 não lista disparo automático para grupos e a página descreve o Pro como "Automatize seus grupos".', reading: 'Comparar o preço de entrada de R$ 69,90 com o nosso só faz sentido se você não precisar do disparo automático.' },
      { key: 'grupos', label: 'Como o preço reage quando você cresce', produto: 'Não reage: grupos ilimitados em qualquer plano pago.', concorrente: '3 grupos (R$ 99), 10 (R$ 179,90), 25 (a partir de R$ 300), com seletor até 300 grupos cujos preços não aparecem na página.', reading: 'Na IA Divulgadora, cada degrau de grupos é um degrau de preço. Aqui adicionar grupo não muda a fatura.' },
      { key: 'conexao', label: 'Custo por número de WhatsApp', produto: 'Um número por conta, sem cobrança extra.', concorrente: 'Conexão extra por R$ 29,90/mês. O Empresarial já vem com 2 números.', reading: 'Se você opera com vários chips, a IA Divulgadora atende — somando R$ 29,90 por conexão.' },
      { key: 'instagram', label: 'Instagram e vitrine', produto: 'Não temos vitrine nem automação de Instagram.', concorrente: 'Vitrine personalizada, imagens para Instagram e Instagram respondendo comentários, stories e reels.', reading: 'Aqui eles ganham. Se o Instagram é parte central do seu trabalho, pesa a favor da IA Divulgadora.' },
      { key: 'empresa', label: 'Operação de alto volume', produto: 'Não oferecemos infraestrutura dedicada nem consultoria de setup.', concorrente: 'Faixa empresarial com infraestrutura dedicada, consultoria de setup e até 300 grupos de envio.', reading: 'É a única do grupo mapeado com essa faixa. Para operação muito grande, é uma vantagem real.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'O plano de entrada tem botão "Começar grátis". A página não detalha o que o gratuito inclui nem por quanto tempo.', reading: 'Vale confirmar com eles se o gratuito cobre o disparo para grupos — pela lista do plano, não parece cobrir.' },
    ],
    criteria: ['Em quantos grupos você publica hoje e em quantos pretende publicar', 'Quantos números de WhatsApp você usa ao mesmo tempo', 'Se você precisa de vitrine e de automação de Instagram', 'Se a sua operação tem volume que justifique infraestrutura dedicada', 'Se prefere preço fixo ou preço por faixa de grupos'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Grupos ilimitados: adicionar grupo não muda a fatura', 'R$ 69 por 30 dias no plano com piloto automático', 'Sem cobrança por conexão extra de WhatsApp', 'Seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Espelhamento de grupos, filas de ofertas e garimpo automático da Shopee', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se você publica em vários grupos e não quer que o preço suba a cada degrau de quantidade.',
      'Escolha a IA Divulgadora se a sua operação é de alto volume e você precisa de infraestrutura dedicada, consultoria de setup ou mais de 25 grupos de envio.',
      'Escolha a IA Divulgadora se vitrine personalizada e Instagram respondendo comentários, stories e reels fazem parte do que você precisa entregar.',
    ],
    notIdealFit: [
      'A IA Divulgadora não é ideal para quem tem muitos grupos e quer preço previsível: o disparo é limitado por faixa de quantidade e o preço acima de 25 grupos não é publicado.',
      'O plano de R$ 69,90 da IA Divulgadora não é ideal para quem quer o robô publicando sozinho: essa lista não inclui disparo automático para grupos.',
      'O Espelha Grupos não é ideal para quem precisa de vitrine, automação de Instagram ou infraestrutura dedicada.',
      'O Espelha Grupos trabalha somente com WhatsApp e com um número por conta.',
    ],
    migrationPath: [
      'Conte em quantos grupos você publica hoje: é esse número, e não o de ofertas, que define o plano na IA Divulgadora.',
      'Some as conexões extras de R$ 29,90 se você usa mais de um número de WhatsApp.',
      'Separe o que você precisa no Instagram do que precisa no WhatsApp — os dois produtos não cobrem a mesma coisa.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'O plano de R$ 69,90 da IA Divulgadora automatiza meus grupos?', a: 'Pela página consultada, não: a lista do Afiliado Iniciante traz gerador de ofertas, links automáticos, imagens para Instagram, vitrine e "promoções no WhatsApp", sem disparo automático para grupos. O disparo aparece no Afiliado Pro, de R$ 99/mês, que a própria página apresenta como "Automatize seus grupos".' },
      { q: 'Quantos grupos cada plano da IA Divulgadora cobre?', a: 'Disparo para 3 grupos no Afiliado Pro (R$ 99/mês), 10 no Creators (R$ 179,90) e 25 no Empresarial (a partir de R$ 300). Há um seletor com faixas de 25 a 300 grupos, mas o preço de cada faixa acima do valor inicial não aparece na página.' },
      { q: 'A IA Divulgadora cobra por número de WhatsApp?', a: 'Sim: a página lista conexão extra por R$ 29,90/mês nos planos Creators e Empresarial, e o Empresarial já inclui 2 números. No Espelha Grupos é um número por conta, sem cobrança adicional.' },
      { q: 'Em que a IA Divulgadora é melhor que o Espelha Grupos?', a: 'Em três coisas concretas: faixa empresarial com infraestrutura dedicada e consultoria de setup, vitrine personalizada e Instagram respondendo comentários, stories e reels. Não fazemos nenhuma das três.' },
    ],
  },
  /* Terceira leva de 17/09/2026: Divulga Ninja, Shark, Afiliado Inteligente e
   * Afilimais. Mesma regra de sempre — nenhum valor em comentário.
   *
   * ⚠️ DOIS nomes parecidos, produtos diferentes, empresas diferentes:
   * `afiliado-inteligente` (afiliadointeligente.com.br, planos Stander/Pro/
   * Advanced/Enterprise) NÃO é `divulgador-inteligente` (planos Essencial/
   * Ouro/Diamante). Confundir os dois publicaria preço de um na página do
   * outro.
   *
   * ⚠️ O material da Shark é uma TABELA COMPARATIVA do próprio site dela, e
   * essa tabela cita preço de terceiros (IA Divulgadora e Afilira) que NÃO bate
   * com as páginas oficiais desses dois, das quais temos print direto. Daqui só
   * entra o preço e o autoclaim da própria Shark: tabela de marketing de
   * concorrente não é fonte oficial sobre outra empresa.
   */
  '/alternativas/divulga-ninja': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Divulga Ninja',
    title: 'Alternativa ao Divulga Ninja: grupo não muda o preço',
    description: 'No Divulga Ninja o plano é por quantidade de grupos ativos, de 1 a 10. No Espelha Grupos são grupos ilimitados por R$69 em 30 dias, com 7 dias grátis.',
    competitorSlugs: ['divulga-ninja'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'No Divulga Ninja o plano é definido pela quantidade de grupos ativos: 1, 3, 5 ou 10, de R$ 49,90 a R$ 149,90 por mês. O monitor de grupos — acompanhar um grupo e publicar o que sai nele — aparece só no plano Master, de R$ 149,90. No Espelha Grupos o espelhamento é o produto inteiro, está em qualquer plano pago a partir de R$ 39 por 30 dias, e a quantidade de grupos não muda a fatura.',
    directAnswer: 'O Divulga Ninja monta o anúncio completo a partir do produto (descrição, preço, imagem e link), gera arte pronta para o Instagram e para o Status do WhatsApp e programa os posts — com a I.A escolhendo o horário de maior chance de compra. A partir do plano Pro ele busca promoções sozinho, e no Master busca por termos específicos como "perfume" ou "tênis". O que muda o preço é a quantidade de grupos ativos: 1 no Start (R$ 49,90), 3 no Plus (R$ 69,90), 5 no Pro (R$ 89,90) e 10 no Master (R$ 149,90), sendo cada grupo de WhatsApp ou de Telegram à escolha. O Espelha Grupos custa R$ 39 por 30 dias no Basic e R$ 69 no Pro, não limita grupos, e o espelhamento de origem para destino está em qualquer plano pago. Em troca, não geramos arte para Instagram nem publicamos no Status, e nosso garimpo automático cobre só a Shopee.',
    rows: [
      { key: 'grupos', label: 'Como o preço reage quando você cresce', produto: 'Não reage: grupos ilimitados em qualquer plano pago.', concorrente: '1 grupo ativo no Start, 3 no Plus, 5 no Pro e 10 no Master. O teto publicado é 10.', reading: 'Cada degrau de grupo é um degrau de preço. Aqui adicionar grupo não muda a fatura.' },
      { key: 'espelhamento', label: 'Monitorar um grupo e publicar o que sai nele', produto: 'É o produto inteiro, em qualquer plano pago a partir de R$ 39 por 30 dias.', concorrente: 'O monitor de grupos aparece só no plano Master, de R$ 149,90/mês.', reading: 'Se o que você quer é exatamente espelhar, o valor a comparar no Divulga Ninja é o Master, não o Start.' },
      { key: 'arte', label: 'Arte e Instagram', produto: 'Não geramos arte para Instagram nem publicamos no Status.', concorrente: 'Arte pronta para Instagram (feed e Stories) e para o Status do WhatsApp em todos os planos.', reading: 'Aqui eles ganham em todos os planos, inclusive no mais barato.' },
      { key: 'horario', label: 'Quem escolhe a hora do envio', produto: 'Você define o ritmo por grupo: intervalo, horário de descanso, limite por hora e por dia.', concorrente: 'A I.A dispara nos horários de maior chance de compra, ou você define data e hora.', reading: 'São abordagens diferentes: eles otimizam o horário, nós controlamos a cadência.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'A página de planos consultada não indica teste grátis.', reading: 'Sem teste, a primeira validação acontece depois de pagar.' },
    ],
    criteria: ['Em quantos grupos você publica hoje e em quantos pretende publicar', 'Se você precisa monitorar grupo de origem ou só publicar o que escolheu', 'Se precisa de arte pronta para Instagram e Status', 'Se prefere que a I.A escolha o horário ou controlar a cadência você mesma', 'Se quer testar a ferramenta completa antes de pagar'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Grupos ilimitados: adicionar grupo não muda a fatura', 'Espelhamento de grupos em qualquer plano pago, a partir de R$ 39 por 30 dias', 'Seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Conversão de links de produto e de cupom', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se você publica em vários grupos, ou pretende publicar, e não quer que cada grupo novo custe um plano acima.',
      'Escolha o Espelha Grupos se o seu trabalho é acompanhar grupos de origem e espelhar: aqui isso está no plano mais barato, lá no mais caro.',
      'Escolha o Divulga Ninja se você publica em poucos grupos e a arte pronta para Instagram e Status resolve uma parte grande do seu dia.',
    ],
    notIdealFit: [
      'O Divulga Ninja não é ideal para quem tem muitos grupos: o teto publicado é 10 grupos ativos, no plano de R$ 149,90/mês.',
      'O plano de R$ 49,90 do Divulga Ninja não é ideal para quem quer espelhar: o monitor de grupos começa no Master.',
      'O Espelha Grupos não é ideal para quem precisa de arte gerada para Instagram ou publicação no Status do WhatsApp.',
    ],
    migrationPath: [
      'Conte em quantos grupos você publica: é esse número que define o plano no Divulga Ninja.',
      'Decida se você precisa monitorar grupo de origem — se sim, compare com o Master, não com o Start.',
      'Liste os grupos de onde vêm as ofertas e os destinos onde quer publicá-las.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'O plano de R$ 49,90 do Divulga Ninja monitora meus grupos?', a: 'Pelo material consultado, não: o plano Start cobre 1 grupo ativo e não lista monitor de grupos. O monitor de grupos aparece no plano Master, de R$ 149,90/mês.' },
      { q: 'Quantos grupos cada plano do Divulga Ninja cobre?', a: '1 grupo ativo no Start (R$ 49,90), 3 no Plus (R$ 69,90), 5 no Pro (R$ 89,90) e 10 no Master (R$ 149,90). Cada grupo pode ser de WhatsApp ou de Telegram, à sua escolha.' },
      { q: 'Em que o Divulga Ninja é melhor que o Espelha Grupos?', a: 'Ele gera arte pronta para Instagram (feed e Stories) e para o Status do WhatsApp em todos os planos, e a I.A escolhe o horário do disparo. Não fazemos nenhuma das duas coisas.' },
    ],
  },
  '/alternativas/shark': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Shark',
    title: 'Alternativa à Shark: espelhar em vez de gerir time',
    description: 'A Shark resolve gestão de time: ranking, moderação e pool de ofertas. O Espelha Grupos resolve publicar sozinho nos seus grupos, por R$69 em 30 dias.',
    competitorSlugs: ['shark'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'A Shark custa R$ 99/mês e resolve um problema diferente do nosso: gestão de um time de promotores, com pool de ofertas compartilhado, ranking, moderação de grupos e crescimento de audiência. O Espelha Grupos custa R$ 69 por 30 dias no Pro e resolve a publicação recorrente: acompanha as origens que você escolhe e publica nos seus grupos, sem limite de quantidade.',
    directAnswer: 'A Shark se apresenta como plataforma de gestão para quem coordena promotores de ofertas: pool de ofertas compartilhado, ranking de promotores, proteção e moderação de grupos, bot interativo para membros, link na bio com pixel da Meta, descoberta de grupos da concorrência e crescimento automático por importação de contatos. Ela também faz conversão automática de links, reescrita com I.A, WhatsApp e Telegram, e extensão do Chrome para Mercado Livre. O preço apresentado é R$ 99/mês. O Espelha Grupos é mais estreito de propósito: acompanha os grupos de origem que você escolhe, troca o link pelo seu código de afiliada e publica nos seus grupos, Canais e Comunidades do WhatsApp, com controle de ritmo e histórico de tudo. Não gerenciamos time, não importamos contatos e não descobrimos grupos de terceiros.',
    rows: [
      { key: 'problema', label: 'Que problema cada um resolve', produto: 'Publicar a oferta sozinho, sem copiar e colar, nos grupos que você escolheu.', concorrente: 'Coordenar um time de promotores, moderar grupos e crescer a audiência.', reading: 'São produtos de escopo diferente. Se você trabalha sozinha, boa parte do que a Shark cobra não vai ser usada.' },
      { key: 'preco', label: 'Preço', produto: 'R$ 39 por 30 dias no Basic; R$ 69 no Pro, que é o plano com o robô no piloto automático.', concorrente: 'R$ 99/mês, valor único na tabela consultada.', reading: 'O preço da Shark é único e não muda por quantidade de grupos — mas a tabela também não informa limite nenhum.' },
      { key: 'limites', label: 'Limites publicados', produto: 'Grupos ilimitados; um número de WhatsApp por conta.', concorrente: 'A tabela consultada não informa limite de grupos, de números de WhatsApp nem de monitoramentos.', reading: 'Vale pedir esses números a eles antes de decidir — sem eles não há como comparar capacidade.' },
      { key: 'time', label: 'Gestão de time', produto: 'Não temos ranking de promotores, pool de ofertas compartilhado nem moderação de grupos.', concorrente: 'Pool de ofertas, ranking de promotores, moderação de grupos e bot interativo para membros.', reading: 'Aqui a Shark ganha com folga, e é o motivo real para escolhê-la.' },
      { key: 'crescimento', label: 'Crescer a audiência', produto: 'Não importamos contatos nem descobrimos grupos de terceiros.', concorrente: 'Crescimento automático por importação de contatos e descoberta de grupos da concorrência.', reading: 'Cada operação precisa avaliar por conta própria se isso cabe nas regras dos grupos e do WhatsApp — a decisão é de quem opera, não da ferramenta.' },
      { key: 'antiban', label: 'Envio em massa', produto: 'Controle de intervalo, horário de descanso, limite por hora e por dia, com histórico. Não prometemos que ninguém é bloqueado.', concorrente: 'A tabela lista "broadcast em massa com anti-ban".', reading: 'Nenhuma ferramenta, nossa ou de terceiro, controla a decisão do WhatsApp. O que existe é reduzir o que está sob controle.' },
    ],
    criteria: ['Se você trabalha sozinha ou coordena um time de promotores', 'Se precisa de moderação e proteção dos seus grupos', 'Quantos grupos você tem — e se a ferramenta informa esse limite', 'Se crescer a audiência é parte do problema ou só publicar melhor', 'Se quer testar a ferramenta completa antes de pagar'],
    limitations: ['Nenhuma ferramenta pode garantir vendas, comissões ou ausência de bloqueio pelo WhatsApp.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Os recursos da Shark aqui descritos são autodeclarados na tabela do próprio site dela — confirme com eles antes de decidir.'],
    botinhoDifferentials: ['R$ 69 por 30 dias no plano com piloto automático', 'Grupos ilimitados, com limite publicado e verificável', 'Espelhamento de grupos, filas de ofertas e garimpo automático da Shopee', 'Seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Conversão de links de produto e de cupom', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se o seu problema é publicar a oferta nos seus grupos sem copiar e colar, e você quer limite de grupos claro e sem custo por quantidade.',
      'Escolha a Shark se você coordena promotores e precisa de ranking, pool de ofertas compartilhado e moderação dos grupos.',
      'Se o seu problema é audiência e não publicação, nenhuma das duas resolve sozinha — mas a Shark cobre mais desse lado.',
    ],
    notIdealFit: [
      'A Shark não é ideal para quem trabalha sozinha: boa parte do valor dela está em gestão de time.',
      'A tabela consultada não publica limite de grupos nem de números de WhatsApp, então não dá para comparar capacidade sem falar com eles.',
      'O Espelha Grupos não é ideal para quem precisa de ranking de promotores, moderação de grupos ou crescimento de audiência.',
    ],
    migrationPath: [
      'Responda primeiro se você trabalha sozinha ou com time: é isso que separa as duas ferramentas.',
      'Peça à Shark os limites de grupos, números de WhatsApp e monitoramentos, que a tabela não mostra.',
      'Liste os grupos de onde vêm as ofertas e os destinos onde quer publicá-las.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'A Shark e o Espelha Grupos resolvem a mesma coisa?', a: 'Não. A Shark é mais forte em gestão de time de promotores, moderação de grupos e crescimento de audiência. O Espelha Grupos resolve a publicação recorrente: acompanhar as origens que você escolhe e publicar nos seus grupos, com controle de ritmo e histórico.' },
      { q: 'Quantos grupos a Shark cobre?', a: 'A tabela comparativa que consultamos não informa limite de grupos, de números de WhatsApp nem de monitoramentos. Vale pedir esses números diretamente a eles — sem eles não há como comparar capacidade.' },
      { q: 'O "anti-ban" da Shark garante que eu não seja bloqueada?', a: 'Nenhuma ferramenta, nossa ou de terceiro, controla a decisão do WhatsApp. O que dá para fazer é reduzir o que está sob controle: intervalo entre envios, limite por destino, variação do texto e conferência do que saiu. Quem prometer ausência de bloqueio está prometendo o que não pode entregar.' },
      { q: 'Em que a Shark é melhor que o Espelha Grupos?', a: 'Em pool de ofertas compartilhado, ranking de promotores, moderação e proteção de grupos, bot interativo para membros e link na bio com pixel da Meta. Não fazemos nenhuma dessas coisas.' },
    ],
  },
  '/alternativas/afiliado-inteligente': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Afiliado Inteligente',
    title: 'Alternativa ao Afiliado Inteligente: sem plano anual',
    description: 'No Afiliado Inteligente o preço aparece por mês mas a cobrança é anual, à vista. No Espelha Grupos são R$69 a cada 30 dias, com grupos ilimitados.',
    competitorSlugs: ['afiliado-inteligente'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'O Afiliado Inteligente anuncia R$ 88,19 por mês no plano de entrada, mas a própria página informa R$ 1.058,29 cobrados anualmente — é um ano pago de uma vez. Esse plano cobre até 5 grupos no WhatsApp e 1 monitoramento. O Espelha Grupos custa R$ 69 a cada 30 dias no Pro, sem compromisso anual, com grupos ilimitados e 7 dias grátis sem cartão.',
    directAnswer: 'O Afiliado Inteligente tem quatro faixas: Stander, Pro, Advanced e Enterprise. Os três primeiros mostram um valor mensal (R$ 88,19, R$ 178,19 e R$ 268,19) acompanhado do total anual cobrado (R$ 1.058,29, R$ 2.138,29 e R$ 3.218,29) — ou seja, o número mensal é a diluição de um pagamento anual. Cada plano traz instâncias simultâneas de WhatsApp (1, 2 ou 3), grupos de WhatsApp e de Telegram na mesma quantidade (5, 12 ou 30), monitoramentos (1, 3 ou 6), site de ofertas incluso com integração de domínio próprio, sequências e segmentação por loja e produto, onboarding guiado e suporte prioritário. O Espelha Grupos cobra R$ 39 por 30 dias no Basic e R$ 69 no Pro, sem compromisso de um ano, sem limite de grupos e com 7 dias grátis para testar o Pro completo antes de pagar. Em troca, trabalhamos com um número de WhatsApp por conta, não publicamos no Telegram e não incluímos site de ofertas.',
    rows: [
      { key: 'cobranca', label: 'Como a cobrança acontece', produto: 'R$ 39 ou R$ 69 a cada 30 dias, sem compromisso anual.', concorrente: 'O valor é anunciado por mês, mas a própria página informa o total cobrado ANUALMENTE — R$ 1.058,29 no plano de entrada.', reading: 'É o ponto que mais muda a decisão: o número a comparar é o anual à vista, não o mensal exibido.' },
      { key: 'grupos', label: 'Limite de grupos', produto: 'Sem limite de grupos em qualquer plano pago.', concorrente: 'Até 5 grupos no WhatsApp no Stander, 12 no Pro e 30 no Advanced.', reading: 'Crescer em grupos é trocar de plano — e trocar de plano é um novo ano contratado.' },
      { key: 'instancias', label: 'Números de WhatsApp', produto: 'Um número por conta.', concorrente: '1 instância no Stander, 2 no Pro e 3 no Advanced, simultâneas.', reading: 'Aqui eles ganham: se você opera com mais de um chip, nós não substituímos.' },
      { key: 'telegram', label: 'Telegram e site de ofertas', produto: 'Somente WhatsApp. Não incluímos site de ofertas.', concorrente: 'Grupos de Telegram na mesma quantidade dos de WhatsApp, e site de ofertas incluso com domínio personalizado (domínio não incluso).', reading: 'Escopo mais largo do lado deles. Se você precisa de Telegram ou de vitrine, é um motivo real para escolhê-los.' },
      { key: 'teste', label: 'Como testar antes de pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'A página consultada não indica teste grátis nem opção mensal sem o compromisso anual.', reading: 'Sem teste e com cobrança anual, a primeira validação vem depois de um ano pago.' },
    ],
    criteria: ['Se você aceita pagar um ano à frente para ter o mensal mais baixo', 'Quantos grupos você tem hoje e quantos pretende ter', 'Quantos números de WhatsApp você usa ao mesmo tempo', 'Se precisa publicar no Telegram ou ter site de ofertas', 'Se quer testar a ferramenta completa antes de pagar'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Cobrança a cada 30 dias, sem compromisso anual', 'Grupos ilimitados em qualquer plano pago', 'R$ 39 no Basic e R$ 69 no plano com piloto automático', 'Seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress', 'Espelhamento de grupos, filas de ofertas e garimpo automático da Shopee', 'Controle do ritmo dos envios por grupo', 'Histórico completo do que saiu, falhou ou foi segurado', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se você não quer se comprometer com um ano, quer grupos ilimitados e prefere testar antes de pagar.',
      'Escolha o Afiliado Inteligente se você precisa de mais de um número de WhatsApp ao mesmo tempo, publica no Telegram ou quer site de ofertas incluso.',
      'Se a sua operação já é estável e previsível, o compromisso anual deles pode fazer sentido pelo valor mensal mais baixo.',
    ],
    notIdealFit: [
      'O Afiliado Inteligente não é ideal para quem está começando: a cobrança apresentada é anual e à vista, e a página não indica teste grátis.',
      'O plano de entrada deles não é ideal para quem tem muitos grupos: são até 5 no WhatsApp e 1 monitoramento.',
      'O Espelha Grupos não é ideal para quem precisa de várias instâncias de WhatsApp, de Telegram ou de site de ofertas incluso.',
    ],
    migrationPath: [
      'Multiplique o mensal deles por doze e compare com o anual publicado — é o mesmo número, e é ele que sai do seu bolso de uma vez.',
      'Conte quantos grupos você tem hoje e quantos pretende ter: é o que define o plano lá.',
      'Separe o que você precisa no Telegram do que precisa no WhatsApp.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'O Afiliado Inteligente cobra por mês ou por ano?', a: 'A página mostra o valor por mês e, logo abaixo, o total cobrado anualmente: R$ 1.058,29 no Stander, R$ 2.138,29 no Pro e R$ 3.218,29 no Advanced. Ou seja, o número mensal é a diluição de um pagamento anual. A página consultada não indica opção mensal sem esse compromisso.' },
      { q: 'Quantos grupos o plano de entrada do Afiliado Inteligente cobre?', a: 'Até 5 grupos no WhatsApp, 1 monitoramento e até 5 grupos no Telegram, com 1 instância de WhatsApp ativa. No Espelha Grupos não há limite de grupos em nenhum plano pago.' },
      { q: 'Em que o Afiliado Inteligente é melhor que o Espelha Grupos?', a: 'Em três coisas: instâncias simultâneas de WhatsApp (até 3), grupos de Telegram na mesma quantidade dos de WhatsApp, e site de ofertas incluso com integração de domínio próprio. Não fazemos nenhuma das três.' },
      { q: 'O Afiliado Inteligente é o mesmo que o Divulgador Inteligente?', a: 'Não: são produtos diferentes, de empresas diferentes, com nomes parecidos. O Afiliado Inteligente tem os planos Stander, Pro, Advanced e Enterprise, com cobrança anual. O Divulgador Inteligente tem Essencial, Ouro e Diamante, cobrados por mês — e tem página de comparação própria aqui no site.' },
    ],
  },
  '/alternativas/afilimais': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Afilimais',
    title: 'Alternativa ao Afilimais: sem pagar por usuário',
    description: 'O Afilimais cobra por usuário, número e faixa de grupos, e o monitoramento começa em R$196. No Espelha Grupos são grupos ilimitados por R$69 em 30 dias.',
    competitorSlugs: ['afilimais'],
    productPage: {
      href: '/bot-afiliados-whatsapp',
      label: 'Como funciona a operação para afiliados, do começo ao fim',
      note: 'Origens, conversão do link, destinos e histórico — sem comparar com ninguém.',
    },
    tldr: 'O Afilimais tem plano gratuito permanente (1 grupo, só Amazon e Shopee) e planos pagos de R$ 99 a R$ 496 por mês, cobrados por quantidade de usuários, números de WhatsApp e faixa de grupos. O monitoramento de grupos — que é o recurso de espelhamento — começa no Grow, de R$ 196/mês. O Espelha Grupos custa R$ 69 por 30 dias no Pro, não cobra por usuário e já espelha no plano de R$ 39.',
    directAnswer: 'O Afilimais é a única ferramenta do grupo que mapeamos construída para EQUIPE: cobra por usuário (1, 2, 5 ou 10), tem CRM completo, leads do WhatsApp em tempo real e emite nota fiscal (500, 1.000 ou 2.000 por plano). Também tem plano gratuito permanente, chega a 20 números de WhatsApp e 300 grupos no Elite, e permite criar a oferta pelo Telegram, pelo WhatsApp ou pela extensão do Chrome. O ponto de atenção é onde cada recurso entra: o Starter, de R$ 99/mês, cobre 15 grupos, não inclui Mercado Livre e não inclui monitoramento de grupos — os dois começam no Grow, de R$ 196/mês. O Espelha Grupos cobra R$ 39 por 30 dias no Basic, com espelhamento e seis lojas já nesse plano, e não cobra por usuário nem por faixa de grupos.',
    rows: [
      { key: 'espelhamento', label: 'Monitorar grupo e publicar o que sai nele', produto: 'Em qualquer plano pago, a partir de R$ 39 por 30 dias.', concorrente: 'O monitoramento de grupos começa no Grow, de R$ 196/mês. O Starter, de R$ 99, não o inclui.', reading: 'Se o que você quer é espelhar, o valor a comparar no Afilimais é R$ 196, não R$ 99.' },
      { key: 'usuarios', label: 'Pelo que você paga', produto: 'Pelo plano. Não cobramos por usuário nem por faixa de grupos.', concorrente: 'Por usuários (1, 2, 5 ou 10), números de WhatsApp (1 a 20) e faixa de grupos (1, 15, 100, 200 ou 300).', reading: 'Se você trabalha sozinha, boa parte do que o Afilimais cobra não vai ser usada.' },
      { key: 'lojas', label: 'Lojas suportadas', produto: 'Seis em qualquer plano pago: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress.', concorrente: 'Amazon e Shopee no gratuito; Amazon, Magalu e Shopee no Starter; Mercado Livre e todas as integrações a partir do Grow.', reading: 'Quem divulga Mercado Livre precisa do plano de R$ 196 lá; aqui ele já está no Basic de R$ 39.' },
      { key: 'time', label: 'Equipe, CRM e nota fiscal', produto: 'Não temos CRM, não emitimos nota fiscal e a conta é de uma pessoa.', concorrente: 'CRM completo, leads em tempo real, emissão de nota fiscal e até 10 usuários na mesma conta.', reading: 'Aqui o Afilimais ganha com folga, e é o motivo real para escolhê-lo se você tem equipe.' },
      { key: 'gratis', label: 'Como começar sem pagar', produto: '7 dias grátis com o Pro completo, sem cartão.', concorrente: 'Plano gratuito permanente: 1 usuário, 1 número, 1 grupo, só Amazon e Shopee, até 20 ofertas por dia.', reading: 'São coisas diferentes: o gratuito deles é permanente mas limitado; o nosso é o plano completo por 7 dias.' },
    ],
    criteria: ['Se você trabalha sozinha ou com equipe', 'Quantos grupos você tem hoje e quantos pretende ter', 'Se precisa de CRM, leads e emissão de nota fiscal', 'Se divulga Mercado Livre — e em qual plano ele entra', 'Se prefere um gratuito permanente limitado ou o plano completo por alguns dias'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Espelhamento de grupos já no plano de R$ 39 por 30 dias', 'Grupos ilimitados, sem faixa por quantidade', 'Sem cobrança por usuário', 'Seis lojas em qualquer plano pago, Mercado Livre incluído', 'Conversão de links de produto e de cupom', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', '7 dias grátis com o Pro completo, sem cartão'],
    bestFit: [
      'Escolha o Espelha Grupos se você trabalha sozinha, quer espelhamento no plano mais barato e não quer pagar por faixa de grupos.',
      'Escolha o Afilimais se você tem equipe e precisa de CRM, leads em tempo real, nota fiscal e vários usuários na mesma conta.',
      'Se você quer só experimentar sem prazo, o plano gratuito permanente do Afilimais cobre 1 grupo com Amazon e Shopee.',
    ],
    notIdealFit: [
      'O Starter do Afilimais, de R$ 99/mês, não é ideal para quem quer espelhar nem para quem divulga Mercado Livre: os dois começam no Grow, de R$ 196/mês.',
      'O Afilimais não é ideal para quem trabalha sozinha com muitos grupos, porque o preço acompanha usuários e faixas de grupos.',
      'O Espelha Grupos não é ideal para quem precisa de CRM, emissão de nota fiscal ou vários usuários na mesma conta.',
    ],
    migrationPath: [
      'Responda duas coisas: quantos grupos e quantas pessoas vão usar. São as duas contas que definem o plano no Afilimais.',
      'Confira em qual plano entram o Mercado Livre e o monitoramento de grupos, se você precisa deles.',
      'Liste os grupos de onde vêm as ofertas e os destinos onde quer publicá-las.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'O plano de R$ 99 do Afilimais monitora meus grupos?', a: 'Pelo material consultado, não: o Starter cobre 15 grupos e não lista monitoramento de grupos. Esse recurso começa no Grow, de R$ 196/mês, junto com o Mercado Livre e todas as integrações.' },
      { q: 'O Afilimais tem plano gratuito?', a: 'Sim, permanente: 1 usuário, 1 número de WhatsApp, até 1 grupo, somente Amazon e Shopee, até 20 ofertas por dia e site personalizado. O Espelha Grupos oferece o plano Pro completo por 7 dias, sem cartão.' },
      { q: 'Em que o Afilimais é melhor que o Espelha Grupos?', a: 'Ele é feito para equipe: cobra por usuário e entrega CRM completo, leads do WhatsApp em tempo real, emissão de nota fiscal e até 20 números de WhatsApp. Não fazemos nenhuma dessas coisas.' },
      { q: 'Preciso de qual plano do Afilimais para divulgar Mercado Livre?', a: 'Pelo material consultado, o Mercado Livre entra a partir do Grow, de R$ 196/mês. No Espelha Grupos ele já está no plano Basic, de R$ 39 por 30 dias.' },
    ],
  },
  /* Cinco comparativos de 23/09/2026. Origem: na consulta "bot para afiliados
   * no WhatsApp" o ChatGPT citou estes nomes e nos deixou de fora — por ler a
   * consulta como "robô que busca oferta sozinho" e por querer evidência de
   * confiança (premiou um concorrente pela política de reembolso pública).
   *
   * Todos os preços vêm de `competitors-data.js`, coletados DIRETAMENTE da
   * página oficial de cada um no mesmo dia (nunca de tabela de IA ou de outro
   * concorrente). Regra de sempre: dizer onde o concorrente é melhor. E dizer
   * que temos os DOIS modos — espelhamento (6 lojas) e busca automática
   * (Shopee, Pro) —, que é o ponto que a IA não enxergava. */
  '/alternativas/easyfy': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Easyfy',
    title: 'Alternativa à Easyfy: grupos ilimitados por R$ 69',
    description: 'O PRO da Easyfy publica em até 10 grupos e canais. No Espelha Grupos o Pro custa R$ 69 por 30 dias, sem limite de grupos, e busca ofertas da Shopee sozinho.',
    competitorSlugs: ['easyfy'],
    productPage: {
      href: '/bot-que-busca-ofertas-shopee-whatsapp',
      label: 'Como o robô busca ofertas da Shopee sozinho',
      note: 'O modo de ofertas automáticas, além do espelhamento dos grupos que você segue.',
    },
    guides: [
      { href: '/bot-afiliados-whatsapp', title: 'Bot para afiliados no WhatsApp: os dois modos' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    tldr: 'A Easyfy tem plano gratuito permanente (1 grupo monitorado e 1 de destino, 10 promoções automáticas por dia) e planos de R$ 59,90 e R$ 89,90 por mês, com WhatsApp e Telegram e 8 plataformas. O PRO publica em até 10 grupos e canais de destino, com 1 número de WhatsApp. O Espelha Grupos cobra R$ 39 por 30 dias no Basic e R$ 69 no Pro, sem limite de grupos, e no Pro também busca ofertas da Shopee sozinho por tema.',
    directAnswer: 'A Easyfy é uma plataforma larga para afiliados: converte links de 8 plataformas (Amazon, Mercado Livre, Shopee, Magazine Luiza, AliExpress, AWIN, Rakuten e SHEIN), monitora grupos, publica no WhatsApp e no Telegram, mostra comissões reais da Shopee e da Awin, tem encurtador próprio, vitrine, link na bio e, no Elite, imagens de produto geradas por IA. O plano gratuito é permanente e o PRO custa R$ 59,90/mês, com 1 número de WhatsApp e até 10 grupos e canais de destino. O Espelha Grupos é só WhatsApp e cobre 6 lojas, mas não limita grupos: o Basic, de R$ 39 por 30 dias, espelha os grupos que você segue com o seu link, e o Pro, de R$ 69, acrescenta canais, filas, controle de ritmo e a busca automática de ofertas da Shopee por tema e desconto mínimo. Os dois modos — repassar o que aparece nos seus grupos de origem e buscar oferta sozinho — ficam na mesma conta. Há 7 dias grátis com o Pro completo, sem cartão, e reembolso integral em até 7 dias do pagamento.',
    rows: [
      { key: 'preco', label: 'Preço', produto: 'Basic R$ 39 e Pro R$ 69, por 30 dias.', concorrente: 'Free R$ 0, PRO R$ 59,90/mês e Elite R$ 89,90/mês.', reading: 'A Easyfy tem um gratuito permanente; nós temos o Pro completo por 7 dias e um plano pago de entrada mais barato.' },
      { key: 'grupos', label: 'Quantos grupos recebem', produto: 'Sem limite de grupos.', concorrente: 'PRO: até 10 grupos e canais de destino. Free: 1 grupo de destino.', reading: 'Se você publica em mais de 10 destinos, a conta muda a nosso favor.' },
      { key: 'lojas', label: 'Lojas e canais', produto: 'Seis lojas (Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress), só WhatsApp.', concorrente: 'Oito plataformas, incluindo AWIN e Rakuten, e WhatsApp e Telegram.', reading: 'Aqui a Easyfy ganha: se você divulga AWIN, Rakuten ou usa Telegram, é um motivo real para escolhê-la.' },
      { key: 'busca', label: 'Oferta sem grupo de origem', produto: 'No Pro, o robô busca ofertas da Shopee sozinho por tema, desconto mínimo e ordem de busca.', concorrente: 'Monitora grupos e converte cada link; permite programar envios automáticos de ofertas.', reading: 'Os dois cobrem o espelhamento; confira como cada um escolhe a oferta quando não há grupo de origem.' },
      { key: 'extras', label: 'Além da publicação', produto: 'Histórico completo de envios, marca d’água e painel de vendas da Shopee no Pro.', concorrente: 'Encurtador com rastreamento, vitrine, link na bio, analytics com comissões da Shopee e da Awin, imagens com IA no Elite.', reading: 'A Easyfy traz mais ferramentas de vitrine e conteúdo; nós focamos na publicação recorrente nos grupos.' },
    ],
    criteria: ['Quantos grupos e canais recebem as ofertas', 'Se você usa Telegram além do WhatsApp', 'Se divulga AWIN ou Rakuten', 'Se quer o robô buscando oferta sozinho', 'Se prefere um gratuito permanente limitado ou o plano completo por 7 dias'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Grupos ilimitados, sem faixa por quantidade', 'Espelhamento no Basic de R$ 39 por 30 dias', 'Busca automática de ofertas da Shopee no Pro de R$ 69', 'Seis lojas, com conversão de produto e de cupom', 'Grupos, Canais e Comunidades do WhatsApp', 'Controle do ritmo dos envios por grupo', '7 dias grátis com o Pro completo, sem cartão', 'Reembolso integral em até 7 dias do pagamento'],
    bestFit: [
      'Escolha o Espelha Grupos se você publica em mais de 10 grupos, quer pagar o mesmo com poucos ou muitos grupos e quer os dois modos (espelhar e buscar oferta sozinho) na mesma conta.',
      'Escolha a Easyfy se usa Telegram, divulga AWIN ou Rakuten, ou quer encurtador próprio, vitrine e imagens com IA no mesmo lugar.',
      'Se você quer começar sem pagar nada e por tempo indeterminado, o gratuito permanente da Easyfy cobre 1 grupo monitorado e 1 de destino.',
    ],
    notIdealFit: [
      'A Easyfy não é ideal para quem publica em muitos grupos: o PRO cobre até 10 destinos e 1 número de WhatsApp.',
      'O Espelha Grupos não é ideal para quem precisa de Telegram, AWIN ou Rakuten — não cobrimos esses canais nem essas redes.',
      'O Espelha Grupos não tem vitrine, link na bio nem geração de imagem por IA.',
    ],
    migrationPath: [
      'Liste os grupos de onde vêm as ofertas e os grupos, Canais ou Comunidades onde você publica.',
      'Confira se as lojas que você divulga estão entre as seis que cobrimos.',
      'Comece os 7 dias grátis e compare pelo histórico de envios, não pela impressão.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'A Easyfy tem plano grátis?', a: 'Tem, permanente e sem cartão: links de afiliado ilimitados, 1 canal (WhatsApp ou Telegram), 1 grupo monitorado, 1 grupo de destino e 10 promoções automáticas por dia, conforme a página oficial consultada em 23/09/2026.' },
      { q: 'Quanto custa a Easyfy?', a: 'PRO por R$ 59,90/mês e Elite por R$ 89,90/mês, cobrados mensalmente. O Espelha Grupos custa R$ 39 (Basic) ou R$ 69 (Pro) por 30 dias.' },
      { q: 'O Espelha Grupos busca ofertas sozinho?', a: 'Sim, no plano Pro: você escreve o tema e o desconto mínimo, e o robô procura na Shopee e publica no seu grupo. Nas outras lojas, o Espelha Grupos converte o link que chega dos grupos que você acompanha.' },
      { q: 'Em que a Easyfy é melhor?', a: 'Em Telegram, em AWIN e Rakuten, e nas ferramentas de vitrine, encurtador e imagem por IA. Não fazemos nada disso.' },
    ],
  },
  '/alternativas/lucreshop': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · LucreShop',
    title: 'Alternativa à LucreShop: sem cota de grupos',
    description: 'A LucreShop limita grupos por número de WhatsApp e por plano. No Espelha Grupos o Pro custa R$ 69 por 30 dias, sem limite de grupos, com 6 lojas.',
    competitorSlugs: ['lucreshop'],
    productPage: {
      href: '/bot-que-busca-ofertas-shopee-whatsapp',
      label: 'Como o robô busca ofertas da Shopee sozinho',
      note: 'O modo de ofertas automáticas, além do espelhamento dos grupos que você segue.',
    },
    guides: [
      { href: '/bot-afiliados-whatsapp', title: 'Bot para afiliados no WhatsApp: os dois modos' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    tldr: 'A LucreShop tem cinco planos, de R$ 29,90 a R$ 530 por mês, com os 4 marketplaces (Amazon, Shopee, Mercado Livre e Magalu), bot de nicho que busca e publica sozinho, espelhamento, Telegram e automação de Instagram. O que muda entre os planos é a cota: 1 grupo no de entrada, 3, 8, 20 e 100 grupos por loja nos seguintes. O Espelha Grupos cobra R$ 39 (Basic) ou R$ 69 (Pro) por 30 dias sem limite de grupos, com 6 lojas.',
    directAnswer: 'A LucreShop é uma plataforma completa para afiliados de Amazon, Shopee, Mercado Livre e Magalu: bot de nicho que busca a oferta e publica sozinho, espelhamento de grupos, campanhas cronometradas, WhatsApp e Telegram, automação de Instagram (resposta a comentário e mensagem no Direct), vitrine própria com subdomínio, link inteligente que troca de grupo quando lota e relatórios de cliques, participantes e ROI. O preço começa em R$ 29,90/mês, com 3 dias grátis sem cartão, mas o plano de entrada cobre 1 grupo ou canal por número de WhatsApp; 20 grupos por loja só no Pro, de R$ 185/mês. O Espelha Grupos não cobra por quantidade de grupos: o Basic, de R$ 39 por 30 dias, espelha os grupos que você segue em 6 lojas, e o Pro, de R$ 69, acrescenta canais, filas, controle de ritmo e a busca automática de ofertas da Shopee por tema. Não temos Telegram, Instagram, vitrine nem relatório de cliques — nesses pontos a LucreShop entrega mais.',
    rows: [
      { key: 'preco', label: 'Preço de entrada', produto: 'Basic R$ 39 por 30 dias, sem limite de grupos.', concorrente: 'Meu Primeiro Grupo: a partir de R$ 29,90/mês, com 1 grupo ou canal por número.', reading: 'A LucreShop começa mais barata, mas com 1 grupo. Com mais grupos, o valor a comparar sobe.' },
      { key: 'grupos', label: 'Quantos grupos recebem', produto: 'Sem limite de grupos.', concorrente: '1 grupo (R$ 29,90), 3 (R$ 59,90), 8 (R$ 95), 20 por loja (R$ 185) e 100 por loja (R$ 530).', reading: 'Quem tem 10 grupos precisa do Pro de R$ 185 lá; aqui paga o mesmo que quem tem um.' },
      { key: 'busca', label: 'Oferta sem grupo de origem', produto: 'No Pro, busca automática de ofertas da Shopee por tema, desconto mínimo e ordem de busca.', concorrente: 'Bot de nicho em todos os planos: você define categorias e lojas e ele busca, monta a mensagem e publica.', reading: 'Os dois buscam oferta sozinhos; confira em quais lojas cada um faz isso.' },
      { key: 'lojas', label: 'Lojas', produto: 'Seis: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress.', concorrente: 'Quatro: Amazon, Shopee, Mercado Livre e Magazine Luiza.', reading: 'Se você divulga SHEIN ou AliExpress, nós cobrimos e a LucreShop não lista.' },
      { key: 'alem', label: 'Além do WhatsApp', produto: 'Grupos, Canais e Comunidades do WhatsApp.', concorrente: 'Telegram, automação de Instagram, vitrine com subdomínio, landing pages, link inteligente anti-lotação e relatórios de cliques e ROI.', reading: 'Aqui a LucreShop ganha com folga.' },
    ],
    criteria: ['Quantos grupos você tem hoje e quantos pretende ter', 'Se usa Telegram ou Instagram', 'Se divulga SHEIN ou AliExpress', 'Se precisa de relatório de cliques e ROI', 'Se prefere cota por plano ou preço fixo'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Grupos ilimitados, sem cota por número ou por plano', 'Seis lojas, SHEIN e AliExpress incluídas', 'Espelhamento no Basic de R$ 39 por 30 dias', 'Busca automática de ofertas da Shopee no Pro de R$ 69', 'Conversão de links de produto e de cupom', '7 dias grátis com o Pro completo, sem cartão', 'Reembolso integral em até 7 dias do pagamento'],
    bestFit: [
      'Escolha o Espelha Grupos se você publica em vários grupos e não quer trocar de plano a cada grupo novo, ou se divulga SHEIN e AliExpress.',
      'Escolha a LucreShop se usa Telegram ou Instagram, quer vitrine própria com SEO e relatórios de cliques e ROI, ou opera um grupo só e quer o menor preço de entrada.',
      'A LucreShop também faz sentido para quem gerencia várias marcas separadas, com vitrines independentes por loja.',
    ],
    notIdealFit: [
      'A LucreShop não é ideal para quem tem muitos grupos com orçamento curto: 20 grupos por loja só a partir de R$ 185/mês.',
      'O Espelha Grupos não é ideal para quem precisa de Telegram, Instagram, vitrine ou relatório de cliques.',
      'O Espelha Grupos trabalha somente com WhatsApp.',
    ],
    migrationPath: [
      'Conte os grupos de destino — é o número que define o plano na LucreShop.',
      'Liste as lojas que você divulga e confira se estão entre as seis que cobrimos.',
      'Comece os 7 dias grátis e compare pelo histórico de envios.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'Quanto custa a LucreShop?', a: 'Conforme a página oficial consultada em 23/09/2026: Meu Primeiro Grupo a partir de R$ 29,90/mês, Grupo em Crescimento R$ 59,90, Start R$ 95, Pro R$ 185 e Elite R$ 530 por mês.' },
      { q: 'A LucreShop tem teste grátis?', a: 'Tem: 3 dias grátis sem cartão, no plano Meu Primeiro Grupo. O Espelha Grupos oferece 7 dias com o Pro completo, sem cartão.' },
      { q: 'Quantos grupos cabem em cada plano da LucreShop?', a: '1 grupo ou canal no de entrada, até 3 no Grupo em Crescimento, até 8 no Start, até 20 por loja no Pro e até 100 por loja no Elite. O Espelha Grupos não limita grupos.' },
      { q: 'Em que a LucreShop é melhor?', a: 'Em Telegram, automação de Instagram, vitrine com subdomínio, link inteligente anti-lotação e relatórios de cliques, participantes e ROI.' },
    ],
  },
  '/alternativas/afiliai': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · AfiliAI',
    title: 'Alternativa ao AfiliAI: grupos ilimitados e 6 lojas',
    description: 'O AfiliAI publica em até 5 ou 10 grupos de destino e lista 4 lojas. No Espelha Grupos o Pro custa R$ 69 por 30 dias, sem limite de grupos, com 6 lojas.',
    competitorSlugs: ['afiliai'],
    productPage: {
      href: '/bot-que-busca-ofertas-shopee-whatsapp',
      label: 'Como o robô busca ofertas da Shopee sozinho',
      note: 'O modo de ofertas automáticas, além do espelhamento dos grupos que você segue.',
    },
    guides: [
      { href: '/bot-afiliados-whatsapp', title: 'Bot para afiliados no WhatsApp: os dois modos' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    tldr: 'O AfiliAI clona grupos, tem AutoPilot que busca oferta e posta sozinho, e publica no WhatsApp e no Telegram. O plano Ofertas custa R$ 49,90/mês para até 5 grupos de destino e o Combo, R$ 99,00/mês para até 10 — os dois exibidos ao lado de um valor "de" riscado. O Espelha Grupos cobra R$ 39 (Basic) ou R$ 69 (Pro) por 30 dias, sem limite de grupos, com 6 lojas.',
    directAnswer: 'O AfiliAI automatiza a divulgação de afiliados no WhatsApp e no Telegram: clona promoções de grupos externos com o card reescrito por IA, tem AutoPilot que busca produto em oferta e posta sozinho, blocos de campanha com intervalo, agendamento com CTAs, vários WhatsApps conectados, vitrine e relatórios diários. Tem também um robô para encher grupo, vendido separado. A página lista Shopee, Mercado Livre, Amazon e Magalu. O plano Ofertas cobre até 5 grupos de destino por R$ 49,90/mês e o Combo, até 10 por R$ 99,00/mês; os dois aparecem ao lado de um valor "de" riscado, sem dizer se ele volta a valer. O Espelha Grupos não limita grupos: o Basic, de R$ 39 por 30 dias, espelha os grupos que você segue em 6 lojas (SHEIN e AliExpress incluídas), e o Pro, de R$ 69, acrescenta canais, filas, controle de ritmo e a busca automática de ofertas da Shopee. Não temos Telegram nem vários números na mesma conta — nesses pontos o AfiliAI entrega mais.',
    rows: [
      { key: 'preco', label: 'Preço', produto: 'Basic R$ 39 e Pro R$ 69, por 30 dias.', concorrente: 'Ofertas R$ 49,90/mês e Combo R$ 99,00/mês, exibidos ao lado de "de R$ 99,90" e "de R$ 209,90".', reading: 'Confirme com eles se o valor riscado volta a valer depois — a página não diz.' },
      { key: 'grupos', label: 'Quantos grupos recebem', produto: 'Sem limite de grupos.', concorrente: 'Até 5 grupos de destino no Ofertas e até 10 no Combo.', reading: 'Com mais de 5 destinos, o valor a comparar lá é o Combo.' },
      { key: 'busca', label: 'Oferta sem grupo de origem', produto: 'No Pro, busca automática de ofertas da Shopee por tema e desconto mínimo.', concorrente: 'AutoPilot: busca produtos em oferta e posta sozinho, já no plano Ofertas.', reading: 'Os dois buscam oferta sozinhos; o AfiliAI inclui isso no plano de entrada.' },
      { key: 'lojas', label: 'Lojas', produto: 'Seis: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress.', concorrente: 'Quatro: Shopee, Mercado Livre, Amazon e Magalu.', reading: 'Se você divulga SHEIN ou AliExpress, nós cobrimos.' },
      { key: 'canais', label: 'Canais e números', produto: 'Só WhatsApp (grupos, Canais e Comunidades), um número por conta.', concorrente: 'WhatsApp e Telegram, 2 WhatsApps no Ofertas e 5 no Combo.', reading: 'Aqui o AfiliAI ganha: Telegram e vários números na mesma conta.' },
    ],
    criteria: ['Quantos grupos de destino você tem', 'Se usa Telegram ou vários números de WhatsApp', 'Se divulga SHEIN ou AliExpress', 'Se o valor riscado do plano volta a valer', 'Se quer testar antes de pagar'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Adicionar pessoas a grupos sem que elas peçam aumenta denúncias e risco de restrição do número.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Grupos ilimitados, sem faixa por quantidade', 'Seis lojas, SHEIN e AliExpress incluídas', 'Espelhamento no Basic de R$ 39 por 30 dias', 'Busca automática de ofertas da Shopee no Pro de R$ 69', '7 dias grátis com o Pro completo, sem cartão', 'Reembolso integral em até 7 dias do pagamento', 'Preço publicado sem valor riscado'],
    bestFit: [
      'Escolha o Espelha Grupos se você publica em mais de 10 grupos, divulga SHEIN ou AliExpress, ou quer testar o plano completo antes de pagar.',
      'Escolha o AfiliAI se usa Telegram, precisa de vários números de WhatsApp na mesma conta ou quer o AutoPilot já no plano de entrada.',
      'O AfiliAI também tem um plano só de crescimento de grupo, que não fazemos.',
    ],
    notIdealFit: [
      'O AfiliAI não é ideal para quem publica em muitos grupos: o teto do Combo é de 10 grupos de destino.',
      'O Espelha Grupos não é ideal para quem precisa de Telegram ou de vários números na mesma conta.',
      'O Espelha Grupos não adiciona membros a grupos.',
    ],
    migrationPath: [
      'Conte os grupos de destino — é o número que define o plano no AfiliAI.',
      'Liste as lojas que você divulga e confira se estão entre as seis que cobrimos.',
      'Comece os 7 dias grátis e compare pelo histórico de envios.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'Quanto custa o AfiliAI?', a: 'Conforme a página oficial afiliai.com.br consultada em 23/09/2026: Ofertas R$ 49,90/mês (até 5 grupos de destino), Combo R$ 99,00/mês (até 10) e Robo R$ 59,90/mês (só para encher grupo). Os três aparecem ao lado de um valor "de" riscado.' },
      { q: 'O AfiliAI busca ofertas sozinho?', a: 'Sim, pelo AutoPilot, e também clona grupos externos. O Espelha Grupos faz os dois modos: espelha os grupos que você segue em 6 lojas e, no Pro, busca ofertas da Shopee sozinho por tema.' },
      { q: 'O AfiliAI tem teste grátis ou reembolso?', a: 'A página consultada tem botão para criar conta grátis, mas não detalha teste, garantia nem política de reembolso. O Espelha Grupos tem 7 dias grátis com o Pro completo e devolve o valor integral em até 7 dias do pagamento.' },
      { q: 'Em que o AfiliAI é melhor?', a: 'Em Telegram, em vários números de WhatsApp na mesma conta e no AutoPilot já no plano de entrada.' },
    ],
  },
  '/alternativas/achify': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Achify',
    title: 'Alternativa ao Achify: espelhar sem pagar por grupo',
    description: 'No Achify o Start envia para 1 grupo e o espelhamento começa no Pro. No Espelha Grupos o Basic de R$ 39 já espelha, sem limite de grupos.',
    competitorSlugs: ['achify'],
    productPage: {
      href: '/bot-que-busca-ofertas-shopee-whatsapp',
      label: 'Como o robô busca ofertas da Shopee sozinho',
      note: 'O modo de ofertas automáticas, além do espelhamento dos grupos que você segue.',
    },
    guides: [
      { href: '/bot-afiliados-whatsapp', title: 'Bot para afiliados no WhatsApp: os dois modos' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    tldr: 'O Achify tem piloto automático 24h na Shopee e publica no WhatsApp e no Telegram. O Start custa R$ 57/mês e envia para 1 grupo; o espelhamento de um grupo de origem começa no Pro, de R$ 97/mês, com 3 grupos para envio; o Ultra, de R$ 147/mês, envia para 10. O Espelha Grupos espelha já no Basic, de R$ 39 por 30 dias, sem limite de grupos, e no Pro de R$ 69 também busca ofertas da Shopee sozinho.',
    directAnswer: 'O Achify automatiza grupos de achadinhos: na Shopee roda um piloto automático 24h que garimpa, aplica o link e envia sozinho; para Amazon e Mercado Livre, as ofertas chegam numa central para você aprovar em poucos cliques. Cada foto sai com marca d’água, moldura e selo de desconto, e todos os planos têm vitrine e link na bio, com WhatsApp e Telegram. O preço acompanha os grupos: Start R$ 57/mês com 1 grupo para envio, Pro R$ 97/mês com 1 grupo monitorado e 3 para envio, Ultra R$ 147/mês com 5 monitorados e 10 para envio. Há garantia de 7 dias com devolução de 100%. O Espelha Grupos espelha os grupos que você segue já no Basic, de R$ 39 por 30 dias, em 6 lojas e sem limite de grupos; o Pro, de R$ 69, acrescenta canais, filas, marca d’água, controle de ritmo e a busca automática de ofertas da Shopee por tema. Também devolvemos o valor integral em até 7 dias do pagamento, e antes disso há 7 dias grátis sem cartão.',
    rows: [
      { key: 'espelhar', label: 'Espelhar um grupo de origem', produto: 'Já no Basic, de R$ 39 por 30 dias, com quantos grupos de origem quiser.', concorrente: 'Começa no Pro, de R$ 97/mês, com 1 grupo monitorado; 5 no Ultra, de R$ 147/mês.', reading: 'Se o que você quer é espelhar, o valor a comparar lá é R$ 97, não R$ 57.' },
      { key: 'grupos', label: 'Quantos grupos recebem', produto: 'Sem limite de grupos.', concorrente: '1 grupo no Start, 3 no Pro e 10 no Ultra.', reading: 'Com mais de 10 grupos, o Achify não tem plano publicado que cubra.' },
      { key: 'busca', label: 'Oferta sem grupo de origem', produto: 'No Pro, busca automática de ofertas da Shopee por tema, desconto mínimo e ordem de busca.', concorrente: 'Piloto automático 24h na Shopee em todos os planos; Amazon e Mercado Livre por aprovação manual.', reading: 'Os dois buscam oferta sozinhos na Shopee; o Achify inclui isso no plano de entrada.' },
      { key: 'lojas', label: 'Lojas', produto: 'Seis: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress.', concorrente: 'Três: Shopee, Amazon e Mercado Livre.', reading: 'Se você divulga Magalu, SHEIN ou AliExpress, nós cobrimos.' },
      { key: 'garantia', label: 'Teste e devolução', produto: '7 dias grátis sem cartão; reembolso integral em até 7 dias do pagamento.', concorrente: 'R$ 1,00 por 8 dias no cartão (renova por R$ 57/mês) e garantia de 7 dias com devolução de 100%.', reading: 'Os dois devolvem o dinheiro em 7 dias; nós deixamos testar antes sem cartão.' },
      { key: 'alem', label: 'Além do WhatsApp', produto: 'Grupos, Canais e Comunidades do WhatsApp.', concorrente: 'Telegram, vitrine online, link na bio, menção @todos e selo de desconto na foto.', reading: 'Aqui o Achify entrega mais.' },
    ],
    criteria: ['Se você quer espelhar um grupo de origem ou só garimpar na Shopee', 'Quantos grupos recebem as ofertas', 'Se divulga Magalu, SHEIN ou AliExpress', 'Se usa Telegram ou quer vitrine', 'Se prefere testar sem cartão ou pagar com garantia'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Espelhamento já no Basic de R$ 39 por 30 dias', 'Grupos ilimitados, sem faixa por quantidade', 'Seis lojas, com conversão de produto e de cupom', 'Busca automática de ofertas da Shopee no Pro de R$ 69', '7 dias grátis sem cartão', 'Reembolso integral em até 7 dias do pagamento'],
    bestFit: [
      'Escolha o Espelha Grupos se quer espelhar grupos de origem sem pagar por quantidade de grupos, ou se divulga Magalu, SHEIN ou AliExpress.',
      'Escolha o Achify se opera poucos grupos, quer o piloto automático da Shopee já no plano de entrada e valoriza vitrine, link na bio, Telegram e selo de desconto na foto.',
      'O plano trimestral do Achify sai mais barato por mês para quem já decidiu ficar.',
    ],
    notIdealFit: [
      'O Achify não é ideal para quem publica em muitos grupos: o teto publicado é de 10 grupos para envio.',
      'O Achify não é ideal para quem quer espelhar grupo no plano mais barato: o monitoramento começa no Pro.',
      'O Espelha Grupos não é ideal para quem precisa de Telegram, vitrine ou link na bio.',
    ],
    migrationPath: [
      'Decida se o que você precisa é espelhar grupos de origem, garimpar na Shopee ou os dois.',
      'Conte os grupos que recebem as ofertas.',
      'Comece os 7 dias grátis e compare pelo histórico de envios.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'Quanto custa o Achify?', a: 'Conforme a página oficial consultada em 23/09/2026, no plano mensal: Start R$ 57, Pro R$ 97 e Ultra R$ 147 por mês. O Start também tem opção trimestral de R$ 97 por 3 meses.' },
      { q: 'O Achify espelha grupos?', a: 'Sim, a partir do Pro, que inclui 1 grupo monitorado; o Ultra inclui 5. O Start garimpa na Shopee e envia para 1 grupo, mas não monitora grupo de origem.' },
      { q: 'O Achify tem garantia?', a: 'Tem: 7 dias com devolução de 100% do valor pago. O Espelha Grupos também devolve o valor integral em até 7 dias do pagamento, e antes disso deixa testar 7 dias sem cartão.' },
      { q: 'Em que o Achify é melhor?', a: 'No piloto automático da Shopee já no plano de entrada, em Telegram, vitrine, link na bio, menção @todos e selo de desconto na foto.' },
    ],
  },
  '/alternativas/afiliados-turbo': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Afiliados Turbo',
    title: 'Alternativa ao Afiliados Turbo: sem cota de ofertas',
    description: 'O Afiliados Turbo cobra por grupos e por ofertas no mês: 1 grupo e 30 ofertas no Starter. No Espelha Grupos o Pro é R$ 69 por 30 dias, sem limite de grupos.',
    competitorSlugs: ['afiliados-turbo'],
    productPage: {
      href: '/bot-que-busca-ofertas-shopee-whatsapp',
      label: 'Como o robô busca ofertas da Shopee sozinho',
      note: 'O modo de ofertas automáticas, além do espelhamento dos grupos que você segue.',
    },
    guides: [
      { href: '/bot-afiliados-whatsapp', title: 'Bot para afiliados no WhatsApp: os dois modos' },
      { href: '/politica-de-reembolso', title: 'Política de reembolso do Espelha Grupos' },
    ],
    tldr: 'O Afiliados Turbo busca ofertas no Mercado Livre, na Amazon e na Shopee, converte o link e publica nos grupos com janela de horário, intervalo e teto diário. O Starter custa R$ 79,90/mês para 1 grupo e 30 ofertas por mês, o Profissional R$ 111,90 para 5 grupos e 200 ofertas, o Premium R$ 219,90. O Espelha Grupos cobra R$ 39 (Basic) ou R$ 69 (Pro) por 30 dias, sem limite de grupos nem de ofertas por mês.',
    directAnswer: 'O Afiliados Turbo é um sistema que captura ofertas dos marketplaces e de grupos de WhatsApp, classifica por IA, converte o link para a sua etiqueta (Mercado Livre, Amazon e Shopee) e publica nos seus grupos, com categoria por grupo, janela de horário, intervalo mínimo e teto diário. Tem 7 dias grátis sem cartão, sem fidelidade. O preço acompanha duas cotas: grupos de publicação e ofertas por mês — 1 grupo e 30 ofertas no Starter (R$ 79,90/mês), 5 grupos e 200 ofertas no Profissional (R$ 111,90), 999 grupos no Premium (R$ 219,90). O Espelha Grupos não cobra por grupo nem por oferta: o Basic, de R$ 39 por 30 dias, espelha os grupos que você segue em 6 lojas, e o Pro, de R$ 69, acrescenta canais, filas, controle de ritmo e a busca automática de ofertas da Shopee. A busca por categoria com classificação por IA e a vitrine com domínio próprio são pontos em que o Afiliados Turbo entrega mais.',
    rows: [
      { key: 'preco', label: 'Preço de entrada', produto: 'Basic R$ 39 por 30 dias.', concorrente: 'Starter R$ 79,90/mês.', reading: 'O nosso plano de entrada custa menos da metade.' },
      { key: 'cota', label: 'Pelo que você paga', produto: 'Pelo plano. Sem limite de grupos nem de ofertas por mês.', concorrente: 'Por grupos de publicação e ofertas por mês: 1 e 30 (Starter), 5 e 200 (Profissional), 999 e 9999 (Premium).', reading: '30 ofertas por mês é uma por dia; confira quantas você publica hoje.' },
      { key: 'busca', label: 'Oferta sem grupo de origem', produto: 'No Pro, busca automática de ofertas da Shopee por tema, desconto mínimo e ordem de busca.', concorrente: 'Catálogo de ofertas dos marketplaces classificado por IA, com categoria por grupo; busca de produtos no Mercado Livre.', reading: 'Os dois buscam oferta sozinhos; a classificação por categoria é um ponto forte deles.' },
      { key: 'lojas', label: 'Lojas com o seu link', produto: 'Seis: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress.', concorrente: 'Três com a sua etiqueta (Mercado Livre, Amazon e Shopee); outras 15 só reconhecidas.', reading: 'Se você divulga Magalu, SHEIN ou AliExpress, nós convertemos o link.' },
      { key: 'teste', label: 'Teste e devolução', produto: '7 dias grátis sem cartão; reembolso integral em até 7 dias do pagamento.', concorrente: '7 dias grátis sem cartão, sem fidelidade e sem multa.', reading: 'Os dois deixam testar antes de pagar.' },
    ],
    criteria: ['Quantas ofertas você publica por mês', 'Quantos grupos recebem as ofertas', 'Se divulga Magalu, SHEIN ou AliExpress', 'Se quer ofertas separadas por categoria para cada grupo', 'Se precisa de vitrine com domínio próprio'],
    limitations: ['Nenhuma ferramenta pode garantir vendas ou comissões.', 'Use o robô somente em grupos e canais nos quais você tem autorização para publicar.', 'Revise preço, cupom, estoque e link de afiliado antes da divulgação.', 'Preço e limites de qualquer concorrente mudam sem aviso — confirme na página oficial antes de decidir.'],
    botinhoDifferentials: ['Sem cota de ofertas por mês', 'Grupos ilimitados, sem faixa por quantidade', 'Seis lojas convertidas com o seu link', 'Espelhamento no Basic de R$ 39 por 30 dias', 'Busca automática de ofertas da Shopee no Pro de R$ 69', 'Reembolso integral em até 7 dias do pagamento'],
    bestFit: [
      'Escolha o Espelha Grupos se você publica mais de uma oferta por dia, em vários grupos, ou divulga Magalu, SHEIN ou AliExpress.',
      'Escolha o Afiliados Turbo se quer um catálogo de ofertas classificado por IA, com categorias diferentes para cada grupo, e vitrine com domínio próprio no Premium.',
      'O Afiliados Turbo também é uma boa escolha para quem quer ver a fila e o ritmo de cada grupo em detalhe antes de publicar.',
    ],
    notIdealFit: [
      'O Afiliados Turbo não é ideal para quem publica muito com orçamento curto: o Starter cobre 30 ofertas por mês e 1 grupo.',
      'O Espelha Grupos não é ideal para quem precisa de vitrine própria ou de classificação de ofertas por categoria.',
      'O Espelha Grupos trabalha somente com WhatsApp.',
    ],
    migrationPath: [
      'Conte quantas ofertas você publica por mês e em quantos grupos.',
      'Liste as lojas que você divulga e confira se estão entre as seis que cobrimos.',
      'Comece os 7 dias grátis e compare pelo histórico de envios.',
      'Cancele a outra só depois de confirmar que grupos, lojas e links funcionam como você espera.',
    ],
    faq: [
      { q: 'Quanto custa o Afiliados Turbo?', a: 'Conforme a página oficial consultada em 23/09/2026: Starter R$ 79,90/mês, Profissional R$ 111,90/mês e Premium R$ 219,90/mês, todos com 7 dias grátis sem cartão.' },
      { q: 'O que o Starter do Afiliados Turbo inclui?', a: '1 grupo de publicação e 30 ofertas por mês, com conversor de links, bio page, publicação automática no WhatsApp e busca de produtos no Mercado Livre.' },
      { q: 'O Espelha Grupos limita ofertas por mês?', a: 'Não. Nem ofertas por mês nem grupos. O que você controla é o ritmo: intervalo entre envios e limite por destino.' },
      { q: 'Em que o Afiliados Turbo é melhor?', a: 'Na classificação das ofertas por IA com categoria por grupo, na tela de fila que mostra o ritmo de cada grupo e na vitrine com domínio próprio.' },
    ],
  },
}

export function getComparisonMetadata(slug) {
  const page = COMPARISON_PAGES[slug]
  const robots = buildSeoRobots(slug)
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: slug },
    ...(robots ? { robots } : {}),
    openGraph: { title: page.title, description: page.description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
  }
}

// `limit` aceita Infinity de propósito — ver o comentário no uso, em
// ComparisonPage. A ordenação continua valendo: as mais próximas primeiro.
function getRelatedComparisonPages(slug, limit = 3) {
  const current = COMPARISON_PAGES[slug]
  if (!current) return []
  const currentCompetitors = new Set(current.competitorSlugs || [])

  return Object.entries(COMPARISON_PAGES)
    .filter(([href]) => href !== slug)
    .map(([href, page]) => {
      const competitors = new Set(page.competitorSlugs || [])
      let overlap = 0
      currentCompetitors.forEach((competitor) => {
        if (competitors.has(competitor)) overlap += 1
      })
      const sameFormatBoost = page.format === current.format ? 1 : 0
      const score = overlap * 10 + sameFormatBoost * 3
      return { href, title: page.title, score }
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

/* Colunas da tabela. Rótulo que diz o que a coluna RESPONDE, não o jargão
 * ("Alternativa" / "Leitura responsável" não diziam nada a quem chega do
 * Google). */
const COMPARISON_TABLE_HEADERS = ['Critério', 'O que cada opção oferece', 'Como ler isso na prática']

const SECTION_IDS = {
  comparativo: 'comparativo',
  decisao: 'decisao',
  alternativas: 'alternativas',
  migracao: 'migracao',
  perguntas: 'perguntas',
}

export function ComparisonPage({ slug }) {
  const page = COMPARISON_PAGES[slug]
  // Todas as outras comparações, não três. Medido em 11/09: o corte em 3, com
  // ranking por sobreposição de concorrente, concentrava os links nas mesmas
  // páginas — /alternativas/proafiliados, /shozap e /promium ficavam com DOIS
  // links de entrada em todo o site, e são justamente as páginas que carregam
  // a maior parte das impressões (buscas por nome de concorrente são 92% do
  // total). Com oito comparações, a lista completa cabe e ainda serve ao
  // leitor: quem está comparando ferramenta quer ver as outras.
  const relatedPages = getRelatedComparisonPages(slug, Number.POSITIVE_INFINITY)
  const siteUrl = getSiteUrl()
  const dates = getEditorialDates(slug)
  const schemas = buildArticleJsonLd({ title: page.title, description: page.description, slug, siteUrl, faq: page.faq, type: 'Article' })
  const hasDifferentials = Array.isArray(page.botinhoDifferentials) && page.botinhoDifferentials.length > 0
  const hasMigration = Array.isArray(page.migrationPath) && page.migrationPath.length > 0
  const competitorSlugs = page.competitorSlugs || []
  // page.rows normalmente é tupla [critério, alternativa, leitura] (ComparisonTable).
  // Uma página pode optar por objetos { key, label, produto, concorrente, reading }
  // para ganhar o comparador interativo por critério (InteractiveComparisonTable).
  const isInteractiveComparison = Array.isArray(page.rows) && page.rows.length > 0 && !Array.isArray(page.rows[0])

  const navItems = [
    { href: `#${SECTION_IDS.comparativo}`, label: 'Comparativo' },
    { href: `#${SECTION_IDS.decisao}`, label: 'Como decidir' },
    ...(competitorSlugs.length > 0 ? [{ href: `#${SECTION_IDS.alternativas}`, label: 'Alternativas avaliadas' }] : []),
    ...(hasMigration ? [{ href: `#${SECTION_IDS.migracao}`, label: 'Como migrar' }] : []),
    { href: `#${SECTION_IDS.perguntas}`, label: 'Perguntas' },
  ]

  const headline = (
    <>
      <span>{page.title.split(' ').slice(0, -2).join(' ')}</span><br />
      <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{page.title.split(' ').slice(-2).join(' ')}</span>
    </>
  )

  return (
    <div className="landing-root comparison-has-sticky">
      <ComparisonPageTracker slug={slug} format={page.format} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <Hero
        eyebrowLabel={page.eyebrow}
        primaryCtaLabel={TRIAL_LABEL}
        headlineOverride={headline}
        subOverride={page.description}
        heroStyle={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-2) 18%, white), transparent)', borderRadius: 24, paddingInline: 20 }}
      />

      <TrustStrip />

      {/* Uma seção só, com um ritmo de espaçamento só. Antes eram 12 <section>
        * de 72px de respiro cada, o que fazia a página parecer não ter fim. */}
      <section className="comparison-section">
        <div className="wrap comparison-stack">
          {/* 1. Resposta curta + porta de entrada para o teste. Quem decide na
            * primeira dobra não pode precisar rolar até o rodapé para clicar. */}
          <SectionCard tone="accent" eyebrow="Resumo rápido" title="A resposta curta">
            <p style={{ color: 'var(--ink)', lineHeight: 1.7, fontSize: 17, maxWidth: '70ch' }}>{page.tldr || page.directAnswer}</p>
            <TrialCta slug={slug} content="tldr-register" />
            <SectionNav items={navItems} />
          </SectionCard>

          {/* 2. Resposta completa, com autoria e datas. */}
          <IntroCard
            eyebrow={page.eyebrow}
            title="Resposta direta"
            body={page.directAnswer}
            pills={[`Por ${EDITORIAL_AUTHOR}`, `Publicado em ${formatDatePtBr(dates.publishedAt)}`, `Atualizado em ${formatDatePtBr(dates.updatedAt)}`]}
            accent
          />

          {/* 3. O comparativo em si — antes ficava depois de "Veja também". */}
          <SectionCard
            id={SECTION_IDS.comparativo}
            eyebrow="Comparativo"
            title="Comparativo lado a lado"
            lead="Cada linha é um critério de decisão, o que cada opção entrega nele e como ler esse dado sem se enganar."
          >
            {isInteractiveComparison ? (
              <InteractiveComparisonTable
                rows={page.rows}
                produtoNome={BRAND_NAME}
                concorrenteNome={competitorSlugs.map((competitorSlug) => getCompetitorBySlug(competitorSlug).name).join(' / ')}
              />
            ) : (
              <ComparisonTable rows={page.rows} headers={COMPARISON_TABLE_HEADERS} />
            )}
            <TrialCta slug={slug} content="tabela-register" variant="inline" label="Testar o Espelha Grupos 7 dias grátis" />
          </SectionCard>

          {/* 4. Decisão: quatro recortes lado a lado, com ícone em vez de bullet. */}
          <div id={SECTION_IDS.decisao} className="comparison-decision-grid">
            <SectionCard eyebrow="Decisão" title="Critérios de decisão">
              <IconList items={page.criteria} />
            </SectionCard>
            <SectionCard tone="soft" eyebrow="Limites" title="Limites importantes">
              <IconList items={page.limitations || PRODUCT_LIMITATIONS} tone="no" />
            </SectionCard>
            {Array.isArray(page.bestFit) && page.bestFit.length > 0 && (
              <SectionCard eyebrow="Melhor encaixe" title="Quem deve usar o quê">
                <IconList items={page.bestFit} />
              </SectionCard>
            )}
            {Array.isArray(page.notIdealFit) && page.notIdealFit.length > 0 && (
              <SectionCard eyebrow="Quando não usar" title="Cenários não ideais">
                <IconList items={page.notIdealFit} tone="no" />
              </SectionCard>
            )}
          </div>

          {/* 5. Diferenciais como chips. O título antigo era fixo e nomeava
            * concorrentes que não têm nada a ver com a página aberta. */}
          {hasDifferentials && (
            <SectionCard
              tone="accent"
              eyebrow={`Diferenciais ${BRAND_NAME}`}
              title={`O que o ${BRAND_NAME} traz nessa comparação`}
              lead={`Pontos que o ${BRAND_NAME} cobre. Os pontos em que a alternativa é melhor estão logo acima, na tabela — comparativo torto não ajuda ninguém a decidir.`}
            >
              {page.richDifferentials ? (
                <DifferentialGrid items={page.botinhoDifferentials} />
              ) : (
                <DifferentialChips items={page.botinhoDifferentials} />
              )}
              <TrialCta slug={slug} content="diferenciais-register" variant="inline" />
            </SectionCard>
          )}

          {/* 6. Perfil de cada alternativa avaliada. */}
          {competitorSlugs.length > 0 && (
            <SectionCard
              id={SECTION_IDS.alternativas}
              eyebrow="Alternativas avaliadas"
              title="Perfil de cada alternativa"
              lead="Preços e limites conforme as páginas públicas de cada ferramenta na data da verificação. Confirme no site oficial antes de decidir — eles mudam."
            >
              <div className="comparison-competitor-grid">
                {page.productProfile && <CompetitorCard competitor={page.productProfile} />}
                {competitorSlugs.map((competitorSlug) => (
                  <CompetitorCard key={competitorSlug} competitor={getCompetitorBySlug(competitorSlug)} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* 7. Migração em passos numerados (antes renderizada duas vezes). */}
          {hasMigration && (
            <SectionCard
              id={SECTION_IDS.migracao}
              eyebrow="Migração"
              title="Como trocar sem parar a operação"
              lead="Seus grupos são seus, no seu WhatsApp. O que muda é qual ferramenta se conecta a eles — por isso dá para rodar em paralelo antes de cancelar a atual."
            >
              <StepList steps={page.migrationPath} />
              <TrialCta slug={slug} content="migracao-register" variant="inline" label="Começar o teste de 7 dias" />
            </SectionCard>
          )}

          {/* 8. Perguntas. */}
          <SectionCard id={SECTION_IDS.perguntas} eyebrow="Perguntas" title="Perguntas frequentes">
            <div className="comparison-faq">
              {page.faq.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </SectionCard>

          {/* 9. Fechamento com a chamada principal. */}
          <SectionCard tone="accent" eyebrow={BRAND_NAME} title={`Onde o ${BRAND_NAME} se encaixa?`}>
            <p style={{ color: 'var(--ink)', lineHeight: 1.7, maxWidth: '70ch' }}>{page.productDefinition || PRODUCT_DEFINITION}</p>
            {/*
              A saída para a página comercial vem ANTES do teste, e por medição:
              em 30 dias, as sete páginas /alternativas/* somaram 147 visitas e
              ZERO cadastros, enquanto as comerciais converteram 15,4% da visita
              em cadastro. Mesmo tema, resultados opostos —
              /alternativas/achadinhos-bot fez 3.400 impressões e 0 cadastro; a
              /bot-achadinhos-whatsapp fez 1.827 e 21.

              Quem chega comparando ferramenta ainda não decidiu comprar; mandá-lo
              direto ao cadastro pula a etapa que de fato converte. Este link era
              a última linha de uma lista de rodapé chamada "Outros comparativos"
              — ou seja, anunciado como mais um comparativo.
            */}
            {page.productPage ? (
              <p style={{ marginTop: 18, color: 'var(--ink)', lineHeight: 1.7, maxWidth: '70ch' }}>
                <Link href={page.productPage.href} data-comparison-cta="product-page" style={{ fontWeight: 800 }}>
                  {page.productPage.label}
                </Link>
                {page.productPage.note ? ` — ${page.productPage.note}` : null}
              </p>
            ) : null}
            <TrialCta slug={slug} content="bottom-register" label={`Testar o ${BRAND_NAME} 7 dias grátis`} />
          </SectionCard>

          {/* 10. Links de apoio, no fim — onde link de saída atrapalha menos. */}
          <div className="comparison-decision-grid">
            <SectionCard eyebrow="Veja também" title="Outros comparativos">
              <ul className="comparison-links">
                <li><Link href="/comparativos" data-comparison-cta="related-hub">Hub de comparativos do {BRAND_NAME}</Link></li>
                {relatedPages.map((related) => (
                  <li key={related.href}>
                    <Link href={related.href} data-comparison-cta="related-page">{related.title}</Link>
                  </li>
                ))}
                {(page.guides ?? []).map((guide) => (
                  <li key={guide.href}>
                    <Link href={guide.href} data-comparison-cta="related-guide">{guide.title}</Link>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard eyebrow="Fontes" title="Políticas para revisar antes de operar" lead="As políticas oficiais mudam e devem ser revisadas pela pessoa responsável antes de ampliar volume.">
              <ul className="comparison-links">
                {COMPARISON_SOURCE_LINKS.map((source) => (
                  <li key={source.href}>
                    <a href={source.href} data-comparison-cta="source-link" rel="noreferrer">{source.label}</a>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          {/* 11. Por loja — ver COMPARISON_STORE_LINKS. */}
          <SectionCard
            eyebrow="Por loja"
            title="Você é afiliada de qual loja?"
            lead="A comissão, o formato do link e o que a loja aceita mudam de uma para outra. Cada página mostra como a oferta daquela loja sai no WhatsApp."
          >
            <ul className="comparison-links">
              {COMPARISON_STORE_LINKS.map((store) => (
                <li key={store.href}>
                  <Link href={store.href} data-comparison-cta="store-page">
                    Divulgar {store.label} no WhatsApp
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </section>

      <FinalCTA />
      <Footer />
      <StickyTrialCta slug={slug} />
    </div>
  )
}
