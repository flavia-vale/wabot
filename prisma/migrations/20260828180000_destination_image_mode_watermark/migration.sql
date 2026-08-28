ALTER TABLE "Group" ADD COLUMN "watermarkText" TEXT;

-- A escolha passa a pertencer ao destino. Preserva o comportamento corrente
-- para destinos existentes, ignorando o valor dormente que era da origem.
UPDATE "Group" SET "imageMode" = 'original' WHERE "role" = 'post';
