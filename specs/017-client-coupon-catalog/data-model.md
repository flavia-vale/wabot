# Phase 1 — Modelo de dados

**Feature**: 017-client-coupon-catalog | **Migration**: `20260919120000_client_coupon`

A mudança é **apenas aditiva** (FR-028): uma tabela nova e uma coluna nova com
default seguro. Nada é removido, renomeado ou reescrito.

---

## Entidade nova: `ClientCoupon`

Um código de desconto que pertence a **uma** cliente e vale para **uma** loja.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `id` | String (cuid) | sim | chave |
| `userId` | String | sim | dono; `onDelete: Cascade` (FR-007) |
| `code` | String | sim | o código que a cliente digita na loja. Gravado como veio, sem normalizar (loja diferencia maiúscula) |
| `label` | String? | não | nome interno, só para a cliente se achar na lista |
| `platform` | String | sim | uma de: `amazon`, `mercadolivre`, `shopee`, `magazineluiza`, `shein`, `aliexpress` (FR-003) |
| `discountType` | String | sim | `percent` ou `amount` |
| `discountValue` | Int | sim | `percent`: 1..100. `amount`: **centavos**, > 0 |
| `validUntil` | DateTime? | não | último instante de validade. `null` = nunca vence (FR-004) |
| `enabled` | Boolean | sim | default `true` |
| `createdAt` | DateTime | sim | default `now()` — **critério de desempate do FR-010** |
| `updatedAt` | DateTime | sim | `@updatedAt` |

Índices: `@@index([userId, enabled])` (é a consulta do `loadConfig`),
`@@index([userId, platform])`.

**Por que `discountValue` é Int em centavos e não Float**: dinheiro em ponto
flutuante produz `269.99999` no arredondamento, e FR-018f exige cálculo
determinístico com teste. Tudo o que é dinheiro nesta feature trafega em
centavos inteiros e só vira texto na formatação final. Para `percent` o campo
guarda a porcentagem inteira (10 = 10%), não centavos — o `discountType` diz
como ler.

**Código repetido é permitido** (edge case da spec): não há índice único em
`(userId, platform, code)`. A tela avisa, mas não recusa.

### Validação (FR-006) — recusada com mensagem em português simples

| Recusa | Mensagem para a cliente |
|---|---|
| sem `code` | "Escreva o código do cupom, do jeito que a loja te deu." |
| sem `platform` | "Escolha em qual loja este cupom vale." |
| `platform` fora da lista | "Esta loja ainda não é aceita." |
| `percent` fora de 1..100 | "A porcentagem precisa ser entre 1 e 100." |
| `amount` ≤ 0 | "O valor do desconto precisa ser maior que zero." |
| `validUntil` ilegível | "Não consegui entender essa data de validade." |

### Estados

```
ligado + sem validade      → vale sempre
ligado + validade futura   → vale até o último instante da data
ligado + validade passada  → VENCIDO: aparece marcado na tela, nunca é usado (FR-005)
desligado                  → não é usado; continua guardado (FR-005: nada é apagado sozinho)
```

O sistema **nunca** desliga nem apaga um cupom por conta própria.

---

## Entidade existente alterada: `OfferAutomation`

| Campo novo | Tipo | Default | Por quê |
|---|---|---|---|
| `useCoupons` | Boolean | **`false`** | FR-022/FR-023. O default é o que garante SC-005: automação criada antes da entrega nasce desmarcada e não muda de comportamento sozinha. |

Nenhum outro campo é tocado.

---

## Entidades existentes NÃO alteradas no banco

- **`BotConfig.mobileTemplatesJson`** (templates): fica como está. A saída do
  `{linhaDeCupom}` acontece na leitura (`canonicalizeTemplateBody`), não por
  reescrita do banco — a spec permite explicitamente, e reescrever template de
  cliente em produção é risco sem ganho.
- **`OfferQueueItem.text`**: fica como está. O token `{cupom}` viaja dentro do
  texto e é resolvido no envio.
- **`MessageLog`**: nenhum campo novo. O texto gravado é o de antes da
  substituição do cupom (o log grava na chegada/enfileiramento) — consequência
  aceita e registrada: o histórico mostra a oferta, não o cupom que saiu nela.

---

## Dado em memória (não é tabela): `couponContext`

Objeto escalar carregado pelo job de envio, para a decisão acontecer no
momento do envio sem consultar nada.

```
couponContext = {
  platform: 'shopee' | 'amazon' | ... | null,
  priceCents: number | null   // null = preço não confiável → FR-011
}
```

Só campos primitivos, de propósito: precisa sobreviver ao `JSON.stringify` do
BullMQ sem virar `{type:'Buffer'}` nem perder função (é a mesma restrição que o
`AGENTS.md` documenta para `payloadRecipe`). Ausência de `couponContext` no job
significa "este envio não tem cupom" — o token, se houver, é só apagado.

---

## SQL da migration (aditiva)

```sql
-- Cupons da própria cliente. Tabela nova e vazia: nada existente muda.
CREATE TABLE "ClientCoupon" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT,
  "platform" TEXT NOT NULL,
  "discountType" TEXT NOT NULL,
  "discountValue" INTEGER NOT NULL,
  "validUntil" DATETIME,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ClientCoupon_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ClientCoupon_userId_enabled_idx" ON "ClientCoupon"("userId", "enabled");
CREATE INDEX "ClientCoupon_userId_platform_idx" ON "ClientCoupon"("userId", "platform");

-- Opt-in por automação. DEFAULT false = automação existente não muda (FR-023).
ALTER TABLE "OfferAutomation" ADD COLUMN "useCoupons" BOOLEAN NOT NULL DEFAULT false;
```

### Acréscimo 2026-09-25: cupom por link, compra mínima, desconto máximo (FR-029/FR-030)

Migration `20260925120000_client_coupon_link_min_cap` (só aditiva):

| Coluna | Tipo | Regra |
|---|---|---|
| `kind` | TEXT NOT NULL DEFAULT `'code'` | `code` ou `link`; linha antiga = código |
| `redeemUrl` | TEXT NULL | obrigatório em `link`: `https://` do domínio da loja (`isStoreCouponLink`) |
| `minPurchaseCents` | INTEGER NULL | compra mínima em centavos; vazio = sem mínimo |
| `maxDiscountCents` | INTEGER NULL | teto em centavos; só vale para `percent` (em `amount` fica NULL) |

Cupom de link grava `code = ''` (a coluna segue NOT NULL). Aviso de repetido:
mesmo código na mesma loja (código) ou mesmo link na mesma loja (link).

