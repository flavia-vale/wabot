-- A estratégia de imagem passa a pertencer ao DESTINO (role='post'), nunca
-- mais à origem. `watermarkText` é opcional e só é lido quando o destino está
-- em 'original_watermark' (ver src/core/imageModePolicy.js e
-- src/billing/groupEntitlements.js).
ALTER TABLE "Group" ADD COLUMN "watermarkText" TEXT;

-- Preserva o comportamento corrente para os destinos já existentes ("a foto
-- que veio na oferta", padrão vigente desde 2026-08-21), ignorando qualquer
-- valor dormente ('preview'/'none'/'fetch') que sobrou de quando o campo era
-- da origem. Não toca em linhas role='monitor' — o campo nunca foi lido lá e
-- segue dormente por compatibilidade de schema.
UPDATE "Group" SET "imageMode" = 'original' WHERE "role" = 'post';
