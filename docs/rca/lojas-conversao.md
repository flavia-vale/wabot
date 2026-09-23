# lojas-conversao — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Resolução de short link da Shopee (canônico — não regredir)

TODAS as fontes de título/preço/imagem da Shopee (API de afiliado GraphQL,
API pública v4 e título via slug) dependem de extrair `(shopId, itemId)` da
URL. Para `s.shopee.com.br`/`shope.ee` isso exige resolver o short link — e
**não pode** ser feito com `fetch(redirect:'follow')` lendo `res.url`:

- A Shopee intercala hop anti-bot no **fim** da cadeia (`verify/traffic`),
  então o `res.url` final perde a URL do produto que passou num hop
  intermediário.
- O short link pode responder 200 com interstitial de redirect via
  JS/meta-refresh em vez de redirect HTTP.
- A cadeia pode exigir cookies setados em hops anteriores (o fetch do Node
  não propaga `Set-Cookie` entre redirects).

Quando a resolução falhava, tudo morria junto e o painel mostrava "Não
conseguimos ler título e preço desse link" (regressão de produção, 2026-06).

Fonte única de verdade em `src/converters/shopee.js`:
- `resolveShopeeShortLink()` — segue redirects **manualmente** com cookie jar,
  para no primeiro hop cuja URL já contém os IDs e extrai o alvo do corpo
  HTML quando não há redirect HTTP. Consumido por `productInfoScraper.js` e
  `imageScrapers.js` — **não** reimplementar resolução local nesses arquivos.
- `extractShopeeIds()` — parsing único de `(shopId, itemId)`, inclusive
  URL-encoded em query param (`verify/traffic?next=...`).

Testes: `test/shopee-shortlink-resolve.test.js` + regressões em
`test/product-info-scraper.test.js`.

### Conversão de link de cupom — TODAS as lojas (`COUPON_LINK_CONVERT`, default OFF)

Links que **não são de produto** (cupom/voucher/campanha, sem ID de produto)
historicamente eram **removidos** (Shopee) ou **descartados/`null`** (Amazon, ML)
na mensagem espelhada. Isso é ruim: o cupom muitas vezes é parte essencial da
oferta (o preço anunciado só fecha com ele), substituí-lo por um link fixo da
conta não serve (as páginas de cupom mudam o tempo todo na origem) e mandar o
original credita a comissão ao afiliado do grupo de origem (concorrente).

**Solução: converter o cupom como afiliado da cliente.** O flag único
`COUPON_LINK_CONVERT` (default OFF, lido em runtime via
`src/converters/couponPolicy.js → shouldConvertCouponLinks()`) governa o caminho
de cupom em TODOS os conversores. É um **interruptor de rollout seguro**: os
caminhos com risco real só passam a valer depois de validados em staging.
Rollback em prod = desligar a env (sem redeploy). Os caminhos de **produto ficam
inalterados** em todos os conversores.

Como cada loja credita o cupom (mecanismo é diferente por afiliado):

| Loja   | Cupom com flag ON | Risco | Notas |
|--------|-------------------|-------|-------|
| **Magalu** | já convertia (sempre): `partner_id` em qualquer URL | nenhum | independe do flag (comportamento pré-existente) |
| **Amazon** | `?tag=` na URL da loja (`amazon.com.br`), não no encurtador | baixo, sem WebView | `convert()` em `amazon.js`, fallback aditivo quando não há ASIN |
| **Shopee** | resolve → `stripAffiliateTracking` (preserva o caminho) → `generateShortLink` → devolve o short link **como-está** | baixo | o short link da API abre direto o app |
| **ML** | ⚠️ **a definir / em teste** | ⚠️ **comissão** | pendurar `partner_id` em página não-produto NÃO credita (vai pro dono do código — ver `mercadolivre.js:700`). Em avaliação: tentar `createLink` no link de cupom e validar em staging. |

`stripAffiliateTracking()` (Shopee) remove só o tracking de terceiros
(`utm_source=an_<id>`, `utm_medium=affiliates`, `af_*`/`deep_and_*`,
`gads_t_sig`, etc.) e **preserva a identidade do cupom** (`path` +
`promotionId`/`voucherCode`/`signature`) — sem isso a API recusa com "Invalid
origin URL".

