-- Add processing summary field for webhook mirror-mode processing.
ALTER TABLE "WebhookEvent" ADD COLUMN "processingResult" TEXT;
