# Design: Melhorias nas Automações de Oferta Shopee

**Data:** 2026-06-01
**Branch:** claude/shopee-affiliate-offers-api-ADOlJ

---

## Escopo

Quatro mudanças independentes nas automações de oferta Shopee:

1. Placeholders `{{grupoLink}}` e `{{cupomLink}}` nos ganchos/CTAs
2. "Priorizar comissão extra do vendedor" (renomear `isAMSOffer` → `prioritizeAMS` com nova lógica de duas buscas)
3. Intervalo mínimo de 15 minutos (era 1 hora)
4. *(informacional)* Deduplicação via `sentItemIds` — já implementada, documentada abaixo

---

## 1. Placeholders de links nos ganchos/CTAs

### Comportamento

O usuário escreve nos ganchos/CTAs textos como:

```
📲 Entre no nosso grupo: {{grupoLink}}
🎟️ Use o cupom: {{cupomLink}}
```

Na hora do envio, `{{grupoLink}}` e `{{cupomLink}}` são substituídos pelos links configurados pelo usuário.

### Schema

Novo campo em `BotConfig`:

```prisma
couponLink  String  @default("")
```

`brandingGroupLink` (já existente em `BotConfig`) é reaproveitado como fonte do `{{grupoLink}}` — mesmo campo, dois pontos de uso (branding de canais + placeholders de automação). Sem campo novo para o link de grupo.

### Backend

**Migration:** adicionar `couponLink` a `BotConfig`.

**`GET /api/config`:** incluir `couponLink` na resposta (já inclui `brandingGroupLink`).

**`PUT /api/config`:** aceitar `couponLink` (String, trim, sem validação de formato — pode ficar vazio).

**`src/core/copyVariation.js` — `applyVariation(text, opts)`:**

Novos opts: `groupInviteLink` e `couponLink`. Após resolver `{{gancho}}`, `{{cta}}`, `{{convitegrupo}}`, aplica um segundo pass:

```js
text = text
  .replace(/\{\{grupoLink\}\}/g, groupInviteLink ?? '')
  .replace(/\{\{cupomLink\}\}/g, couponLink ?? '')
```

Se o link estiver vazio, o placeholder é removido (substituído por string vazia).

**`src/offerAutomation/dispatcher.js` — `runAutomation`:**

Após buscar `botConfig`, passar para `applyVariation`:

```js
applyVariation(base, {
  groupId: automation.destGroupJid,
  poolJson,
  groupInviteLink: botConfig?.brandingGroupLink ?? '',
  couponLink: botConfig?.couponLink ?? '',
  random: true,
})
```

### UI — página Ganchos e CTAs (`variacoes-de-texto/page.js`)

Nova seção **"Links"** no topo da página, antes do editor de variações:

- Campo "Link de convite do grupo" → lê/grava `brandingGroupLink` via `PUT /api/config`
- Campo "Link de cupom" → lê/grava `couponLink` via `PUT /api/config`
- Dica inline: `Use {{grupoLink}} e {{cupomLink}} nos seus ganchos e CTAs`
- Salvam junto com as variações de texto no mesmo botão "Salvar"

> O campo "Link do grupo" em Configurações continua funcionando — é o mesmo `brandingGroupLink`. Edição em qualquer das duas páginas reflete na outra.

---

## 2. Priorizar comissão extra do vendedor (`prioritizeAMS`)

### Mudança de semântica

| Antes | Depois |
|-------|--------|
| `isAMSOffer: true` = buscar **apenas** produtos com comissão extra | `prioritizeAMS: true` = buscar com e sem comissão, enviar os **com comissão primeiro** |

### Schema

```prisma
// Renomear via migration
prioritizeAMS  Boolean  @default(false)
// isAMSOffer removido
```

**Migration:** `ALTER TABLE OfferAutomation RENAME COLUMN isAMSOffer TO prioritizeAMS`

> Dados existentes preservados — quem tinha `isAMSOffer = false` (maioria) continua com `prioritizeAMS = false`. Quem tinha `isAMSOffer = true` passa a priorizar em vez de filtrar exclusivamente, comportamento melhor.

### Lógica no dispatcher (`runAutomation`)

**Quando `prioritizeAMS = false` (padrão):**
Sem alteração — único fetch, sem `isAMSOffer` no payload GraphQL.

**Quando `prioritizeAMS = true`:**

