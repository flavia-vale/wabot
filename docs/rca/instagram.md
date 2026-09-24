# instagram — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Instagram Stories — fundações das fases 1–4 (2026-09-08)

Instagram é um destino tipado (`instagram_story`), nunca um JID falso. Os
contratos puros ficam em `src/domain/delivery/`; persistência e serviços ficam
em `src/instagram/`. Basic, Pro e Trial (inclusive ativo) **não** têm acesso:
todo futuro endpoint, cron, worker, retry ou ação admin deve conferir
`entitlements.canUseInstagramStories`, exclusivo do plano técnico `premium`.

O renderer produz somente JPEG sRGB 1080×1920, máximo 8 MB, a partir de Buffer;
download/SSRF não pertence a essa fronteira. Template é versionado e versão
existente nunca é sobrescrita. Assets usam URL HTTPS assinada com HMAC, TTL e
limpeza que apaga o arquivo antes de marcar `deletedAt`. Variáveis obrigatórias
para servir assets: `STORY_ASSET_PUBLIC_BASE_URL` e
`STORY_ASSET_SIGNING_SECRET` (≥32 caracteres); `STORY_ASSET_DIR` é opcional.

Migração: `prisma/migrations/20260908010000_instagram_stories_phase_2`.
Testes: `test/instagram-story-schema.test.js`,
`test/instagram-story-repository.test.js`,
`test/instagram-story-renderer.test.js`, `test/instagram-story-storage.test.js`.

### POC Meta (Fase 0)

`npm run poc:instagram-story` executa a validação progressiva da Graph API em
três modos: `inspect` (somente leitura), `container` (não publica) e `publish`
(publica de verdade). A versão da API é obrigatoriamente pinada em
`IG_GRAPH_API_VERSION`; nunca adicionar default `latest`. Tokens só entram por
`IG_ACCESS_TOKEN` no ambiente e nunca em commit/log/PR. Runbook:
`docs/instagram/phase-0-meta-poc-runbook.md`. Teste puro, sem Meta:
`test/instagram-meta-poc.test.js`.

### Publicação de Stories (Fase 6)

A fila durável é `instagram-stories` e a DLQ é `instagram-stories-dlq`. Payload
BullMQ contém **somente** `publicationId`: nunca Buffer, token ou snapshot.
`processInstagramPublication` revalida Premium/conexão/asset no dequeue.
Falha ambígua de `media_publish` vira `reconciliation_required`; não criar novo
container nesse caso. O runtime roda na API e só inicia com Redis + OAuth +
storage configurados. Teste: `test/instagram-publishing.test.js`; detalhes em
`docs/instagram/phase-6-publishing-queue.md`.

### Stories manuais/agendados (Fase 7)

Endpoint canônico: `POST /api/instagram/stories`; não acrescentar Instagram em
`broadcast.targetJids`. O download da imagem revalida anti-SSRF a cada redirect
e tem teto de 15 MB. Fan-out é isolado por destino e responde sucessos/erros
separadamente. Agendado é `StoryPublication` + delay BullMQ, não
`ScheduledMessage` (que continua WhatsApp/JID). Cancelar só quando `queued` e
no futuro. Teste: `test/instagram-manual-scheduled.test.js`.

### Stories em ofertas automáticas (Fase 8)

`OfferAutomationDestination` é o único vínculo entre automação e destino
Instagram. Nunca grave conta Meta em `destGroupJid`. Automações Instagram-only
não dependem de WhatsApp online; cron e trigger devem carregar a relação
`instagramDestinations.destination` e revalidar `canUseInstagramStories`. A
idempotência inclui automação, destino, produto e preço. Teste:
`test/instagram-automation.test.js`.

### Stories em filas e espelhamento (Fases 9–12)

Filas usam `OfferQueueDestination` e snapshot imutável no item. Espelhamento
usa `InstagramMirrorDestination` + outbox `InstagramStoryIngress`: o bot-worker
só captura dados públicos e nunca carrega token Meta; a API é a única
consumidora/renderizadora. Configuração, cron, dequeue e retry sempre revalidam
`canUseInstagramStories`. Chaves: `offer-queue:<queue>:<item>:<destino>` e
`mirror:<destino>:<mensagem-origem>`. Testes: `test/instagram-offer-queue.test.js`
e `test/instagram-mirroring.test.js`.

### Segunda revisão: o recurso não existia para ninguém (2026-09-13 — não regredir)

Revisão independente da implementação de Stories. A suíte estava verde e nada
disto era pego por teste. Correções, na ordem em que doíam:

**1. O plano que libera o recurso não era alcançável.** `canUseInstagramStories`
exige `plan === 'premium'`, e `premium` não existia em canto nenhum do produto:
o checkout vende só `basic`/`pro`, e a liberação manual, o pagamento por fora e
a listagem do admin recusavam o valor. Ou seja, **zero contas** podiam usar
Stories, e nem por dentro do produto dava para ligar. `premium` entrou em
`PAID_PLANS` nos três lugares (`src/api/routes/admin.js`,
`src/domain/payments/manualPayment.js`, `src/emailTriggers/lifecyclePolicy.js`)
e nos seletores do admin. **Não tirar de `lifecyclePolicy`:** sem ele a cliente
pagante caía na jornada de fim de TESTE GRÁTIS. O catálogo comercial
(`/precos`) segue sem `premium` de propósito — preço é decisão da dona do
produto, e enquanto não houver, liberação manual é o único caminho.

