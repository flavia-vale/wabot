-- CreateTable: planos dinâmicos da landing page. Migration aditiva; não altera nem apaga dados existentes.
CREATE TABLE "LpPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "LpPlan_position_idx" ON "LpPlan"("position");

-- Dados iniciais não destrutivos para manter a LP preenchida após o deploy.
INSERT INTO "LpPlan" ("id", "title", "description", "price", "position") VALUES
('trial', 'Teste grátis', 'Experimente o fluxo principal antes de escolher um plano pago.', 'R$0', 1),
('basic', 'Basic', 'Para operar com os mesmos recursos essenciais do Pro mantendo anúncios no uso.', 'R$50', 2),
('pro', 'Pro', 'Para operar com os mesmos recursos do Basic, sem anúncios na experiência.', 'R$100', 3);
