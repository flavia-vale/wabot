-- Habilita AliExpress nas configurações existentes e corrige o CSV legado
-- vazio que a migration da SHEIN transformava em ",shein".
UPDATE "BotConfig"
   SET "platforms" = LTRIM(COALESCE("platforms", ''), ',');

UPDATE "BotConfig"
   SET "platforms" = CASE
     WHEN COALESCE("platforms", '') = '' THEN 'aliexpress'
     ELSE "platforms" || ',aliexpress'
   END
 WHERE ',' || COALESCE("platforms", '') || ',' NOT LIKE '%,aliexpress,%';
