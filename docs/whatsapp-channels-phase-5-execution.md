# Fase 5 — Plano técnico de execução (PR-a-PR)

Companion executável do `whatsapp-channels-implementation-plan.md`.
Cada item abaixo é **um PR contra `develop`**, validado em staging antes
do próximo. Status: Fases 0–4 prontas (Fase 4 em PR #496, staging
pendente). Este doc cobre **só Fase 5**.

## Ordem por valor defensivo (recomendada)

1. PR-5.0 — Foundations (schema + helpers, sem comportamento)
2. PR-5.A — Anti-ban no follow
3. PR-5.C.1 — `ChannelHealth` + listeners (detecção antes de fazer
   mais postagens)
4. PR-5.B.1 — Velocity scheduler por canal-destino
5. PR-5.F — Snapshot diário (paraquedas, baixo custo)
6. PR-5.B.2 — Variação de copy + imagem + stagger
7. PR-5.C.3 — Probe ativo
8. PR-5.E.2 — Guardrails de UI (título/copy enganosa)
9. PR-5.E.3 — Report risk score
10. PR-5.C.4 — Sinal indireto via cliques de afiliado
11. PR-5.B.3/4 — Humanização (reactions, presence) — opcional

Lógica do ordering: **detectar antes de regularizar antes de variar**.
Health (5.C.1) vem antes do scheduler (5.B.1) porque sem detecção a
gente não sabe se os defaults do scheduler estão certos.

---

## PR-5.0 — Foundations (schema + helpers neutros)

**Objetivo:** migrations + utilitários puros, sem mudar comportamento
em produção. Merge seguro em qualquer momento.

**Arquivos novos:**
- `prisma/migrations/<ts>_phase5_foundations/migration.sql`
- `src/core/followGuard.js` (skeleton, retorna sempre `{ ok: true }`)
- `src/core/channelThrottle.js` (skeleton, idem)
- `src/core/channelHealth.js` (skeleton)
- `test/core/followGuard.test.js`
- `test/core/channelThrottle.test.js`
- `test/core/channelHealth.test.js`

**Migration:**

```sql
ALTER TABLE "BotConfig" ADD COLUMN "maxDailyFollows" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "BotConfig" ADD COLUMN "channelMinIntervalSec" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "BotConfig" ADD COLUMN "channelBurstCap" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "BotConfig" ADD COLUMN "channelBurstWindowSec" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE "BotConfig" ADD COLUMN "channelDailyCap" INTEGER;
ALTER TABLE "BotConfig" ADD COLUMN "channelStaggerJitterMs" INTEGER NOT NULL DEFAULT 90000;
ALTER TABLE "BotConfig" ADD COLUMN "channelQuietHoursJson" TEXT NOT NULL DEFAULT '{"startHour":0,"endHour":6,"tz":"America/Sao_Paulo"}';
ALTER TABLE "BotConfig" ADD COLUMN "imageMutationEnabled" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BotConfig" ADD COLUMN "copyVariationPoolJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "BotConfig" ADD COLUMN "probeAccountSessionId" TEXT;
ALTER TABLE "BotConfig" ADD COLUMN "probeEnabled" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "FollowLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT NOT NULL,
  "channelJid" TEXT NOT NULL,
  "status" TEXT NOT NULL,           -- 'ok' | 'error' | 'rate_limited'
  "error" TEXT,
  "followedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "FollowLog_userId_followedAt_idx" ON "FollowLog"("userId", "followedAt");

CREATE TABLE "ChannelHealth" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "groupId" TEXT NOT NULL UNIQUE,    -- ref ao Group (canal-destino)
  "status" TEXT NOT NULL DEFAULT 'green',  -- green|yellow|red|critical
  "lastError" TEXT,
  "errorRate1h" REAL NOT NULL DEFAULT 0,
  "latencyP95_1h" INTEGER,
  "lastProbeSeenAt" DATETIME,
  "lastPostedAt" DATETIME,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "pausedUntil" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelHealth_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);
CREATE INDEX "ChannelHealth_status_idx" ON "ChannelHealth"("status");

CREATE TABLE "ChannelThrottle" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "groupId" TEXT NOT NULL UNIQUE,
  "lastPostAt" DATETIME,
  "burstWindowStart" DATETIME,
  "postsInBurstWindow" INTEGER NOT NULL DEFAULT 0,
  "postsToday" INTEGER NOT NULL DEFAULT 0,
  "dayBucket" TEXT NOT NULL DEFAULT '',   -- yyyy-mm-dd
  CONSTRAINT "ChannelThrottle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);

CREATE TABLE "ChannelSnapshot" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "inviteLink" TEXT,
  "snapshotJson" TEXT NOT NULL,
  "snapshotedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelSnapshot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);
CREATE INDEX "ChannelSnapshot_groupId_snapshotedAt_idx" ON "ChannelSnapshot"("groupId", "snapshotedAt");
```

