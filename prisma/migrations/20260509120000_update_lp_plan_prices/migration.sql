-- Atualiza os preços iniciais dos planos pagos para convergir com a política atual.
UPDATE "LpPlan" SET "price" = 'R$40' WHERE "id" = 'basic';
UPDATE "LpPlan" SET "price" = 'R$70' WHERE "id" = 'pro';
