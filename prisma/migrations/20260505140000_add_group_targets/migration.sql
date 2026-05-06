CREATE TABLE "GroupTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "GroupTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupTarget_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GroupTarget_monitorId_postId_key" ON "GroupTarget"("monitorId", "postId");
CREATE INDEX "GroupTarget_userId_idx" ON "GroupTarget"("userId");
CREATE INDEX "GroupTarget_postId_idx" ON "GroupTarget"("postId");
