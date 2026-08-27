# Data model: Painel de vendas da Shopee

Este modelo é **transitório**. Não adiciona tabelas Prisma: descreve objetos normalizados em
memória e o DTO público do endpoint.

## SalesQuery

| Campo | Tipo | Regra |
|---|---|---|
| `from` | data ISO `YYYY-MM-DD` | obrigatória; início <= fim |
| `to` | data ISO `YYYY-MM-DD` | obrigatória; intervalo inclusivo, máximo 30 dias |
| `orderPage` | inteiro | default 1, mínimo 1 |
| `productPage` | inteiro | default 1, mínimo 1 |
| `limit` | inteiro | default 20, máximo 50 |
| `timeZone` | string allowlisted | default `America/Sao_Paulo`; usada para limites/exibição |

O backend converte datas civis em instantes sem sobrepor blocos. Datas futuras, invertidas ou
fora da janela retornam 400 com código estável.

## ProviderConversion (entrada privada)

Campos consumidos do `conversionReport`: `conversionId`, `checkoutId`, `clickTime`,
`purchaseTime`, `conversionStatus`, `utmContent`, `estimatedTotalCommission`, `netCommission`,
`totalCommission` e `orders[]`. Outros campos da resposta são ignorados.

### ProviderOrder

`orderId`, `orderStatus`, `shopType` e `items[]`.

### ProviderItem

`itemId`, `modelId`, `itemName`, `shopId`, `shopName`, `qty`, `itemPrice`, `actualAmount`,
`refundAmount`, `displayItemStatus`, `fraudStatus`, `completeTime`, `imageUrl` e as medidas de
comissão necessárias como fallback explicável. Nenhum dado de comprador é consultado.

## AttributedConversion

Conversão aceita somente quando `normalize(utmContent).startsWith('espelhagrupos')`.

| Campo | Fonte/regra |
|---|---|
| `key` | hash/identificador interno derivado de `conversionId`; nunca necessário na UI |
| `purchasedAt` | `purchaseTime` |
| `convertedClickAt` | `clickTime`; semanticamente “clique que converteu” |
| `rawStatus` | `conversionStatus` |
| `statusCategory` | `pending`, `unpaid`, `confirmed`, `cancelled`, `refunded`, `unclassified` |
| `estimatedCommission` | `estimatedTotalCommission`, sem somar alternativas |
| `confirmedCommission` | `netCommission` somente com status confirmado explícito; senão `null` |
| `orders` | pedidos normalizados e deduplicados |

### State transitions

Uma chave de conversão pode aparecer em leituras posteriores com mudanças:

`unpaid → pending → confirmed`, `unpaid|pending → cancelled`, ou
`confirmed → refunded`. Não há transição gravada localmente; cada snapshot substitui o anterior
na tela. Estado desconhecido nunca transita implicitamente para confirmado.

## SalesOrder (DTO público)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string opaca | estável só para key/paginação; não expõe segredo |
| `purchasedAt` | ISO datetime | data da conversão/pedido |
| `convertedClickAt` | ISO datetime ou null | apenas clique convertido |
| `status` | categoria conhecida | rótulo leigo derivado |
| `rawStatusLabel` | string segura | usado quando não classificado |
| `amount` | decimal ou null | soma de `actualAmount` dos itens do pedido uma vez |
| `estimatedCommission` | decimal ou null | parcela canônica aplicável |
| `confirmedCommission` | decimal ou null | somente conclusiva |
| `itemCount` | inteiro | soma de quantidades, distinto de pedidos |

## SalesProduct (DTO público)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string opaca | chave de UI, não um identificador de comprador |
| `name` | string | comprimento limitado/sanitizado |
| `shopName` | string ou null | comprimento limitado/sanitizado |
| `quantity` | inteiro | mínimo 0 |
| `amount` | decimal ou null | `actualAmount`; não inventar zero quando ausente |
| `status` | categoria conhecida | baseada no item, desconhecido = não classificado |
| `estimatedCommission` | decimal ou null | medida única do item quando exibida |
| `imageUrl` | URL Shopee HTTPS ou null | allowlist de host/protocolo; caso contrário omitida |
| `purchasedAt` | ISO datetime | para ordenação/exibição |

## SalesSummary

- `attributedPurchases`: número de conversões deduplicadas.
- `orderCount`: pedidos deduplicados.
- `itemQuantity`: soma de `qty`, explicitamente “itens”.
- `salesAmount`: soma de valores canônicos dos itens uma vez; `null` se não calculável.
- `estimatedCommission`: soma de `estimatedTotalCommission` por conversão uma vez.
- `confirmedCommission`: soma apenas das conversões conclusivamente confirmadas; `null` quando a
  fonte não permite conclusão.
- `statusCounts`: contagem por categoria, incluindo `unclassified`.

## SalesSnapshot

Contém `period`, `summary`, páginas de `orders` e `products`, `sourceUpdatedAt` (momento em que a
leitura completa terminou), `stale=false` e limites semânticos sobre cliques. Em falha, o frontend
mantém o snapshot anterior e marca `stale=true`; o erro não fabrica um snapshot zerado.

## Isolamento e privacidade

- A associação `Credential(userId, platform='shopee')` é obtida apenas com `req.user.sub`.
- Nenhum DTO contém `appId`, `secretKey`, `userId`, `checkoutId`, `conversionId` bruto ou comprador.
- Arrays são ordenados por data e chave estável antes da paginação; dedupe precede agregação.
