# Plano: Integrar Mobile v2 ao Backoffice Existente

**Data:** 2026-05-28  
**Branch:** `claude/epic-bardeen-ipF65`  
**Escopo:** Substituir dados mock das 13 páginas `/m/*` pelos endpoints `/api/*` já existentes  
**NÃO escopo:** construir features novas. Apenas wiring + tratamento de edge cases.

---

## 1. Diagnóstico Atual

### O que JÁ existe (não construir)

**Backoffice — Fastify API** (`src/api/routes/`): 14 arquivos, ~100 endpoints:
```
auth.js          → /api/auth/{login,register,recover,logout,me}
session.js       → /api/sessions, /api/sessions/qr, /pairing-code, /start, /stop
groups.js        → /api/groups, /api/wa-groups
config.js        → /api/config (GET/PUT)
credentials.js   → /api/credentials/:platform
logs.js          → /api/logs, /api/logs/summary
broadcast.js     → /api/broadcast, /api/scheduled (manual offer)
linkConversion.js→ /api/convert, /api/scrape-offer
payments.js      → /api/billing/*, /api/plans, /api/checkout
dashboard.js     → /api/overview, /api/finance/*, /api/marketing/*
preservation.js  → /api/monitoring/*
admin.js         → /api/admin/* (suporte)
public.js        → /api/public/{faq,plans,lp-content,tutorial-content}
clickTracker.js  → /api/groups/:id/clicks, /api/r/:hash
```

**Mobile v2 — Next.js App Router** (`dashboard/app/m/`): 13 páginas:
```
/m/                           → Home (dashboard inicial)
/m/account/                   → Conta do usuário
/m/account/subscription/      → Assinatura/billing
/m/account/templates/         → Templates de mensagem
/m/config/whatsapp/           → Conexão WhatsApp (QR)
/m/config/groups/             → Grupos origem/destino
/m/config/credentials/        → Credenciais de afiliado
/m/config/preferences/        → Preferências (cadência, filtros)
/m/op/logs/                   → Histórico de envios
/m/op/offer/                  → Criar oferta manual
/m/op/converter/              → Converter link em afiliado
/m/op/espelhar/               → Liga/desliga espelhamento
/m/help/tutorial/             → Tutorial
```

### O que está QUEBRADO

Todas as 13 páginas mobile usam **dados hardcoded** (`const items = [...]`, `const data = ...`). Nenhuma faz `fetch()`. Resultado: UI lindíssima, mas mostra mesmos dados fakes para todo mundo, e nenhuma ação tem efeito real.

**Exemplo concreto** (`dashboard/app/m/op/logs/page.js:176-200`):
```js
const items = [
  {id:0, hora:'14:48', status:'ok', source:'auto', loja:'Shopee', ...},
  {id:1, hora:'14:32', status:'fila', ...},
  // ... 9 items totalmente fakes
];
```

Esses 9 items deveriam vir de `GET /api/logs?userId=<jwt-sub>&limit=50`.

---

## 2. Mapeamento Página → Endpoint Existente

| Página Mobile | Endpoint(s) já existentes | Ação |
|---|---|---|
| `/m/` (home) | `GET /api/overview`, `GET /api/logs/summary`, `GET /api/sessions` | Substituir mock por fetch + render |
| `/m/account` | `GET /api/auth/me`, `GET /api/billing/webhooks` | Buscar perfil + status do plano |
| `/m/account/subscription` | `GET /api/plans`, `GET /api/subscriptions`, `POST /api/checkout` | Listar planos + ação de upgrade |
| `/m/account/templates` | `GET /api/config` (campo `templates`) + `PUT /api/config` | CRUD de templates via config |
| `/m/config/whatsapp` | `GET /api/sessions/qr-latest`, `POST /api/sessions/start`, `POST /api/sessions/stop`, `POST /api/sessions/pairing-code` | Pareamento QR/código |
| `/m/config/groups` | `GET /api/wa-groups`, `GET /api/groups`, `PUT /api/groups/:id/targets` | Listar grupos + configurar destinos |
| `/m/config/credentials` | `GET /api/credentials/:platform`, `PUT /api/credentials/:platform` | Credenciais Shopee/Amazon/ML |
| `/m/config/preferences` | `GET /api/config`, `PUT /api/config` | Cadência, palavras bloqueadas, etc |
| `/m/op/logs` | `GET /api/logs?filter=...&limit=50`, `GET /api/logs/summary` | Histórico + contadores dos filtros |
| `/m/op/offer` | `POST /api/scrape-offer`, `POST /api/broadcast`, `POST /api/scheduled` | Criar oferta manual (raspar + agendar/enviar) |
| `/m/op/converter` | `POST /api/convert`, `POST /api/links/shortlink` | Converter URL em link afiliado |
| `/m/op/espelhar` | `GET /api/config` (campo `mirrorEnabled`), `PUT /api/config` | Toggle on/off do espelhamento |
| `/m/help/tutorial` | `GET /api/public/tutorial-content` | Conteúdo do tutorial |

