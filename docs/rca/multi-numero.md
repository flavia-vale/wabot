# Vários números de WhatsApp na mesma conta (multi-número)

Plano de negócio aprovado pela dona do produto em 2026-09-30. Este arquivo é
a fonte da decisão: fase atual, preço, critérios de avanço e o que NÃO
prometer. Ler antes de mexer no assunto.

## Situação de partida (dados)

- Hoje é **1 número por conta**: `WaSession.userId @unique` (`prisma/schema.prisma`).
- Planos: Basic R$39, PRO R$69, plano acima do PRO ainda não lançado (`PLAN_IDS.PREMIUM`).
- Custo por número: ~R$1,75–3/mês de servidor; para capacidade conta
  **0,35 GB/número** (ver `memoria-e-capacidade.md`). Cada número extra ocupa
  **uma vaga** igual a uma conta nova.
- Procura já existente: clientes com **várias contas usando o mesmo número**
  (`WaPhoneOwnership`; medido: 12 contas em 4 pessoas). Hipótese: parte é
  procura por mais números, parte é reuso de teste grátis.

## Preço aprovado

| Produto | Preço |
|---|---|
| Número extra (só PRO; Trial ativo conta como PRO) | **R$29/mês por número** (`EXTRA_NUMBER_PRICE_CENTS`) |
| Plano "Escala" (Fase 3) | R$129–149 com 3 números + rodízio + Instagram (a fechar) |
| Proxy por número (opcional, Fase 3) | +R$15–20/número, só se os dados mostrarem ban em cascata |

R$29 fica abaixo de uma 2ª conta PRO (R$69), mas não tão baixo que derrube a
receita de quem já paga duas contas.

## Fases e critério de avanço

| Fase | Entrega | Meta para seguir |
|---|---|---|
| **0. Validar** ✅ em andamento | Lista de espera no painel (`/painel/whatsapp`, com robô conectado) + `scripts/diag-multi-numero-demanda.mjs` | ≥5 contas PRO na lista, ou ≥10% dos PROs (com ao menos 3) |
| 1. Número reserva ✅ implementado (ver "Fase 1 — como ficou") | 2º número assume se o 1º cair ou for banido | Quem usa reserva cancela menos que quem não usa |
| 2. Rodízio ✅ implementado (ver "Fase 2 — como ficou") | Envios alternados entre os números presentes em cada grupo, com teto por número | Menos bans por número, vazão igual ou maior |
| 3. Plano Escala | Até 5 números, descanso automático, saúde por número, proxy opcional | Receita média do PRO +20% |

## Fase 0 — como funciona

- Rotas: `GET/POST/DELETE /api/multi-number/waitlist` (`src/api/routes/multiNumber.js`).
- Regra: `src/domain/multiNumber/waitlist.js` (preço, opções, validação,
  intenção vigente, critério de decisão). O diagnóstico IMPORTA essa regra.
- Armazenamento: `AnalyticsEvent` com `multi_number_waitlist_joined` /
  `multi_number_waitlist_left` (sem migration). A intenção vigente é o
  evento mais recente da conta. Grava direto pelo `writeAnalyticsEvent`, sem
  depender de `ANALYTICS_ENABLED` — é dado de negócio, não telemetria.
- Não liga sessão, não reserva vaga, **não aumenta RAM**.
- Diagnóstico (read-only): `node scripts/diag-multi-numero-demanda.mjs [--lista]`
  → base PRO, lista (quantidade, motivo, receita potencial), contas que
  compartilham número e a decisão da Fase 1. `--lista` imprime e-mails para
  o contato de pré-venda.

## Não regredir / o que não prometer

- **Nunca vender como "anti-ban garantido".** O rodízio reduz o volume por
  número; não elimina o risco. Texto certo: "continuidade" e "envio dividido".
- Um número só envia para grupo em que está (membro/admin; admin no canal).
  O rodízio só pode escolher entre números presentes no destino.
- Só **um** número "ouve" cada grupo de origem, senão a oferta duplica.
- Todos os números saem do mesmo IP do servidor: ban em cascata é hipótese a
  medir na Fase 2 antes de vender proxy.
- **Fase 1 em diante aumenta RAM** (cada número = uma sessão, 0,35 GB para
  capacidade): Regra #1 da política de memória — estimativa + OK da usuária
  antes de liberar. A folga era de 24 vagas em 2026-09-18.

