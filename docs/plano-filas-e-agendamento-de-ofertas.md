# Plano: Filas de envio + Agendamento na "Criar oferta"

> **Para a IA desenvolvedora:** este documento é a especificação completa da
> feature. Leia o `AGENTS.md` da raiz ANTES de começar — as regras dele valem
> integralmente e este plano não as substitui. A seção "O QUE NÃO PODE SER
> FEITO" no final é vinculante.

## 1. Dor do cliente e objetivo

Hoje, ao criar uma oferta no painel (`/painel/criar-oferta`), o usuário só
consegue **copiar** a mensagem (clipboard). Não há envio direto da página, nem
agendamento, nem fila. O objetivo:

1. Na página **Criar oferta**, adicionar três modos de despacho:
   - **Enviar agora** — dispara imediatamente para os grupos escolhidos.
   - **Agendar** — usuário escolhe dia e hora; a oferta sai sozinha no horário.
   - **Inserir na fila X** — a oferta entra numa fila nomeada que **drena
     sozinha** respeitando os limites configurados na fila.
2. Nova página **`/painel/filas`** para CRUD de filas. Cada fila tem nome e
   parâmetros de preservação, **cada parâmetro com um toggle on/off que revela
   o campo de valor quando ativado**:
   - Intervalo mínimo entre ofertas (minutos)
   - Máximo de ofertas por hora
   - Máximo de ofertas por dia

**Decisões de produto já tomadas com a cliente (não rediscutir):**
- Na visualização da fila pelo cliente, a oferta pode aparecer **sem foto**.
- No momento do envio ao grupo, a mensagem **TEM que ir com a foto do
  produto**.
- A fila **drena automaticamente** respeitando os limites (não é só etiqueta).

## 2. O que já existe (reaproveitar, não reinventar)

| Peça | Onde | Estado |
|---|---|---|
| Scrape/montagem de oferta | `src/converters/offerEngine.js` → `buildScrapedOffer()`; rota `POST /api/link-conversion/scrape-offer` | Pronto. **Não tocar.** |
| Página Criar oferta | `dashboard/app/painel/criar-oferta/page.js` | Só "Copiar oferta". Vamos adicionar o bloco de despacho. |
| Envio imediato (texto) | `POST /api/broadcast/send` em `src/api/routes/broadcast.js` → `sendBroadcast()` de `src/manager.js` | Pronto para texto. Hoje a rota **não repassa `options`** — precisa passar `imageUrl`. |
| **Envio com imagem por URL** | `bot-worker.js` ~linhas 788–815: `options.imageUrl` vira receita `{type:'imageUrl', text, imageUrl, refererUrl}`; a imagem é baixada via `fetchImageBuffer` + `normalizeImageForWhatsApp` **no momento do envio**, com fallback gracioso para texto se o download falhar | **Pronto.** É o mecanismo canônico — só persiste URL, nunca Buffer. |
| Agendamento (texto) | Model `ScheduledMessage` (prisma/schema.prisma ~linha 297: `text`, `targetJids` JSON, `scheduledAt`, `sentAt`, `status`); rotas `GET/POST /api/broadcast/scheduled` e `DELETE /api/broadcast/scheduled/:id`; loop `checkScheduledMessages()` no `bot-worker.js` (~linha 409, `setInterval` 30s, claim atômico via `updateMany status pending→queued`) | Pronto para texto puro. Vamos **estender** com `imageUrl` opcional. |
| Página de agendados | `dashboard/app/painel/agendados/page.js` | Lista/cancela. Os agendamentos de oferta aparecem aqui automaticamente. |
| Tick recorrente padrão | `src/offerAutomation/cron.js`: `startOfferAutomationCron()` com `setInterval` 60s, iniciado em `src/api/server.js`; decide "due" em `src/offerAutomation/schedule.js`; envia via `sendBroadcast` (funciona em modo inline E remote do supervisor) | **Padrão a copiar** para o drainer das filas. |
| Throttle por grupo (anti-ban global) | `src/core/channelThrottle.js` + `BotConfig` (`channelMinIntervalSec`, `channelBurstCap`, `channelDailyCap`, quiet hours) | Continua valendo como segunda camada. Os limites da fila são **adicionais**, não substituem. |
| Padrão CRUD de rota autenticada | `src/api/routes/offerAutomation.js` (`onRequest: [app.authenticate]`, ownership por `userId: req.user.sub`) | Copiar o padrão. |
| Padrão de página CRUD no painel | `dashboard/app/painel/ofertas-automaticas/page.js` + `usePainelHeader` + `PainelTopbarAction` (de `PainelShell.js`) + `dashboard/lib/api.js` (`apiFetch`) | Copiar o padrão. |
| Menu lateral | `dashboard/app/painel/nav.js` — grupo `Configuração` | Adicionar item "Filas". |

