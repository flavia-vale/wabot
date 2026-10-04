# Data model — Telegram como origem pela conta pessoal (feature 021)

Migration **única, aditiva**, no PR-1 (porque `prisma/schema.prisma` está em
`WORKER_CODE_PATHS_RE` e reinicia o `bot-supervisor`). **Nenhuma coluna nova em
tabela existente**, nenhum `ALTER` em tabela com dado. Teste de guarda:
`test/migrations-delivery-network-aditiva.test.js` estendido (ou irmão novo) — a
migration só pode conter `CREATE TABLE` / `CREATE INDEX`.

---

## 1. Tabelas novas

### 1.1 `TelegramAccount` — a conta do Telegram conectada (uma por conta do Espelha Grupos)

| Campo | Tipo | Regra |
|---|---|---|
| `id` | String @id cuid | |
| `userId` | String **@unique** → `User` (onDelete: Cascade) | uma conexão por conta (spec, Key Entities); apagar a conta apaga a linha — **mas** a revogação no Telegram é feita antes pela rotina de exclusão (FR-028, plan D7) |
| `telegramUserIdHash` | String? **@unique** | HMAC-SHA256 do id do usuário do Telegram; garante FR-008. Nulo enquanto conectando |
| `displayName` | String? | nome visível da conta (ex.: "Maria Achadinhos"). **Nunca** telefone |
| `encryptedSession` | String? | `StringSession` cifrada com `encryptCredential` (`src/credentialCrypto.js:61`). Nulo = sem sessão. Nunca sai em resposta de rota/log (T-E6) |
| `status` | String default `'desconectada'` | `conectando` · `conectada` · `desconectada` · `com_problema` · `pausada_plano` (estado **real**, escrito pelo leitor/API) |
| `desiredState` | String default `'ligada'` | `ligada` · `pausada` · `revogar` (o que a API quer; o leitor obedece) |
| `problemCode` | String? | código interno (`revogada`, `restrita`, `banida`, `senha_errada`, `outro`) → traduzido para texto leigo na tela/e-mail |
| `floodUntil` | DateTime? | o Telegram pediu espera até aqui; o leitor não chama nada dessa conta antes |
| `consentAcceptedAt` | DateTime? | FR-003; sem isto a conexão é recusada |
| `consentVersion` | String? | versão do texto em `src/legalTerms.js` |
| `connectedAt` | DateTime? | |
| `lastReadAt` | DateTime? | última mensagem de origem gravada na fila (diagnóstico FR-029) |
| `lastCheckAt` | DateTime? | último "ping" ok (`getMe`) — base do SC-008 |
| `lastNotifiedAt` | DateTime? | último aviso à cliente (dedup de e-mail por dia) |
| `createdAt` / `updatedAt` | DateTime | |

Índices: `@@index([status])`, `@@index([desiredState])`.

**Transições de `status`** (escritas por quem percebe):

```
desconectada --(cliente aceita + lê QR)--> conectando --(login ok)--> conectada
conectando --(QR expira 2 min / erro)--> desconectada
conectada --(AUTH_KEY_UNREGISTERED | SESSION_REVOKED | SESSION_EXPIRED)--> desconectada   [sessão apagada, aviso]
conectada --(USER_DEACTIVATED[_BAN] | PHONE_NUMBER_BANNED)--> com_problema                 [para de usar, aviso]
conectada --(Premium vencido | fora da liberação | interruptor off)--> pausada_plano        [sessão mantida]
pausada_plano --(acesso volta)--> conectada
qualquer --(cliente toca Desconectar | conta excluída)--> desiredState=revogar --(logOut ok)--> linha apagada
```

Queda de rede passageira **não** muda `status` (o pool reconecta; só o heartbeat da conta envelhece).

### 1.2 `TelegramInboxMessage` — fila de entrada + "já visto"

| Campo | Tipo | Regra |
|---|---|---|
| `id` | String @id cuid | |
| `telegramAccountId` | String → `TelegramAccount` (onDelete: Cascade) | desconectar apaga a fila |
| `userId` | String | redundante para consultas por conta |
| `sourceId` | String | `tg:-100…` (mesmo `waJid` do `Group` da origem) |
| `messageId` | String | id da mensagem no chat |
| `messageTimestamp` | DateTime | data da mensagem no Telegram (frescor) |
| `messageKind` | String | vocabulário de `detectMessageKind` (research R6) |
| `text` | String? | texto com links escondidos expandidos; **apagado** ao concluir |
| `mediaToken` | String? | token da foto em `TELEGRAM_MEDIA_DIR` (expira 6 h) |
| `status` | String default `'pending'` | `pending` · `processing` · `done` · `dropped` · `failed` |
| `attempts` | Int default 0 | 3 = `failed` |
| `dropReason` | String? | motivo de descarte (mesmos códigos de `MessageLog.errorMsg` quando aplicável, ex. `stale`) |
| `receivedAt` | DateTime default now | ordem por origem |
| `processedAt` | DateTime? | |

Restrições: `@@unique([telegramAccountId, sourceId, messageId])` (no máximo uma vez — FR-019);
`@@index([status, receivedAt])`, `@@index([sourceId, status, receivedAt])`.
Retenção: linhas `done/dropped/failed` apagadas após 7 dias (faxina na API).