**Aceite:** migration aplica em staging sem perda de dados; suite full
verde; nenhum efeito observável em runtime.

---

## PR-5.A — Anti-ban no follow

**Arquivos:**
- `src/core/followGuard.js` — implementação
- `src/core/channelDirectory.js` — chamar `followGuard.canFollowNow(userId)` antes de `newsletterFollow`
- `src/bot-worker.js` — listener de `stream:error` (rate-overlimit / not-authorized) → pausar follows da sessão
- `src/api/routes/groups.js` — endpoint `POST /api/groups/:id/follow-now` rejeita com 429 se guard nega
- Dashboard: badge "limite diário atingido" na lista de canais

**API de `followGuard`:**

```js
// retorna { ok: true } ou { ok: false, reason, retryAfterMs, dailyUsed, dailyCap }
canFollowNow(userId, { now = Date.now() } = {})

logFollow(userId, channelJid, status, error?)
```

**Regras:**
- Conta últimos `FollowLog` com `status='ok'` em janela 24h.
- `dailyCap = warmupCap(sessionAgeDays) ?? BotConfig.maxDailyFollows`
- `warmupCap`: idade < 1d → 1; < 3d → 1; < 7d → 2; ≥ 7d → `maxDailyFollows`.
- Intervalo mínimo entre 2 follows da mesma sessão: 30s + jitter (reusa `smartDelay`).

**Listener stream:error:**

```js
sock.ev.on('connection.update', (u) => { /* já existe */ })
sock.ws.on('CB:stream:error', (node) => {
  const reason = node?.attrs?.code || node?.children?.[0]?.tag
  if (reason === 'rate-overlimit') quarantineFollow(userId, '1h')
  if (reason === 'not-authorized' || reason === 'forbidden') alertCritical(userId)
})
```

**Aceite:** 30 follows tentados em sequência → só `maxDailyFollows`
passa, resto retorna 429 com retry-after. `FollowLog` tem registros.
Smoke staging com 1 conta nova: warmup de 1/dia visível.

---

## PR-5.C.1 — `ChannelHealth` + listeners (detecção)

**Arquivos:**
- `src/core/channelHealth.js` — funções `recordSendResult`, `recordStreamError`, `recomputeHealth`, `getHealth`
- `src/bot-worker.js` — após cada `sendMessage` em canal, chamar `recordSendResult`
- `src/api/routes/groups.js` — `GET /api/groups/:id/health`
- `dashboard/components/ChannelStatusBadges.js` — adicionar `HealthBadge` (🟢🟡🔴⚫)
- Worker periódico: a cada 5 min, `recomputeHealth` de todos os canais ativos (errorRate1h, latencyP95)

**API:**

```js
recordSendResult(groupId, { ok, latencyMs, errorCode, messageId })
  // atualiza lastPostedAt, consecutiveFailures, lastError
  // transição de estado conforme tabela 5.C.5

recordStreamError(userId, code)
  // 'rate-overlimit' → todos canais da sessão amarelo
  // 'not-authorized'/'forbidden' → critical (sessão inteira)

getHealth(groupId) → { status, lastError, ... }
```

**Transições (worker periódico + on-event):**
- `errorRate1h > 0.05` ou `latencyP95 > 3x baseline` → yellow
- `consecutiveFailures >= 3` com `403/401` → red, `pausedUntil = now + 1h`
- `stream:error: forbidden` → critical, pausar todas as sessões; alerta no dashboard