**2. A foto ia ser recusada pela loja.** `downloadStoryImage` foi reescrito do
zero **sem User-Agent e sem Referer** — exatamente o que `fetchImageBufferRaw`
manda de propósito porque Shopee/Amazon bloqueiam requisição sem cara de
navegador (comentário em `converters/imageScrapers.js`). A mesma foto que sai
normal no grupo devolveria 403 no Story. Hoje o download manda os dois
cabeçalhos e `imageRefererUrl` é passado por todas as superfícies. **Não dá
para reusar `fetchImageBuffer` direto:** ele segue redirect sozinho, e aqui a
URL vem da cliente — cada hop precisa passar pela guarda anti-SSRF.

**3. O Story não dizia de onde era a oferta.** A Content Publishing API publica
**imagem pura** — não existe sticker de link. O card não trazia loja, não
trazia link e a CTA prometia nada. Agora o overlay leva **nome da loja +
desconto**, e a CTA padrão (`DEFAULT_STORY_CALL_TO_ACTION`) é honesta ("Link na
bio"). Teste falha se ela voltar a prometer clique/arrasta. Preço ausente vira
"Confira o preço" em vez de um vão branco.

**4. "Conferência necessária" era beco sem saída.** `reconciliation_required`
nasce quando `media_publish` pode ter publicado sem confirmar — repetir às
cegas duplicaria o Story, então o processor para ali **de propósito**. O que
faltava era alguém retomar: o retry recusava o status, não havia varredura nem
botão. `src/instagram/publishing/reconcile.js` reenfileira a cada 15min (só com
container e após 10min) e o processor relê o container antes de publicar de
novo. Passada in-process, **nenhum processo PM2 novo**.

**5. Limite diário da Meta virava falha permanente em ~8 minutos.** 5 tentativas
com backoff de 30s para uma janela de **24h** — numa conta com automação, a
maior parte do dia caía em `failed`. E o default de cota era 100; **a Meta
libera 25/24h**, então o pré-check passava e a recusa vinha depois do container
criado. Hoje `InstagramPublishingError.retryAfterMs` reagenda o job
(`moveToDelayed`) **sem gastar tentativa**. ⚠️ Os fallbacks de
`UnrecoverableError`/`DelayedError` na fila são classes nomeadas próprias:
`= Error` faria `instanceof` casar com tudo e a DLQ nunca mais receberia nada.

**6. O Instagram não tinha nenhuma cadência.** O WhatsApp tem um módulo de
preservação inteiro contra rajada; o canal novo disparava tantos containers
quanto a concorrência permitisse — o padrão que a Meta associa a automação
abusiva. `storyPacingDelayMs` (puro) garante `INSTAGRAM_MIN_INTERVAL_MS` (90s)
entre Stories da mesma conta, adiando o job em vez de ocupar o slot da fila.

**7. O espelhamento furava a dedup de link.** A captura roda **antes** do bloco
de dedup no `bot-worker.js`, e `@@unique([destinationId, sourceMessageKey])`
não segura repost (cada repost chega com `key.id` novo). Coluna `productKey`
(migration `20260913120000_instagram_mirror_product_key`) + janela
`INSTAGRAM_MIRROR_DEDUP_WINDOW_MS` (12h).

**8. O Story espelhado saía sem preço e com o banner do grupo no título.**
`titleFromText` pegava a primeira linha ("🔥 OFERTA RELÂMPAGO") e o snapshot
não tinha preço nenhum. Agora o consumidor da API (nunca o worker) completa
título/preço/loja por `enrichMirrorOffer`, que reusa
`resolveMirrorOfferFromLink` — **o mesmo caminho do template do WhatsApp**,
para o Story e a mensagem do grupo contarem a mesma história; sem loja, cai
para o "De/Por" da copy da origem. **A rede continua fora do hot path.**

⚠️ **A classe de emoji de `titleFromText` precisa da flag `u`.** Sem ela a
classe é lida em code units e o alto surrogate compartilhado (`\uD83D`) sumia de
QUALQUER emoji do bloco: "🎁 Brinde" virava "\udf81 Brinde". Mesma família do
RCA 2026-09-11. E o corte é `truncateByCodePoints`, **nunca `.slice`**.

**9. Dez destinos = dez downloads e dez renders no mesmo request.** A imagem é
idêntica para todos (mesma oferta, mesmo modelo). `prepareStoryAsset` renderiza
uma vez e `createAndEnqueueStory` aceita `preparedAsset`. Best-effort: falha no
preparo compartilhado faz cada destino tentar sozinho.

**10. Regressões nos canais que já existiam:**
- **Fila híbrida perdeu o gate `bot_offline`.** O gate passou a olhar "tem
  destino Instagram?" em vez de "a fila ainda manda no WhatsApp?" — com o bot
  fora do ar os itens queimavam tentativa e viravam `failed` terminal, quando
  antes só ficavam `pending` com o motivo na tela. **Quem decide é
  `whatsappEnabled`**, que é o campo que distingue fila Instagram-only do
  legado `targetJids='[]'`.
- **Automação usava um booleano de aceite só para os dois canais.** Falha de um
  destino Instagram impedia o item de entrar em `sentItemIds` **com o WhatsApp
  já entregue**, e ele voltava candidato a cada tick. Hoje o aceite é por canal.

**11. LGPD deixava o JPEG no disco.** A anonimização apagava a linha de
`RenderedAsset`, e a varredura de expirados é guiada pelo banco — sem a linha
ela nunca mais olhava o arquivo, que ficava para sempre e servível pela URL
assinada. Agora os arquivos saem **antes** do `deleteMany` (`anonymizeUser(...,
{ storage })`) e `cleanupExpiredStoryAssets` chama `storage.cleanup()` como
rede contra órfão.

**12. Falha transitória desligava os destinos da cliente.** O `catch` do refresh
usava `error.retryable`, então **qualquer** exceção sem a flag — um `TypeError`
nosso incluso — marcava `needs_reconnect` e desabilitava os destinos, que é o
oposto da correção #13 de 2026-09-11. Hoje `isPermanentOAuthFailure` exige
recusa comprovada da Meta (4xx que não seja 429, ou credencial inválida). E o
sweep **não filtra mais por `loginMethod`**: conexão de outro método
simplesmente deixava de ser renovada e vencia em silêncio.

**13. Desconectar deixava um rastro de "Falhou".** Publicações e ingressos já
enfileirados seguiam vivos e viravam falha na tela. `disconnectInstagram` agora
cancela os dois e remove os jobs da fila.

**14. Interface e linguagem:**
- O painel de Instagram aparecia para **todas** as clientes, com um botão
  "Conectar" que sempre devolvia 403 e três chamadas de API por abertura de
  Configurações — só o `/health` são nove contagens no SQLite. Hoje a tela é
  gated por `hasInstagramStoriesAccess` e as rotas `/connections` e `/health`
  exigem o plano.
- **A mensagem crua do backend ia para a tela** ("Meta HTTP 400", "Container
  ERROR", "Chave de idempotência pertence a outra publicação").
  `src/instagram/errorMessages.js` é o ponto único de tradução; teste falha se
  jargão voltar.
- **"Oferta enviada para WhatsApp e Instagram" era mentira**: o Story só entra
  na fila (202). E, quando um canal falhava, a usuária lia só o erro e não
  sabia que o WhatsApp tinha saído — reclicar reenviava o WhatsApp (o broadcast
  não tem chave de idempotência). O resultado agora é por canal e diz o que já
  saiu.

Correção de método da própria revisão: a chave de idempotência do "Criar
oferta" **é** gerada (`setStoryIdempotencyKey` no gerar/limpar) — a primeira
leitura disse o contrário e estava errada.

Testes: `test/instagram-revisao-correcoes.test.js`, mais os casos novos em
`test/instagram-mirroring.test.js`, `test/instagram-offer-queue.test.js` e
`test/instagram-publishing.test.js`.

⚠️ **Continua valendo o que a revisão de 2026-09-11 listou como bloqueador e
não é código:** HTTPS público para a Meta buscar o asset, validação real do app
na Meta e a decisão de produto sobre como a pessoa chega à loja (link na bio,
direct). Nada disso é resolvido aqui.

### Revisão crítica de confiabilidade (2026-09-11)

- `StoryPublication.idempotencyKey` é sempre escopada por usuário; nunca volte
  a persistir diretamente uma chave recebida pela API.
- Falha final da BullMQ precisa atualizar também o estado durável no Prisma.
- Ingressos de espelhamento usam lease por `claimedAt`; busca de imagem externa
  nunca pode voltar ao hot path do `bot-worker`.
- Assets agendados precisam permanecer válidos depois de `scheduledFor`.
- Exportação/anonimização LGPD deve incluir toda nova tabela Instagram sem
  jamais exportar `InstagramConnection.encryptedToken`.
- A lista completa de bloqueadores e riscos residuais está em
  `docs/instagram/critical-review-2026-09-11.md`.
- As quatro superfícies de destino Instagram são: Criar oferta, Filas, Ofertas
  automáticas e Espelhamento. Não adicionar suporte só no backend: todas devem
  continuar selecionáveis na UI, sempre atrás de `plan === 'premium'`.
- Renovação OAuth transitória (rede, 429, 5xx) nunca desativa destino nem exige
  login novamente; somente erro permanente muda para `needs_reconnect`.
- Item de fila que também vai ao Instagram precisa carregar `offerSnapshot`;
  texto/imagem de WhatsApp sozinhos não bastam para o renderer vertical.
- Em `OfferQueue`, `targetJids='[]'` é o fallback legado para todos os grupos.
  Fila Instagram-only deve gravar `whatsappEnabled=false`; sem isso ela envia
  acidentalmente também para todos os destinos WhatsApp.
