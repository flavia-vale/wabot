# Implementation Plan: Telegram como origem pela conta pessoal da cliente

**Branch**: `021-telegram-origem-plano` (spec em `021-telegram-origem-conta-pessoal`) | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/021-telegram-origem-conta-pessoal/spec.md` + feature anterior `specs/017-multicanal-telegram-instagram/` + `docs/rca/multicanal.md`.

**Artefatos desta fase**: [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

---

## Decisão registrada da dona do produto (2026-10-03, confirmação nova)

> **O robô do Espelha Grupos continua sendo QUEM PUBLICA nos destinos do Telegram.
> A conta pessoal da cliente só LÊ as origens.**

Consequência técnica, que vale para todo o plano: o processo novo (`telegram-leitor`)
**não tem nenhum caminho de código que envie, responda, reaja, marque como lida, entre ou
saia de grupo**. Toda publicação continua indo por um dos dois caminhos que já existem:
`sendBroadcast` (WhatsApp da cliente) ou `DeliveryOutbox` → `sweep` → robô (Telegram).
Isso é travado por teste estrutural (T-E3 em "Testes estruturais").

Demais decisões da spec (D1–D5) valem sem alteração: Premium com acesso em dia (D1),
conta dedicada recomendada (D2), tratamento igual ao WhatsApp sem mudar o WhatsApp (D3),
processo novo **autorizado só para medição em staging** — OK de produção depois da medição (D4),
começar agora (D5).

---

## Summary

A cliente Premium conecta a própria conta do Telegram por QR; um processo PM2 novo e
**fino** (`telegram-leitor`, cliente MTProto GramJS) mantém as contas conectadas e, das
origens marcadas, grava cada mensagem nova numa **fila de entrada no banco**
(`TelegramInboxMessage`). Quem trata a oferta é a **API**, numa passada in-process (mesmo
padrão do `sweep` da caixa de saída da 017), usando o **mesmo código** de tratamento do
espelhamento do WhatsApp — extraído de `src/bot-worker.js` para `src/core/mirrorPipeline.js`
por **movimentação sem edição**, travada por teste de equivalência. A entrega reaproveita o
que já existe: destino WhatsApp → `sendBroadcast` (com um campo opcional novo `options.mirror`
para histórico e trava de repetição por link); destino Telegram → `enqueueDeliveryOutbox` →
robô do Espelha Grupos.

Os quatro pilares, em ordem de importância:

1. **O WhatsApp não muda de comportamento.** Toda mudança no robô do WhatsApp é *mover*
   código (extração) ou *acrescentar* um ramo que só roda quando um campo novo está presente.
   Tudo isso entra **num único PR de núcleo** (PR-1), com **um único reinício anunciado** do
   `bot-supervisor` em produção, com interruptores desligados (nada novo acontece).
2. **O leitor é fino e isolado.** Ele só lê e grava no banco; não converte link, não envia,
   não carrega conversor. Cair ou travar não afeta API nem WhatsApp (FR-014). A API cair não
   perde mensagem: a fila de entrada está no banco.
3. **`src/supervisor/protocol.js` [PROTECTED_CORE] não muda.** `options` do `sendBroadcast`
   já é objeto livre que atravessa o protocolo; API ↔ leitor conversam por **banco** (estado
   e fila) + **HTTP só em 127.0.0.1** com segredo interno (comandos síncronos: QR, senha de
   duas etapas, lista de grupos, desconectar).
4. **Memória sinalizada e medida antes.** Hipótese de RAM declarada, roteiro de medição em
   staging (Fase 0, fora do fluxo de deploy) e alternativa mais leve na mesa.

---

## Technical Context

**Language/Version**: Node.js 22 ESM (mesmo runtime do repo; `node -v` = v22.22.2 no ambiente de desenvolvimento).

**Primary Dependencies**: as existentes (Fastify, Prisma/SQLite, BullMQ/Redis, Next.js) **+ uma nova: `telegram` (GramJS)**, versão fixada sem `^`. Escolha e alternativas em research.md §R1. ⚠️ Adicionar dependência muda `package-lock.json`, que está em `WORKER_CODE_PATHS_RE` (`docs/rca/deploy-e-infra.md` linha ~157): **o deploy que leva a dependência reinicia o `bot-supervisor`**. Por isso ela entra no PR-1 (núcleo), junto com o único reinício anunciado.

**Storage**: SQLite via Prisma (WAL). Migration **aditiva** única no PR-1: 3 tabelas novas (`TelegramAccount`, `TelegramInboxMessage`, `TelegramLeitorHeartbeat`) e **nenhuma** coluna nova em tabela existente — `Group` já tem `deliveryNetwork` (schema.prisma ~l.297) e `waJid` com prefixo `tg:` já é aceito pela unicidade `@@unique([userId, waJid, role])`. Detalhes em [data-model.md](./data-model.md). `prisma/schema.prisma` também está em `WORKER_CODE_PATHS_RE` → **toda migration desta feature nasce no PR-1**.

**Testing**: `node:test` (`npm test`), módulos puros + testes estruturais de guarda (padrão de `test/delivery-*.test.js`, `test/deploy-worker-code-paths.test.js`). Cliente GramJS sempre **fingido** nos testes (nenhum teste fala com o Telegram).

**Target Platform**: VPS único (30,6 GB, teto 80 vagas, limite seguro ~71 — `AGENTS.md`), PM2; prod `~/wabot` (modo `remote`), staging `~/wabot-staging` (modo `inline`).

**Project Type**: serviço web (backend `src/`) + painel Next.js (`dashboard/`) + **1 processo PM2 novo por ambiente**.

**Performance Goals**: SC-003 — 95% das ofertas de origem do Telegram chegam até 1 min além do que levaria vinda do WhatsApp. Orçamento: leitor grava na fila em < 2 s após o evento; passada da API a cada 3 s (single-flight); conversão = mesma do WhatsApp.

**Constraints**:
- **Memória (REGRA #1)**: processo novo — sinalização obrigatória abaixo; OK de produção só depois da medição (D4).
- **`protocol.js` intocado**; `PROTOCOL_VERSION` não muda (guarda já existe: `test/delivery-protocolo-intocado.test.js`).
- **Modo `remote`**: código de worker só vale após reiniciar o `bot-supervisor` (reconecta todas as sessões) → um reinício, no PR-1, anunciado.
- **Leitor fora de `WORKER_CODE_PATHS_RE`**: código do leitor em `src/telegramReader/` (não em `src/core/`), para correção no leitor nunca reconectar o WhatsApp. Ele *importa* módulos de `src/core/` só de leitura (ex.: `networks.js`); o contrário (worker importar `src/telegramReader/`) é proibido por teste.
- **Um leitor por ambiente** (`instances: 1`): duas instâncias conectariam a mesma conta duas vezes (o Telegram aceita, mas duplicaria leitura e aumentaria risco de restrição). Trava por `TelegramLeitorHeartbeat.instanceId`.
- **API segue `instances: 1`** (já exigido pela 017 para o leitor do robô).

**Scale/Scope**: liberação gradual; dimensionamento inicial 1–10 contas conectadas, teto técnico por processo a medir na Fase 0 (alvo 50). 31 FRs, 10 SCs, 6 fases.

---

## Constitution Check

*GATE: antes da Phase 0 e de novo depois da Phase 1.*

⚠️ `.specify/memory/constitution.md` continua **template não preenchido** (placeholders `[PRINCIPLE_N_NAME]` intactos). Como na 017, o gate é avaliado contra **`AGENTS.md`** (fonte canônica de regras do repo).

| Regra canônica (AGENTS.md) | Situação neste plano | Veredito |
|---|---|---|
| **REGRA #1 memória — SUPER SINALIZAR** | Processo PM2 novo. Estimativa declarada como HIPÓTESE, medição em staging (Fase 0) fora do fluxo de deploy, OK explícito da dona antes de produção (D4). | ⚠️ **condicionado** à sinalização abaixo |
| **REGRA #2 — alternativa mais leve** | Três alternativas avaliadas e precificadas (leitor dentro da API até N contas; leitor + tratamento no mesmo processo; polling sem conexão permanente). | ✅ |
| **REGRA #3 — limpeza só segura e reversível** | Nenhum restart em massa fora do PR-1 anunciado; nada de FLUSHALL; leitor tem `max_memory_restart`. | ✅ |
| **`protocol.js` [PROTECTED_CORE]** | Não tocado. `options.mirror` viaja dentro de `options` do `SEND_BROADCAST`, que já é objeto livre (`src/supervisor/client.js:616`). | ✅ |
| **Modo `remote` / um reinício anunciado** | Todas as mudanças de worker + migration + dependência no PR-1, interruptores desligados. PR-2..PR-6 não tocam caminho de worker (verificado por `test/deploy-worker-code-paths.test.js` + teste novo T-E2). | ✅ |
| **Mudar env exige `pm2 delete` + `start`** | Interruptores lidos pela API e pelo leitor (nunca pelo worker); runbook usa delete+start. | ✅ |
| **Branch → PR contra `develop` → staging → PR para `main`** | 7 PRs (PR-0..PR-6), cada um contra `develop`; validação ao vivo em staging antes de `main`. | ✅ |
| **Migration aditiva, passa por staging** | 3 tabelas novas, zero ALTER em tabela com dado. | ✅ |
| **Não mexer em `.env`/banco de prod sem confirmar** | `TELEGRAM_API_ID/HASH` e interruptores entram no `.env` de prod só com a dona. | ✅ |
| **Vocabulário** (`channel`/`platform` reservados; "aplicativo" na tela) | Código: `deliveryNetwork='telegram'`; tela: "sua conta do Telegram", "o robô do Espelha Grupos". Proibidos em tela/e-mail: token, sessão, MTProto, api_id, chat_id, hash, código de autorização. Guardas estendidas. | ✅ |
| **Design system v2** | Tela nova segue `docs/design-system/design-system-v2.html` (cards, botões, padrão PRO/Premium). | ✅ |
| **Causa raiz com dado; hipótese dita como hipótese** | Tudo que depende do Telegram real está marcado **HIPÓTESE** com a medição que a decide. | ✅ |

**Resultado do gate**: **aprovado condicionado** à sinalização de memória abaixo e ao gate da Fase 0 (regras de uso do Telegram + medição). Nenhuma violação a justificar em "Complexity Tracking" além do processo novo.

### 🔴 Sinalização de memória obrigatória (REGRA #1 — ler antes de aprovar)

**O que este plano acrescenta (HIPÓTESE até a Fase 0):**

| Item | Onde roda | Custo estimado (HIPÓTESE) | Base da estimativa |
|---|---|---|---|
| `telegram-leitor` (prod) | processo PM2 novo | **~110–150 MB fixos + 10–20 MB por conta conectada** | Node 22 vazio ~45 MB + cliente Prisma/SQLite ~30–50 MB (o `bot-supervisor`, sem robô, mede ~120 MB — `specs/017.../plan.md`) + GramJS ~20–40 MB; por conta: 1 conexão TCP, cache de entidades, laço de atualizações (a spec parte de 10–20 MB). **A spec dizia ~100 MB fixos; o Prisma no processo deve empurrar para cima — medir.** |
| `telegram-leitor-staging` | processo PM2 novo (staging) | idem, com 1–3 contas de teste | Desligável junto com o staging (`src/ops/stagingPower.js`, acrescentar ao `STAGING_PM2_APPS`). |
| Passada de tratamento da fila de entrada | dentro do processo `api` existente (`setInterval` + `unref`, single-flight) | **< 15 MB** em regime | Mesmo padrão do `sweep` da 017; lotes pequenos; conversores já estão carregados na API (`src/api/routes/linkConversion.js`). |
| Fotos das ofertas (disco, não RAM) | `TELEGRAM_MEDIA_DIR` | ≤ 5 MB por foto, TTL 6 h, faxina | Não pesa RAM. |

**Cenário prod, 10 contas**: ~150 + 10×15 ≈ **300 MB (HIPÓTESE)** ≈ menos de **1 vaga de robô** (0,35 GB/sessão na conta da política). Com 50 contas: ~150 + 50×15 ≈ 900 MB ≈ 2,5 vagas → o teto do leitor precisa ser decidido com o número medido.

**Alternativas mais leves (REGRA #2):**

| Alternativa | Custo | Por que não é a padrão |
|---|---|---|
| **A1 — Leitor dentro da API** até N contas (`TELEGRAM_LEITOR_MODE=inline`) | só o incremento por conta + GramJS (~20–40 MB), sem Node/Prisma duplicados | Viola o espírito de FR-014 (biblioteca de terceiro, conexões longas e possível vazamento dentro da API que atende o painel e as filas). Fica como **plano B** se a medição do processo separado não for aprovada; o código do leitor é escrito para rodar nos dois modos (mesma fábrica `createReaderPool`). |
| **A2 — Leitor sem Prisma** (falando com a API por HTTP local em vez do banco) | −30–50 MB fixos | Acopla o leitor à API estar de pé (API reiniciando = mensagens perdidas). Avaliar só se a medição mostrar o Prisma como o maior custo. |
| **A3 — Sem conexão permanente** (consulta periódica das origens a cada X s) | quase zero por conta parada | Mais chamadas ao Telegram = mais risco de restrição (SC-010) e latência pior (SC-003). Fica como recuperação de lacuna, não como modo principal. |

**Gate**: nenhum `pm2 start telegram-leitor` em **produção** sem (1) número medido na Fase 0 e (2) OK explícito da dona com esse número.

---

## Decisões de arquitetura

### D1. Reaproveitar o tratamento do WhatsApp: extrair o "estágio de texto" para `src/core/mirrorPipeline.js` (opção (a))

**O que existe hoje.** O tratamento mora inline em `processIncomingMessage` (`src/bot-worker.js:4746`), uma função de ~1.600 linhas com closures. Boa parte das regras **já está em módulos** (`src/core/mirrorLinkGuard.js`, `src/core/mirrorTemplate.js`, `src/core/relayFooter.js`, `src/core/customDomainLinkResolver.js`, `src/messageProcessor.js`, `src/forwardingPolicy.js`, `src/core/conversionScheduler.js`, `src/core/destinationRouting.js`) — o que está inline é a **orquestração**: ordem das etapas, leitura das configs do grupo e os registros de descarte.

Mapa (linhas do `HEAD` 788ca1a7):

| Linhas | Etapa | Vai para |
|---|---|---|
| 4753–4835 | `recordSkippedMessage` / `registerDedupBlock` (gravação de descarte) | **fica no worker**, injetado no módulo como `deps.recordLog` (mesma forma de linha) |
| 4846–4847 | extrair texto do proto do Baileys (`extractMessageContent`, `extractIncomingText`) | **fica no worker** (específico do WhatsApp) |
| 4849–4853 | texto grande demais (`skip:text_too_large`) | compartilhado |
| 4855–4864 | palavras bloqueadas (`skip:blocked_keyword`) | compartilhado |
| 4866–4902 | lojas Awin/Rakuten ligadas no grupo, desembrulho de domínio próprio (`unwrapCustomDomainOfferLinks`), `sanitizeInviteLinks`, sinal de loja não suportada | compartilhado |
| 4909–4935 | texto virou vazio / `linkRemovedSkipReason` | compartilhado |
| 4937–5026 | cupom, `detectLinks`, política de encaminhamento (`shouldForwardMessage`, `skip:policy:*`) | compartilhado; o tipo da mensagem entra como **callback** `deps.messageKindFor(sanitizedText)` (hoje é calculado em 4940 *depois* do sanitizador; o worker passa `detectMessageKind(innerMessage, ·)`, o Telegram um mapeador próprio — research §R6) |
| 5029–5030 | lojas permitidas (`allowedPlatforms`) | compartilhado |
| 5036–5235 | `getOriginalMediaMessage`, `downloadOriginalImage`, seleção de imagem | **fica no worker** (mídia do WhatsApp) |
| 5151 | `effectiveLinkTarget` (primeiro/último link) | compartilhado (é config do grupo) |
| 5257–5378 | conversão por loja (`convertPerPlatformSerially` + `convertLink` + `recordConversionIssue`) | compartilhado; `convertLink` e `recordLog` injetados |
| 5380–5404 | avisos de conversão (`warning:*`) | compartilhado |
| 5406–5442 | `decideMirrorConversions`, `applyConversionsAndBranding`, `findUnconvertedStoreLinks` | compartilhado |
| 5443–5455 | eleição do link primário | compartilhado |
| 5457–5511 | modelo de texto (`applyMirrorTemplate`, cupom `couponContext`), texto adicional (`appendRelayFooter`) | compartilhado |
| ~5522–5580 | trava de título desalinhado (`scrapeProductTitle` + `hasSignificantTokenOverlap`) | compartilhado (devolve `titleOverlap`) |
| 5583–5600 | estratégia de imagem de cupom / foto da loja | **fica no worker** (usa `titleOverlap` devolvido) |
| 5605–5616 | `resolveMonitorDestinations` | já é módulo (`src/core/destinationRouting.js`); os dois chamam |
| 5620–5627 | captura do Story do Instagram | fica no worker (fora do escopo: Instagram como origem) |
| 5630–5643 | janela de repetição (cupom curta/produto longa), idade de pendente | compartilhado (função pura `resolveDedupWindows`) |
| 5662–5684 | ramo de hand-off para outro aplicativo | fica no worker (já existe) |
| 5718–5735 | dedup local em arquivo (`dedup.links`) | **fica no worker** (estado do processo) |
| 5745–5790 | dedup no banco (`MessageLog` por destino + link original/convertido) | **extraído** para `src/core/mirrorDestinationDedup.js` (`findRecentDestinationDuplicate`) |
| 5817–~5900 | reserva atômica `SendDedupKey` | **extraído** para o mesmo módulo (`reserveSendDedupKeys`) |
| depois | montar payload, `enqueueSendJob`, preservação, envio | **fica no worker** |
| 6380–6450 | frescor/reentrega (`incomingFreshness`, `messageDedup`) | fica no worker; o leitor usa `shouldProcessIncomingMessage` (já puro) com `upsertType='notify'` e a própria fila como "ids vistos" |

**Contrato do módulo**: [contracts/mirror-pipeline.md](./contracts/mirror-pipeline.md). Resumo: `prepareMirrorOffer({ text, monitorGroup, cfg, ids }, deps)` devolve `{ kind: 'drop' }` (o motivo já foi gravado por `deps.recordLog`, exatamente como hoje) ou `{ kind: 'offer', finalText, primary, conversions, links, sanitizedText, isCouponMsg, templateApplied, couponContext, titleOverlap, dedupWindows }`.

**Como provar que o WhatsApp não muda (FR-016/SC-001)** — três camadas:

1. **Movimentação sem edição, travada por teste (T-E1).** O PR-1 faz a extração em **dois commits**: (i) congela o trecho original (4849–5580 + 5745–5900) em `test/fixtures/mirror-pipeline-inline.snapshot.txt`; (ii) move o trecho para o módulo. O teste `test/mirror-pipeline-movimentacao.test.js` compara o corpo do módulo com o snapshot **byte a byte**, depois de aplicar uma **lista fechada de substituições declaradas** (ex.: `msg.key.id` → `ids.msgId`, `jid` → `ids.sourceId`, `db.messageLog.create(` → `deps.recordLog(`). Qualquer diferença fora da lista falha. A lista é curta e revisável no PR.
2. **Equivalência de comportamento (T-E4).** `test/mirror-pipeline-equivalencia.test.js`: tabela de ≥ 30 mensagens (texto puro, foto+legenda, cupom, só link de loja não suportada, domínio próprio, Awin aprovada/não aprovada, palavra bloqueada, loja desligada, falha parcial de conversão, link vazado sem `https://`, modelo/relay/rodapé, primeiro/último link, título desalinhado) rodadas pelo módulo com conversores fingidos; a saída (texto final, motivo, **linhas de `MessageLog` com todos os campos**) é comparada a um *golden* gravado **antes** da extração pelo mesmo harness rodando o worker com socket fingido (o repo já monta worker com socket fingido em testes como `test/mirror-duplicate-replay.test.js` — **HIPÓTESE** de que o harness cobre `processIncomingMessage` inteiro; se não cobrir, o golden é gravado pela camada 1 + os testes existentes, e isso é dito no PR).
3. **Testes existentes intocados + observação em staging.** Toda a suíte atual de espelhamento (`mirror-*.test.js`, `delivery-whatsapp-send-inalterado.test.js`, `anti-banimento-*`) passa **sem alteração de teste**. Em staging, 24 h comparando distribuição de `MessageLog.errorMsg`/`status` por hora antes × depois (script `scripts/diag-espelhamento-antes-depois.mjs`, read-only) — SC-001.

**Por que (a) e não (b) "orquestrador duplicado no leitor":** a alternativa (b) — compor os mesmos módulos de `src/core/` num orquestrador novo, sem tocar o worker — teria **zero risco imediato** para o WhatsApp, mas duplicaria ~600 linhas de ordem/regra (leitura de config por grupo, Awin/Rakuten, política, eleição do primário, chave de modelo, janela de repetição). D3 exige "igual ao WhatsApp" de forma permanente; duas cópias divergem na primeira correção de RCA. Como o worker **já precisa** mudar no PR-1 por outros motivos (D4 `options.mirror`, D6 config), a extração não custa reinício extra. (b) fica documentada em research §R2 como recuo, se a camada 1 da prova não fechar.

**Efeito colateral aceito e anunciado:** depois do PR-1, correção no tratamento do Telegram que mexa em `src/core/mirrorPipeline.js` **reinicia o `bot-supervisor`** (está em `src/core/`). É coerente: a regra é a mesma para os dois aplicativos.

### D2. Processo novo `telegram-leitor` (GramJS) — só leitura, fino

- **Biblioteca**: `telegram` (GramJS), research §R1. Login por QR (`auth.exportLoginToken` via `client.signInUserWithQrCode`), sessão em `StringSession` (guardada criptografada, nunca em arquivo), eventos `NewMessage`, `FloodWaitError` com `floodSleepThreshold` baixo, várias contas por processo (um `TelegramClient` por conta, num `Map` do pool).
- **Código**: `src/telegramReader/` (fora de `WORKER_CODE_PATHS_RE` de propósito):
  - `index.js` — entrypoint PM2; pool de contas; heartbeat; servidor HTTP de controle em `127.0.0.1`.
  - `pool.js` — `createReaderPool({ db, clientFactory, env })`: liga/desliga clientes conforme `TelegramAccount.desiredState`, reconexão com recuo, limite de contas por processo.
  - `login.js` — fluxo de QR e senha de duas etapas (senha só em memória, descartada ao concluir).
  - `ingest.js` — filtro de entrada (só origens marcadas, nunca privado, ignora robô e mensagens já vistas), extração de texto + links escondidos, gravação na fila. **Puro** onde der (`decideIngest(message, ctx)`).
  - `errors.js` — classificação (`AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`, `USER_DEACTIVATED(_BAN)`, `FLOOD_WAIT_X`, `CHANNEL_PRIVATE`, rede) → estado + aviso.
  - `media.js` — baixa só a foto da mensagem aceita (≤ 5 MB) para `TELEGRAM_MEDIA_DIR`.
- **Nada de envio**: o módulo nunca importa nem chama `sendMessage`, `sendFile`, `readHistory`/`markAsRead`, `joinChannel`, `leaveChannel`, `deleteMessages`, `updateStatus(online)`. Guarda T-E3 lista as funções proibidas.
- **ecosystem.config.cjs**: dois apps novos, `telegram-leitor` (cwd `~/wabot`) e `telegram-leitor-staging` (cwd `~/wabot-staging`), `script: 'src/telegramReader/index.js'`, `exec_mode: 'fork'`, `instances: 1`, `max_memory_restart` = número medido na Fase 0 + 30% (HIPÓTESE inicial `350M`), `autorestart: true`, `kill_timeout: 10000`. **Não** entram no `pm2 start ecosystem.config.cjs` padrão de produção até o OK de memória: os scripts de deploy só reiniciam o leitor **se ele já estiver no pm2** (`pm2 describe telegram-leitor` ok) — research §R9.
- **Deploy**: `scripts/deploy_safe_dashboard.sh` e `scripts/deploy_safe_staging.sh` ganham `LEITOR_CODE_PATHS_RE` (`src/telegramReader/`, `src/core/`, `src/db.js`, `src/logger.js`, `prisma/schema.prisma`, `package-lock.json`, `src/credentialCrypto.js`) → `pm2 restart telegram-leitor --update-env` só quando bater e só se o app existir. Nunca toca no `bot-supervisor` por causa do leitor. Teste: estender `test/deploy-safe-*.test.js` + novo `test/deploy-leitor-code-paths.test.js` (mesma técnica de import transitivo do `deploy-worker-code-paths`).

### D3. API ↔ leitor sem tocar `protocol.js`: banco + HTTP local

- **Banco (fonte da verdade, assíncrono)**: `TelegramAccount` (estado desejado × estado real, sessão criptografada, contadores), `TelegramInboxMessage` (fila de entrada), `TelegramLeitorHeartbeat` (vida do processo). O leitor relê `TelegramAccount` a cada 30 s e logo após um "cutucão" HTTP.
- **HTTP de controle (síncrono, só `127.0.0.1`)**: `TELEGRAM_LEITOR_PORT` (prod `3021`, staging `3024` — **valores propostos**, registrar em `docs/rca/deploy-e-infra.md`; não são portas públicas e não entram na regra dos 3 lugares, que é do painel/API) + cabeçalho `x-leitor-token` = `TELEGRAM_LEITOR_INTERNAL_TOKEN`. Usado para: iniciar QR, entregar a senha de duas etapas (**nunca passa pelo banco**), listar grupos/canais da conta, desconectar (revogar), cutucar. Contrato: [contracts/leitor-controle-http.md](./contracts/leitor-controle-http.md).
- **Leitor fora do ar**: a API responde "a leitura do Telegram está temporariamente parada" na tela (sem jargão); a fila e o estado continuam no banco.
- **Por que não Redis pub/sub**: staging roda `inline` e o leitor não precisa de Redis para nada; um canal Redis novo seria mais uma peça para falhar e mais uma conexão. Banco + HTTP local cobrem tudo. (Alternativa registrada em research §R4.)

### D4. Tratamento e entrega (FR-015..FR-021)

Passada `src/telegramOrigin/inboxSweep.js` **na API** (`setInterval` 3 s + `unref`, single-flight, ligada só com `TELEGRAM_ORIGIN_ENABLED=1`):

1. Pega **1 mensagem pendente por origem**, a mais antiga (`ORDER BY receivedAt`, `distinct sourceId`) — ordem por origem preservada (FR-019) e uma origem não trava as outras (mesmo desenho da revisão crítica da 017, "caixa de saída pega 1 por grupo").
2. Marca `processing` (com `attempts++`); travada > 2 min ou 3 tentativas → `failed` com motivo e a próxima da origem segue (FR-019).
3. Frescor: `shouldProcessIncomingMessage({ upsertType: 'notify', messageTimestampMs, maxAgeMs: INCOMING_MAX_AGE_MS, lateMaxAgeMs: INCOMING_LATE_MAX_AGE_MS, isMonitoredSource: true, seenBefore: false })` (`src/core/incomingFreshness.js`) — mesma janela do WhatsApp (5 min ao vivo, 60 min tardia para origem monitorada; a unicidade da fila faz o papel de "id já visto").
4. Monta `cfg` com **o mesmo** `buildEntitledGroupConfig` que o worker lê (`src/billing/groupEntitlements.js:83`) e chama `prepareMirrorOffer(...)` com `deps.convertLink` = `src/core/linkCore.js` (o mesmo que a API já usa em `src/api/routes/linkConversion.js`) e `deps.recordLog` gravando `MessageLog` com `sourceGroup='tg:<id>'` e `deliveryNetwork` de origem.
5. Destinos: `resolveMonitorDestinations` (mesmo módulo). Para cada destino:
   - **WhatsApp** → `sendBroadcast(userId, finalText, [destJid], { source: 'telegramMirror', imageUrl, mirror: {...} })` via `src/manager.js` (inline/remote transparente). Se `isRunning(userId)` for falso, grava `MessageLog` com o **mesmo motivo** que a fila usa para WhatsApp desconectado (`src/offerQueue/dispatcher.js:92`) e segue (FR-017, cenário US3.4). ⚠️ `sendBroadcast` **não converte link** (`src/bot-worker.js:6757–6835`): a conversão já aconteceu no passo 4.
   - **Telegram** → `enqueueDeliveryOutbox({ deliveryNetwork:'telegram', destinationId, sourceId:'tg:<origem>', offer: { texto, linkConvertido, imagem, historico:{ loja, linkOriginal, origem }, janelaRepeticaoMs } })` — exatamente o que o worker já faz no hand-off (`src/bot-worker.js:5666–5682`). Ritmo, horário e limite diário do destino já são aplicados pelo `sweep` (FR-018).
6. Marca `done`, apaga o texto da linha (minimização, research §R11).

**Mudança no worker (PR-1), `options.mirror` no broadcast** — ramo aditivo em `src/bot-worker.js:6757`:
- Sem `options.mirror` → **código de hoje, sem mudança** (guarda T-E5).
- Com `options.mirror = { sourceId, platform, originalUrl, convertedUrl, dedupWindowMs, pendingMaxAgeMs }`: antes de criar a linha, roda `findRecentDestinationDuplicate` + `reserveSendDedupKeys` (os mesmos extraídos em D1) e, se duplicata, grava `skip:dedup_recent_link` como o espelhamento faz; senão cria a `MessageLog` com `platform`, `sourceGroup=sourceId`, `originalUrl`, `convertedUrl` preenchidos (em vez de `'broadcast'`/`''`). O job ganha `mirrorSourceJid`, e a **revalidação de destino desvinculado** no dequeue (`src/bot-worker.js:3367`, hoje só `type==='converted'`) passa a valer também para ele.
- Preservação, intervalo entre destinos, horário e aparência do destino (foto/card/marca d'água via `buildBroadcastImageRecipe`, `src/bot-worker.js:2601`) já são aplicados ao broadcast no dequeue — **HIPÓTESE a confirmar nas tarefas** listando todo ramo de `processSendJob` que depende de `job.type` (achados: só métricas em 2472 e revalidação em 3367).

**Foto**: o leitor salva a foto em `TELEGRAM_MEDIA_DIR/<uuid>.jpg`; a API serve em `GET /api/tg-midia/:token` (token aleatório de 128 bits, expira em 6 h, sem listagem) e passa a URL **pública** do ambiente como `imageUrl`. HIPÓTESE: o worker baixa por URL pública sem bloqueio (o caminho `imageUrl` já é usado por filas/ofertas automáticas). Falhou o download → sai só texto, com a redução registrada (mesma regra do Telegram na 017). Para destino Telegram a imagem vai pela mesma URL (`offer.imagem.url`).

### D5. Travas anti-loop (FR-012, FR-020, FR-022, FR-023)

- **(a) Ignorar o robô do Espelha Grupos** — duas camadas:
  1. Por **autor**: a API grava o id do robô (`getMe`, `src/delivery/telegram/api.js:64`) em `TelegramLeitorHeartbeat.botUserId` na partida; o leitor descarta `message.senderId === botUserId` (vale para grupos).
  2. Por **mensagem enviada**: em canais, a publicação do robô aparece **como o canal**, não como o robô (HIPÓTESE forte, a confirmar na Fase 0). Por isso o `sweep` passa a gravar, a cada envio aceito, `DeliveryInboxSeen{ deliveryNetwork:'telegram', sourceId:destinationId, messageId }` — o `adapter.send` já devolve `messageId` (`src/delivery/telegram/adapter.js:218,223`). O leitor descarta mensagem cujo par (chat, id) esteja lá. É o uso que a tabela foi criada para ter (comentário em `schema.prisma`, `DeliveryInboxSeen`).
  3. Somado à trava atual (mesmo grupo não é origem e destino), na prática o robô nunca publica numa origem.
- **(b) Trava de repetição por link entre aplicativos** — já é **por destino** nos dois caminhos: WhatsApp procura em `MessageLog` por `destGroup` + `originalUrl|convertedUrl` (`src/bot-worker.js:5745–5790`); caixa de saída procura por `destGroup` + `convertedUrl` (`src/deliveryOutbox/sweep.js:268–280`). Para valer **entre aplicativos** sem mudar o WhatsApp:
  - TG→WA grava `originalUrl/convertedUrl` (via `options.mirror`, D4), então o WhatsApp→WhatsApp passa a enxergar a oferta que veio do Telegram e vice-versa — **a regra do WhatsApp não muda**, só passa a ter linha para ver.
  - Caixa de saída: a busca passa a casar `originalUrl` **ou** `convertedUrl` (o histórico já grava `linkOriginal`, `src/domain/delivery/history.js`), porque o encurtador pode gerar link convertido diferente para o mesmo produto. ⚠️ `src/deliveryOutbox/` está em `WORKER_CODE_PATHS_RE` (`scripts/deploy_safe_dashboard.sh:357`, regra por **pasta**, não por import) → esta mudança e a gravação de `DeliveryInboxSeen` do item (a).2 entram no **PR-1**. Efeito no que já existe: WhatsApp→Telegram fica um pouco mais estrito (mesmo produto com link encurtado diferente deixa de sair duas vezes no mesmo grupo dentro da janela) — anunciado no PR.
- **(c) Caminho de ida e volta** — FR-022/FR-023:
  - Com a trava atual, um mesmo grupo não pode ser origem e destino (`src/api/routes/groups.js:136–152`). Para o Telegram, a mesma conversa chega por dois caminhos (origem pela conta da cliente, destino pelo robô) → a comparação passa a usar **identificador canônico** (`canonicalDestinationId`, `src/core/delivery/networks.js:214`) e o **mesmo formato de id** nos dois papéis (`tg:-100…`, formato do Bot API — research §R7). Assim "o canal X é destino pelo robô" bloqueia "o canal X como origem pela conta" (e o contrário), com texto leigo.
  - Defesa extra no `PUT /groups/:id/targets` (`groups.js:212–241`): função pura `detectRoundTrip(monitor, posts, existingLinks)` em `src/domain/delivery/routeLoopGuard.js` recusa ligar origem M → destino P quando já existe origem P' (mesma conversa de P) → destino M' (mesma conversa de M). **Honestidade**: com a comparação canônica acima, esse caso fica normalmente inalcançável; a defesa cobre dado antigo gravado em formato diferente. A tela mostra: "Isso faria as ofertas irem e voltarem sem parar entre o WhatsApp e o Telegram."
  - Loops por grupos de terceiros (A→B, alguém copia B para C, C é origem → A) não são detectáveis por configuração; a trava (b) por destino + (a) seguram.

### D6. Config do robô do WhatsApp não carrega origem do Telegram

`buildEntitledGroupConfig` (`src/billing/groupEntitlements.js:83–135`) passaria a origem `tg:` (se o interruptor `DELIVERY_NETWORKS_ENABLED` tiver `telegram` e a conta for Premium) para `groups.monitorJids`, que alimenta `allowedChatJids` e `monitoredSourceCount` no worker (`src/bot-worker.js:581–591`) — e a contagem de origens entra no diagnóstico de "conectado mas cego". PR-1: `monitorJids` passa a conter **só origens de WhatsApp**; `groups.monitor` mantém a origem `tg:` (necessária para a revalidação de destino desvinculado do D4). Teste: `test/group-entitlements-delivery-network-regression.test.js` estendido.

### D7. Segurança e LGPD (FR-003..FR-010, FR-028)

- **Criptografia**: `encryptCredential`/`decryptCredential` de `src/credentialCrypto.js` (AES com `CREDENTIAL_ENCRYPTION_KEY`, mesmo esquema de credenciais de afiliado e do token do Instagram em `src/instagram/oauth/service.js`). A `StringSession` só existe em claro **na memória do leitor**. Sem `CREDENTIAL_ENCRYPTION_KEY` válida (`validateEncryptionKey`) o recurso não liga.
- **Nunca logar**: logger do leitor com `redact` para `session`, `stringSession`, `password`, `authKey`, `encryptedSession`, `qrToken`; GramJS com `client.setLogLevel('none')` (o log da lib imprime dados de conexão). Guarda T-E6: varre `src/telegramReader/`, `src/telegramOrigin/`, rotas e e-mails procurando esses campos em chamadas de log/resposta.
- **Só origens marcadas**: o leitor recebe atualizações de todas as conversas (é como o MTProto funciona — não há como "não receber"); o filtro `decideIngest` descarta **em memória**, antes de qualquer log, tudo que não é origem marcada; chat privado (`isPrivate`) é descartado primeiro. A lista de grupos para escolha vem de `getDialogs` filtrado a `isGroup || isChannel` e **não é gravada** (só a escolha).
- **Nada de "visto"**: sem `markAsRead`; sem `updateStatus` online (HIPÓTESE: conectar via GramJS não marca online sozinho — conferir na Fase 0 olhando a conta de teste de outro aparelho).
- **Consentimento**: `TelegramAccount.consentAcceptedAt` + `consentVersion` (texto versionado em `src/legalTerms.js`). Sem aceite, a rota de conectar responde 409.
- **Desconectar = revogar + apagar**: API → leitor `POST /contas/:id/desconectar` → `auth.logOut` (encerra do lado do Telegram, some de "Dispositivos") → API apaga `TelegramAccount`, origens `Group{deliveryNetwork:'telegram', role:'monitor'}` da conta (cascade `GroupTarget`), `TelegramInboxMessage` e fotos. Leitor fora do ar: a linha fica `desiredState='revogar'` com a sessão ainda cifrada **só para poder revogar**; a tela já mostra "desconectada"; o leitor revoga e apaga ao voltar (research §R10). Mesma rotina na exclusão da conta do Espelha Grupos (FR-028).
- **Uma conta do Telegram por conta do Espelha Grupos (FR-008)**: `telegramUserIdHash` (HMAC-SHA256 do id do usuário do Telegram com chave derivada de `CREDENTIAL_ENCRYPTION_KEY`) `@unique`. Segunda conexão é recusada com texto claro; nunca guardamos o número de telefone.

### D8. Robustez e avisos (FR-025..FR-029)

- **Reconexão**: GramJS reconecta sozinho; o pool vigia `client.connected` e recria com recuo 5 s → 5 min. Ao voltar, **recuperação de lacuna** por origem: `getMessages(origem, { minId: lastMessageId, limit: 20 })` uma vez, e o portão de frescor (D4.3) descarta o que passou da janela (FR-025).
- **Revogada/restrita**: `AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`, `SESSION_EXPIRED` → `status='desconectada'`, apaga a sessão, aviso; `USER_DEACTIVATED`, `USER_DEACTIVATED_BAN`, `PHONE_NUMBER_BANNED` → `status='com_problema'`, para de usar, aviso; `CHANNEL_PRIVATE`/`CHAT_FORBIDDEN` numa origem → `Group` com problema "você saiu deste grupo/canal" (edge case), as outras seguem.
- **FLOOD_WAIT**: `floodSleepThreshold = 0` (nunca dormir escondido dentro da lib); `FloodWaitError.seconds` → `TelegramAccount.floodUntil`; o pool não chama nada daquela conta até lá (US6.3).
- **Limites (FR-013)**: `TELEGRAM_ORIGIN_MAX_PER_ACCOUNT` (default **10**, HIPÓTESE a recalibrar na Fase 0), `TELEGRAM_ORIGIN_ADD_PER_HOUR` (default 5 origens novas/h), `TELEGRAM_LEITOR_MAX_ACCOUNTS` (teto do processo, do número medido), `getDialogs` no máximo 1×/min por conta (cache em memória 60 s).
- **Premium vencido / interruptor / lista**: passada na API a cada 5 min (`canUseMultiNetwork` em `src/billing/plans.js:149` já exige acesso em dia + `TELEGRAM_ORIGIN_ENABLED` + `TELEGRAM_ORIGIN_ALLOWLIST`) → `desiredState='pausada_plano'`; o leitor desconecta o cliente **sem apagar** a sessão; volta sozinho quando regulariza (FR-027).
- **Avisos à cliente**: card na tela Aplicativos + e-mail novo `telegram_conta_desconectada` / `telegram_conta_com_problema` no registro de e-mails (`src/email/registry.js`), 1 por evento, com dedup por dia (SC-008: percebido + avisado ≤ 15 min; o erro chega na próxima chamada/reconexão; o pool faz um "ping" `getMe` a cada 5 min por conta).
- **Avisos à operação**: o leitor grava heartbeat a cada 30 s; `src/telegramOrigin/leitorHealthWatch.js` na API (mesmo padrão de `src/delivery/telegram/healthWatch.js:15`, `decideHealthAlert` de `src/core/delivery/networkHealth.js:96`) → heartbeat > 3 min = "parado", conta com erro em massa = "com problema" → `sendAdminAlert` (`src/email/adminAlerts.js:66`) com e-mail interno novo `admin_leitor_telegram_parado` + card "Leitura do Telegram" no `/admin` (ao lado do card "Robô do Telegram").
- **Diagnóstico (FR-029)**: `scripts/diag-telegram-leitor.mjs [email]` read-only: contas por estado, última leitura, fila por status, descartes por motivo nas últimas 24 h, heartbeat. Nunca imprime sessão.

---

## Project Structure

### Documentation (this feature)

```text
specs/021-telegram-origem-conta-pessoal/
├── spec.md
├── plan.md                         # este arquivo
├── research.md                     # Phase 0
├── data-model.md                   # Phase 1
├── quickstart.md                   # Phase 1 (roteiro de validação)
├── contracts/
│   ├── mirror-pipeline.md          # módulo compartilhado WhatsApp/Telegram
│   ├── leitor-controle-http.md     # API ↔ leitor (127.0.0.1)
│   ├── api-telegram-conta.md       # rotas do painel
│   └── broadcast-mirror-option.md  # campo opcional options.mirror do sendBroadcast
├── checklists/                     # já existe (spec)
└── tasks.md                        # Phase 2 (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── mirrorPipeline.js            # NOVO (PR-1) — estágio de texto extraído do worker
│   ├── mirrorDestinationDedup.js    # NOVO (PR-1) — dedup por destino (MessageLog + SendDedupKey)
├── bot-worker.js                    # PR-1: chama mirrorPipeline/mirrorDestinationDedup; options.mirror; revalidação
├── billing/groupEntitlements.js     # PR-1: monitorJids só WhatsApp
├── telegramReader/                  # NOVO — processo telegram-leitor (fora do WORKER_CODE_PATHS_RE)
│   ├── index.js · pool.js · login.js · ingest.js · errors.js · media.js · controlServer.js
├── telegramOrigin/                  # NOVO — lado da API
│   ├── inboxSweep.js                # tratamento + entrega (D4)
│   ├── accountService.js            # conectar/desconectar/estado/pausa por plano
│   ├── leitorClient.js              # cliente HTTP do controle local
│   ├── leitorHealthWatch.js         # aviso interno
│   └── mediaRoute.js                # GET /api/tg-midia/:token
├── api/routes/telegramConta.js      # NOVO — rotas do painel
├── domain/delivery/routeLoopGuard.js # NOVO (PR-4) — detectRoundTrip (puro; fora de src/core para não reiniciar o supervisor)
├── api/routes/groups.js             # PR-4: trava canônica + ida e volta
├── deliveryOutbox/sweep.js          # PR-1: grava DeliveryInboxSeen do robô + dedup por originalUrl (pasta está no WORKER_CODE_PATHS_RE)
├── email/registry.js                # PR-5: e-mails novos
└── legalTerms.js                    # PR-2: texto do consentimento; PR-6: termos
dashboard/app/painel/aplicativos/    # tela: "Sua conta do Telegram" (QR, senha, origens, desconectar)
dashboard/app/admin/                 # card "Leitura do Telegram"
prisma/schema.prisma + migrations/   # PR-1: 3 tabelas novas
ecosystem.config.cjs                 # PR-2: telegram-leitor, telegram-leitor-staging
scripts/deploy_safe_dashboard.sh, scripts/deploy_safe_staging.sh  # PR-2: LEITOR_CODE_PATHS_RE
scripts/diag-telegram-leitor.mjs     # PR-5
scripts/spike/telegram-leitor-spike.mjs  # PR-0 (roda fora do repo instalado)
test/                                # ver "Testes"
```

**Structure Decision**: segue a estrutura existente (backend `src/`, painel `dashboard/`). Tudo que cai em `WORKER_CODE_PATHS_RE` (`src/core/`, `src/billing/`, `src/deliveryOutbox/`, schema, lockfile) entra no PR-1. Código do leitor em `src/telegramReader/`, do lado da API em `src/telegramOrigin/` — nenhuma das duas pastas pode ser importada pelo worker (guarda T-E2). `routeLoopGuard.js` é puro e usado só pela API: fica em `src/domain/delivery/` (fora de `src/core/`) para não reiniciar o supervisor no PR-4.

---

## Ordem de entrega — Fases 0–5 da spec → PRs

Legenda: 🔁 reinicia o quê · ⛔🔑 validação ao vivo que precisa da conta de teste e de `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` (criados pela dona em my.telegram.org, um registro por ambiente).

| PR | Fase | Conteúdo | 🔁 Staging | 🔁 Produção | ⛔🔑 |
|---|---|---|---|---|---|
| **PR-0** | 0 Validação | `scripts/spike/telegram-leitor-spike.mjs` + README: roda em **pasta separada no VPS** (`~/telegram-spike`, `npm i telegram@<versão>` lá), **sem** entrar no `package.json` do repo. Mede RSS com 0/1/3/5 contas (24 h), latência de `NewMessage` em canal grande e pequeno, se aparece "online"/"visto" na conta de teste, `FLOOD_WAIT` em `getDialogs`, formato de id e autor de post do robô em canal (D5.a.2). Conferência das regras de uso da API do Telegram. | nada (processo avulso `pm2 start ... --name telegram-spike`, parado depois) | nada | ⛔🔑 conta de teste + API_ID/HASH de staging. **Gate**: dona aprova o número de RAM e o resultado das regras de uso. |
| **PR-1** | Núcleo (pré-1..3) | Migration (3 tabelas). Dependência `telegram` fixada. Extração D1 (`mirrorPipeline.js`, `mirrorDestinationDedup.js`) + T-E1/T-E4. `options.mirror` no broadcast + revalidação (D4). `monitorJids` só WhatsApp (D6). `sweep.js`: grava `DeliveryInboxSeen` de cada envio do robô (D5.a.2) e dedup por `originalUrl` (D5.b). Interruptores todos desligados. | API+robôs (staging é `inline`) | **🔴 `bot-supervisor` (reconecta todas as sessões) + `api`** — único reinício, **anunciado** às clientes | SC-001: 24 h em staging comparando espelhamento antes × depois (sem Telegram nenhum) |
| **PR-2** | 1 Conectar conta | `src/telegramReader/` (pool, login QR, senha, revogar, heartbeat, controle HTTP), `src/telegramOrigin/accountService.js`, rotas, consentimento, tela "Sua conta do Telegram", criptografia, apps no `ecosystem.config.cjs`, `LEITOR_CODE_PATHS_RE` nos deploys. | `api-staging` + **start manual** `telegram-leitor-staging` (delete+start) | `api` (leitor de prod **não** é ligado) | ⛔🔑 conectar/desconectar conta de teste, conferir "Dispositivos" no Telegram, senha de duas etapas, QR expirado |
| **PR-3** | 2 Escolher e ler origens | Lista de grupos/canais (sem privados), marcar origem (`Group role='monitor' deliveryNetwork='telegram' waJid='tg:-100…'`), limites, ingestão na fila, trava (a) no leitor (autor + consulta a `DeliveryInboxSeen`, que o `sweep` já grava desde o PR-1), `botUserId` gravado pela API. | api + leitor | api | ⛔🔑 grupo e canal de teste; mensagem em grupo **não** marcado e em privado **não** aparece em lugar nenhum (SC-005) |
| **PR-4** | 3 Tratar e entregar | `inboxSweep.js` (D4), foto (`mediaRoute`), TG→WA via `sendBroadcast`+`options.mirror`, TG→TG via caixa de saída (`enqueueDeliveryOutbox` só é **chamado**, não alterado), trava (c) canônica + `routeLoopGuard` (em `src/domain/`), histórico. | api + leitor | api | ⛔🔑 4 combinações; SC-004 (zero loop com a conta de teste dentro do grupo de destino); SC-003 latência |
| **PR-5** | 4 Robustez | Estados, `FLOOD_WAIT`, revogada/restrita, recuperação de lacuna, pausa por plano, e-mails à cliente, `leitorHealthWatch` + card admin + e-mail interno, `diag-telegram-leitor.mjs`. | api + leitor | api | ⛔🔑 revogar pela conta de teste (Configurações → Dispositivos) e medir SC-008 (≤ 15 min); matar o leitor e ver aviso interno; WhatsApp intacto |
| **PR-6** | 5 Lançamento | Termos de uso (`src/legalTerms.js`), página de preços (Premium), `TELEGRAM_ORIGIN_ALLOWLIST` → todas, RCA em `docs/rca/multicanal.md` (+1 linha no índice/mapa do `AGENTS.md`, sem colar RCA). Reindexação se página pública mudar (regra do `AGENTS.md`). | api + dashboard | api + dashboard + **primeiro `pm2 start telegram-leitor` em prod** (só com o OK de memória da Fase 0) | liberação gradual com 1–3 clientes; SC-010 |

**Regra de ouro da ordem**: depois do PR-1, **nenhum PR desta feature toca caminho de `WORKER_CODE_PATHS_RE`** (`scripts/deploy_safe_dashboard.sh:357`) — em especial `src/bot-worker.js`, `src/core/`, `src/delivery/`, `src/deliveryOutbox/`, `src/billing/`, `src/credential*.js`, `src/jobs/`, `src/events/`, `src/domain/session/`, `prisma/schema.prisma`, `package-lock.json`. Por isso o código novo do lado da API mora em `src/telegramOrigin/`, `src/api/routes/`, `src/domain/delivery/`, `src/email/` e `src/legalTerms.js` (fora da lista). Se um PR posterior precisar, ele vira um **segundo reinício anunciado** e isso é dito no PR. Guarda T-E2 falha se `src/telegramOrigin/` ou `src/telegramReader/` forem importados pelo worker; a revisão de cada PR confere o diff contra `WORKER_CODE_PATHS_RE`.

**Interruptores (todos desligados por padrão; lidos pela API e pelo leitor, nunca pelo worker)**:
`TELEGRAM_ORIGIN_ENABLED` (0/1), `TELEGRAM_ORIGIN_ALLOWLIST` (ids de usuário, vírgula; vazio = ninguém; `*` = todas as Premium), `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (segredos — só `.env` do servidor), `TELEGRAM_LEITOR_PORT`, `TELEGRAM_LEITOR_INTERNAL_TOKEN`, `TELEGRAM_MEDIA_DIR`, `TELEGRAM_ORIGIN_MAX_PER_ACCOUNT`, `TELEGRAM_LEITOR_MAX_ACCOUNTS`. Destino Telegram continua exigindo `DELIVERY_NETWORKS_ENABLED=whatsapp,telegram` (017). Aplicar = `pm2 delete` + `start` (pegadinha #1).

**Rollback**: `TELEGRAM_ORIGIN_ENABLED=0` + delete/start da API e `pm2 stop telegram-leitor` → nada é apagado, as origens do Telegram ficam paradas, WhatsApp intacto. O PR-1 sozinho é inerte (interruptores desligados; `options.mirror` só é enviado pela API do PR-4).

---

## Testes

### Estruturais de guarda (nascem com a feature)

| Id | Arquivo | O que trava |
|---|---|---|
| T-E1 | `test/mirror-pipeline-movimentacao.test.js` | corpo do `mirrorPipeline.js` = snapshot do trecho original do worker, byte a byte, salvo a lista declarada de substituições (FR-016) |
| T-E2 | `test/telegram-origem-fora-do-worker.test.js` | grafo de imports do `bot-worker.js`/supervisor não alcança `src/telegramReader/`, `src/telegramOrigin/`, `telegram` (npm); `TELEGRAM_*` não é lido em arquivo carregado pelo worker |
| T-E3 | `test/telegram-leitor-so-le.test.js` | `src/telegramReader/` não chama `sendMessage`, `sendFile`, `forwardMessages`, `markAsRead`/`readHistory`, `joinChannel`/`ImportChatInvite`, `leaveChannel`, `deleteMessages`, `UpdateStatus` (decisão 2026-10-03) |
| T-E4 | `test/mirror-pipeline-equivalencia.test.js` | tabela ≥ 30 mensagens: saída e linhas de `MessageLog` iguais ao golden |
| T-E5 | `test/broadcast-sem-mirror-inalterado.test.js` | broadcast sem `options.mirror` grava a mesma linha e o mesmo job de hoje |
| T-E6 | `test/telegram-segredo-nunca-vaza.test.js` | sessão/senha/QR/api_hash nunca em log, resposta de rota, e-mail, aviso admin; `redact` presente; GramJS com log `none` (FR-006/SC-006) |
| T-E7 | estender `test/delivery-vocabulario.test.js` e `test/painel-linguagem-leiga.test.js` | tela/e-mail sem token, sessão, MTProto, api_id, chat_id, hash, código de autorização; sem "canal"/"plataforma" como aplicativo |
| T-E8 | `test/delivery-protocolo-intocado.test.js` (existente) | `protocol.js`/`PROTOCOL_VERSION` iguais |
| T-E9 | `test/deploy-leitor-code-paths.test.js` + `test/deploy-worker-code-paths.test.js` (existente) | lista de caminhos do leitor completa; os dois scripts de deploy iguais; leitor nunca reinicia supervisor |
| T-E10 | `test/telegram-privado-nunca-gravado.test.js` | `decideIngest` descarta privado e não marcado **antes** de qualquer log/escrita (SC-005) |

### Puros / com banco fingido

`decideIngest` (robô, privado, não marcado, já visto, tipo de mensagem, links escondidos), `telegramMessageKind`, `classifyTelegramError` → estado, `detectRoundTrip`, `resolveDedupWindows`, ordem por origem e "travada não para a fila" no `inboxSweep`, pausa por plano, limites de origem, consentimento obrigatório, desconectar apaga tudo (SC-007), dedup cruzada WA↔TG por destino (SC-004 dirigido com rede fictícia, padrão `test/delivery-rede-ficticia-e2e.test.js`).

### Gate manual (não substituível)

Itens ⛔🔑 da tabela de PRs + quickstart.md.

---

## Riscos → tratamento técnico

| Risco (spec) | Tratamento |
|---|---|
| Acesso total à conta | D7 inteiro; recomendação de conta dedicada na tela e nos termos |
| Restrição/banimento | só leitura (T-E3), sem entrar em grupos, limites, `floodSleepThreshold=0` + respeito a `floodUntil`, liberação gradual, Fase 0 confere regras |
| Regras de uso do Telegram | Fase 0 com gate da dona; registro próprio em my.telegram.org por ambiente |
| Estabilidade da biblioteca | processo isolado, `max_memory_restart`, heartbeat + aviso; versão fixada |
| Loops | D5 (a, b, c) + trava atual, SC-004 |
| Memória | sinalização + Fase 0 + A1/A2/A3 |
| WhatsApp mudar sem querer | D1 (três camadas de prova), PR-1 único, T-E5 |
| Conversão concorrente (cookie de afiliado rotacionado em dois processos) | A API **já** converte link hoje (`linkConversion.js`, ofertas automáticas) em paralelo ao worker; o RCA de `docs/rca/lojas-conversao.md` mediu que o ML não rotaciona cookie no `createLink`. Risco residual tratado como **HIPÓTESE baixa**; monitorar `skip:no_valid_conversions` das origens do Telegram na liberação gradual |
| Leitor recebe atualização de privado (inevitável no MTProto) | descarte em memória antes de qualquer log (T-E10); dito na tela de consentimento de forma simples ("nunca é lido nem guardado") |

---

## Complexity Tracking

| Violação / complexidade | Por que é necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| Processo PM2 novo (`telegram-leitor`) | FR-014 (isolamento) + D4 da dona (autorizado a medir); biblioteca de terceiro com conexões longas por cliente | A1 (dentro da API) fica como plano B medido, não como padrão |
| Extração de ~700 linhas do worker para `src/core/` | D3 "igual ao WhatsApp" para sempre, sem duas cópias | (b) orquestrador duplicado diverge na primeira correção |
| HTTP local entre API e leitor | senha de duas etapas não pode passar pelo banco; QR precisa de resposta rápida | só banco: a senha ficaria gravada, mesmo que por segundos |

---

## Constitution Check — reavaliação depois do desenho (Phase 1)

Sem mudança de veredito: `protocol.js` intocado (contracts/broadcast-mirror-option.md usa `options`), migration só aditiva (data-model.md), um único reinício anunciado (PR-1), nenhum caminho de worker depois dele, vocabulário e segredo com guardas, memória **condicionada ao gate da Fase 0 e ao OK da dona**. Pendências que **não** são decididas aqui (registradas em research.md §"Em aberto"): número final de RAM/teto de contas, limite de origens por conta, portas internas definitivas, resultado das regras de uso do Telegram.
