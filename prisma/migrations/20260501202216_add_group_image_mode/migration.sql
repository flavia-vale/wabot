-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "waJid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "imageMode" TEXT NOT NULL DEFAULT 'none',
    "imageLinkTarget" TEXT NOT NULL DEFAULT 'first',
    "fallbackToOriginal" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("id", "name", "role", "userId", "waJid") SELECT "id", "name", "role", "userId", "waJid" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE UNIQUE INDEX "Group_userId_waJid_role_key" ON "Group"("userId", "waJid", "role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
