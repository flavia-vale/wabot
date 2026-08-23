-- AddColumn maxAutomations to User
ALTER TABLE "User" ADD COLUMN "maxAutomations" INTEGER NOT NULL DEFAULT 30;

-- Create index for admin queries
CREATE INDEX "idx_user_max_automations" ON "User"("maxAutomations");
