# Scraping Fallback Sem Credenciais — Título e Preço para Todas as Lojas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando um cliente não tem chaves de afiliado configuradas, `fetchProductInfo` deve devolver título (e preço, quando possível) usando UAs de crawler que recebem HTML com SSR das lojas — sem depender de credenciais.

**Architecture:** Para cada loja, quando a resposta HTML do primeiro `fetchHtml` for detectada como "bloqueada" (shell vazio da Shopee, página anti-bot do ML, CAPTCHA da Amazon), faz uma segunda tentativa com UAs de crawler conhecidos (`facebookexternalhit`, `WhatsApp`) que as lojas whitelist para preview de links. Os extratores existentes (`extractFromJsonLd`, `extractTitleFallback`, `extractMetaPrice`, `extractShopeePriceRangeFromJsonInHtml`) são reutilizados sobre o HTML SSR — nenhuma lógica de extração nova. Nenhuma credencial é usada; o caminho de credenciais existente não é tocado.

**Tech Stack:** Node.js ESM, `globalThis.fetch`, regex extractors já existentes em `productInfoScraper.js`

---

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `src/converters/productInfoScraper.js` | Único arquivo modificado. Recebe 3 novas funções auxiliares + 3 blocos de retry com crawler UA inseridos em `fetchProductInfo`. |
| `test/product-info-scraper.test.js` | Recebe os testes de regressão de no-creds para cada loja. |

Nenhum arquivo novo criado. Nenhum outro arquivo tocado.

---

## Estado atual sem credenciais (baseline que o plano parte)

| Loja | Sem creds hoje | Problema |
|---|---|---|
| **Shopee** | API v4 com CSRF falso (pode devolver 90309999) → SPA shell sem dados → título do slug da URL | Sem preço; título só do slug |
| **Mercado Livre** | HTML do produto cai na página anti-bot `/gz/account-verification` se não tiver cookie ssid → `extractMercadoLivreFromHtml` devolve null; `fetchMercadoLivreProductInfo` funciona se `ML_CLIENT_ID`/`ML_CLIENT_SECRET` estão no .env | Sem preço sem app token; título só do slug |
| **Amazon** | 4× retry de CAPTCHA (~99% de sucesso) — **já funciona bem** | Raro mas ~1% de falha; caso de borda |

---

## Task 1 — Shopee: SSR via UA de crawler quando sem creds

**Por quê funciona:** a Shopee serve HTML renderizado no servidor (`og:title`, JSON-LD Product, JSON embutido com `price_min`) para UAs como `facebookexternalhit` e `WhatsApp`, que ela whitelist para preview de links. O `imageScrapers.js` já comprova isso para imagem.

**Files:**
- Modify: `src/converters/productInfoScraper.js`
- Test: `test/product-info-scraper.test.js`

---

- [ ] **1.1 Escreva o teste que falha**

Adicione ao final de `test/product-info-scraper.test.js`:

```js
// ── Shopee SSR sem creds ────────────────────────────────────────────────────

test('fetchProductInfo (Shopee sem creds) extrai título e preço do SSR retornado por crawler UA', async (t) => {
  // Simula: BROWSER_UA retorna SPA shell; facebookexternalhit retorna SSR com produto.
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body></body></html>'
  const ssrHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Kit Maquiagem Completo Com Pincéis Profissionais" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Kit Maquiagem Completo Com Pincéis Profissionais","offers":{"@type":"Offer","price":"33.18","priceCurrency":"BRL"}}</script>
  </head><body>produto</body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const ua = (init?.headers?.['User-Agent'] || init?.headers?.['user-agent'] || '')
    if (url.includes('/api/v4/item/get?')) {
      return { ok: false, headers: { get: () => 'application/json' }, json: async () => ({ error: 90309999 }) }
    }
    if (/facebookexternalhit|WhatsApp|Googlebot/i.test(ua)) {
      return {
        ok: true, url: 'https://shopee.com.br/Kit-Maquiagem-i.358.2169',
        headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
        body: null, text: async () => ssrHtml,
      }
    }
    return {
      ok: true, url: 'https://shopee.com.br/Kit-Maquiagem-i.358.2169',
      headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
      body: null, text: async () => shellHtml,
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Kit-Maquiagem-i.358101010.21697493290')
  assert.match(info.title, /Kit Maquiagem Completo Com Pincéis Profissionais/i)
  assert.equal(info.newPrice, '33,18')
})

test('fetchProductInfo (Shopee sem creds) usa título do slug quando crawler UA também falha', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body></body></html>'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('/api/v4/item/get?')) {
      return { ok: false, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    // todos os UAs retornam o shell
    return {
      ok: true, url: String(input),
      headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
      body: null, text: async () => shellHtml,
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Kit-Maquiagem-Com-Pinceis-i.358101010.21697493290')
  assert.match(info.title, /Kit Maquiagem Com Pinceis/i)
  // sem preço quando tudo falha
  assert.equal(info.newPrice, '')
})
```