## 3. Arquitetura proposta

### 3.1 Novos models Prisma (migration ADITIVA, nada de alterar tabela existente além do indicado)

```prisma
model OfferQueue {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String
  enabled         Boolean  @default(true)
  // Parâmetros de preservação — toggle + valor. Toggle off = valor ignorado.
  intervalEnabled Boolean  @default(false)
  intervalMinutes Int      @default(30)
  hourlyCapEnabled Boolean @default(false)
  hourlyCap       Int      @default(10)
  dailyCapEnabled Boolean  @default(false)
  dailyCap        Int      @default(50)
  lastSentAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  items OfferQueueItem[]

  @@index([userId, enabled])
}

model OfferQueueItem {
  id          String     @id @default(cuid())
  queueId     String
  queue       OfferQueue @relation(fields: [queueId], references: [id], onDelete: Cascade)
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  text        String      // mensagem final já montada (template aplicado)
  imageUrl    String?     // URL da imagem do produto — NUNCA buffer/binário
  imageRefererUrl String? // opcional, referer para o fetch da imagem
  targetJids  String      // JSON array de JIDs destino (igual ScheduledMessage)
  status      String     @default("pending") // pending|queued|sent|failed|cancelled
  position    Int         // ordem FIFO dentro da fila
  sentAt      DateTime?
  createdAt   DateTime   @default(now())

  @@index([queueId, status, position])
  @@index([userId, status])
}
```

E **uma coluna nova opcional** no model existente (não mexer em mais nada
dele):

```prisma
model ScheduledMessage {
  // ... campos existentes intactos ...
  imageUrl        String?   // NOVO, nullable — retrocompatível
  imageRefererUrl String?   // NOVO, nullable
}
```

Adicionar as relações `offerQueues OfferQueue[]` e
`offerQueueItems OfferQueueItem[]` no model `User`.

Migration: `npx prisma migrate dev --name add_offer_queues_and_scheduled_image`.
Só `CREATE TABLE` + `ALTER TABLE ADD COLUMN` nullable — nada destrutivo.

### 3.2 De onde vem a foto do produto

`buildScrapedOffer()` **não** retorna imagem hoje. A rota
`POST /api/link-conversion/scrape-offer` deve ser estendida para, **após** o
resultado do motor, tentar resolver a URL da imagem hi-res chamando o scraper
existente em `src/converters/imageScrapers.js` a partir do `finalUrl` (usar a
função pública que o pipeline de espelhamento já usa para obter a URL da
imagem — localizar o export correto no arquivo; NÃO duplicar lógica de
scraping). Regras:

- A resposta da rota ganha campo opcional `imageUrl` (e `imageRefererUrl` se o
  scraper fornecer). Falha no scrape de imagem **não** quebra a rota — campo
  fica `null` e a oferta segue sem foto.
- **Não** alterar `buildScrapedOffer()` em si nem seu contrato
  (`keepOriginalLink`, consumidores Telegram/painel). Se for mais limpo
  acrescentar a busca de imagem dentro do `offerEngine` como campo extra
  opcional do retorno, pode — desde que o bot do Telegram e os testes
  existentes (`test/offer-engine.test.js`, `test/telegram-offer-bot.test.js`,
  `test/link-conversion-route.test.js`) continuem passando sem alteração de
  comportamento.
- O frontend guarda a `imageUrl` no estado da oferta gerada e a envia nos três
  modos de despacho. Persiste-se **somente a URL**; o download acontece no
  bot-worker na hora do envio (mecanismo já existente).

### 3.3 Envio agora (com foto)

Estender `POST /api/broadcast/send` (`src/api/routes/broadcast.js`) para
aceitar `imageUrl` e `imageRefererUrl` opcionais no body e repassar como 4º
argumento: `sendBroadcastImpl(userId, text, targetJids, { imageUrl,
imageRefererUrl })`. O caminho `manager.js → sessionCore/supervisor →
bot-worker` já transporta `options` — não mexer neles.

Manter intactos: validação de `text`, gate de canais por plano
(`enforceChannelPlanGate`), fallback para grupos `role: 'post'`.

