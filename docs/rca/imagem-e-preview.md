# imagem-e-preview — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## "Imagem que veio na mensagem" tem UM caminho só: subir de novo (RCA 2026-08-21)

Existiam **dois** caminhos para a mesma promessa de produto, e eles não eram
equivalentes:

- destino **com** botão "Ver canal" → `getImage({ forceOriginalForChannelButton })`
  baixa a mídia da origem e a **SOBE de novo** como imagem nova (o botão só é
  aceito em corpo de mídia). É o caminho que a cliente descreve como "funciona
  perfeito";
- destino **sem** botão, modo `original` → `shouldUseRelayPath` + `relayMessage`
  **REAPROVEITAM** o proto já hospedado da origem, sem subir nada.

Quando todas as contas foram trocadas para `original` (bloqueio do ML), o grupo
sem botão passou a usar o repasse e a cliente reportou oferta que **chegava no
grupo gêmeo e não chegava nele** — com o envio gravado como `success`, porque o
repasse é aceito pelo Baileys e a perda acontece depois, na entrega. O painel não
tem como ver isso: `success` significa "entreguei ao WhatsApp", não "apareceu no
grupo".

Hoje `shouldReuploadOriginalMedia` (`src/core/imageModePolicy.js`) faz o modo
`original` usar o MESMO caminho do botão. Escape hatch
`IMAGE_ORIGINAL_STRATEGY=relay` volta ao repasse (mais barato, preserva vídeo)
sem redeploy. **Não regredir:** não voltar o repasse a padrão sem antes provar,
em teste controlado com dois destinos gêmeos, que ele entrega tudo. Teste:
`test/image-mode-policy.test.js`.

## Padrão do produto: "a foto que veio na oferta" (2026-08-21)

`DEFAULT_GROUP_IMAGE_MODE` passou de `preview` para **`original`**. Motivo
medido: o card de preview depende de ABRIR A PÁGINA DA LOJA para achar a foto, e
com o Mercado Livre barrando o IP do servidor **todo link de produto direto do
ML saía sem foto** — um grupo que só recebe esse tipo de link ficou 100% sem
imagem, enquanto o gêmeo com botão "Ver canal" (que sobe a foto da mensagem)
saía perfeito.

- O modo `preview` **não foi removido**: continua no código e alcançável por
  `GROUP_IMAGE_MODE=preview`. A investigação de foto por loja fica para depois.
- A cliente **não escolhe** formato de imagem na tela. A única escolha de
  formato no painel é o botão "Ver canal" (`dashboard/app/painel/grupos/page.js`).
  Guarda em `test/image-mode-policy.test.js` falha se um controle de `imageMode`
  ou o texto "card de preview" voltar à tela.
- Testes que travavam a string `'preview'` foram reescritos para comparar com
  `resolveGroupImageMode()`: a invariante do chokepoint é o valor persistido ser
  IGNORADO, não o modo ser um valor específico.

## Modo de imagem é GLOBAL e trocável por env (`GROUP_IMAGE_MODE`, 2026-08-20)

Desde 2026-07 o modo é único para todo mundo e o valor persistido em
`Group.imageMode` nunca é lido no envio (seção abaixo). O que mudou em
2026-08-20: esse modo único deixou de ser a string fixa `'preview'` e passa por
`resolveGroupImageMode` (`src/core/imageModePolicy.js`), que lê
`GROUP_IMAGE_MODE` do `.env` — padrão `preview`, valor inválido cai no padrão.