**Aceite:** simular 5 erros 403 consecutivos em staging em um canal →
`status='red'`, `pausedUntil` setado, envio bloqueado no caminho do bot
worker. Badge aparece na UI.

---

## PR-5.B.1 — Velocity scheduler por canal-destino

**Arquivos:**
- `src/core/channelThrottle.js` — implementação
- `src/bot-worker.js` — caminho de envio para `kind='channel'`: passar pelo throttle antes de `sendMessage`
- Worker periódico: reset diário do `dayBucket` e `postsToday`

**API:**

```js
// returns { allow: true } | { allow: false, deferUntil: <ts>, reason }
checkAndReserve(groupId, botConfig, { now = Date.now() } = {})

// chamado após envio bem-sucedido
recordPost(groupId, { now })
```

**Regras (em ordem de cheque):**
1. `ChannelHealth.pausedUntil > now` → recusa.
2. Quiet hours (parsed do `channelQuietHoursJson`) → defer até fim do quiet.
3. `postsToday >= channelDailyCap` (se setado) → defer 24h.
4. `lastPostAt + channelMinIntervalSec + jitter > now` → defer até o gap fechar.
5. `postsInBurstWindow >= channelBurstCap` (janela móvel `channelBurstWindowSec`) → defer até reset da janela.
6. Senão `allow=true`, reserva slot.

**Integração com fila atual:** se hoje o envio é síncrono no
`bot-worker.js`, encaixar um `setTimeout(deferUntil - now)` quando
recusa, ou jogar num `setImmediate` loop. Não substituir BullMQ/Redis
se já existir (ver `REDIS_BULLMQ_QUEUE_PLAN.md`).

**Aceite:** disparar 10 posts pro mesmo canal em 1s → só 1 sai
imediato, restantes ficam espaçados ≥ `channelMinIntervalSec`.
Em quiet hours, todos defer para fim do quiet.

---

## PR-5.F — Snapshot diário do canal

**Arquivos:**
- `src/jobs/channelSnapshot.js` — job que itera canais (`kind='channel'`, `role='post'`), pega `newsletterMetadata` via IPC, persiste `ChannelSnapshot`
- Cron: 1x/dia (03:00 BRT, depois do backup_prod)
- `src/api/routes/groups.js` — `GET /api/groups/:id/snapshots`, `POST /api/groups/:id/recreate` (recebe novo JID, re-aplica metadata, re-roteia targets)
- Dashboard: aba "Snapshots" + botão "recriar canal"

**API recreate:**

```js
POST /api/groups/:id/recreate
body: { newJid: 'xxxxx@newsletter' }
// 1. valida que newJid é admin via newsletterMetadata
// 2. lê último ChannelSnapshot, aplica nome/descrição (se permitido pelo Baileys)
// 3. UPDATE Group SET waJid = newJid WHERE id = :id
// 4. GroupTarget continua válido (referencia id, não jid)
```

**Aceite:** snapshot rodando diariamente em staging por 3 dias com 1
canal-destino. Tabela `ChannelSnapshot` cresce. Botão "recriar" troca
JID e mantém targets.

---

## PR-5.B.2 — Variação (copy + imagem + stagger)

**Arquivos:**
- `src/core/copyVariation.js` — `applyVariation(text, { groupId, poolJson })`
- `src/core/imageMutation.js` — `mutate(buffer, mimetype, { groupId })` retorna `{ buffer, mimetype }`. Usa `sharp` (já em deps? checar).
- `src/bot-worker.js` — no path de envio pra canal, aplicar `applyVariation` no texto e `mutate` no buffer **depois** do scraper. **Não tocar `src/converters/`** (bloco protegido).
- Stagger: quando 1 fonte fan-out pra N destinos, scheduler do PR-5.B.1 sorteia `delayPerDestination = random(0, channelStaggerJitterMs)` para cada destino além do primeiro.

**Pool de copy (JSON em `BotConfig.copyVariationPoolJson`):**

```json
{
  "greetings": ["", "🔥 ", "💥 ", "⚡ "],
  "ctas": ["Confira:", "Pega já:", "Olha essa:", "Não perde:"],
  "trailers": ["", " 👀", " 💸", " 🎯"]
}
```