**Conclusão:** 13 páginas × ~2-4 endpoints cada = ~30-40 chamadas a fazer. Zero endpoint novo.

---

## 3. Padrão de Implementação (Reusável)

### 3.1 Convenção: hook `useApiData`

Criar **um único hook** que centraliza fetch + loading + erro + retry, igual ao desktop dashboard usa:

```js
// dashboard/components/mobile/useApiData.js
'use client'
import { useState, useEffect, useCallback } from 'react'

export function useApiData(path, { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (skip) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(path, { credentials: 'include' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [path, skip])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}
```

**Por quê:** cada página vira 3-5 linhas em vez de 30. Tratamento de 401 + erro fica uniforme.

### 3.2 Convenção: mutações via `apiMutate`

```js
// dashboard/components/mobile/apiMutate.js
export async function apiMutate(path, { method = 'POST', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) { window.location.href = '/login'; return }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${txt}`)
  }
  return res.headers.get('content-type')?.includes('json') ? res.json() : res.text()
}
```

### 3.3 Exemplo concreto: refazer `/m/op/logs`

**Antes** (hardcoded, 9 items fakes):
```js
const items = [{id:0, hora:'14:48', status:'ok', ...}, ...]
const filters = [{key:'todos', label:'Tudo', n: 184}, ...]
```

**Depois** (linked ao `/api/logs` real):
```js
'use client'
import { useApiData } from '@/components/mobile/useApiData'

