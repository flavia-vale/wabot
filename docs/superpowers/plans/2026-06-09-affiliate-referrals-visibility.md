# Affiliate Referrals Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar lista de clientes indicados no painel admin (linhas expansíveis) e no painel do afiliado (nota + tabela de indicados com status ativo/expirado).

**Architecture:** Backend expõe dois pontos de dados novos — o endpoint existente `GET /affiliate/me` passa a incluir `referrals[]` e um novo `GET /admin/affiliates/:id/referrals` retorna a mesma lista com e-mail para uso admin. A lógica de agregar comissões por usuário indicado é extraída como função pura `buildReferrals()` testável sem DB. No frontend, o `ApprovedTab` ganha expand/collapse com fetch sob demanda e cache local; o painel do afiliado ganha nota explicativa + tabela de indicados.

**Tech Stack:** Node.js + Prisma (SQLite), Fastify, Next.js (React), Tailwind CSS, node:test

---

### Task 1: Extrair e testar `buildReferrals()` no service

**Files:**
- Modify: `src/domain/affiliate/service.js`
- Create: `test/affiliate-service.test.js`

- [ ] **Step 1: Criar `test/affiliate-service.test.js` com teste falhando**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReferrals } from '../src/domain/affiliate/service.js'

test('buildReferrals agrega commissionAmountCents por referredUserId', () => {
  const users = [
    { id: 'u1', name: 'João', plan: 'pro', status: 'active', accessExpiresAt: new Date(Date.now() + 86400000) },
    { id: 'u2', name: 'Maria', plan: 'basic', status: 'inactive', accessExpiresAt: null },
  ]
  const commissions = [
    { referredUserId: 'u1', commissionAmountCents: 2000 },
    { referredUserId: 'u1', commissionAmountCents: 1500 },
    { referredUserId: 'u2', commissionAmountCents: 3000 },
  ]
  const result = buildReferrals(users, commissions)
  assert.equal(result[0].totalCommissionsCents, 3500)
  assert.equal(result[1].totalCommissionsCents, 3000)
  assert.equal(result[0].name, 'João')
  assert.equal('email' in result[0], false, 'não deve expor email por padrão')
})

test('buildReferrals com includeEmail=true expõe email', () => {
  const users = [{ id: 'u1', name: 'João', email: 'j@ex.com', plan: 'pro', status: 'active', accessExpiresAt: null }]
  const result = buildReferrals(users, [], true)
  assert.equal(result[0].email, 'j@ex.com')
})