## Fase 1 — especificação técnica (número reserva)

Escrita em 2026-10-03, ANTES de haver código. Só começar quando
`diag-multi-numero-demanda.mjs` disser **SEGUIR**. Fatos abaixo conferidos no
código da `develop` nessa data.

### Como é hoje (tudo é "1 conta = 1 robô")

| Peça | Chave hoje | Onde |
|---|---|---|
| Registro da sessão | `WaSession.userId @unique` | `prisma/schema.prisma` |
| Login do WhatsApp no disco | `getAuthInfoDir(userId)` → `auth_info/<userId>` | `src/paths.js` |
| Dedup local | `getDedupFile(userId)` | `src/paths.js` |
| Robôs ligados | `bots` Map por `userId`; worker recebe `BOT_USER_ID` | `src/core/sessionCore.js` (`startBot`/`stopBot`) |
| Supervisor, QR/status, último evento no Redis | `userId` | `src/supervisor/index.js`, `protocol.js` (`lastEventKey`) |
| Quem lê/escreve `waSession` | 16 arquivos | `grep -rl "waSession\." src` |
| Grupos e destinos | `Group.userId`, `Destination.userId` (sem número) | `prisma/schema.prisma` |

### Decisão central: a chave do número principal NÃO muda

Cada número ganha uma **chave de sessão** (`sessionKey`):

- número 1 (principal) → `sessionKey = userId` — **igual a hoje**;
- números extras → `sessionKey = <userId>~n2`, `~n3`…

Por quê: assim **nenhuma sessão existente precisa ser migrada**. Pasta de
login, Map de robôs, chaves do Redis e dedup do principal continuam com o
mesmo nome. Só o número extra é novo. Isso tira o maior risco do projeto
(mover o login de todos os clientes) e deixa a volta atrás simples: desligar a
flag e parar os robôs `~nX`.

Regra de ouro: código que recebe `userId` e precisa da conta usa
`accountIdFromSessionKey(sessionKey)` (corta o `~nX`); código que precisa do
robô usa a `sessionKey`. Função pura nova em `src/domain/session/sessionKey.js`,
com teste. **Proibido** montar `~n` à mão fora dela.

### 1. Banco (migration, só acrescenta)

- `WaSession`: tirar o `@unique` de `userId`; novas colunas
  `slot Int @default(1)`, `role String @default("primary")`
  (`primary` | `reserve`) e `@@unique([userId, slot])`.
  As linhas atuais viram `slot=1, role=primary` pelo default, sem script.
  (SQLite: o Prisma recria a tabela; testar no staging com cópia do banco de
  produção antes — regra de "banco passa por staging".)
- `User.extraNumbers Int @default(0)`: quantos números extras a conta pagou.
- Toda leitura `findUnique({ where: { userId } })` em `waSession` (16 arquivos)
  passa a `findFirst({ where: { userId, slot: 1 } })` ou recebe a `sessionKey`.
  Teste estrutural: nenhum `waSession.findUnique({ where: { userId` sobrando.

### 2. Disco e robô

- `getAuthInfoDir(sessionKey)` e `getDedupFile(sessionKey)`: mesma função, a
  chave muda só para extras. A guarda de "dois sockets no mesmo AUTH_INFO_DIR"
  (`src/supervisor/envGuard.js`) passa a valer por `sessionKey`.
- `startBot(sessionKey)` / `stopBot(sessionKey)`; o fork passa
  `BOT_USER_ID=<conta>` **e** `BOT_SESSION_KEY=<chave>` + `BOT_ROLE`.
- O bot-worker em `role=reserve` **conecta e fica de prontidão**: não escuta
  grupos de origem e não pega envio. Só assume quando promovido (abaixo).
  Isso evita oferta duplicada e conversão em dobro.
- Supervisor, eventos de QR/status e `lastEventKey` passam a usar `sessionKey`.

### 3. Troca automática (failover)

Promove a reserva a `primary` (e rebaixa o antigo) quando o principal:

- foi deslogado/banido (`loggedOut` 401 — ver `src/core/reconnectPolicy.js`); ou
- está desconectado há mais de `MULTI_NUMBER_FAILOVER_MINUTES` (padrão 10); ou
- está "conectado mas cego" (`isReceptionProblem` em
  `src/core/receptionHealth.js`) pela mesma janela.