export default function LogsPage() {
  const [filter, setFilter] = useState('todos')
  const { data: summary } = useApiData('/api/logs/summary')
  const { data: logs, loading, error, reload } =
    useApiData(`/api/logs?filter=${filter}&limit=50`)

  const filters = [
    {key:'todos',    label:'Tudo',       n: summary?.total ?? 0},
    {key:'fila',     label:'Aguardando', n: summary?.queued ?? 0},
    {key:'ok',       label:'Postados',   n: summary?.success ?? 0},
    {key:'falha',    label:'Erros',      n: summary?.error ?? 0},
    {key:'ignorado', label:'Não postados', n: summary?.skipped ?? 0},
  ]

  if (loading) return <MobileShell><Skeleton /></MobileShell>
  if (error) return <MobileShell><ErrorState onRetry={reload} /></MobileShell>

  const items = (logs?.items ?? []).map(toMobileItem)  // adaptador shape API→UI
  // ... resto do render
}
```

**Adaptador:** `toMobileItem` converte o shape do backend (`{ sentAt, destGroup, convertedUrl, status, errorMsg }`) para o shape esperado pela UI (`{ hora, para, link, status, erro }`). Fica em um arquivo só por página.

---

## 4. Ordem de Implementação Sugerida

Comecar pelas páginas **mais usadas e mais simples** (high ROI):

### Sprint 1 — fundação + 3 páginas read-only
- [ ] **Setup**: criar `useApiData.js` e `apiMutate.js` em `dashboard/components/mobile/`
- [ ] **`/m/op/logs`** — linkar a `GET /api/logs` + `/api/logs/summary`. (Maior valor, só leitura.)
- [ ] **`/m/`** (home) — linkar a `GET /api/overview` + `GET /api/sessions` (status WhatsApp). 
- [ ] **`/m/account`** — linkar a `GET /api/auth/me` + plano atual.

### Sprint 2 — config (read + write)
- [ ] **`/m/config/preferences`** — `GET /api/config` + `PUT /api/config`. Toggle simples.
- [ ] **`/m/op/espelhar`** — `PUT /api/config { mirrorEnabled: true|false }`.
- [ ] **`/m/config/credentials`** — `GET/PUT /api/credentials/:platform`.
- [ ] **`/m/config/groups`** — listar grupos + selecionar destinos.

### Sprint 3 — fluxos críticos
- [ ] **`/m/config/whatsapp`** — QR/pairing. Reaproveitar componente do desktop dashboard (`QRConnectionModal` ou similar) ou implementar polling em `/api/sessions/qr-latest`.
- [ ] **`/m/op/converter`** — `POST /api/convert` com retorno do shortlink.
- [ ] **`/m/op/offer`** — `POST /api/scrape-offer` (raspar) → `POST /api/broadcast` (enviar agora) ou `POST /api/scheduled` (agendar).

### Sprint 4 — assinatura + finalização
- [ ] **`/m/account/subscription`** — `GET /api/plans` + `POST /api/checkout` (Mercado Pago).
- [ ] **`/m/account/templates`** — CRUD via `/api/config.templates`.
- [ ] **`/m/help/tutorial`** — `GET /api/public/tutorial-content` (já é público).

---

## 5. Gaps Conhecidos (a tratar caso a caso)

Em geral todos os endpoints existem. Riscos pontuais a validar enquanto implementa cada página:

| Página | Risco | O que fazer |
|---|---|---|
| `/m/op/logs` | Confirmar que `/api/logs` aceita `?filter=ok\|fila\|falha\|ignorado` ou se filtra só por `status`. | Ler `src/api/routes/logs.js`. Se não aceita, mapear filtro mobile → query backend. Não criar novo endpoint. |
| `/m/op/logs` | Campo `dedupHits` deve aparecer como "+N repetições bloqueadas" (igual desktop). | Já existe — só renderizar. |
| `/m/account/templates` | Templates ficam dentro de `/api/config` ou em endpoint próprio? | Ler `src/api/routes/config.js` e `prisma/schema.prisma`. Provavelmente está em `Config.templates JSON`. |
| `/m/config/whatsapp` | Pareamento QR exige polling ou WebSocket? | Desktop usa polling em `/api/sessions/qr-latest` a cada 2s. Replicar. |
| `/m/op/offer` | Upload de imagem da oferta — multipart ou URL? | Ver `src/api/routes/broadcast.js`. Mobile pode mandar URL e backend raspa. |
| `/m/account/subscription` | Pagamento via Mercado Pago abre nova aba ou usa SDK embed? | Ver implementação desktop em `dashboard/app/dashboard/assinaturas/`. |

**Regra:** se um gap exigir endpoint novo, **pare e abra discussão** antes de codar. Provavelmente o endpoint já existe com outro nome.

---

## 6. Autenticação — como o mobile fala com a API

A API já valida JWT via cookie `Authorization` ou header. O proxy do Next (`dashboard/app/api/[...path]/route.js`) já encaminha cookies. **Não há nada a configurar** — basta usar `fetch(path, { credentials: 'include' })` que o cookie vai junto.

Se a página detectar 401 (token expirado), o `useApiData` redireciona para `/login` automaticamente.

---

## 7. Critérios de Aceite (por página)

Cada página linkada deve:
1. ✅ Carregar dados reais do usuário logado (não os mocks)
2. ✅ Mostrar skeleton/spinner enquanto carrega
3. ✅ Mostrar estado de erro com botão "Tentar de novo"
4. ✅ Mostrar estado vazio (ex: "Nenhum envio ainda")
5. ✅ Mutações (PUT/POST) atualizam UI otimisticamente OU recarregam após sucesso
6. ✅ 401 redireciona para `/login`
7. ✅ Logado como user A vê dados de A; logado como user B vê de B
8. ✅ Smoke test em staging com conta de teste

---

## 8. O Que NÃO Fazer

- ❌ Criar endpoints novos sem confirmar que não existe equivalente
- ❌ Mudar schema Prisma para acomodar o mobile (mobile se adapta à API, não o contrário)
- ❌ Construir WebSocket/streaming sem necessidade (não há requisito de real-time no mobile v2)
- ❌ Duplicar lógica de negócio entre mobile e desktop (a lógica está no backend, mobile só renderiza)
- ❌ Mexer no bot-supervisor (esse fluxo já funciona, mobile só consome status via `/api/sessions`)
- ❌ Otimização prematura (cache complexo, SWR, react-query) — `useApiData` simples basta na fase 1

---

## 9. Próximo Passo Concreto

Sugiro começar **agora** por `/m/op/logs` porque:
- É a tela mais usada após login
- É read-only (sem risco de mutar dados)
- `/api/logs` e `/api/logs/summary` já estão testados pelo desktop
- Dá pra validar o padrão `useApiData` antes de espalhar pelas outras 12 páginas

Se concordar, posso:
1. Criar `dashboard/components/mobile/useApiData.js`
2. Refatorar `dashboard/app/m/op/logs/page.js` para usar dados reais
3. Validar em staging com sua conta
4. Documentar o padrão pras próximas páginas

---

**Resumo:** o backoffice está pronto. O mobile está pronto visualmente. Falta apenas **trocar os arrays hardcoded por chamadas `fetch`** em 13 páginas. Não há feature nova a construir.
