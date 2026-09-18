-- RCA 2026-09-18: /api/public/faq e /api/public/plans são abertos no robots.txt
-- justamente para buscador e motor de IA lerem preço e funcionamento sem raspar
-- a página — e devolviam o seed de 2026-05/06: "Hoje suportamos Shopee, Mercado
-- Livre, Amazon e Magalu" (4 lojas; são 6 desde SHEIN e AliExpress) e um plano
-- Basic com "Conversão de links: Mercado Livre, Amazon, Shopee e Magalu". A home
-- troca o FAQ estático pelo da API depois de hidratar e o /precos prefere as
-- features do banco, então o texto VISÍVEL também dizia 4 lojas enquanto
-- pricing.md e o JSON-LD diziam 6. IA que lê os dois responde errado.
--
-- DML pura (sem ALTER TABLE): convive com o WAL, não exige parar API/supervisor
-- (pegadinha #8 não se aplica). Idempotente e GUARDADA: só troca a linha que
-- ainda está byte a byte com o texto do seed antigo — quem editou pelo admin
-- não é sobrescrito. Texto novo = DEFAULT_LANDING_PLANS / CORE_FAQ_ITEMS em
-- dashboard/lib/marketing-content.js (test/public-faq-plans-sync.test.js falha
-- se os dois divergirem).

UPDATE "LpPlan"
SET
  "description" = 'Experimente por 7 dias tudo do Pro: grupos, canais, garimpo automático de ofertas, filas e controle do ritmo dos envios.',
  "features" = '["Tudo do plano Pro por 7 dias","Espelhamento em grupos e canais","Garimpo automático de ofertas e filas de envio","Painel de vendas e comissão da Shopee","Marca d’água e card de oferta clicável","Relatórios de envio completos"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'trial'
  AND "description" = 'Experimente por 7 dias tudo do Pro: grupos, canais, ofertas automáticas, filas e o Módulo de Preservação Avançada.'
  AND "features" = '["Tudo do plano Pro por 7 dias","Espelhamento em grupos e canais","Ofertas automáticas e filas de envio","Módulo de Preservação Avançada","Relatórios de envio completos"]';

UPDATE "LpPlan"
SET
  "description" = 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.',
  "features" = '["Espelhamento de grupos (monitor → destinos)","Conversão de links em 6 lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress","Painel de vendas e comissão da Shopee (pedidos, valor vendido e comissão)","Marca d’água com o seu nome na foto da oferta","Card de oferta clicável: tocar no card abre a loja","Mensagem reescrita do seu jeito, não copiada da origem","Criar oferta a partir de link (título, preço e imagem)","Envio imediato e agendado","Relatórios de envio com histórico completo"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'basic'
  AND "description" = 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.'
  AND "features" = '["Espelhamento de grupos (monitor → destinos)","Conversão de links: Mercado Livre, Amazon, Shopee e Magalu","Criar oferta a partir de link (título, preço e imagem)","Envio imediato e agendado","Templates de mensagem personalizáveis","Relatórios de envio com histórico completo"]';

UPDATE "LpPlan"
SET
  "description" = 'Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e controle de ritmo dos envios.',
  "features" = '["Tudo do Basic","Monitoramento e envio em canais","Garimpo automático de ofertas da Shopee: o robô acha as ofertas por palavra-chave e filtros, você não precisa colar link","Filas de ofertas com intervalo definido e limites por hora e por dia","Controle do ritmo dos envios por grupo (Módulo de Preservação Avançada): intervalo, horário de descanso, limite diário e variação do texto"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pro'
  AND "description" = 'Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e Módulo de Preservação Avançada.'
  AND "features" = '["Tudo do Basic","Monitoramento e envio em canais","Ofertas automáticas da Shopee (palavra-chave, filtros e dedup inteligente)","Filas de ofertas com limites por hora e por dia","Módulo de Preservação Avançada (cadência, horários de descanso, variação de copy e limites)"]';

UPDATE "FaqItem"
SET "answer" = 'O Espelha Grupos permite intervalos configuráveis, filtros anti-spam e revisão da operação, mas nenhum software elimina risco de bloqueio. Use apenas grupos e canais autorizados, mensagens relevantes e cadência responsável.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq_seed_whatsapp_ban' AND "answer" = 'O BOTinho respeita limites de envio, usa intervalos configuráveis e permite filtros anti-spam. Ainda assim, recomendamos operar com grupos autorizados e mensagens relevantes para reduzir riscos.';

UPDATE "FaqItem"
SET "answer" = 'Hoje o fluxo é focado em links suportados de seis lojas: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress. Cadastre as credenciais exigidas para as lojas que você usa e revise cada oferta antes de divulgar.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq_seed_programs' AND "answer" = 'Hoje suportamos Shopee, Mercado Livre, Amazon e Magalu. Basta cadastrar suas credenciais no painel para as plataformas que você usa.';

UPDATE "FaqItem"
SET "answer" = 'Sim. Você define grupos e/ou canais de origem e destino, filtros por palavras, plataformas permitidas e acompanha os envios pelo histórico de logs.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq_seed_text' AND "answer" = 'Sim. Você define grupos de origem e destino, filtros por palavras, plataformas permitidas e pode acompanhar tudo pelo histórico de logs.';

