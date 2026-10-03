# Research — Telegram como origem pela conta pessoal (feature 021)

Formato: **Decisão / Por quê / Alternativas**. Tudo que depende do Telegram real e não
foi medido está marcado **HIPÓTESE**, com a medição da Fase 0 (PR-0) que decide.
Linhas citadas referem-se ao `HEAD` 788ca1a7.

---

## R1. Biblioteca MTProto: `telegram` (GramJS)

- **Decisão**: `telegram` (GramJS) em versão **fixada** (sem `^`), escolhida no PR-0 entre as estáveis mais recentes.
- **Por quê**: JavaScript puro (sem binário nativo → nada de `node-gyp` no deploy), mesma linguagem do repo, suporta o que precisamos: `client.signInUserWithQrCode` (usa `auth.exportLoginToken`/`auth.importLoginToken` e trata a troca de DC), callback de senha de duas etapas (SRP feito pela lib), `StringSession` (sessão como texto → cabe na criptografia de credenciais), evento `NewMessage`, `FloodWaitError` com `.seconds`, `floodSleepThreshold` configurável, `Api.auth.LogOut`. Um `TelegramClient` por conta; vários no mesmo processo é uso comum da lib.
- **Riscos conhecidos (HIPÓTESE, medir no PR-0)**: consumo de memória do cache de entidades por conta; log interno verboso (por isso `setLogLevel('none')`); comportamento de atualizações de canais grandes (pode chegar com atraso ou exigir `getDifference`).
- **Alternativas**:
  - **TDLib** (`tdl` + binário `libtdjson`): mais robusta em atualizações, mas binário nativo por arquitetura, ~100+ MB de RAM por conta segundo relatos públicos (HIPÓTESE) e banco local em disco por conta → pior para memória e para LGPD (mais dado em disco). Rejeitada.
  - **`mtcute`**: moderna, TypeScript, boa API; menos usada, menos material de referência. Fica como alternativa se o GramJS falhar na medição.
  - **Pyrogram/Telethon** (Python): outra stack no VPS. Rejeitada.
- **Impacto de deploy**: a dependência altera `package-lock.json`, que está em `WORKER_CODE_PATHS_RE` (`scripts/deploy_safe_dashboard.sh:357`) → **reinicia o `bot-supervisor`** no deploy de produção. Por isso entra no PR-1, junto com o único reinício anunciado. Para a medição (PR-0) a lib é instalada **fora do repo** (`~/telegram-spike`), sem passar pelo `package.json`.

## R2. Reaproveitar o tratamento do WhatsApp

- **Decisão**: opção (a) — extrair o "estágio de texto" de `processIncomingMessage` (`src/bot-worker.js:4746`) para `src/core/mirrorPipeline.js` e a dedup por destino (`src/bot-worker.js:5745–5900`) para `src/core/mirrorDestinationDedup.js`, por **movimentação sem edição** com lista declarada de substituições; worker e API chamam o mesmo código. Mapa linha a linha em plan.md §D1.
- **Por quê**: D3 pede o mesmo tratamento para sempre. As regras já estão quase todas em módulos (`mirrorLinkGuard`, `mirrorTemplate`, `relayFooter`, `customDomainLinkResolver`, `messageProcessor`, `forwardingPolicy`, `conversionScheduler`, `destinationRouting`); o que falta extrair é a **orquestração** (~700 linhas), justamente onde as correções de RCA caem (ex.: `skip:policy:*:unsupported_store`, Awin/Rakuten, eleição do primário sem cupom). O worker já precisa mudar no PR-1 por `options.mirror` e config → a extração não custa reinício extra.
- **Prova de equivalência**: (1) teste de movimentação byte a byte contra snapshot do trecho original; (2) tabela de ≥ 30 mensagens com golden de saída e de linhas de `MessageLog`; (3) suíte atual sem alterar teste + 24 h de staging comparando `MessageLog` por motivo. **HIPÓTESE**: o harness de worker com socket fingido já existente (`test/mirror-duplicate-replay.test.js` e afins) alcança `processIncomingMessage` inteiro; se não alcançar, a camada (2) roda só no módulo e o PR diz isso.
- **Alternativas**:
  - **(b) orquestrador duplicado** no lado da API, sem tocar o worker. Zero risco imediato, mas duas cópias divergem. Fica como **recuo** se a camada (1) não fechar (ex.: closures demais para mover sem editar).
  - **(c) injetar a mensagem do Telegram no robô do WhatsApp** (comando novo "trate esta mensagem"): reaproveitaria 100%, mas exige comando novo no `protocol.js` [PROTECTED_CORE] e mídia em formato Baileys; e amarraria a origem do Telegram ao WhatsApp estar conectado mesmo para destino Telegram. Rejeitada.
  - **(d) versão reduzida na API** (só conversão + texto): viola D3. Rejeitada.

