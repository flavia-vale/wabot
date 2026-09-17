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
    description: 'O AchadinhosBot cobra por número de grupos e cobre só Shopee. No Espelha Grupos: grupos ilimitados, 4 lojas e 7 dias grátis por R$ 39/30 dias.',
    competitorSlugs: ['achadinhosbot', 'achadinho-pro'],
    // Par recíproco do `competitorNudge` de /bot-achadinhos-whatsapp: as duas
    // páginas ranqueavam para as mesmas consultas e não se linkavam, então o
    // Google não tinha como saber qual responde o quê. Aqui fica a busca por
    // NOME do concorrente; lá, a busca genérica por "bot para achadinhos".
    productPage: {
      href: '/bot-achadinhos-whatsapp',
      label: 'Como funciona o bot para achadinhos no WhatsApp',
      note: 'Grupos ilimitados, quatro lojas e 7 dias grátis.',
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
    title: 'Alternativa ao Achadinho Pro: 4 lojas por R$ 39',
    description: 'O Achadinho Pro cobre só Shopee no plano de entrada. No Espelha Grupos, Shopee, Amazon, Mercado Livre e Magalu já entram por R$ 39/30 dias, com 7 dias grátis.',
    competitorSlugs: ['achadinho-pro'],
    productPage: {
      href: '/bot-achadinhos-whatsapp',
      label: 'Como funciona o bot para achadinhos no WhatsApp',
      note: 'Grupos ilimitados, quatro lojas e 7 dias grátis.',
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
      note: 'Grupos ilimitados, quatro lojas e 7 dias grátis.',
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
  '/botinho-vs-planilha-manual': {
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
  '/botinho-vs-ferramentas-genericas-automacao': {
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
    tldr: 'Não escolha por promessa de ganho: escolha por processo confiável, rastreabilidade e aderência às políticas das plataformas.',
    directAnswer: 'Os melhores bots para afiliados no WhatsApp devem ser avaliados por critérios de processo, não por promessa de comissão. Priorize revisão de link monetizado, controle de grupos, filtros, cadência, logs, limites contra spam, clareza de preço e suporte a plataformas realmente usadas pela operação.',
    rows: [
      ['Link monetizado', 'A ferramenta ajuda a conferir ou converter links suportados sem remover tags?', 'Reduz risco operacional, mas não elimina revisão humana.'],
      ['Grupos e destinos', 'Existe separação clara entre origem, destino, nicho e prioridade?', 'Evita publicar no público errado.'],
      ['Cadência', 'Há intervalos, filtros e controle para evitar repetição?', 'Ajuda a proteger experiência dos grupos.'],
      ['Logs', 'A operação consegue auditar envio, falha e campanha?', 'Permite aprender e corrigir processo.'],
    ],
    criteria: ['Transparência de preço', 'Limites de uso responsável', 'Logs e auditoria', 'Suporte a afiliados', 'Ausência de promessa de ganho garantido'],
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
      { q: 'O que evitar ao escolher um bot?', a: 'Evite promessa de comissão garantida, disparo sem consentimento, ausência de logs e ferramenta que não explica limites de uso.' },
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
