# Contrato — regra pura de escolha do cupom

Arquivo: `src/core/clientCouponPolicy.js` · Teste: `test/client-coupon-policy.test.js`

**Invariantes do módulo** (verificadas por teste estrutural — SC-007):

- não importa `db`, Prisma, `fetch`, Redis, Baileys nem nada de `dashboard/`;
- nenhuma função é `async`;
- `Date.now()` nunca é lido lá dentro — o instante entra por parâmetro (`now`),
  senão o teste de "cupom que vence entre o cadastro e o envio" não é
  determinístico.

---

## `chooseCoupon({ coupons, platform, priceCents, now })`

Devolve `{ coupon, savingsCents, finalPriceCents } | null`.

**Filtro** (nesta ordem):
1. `platform` ausente/desconhecida → `null` (não adivinhar loja).
2. sobra só cupom com `enabled === true`, `platform` igual e não vencido
   (`validUntil == null || validUntil >= now`).
3. lista vazia → `null`.

**Escolha com preço confiável** (`priceCents` inteiro > 0):
- economia de `percent` = `Math.round(priceCents * discountValue / 100)`;
- economia de `amount` = `Math.min(discountValue, priceCents)` — **o teto do
  FR-009**, que é o que impede um cupom de R$ 500 ganhar numa oferta de R$ 50;
- vence a maior economia; empate → `createdAt` mais recente (FR-010).

**Escolha sem preço confiável** (`priceCents` nulo/0/negativo/`NaN`) — FR-011,
ordem fixa e previsível, nunca comparação inventada:
1. maior `percent`;
2. depois maior `amount`;
3. depois `createdAt` mais recente.

**`finalPriceCents`**: `priceCents - savingsCents`, e **`null`** quando o preço
não é confiável **ou** o resultado é `<= 0` (FR-018c). Nunca zero, nunca
negativo, nunca inventado.

**Nunca lança.** Entrada malformada (cupom sem `discountType`, valor não
numérico, `coupons` que não é array) é ignorada item a item; no pior caso
devolve `null`.

---

## `renderCouponText({ coupon, priceCents, finalPriceCents })`

| Entrada | Saída |
|---|---|
| preço e final conhecidos | `🎟️ Use o cupom BEMVINDO10 — de R$ 300,00 por R$ 270,00 com o cupom` |
| `finalPriceCents === null`, cupom `percent` | `🎟️ Use o cupom BEMVINDO10 (10% de desconto)` |
| `finalPriceCents === null`, cupom `amount` | `🎟️ Use o cupom TOP50 (R$ 50,00 de desconto)` |
| `coupon` nulo | `''` |

**A expressão "com o cupom" é obrigatória** sempre que aparece o preço menor
(FR-018e). Teste falha se ela sumir: sem ela, uma condição declarada vira
promessa de preço.

---

## `applyCouponToken(text, couponText)`

Substitui `{cupom}` por `couponText`. Com `couponText` vazio, remove a **linha
inteira** do token antes de substituir, e depois faz a mesma limpeza de sobra
que `stripUnresolvedPlaceholders` já faz (parênteses vazios, `**`, `~~`, linha
só com emoji, espaço duplo, 3+ quebras) — FR-017/SC-003.

Token repetido no corpo: substituído em **todas** as posições, sem erro (edge
case da spec).

## `parseOfferPriceToCents(text)`

`"R$ 1.299,90"` → `129990`. Devolve `null` para vazio, faixa de preço,
"a partir de", número não finito ou `<= 0`. Ler errado e devolver `null` é o
comportamento desejado: sem preço confiável cai no FR-011, que é seguro.

## `formatBrl(cents)`

`toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` sobre
`cents / 100`. Duas casas, vírgula decimal — mesmo padrão de `priceStr` em
`src/offerAutomation/dispatcher.js`.

---

## Casos obrigatórios no teste (FR-013 + FR-018f + FR-018g)

comparação percentual × fixo nos dois sentidos (R$ 300 e R$ 100) · empate pelo
mais recente · cupom vencido ignorado · cupom desligado ignorado · loja
diferente ignorada · loja desconhecida → `null` · preço ausente cai na ordem
fixa · teto do valor em reais · `finalPriceCents` nulo quando desconto ≥ preço ·
arredondamento de centavo (ex.: 33% de R$ 19,99) · formatação em reais · token
repetido · token sem cupom não deixa sobra · entrada malformada não lança.
