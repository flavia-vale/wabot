CREATE TABLE "Refund" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "gatewayFeeLoss" REAL NOT NULL DEFAULT 0,
  "method" TEXT NOT NULL DEFAULT 'pix',
  "reason" TEXT,
  "refundedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");
CREATE INDEX "Refund_refundedAt_idx" ON "Refund"("refundedAt");
CREATE INDEX "Refund_userId_refundedAt_idx" ON "Refund"("userId", "refundedAt");
