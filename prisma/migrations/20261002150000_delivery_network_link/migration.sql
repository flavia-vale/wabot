-- Feature 017, Fatia 3 — migration ADITIVA apenas: 1 tabela nova. Nenhum
-- DROP, RENAME ou reescrita de dado existente.
--
-- Ligação da conta com um aplicativo de robô único (Telegram). O `linkCode`
-- vai no link "adicionar o robô ao grupo" da tela Aplicativos: o Telegram o
-- devolve ao robô quando a cliente escolhe o grupo, e é assim que o grupo
-- chega à conta certa sem a cliente copiar nada (FR-017). `disabledAt`
-- preenchido = a cliente desligou o aplicativo: os destinos param, nada é
-- apagado (FR-019).
CREATE TABLE "DeliveryNetworkLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deliveryNetwork" TEXT NOT NULL,
  "linkCode" TEXT NOT NULL,
  "disabledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "DeliveryNetworkLink_linkCode_key" ON "DeliveryNetworkLink"("linkCode");
CREATE UNIQUE INDEX "DeliveryNetworkLink_userId_deliveryNetwork_key" ON "DeliveryNetworkLink"("userId", "deliveryNetwork");
