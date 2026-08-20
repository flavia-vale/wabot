# Contrato — `src/converters/shein.js`

Módulo novo. Referência direta de implementação: `scripts/diag-shein-affiliate-link.mjs`
(read-only, já commitado e validado ao vivo em 2026-08-18). Portar a lógica, trocando `fetch` global
por `fetchImpl` injetável e os `console.log` por retorno de valor.

Estrutura espelha `src/converters/shopee.js` (resolvedor + conversor no mesmo módulo), sem API.

---

## Constantes exportadas (fonte única de verdade)

```js
SHEIN_PRODUCT_RE   = /-p-(\d+)(?:-cat-(\d+))?\.html/i
SHEIN_GOODS_ID_RE  = /[?&]goods_id=(\d+)/i
SHEIN_RISK_RE      = /\/risk\/(?:challenge|action)/i

// Removidos do link antes de aplicar a identidade da cliente.
THIRD_PARTY_PARAMS = ['url_from','koc_id','aff_id','src_identifier','onelink','requestId','behaviorId']
// + qualquer chave que case /^utm_/i

// Token opaco do botão "compartilhar" do app — recusa dura.
OPAQUE_SHARE_PARAMS = ['shc','link']

// Constantes do programa de afiliados (NÃO fazem parte do cadastro da cliente).
PROGRAM_PARAMS = { scene:'1', test:'5051', ad_type:'KOC', campaign:'goods', campaign_id:'20' }

// Prefixo literal do parâmetro derivado.
AFFILIATE_URL_FROM_PREFIX = 'affiliate_koc_'
```

---

## `isSheinShortLink(url) → boolean`

`true` para host `onelink.shein.com` ou `shein.top` (com o prefixo `(?:[a-z0-9-]+\.)*`).

---

## `resolveSheinShortLink(url, { totalTimeoutMs = 8000, maxHops = 6, fetchImpl = globalThis.fetch }) → Promise<string>`

Segue redirects **manualmente**, com cookie jar, e devolve a URL do hop mais informativo.

`totalTimeoutMs` é orçamento **da cadeia inteira**, não por hop (T066). Prazo por
hop somava até 48s de pior caso, acima dos 25s de `MSG_QUEUE_TIMEOUT_MS` — a
mensagem inteira morreria como `timeout:incoming` em vez de o link falhar
honestamente e a oferta seguir. O corpo é lido por `readBodyLimited`, com teto de
512KB (mesmo valor da Shopee), devolvendo o que coletou.

Ordem de decisão por hop (não reordenar):

1. Se a URL atual já revela o produto (`SHEIN_PRODUCT_RE` ou `SHEIN_GOODS_ID_RE`) → **retorna ela**.
2. Faz `fetch` com `redirect: 'manual'`, UA de navegador móvel, `Accept-Language: pt-BR`, cookies
   acumulados; grava os `Set-Cookie` da resposta no jar.
3. Se há `Location`: resolve contra a URL atual. **Se o destino casar `SHEIN_RISK_RE`, para e retorna
   a URL atual** (o hop anterior é o que tem os dados). Senão segue.
4. Sem `Location` e corpo `text/html`: extrai o destino do HTML, nesta ordem de padrões —
   `<input id="url" value="...">` **primeiro** (é o padrão real do oneLink), depois meta-refresh,
   depois `location =` em JS, depois `<link rel=canonical>`. Mesma checagem de `/risk/` antes de
   seguir.
5. Sem destino, ou `maxHops` esgotado, ou erro de rede/timeout → retorna a última URL conhecida.

**Nunca** usar `fetch(redirect: 'follow')`: perde o hop com os dados.

Não lança. Falha de rede degrada para "não resolveu" (o `convert` decide recusar).

---

## `extractSheinGoodsId(url) → string | null`

Caminho (`-p-<id>.html`) ou query (`goods_id=<id>`). `null` quando nenhum.

---