## R3. Onde roda o tratamento: na API, não no leitor

- **Decisão**: leitor fino (só lê e grava na fila); tratamento na API, em passada in-process (`src/telegramOrigin/inboxSweep.js`).
- **Por quê**: a API **já** carrega conversores e converte links hoje (`src/api/routes/linkConversion.js`, `src/core/linkCore.js`, ofertas automáticas); já é quem chama `sendBroadcast` (filas/automáticas) e quem drena a caixa de saída (017). Pôr conversores no leitor duplicaria memória (conversores + raspadores) e faria correção de conversão exigir reiniciar o leitor (reconectar contas do Telegram). Com a fila no banco, API reiniciando não perde mensagem; leitor reiniciando não perde trabalho já gravado.
- **Alternativa**: tratar no leitor — rejeitada por memória e acoplamento (acima).

## R4. Comunicação API ↔ leitor

- **Decisão**: banco (estado + fila + heartbeat) + HTTP em `127.0.0.1` com segredo interno para comandos síncronos. Contrato em `contracts/leitor-controle-http.md`.
- **Por quê**: não toca `src/supervisor/protocol.js`; a senha de duas etapas nunca é gravada (vai direto da requisição da API para a memória do leitor); QR precisa de ida e volta rápida.
- **Alternativas**: Redis pub/sub em canal próprio (mais uma peça; staging é `inline` e o leitor não usa Redis para nada); só banco (senha teria de passar pelo disco); IPC de `fork()` (o leitor não é filho da API e não deve ser — FR-014).

## R5. Login por QR, duas etapas e uma conta por cliente

- **Decisão**: `signInUserWithQrCode` no leitor; cada token vira `tg://login?token=<base64url>` que a API devolve à tela como **imagem de QR** (a tela nunca mostra o texto). Token expira em ~30 s (HIPÓTESE pelo comportamento conhecido do `exportLoginToken`); a lib renova e o leitor atualiza a sessão de login em memória; a tela consulta a cada 2 s. Após 2 min sem leitura, o login é encerrado e a tela oferece "gerar outro QR" (US2.4).
- **Duas etapas**: callback `password(hint)` do GramJS fica esperando uma `Promise` resolvida pelo `POST /login/:id/senha` do controle local; timeout 3 min; a senha não é logada nem gravada; erro `PASSWORD_HASH_INVALID` → "senha incorreta" (sem jargão).
- **Uma conta do Telegram por conta do Espelha Grupos (FR-008)**: depois do login, `getMe()` → id do usuário → HMAC → `telegramUserIdHash @unique`. Conflito → o leitor revoga a sessão recém-criada (`auth.logOut`) e a tela explica.

## R6. Tipo da mensagem do Telegram → vocabulário do WhatsApp

- **Decisão**: mapeador puro `telegramMessageKind(message)` devolvendo o mesmo vocabulário de `detectMessageKind` (`src/forwardingPolicy.js:67`): texto → `'text'`; foto com legenda → `'image_with_caption'`; foto sem texto → `'image'`; vídeo com legenda → `'video_with_caption'`; figurinha → `'sticker'`; enquete, áudio, documento, contato, localização, serviço (entrou/saiu) → `'other'`/`'audio'`/`'document'`. A política de encaminhamento (`shouldForwardMessage`) decide igual ao WhatsApp. Álbum: só a mensagem com legenda (o Telegram põe a legenda num item) — HIPÓTESE a confirmar no PR-0.
- **Links escondidos atrás de palavras**: entidades `MessageEntityTextUrl` viram `palavra https://url` no texto entregue ao pipeline (o detector precisa ver a URL). Botões inline com URL (`replyMarkup`) também são extraídos e anexados ao fim, uma por linha (comum em canais de achadinhos — HIPÓTESE de frequência).
- **Formatação**: v1 entrega texto simples; negrito vira `*texto*` (formato do WhatsApp) só se o teste de vocabulário/equivalência não mostrar efeito colateral — decisão das tarefas.