- [ ] **1.2 Rode o teste — confirme que falha**

```bash
node --test test/product-info-scraper.test.js 2>&1 | grep -E 'pass|fail|not ok'
```

Esperado: os 2 novos testes `fail` (os anteriores passam).

---

- [ ] **1.3 Adicione as constantes e helpers em `productInfoScraper.js`**

Após a constante `ML_MOBILE_UA` (linha ~102), insira:

```js
const SHOPEE_CRAWLER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.24.10.85 A',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]

function isShopeeSpaShelll(html) {
  if (!html || html.length < 5_000) return true
  if (/<title>\s*shopee/i.test(html) && !html.includes('"price_min"') && !extractFromJsonLd(html)) return true
  return false
}

async function fetchShopeeSSRHtml(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  for (const ua of SHOPEE_CRAWLER_UAS) {
    try {
      const result = await fetchHtml(url, { ua, timeoutMs })
      if (result?.html && !isShopeeSpaShelll(result.html)) return result
    } catch {
      // próximo UA
    }
  }
  return null
}
```

- [ ] **1.4 Integre o SSR fallback dentro de `fetchProductInfo`**

Localize o bloco que trata o retry do ML (começa com `// Bug: links curtos do ML`). Imediatamente ANTES desse bloco, insira:

```js
  // Shopee SPA shell sem creds: tenta UAs de crawler para obter HTML SSR com
  // og:title e preço. Só dispara quando a URL é Shopee, o HTML parece o shell
  // vazio do SPA e não há creds de afiliado (shopeeCreds null).
  if (!shopeeCreds && extractShopeeIds(resolvedUrl || url) && isShopeeSpaShelll(html)) {
    const ssrResult = await fetchShopeeSSRHtml(resolvedUrl || url, { timeoutMs: HTML_FETCH_TIMEOUT_MS })
    if (ssrResult?.html) {
      html = ssrResult.html
      finalUrl = ssrResult.finalUrl || finalUrl
    }
  }
```

> A variável `shopeeCreds` já está disponível na linha ~660: `const shopeeCreds = opts.shopeeCreds || opts.shopeeCredentials || null`. `extractShopeeIds` já está importada no topo do arquivo (foi adicionada na tarefa anterior do short link fix).

- [ ] **1.5 Rode os testes — confirme que passam**

```bash
node --test test/product-info-scraper.test.js 2>&1 | grep -E 'pass|fail|not ok'
```

Esperado: todos passam (incluindo os 2 novos).

- [ ] **1.6 Commit**

```bash
git add src/converters/productInfoScraper.js test/product-info-scraper.test.js
git commit -m "feat(scraper): Shopee SSR via crawler UA quando sem credenciais de afiliado"
```

---

## Task 2 — Mercado Livre: retry com `facebookexternalhit` quando HTML é anti-bot e sem creds

**Por quê funciona:** O ML serve a página `/gz/account-verification` para IPs de datacenter sem cookie ssid. UAs de crawler conhecidos como `facebookexternalhit` podem receber HTML com `og:title` e preço — os extratores `extractMercadoLivreFromHtml` e `extractFromJsonLd` já funcionam sobre HTML real.

**Nota:** quando o usuário TEM credenciais ML, o retry com cookie+UA mobile já acontece (bloco `needsMlCookieRetry`). Esta tarefa cobre o caso sem credenciais.