Regras:
- **Uma troca por vez**, com trava no banco (sem dois `primary` ao mesmo tempo)
  e intervalo mínimo entre trocas (evita pingue-pongue).
- Ao promover: reinicia os dois robôs nos papéis novos (mais simples e seguro
  que trocar papel com o robô rodando).
- A reserva só envia para grupos em que **é membro**. Grupo sem a reserva fica
  sem envio durante a troca, e o painel avisa ("a reserva não está em 3 grupos").
- Avisar a cliente (e-mail + aviso no painel) a cada troca.
- Volta para o principal: **manual** na Fase 1 (botão "voltar para o número 1").

### 4. Painel

Na tela WhatsApp (dentro do retorno de quem está conectada — ver regressão de
2026-09-30), um bloco "Número reserva":
- conectar por QR/código (reaproveita o fluxo atual com a `sessionKey` extra);
- estado de cada número (conectado, de prontidão, ativo);
- lista de grupos em que a reserva **não** está;
- botões: desconectar reserva, voltar para o número 1.
Segue o design system v2 (padrão PRO). Texto: "continuidade", nunca "anti-ban".

### 5. Cobrança

- Só PRO (e Trial ativo, como o resto). `extraNumbers > 0` exige PRO.
- R$29/mês por número. **Decisão em aberto** (perguntar à dona do produto
  antes de codar): (a) somar no valor da assinatura recorrente do PRO
  (uma cobrança só; mudar valor de assinatura existente no Mercado Pago) ou
  (b) assinatura separada só do adicional (mais simples de ligar/desligar,
  duas cobranças no cartão). Ler `docs/rca/cobranca.md` antes.
- Plano vencido ou cancelado → robôs extras param primeiro.

### 6. Capacidade e RAM (Regra #1 — sinalizar antes de liberar)

- Cada número extra = uma vaga a mais: **~0,18 GB medidos, 0,35 GB para
  decidir capacidade**. A reserva em prontidão gasta quase o mesmo que um robô
  ativo (o socket fica aberto).
- Ex.: 10 clientes com 1 reserva = +3,5 GB na conta de capacidade (+1,8 GB
  reais). Conferir folga com `diag-vagas-robos.mjs` antes de abrir.
- A recusa por falta de vaga (`src/domain/session/startRefusal.js`) vale para o
  extra também, e o **principal tem prioridade** sobre qualquer reserva.

### 7. Liberação e volta atrás

1. Flag `MULTI_NUMBER_ENABLED` (padrão desligada). Desligada = tudo como hoje.
2. Staging com cópia do banco de produção: migration + 2 contas de teste com
   reserva + forçar queda do principal.
3. Produção liberada só para a lista de espera (quem pediu na Fase 0), em
   lotes pequenos, olhando swap e vagas.
4. Volta atrás: desligar a flag e parar os robôs `~nX`. O principal nunca foi
   mexido.

### 8. Testes obrigatórios

- `sessionKey`: montar, desmontar, conta a partir da chave, recusa chave inválida.
- Failover: cada gatilho promove; nunca dois `primary`; intervalo mínimo
  respeitado; sem reserva conectada não troca.
- Reserva em prontidão não processa mensagem de grupo nem pega envio.
- Estrutural: nenhuma leitura de `waSession` por `userId` único sobrando;
  ninguém monta `~n` fora de `sessionKey.js`.
- Conta sem extras: comportamento idêntico ao de hoje (o teste mais importante).

### Fora da Fase 1

Rodízio de envio (Fase 2), mais de 1 reserva, proxy por número, plano Escala.

## Fase 1 — como ficou (implementado em 2026-10-03, flavia-vale/wabot#2190)

Tudo atrás de `MULTI_NUMBER_ENABLED` (padrão **desligado** = produto igual ao
de antes). Duas mudanças em relação à especificação acima, ambas para reduzir
risco:

1. **Banco:** `WaSession` NÃO perdeu o `@unique` — a relação 1:1
   `User.waSession` é usada em 30+ pontos. Os números extras moram em
   `WaExtraSession` (slot 2) e a conta ganhou `extraNumbers`, `activeWaSlot` e
   `waSlotSwitchedAt`. Migration só de acréscimos.
