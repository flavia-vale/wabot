import './landing.css'
import Link from 'next/link'
import { Hero } from '@/components/landing/Hero'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { IntroCard } from '@/components/landing/IntroCard'
import { BRAND_NAME, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS } from '@/lib/marketing-content'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'
import { getSiteUrl } from '@/lib/site-url'
import { getCompetitorBySlug } from '@/lib/competitors-data'
import { ComparisonPageTracker } from '@/components/marketing/ComparisonPageTracker'

export const COMPARISON_SOURCE_LINKS = [
  { label: 'Política de Mensagens do WhatsApp Business', href: 'https://whatsappbusiness.com/pt-br/policy/' },
  { label: 'Termos do Programa de Afiliados e Criadores do Mercado Livre', href: 'https://www.mercadolivre.com.br/ajuda/30228' },
  { label: 'Amazon Associates Program Operating Agreement', href: 'https://affiliate-program.amazon.com/help/operating/agreement/' },
]

export const COMPARISON_PAGES = {
  '/alternativas/bot-para-whatsapp-afiliados': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Afiliados',
    title: 'Alternativas de bot para afiliados no WhatsApp: como escolher em 2026',
    description: 'Compare caminhos para divulgar ofertas em grupos de WhatsApp: operação manual, planilha, automação genérica, ferramenta oficial de mensagens e BOTinho.',
    competitorSlugs: ['achadinho-pro', 'achadinhosbot', 'proafiliados-com', 'lumi-ofertas-inteligentes', 'gigi-bot', 'manual-spreadsheet-workflow', 'generic-automation-tools', 'official-service-api-tools'],
    tldr: 'Se você está pesquisando alternativas de bot para WhatsApp, compare foco operacional, capacidade de governança e custo de manutenção contínua antes de decidir.',
    directAnswer: 'A melhor alternativa de bot para WhatsApp para afiliados depende do estágio da operação. Para poucos grupos, planilha e revisão manual podem bastar. Para rotina com origem, destino, link monetizado, filtros, cadência e logs, o BOTinho foi desenhado para organizar esse fluxo sem prometer ganho financeiro ou burlar regras das plataformas.',
    rows: [
      ['Planilha + envio manual', 'Baixo custo e controle humano total.', 'Não escala bem, depende de lembrar horários e dificulta auditoria por campanha.'],
      ['Automação genérica', 'Flexível para equipes técnicas.', 'Pode exigir integrações frágeis, manutenção e atenção extra a regras do WhatsApp.'],
      ['Ferramentas de atendimento/API oficial', 'Boas para atendimento, templates e conversas com clientes.', 'Nem sempre resolvem curadoria de oferta, grupos de origem/destino e link de afiliado.'],
      ['BOTinho', 'Foco em afiliados, curadores de ofertas e admins de grupos com filtros, cadência, conversão de links suportados e logs.', 'Não substitui revisão humana nem autorização dos grupos e plataformas.'],
    ],
    criteria: ['Revisão de link monetizado', 'Controle de grupos de origem e destino', 'Cadência anti-ruído', 'Histórico de envios', 'Limites claros contra spam'],
    botinhoDifferentials: ['Menor preço do mercado', 'Grupos ilimitados', 'Plataformas suportadas: 4', 'Conversão de links avançada', 'Funcionamento 24/7 sem limites', 'Broadcast em massa', 'Mensagem de boas-vindas', 'Canais & Comunidades', 'Histórico de logs', 'Suporte por WhatsApp', 'Sem cartão de crédito', 'Pronto em 5 minutos', 'Cancele quando quiser', 'Teste grátis'],
    bestFit: [
      'Escolha BOTinho quando o foco principal é rotina recorrente de ofertas em grupos com filtros, cadência e histórico operacional.',
      'Escolha automação genérica quando sua equipe já mantém integrações customizadas e precisa máxima flexibilidade técnica.',
      'Escolha processo manual quando o volume ainda é baixo e a revisão humana cobre toda a operação sem atraso.',
    ],
    notIdealFit: [
      'BOTinho não é ideal para quem busca automação irrestrita sem revisão humana e sem limites de uso responsável.',
      'Automação genérica não é ideal para times sem capacidade de manutenção técnica contínua.',
      'Processo manual não é ideal para operação com muitos grupos e publicação diária em escala.',
    ],
    migrationPath: [
      'Mapeie grupos de origem/destino e critérios mínimos de qualidade de link.',
      'Rode uma semana em paralelo (manual + fluxo novo) para validar cadência e qualidade.',
      'Mantenha checklist de revisão humana e compare resultado por campanha antes do corte final.',
    ],
    faq: [
      { q: 'BOTinho é a melhor opção para qualquer afiliado?', a: 'Não. Se você divulga poucas ofertas por semana, um processo manual bem revisado pode ser suficiente. O BOTinho faz mais sentido quando há grupos, frequência e necessidade de logs.' },
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
    title: 'Alternativa ao AchadinhosBot: comparativo honesto',
    description: 'Compare AchadinhosBot, Achadinho Pro e BOTinho para automatizar grupos de achadinhos no WhatsApp: preço, marketplaces e teste grátis. Dados de 31/07/2026.',
    competitorSlugs: ['achadinhosbot', 'achadinho-pro'],
    // Par recíproco do `competitorNudge` de /bot-achadinhos-whatsapp: as duas
    // páginas ranqueavam para as mesmas consultas e não se linkavam, então o
    // Google não tinha como saber qual responde o quê. Aqui fica a busca por
    // NOME do concorrente; lá, a busca genérica por "bot para achadinhos".
    productPage: {
      href: '/bot-achadinhos-whatsapp?utm_source=comparativo&utm_medium=internal&utm_campaign=canais-preservacao&utm_content=comparison_product_backlink',
      label: 'Como funciona o bot para achadinhos no WhatsApp',
    },
    tldr: 'Se você opera só Shopee e quer escalar por número de grupos, o AchadinhosBot resolve. Se precisa de Mercado Livre, Amazon e Magalu na mesma conta, compare o custo total antes de decidir.',
    directAnswer: 'O AchadinhosBot automatiza grupos de achadinhos no WhatsApp com foco em Shopee, cobrando por faixa de grupos (R$ 59,90 por 1 grupo até R$ 199,90 por 15 grupos) e oferecendo teste grátis de 3 dias. As alternativas mais próximas são o Achadinho Pro, que adiciona Mercado Livre e Amazon a partir de R$ 59,97/mês, e o BOTinho, que cobre quatro marketplaces e converte também links de cupom.',
    rows: [
      ['Preço de entrada', 'AchadinhosBot: R$ 59,90/mês (1 grupo). Achadinho Pro: R$ 49,97/mês (só Shopee). BOTinho: R$ 39/30 dias.', 'Compare pelo número de grupos que você realmente usa, não só pelo preço da primeira faixa.'],
      ['Marketplaces', 'AchadinhosBot: Shopee. Achadinho Pro: Shopee no Basic, +ML e Amazon no Pro. BOTinho: Shopee, Amazon, Mercado Livre e Magalu.', 'Se você só divulga Shopee, cobertura extra não vale nada. Pese pelo que você usa hoje.'],
      ['Como escala o preço', 'AchadinhosBot: por faixa de grupos (1 → 5 → 10 → 15). Achadinho Pro: grupos ilimitados por automação. BOTinho: sem limite de grupos.', 'Escalar por faixa é previsível, mas fica caro se a operação cresce em grupos.'],
      ['Teste grátis', 'AchadinhosBot: 3 dias, com marca d’água e conexão que o próprio site descreve como "menos estável". BOTinho: 7 dias com o plano Pro completo.', 'Teste limitado mostra menos do produto real. Veja o que está incluído antes de concluir.'],
      ['Conversão de cupom', 'Não indicada nas páginas públicas dos dois concorrentes. BOTinho converte link de cupom, não só de produto.', 'Só faz diferença para quem divulga campanha de cupom além de produto avulso.'],
    ],
    criteria: ['Número de grupos que você opera hoje', 'Marketplaces que realmente usa', 'Se precisa converter cupom além de produto', 'O que o teste grátis deixa você validar', 'Transparência de preço e de limites'],
    botinhoDifferentials: ['Quatro marketplaces incluídos', 'Conversão de link de cupom, não só de produto', 'Sem limite de grupos', 'Teste grátis de 7 dias com o Pro completo', 'Canais e Comunidades do WhatsApp', 'Histórico completo de envios'],
    bestFit: [
      'Escolha o AchadinhosBot se opera só Shopee, quer preço previsível por faixa de grupos e valoriza suporte 24/7 já no plano de entrada.',
      'Escolha o Achadinho Pro se quer os três marketplaces principais pagando pouco mais que o plano básico, e se grupos ilimitados por automação resolve sua estrutura.',
      'Escolha o BOTinho se precisa de quatro marketplaces, converte campanhas de cupom além de produto, ou quer validar a operação completa antes de pagar.',
    ],
    notIdealFit: [
      'O AchadinhosBot não é ideal para quem divulga Mercado Livre, Amazon ou Magalu — a tabela pública de preços cobre Shopee.',
      'O Achadinho Pro não é ideal para quem quer testar antes de pagar: a página de preços não indica teste grátis.',
      'O BOTinho não é ideal para quem quer automação sem revisão humana ou opera em Telegram — o produto é só WhatsApp.',
    ],
    migrationPath: [
      'Liste seus grupos de origem e de destino e conte quantos realmente recebem oferta por semana.',
      'Confira em qual faixa de preço esse número cai em cada ferramenta — é aí que a diferença de custo aparece, não no plano de entrada.',
      'Rode uma semana em paralelo antes de cancelar a ferramenta atual, comparando qualidade do link convertido e do preview.',
    ],
    faq: [
      { q: 'Qual a melhor alternativa ao AchadinhosBot?', a: 'Depende do que você opera. Para quem fica só na Shopee, o próprio AchadinhosBot resolve e tem suporte 24/7 no plano de entrada. Para quem precisa de Mercado Livre, Amazon e Magalu na mesma conta, Achadinho Pro e BOTinho cobrem mais marketplaces.' },
      { q: 'Quanto custa o AchadinhosBot?', a: 'Conforme a página pública consultada em 31/07/2026: R$ 59,90/mês para 1 grupo, R$ 99,90 para 5, R$ 149,90 para 10 e R$ 199,90 para 15 grupos, além de um teste grátis de 3 dias. Confirme na página oficial antes de decidir — preços mudam.' },
      { q: 'O AchadinhosBot tem teste grátis?', a: 'Sim, 3 dias sem cartão. Vale saber o que está incluído: 1 grupo, 30 envios por dia, intervalo mínimo de 10 minutos, marca d’água nas mensagens e uma conexão que o próprio site descreve como "menos estável".' },
      { q: 'Em que o AchadinhosBot é melhor que o BOTinho?', a: 'Em dois pontos concretos: o preço escala de forma muito previsível por faixa de grupos, e o suporte 24/7 por e-mail e WhatsApp aparece já no plano de entrada. Se sua operação é só Shopee e cabe numa faixa, essa simplicidade é uma vantagem real.' },
      { q: 'Trocar de ferramenta faz perder os grupos?', a: 'Não. Os grupos são seus, no seu WhatsApp. O que muda é qual ferramenta se conecta a eles. Por isso dá para rodar uma semana em paralelo antes de cancelar a atual.' },
    ],
  },
  '/alternativas/proafiliados': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · ProAfiliados',
    title: 'Alternativa ao ProAfiliados: comparativo honesto para bot de afiliados no WhatsApp',
    description: 'Compare ProAfiliados e BOTinho para automatizar ofertas de afiliado no WhatsApp: plano grátis, preço por plano, tag nas mensagens e o que cada um cobre. Dados verificados em 04/08/2026.',
    competitorSlugs: ['proafiliados-com'],
    tldr: 'Se você quer testar automação de afiliados sem pagar nada, o plano grátis do ProAfiliados é o mais generoso do mercado — e não é trial, é grátis para sempre. O custo é a tag deles nas suas mensagens.',
    directAnswer: 'O ProAfiliados é um bot de afiliados para WhatsApp e Telegram com plano gratuito permanente (grupos ilimitados, monitoramento 24/7 e 5 plataformas), cobrando R$ 50/mês no Premium para remover a tag "proafiliados" das mensagens e R$ 100/mês no Premium Plus para tirar os anúncios do sistema. O pagamento é via PIX, sem cartão. A alternativa mais próxima é o BOTinho, que não insere tag nem anúncio em nenhum plano, mas não tem camada gratuita permanente — o teste grátis é de 7 dias.',
    rows: [
      ['Plano grátis', 'ProAfiliados: grátis para sempre, com grupos ilimitados, 5 plataformas e monitoramento 24/7. BOTinho: teste de 7 dias com o Pro completo, depois é pago.', 'Se o seu critério é não pagar nada nunca, o ProAfiliados ganha sem discussão. Não é trial disfarçado.'],
      ['O que o grátis custa', 'ProAfiliados: as mensagens saem com a tag "proafiliados" e o sistema insere anúncios próprios. BOTinho: não insere tag nem anúncio em nenhum plano, inclusive no teste.', 'A tag aparece para os seus membros. Se o grupo é sua marca, isso pesa; se você está validando, não pesa nada.'],
      ['Preço para tirar a tag', 'ProAfiliados: R$ 50/mês (Premium). BOTinho: R$ 39/30 dias no Basic, R$ 69 no Pro.', 'Comparar Premium (R$50) com Basic (R$39) só vale se os recursos que você usa estiverem no Basic.'],
      ['Preço para tirar os anúncios', 'ProAfiliados: R$ 100/mês (Premium Plus). BOTinho: não se aplica — não há anúncio do sistema em nenhum plano.', 'É o ponto onde a comparação de preço vira outra: R$ 100 contra R$ 69.'],
      ['Pagamento', 'ProAfiliados: PIX, sem cartão de crédito. BOTinho: cartão e PIX via Mercado Pago.', 'PIX sem cartão é vantagem real para quem não quer recorrência no cartão.'],
      ['Telegram', 'ProAfiliados: WhatsApp e Telegram. BOTinho: só WhatsApp (grupos, canais e comunidades).', 'Se parte da sua audiência está no Telegram, o BOTinho não atende.'],
    ],
    criteria: ['Se você aceita tag e anúncio de terceiro nas suas mensagens', 'Se opera Telegram além de WhatsApp', 'Se precisa converter cupom além de link de produto', 'Quanto tempo você quer validar antes de pagar', 'Se prefere pagar por PIX em vez de cartão'],
    botinhoDifferentials: ['Nenhuma tag ou anúncio de terceiro nas mensagens, em nenhum plano', 'Conversão de link de cupom, não só de produto', 'Canais e Comunidades do WhatsApp', 'Controle de cadência por destino e limites por hora/dia', 'Histórico completo de envios, incluindo o que foi bloqueado por repetição'],
    bestFit: [
      'Escolha o ProAfiliados se o orçamento hoje é zero e você quer validar a ideia sem pagar nada — o plano grátis é permanente e cobre grupos ilimitados.',
      'Escolha o ProAfiliados também se opera Telegram junto com o WhatsApp, ou se prefere pagar por PIX sem cartão.',
      'Escolha o BOTinho se o grupo é a sua marca e você não quer tag nem anúncio de terceiro nas mensagens, ou se divulga campanha de cupom além de produto avulso.',
    ],
    notIdealFit: [
      'O ProAfiliados não é ideal para quem trata o grupo como marca própria: no plano grátis as mensagens carregam a tag deles, e os anúncios do sistema só somem no plano de R$ 100/mês.',
      'O BOTinho não é ideal para quem quer uma camada gratuita permanente — o teste grátis são 7 dias, depois é pago.',
      'O BOTinho também não atende quem publica no Telegram: o produto é só WhatsApp.',
    ],
    migrationPath: [
      'Use o plano grátis do ProAfiliados primeiro. Ele é permanente e serve para responder a pergunta mais importante: automação resolve o seu problema?',
      'Se resolver, decida o que incomoda mais — a tag nas mensagens ou o custo mensal. Isso define qual ferramenta faz sentido.',
      'Rode uma semana em paralelo antes de cancelar qualquer coisa, comparando a qualidade do link convertido e do preview no celular.',
    ],
    faq: [
      { q: 'O ProAfiliados é grátis mesmo?', a: 'Sim, e não é trial: a página de preços consultada em 04/08/2026 descreve o plano Grátis como "R$ 0 para sempre", com grupos ilimitados, monitoramento 24/7 e 5 plataformas. A contrapartida é que as mensagens saem com a tag "proafiliados" e o sistema insere anúncios próprios.' },
      { q: 'Quanto custa o ProAfiliados?', a: 'Conforme a página pública consultada em 04/08/2026: Grátis (R$ 0 para sempre), Premium a R$ 50/mês e Premium Plus a R$ 100/mês. O pagamento é via PIX, sem cartão de crédito, e o cancelamento pode ser feito a qualquer momento. Confirme na página oficial antes de decidir — preços mudam.' },
      { q: 'Em que o ProAfiliados é melhor que o BOTinho?', a: 'Em três pontos concretos. O plano gratuito permanente não tem equivalente aqui — o nosso teste grátis dura 7 dias. O ProAfiliados cobre Telegram, e o BOTinho é só WhatsApp. E o pagamento por PIX sem cartão é mais simples para quem não quer recorrência no cartão de crédito.' },
      { q: 'O que é a "tag proafiliados" nas mensagens?', a: 'Segundo a própria página de preços, o plano grátis inclui essa tag nas mensagens enviadas, e removê-la é justamente o que o plano Premium (R$ 50/mês) oferece. Na prática, os membros do seu grupo veem a marca da ferramenta junto com a sua oferta.' },
      { q: 'Vale a pena pagar R$ 100 no Premium Plus?', a: 'Depende de quanto os anúncios do sistema incomodam. Esse é o único plano da linha que os remove por completo, e a página o descreve como voltado para times e agências. Se você opera sozinha e a tag já saiu no Premium, o salto para R$ 100 precisa se justificar por outra coisa.' },
    ],
  },
  '/alternativas/shozap': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Shozap',
    title: 'Alternativa ao Shozap: comparativo honesto de preço e limites por plano',
    description: 'Compare Shozap e BOTinho para divulgar ofertas no WhatsApp: preço por plano, quantas conexões e grupos cabem, e quais marketplaces entram em cada faixa. Dados verificados em 04/08/2026.',
    competitorSlugs: ['shozap'],
    tldr: 'O Shozap escala por cota — conexões, campanhas, grupos por campanha e contas de marketplace. Some seus grupos antes de comparar preço: o plano de entrada cobre 3 grupos por campanha e só Shopee.',
    directAnswer: 'O Shozap é uma plataforma de divulgação para WhatsApp e Telegram que cobra por cota de uso: R$ 50/mês no Básico (1 conexão de cada, 3 campanhas, 3 grupos por campanha, só Shopee), R$ 100/mês no Intermediário (adiciona Mercado Livre e Amazon), R$ 150/mês no Elite (adiciona Shein e Magalu) e R$ 300/mês no Avançado. A alternativa mais próxima é o BOTinho, que cobre quatro marketplaces já no plano de R$ 39 e não limita número de grupos, mas atende só WhatsApp.',
    rows: [
      ['Preço de entrada', 'Shozap: R$ 50/mês (Básico). BOTinho: R$ 39/30 dias (Basic).', 'A diferença real não está aqui — está no que cada plano de entrada inclui.'],
      ['Marketplaces no plano de entrada', 'Shozap: só Shopee (1 conta). Mercado Livre e Amazon a partir de R$ 100/mês; Shein e Magalu a partir de R$ 150/mês. BOTinho: Shopee, Amazon, Mercado Livre e Magalu já no Basic.', 'Se você divulga mais de um marketplace, compare o plano de R$ 100 do Shozap, não o de R$ 50.'],
      ['Limite de grupos', 'Shozap: 3 grupos por campanha no Básico, 10 no Intermediário, 50 no Elite, ilimitado no Avançado. BOTinho: sem limite de grupos.', 'Some quantos destinos você tem hoje. É a conta que muda a decisão.'],
      ['Conexões de WhatsApp', 'Shozap: 1 no Básico, 3 no Intermediário, 6 no Elite, 15 no Avançado. BOTinho: uma sessão por conta.', 'Se você opera vários números, o Shozap resolve isso de forma direta e o BOTinho não.'],
      ['Telegram', 'Shozap: incluído em todos os planos, no mesmo número de conexões do WhatsApp. BOTinho: não atende Telegram.', 'Vantagem clara do Shozap para quem tem audiência nos dois lugares.'],
      ['Recursos que o BOTinho não tem', 'Shozap: créditos de IA por mês e créditos de SMS a partir do Intermediário.', 'Se SMS faz parte da sua operação, isso não tem equivalente aqui.'],
    ],
    criteria: ['Quantos grupos de destino você tem hoje', 'Quantos marketplaces você realmente divulga', 'Se opera mais de um número de WhatsApp', 'Se parte da audiência está no Telegram', 'Se precisa converter cupom além de link de produto'],
    botinhoDifferentials: ['Quatro marketplaces já no plano de entrada', 'Sem limite de grupos ou de campanhas', 'Conversão de link de cupom, não só de produto', 'Teste grátis de 7 dias com o Pro completo', 'Canais e Comunidades do WhatsApp', 'Histórico de envios com o que foi bloqueado por repetição'],
    bestFit: [
      'Escolha o Shozap se opera WhatsApp e Telegram juntos — ele cobre os dois no mesmo plano, inclusive no de entrada.',
      'Escolha o Shozap também se precisa de vários números de WhatsApp na mesma conta, ou se créditos de SMS fazem parte da sua operação.',
      'Escolha o BOTinho se divulga mais de um marketplace desde já, ou se o número de grupos cresce e você não quer que isso empurre o plano para cima.',
    ],
    notIdealFit: [
      'O Shozap não é ideal para quem divulga Mercado Livre ou Amazon com orçamento apertado: no plano de R$ 50 só entra Shopee.',
      'O Shozap também não é ideal para quem tem muitos grupos de destino — o limite por campanha é o que empurra o custo.',
      'O BOTinho não é ideal para quem publica no Telegram, opera vários números de WhatsApp ou precisa de SMS.',
    ],
    migrationPath: [
      'Conte quantos grupos de destino você realmente usa por semana e em quantas campanhas eles se organizam.',
      'Veja em qual faixa do Shozap esse número cai — e compare com o custo do BOTinho, que não muda com o número de grupos.',
      'Se você usa Telegram, some o que custaria manter as duas ferramentas antes de decidir por uma só.',
    ],
    faq: [
      { q: 'Quanto custa o Shozap?', a: 'Conforme a página pública consultada em 04/08/2026: Básico R$ 50/mês, Intermediário R$ 100/mês, Elite R$ 150/mês e Avançado R$ 300/mês. O site tem um botão "Começar grátis", mas a tela de preços consultada não detalha os limites desse acesso gratuito. Confirme na página oficial antes de decidir.' },
      { q: 'O plano de R$ 50 do Shozap cobre quais lojas?', a: 'Só Shopee, com 1 conta. Mercado Livre e Amazon aparecem a partir do Intermediário (R$ 100/mês), e Shein e Magalu a partir do Elite (R$ 150/mês). Se você divulga mais de um marketplace, a comparação justa é contra o plano de R$ 100, não o de R$ 50.' },
      { q: 'Em que o Shozap é melhor que o BOTinho?', a: 'Em três coisas objetivas. Ele cobre Telegram junto com WhatsApp em todos os planos, permite várias conexões de WhatsApp na mesma conta (3 no Intermediário, 15 no Avançado) e inclui créditos de SMS a partir do Intermediário. Nenhuma dessas três existe no BOTinho.' },
      { q: 'O que são "grupos por campanha"?', a: 'É o teto de destinos que cada campanha de envio alcança: 3 no Básico, 10 no Intermediário, 50 no Elite e ilimitado no Avançado. É a cota que mais costuma definir o plano necessário, porque cresce junto com a operação — vale somar seus destinos antes de comparar preço.' },
      { q: 'Trocar de ferramenta faz perder os grupos?', a: 'Não. Os grupos são seus, no seu WhatsApp. O que muda é qual ferramenta se conecta a eles, então dá para rodar as duas em paralelo por uma semana antes de cancelar a atual.' },
    ],
  },
  '/alternativas/fluxopromo': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · FluxoPromo',
    title: 'Alternativa ao FluxoPromo: comparativo honesto para quem divulga ofertas',
    description: 'Compare FluxoPromo e BOTinho para divulgar ofertas de afiliado: plano grátis, preço por plano, limite de ofertas por dia e a diferença entre feed de ofertas e espelhamento de grupos. Verificado em 04/08/2026.',
    competitorSlugs: ['fluxopromo'],
    tldr: 'Antes de comparar preço, entenda que são propostas diferentes: o FluxoPromo entrega ofertas prontas por nicho, o BOTinho espelha os grupos que você escolhe acompanhar. Uma não substitui a outra.',
    directAnswer: 'O FluxoPromo distribui ofertas de afiliado por nicho para canais de Telegram e destinos de WhatsApp, com plano gratuito permanente (20 ofertas/dia, 3 lojas, 1 canal de Telegram) e planos pagos de R$ 37 a R$ 197/mês cobrados por teto de ofertas por dia. O BOTinho funciona de outra forma: monitora os grupos de origem que você escolhe, converte os links para o seu código e republica nos seus destinos, a partir de R$ 39/30 dias.',
    rows: [
      ['De onde vêm as ofertas', 'FluxoPromo: da curadoria da própria ferramenta, escolhida por nicho e loja (+15 nichos disponíveis). BOTinho: dos grupos de origem que você já acompanha e escolhe monitorar.', 'Essa é a diferença que importa. Compare isso antes de comparar preço.'],
      ['Plano grátis', 'FluxoPromo: permanente, com 20 ofertas/dia, 3 lojas e 1 canal de Telegram. BOTinho: teste de 7 dias com o Pro completo.', 'O grátis do FluxoPromo não publica em WhatsApp — só em Telegram.'],
      ['Preço de entrada pago', 'FluxoPromo: R$ 37/mês (Essencial), com 1 destino de WhatsApp. BOTinho: R$ 39/30 dias.', 'O FluxoPromo tem o plano pago mais barato entre os concorrentes que mapeamos.'],
      ['Como o preço escala', 'FluxoPromo: por teto de ofertas/dia (20 → 50 → 150 → ilimitado) e por número de destinos. BOTinho: sem limite de ofertas nem de grupos.', 'Se você publica muita oferta por dia, é o teto diário que define o plano.'],
      ['Lojas cobertas', 'FluxoPromo: 3 no grátis, 4 no Essencial, 5 no Pro e 12 no Expert (R$ 197/mês). BOTinho: Shopee, Amazon, Mercado Livre e Magalu em todos os planos.', 'O Expert cobre mais lojas do que o BOTinho. Custa R$ 197/mês.'],
      ['Telegram', 'FluxoPromo: é o destino principal, presente desde o plano grátis. BOTinho: não atende Telegram.', 'Se o seu canal é no Telegram, o BOTinho não serve.'],
    ],
    criteria: ['Se você quer ofertas prontas por nicho ou espelhar grupos que já acompanha', 'Se o seu público está no Telegram ou no WhatsApp', 'Quantas ofertas por dia você publica', 'Quantas lojas você realmente divulga', 'Se precisa converter cupom além de link de produto'],
    botinhoDifferentials: ['Monitora os grupos de origem que VOCÊ escolhe, não um feed pronto', 'Sem teto de ofertas por dia', 'Conversão de link de cupom, não só de produto', 'Canais e Comunidades do WhatsApp', 'Controle de cadência por destino e limites anti-repetição', 'Histórico de envios com o que foi bloqueado por repetição'],
    bestFit: [
      'Escolha o FluxoPromo se você não tem grupos de origem para acompanhar e quer receber ofertas prontas, selecionadas por nicho.',
      'Escolha o FluxoPromo também se o seu canal principal é Telegram — ele publica lá desde o plano grátis, e o BOTinho não atende Telegram.',
      'Escolha o BOTinho se você já acompanha grupos de ofertas e quer espelhar exatamente o que sai neles, com o seu código de afiliado.',
    ],
    notIdealFit: [
      'O FluxoPromo não é ideal para quem quer espelhar grupos específicos: a página pública descreve distribuição por nicho e loja, não monitoramento de origens escolhidas por você.',
      'O FluxoPromo também limita ofertas por dia em todos os planos exceto o Expert (R$ 197/mês).',
      'O BOTinho não é ideal para quem publica em Telegram, nem para quem quer uma camada gratuita permanente.',
    ],
    migrationPath: [
      'Responda primeiro: você já acompanha grupos de onde as ofertas boas saem, ou quer que alguém selecione por você? A resposta decide a ferramenta, não o preço.',
      'Se a resposta for "acompanho grupos", conte quantas ofertas por dia eles geram — é o número que o modelo de teto diário penaliza.',
      'Se o seu destino principal é Telegram, o BOTinho está fora da comparação, independentemente de preço.',
    ],
    faq: [
      { q: 'Quanto custa o FluxoPromo?', a: 'Conforme a página pública consultada em 04/08/2026: Grátis (20 ofertas/dia, 3 lojas, 1 canal de Telegram), Essencial R$ 37/mês, Pro R$ 97/mês e Expert R$ 197/mês. Há garantia de 7 dias nos planos pagos e o plano anual dá 2 meses grátis. Confirme na página oficial antes de decidir.' },
      { q: 'O FluxoPromo funciona no WhatsApp?', a: 'Sim, mas não no plano gratuito. O grátis publica apenas em 1 canal de Telegram; o destino de WhatsApp entra a partir do Essencial (R$ 37/mês), com 1 destino, chegando a 10 destinos no Expert.' },
      { q: 'Em que o FluxoPromo é melhor que o BOTinho?', a: 'Em quatro pontos. Tem plano gratuito permanente, enquanto aqui o teste dura 7 dias. O plano pago de entrada custa R$ 37, mais barato que o nosso Basic. Cobre Telegram, que o BOTinho não atende. E o plano Expert cobre 12 lojas, mais do que as quatro que cobrimos.' },
      { q: 'Qual a diferença real entre os dois?', a: 'De onde vem a oferta. O FluxoPromo entrega ofertas selecionadas pela própria ferramenta, organizadas por nicho e loja. O BOTinho monitora os grupos de origem que você escolhe e republica o que sai neles com o seu código de afiliado. Se você já tem grupos bons para acompanhar, são coisas diferentes; se não tem, o feed pronto resolve um problema que o espelhamento não resolve.' },
      { q: 'O limite de ofertas por dia atrapalha?', a: 'Depende do seu volume. São 20/dia no grátis, 50 no Essencial, 150 no Pro e ilimitado só no Expert (R$ 197/mês). Para quem publica poucas ofertas selecionadas por dia, o teto nunca é alcançado. Para quem espelha grupos ativos, 20 ou 50 acabam rápido.' },
    ],
  },
  '/botinho-vs-planilha-manual': {
    format: 'vs',
    eyebrow: 'Comparativo · Operação manual',
    title: 'Planilha ou bot para divulgar ofertas no WhatsApp: quando vale automatizar',
    description: 'Compare BOTinho e planilha manual para organizar grupos, links de afiliado, cadência e logs de divulgação em WhatsApp.',
    competitorSlugs: ['manual-spreadsheet-workflow'],
    tldr: 'Planilha manual funciona para operação pequena; BOTinho tende a ganhar quando volume e repetição aumentam e você precisa de logs e consistência.',
    directAnswer: 'Planilha manual é indicada para validar processo com baixo volume e revisão próxima. O BOTinho é indicado quando a operação precisa repetir a rotina com mais consistência: separar origem e destino, revisar links suportados, aplicar filtros, controlar cadência e consultar histórico de logs.',
    rows: [
      ['Organização de grupos', 'Planilha exige atualização manual de nomes, regras e prioridades.', 'BOTinho centraliza origem/destino na rotina operacional.'],
      ['Conferência de link', 'Depende de checklist e disciplina da pessoa operadora.', 'Ajuda a converter links suportados, mas ainda exige revisão humana do destino final.'],
      ['Cadência', 'Horários e intervalos ficam sujeitos a esquecimento.', 'Intervalos configuráveis ajudam a reduzir repetição excessiva.'],
      ['Auditoria', 'Histórico depende de anotações manuais.', 'Logs ajudam a conferir execução e falhas de envio.'],
    ],
    criteria: ['Volume semanal de ofertas', 'Número de grupos', 'Risco de erro humano', 'Necessidade de logs', 'Tempo disponível para revisão'],
    bestFit: [
      'BOTinho é melhor para operação diária com múltiplos grupos e necessidade de trilha de execução.',
      'Planilha manual é melhor para estágio inicial de validação com poucas publicações semanais.',
    ],
    notIdealFit: [
      'BOTinho não é ideal se você ainda não definiu processo base de revisão humana.',
      'Planilha manual não é ideal quando atrasos e erros de rotina já impactam performance.',
    ],
    migrationPath: [
      'Use a planilha como calendário editorial, não como executor principal.',
      'Configure primeiro os grupos prioritários e a cadência mínima.',
      'Valide logs de execução por 7 dias e ajuste regras de publicação antes de ampliar.',
    ],
    faq: [
      { q: 'Quando continuar na planilha?', a: 'Continue na planilha se a operação ainda é pequena, tem poucos grupos e a revisão manual não atrasa a publicação.' },
      { q: 'Quando migrar para o BOTinho?', a: 'Considere migrar quando houver repetição diária, vários destinos, risco de link errado e necessidade de histórico.' },
      { q: 'A planilha deixa de ser útil?', a: 'Não. Ela pode continuar como planejamento editorial, enquanto o BOTinho organiza a execução recorrente.' },
    ],
  },
  '/botinho-vs-ferramentas-genericas-automacao': {
    format: 'vs',
    eyebrow: 'Comparativo · Automação genérica',
    title: 'Bot de afiliados ou automação genérica de WhatsApp: qual usar',
    description: 'Entenda quando usar BOTinho ou ferramentas genéricas como automações de fluxo, conectores e scripts para rotinas de WhatsApp com afiliados.',
    competitorSlugs: ['generic-automation-tools'],
    tldr: 'Ferramentas genéricas priorizam flexibilidade técnica; BOTinho prioriza velocidade de operação para grupos de ofertas sem projeto técnico do zero.',
    directAnswer: 'Ferramentas genéricas são úteis quando a equipe técnica precisa conectar muitos sistemas diferentes. O BOTinho é mais indicado quando o problema central é operação de ofertas em grupos: link monetizado, origem, destino, filtros, cadência, revisão humana e logs sem construir uma automação do zero.',
    rows: [
      ['Setup', 'Automação genérica costuma exigir desenho técnico e testes de integração.', 'BOTinho entrega fluxo mais específico para grupos e ofertas.'],
      ['Manutenção', 'Scripts e conectores podem quebrar quando páginas, APIs ou regras mudam.', 'BOTinho concentra regras do produto e ajustes operacionais em uma experiência única.'],
      ['Governança', 'Depende de documentação própria da equipe.', 'Metodologia pública reforça limites, revisão e cadência responsável.'],
      ['Flexibilidade', 'Alta para times técnicos.', 'Focada no caso de uso de afiliados e admins de grupos.'],
    ],
    criteria: ['Capacidade técnica interna', 'Número de integrações externas', 'Foco em grupos de ofertas', 'Necessidade de governança', 'Custo de manutenção'],
    bestFit: [
      'BOTinho é melhor quando a dor principal é execução de ofertas em grupos com governança operacional.',
      'Automação genérica é melhor quando você precisa orquestrar vários sistemas além do WhatsApp.',
    ],
    notIdealFit: [
      'BOTinho não é ideal para pipelines altamente customizados que exigem lógica técnica complexa fora do escopo do produto.',
      'Automação genérica não é ideal para times que precisam de resultado rápido sem sobrecarga de manutenção.',
    ],
    migrationPath: [
      'Mapeie quais integrações realmente precisam continuar externas.',
      'Migre os fluxos de maior frequência primeiro para reduzir risco operacional.',
      'Mantenha monitoramento paralelo por uma janela de validação antes de desativar scripts antigos.',
    ],
    faq: [
      { q: 'Ferramentas genéricas são ruins?', a: 'Não. Elas são fortes para fluxos amplos. A comparação é sobre foco: BOTinho prioriza rotina de ofertas em grupos.' },
      { q: 'Posso usar as duas abordagens?', a: 'Sim. Uma equipe pode manter BI, CRM ou planilhas fora do BOTinho e usar o produto para execução de grupos.' },
      { q: 'Qual tem menor risco?', a: 'O risco depende do uso. Qualquer abordagem precisa respeitar regras do WhatsApp, consentimento, cadência e políticas de afiliados.' },
    ],
  },
  '/melhores-bots-para-afiliados-whatsapp': {
    format: 'alternative-plural',
    eyebrow: 'Critérios · Avaliação de ferramentas',
    title: 'Melhores bots para afiliados no WhatsApp em 2026: como comparar',
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
      { q: 'BOTinho entra nesses critérios?', a: 'Sim. O BOTinho foi desenhado para grupos, links suportados, cadência e logs, mas ainda exige revisão humana e autorização dos grupos.' },
      { q: 'O que evitar ao escolher um bot?', a: 'Evite promessa de comissão garantida, disparo sem consentimento, ausência de logs e ferramenta que não explica limites de uso.' },
    ],
  },
}