## R7. Identificador das origens

- **Decisão**: `Group.waJid = 'tg:<id no formato do Bot API>'` — supergrupo/canal `-100<channel_id>`, grupo básico `-<chat_id>` — o mesmo formato que a 017 usa para destino (`src/delivery/telegram/adapter.js:23`, `toDestinationId`). `deliveryNetwork='telegram'`, `role='monitor'`, `kind='group'`. GramJS expõe `utils.getPeerId(peer)` que já devolve esse formato (HIPÓTESE de API; conferir no PR-0).
- **Por quê**: comparar a mesma conversa nos dois papéis (origem pela conta, destino pelo robô) com `canonicalDestinationId` (`src/core/delivery/networks.js:214`) e a trava atual de `src/api/routes/groups.js:136–152`. A unicidade `@@unique([userId, waJid, role])` continua valendo.
- **Supergrupo migrado de grupo básico**: o id muda (`-<id>` → `-100<id>`); evento `MessageActionChatMigrateTo` atualiza o `waJid` da origem (mesma ideia do "supergrupo leva junto as ofertas" da 017).
- **Tópicos**: mensagens de qualquer tópico contam como o mesmo grupo (edge case da spec) — o filtro usa só o chat.

## R8. Frescor, ordem e "no máximo uma vez"

- **Decisão**: `TelegramInboxMessage @@unique([telegramAccountId, sourceId, messageId])` é ao mesmo tempo dedup de entrada e fila. Na leitura: `create` com conflito = já visto → descarta (reentrega, reconexão, recuperação de lacuna). Na passada: 1 pendente por origem, a mais antiga; `processing` preso > 2 min ou 3 tentativas → `failed` e segue. Frescor por `shouldProcessIncomingMessage` (`src/core/incomingFreshness.js`) com `upsertType='notify'`, janelas iguais às do WhatsApp (5 min / 60 min tardia para origem monitorada).
- **Por que não `DeliveryInboxSeen`** para isso: a unicidade dela é `(deliveryNetwork, sourceId, messageId)` **sem conta** — duas clientes com o mesmo canal de origem se bloqueariam (a primeira a ler "consumiria" a mensagem da outra). Mudar a unicidade exigiria recriar a tabela (SQLite). A tabela fica com o uso que serve bem: marcar as mensagens **publicadas pelo robô** (trava anti-loop "a"), que é global por natureza.
- **Mensagem editada/apagada**: `EditedMessage`/`DeletedMessage` não são escutados (fora de escopo, igual ao WhatsApp).

## R9. PM2 e deploy do leitor

