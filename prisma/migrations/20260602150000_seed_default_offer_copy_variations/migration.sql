-- Persiste o pool padrão de ganchos, CTAs e fechamentos para ofertas automáticas.
-- Cobre usuários existentes com BotConfig vazio/legado, cria BotConfig para
-- usuários sem configuração e troca o default real da coluna para usuários futuros.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_BotConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "delayMin" INTEGER NOT NULL DEFAULT 5,
    "delayMax" INTEGER NOT NULL DEFAULT 15,
    "platforms" TEXT NOT NULL DEFAULT 'shopee,amazon,mercadolivre,magazineluiza',
    "blockedKeywords" TEXT NOT NULL DEFAULT '',
    "welcomeMsg" TEXT NOT NULL DEFAULT '',
    "feedGlobal" BOOLEAN NOT NULL DEFAULT false,
    "postToStatus" BOOLEAN NOT NULL DEFAULT false,
    "brandingGroupLink" TEXT NOT NULL DEFAULT '',
    "couponLink" TEXT NOT NULL DEFAULT '',
    "brandingCtaText" TEXT NOT NULL DEFAULT 'Participe do grupo:',
    "maxDailyFollows" INTEGER NOT NULL DEFAULT 3,
    "channelMinIntervalSec" INTEGER NOT NULL DEFAULT 30,
    "channelBurstCap" INTEGER NOT NULL DEFAULT 6,
    "channelBurstWindowSec" INTEGER NOT NULL DEFAULT 600,
    "channelDailyCap" INTEGER,
    "channelStaggerJitterMs" INTEGER NOT NULL DEFAULT 90000,
    "channelQuietHoursJson" TEXT NOT NULL DEFAULT '{"startHour":0,"endHour":6,"tz":"America/Sao_Paulo"}',
    "imageMutationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "copyVariationPoolJson" TEXT NOT NULL DEFAULT '{"greetings":["🚨 COOOOOORRE QUE TÁ ACABANDO!","💡 UTILIDADE PÚBLICA!!","😱 TÁ BARATOOO DEMAIS!","🍌 PREÇO DE BANANA!!","🔥 PARA TUDO E OLHA ISSO!","💸 O GERENTE ENLOUQUECEU!!","⚡ OFERTA RELÂMPAGO, CLICA JÁ!","🎁 QUASE DE GRAÇA, SÉRIO!!","💎 ACHADO DE MILHÕES!!","🏃 VOLTOU PRO ESTOQUE, VOA!","💥 CHOCADO COM ESSE VALOR!","🤑 SÓ QUEM FOR RÁPIDO VAI PEGAR!"],"ctas":["📲 Entre no nosso grupo oficial:","👥 Vem pro grupo economizar com a gente:","👇 Clique aqui e faça parte do nosso grupo VIP:","🤫 Acesse nosso grupo secreto de ofertas:","🚀 Receba os melhores achadinhos direto no grupo:","🔔 Quer ver as promoções primeiro? Entre no grupo:","💥 Não perca nenhum bug! Faça parte do grupo:","🛒 Garanta os melhores descontos entrando no grupo:","🤝 Junte-se à nossa comunidade de achadinhos:","👀 Para não perder nadinha, vem pro grupo:"],"trailers":["⚠️ Atenção: Preços e estoque podem mudar a qualquer momento!","🚨 O valor promocional e a disponibilidade dependem do estoque da loja.","⏳ Corra! Oferta por tempo limitado ou até durarem os estoques.","📝 Preço sujeito a alteração e produto sujeito a esgotar sem aviso prévio.","🏃💨 Garanta logo, porque o estoque voa e o preço pode subir rapidinho!","🔔 Aviso: A loja parceira pode alterar o valor ou encerrar a oferta a qualquer minuto.","🛒 Unidades promocionais limitadas! Preço sujeito a reajuste no site.","📉 Desconto válido por tempo limitado, sujeito a alteração e fim de estoque.","ℹ️ Os preços e a disponibilidade do produto são de responsabilidade total da loja.","💥 Aproveite rápido: Estoques limitados e valores sujeitos a alteração."]}',
    "probeAccountSessionId" TEXT,
    "probeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mobileTemplatesJson" TEXT NOT NULL DEFAULT '{}',
    "mobileCouponLinksJson" TEXT NOT NULL DEFAULT '{}',
    "preservationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_BotConfig" ("id", "userId", "delayMin", "delayMax", "platforms", "blockedKeywords", "welcomeMsg", "feedGlobal", "postToStatus", "brandingGroupLink", "couponLink", "brandingCtaText", "maxDailyFollows", "channelMinIntervalSec", "channelBurstCap", "channelBurstWindowSec", "channelDailyCap", "channelStaggerJitterMs", "channelQuietHoursJson", "imageMutationEnabled", "copyVariationPoolJson", "probeAccountSessionId", "probeEnabled", "mobileTemplatesJson", "mobileCouponLinksJson", "preservationEnabled", "updatedAt")
