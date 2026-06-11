-- Ofertas automáticas e filas de ofertas viraram features Pro (Trial ativo
-- incluso). Sem grandfathering (decisão 2026-06-11): automações e filas de
-- usuários Basic são desativadas — nada é apagado; ao migrar para Pro o
-- usuário reativa manualmente. O gate de runtime nos crons já impede a
-- execução; este UPDATE alinha o estado persistido ao novo contrato.
UPDATE "OfferAutomation"
SET "enabled" = false
WHERE "enabled" = true
  AND "userId" IN (SELECT "id" FROM "User" WHERE "plan" = 'basic');

UPDATE "OfferQueue"
SET "enabled" = false
WHERE "enabled" = true
  AND "userId" IN (SELECT "id" FROM "User" WHERE "plan" = 'basic');
