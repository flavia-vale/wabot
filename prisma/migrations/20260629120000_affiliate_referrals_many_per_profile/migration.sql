-- Permite que um mesmo perfil de afiliado tenha muitos usuários indicados.
-- Antes, User.affiliateProfileId era @unique e o painel do afiliado só podia
-- refletir no máximo um indicado por afiliado.
DROP INDEX IF EXISTS "User_affiliateProfileId_key";
CREATE INDEX IF NOT EXISTS "User_affiliateProfileId_idx" ON "User"("affiliateProfileId");
