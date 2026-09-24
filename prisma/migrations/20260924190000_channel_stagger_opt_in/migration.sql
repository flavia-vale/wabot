-- Incidente 2026-09-24: o "Intervalo entre destinos" virou espera FIXA entre
-- quaisquer dois destinos da conta (specs/018) e travou a fila de quem tem
-- vários grupos. Decisão da dona do produto: ele passa a ser OPCIONAL — toda
-- conta volta para 0 (sem espera) e só liga quem escolher na tela.
-- DML puro (sem ALTER TABLE): convive com WAL, não exige parar API/supervisor.
UPDATE "BotConfig" SET "channelStaggerJitterMs" = 0 WHERE "channelStaggerJitterMs" <> 0;
