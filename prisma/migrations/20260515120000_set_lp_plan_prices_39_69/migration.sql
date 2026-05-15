-- Corrige os preços oficiais dos planos pagos para o valor comercial atual.
-- Migration de dados não destrutiva: atualiza apenas os registros canônicos da landing/checkout.
UPDATE "LpPlan" SET "price" = 'R$39' WHERE "id" = 'basic';
UPDATE "LpPlan" SET "price" = 'R$69' WHERE "id" = 'pro';
