-- Per-group link election (first/last) for mirror template offers.
ALTER TABLE "Group" ADD COLUMN "primaryLinkTarget" TEXT;

-- Global defaults applied when a monitor group does not override them.
ALTER TABLE "BotConfig" ADD COLUMN "mirrorTemplateKeyDefault" TEXT;
ALTER TABLE "BotConfig" ADD COLUMN "primaryLinkTargetDefault" TEXT NOT NULL DEFAULT 'first';
