# Fase 4 — UI no dashboard pra cadastrar e gerenciar canais

**Data**: 2026-05-16
**Plano mestre**: `docs/whatsapp-channels-implementation-plan.md` (Fase 4)
**Pré-requisitos mergeados**: Fase 1 (jid + Group.kind), Fase 2 (newsletterFollow auto), Fase 3 (envio em canal-destino).

## Objetivo

Permitir que a usuária cadastre e gerencie canais (`@newsletter`) pelo dashboard da mesma forma que cadastra grupos hoje, com feedback claro sobre seguir/admin e prevenção de uso indevido (cadastrar canal alheio como destino — risco de restrição na conta).

Escopo limitado a UI/API; runtime de envio e follow já está pronto das fases anteriores.

## Decisões alinhadas com a usuária

1. Cadastro de canal aceita **link de convite** (`https://whatsapp.com/channel/...`) **e lista de canais seguidos** (ambos caminhos coexistem). JID manual fica como fallback avançado.
2. Follow de canal-monitor é **imediato via IPC** API↔worker. UI mostra status (seguindo / pendente / erro).
3. **Badge de admin** preventivo no canal-destino, com orientação textual reforçando "só cadastre canais onde você é admin".
4. **Página única "Grupos e Canais"** (mesma rota `/dashboard/grupos`), com seletor de tipo no cadastro e badge de tipo na listagem.

## Arquitetura

### Backend

**`src/api/routes/groups.js`** — rotas novas:
- `POST /api/groups/resolve-channel-invite` — body `{ url }`. Valida via `parseChannelInviteUrl` (Fase 1), chama IPC `channel:metadata({ inviteCode })` no worker, retorna `{ waJid, name, owner, isViewerOwner, picture? }` ou 4xx amigável.
- `POST /api/groups/:id/follow-now` — pra canal-monitor recém-cadastrado. IPC `channel:follow({ jid })`. Timeout 10s.
- `GET /api/wa/channels` — lista canais já seguidos. IPC `channel:list-followed`.
- `POST /api/groups/:id/refresh-admin` — re-checa admin via `channel:metadata`. Debounce 2s no cliente.

POST `/api/groups` atual (Fase 1) continua aceitando `kind: 'channel'` sem mudança — o fluxo novo apenas pré-preenche e valida antes de chamar.

**`src/manager.js`** — adiciona `requestFromWorker(userId, { type, payload, timeoutMs = 10000 })`:
```js
// Pseudo-API
const { ok, data, error } = await requestFromWorker(userId, {
  type: 'channel:metadata',
  payload: { inviteCode: '0029Va...' },
  timeoutMs: 10000,
})
```
- Cada request ganha `correlationId` (uuid v4).
- Envia ao worker via `child.send({ kind: 'request', correlationId, type, payload })`.
- Mantém `Map<correlationId, { resolve, reject, timer }>` por worker.
- Worker offline (sem child process) → retorna `{ ok: false, error: 'worker-offline' }` síncrono.
- Timeout → rejeita com `error: 'timeout'`, limpa entry.
- Response órfã (correlationId desconhecido) → log warn, descarta.

**`src/core/channelDirectory.js`** (novo, puro/mockável):
- `createChannelDirectory({ sock, logger, now = Date.now, ttlMs = 5 * 60_000 })` retorna handlers:
  - `metadata({ jid?, inviteCode? })` → `{ jid, name, owner, isViewerOwner, picture? }`. Cache keyed por jid, TTL 5min. `isViewerOwner` = `owner === sock.user.id` (normalizado).
  - `follow({ jid })` → reusa `followedChannelJids` + `inFlightChannelJids` da Fase 2; idempotente. Retorna `{ followed: 'new' | 'already' }`.
  - `listFollowed()` → deriva de `followedChannelJids` + metadata por item (paralelo limitado a 5). Cacheado por TTL.
- Erros do Baileys propagados com `error.message` preservada pra UI mostrar.

**`src/bot-worker.js`** — registra um dispatcher `process.on('message', ...)` para `kind === 'request'`, roteia pra `channelDirectory` por `type`, responde `{ kind: 'response', correlationId, ok, data, error }`. Try/catch garante que erro do handler vira `ok: false, error: err.message`.

### Frontend

**Renomeio só visual**: arquivo continua `dashboard/app/dashboard/grupos/page.js`, mas título e link no menu lateral viram "Grupos e Canais".

**Lista unificada**:
- Cada item ganha badge `[Grupo]` ou `[Canal]` (CSS já no projeto, cor distinta).
- Canal-monitor: badge follow status (Seguindo / Pendente / Erro).
- Canal-destino: badge admin (Admin OK / Sem permissão confirmada / Não verificado), clicável para refresh.
- Chips de filtro no topo: `Todos` `Grupos` `Canais` (client-side filter).

**Cadastro de canal — modal "Adicionar canal"** com 3 abas:
1. **Colar link** (default): input URL → botão "Buscar canal" chama `/resolve-channel-invite` → preview (nome, JID, badge admin). Submit chama `POST /api/groups` com `kind: 'channel'`.
2. **Seguidos**: lista de `GET /api/wa/channels` com clique pra preencher.
3. **JID manual** (colapsado): caixa `xxx@newsletter`. Mesmo pipeline de validação.