## `hasOpaqueShareToken(url) → boolean`

`true` se houver `shc` ou `link` na query.

---

## `stripSheinAffiliateTracking(url) → string`

Remove `THIRD_PARTY_PARAMS` e toda chave `utm_*`. **Preserva** caminho, `goods_id` e todos os demais
parâmetros de destino. URL inválida → devolve a entrada inalterada.

---

## `convert(url, creds) → Promise<{ url, linkKind } | null>`

Contrato de `CONVERTERS` (`src/converters/index.js`): pode devolver string, objeto ou `null`. Aqui
sempre objeto ou `null`.

```
entrada: url (link de SHEIN da mensagem), creds = { tag: '<identificador da cliente>' }
```

Passos:

1. Sem `creds.tag` válido → `null`.
2. `isSheinShortLink(url)` → `resolveSheinShortLink`. Senão usa a URL como está.
3. `hasOpaqueShareToken(resolvida)` → **`null`** (FR-014).
4. `stripSheinAffiliateTracking(resolvida)`.
5. Aplica a identidade da cliente: `koc_id = tag` e `url_from = 'affiliate_koc_' + tag`.
6. Garante as `PROGRAM_PARAMS` ausentes (constantes do programa).
7. `linkKind`: `'product'` se `extractSheinGoodsId` devolveu id; senão `'coupon'`.
8. Se `linkKind === 'product'` mas o `goods_id` sumiu do resultado → `null` (nunca publicar link de
   produto sem produto).
9. Qualquer exceção → `null`.

### Invariantes verificáveis (viram teste)

| # | Invariante |
|---|---|
| INV-1 | O valor de retorno **nunca** é (nem contém) a URL de origem de terceiro com a identidade dele. Se o identificador do afiliado de origem aparecer na saída, é bug grave |
| INV-2 | Link com `shc`/`link` → `null`, sempre |
| INV-3 | Link de produto cuja resolução não achou `goods_id` → `null` |
| INV-4 | `onelink`, `requestId`, `behaviorId`, `utm_*` nunca aparecem na saída |
| INV-5 | Falha de rede/timeout na resolução → `null`, nunca a URL original |
| INV-6 | Cupom/campanha converte sem depender de `COUPON_LINK_CONVERT` |

---

## Registro no dispatcher

`src/converters/index.js`:

```js
import { convert as convertShein } from './shein.js'
const CONVERTERS = { ..., shein: convertShein }
```

`convertLink` já retorna `null` quando não há credencial da plataforma — o caminho
"loja não configurada" (FR-017 / US2 cenário 3) é o existente, sem código novo.

---

## Testes (sem rede, `fetchImpl` injetado)

**`test/converters-shein.test.js`**
- produto direto (`-p-<id>.html`) converte com `koc_id` e `url_from` da cliente e `linkKind:'product'`;
- destino `m.shein.com/br/ark/default` de **outro** afiliado: identidade dele sai, a da cliente entra,
  `goods_id` preservado (INV-1);
- `shc`/`link` → `null` (INV-2);
- sem `goods_id` num link que se diz de produto → `null` (INV-3);
- `onelink`/`requestId`/`behaviorId`/`utm_*` ausentes da saída (INV-4);
- `fetchImpl` que rejeita → `null` (INV-5);
- cupom/campanha → `linkKind:'coupon'`, com `COUPON_LINK_CONVERT` ausente (INV-6);
- sem `creds.tag` → `null`.

**`test/shein-shortlink-resolve.test.js`**
- 1º hop 200 com `<input id="url">` → segue para o destino;
- hop intermediário já com `goods_id` → para ali, sem pedir o próximo;
- `Location` apontando para `/risk/challenge` → para no hop anterior e o devolve;
- corpo HTML cujo único destino é `/risk/challenge` → idem;
- cadeia sem fim → para em `maxHops`;
- cookies do hop 1 são reenviados no hop 2.