**Causa raiz do "Oops! Seu navegador não é mais aceito!" (resolvida 2026-06) —
NÃO REGREDIR:** o `unsupported.html` é uma **parede do lado do cliente**: a
Shopee detecta o User-Agent do WebView do WhatsApp e bloqueia **qualquer página
web** `shopee.com.br/...`. O que escapa é o short link `s.shopee.com.br/XXX` da
`generateShortLink`, que ao ser tocado **abre direto o app** (deep-link),
exatamente como os links de produto. Um probe contra a API real
(`scripts/shopee-linktype-probe.mjs`) provou que a API gera um short link
app-deeplink para a origem **natural** do cupom (qualquer caminho `/m/...`,
`/buyer/voucher`, etc.). Há duas invariantes importantes:

1. **Nunca reescrever a origem para landing web** (`/m/cupom-de-desconto` ou
   similar). Essa reescrita transformava um link que abriria o app numa página
   web que SEMPRE cai no `unsupported.html`. A correção é preservar o caminho
   original e devolver o short link da API como-está.
2. **Nunca encurtar `unsupported.html` como `originUrl`.** Alguns short links de
   concorrente resolvem server-side para `https://shopee.com.br/unsupported.html?...`
   (por causa do UA/anti-bot fora do app). Se essa URL for enviada para
   `generateShortLink`, a Shopee gera um shortLink nosso que nasce quebrado e
   cai no mesmo erro no WhatsApp. Quando `resolveShopeeShortLink()` terminar em
   `unsupported.html`, `convert()` deve descartar essa URL resolvida e tentar a
   conversão usando o **short link original** (`s.shopee.com.br/...`) como
   `originUrl`; se a API recusar, aí sim cai no strip seguro. Não remover
   preventivamente o cupom só porque a resolução server-side caiu na parede web.

**Não reintroduzir nenhuma reescrita de cupom para landing web, não usar
`unsupported.html` como origem de afiliado e não remover cupom antes de tentar o
fallback pelo short link original.**

Invariante de segurança em TODOS os caminhos: **o link original de terceiro
NUNCA é encaminhado.** Se a conversão falhar, cai no strip seguro (não vaza
comissão).

**O que só um teste real em staging resolve (não dá para validar no sandbox):**
(1) o ML credita cupom de algum jeito? **Validar clicando no link num celular
ANTES de ligar em prod.** Testes: `test/shopee-affiliate-info.test.js` e
`test/converters-amazon.test.js`.

## AliExpress: conversão pela API oficial (não regredir)

`src/converters/aliexpress.js` usa o mesmo GET observado no Gerador de Links do
portal: `/tools/linkGenerate/generatePromotionLinkV2.htm`, com `shipTos=BR`,
`trackId=default` e o `targetUrl`. **Não existe ID/App Key/App Secret para a
cliente procurar nesse fluxo.** Ela cadastra uma exportação da sessão de
`portals.aliexpress.com` (Header string ou JSON do Cookie-Editor), protegida
pela mesma criptografia em repouso das outras credenciais. Links diretos e os encurtadores
`a.aliexpress.com`/`s.click.aliexpress.com` são aceitos, mas todo redirect deve
continuar em HTTPS dentro de `aliexpress.com` ou `aliexpress.us`.

**Fail-closed é obrigatório:** antes de chamar a API, remover `aff_*`, `utm_*` e
os demais rastros conhecidos da origem. Se resolução, sessão, API, JSON ou
validação da URL final falhar, não publicar o link original. A URL devolvida só
é confiável quando é string HTTPS sem usuário/senha e pertence a host oficial
ancorado — `aliexpress.com.evil.net` nunca é AliExpress. O código de acesso vai
somente no header `Cookie` e jamais entra na URL, erro ou log.

A migration `20260910150000_botconfig_platforms_add_aliexpress` habilita a loja
para configurações existentes e limpa a vírgula inicial legada criada por
`platforms=''`. Gate real antes de produção: confirmar no staging o mesmo
produto/variante no celular e a atribuição no relatório da afiliada. Testes:
`test/converters-aliexpress.test.js`,
`test/aliexpress-platform-integration.test.js` e
`test/migrations-botconfig-platforms-aliexpress.test.js`.

