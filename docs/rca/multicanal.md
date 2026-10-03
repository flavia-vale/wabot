# Multicanal: Telegram (feature 017)

Spec, plano e tarefas: `specs/017-multicanal-telegram-instagram/`. Decisões da
dona do produto: `plan.md` §"Decisões registradas".

## Vocabulário (não regredir)

- Código: `deliveryNetwork`. Tela: **aplicativo**. Nunca reaproveitar
  `channel`/"canal" (= Canal do WhatsApp `@newsletter`) nem `platform`/
  "plataforma" (= loja). Guarda: `test/delivery-vocabulario.test.js`.
- Na tela: "o robô do Espelha Grupos", "seu grupo". Nunca token, chat_id,
  webhook, Bot API.
- Só `src/core/delivery/networks.js` pode escrever o nome de um aplicativo;
  o resto pergunta CAPACIDADE (`caps.acceptsButton`...). Guarda:
  `test/delivery-sem-if-por-rede.test.js`.

## Plano

- Multicanal só no **Premium** (R$ 99/mês, acima do Pro). Teste grátis e Pro
  não herdam (`canUseMultiNetwork`). O Premium também libera os Stories do
  Instagram.
- O Instagram Stories **fica no caminho próprio** (`src/instagram/`, decisão
  de 2026-10-02). Na tela Aplicativos ele aparece como "tela própria".

## Como funciona

| Peça | Onde |
|---|---|
| Interruptor + capacidades + prefixo `tg:` | `src/core/delivery/networks.js` |
| Cliente HTTP do Telegram (único que lê o segredo) | `src/delivery/telegram/api.js` |
| Adaptador (envio, motivos, prontidão, supergrupo) | `src/delivery/telegram/adapter.js` |
| Ligação grupo → conta (link `startgroup` com código) | `src/delivery/telegram/link.js`, tabela `DeliveryNetworkLink` |
| Leitor único de atualizações (long poll) | `src/delivery/telegram/updatesLoop.js` |
| Caixa de saída (rodízio, ritmo, idade, anti-repetição) | `src/deliveryOutbox/sweep.js`, `src/core/delivery/fairShare.js` |
| Filas/ofertas automáticas → Telegram | `src/deliveryOutbox/handOff.js` |
| Espelhamento WhatsApp → Telegram | ramo de hand-off em `src/bot-worker.js` (busque `enqueueDeliveryOutbox`) |
| Estado do robô + aviso interno | `src/core/delivery/networkHealth.js`, `src/delivery/telegram/healthWatch.js`, e-mail `admin_robo_aplicativo_parado` |
| Tela | `dashboard/app/painel/aplicativos/`, card "Robô do Telegram" no `/admin` |

Tudo roda **dentro do processo `api`** (setInterval + unref). Nenhum processo
PM2 novo. **Exige `api` com `instances: 1`**: o Telegram aceita UM leitor por
robô (dois leitores = 409 e um para).

## Ligar

```
DELIVERY_NETWORKS_ENABLED=whatsapp,telegram
TELEGRAM_BOT_TOKEN=<segredo do robô>   # só no .env do servidor, nunca no chat/GitHub
```

- Staging e produção usam **robôs diferentes** (dois ambientes no mesmo robô
  = 409).
