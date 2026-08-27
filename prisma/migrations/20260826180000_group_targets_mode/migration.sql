-- Intenção da cliente sobre os destinos de cada origem monitorada.
-- 'all' (default) = comportamento histórico: origem sem vínculo espelha para
-- todos os destinos da conta. 'explicit' = ela escolheu os destinos no painel;
-- lista vazia passa a significar NENHUM destino, nunca "todos".
--
-- Migração de dados: toda origem que HOJE tem vínculo em GroupTarget é, por
-- definição, uma escolha explícita da cliente.
ALTER TABLE "Group" ADD COLUMN "targetsMode" TEXT NOT NULL DEFAULT 'all';

UPDATE "Group"
   SET "targetsMode" = 'explicit'
 WHERE "role" = 'monitor'
   AND "id" IN (SELECT DISTINCT "monitorId" FROM "GroupTarget");