SELECT "id", "userId", "delayMin", "delayMax", "platforms", "blockedKeywords", "welcomeMsg", "feedGlobal", "postToStatus", "brandingGroupLink", "couponLink", "brandingCtaText", "maxDailyFollows", "channelMinIntervalSec", "channelBurstCap", "channelBurstWindowSec", "channelDailyCap", "channelStaggerJitterMs", "channelQuietHoursJson", "imageMutationEnabled", CASE WHEN trim(COALESCE("copyVariationPoolJson", '')) IN ('', '{}') THEN '{"greetings":["🚨 COOOOOORRE QUE TÁ ACABANDO!","💡 UTILIDADE PÚBLICA!!","😱 TÁ BARATOOO DEMAIS!","🍌 PREÇO DE BANANA!!","🔥 PARA TUDO E OLHA ISSO!","💸 O GERENTE ENLOUQUECEU!!","⚡ OFERTA RELÂMPAGO, CLICA JÁ!","🎁 QUASE DE GRAÇA, SÉRIO!!","💎 ACHADO DE MILHÕES!!","🏃 VOLTOU PRO ESTOQUE, VOA!","💥 CHOCADO COM ESSE VALOR!","🤑 SÓ QUEM FOR RÁPIDO VAI PEGAR!"],"ctas":["📲 Entre no nosso grupo oficial:","👥 Vem pro grupo economizar com a gente:","👇 Clique aqui e faça parte do nosso grupo VIP:","🤫 Acesse nosso grupo secreto de ofertas:","🚀 Receba os melhores achadinhos direto no grupo:","🔔 Quer ver as promoções primeiro? Entre no grupo:","💥 Não perca nenhum bug! Faça parte do grupo:","🛒 Garanta os melhores descontos entrando no grupo:","🤝 Junte-se à nossa comunidade de achadinhos:","👀 Para não perder nadinha, vem pro grupo:"],"trailers":["⚠️ Atenção: Preços e estoque podem mudar a qualquer momento!","🚨 O valor promocional e a disponibilidade dependem do estoque da loja.","⏳ Corra! Oferta por tempo limitado ou até durarem os estoques.","📝 Preço sujeito a alteração e produto sujeito a esgotar sem aviso prévio.","🏃💨 Garanta logo, porque o estoque voa e o preço pode subir rapidinho!","🔔 Aviso: A loja parceira pode alterar o valor ou encerrar a oferta a qualquer minuto.","🛒 Unidades promocionais limitadas! Preço sujeito a reajuste no site.","📉 Desconto válido por tempo limitado, sujeito a alteração e fim de estoque.","ℹ️ Os preços e a disponibilidade do produto são de responsabilidade total da loja.","💥 Aproveite rápido: Estoques limitados e valores sujeitos a alteração."]}' ELSE "copyVariationPoolJson" END, "probeAccountSessionId", "probeEnabled", "mobileTemplatesJson", "mobileCouponLinksJson", "preservationEnabled", "updatedAt"
FROM "BotConfig";

DROP TABLE "BotConfig";
ALTER TABLE "new_BotConfig" RENAME TO "BotConfig";
CREATE UNIQUE INDEX "BotConfig_userId_key" ON "BotConfig"("userId");

INSERT INTO "BotConfig" ("id", "userId", "copyVariationPoolJson", "updatedAt")
SELECT 'botcfg_default_' || "User"."id", "User"."id", '{"greetings":["🚨 COOOOOORRE QUE TÁ ACABANDO!","💡 UTILIDADE PÚBLICA!!","😱 TÁ BARATOOO DEMAIS!","🍌 PREÇO DE BANANA!!","🔥 PARA TUDO E OLHA ISSO!","💸 O GERENTE ENLOUQUECEU!!","⚡ OFERTA RELÂMPAGO, CLICA JÁ!","🎁 QUASE DE GRAÇA, SÉRIO!!","💎 ACHADO DE MILHÕES!!","🏃 VOLTOU PRO ESTOQUE, VOA!","💥 CHOCADO COM ESSE VALOR!","🤑 SÓ QUEM FOR RÁPIDO VAI PEGAR!"],"ctas":["📲 Entre no nosso grupo oficial:","👥 Vem pro grupo economizar com a gente:","👇 Clique aqui e faça parte do nosso grupo VIP:","🤫 Acesse nosso grupo secreto de ofertas:","🚀 Receba os melhores achadinhos direto no grupo:","🔔 Quer ver as promoções primeiro? Entre no grupo:","💥 Não perca nenhum bug! Faça parte do grupo:","🛒 Garanta os melhores descontos entrando no grupo:","🤝 Junte-se à nossa comunidade de achadinhos:","👀 Para não perder nadinha, vem pro grupo:"],"trailers":["⚠️ Atenção: Preços e estoque podem mudar a qualquer momento!","🚨 O valor promocional e a disponibilidade dependem do estoque da loja.","⏳ Corra! Oferta por tempo limitado ou até durarem os estoques.","📝 Preço sujeito a alteração e produto sujeito a esgotar sem aviso prévio.","🏃💨 Garanta logo, porque o estoque voa e o preço pode subir rapidinho!","🔔 Aviso: A loja parceira pode alterar o valor ou encerrar a oferta a qualquer minuto.","🛒 Unidades promocionais limitadas! Preço sujeito a reajuste no site.","📉 Desconto válido por tempo limitado, sujeito a alteração e fim de estoque.","ℹ️ Os preços e a disponibilidade do produto são de responsabilidade total da loja.","💥 Aproveite rápido: Estoques limitados e valores sujeitos a alteração."]}', CURRENT_TIMESTAMP
FROM "User"
WHERE NOT EXISTS (
  SELECT 1 FROM "BotConfig" WHERE "BotConfig"."userId" = "User"."id"
);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