- Aplicar com `pm2 delete` + `start` da API (pegadinha #1).
- **Pegadinha (descoberta na Fatia 4):** a lista de destinos do espelhamento é
  montada DENTRO do robô do WhatsApp, que lê o `.env` quando liga. Em
  produção (`remote`) o interruptor precisa estar no `.env` ANTES do deploy
  que reinicia o `bot-supervisor`, senão o espelhamento não chega ao Telegram
  até o próximo reinício dos robôs. Filas, ofertas automáticas e a tela
  dependem só da API.
- As fatias tocam código dos robôs (`src/core/`, `src/billing/`, schema...):
  o deploy em produção **reconecta todas as sessões**. Levar tudo num único
  develop → main, com aviso às clientes.

## Desligar

Tirar `telegram` do interruptor + `pm2 delete`/`start` da API: a API para de
entregar na hora. Robôs que ainda leem o valor antigo seguem deixando ofertas
na caixa de saída; a faxina descarta com motivo depois de 180 min. Nada é
apagado; os grupos voltam a receber ao religar.

## Contingência: o robô foi bloqueado (card "bloqueado" / e-mail interno)

1. Criar um robô novo no Telegram (BotFather), com o mesmo nome público.
2. Trocar `TELEGRAM_BOT_TOKEN` no `.env` da API.
3. `pm2 delete api && pm2 start ecosystem.config.cjs --only api && pm2 save`.
4. Avisar as clientes Premium: abrir Aplicativos e tocar em "Adicionar o robô
   a um grupo" de novo em cada grupo. Nenhuma configuração delas é perdida.

## Diagnóstico rápido (rodar no diretório do ambiente)

- Ofertas paradas: `sqlite3 <db> "SELECT status, COUNT(*) FROM DeliveryOutbox GROUP BY status"`.
- Motivo das falhas: `sqlite3 <db> "SELECT lastError, COUNT(*) FROM DeliveryOutbox WHERE status IN ('failed','dropped') GROUP BY lastError ORDER BY 2 DESC LIMIT 10"`.
- 409 no log da API = outro processo lendo o mesmo robô (staging e produção
  com o mesmo segredo, ou `api` com mais de uma instância).

## Revisão crítica (2026-10-03) — não regredir

PRs A/B/C da revisão. Cada item tem teste em `test/telegram-revisao-{a,a-sweep,b,c}.test.js`.

- **Destino `tg:` nunca passa pelo normalizador do WhatsApp** (`normalizeTargetJids`): ele acrescentava `@g.us` e o Telegram de filas/ofertas automáticas/"Enviar agora" nunca chegava. `canonicalDestinationId` aceita valores antigos com sufixo.
- **Robô do WhatsApp descarta destino de outro aplicativo** no início de `processSendJob` (`skip:destino_outro_aplicativo`), antes de "enviando", da vez entre destinos e de qualquer tentativa. Broadcast e agendadas repassam o Telegram para a caixa de saída.
- **Link Inteligente e rotas de grupo que consultam o WhatsApp** recusam grupo de outro aplicativo (o Baileys mandaria `tg:` ao servidor).
- **`canUseMultiNetwork` exige acesso em dia** (Premium vencido publicava de graça). O Instagram Stories ainda NÃO confere a data — mesma brecha, fora desta revisão.
- **Oferta aceita pelo Telegram nunca volta para a fila**: banco ocupado ao gravar "entregue" reenviava a cada minuto; "enviando" preso vira `entrega_incerta`, sem reenvio.
- **Foto que o Telegram não baixa** → sai só o texto (`imagem_removida`). **Tamanho** medido depois do HTML.
- **Caixa de saída pega 1 por grupo** (`distinct`), não as 200 mais antigas — uma conta não trava as outras.
- **`deleteWebhook` na partida**; 409/401 da leitura viram estado `conflito`/`bloqueado` com aviso.
- **Supergrupo** leva junto as ofertas da caixa de saída.
- **Fila só de Telegram** não para quando o WhatsApp cai.
- **Limite de grupos** vale no link; **horário de envio e limite diário** do destino valem no Telegram (adia, não descarta); **limite de ritmo** só vira alerta em 2+ grupos; **robô removido 3x** pausa o envio até a prontidão voltar; Premium no editor de planos e no público dos e-mails.

## Ainda não feito

- **Telegram como origem (Fatia 5)**: depende de decisão da dona do produto
  sobre reaproveitar o pipeline de espelhamento (hoje dentro do robô do
  WhatsApp) ou fazer uma versão reduzida na API.
- Foto da mensagem de origem no espelhamento para o Telegram (vai só o texto;
  o Telegram mostra a prévia do link da loja).
- Página pública de preços com o Premium (T040), quando o Telegram estiver no
  ar para todas.
