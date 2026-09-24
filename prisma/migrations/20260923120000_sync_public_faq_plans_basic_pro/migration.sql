-- Divisão Basic/PRO (2026-09-23): marca d'água, variação do texto e o painel
-- de vendas da Shopee saíram do Basic e foram para o PRO (decisão da dona do
-- produto). As listas públicas de /api/public/plans e /precos precisam dizer o
-- mesmo que o produto faz — mesma regra da migration de 2026-09-18.
--
-- DML pura (sem ALTER TABLE). GUARDADA: cada UPDATE só troca a linha que ainda
-- está byte a byte com um texto que NÓS publicamos (o seed de 2026-05/06 ou o
-- de 2026-09-18). Quem editou pelo admin não é sobrescrito. Texto novo =
-- DEFAULT_LANDING_PLANS em dashboard/lib/marketing-content.js
-- (test/public-faq-plans-sync.test.js falha se divergirem).

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
  "description" = 'Espelhamento, conversão de links, criação de ofertas e agendamento.',
  "features" = '["Espelhamento de grupos","Conversão de links de 6 lojas (Shopee, Mercado Livre, Amazon, SHEIN, Magalu e AliExpress)","Card de oferta clicável","Mensagem reescrita do seu jeito","Envio imediato ou agendado","Relatórios com histórico completo"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'basic'
  AND "description" = 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.'
  AND "features" = '["Espelhamento de grupos (monitor → destinos)","Conversão de links: Mercado Livre, Amazon, Shopee e Magalu","Criar oferta a partir de link (título, preço e imagem)","Envio imediato e agendado","Templates de mensagem personalizáveis","Relatórios de envio com histórico completo"]';

UPDATE "LpPlan"
SET
  "description" = 'Espelhamento, conversão de links, criação de ofertas e agendamento.',
  "features" = '["Espelhamento de grupos","Conversão de links de 6 lojas (Shopee, Mercado Livre, Amazon, SHEIN, Magalu e AliExpress)","Card de oferta clicável","Mensagem reescrita do seu jeito","Envio imediato ou agendado","Relatórios com histórico completo"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'basic'
  AND "description" = 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.'
  AND "features" = '["Espelhamento de grupos (monitor → destinos)","Conversão de links em 6 lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress","Painel de vendas e comissão da Shopee (pedidos, valor vendido e comissão)","Marca d’água com o seu nome na foto da oferta","Card de oferta clicável: tocar no card abre a loja","Mensagem reescrita do seu jeito, não copiada da origem","Criar oferta a partir de link (título, preço e imagem)","Envio imediato e agendado","Relatórios de envio com histórico completo"]';

UPDATE "LpPlan"
SET
  "description" = 'Tudo do Basic + canais, ofertas automáticas, filas de envio e controle de ritmo dos envios.',
  "features" = '["Tudo do plano Basic","Espelhamento de grupos e CANAIS do WhatsApp","Garimpo automático de ofertas","Filas de ofertas","Sua marca d’água nas ofertas","Horário de descanso, máximo de ofertas por dia, intervalo entre mensagens e variação do texto","Painel de vendas e comissão da Shopee"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pro'
  AND "description" = 'Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e Módulo de Preservação Avançada.'
  AND "features" = '["Tudo do Basic","Monitoramento e envio em canais","Ofertas automáticas da Shopee (palavra-chave, filtros e dedup inteligente)","Filas de ofertas com limites por hora e por dia","Módulo de Preservação Avançada (cadência, horários de descanso, variação de copy e limites)"]';

UPDATE "LpPlan"
SET
  "description" = 'Tudo do Basic + canais, ofertas automáticas, filas de envio e controle de ritmo dos envios.',
  "features" = '["Tudo do plano Basic","Espelhamento de grupos e CANAIS do WhatsApp","Garimpo automático de ofertas","Filas de ofertas","Sua marca d’água nas ofertas","Horário de descanso, máximo de ofertas por dia, intervalo entre mensagens e variação do texto","Painel de vendas e comissão da Shopee"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pro'
  AND "description" = 'Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e controle de ritmo dos envios.'
  AND "features" = '["Tudo do Basic","Monitoramento e envio em canais","Garimpo automático de ofertas da Shopee: o robô acha as ofertas por palavra-chave e filtros, você não precisa colar link","Filas de ofertas com intervalo definido e limites por hora e por dia","Controle do ritmo dos envios por grupo (Módulo de Preservação Avançada): intervalo, horário de descanso, limite diário e variação do texto"]';

-- FAQ: mesmas respostas da migration de 2026-09-18, reaplicadas com a mesma
-- guarda (no-op onde já foram trocadas).
UPDATE "FaqItem"
SET "answer" = 'O Espelha Grupos permite intervalos configuráveis, filtros anti-spam e revisão da operação, mas nenhum software elimina risco de bloqueio. Use apenas grupos e canais autorizados, mensagens relevantes e cadência responsável.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq_seed_whatsapp_ban' AND "answer" = 'O BOTinho respeita limites de envio, usa intervalos configuráveis e permite filtros anti-spam. Ainda assim, recomendamos operar com grupos autorizados e mensagens relevantes para reduzir riscos.';

UPDATE "FaqItem"
SET "answer" = 'Hoje o fluxo é focado em links suportados de seis lojas: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress. Cadastre as credenciais exigidas para as lojas que você usa e revise cada oferta antes de divulgar.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq_seed_programs' AND "answer" = 'Hoje suportamos Shopee, Mercado Livre, Amazon e Magalu. Basta cadastrar suas credenciais no painel para as plataformas que você usa.';

UPDATE "FaqItem"
SET "answer" = 'Sim. Você define grupos e/ou canais de origem e destino, filtros por palavras, plataformas permitidas e acompanha os envios pelo histórico de logs.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq_seed_text' AND "answer" = 'Sim. Você define grupos de origem e destino, filtros por palavras, plataformas permitidas e pode acompanhar tudo pelo histórico de logs.';