2. **Processos:** o processo com chave = `userId` é SEMPRE o que envia (filas,
   comandos, Redis e telas não mudaram); ele só passa a usar o **login** do
   número ativo (`activeWaSlot`). O processo `<userId>~n2` é a prontidão e
   usa o login do outro número. `WaSession` = estado de quem envia;
   `WaExtraSession` slot 2 = estado de quem está de prontidão.

| Peça | Onde |
|---|---|
| Chave e identidade do processo (qual login usa) | `src/domain/session/sessionKey.js`, `src/domain/session/workerIdentity.js`, `src/core/workerIdentity.js` |
| Prontidão no robô (não espelha, não envia, só comandos de socket) | `IS_STANDBY` em `src/bot-worker.js` |
| Religar a prontidão após restart | `src/core/standbySessions.js` (inline e supervisor) |
| Troca automática | `src/domain/session/failoverPolicy.js`, `src/core/numberSwitch.js`, `src/jobs/numberFailover.js` (passada de 1 min na API) |
| API da reserva | `/api/multi-number/reserve*` em `src/api/routes/multiNumber.js` |
| Cobrança (assinatura separada) | `/api/payments/extra-number/*`, `src/domain/payments/extraNumberBilling.js` |
| Painel | `dashboard/components/MultiNumberSection.js`, `ReserveNumberCard.js`, `ReservePurchaseCard.js` |
| E-mail da troca | `whatsapp_reserva_assumiu` |

**Envs** (todas opcionais):

| Env | Padrão | O que faz |
|---|---|---|
| `MULTI_NUMBER_ENABLED` | desligado | liga tudo |
| `MULTI_NUMBER_FAILOVER_MINUTES` | 10 (mín. 2) | queda comum antes de a reserva assumir |
| `MULTI_NUMBER_MIN_SWITCH_MINUTES` | 30 (mín. 5) | intervalo mínimo entre trocas automáticas |
| `MULTI_NUMBER_RESERVE_HEADROOM` | 5 | vagas guardadas para números principais |

### Não regredir

- **Nunca dois processos no mesmo login** (440 em loop). A troca é: reivindica
  no banco → marca `switching` → para os dois e ESPERA saírem → inverte
  `activeWaSlot` → troca os telefones de linha → religa. Não sair a tempo =
  cancela sem mudar nada. Flag ligada + banco fora = o worker SAI (não chuta
  o número).
- **A prontidão não faz negócio nenhum**: sem agendados, sem watchdog de
  envio, sem fila, sem espelhar, sem eventos de conexão, só `stop`,
  `requestPairingCode`, `listGroups`, `metrics`. Teste estrutural em
  `test/multi-number-standby.test.js`.
- **Cobrança do adicional nunca toca no plano.** Webhook desvia pela
  referência `addon:extra_number:<conta>` antes de resolver plano por valor;
  toda consulta de assinatura do plano usa `PLAN_SUBSCRIPTION_WHERE`. Teste
  estrutural em `test/multi-number-billing.test.js`.
- **Reserva nunca tira vaga de principal**: só liga com
  `MULTI_NUMBER_RESERVE_HEADROOM` vagas sobrando; sem dado de vaga, recusa.
- Cancelar o adicional desliga a prontidão **na hora** (diferente do plano,
  que vale até o fim do período pago) — decisão da Fase 1.
- Ainda **não** existe gatilho de troca por "conectado mas cego": esse estado
  não é gravado no banco. Fica para a Fase 2.

### Validação em staging (nesta ordem)