**Por que:** o Mercado Livre passou a barrar o IP do servidor e parte das
ofertas voltou a sair sem foto no preview. `original` ("imagem que veio na
mensagem") não abre a página da loja, então não é afetado por bloqueio de loja
nenhuma — é o plano B enquanto a causa não fecha. A troca é por env de
propósito: vale para todas as contas de uma vez, **não reescreve escolha
nenhuma no banco** e volta apagando a linha do `.env` (pegadinha #1: `pm2
delete` + `start`, e reiniciar o `bot-supervisor` para os bots pegarem).

**A memória de quem estava em preview** fica em
`scripts/snapshot-image-mode.mjs` (read-only): grava cliente por cliente, grupo
por grupo, num JSON com data e motivo. Rodar ANTES de trocar.

**Não regredir:** a invariante do chokepoint continua valendo — `toMonitorGroup`
não pode voltar a ler `group.imageMode`; o que ele lê é o modo global. Teste:
`test/image-mode-policy.test.js`.

## A escolha do formato foi RETIRADA da tela de novo (2026-08-22, fim do dia)

Voltou e saiu no mesmo dia. Com a escolha por grupo ligada em produção, apareceu
**divergência entre o que o painel mostrava e o que saía no grupo** (grupo com
"Card que abre a loja" selecionado recebendo foto original), e não havia
orçamento para investigar a fundo com clientes no ar.

**Estado atual, e é o que vale:**

- o modo é **único para todo mundo** e vem só da env global
  (`resolveGroupImageMode`, `GROUP_IMAGE_MODE`, padrão `original` = "a foto que
  veio na oferta");
- o chokepoint `toMonitorGroup` (`src/billing/groupEntitlements.js`) **ignora**
  `Group.imageMode` de novo;
- a tela **não** oferece escolha de formato. A única escolha de formato que a
  cliente faz é o botão "Ver canal";
- `Group.imageMode` continua na coluna e aceito pela rota, **dormente**.

**Não reintroduzir a escolha por grupo sem antes fechar a investigação de
22/08.** Guardas em `test/image-mode-policy.test.js` falham se o seletor voltar
à tela ou se o chokepoint voltar a ler o campo persistido.

**Investigação em aberto (retomar com orçamento):** por que, com a escolha
ligada, o formato que saía não batia com o selecionado no painel. Suspeita não
verificada: o memo de `getImage` é por MENSAGEM e `buildPayload` roda por
DESTINO, então o primeiro destino a sair pode fixar o resultado para os demais.
Nada disso foi comprovado.

## A escolha do formato VOLTOU para a tela da cliente (2026-08-22)

Por grupo monitorado, em "Como a oferta aparece":

- **Card que abre a loja** (`preview`) — texto + card grande; tocar no card abre
  a página do produto;
- **Foto da oferta** (`original`) — foto + texto; tocar na foto só amplia a foto.

**Por que voltou.** A escolha tinha sido tirada em 2026-07 porque o card
dependia de UMA fonte de foto só (raspar a loja): loja bloqueando = oferta sem
foto = suporte. Isso deixou de valer — a foto do ML agora vem também pela API, e
o plano B em cascata (`core/previewImageFallbackPolicy.js`) usa a foto da
mensagem de origem quando a loja não entrega. O motivo de a cliente não poder
escolher caiu junto.

**Precedência — toda ela em `resolveGroupImageModeFor`** (`core/imageModePolicy.js`,
puro/testado), consumida SÓ pelo chokepoint `toMonitorGroup`
(`src/billing/groupEntitlements.js`):

1. **`GROUP_IMAGE_MODE_FORCE`** — chave-mestra global, ignora a escolha de todo
   mundo;
2. `Group.imageMode`, se for um dos dois formatos que a tela oferece;
3. `GROUP_IMAGE_MODE` / `DEFAULT_GROUP_IMAGE_MODE` — para grupo que nunca
   escolheu.

**A chave-mestra não é enfeite.** A lição de 2026-08-19/21 foi precisar trocar o
formato de todas as contas em minutos, sem migration e sem redeploy, quando uma
loja fecha o caminho da foto. Com a escolha por grupo de volta, `GROUP_IMAGE_MODE`
sozinho não faria mais isso (quem escolheu ganharia da env) — daí a env separada.
**Não remover.**

**Não regredir:**
- `fetch` e `none` continuam **dormentes** (FR-006): existem no código e na
  coluna, mas **não** são oferecidos na tela. Valor legado desses dois cai no
  padrão global em vez de reativar um caminho que ninguém escolheu — a migration
  de 2026-07 deixou todo grupo existente com `'preview'` persistido, então essa
  regra é o que impede dado antigo de virar comportamento novo em silêncio.
- ⚠️ **Consequência do deploy, não de ação da cliente:** como todo grupo já
  existente tem `'preview'` no banco, subir esta versão faz esses grupos
  passarem a sair como card clicável **sem ninguém mexer em nada**. É o efeito
  desejado, mas é uma mudança de comportamento no deploy — não confundir com bug.
- O chokepoint continua sendo o **único** ponto que decide o modo. Não voltar a
  ler `group.imageMode` cru em nenhum outro lugar.
- Com o botão **"Ver canal"** ligado no grupo, o seletor fica **travado** em foto:
  o botão só é aceito em corpo de mídia, então oferecer o card ali prometeria
  algo que o WhatsApp derruba.
- Linguagem: a tela diz o que ACONTECE ("abre a loja" / "amplia a foto"), nunca
  `imageMode`, "card de preview", "thumbnail" ou afins. Teste falha se jargão
  voltar.

Testes: `test/image-mode-policy.test.js`, `test/group-entitlements.test.js`.

## `imageMode` fixado em `'preview'` para todos os grupos (2026-07, specs/001-image-mode-preview-default)

A escolha de imagem por grupo monitorado ("Preview clicável" / "Imagem oficial
da loja" / "Imagem que veio na mensagem" / "Sem imagem") foi **desativada**.
Toda oferta espelhada sai sempre como card de **preview clicável do WhatsApp**
(foto do produto no card; título/preço no texto; clique abre o link).

**Motivo:** padronizar o comportamento (menos suporte "por que minha oferta
saiu sem foto/com foto errada"), o preview clicável é o modo mais robusto
contra bloqueio de prévia automática por lojas com link de afiliado
(Shopee/Amazon), e reduz superfície de configuração para o cliente.

**Chokepoint (defesa em profundidade — FR-001/FR-009):**
`toMonitorGroup()` em `src/billing/groupEntitlements.js` ignora o valor
persistido em `group.imageMode` e retorna sempre `imageMode: 'preview'` no
`cfg` consumido pelo pipeline de envio (`src/bot-worker.js`). Mesmo que a
coluna `Group.imageMode` ainda tenha um valor legado (grupo criado antes da
migração, ou migração ainda não rodada num ambiente específico), o
comportamento em runtime é sempre preview — não há caminho de código que leia
o valor persistido sem passar por este chokepoint primeiro.

**Migração de dados (não-destrutiva, idempotente):**
`prisma/migrations/20260710160000_group_image_mode_preview_default/migration.sql`
faz `UPDATE "Group" SET "imageMode" = 'preview' WHERE "imageMode" IS NULL OR
"imageMode" <> 'preview'`, seguindo o precedente de
`20260628120000_group_image_mode_choice/migration.sql` (mesmo padrão de
`UPDATE`). É DML puro — não há `ALTER TABLE`, então convive com o WAL/
`busy_timeout` sem exigir lock exclusivo nem parar API/supervisor
(pegadinha #8 não se aplica aqui). `prisma/schema.prisma` também mudou o
default da coluna de `@default("none")` para `@default("preview")` (defesa em
profundidade adicional para qualquer `create()` futuro que omita o campo) —
isso é só metadado do Prisma Client; o `DEFAULT` físico da coluna já
materializada no SQLite de produção **não** é reescrito (mudar o `DEFAULT`
físico via SQLite exigiria recriar a tabela inteira, risco/lock desnecessário
para um valor que a aplicação nunca lê sem passar pelo chokepoint). Na
criação de grupo (`src/api/routes/groups.js`), `imageMode` é sempre enviado
explicitamente como `'preview'`, então nenhum caminho de criação depende do
`DEFAULT` físico da coluna.

**Novos grupos:** nascem em `'preview'` por dois níveis — app
(`src/api/routes/groups.js`, `POST /groups`) e schema (`@default("preview")`).

**UI removida:** o bloco "Imagem da oferta" (seletor + textos auxiliares) foi
removido de `dashboard/app/painel/grupos/page.js`. O campo `imageMode`
continua aceito/validado em `PUT /groups/:id` (dormente) — a coluna e a rota
não foram removidas, só a superfície de UI.

**Código de extração de imagem permanece DORMENTE, não foi apagado (FR-006):**
com `imageMode` sempre `'preview'`, os ramos que tratavam `'fetch'`/
`'original'`/`'none'` nunca executam em runtime, mas o código continua no
repositório, comentado explicando a dormência, pronto para reativação futura
sem precisar reescrever a lógica:
- `src/bot-worker.js` — `getImage()` (fetch ativo de imagem oficial via
  `resolveMonitoredImage`) e o bloco de `buildPayload` que tratava
  `wantImage`/`imageMode === 'original'`.
- `src/monitoredRelayPolicy.js` — `shouldRelayOriginalMediaForImageMode()`
  nunca mais retorna `true` em runtime (relay de mídia original dormente).
- `src/converters/imageScrapers.js` — scrapers de Amazon/Mercado
  Livre/Shopee (regras da seção "Image scrapers" abaixo continuam válidas
  para quando o código for reativado).

**Não regredir:** não remover os ramos dormentes acima (só documentá-los como
tais); não reintroduzir leitura direta de `group.imageMode` fora do
chokepoint em `groupEntitlements.js` no caminho de envio. Testes:
`test/group-entitlements.test.js`,
`test/bot-worker-manual-link-preview-channel.test.js`,
`test/migrations-group-image-mode-preview.test.js`,
`test/groups-route-image-mode.test.js`.

## `title` do card de preview manual — NÃO pode ser omitido (regressão PR #1186)

O card clicável do modo `preview` (`buildManualLinkPreview`, `src/bot-worker.js`)
sempre mostra o nome da loja (Amazon/Shopee/Mercado Livre/Magalu) numa linha
acima do domínio, entre a imagem e o texto. Isso **não é estético — é
obrigatório**: no PR #1186 o campo `title` do `urlInfo` foi omitido e o
WhatsApp **parou de renderizar o card inteiro** (regressão confirmada em
staging, revertida no commit `1993c9b`). Há um teste estrutural
(`test/store-brand-card.test.js`) que falha se a chamada
`title: storePreviewTitle(...)` sumir da chamada de `buildManualLinkPreview`.

**Flag experimental `PREVIEW_CARD_HIDE_STORE_TITLE`** (default OFF, lida em
`storePreviewTitle`): quando `'true'`, o CONTEÚDO do `title` vira um espaço
(`' '`) em vez do nome da loja — a chave continua presente (não reproduz a
omissão do PR #1186), só o texto visível muda. **Não testado em produção
ainda** — não se sabe se o WhatsApp trata string vazia/proto3 default-value
como campo ausente (o que reproduziria o bug antigo); por isso espaço em vez
de `''`. Antes de promover para main: ligar a flag em staging, mandar uma
oferta real (Amazon/Shopee/ML/Magalu) e conferir no celular se o card ainda
aparece com foto. Se sumir, desligar a flag (sem redeploy) e reverter para o
nome da loja.

## Oferta saindo SEM FOTO: o caminho do card de preview era MUDO (2026-08)

Toda oferta espelhada sai como card de preview (`imageMode` fixo em `'preview'`).
O card só existe com foto: sem `jpegThumbnail`, `buildManualLinkPreview`
(`src/bot-worker.js`) devolve `null` e a mensagem sai como **texto puro** — é
esse o "sem imagem" que a cliente relata.

**O que impedia o diagnóstico:** esse caminho não deixava rastro nenhum em
produção. `fetchProductImage` (`src/converters/imageScrapers.js`) trata o
próprio erro e devolve `null` **sem lançar**, então o `.catch(logger.debug)`
nunca rodava; e `logger.debug` não chega ao `bot.log` de qualquer forma — o
transport de arquivo é `level: 'info'` (`src/logger.js`). Ou seja: zero linha de
log, zero sinal, nenhuma forma de saber se a foto se perdeu na loja, no
download, no `normalize` ou no upload da thumbnail.

Hoje cada etapa que perde a foto chama `reportPreviewCardNoImage(stage)`:
`logger.warn` + `AnalyticsEvent('ops_preview_card_no_image')` (allowlist em
`src/analytics.js`, mapa em `src/observability/operationalSignals.js`). Etapas:
`anchor_missing` (o link não aparece literal no texto), `scrape_sem_imagem` (a
loja não devolveu foto — caso mais comum), `download_falhou`/`download_sem_bytes`,
`normalize_falhou`, `sem_plataforma`.

**Não regredir:** não rebaixar esses avisos para `debug` e não voltar a tratar
`fetchProductImage` como se lançasse erro em falha (ele devolve `null`).
Teste: `test/preview-card-no-image-observability.test.js`.

**Diagnóstico (read-only, roda no diretório do ambiente):**
```bash
cd ~/wabot && node scripts/diag-preview-sem-imagem.mjs [<email>] [--days=3] [--no-live]
```
Ele cruza os avisos do `bot.log`, o histórico do sinal no banco e **repete ao
vivo** a busca de foto dos últimos envios reais, loja por loja — é o que separa
"a loja parou de entregar a foto para este servidor" de "problema nosso depois
de já ter a foto". Lembre da armadilha do ML: o muro anti-robô vem com **status
200** e sem `og:image`.

⚠️ Em modo `remote`, deploy da API **não** recarrega os bot-workers: enquanto o
`bot-supervisor` não for reiniciado, os avisos novos não aparecem no log (ver
seção "código novo não carregado pelos bots").

## Magalu sem foto: a loja fecha a página e isso era MUDO (RCA 2026-09-17)

Cliente relatou "as ofertas da Magalu estão indo sem imagem".

**Causa raiz: a Magalu era a única loja habilitada sem fonte de foto própria.**
`fetchProductImage` (`src/converters/imageScrapers.js`) tem ramo dedicado para
Shopee (API de afiliado), Amazon (`data-a-dynamic-image`) e Mercado Livre
(vitrine + API); a SHEIN não precisa porque o og:image do oneLink já serve. A
Magalu caía **só** no leitor genérico de HTML (`resolveByHtmlLayers`) — e é
exatamente esse caminho que a loja fecha.

**Medido no servidor (2026-09-17, página real de produto), não deduzido:**

| User-Agent | Resposta |
|---|---|
| navegador, Googlebot, Twitterbot, Slackbot, TelegramBot, iPhone, curl | **403** com a página de erro de marca (1.075 bytes, "Não é possível acessar a página", CSS em `wx.mlcdn.com.br/akamai-bot/`) |
| WhatsApp | **200** com ~2,5KB de desafio JavaScript do Akamai (`sec-if-cpt-container`, "Powered and protected by Akamai"), sem `og:image` |

Também foram medidos e descartados: `www.magazinevoce.com.br` (Radware, 200 com
`az-request-verify`), `busca.magazineluiza.com.br` (captcha do Radware),
`/api/*` e `/sitemap.xml` (403), `mlz.me` (resolve para landing do Bitly) e
`api.magalu.com` (portal de desenvolvedor — exige credencial de vendedor, que a
cliente não tem). **Não existe hoje fonte de foto da Magalu que não passe pela
página do produto**; o CDN (`a-static.mlcdn.com.br`) responde, mas o caminho da
foto não é derivável do SKU.

⚠️ **A medição acima é do IP de onde ela foi feita, não uma lei.** Bloqueio por
reputação de IP vem e vai (o muro do ML entregava foto em staging e não em
produção). O defeito de código, esse sim, é independente de IP: **o bloqueio
não tinha nome**.

**Por que ficava escondido — as duas formas do muro eram indistinguíveis de
"não tem foto":**

- o caso de **200** é a mesma armadilha do muro do Mercado Livre: "a página
  respondeu" não significa nada, e o resultado chegava ao log como
  `scrape_sem_imagem`, que quer dizer *a loja não tem foto deste produto* — um
  diagnóstico com ação OPOSTA à real;
- o caso de **403** era ainda mais mudo: `fetchHtml` devolvia `{ html: null }`
  em qualquer `!res.ok`, então bloqueio de borda e link morto (404) viravam a
  mesma coisa.

**O que foi feito:**

| Peça | Onde |
|---|---|
| Reconhecer o muro nas duas formas + candidatas de resolução (PURO, sem rede) | `src/converters/magaluImage.js` |
| Ramo próprio da Magalu | `resolveMagaluImage` em `src/converters/imageScrapers.js` |
| Status HTTP devolvido por `fetchHtml` | idem |
| Sinal durável `ops_magalu_bot_wall` | `src/observability/operationalSignals.js` + `src/analytics.js` |

**Não regredir:**

- **O ramo da Magalu não pode voltar a cair no leitor genérico**, e o genérico
  não pode reler a MESMA página (dois fetches do mesmo HTML dentro do orçamento
  de 25s da mensagem — mesma lição do T069 da SHEIN). Guarda estrutural no teste.
- **403 e 429 são bloqueio; 404 continua sendo link morto.** Acusar bloqueio no
  404 mandaria procurar defeito na loja quando o link é que não existe mais.
- **`buildMagaluImageUrlCandidates` nunca reescreve destrutivamente.** O
  og:image da Magalu traz o tamanho no caminho do CDN (`/450x450/...`), quase
  sempre abaixo dos 800px do preview; as variantes grandes vêm primeiro e a URL
  **original fica por último** — mesmo contrato de Amazon/SHEIN. Se o CDN não
  servir o tamanho pedido, `fetchImageBuffer` cai para a que já funcionava em
  vez de a oferta sair sem foto. E nunca pede variante MENOR do que a anunciada.
- **O sinal precisa estar nas DUAS allowlists** (`operationalSignals.js` e
  `analytics.js`): faltar em uma descarta o evento em silêncio (mesmo modo de
  falha de `organic_page_view`).
- **Dar nome ao bloqueio NÃO substitui a foto.** Quando este caminho devolve
  `null`, quem salva a oferta é o plano B da foto da mensagem de origem
  (`core/previewImageFallbackPolicy.js`, ligado por default) — e ele só tem o
  que usar se a mensagem de origem trouxer foto. Oferta de Magalu compartilhada
  como texto + link, com a loja barrando, **continua saindo sem foto**: não há
  bytes em lugar nenhum. Isso é limite conhecido, não defeito escondido. **Não**
  usar o banner de marca (`storeBrandCard`) como tapa-buraco de produto — é
  exatamente a regressão #1205/#1208.

⚠️ Em modo `remote` o deploy da API **não** recarrega os bot-workers: nada disso
vale nos bots antes de `pm2 restart bot-supervisor --update-env` (reconecta
TODAS as sessões — anunciar antes). Ver "código novo não carregado pelos bots".

Teste: `test/magalu-imagem-oferta.test.js` (muro reproduzido por servidor
local, sem tocar a loja).

## Foto do card saindo como SELO no meio de um fundo borrado (RCA 2026-09-18)

Cliente mandou print: card de tênis (Magalu, `magazinevoce.com.br`) com a foto
num quadradinho no centro, cercada por uma ampliação borrada dela mesma.

**Medido no banco da conta, não deduzido:**

| quando | deliveryKind | originImageBytes |
|---|---|---:|
| 21:13 | `card_origem` | **5.539** |
| 20:56 | `texto` | 0 |

Ou seja: a foto veio do **plano B da mensagem de origem** (a loja devolveu 403,
`ops_magalu_bot_wall`), e essa foto é a **miniatura embutida do card da
origem** — poucas centenas de pixels.

**Causa:** `prepareWAMessageMedia` lê as dimensões REAIS do buffer que sobe e
grava `thumbnailWidth`/`thumbnailHeight` no proto (Utils/messages.js). O
WhatsApp desenha o card no tamanho declarado e preenche o resto com borrão.
`normalizeImageForWhatsApp` redimensiona com `withoutEnlargement: true` — **de
propósito** —, então a foto pequena chega pequena ao upload.

⚠️ **Não é problema de Magalu.** O mesmo `bot.log` mostra o plano B agindo em
Mercado Livre e Shopee (`Card de preview: foto da loja falhou, usando a foto da
mensagem de origem`). **Toda** oferta que cai no plano B saía assim.

| Peça | Onde |
|---|---|
| Quando ampliar (PURO, sem imagem) | `src/core/cardPhotoUpscalePolicy.js` |
| A ampliação (ponto ÚNICO) | `src/core/cardPhoto.js` (`upscaleCardPhotoIfTiny`) |
| Gancho | `buildManualLinkPreview` em `src/bot-worker.js` |

**Por que ampliar é certo AQUI e errado no envio de foto:** a decisão de
2026-08-26 é que miniatura minúscula ampliada **em tela cheia** vira borrão
ilegível — e ela continua valendo (`withoutEnlargement: true` fica onde está).
Mas o mesmo RCA registra que **"miniatura pequena DENTRO de um card é
legível"**. É este caso: a alternativa não é uma foto melhor, é o selo do
print. Teste falha se a ampliação vazar para fora do card.

**Não regredir:**

- **Magalu precisa chegar como `linkKind='product'`.** Os links reais
  `/p/<sku>/` e `/divulgador/oferta/<token>/` antes ficavam `undefined` porque
  eram a única loja sem detector em `converters/linkKind.js`. No modo
  `original`, isso desligava `preferStorePhoto`: o pipeline nem tentava a foto
  oficial e republicava diretamente a imagem pequena da origem. Home,
  categoria e campanha não podem casar com o detector, para não trazer produto
  aleatório.
- **Link preview tem duas imagens; baixar a HQ antes do inline.** Em produção,
  as ofertas Magalu chegaram como `card_origem` com apenas 545–1999 bytes. O
  `extendedTextMessage` pode carregar `thumbnailDirectPath` + `mediaKey` para a
  thumbnail remota e, ao mesmo tempo, `jpegThumbnail` como placeholder inline.
  `downloadOriginalImage` precisa tentar a remota primeiro; só usa o inline se
  o ponteiro não existir ou o download falhar. Não usar bytes como substituto
  dessa decisão: aqui o proto já diz exatamente qual fonte é qual.
- **Recuperação em massa de origens sem destino:** se uma regressão de painel
  deixar várias origens com `targetsMode='explicit'` e zero `GroupTarget`, use
  `scripts/restore-empty-monitor-targets.mjs`. Ele é read-only por padrão e só
  volta essas origens ao fallback canônico `all`; não cria vínculos por palpite.
  Gravar em toda a base exige `--aplicar --todos`. A configuração dos workers
  expira em até 60s, então não reiniciar supervisor para aplicar isso.
- **A ampliação roda ANTES da tela fixa.** A tela transforma qualquer entrada
  em 1080x1080; tentar decidir a ampliação depois dela enxerga o canvas grande,
  não os 220px da foto, e mantém o produto como selo no centro. Esse foi o RCA
  específico dos links `magazinevoce/...`: o guard anterior verificava apenas
  "antes da marca/upload" e deixou passar a ordem errada. Agora
  `prepararFotoDoCard` amplia a fonte antes de chamar
  `composePreviewCardImage`; o compositor continua responsável só pela tela. O
  teste funcional exige a sequência `220 -> 800 -> canvas 1080`.
- **A ampliação roda ANTES da marca d'água.** `renderDestinationWatermark`
  DESISTE de marcar foto pequena demais (`watermarkApplied:false` em silêncio),
  então ampliar antes faz a marca ser desenhada na resolução final e recupera
  casos em que ela simplesmente não saía. Teste trava a ordem.
- **E antes do upload**, que é quem grava as dimensões no proto. Depois dele
  não serve para nada.
- **Fora do banner de cupom**: ele já nasce em 720x720, com tamanho escolhido,
  e não é foto de produto.
- **Fail-safe é NÃO ampliar.** Sem dimensão confiável, bytes ilegíveis ou
  qualquer falha → devolve o buffer ORIGINAL. Card com selo é ruim; card sem
  foto é pior.
- **Foto que já preenche o card volta byte a byte igual** — nenhum reencode à
  toa.
- **A proporção é preservada** (`fit: 'inside'`): a foto nunca sai esticada.
- **O piso é `IMAGE_HIRES_MIN_DIMENSION_PX` (800)**, que já era a definição da
  casa de "resolução suficiente para o card grande do WhatsApp" — não é número
  por analogia. Foi exatamente por analogia que o piso de bytes de 2026-08-26
  nasceu em 3000 e teve de cair para 800 no mesmo dia.
- `PREVIEW_CARD_MIN_PX=0` desliga e volta ao comportamento do print; valor
  inválido cai no padrão (`.env` mal preenchido nunca muda o formato da oferta
  em silêncio); fora da faixa é grampeado em [200, 1600].

**Ampliar não inventa detalhe** — a foto fica borrada. O ganho é o card ocupar
a largura toda em vez de virar selo, e num card a perda de nitidez é muito
menor que em tela cheia. Se a dona do produto preferir o selo nítido,
`PREVIEW_CARD_MIN_PX=0` reverte sem redeploy.

**Custo:** um `sharp` a mais **só** quando a foto está abaixo do piso, uma vez
por destino. Nenhum processo novo, nenhuma env obrigatória, **zero impacto de
RAM**.

Teste: `test/card-foto-pequena-selo.test.js` (renderiza imagem de verdade e
mede os pixels, em vez de confiar em leitura de código).

## "As imagens só aparecem se clicar" (RCA 2026-09-03 — não regredir)

Cliente (`samaraoliveiraasam@gmail.com`) mandou dois prints: um card de Shopee
com a área da foto preta e uma oferta com bloco chapado e botão `74 kB`. Nem a
dona do produto nem as outras clientes viam isso.

**O envio dela é idêntico ao das outras.** Medido em produção, 3 dias, mesma
janela:

| Conta | `card_loja` | `foto` | `card_origem` | `Foto (repasse)` |
|---|---:|---:|---:|---:|
| samara | 184 | 133 | 17 | **0** |
| dona do produto | 725 | 1213 | 0 | **0** |

Zero `relay` nas duas mata a hipótese de mídia repassada sem miniatura própria.
A configuração também não separa: as duas têm destino em `preview_watermark`.

**O que sobra é o APARELHO de quem olha.** O robô é um aparelho conectado: os
bytes da foto nunca passaram pelo celular dela, que precisa baixá-los do
servidor do WhatsApp. Com *Download automático de mídia* desligado, tudo que o
robô manda vira bloco com botão — e os dois prints são da tela de QUEM ENVIA
(mensagem à direita, com ✓), não de um membro do grupo. **Antes de procurar
defeito neste relato, pergunte se algum MEMBRO do grupo viu o mesmo.**

**O agravante é nosso, e é o que faz parecer defeito:** nos prints não existe a
prévia borrada atrás do botão. Quem desenha essa prévia é a `jpegThumbnail`
embutida no proto — a única coisa que o WhatsApp mostra ANTES de baixar. Medido:

| | foto texturizada | foto de catálogo |
|---|---:|---:|
| nossa miniatura (500px q80) | 57.056 B | 3.239 B |
| 160px q65 | 6.853 B | 788 B |
| padrão do WhatsApp/Baileys (32px q50, `extractImageThumb(file, 32)`) | 392 B | 384 B |

Na pior foto somos ~145× o padrão. **NÃO está provado que o cliente recusa a
miniatura por tamanho** — não repetir isso como fato. O que está provado é o
quadro acima: mesmo caminho de envio nas duas contas, e nenhuma prévia borrada
nos prints. Encolher é a única alavanca nossa nesse ponto.

Por isso entrou como interruptor de rollout, no mesmo padrão de
`COUPON_BRAND_CARD_ENABLED` / `PREVIEW_CARD_HIDE_STORE_TITLE`:

- `INLINE_THUMBNAIL_MAX_PX` — **ausente = 500px q80, byte a byte o
  comportamento histórico**. `160` é o valor a validar. Fora da faixa é
  grampeado em [32, 500]; valor inválido cai no histórico (`.env` mal
  preenchido nunca pode deixar a oferta sem miniatura).
- Decisão pura em `src/core/inlineThumbnailPolicy.js`; geração em
  `src/core/inlineThumbnail.js` (`buildInlineThumbnail`), **ponto único** dos
  três caminhos que alimentam o campo: foto normalizada
  (`normalizeImageForWhatsApp`), foto com marca (`renderDestinationWatermark`) e
  banner de cupom (que nascia em 720px e ia inteiro para o campo embutido).
- O card **não perde nitidez de forma permanente**: a versão em alta continua
  subindo em `highQualityThumbnail`. O custo é um instante de borrão; o ganho é
  existir prévia para quem hoje vê bloco chapado.

**Validação obrigatória antes de virar padrão** (é o gate desta mudança): em
staging, `INLINE_THUMBNAIL_MAX_PX=160`, mandar oferta real e conferir num
celular com *Download automático de mídia* **desligado** que a prévia borrada
aparece sem tocar — nos dois formatos (card e foto). Só então promover o
default. Aplicar a env exige `pm2 delete` + `start` (pegadinha #1) **e**, em
modo `remote`, `pm2 restart bot-supervisor` para os workers carregarem o código
(reconecta TODAS as sessões — anunciar antes).

**Não regredir:** não voltar a gerar miniatura de 500px fora de
`buildInlineThumbnail` (teste estrutural falha); não mandar o banner de cupom
cheio para o campo embutido. Teste:
`test/inline-thumbnail-policy.test.js`.

## Card de cada oferta saindo de um tamanho (RCA 2026-09-16 — não regredir)

Três relatos da mesma cliente na mesma conversa: "imagens quebradas", "preview
com imagem pequena" e "cada oferta vindo com a imagem de um tamanho". Ela
comparou com grupos profissionais, onde o preview sai **sempre do mesmo
tamanho**.

**Os três são o MESMO defeito visto de ângulos diferentes.** O card de preview
não tem tamanho próprio: quem decide como o WhatsApp o desenha é a miniatura
que sobe em `highQualityThumbnail` — `prepareWAMessageMedia` lê width/height do
buffer e grava em `thumbnailWidth`/`thumbnailHeight` do proto. Até aqui esse
buffer era **a foto como ela veio da loja**:

| fonte da foto | o que chegava ao proto |
|---|---|
| Mercado Livre (`D_NQ_NP_2X_`) | 1080x1080 |
| Amazon (`_AC_SL1500_`) | 1500x1500 |
| banner de cupom (`storeBrandCard`) | 720x720 |
| plano B da foto de origem | o que a mensagem de origem tivesse (às vezes ~300px) |
| foto larga/alta de vitrine | proporção qualquer |

Como `normalizeImageForWhatsApp` usa `withoutEnlargement: true`, foto pequena
continuava pequena. Daí: proporção diferente por loja → **card de tamanho
diferente por oferta**; foto pequena → **card compacto** (o Desktop/Web respeita
as dimensões gravadas — é o mesmo mecanismo já descrito no comentário de
`buildManualLinkPreview`); foto muito larga ou muito alta → o cliente **corta no
centro** para caber no card e o produto sai fatiado ("quebrada").

Hoje toda foto de card passa por uma **tela fixa** antes do upload:
`composePreviewCardImage` (`src/core/previewCardCanvas.js`), com a decisão pura
em `previewCardCanvasPolicy.js`. Quadrada de 1080px por padrão — proporção
nativa da foto de catálogo de Amazon/ML/Shopee, então na maioria das ofertas não
sobra moldura nenhuma. A foto entra **inteira** (`fit: inside`, nunca cortada) e
o que sobra vira um desfoque da própria foto (barra branca ficaria estranha em
foto colorida).

**Não regredir:**

- **Os DOIS montadores de card passam pela tela fixa**: `buildManualLinkPreview`
  (espelhamento, via `prepararFotoDoCard`, nas TRÊS fontes — loja, plano B da
  origem e banner de cupom) e `buildBroadcastLinkPreview` (fila e ofertas
  automáticas). Um caminho de fora e os cards voltam a divergir entre si, que é
  exatamente o relato. Guarda estrutural no teste.
- **A miniatura embutida nasce da imagem JÁ composta.** Ela é o que o WhatsApp
  desenha antes de baixar; derivá-la da foto original faria o card mudar de
  proporção ao terminar o download.
- **Nunca cortar a foto para preencher a tela** (`fit: cover`): cortar é o que
  fatiava o produto. O vazio é moldura, não corte.
- **Não soma custo no caminho do card**: a tela fixa SUBSTITUI o
  `normalizeImageForWhatsApp` ali (entrega os mesmos dois campos), não roda
  depois dele. O **envio em modo foto continua sem tela fixa** — lá a imagem é o
  corpo da mensagem e recortar/emoldurar mudaria o que a pessoa vê em tela cheia.
- **Fail-safe é deixar a oferta sair**: composição que falha, entrada ilegível ou
  tela desligada devolvem `null` e o caminho histórico assume. Card de tamanho
  irregular é muito melhor que oferta sem foto.
- A marca d'água continua sendo composta **depois** da tela fixa, então ela
  preserva as dimensões do card (`renderDestinationWatermark` só reduz para
  dentro de 1600px, `withoutEnlargement`).

Envs (opcionais): `PREVIEW_CARD_CANVAS=off` volta ao comportamento histórico sem
redeploy (aceita `off`/`false`/`0`) e `PREVIEW_CARD_CANVAS_PX` muda o tamanho
(padrão 1080, grampeado em [480, 1600]). Aplicar exige `pm2 delete` + `start`
(pegadinha #1) **e**, em modo `remote`, `pm2 restart bot-supervisor` para os
workers carregarem o código — o que reconecta TODAS as sessões (anunciar antes).

⚠️ **Validar em staging olhando o grupo, não só o teste**: mandar ofertas de
lojas diferentes (ML, Amazon, Shopee) e uma de cupom no MESMO grupo e conferir no
celular que os cards saem do mesmo tamanho, com a foto inteira. Teste:
`test/preview-card-canvas.test.js`.

## Voltar ao CARD DE PREVIEW CLICÁVEL: as duas travas e como caíram (2026-08-21)

Os dois formatos de oferta **não são a mesma coisa para a cliente**:

- **card de preview clicável** (`GROUP_IMAGE_MODE=preview`): texto + card grande;
  **tocar no card ABRE A LOJA**. A foto vem de raspar a página da loja;
- **imagem de verdade** (`original`, e o caminho do botão "Ver canal"): foto com
  legenda; **tocar na foto só amplia a foto** — para ir à loja a pessoa precisa
  achar o link dentro do texto.

Em 20-21/08 o padrão virou `original` porque o preview saía SEM FOTO (sem
thumbnail o WhatsApp não desenha card e a oferta vira texto puro). Foi
paliativo: resolveu a foto e **custou a clicabilidade**. As duas travas que
impediam a volta:

**Trava 1 — o ML fechou TODAS as rotas gratuitas de foto.** Medido de um IP
bloqueado: página de produto (`/p/MLB…` e `produto…-_JM`) responde 200 com ~39KB
e sem `og:image` (muro); `api.mercadolibre.com` responde **403 PolicyAgent** sem
token; `/oembed` não existe (404). Não sobra rota anônima. O que passa: a
**vitrine** `/social/<handle>?ref=` (já implementada, mas só existe para
`meli.la`) e a **CDN** `http2.mlstatic.com`, que nunca esteve bloqueada.

A saída não exigiu rota nova: `fetchMercadoLivreProductInfo`/
`fetchMercadoLivreItemInfo` **já chamavam a API do ML** para título e preço, e a
mesma resposta traz `pictures[]` — a foto estava sendo descartada.
`fetchMercadoLivreApiImageId` (`src/converters/productInfoScraper.js`) devolve o
id da PRIMEIRA foto e `buildMlPictureUrl` monta a mesma variante grande da
vitrine (`D_NQ_NP_2X_<id>-F.jpg`, 1080x1080).

Ordem canônica em `resolveMercadoLivreImage` (**não inverter** — guarda em
`test/ml-api-image-source.test.js`): **vitrine → API → página do produto**. A
vitrine primeiro porque está provada em produção e não gasta token; a API antes
da página porque a página é justamente a que o muro barra (tentá-la primeiro só
queimaria o orçamento de 25s da mensagem).

Cada endpoint exige um token diferente, e é isso que define a cobertura:
`/products/<id>` (link de catálogo `/p/`) usa token de **aplicação**
(`ML_CLIENT_ID`/`ML_CLIENT_SECRET`) e vale para **todas** as contas;
`/items/<id>` (link de anúncio) usa o token **OAuth da cliente** e só vale para
quem tem `oauthRefreshToken`. Sem token, devolve `null` e cai na fonte seguinte.

⚠️ **Não provado:** que o token passa pelo PolicyAgent a partir de um IP
bloqueado. Um token falso devolve o mesmo 403 (a política de auth reprova
antes), então só um teste com as credenciais reais, do VPS, decide. Se o 403
persistir com token válido, a Trava 2 continua sendo a rede de segurança.

**Trava 2 — o card tinha UMA fonte de foto só.** Falhou a loja, o card inteiro
era descartado (`if (!jpegThumbnail) return null`) e a oferta ia como texto puro.
Agora há **plano B em cascata**: a foto da própria mensagem de origem vira a
thumbnail do card, preservando foto **e** clique que abre a loja
(`src/core/previewImageFallbackPolicy.js`).

**Isso não é hipótese sobre o WhatsApp.** O card não sabe de onde vieram os
bytes da thumbnail — é um JPEG subido por `prepareWAMessageMedia` com
`mediaTypeOverride: 'thumbnail-link'`. O banner de cupom
(`buildStoreBrandCardImage`, specs/008) **já** alimenta os MESMOS dois campos
com um JPEG gerado localmente a partir de um SVG, sem tocar na loja, e renderiza
card clicável. "Bytes que não vêm da loja" é caminho já exercitado.

**Não regredir:** a foto da LOJA continua sendo a primeira escolha — a cascata
só roda quando não há thumbnail (a foto da origem vem do concorrente e pode ter
marca d'água/preço antigo; usá-la sempre rebaixaria toda oferta). Não roda em
cupom com banner. Sinal PRÓPRIO `ops_preview_card_origin_fallback` (a oferta
SAIU completa — contá-la como `ops_preview_card_no_image` esconderia justamente
quantas ofertas o plano B salvou). A mídia da origem é baixada **uma vez por
mensagem** (`getOriginalPhotoOnce`), não uma vez por destino — `buildPayload`
roda por destino.

Envs: `PREVIEW_CARD_ORIGIN_FALLBACK=off` desliga a cascata (default LIGADA: ela
só age quando o card já ia sair sem foto, então não há caminho em que piore o
resultado; e como o padrão hoje é `original`, ligada por default ela não muda
nada no que está no ar). `GROUP_IMAGE_MODE=preview` religa o card clicável.

**Ainda não medido (não repetir como fato):** se o muro do ML é permanente, por
frequência ou por reputação de IP — staging (mesmo IP, pouco tráfego) entregava
foto enquanto produção não, e num teste em produção 4 de 8 links devolveram
foto. Sugere intermitência; ninguém mediu. Rodar
`scripts/diag-ml-muro-taxa.mjs --sample=6 --repetir=24 --intervalo=30` (12h de
cobertura) antes de qualquer conclusão. Quantas contas estão com a chave da
Shopee recusada também nunca foi medido:
`scripts/diag-shopee-chave-por-conta.mjs`.

**Critério para religar o preview:** `GROUP_IMAGE_MODE=preview` em produção com
as ofertas saindo com card clicável E com foto, inclusive as de link direto do
ML — conferido no celular, em dois grupos, com `ops_preview_card_no_image` perto
de zero por algumas horas. Lembre que em modo `remote` o deploy da API **não**
recarrega os bot-workers: sem `pm2 restart bot-supervisor --update-env` nada
disso vale nos bots (e isso reconecta TODAS as sessões — avisar antes).

## ML sem foto: o muro anti-robô do ML bate no IP do servidor (RCA 2026-08-19/20)

**Sintoma:** de um dia para o outro, as ofertas de Mercado Livre passaram a sair
**sem foto** (card de preview vazio). Amazon e Shopee normais. A conversão do ML
continuou funcionando — foto e conversão são caminhos independentes.

**Causa medida no próprio VPS** (não suposição): a página do produto do ML
responde **status 200**, ~39KB e **sem `og:image`** — é o muro anti-robô
(`suspicious-traffic-frontend`). `fetchProductImage('mercadolivre', ...)` devolve
`null` e o card sai sem imagem. O muro é **por IP, não por User-Agent**: Chrome,
iPhone, WhatsApp, Facebook e Googlebot receberam todos a mesma parede; só `curl`
mudou (403). Trocar UA não resolve.

**Fonte de foto usada hoje:** a página da **vitrine** (`/social/<handle>?ref=`)
continua acessível e já é buscada para achar o produto destacado. Ela traz a foto
em `pictures.pictures[0].id`, e a CDN (`http2.mlstatic.com`) nunca esteve
bloqueada: `D_NQ_NP_2X_<id>-F.jpg` devolve **1080x1080** (acima do mínimo de
800px do preview). `extractFeaturedSocialImage` +
`fetchFeaturedSocialImage` + `resolveSocialShareUrl`
(`src/converters/mercadolivre.js`) alimentam `resolveMercadoLivreImage`
(`imageScrapers.js`), **antes** da leitura da página do produto — que fica como
2ª opção e volta a valer sozinha se o bloqueio cair.

**Não regredir:** não voltar a depender só da página do produto; não aceitar
vitrine **sem `?ref=`** como fonte (sem o ref o ML serve um destaque qualquer do
perfil — é a origem do bug histórico da "foto errada"); manter a âncora no
PRIMEIRO polycard (os seguintes são recomendações). Fixture real em
`test/fixtures/ml-social-card-featured.html`; teste:
`test/ml-social-card-image.test.js`.

**O muro tem nome próprio no log (guard do incidente).** `isAntiBotWallHtml`
(`imageScrapers.js`) reconhece os marcadores (`suspicious-traffic`,
`/gz/account-verification`) e `resolveMercadoLivreImage` emite
`ops_ml_anti_bot_wall` em vez de deixar o bloqueio virar "sem foto" genérico —
sinal SEPARADO de `ops_preview_card_no_image` porque a ação é outra: não é
defeito nosso, é a loja barrando, e a foto tem que vir por outra fonte.

**Armadilha de diagnóstico:** o muro vem com **200**, então "a página respondeu"
não significa nada. Checar `og:image` e o marcador `suspicious-traffic` no corpo:
```bash
node -e "fetch('<url do produto>',{headers:{'User-Agent':'Mozilla/5.0'}}).then(async r=>{const t=await r.text();console.log(r.status,/suspicious-traffic/.test(t),/og:image/.test(t))})"
```

## Image scrapers — configuração canônica (PR #422, não regredir)

`src/converters/imageScrapers.js` entrega imagem hi-res para link preview
do WhatsApp em **Mercado Livre, Amazon e Shopee**. Ajustes consolidados
em #422 a partir de fixtures reais de HTML (em `test/fixtures/`).
Antes de mexer, leia esta seção inteira.

### Regras invioláveis

- **Não mexer no caminho do Mercado Livre.** É a referência de qualidade;
  já funciona.
- **Não baixar a barra de qualidade**: `IMAGE_HIRES_MIN_DIMENSION_PX = 800`
  é o mínimo aceitável no maior eixo para preview do WA.
- **Não restaurar regex com slashes escapadas** (`https?:\\\/\\\/`) em
  `AMAZON_INLINE_IMAGE_RE` — a Amazon BR atual serve com slashes normais.
- **Não baixar `IMAGE_HTML_MAX_BYTES`** para menos de 2MB — a página do
  produto Amazon passa de 1.3MB e o `data-a-dynamic-image` fica em
  ~320KB. `readLimitedText` precisa devolver o que coletou ao atingir o
  teto (e não `null`).
- **Não enviar URL com badges/overlays** (`_BO`, `_UF`, `_SR`, `_PI*`,
  `_ZJ*`, `_QL*`) para o WhatsApp. `buildAmazonImageUrlCandidates`
  extrai o ID base de `/images/I/` e gera variantes `_AC_SL1500_`,
  `_SL1500_`, `_AC_UL1500_`, `_AC_SX1500_` limpas.
- **Shopee sem creds devolve `null` e está correto**: o SPA shell (~13KB)
  não tem `og:image`, a API v4/v2 responde `error: 90309999`. Caminho
  real em produção é a API de afiliado em `src/converters/shopee.js`
  (creds `appId`+`secretKey`). Não inventar fallback para "consertar"
  isso sem creds — vai dar `null` mesmo.

### O que precisa coexistir (em 3 lugares acoplados)

1. `IMAGE_HIRES_MIN_DIMENSION_PX` (default 800) em `imageScrapers.js`
   determina o "hi-res aceitável" usado pelo `fetchImageBuffer`.
2. `validateDownloadedImage` precisa devolver `{ buffer, mimetype, width,
   height }` — o `fetchImageBuffer` usa `width/height` para decidir.
3. As fixtures em `test/fixtures/` são HTML capturado de produção
   (Amazon B09VQ39F41 e Shopee SPA shell). Se Amazon/Shopee mudarem
   layout, recapture **antes** de mexer no scraper, não depois.

### Stripping de CDN canônico

| CDN                                | Sufixos/tokens que SEMPRE removemos para chegar no original              |
|------------------------------------|--------------------------------------------------------------------------|
| `m.media-amazon.com/images/I/`     | `_AC_SY*`, `_AC_SX*`, `_SL*`, `_SX*`, `_SY*`, `_BO*`, `_UF*`, `_SR*`, `_PI*`, `_ZJ*`, `_QL*` (substituído por `_AC_SL1500_`) |
| `down-br.img.susercontent.com`     | `_tn`, `_xxs`, `_xs`, `_sm`, `_md`, `_lg`, `@resize_w<n>[_n[lh]]`, query `?x-oss-process=...` |
| `cf.shopee.com.br` ↔ susercontent  | Alterna hostnames quando um responde 404                                 |
| `mlstatic.com`                     | `D_NQ_NP_` → `D_NQ_NP_2X_` (não tocar — referência)                      |

Teste: `node --test test/image-scrapers.test.js`.