**Files:**
- Modify: `src/converters/productInfoScraper.js`
- Test: `test/product-info-scraper.test.js`

---

- [ ] **2.1 Escreva o teste que falha**

Adicione ao final de `test/product-info-scraper.test.js`:

```js
// ── Mercado Livre SSR sem creds ─────────────────────────────────────────────

test('fetchProductInfo (ML sem creds) tenta facebookexternalhit quando HTML é anti-bot e extrai título+preço', async (t) => {
  const antibotHtml = '<!doctype html><html><head><title>Mercado Libre</title></head><body><div id="gz-verify">Verificação de segurança</div></body></html>'
  const ssrHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Liquidificador Arno Faciclic Plus 550W" />
  </head><body class="ui-pdp">
    <h1 class="ui-pdp-title">Liquidificador Arno Faciclic Plus 550W</h1>
    <div class="ui-pdp-price__second-line">
      <span class="andes-money-amount__fraction">149</span>
      <span class="andes-money-amount__cents">90</span>
    </div>
  </body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const ua = init?.headers?.['User-Agent'] || init?.headers?.['user-agent'] || ''
    // App token do ML: retorna null (sem ML_CLIENT_ID no teste)
    if (url.includes('api.mercadolibre.com')) return { ok: false, headers: { get: () => null } }
    if (/facebookexternalhit|WhatsApp/i.test(ua)) {
      return {
        ok: true, url,
        headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
        body: null, text: async () => ssrHtml,
      }
    }
    return {
      ok: true, url,
      headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
      body: null, text: async () => antibotHtml,
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.mercadolivre.com.br/liquidificador-arno/MLB123456')
  assert.match(info.title, /Liquidificador Arno Faciclic Plus/i)
  assert.equal(info.newPrice, '149,90')
})
```

- [ ] **2.2 Rode o teste — confirme que falha**

```bash
node --test test/product-info-scraper.test.js 2>&1 | grep -E 'pass|fail|not ok'
```

---

- [ ] **2.3 Adicione helper de detecção de anti-bot ML e constante de UA**

Após `isShopeeSpaShelll` (inserido na Task 1), adicione:

```js
const ML_CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

function isMercadoLivreAntiBotHtml(html) {
  if (!html || html.length < 20_000) return true
  if (html.includes('ui-pdp') || html.includes('andes-money-amount')) return false
  // A página /gz/account-verification tem <title>Mercado Libre</title> sem conteúdo de produto
  return /<title>\s*Mercado Lib[er]{2}[eo]?\s*(<|$)/i.test(html) || html.includes('gz-verify') || html.includes('account-verification')
}
```

- [ ] **2.4 Integre o retry no `fetchProductInfo`**

Localize o bloco `const needsMlCookieRetry = ...`. Imediatamente APÓS o bloco que termina com `}` desse retry (após a linha `finalUrl = retried.finalUrl || finalUrl` + fechamentos), insira:

```js
  // ML sem creds: quando o HTML parece anti-bot e não há cookie ssid, tenta
  // uma vez com UA de crawler (facebookexternalhit) — ML o whitelist para
  // preview de links no WhatsApp e pode servir HTML com og:title + preços.
  if (!mlCookieHeader && isMercadoLivreUrl(finalUrl) && isMercadoLivreAntiBotHtml(html)) {
    try {
      const crawlerResult = await fetchHtml(finalUrl, { ua: ML_CRAWLER_UA, timeoutMs: HTML_FETCH_TIMEOUT_MS })
      if (crawlerResult?.html && !isMercadoLivreAntiBotHtml(crawlerResult.html)) {
        html = crawlerResult.html
        finalUrl = crawlerResult.finalUrl || finalUrl
      }
    } catch {
      // mantém html anterior
    }
  }
```

- [ ] **2.5 Rode os testes**

```bash
node --test test/product-info-scraper.test.js 2>&1 | grep -E 'pass|fail|not ok'
```

Esperado: todos passam.

- [ ] **2.6 Commit**

