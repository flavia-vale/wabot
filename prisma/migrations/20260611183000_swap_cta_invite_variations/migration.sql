-- Corrige a classificação histórica dos textos de CTA e convite do grupo.
-- O json_set avalia ambos os json_extract sobre o valor original da linha,
-- fazendo a troca sem perder greetings nem chaves adicionais do usuário.
UPDATE "BotConfig"
SET "copyVariationPoolJson" = json_set(
  "copyVariationPoolJson",
  '$.ctas', json_extract("copyVariationPoolJson", '$.trailers'),
  '$.trailers', json_extract("copyVariationPoolJson", '$.ctas')
)
WHERE json_valid("copyVariationPoolJson") = 1
  AND json_type("copyVariationPoolJson") = 'object'
  AND json_type("copyVariationPoolJson", '$.ctas') = 'array'
  AND json_type("copyVariationPoolJson", '$.trailers') = 'array';
