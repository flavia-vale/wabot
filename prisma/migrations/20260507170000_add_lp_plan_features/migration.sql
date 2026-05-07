-- Add features as JSON string for dynamic bullets in LP/admin/dashboard plans.
ALTER TABLE "LpPlan" ADD COLUMN "features" TEXT NOT NULL DEFAULT '[]';

UPDATE "LpPlan"
SET "features" = CASE "id"
  WHEN 'trial' THEN '["Conversão de links suportados","Monitoramento de grupos","Envio para grupos de destino","Histórico de logs","Com anúncios"]'
  WHEN 'basic' THEN '["Conversão de links suportados","Monitoramento de grupos","Envio para grupos de destino","Histórico de logs","Com anúncios"]'
  WHEN 'pro' THEN '["Conversão de links suportados","Monitoramento de grupos","Envio para grupos de destino","Histórico de logs","Sem anúncios"]'
  ELSE "features"
END;
