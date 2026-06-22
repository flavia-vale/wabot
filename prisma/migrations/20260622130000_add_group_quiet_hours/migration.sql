-- AlterTable: janela silenciosa por grupo espelhado (destino). Quando
-- quietHoursEnabled = true, sobrepõe a janela silenciosa global do BotConfig
-- para aquele destino. quietHoursJson guarda {startHour,endHour,tz} no mesmo
-- formato de BotConfig.channelQuietHoursJson.
ALTER TABLE "Group" ADD COLUMN "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN "quietHoursJson" TEXT;
