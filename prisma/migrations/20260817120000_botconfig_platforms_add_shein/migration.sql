-- Adiciona 'shein' ao CSV de plataformas ativas de todo BotConfig existente
-- (5ª loja suportada — specs/012-shein-store-support). DML puro, idempotente:
-- não toca em linhas que já têm 'shein' na lista, e não altera nenhuma outra
-- coluna. Sem alteração de schema — não exige parar API/supervisor (AGENTS.md
-- pegadinha #8 não se aplica).
--
-- O `@default(...)` de BotConfig.platforms em schema.prisma também ganhou
-- 'shein' (defesa em profundidade para linhas novas); esta migration cobre
-- as linhas já existentes.
UPDATE "BotConfig"
   SET "platforms" = CASE
     WHEN COALESCE("platforms", '') = '' THEN 'shein'
     ELSE "platforms" || ',shein'
   END
 WHERE ',' || COALESCE("platforms", '') || ',' NOT LIKE '%,shein,%';
