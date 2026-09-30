-- Texto completo da oferta espelhada para o reenvio pós-restart
-- (docs/rca/envio-e-filas.md, RCA 2026-09-30). Só acréscimo: coluna nula,
-- linhas existentes ficam NULL e não são reenviadas.

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN "resendText" TEXT;
