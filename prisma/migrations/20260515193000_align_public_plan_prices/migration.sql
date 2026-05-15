-- Align public/dynamic plan prices with the dashboard subscription prices.
UPDATE "LpPlan" SET "price" = 'R$39' WHERE "id" = 'basic';
UPDATE "LpPlan" SET "price" = 'R$69' WHERE "id" = 'pro';
