-- Atualiza os preços iniciais dos planos pagos para convergir com a política atual.
UPDATE "LpPlan" SET "price" = 'R$1' WHERE "id" = 'basic';
UPDATE "LpPlan" SET "price" = 'R$2' WHERE "id" = 'pro';