## SHEIN: encurtamento de link (`SHEIN_SHORTLINK_ENABLED`, default LIGADO)

`shortenSheinLink()` (`src/converters/shein.js`) troca o link longo da SHEIN
pelo `oneLink` curto da própria loja, seguindo o mesmo padrão de kill-switch
dos outros interruptores de rollout desta seção (`COUPON_LINK_CONVERT`,
`COUPON_BRAND_CARD_ENABLED`, `WA_IGNORE_UNMONITORED_GROUPS`,
`BADSESSION_KEEP_ESTABLISHED_AUTH`, `PREVIEW_CARD_HIDE_STORE_TITLE`): env
única, sem redeploy para desligar.

- **Default é LIGADO.** Só o valor **exatamente** `'false'` desliga —
  `'0'`, `'off'`, `'no'` etc. **não têm efeito nenhum** (a leitura é
  `String(process.env.SHEIN_SHORTLINK_ENABLED ?? 'true') === 'false'`).
- **Desligar não para nenhuma oferta de sair.** `shortenSheinLink()` some
  logo no topo (antes de tocar cookie/rede) e devolve `null`; `convert()`
  cai no comportamento de sempre — publica o link **longo** da SHEIN com a
  identidade da cliente aplicada. É a única alavanca de rollback deste
  encurtamento sem precisar reverter código/deploy.
