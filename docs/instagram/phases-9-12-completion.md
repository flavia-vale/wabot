# Instagram Stories — fases 9 a 12

## Fase 9 — filas de ofertas

`OfferQueueDestination` liga a fila a destinos tipados e cada item congela a
oferta em `offerSnapshot`. Filas Instagram-only drenam sem WhatsApp online. O
envio usa `offer-queue:<queue>:<item>:<destination>` e o retry existente da
fila não duplica Stories porque a publicação é idempotente.

## Fase 10 — espelhamento

`InstagramMirrorDestination` liga um grupo monitorado a contas Instagram. O
bot-worker captura uma oferta já convertida para o link afiliado da cliente e
grava um outbox `InstagramStoryIngress`; ele nunca carrega token Meta. A API
consome o outbox, revalida tenant/destino/plano, prepara o asset e entrega à
fila de publicação. São cinco tentativas com backoff e chave idempotente por
mensagem de origem e destino.

## Fase 11 — operação e painel

Configurações ganhou conexão OAuth, saúde/validade do token, renovação,
desconexão, últimas 20 publicações e retry explícito. A API lista destinos junto
da conexão e permite retry somente de falhas. Tokens e IDs internos do
provedor continuam fora das respostas de publicação.

## Fase 12 — rollout e POC final

1. aplicar migrations e configurar storage/Redis/OAuth primeiro em staging;
2. manter o plano comercial Premium indisponível até aprovação da Meta;
3. conectar uma conta Business/Creator de teste;
4. executar o runbook da fase 0 por último e publicar uma imagem sem dados reais;
5. validar manual, agendado, fila, automação e espelhamento no staging;
6. revisar DLQ, limites e expiração do asset por 24 horas;
7. somente depois promover `develop -> main`.

A POC real continua necessariamente pendente até existirem credenciais Meta e
uma conta profissional autorizada; o código e o runbook estão prontos, mas essa
etapa não deve ser simulada nem executada com segredos no terminal/histórico.