`applyVariation` substitui placeholders `{{greeting}}` `{{cta}}`
`{{trailer}}` ou apenas concatena com índice baseado em
`hash(groupId + date)`.

**Image mutation regras invioláveis:**
- Aplicada **após** `src/converters/imageScrapers.js` ter resolvido o
  buffer. Nunca dentro do bloco protegido.
- Só se `imageMutationEnabled=true`.
- Recompress JPEG com `quality = 85 + (hash(groupId+date) % 8)` → 85–92.
- Crop 0–2px em uma borda aleatória. Validar `width/height >=
  IMAGE_HIRES_MIN_DIMENSION_PX` (800) após crop — se cair abaixo,
  pula a mutação.
- Mantém mimetype.

**Aceite:** 1 fonte → 3 destinos, conteúdo idêntico de entrada:
- 3 textos diferentes saem (variação de copy).
- 3 buffers com hash MD5 diferente (variação de imagem).
- 3 instantes de envio espaçados em até `channelStaggerJitterMs`.

---

## PR-5.C.3 — Probe ativo

**Arquivos:**
- Migration: nenhuma (campos `probeAccountSessionId`, `probeEnabled` já vieram no PR-5.0).
- `src/core/channelProbe.js` — handler que, na sessão-probe, observa `messages.upsert` em canais que o tenant marca como destinos. Atualiza `ChannelHealth.lastProbeSeenAt`.
- `src/bot-worker.js` — quando a sessão for a probe (campo na WaSession ou flag), só rodar handler de probe (não envia, não converte).
- Worker periódico (já no PR-5.C.1): se `lastPostedAt - lastProbeSeenAt > 1h` para canais com posts recentes → status red.
- Dashboard: tela de config do probe — selecionar uma sessão WA como "probe" do tenant.

**Aceite:** com 1 sessão probe e 1 canal-destino, post pelo admin
aparece com `lastProbeSeenAt` atualizado em <1min. Bloquear admin de
postar (simular shadowban) → após 1h, `status='red'`.

---

## PR-5.E.2 — Guardrails de UI

**Arquivos:**
- `src/core/copyLinter.js` — funções puras `lintChannelTitle`, `lintCopyTemplate`. Devolvem `{ warnings: [...] }`.
- `dashboard/components/AddChannelModal.js` — chamar lint no submit, exibir warnings (não bloqueia, só alerta).
- `dashboard/components/CopyEditor.js` (novo, se ainda não existe) — para o pool `copyVariationPoolJson`.

**Regras de lint (heurísticas simples):**
- Título do canal contém marca conhecida (`/amazon|shopee|mercado.?livre|magalu|aliexpress/i`) **sem** prefixo permitido ("ofertas de", "achados de") → warning impersonação.
- Copy template contém claims duros: `/\b(\d{2,3})\s*%\s*off\b/i`, `/\bultima(s)?\s+pe[çc]a/i`, `/\bclique\s+agora\b/i` → warning enganoso.
- Título genérico só (`/^(promo|ofertas?|achados?)$/i`) → warning "pouco descritivo".

**Aceite:** cadastro de canal "Amazon Ofertas BR" mostra warning de
impersonação. Template "99% OFF" mostra warning de claim. Lint não
bloqueia salvar.

---

## PR-5.E.3 — Report risk score

**Arquivos:**
- `src/core/reportRiskScore.js` — função pura `computeScore({ postsPerDay, followerCount, clickRate, sourceDiversity })`
- Worker periódico atualiza `ChannelHealth.reportRiskScore` (nova coluna, migration aditiva neste PR).
- Dashboard: card de score (0–100) na página do canal-destino.

**Coleta de dados:**
- `postsPerDay`: agregação do `MessageLog` por canal (já existe?).
- `followerCount`: do `newsletterMetadata` (snapshot mais recente).
- `clickRate`: depende do tracker de afiliado se existir; senão, marcar `null` e score sem essa dimensão.
- `sourceDiversity`: distinct(monitorId) de `GroupTarget` que apontam pro canal.

**Fórmula (heurística inicial, ajustar com dados reais):**

