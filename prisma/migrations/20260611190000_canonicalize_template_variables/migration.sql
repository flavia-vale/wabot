-- Converte aliases históricos dos corpos de templates para os nomes canônicos.
-- A troca é idempotente e alcança presets sobrescritos e templates personalizados.
UPDATE "BotConfig"
SET "mobileTemplatesJson" = replace(
  replace("mobileTemplatesJson", '{{greeting}}', '{{gancho}}'),
  '{{trailer}}', '{{convitegrupo}}'
)
WHERE json_valid("mobileTemplatesJson") = 1
  AND (instr("mobileTemplatesJson", '{{greeting}}') > 0
    OR instr("mobileTemplatesJson", '{{trailer}}') > 0);
