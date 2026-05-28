# PR1 — Conversão obrigatória no `/scrape-offer` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Garantir que o endpoint de gerar oferta sempre tente converter o link para afiliado primeiro e só então monte a oferta, com fallback seguro para link original e sinalização explícita de conversão.

**Architecture:** O fluxo do endpoint `/scrape-offer` passará a ter duas fases: (1) tentativa de conversão por plataforma com validação de credenciais e timeout; (2) scrape de produto usando `offerUrl` (convertido quando possível, original no fallback). O contrato de resposta será estendido com bloco `conversion`, mantendo compatibilidade dos campos já consumidos pela UI.

**Tech Stack:** Node.js, Fastify, conversores existentes em `src/converters`, scraper `productInfoScraper`, testes Node test runner já usados no repositório.

---

## Scope check (PR1)
- Inclui apenas backend + testes do endpoint de scrape/conversão.
- Não inclui mudança visual do dashboard nem “Editar template” (ficam para PR2).
- Não altera banco, migrations, `.env`, PM2 ou deploy scripts.

## File map
- **Modify:** `src/api/routes/linkConversion.js`
  - Inserir orquestração “converter -> scrape”, timeout e bloco `conversion`.
- **Modify (opcional, só se necessário):** `src/converters/productInfoScraper.js`
  - Ajustes mínimos para aceitar URL convertida sem regressão.
- **Create/Modify tests:** `test/api/link-conversion-routes.test.js` (ou arquivo equivalente existente para essa rota)
  - Cobrir novos casos de contrato e fallback.

---

### Task 1: Definir contrato de resposta do `/scrape-offer` com compatibilidade

**Files:**
- Modify: `src/api/routes/linkConversion.js`
- Test: `test/api/link-conversion-routes.test.js`

- [x] **Step 1: Escrever testes que falham para novo contrato (TDD)**

```js
// caso sucesso de conversão
assert.deepEqual(Object.keys(body.conversion).sort(), [
  'attempted', 'platform', 'reasonCode', 'reasonMessage', 'success', 'usedOriginalUrl',
].sort())
assert.equal(body.conversion.attempted, true)
assert.equal(body.conversion.success, true)
assert.equal(body.conversion.usedOriginalUrl, false)
assert.equal(body.offerUrl, 'https://converted.example/...')

// compatibilidade
assert.equal(typeof body.title, 'string')
assert.equal(typeof body.oldPrice, 'string')
assert.equal(typeof body.newPrice, 'string')
assert.equal(typeof body.finalUrl, 'string')
```

- [x] **Step 2: Rodar teste para validar falha inicial**

Run: `node --test test/api/link-conversion-routes.test.js`
Expected: FAIL em asserts de `conversion`/`offerUrl` ausentes.

- [x] **Step 3: Implementar extensão de payload sem remover campos antigos**

```js
return {
  title: info?.title || '',
  oldPrice: info?.oldPrice || '',
  newPrice: info?.newPrice || '',
  finalUrl: info?.finalUrl || offerUrl,
  offerUrl,
  conversion: {
    attempted: true,
    success,
    usedOriginalUrl: !success,
    reasonCode,
    reasonMessage,
    platform,
  },
}
```

- [x] **Step 4: Rodar teste e confirmar PASS**

Run: `node --test test/api/link-conversion-routes.test.js`
Expected: PASS para casos de contrato.

- [x] **Step 5: Commit**

```bash
git add src/api/routes/linkConversion.js test/api/link-conversion-routes.test.js
git commit -m "feat(api): estende contrato do scrape-offer com status de conversao"
```

---

### Task 2: Implementar conversão obrigatória antes do scrape

**Files:**
- Modify: `src/api/routes/linkConversion.js`
- Test: `test/api/link-conversion-routes.test.js`

- [x] **Step 1: Escrever teste de ordem do fluxo**

```js
// mock converter retorna URL convertida
// mock scraper deve receber URL convertida (não original)
assert.equal(scraperCalledWith, convertedUrl)
assert.equal(body.offerUrl, convertedUrl)
```

- [x] **Step 2: Escrever teste de reconversão mesmo quando entrada já parece afiliada**

```js
// input: amzn.to / meli.la / etc.
// converter deve ser chamado mesmo assim
assert.equal(converterCallCount, 1)
```

- [x] **Step 3: Implementar helper de tentativa de conversão com timeout**

```js
const convertedUrl = await withTimeout(
  convertLink(platform, originalUrl, credentialsMap),
  Math.min(operational.conversionTimeoutMs, remainingMs),
  `Tempo limite de conversão excedido para ${label}.`,
)
```

- [x] **Step 4: Rodar testes e confirmar PASS**

Run: `node --test test/api/link-conversion-routes.test.js`
Expected: PASS nos cenários de conversão e ordem.

- [x] **Step 5: Commit**

```bash
git add src/api/routes/linkConversion.js test/api/link-conversion-routes.test.js
git commit -m "feat(api): converte link antes de montar oferta no scrape-offer"
```

---

### Task 3: Fallback seguro para link original com reason codes

**Files:**
- Modify: `src/api/routes/linkConversion.js`
- Test: `test/api/link-conversion-routes.test.js`

- [x] **Step 1: Escrever testes para fallback (sem bloquear geração de oferta)**