```
score = clamp(0, 100,
  40 * normPostsPerFollower          // > 0.5 posts/follower/dia = ruim
  + 30 * (1 - clickRateOrFallback)
  + 30 * (1 - diversityScore)
)
```

**Aceite:** canal com 1 fonte, 0 cliques, 10 posts/dia, 50 followers
→ score próximo de 100. Canal com 5 fontes, click rate sadio, 2
posts/dia, 500 followers → score < 30.

---

## PR-5.C.4 — Sinal indireto via cliques de afiliado

**Pré-requisito:** tracker de cliques existir (verificar — pode estar
fora do escopo atual). Se não existir, **PR é skip ou bloqueado**.

**Arquivos:**
- `src/core/affiliateClickHealth.js` — calcula baseline 7d de cliques/canal, alerta se drop > 70% por > 48h.
- Integra com `channelHealth.recomputeHealth` (transição yellow → red).

---

## PR-5.B.3/4 — Humanização (opcional, baixa prioridade)

**Avaliar pós-staging:** se health permanecer verde por 14d com
PRs 5.A–5.F, esse PR pode ficar deferido indefinidamente. Mecânica:

- `src/jobs/humanizer.js` — cron 1x/dia por canal-destino:
  - sorteia 1–2 posts antigos (últimos 7d), aplica reaction (emoji
    aleatório de pool).
  - 1x/semana, pin/unpin de post recente.
- Presence heartbeat: a sessão admin envia `presence: available` em
  janelas plausíveis (08–22 BRT), não só no instante do post.

---

## Testes (padrão por PR)

Cada PR acima leva:
- Testes unitários do módulo novo (`test/core/*.test.js`).
- Testes de integração no caminho de envio (com mock Baileys).
- Smoke manual em staging documentado no PR description.

Suite completa (`npm test`) precisa continuar verde. Hoje 224+ verdes
(Fase 4).

## Riscos por PR

| PR | Risco principal | Mitigação |
|---|---|---|
| 5.0 | Migration corrompe `BotConfig` | `ADD COLUMN ... DEFAULT` é safe em SQLite; testar em cópia da staging.db antes |
| 5.A | Travar follows legítimos do cliente | Default 3/dia é folgado; UI mostra contador; cliente pode subir manualmente |
| 5.C.1 | Falso positivo de "red" pausa canal saudável | Threshold conservador (3 falhas consecutivas, não % bruto); cliente pode "force unpause" |
| 5.B.1 | Atraso visível no fan-out (cliente reclama) | Métrica de latency exposta no dashboard; defaults documentados |
| 5.F | Snapshot pesa no banco | Rotação automática: manter só últimos 30 snapshots por canal |
| 5.B.2 | Mutação de imagem cai abaixo de 800px | Validação obrigatória pós-mutação; pula se cair |
| 5.C.3 | Probe seguir muitos canais derruba a probe | Probe segue só canais-destino do próprio tenant (3–20), não escala |
| 5.E.2 | Falso positivo de lint irrita cliente | Warning, não bloqueio. Não persiste estado |
| 5.E.3 | Score impreciso causa decisão errada | Não automatizar ação só por score; só exibir |

## Defaults consolidados (cheat sheet)

```
maxDailyFollows          3
channelMinIntervalSec    30
channelBurstCap          6 em 10 min
channelDailyCap          (sem default — opcional)
channelStaggerJitterMs   90000  (90s)
channelQuietHours        00:00–06:00 BRT
imageMutationEnabled     true
probeEnabled             false (cliente opta)
warmup follow            <1d:1, <3d:1, <7d:2, >=7d:N
health pause após        3 falhas 403 consecutivas, 1h
snapshot retention       30/canal
```

## Critério de aceite global da Fase 5

- Todos os PRs 5.0–5.F merged em `develop` e validados em staging.
- 14 dias corridos em staging com pelo menos 1 cliente real, 1 probe
  ativo, sem ban e sem regressão de conversão de link.
- `ChannelHealth` cobrindo 100% dos canais-destino.
- Dashboard expondo: status do canal, score de risco, contador diário
  de follows, snapshot mais recente.

Só então abrir PR `develop → main`.