- **Aplicar a env exige `pm2 delete` + `start`**, não `restart --update-env`
  (pegadinha #1 — PM2 cacheia env no `pm2 start`).
- **Guarda de publicação (T090, não regredir):** o `oneLink` devolvido pela
  SHEIN é validado ANTES de publicar — precisa ser string, URL absoluta
  `http(s)` e host aprovado por `isSheinHost` (mesmo princípio do RCA "o
  endereço montado por nós NUNCA pode ser publicado", seção do Mercado
  Livre). Reprovação devolve `null` e cai no link longo; nunca publica
  domínio de fora, caminho relativo ou `[object Object]`. Um `oneLink`
  legítimo (inclusive com parâmetros próprios da SHEIN, ex.: `?ismg_ol=...`)
  continua saindo **exatamente como veio**, sem reescrever nem remover
  parâmetro. Teste: `test/shein-shortlink.test.js`.

## Amazon: a tag PRECISA estar dentro da `longUrl` mandada ao SiteStripe (RCA 2026-07 — não regredir)

**Sintoma:** cliente relatou **zero cliques** no painel de afiliados da Amazon
entre 16 e 23/07, voltando ao normal em 24/07. Não era queda de envio: o
`MessageLog` mostra 100-160 ofertas Amazon/dia saindo com sucesso o período
inteiro, com `tag=` correta no fallback.

**Causa raiz:** em `convert()` (`src/converters/amazon.js`), o caminho de
**produto** mandava ao endpoint `sitestripe/getShortUrl` a `longUrl` crua vinda
de `buildLongUrl` — `https://www.amazon.com.br/dp/<ASIN>`, **sem `?tag=`** —
confiando apenas no query param `tag=` da própria chamada para creditar. O
SiteStripe encurta a `longUrl` **como recebeu**: o `amzn.to` gerado nascia sem
tag de afiliado. A oferta saía bonita, era clicada, e **nenhum clique era
creditado**. O caminho de **cupom** (`convertStoreUrlWithoutAsin`) sempre
embutiu a tag via `withAffiliateTag` — a assimetria entre os dois caminhos era
o próprio bug.

**Correlação que confirmou em produção** (conta `flavia.vale@usp.br`,
tag `fafaciane-20`):

| Período       | Formato do link enviado | Cliques |
|---------------|-------------------------|---------|
| 02/07 – 12/07 | `?tag=` longo (fallback, cookie expirado) | sim |
| 13/07 – 23/07 | `amzn.to` (sessão SiteStripe viva)        | **zero** |
| 24/07 – hoje  | `?tag=` longo (cookie expirou de novo)    | sim |

O atraso de 13/07 (início do `amzn.to`) para 16/07 (zero cliques) é o rastro dos
links `?tag=` antigos ainda circulando nos grupos e morrendo aos poucos.

**Armadilha de diagnóstico (não repetir):** o cookie do SiteStripe expirado
**mascara** o bug — sessão morta força o fallback `?tag=`, que credita
normalmente. Ou seja, **quanto mais saudável a sessão Amazon, pior a comissão**.
Renovar o cookie sem esta correção faz os cliques sumirem de novo. Se um relato
de "parei de receber comissão" coincidir com sessão SiteStripe saudável,
suspeitar disto antes de qualquer outra coisa.

**Não regredir:** nunca mandar `longUrl` sem `?tag=` para o `getShortUrl`, em
NENHUM caminho de conversão. E, como a `longUrl` já carrega a tag, os fallbacks
não podem reanexar `?tag=` (viraria `?tag=x?tag=x`). Testes:
`test/converters-amazon.test.js` ("produto embute ?tag= na longUrl mandada ao
getShortUrl" e "fallback de produto não duplica ?tag=").

**Diagnóstico reutilizável:** `scripts/diag-amazon-clicks.mjs` (estado da
credencial + formato do link enviado por dia + probe ao vivo) e
`scripts/diag-amazon-shortlink-tag.mjs` (segue os `amzn.to` já enviados e lê a
tag final). Os dois são read-only e não imprimem segredo.

## Amazon: o preço publicado é o do BUY BOX (RCA 2026-09-16 — não regredir)

Clientes reclamaram que a oferta de Amazon chegava ao grupo com um preço e a
loja mostrava outro. Medido contra marcação real da Amazon, **cinco** caminhos
do scraper produziam número errado — três para MAIS, dois para MENOS:

| O que acontecia | Efeito no preço |
|---|---|
| O preço de TABELA riscado ("De: R$ 299,00") vem antes do preço a pagar; o regex antigo pegava o primeiro `a-offscreen` depois da âncora | mais caro |
| `AggregateOffer.lowPrice` do JSON-LD ganhava do buy box — é o MENOR preço entre todos os vendedores e condições, inclusive usado | mais barato |
| Preço de usado/outro vendedor (`usedbuyBox`) publicado quando o buy box está indisponível | mais barato |
| `extractShopeePriceRangeFromHtml` e `extractShopeePriceFromHtml` varriam o HTML INTEIRO atrás de qualquer `R$ x,yy` — numa página da Amazon colhem acessório, "compre junto" e recomendação | qualquer coisa |
| `a-price-whole` hoje carrega um `<span class="a-price-decimal">` aninhado; o regex exigia só dígitos e ponto, não casava, e a oferta caía nos fallbacks genéricos acima | — |

A regra agora mora em **`src/converters/amazonPrice.js`** (`extractAmazonBuyBoxPrice`,
puro e testável, sem rede): publicar o preço A PAGAR do buy box.

**Não regredir:**

- **Na Amazon o buy box ganha do JSON-LD.** `extractFromJsonLd` marca
  `aggregate: true` quando o preço veio de `lowPrice`, e preço agregado passa a
  valer só como ÚLTIMO recurso, nunca como primeira escolha. `highPrice` deixou
  de virar "de": é o maior preço entre vendedores, não o preço cheio do anúncio
  — como "de" ele inventa um desconto que não existe.
- **Os extratores de faixa da Shopee só rodam em URL da Shopee.** Eles são
  varredura cega de `R$` e não têm como saber de qual produto é o número.
- **`a-price` precisa ser a classe INTEIRA.** `a-price-whole`, `a-price-symbol`
  e `a-price-fraction` são pedaços do MESMO preço, não preços separados — um
  `\ba-price\b` os trata como três ofertas e o valor sai picado.
- **`priceToPay`/`apexPriceToPay` ganha de `a-text-price`.** A Amazon combina
  as duas classes em alguns layouts; tratar `a-text-price` como riscado sempre
  fazia a oferta sair SEM preço nenhum.
- **Na dúvida, vazio.** Buy box indisponível não autoriza publicar o preço de
  usado: oferta sem preço é recuperável, oferta com preço que não existe vira
  reclamação e queima a confiança no resto das ofertas.
- **"De" só sai quando é MAIOR que o "por"** — "de R$ 249,90 por R$ 249,90" faz
  a cliente desconfiar do preço todo.

⚠️ **Preço diferente nem sempre é defeito nosso:** oferta relâmpago muda de
preço depois do envio. O que separa os dois casos é O QUANDO. Diagnóstico
read-only, no diretório do ambiente:

```bash
cd ~/wabot && node scripts/diag-amazon-preco.mjs <email> --days=3
```

Ele põe lado a lado o preço que saiu no texto da mensagem e o preço que está na
Amazon agora. `MUDOU` concentrado em envios de minutos atrás é defeito nosso;
espalhado em envios antigos é a loja que mudou o preço depois.

⚠️ Em modo `remote` o deploy da API **não** recarrega os bot-workers — nada
disso vale nos bots antes de `pm2 restart bot-supervisor --update-env`
(reconecta TODAS as sessões: avisar antes). Ver "código novo não carregado
pelos bots".

Testes: `test/amazon-preco-buy-box.test.js`, `test/product-info-scraper.test.js`.

## Vitrine `/social/?ref=`: usar o endereço do card, nunca fabricar (RCA 2026-07-28)

Todo `meli.la` de canal resolve para `/social/<handle>?ref=<blob>`, e
`extractFeaturedSocialProduct` (`src/converters/mercadolivre.js`) extrai o
produto do card destacado. Ordem canônica (não inverter):

1. `product_id` no card → `https://www.mercadolivre.com.br/p/<id>` (catálogo);
2. **campo `url` do card → endereço REAL do anúncio** (`extractFeaturedCardUrl`);
3. só então, último recurso, `produto.mercadolivre.com.br/<id>-x-_JM`.

O passo 2 é novo. Antes, card sem `product_id` caía direto no passo 3, que
**fabrica** o endereço: sem hífen depois de `MLB` e com o slug inventado `-x-`.
O endereço real do ML é `produto.mercadolivre.com.br/MLB-<id>-<nome>-_JM`.
Medido em produção: o fabricado respondeu **404** ao ser aberto do próprio VPS,
e essa forma era ~16% dos links de ML de uma cliente (370 em 7 dias) — a cliente
reportou "página não existe". Diagnóstico reutilizável:
`scripts/diag-ml-social-featured.mjs` (lê o mesmo HTML que o robô lê, lista os
campos do card e testa o endereço montado, distinguindo 404 real de muro
anti-robô do ML).

`extractFeaturedCardUrl` só aceita host do próprio ML (o HTML é de terceiro),
exige MLB no caminho, descarta quando o MLB do `url` diverge do `id` do card
(anti-mismatch, mesma filosofia de `validateAffiliateRedirect`) e remove
query/hash. **Não regredir:** não voltar a fabricar endereço antes de tentar o
`url` do card. Testes: `test/mercadolivre-resolve.test.js` (bloco "Endereço do
card destacado").

**Armadilha de diagnóstico:** o ML serve o muro anti-robô
(`suspicious-traffic-frontend` / `/gz/account-verification`) com **status 200**
para quem ele não reconhece. Um `200` num teste de fora do VPS **não prova** que
a página existe — confira o corpo antes de concluir.

### O endereço montado por nós NUNCA pode ser publicado (RCA 2026-08-15)

O RCA acima passou a **preferir** o endereço do card, mas manteve a fabricação de
`produto.mercadolivre.com.br/MLB<id>-x-_JM` como último recurso — e ela continuou
chegando ao grupo. Cliente novo (`matheuschaves308@gmail.com`) reportou "os links
do mercado livre estão dando erro" com print da página **"Tivemos um problema"**;
o mesmo endereço aberto no celular E no computador dá **"Parece que esta página
não existe"**. Em 7 dias, **10 de 79** envios de ML dele saíram como
`produto.mercadolivre.com.br/MLB<id>-x-_JM?partner_id=<tag>` — e gravados como
`success` no painel.

**Por que ficava escondido:** o endereço montado é só a **entrada** da chamada à
API de afiliados, e a API **aceita** (validado ao vivo com a credencial dele:
devolveu `meli.la` funcionando). Quem chega ao grupo é o `meli.la`. Só quando a
chamada falha (código de acesso vencido, 403, 429) o plano B publica o endereço
montado **cru** — e aí o link quebrado vai para o grupo. Isso explica o relato do
cliente ("atualizei o código, voltou a funcionar, caiu de novo"): com a credencial
viva sai `meli.la`, com ela morta sai o endereço quebrado.

**Armadilha de diagnóstico (não repetir):** os 401 do `bot.log` estavam TODOS em
endereços montados, sugerindo que o formato causava o 401. É falso — um teste
controlado com a credencial dele converteu o MESMO endereço montado com sucesso.
O 401 era a credencial; a página de erro era o endereço. **Dois problemas
independentes** que se sobrepunham no log.

**Fix:** `isSyntheticListingUrl` (`src/converters/mercadolivre.js`, pura/exportada)
reconhece exatamente o formato que nós montamos, e `convert()` **retorna `null`**
em vez de aplicar o fallback `partner_id` sobre ele. A guarda é no **publicar**,
não no montar — montar continua valendo como entrada da API (é o que preserva os
links curtos). Melhor não enviar a oferta do que enviar link quebrado, e a linha
vira falha de conversão honesta em vez de `success` mentiroso.

**Não regredir:** não voltar a pendurar `partner_id` em endereço que casa com
`isSyntheticListingUrl`; não confundir com o endereço REAL
(`MLB-<id>-<nome>-_JM`) nem com catálogo (`/p/MLB<id>`), que continuam saindo
normalmente no fallback. Testes: `test/mercadolivre-resolve.test.js` (bloco
"Nunca publicar endereço montado por nós").

**Diagnóstico reutilizável:** `scripts/diag-ml-sends.mjs <email|telefone|nome>`
— read-only, classifica o formato de cada link de ML publicado e marca com ⚠ os
suspeitos (`listing_fabricado`, `vitrine_social`, `cupom_generico`).

## Oferta de PRODUTO publicada como VITRINE (+ banner de cupom) (RCA 2026-09-18)

Cliente mandou print de duas ofertas de perfume, com nome e preço, saindo com o
banner amarelo "CUPOM Mercado Livre" no lugar da foto. As duas publicaram **o
mesmo link** — que não era de produto nenhum: era a vitrine cadastrada da
própria cliente.

**O banner era a ponta; a raiz é a troca do link.** Em 45 minutos, 30 ofertas
saíram assim (~25 delas de produto: fone, perfume, panela, notebook, pneu,
whey), em 5 contas. Quem clicava no perfume caía numa lista genérica.

### A medição que fechou a causa (não repetir as hipóteses derrubadas)

| Hipótese | Veredito |
|---|---|
| Muro anti-robô do ML no IP do servidor | **FALSA** — 4 links testados, 200, página completa, sem marcador |
| O ML mudou o HTML e o extrator quebrou | **FALSA** — o extrator lê o card e monta a URL certa |
| A etiqueta `?ref=` se perde no caminho reserva da resolução | **FALSA** — **0** casos em 773 |

O placar real das 773 falhas de leitura: **242** eram `/lists` (sem produto,
comportamento correto) e **531** eram páginas que **responderam 200 e vieram sem
o card destacado**. Reprocessando 20 dos links que falharam em produção,
**17 resolveram na primeira tentativa, em ~1s cada**.

Ou seja: **o ML às vezes entrega a página sem o produto em destaque, e o robô
tratava esse engasgo como resposta definitiva.**

### A cadeia inteira, e os três consertos

1. Leitura do card destacado falha por um instante
   (`tryExtractFeaturedProductFromSocialShare`).
2. `resolveToCleanProductUrl` devolve `null` — e `null` significava DUAS coisas
   opostas: "a página não tem produto" e "não consegui ler a página".
3. `convert()` cai no caminho de cupom; o ML recusa (`unsupported_url`, erro 111).
4. `decideVitrineFallback` publica a **vitrine da cliente** no lugar do produto,
   com `linkKind:'coupon'` + `warning:'ml_vitrine_fallback_used'`.
5. Esse aviso de FALHA era lido como sinal de que a mensagem era de cupom, e
   ligava o banner.

**Não regredir:**

- **Ler de novo antes de desistir.** `ML_SOCIAL_CARD_ATTEMPTS` (2) com
  `ML_SOCIAL_CARD_RETRY_DELAY_MS` (600ms). A releitura só acontece quando a
  página **respondeu** e respondeu rápido (`ML_SOCIAL_CARD_RETRY_MAX_ELAPSED_MS`,
  3s): leitura que estourou já consumiu o orçamento da mensagem
  (`MSG_QUEUE_TIMEOUT_MS`, 25s), e insistir ali derrubaria por timeout uma oferta
  que hoje sai — pior que o defeito sendo consertado.
- **"Não consegui ler" NUNCA vira "é vitrine".** `ML_SOCIAL_CARD_OUTCOME`
  separa `PRODUTO` / `SEM_PRODUTO` / `LEITURA_FALHOU`, e `decideVitrineFallback`
  descarta quando a leitura falhou. **Oferta não enviada é recuperável; oferta
  enviada com o link errado não é** — já foi para o grupo. Escape hatch:
  `ML_VITRINE_ON_READ_FAILURE=true` volta ao comportamento histórico.
- **Vitrine LIDA e confirmada sem produto continua caindo na vitrine
  cadastrada** — as features 004/007 não foram tocadas.
- **O banner de cupom exige vitrine CONFIRMADA**
  (`resolveCouponTextSignal`, em `converters/couponBrandCardPolicy.js`). A
  blindagem tripla tem duas condições que caem sozinhas com link curto (a URL não
  expõe MLB/ASIN → `linkKind:'coupon'` e `urlHasProductId:false`), então o sinal
  de texto era a **única** trava real — e aceitar `ml_vitrine_fallback_used` nela
  fazia **um fato só** (a conversão falhou) derrubar as três. Hoje o aviso de
  vitrine só vale quando `isDirectVitrineShare(primary.url)` é true, isto é,
  quando o link COMPARTILHADO já era uma página `/social/`. Atrás de um
  encurtador pode haver produto de verdade — e havia.
- **`COUPON_BRAND_CARD_ENABLED` estava ligado em produção** contra o que esta
  documentação já mandava. Continua devendo ficar ausente até validação
  explícita em staging.

⚠️ **Armadilha de diagnóstico:** `sentAt` é gravado pelo Prisma no SQLite como
**número** (ms). Consulta com `sentAt > datetime('now','-2 days')` compara número
com texto e **nunca dá verdadeiro** — devolve zero linhas e parece ausência de
dado. Use `sentAt > (strftime('%s','now','-2 days') * 1000)` e
`datetime(sentAt/1000,'unixepoch','localtime')`.

Comandos de diagnóstico (read-only, no diretório do ambiente):

```bash
LOG=/home/deploy/BOTinho-shared/logs/bot.log
# placar da leitura do card destacado
for m in "produto destacado extraído" "sem card destacado" "erro ao buscar HTML" "usando vitrine cadastrada"; do
  printf "%-34s %s\n" "$m" "$(grep -c "$m" $LOG)"
done
# separa o defeito (com ref=) do comportamento correto (/lists)
grep "sem card destacado" $LOG | sed -n 's/.*"landingUrl":"\([^"]*\)".*/\1/p' | awk '
/\/lists/ {l++; next} /[?&]ref=/ {r++; next} {s++}
END {print "  /lists:", l+0; print "  com ref= (defeito):", r+0; print "  sem ref=:", s+0}'
```

⚠️ Em modo `remote` o deploy da API **não** recarrega os bot-workers — nada disso
vale nos bots antes de `pm2 restart bot-supervisor --update-env` (reconecta TODAS
as sessões: anunciar antes). Ver "código novo não carregado pelos bots".

Teste: `test/ml-oferta-de-produto-virou-vitrine.test.js`.
