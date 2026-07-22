# Contrato — Rotação de cookie no scrape web (#1)

## Módulo compartilhado (extração, sem mudar comportamento)

`src/converters/mercadolivreCookieRotation.js` (novo, puro, db-free/env-free). Exporta os helpers hoje module-private em `mercadolivre.js`:

```
parseCookieHeader(cookieHeader = '') -> Map<name, value>
getSetCookieLines(headers = {}) -> string[]            // lê headers['set-cookie'] | headers['Set-Cookie']
parseSetCookieLine(line) -> { name, value, isDeletion } | null
mergeSetCookieIntoJar(cookieHeader, setCookieLines) -> Map<name, value>   // ignora deleções
serializeCookieJar(jar) -> string                      // filtra valor vazio
buildCredentialPatchFromSetCookie(creds = {}, cookieHeader = '', headers = {}) -> patch | null
```

- `mercadolivre.js` passa a **importar** esses símbolos em vez de defini-los. Comportamento do eixo de afiliado (`checkMercadoLivreSession`) **inalterado** — coberto por regressão.
- `buildCredentialPatchFromSetCookie` retorna `null` quando nenhum nome mudou (→ nenhuma escrita, FR-006) e nunca produz `ssid`/cookie vazio (FR-004).

## `fetchHtml` (expor Set-Cookie ao chamador)

**Antes**: `fetchHtml(url, opts) -> { html, finalUrl }`
**Depois**: `fetchHtml(url, opts) -> { html, finalUrl, setCookie }`

- `setCookie: string[]` = `res.headers.getSetCookie?.() ?? []` (array vazio quando não há `Set-Cookie`, inclusive em `!res.ok` / content-type não-HTML).
- Nenhum outro campo do retorno muda; chamadores que ignoram `setCookie` seguem funcionando.

## `fetchProductInfo` (persistir rotação no ramo ML autenticado)

- Só no caminho em que há credencial de ML (retry com `mlCookieHeader`, onde `opts.mlCredentials.__onCredentialPatch` existe):
  1. `const { html, finalUrl, setCookie } = await fetchHtml(finalUrl, { ...fetchOpts, cookieHeader: mlCookieHeader })`
  2. `const patch = buildCredentialPatchFromSetCookie(opts.mlCredentials, mlCookieHeader, { 'set-cookie': setCookie })`
  3. Se `patch` e `typeof opts.mlCredentials.__onCredentialPatch === 'function'`:
     `try { await opts.mlCredentials.__onCredentialPatch('mercadolivre', patch) } catch (e) { /* → sinal #4, axis:'cookie' */ }`
- **Best-effort**: nenhuma exceção da persistência interrompe ou propaga ao scrape; `fetchProductInfo` continua retornando `{ title, oldPrice, newPrice, finalUrl }` (superfície pública inalterada).
- **Ambos os consumidores cobertos (FR-005)**: `offerEngine.buildScrapedOffer` e `mirrorTemplate` já entregam `mlCredentials` com `__onCredentialPatch` — a persistência passa a valer para os dois sem mudança neles.

## Testes (node:test, db-free/env-free)

- `mergeSetCookieIntoJar` mescla rotação real; ignora deleção; `serializeCookieJar` nunca emite `nome=` vazio.
- `buildCredentialPatchFromSetCookie`: patch com `ssid` novo quando rotaciona; `null` quando nada muda; preserva `ssid` conhecido em deleção.
- `fetchProductInfo` (com `fetch` stubbed devolvendo `Set-Cookie` com `ssid` novo): chama `__onCredentialPatch('mercadolivre', patchComSsidNovo)`; sem `Set-Cookie` → não chama; deleção → não sobrescreve.