test('buildReferrals retorna totalCommissionsCents=0 para usuário sem comissões', () => {
  const users = [{ id: 'u1', name: 'João', plan: 'trial', status: 'active', accessExpiresAt: null }]
  const result = buildReferrals(users, [])
  assert.equal(result[0].totalCommissionsCents, 0)
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd /home/user/wabot && node --test test/affiliate-service.test.js
```

Esperado: `SyntaxError` ou `not ok` — `buildReferrals` não existe ainda.

- [ ] **Step 3: Adicionar `buildReferrals` em `service.js` e modificar `getAffiliateMeData`**

Em `src/domain/affiliate/service.js`, adicionar a função logo antes de `getAffiliateMeData`:

```js
export function buildReferrals(users, commissions, includeEmail = false) {
  const commissionsByUser = {}
  for (const c of commissions) {
    commissionsByUser[c.referredUserId] = (commissionsByUser[c.referredUserId] ?? 0) + c.commissionAmountCents
  }
  return users.map(u => ({
    ...(includeEmail ? { id: u.id, email: u.email, createdAt: u.createdAt } : {}),
    name: u.name,
    plan: u.plan,
    status: u.status,
    accessExpiresAt: u.accessExpiresAt,
    totalCommissionsCents: commissionsByUser[u.id] ?? 0,
  }))
}
```

Substituir o corpo de `getAffiliateMeData` por:

```js
export async function getAffiliateMeData({ userId }) {
  const profile = await db.affiliateProfile.findUnique({ where: { userId } })
  if (!profile) return null

  const [referredUsers, commissions] = await Promise.all([
    db.user.findMany({
      where: { affiliateProfileId: profile.id },
      select: { id: true, name: true, plan: true, status: true, accessExpiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.affiliateCommission.findMany({
      where: { affiliateId: profile.id },
      orderBy: { cycleMonth: 'desc' },
    }),
  ])

  const totalEarnedCents = commissions.reduce((s, c) => s + c.commissionAmountCents, 0)
  const totalSales = commissions.length
  const totalReferrals = referredUsers.length

  const byMonth = {}
  for (const c of commissions) {
    if (!byMonth[c.cycleMonth]) byMonth[c.cycleMonth] = { month: c.cycleMonth, totalCents: 0, status: 'paid', count: 0 }
    byMonth[c.cycleMonth].totalCents += c.commissionAmountCents
    byMonth[c.cycleMonth].count++
    if (c.status === 'pending') byMonth[c.cycleMonth].status = 'pending'
  }

  return {
    profile,
    stats: { totalReferrals, totalSales, totalEarnedCents },
    months: Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)),
    referrals: buildReferrals(referredUsers, commissions),
  }
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
cd /home/user/wabot && node --test test/affiliate-service.test.js
```

Esperado:
```
ok 1 - buildReferrals agrega commissionAmountCents por referredUserId
ok 2 - buildReferrals com includeEmail=true expõe email
ok 3 - buildReferrals retorna totalCommissionsCents=0 para usuário sem comissões
# pass 3
```

- [ ] **Step 5: Rodar a suite completa para confirmar sem regressões**

```bash
cd /home/user/wabot && npm test 2>&1 | grep -E "^not ok|# fail|# pass"
```

Esperado: mesmos `not ok` pré-existentes; contagem `pass` cresce em 3.

- [ ] **Step 6: Commit**

```bash
git add src/domain/affiliate/service.js test/affiliate-service.test.js
git commit -m "feat: buildReferrals pura + referrals no retorno de getAffiliateMeData"
```

---

### Task 2: Novo endpoint `GET /admin/affiliates/:id/referrals`

**Files:**
- Modify: `src/api/routes/affiliate.js`

- [ ] **Step 1: Adicionar o endpoint em `affiliate.js`**

Inserir o bloco abaixo logo **após** o `app.get('/admin/affiliates/settings', ...)` (linha ~233) e **antes** do `app.put('/admin/affiliates/settings', ...)`. Isso garante que a rota estática é registrada antes das paramétricas, conforme o padrão do projeto.

```js
app.get('/admin/affiliates/:id/referrals', { onRequest: [app.authenticate] }, async (req, reply) => {
  const access = await requireAdminAccess(req, reply, 'billing:read')
  if (!access) return

  const { id } = req.params
  const profile = await db.affiliateProfile.findUnique({ where: { id } })
  if (!profile) return reply.code(404).send({ error: 'Afiliado não encontrado' })

  const [referredUsers, commissions] = await Promise.all([
    db.user.findMany({
      where: { affiliateProfileId: id },
      select: { id: true, name: true, email: true, plan: true, status: true, accessExpiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.affiliateCommission.findMany({
      where: { affiliateId: id },
      select: { referredUserId: true, commissionAmountCents: true },
    }),
  ])

  return { referrals: buildReferrals(referredUsers, commissions, true) }
})
```

Adicionar `buildReferrals` ao import no topo do arquivo:

```js
import { applyAffiliate, getAffiliateMeData, getAffiliateSettings, tryCreateAffiliateCommission, buildReferrals } from '../../domain/affiliate/service.js'
```

- [ ] **Step 2: Verificar que o servidor inicia sem erros**

```bash
cd /home/user/wabot && node -e "import('./src/api/server.js').then(() => { console.log('ok'); process.exit(0) }).catch(e => { console.error(e.message); process.exit(1) })"
```

Esperado: `ok` (ou silêncio — o servidor inicia e fecha).

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/affiliate.js
git commit -m "feat: GET /admin/affiliates/:id/referrals retorna indicados com totais"
```

---

### Task 3: Adicionar `adminAffiliateReferrals` no cliente da dashboard

**Files:**
- Modify: `dashboard/lib/api.js`

- [ ] **Step 1: Adicionar método**

Localizar o bloco de métodos `adminAffiliate*` em `dashboard/lib/api.js` e adicionar após `adminAffiliates`:

```js
adminAffiliateReferrals: (id) => apiFetch(`/api/admin/affiliates/${id}/referrals`),
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/lib/api.js
git commit -m "feat: adminAffiliateReferrals no cliente da dashboard"
```

---

### Task 4: `ApprovedTab` com linhas expansíveis

**Files:**
- Modify: `dashboard/app/admin/afiliados/page.js`

- [ ] **Step 1: Adicionar helper `isReferralActive` e novos estados**

Logo após a definição de `CommissionTypeBadge` (linha ~36), adicionar:

```js
function isReferralActive(r) {
  return r.status === 'active' && (!r.accessExpiresAt || new Date(r.accessExpiresAt) > new Date())
}
```

No início de `ApprovedTab`, adicionar os três novos estados após os existentes:

```js
const [expandedId, setExpandedId] = useState(null)
const [referralsCache, setReferralsCache] = useState({})
const [referralsLoading, setReferralsLoading] = useState({})
```

- [ ] **Step 2: Adicionar função `toggleExpand`**

Após `handleOverrideSave`, adicionar:

```js
function toggleExpand(id) {
  if (expandedId === id) { setExpandedId(null); return }
  setExpandedId(id)
  if (referralsCache[id] !== undefined) return
  setReferralsLoading(prev => ({ ...prev, [id]: true }))
  api.adminAffiliateReferrals(id)
    .then(result => {
      setReferralsCache(prev => ({ ...prev, [id]: result.referrals ?? [] }))
      setReferralsLoading(prev => ({ ...prev, [id]: false }))
    })
    .catch(() => {
      setReferralsCache(prev => ({ ...prev, [id]: [] }))
      setReferralsLoading(prev => ({ ...prev, [id]: false }))
    })
}
```

- [ ] **Step 3: Substituir a célula de `totalReferrals` por botão**

Localizar a célula que exibe `p.totalReferrals`:

```jsx
<td className="px-4 py-3 text-right text-gray-700">{p.totalReferrals}</td>
```

Substituir por:

```jsx
<td className="px-4 py-3 text-right">
  <button
    onClick={() => toggleExpand(p.id)}
    className="text-emerald-700 hover:underline font-semibold text-sm"
  >
    {p.totalReferrals} indicado{p.totalReferrals !== 1 ? 's' : ''} {expandedId === p.id ? '▴' : '▾'}
  </button>
</td>
```

- [ ] **Step 4: Adicionar linha expansível após o `<tr>` principal**

O `<tr>` principal do map está dentro do `<tbody>`. Envolver cada item em um Fragment e adicionar a linha de expansão:

```jsx
{profiles.map(p => (
  <Fragment key={p.id}>
    <tr className="bg-white">
      {/* ... células existentes sem alteração, exceto a de totalReferrals já trocada ... */}
    </tr>
    {expandedId === p.id && (
      <tr>
        <td colSpan={6} className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          {referralsLoading[p.id] ? (
            <p className="text-xs text-gray-500">Carregando indicados...</p>
          ) : (referralsCache[p.id] ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum indicado ainda.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pb-2 pr-4 text-gray-500 font-semibold uppercase tracking-wide">Nome / E-mail</th>
                  <th className="text-left pb-2 pr-4 text-gray-500 font-semibold uppercase tracking-wide">Cadastro</th>
                  <th className="text-left pb-2 pr-4 text-gray-500 font-semibold uppercase tracking-wide">Plano</th>
                  <th className="text-left pb-2 pr-4 text-gray-500 font-semibold uppercase tracking-wide">Status</th>
                  <th className="text-right pb-2 text-gray-500 font-semibold uppercase tracking-wide">Comissões geradas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(referralsCache[p.id] ?? []).map(r => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4">
                      <p className="font-semibold text-gray-800">{r.name ?? '—'}</p>
                      <p className="text-gray-400">{r.email}</p>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{formatDate(r.createdAt)}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.plan}</td>
                    <td className="py-2 pr-4">
                      {isReferralActive(r)
                        ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">Ativo</span>
                        : <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">Expirado</span>
                      }
                    </td>
                    <td className="py-2 text-right font-semibold text-gray-800">{formatCurrency(r.totalCommissionsCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </td>
      </tr>
    )}
  </Fragment>
))}
```

Adicionar `Fragment` ao import existente no topo do arquivo:

```js
import { useEffect, useState, Fragment } from 'react'
```

Usar `<Fragment key={p.id}>` no lugar de `<React.Fragment key={p.id}>` no map. (Shorthand `<>` não aceita `key`.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/admin/afiliados/page.js
git commit -m "feat: ApprovedTab com linhas expansíveis de indicados"
```

---

### Task 5: Painel do afiliado — nota + seção "Meus indicados"

**Files:**
- Modify: `dashboard/app/painel/afiliados/page.js`

- [ ] **Step 1: Adicionar `isReferralActive` helper**

Logo após a função `copyToClipboard` (linha ~18):

```js
function isReferralActive(r) {
  return r.status === 'active' && (!r.accessExpiresAt || new Date(r.accessExpiresAt) > new Date())
}
```

- [ ] **Step 2: Destruturar `referrals` do `data`**

Localizar (linha ~220):

```js
const { stats = {}, months = [] } = data
```

Substituir por:

```js
const { stats = {}, months = [], referrals = [] } = data
```

- [ ] **Step 3: Adicionar nota explicativa + seção de indicados**

Localizar o bloco `{months.length > 0 && (...)}` e inserir o bloco da nota logo **antes** dele:

```jsx
<div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
  Você recebe comissão em cada renovação ativa dos seus indicados. Quando um cliente expira ou não renova, as comissões desse cliente encerram automaticamente.
</div>
```

Após o bloco `{months.length > 0 && (...)}`, adicionar a seção de indicados:

```jsx
<div>
  <h2 className="text-base font-bold text-gray-800 mb-2">Meus indicados</h2>
  {referrals.length === 0 ? (
    <p className="text-sm text-gray-400">Nenhum cliente indicado ainda.</p>
  ) : (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Nome</th>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Plano</th>
            <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Status</th>
            <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Total gerado para você</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {referrals.map((r, i) => (
            <tr key={i} className="bg-white">
              <td className="px-4 py-3 font-semibold text-gray-900">{r.name ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">{r.plan}</td>
              <td className="px-4 py-3">
                {isReferralActive(r)
                  ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Ativo</span>
                  : <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Expirado</span>
                }
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(r.totalCommissionsCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/painel/afiliados/page.js
git commit -m "feat: nota de comissão recorrente e lista de indicados no painel do afiliado"
```

---

### Task 6: Push e PR

- [ ] **Step 1: Rodar suite completa para confirmar sem novas regressões**

```bash
cd /home/user/wabot && npm test 2>&1 | grep -E "^not ok|# fail|# pass"
```

Esperado: mesmos `not ok` pré-existentes (6 falhas pre-existentes), sem novos.

- [ ] **Step 2: Push**

```bash
git push -u origin claude/affiliate-program-plan-xkmvo2
```

- [ ] **Step 3: Atualizar PR #875 ou criar nova PR** conforme orientação do usuário.
