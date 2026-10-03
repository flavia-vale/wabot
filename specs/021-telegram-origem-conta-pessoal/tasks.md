---
description: "Tasks — Telegram como origem pela conta pessoal da cliente (feature 021)"
---

# Tasks: Telegram como origem pela conta pessoal da cliente

**Branch**: `021-telegram-origem-plano` | **Entrada**: `specs/021-telegram-origem-conta-pessoal/` (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Organização**: por **ordem de PRs do plano** (PR-0 → PR-6). Cada PR é uma fase; dentro dela, tarefas com histórias `[US1..US7]` da spec. Testes **estão incluídos** porque o plano os exige (T-E1..T-E10 e puros).

## Formato

`- [ ] T### [P?] [US?] Descrição com caminho de arquivo`

- **[P]** = pode rodar em paralelo (arquivos diferentes, sem dependência pendente).
- **⛔🔑** = só fecha com **validação ao vivo**: precisa da conta de teste da dona + `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` do **staging** (já no `.env` do staging; nunca em chat, repo ou log). Quem executa é a dona (ou ela, guiada); o agente prepara tudo antes.
- **(mock)** = roda só com mocks/banco fingido/rede fictícia (`npm test`), sem Telegram real.
- **Histórias**: US1 WhatsApp igual (P1) · US2 conectar conta (P1) · US3 origens → WhatsApp (P1) · US4 Telegram → Telegram (P2) · US5 anti-loop (P1) · US6 queda/revogação/restrição (P2) · US7 lançamento controlado (P3).

## Decisões já aprovadas (2026-10-03, registradas em `plan.md` "Aprovações da dona")

- Aplicativo criado em my.telegram.org; `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` já no `.env` do staging.
- Conta de Telegram de teste disponível para a Fase 0.
- **Limite de 10 origens por conta** (`TELEGRAM_ORIGIN_MAX_PER_ACCOUNT=10`).
- **Portas internas do `telegram-leitor`: 3021 (prod) / 3024 (staging)**, só `127.0.0.1`; documentadas em 3 lugares: `ecosystem.config.cjs`, `docs/rca/deploy-e-infra.md`, `plan.md` D3.
- O **robô do Espelha Grupos publica**; a conta da cliente **só lê** (travado por T-E3).
- **RAM do processo novo = HIPÓTESE** até a medição do PR-0 **e** o OK final da dona com o número medido.

## Regras de ouro (valem em todas as fases)

- Só o **PR-1** toca caminho de `WORKER_CODE_PATHS_RE` (`scripts/deploy_safe_dashboard.sh:357`) e é o **único** que reinicia o `bot-supervisor` (anunciar antes). Do PR-2 em diante, conferir o diff contra essa regex.
- Nenhum `pm2 start telegram-leitor` em **produção** antes do PR-6 e do OK de memória da dona.
- Segredos (sessão, senha, QR, api_hash) nunca em log, resposta, e-mail ou aviso (T-E6).
- Fluxo: feature → `develop` (staging) → validar → `main`. Sem push direto, sem amend em commit mergeado.

---

## PR-0 — Medição isolada (Fase 0) — nada reinicia, nada entra no `package.json` de produção

**Objetivo**: medir RAM real, latência, "online/visto", `FLOOD_WAIT` e autor de post do robô, num processo avulso em pasta separada no VPS (`~/telegram-spike`). **Gate**: a dona aprova o número de RAM e o resultado das regras de uso do Telegram.

**Garantias**: pasta própria no VPS com `package.json` próprio; `package.json`/`package-lock.json` do repo **não mudam**; `pm2 start ... --name telegram-spike` e `pm2 delete` ao fim; nenhum restart de app existente; o spike **só lê** (sem enviar, marcar como lida, entrar ou sair).

- [X] T001 [P] Criar `scripts/spike/README.md`: objetivo, garantias acima, estrutura de arquivos copiados para `~/telegram-spike/` (`spike.mjs`, `package.json`, `canais.txt`, `sessions/`, saídas `memoria.csv`, `latencia.csv`, `eventos.log`), e o aviso "nunca commitar `sessions/` nem `.env`".
- [X] T002 [P] Criar `scripts/spike/package.spike.json` (nome **diferente** de `package.json` para não virar pacote dentro do repo; a dona/agente copia como `~/telegram-spike/package.json`): `type: module`, dependência `telegram` com **versão exata** candidata (a mesma que o PR-1 vai fixar) e `qrcode-terminal`; nada de Prisma (mede o leitor "base" + nota do custo do Prisma em T010). Documentar a versão escolhida em `scripts/spike/README.md`.
- [X] T003 Criar `scripts/spike/telegram-leitor-spike.mjs` (esqueleto + modo `--login`): lê `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` de `~/telegram-spike/.env` (arquivo `chmod 600`, fora do git), cliente GramJS com **log desligado** (`baseLogger` nível `none`), login por **QR no terminal** (`client.signInUserWithQrCode`, pedindo a senha de duas etapas só em memória), grava a sessão em `~/telegram-spike/sessions/<apelido>.session` (`chmod 600`) e imprime só "conectada como <nome>" (nunca telefone, sessão ou hash). Argumento `--conta=<apelido>` para várias contas (0/1/3/5 da medição; com uma só conta de teste, abrir múltiplas sessões é opcional — ver T016).
- [X] T004 Em `scripts/spike/telegram-leitor-spike.mjs`, modo `--listar`: listar **só grupos e canais** (descartando privados e bots) com número da linha, nome e tipo, para a dona escolher; gravar a escolha em `~/telegram-spike/canais.txt` (um id por linha). Não chamar `joinChannel`, `ImportChatInvite`, `leaveChannel` (a conta só entra em canais pelo aplicativo Telegram, à mão, pela dona).
- [X] T005 Em `scripts/spike/telegram-leitor-spike.mjs`, modo `--ler` (padrão do PM2): conectar as sessões de `sessions/`, ouvir `NewMessage` **apenas** dos ids de `canais.txt`; mensagem de qualquer outro chat (inclusive privado) é descartada **antes** de qualquer log; guardar em `eventos.log` só `{hora, canalId, tipo, tamanhoTexto}` (nunca o texto). Sem `markAsRead`, sem `UpdateStatus`, sem envio. Aviso no topo do arquivo: "só leitura".
- [X] T006 [P] Em `scripts/spike/telegram-leitor-spike.mjs`, coletor de memória: a cada 5 min anexar linha em `~/telegram-spike/memoria.csv` com colunas `iso,contas,canais,rss_mb,heap_mb,external_mb,swap_mb` (`process.memoryUsage()` + leitura de `/proc/meminfo` para swap). Flag `--rotulo=<texto>` (ex.: `repouso`, `5canais`, `3contas-24h`) para marcar a etapa; comando `kill -USR2` ou arquivo `~/telegram-spike/ROTULO` para trocar o rótulo sem reiniciar.
- [X] T007 [P] Em `scripts/spike/telegram-leitor-spike.mjs`, medidor de latência: para cada `NewMessage`, gravar em `~/telegram-spike/latencia.csv` `iso,canalId,tamanhoCanal,msg_date,recebido_em,atraso_ms` (diferença entre o horário da mensagem no Telegram e o recebimento); `tamanhoCanal` = número de membros (grande × pequeno).
- [X] T008 [P] Em `scripts/spike/telegram-leitor-spike.mjs`, registrar `FLOOD_WAIT`: capturar o erro de `getDialogs`/chamadas, gravar `{hora, operacao, segundos}` em `eventos.log`, **respeitar a espera** (`floodSleepThreshold: 0` e não repetir antes do prazo). Rodar `--listar` 3 vezes seguidas, espaçadas, para ver se aparece.
- [X] T009 [P] Em `scripts/spike/telegram-leitor-spike.mjs`, modo `--autor-do-robo` (decide D5.a.2): para mensagens do canal "destino-tg" de teste, gravar em `eventos.log` o tipo do remetente (`fromId`/`peerId`/`post_author`/`senderId`: **só a forma**, ex.: "autor=canal", "autor=usuário 123…456 (truncado)") para saber se uma publicação do robô aparece com o robô ou com o canal como autor.
- [X] T010 [P] Em `scripts/spike/telegram-leitor-spike.mjs`, comando `--custo-prisma`: carregar `@prisma/client` (se instalado no `~/telegram-spike`) e medir o RSS antes/depois — responde se A2 (leitor sem Prisma) vale a pena. Se Prisma não estiver instalado, imprimir "não medido" (não é bloqueio).
- [X] T011 Criar `scripts/spike/resumir-medicao.mjs`: lê `memoria.csv`, `latencia.csv`, `eventos.log` e imprime `RESULTADO.md` no **formato de T013** (RSS base, incremento por conta/canal, RSS máximo e crescimento em 24 h, latência mediana/p95 por tamanho de canal, contagem de `FLOOD_WAIT`, autor do robô), sem ids reais nem textos.
- [X] T012 [P] Criar `test/spike-resumir-medicao.test.js` (mock): entrada fictícia de `memoria.csv`/`latencia.csv` → `resumir-medicao.mjs` calcula RSS máximo, incremento por conta, mediana e p95 corretamente e **não** imprime ids nem texto.
- [X] T013 [P] Criar `scripts/spike/RESULTADO-MODELO.md` — o **formato do resultado que a dona me devolve** (um bloco para copiar e colar, curto):
  ```
  RESULTADO FASE 0 — <data>
  1. RAM em repouso (0 canais, 1 conta):      ___ MB
  2. RAM com 5 canais (1 conta):              ___ MB
  3. RAM com 10 canais (1 conta):             ___ MB
  4. RAM máxima em 24 h (3 contas, se feito): ___ MB   | cresceu ao longo do dia? sim/não
  5. Swap do servidor mudou? sim/não (valor antes/depois)
  6. Atraso da mensagem (mediana / p95): canal grande ___ s / ___ s · grupo pequeno ___ s / ___ s
  7. A conta de teste apareceu "online" para outras pessoas? sim/não
  8. As mensagens do canal ficaram "vistas" (visualizações subiram)? sim/não
  9. Apareceu pedido de espera do Telegram (FLOOD_WAIT)? sim/não (quantos, quantos segundos)
  10. Publicação do robô no canal de teste: autor aparece como canal / robô / outro: ___
  11. Regras de uso da API do Telegram: li core.telegram.org/api/terms e o uso (só leitura, conta da própria cliente) está ok? sim/não/dúvida: ___
  12. Algum aviso do Telegram na conta de teste (e-mail/SMS/aviso de login)? sim/não
  ```
- [X] T014 Criar `scripts/spike/PASSO-A-PASSO-DONA.md` — **passo a passo leigo** (frases curtas, um comando por passo, com "o que você deve ver"), cobrindo, no VPS de **staging**: (1) criar a pasta `mkdir -p ~/telegram-spike/sessions` e copiar os arquivos de `~/wabot-staging/scripts/spike/` (`cp`), renomeando `package.spike.json` → `package.json`; (2) `cd ~/telegram-spike && npm install` (só ali; não mexe no `~/wabot-staging`); (3) criar `.env` com as duas chaves **sem imprimir** (o comando usa `read -s`/editor; avisa "não cole as chaves no chat"); (4) **login por QR** com a conta de teste: `node telegram-leitor-spike.mjs --login --conta=teste`, abrir o Telegram no celular → Configurações → Dispositivos → Ler QR; senha de duas etapas se houver; (5) **entrar/ler alguns canais**: pelo próprio aplicativo Telegram entrar em 1 canal grande público e 1 grupo pequeno e, depois, `--listar` para escolher (começar com 1 canal, depois 5, depois 10); (6) **medir RAM em repouso**: `pm2 start telegram-leitor-spike.mjs --name telegram-spike -- --ler --rotulo=repouso` com `canais.txt` vazio, esperar 30 min; trocar o rótulo e repetir com 1, 5 e 10 canais (≥ 2 h cada; deixar 24 h na última etapa); atalho para ver o RSS na hora: `pm2 jlist` filtrado (comando de uma linha pronto no arquivo); (7) conferir **online/visto** pelo celular de outra pessoa/conta (2 perguntas sim/não); (8) publicar uma mensagem no "destino-tg" pelo robô do staging e anotar o autor; (9) encerrar: `pm2 delete telegram-spike` (o único pm2 que ela roda), apagar a sessão com Configurações → Dispositivos → Encerrar sessão; (10) gerar o resultado: `node resumir-medicao.mjs` e copiar o bloco no formato de `RESULTADO-MODELO.md`. Incluir "o que NÃO fazer": não rodar `pm2 restart`/`pm2 delete` de outros apps, não ligar em produção, não colar chaves ou arquivo `.session` no chat.
- [X] T015 [P] Criar `test/spike-fora-do-package.test.js` (mock): garante que `package.json` e `package-lock.json` do repo **não** têm a dependência `telegram`, que nada em `src/` ou `dashboard/` importa `scripts/spike/`, e que `scripts/spike/package.spike.json` existe com versão **exata** (sem `^`/`~`).
- [ ] T016 ⛔🔑 [US2] Dona executa `scripts/spike/PASSO-A-PASSO-DONA.md` no **staging** com a conta de teste (login por QR, 1 → 5 → 10 canais, RSS em repouso e por canal, 24 h na etapa final; etapas "3 e 5 contas" só se houver mais contas de teste, senão registrar "1 conta; incremento por conta extrapolado — HIPÓTESE").
- [ ] T017 ⛔🔑 [US2] Dona confere as regras de uso da API do Telegram (core.telegram.org/api/terms e a política do my.telegram.org) para o uso "só leitura, na conta da própria cliente, com consentimento" e marca o item 11 do resultado.
- [ ] T018 ⛔🔑 [US2] **GATE PR-0**: a dona devolve o bloco de `RESULTADO-MODELO.md`; o agente registra o resultado em `docs/rca/memoria-e-capacidade.md` (seção nova "Telegram leitor — medição Fase 0"), atualiza `specs/021-telegram-origem-conta-pessoal/research.md` ("Em aberto": RAM real e `TELEGRAM_LEITOR_MAX_ACCOUNTS`, processo separado × plano B A1, autor do robô) e `plan.md` (sinalização de memória: trocar HIPÓTESE pelo número medido). **Só avança para o PR-1 com o OK explícito da dona sobre o número de RAM e as regras de uso.** Se o número não for aprovado → decidir A1/A2/A3 do plan.md antes do PR-2 (o PR-1 não depende disso).

**Checkpoint PR-0**: número de RAM medido e aprovado; D5.a.2 confirmada (autor do robô); regras de uso conferidas.

---

## PR-1 — Núcleo (Fases pré-1..3 da spec) — ÚNICO PR que reinicia o `bot-supervisor`

**Objetivo (US1)**: extrair o tratamento do WhatsApp sem mudar nada, migration aditiva, `options.mirror`, interruptores desligados. Quem usa só WhatsApp **não percebe nada**. 🔁 Staging: API+robôs (modo `inline`). 🔁 Produção: **`bot-supervisor` (reconecta todas as sessões) + `api` — anunciar antes às clientes**. Todas as tarefas abaixo são **mock** salvo a última.

### Congelar o "antes" (commit 1 — antes de mover qualquer linha)

- [ ] T019 [US1] Registrar o estado atual do harness: avaliar se `test/mirror-duplicate-replay.test.js` monta `processIncomingMessage` inteiro com socket fingido; escrever a conclusão (cobre / não cobre) no topo de `test/mirror-pipeline-equivalencia.test.js` e, se não cobrir, no corpo da PR (plan.md D1 camada 2).
- [ ] T020 [US1] Congelar o trecho original de `src/bot-worker.js` (linhas 4849–5580 e 5745–5900 do `HEAD`) em `test/fixtures/mirror-pipeline-inline.snapshot.txt` (commit próprio, sem outra mudança).
- [ ] T021 [US1] Criar a tabela de ≥ 30 mensagens e gravar o **golden** do comportamento atual (texto final, motivo, linhas de `MessageLog` com todos os campos) em `test/fixtures/mirror-pipeline-golden.json`, rodando o worker atual com socket e conversores fingidos (casos: texto puro, foto+legenda, cupom, loja não suportada, domínio próprio, Awin aprovada/não aprovada, palavra bloqueada, loja desligada, falha parcial de conversão, link sem `https://`, modelo/relay/rodapé, primeiro/último link, título desalinhado) — `test/mirror-pipeline-equivalencia.test.js` (parte "grava golden").

### Banco e dependência

- [ ] T022 [P] [US1] Adicionar ao `prisma/schema.prisma` os modelos `TelegramAccount`, `TelegramInboxMessage`, `TelegramLeitorHeartbeat` conforme `data-model.md` §1 e criar a migration **só aditiva** em `prisma/migrations/<timestamp>_telegram_origem_conta/migration.sql`.
- [ ] T023 [P] [US1] Teste de migration/estrutura em `test/telegram-origem-schema.test.js` (mock): os 3 modelos existem, campos/índices de `data-model.md` §1, nenhuma tabela existente alterada, `TelegramAccount.userId` único e `telegramUserId` único (FR-008).
- [ ] T024 [US1] Fixar a dependência `telegram` (versão **exata** do PR-0, T002) em `package.json` e atualizar `package-lock.json`.

### Extração do estágio de texto (commit 2 — mover sem editar)

- [ ] T025 [US1] Criar `src/core/mirrorPipeline.js` com `prepareMirrorOffer(input, deps)` movendo o trecho congelado conforme `contracts/mirror-pipeline.md` e a tabela de linhas de plan.md D1 (compartilhado: texto grande, palavras bloqueadas, Awin/Rakuten, domínio próprio, convites, política de encaminhamento com `deps.messageKindFor`, lojas permitidas, conversão por loja, avisos, `decideMirrorConversions`, eleição do primário, modelo, texto adicional, título desalinhado); só substituições da lista fechada.
- [ ] T026 [US1] Criar `src/core/mirrorDestinationDedup.js` com `findRecentDestinationDuplicate` e `reserveSendDedupKeys` (trechos 5745–5790 e 5817–~5900) e a função pura `resolveDedupWindows` (5630–5643), conforme `contracts/mirror-pipeline.md`.
- [ ] T027 [US1] Fazer `processIncomingMessage` em `src/bot-worker.js` chamar `prepareMirrorOffer`, `findRecentDestinationDuplicate`, `reserveSendDedupKeys` (injetando `recordLog`, `convertLink`, `messageKindFor`); o que "fica no worker" (extração do proto, mídia, dedup em arquivo, Instagram, hand-off, envio) não muda.
- [ ] T028 [P] [US1] `test/mirror-pipeline-movimentacao.test.js` (T-E1, mock): corpo de `mirrorPipeline.js` = snapshot byte a byte, salvo a lista declarada de substituições (FR-016).
- [ ] T029 [P] [US1] `test/mirror-pipeline-equivalencia.test.js` (T-E4, mock): rodar a tabela de ≥ 30 mensagens pelo módulo e comparar com `mirror-pipeline-golden.json`.

### Mudanças restantes do worker/entrega

- [ ] T030 [US1] `src/bot-worker.js` (ramo `msg.type === 'broadcast'`, ~l.6757): aceitar `options.mirror` opcional e fazer a **revalidação** na hora do envio (destino ainda ligado, origem ainda marcada, WhatsApp conectado), conforme `contracts/broadcast-mirror-option.md`; sem `options.mirror` o comportamento é idêntico ao atual.
- [ ] T031 [P] [US1] `test/broadcast-sem-mirror-inalterado.test.js` (T-E5, mock): broadcast sem `options.mirror` grava a mesma linha e o mesmo job de hoje; com `options.mirror` revalida e descarta com motivo quando a origem/destino saiu.
- [ ] T032 [US1] `src/billing/groupEntitlements.js`: `monitorJids` considera **só origens do WhatsApp** (D6) — config do robô do WhatsApp não carrega origem do Telegram.
- [ ] T033 [P] [US1] `test/telegram-origem-config-worker.test.js` (mock): grupo `role='monitor' deliveryNetwork='telegram' waJid='tg:-100…'` nunca entra em `monitorJids` nem na config do worker.
- [ ] T034 [US5] `src/deliveryOutbox/sweep.js`: gravar `DeliveryInboxSeen` para **cada envio do robô** ao Telegram (trava (a), D5.a.2) e dedup por `originalUrl` entre aplicativos (trava (b), D5.b); sem mudar o contrato do outbox.
- [ ] T035 [P] [US5] `test/delivery-outbox-inbox-seen.test.js` (mock): envio do robô grava `DeliveryInboxSeen`; link já entregue ao destino não é reenviado vindo de outro aplicativo.
- [ ] T036 [P] [US1] `src/telegramOrigin/config.js`: leitura única e validada das variáveis `TELEGRAM_ORIGIN_ENABLED` (padrão 0), `TELEGRAM_ORIGIN_ALLOWLIST`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_LEITOR_PORT`, `TELEGRAM_LEITOR_INTERNAL_TOKEN`, `TELEGRAM_MEDIA_DIR`, `TELEGRAM_ORIGIN_MAX_PER_ACCOUNT` (padrão **10**), `TELEGRAM_LEITOR_MAX_ACCOUNTS`; **todos desligados por padrão**; nunca importado pelo worker.

### Guardas estruturais e prova

- [ ] T037 [P] [US1] `test/telegram-origem-fora-do-worker.test.js` (T-E2, mock): grafo de imports de `src/bot-worker.js` e do supervisor não alcança `src/telegramReader/`, `src/telegramOrigin/` nem `telegram` (npm); `TELEGRAM_*` não é lido em arquivo carregado pelo worker.
- [ ] T038 [P] [US1] Rodar `test/delivery-protocolo-intocado.test.js` (T-E8) e a suíte atual de espelhamento (`test/mirror-*.test.js`, `test/delivery-whatsapp-send-inalterado.test.js`, `test/anti-banimento-*`) **sem alterar nenhum teste existente**; registrar o resultado na PR.
- [ ] T039 [P] [US1] `scripts/diag-espelhamento-antes-depois.mjs` (read-only): compara a distribuição de `MessageLog.status`/`errorMsg` por hora antes × depois de um instante `--corte=ISO`, `--horas=24`, imprime veredito.
- [ ] T040 [US1] Documentar o PR-1 na descrição da PR: lista de arquivos de `WORKER_CODE_PATHS_RE` tocados, aviso "reinicia `bot-supervisor` em prod", texto do anúncio às clientes, e a nota "correção futura em `src/core/mirrorPipeline.js` também reinicia o supervisor" (D1, efeito aceito).
- [ ] T041 ⛔ [US1] **SC-001 (sem 🔑: não usa Telegram)**: após o deploy automático em staging, publicar 10 ofertas variadas em "origem-wa" (quickstart.md §2) e 24 h depois rodar `node scripts/diag-espelhamento-antes-depois.mjs --horas=24 --corte=<instante do deploy>`; veredito "sem diferença relevante" é o gate para abrir o PR `develop → main`.

**Checkpoint PR-1**: WhatsApp idêntico (T-E1, T-E4, T-E5 verdes + 24 h em staging); feature inerte (interruptores em 0).

---

## PR-2 — Conectar a conta (Fase 1, US2) — API + leitor novo, **sem** reiniciar supervisor

🔁 Staging: `api-staging` + **start manual** `telegram-leitor-staging` (`pm2 delete` + `start`). 🔁 Produção: só `api` (leitor de prod **não** é ligado).

**Teste independente**: conectar/desconectar a conta de teste; "Dispositivos" no Telegram mostra/some a sessão; senha de duas etapas; QR expirado.

### Leitor (processo `telegram-leitor`) — só leitura

- [ ] T042 [P] [US2] `src/telegramReader/errors.js`: `classifyTelegramError` → estado interno (`revogada`, `restrita`, `banida`, `senha_incorreta`, `qr_expirado`, `ja_usada_em_outra_conta`, `espera` com `retryAfterSec`) — puro.
- [ ] T043 [P] [US2] `src/telegramReader/login.js`: login por QR, senha de duas etapas **só em memória** (nunca em banco/log), expiração de `loginId`, cancelamento descarta sessão parcial (contrato `contracts/leitor-controle-http.md`).
- [ ] T044 [US2] `src/telegramReader/pool.js`: `createReaderPool({ db, clientFactory, env })` — liga/desliga clientes conforme `TelegramAccount.desiredState`, relê o banco a cada 30 s e após "cutucão", reconexão com recuo, limite `TELEGRAM_LEITOR_MAX_ACCOUNTS`, `floodSleepThreshold: 0` e respeito a `floodUntil`, log do GramJS desligado; sessão criptografada com `src/credentialCrypto.js` (FR-005); mesma fábrica serve ao plano B A1.
- [ ] T045 [US2] `src/telegramReader/controlServer.js`: HTTP em `127.0.0.1:${TELEGRAM_LEITOR_PORT}` com `x-leitor-token`; rotas `POST /login`, `GET /login/:loginId`, `POST /login/:loginId/senha`, `DELETE /login/:loginId`, `POST /contas/:accountId/desconectar` (`auth.logOut`, FR-007), `POST /cutucar`, `GET /saude` — conforme o contrato; respostas sem sessão/senha/telefone/api_hash.
- [ ] T046 [US2] `src/telegramReader/index.js`: entrada do processo (carrega `src/telegramOrigin/config.js`, sobe pool e controlServer, grava `TelegramLeitorHeartbeat` a cada 30 s com `instanceId` e RSS, `SIGTERM` limpo).

### Lado da API

- [ ] T047 [P] [US2] `src/telegramOrigin/leitorClient.js`: cliente HTTP do controle local com timeouts (10 s QR/senha, 20 s lista); leitor fora do ar → erro tipado traduzido para "a leitura do Telegram está parada no momento".
- [ ] T048 [US2] `src/telegramOrigin/accountService.js`: conectar/desconectar/estado, consentimento (`consentAcceptedAt` + `consentVersion`, FR-003), uma conta do Telegram só em uma conta do Espelha Grupos (FR-008), apagar tudo ao desconectar e ao excluir a conta do Espelha Grupos (FR-007/FR-028; `desiredState='revogar'` se a revogação falhar).
- [ ] T049 [US2] `src/api/routes/telegramConta.js`: `GET /`, `POST /consentimento`, `POST /conectar`, `GET /conectar/:loginId`, `POST /conectar/:loginId/senha` (corpo nunca logado: `redact`), `POST /desconectar`, com `requireTelegramOrigin(user)` (flag + allowlist + `canUseMultiNetwork`) e 404 fora da liberação; registrar a rota no bootstrap da API.
- [ ] T050 [P] [US2] `src/legalTerms.js`: texto do consentimento (o que é lido; o que nunca é lido; a conta nunca publica; como desconectar; risco de restrição; recomendação de conta dedicada) com `consentimentoVersao`.

### Painel

- [ ] T051 [US2] `dashboard/app/painel/aplicativos/SuaContaTelegram.js` + integração em `dashboard/app/painel/aplicativos/AppsPanel.js`: card "Sua conta do Telegram" (consentimento, QR, senha de duas etapas, estado, desconectar), cadeado/aviso Premium padrão, design system v2, vocabulário leigo (sem token/sessão/MTProto/api_id/hash/código).

### Infra e deploy

- [ ] T052 [P] [US2] `ecosystem.config.cjs`: apps `telegram-leitor` (porta **3021**) e `telegram-leitor-staging` (porta **3024**) com `max_memory_restart` (valor definido pelo número medido no PR-0) — e **comentário com a porta**.
- [ ] T053 [P] [US2] `docs/rca/deploy-e-infra.md`: registrar as portas internas 3021/3024 (aprovadas em 2026-10-03), `TELEGRAM_*` no `.env` mínimo do servidor, `pm2 delete`+`start` para aplicar env, e que o leitor não entra na regra dos 3 lugares de portas do painel/API.
- [ ] T054 [P] [US2] `scripts/deploy_safe_dashboard.sh` e `scripts/deploy_safe_staging.sh`: criar `LEITOR_CODE_PATHS_RE` (`src/telegramReader/`, `src/telegramOrigin/leitor*`, etc.) para reiniciar **só** o leitor quando só ele mudar; nunca o supervisor.
- [ ] T055 [P] [US2] `src/ops/stagingPower.js`: incluir `telegram-leitor-staging` em `STAGING_PM2_APPS` (desliga junto com o staging).

### Testes (mock)

- [ ] T056 [P] [US2] `test/telegram-leitor-so-le.test.js` (T-E3): `src/telegramReader/` não chama `sendMessage`, `sendFile`, `forwardMessages`, `markAsRead`/`readHistory`, `joinChannel`/`ImportChatInvite`, `leaveChannel`, `deleteMessages`, `UpdateStatus`.
- [ ] T057 [P] [US2] `test/telegram-segredo-nunca-vaza.test.js` (T-E6): sessão/senha/QR/api_hash nunca em log, resposta de rota, e-mail, aviso admin; `redact` presente; GramJS com log `none`.
- [ ] T058 [P] [US2] Estender `test/delivery-vocabulario.test.js` e `test/painel-linguagem-leiga.test.js` (T-E7): telas e e-mails sem os termos proibidos.
- [ ] T059 [P] [US2] `test/deploy-leitor-code-paths.test.js` (T-E9) + ajuste de `test/deploy-worker-code-paths.test.js`: lista do leitor completa, os dois scripts de deploy iguais, leitor nunca reinicia supervisor.
- [ ] T060 [P] [US2] `test/telegram-conta-service.test.js`: consentimento obrigatório (409 sem ele), uma conta do Telegram em duas contas do Espelha → recusa, desconectar apaga tudo (SC-007), pausa/retomada, `classifyTelegramError` → estado.
- [ ] T061 [P] [US2] `test/telegram-conta-rotas.test.js`: 404 fora da allowlist, 403 `FEATURE_REQUIRES_PREMIUM` sem Premium, nenhuma resposta com segredo/telefone/id numérico.

### Validação ao vivo

- [ ] T062 ⛔🔑 [US2] No staging: `pm2 delete`+`start` de `api-staging` e `telegram-leitor-staging` com `TELEGRAM_ORIGIN_ENABLED=1` e allowlist só da conta de teste; conectar a conta de teste por QR, ver a sessão em Configurações → Dispositivos, testar conta com senha de duas etapas, QR expirado, **desconectar** (a sessão some do Telegram e as origens/fila somem do banco) — quickstart.md §3.
- [ ] T063 ⛔🔑 [US2] Medir o RSS real do `telegram-leitor-staging` com 1 conta e comparar com o número do PR-0 (T018); registrar em `docs/rca/memoria-e-capacidade.md`.

**Checkpoint PR-2**: conta de teste conecta e desconecta de verdade; nada de segredo vaza; leitor não reinicia supervisor.

---

## PR-3 — Escolher e ler origens (Fase 2, US3 parte 1 + US5 trava "a")

🔁 Staging: api + leitor. 🔁 Produção: api. **Teste independente**: mensagem em grupo marcado chega na fila; em grupo não marcado e em privado não aparece em lugar nenhum (SC-005).

- [ ] T064 [P] [US3] `src/telegramReader/ingest.js`: `decideIngest` puro — descarta **antes de qualquer log/escrita** privado, não marcado, mensagem do robô (autor = `botUserId` ou presente em `DeliveryInboxSeen`), já visto, tipo de mensagem sem texto útil; calcula `telegramMessageKind`; normaliza texto com links escondidos (entidades `TextUrl`) em URL visível; grava em `TelegramInboxMessage` com `receivedAt`/`sourceId`.
- [ ] T065 [US3] Ligar `ingest.js` ao pool em `src/telegramReader/pool.js` (handler `NewMessage`, ritmo de consultas e limite por conta; recuperação de lacuna fica para o PR-5).
- [ ] T066 [P] [US3] `src/telegramReader/media.js`: baixar foto da oferta para `TELEGRAM_MEDIA_DIR` (≤ 5 MB, TTL 6 h, faxina) — só leitura (download), nome com token de 128 bits.
- [ ] T067 [US3] `src/telegramReader/controlServer.js`: rota `GET /contas/:accountId/conversas` (só grupos e canais, cache 60 s, 429 `espera`, 409 `nao_conectada`).
- [ ] T068 [US3] `src/api/routes/telegramConta.js`: `GET /conversas` (com `jaEhOrigem`/`jaEhDestino`), `POST /origens` (cria `Group role='monitor' deliveryNetwork='telegram' waJid='tg:-100…'`, **limite de 10 por conta** via `TELEGRAM_ORIGIN_MAX_PER_ACCOUNT`, recusas com motivo, `reloadWorkerConfig`), `DELETE /origens/:groupId`.
- [ ] T069 [US3] `src/telegramOrigin/accountService.js`: gravar `botUserId` (id do robô nos destinos do Telegram) para a trava "a".
- [ ] T070 [US3] `src/api/routes/groups.js`: `POST /` continua recusando `tg:` digitado à mão (origem do Telegram só por `POST /origens`).
- [ ] T071 [US3] `dashboard/app/painel/aplicativos/SuaContaTelegram.js`: lista de conversas, marcar/desmarcar origens, contador "X de 10", bloqueio quando a conversa já é destino (FR-023), configurações da origem pelas telas existentes (FR-024).
- [ ] T072 [P] [US3] `test/telegram-decide-ingest.test.js` (mock): robô, privado, não marcado, já visto, tipo de mensagem, links escondidos.
- [ ] T073 [P] [US3] `test/telegram-privado-nunca-gravado.test.js` (T-E10, mock): `decideIngest` descarta privado e não marcado **antes** de qualquer log/escrita (SC-005).
- [ ] T074 [P] [US3] `test/telegram-origens-limites.test.js` (mock): 10 por conta (11ª recusada com motivo leigo), só grupos/canais, origem duplicada, grupo que já é destino.
- [ ] T075 ⛔🔑 [US3] Staging: marcar um grupo e um canal de teste como origem; postar neles e conferir que a mensagem chega à fila (`TelegramInboxMessage`); postar em grupo **não marcado** e em conversa privada e conferir que **não aparecem** em tabela, log nem painel (SC-005) — quickstart.md §4.
- [ ] T076 ⛔🔑 [US3] Confirmar no staging, com o resultado de D5.a.2 do PR-0, que mensagens publicadas pelo robô num destino-canal que também seja lido **não** entram na fila (trava "a").

**Checkpoint PR-3**: só as origens marcadas são lidas; privado nunca é tocado.

---

## PR-4 — Tratar e entregar (Fase 3, US3 + US4 + US5)

🔁 Staging: api + leitor. 🔁 Produção: api. **Teste independente**: as 4 combinações (WA→WA já existe; TG→WA, TG→TG, WA→TG) entregam; zero loop (SC-004).

- [ ] T077 [US3] `src/telegramOrigin/inboxSweep.js`: passada na API (`setInterval` 3 s + `unref`, single-flight, só com `TELEGRAM_ORIGIN_ENABLED=1`): 1 mensagem pendente por origem, a mais antiga; `processing` com `attempts++`; travada > 2 min ou 3 tentativas → `failed` com motivo e a origem segue (FR-019); chama `prepareMirrorOffer` (frescor com `shouldProcessIncomingMessage`, `upsertType='notify'`); descarte grava `MessageLog` com motivo (FR-021).
- [ ] T078 [US3] `src/telegramOrigin/inboxSweep.js`: entrega **TG→WA** por `sendBroadcast` com `options.mirror` (só com WhatsApp da cliente conectado; ritmo, intervalo entre destinos e horário de hoje — FR-017).
- [ ] T079 [US4] `src/telegramOrigin/inboxSweep.js`: entrega **TG→TG** via `enqueueDeliveryOutbox` (apenas **chamado**, não alterado) com regras de ritmo/horário/limite diário já aplicadas ao Telegram (FR-018); o **robô** publica.
- [ ] T080 [US3] `src/telegramOrigin/mediaRoute.js` + registro de `GET /api/tg-midia/:token` (sem autenticação, token 128 bits, `image/jpeg`, 404 expirada, `Cache-Control: private, max-age=3600`).
- [ ] T081 [US5] `src/domain/delivery/routeLoopGuard.js`: `detectRoundTrip` puro (A→B e B→A entre aplicativos), **fora de `src/core/`**.
- [ ] T082 [US5] `src/api/routes/groups.js`: trava canônica (`canonicalDestinationId`) na regra "mesmo grupo origem e destino" e `PUT /:id/targets` com `detectRoundTrip` → 400 `CAMINHO_IDA_E_VOLTA` com mensagem leiga (FR-022/FR-023).
- [ ] T083 [US3] Ligar o `inboxSweep` ao bootstrap da API (`src/api/` — arquivo de inicialização, guardado pela flag) e ao histórico (`MessageLog` com aplicativo de origem exibido nas telas existentes).
- [ ] T084 [US5] `dashboard/app/painel/aplicativos/SuaContaTelegram.js` (ou tela de destinos existente): mostrar a explicação leiga quando o caminho de ida e volta for bloqueado.
- [ ] T085 [P] [US3] `test/telegram-inbox-sweep.test.js` (mock): ordem por origem, "travada não para a fila", 3 tentativas → `failed`, descarte por motivo gravado, mesma mensagem reentregue = 1 espelhamento (FR-019).
- [ ] T086 [P] [US5] `test/route-loop-guard.test.js` (mock): `detectRoundTrip` e trava canônica `tg:-100…`.
- [ ] T087 [P] [US5] `test/telegram-dedup-cruzada-e2e.test.js` (mock, rede fictícia — padrão de `test/delivery-rede-ficticia-e2e.test.js`): oferta entregue a um destino não volta a ele vinda de outro aplicativo (SC-004 dirigido).
- [ ] T088 [P] [US3] `test/telegram-media-route.test.js` (mock): token inválido/expirado → 404, sem listagem.
- [ ] T089 ⛔🔑 [US3] Staging: oferta real em origem do Telegram → destino WhatsApp (conferir texto, link convertido, foto, histórico com origem/destino/aplicativo) — quickstart.md §5.
- [ ] T090 ⛔🔑 [US4] Staging: oferta em origem do Telegram → destino do Telegram (publicada **pelo robô**, nunca pela conta da cliente) e WhatsApp → Telegram — quickstart.md §6.
- [ ] T091 ⛔🔑 [US5] **SC-004**: com a conta de teste **dentro** do grupo de destino, rodar as 4 combinações e confirmar zero loop; tentar montar caminho de ida e volta pela tela e ver o bloqueio leigo.
- [ ] T092 ⛔🔑 [US3] **SC-003**: medir a latência ponta a ponta (postagem na origem → publicação no destino) e comparar com a meta da spec.

**Checkpoint PR-4**: as 4 combinações funcionam; nenhum loop; conta da cliente nunca publica.

---

## PR-5 — Robustez (Fase 4, US6)

🔁 Staging: api + leitor. 🔁 Produção: api. **Teste independente**: revogar pela conta de teste e ver o painel avisar em ≤ 15 min (SC-008); matar o leitor e ver o aviso interno; WhatsApp intacto.

- [ ] T093 [US6] `src/telegramReader/pool.js`: tratar `FLOOD_WAIT` (gravar `floodUntil`, nunca repetir antes), sessão revogada/restrita/banida → `TelegramAccount.state` com `errorCode` do vocabulário interno.
- [ ] T094 [US6] `src/telegramReader/pool.js`: **recuperação de lacuna** depois de queda (reler só o que está dentro da janela de frescor, sem reprocessar fora dela — FR-025), respeitando limites de ritmo.
- [ ] T095 [US6] `src/telegramOrigin/accountService.js`: **pausa por plano** (Premium vencido → `pausada_plano`, config preservada) e retomada ao voltar o acesso (FR-027).
- [ ] T096 [US6] `src/telegramOrigin/leitorHealthWatch.js`: heartbeat > 3 min → `leitura_parada` na tela e aviso interno (`src/email/adminAlerts.js`), com anti-repetição.
- [ ] T097 [US6] `src/email/registry.js`: e-mails à cliente (conta desconectada/revogada, conta com problema, pausada por plano) em linguagem leiga, sem termos proibidos (FR-026/FR-030).
- [ ] T098 [P] [US6] `scripts/diag-telegram-leitor.mjs` (read-only): contas conectadas, estado, última mensagem lida, descartes por motivo, heartbeat, RSS — sem segredos (FR-029).
- [ ] T099 [P] [US6] `dashboard/app/admin/` (card "Leitura do Telegram" na página de operação existente, ex.: `dashboard/app/admin/operacao/`): contas por estado, heartbeat, RSS; sem segredos.
- [ ] T100 [US6] `dashboard/app/painel/aplicativos/SuaContaTelegram.js`: estados `desconectada`, `com_problema`, `pausada_plano`, `leitura_parada` com o que fazer, e botão de reconectar.
- [ ] T101 [P] [US6] `test/telegram-classifica-erros.test.js` (mock): erro → estado; `FLOOD_WAIT` respeitado.
- [ ] T102 [P] [US6] `test/telegram-pausa-plano.test.js` (mock): Premium vencido pausa sem apagar; volta retoma; conta excluída apaga tudo (FR-028).
- [ ] T103 [P] [US6] `test/telegram-leitor-health-watch.test.js` (mock): heartbeat velho dispara aviso uma vez; voltou, limpa.
- [ ] T104 ⛔🔑 [US6] **SC-008**: revogar a sessão pela conta de teste (Configurações → Dispositivos) e medir o tempo até o painel mostrar "desconectada" (≤ 15 min) e o e-mail sair.
- [ ] T105 ⛔🔑 [US6] `pm2 stop telegram-leitor-staging`: ver o aviso interno e a mensagem leiga na tela; confirmar que o WhatsApp segue normal; religar e ver a recuperação de lacuna sem duplicar.

**Checkpoint PR-5**: todos os estados cobertos; WhatsApp intacto em qualquer falha do leitor.

---

## PR-6 — Lançamento controlado (Fase 5, US7)

🔁 Staging: api + dashboard. 🔁 Produção: api + dashboard + **primeiro `pm2 start telegram-leitor` em prod** — **somente com o OK de memória da dona** (número medido no PR-0/T063).

- [ ] T106 [P] [US7] `src/legalTerms.js`: termos de uso atualizados com a leitura do Telegram (FR-031) e nova versão para reaceite quando aplicável.
- [ ] T107 [P] [US7] Página de preços (arquivo em `dashboard/app/` que lista o Premium; localizar com `Grep` por "Premium") citando o recurso; seguir `docs/design-system/design-system-v2.html`; se mudar texto de página pública já indexada, listar as URLs no **topo** da tabela de `docs/marketing/ACOES_FLAVIA_2026-09-11.md` (regra do `AGENTS.md`), só depois do deploy em `main`.
- [ ] T108 [P] [US7] `docs/rca/multicanal.md`: seção "Telegram como origem pela conta pessoal" (decisões, travas a/b/c, portas, medição), e **uma linha** no índice e no mapa de sintomas do `AGENTS.md` (sem colar RCA; respeitar o teto de 40 KB de `test/agents-md-enxuto.test.js`).
- [ ] T109 [P] [US7] `test/telegram-liberacao-gradual.test.js` (mock): `TELEGRAM_ORIGIN_ENABLED=0` → tudo 404; allowlist vazia → ninguém; ids → só eles; `*` → todas as Premium (US7.1).
- [ ] T110 ⛔🔑 [US7] Liberação gradual em **produção** com 1–3 clientes (allowlist), com o leitor de prod iniciado por `pm2 delete`+`start` **após janela aberta** (`scripts/janela.sh`) e OK explícito da dona sobre a RAM medida; acompanhar `scripts/diag-telegram-leitor.mjs`, `skip:no_valid_conversions` das origens do Telegram e swap (SC-010).
- [ ] T111 [US7] Depois de ≥ 1 semana sem incidente e OK da dona: `TELEGRAM_ORIGIN_ALLOWLIST=*` (delete+start da API) e registrar o número final de RAM em `docs/rca/memoria-e-capacidade.md`.

---

## Dependências entre PRs

- **PR-0 → PR-1**: só o gate de RAM/regras de uso (T018) libera a decisão de seguir; o PR-1 em si não usa o leitor e pode ser preparado em paralelo, mas **não vai a `main`** sem T018.
- **PR-1 → PR-2..PR-6** (migration, `options.mirror`, `mirrorPipeline`, `DeliveryInboxSeen`).
- **PR-2 → PR-3 → PR-4 → PR-5 → PR-6** em sequência (cada um depende do anterior no staging).
- Dentro de cada PR, tarefas `[P]` rodam em paralelo; testes (mock) podem ser escritos antes da implementação.

## Execução paralela — exemplos

- PR-0: T001, T002, T006–T010, T012, T013, T015 em paralelo depois do esqueleto T003–T005.
- PR-1: T022/T023, T028/T029, T031, T033, T035–T039 em paralelo depois das tarefas de extração (T025–T027).
- PR-2: T042/T043, T047, T050, T052–T055 e todos os testes T056–T061 em paralelo.

## Estratégia de implementação

1. **PR-0 primeiro e sozinho**: sem ele não há número de RAM nem confirmação de D5.a.2; é barato, isolado e reversível (`pm2 delete telegram-spike`).
2. **MVP = PR-0 + PR-1 + PR-2 + PR-3 + PR-4** (conectar, escolher origem, TG→WA e TG→TG sem loop). PR-5 (robustez) é obrigatório antes de qualquer cliente real; PR-6 libera.
3. Tudo que depende de Telegram real está marcado ⛔🔑 e nasce **como hipótese** até a dona validar; o que roda só com mocks fecha em `npm test` verde.
4. Rollback em qualquer ponto: `TELEGRAM_ORIGIN_ENABLED=0` + delete/start da API e `pm2 stop telegram-leitor` — nada é apagado, WhatsApp intacto.