### 3.4 Agendar (com foto)

- `POST /api/broadcast/scheduled` passa a aceitar `imageUrl`/`imageRefererUrl`
  opcionais e gravá-los no `ScheduledMessage`. Validações existentes (data
  futura, gate de plano) intactas.
- No `bot-worker.js`, `checkScheduledMessages()` (~linha 409): quando
  `msg.imageUrl` existir, montar o job com a mesma receita de imagem usada
  pelo broadcast (reusar `buildBroadcastRecipe`/o resolvedor pós-dequeue das
  linhas ~788–815 — extrair helper se necessário, sem duplicar o fetch). Sem
  `imageUrl`, comportamento atual byte a byte.
- O claim atômico (`updateMany pending→queued`), o `onDone` que marca
  `sent/failed` e a criação de `MessageLog` permanecem como estão.

### 3.5 Fila: drenagem automática

Criar `src/offerQueue/` seguindo o padrão de `src/offerAutomation/`:

- **`src/offerQueue/dispatcher.js`** — `drainQueueOnce(queue, deps)`:
  1. Se `!isRunning(queue.userId)` → retorna `{ skipped: 'bot_offline' }`.
  2. Checa limites da fila (apenas os com toggle ativado):
     - `intervalEnabled`: `now - lastSentAt >= intervalMinutes * 60_000`.
     - `hourlyCapEnabled`: `COUNT(OfferQueueItem sent na última 1h) < hourlyCap`.
     - `dailyCapEnabled`: contagem desde meia-noite **America/Sao_Paulo**
       (seguir o padrão de dia BRT já usado em
       `src/offerAutomation/schedule.js`) `< dailyCap`.
  3. Se algum limite bloquear → retorna motivo, sem efeito colateral.
  4. Pega o próximo item `status='pending'` ordenado por `position` ASC;
     claim atômico `updateMany pending→queued` (mesmo padrão do
     `checkScheduledMessages`); se `count !== 1`, pula.
  5. `sendBroadcast(userId, item.text, JSON.parse(item.targetJids),
     { imageUrl: item.imageUrl ?? undefined, imageRefererUrl: ... })`.
  6. Sucesso → `item.status='sent', sentAt=now` + `queue.lastSentAt=now`.
     Falha → `item.status='failed'` (não re-tentar automaticamente nesta
     versão; o retry fino já existe dentro do pipeline de envio do worker).
  7. **Um item por tick por fila** — o espaçamento natural do tick já evita
     rajadas mesmo com todos os toggles desligados.
- **`src/offerQueue/cron.js`** — `startOfferQueueCron()` espelhando
  `src/offerAutomation/cron.js`: `setInterval(tick, 60_000)`, `unref()`,
  tick busca filas `enabled: true` com itens pendentes e chama
  `drainQueueOnce` por fila, com try/catch por fila (uma fila quebrada não
  derruba as outras). Guard `ticking` para não sobrepor execuções.
- Iniciar em `src/api/server.js` ao lado de `startOfferAutomationCron()`.
  Como usa `sendBroadcast` do `manager.js`, funciona nos modos `inline` e
  `remote` do supervisor sem código extra.

### 3.6 Rotas novas — `src/api/routes/offerQueue.js`

Registrar em `src/api/server.js` com `prefix: '/api/offer-queues'`. Todas com
`onRequest: [app.authenticate]` e ownership `userId: req.user.sub` (copiar
padrão de `offerAutomation.js`):

| Método | Rota | Função |
|---|---|---|
| GET | `/` | Lista filas do usuário + contagem de itens pendentes (e enviados hoje, p/ UI) |
| POST | `/` | Cria fila. Valida: `name` obrigatório; valores numéricos ≥ 1 quando o toggle correspondente está on |
| PUT | `/:id` | Atualiza nome/toggles/valores/`enabled` |
| DELETE | `/:id` | Apaga fila (cascade apaga itens — confirmar na UI) |
| GET | `/:id/items` | Lista itens (pending primeiro, por `position`) |
| POST | `/:id/items` | Insere oferta na fila: body `{ text, imageUrl?, imageRefererUrl?, jids? }`. Reusar `normalizeTargetJids` + fallback grupos `post` + `enforceChannelPlanGate` de `broadcast.js` (extrair esses helpers para um módulo compartilhado em vez de copiar/colar). `position` = max(position)+1 |
| DELETE | `/:id/items/:itemId` | Remove item pendente (`status='cancelled'`) |

