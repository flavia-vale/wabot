-- AlterTable: botão "Ver canal" agora vive POR GRUPO DE DESTINO (role='post'),
-- não mais global em BotConfig.channelForward*.
ALTER TABLE "Group" ADD COLUMN "channelButtonJid" TEXT;
ALTER TABLE "Group" ADD COLUMN "channelButtonName" TEXT;

-- Migração de dados: herda o canal global existente (BotConfig.channelForward*)
-- para os grupos de destino que ainda não têm canal próprio. Preserva o
-- comportamento atual de quem já usava o botão, sem manter fallback em runtime.
UPDATE "Group"
SET
  "channelButtonJid" = (
    SELECT bc."channelForwardJid" FROM "BotConfig" bc WHERE bc."userId" = "Group"."userId"
  ),
  "channelButtonName" = (
    SELECT bc."channelForwardName" FROM "BotConfig" bc WHERE bc."userId" = "Group"."userId"
  )
WHERE "role" = 'post'
  AND ("channelButtonJid" IS NULL OR "channelButtonJid" = '')
  AND EXISTS (
    SELECT 1 FROM "BotConfig" bc
    WHERE bc."userId" = "Group"."userId"
      AND bc."channelForwardJid" IS NOT NULL
      AND bc."channelForwardJid" <> ''
  );