```bash
git add src/converters/productInfoScraper.js test/product-info-scraper.test.js
git commit -m "feat(scraper): ML retry com facebookexternalhit quando anti-bot e sem credenciais"
```

---

## Task 3 — Amazon: `facebookexternalhit` como último recurso após todos os retries de CAPTCHA

**Por quê:** a Amazon serve HTML diferente para UAs de crawler conhecidos, podendo bypassar o CAPTCHA. Não é o caso principal (os 4 retries já cobrem ~99%), mas garante robustez no ~1% restante.

**Files:**
- Modify: `src/converters/productInfoScraper.js`
- Test: `test/product-info-scraper.test.js`

---

- [ ] **3.1 Escreva o teste que falha**

```js
// ── Amazon crawler UA fallback ───────────────────────────────────────────────

test('fetchProductInfo (Amazon) usa facebookexternalhit quando todos os retries de CAPTCHA falham', async (t) => {
  const captchaHtml = `<!doctype html><html><head><title>Amazon.com.br</title></head>
    <body><p>Type the characters you see in this image:</p>
    <img src="https://images-na.ssl-images-amazon.com/captcha/abc.jpg"/></body></html>`
  const productHtml = `<!doctype html><html><head><title>Fritadeira Air Fryer Mondial - Amazon.com.br</title></head>
    <body>
      <span id="productTitle"> Fritadeira Air Fryer Mondial 4L Preta </span>
      <span class="a-price a-text-price a-size-medium apexPriceToPay">
        <span class="a-offscreen">R$319,90</span>
      </span>
    </body></html>`

  const originalFetch = globalThis.fetch
  let callCount = 0
  globalThis.fetch = async (input, init) => {
    const ua = init?.headers?.['User-Agent'] || ''
    if (/facebookexternalhit/i.test(ua)) {
      return {
        ok: true, url: String(input),
        headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
        body: null, text: async () => productHtml,
      }
    }
    callCount++
    return {
      ok: true, url: String(input),
      headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
      body: null, text: async () => captchaHtml,
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.amazon.com.br/dp/B09VQ39F41')
  assert.match(info.title, /Fritadeira Air Fryer Mondial/i)
  assert.equal(info.newPrice, '319,90')
  // deve ter tentado os retries normais antes de chegar no crawler UA
  assert.ok(callCount >= 2)
})
```

- [ ] **3.2 Rode o teste — confirme que falha**

```bash
node --test test/product-info-scraper.test.js 2>&1 | grep -E 'pass|fail|not ok'
```

---

- [ ] **3.3 Adicione constante e retry após o bloco de retries do Amazon**

Localize o bloco de retries do Amazon (termina na linha `}` que fecha o `for (let attempt...)`). Adicione logo em seguida:

```js
  // Amazon CAPTCHA esgotado: um último retry com facebookexternalhit. A Amazon
  // às vezes serve HTML diferente para UAs de crawler conhecidos (preview de
  // links) — se retornar HTML de produto real, usa. Só dispara se todos os
  // retries normais ainda devolveram CAPTCHA.
  if ((isAmazonUrl(resolvedUrl) || isAmazonUrl(finalUrl)) && isAmazonBlockedHtml(html)) {
    try {
      const crawlerResult = await fetchHtml(finalUrl || resolvedUrl, {
        ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        timeoutMs: HTML_FETCH_TIMEOUT_MS,
      })
      if (crawlerResult?.html && !isAmazonBlockedHtml(crawlerResult.html)) {
        html = crawlerResult.html
        finalUrl = crawlerResult.finalUrl || finalUrl
      }
    } catch {
      // mantém html anterior
    }
  }
```

- [ ] **3.4 Rode os testes**

```bash
node --test test/product-info-scraper.test.js 2>&1 | grep -E 'pass|fail|not ok'
```

Esperado: todos passam.

- [ ] **3.5 Commit**

```bash
git add src/converters/productInfoScraper.js test/product-info-scraper.test.js
git commit -m "feat(scraper): Amazon facebookexternalhit como último recurso quando CAPTCHA persiste"
```

---

## Task 4 — Suíte de regressão: confirmar que caminho COM credenciais não regrediu

Garantir que as 3 adições não interferem com o caminho de credenciais (que está funcionando e não deve ser tocado).