### 3.7 Frontend

**a) `dashboard/lib/api.js`** — adicionar métodos: `offerQueues()`,
`offerQueueCreate/Update/Delete`, `offerQueueItems(id)`,
`offerQueueItemAdd(id, data)`, `offerQueueItemDelete(id, itemId)`, e
`broadcastSend({ text, jids, imageUrl })` / estender o método de agendamento
existente com `imageUrl`.

**b) `dashboard/app/painel/nav.js`** — item `{ label: 'Filas', href:
'/painel/filas' }` no grupo `Configuração`.

**c) Nova página `dashboard/app/painel/filas/page.js`** (`'use client'`,
copiar estrutura de `ofertas-automaticas/page.js`):
- `usePainelHeader({ title: 'Filas', ... })`, botão `+ Nova fila` via
  `PainelTopbarAction`.
- Form de criar/editar: campo nome + 3 blocos de parâmetro, cada um com
  **toggle (checkbox `pnl-check`/`pnl-toggle`) que, quando ligado, revela o
  input numérico** — exatamente como pedido. Toggle desligado = parâmetro
  inativo (o backend ignora o valor).
- Card por fila: nome, status (ativa/pausada — `enabled`), resumo dos limites
  ativos, contagem de pendentes/enviados hoje, botões editar/excluir e link
  "ver itens" (lista expansível ou seção na própria página) com opção de
  remover item pendente. Itens exibidos **sem foto** (texto truncado + data) —
  decisão de produto.

**d) `dashboard/app/painel/criar-oferta/page.js`** — após a oferta gerada,
adicionar uma seção "Despacho" ao lado/abaixo do botão Copiar (que
**permanece**):
- Seletor de grupos destino (buscar via API de grupos já usada em
  `/painel/envio` — reusar o mesmo componente/padrão de seleção; default =
  grupos `post`).
- Três ações:
  1. **Enviar agora** → `POST /api/broadcast/send` com `{ text: offerMessage,
     jids, imageUrl }`. Desabilitar com aviso se o bot não estiver conectado
     (a rota retorna 400 "Bot não está conectado" — tratar a mensagem).
  2. **Agendar** → revela `datetime-local`; valida futuro; `POST
     /api/broadcast/scheduled` com `{ text, scheduledAt, jids, imageUrl }`.
     Feedback de sucesso com link para `/painel/agendados`.
  3. **Inserir na fila** → `<select>` populado por `api.offerQueues()`; se o
     usuário não tem fila, mostrar CTA "Criar minha primeira fila" linkando
     `/painel/filas`. Submete `POST /api/offer-queues/:id/items`.
- A `imageUrl` vem da resposta do `scrapeOffer` (item 3.2) e fica no estado
  `generated`. Se `null`, despacha sem foto normalmente.

### 3.8 Testes (node:test, db-free como o resto da suíte)

- `test/offer-queue-routes.test.js` — CRUD com db fake/injetado (padrão dos
  testes de rota existentes): validações de toggle+valor, ownership (user A
  não vê fila de user B), inserção de item com normalização de JIDs.
- `test/offer-queue-dispatcher.test.js` — `drainQueueOnce` com deps
  injetadas (db fake, `sendBroadcast` fake, clock fake): respeita
  `intervalMinutes`, `hourlyCap`, `dailyCap` (fronteira de dia BRT), ignora
  parâmetro com toggle off, claim atômico não despacha duas vezes, falha de
  envio marca `failed` sem travar a fila, bot offline pula sem efeito.
- Estender `test/link-conversion-route.test.js` apenas se a rota ganhar o
  campo `imageUrl` (assert de que falha de imagem não quebra a resposta).
- Rodar a suíte inteira: `node --test` — **tudo que passa hoje precisa
  continuar passando.**

## 4. Ordem de implementação sugerida (cada fase = commits pequenos)

1. **Prisma**: models novos + colunas em `ScheduledMessage` + migration.
2. **Backend filas**: `routes/offerQueue.js` + registro no server + testes.
3. **Drainer**: `src/offerQueue/dispatcher.js` + `cron.js` + start no server
   + testes.
4. **Imagem**: `scrape-offer` retorna `imageUrl`; `broadcast/send` e
   `broadcast/scheduled` aceitam `imageUrl`; `checkScheduledMessages` monta
   receita de imagem.
5. **Frontend**: `lib/api.js` → página `/painel/filas` → nav → bloco de
   despacho na `criar-oferta`.
