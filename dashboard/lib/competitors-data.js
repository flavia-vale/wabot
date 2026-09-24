const REQUIRED_STRING_FIELDS = ['slug', 'name', 'positioning', 'bestFor', 'notIdealFor', 'migrationNotes', 'updatedAt', 'verifiedAt']

const COMPETITORS = [
  {
    slug: 'achadinho-pro',
    name: 'Achadinho Pro',
    positioning: 'Bot de afiliados para WhatsApp com IA para selecionar produtos e gerar links de Shopee, Mercado Livre e Amazon automaticamente.',
    bestFor: 'Quem quer começar só com Shopee e evoluir depois para múltiplos marketplaces.',
    notIdealFor: 'Quem já opera vários marketplaces desde o início e quer todos incluídos no plano de entrada.',
    pricingTiers: [
      { name: 'Basic', price: 'R$ 49,97/mês', notes: 'Marketplace: Shopee. Grupos ilimitados por automação, até 5 números de WhatsApp, até 5 automações, Shopee Videos, extensão Chrome, IA de pesquisa.' },
      { name: 'Pro', price: 'R$ 59,97/mês', notes: 'Shopee + Mercado Livre + Amazon + Listas Personalizadas (48h de auto-expiração). R$10/mês a mais que o Basic para 3 marketplaces simultâneos.' },
    ],
    strengths: ['Diferença de apenas R$10/mês entre Basic e Pro para 4x mais marketplaces', 'Grupos ilimitados por automação em ambos os planos', 'Shopee Videos como recurso exclusivo do Basic'],
    weaknesses: ['Plano de entrada (Basic) cobre só Shopee', 'A página de preços não indica teste grátis nem número de dias de trial', 'Amazon e Mercado Livre só entram no plano Pro'],
    migrationNotes: 'Conferir se o volume de grupos e o número de contas de WhatsApp necessárias cabe no limite do plano antes de assinar.',
    updatedAt: '2026-07-31',
    verifiedAt: '2026-07-31',
    source: 'Print da página de preços em achadinhopro.com.br, enviado pela usuária em 31/07/2026.',
  },
  {
    slug: 'achadinhosbot',
    name: 'AchadinhosBot',
    positioning: 'Automação Shopee para WhatsApp com foco em grupos, listas manuais/inteligentes e templates de mensagem.',
    bestFor: 'Quem quer testar de graça por 3 dias antes de decidir e escalar por número de grupos conectados.',
    notIdealFor: 'Quem precisa de mais de 15 grupos ou de marketplaces além da Shopee.',
    pricingTiers: [
      { name: 'Teste Grátis', price: 'R$ 0 por 3 dias', notes: '1 grupo, 30 envios/dia, intervalo mínimo de 10min, com marca d\'água na mensagem, conexão indicada como "menos estável".' },
      { name: 'Starter', price: 'R$ 59,90/mês', notes: '1 grupo, envios ilimitados, intervalo de 5min, sem marca d\'água, listas ilimitadas.' },
      { name: 'Pro', price: 'R$ 99,90/mês', notes: '5 grupos WhatsApp, mesmos recursos do Starter.' },
      { name: 'Advanced', price: 'R$ 149,90/mês', notes: '10 grupos WhatsApp — plano indicado como "mais popular" na página.' },
      { name: 'Premium', price: 'R$ 199,90/mês', notes: '15 grupos WhatsApp, teto da linha de planos por número de grupos.' },
    ],
    strengths: ['Teste grátis real de 3 dias, sem pedir cartão', 'Preço escala de forma previsível por número de grupos', 'Suporte 24/7 por e-mail e WhatsApp em todos os planos pagos'],
    weaknesses: ['Foco só em Shopee — a tabela de preços não indica Mercado Livre, Amazon ou Magalu', 'Teste grátis tem marca d\'água e conexão indicada pelo próprio site como "menos estável"', 'Starter cobre só 1 grupo, o mesmo limite do teste grátis'],
    migrationNotes: 'Validar no teste grátis de 3 dias se a estabilidade da conexão atende antes de assinar um plano pago.',
    updatedAt: '2026-07-31',
    verifiedAt: '2026-07-31',
    source: 'Print da página de preços em achadinhosbot.com.br, enviado pela usuária em 31/07/2026.',
  },
  {
    slug: 'proafiliados-com',
    name: 'ProAfiliados',
    positioning: 'Bot de afiliados para WhatsApp e Telegram com plano gratuito permanente e cobrança via PIX.',
    bestFor: 'Quem quer testar automação de afiliados sem custo nenhum, incluindo múltiplas plataformas desde o plano grátis.',
    notIdealFor: 'Quem precisa de broadcast ilimitado ou remoção de anúncios do sistema sem pagar.',
    pricingTiers: [
      { name: 'Grátis', price: 'R$ 0 para sempre', notes: 'Grupos ilimitados, monitoramento 24/7, 5 plataformas, feed global. Mensagens saem com a tag "proafiliados".' },
      { name: 'Premium', price: 'R$ 50/mês', notes: 'Plano indicado como "mais popular". Tudo do Grátis + sem tag proafiliados, prioridade no suporte, broadcast ilimitado. Anúncios do sistema a cada 30 envios.' },
      { name: 'Premium Plus', price: 'R$ 100/mês', notes: 'Indicado para times e agências. Sem anúncios do sistema, suporte prioritário, todos os recursos inclusos.' },
    ],
    strengths: ['Único com plano gratuito permanente (não é trial) entre os concorrentes mapeados', 'Pagamento via PIX, sem cartão de crédito', 'Cancelamento a qualquer momento em todos os planos'],
    weaknesses: ['Plano grátis insere anúncios do próprio sistema e a tag "proafiliados" nas mensagens', 'A página de preços não detalha limite de grupos por plataforma', 'O diferencial do Premium Plus para times/agências é pouco detalhado publicamente'],
    migrationNotes: 'Testar o plano grátis primeiro — ele já inclui as 5 plataformas — antes de decidir se vale pagar para remover a tag e os anúncios.',
    updatedAt: '2026-07-31',
    verifiedAt: '2026-07-31',
    source: 'Print da página de preços em proafiliados.com, enviado pela usuária em 31/07/2026.',
  },
  {
    slug: 'shozap',
    name: 'Shozap',
    positioning: 'Plataforma de divulgação para WhatsApp e Telegram que escala por número de conexões, campanhas e contas de marketplace, com créditos de IA e de SMS inclusos por plano.',
    bestFor: 'Quem opera WhatsApp e Telegram juntos e precisa de várias conexões simultâneas na mesma conta.',
    notIdealFor: 'Quem divulga Mercado Livre ou Amazon e quer isso no plano de entrada — no Básico só entra Shopee.',
    pricingTiers: [
      { name: 'Básico', price: 'R$ 50,00/mês', notes: '1 conexão WhatsApp e 1 Telegram, envios ilimitados, 3 campanhas, 3 grupos por campanha, 1 monitoramento de grupos, 50 créditos de IA. Marketplace: Shopee (1 conta). Mercado Livre, Amazon, Shein e Magalu não inclusos.' },
      { name: 'Intermediário', price: 'R$ 100,00/mês', notes: 'Indicado como "para escalar seu negócio". 3 conexões de cada, 6 campanhas, 10 grupos por campanha, 3 monitoramentos, 100 créditos de IA, 50 créditos de SMS. Shopee (5 contas), Mercado Livre (1) e Amazon (1). Shein e Magalu não inclusos.' },
      { name: 'Elite', price: 'R$ 150,00/mês', notes: '6 conexões de cada, 10 campanhas, 50 grupos por campanha, 6 monitoramentos, 200 créditos de IA, 100 de SMS. Shopee (7), Mercado Livre (2), Amazon (2), Shein (2) e Magalu (2).' },
      { name: 'Avançado', price: 'R$ 300,00/mês', notes: '15 conexões de cada, campanhas e grupos por campanha ilimitados, 15 monitoramentos, 1.000 créditos de IA, 300 de SMS. Shopee (10 contas), Mercado Livre (5).' },
    ],
    strengths: [
      'WhatsApp e Telegram no mesmo plano, inclusive no de entrada',
      'Várias conexões simultâneas de WhatsApp numa conta só (3 no Intermediário, 15 no Avançado)',
      'Créditos de SMS inclusos a partir do Intermediário — recurso que não aparece nos demais concorrentes mapeados',
      'Deixa explícito quantas CONTAS de cada marketplace cabem por plano, o que a maioria não detalha',
    ],
    weaknesses: [
      'O plano de entrada (R$ 50/mês) cobre só Shopee — Mercado Livre e Amazon só a partir de R$ 100/mês',
      'Shein e Magalu só entram no Elite (R$ 150/mês)',
      'Quase tudo é limitado por cota (campanhas, grupos por campanha, monitoramentos, redirecionamentos), então a conta real depende de quantos grupos você opera',
    ],
    migrationNotes: 'Somar quantos grupos de destino você tem hoje e dividir pelo limite de "grupos por campanha" do plano — é aí que o custo real aparece, não no preço da primeira faixa.',
    updatedAt: '2026-08-04',
    verifiedAt: '2026-08-04',
    source: 'Print da página de preços em shozap.com.br/#precos, enviado pela usuária em 04/08/2026. O site tem um botão "Começar grátis", mas a tela consultada não detalha os limites desse acesso gratuito.',
  },
  {
    slug: 'promium',
    name: 'Promium',
    positioning: 'Plataforma ampla de divulgação de ofertas para WhatsApp e Telegram, com replicador de grupos, captura de cupom por IA, vitrine própria e rotador de links com pixel de anúncio. Cobra por faixa de grupos e por número de conexões.',
    bestFor: 'Operação grande, com muitos grupos e mais de uma conexão de WhatsApp, que quer vitrine com domínio próprio e rastreamento de links com pixel de Meta, TikTok e GA4 dentro da mesma ferramenta.',
    notIdealFor: 'Quem está começando ou opera poucos grupos — o plano de entrada cobre 5 grupos e já custa mais que o nosso plano completo a partir do segundo mês.',
    pricingTiers: [
      { name: 'Starter', price: 'R$ 97,90/mês (R$ 47,90 no 1º mês)', notes: 'O valor recorrente, a partir do segundo mês, é R$ 97,90. 5 grupos de WhatsApp, 1 instância.' },
      { name: 'Basic', price: 'R$ 197,90/mês (R$ 97,90 no 1º mês)', notes: 'O valor recorrente, a partir do segundo mês, é R$ 197,90. 20 grupos de WhatsApp, 1 instância.' },
      { name: 'Intermediário', price: 'R$ 397,90/mês (R$ 297,90 no 1º mês)', notes: 'O valor recorrente, a partir do segundo mês, é R$ 397,90. 50 grupos de WhatsApp, 2 instâncias.' },
      { name: 'Pro', price: 'R$ 597,90/mês (R$ 497,90 no 1º mês)', notes: 'O valor recorrente, a partir do segundo mês, é R$ 597,90. 200 grupos de WhatsApp, 3 instâncias.' },
    ],
    strengths: [
      'Cobre 10 lojas, mais que as cinco do nosso plano de entrada',
      'Publica também em Telegram, que não atendemos',
      'Vitrine de produtos com domínio próprio',
      'Rotador de links com pixel de Meta, TikTok e GA4 — permite anunciar em cima do próprio tráfego',
      'Captura de cupom por IA e fila de envios com intervalo',
      'Até 3 conexões de WhatsApp no plano mais alto',
    ],
    weaknesses: [
      'O preço do primeiro mês é promocional em todos os planos: o valor recorrente é o do segundo mês em diante, e é ele que vale para comparar',
      'O plano de entrada cobre apenas 5 grupos de WhatsApp',
      'A cobrança escala por faixa de grupos — crescer de 5 para 20 grupos dobra a mensalidade',
      'A página consultada não informa teste grátis',
    ],
    migrationNotes: 'Compare pelo valor do SEGUNDO mês, não pelo preço de entrada anunciado. E conte quantos grupos você tem hoje: a conta muda bastante entre as faixas de 5, 20, 50 e 200.',
    updatedAt: '2026-09-01',
    verifiedAt: '2026-09-01',
    source: 'Print da página de planos em promium.space/#planos, enviado pela usuária em 01/09/2026. Todos os planos anunciam um preço promocional no primeiro mês e um valor recorrente a partir do segundo; os valores registrados aqui são os recorrentes, com o promocional citado em notes.',
  },
  {
    slug: 'fluxopromo',
    name: 'FluxoPromo',
    positioning: 'Distribuição automática de ofertas por nicho para canais de Telegram e destinos de WhatsApp, com plano gratuito permanente e cobrança por volume de ofertas por dia.',
    bestFor: 'Quem quer receber ofertas prontas por nicho e publicar em canal de Telegram, começando de graça.',
    notIdealFor: 'Quem quer espelhar grupos específicos que já acompanha — a página pública descreve distribuição a partir de nichos e lojas, não monitoramento de grupos escolhidos por você.',
    pricingTiers: [
      { name: 'Grátis', price: 'R$ 0', notes: '20 ofertas/dia, 3 lojas (Amazon, Shopee, Mercado Livre), 1 canal de Telegram, +15 nichos. Inclui links afiliados automáticos, anti-duplicação e programa de indicação. Não inclui destino de WhatsApp.' },
      { name: 'Essencial', price: 'R$ 37/mês', notes: '50 ofertas/dia, 4 lojas (+ Magalu), 1 canal de Telegram e 1 destino de WhatsApp. Adiciona integração com WhatsApp, formatação inteligente, horários otimizados de envio, links curtos e comunidade VIP.' },
      { name: 'Pro', price: 'R$ 97/mês', notes: 'Indicado como "mais escolhido". 150 ofertas/dia, 5 lojas (+ Kabum), 5 canais de destino e 5 destinos de WhatsApp. Adiciona filtros por categoria, métricas de desempenho, agendamento de posts e templates personalizados.' },
      { name: 'Expert', price: 'R$ 197/mês', notes: 'Ofertas ilimitadas, todas as 12 lojas, 10 canais e 10 destinos de WhatsApp. Adiciona suporte prioritário, relatórios semanais e ofertas manuais via dashboard.' },
    ],
    strengths: [
      'Plano gratuito permanente que já cobre Amazon, Shopee e Mercado Livre',
      'Plano pago de entrada a R$ 37/mês — o mais barato entre os concorrentes mapeados',
      'Garantia de 7 dias em todos os planos pagos e plano anual com 2 meses grátis',
      'Cobertura de 12 lojas no plano Expert, a maior da linha',
    ],
    weaknesses: [
      'O plano gratuito publica só em Telegram — destino de WhatsApp começa no Essencial (R$ 37/mês)',
      'Cobra por teto de ofertas por dia (20 / 50 / 150 / ilimitado), modelo diferente dos concorrentes que cobram por grupos ou conexões',
      'A página pública indica distribuição de ofertas por nicho e loja, não espelhamento de grupos de origem escolhidos por você — são propostas diferentes, vale confirmar antes de comparar só pelo preço',
    ],
    migrationNotes: 'Antes de comparar preço, confirmar se o que você precisa é receber ofertas prontas por nicho ou espelhar grupos específicos que já acompanha — as duas coisas resolvem problemas diferentes.',
    updatedAt: '2026-08-04',
    verifiedAt: '2026-08-04',
    source: 'Print da página de preços em fluxopromo.com, enviado pela usuária em 04/08/2026.',
  },
  {
    slug: 'lumi-ofertas-inteligentes',
    name: 'Lumi Ofertas Inteligentes',
    positioning: 'Plataforma de afiliados para WhatsApp e Telegram com disparo em massa, filas de ofertas e espelhamento entre grupos.',
    bestFor: 'Operações maiores que já querem múltiplos números de WhatsApp, filas de ofertas e espelhamento desde o plano de entrada.',
    notIdealFor: 'Quem está começando e quer testar sem comprometer R$97/mês — não há plano grátis nem trial visível na página.',
    pricingTiers: [
      { name: 'Afiliado básico', price: 'R$ 97/mês', notes: '1 número de WhatsApp, 20 grupos, disparador em massa, 3 filas de ofertas, 1 monitoramento, 1 espelhamento. Shopee, Mercado Livre e Amazon.' },
      { name: 'Afiliado Pro', price: 'R$ 187/mês', notes: '3 números, 50 grupos WhatsApp + 50 grupos Telegram, 6 filas, 5 monitoramentos, 5 espelhamentos, 8 divulgadores automáticos. Adiciona Magalu.' },
      { name: 'Afiliado Master', price: 'R$ 247/mês', notes: '6 números, grupos ilimitados WhatsApp e Telegram, 10 filas, 10 monitoramentos, 10 espelhamentos. Envio para Canais do WhatsApp listado como "em breve".' },
    ],
    strengths: ['Único com espelhamento de grupos e múltiplos números de WhatsApp já no plano de entrada', 'Cobre 4 marketplaces (Shopee, Mercado Livre, Amazon, Magalu) a partir do plano Pro', 'Filas de ofertas e monitoramentos dedicados, não só disparo simples'],
    weaknesses: ['O plano de entrada, R$97/mês, é o mais caro entre os concorrentes mapeados', 'A página de preços não indica teste grátis nem trial', 'Envio para Canais do WhatsApp aparece como "em breve" mesmo no plano mais caro'],
    migrationNotes: 'Confirmar se o número de grupos e marketplaces do plano básico já atende antes de assinar — o salto de preço para o Pro é de quase 2x.',
    updatedAt: '2026-07-31',
    verifiedAt: '2026-07-31',
    source: 'Print da página de preços em lumiofertasinteligentes.com.br, enviado pela usuária em 31/07/2026.',
  },
  {
    slug: 'gigi-bot',
    name: 'Gigi Bot',
    positioning: 'Bot de afiliados que roda no Telegram e converte links de Shopee, Mercado Livre, Magalu, AliExpress, Kabum, Terabyte, Natura, Shein e Temu. O envio automático para WhatsApp fica só no plano mais caro.',
    bestFor: 'Quem quer testar de graça e evoluir aos poucos: o plano gratuito já converte links de 9 lojas diferentes.',
    notIdealFor: 'Quem precisa que o robô publique sozinho nos grupos de WhatsApp: espelhamento de grupos e autoenvio WhatsApp/Telegram aparecem só no plano mais caro.',
    pricingTiers: [
      { name: 'Guru das Promoções Bot', price: 'Grátis', notes: 'Conversão automática de links de 9 lojas, texto de disparo customizável por loja, template de story, limite de 120 promoções/dia. A tabela marca como NÃO incluídos: promoções ilimitadas, versão 5x mais rápida, site personalizado, Amazon e autoenvio WhatsApp/Telegram.' },
      { name: 'Guru Plus Bot', price: 'R$ 19,99/mês', notes: 'Versão em nuvem 24/7, 5x mais rápido que a versão gratuita, promoções ilimitadas, CTAs de venda personalizados. A tabela marca como NÃO incluídos: site personalizado, Amazon, espelhamento de grupos e autoenvio WhatsApp/Telegram.' },
      { name: 'Gigi Promo Bot', price: 'R$ 39,99/mês', notes: 'Adiciona Amazon ilimitada, site de promoções com domínio próprio e modo de copiar ofertas de outros afiliados. A tabela marca como NÃO incluídos: autoenvio WhatsApp/Telegram, agendamento de horários e espelhamento de grupos.' },
      { name: 'Gigi Prime Bot', price: 'R$ 49,90/mês (1º mês promocional; de R$67,99)', notes: '4 filas de envios (até 20 grupos cada), espelhamento de grupos, 1 conta de disparo com agendamento para WhatsApp (até 20 grupos), programação por horário e relatório de comissões da Shopee.' },
    ],
    strengths: ['Cobre a maior variedade de lojas entre os concorrentes mapeados: Shopee, Mercado Livre, Magalu, AliExpress, Kabum, Terabyte, Natura, Shein e Temu', 'Plano gratuito permanente que já converte link automaticamente, sem exigir cartão', 'Relatório de comissões da Shopee é recurso próprio, não visto nos demais concorrentes mapeados'],
    weaknesses: ['Autoenvio WhatsApp/Telegram aparece riscado nos TRÊS primeiros planos (grátis, R$ 19,99 e R$ 39,99) — só o Gigi Prime Bot publica sozinho no WhatsApp', 'Espelhamento de grupos também só no Gigi Prime Bot', 'Amazon só entra a partir do 3º plano pago (Gigi Promo Bot)', 'Mesmo no plano mais caro o envio é limitado a 20 grupos por fila', 'Preço do Gigi Prime Bot é mostrado como promocional (de R$67,99 para R$49,90) e a própria tabela chama R$ 49,90 de "primeiro mês promocional", sem indicar o valor a partir do segundo mês'],
    migrationNotes: 'O corte que importa não é espelhamento contra conversão de link: é que nenhum plano abaixo do Gigi Prime Bot envia sozinho para o WhatsApp. Quem precisa que o robô publique nos grupos precisa do plano mais caro — comparar esse valor com concorrentes que já incluem envio e espelhamento no plano de entrada.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Print da página de planos em gigibot.com.br/planos, enviado pela usuária em 17/09/2026. Terceira coleta (31/07, 26/08 e 17/09) — os quatro planos e os preços não mudaram em nenhuma delas.',
  },
  {
    slug: 'divulgador-inteligente',
    name: 'Divulgador Inteligente',
    positioning: 'Plataforma para afiliados com geração de promoções em muitas lojas, site de promoções próprio, página de link na bio e template de story. A automação de grupos no WhatsApp é um recurso à parte, liberado só no plano mais caro.',
    bestFor: 'Quem divulga em MUITAS lojas diferentes e quer, junto, site de promoções com domínio próprio, link na bio e descrição de produto gerada por I.A.',
    notIdealFor: 'Quem quer o robô publicando sozinho nos grupos: nos dois planos mais baratos esse item aparece desabilitado na própria página, com o aviso "Disponível a partir do plano Diamante".',
    pricingTiers: [
      { name: 'Essencial', price: 'R$ 67,00/mês', notes: '10 lojas (Shopee, Magalu, SHEIN, AliExpress e mais 6), descrição de produto com I.A, Grupos Redirect, download de vídeos de achadinhos do Pinterest, texto de disparo customizável por loja, template de story, site de promoções personalizado com selo de verificado e página de link na bio. A linha "Automação de grupos no WhatsApp" aparece DESABILITADA, com o aviso "Disponível a partir do plano Diamante".' },
      { name: 'Ouro', price: 'R$ 137,00/mês', notes: 'Tudo do Essencial + 16 lojas (Amazon, Shopee, Magalu, Natura e mais 12), promoções ilimitadas da Amazon e domínio próprio. A linha "Automação de grupos no WhatsApp" continua DESABILITADA, com o mesmo aviso.' },
      { name: 'Diamante', price: 'R$ 189,00/mês', notes: 'Tudo do Essencial + Ouro, 121 lojas e até 2 perfis na mesma assinatura. É o primeiro plano com automação de grupos no WhatsApp: a "Automação Base" vem incluída sem custo adicional, no nível "Até 2 Grupos" — que a própria página descreve como 1 número conectado e 1 grupo monitorado — com piloto automático 24h, disparos ilimitados, agendamento, monitoramento de grupos e segmentação. "Nível de automação" é um seletor com opções maiores, cujos preços não aparecem no material consultado.' },
    ],
    strengths: ['121 lojas no plano Diamante — de longe a maior cobertura entre os concorrentes mapeados', 'Site de promoções personalizado com selo de verificado, domínio próprio e página de link na bio', 'Descrição de produto gerada por I.A e download de vídeos de achadinhos do Pinterest, que nenhum outro concorrente mapeado oferece', 'Até 2 perfis na mesma assinatura no Diamante', '7 dias de garantia e cancelamento a qualquer momento em todos os planos'],
    weaknesses: ['A automação de grupos no WhatsApp só existe a partir do Diamante, de R$ 189/mês — nos planos de R$ 67 e R$ 137 a própria página mostra o item desabilitado', 'A automação incluída no Diamante é o nível "Até 2 Grupos": 1 número conectado e 1 grupo monitorado', 'O seletor "Nível de automação" indica níveis maiores, mas o material consultado não informa quanto custam', 'Amazon só entra a partir do plano Ouro (R$ 137/mês)'],
    migrationNotes: 'O corte que importa não é preço de entrada: é que os dois planos mais baratos não automatizam grupo nenhum. Antes de comparar R$ 67 com qualquer coisa, confirme se você precisa do robô publicando sozinho — se precisar, o valor a comparar é R$ 189, e vale conferir quanto custa subir o nível de automação além de 1 grupo monitorado.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Prints da página de planos do Divulgador Inteligente (cartões Essencial, Ouro e Diamante), enviados pela usuária em 17/09/2026.',
  },
  {
    slug: 'divulga-ninja',
    name: 'Divulga Ninja',
    positioning: 'Ferramenta que monta o anúncio completo a partir do produto (descrição, preço, imagem e link), gera arte para Instagram e Status e programa os posts — com I.A escolhendo o horário. O preço acompanha a quantidade de grupos ativos.',
    bestFor: 'Quem publica em poucos grupos e quer o anúncio e a arte prontos, com a I.A decidindo a hora de postar.',
    notIdealFor: 'Quem quer monitorar grupo de origem e espelhar: esse recurso aparece só no plano mais caro.',
    pricingTiers: [
      { name: 'Start', price: 'R$ 49,90/mês', notes: 'Até 1 grupo ativo (WhatsApp ou Telegram). Geração automática do anúncio completo, arte para Instagram (feed e Stories) e Status do WhatsApp, agendamento por data e hora ou pela I.A, integrações com Shopee, Mercado Livre e outras.' },
      { name: 'Plus', price: 'R$ 69,90/mês', notes: 'Até 3 grupos ativos. Adiciona feed das últimas promoções curado por I.A.' },
      { name: 'Pro', price: 'R$ 89,90/mês', notes: 'Até 5 grupos ativos. Adiciona busca 100% automática de promoções — o sistema encontra e publica sozinho.' },
      { name: 'Master', price: 'R$ 149,90/mês', notes: 'Marcado como "Mais vendido". Até 10 grupos ativos. Adiciona sistema próprio nos grupos com a marca da cliente, busca por termos específicos (como "perfume" ou "tênis") além das categorias, e MONITOR DE GRUPOS: monitorar grupos do WhatsApp e publicar promoções automaticamente.' },
    ],
    strengths: ['Arte pronta para Instagram (feed e Stories) e para o Status do WhatsApp em todos os planos', 'A I.A escolhe o horário de disparo, além de aceitar data e hora definidas pela cliente', 'Busca 100% automática de promoções a partir do plano Pro, com termos específicos no Master', 'Cada grupo pode ser de WhatsApp ou de Telegram, à escolha', 'Preço de entrada abaixo de R$ 50'],
    weaknesses: ['O preço acompanha a QUANTIDADE de grupos ativos: 1, 3, 5 ou 10 — crescer em grupos é trocar de plano', 'O monitor de grupos (acompanhar um grupo e publicar o que sai nele) aparece só no Master, de R$ 149,90/mês', 'A busca automática de promoções começa no Pro, de R$ 89,90/mês', 'O teto publicado é de 10 grupos ativos; a página não mostra faixa acima disso'],
    migrationNotes: 'Conte os grupos antes de comparar preço, porque é o que define o plano. E confirme o que você precisa: se for monitorar um grupo de origem e espelhar, o valor a comparar é o Master, não o Start.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Página de planos do Divulga Ninja (Start, Plus, Pro e Master), transcrita pela usuária em 17/09/2026.',
  },
  {
    slug: 'shark',
    name: 'Shark',
    positioning: 'Plataforma de gestão para promotores de ofertas com pool de ofertas compartilhado, ranking de promotores, moderação de grupos, descoberta de grupos da concorrência e link na bio com pixel da Meta.',
    bestFor: 'Quem gerencia um TIME de promotores e precisa de ranking, moderação e pool de ofertas compartilhado — recursos que nenhum outro concorrente mapeado apresenta.',
    notIdealFor: 'Quem quer só espelhar grupo em grupo: boa parte do que eles cobram resolve gestão de time e crescimento de audiência, não publicação recorrente.',
    pricingTiers: [
      { name: 'Plano único', price: 'R$ 99/mês', notes: 'Valor único apresentado na tabela comparativa do próprio site, sem faixas por quantidade de grupos.' },
    ],
    strengths: ['Pool de ofertas compartilhado e ranking de promotores — não vistos em nenhum outro concorrente mapeado', 'Proteção e moderação de grupos, e bot interativo para membros', 'Link na bio com pixel da Meta, para remarketing', 'Reescrita de texto com I.A, WhatsApp e Telegram, extensão do Chrome para Mercado Livre', 'Descoberta de grupos da concorrência e crescimento automático por importação de contatos'],
    weaknesses: ['A página consultada é uma tabela comparativa, não uma página de planos — não há detalhe de limites por grupo, por número de WhatsApp nem por monitoramento', 'Não há indicação de teste grátis na tabela consultada', 'Parte do que diferencia a ferramenta (importar contatos, descobrir grupos de concorrente) é crescimento de audiência, não divulgação — e cada operação precisa avaliar por conta própria se isso cabe nas regras dos grupos e da plataforma'],
    migrationNotes: 'Antes de comparar preço, separe o que você precisa: se o problema é publicar oferta em grupo, boa parte do valor da Shark está em gestão de time e crescimento de audiência. Peça a eles os limites por grupo e por número de WhatsApp, que a tabela não mostra.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    // ⚠️ A mesma tabela traz preço de TERCEIROS (IA Divulgadora e Afilira) que
    // NÃO bate com as páginas oficiais desses dois, das quais temos print
    // direto. Tabela de marketing de concorrente não é fonte oficial sobre
    // outra empresa — daqui só sai o preço e o autoclaim da própria Shark.
    source: 'Print da tabela comparativa em sharkgestao.com, enviado pela usuária em 17/09/2026. Os recursos listados são autodeclarados pela própria Shark nessa tabela.',
  },
  {
    slug: 'afiliado-inteligente',
    name: 'Afiliado Inteligente',
    positioning: 'Plataforma para afiliados com envios automáticos 24/7, site de ofertas próprio e segmentação por loja e produto. O preço é anunciado por mês, mas a cobrança apresentada é ANUAL.',
    bestFor: 'Quem já tem operação estável e aceita pagar um ano à frente em troca do valor mensal mais baixo.',
    notIdealFor: 'Quem está começando ou quer testar sem compromisso: a página consultada não indica teste grátis nem plano mensal sem o compromisso anual.',
    pricingTiers: [
      { name: 'Stander', price: 'R$ 88,19/mês — R$ 1.058,29 cobrados anualmente', notes: 'O valor anual é o que a própria página informa como cobrado. 1 instância de WhatsApp ativa, até 5 grupos no WhatsApp, até 1 monitoramento, até 5 grupos no Telegram, site de ofertas incluso (domínio não incluso), integração com domínios personalizados, sequências e segmentação por loja e produto, onboarding guiado, suporte prioritário e envios automáticos 24/7.' },
      { name: 'Pro', price: 'R$ 178,19/mês — R$ 2.138,29 cobrados anualmente', notes: 'Cobrança anual, como na página. 2 instâncias de WhatsApp simultâneas, até 12 grupos no WhatsApp, até 3 monitoramentos e até 12 grupos no Telegram.' },
      { name: 'Advanced', price: 'R$ 268,19/mês — R$ 3.218,29 cobrados anualmente', notes: 'Cobrança anual, como na página. 3 instâncias simultâneas, até 30 grupos no WhatsApp, até 6 monitoramentos e até 30 grupos no Telegram.' },
      { name: 'Enterprise', price: 'Sob consulta', notes: 'Instâncias, grupos de WhatsApp, monitoramentos e grupos de Telegram descritos como "a definir".' },
    ],
    strengths: ['Instâncias simultâneas de WhatsApp em todos os planos pagos (1, 2 ou 3)', 'Telegram com a mesma capacidade de grupos do WhatsApp em cada plano', 'Site de ofertas incluso e integração com domínio personalizado desde o plano de entrada', 'Sequências e segmentação por loja e produto', 'Onboarding guiado e suporte prioritário em todos os planos'],
    weaknesses: ['O preço é mostrado por mês, mas a cobrança apresentada é ANUAL: o plano de entrada é R$ 1.058,29 de uma vez', 'O plano de entrada cobre até 5 grupos no WhatsApp e 1 monitoramento', 'A página consultada não indica teste grátis nem opção mensal sem compromisso anual', 'O Enterprise tem todos os limites "a definir" e preço sob consulta'],
    migrationNotes: 'O número que importa aqui não é o mensal exibido, é o anual cobrado. Compare R$ 1.058,29 à vista com o que você gastaria em doze meses na alternativa, e confirme se existe opção mensal antes de assinar.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    // ⚠️ NÃO confundir com "Divulgador Inteligente" (slug
    // `divulgador-inteligente`), que é outro produto, de outra empresa, com
    // planos Essencial/Ouro/Diamante. Os nomes são parecidos e os dois estão
    // mapeados aqui.
    source: 'Print da página de planos em afiliadointeligente.com.br/#planos (Stander, Pro, Advanced e Enterprise), enviado pela usuária em 17/09/2026.',
  },
  {
    slug: 'afilimais',
    name: 'Afilimais',
    positioning: 'Plataforma de divulgação com plano gratuito permanente, CRM, emissão de notas fiscais e vários usuários na mesma conta. O preço acompanha número de usuários, números de WhatsApp e quantidade de grupos.',
    bestFor: 'Operação com EQUIPE: é a única do grupo mapeado que cobra por usuário, traz CRM completo e emite nota fiscal.',
    notIdealFor: 'Afiliada sozinha com muitos grupos: o plano de entrada pago cobre 15 grupos, e passar disso é saltar para R$ 196/mês.',
    pricingTiers: [
      { name: 'Grátis', price: 'R$ 0/mês', notes: '1 usuário, 1 número de WhatsApp, até 1 grupo, somente Amazon e Shopee, até 20 ofertas por dia e site personalizado.' },
      { name: 'Starter', price: 'R$ 99/mês', notes: '1 usuário, 1 número, até 15 grupos, Amazon, Magalu e Shopee, criação pelo Telegram, feed de ofertas, site personalizado, 1 landing page e suporte por e-mail.' },
      { name: 'Grow', price: 'R$ 196/mês', notes: 'Marcado como "Mais popular". 2 usuários, 5 números, até 100 grupos, adiciona Mercado Livre e todas as integrações, criação pelo WhatsApp e pela extensão do Chrome, 2 landing pages, suporte por WhatsApp, monitoramento de grupos, leads do WhatsApp em tempo real e 500 notas fiscais.' },
      { name: 'Pro', price: 'R$ 296/mês', notes: '5 usuários, 10 números, até 200 grupos, 5 landing pages, CRM completo, 1.000 notas fiscais e gerenciamento de grupos.' },
      { name: 'Elite', price: 'R$ 496/mês', notes: '10 usuários, 20 números, até 300 grupos, 2.000 notas fiscais e suporte dedicado.' },
    ],
    strengths: ['Plano gratuito permanente, com 1 grupo e até 20 ofertas por dia', 'Vários usuários na mesma conta (2, 5 ou 10) — nenhum outro concorrente mapeado cobra por usuário', 'CRM completo e leads do WhatsApp em tempo real', 'Emissão de notas fiscais (500, 1.000 ou 2.000 por plano)', 'Até 20 números de WhatsApp e 300 grupos no plano mais caro', 'Criação da oferta pelo Telegram, pelo WhatsApp ou pela extensão do Chrome'],
    weaknesses: ['O plano gratuito cobre 1 grupo e só Amazon e Shopee', 'O Starter, de R$ 99/mês, cobre 15 grupos e não inclui monitoramento de grupos — ele começa no Grow, de R$ 196/mês', 'O Mercado Livre entra a partir do Grow', 'O suporte do Starter é só por e-mail', 'O preço sobe por faixa de grupos: 15, 100, 200 e 300'],
    migrationNotes: 'Duas contas antes de comparar preço: quantos GRUPOS e quantas PESSOAS vão usar. Se for você sozinha, boa parte do que o Afilimais cobra (usuários, CRM, nota fiscal) não vai ser usada — e o monitoramento de grupos, que é o recurso de espelhamento, só aparece a partir do Grow.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Página de planos do Afilimais (Grátis, Starter, Grow, Pro e Elite), transcrita pela usuária em 17/09/2026.',
  },
  {
    slug: 'gigi-prime-bot',
    name: 'Gigi Prime Bot',
    positioning: 'Bot de apoio para rotina de divulgação e distribuição de ofertas em grupos.',
    bestFor: 'Perfis que buscam bot focado em operação prática de grupos.',
    notIdealFor: 'Times que exigem comparativos públicos extensos sobre governança e observabilidade.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Condições comerciais e limites devem ser confirmados diretamente.' },
    ],
    strengths: ['Fluxo direto para divulgação', 'Baixa complexidade de entrada', 'Foco em rotina operacional'],
    weaknesses: ['Informações públicas de benchmark podem ser limitadas', 'Diferenças entre planos exigem validação manual', 'SLA e suporte variam conforme canal'],
    migrationNotes: 'Comparar estabilidade da rotina em janela de testes e manter fallback manual durante transição.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
  {
    slug: 'busqy',
    name: 'Busqy',
    positioning: 'Plataforma de divulgação para afiliados com geração de texto e imagem por I.A (cobrada em créditos), envio no WhatsApp e no Telegram, site de promoções com domínio próprio, extensão do Chrome e "protetor de WhatsApp".',
    bestFor: 'Quem quer texto e arte gerados por I.A dentro da própria ferramenta e opera com vários números de WhatsApp, filas e roteadores de envio.',
    notIdealFor: 'Quem tem muitos grupos e orçamento curto: o plano de entrada cobre 5 grupos de WhatsApp, e grupos ilimitados só aparecem no plano de R$ 399/mês.',
    pricingTiers: [
      { name: 'Top Afiliado', price: 'R$ 99/mês', notes: '1 número para envio, 1 número de monitoramento, 5 grupos no WhatsApp, 5 grupos no Telegram, 1 monitoramento (até 3 grupos), 1 divulgador PRO, 1 fila de envios, 1 roteador, 1.000 créditos de I.A, extensão do Chrome, protetor de WhatsApp, bot no Telegram, site de promoções com domínio próprio (domínio não incluso) e templates personalizados.' },
      { name: 'Elite +', price: 'R$ 199/mês', notes: 'Marcado como "Mais Popular". 2 números para envio, 20 grupos no WhatsApp, 5 no Telegram, 3 monitoramentos (até 9 grupos), 3 divulgadores PRO, 3 filas, 3 roteadores e 3.000 créditos de I.A. Pacotes extras por R$ 99/mês cada, com 1 número, 15 grupos e 2.000 créditos.' },
      { name: 'Ultimate', price: 'R$ 399/mês', notes: 'Anunciado como "Oferta Especial de Lançamento" — o material não informa o valor fora da promoção. 5 números para envio, grupos ilimitados no WhatsApp, 5 no Telegram, 10 monitoramentos (até 30 grupos), 10 divulgadores PRO, 10 filas, 10 roteadores e 10.000 créditos de I.A. Pacotes extras por R$ 99/mês cada.' },
    ],
    strengths: ['Geração de TEXTO e de IMAGEM por I.A dentro da ferramenta', 'Site de promoções com domínio próprio e templates personalizados', 'Até 5 números de WhatsApp para envio e grupos ilimitados no plano mais caro', 'Filas e roteadores de envio, além de bot no Telegram e extensão do Chrome', 'Criador de divulgações ilimitado para Shopee, Mercado Livre, Amazon, SHEIN e mais'],
    weaknesses: ['O plano de entrada custa R$ 99/mês e cobre apenas 5 grupos no WhatsApp', 'Grupos ilimitados só no plano de R$ 399/mês', 'Os recursos de I.A são cobrados em CRÉDITOS (1.000, 3.000 ou 10.000 por plano) — quando acabam, é preciso comprar pacote extra de R$ 99/mês', 'O monitoramento do plano de entrada cobre até 3 grupos', 'O domínio do site de promoções não está incluso', 'O plano Ultimate é anunciado como oferta de lançamento, sem o valor cheio publicado'],
    migrationNotes: 'Conte os grupos antes de comparar preço: o plano de R$ 99 cobre 5 e o de R$ 199 cobre 20. E confira o consumo de créditos de I.A na sua rotina — é uma conta que não aparece no preço do plano, mas aparece na fatura quando os créditos acabam.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Página de planos do Busqy (Top Afiliado, Elite + e Ultimate), transcrita pela usuária em 17/09/2026.',
  },
  {
    slug: 'afilira',
    name: 'Afilira',
    positioning: 'Ferramenta que BUSCA ofertas automaticamente em grupos e nas lojas, prepara o link com a comissão da afiliada e envia para WhatsApp e Telegram. Tem o menor preço de entrada entre os concorrentes mapeados.',
    bestFor: 'Quem quer que a ferramenta ache a oferta (não só publique a que você escolheu) e precisa de Awin, Terabyte e SHEIN além dos quatro marketplaces principais.',
    notIdealFor: 'Quem quer começar barato E com vários grupos: o plano de R$ 47 busca em 1 grupo e envia para 1 grupo.',
    pricingTiers: [
      { name: 'Starter', price: 'R$ 47/mês', notes: '1 número de WhatsApp conectado, busca ofertas em apenas 1 grupo, envio para apenas 1 grupo. Shopee, Amazon, Mercado Livre e Magalu. Ofertas encontradas automaticamente e ofertas compartilhadas pela comunidade. Sem anúncios e sem tag de marca. Suporte pelo painel.' },
      { name: 'Professional', price: 'R$ 97/mês', notes: 'Marcado como "Popular". 3 números conectados, envio para WhatsApp e Telegram, busca em até 50 grupos, envio para quantos grupos precisar. Adiciona Awin (Casas Bahia, KaBuM!, Centauro, Dafiti e mais), Terabyte Shop e SHEIN. Envio de um grupo específico para outro, filtros por grupo, ofertas no Status, boas-vindas e saída no privado, criação de grupos em lote, relatórios, extensão para capturar produtos do Mercado Livre, agendamento e adição de membros com intervalo de 2 minutos. Suporte prioritário por WhatsApp.' },
      { name: 'Enterprise', price: 'R$ 197/mês', notes: '10 números conectados, busca e envio em quantos grupos precisar, integração com os sistemas da cliente e avisos em outras ferramentas. Tudo do Professional incluído.' },
    ],
    strengths: ['Menor preço de entrada entre os concorrentes mapeados: R$ 47/mês', 'Busca as ofertas sozinha, em grupos e nas lojas, em vez de só publicar o link que a afiliada escolheu', 'Awin (Casas Bahia, KaBuM!, Centauro, Dafiti), Terabyte Shop e SHEIN a partir do Professional', 'Telegram além do WhatsApp, e até 10 números conectados no Enterprise', 'Publicação no Status do WhatsApp, boas-vindas e saída automáticas no privado, criação de grupos em lote e relatórios', 'Integração com sistemas próprios da cliente no Enterprise'],
    weaknesses: ['O plano de R$ 47 busca ofertas em apenas 1 grupo e envia para apenas 1 grupo', 'O envio de um grupo específico para outro — o espelhamento — aparece só a partir do Professional, de R$ 97/mês', 'Awin, Terabyte e SHEIN também só a partir do Professional', 'O plano de entrada tem suporte apenas pelo painel; suporte por WhatsApp começa no Professional'],
    migrationNotes: 'O preço de R$ 47 é real, mas cobre uma origem e um destino. Se você já acompanha mais de um grupo ou publica em mais de um, o valor a comparar é o Professional, de R$ 97/mês — que é onde também entram o espelhamento entre grupos, a Awin, a Terabyte e a SHEIN.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Página de planos do Afilira (Starter, Professional e Enterprise), transcrita pela usuária em 17/09/2026.',
  },
  {
    slug: 'ia-divulgadora',
    name: 'IA Divulgadora',
    positioning: 'Plataforma para afiliados com quatro faixas, de quem está começando a operação empresarial com infraestrutura dedicada. O disparo automático para grupos é cobrado por QUANTIDADE de grupos.',
    bestFor: 'Operação grande: é o único concorrente mapeado com faixa empresarial até 300 grupos de envio, infraestrutura dedicada e consultoria de setup.',
    notIdealFor: 'Quem quer o robô publicando em muitos grupos sem trocar de plano: o disparo vai de 3 grupos (R$ 99) a 10 (R$ 179,90) e 25 (a partir de R$ 300).',
    pricingTiers: [
      { name: 'Afiliado Iniciante', price: 'R$ 69,90/mês', notes: '"Comece a divulgar sem limite": gerador de ofertas sem limite, links de afiliado automáticos, imagens para Instagram, vitrine personalizada e promoções no WhatsApp. Tem botão "Começar grátis". A lista NÃO inclui disparo automático para grupos — esse item aparece a partir do plano seguinte.' },
      { name: 'Afiliado Pro', price: 'R$ 99,00/mês', notes: 'Apresentado na própria página como "Automatize seus grupos". Disparo para 3 grupos, gestão de leads, monitoramento, Modo Clone + Link Preview, filas e agendamento, Fura Fila + Marcar Todos, segmentação por nicho, SubID por marketplace e Instagram respondendo comentários, stories e reels.' },
      { name: 'Creators', price: 'R$ 179,90/mês', notes: 'Marcado como "Mais escolhido". Tudo do Pro com disparo para 10 grupos, mais conexão extra por R$ 29,90.' },
      { name: 'Empresarial', price: 'a partir de R$ 300/mês', notes: 'Disparo para 25 grupos no WhatsApp, 2 números conectados, infraestrutura dedicada e consultoria de setup. A página traz um seletor de grupos de envio com as faixas 25, 50, 100, 200 e 300, mas não publica o preço de cada faixa acima do valor inicial.' },
      // Add-on cobrado à parte. Fica como item próprio de `pricingTiers`, e não
      // só no `notes` de outro plano, porque é assim que a guarda FR-031
      // reconhece o valor como verificado — e porque ele muda a conta de quem
      // usa mais de um número.
      { name: 'Conexão extra de WhatsApp (add-on)', price: 'R$ 29,90/mês', notes: 'Cobrada por conexão adicional, listada nos planos Creators e Empresarial.' },
    ],
    strengths: ['Única do grupo mapeado com faixa empresarial explícita: até 300 grupos de envio, infraestrutura dedicada e consultoria de setup', 'Modo Clone + Link Preview, gestão de leads e SubID por marketplace', 'Instagram respondendo comentários, stories e reels', 'Vitrine personalizada e imagens para Instagram já no plano de entrada', 'Plano de entrada com "Começar grátis"'],
    weaknesses: ['O plano de entrada, de R$ 69,90, não lista disparo automático para grupos — a própria página só promete "Automatize seus grupos" a partir do Afiliado Pro, de R$ 99/mês', 'O preço acompanha a QUANTIDADE de grupos de envio: 3 no Pro, 10 no Creators e 25 no Empresarial — crescer em grupos exige trocar de plano', 'Cada conexão extra de WhatsApp custa R$ 29,90/mês à parte', 'O Empresarial é "a partir de" R$ 300/mês e o preço das faixas de 50 a 300 grupos não aparece na página'],
    migrationNotes: 'Antes de comparar preço, conte em quantos grupos você publica: é esse número, e não o de ofertas, que define o plano. Some também as conexões extras de R$ 29,90 se você usa mais de um número de WhatsApp.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Print da página de planos em iadivulgadora.com.br/#pricing (Afiliado Iniciante, Afiliado Pro, Creators e Empresarial), enviado pela usuária em 17/09/2026.',
  },
  {
    slug: 'divulga-links',
    name: 'DivulgaLinks',
    positioning: 'Plataforma de divulgação por NICHO: cada nicho reúne 1 Instagram, 1 grupo de Telegram e vários grupos de WhatsApp do mesmo assunto. Cria o post a partir do link do produto e tem forte automação de Instagram.',
    bestFor: 'Quem divulga em Instagram, Telegram e WhatsApp ao mesmo tempo e organiza a operação por temas separados — um nicho de bebê, outro de eletrônicos, outro de casa.',
    notIdealFor: 'Quem tem um nicho só e muitos grupos: subir de plano não aumenta grupo nenhum, só a quantidade de nichos.',
    pricingTiers: [
      { name: 'Starter', price: 'Preço não informado na página consultada', notes: 'Descrito como "igual ao PRIME (com limitações)", com 7 dias grátis.' },
      { name: 'Prime', price: 'R$ 69,90/mês', notes: '1 nicho.' },
      { name: 'Premium', price: 'R$ 129,90/mês', notes: '5 nichos.' },
      { name: 'Pro', price: 'R$ 169,90/mês', notes: '10 nichos.' },
      { name: 'Ultimate', price: 'R$ 229,90/mês', notes: '15 nichos. A página afirma que a ÚNICA diferença entre os planos é quantos nichos você pode gerenciar; cada nicho equivale a 1 Instagram + 1 grupo de Telegram + vários grupos de WhatsApp do mesmo nicho.' },
    ],
    strengths: ['Automação de Instagram que nenhum outro concorrente mapeado tem: criação automática de artes para stories, postagem e agendamento de stories e reels, resposta automática a comentários e link enviado no direct', 'Cobre Telegram além do WhatsApp', 'Listas de produtos geradas automaticamente por categoria ou palavra-chave', 'AliExpress, Amazon, AWIN (algumas lojas), Shopee, Magazine Luiza, Mercado Livre e Natura', 'Plano Starter com 7 dias grátis'],
    weaknesses: ['O preço acompanha a quantidade de NICHOS, não a de grupos — quem tem um nicho só não ganha nada subindo de plano', 'Cada nicho embute 1 Instagram e 1 grupo de Telegram; quem não usa esses dois canais paga por eles do mesmo jeito', 'O preço do plano Starter não aparece na página de planos consultada', 'O material consultado descreve criar o post a partir do link do produto e gerar listas por categoria — não menciona monitorar um grupo de origem e espelhar o que é publicado nele'],
    migrationNotes: 'Antes de comparar preço, conte quantos NICHOS diferentes você divulga, não quantos grupos. Se for um nicho só, o Prime já é o teto útil da ferramenta; se você não publica no Instagram nem no Telegram, boa parte do que está no preço não vai ser usada.',
    updatedAt: '2026-09-17',
    verifiedAt: '2026-09-17',
    source: 'Print do artigo "Planos DivulgaLinks 2025" em da.divulgalinks.com.br (publicado em 01/01/2025 pelo Suporte), enviado pela usuária em 17/09/2026 com a confirmação de que preços e condições seguem válidos nesta data.',
  },
  {
    slug: 'ofertiva',
    name: 'Ofertiva',
    positioning: 'Bot de WhatsApp para afiliados com página na bio (vitrine própria com geração por IA) incluída em todo plano, e Meta Pixel para medir conversão de anúncio a partir do plano intermediário. Cobra por teto de WhatsApps conectados, destinos de envio e grupos espelhados.',
    bestFor: 'Quem quer, junto do robô de ofertas, uma página de bio pronta (vitrine própria com IA) e Meta Pixel para rastrear conversão de anúncio — e não se importa em ficar limitada a poucos grupos espelhados.',
    notIdealFor: 'Quem quer espelhar mais de 1 grupo sem trocar de plano (o Essencial cobre só 1) ou precisa converter Magalu — a Ofertiva não lista essa loja.',
    pricingTiers: [
      { name: 'Essencial', price: 'R$ 39,90/mês', notes: '1 WhatsApp conectado, envie para até 5 destinos (grupos ou canais), 1 grupo espelhado. Até 15.000 envios/mês, até 1 rotina de publicação automática, 300 gerações de IA/mês. Página na bio incluída (20 gerações de IA/mês nela), mas SEM painel de desempenho da página, SEM Meta Pixel e SEM gestão de grupos com link de entrada automático.' },
      { name: 'Profissional', price: 'R$ 69,90/mês', notes: 'Marcado como o plano recomendado. 2 WhatsApps conectados, até 10 destinos, 3 grupos espelhados. Até 60.000 envios/mês, até 3 rotinas automáticas, 600 gerações de IA/mês, 50 gerações de IA na página da bio/mês. Já inclui painel de desempenho da página na bio, Meta Pixel na página na bio e gestão de grupos com link de entrada automático.' },
      { name: 'Escala', price: 'R$ 139,90/mês', notes: '5 WhatsApps conectados, até 30 destinos, 6 grupos espelhados. Até 300.000 envios/mês, até 10 rotinas automáticas, 1.500 gerações de IA/mês, 100 gerações de IA na página da bio/mês. Mesmos recursos do Profissional (painel de desempenho, Meta Pixel, gestão de grupos), em teto maior.' },
    ],
    strengths: [
      'Página na bio (vitrine própria) com geração por IA incluída em todos os planos — não temos equivalente',
      'Meta Pixel na página na bio para medir conversão de anúncio, a partir do plano intermediário',
      'Gestão de grupos com link de entrada automático, a partir do plano intermediário',
      'Até 5 conexões de WhatsApp na mesma conta, no plano mais caro',
      'Garantia de 7 dias e pagamento via Mercado Pago em todos os planos',
    ],
    weaknesses: [
      'Não converte Magalu — só Shopee, Mercado Livre, Amazon, SHEIN e AliExpress, contra as nossas 6 lojas',
      'Espelhamento tem teto por plano: 1 grupo no Essencial, 3 no Profissional, 6 no Escala — não temos teto de grupos espelhados',
      'Destinos de envio também têm teto: 5 no Essencial, 10 no Profissional, 30 no Escala',
      'Painel de desempenho da página na bio, Meta Pixel e gestão automática de grupos ficam de fora do plano de entrada',
    ],
    migrationNotes: 'Se página na bio com Meta Pixel pesa na sua decisão, é onde a Ofertiva ganha — não temos essa peça. Se o que importa é espelhar quantos grupos quiser sem teto e ter Magalu na lista de lojas, o Espelha Grupos cobre os dois já no plano Basic, de R$ 39 por 30 dias.',
    updatedAt: '2026-09-22',
    verifiedAt: '2026-09-22',
    source: 'Print da página de planos em ofertiva.app.br/#precos (Essencial, Profissional e Escala), enviado pela usuária em 22/09/2026. Cada card mostra um "De R$ X" riscado ao lado do preço final, mas o texto abaixo diz "cobrados mensalmente" — não é promoção de 1º mês como o Promium, é o valor da cobrança recorrente.',
  },
  // Cinco fichas de 23/09/2026, coletadas DIRETAMENTE da página oficial de cada
  // concorrente (HTML baixado do próprio domínio, não tabela de IA nem de
  // terceiro). Motivo: na consulta "bot para afiliados no WhatsApp" o ChatGPT
  // citou estes nomes e não havia página nossa comparando com nenhum deles.
  {
    slug: 'easyfy',
    name: 'Easyfy',
    positioning: 'Plataforma para afiliados que converte links de 8 plataformas, monitora grupos e publica no WhatsApp e no Telegram, com analytics de comissão, encurtador próprio, vitrine e imagens de produto geradas por IA.',
    bestFor: 'Quem divulga fora dos grandes marketplaces (AWIN, Rakuten) e quer WhatsApp e Telegram no mesmo painel, começando por um plano gratuito permanente.',
    notIdealFor: 'Quem publica em muitos grupos: o PRO cobre 10 grupos e canais de destino e 1 número de WhatsApp.',
    pricingTiers: [
      { name: 'Free', price: 'R$ 0', notes: 'Sem cartão. Links de afiliado ilimitados, 1 canal (WhatsApp ou Telegram), 1 grupo monitorado e 1 grupo de destino, 10 promoções automáticas por dia, 8 plataformas.' },
      { name: 'PRO', price: 'R$ 59,90/mês', notes: 'Cobrado mensalmente. Automação de WhatsApp e Telegram, 1 número de WhatsApp e 1 de Telegram, 10 grupos e canais de destino, disparos em massa, extensão do Chrome, analytics com comissões da Shopee e da Awin, link na bio e vitrine pública.' },
      { name: 'Elite', price: 'R$ 89,90/mês', notes: 'Cobrado mensalmente. Tudo do PRO e mais 50 imagens com IA por mês para stories.' },
    ],
    strengths: ['Plano gratuito permanente, sem cartão, já com 1 grupo monitorado e 1 de destino', '8 plataformas: Amazon, Mercado Livre, Shopee, Magazine Luiza, AliExpress, AWIN, Rakuten e SHEIN', 'WhatsApp e Telegram no mesmo painel', 'Analytics com comissões reais da Shopee e da Awin, encurtador próprio com rastreamento, vitrine e link na bio', 'Imagens de produto geradas por IA no Elite'],
    weaknesses: ['O PRO cobre até 10 grupos e canais de destino e 1 número de WhatsApp', 'O plano gratuito limita a 10 promoções automáticas por dia', 'A página consultada não menciona garantia nem política de reembolso'],
    migrationNotes: 'Conte quantos grupos de destino você tem hoje: o PRO cobre 10. Se você divulga AWIN ou Rakuten, a Easyfy cobre e nós não.',
    updatedAt: '2026-09-23',
    verifiedAt: '2026-09-23',
    source: 'Página oficial easyfy.click (seção de preços, planos Free, PRO e Elite), consultada diretamente em 23/09/2026.',
  },
  {
    slug: 'lucreshop',
    name: 'LucreShop',
    positioning: 'Plataforma para afiliados de Amazon, Shopee, Mercado Livre e Magalu que junta bot de nicho (busca e publica sozinho), espelhamento de grupos, campanhas, WhatsApp, Telegram, automação de Instagram, vitrine própria e relatórios de cliques e ROI. As cotas são por "loja" (perfil) e por número de WhatsApp.',
    bestFor: 'Quem quer, no mesmo painel, bot de nicho que busca oferta sozinho, WhatsApp e Telegram, automação de Instagram, vitrine com SEO e relatórios de cliques e ROI.',
    notIdealFor: 'Quem publica em muitos grupos com orçamento curto: o plano de entrada cobre 1 grupo ou canal, e 20 grupos por loja só aparecem no Pro, de R$ 185/mês.',
    pricingTiers: [
      { name: 'Meu Primeiro Grupo', price: 'A partir de R$ 29,90/mês', notes: '1 loja com os 4 marketplaces, 1 número de WhatsApp com 1 grupo ou canal, 1 canal do Telegram, 1 bot de nicho, 1 campanha, 1 espelhamento, 1 automação de Instagram, 1 link inteligente e 1 landing page. É o plano do teste de 3 dias grátis, sem cartão.' },
      { name: 'Grupo em Crescimento', price: 'R$ 59,90/mês', notes: '1 número de WhatsApp com até 3 grupos ou canais, até 3 bots de nicho, 3 campanhas, 3 espelhamentos e 3 automações de Instagram por loja.' },
      { name: 'Start', price: 'R$ 95/mês', notes: '1 número de WhatsApp com até 8 grupos ou canais, 2 canais do Telegram, até 5 bots de nicho, 5 campanhas e 5 espelhamentos por loja, bio com Facebook Pixel e Google Tag Manager, relatório de pedidos e comissões da Shopee.' },
      { name: 'Pro', price: 'R$ 185/mês', notes: 'Marcado como "Mais escolhido". 2 lojas, 2 números de WhatsApp por loja com até 10 grupos cada (20 por loja), até 10 bots de nicho, espelhamentos e automações de Instagram ilimitados.' },
      { name: 'Elite', price: 'R$ 530/mês', notes: '4 lojas, 5 números de WhatsApp por loja com até 20 grupos cada (100 por loja), até 10 bots de nicho, espelhamentos ilimitados.' },
    ],
    strengths: ['Bot de nicho que busca e publica sozinho em todos os planos', 'WhatsApp, Telegram e automação de Instagram (resposta a comentário e mensagem no Direct)', 'Vitrine própria com subdomínio, link inteligente que troca de grupo quando lota, landing pages', 'Relatórios de cliques, participantes por DDD e calculadora de ROI', 'Preço de entrada de R$ 29,90 e 3 dias grátis sem cartão', 'Política de reembolso e dados da empresa publicados no site'],
    weaknesses: ['O plano de entrada cobre 1 grupo ou canal por número', 'Os limites contam por "loja" (perfil) e por número — crescer em grupos é trocar de plano', 'Não lista SHEIN nem AliExpress entre os marketplaces', 'Entre o Start (R$ 95) e o Pro (R$ 185) o preço quase dobra'],
    migrationNotes: 'Conte os grupos de destino antes de comparar: é o limite por número de WhatsApp que define o plano. O teste de 3 dias começa no plano Meu Primeiro Grupo, com 1 grupo.',
    updatedAt: '2026-09-23',
    verifiedAt: '2026-09-23',
    source: 'Página oficial lucreshop.com.br (seção de planos: Meu Primeiro Grupo, Grupo em Crescimento, Start, Pro e Elite), consultada diretamente em 23/09/2026.',
  },
  {
    slug: 'afiliai',
    name: 'AfiliAI',
    positioning: 'Automação de divulgação para afiliados que clona grupos externos (com card reescrito por IA), busca produtos em oferta e posta sozinha (AutoPilot), agenda campanhas e publica no WhatsApp e no Telegram. Tem também um robô para encher grupos.',
    bestFor: 'Quem quer clonar grupos, AutoPilot e vários WhatsApps conectados num plano de entrada abaixo de R$ 50, e também pretende usar ferramenta de crescimento de grupo.',
    notIdealFor: 'Quem publica em mais de 10 grupos de destino ou divulga SHEIN e AliExpress — a página lista Shopee, Mercado Livre, Amazon e Magalu.',
    pricingTiers: [
      { name: 'Ofertas', price: 'R$ 49,90/mês (anunciado "de R$ 99,90")', notes: 'Até 5 grupos de destino, clone de grupos, AutoPilot e blocos de campanha, agendamento com CTAs e follow-ups, página de vitrine, canais do Telegram e 2 WhatsApps conectados. A página não informa se o valor "de" riscado volta a valer depois.' },
      { name: 'Combo', price: 'R$ 99,00/mês (anunciado "de R$ 209,90")', notes: 'Marcado como "Mais escolhido". Tudo do Ofertas, até 10 grupos de destino, robô de encher grupo ilimitado, 5 WhatsApps conectados, relatórios diários da Shopee e suporte prioritário.' },
      { name: 'Robo', price: 'R$ 59,90/mês (anunciado "de R$ 129,90")', notes: 'Só para encher grupo, sem postar ofertas: adiciona membros via Excel, transfere membros entre grupos, 1 WhatsApp dedicado.' },
    ],
    strengths: ['Clone de grupos e AutoPilot (busca produto em oferta e posta sozinho) já no plano de entrada', 'Card da oferta reescrito por IA', 'WhatsApp e Telegram, com vários WhatsApps conectados (2 no Ofertas, 5 no Combo)', 'Relatórios diários por e-mail e vitrine própria'],
    weaknesses: ['O plano de entrada cobre até 5 grupos de destino; o Combo, 10', 'A página lista 4 lojas: Shopee, Mercado Livre, Amazon e Magalu', 'Os preços aparecem ao lado de um valor "de" riscado, sem dizer se é promoção temporária', 'A página consultada não menciona teste grátis, garantia nem política de reembolso', 'Parte do produto (encher grupo adicionando membros) é crescimento de audiência — cada operação precisa avaliar se isso cabe nas regras dos grupos e do WhatsApp'],
    migrationNotes: 'Conte os grupos de destino: o Ofertas cobre 5 e o Combo 10. Pergunte a eles se o valor riscado volta a valer depois de algum tempo, porque a página não diz.',
    updatedAt: '2026-09-23',
    verifiedAt: '2026-09-23',
    // ⚠️ Existe OUTRO produto com nome parecido em afiliai.app (gerador de post
    // para Mercado Livre, só plano grátis no ar). Esta ficha é do afiliai.com.br.
    source: 'Página oficial afiliai.com.br (seção de planos: Ofertas, Combo e Robo), consultada diretamente em 23/09/2026.',
  },
  {
    slug: 'achify',
    name: 'Achify',
    positioning: 'Automação de grupos de achadinhos no WhatsApp e no Telegram com piloto automático 24h na Shopee (garimpa e envia sozinho), central de ofertas de Amazon e Mercado Livre para aprovar em poucos cliques, marca d\'água, vitrine própria e link na bio.',
    bestFor: 'Quem divulga Shopee e quer o robô garimpando e publicando sozinho, com marca d\'água, selo de desconto e vitrine, em poucos grupos.',
    notIdealFor: 'Quem publica em muitos grupos: o Start cobre 1 grupo para envio e o Ultra, 10. E quem quer publicação automática de Amazon e Mercado Livre — ali as ofertas passam por aprovação manual.',
    pricingTiers: [
      { name: 'Achify Start', price: 'R$ 57/mês', notes: 'Plano mensal. Vitrine e link na bio, piloto automático 24h na Shopee, central Amazon e Mercado Livre (aprovação em poucos cliques), envio automático WhatsApp e Telegram, menção @todos, 1 canal WhatsApp, 1 grupo para envio, até 168 postagens/dia.' },
      { name: 'Condição de entrada (cartão)', price: 'R$ 1,00 por 8 dias', notes: 'Oferta do checkout: 8 dias de acesso total por R$ 1,00 no cartão, renovando automaticamente pelo valor mensal do Start a partir do 9º dia.' },
      { name: 'Achify Pro', price: 'R$ 97/mês', notes: 'Marcado como "Plano Mais Escolhido". Tudo do Start, 1 grupo monitorado (garimpo em outro grupo e envio automático), 2 canais WhatsApp, 3 grupos para envio, até 168 postagens/dia.' },
      { name: 'Achify Ultra', price: 'R$ 147/mês', notes: 'Tudo do Pro, 5 grupos monitorados, 3 canais WhatsApp, 10 grupos para envio, até 287 postagens/dia.' },
      { name: 'Trimestral Start', price: 'R$ 97 por 3 meses', notes: 'Opção trimestral do Start informada no FAQ da página (≈ R$ 32/mês).' },
    ],
    strengths: ['Piloto automático 24h na Shopee: garimpa, aplica o link e envia sozinho', 'Marca d\'água, moldura com a cor da marca e selo de desconto em cada foto', 'WhatsApp e Telegram, vitrine online e link na bio em todos os planos', 'Garantia de 7 dias com devolução de 100% e política de reembolso publicada', 'Opção trimestral mais barata por mês'],
    weaknesses: ['O Start envia para 1 grupo e não monitora grupo de origem — o espelhamento começa no Pro, com 1 grupo monitorado', 'Amazon e Mercado Livre não entram no piloto automático: as ofertas precisam ser aprovadas à mão', 'Lojas listadas: Shopee, Amazon e Mercado Livre', 'O teto do plano mais caro é de 10 grupos para envio'],
    migrationNotes: 'Se o que você quer é espelhar um grupo de origem, o valor a comparar é o Pro (R$ 97/mês), não o Start. E conte os grupos de envio: 1, 3 ou 10 conforme o plano.',
    updatedAt: '2026-09-23',
    verifiedAt: '2026-09-23',
    source: 'Página oficial achify.com.br (seção de planos mensal/trimestral, FAQ e checkout), consultada diretamente em 23/09/2026.',
  },
  {
    slug: 'afiliados-turbo',
    name: 'Afiliados Turbo',
    positioning: 'Sistema que busca ofertas no Mercado Livre, na Amazon e na Shopee (e monitora grupos de WhatsApp), converte o link para a etiqueta da afiliada e publica nos grupos respeitando janela de horário, intervalo mínimo e teto diário. Cobra por grupos de publicação e ofertas por mês.',
    bestFor: 'Quem quer o catálogo de ofertas classificado por IA, com categoria por grupo e limite diário, e testar 7 dias sem cartão.',
    notIdealFor: 'Quem publica muita oferta por mês com orçamento curto: o Starter cobre 1 grupo e 30 ofertas por mês.',
    pricingTiers: [
      { name: 'Starter', price: 'R$ 79,90/mês', notes: '7 dias grátis, cobrado só depois. 1 grupo de publicação, 30 ofertas por mês, conversor de links, bio page, publicação automática no WhatsApp e busca de produtos no Mercado Livre.' },
      { name: 'Profissional', price: 'R$ 111,90/mês', notes: 'Marcado como "Mais escolhido". 5 grupos de publicação, 200 ofertas por mês e analytics avançado.' },
      { name: 'Premium', price: 'R$ 219,90/mês', notes: '999 grupos de publicação, 9999 ofertas por mês e domínio próprio.' },
    ],
    strengths: ['7 dias grátis sem cartão, sem fidelidade e sem multa', 'Busca as ofertas sozinho nos marketplaces e classifica por IA, com categoria por grupo', 'Janela de horário, intervalo mínimo e teto diário por grupo, com bloqueio de oferta repetida', 'Link com a etiqueta da afiliada em Mercado Livre, Amazon e Shopee', 'Página honesta sobre risco de bloqueio e sobre não prometer faturamento'],
    weaknesses: ['O Starter cobre 1 grupo e 30 ofertas por mês', 'O preço sobe por grupos de publicação e ofertas por mês', 'A geração de link com a etiqueta funciona em 3 lojas (Mercado Livre, Amazon e Shopee); as outras são só reconhecidas', 'A página consultada não menciona Telegram'],
    migrationNotes: 'Conte duas coisas antes de comparar: quantos grupos recebem ofertas e quantas ofertas saem por mês. É por essas duas cotas que o plano muda.',
    updatedAt: '2026-09-23',
    verifiedAt: '2026-09-23',
    source: 'Página oficial afiliadosturbo.com.br (seção de planos Starter, Profissional e Premium e FAQ), consultada diretamente em 23/09/2026.',
  },
  {
    slug: 'manual-spreadsheet-workflow',
    name: 'Planilha + envio manual',
    positioning: 'Operação manual com planilha e checklist humano para organizar grupos, links e horários.',
    bestFor: 'Operações pequenas com baixo volume semanal e revisão próxima de quem publica.',
    notIdealFor: 'Times que precisam escalar cadência, auditoria e repetição diária com menos erro manual.',
    pricingTiers: [
      { name: 'Ferramentas básicas', price: 'Baixo custo', notes: 'Planilha + rotina manual; custo principal vira tempo operacional.' },
    ],
    strengths: [
      'Controle humano total sobre contexto e copy',
      'Baixo custo inicial',
      'Sem dependência de integrações técnicas',
    ],
    weaknesses: [
      'Baixa escalabilidade operacional',
      'Maior risco de esquecimento de horário e repetição',
      'Auditoria depende de disciplina manual',
    ],
    migrationNotes: 'Migrar mantendo a planilha como planejamento editorial e delegando execução recorrente ao fluxo operacional da ferramenta.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Pesquisa editorial interna com critérios públicos de operação responsável.',
  },
  {
    slug: 'generic-automation-tools',
    name: 'Ferramentas genéricas de automação',
    positioning: 'Conectores, scripts e fluxos customizados para equipes técnicas com múltiplas integrações.',
    bestFor: 'Operações com engenharia interna e necessidade de integrar diversos sistemas.',
    notIdealFor: 'Times sem capacidade técnica contínua para manter integrações e governança operacional.',
    pricingTiers: [
      { name: 'Stack técnica', price: 'Variável', notes: 'Custo depende de ferramentas, horas de implementação e manutenção contínua.' },
    ],
    strengths: [
      'Alta flexibilidade de arquitetura',
      'Integração com múltiplos sistemas de dados',
      'Customização avançada por equipe técnica',
    ],
    weaknesses: [
      'Maior custo de manutenção ao longo do tempo',
      'Risco de quebra quando APIs/layouts mudam',
      'Dependência de documentação e governança interna',
    ],
    migrationNotes: 'Mapear fluxos críticos e migrar por etapas, mantendo integrações externas em paralelo até estabilizar o novo processo.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Pesquisa editorial interna com foco em manutenção técnica e governança.',
  },
  {
    slug: 'official-service-api-tools',
    name: 'Ferramentas de atendimento/API oficial',
    positioning: 'Soluções focadas em atendimento, templates e conversas com clientes usando APIs oficiais.',
    bestFor: 'Empresas com foco em suporte, CRM conversacional e jornadas de atendimento.',
    notIdealFor: 'Operações cujo principal problema é curadoria e redistribuição de ofertas em múltiplos grupos.',
    pricingTiers: [
      { name: 'Plano por conversas/uso', price: 'Variável', notes: 'Normalmente inclui custos de mensagens e plataforma.' },
    ],
    strengths: [
      'Governança forte para atendimento',
      'Bom encaixe com fluxos de suporte comercial',
      'Suporte a templates e integrações de atendimento',
    ],
    weaknesses: [
      'Nem sempre cobre curadoria de ofertas por grupos',
      'Pode exigir complementos para rotina de afiliados',
      'Custo pode crescer com volume de conversas',
    ],
    migrationNotes: 'Usar ferramentas oficiais para atendimento e manter fluxo especializado para operação de ofertas quando necessário.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Pesquisa editorial interna orientada a fluxos de atendimento e conversas.',
  },
]

