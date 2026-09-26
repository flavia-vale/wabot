-- Gastos fixos do ROI editáveis na tela (Admin > Financeiro > ROI).
-- Tabela nova e vazia: nada existente muda. Sem linha = valores de env/padrão.
CREATE TABLE "OperatingCostSettings" (
  "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "claudeMonthlyBrl" REAL,
  "vpsMonthlyBrl" REAL,
  "usdBrlRate" REAL,
  "updatedBy" TEXT,
  "updatedAt" DATETIME NOT NULL
);
