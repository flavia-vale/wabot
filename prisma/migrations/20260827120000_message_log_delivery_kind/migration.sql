-- Visão admin de qualidade de entrega: COMO cada oferta saiu, e se a mensagem
-- de origem trazia imagem. Sem isso, "oferta chegou sem foto" só era detectável
-- quando a cliente reclamava.
--
-- Colunas NULÁVEIS e sem default: linhas antigas ficam com NULL ("não sabemos"),
-- que é a verdade — não inventamos valor para envio anterior ao registro.
ALTER TABLE "MessageLog" ADD COLUMN "deliveryKind" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "originImageBytes" INTEGER;

CREATE INDEX IF NOT EXISTS "MessageLog_deliveryKind_sentAt_idx"
  ON "MessageLog" ("deliveryKind", "sentAt");
