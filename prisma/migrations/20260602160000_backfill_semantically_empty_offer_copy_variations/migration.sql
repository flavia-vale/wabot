-- Backfill complementar para contas que tinham o editor salvo no modo conservador.
-- O seed anterior cobria '{}' e string vazia; este cobre pools semanticamente vazios
-- como {"greetings":[""],"ctas":[""],"trailers":[""]}, preservando qualquer texto customizado.
UPDATE "BotConfig"
SET "copyVariationPoolJson" = '{"greetings":["🚨 COOOOOORRE QUE TÁ ACABANDO!","💡 UTILIDADE PÚBLICA!!","😱 TÁ BARATOOO DEMAIS!","🍌 PREÇO DE BANANA!!","🔥 PARA TUDO E OLHA ISSO!","💸 O GERENTE ENLOUQUECEU!!","⚡ OFERTA RELÂMPAGO, CLICA JÁ!","🎁 QUASE DE GRAÇA, SÉRIO!!","💎 ACHADO DE MILHÕES!!","🏃 VOLTOU PRO ESTOQUE, VOA!","💥 CHOCADO COM ESSE VALOR!","🤑 SÓ QUEM FOR RÁPIDO VAI PEGAR!"],"ctas":["📲 Entre no nosso grupo oficial:","👥 Vem pro grupo economizar com a gente:","👇 Clique aqui e faça parte do nosso grupo VIP:","🤫 Acesse nosso grupo secreto de ofertas:","🚀 Receba os melhores achadinhos direto no grupo:","🔔 Quer ver as promoções primeiro? Entre no grupo:","💥 Não perca nenhum bug! Faça parte do grupo:","🛒 Garanta os melhores descontos entrando no grupo:","🤝 Junte-se à nossa comunidade de achadinhos:","👀 Para não perder nadinha, vem pro grupo:"],"trailers":["⚠️ Atenção: Preços e estoque podem mudar a qualquer momento!","🚨 O valor promocional e a disponibilidade dependem do estoque da loja.","⏳ Corra! Oferta por tempo limitado ou até durarem os estoques.","📝 Preço sujeito a alteração e produto sujeito a esgotar sem aviso prévio.","🏃💨 Garanta logo, porque o estoque voa e o preço pode subir rapidinho!","🔔 Aviso: A loja parceira pode alterar o valor ou encerrar a oferta a qualquer minuto.","🛒 Unidades promocionais limitadas! Preço sujeito a reajuste no site.","📉 Desconto válido por tempo limitado, sujeito a alteração e fim de estoque.","ℹ️ Os preços e a disponibilidade do produto são de responsabilidade total da loja.","💥 Aproveite rápido: Estoques limitados e valores sujeitos a alteração."]}'
WHERE json_valid("copyVariationPoolJson") = 1
  AND json_type("copyVariationPoolJson") = 'object'
  AND json_type("copyVariationPoolJson", '$.greetings') = 'array'
  AND json_type("copyVariationPoolJson", '$.ctas') = 'array'
  AND json_type("copyVariationPoolJson", '$.trailers') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM json_each("copyVariationPoolJson", '$.greetings')
    WHERE trim(COALESCE(value, '')) <> ''
  )
  AND NOT EXISTS (
    SELECT 1 FROM json_each("copyVariationPoolJson", '$.ctas')
    WHERE trim(COALESCE(value, '')) <> ''
  )
  AND NOT EXISTS (
    SELECT 1 FROM json_each("copyVariationPoolJson", '$.trailers')
    WHERE trim(COALESCE(value, '')) <> ''
  );
