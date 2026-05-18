UPDATE "LpPlan"
SET
  "title" = 'Teste grátis',
  "description" = 'Teste por 7 dias os recursos completos do Pro: grupos, canais e Módulo de Preservação Avançada.',
  "features" = '["Conversão de links suportados","Monitoramento de grupos","Envio para grupos e canais","Módulo de Preservação Avançada","Histórico de logs"]',
  "position" = 1
WHERE "id" = 'trial';

UPDATE "LpPlan"
SET
  "title" = 'Basic',
  "description" = 'Plano focado em grupos: operação essencial com cadência e filtros básicos.',
  "features" = '["Conversão de links suportados","Monitoramento e envio em grupos","Delay e filtros básicos","Histórico de logs","Sem canais"]',
  "position" = 2
WHERE "id" = 'basic';

UPDATE "LpPlan"
SET
  "title" = 'Pro',
  "description" = 'Tudo do Basic + canais + Módulo de Preservação Avançada para operar com mais controle.',
  "features" = '["Tudo do Basic","Monitoramento e envio em canais","Módulo de Preservação Avançada","Warmup, limites e cadência avançada","Histórico de logs"]',
  "position" = 3
WHERE "id" = 'pro';