const competitorsBySlug = new Map(COMPETITORS.map((competitor) => [competitor.slug, competitor]))

function assertString(value, field, competitorName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Competitor data inválido (${competitorName}): campo obrigatório "${field}" ausente ou vazio.`)
  }
}

function validateCompetitorShape(competitor) {
  const competitorName = competitor?.name || competitor?.slug || 'unknown'

  for (const field of REQUIRED_STRING_FIELDS) {
    assertString(competitor?.[field], field, competitorName)
  }
  assertString(competitor?.source, 'source', competitorName)

  if (!Array.isArray(competitor.pricingTiers) || competitor.pricingTiers.length === 0) {
    throw new Error(`Competitor data inválido (${competitorName}): pricingTiers deve ter pelo menos um item.`)
  }

  for (const tier of competitor.pricingTiers) {
    assertString(tier?.name, 'pricingTiers[].name', competitorName)
    assertString(tier?.price, 'pricingTiers[].price', competitorName)
    assertString(tier?.notes, 'pricingTiers[].notes', competitorName)
  }

  for (const field of ['strengths', 'weaknesses']) {
    if (!Array.isArray(competitor[field]) || competitor[field].length === 0) {
      throw new Error(`Competitor data inválido (${competitorName}): ${field} deve ter pelo menos um item.`)
    }
    competitor[field].forEach((item, index) => assertString(item, `${field}[${index}]`, competitorName))
  }
}

export function listCompetitors() {
  return COMPETITORS
}

export function getCompetitorBySlug(slug) {
  const competitor = competitorsBySlug.get(slug)
  if (!competitor) throw new Error(`Competitor não encontrado para slug: ${slug}`)
  return competitor
}

for (const competitor of COMPETITORS) {
  validateCompetitorShape(competitor)
}