```
1. fetchOffers({ ..., isAMSOffer: true,  limit: offersPerSend * 4, excludeItemIds: sentItemIds })
   → amsOffers

2. amsItemIds = amsOffers.map(o => String(o.itemId))

3. fetchOffers({ ..., isAMSOffer: false, limit: offersPerSend * 4, excludeItemIds: [...sentItemIds, ...amsItemIds] })
   → regularOffers

4. toSend = [...amsOffers, ...regularOffers].slice(0, offersPerSend)
```

Se o primeiro fetch retornar ofertas suficientes (`>= offersPerSend`), o segundo fetch ainda ocorre para complementar caso necessário, mas o slice limita o total.

`fetchOffers` em `shopeeOffers.js` não muda — `isAMSOffer` continua sendo um parâmetro booleano passado para o GraphQL.

### Rotas da API (`offerAutomation.js`)

- `POST /api/offer-automations`: aceitar `prioritizeAMS` (Boolean, default false); remover `isAMSOffer`
- `PUT /api/offer-automations/:id`: aceitar `prioritizeAMS`; remover `isAMSOffer`

### UI — página de automações (`ofertas-automaticas/page.js`)

Substituir o toggle/checkbox `isAMSOffer` por:

```
[ ] Priorizar ofertas com comissão extra do vendedor
    Se ativado, o bot buscará os dois tipos e enviará primeiro
    as ofertas com comissão extra.
```

---

## 3. Intervalo mínimo de 15 minutos

### Backend (`src/api/routes/offerAutomation.js`)

```js
const VALID_INTERVALS = [15, 30, 45, 60, 120, 240, 360, 720, 1440]
```

### Frontend (`dashboard/app/dashboard/ofertas-automaticas/page.js`)

```js
const INTERVAL_OPTIONS = [
  { value: 15,   label: 'A cada 15 minutos' },
  { value: 30,   label: 'A cada 30 minutos' },
  { value: 45,   label: 'A cada 45 minutos' },
  { value: 60,   label: 'A cada 1 hora' },
  { value: 120,  label: 'A cada 2 horas' },
  { value: 240,  label: 'A cada 4 horas' },
  { value: 360,  label: 'A cada 6 horas' },
  { value: 720,  label: 'A cada 12 horas' },
  { value: 1440, label: 'Uma vez por dia' },
]
```

Sem migration, sem schema change.

---

## 4. Como funciona a deduplicação (informacional)

Cada `OfferAutomation` tem um campo `sentItemIds` (JSON array de strings, max 200 entradas) persistido no banco. Fluxo:

1. Ao disparar, o bot lê `sentItemIds` do banco.
2. Passa como `excludeItemIds` para `fetchOffers` → os IDs são excluídos localmente após o retorno da API (a API Shopee não suporta exclusão por ID).
3. Após enviar, os novos `itemId`s são adicionados ao array (função `addSentIds` em `dispatcher.js`).
4. Se o array ultrapassa 200 entradas, as mais antigas são descartadas (`slice(length - 200)`).
5. O array atualizado é salvo no banco junto com `lastSentAt`.

Isso garante que ofertas recentes não se repitam. O janela efetiva depende do volume de produtos disponíveis — com 200 IDs e `offersPerSend = 3`, são ~66 disparos de histórico.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Adicionar `couponLink`; renomear `isAMSOffer → prioritizeAMS` |
| `prisma/migrations/...` | Duas migrations (ou uma combinada) |
| `src/core/copyVariation.js` | Substituição de `{{grupoLink}}` e `{{cupomLink}}` |
| `src/offerAutomation/dispatcher.js` | Lógica de duas buscas para `prioritizeAMS`; passar links para `applyVariation` |
| `src/api/routes/offerAutomation.js` | `VALID_INTERVALS` atualizado; campo `prioritizeAMS` |
| `src/api/routes/config.js` | Aceitar/retornar `couponLink` |
| `dashboard/app/dashboard/ofertas-automaticas/page.js` | `INTERVAL_OPTIONS` atualizado; UI de `prioritizeAMS` |
| `dashboard/app/dashboard/variacoes-de-texto/page.js` | Seção "Links" com `brandingGroupLink` e `couponLink` |

---

## Ordem de implementação

1. Migration (schema + couponLink + renomear isAMSOffer)
2. `copyVariation.js` — substituição dos novos placeholders
3. `dispatcher.js` — lógica prioritizeAMS + passar links
4. `offerAutomation.js` (rotas) — VALID_INTERVALS + prioritizeAMS
5. `config.js` (rotas) — couponLink
6. Frontend — `ofertas-automaticas/page.js`
7. Frontend — `variacoes-de-texto/page.js`
