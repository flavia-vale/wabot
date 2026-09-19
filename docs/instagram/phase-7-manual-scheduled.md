# Fase 7 — Stories manuais e agendados

`POST /api/instagram/stories` recebe uma oferta canônica, URL da imagem e de 1
a 10 `destinationIds`. `scheduledFor` ausente cria envio manual; presente deve
ser futuro e cria job BullMQ com delay. Uma publicação é materializada por
destino, com chave idempotente própria, snapshot e versão do template padrão.

O download usa DNS anti-SSRF em cada hop, redirects manuais (máximo 3), timeout
de 15s e teto de 15 MB. Só depois do download o renderer e o storage são
acionados. Falha de um destino não cancela os demais; a resposta 202 separa
`publications` e `errors`.

`GET /api/instagram/stories` lista os 100 envios recentes do tenant sem token
ou payload interno. `DELETE /api/instagram/stories/:id` cancela somente item
agendado, futuro e ainda `queued`, removendo também o job BullMQ quando ele
ainda existe.

Toda preparação passa novamente pelo gate Premium no serviço de asset e no
dequeue. Runtime/storage ausentes devolvem 503 sem criar publicação.
