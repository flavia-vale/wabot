# Contract — Fallback de vitrine do Mercado Livre

Interface interna (não é API HTTP pública). Define o contrato das funções e da
escrita de `MessageLog` que a correção deve preservar/ajustar. Serve de base para o
teste de regressão (`test/ml-vitrine-fallback.test.js`).

## Funções (`src/converters/mercadolivre.js`)

### `isValidMlVitrineUrl(raw): boolean`
- **Entrada**: string arbitrária.
- **Saída**: `true` sse `raw` é URL parseável cujo hostname casa `ML_HOST`
  (mercadolivre/mercadolibre/meli.la/mluvem etc.); `false` caso contrário (inclui
  vazio, malformado, host não-ML).
- **Invariante**: nunca lança; entrada inválida → `false`.

### `buildVitrineFallback(creds): { url, linkKind:'coupon', warning:'ml_vitrine_fallback_used' } | null`
- **Entrada**: `creds` (pode conter `vitrineUrl`).
- **Saída**: objeto de fallback quando `creds.vitrineUrl` passa em
  `isValidMlVitrineUrl`; senão `null`.
- **Invariante**: o `url` retornado é SEMPRE a vitrine própria da usuária — nunca o
  link de terceiro.

### `isDirectVitrineShare(originalUrl): boolean`
- **Entrada**: URL original recebida na mensagem (antes de resolução de rede).
- **Saída**: `true` só quando já era diretamente `https://<ml-host>/social/...`.
- **Invariante**: `true` = CERTEZA de vitrine/perfil; encurtadores não resolvidos →
  `false` (evita falso positivo em produto de loja oficial — RCA 2026-07-08).

### `convertMlCouponWithoutProduct(url, creds)` / `convert(url, creds)`
- **Ramo de vitrine**: só no `err.mlFailureType === 'unsupported_url'`.
  1. `buildVitrineFallback(creds)` válido → retorna o fallback (oferta usará a
     vitrine).
  2. Sem vitrine + `isDirectVitrineShare(url)` `true` → recusa classificada "cadastre
     sua vitrine".
  3. Sem vitrine + `isDirectVitrineShare(url)` `false` → `null` (descarte seguro,
     sem culpar vitrine).
- **Invariante (FR-003)**: nenhum caminho encaminha o link de terceiro.
- **Invariante (FR-005)**: quando há produto conversível (`cleanTarget`), o ramo de
  vitrine **não** é alcançado; a oferta sai com o link de produto convertido.

## Escrita de `MessageLog` (`src/bot-worker.js`)

### Contrato de coerência mensagem × status (FR-004 — foco da correção)
- **Regra**: a copy `warning:ml_vitrine_fallback_used` ("a oferta saiu usando sua
  vitrine") só pode ser exibida quando a oferta **efetivamente saiu** com o link de
  vitrine (existe linha de envio `status='success'` com `convertedUrl` = vitrine para
  a mesma mensagem).
- **Proibido**: emitir a copy de sucesso da vitrine em paralelo a um
  `status='skipped'` ("ignorado") da mesma mensagem/minuto (o sintoma do incidente).
- **Quando a oferta é ignorada** por falta de vitrine válida: a copy deve orientar
  cadastrar/corrigir a vitrine, sem alegar envio.

## Tradução de copy (`dashboard/lib/painel/logsCopy.js`, `dashboard/lib/mobileLogs.js`)
- Os textos exibidos para `warning:ml_vitrine_fallback_used` e para a variante de
  "cadastre sua vitrine" devem refletir o desfecho real. Qualquer novo prefixo de
  `errorMsg` precisa de entrada correspondente aqui (senão cai em UNKNOWN).

## Casos de teste derivados do contrato (para `test/ml-vitrine-fallback.test.js`)
1. **Vitrine cadastrada + recusa `unsupported_url` de vitrine direta** → conversão
   retorna fallback com `warning:'ml_vitrine_fallback_used'` e `url` = vitrine
   cadastrada. (US1 / FR-001)
2. **Link de produto conversível + vitrine cadastrada** → NÃO chama
   `buildVitrineFallback`; retorna link de produto convertido. (US2 / FR-002/FR-005)
3. **`vitrineUrl` ausente + recusa ambígua (não `/social/`)** → `null` (descarte
   seguro), sem afirmar vitrine. (FR-006)
4. **`vitrineUrl` malformada** → `isValidMlVitrineUrl` `false` →
   `buildVitrineFallback` `null` → descarte seguro; copy não afirma envio. (Edge)
5. **Coerência mensagem×status**: dada uma mensagem que gerou fallback mas foi
   barrada a jusante, NÃO coexistem copy de sucesso e status skipped. (FR-004)
6. **Invariante de segurança**: em nenhum caso o retorno contém o link de terceiro
   original. (FR-003)
