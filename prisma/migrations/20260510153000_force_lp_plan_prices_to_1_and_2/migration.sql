-- Garante correção dos preços em bases já migradas anteriormente.
UPDATE "LpPlan" SET "price" = 'R$1' WHERE "id" = 'basic';
UPDATE "LpPlan" SET "price" = 'R$2' WHERE "id" = 'pro';
