-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "providerRef" TEXT,
    "instagramConnectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Destination_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Destination_instagramConnectionId_fkey" FOREIGN KEY ("instagramConnectionId") REFERENCES "InstagramConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstagramConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "username" TEXT,
    "accountType" TEXT,
    "loginMethod" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL DEFAULT '[]',
    "tokenIssuedAt" DATETIME,
    "tokenExpiresAt" DATETIME,
    "lastValidatedAt" DATETIME,
    "lastRefreshedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastErrorCode" TEXT,
    "lastErrorAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstagramConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryTemplateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definitionJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StoryTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenderedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RenderedAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "renderedAssetId" TEXT,
    "contractVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "offerSnapshotJson" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerContainerId" TEXT,
    "providerMediaId" TEXT,
    "scheduledFor" DATETIME,
    "publishedAt" DATETIME,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryPublication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryPublication_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoryPublication_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StoryTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoryPublication_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "StoryTemplateVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoryPublication_renderedAssetId_fkey" FOREIGN KEY ("renderedAssetId") REFERENCES "RenderedAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryPublicationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retryDisposition" TEXT NOT NULL DEFAULT 'none',
    "providerRequestId" TEXT,
    "providerStatus" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "StoryPublicationAttempt_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "StoryPublication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Destination_userId_type_enabled_idx" ON "Destination"("userId", "type", "enabled");

-- CreateIndex
CREATE INDEX "Destination_instagramConnectionId_idx" ON "Destination"("instagramConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_userId_type_providerRef_key" ON "Destination"("userId", "type", "providerRef");

-- CreateIndex
CREATE INDEX "InstagramConnection_userId_status_idx" ON "InstagramConnection"("userId", "status");

-- CreateIndex
CREATE INDEX "InstagramConnection_status_tokenExpiresAt_idx" ON "InstagramConnection"("status", "tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramConnection_userId_instagramAccountId_key" ON "InstagramConnection"("userId", "instagramAccountId");

-- CreateIndex
CREATE INDEX "StoryTemplate_userId_enabled_idx" ON "StoryTemplate"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTemplate_scopeKey_key_key" ON "StoryTemplate"("scopeKey", "key");

-- CreateIndex
CREATE INDEX "StoryTemplateVersion_contentHash_idx" ON "StoryTemplateVersion"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTemplateVersion_templateId_version_key" ON "StoryTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RenderedAsset_storageKey_key" ON "RenderedAsset"("storageKey");

-- CreateIndex
CREATE INDEX "RenderedAsset_userId_createdAt_idx" ON "RenderedAsset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RenderedAsset_expiresAt_deletedAt_idx" ON "RenderedAsset"("expiresAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoryPublication_idempotencyKey_key" ON "StoryPublication"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StoryPublication_userId_status_createdAt_idx" ON "StoryPublication"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StoryPublication_destinationId_createdAt_idx" ON "StoryPublication"("destinationId", "createdAt");

-- CreateIndex
CREATE INDEX "StoryPublication_status_scheduledFor_idx" ON "StoryPublication"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "StoryPublicationAttempt_status_startedAt_idx" ON "StoryPublicationAttempt"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoryPublicationAttempt_publicationId_attemptNumber_key" ON "StoryPublicationAttempt"("publicationId", "attemptNumber");