Staging com **token de sandbox do MP** (token de produção cobra de verdade).
Ligar a flag exige `pm2 delete` + `start` (pegadinha #1) em `api-staging` e no
supervisor de staging.

1. Flag desligada: tela WhatsApp igual a antes (lista de espera); `GET
   /api/multi-number/reserve` → 404.
2. Ligar `MULTI_NUMBER_ENABLED=true`. Conta PRO sem o adicional vê
   "Contratar número reserva"; Basic continua vendo a lista de espera.
3. Contratar no sandbox → webhook → `User.extraNumbers = 1`; o painel mostra o
   bloco "Número reserva".
4. Conectar a reserva com OUTRO celular (QR ou código). Tentar o mesmo número
   tem que recusar.
5. "Conferir grupos da reserva" lista os destinos em que ela não está.
6. Desconectar o número principal pelo celular (Dispositivos conectados →
   sair): em até ~1 min a reserva assume (motivo `logged_out`), e chega o
   e-mail. SQL de conferência:
   `SELECT activeWaSlot, waSlotSwitchedAt FROM User WHERE email='<conta>';`
7. Enviar uma oferta: tem que sair pelo número reserva.
8. Reconectar o número antigo (ele volta como prontidão) e usar "Voltar para o
   número de antes".
9. Reiniciar `api-staging`: a prontidão volta sozinha.
10. Cancelar o adicional: a prontidão desliga e `extraNumbers` volta a 0.

**Antes de ligar em produção (Regra #1):** cada reserva = +1 vaga
(~0,18 GB medidos, 0,35 GB para capacidade). Conferir folga com
`diag-vagas-robos.mjs` e pedir OK explícito da dona do produto.

## Fase 2 — plano técnico (rodízio de envio)

Escrito em 2026-10-03, sobre o código da `develop` depois do #2190. Só começa
quando a Fase 1 estiver em produção e os **portões** abaixo derem SEGUIR.

### Objetivo

Os dois números da conta **enviam ao mesmo tempo**, cada um para uma parte dos
grupos. Cada número envia menos por hora → menos risco de bloqueio por número,
e a vazão total pode subir. A troca automática da Fase 1 continua valendo: se
um número cair, o outro assume tudo.

### O que muda em relação à Fase 1 (fatos do código)

| Hoje (Fase 1) | Fase 2 |
|---|---|
| Só o processo ativo (chave `userId`) envia; a prontidão (`~n2`) não envia | O processo `~n2` vira **segundo remetente**: continua sem escutar origens, mas **consome a própria fila de envio** |
| Uma fila por conta: `wabot-send-<userId>` (`BULLMQ_QUEUE_NAME`, `src/bot-worker.js`) | Uma fila **por número**: `wabot-send-<chave do processo>`. Atenção: depois da Fase 1 o worker troca `userId` pela conta ANTES de montar o nome da fila — o nome precisa usar `SESSION_IDENTITY.processKey` |
| Espelhamento (`relay`) e mídia "original" vão para fila **em memória** (`findUnserializableField`) | Esses jobs precisam virar serializáveis para atravessar processos (ver "Transporte") |
| Intervalo entre destinos: estado em memória por processo (`destinationSpacingState`) | **Mantém por processo = por número.** É exatamente o que o rodízio quer: cada número tem o próprio ritmo |
| Limite por grupo: `ChannelThrottle` no banco (`checkAndReserve`) | **Mantém.** Como é por grupo e está no banco, vale para os dois números juntos — o grupo não recebe mais rápido por ter dois remetentes |
| Dedup antes de enfileirar, no processo que escuta (Redis + arquivo) | **Mantém.** Quem decide e deduplica continua sendo só o processo ativo |
| Gatilho "conectado mas cego" não existe (estado não gravado) | Entra aqui (item 7) |

### Portões antes de codar (medir, não supor)

1. **Fase 1 em produção há 2+ semanas** com reservas reais e nenhuma troca
   indevida: `SELECT reason, COUNT(*) FROM (SELECT json_extract(metadata,'$.reason') reason FROM AnalyticsEvent WHERE event='multi_number_switched' AND createdAt >= datetime('now','-14 days')) GROUP BY 1;`
   → se `manual` dominar, a troca automática não está sendo usada; se
   `down_too_long` for frequente, revisar o tempo antes de dobrar o envio.
2. **Quanto do envio é espelhamento em memória** (decide o tamanho do item 3):
   `SELECT COALESCE(deliveryKind,'?') k, COUNT(*) FROM MessageLog WHERE status='success' AND sentAt >= datetime('now','-7 days') GROUP BY 1 ORDER BY 2 DESC LIMIT 10;`
   → se `relay` for pequeno, a Fase 2a (sem espelhamento) já entrega quase
   todo o ganho.
3. **Backend da fila em produção:** `grep -cE '^(QUEUE_BACKEND=bullmq|REDIS_URL=)' ~/wabot/.env`
   → se der menos de 2, não há Redis/BullMQ e o rodízio entre processos não
   tem por onde passar (pré-requisito de infra, decisão à parte).
4. **Spike do espelhamento (staging):** reenviar, a partir do número 2, uma
   mensagem de mídia recebida pelo número 1 (o `relay` reaproveita as
   referências de mídia do WhatsApp). Se a mídia não abrir para quem recebe,
   o espelhamento com mídia precisa ser re-baixado e re-enviado (custo de CPU
   e banda — reavaliar).

### Desenho

**1. Papel "segundo remetente"** (`src/domain/session/workerIdentity.js`)
- Novo papel `secondary`, além de `active`/`standby`: só existe com
  `User.rotationEnabled = true` (coluna nova, padrão `false`) e flag
  `MULTI_NUMBER_ROTATION_ENABLED`.
- No robô (`IS_STANDBY` → `ROLE`): `secondary` cria o backend de envio e roda
  `processSendJob`; continua sem `messages.upsert`, sem agendados, sem
  reprocessar falhas da conta (isso fica só no ativo, senão duplica).
- IPC permitido ao `secondary`: o da prontidão + `metrics`. Comandos de
  negócio continuam indo só para o ativo.

**2. Quem envia cada grupo** (novo, puro: `src/domain/session/senderRouting.js`)
- **Grupo fixo por número** (não alternar mensagem a mensagem): cada grupo de
  destino tem um número dono. Motivo: o grupo vê sempre o mesmo remetente
  (menos estranheza para membros e admins) e o limite por número fica
  previsível.
- Distribuição: equilibra pelo volume dos últimos 7 dias por grupo
  (`MessageLog`), não pela contagem de grupos.
- Regras duras: só é dono quem é **membro** do grupo (item 4); canal só se o
  número for **admin** do canal; número desconectado não é dono de nada (o
  outro assume na hora, sem esperar a troca da Fase 1).
- Tabela nova `DestinationSender(userId, destJid, slot, assignedAt, reason)`
  — dono gravado (estável entre restarts), recalculado 1x/dia ou quando a
  pertença muda.

**3. Transporte do envio entre processos**
- **Fase 2a — só o que já é serializável:** ofertas automáticas, filas,
  agendados, broadcast (já vão por BullMQ com `payloadRecipe`). O ativo
  decide o dono e enfileira na fila do número dono. Espelhamento continua
  saindo pelo ativo.
- **Fase 2b — espelhamento:** tornar o job de `relay` serializável:
  `proto.Message.encode(...)` → base64, e Buffer de mídia "original" →
  arquivo em `data/send-spool/<userId>/<jobId>.bin` (mesmo nó: a Fase 1 já
  garante que os dois processos da conta moram no mesmo nó), com limpeza por
  idade (24 h) e por tamanho. Depende do portão 4.
- Sem Redis (`QUEUE_BACKEND` memória) → rodízio indisponível; o ativo envia
  tudo, como hoje.

**4. Quem é membro de quê** (novo: tabela `WaGroupMembership(userId, slot, waJid, isAdmin, refreshedAt)`)
- Cada processo grava os próprios grupos ao conectar e 1x/hora usando o
  `groupFetchAllParticipating` que já existe (`listGroups`/refresh) — sem
  chamada nova ao WhatsApp.
- Substitui a consulta ao vivo do `GET /reserve/missing-groups` da Fase 1.

**5. Teto por número**
- `MULTI_NUMBER_SENDER_HOURLY_CAP` (envios/hora por número). Passou do teto:
  o grupo vai para o outro número **se ele for membro**; senão espera (nunca
  estoura o teto do número dono).
- Valor inicial medido, não chutado: envios/hora reais por conta hoje
  (`MessageLog`, `senderSlot` do item 6) dividido por 2, com folga. A regra de
  ritmo continua a de `src/core/destinationSpacing.js` e
  `src/core/channelThrottle.js` (importar, nunca copiar). Obs.: o
  `scripts/diag-antiban-valores.mjs` citado em `destinationSpacing.js` não
  existe no repositório.

**6. Rastreio**
- `MessageLog.senderSlot Int?` (coluna nova): qual número enviou. Base para
  medir bloqueio por número e para o diagnóstico.
- `scripts/diag-rodizio.mjs` (read-only): envios por número/hora, grupos por
  dono, grupos sem dono possível (nenhum número membro), fila de cada número.

**7. Gatilho "conectado mas cego"** (pendência da Fase 1)
- Gravar o estado de recepção (`computeReceptionState`,
  `src/core/receptionHealth.js`) em `WaSession.receptionState` no heartbeat
  que já existe (sem escrita nova por mensagem).
- `decideFailover` ganha o motivo `blind` com a mesma janela de
  `MULTI_NUMBER_FAILOVER_MINUTES`.

**8. Painel**
- Chave "Dividir os envios entre os números" (padrão desligado por conta).
- Lista de grupos com o número que envia e o aviso "nenhum dos seus números
  está neste grupo".
- Contagem de envios de cada número nas últimas 24 h.

### Riscos

| Risco | Como tratar |
|---|---|
| Dois números no mesmo grupo enviando a mesma oferta | Dedup continua só no ativo, ANTES de escolher o dono; teste estrutural: só o ativo chama o dedup |
| Grupo recebendo mais rápido que antes | Limite por grupo continua no banco (`ChannelThrottle`), compartilhado pelos dois |
| Vazamento de disco no spool (2b) | Limpeza por idade e teto de tamanho; diagnóstico mostra o tamanho |
| Mudança de dono no meio de uma fila | Job já enfileirado sai pelo número da fila; só jobs novos usam o dono novo |
| Mais RAM/CPU | O `~n2` já está ligado desde a Fase 1; a Fase 2 soma o trabalho de envio (fila + Baileys enviando). **Regra #1:** medir RSS do `~n2` antes/depois no staging e trazer o número para OK antes de ligar em produção |
| Bloqueio em cascata (mesmo IP) | Rastreio por número (item 6) dá o dado para decidir proxy por número (Fase 3) |

### Ordem de entrega (cada uma um PR, cada uma atrás de flag)

1. Rastreio + estado de recepção: `senderSlot`, `receptionState`, gatilho
   `blind`, `diag-rodizio.mjs`. Útil mesmo sem rodízio.
2. Pertença por número (`WaGroupMembership`) + painel mostrando grupos sem a
   reserva a partir dela.
3. Fila por número + papel `secondary` + roteamento (Fase 2a, só jobs
   serializáveis) + teto por número.
4. Painel do rodízio (chave, dono por grupo, envios por número).
5. Fase 2b (espelhamento) — só se os portões 2 e 4 justificarem.

### Testes obrigatórios

- Roteamento puro: nunca escolhe número não-membro, desconectado ou acima do
  teto; distribuição equilibrada por volume; dono estável sem mudança de
  pertença.
- Estrutural: só o ativo escuta, deduplica e reprocessa; o `secondary` não
  registra `messages.upsert`; nome da fila usa a chave do processo.
- Conta sem rodízio (`rotationEnabled = false`): comportamento idêntico ao
  da Fase 1 — o teste mais importante.
- Spool (2b): ida e volta do job, limpeza por idade, falha de disco não
  derruba o envio (cai para o ativo).

### Fora da Fase 2

Mais de 2 números, proxy por número, plano Escala (Fase 3).

## Fase 2 — como ficou (implementado em 2026-10-03, flavia-vale/wabot#2199)

Tudo atrás de flags **desligadas**. A dona do produto pediu para implementar
antes dos portões: eles viraram **checagens obrigatórias antes de LIGAR**
(ver "Portões antes de codar" acima — continuam valendo, agora como
"antes de ligar").

| Peça | Onde |
|---|---|
| Qual número enviou (`MessageLog.senderSlot`) e recepção no heartbeat (`WaSession.receptionState`) | `src/bot-worker.js` (só com `MULTI_NUMBER_ENABLED`) |
| Troca por "conectado mas cego" (motivo `blind`) | `isActiveBlind` em `src/domain/session/failoverPolicy.js` |
| Em quais grupos cada número está | `WaGroupMembership`, `syncGroupMembership` no robô, `src/domain/session/groupMembership.js` |
| Dono de cada grupo e escolha do remetente (puro) | `src/domain/session/senderRouting.js` |
| Plano do rodízio com banco (só no ativo) | `src/core/rotationRouter.js`, tabela `DestinationSender` |
| Fila do outro número e devolução | `createBullmqProducer` em `src/sendQueueBackend.js`; `routeToOtherNumber` no robô |
| Espelhamento no rodízio (2b) | `src/core/sendSpool.js`, `routeMirrorToOtherNumber` no robô |
| API | `GET/POST /api/multi-number/rotation` |
| Painel | `dashboard/components/RotationCard.js` (dentro do bloco da reserva) |
| Diagnóstico | `scripts/diag-rodizio.mjs` |

**Envs novas** (todas opcionais):

| Env | Padrão | O que faz |
|---|---|---|
| `MULTI_NUMBER_ROTATION_ENABLED` | desligado | liga o rodízio no servidor (a conta ainda precisa ligar no painel) |
| `MULTI_NUMBER_ROTATION_RELAY` | desligado | inclui o espelhamento no rodízio (2b) |
| `MULTI_NUMBER_SENDER_HOURLY_CAP` | sem teto | envios/hora por número antes de transbordar para o outro |
| `SEND_SPOOL_DIR` | `<BOT_LOG_DIR>/send-spool` | pasta do spool do 2b |

### Diferenças em relação ao plano

- **Teto por número é preferência, não bloqueio:** passou do teto, o grupo
  transborda para o outro número se ele estiver no grupo; senão segue pelo
  dono. O limite DURO continua sendo o de cada grupo (`ChannelThrottle`, no
  banco, compartilhado pelos dois números).
- **Com um número fora do ar o plano não é gravado** (vale só em memória).
  Gravar faria o número que ficou "herdar" os grupos para sempre.
- **Canais (`@newsletter`) ficam fora do rodízio** — saem sempre pelo ativo
  (admin do canal é por número; fica para quando houver dado de admin).
- **Job com `onDone` não atravessa** no 2a; no 2b o aviso "Mensagem enviada"
  e a analítica de erro do job roteado ficam sem registro no ativo.
- **Envio do espelhamento é montado na hora de enfileirar** quando vai para o
  outro número (no outro processo não existe o contexto da origem). Foto e
  marca d'água são resolvidas antes da espera da fila.

### Não regredir

- **Só o ativo decide e deduplica.** O segundo remetente não registra
  `messages.upsert`, não reprocessa falhas da conta, não roda agendados.
  Testes estruturais em `test/multi-number-rotation.test.js` e
  `test/multi-number-standby.test.js`.
- **Fila da conta não muda de nome** (`wabot-send-<userId>`); a do outro
  processo é `wabot-send-<userId>~n2`. Sem Redis/BullMQ, nada é roteado.
- **Nunca rotear quando o outro número não está conectado e com sinal
  recente (3 min).** Fora do ar há 10+ min → o ativo traz de volta o que
  ficou na fila dele.
- **Spool:** o Redis só leva nomes de arquivo; nome vindo do Redis nunca
  escapa da pasta; arquivos saem ao terminar o envio e na limpeza horária.

### Antes de LIGAR (portões + Regra #1)

1. Portões 1–3 do plano (trocas em produção, fatia de `relay`, Redis em
   produção). Sem Redis o rodízio fica inerte.
2. Portão 4 (mídia reenviada por outro número) **antes** de
   `MULTI_NUMBER_ROTATION_RELAY`.
3. Medir RSS do processo `~n2` com o rodízio ligado no staging e trazer o
   número para OK (Regra #1).

### Validação em staging (nesta ordem)

1. Flags desligadas: nada muda (bloco da reserva sem "Dividir os envios").
2. `MULTI_NUMBER_ROTATION_ENABLED=true` (`pm2 delete` + `start`): com a
   reserva conectada aparece "Dividir os envios entre os números".
3. Pôr o número reserva em 2 dos grupos de destino e esperar até 1 h (ou
   reconectar) → `diag-rodizio.mjs --email=<conta>` mostra "grupos por número".
4. Ligar a divisão. Mandar uma oferta automática/fila para os grupos → parte
   sai pelo número 2 (`senderSlot`). Nenhuma oferta duplicada.
5. Desligar o número 2 pelo celular → em ~10 min o que estava na fila dele
   sai pelo ativo; troca automática continua funcionando.
6. Só depois do portão 4: `MULTI_NUMBER_ROTATION_RELAY=true` e repetir com
   espelhamento com foto e com vídeo.