- **Decisão**: apps `telegram-leitor` (prod) e `telegram-leitor-staging` no `ecosystem.config.cjs`, `instances: 1`, `fork`, `max_memory_restart` = medido + 30% (HIPÓTESE inicial 350M). Os scripts de deploy ganham `LEITOR_CODE_PATHS_RE` e só fazem `pm2 restart <leitor> --update-env` **se o app já existir no pm2** e o diff tocar os caminhos do leitor — o leitor nunca é ligado por deploy, só à mão (com janela, `scripts/janela.sh`, e `pm2 save` via `scripts/pm2-save-seguro.mjs`). `stagingPower` passa a incluir `telegram-leitor-staging` no desligar/ligar.
- **Mudança de env** do leitor: `pm2 delete telegram-leitor && pm2 start ecosystem.config.cjs --only telegram-leitor` (pegadinha #1).
- **Trava de instância única**: ao subir, o leitor grava `TelegramLeitorHeartbeat{ env, instanceId, pid }`; se encontrar heartbeat de outro `instanceId` com < 90 s, sai com erro (evita dois leitores no mesmo ambiente, p.ex. pm2 duplicado após `resurrect`).
- **Staging × produção**: registros separados em my.telegram.org (API_ID/HASH por ambiente) e contas de teste separadas; nunca a mesma conta do Telegram conectada nos dois ambientes (o Telegram aceita, mas duplicaria leitura e confundiria os testes).

## R10. Desconectar com o leitor fora do ar

- **Decisão**: a API marca `desiredState='revogar'`, apaga **na hora** origens, fila e fotos, e mostra "desconectada"; mantém só a sessão cifrada até o leitor executar `auth.logOut` (ao voltar, primeira coisa que faz) e então apaga a linha. Se a revogação falhar com `AUTH_KEY_UNREGISTERED` (já revogada pela cliente), apaga do mesmo jeito.
- **Por quê**: FR-007 exige encerrar do lado do Telegram; apagar a sessão antes de revogar deixaria um acesso aberto em "Dispositivos" que só a cliente consegue fechar.
- **Teto**: se o leitor ficar > 24 h sem revogar, o aviso interno dispara e a tela orienta a cliente a encerrar em Configurações → Dispositivos (texto leigo).

## R11. Minimização de dados (LGPD)

- **Decisão**: só mensagens de origens marcadas são gravadas; texto da fila é apagado ao concluir (`done`/`dropped`/`failed` → `text=NULL`), linhas da fila apagadas após 7 dias; fotos apagadas após 6 h; lista de grupos para escolha nunca é gravada; nenhum número de telefone gravado (só nome visível e `telegramUserIdHash`). O histórico (`MessageLog`) segue a política atual, igual ao WhatsApp (`sanitizeMessageForLog`).

## R12. Regras de uso do Telegram (Fase 0 — conferir, não presumir)

- **HIPÓTESE**: os Termos da API do Telegram permitem cliente de terceiros com `api_id` próprio, desde que não haja spam, automação de envio abusiva nem uso enganoso; contas usadas por clientes não oficiais com comportamento atípico (muitos logins novos, entrada em massa em canais, muitas chamadas) correm risco de restrição.
- **O que o PR-0 entrega**: leitura dos termos vigentes (core.telegram.org/api/terms) com resumo para a dona, e o registro do aplicativo com nome/descrição verdadeiros. A decisão de seguir é da dona (spec, tabela de riscos).

## R13. Medição de memória (roteiro da Fase 0)

1. Em `~/telegram-spike` (fora do repo), instalar a versão candidata do `telegram` + `@prisma/client` igual à do repo.
2. `pm2 start spike.mjs --name telegram-spike` (staging autorizado por D4), com 0 contas, depois 1, 3 e 5 contas de teste conectadas, cada etapa ≥ 2 h e a de 3 contas por 24 h.
3. Coletar `pm2 jlist` → `monit.memory` a cada 5 min (o próprio script grava CSV com `process.memoryUsage()` e RSS) e o swap do host.
4. Registrar: RSS base, incremento por conta, crescimento em 24 h (vazamento?), latência mediana/p95 de `NewMessage` num canal de teste grande e num grupo pequeno, e se a conta de teste aparece "online" ou marca "visto".
5. Resultado vai para `docs/rca/memoria-e-capacidade.md` (seção nova) e para a decisão da dona (D4).

## Em aberto (decidido depois, com dado)

| Item | Decide | Quando |
|---|---|---|
| RAM real e teto de contas por processo (`TELEGRAM_LEITOR_MAX_ACCOUNTS`) | dona, com R13 | fim do PR-0 |
| Seguir com processo separado ou plano B A1 (dentro da API) | dona | fim do PR-0 |
| Limite de origens por conta (default proposto 10) | dona, com R12/R13 | PR-3 |
| Portas internas definitivas do controle (propostas 3021/3024) | implementação; registrar em `docs/rca/deploy-e-infra.md` | PR-2 |
| Autor de post do robô em canal (confirma D5.a.2) | PR-0 | fim do PR-0 |
