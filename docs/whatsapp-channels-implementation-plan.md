# Plano de implementação — espelhamento de WhatsApp Channels

Status: **proposta** (não implementado). Última revisão: 2026-05-16.

## 1. Contexto e motivação

O BOTinho hoje opera só com **grupos do WhatsApp**: monitora grupos de
afiliados de terceiros (origem) e republica as ofertas, com links
convertidos para a tag de afiliado do cliente, nos grupos próprios do
cliente (destino). O bloco protegido (`src/converters/`, `src/detector.js`,
`src/credentialHealth.js`) faz essa conversão e está estável (PR #422).

**Pressão de mercado**: ao longo de 2025–2026, o WhatsApp vem banindo
grupos de ofertas em massa. Donos desses grupos estão migrando para
**Canais do WhatsApp** (newsletter/broadcast unidirecional). O produto
perde matéria-prima se ficar restrito a grupos.

**Demanda**: estender a lógica de espelhamento para cobrir qualquer par
origem→destino (grupo↔grupo, grupo↔canal, canal↔grupo, canal↔canal),
preservando a conversão de links existente.

## 2. Descobertas-chave da pesquisa (maio 2026)

### 2.1. Baileys 6.7.x já suporta canais

Os métodos `newsletterMetadata`, `newsletterFollow`, `newsletterUnfollow`,
`newsletterFetchMessages`, `newsletterMute`, e o uso de
`sendMessage(jid@newsletter, …)` para postar em canais existem desde a
linha 6.5+. A versão 6.7.16 (atual em produção) atende ao caso de uso.

Fonte: [Baileys repo (WhiskeySockets/Baileys)](https://github.com/WhiskeySockets/Baileys)

### 2.2. Baileys 7.x traz refinamentos marginais com custo desproporcional

A 7.x adiciona quote dentro de newsletter e upload path próprio para
mídia de canal. Em troca exige:
- Node ≥ 20.
- Schema de auth state novo (chaves `lid-mapping`, `device-list`, `tctoken`).
- **Re-pareamento obrigatório de todas as sessões existentes** — não há
  migração automática de `auth_info` 6.x → 7.x.

Esse último ponto causou o incidente de 2026-05-16 em staging
(`MessageCounterError`, `Bad MAC`, `ERR_MODULE_NOT_FOUND` no entry ESM)
quando a PR #450 (bump 6.7.16 → 7.0.0-rc11) foi mergeada em `develop`.
Revert em PR #451.

**Decisão**: ficar em 6.7.16. Revisitar 7.x só se aparecer feature
indispensável que justifique janela de re-pareamento global.

Fonte: [Baileys v7 migration guide](https://baileys.wiki/docs/migration/to-v7.0.0/)

### 2.3. Cliente só pode postar em canal do qual é admin/owner

A API de canal só aceita `sendMessage` quando a conta autenticada é
admin ou owner do canal de destino. Postar em canal de terceiro **não é
possível** pela API.

Implicação: o caso de uso "canal alheio como destino" não existe e sai
do escopo. As combinações reais são:

| Origem | Destino | Status |
|---|---|---|
| Grupo (alheio) | Grupo (próprio) | Já existe hoje |
| Grupo (alheio) | Canal (próprio, cliente admin) | Novo |
| Canal (alheio público) | Grupo (próprio) | Novo |
| Canal (alheio público) | Canal (próprio, cliente admin) | Novo |

### 2.4. Caminho oficial Meta não cobre o caso

WhatsApp Business Cloud API (em 2026, on-premise foi deprecated em
out/2025) suporta apenas mensagens 1:1 com clientes via templates
marketing/utility/service. **Não posta em canais** nem permite
**ler canais de terceiros**. Eliminado como alternativa.

Fonte: [WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api)

### 2.5. Scraping HTML do link público do canal não serve

A página `whatsapp.com/channel/<id>` renderiza SSR só com OG tags do
canal (nome, descrição, foto). Mensagens recentes vêm de WebSocket
privado pós-hidratação que exige sessão WA autenticada. Não dá pra ler
o feed sem conta logada. Eliminado.

### 2.6. Risco de banimento é alto e crescente

Issues reportadas em 2025–2026 (Baileys #1869, whatsmeow #810) descrevem
onda de bans detectada por fingerprint de protocolo, velocity de
operações e reply-ratio < 10%. O padrão "inscrever em muitos canais
rapidamente + repostar em escala" bate exatamente com a heurística de
farm que o WhatsApp combate.

**Mitigações obrigatórias** (seção 6).

Fonte: [Baileys ban wave issue #1869](https://github.com/WhiskeySockets/Baileys/issues/1869)

### 2.7. Alternativa whatsmeow (Go) fica em segundo plano

A biblioteca `tulir/whatsmeow` (usada por bridges Matrix em produção) é
tecnicamente mais sólida para canais e mais próxima do cliente oficial
WhatsApp (menor ban risk). Porém adiciona linguagem nova na stack
(Go) e exige microsserviço com bridge gRPC/HTTP para o Node atual.

**Decisão**: não adotar agora. Reavaliar se a Fase 5 (salvaguardas
anti-ban) não for suficiente — i.e., se observarmos bans nos clientes
mesmo com warmup + jitter + limites.

Fonte: [whatsmeow newsletter.go](https://github.com/tulir/whatsmeow/blob/main/newsletter.go)

## 3. Decisões adotadas

1. **Stack**: Baileys 6.7.16, sem upgrade.
2. **Schema**: extensão mínima — adicionar coluna `kind` em `Group`,
   sem nova tabela.
3. **Pipeline**: zero mudança no bloco protegido. Adicionar uma camada
   fina de adaptação JID que generaliza os 3 pontos hoje hard-coded em
   `@g.us`.
4. **UI**: dashboard ganha suporte a "tipo: grupo / canal" no fluxo de
   adicionar origem/destino. Canal entra por invite URL
   `https://whatsapp.com/channel/<id>`.
5. **Salvaguardas anti-ban são parte do escopo MVP**, não fase opcional
   futura.

## 4. Arquitetura

### 4.1. Migration Prisma (Fase 1)

```sql
-- prisma/migrations/<timestamp>_add_group_kind/migration.sql
ALTER TABLE "Group" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'group';
CREATE INDEX "Group_userId_kind_idx" ON "Group"("userId", "kind");
```

Compatibilidade: registros existentes ficam `'group'`. Nenhum código
quebra; comportamento inalterado até a Fase 2.

A tabela continua chamando `Group` por compatibilidade com o resto do
código. Semanticamente passa a representar **source/destination de
qualquer tipo**. O nome fica como dívida técnica de leitura — não vale
o refactor amplo agora.

### 4.2. Utility de JID (`src/core/jid.js`, novo)

Concentra a detecção e normalização hoje espalhada em pelo menos 3
pontos do código:
- `src/bot-worker.js:721` — `String(jid).endsWith('@g.us')`
- `src/api/routes/broadcast.js:10` — `jid.includes('@') ? jid : '${jid}@g.us'`
- `src/api/routes/groups.js:15` — `'${jid}@g.us'`

API mínima:

```js
export function detectKind(jid) {
  if (typeof jid !== 'string') return null
  if (jid.endsWith('@g.us')) return 'group'
  if (jid.endsWith('@newsletter')) return 'channel'
  return null
}

export function isMirrorableJid(jid) {
  return detectKind(jid) !== null
}

export function ensureJid(raw, kind) {
  // 'abc123' + kind='group' -> 'abc123@g.us'
  // 'abc123' + kind='channel' -> 'abc123@newsletter'
  // já tem '@' -> retorna como está (validando contra kind se fornecido)
}

export function parseChannelInviteUrl(url) {
  // 'https://whatsapp.com/channel/0029Va...' -> id
}
```

Testes em `test/jid.test.js` cobrindo todos os casos.

### 4.3. Subscrição a canais no boot do worker

`bot-worker.js` na inicialização carrega todos os `Group` com
`role='monitor'`. Para os com `kind='channel'`, chama
`sock.newsletterFollow(jid)`. Operação é idempotente — se já segue, o
Baileys ignora.

**Distribuição temporal** (anti-ban): não chamar todos em rajada. Usar
`smartDelay` (já existe) com jitter de 30–90s entre follows. Em conta
recém-pareada, limitar a N follows novos por dia (ver Fase 5).

### 4.4. Filtragem em `messages.upsert`

Substituir o filtro hoje específico para `@g.us`:

```js
// antes
if (cfg.botConfig.feedGlobal && !String(jid).endsWith('@g.us')) return

// depois
if (cfg.botConfig.feedGlobal && !isMirrorableJid(jid)) return
```

Mensagens de canais entram no mesmo pipeline. `messageProcessor`,
`monitoredImageResolver`, `messageDedup`, conversão de links — tudo
opera transparente.

### 4.5. Envio para canal-destino

Para destinos com `kind='channel'`:

1. Antes do primeiro envio (ou no boot), validar via
   `newsletterMetadata(jid)` que o usuário é admin/owner. Se não for,
   marcar o destino como `inactive` e expor erro no dashboard.
2. `sendMessage(jid@newsletter, payload)` funciona igual ao grupo na
   6.7.x — mesmo objeto de payload (text, image, document). A diferença
   técnica está no upload path da mídia, que o Baileys já abstrai.
3. **Não tentar quote/reply em canal** — comportamento instável na
   6.7.x. Forçar `quoted: undefined` no path de canal.

### 4.6. UI no dashboard

- Página atual `/dashboard/grupos` ganha rótulo de "Origens & Destinos".
- Formulário de adição:
  - Radio "Tipo": **Grupo** / **Canal**.
  - Se Grupo → fluxo atual (JID copiado do WhatsApp Web).
  - Se Canal → input de URL de convite
    `https://whatsapp.com/channel/<id>`. Backend resolve `newsletterMetadata`
    e salva nome/foto/JID.
- Listagem distingue visualmente grupo (ícone usuários) de canal (ícone
  megafone).
- Para destino-canal, exibir badge "✓ admin" ou "✗ sem permissão" baseado
  na validação periódica de `newsletterMetadata`.

### 4.7. Conversão de links (intacta)

`messageProcessor.buildProcessedMessage(text, conversions, brandingLink)`
recebe texto e devolve texto. O tipo de origem/destino é irrelevante
para essa camada. **Nenhuma alteração no bloco protegido.**

## 5. Fases de implementação

Cada fase = um PR contra `develop`, com deploy em staging e validação
manual antes de seguir.

### Fase 0 — Reverter Baileys 7.x ✅
Feito em PR #451 (revert da #450). Baileys de volta a 6.7.16.

### Fase 1 — Plumbing (sem comportamento novo)
- `src/core/jid.js` + `test/jid.test.js`.
- Migration `add_group_kind`.
- Refatorar os 3 hard-codes (`bot-worker.js:721`, `broadcast.js:10`,
  `groups.js:15`) para usar a utility.
- `package.json`: sem mudança de deps.

Critério de aceite: todos os testes passam (`npm test`), staging
continua funcionando idêntico ao anterior. Nenhum cliente afetado.

### Fase 2 — Leitura de canal (admin-only)
- `bot-worker.js`: no boot, listar `Group` com `kind='channel'` e
  `role='monitor'`, chamar `newsletterFollow` com smartDelay.
- Endpoint admin para cadastrar canal-monitor (`POST /api/admin/channels/monitor`).
- Validar canal real em staging: cadastrar 1 canal de ofertas, confirmar
  que `messages.upsert` recebe, conversão de link executa, envio para
  grupo-destino acontece.

Critério de aceite: 5+ ofertas reais de um canal chegando a um grupo
destino em staging por 24h sem regressão.

### Fase 3 — Postagem em canal-destino
- ~~Validação de admin via `newsletterMetadata` antes de salvar
  canal-destino.~~ **Deferido para Fase 5**: a interface
  `NewsletterMetadata` na Baileys 6.7.16 não expõe role do viewer
  (só tem `owner`), inviabilizando validação genérica upfront.
  Mitigação adotada: detectar erro de "forbidden" na resposta do
  `sendMessage` e short-circuit no retry loop (não consumir todas
  as tentativas em destinos permanentemente sem permissão).
- Adaptação no path de envio:
  - Bypass do `relayMessage` para canal-destino (reusa proto de
    upload de grupo, não compatível com canal).
  - Strip de `quoted` e `contextInfo` do payload (canais não
    suportam reply-context).
- Endpoint para cadastrar canal-destino: já contemplado em Fase 1
  (`POST /api/groups` aceita `kind='channel'` com `role='post'`).

Critério de aceite: ofertas de um grupo-monitor chegando a um
canal-destino próprio em staging, com mídia hi-res, por 24h.

## Fase 4 — UI no dashboard (IMPLEMENTADA)

**Status:** Implementada em PR #496. Branch `feat/channels-phase-4-ui`. Pendente validação manual em staging.

### Decisões consolidadas (alinhadas com a usuária via brainstorming)

1. **Cadastro de canal** aceita três caminhos no mesmo modal:
   - Link de convite (`https://whatsapp.com/channel/...`) — resolvido via `newsletterMetadata('invite', code)`.
   - Lista de canais já seguidos — via `listFollowedChannels` (derivado de `followedChannelJids` + metadata em paralelo).
   - JID manual (`xxx@newsletter`) — caminho fallback avançado.

2. **Follow de canal-monitor** acontece imediatamente após o cadastro, via IPC `channel:follow` no worker. Badge na UI mostra status `pendente → seguindo → erro`.

3. **Badge de admin** preventivo no canal-destino, com refresh manual. Limitação conhecida: Baileys 6.7.16 só expõe `owner` em NewsletterMetadata, não admins. Badge texto é honesto: "Admin OK" / "Sem permissão confirmada".

4. **Página única "Grupos e Canais"** com seletor de tipo no cadastro, badges de tipo na listagem (Grupo/Canal) e chips de filtro (Todos / Grupos / Canais).

### IPC API↔worker

Reusa o padrão existente `requestWithTimeout` em `sessionCore.js`. Novos exports:
- `channelMetadata(userId, { jid? | inviteCode? })`
- `followChannelImmediate(userId, jid)`
- `listFollowedChannels(userId)`

Handlers no worker recebem `channel:metadata`, `channel:follow`, `channel:listFollowed` e roteiam para `src/core/channelDirectory.js` (módulo puro, sock injetado).

### Rotas API novas (em `src/api/routes/groups.js`)

- `POST /api/groups/resolve-channel-invite` — body `{ url }`
- `POST /api/groups/resolve-channel-jid` — body `{ jid }`
- `POST /api/groups/:id/follow-now` — para canal-monitor cadastrado
- `POST /api/groups/:id/refresh-admin` — re-checa admin de canal-destino
- `GET /api/groups/wa/channels` — lista canais seguidos com metadata

Todas as rotas validam `isRunning(userId)` (503 se worker offline) e usam dependency injection para serem testáveis.

### Testes

- `test/core/channelDirectory.test.js` — 14 testes (metadata, follow idempotente, listFollowed)
- `test/api/routes/groups.channel.test.js` — 13 testes para as 5 rotas
- Suite full: 224+ verdes

### Componentes novos no dashboard

- `dashboard/components/AddChannelModal.js` — modal 3 abas (link / seguidos / JID)
- `dashboard/components/ChannelStatusBadges.js` — TypeBadge, FollowBadge, AdminBadge

### Smoke manual pós-merge staging

1. Resolver link de canal próprio → preview com "Admin OK"
2. Cadastrar canal-destino próprio → mensagem chega no canal
3. Cadastrar canal-monitor → badge "Pendente" → "Seguindo" em segundos
4. Cadastrar canal alheio como destino (com checkbox) → erro forbidden + sem retries (Fase 3 já cobre)
5. JID manual → preview funciona
6. Refresh admin badge → status atualiza
7. Worker offline → 503 com mensagem clara
8. Filtro chips funcionando

### Fase 5 — Salvaguardas anti-ban
- Limite diário de novos `newsletterFollow` por sessão (default 3,
  configurável via `BotConfig`).
- Warmup: contas novas começam com limite reduzido, sobe ao longo de
  semanas.
- Aviso explícito no onboarding: "use conta dedicada, não a pessoal".
- Telemetria: contar follows/dia/conta, alertar quando sessão se
  aproxima do limite.
- Opcional: pausa automática se o WhatsApp emitir sinal de
  rate-limiting (`stream:error` com motivo específico).

Critério de aceite: documentação operacional + dashboards de
monitoramento + nenhum ban em staging em 14 dias de operação real.

## 6. Salvaguardas anti-ban (não opcionais)

Resumo das mitigações que entram **obrigatoriamente** até a Fase 5:

| Salvaguarda | Onde | Default |
|---|---|---|
| Jitter humano entre follows | `smartDelay` | 30–90s |
| Limite diário de novos follows | `BotConfig.maxDailyFollows` | 3 |
| Warmup gradual | sessões com idade < 7d limitam a 1/dia | — |
| Aviso "conta dedicada" | onboarding UI | obrigatório |
| Telemetria de follows | `MessageLog`-like, novo `FollowLog` | — |
| Pausa em rate-limit | listener de `stream:error` no Baileys | auto |
| Reply-ratio mínimo | bot já não responde — não aplicável | — |

**Não confiar em uma única salvaguarda**. Defesa em profundidade.

## 7. Riscos e questões abertas

### 7.1. Risco de regressão na conversão de links
O bloco protegido não é alterado, mas a feature **adiciona um caminho**
em que mensagens vêm de canal. Garantir cobertura de teste com fixtures
de mensagem-canal real (capturar 3–5 amostras em staging na Fase 2 e
versionar em `test/fixtures/`).

### 7.2. Mídia em canal pode ter formato diferente
A 6.7.x suporta envio para canal, mas a estrutura de
`messageProto.imageMessage` em mensagens **recebidas** de canal pode
diferir sutilmente. Validar em staging com canais reais antes da Fase 4.

### 7.3. Limite de canais inscritos por conta
Não documentado oficialmente, mas relatos comunitários sugerem ~2000
canais por conta. Para o BOTinho (3–20 canais por cliente), é folga
suficiente. Monitorar.

### 7.4. Migração futura para Baileys 7.x ou whatsmeow
Decisão adiada. Reabrir discussão se:
- Surgir feature da 7.x indispensável (ex.: suporte a comunidades
  evoluído), **ou**
- Observarmos bans frequentes em clientes mesmo com salvaguardas (Fase 5).

### 7.5. Postagem em canal alheio é impossível pela API
Já considerado. Combinações suportadas estão listadas na seção 2.3.
Comunicar isso na UI quando o cliente tentar marcar canal alheio como
destino.

## 8. Anexos — referências completas

- [Baileys v7 migration guide](https://baileys.wiki/docs/migration/to-v7.0.0/)
- [WhiskeySockets/Baileys repo](https://github.com/WhiskeySockets/Baileys)
- [whatsmeow newsletter.go](https://github.com/tulir/whatsmeow/blob/main/newsletter.go)
- [mautrix April 2026 release](https://mau.fi/blog/2026-04-mautrix-release/)
- [whatsapp-web.js channel video bug #5689](https://github.com/wwebjs/whatsapp-web.js/issues/5689)
- [WAHA newsletter dropped #1863](https://github.com/devlikeapro/waha/issues/1863)
- [wppconnect releases](https://github.com/wppconnect-team/wppconnect/releases)
- [open-wa/wa-automate-nodejs](https://github.com/open-wa/wa-automate-nodejs)
- [Baileys ban wave issue #1869](https://github.com/WhiskeySockets/Baileys/issues/1869)
- [whatsmeow "account at risk" #810](https://github.com/tulir/whatsmeow/issues/810)
- [WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- PR #450 (bump Baileys 7.0.0-rc11 — **não merge**, foi revertido)
- PR #451 (revert da #450, restaurou 6.7.16)
- PR #422 (configuração canônica dos image scrapers — bloco protegido)
