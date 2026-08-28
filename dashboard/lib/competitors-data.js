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
    updatedAt: '2026-08-26',
    verifiedAt: '2026-08-26',
    source: 'Print da página de preços em gigibot.com.br, enviado pela usuária em 26/08/2026 (substitui o print de 31/07/2026; os quatro planos e os preços não mudaram entre as duas coletas).',
  },
  {
    slug: 'divulgador-inteligente',
    name: 'Divulgador Inteligente',
    positioning: 'Ferramenta de automação para divulgação em grupos de WhatsApp com foco em rotina recorrente.',
    bestFor: 'Operações que querem automatizar divulgação com fluxo pronto sem montar stack técnica própria.',
    notIdealFor: 'Times que precisam de governança avançada de logs e comparação contínua de qualidade por campanha.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Preço e limites podem variar conforme período e oferta comercial.' },
    ],
    strengths: ['Automação de rotina de divulgação', 'Fluxo orientado para grupos', 'Baixa fricção inicial'],
    weaknesses: ['Pouca transparência pública de limites em materiais de comparação', 'Dependência de validação manual de claims de mercado', 'Comparação de suporte e SLA precisa ser confirmada caso a caso'],
    migrationNotes: 'Mapear regras de envio, limites e estrutura de grupos antes da migração para evitar perda de consistência operacional.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
  {
    slug: 'divulga-ninja',
    name: 'Divulga Ninja',
    positioning: 'Solução para divulgação automatizada em grupos com apelo de velocidade operacional.',
    bestFor: 'Equipes que priorizam agilidade de execução em volume de grupos.',
    notIdealFor: 'Operações que precisam de trilha detalhada de auditoria por campanha e critérios rígidos de governança.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Detalhes de preço e limites devem ser confirmados no canal oficial.' },
    ],
    strengths: ['Foco em execução rápida', 'Uso orientado a grupos', 'Adoção simplificada'],
    weaknesses: ['Claims de diferenciação exigem validação periódica', 'Cobertura de funcionalidades avançadas pode variar por plano', 'Dependência de confirmação de política de suporte'],
    migrationNotes: 'Executar piloto com subconjunto de grupos e validar qualidade de envio antes de escalar.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
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
    positioning: 'Ferramenta para apoiar divulgação e organização de ofertas em WhatsApp.',
    bestFor: 'Operações que querem ganhar produtividade na curadoria e distribuição.',
    notIdealFor: 'Cenários que dependem de comparação pública detalhada de recursos de compliance avançado.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Faixas e benefícios comerciais devem ser validados no fornecedor.' },
    ],
    strengths: ['Produtividade operacional', 'Apoio à distribuição em grupos', 'Fluxo com baixa fricção inicial'],
    weaknesses: ['Necessidade de auditoria manual de claims em comparação', 'Detalhes de limites podem variar', 'Cobertura de recursos avançados depende de plano'],
    migrationNotes: 'Validar aderência por nicho e tipo de grupo antes de migração integral.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
  {
    slug: 'divulga-links',
    name: 'DivulgaLinks',
    positioning: 'Solução voltada para disseminação de links e automação de postagens em grupos.',
    bestFor: 'Times que precisam acelerar disseminação de links com rotina estruturada.',
    notIdealFor: 'Operações que exigem observabilidade granular e governança editorial profunda desde o início.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Preço e escopo devem ser confirmados em proposta oficial.' },
    ],
    strengths: ['Foco em links e distribuição', 'Adoção relativamente rápida', 'Aplicável a operações de afiliados'],
    weaknesses: ['Comparação de recursos premium requer validação constante', 'Política de suporte pode variar', 'Necessidade de revisão humana para qualidade final'],
    migrationNotes: 'Fazer migração progressiva por grupos prioritários com checklist de qualidade de link.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
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
