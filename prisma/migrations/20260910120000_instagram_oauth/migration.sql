CREATE TABLE "InstagramOAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "loginMethod" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InstagramOAuthState_stateHash_key" ON "InstagramOAuthState"("stateHash");
CREATE INDEX "InstagramOAuthState_userId_expiresAt_idx" ON "InstagramOAuthState"("userId", "expiresAt");
CREATE INDEX "InstagramOAuthState_expiresAt_consumedAt_idx" ON "InstagramOAuthState"("expiresAt", "consumedAt");