6. **Validação manual em staging** (fluxo do AGENTS.md): PR contra `develop`,
   autodeploy, testar em `http://178.105.54.0:3006` os 3 modos + drenagem.

## 5. O QUE NÃO PODE SER FEITO (vinculante)

1. **NÃO persistir Buffer/binário de imagem** em fila, banco ou job — só URL.
   Já houve regressão real com BullMQ serializando Buffer via JSON (oferta
   saiu sem foto). O download é sempre pós-dequeue, no bot-worker.
2. **NÃO mudar `QUEUE_BACKEND` default nem ligar BullMQ** para nada disso. A
   fila desta feature é tabela Prisma + tick de 60s, igual ao
   `offerAutomation`. Não criar dependência nova de Redis.
3. **NÃO tocar em `src/converters/imageScrapers.js`** (regras invioláveis do
   AGENTS.md: Mercado Livre é referência, mínimos de qualidade, limites de
   bytes). Apenas **consumir** as funções existentes.
4. **NÃO alterar o contrato de `buildScrapedOffer()`** (`keepOriginalLink`,
   painel devolve link convertido, Telegram devolve link original) nem
   duplicar lógica de scrape/conversão fora do `offerEngine`.
5. **NÃO quebrar `ScheduledMessage`**: só colunas novas nullable. O loop
   `checkScheduledMessages` sem `imageUrl` deve se comportar exatamente como
   hoje. Não renomear status (`pending|queued|sent|failed|cancelled`).
6. **NÃO mexer no pipeline de espelhamento** do `bot-worker.js` (incoming,
   dedup `registerDedupBlock`, timeouts, fila serial de envio). A feature só
   adiciona produtores de `sendBroadcast`.
7. **NÃO remover/contornar o `channelThrottle`** nem os smart delays. Os
   limites da fila são uma camada A MAIS; o throttle por grupo continua
   decidindo na hora do envio.
8. **NÃO inventar prefixos novos de `MessageLog.errorMsg`**. Se precisar
   classificar erro, usar `classifyError()`/taxonomia existente
   (`src/errorTaxonomy.js`); prefixo novo exige atualizar `errorTaxonomy.js`
   E `explainErrorMsg` no painel — evitar nesta feature.
9. **NÃO importar `sessionCore` direto** — sempre `src/manager.js`
   (`sendBroadcast`, `isRunning`), para funcionar nos modos inline e remote.
10. **NÃO tocar em portas, deploy scripts, `.env`, `ecosystem.config.cjs`**.
    O drainer roda dentro do processo `api` (como o offerAutomation) — nenhum
    app PM2 novo.
11. **NÃO fazer migration destrutiva** (DROP/RENAME/ALTER de coluna
    existente). Só CREATE TABLE e ADD COLUMN nullable.
12. **NÃO criar PR contra `main`** — branch a partir de `develop`, PR contra
    `develop`, validar em staging antes de promover. Não fazer amend em
    commit já mergeado.
13. **NÃO remover o botão "Copiar oferta"** nem alterar o template/prévia da
    criar-oferta — o despacho é aditivo.
14. **NÃO deixar testes dependentes de banco real ou env** — seguir o padrão
    db-free da suíte (deps injetadas).
15. **NÃO esquecer ownership**: toda rota nova filtra por
    `userId: req.user.sub` em TODAS as queries (find/update/delete), nunca só
    pelo `id`.

## 6. Critérios de aceite

- [ ] Criar oferta → "Enviar agora" entrega no grupo **com a foto** do
  produto (quando a loja fornece imagem) e com texto idêntico à prévia.
- [ ] "Agendar" cria registro visível em `/painel/agendados`, dispara no
  horário (tolerância de até ~30s do tick) **com foto**, e pode ser cancelado
  antes.
- [ ] Fila criada com intervalo 2min + máx 3/hora: ao inserir 5 ofertas, saem
  espaçadas ≥2min e a 4ª só sai na hora seguinte.
- [ ] Toggle desligado = parâmetro não limita nada.
- [ ] Fila pausada (`enabled=false`) não envia; ao reativar, retoma de onde
  parou.
- [ ] Bot desconectado: nada quebra; fila/agendados aguardam reconexão.
- [ ] Falha de download de imagem no envio degrada para texto (comportamento
  já existente do worker) sem marcar erro fatal.
- [ ] `node --test` 100% verde, incluindo suíte pré-existente intacta.
- [ ] Agendamentos de texto criados antes da feature continuam funcionando.
