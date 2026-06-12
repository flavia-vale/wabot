-- Reestruturação 2026-06-11: ofertas automáticas e filas viram diferenciais
-- do Pro; copy remove features desativadas (OAuth, cliques, status, feed
-- global), o termo "warmup" e cita os 4 marketplaces nominalmente.
-- Manter em sincronia com DEFAULT_LANDING_PLANS (dashboard/lib/marketing-content.js).
UPDATE "LpPlan"
SET
  "title" = 'Teste grátis',
  "description" = 'Experimente por 7 dias tudo do Pro: grupos, canais, ofertas automáticas, filas e o Módulo de Preservação Avançada.',
  "features" = '["Tudo do plano Pro por 7 dias","Espelhamento em grupos e canais","Ofertas automáticas e filas de envio","Módulo de Preservação Avançada","Relatórios de envio completos"]',
  "position" = 1
WHERE "id" = 'trial';

UPDATE "LpPlan"
SET
  "title" = 'Basic',
  "description" = 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.',
  "features" = '["Espelhamento de grupos (monitor → destinos)","Conversão de links: Mercado Livre, Amazon, Shopee e Magalu","Criar oferta a partir de link (título, preço e imagem)","Envio imediato e agendado","Templates de mensagem personalizáveis","Relatórios de envio com histórico completo"]',
  "position" = 2
WHERE "id" = 'basic';

UPDATE "LpPlan"
SET
  "title" = 'Pro',
  "description" = 'Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e Módulo de Preservação Avançada.',
  "features" = '["Tudo do Basic","Monitoramento e envio em canais","Ofertas automáticas da Shopee (palavra-chave, filtros e dedup inteligente)","Filas de ofertas com limites por hora e por dia","Módulo de Preservação Avançada (cadência, horários de descanso, variação de copy e limites)"]',
  "position" = 3
WHERE "id" = 'pro';