Banner informativo fixo acima do modal:
> Canais funcionam diferente de grupos: pra monitorar você precisa seguir o canal; pra postar você precisa ser admin do canal. Só cadastre canais onde você é admin como destino — tentar postar em canais alheios pode causar restrição na sua conta do WhatsApp.

Se role=post + `isViewerOwner === false`, exige checkbox "Sou admin mesmo assim, prosseguir" pra liberar submit.

Pós-cadastro de canal-monitor: dispara `POST /api/groups/:id/follow-now` em background; badge "Pendente" → "Seguindo" ou "Erro" inline.

Formulário existente de "Adicionar grupo manual" ganha radio "Tipo: Grupo / Canal" no topo. Selecionar Canal abre o modal; Grupo mantém o form atual.

Picker de grupos do WA permanece intacto. Banner sutil acima dele: "Pra cadastrar canais, use o botão 'Adicionar canal'."

## Edge cases (todos cobertos)

| Caso | Comportamento |
|---|---|
| URL inválida | 400 com mensagem; modal mostra inline. |
| `newsletterMetadata` retorna 404/erro | 404 amigável; "Canal não encontrado. Confira o link." |
| Worker offline | 503; botão de cadastro fica disabled se `session.status !== 'connected'`. |
| `follow-now` falha | Cadastro permanece (Group salvo); badge ⚠️ com tooltip + botão "Tentar novamente". |
| JID duplicado mesmo role | P2002 → 409 "Esse canal já está cadastrado". |
| Spam no refresh-admin | Debounce 2s + estado loading no botão. |
| role=post + não-dono + checkbox marcado | Cadastra. Send falha na primeira tentativa; Fase 3 corta retries. |
| Sessão desconecta durante follow-now | Timeout 10s rejeita, cadastro persiste; próxima `connection.open` cobre via `ensureChannelSubscriptions`. |
| Cache stale de admin (perdeu admin no canal) | Refresh manual resolve. Aceitável. |

## Testes

**Unitários (TDD estrito RED→GREEN→REFACTOR)**:
- `test/core/channelDirectory.test.js` — `metadata` (cache hit/miss/expired, isViewerOwner true/false), `follow` (novo/idempotente/erro Baileys), `listFollowed` (paralelo limitado, falha parcial).
- `test/manager.requestFromWorker.test.js` — happy path, timeout, worker-offline, correlationId único, response órfã, cleanup de timer no resolve.
- `test/api/routes/groups.channel.test.js` — resolve-invite (200/400/404/503), follow-now (200/503/timeout), refresh-admin, wa/channels.

**Não-regressão**:
- `npm test` full mantendo 197+ verdes.
- `dashboard/ npm run build` verde.

**Manual em staging (checklist da PR)**:
- Resolver link real de canal próprio → preview correto + badge "Admin OK".
- Cadastrar canal próprio como destino → enviar oferta de grupo monitor → chega no canal.
- Cadastrar canal alheio como destino (com checkbox de prosseguir) → MessageLog mostra erro forbidden + sem retries (Fase 3).
- Cadastrar canal qualquer como monitor → ver badge "Pendente" → "Seguindo" em segundos.
- Worker offline (parar `api-staging` momentaneamente): UI deve mostrar mensagem clara, não travar.

## Plano de commits / PR

Branch: `feat/channels-phase-4-ui` saindo de `develop`.

Commits (cada um verde isolado):
1. `feat(channels): manager.requestFromWorker — IPC bidirecional com correlationId + timeout`
2. `feat(channels): channelDirectory — handlers metadata/follow/listFollowed`
3. `feat(channels): rotas API resolve-channel-invite, follow-now, refresh-admin, wa/channels`
4. `feat(channels): UI dashboard — modal adicionar canal + badges + filtro + banner`
5. (opcional) `docs(channels): atualizar plan doc com decisões da Fase 4`

PR contra `develop`. Staging valida. Só depois `develop → main`.

## Riscos & limitações conhecidas

- IPC bidirecional novo: vazamento de listeners se timer não limpar. Mitigação: `try/finally` no manager + teste unitário de cleanup.
- `newsletterMetadata` por inviteCode em Baileys 6.7.16: a assinatura exata será verificada em `node_modules/@whiskeysockets/baileys/...` antes do RED do channelDirectory (não inventar API).
- Cache admin stale se a usuária perder admin: refresh manual resolve.
- `isViewerOwner` só identifica owner (limitação da Fase 3). Admins não-owner viram falso negativo no badge. Texto do badge é honesto sobre isso ("Sem permissão confirmada", não "Não é admin").

## Fora de escopo (Fase 5)

- Rate-limit / warmup específico pra canais.
- Renovação periódica de `subscribeNewsletterUpdates`.
- Telemetria de follows diários (anti-ban).
- Detecção de admin não-owner (depende de upgrade Baileys ou parse de payload bruto).
