-- Plano B / RCA 2026-07 (fila entupida derrubando a vazão de todos os destinos):
-- descarte por IDADE na fila, configurável por destino na Preservação.
--
-- queueMaxAgeMin = há quanto tempo (em minutos) uma mensagem pode ficar
-- esperando na fila antes de ser descartada. 0 = nunca descarta.
-- Default 300 (5h) — combinado com a cliente.
--
-- DDL (ALTER TABLE) exige lock exclusivo do SQLite: os scripts de deploy já
-- param os apps que seguram Prisma antes do migrate (pegadinha #8 do AGENTS.md).
ALTER TABLE "PreservationPreset" ADD COLUMN "queueMaxAgeMin" INTEGER NOT NULL DEFAULT 300;

-- Override por destino: NULL = herda do preset atribuído / preset default.
ALTER TABLE "Group" ADD COLUMN "queueMaxAgeMin" INTEGER;
