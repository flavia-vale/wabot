# Affiliate Referrals Visibility — Design Spec
Generated: 2026-06-09

## Contexto

O programa de afiliados gera comissões recorrentes a cada renovação do cliente indicado. Quando o cliente expira ou deixa de renovar, as comissões daquele cliente encerram automaticamente (por arquitetura — nenhum pagamento = nenhuma comissão). Esse comportamento não estava visível nem no painel do afiliado nem no painel admin.

Além disso, o painel admin mostrava apenas o número total de indicados por afiliado, sem lista dos clientes. Este spec cobre as duas lacunas.

---

## Mudanças

### 1. Backend

#### 1.1 Novo endpoint `GET /admin/affiliates/:id/referrals`

- Requer autenticação com permissão `billing:read`
- Parâmetro: `:id` = id do `AffiliateProfile`
- Retorna lista de usuários indicados com dados de assinatura e comissões geradas:

```json
{
  "referrals": [
    {
      "id": "clxxx",
      "name": "João Silva",
      "email": "joao@exemplo.com",
      "plan": "pro",
      "status": "active",
      "accessExpiresAt": "2026-07-15T00:00:00.000Z",
      "createdAt": "2026-01-12T10:00:00.000Z",
      "totalCommissionsCents": 4500
    }
  ]
}
```

- `totalCommissionsCents`: `SUM(commissionAmountCents)` de `AffiliateCommission` onde `referredUserId = user.id AND affiliateId = profile.id`
- Usuários buscados via `user.affiliateProfileId = profile.id`

#### 1.2 `getAffiliateMeData()` ampliado

Adiciona campo `referrals` ao retorno existente de `GET /affiliate/me`:

```json
{
  "referrals": [
    {
      "name": "João Silva",
      "plan": "pro",
      "status": "active",
      "accessExpiresAt": "2026-07-15T00:00:00.000Z",
      "totalCommissionsCents": 4500
    }
  ]
}
```

- Sem e-mail (afiliado não precisa saber o e-mail dos seus indicados)
- Status derivado de `user.status` e `accessExpiresAt`

---

### 2. Dashboard — API client

Novo método em `dashboard/lib/api.js`:

```js
adminAffiliateReferrals: (id) => apiFetch(`/api/admin/affiliates/${id}/referrals`)
```

---

### 3. Admin: aba Aprovados com linha expansível

**Arquivo:** `dashboard/app/admin/afiliados/page.js` — `ApprovedTab`

- Adicionar estado `expandedId` (string | null) — apenas um afiliado aberto por vez
- Adicionar estado `referralsCache` (objeto `{ [affiliateId]: referral[] }`) — evita refetch ao recolher e reabrir
- O total de indicados (`totalReferrals`) vira botão clicável "N indicados ▾" / "N indicados ▴"
- Ao expandir pela primeira vez, chama `api.adminAffiliateReferrals(id)`, salva no cache
- Sub-tabela renderizada em `<tr>` adicional com `colspan` da largura total, fundo `gray-50`

**Colunas da sub-tabela:**

| Nome / E-mail | Cadastro | Plano | Status | Comissões geradas |
|---|---|---|---|---|

**Status display:**
- `status === 'active'` e `accessExpiresAt` no futuro (ou null) → badge verde "Ativo"
- Caso contrário → badge vermelho "Expirado"

Loading spinner inline enquanto busca. Lista vazia exibe "Nenhum indicado ainda."

---

### 4. Painel do afiliado: nota + lista de indicados

**Arquivo:** `dashboard/app/painel/afiliados/page.js` — estado `approved`

#### 4.1 Nota explicativa

Bloco fixo acima da seção de ganhos mensais:

> "Você recebe comissão em cada renovação ativa dos seus indicados. Quando um cliente expira ou não renova, as comissões desse cliente encerram automaticamente."

#### 4.2 Seção "Meus indicados"

Abaixo dos ganhos mensais, nova seção com tabela:

| Nome | Plano | Status | Total gerado para você |
|---|---|---|---|

- Badge verde "Ativo" / vermelho "Expirado" (mesma lógica do admin)
- `totalCommissionsCents` = total que o afiliado recebeu especificamente por esse cliente
- Lista vazia: "Nenhum cliente indicado ainda."
- Dados vêm do `referrals` já incluído no retorno de `GET /affiliate/me` (sem chamada extra)

---

## Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `src/domain/affiliate/service.js` | `getAffiliateMeData` inclui `referrals` |
| `src/api/routes/affiliate.js` | Novo `GET /admin/affiliates/:id/referrals` |
| `dashboard/lib/api.js` | `adminAffiliateReferrals` |
| `dashboard/app/admin/afiliados/page.js` | `ApprovedTab` expansível |
| `dashboard/app/painel/afiliados/page.js` | Nota + seção "Meus indicados" |

## Sem mudanças de schema

A lógica de "expirado" é derivada de `user.status` e `user.accessExpiresAt` — campos já existentes. Nenhuma migration necessária.