export function getComparisonMetadata(slug) {
  const page = COMPARISON_PAGES[slug]
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: slug },
    openGraph: { title: page.title, description: page.description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
  }
}

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

export function ComparisonPage({ slug }) {
  const page = COMPARISON_PAGES[slug]
  const relatedPages = getRelatedComparisonPages(slug, 3)
  const siteUrl = getSiteUrl()
  const dates = getEditorialDates(slug)
  const schemas = buildArticleJsonLd({ title: page.title, description: page.description, slug, siteUrl, faq: page.faq, type: 'Article' })

  const headline = (
    <>
      <span>{page.title.split(' ').slice(0, -2).join(' ')}</span><br />
      <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{page.title.split(' ').slice(-2).join(' ')}</span>
    </>
  )

  return (
    <div className="landing-root">
      <ComparisonPageTracker slug={slug} format={page.format} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <Hero
        eyebrowLabel={page.eyebrow}
        primaryCtaLabel="Entrar na Lista VIP"
        headlineOverride={headline}
        subOverride={page.description}
        heroStyle={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-2) 18%, white), transparent)', borderRadius: 24, paddingInline: 20 }}
      />

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <IntroCard
            eyebrow={page.eyebrow}
            title={page.title}
            body={page.directAnswer}
            pills={[`Por ${EDITORIAL_AUTHOR}`, `Publicado em ${formatDatePtBr(dates.publishedAt)}`, `Atualizado em ${formatDatePtBr(dates.updatedAt)}`]}
            accent
          />
        </div>
      </section>

      {Array.isArray(page.botinhoDifferentials) && page.botinhoDifferentials.length > 0 && (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Diferenciais BOTinho</span>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Veja como nos comparamos com Divulgador Inteligente, Divulga Ninja, Gigi Prime Bot, Busqy e DivulgaLinks</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.8 }}>
                {page.botinhoDifferentials.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Veja também</span>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Outros comparativos relacionados</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              {page.productPage ? (
                <li>
                  <Link href={page.productPage.href} data-comparison-cta="product-page" style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                    {page.productPage.label}
                  </Link>
                </li>
              ) : null}
              <li><Link href="/comparativos" data-comparison-cta="related-hub" style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>Hub de comparativos do BOTinho</Link></li>
              {relatedPages.map((related) => (
                <li key={related.href}>
                  <Link href={related.href} data-comparison-cta="related-page" style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                    {related.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'color-mix(in oklab, var(--accent) 14%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />TL;DR</span>
            <p style={{ margin: '12px 0 0', color: 'var(--ink)', lineHeight: 1.7 }}>{page.tldr || page.directAnswer}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Comparativo</span>
            <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', lineHeight: 1.12, margin: '14px 0 18px' }}>Comparativo equilibrado</h2>
            <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left', color: 'var(--ink)' }}>
                <thead style={{ background: 'var(--bg-soft)' }}>
                  <tr>
                    <th style={{ padding: 16, fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Critério</th>
                    <th style={{ padding: 16, fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Alternativa</th>
                    <th style={{ padding: 16, fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Leitura responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map(([criterion, alternative, reading], i, arr) => (
                    <tr key={criterion} style={{ borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--line)' }}>
                      <td style={{ padding: 16, fontWeight: 600 }}>{criterion}</td>
                      <td style={{ padding: 16, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{alternative}</td>
                      <td style={{ padding: 16, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{reading}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Decisão</span>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Critérios de decisão</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                {page.criteria.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div style={{ background: 'color-mix(in oklab, var(--accent-2) 24%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Limites</span>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Limites importantes</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRODUCT_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            {Array.isArray(page.bestFit) && page.bestFit.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
                <span className="pill"><span className="dot" />Melhor encaixe</span>
                <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Quem deve usar o quê</h2>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {page.bestFit.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(page.notIdealFit) && page.notIdealFit.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
                <span className="pill"><span className="dot" />Quando não usar</span>
                <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Cenários não ideais</h2>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {page.notIdealFit.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Perfis de alternativa</span>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Resumo centralizado dos caminhos avaliados</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {(page.competitorSlugs || []).map((slug) => {
                const competitor = getCompetitorBySlug(slug)
                return (
                  <article key={slug} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 16, background: 'color-mix(in oklab, var(--surface) 92%, white)' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{competitor.name}</h3>
                    <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{competitor.positioning}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink)', lineHeight: 1.6 }}><strong>Melhor para:</strong> {competitor.bestFor}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink)', lineHeight: 1.6 }}><strong>Não ideal para:</strong> {competitor.notIdealFor}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', lineHeight: 1.6 }}><strong>Nota de migração:</strong> {competitor.migrationNotes}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', lineHeight: 1.6 }}><strong>Fonte:</strong> {competitor.source}</p>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', lineHeight: 1.6 }}><strong>Verificado em:</strong> {competitor.verifiedAt}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {Array.isArray(page.migrationPath) && page.migrationPath.length > 0 && (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Migração</span>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Caminho de migração recomendado</h2>
              <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', lineHeight: 1.8 }}>
                {page.migrationPath.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          </div>
        </section>
      )}

      {Array.isArray(page.migrationPath) && page.migrationPath.length > 0 && (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Migração</span>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Caminho de migração recomendado</h2>
              <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', lineHeight: 1.8 }}>
                {page.migrationPath.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Fontes</span>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Fontes e políticas para revisar antes de operar</h2>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.65 }}>Use as políticas oficiais como referência operacional. Elas podem mudar e devem ser revisadas pela pessoa responsável antes de ampliar volume.</p>
            <ul style={{ margin: '14px 0 0', paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.8 }}>
              {COMPARISON_SOURCE_LINKS.map((source) => (
                <li key={source.href}>
                  <a href={source.href} data-comparison-cta="source-link" style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }} rel="noreferrer">{source.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />FAQ</span>
            <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', lineHeight: 1.12, margin: '14px 0 16px' }}>Perguntas frequentes</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {page.faq.map((item) => (
                <details key={item.q} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', background: 'color-mix(in oklab, var(--surface) 92%, white)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--ink)' }}>{item.q}</summary>
                  <p style={{ marginTop: 10, color: 'var(--ink-soft)', lineHeight: 1.65 }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'color-mix(in oklab, var(--accent) 22%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />{BRAND_NAME}</span>
            <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 34px)', lineHeight: 1.12, margin: '14px 0 12px' }}>Onde o {BRAND_NAME} se encaixa?</h2>
            <p style={{ color: 'var(--ink)', lineHeight: 1.7 }}>{PRODUCT_DEFINITION}</p>
            <Link href="/login?mode=register&utm_source=comparativo&utm_medium=organic&utm_campaign=ai-seo-p2" data-comparison-cta="bottom-register" className="btn btn-accent" style={{ marginTop: 20 }}>
              Entrar na Lista VIP
            </Link>
          </div>
        </div>
      </section>

      <FinalCTA />
      <Footer />
    </div>
  )
}