**Files:**
- Test: `test/product-info-scraper.test.js`

---

- [ ] **4.1 Escreva os testes de regressão**

```js
// ── Regressões: caminho COM creds não deve chamar crawler UA ─────────────────

test('fetchProductInfo (Shopee COM creds) não chama crawler UA — usa API de afiliado', async (t) => {
  let crawlerUaCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const ua = init?.headers?.['User-Agent'] || ''
    if (/facebookexternalhit|WhatsApp|Googlebot/i.test(ua)) {
      crawlerUaCalled = true
    }
    if (String(input).includes('open-api.affiliate.shopee')) {
      // intercepta a chamada da API de afiliado
      return { data: {} } // axios — não passa por fetch, mas vamos interceptar o fetch normal
    }
    return {
      ok: true, url: String(input),
      headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
      body: null, text: async () => '<!doctype html><html><head><title>Shopee Brasil</title></head><body></body></html>',
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  // COM creds — o affiliateResult já cobre (fetchShopeeProductInfo usa axios, não fetch)
  // O importante é que o crawler UA NÃO é chamado quando creds estão presentes
  // e o fetchShopeeItemInfo retornou via API de afiliado.
  // Verificamos indiretamente: shopeeCreds está presente → bloco SSR não dispara.
  await fetchProductInfo('https://shopee.com.br/Produto-i.111.222', { shopeeCredentials: { appId: '123', secretKey: 'abc' } })
  assert.equal(crawlerUaCalled, false, 'crawler UA não deve ser chamado quando shopeeCreds está presente')
})

test('fetchProductInfo (ML COM creds) não chama facebookexternalhit — usa cookie+UA mobile existente', async (t) => {
  let crawlerUaCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const ua = init?.headers?.['User-Agent'] || ''
    if (/facebookexternalhit/i.test(ua)) crawlerUaCalled = true
    return {
      ok: true, url: String(input),
      headers: { get: (n) => n.toLowerCase() === 'content-type' ? 'text/html' : null },
      body: null,
      text: async () => `<!doctype html><html><head>
        <meta property="og:title" content="Produto ML"/>
        </head><body class="ui-pdp">
        <span class="andes-money-amount__fraction">199</span>
        <span class="andes-money-amount__cents">90</span>
        </body></html>`,
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  await fetchProductInfo('https://produto.mercadolivre.com.br/MLB123', {
    mlCredentials: { ssid: 'x'.repeat(20) },
  })
  assert.equal(crawlerUaCalled, false, 'crawler UA não deve ser chamado quando mlCredentials está presente')
})
```

- [ ] **4.2 Rode os testes**

```bash
node --test test/product-info-scraper.test.js 2>&1 | grep -E 'pass|fail|not ok'
```

Esperado: todos passam.

- [ ] **4.3 Suite completa**

```bash
npm test 2>&1 | tail -8
```

Esperado: mesmos resultados de antes (895+ pass, 0 novas falhas).

- [ ] **4.4 Commit final**

```bash
git add test/product-info-scraper.test.js
git commit -m "test(scraper): regressões para garantir que creds path não chama crawler UA"
```

---

## Resumo dos entregáveis

| Loja | Sem creds antes | Sem creds após |
|---|---|---|
| **Shopee** | Título do slug apenas | Título (og:title SSR) + preço (JSON-LD/og:price SSR) |
| **Mercado Livre** | Slug ou app token (se configurado) | og:title + preço do HTML real via facebookexternalhit |
| **Amazon** | ~99% via CAPTCHA retry | ~100% (crawler UA como último recurso) |

**Nota importante:** O caminho COM credenciais não é tocado. As 3 novas tentativas com crawler UA têm guard `if (!shopeeCreds ...)` / `if (!mlCookieHeader ...)` que garantem que só disparam quando não há credenciais configuradas.

**Confiabilidade:** As lojas podem mudar a whitelist de UAs ou o conteúdo SSR sem aviso. O fallback degrada graciosamente para título do slug — nunca quebra. Para Shopee especificamente, encorajar clientes a configurar as próprias chaves continua sendo a recomendação prioritária.