### 1.3 `TelegramLeitorHeartbeat` — vida do processo

| Campo | Tipo | Regra |
|---|---|---|
| `env` | String @id | `production` · `staging` (um leitor por ambiente) |
| `instanceId` | String | uuid gerado na partida; trava de instância única (research R9) |
| `pid` | Int | |
| `startedAt` / `beatAt` | DateTime | heartbeat a cada 30 s; > 3 min = "parado" (aviso interno) |
| `accountsConnected` | Int | |
| `rssMb` | Int | `process.memoryUsage().rss` — alimenta a medição contínua (memória) |
| `botUserId` | String? | id do robô do Espelha Grupos (escrito pela **API** a partir de `getMe`) — trava anti-loop (a).1 |

---

## 2. Tabelas existentes — uso novo, sem alteração de schema

### 2.1 `Group` (origem do Telegram)

Uma origem do Telegram é uma linha comum de `Group`:

| Campo | Valor |
|---|---|
| `role` | `'monitor'` |
| `deliveryNetwork` | `'telegram'` (coluna já existe; lida sempre via `resolveDeliveryNetwork`) |
| `waJid` | `'tg:-100<id>'` (supergrupo/canal) ou `'tg:-<id>'` (grupo básico) — research R7 |
| `kind` | `'group'` (canal do Telegram **não** usa `kind='channel'`, que significa Canal do WhatsApp `@newsletter` e liga regras de plano de canal) |
| `name` | nome do grupo/canal como a cliente vê |
| demais (`blockedKeywords`, `allowedPlatforms`, `templateKey`, `relayFooterText`, `forwardMode`, `noLinkScope`, `primaryLinkTarget`, `targetsMode`) | **mesmas** configurações de uma origem do WhatsApp (FR-024) |

O tipo "grupo" × "canal do Telegram" só é mostrado na tela; se precisar persistir,
fica para as tarefas decidirem entre `welcomeMsg`-like campo livre existente ou
tabela auxiliar — **sem** coluna nova em `Group` nesta feature.

Validações (API, `src/telegramOrigin/accountService.js`):
- conta com `TelegramAccount.status='conectada'` e direito Premium em dia;
- a conversa está na lista de grupos/canais da conta naquele momento (nunca privado);
- limite `TELEGRAM_ORIGIN_MAX_PER_ACCOUNT` e `TELEGRAM_ORIGIN_ADD_PER_HOUR`;
- trava canônica: não existe `Group` `role='post'` do mesmo usuário com o mesmo id canônico (FR-023, plan D5.c).

Desconectar apaga essas linhas (cascade apaga `GroupTarget`). Premium vencido **não** apaga.

### 2.2 `GroupTarget`

Sem mudança. Origem `tg:` → destino WhatsApp ou destino `tg:` (do robô). `PUT /groups/:id/targets`
ganha a checagem `detectRoundTrip` (plan D5.c).

### 2.3 `MessageLog` (histórico — FR-021)

Linhas de origem do Telegram usam a forma já existente:

| Caso | `sourceGroup` | `destGroup` | `platform` | `originalUrl`/`convertedUrl` | `deliveryNetwork` |
|---|---|---|---|---|---|
| descarte no tratamento | `tg:-100…` | `skipped` / `conversion` / `warning` | loja ou `nolink` | como no WhatsApp | null (descarte não tem destino) |
| TG → WhatsApp | `tg:-100…` | JID do grupo | loja | preenchidos (via `options.mirror`) | null = WhatsApp (padrão atual) |
| TG → Telegram | `tg:-100…` | `tg:-100…` | loja | preenchidos (via `historico`) | `'telegram'` (já gravado por `writeDeliveryHistory`) |

A tela de histórico já mostra por aplicativo (017); a origem `tg:` precisa de nome
amigável — a tela resolve pelo `Group` da origem (sem coluna nova).

### 2.4 `DeliveryInboxSeen`

Passa a ser **populada pelo `sweep`** (PR-1) a cada envio aceito pelo robô:
`{ deliveryNetwork: 'telegram', sourceId: <destinationId canônico>, messageId: <message_id devolvido> }`.
O leitor consulta antes de gravar na fila (trava anti-loop "a".2). Faxina: apagar `seenAt` > 7 dias.
**Não** é usada como dedup de entrada das origens (motivo em research R8).

### 2.5 `DeliveryOutbox`

Sem mudança de schema. TG → TG grava `sourceId='tg:<origem>'` e `offer.historico.origem` igual.

### 2.6 `Credential`

Não é usada (a sessão do Telegram não é credencial de loja e tem ciclo de vida próprio);
reaproveita-se só o **esquema de criptografia** (`src/credentialCrypto.js`).

---

## 3. Arquivos fora do banco

| O quê | Onde | Ciclo |
|---|---|---|
| Fotos das ofertas | `TELEGRAM_MEDIA_DIR` (prod `~/wabot/data/telegram-media`, staging `~/wabot-staging/data/telegram-media` — propostos) | escrito pelo leitor, servido pela API por token, apagado em 6 h ou ao desconectar |

Nada de sessão em arquivo (GramJS `StoreSession` **não** é usado).
