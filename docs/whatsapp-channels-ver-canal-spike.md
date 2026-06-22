# Spike (Fase 0) — botão nativo "Ver canal" do canal do próprio usuário

## Problema

Mensagens espelhadas grupo→grupo com mídia (imagem/vídeo) reaproveitam o proto
original via `relayMessage` (caminho de relay em `src/bot-worker.js`). A cópia
era rasa e carregava o `contextInfo.forwardedNewsletterMessageInfo` da ORIGEM —
é ele que renderiza o botão **"Ver canal"** apontando para o canal de outra
pessoa.

Objetivo da feature: remover esse botão de terceiros e, opcionalmente, injetar
o canal do **próprio usuário** como botão nativo "Ver canal".

## O que este spike valida (e por que existe)

Não há certeza de que o WhatsApp renderiza um `forwardedNewsletterMessageInfo`
**fabricado** de forma confiável. Ele pode exigir:

- um `serverMessageId` real (de uma mensagem que de fato existe no canal), e/ou
- que a conta do bot **siga** (ou administre) o canal de destino.

Antes de construir schema + UI + persistência (Fases 1–3), este spike confirma,
em **staging**, se o botão renderiza e abre o canal correto. O resultado decide:

- **Renderiza de forma confiável** → seguimos com o botão nativo (Fases 1–3).
- **Não renderiza / instável** → pivotamos para "link do canal em texto"
  (reaproveitando o mecanismo de branding `brandingGroupLink`).

## Como está implementado (gated, no-op em produção)

O spike é controlado por env vars. **Sem `CHANNEL_FORWARD_SPIKE_JID`, o relay
mantém o comportamento histórico byte-a-byte** (shallow copy + caption) — nada
muda em produção.

| Env                                  | Obrigatória | O que faz                                                            |
|--------------------------------------|-------------|----------------------------------------------------------------------|
| `CHANNEL_FORWARD_SPIKE_JID`          | sim (ativa) | JID do canal de teste (`xxxxx@newsletter`). Ausente → spike desligado. |
| `CHANNEL_FORWARD_SPIKE_NAME`         | não         | Nome exibido do canal (`newsletterName`).                            |
| `CHANNEL_FORWARD_SPIKE_SERVER_MSG_ID`| não         | `serverMessageId` a injetar. Vazio → campo omitido (testar ambos).   |

Quando ativo, o relay:
1. **remove** o `forwardedNewsletterMessageInfo`/`externalAdReply` da origem;
2. **injeta** um `forwardedNewsletterMessageInfo` apontando para o canal do env.

Código: `buildRelayProto()` em `src/core/channelSend.js`; wiring em
`src/bot-worker.js` (helper `getChannelForwardSpikeConfig()` + caminho de relay).
Testes: `test/core/channelSend.test.js`.

## Como rodar o spike em STAGING

> Nunca rodar em produção. Token/sessão e canal de teste são de staging.

1. Descobrir o JID do canal de teste (`@newsletter`). Opções:
   - usar um canal que a conta de staging já segue/administra;
   - inspecionar os logs do worker ao receber/seguir um canal.
2. No `~/wabot-staging/.env`, adicionar:
   ```
   CHANNEL_FORWARD_SPIKE_JID=<seu_canal_de_teste>@newsletter
   CHANNEL_FORWARD_SPIKE_NAME=Canal de Teste
   # primeira passada: deixar vazio/sem a linha para testar SEM serverMessageId
   # CHANNEL_FORWARD_SPIKE_SERVER_MSG_ID=
   ```
3. Aplicar a env (PM2 cacheia env — `restart --update-env` NÃO basta; ver
   pegadinha #1 do AGENTS.md):
   ```bash
   pm2 delete bot-supervisor-staging api-staging
   cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging
   pm2 start ecosystem.config.cjs --only bot-supervisor-staging   # se em modo remote
   pm2 save
   ```
   (Em modo `inline`, o worker é forkado pela `api-staging`, então o delete/start
   da `api-staging` já recarrega a env do worker.)
4. Enviar, num **grupo monitorado** de staging, uma mensagem com **imagem +
   link** (ex.: uma oferta) que dispare o espelhamento para um **grupo de
   destino**.
5. No grupo de destino, observar a mensagem espelhada:
   - **PASS:** aparece o botão "Ver canal" e ele abre o **canal de teste**
     configurado (não o de terceiros).
   - **FAIL:** botão não aparece, aparece quebrado, ou ainda mostra o canal de
     origem.

## Matriz de testes a cobrir

| Cenário                                   | Esperado / a observar                                  |
|-------------------------------------------|--------------------------------------------------------|
| Sem `SERVER_MSG_ID`                       | Botão renderiza? Abre o canal certo?                   |
| Com `SERVER_MSG_ID` real (msg do canal)   | Botão renderiza? Deep-link abre a postagem certa?      |
| Com `SERVER_MSG_ID` inventado (ex.: `1`)  | Renderiza mesmo assim? Quebra?                          |
| Conta do bot **segue** o canal            | Diferença na renderização?                             |
| Conta do bot **não segue** o canal        | Diferença na renderização?                             |
| Mensagem espelhada **sem** spike (env off)| Confirmar que o botão de terceiros sumiu/era o legado. |

## Critério de decisão

- Se houver **uma combinação confiável** (renderiza e abre o canal certo, de
  forma reproduzível) → documentar exatamente qual (precisa de serverMessageId
  real? precisa seguir o canal?) e seguir para Fase 1–3 com essa combinação.
- Caso contrário → registrar o resultado e pivotar para o fallback de texto.

## Limpeza pós-spike

- Remover as três env vars `CHANNEL_FORWARD_SPIKE_*` do `.env` de staging e
  recarregar (delete/start).
- O código gated pode permanecer no branch enquanto vira a feature definitiva
  (`BotConfig.channelForward*`), ou ser removido se pivotarmos para texto.