```js
// loja sem suporte / credencial ausente / erro no conversor
assert.equal(body.conversion.success, false)
assert.equal(body.conversion.usedOriginalUrl, true)
assert.equal(body.offerUrl, originalUrl)
assert.match(body.conversion.reasonCode, /UNSUPPORTED_PLATFORM|MISSING_CREDENTIALS|CONVERSION_FAILED|CONVERSION_TIMEOUT/)
```

- [x] **Step 2: Implementar mapeamento de reason codes padronizado**

```js
function classifyConversionFailure(err, context) {
  if (context.unsupported) return { code: 'UNSUPPORTED_PLATFORM', message: 'Loja ainda sem conversão automática.' }
  if (context.missingCredentials) return { code: 'MISSING_CREDENTIALS', message: 'Credenciais ausentes para esta loja.' }
  if (/tempo limite/i.test(String(err?.message || ''))) return { code: 'CONVERSION_TIMEOUT', message: err.message }
  return { code: 'CONVERSION_FAILED', message: err?.message || 'Falha na conversão.' }
}
```

- [x] **Step 3: Garantir que scrape continue com URL original no fallback**

```js
const offerUrl = conversionSuccess ? convertedUrl : originalUrl
const info = await fetchProductInfo(offerUrl)
```

- [x] **Step 4: Rodar testes e confirmar PASS**

Run: `node --test test/api/link-conversion-routes.test.js`
Expected: PASS nos cenários de fallback.

- [x] **Step 5: Commit**

```bash
git add src/api/routes/linkConversion.js test/api/link-conversion-routes.test.js
git commit -m "feat(api): adiciona fallback com reason codes no scrape-offer"
```

---

### Task 4: Hardening + regressão do endpoint atual

**Files:**
- Modify: `test/api/link-conversion-routes.test.js`
- Modify: `src/api/routes/linkConversion.js` (se ajuste pequeno for necessário)

- [x] **Step 1: Adicionar testes de regressão para validação de URL inválida e erro de scrape**

```js
assert.equal(statusCode, 400)
assert.equal(body.code, 'SCRAPE_OFFER_INVALID_URL')

assert.equal(statusCode, 502)
assert.equal(body.code, 'SCRAPE_OFFER_FETCH_FAILED')
```

- [x] **Step 2: Rodar suíte alvo de testes da rota**

Run: `node --test test/api/link-conversion-routes.test.js`
Expected: PASS geral da suíte.

- [x] **Step 3: Rodar teste de scraper para checar não-regressão local**

Run: `node --test test/image-scrapers.test.js`
Expected: PASS (sem alterações de regras canônicas de imagem).

- [x] **Step 4: Commit final da PR1**

```bash
git add src/api/routes/linkConversion.js test/api/link-conversion-routes.test.js
git commit -m "test(api): cobre conversao obrigatoria e fallback do scrape-offer"
```

---

## Riscos e mitigação (PR1)
- **Breaking de frontend atual:** mitigado mantendo `title/oldPrice/newPrice/finalUrl` intactos.
- **Timeout em conversores externos:** mitigado com timeout já existente + fallback para URL original.
- **Credenciais ausentes:** não bloqueia geração; apenas marca `conversion.success=false`.
- **Regressão em scrapers:** mitigada com execução de teste de scraper existente.

## Critérios de aceite da PR1
1. `/scrape-offer` sempre tenta conversão (`conversion.attempted=true`).
2. Em sucesso, `offerUrl` é convertido e scrape usa esse URL.
3. Em falha/não-suporte, `offerUrl` volta para original com `reasonCode` apropriado.
4. Campos legados seguem presentes para compatibilidade.
5. Testes automatizados da rota passam.

## Validação em staging (após merge em develop)
- Fluxo manual na `http://178.105.54.0:3006`:
  - Link suportado + credenciais ok → status de conversão positiva no payload.
  - Link sem credenciais → oferta ainda gerada, com fallback.
  - Link de loja sem conversão → oferta gerada com link original.



## Status de execução (atualizado em 2026-05-26)

### ✅ Executado nesta PR1
- Backend `POST /scrape-offer` agora tenta conversão antes do scrape, com timeout e fallback para URL original.
- Contrato estendido com `offerUrl` e bloco `conversion` (`attempted`, `success`, `usedOriginalUrl`, `reasonCode`, `reasonMessage`, `platform`), mantendo campos legados.
- Testes da rota atualizados para cobrir:
  - sucesso de conversão e uso da URL convertida no scraper,
  - reconversão de links curtos/afiliados,
  - fallback por credencial ausente,
  - fallback para loja não suportada,
  - fallback quando conversor falha,
  - regressão de URL inválida (400) e falha de scrape (502).
- Verificações executadas com sucesso:
  - `node --test test/link-conversion-route.test.js`
  - `node --test test/image-scrapers.test.js`

### 🟡 O que ainda falta (fora do escopo da PR1)
1. **PR2 (Frontend/UX do Gerar Oferta):**
   - template padrão novo:
     - `🛍️ {{title}}{{oldPriceBlock}}{{newPriceBlock}}`
     - `🛒 Compre aqui 👉 {{link}}`
   - template oculto por padrão, exibido apenas ao clicar em “Editar template”.
   - sinalização visual no front:
     - verde quando `conversion.success=true`,
     - vermelho quando `conversion.success=false` e uso do link original.
2. **Validação manual em staging (porta 3006):**
   - validar o fluxo E2E após merge em `develop`.
3. **PR3 (se necessário):**
   - polimentos de UX/mensagens e cobertura adicional de testes de interface.
