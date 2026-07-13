# Phase 1 — Data Model: Fallback de vitrine do ML

Esta feature **não cria** tabelas nem migrations. Ela opera sobre entidades e
campos já existentes. Documenta-se aqui a forma real dos dados envolvidos, para o
diagnóstico e a correção.

## Entidade: Credencial de afiliada do Mercado Livre

- **Persistência**: modelo Prisma `Credential`, campo `data` (String) contendo um
  blob JSON cifrado em **AES-256-GCM** (formato `v1:<iv>:<tag>:<ciphertext>`, D-3).
  Leitura via `parseCredentialData`/`decryptCredential` (`src/credentialHealth.js`,
  `src/credentialCrypto.js`). `provider`/`platform` = `mercadolivre`.
- **Campos relevantes (dentro do JSON decifrado `data`)**:
  | Campo        | Tipo   | Papel |
  |--------------|--------|-------|
  | `ssid`       | string | cookie de sessão ML usado no createLink de afiliado |
  | `tag`        | string | identificador de afiliado (partner/handle) |
  | `vitrineUrl` | string | **link da vitrine própria da usuária** — fonte do fallback |
- **Validação de `vitrineUrl`**:
  - `credentialHealth.js` (~49-51): warning de UX se não casar
    `mercadolivre|mercadolibre|meli.la|mluvem.com`.
  - `isValidMlVitrineUrl(raw)` (`mercadolivre.js` ~867): `true` só se `raw` é URL
    parseável cujo hostname casa `ML_HOST`.
- **Uso**: `buildVitrineFallback(creds)` lê `creds.vitrineUrl`; se válido, devolve o
  substituto `{ url, linkKind:'coupon', warning:'ml_vitrine_fallback_used' }`.
- **Ponto de investigação**: confirmar que o `creds` entregue a `convert()` carrega
  o `vitrineUrl` decifrado (hipótese A da research).

## Entidade: MessageLog (registro por mensagem espelhada)

- **Persistência**: modelo Prisma `MessageLog` (SQLite, WAL).
- **Campos relevantes**:
  | Campo         | Papel |
  |---------------|-------|
  | `status`      | `queued`/`sending`/`success`/`skipped`/`error` |
  | `errorMsg`    | motivo na taxonomia canônica (prefixos `skip:` / `warning:` / `error:` / `timeout:`) |
  | `originalUrl` | link recebido do canal monitorado |
  | `convertedUrl`| link efetivamente usado (vitrine/afiliado) quando enviado |
  | `destGroup`   | grupo de destino; valor especial `'warning'` para linhas de notificação |
  | `userId`      | dona da oferta |
- **Prefixos de `errorMsg` desta feature**:
  - `warning:ml_vitrine_fallback_used` → linha de **notificação** (não é o status do
    envio); hoje traduzida como "A oferta saiu usando o link da SUA vitrine…".
  - `skip:*` → status `skipped` ("ignorado"): p.ex. `skip:title_mismatch`,
    `skip:dedup_recent_link`, `skip:no_valid_conversions`, `skip:policy:*`.
  - `error:conversion:*` (com "Cadastre o link da SUA vitrine") → recusa de conversão
    orientando cadastro de vitrine.
- **Invariante a garantir (FR-004)**: para uma mesma mensagem, a copy de sucesso da
  vitrine (`warning:ml_vitrine_fallback_used`) **não** deve coexistir com um
  `status='skipped'` — mensagem e desfecho precisam ser coerentes.
- **Regras de status/taxonomia**: qualquer ajuste passa por `classifyError()`
  (`src/errorTaxonomy.js`) e pelo tradutor `explainErrorMsg`
  (`dashboard/lib/painel/logsCopy.js` + `dashboard/lib/mobileLogs.js`). Não inventar
  prefixo fora da taxonomia.

## Entidade: Oferta / link original

- **Classificação** (o eixo que separa "substituir por vitrine" de "converter"):
  | Classe | Detecção | Desfecho esperado |
  |--------|----------|-------------------|
  | Produto conversível | `resolveToCleanProductUrl` devolve produto | converte link de afiliado da usuária — vitrine NÃO usada (FR-002/FR-005) |
  | Vitrine/perfil de terceiro (certeza) | recusa `unsupported_url` + `isDirectVitrineShare(original)` `/social/` | fallback: vitrine própria da usuária (FR-001) |
  | Recusa ambígua (encurtador não resolvido, SSID/403/429) | `unsupported_url` sem `/social/`, ou outro `mlFailureType` | descarte seguro, sem culpar vitrine (FR-006) |
- **Invariante de segurança (FR-003)**: o link original de terceiro **nunca** é
  encaminhado em nenhuma classe — só vitrine própria ou descarte.

## Relações e fluxo

```
Credential.data(cifrado) --decrypt--> creds{ ssid, tag, vitrineUrl }
        │
        ▼
convert(url, creds) → convertMlCouponWithoutProduct(url, creds)
        │  (ML recusa createLink: mlFailureType='unsupported_url')
        ├─ buildVitrineFallback(creds) válido → { warning:'ml_vitrine_fallback_used' }
        │        │
        │        ▼  bot-worker.js grava linha warning (destGroup='warning')  ← desalinhar aqui = bug
        │        └─ e DEVE resultar em envio success com convertedUrl=vitrine
        └─ sem vitrine + isDirectVitrineShare=false → null (descarte seguro)
```
