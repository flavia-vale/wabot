# Mobile v2 Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o front das 11 rotas mobile (`/m/*`) pelo design v2 entregue no ZIP, criar 3 rotas novas (`/m/op/espelhar`, `/m/account`, `/m/account/templates`), remover 1 rota (`/m/op/sends`), e manter `/m/op/converter` intacto.

**Architecture:** Sistema de design via CSS variables globais (`--ink`, `--accent-strong`, etc.). Chrome compartilhado (`MobileShell`) refatorado para topbar + bottom nav v2 (5 tabs com botão central destacado). Páginas usam inline styles com `var(--token)`, biblioteca compartilhada de SVGs (`MobileIcons.jsx`) e primitivos visuais (`mobileStyles.js`). Sem mudança em backend/dados — mocks do v2 mantidos.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4 (para non-mobile), CSS variables (para mobile v2). Pure client components (`'use client'`).

**Spec:** `docs/superpowers/specs/2026-05-27-mobile-v2-refactor-design.md`
**V2 source (referência):** `docs/superpowers/specs/v2-source/mobile-*.jsx`

---

## Conversion Recipe (referenciado por toda task de página)

Toda página v2 é copiada do componente correspondente em `docs/superpowers/specs/v2-source/` aplicando estas regras de conversão:

1. **Wrapper:** trocar `<MobileFrame title="..." active="...">` por `<MobileShell title="..." active="...">`.
2. **Icons:** trocar `<Icon name="x" size={n} stroke={s}/>` por `<MobileIcon name="x" size={n} stroke={s}/>`. O `MobileIcon` é importado de `@/components/mobile/MobileIcons`.
3. **Estilos compartilhados:** se a página usa `mobi.btn(...)`, `mobi.card`, `mobi.sectionLabel`, `mobi.pagePad`, importar `mobi` de `@/components/mobile/mobileStyles`.
4. **Estilos locais:** constantes de estilo locais ao arquivo (`homeStyles`, `criarStyles`, `espStyles`, etc.) ficam **dentro do arquivo da página** como `const xxxStyles = {...}`.
5. **Sub-componentes auxiliares:** funções auxiliares locais (`HomeSparkline`, `IncluirTagBlock`, etc.) ficam no mesmo arquivo da página.
6. **Estado React:** v2 usa props para variar estados (`state='converted'`, `view='list'`). Manter os defaults v2 — não converter para `useState` salvo onde já houver interatividade óbvia.
7. **Diretiva:** adicionar `'use client'` no topo. Toda página v2 usa interação (botões, toggles).
8. **Observability:** adicionar `useMobileRoutePerf('m/<rota>')` no topo do componente, importado de `@/components/mobile/MobileObservability`.
9. **Default export:** `export default function NomePage() { ... }`.
10. **Hooks de dados antigos:** remover `useMockAsyncData`, `MobileErrorCard`, `MobileLoadingCard`, `VirtualList` das páginas refatoradas — o v2 não usa esses padrões.
11. **Mocks:** preservar todos os mocks hard-coded do v2 (arrays/objetos in-file). Não tentar conectar com dados reais.

### Template de página v2 (modelo a seguir)

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const localStyles = {
  // copiar fielmente do v2
}

// sub-componentes auxiliares (se houver)
function Sparkline() { /* ... */ }

export default function XxxPage() {
  useMobileRoutePerf('m/<rota>')
  return (
    <MobileShell title="Conversor" active="<tab>">
      {/* JSX adaptado do v2 */}
    </MobileShell>
  )
}
```

### Tab `active` por rota

| Rota                         | `active` value |
|------------------------------|----------------|
| `/m`                         | `'inicio'`     |
| `/m/op/espelhar`             | `'espelhar'`   |
| `/m/op/offer`                | `'criar'`      |
| `/m/op/logs`                 | `'envios'`     |
| `/m/account`                 | `'conta'`      |
| `/m/account/*`               | `'conta'`      |
| `/m/config/*`                | `'conta'` (acessadas via Conta) |
| `/m/help/tutorial`           | `'conta'` (acessada via Conta) |

---

## Phase 1 — Infrastructure

### Task 1.1: Adicionar CSS variables globais

**Files:**
- Modify: `dashboard/app/globals.css`

- [ ] **Step 1: Adicionar bloco `:root` com tokens v2**

Editar `dashboard/app/globals.css`, adicionando o bloco abaixo **depois** do `@import 'tailwindcss';` e **antes** do `html, body { ... }`:

```css
:root {
  --bg: #EEF6F2;
  --bg-soft: #DDEDE5;
  --surface: #FCFEFD;
  --ink: #1F2D2A;
  --ink-soft: #5A6E68;
  --ink-faint: #8FA09A;
  --accent: #7CC9A9;
  --accent-strong: #3E9C7A;
  --accent-2: #D9CFEA;
  --accent-3: #F6E8D8;
  --line: rgba(31,45,42,0.10);
  --line-strong: rgba(31,45,42,0.18);
  --danger: #D97757;
  --success: #3E9C7A;
  --warn: #E8A45A;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/globals.css
git commit -m "feat(mobile): adiciona CSS variables do design system v2"
```

---

### Task 1.2: Criar biblioteca de ícones `MobileIcons.jsx`

**Files:**
- Create: `dashboard/components/mobile/MobileIcons.jsx`

- [ ] **Step 1: Criar arquivo com todos os ícones v2**

Criar `dashboard/components/mobile/MobileIcons.jsx`:

```jsx
'use client'

export function MobileIcon({ name, size = 20, stroke = 1.6 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }
  switch (name) {
    case 'link':
      return <svg {...props}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 1 0 11 21l1.5-1.5"/></svg>
    case 'bolt':
      return <svg {...props}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
    case 'shield':
      return <svg {...props}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z"/></svg>
    case 'chat':
      return <svg {...props}><path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1.4 3.4A8 8 0 0 1 21 12z"/><path d="M8 11h8M8 14h5"/></svg>
    case 'users':
      return <svg {...props}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2 1-4 3-5"/></svg>
    case 'chart':
      return <svg {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
    case 'sparkles':
      return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>
    case 'check':
      return <svg {...props}><path d="M5 12.5 10 17 19 7"/></svg>
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>
    case 'arrow':
      return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    case 'whatsapp':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.1 4.9A10 10 0 0 0 4.5 18.5L3 22l3.6-1.4a10 10 0 0 0 14.7-8.7c0-2.7-1-5.2-2.8-7zM12 20.2a8.3 8.3 0 0 1-4.2-1.1l-.3-.2-2.7 1 1-2.6-.2-.3a8.3 8.3 0 1 1 6.4 3.2zm4.6-6.2c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1c-.2.1-.3.2-.5 0a6.7 6.7 0 0 1-3.4-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.4 3 3 0 0 0-1 2.3c0 1.4 1 2.7 1.2 2.9.2.2 2 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/></svg>
    case 'star':
      return <svg {...props}><path d="m12 3 2.6 5.6 6 .9-4.3 4.3 1 6-5.3-2.9L6.7 20l1-6-4.3-4.3 6-.9z"/></svg>
    default:
      return null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/mobile/MobileIcons.jsx
git commit -m "feat(mobile): biblioteca de SVGs MobileIcon do design v2"
```

---

### Task 1.3: Criar primitivos `mobileStyles.js`

**Files:**
- Create: `dashboard/components/mobile/mobileStyles.js`

- [ ] **Step 1: Criar arquivo com primitivos do v2 chrome**

Criar `dashboard/components/mobile/mobileStyles.js`:

```js
export const mobi = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 18,
    padding: 18,
  },
  sectionLabel: {
    fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '24px 20px 10px',
  },
  pagePad: { padding: '14px 16px 0' },
  btn: (kind, full) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 18px',
    borderRadius: 999,
    fontSize: 14, fontWeight: 600,
    width: full ? '100%' : 'auto',
    border: '1px solid ' + (kind === 'ghost' ? 'var(--line-strong)' : 'transparent'),
    background: kind === 'primary' ? 'var(--ink)' : kind === 'accent' ? 'var(--accent-strong)' : 'transparent',
    color: kind === 'primary' || kind === 'accent' ? 'white' : 'var(--ink)',
    fontFamily: 'inherit', cursor: 'pointer',
  }),
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/mobile/mobileStyles.js
git commit -m "feat(mobile): primitivos visuais mobi.btn/card/sectionLabel do v2"
```

---

### Task 1.4: Atualizar `routes.js` com novas rotas

**Files:**
- Modify: `dashboard/components/mobile/routes.js`

- [ ] **Step 1: Substituir conteúdo do `routes.js`**

Substituir TODO o conteúdo de `dashboard/components/mobile/routes.js` por:

```js
export const mobileRoutes = {
  home: '/m',
  converter: '/m/op/converter',
  offer: '/m/op/offer',
  logs: '/m/op/logs',
  espelhar: '/m/op/espelhar',
  configWhatsApp: '/m/config/whatsapp',
  configGroups: '/m/config/groups',
  configCredentials: '/m/config/credentials',
  configPreferences: '/m/config/preferences',
  helpTutorial: '/m/help/tutorial',
  account: '/m/account',
  accountSubscription: '/m/account/subscription',
  accountTemplates: '/m/account/templates',
}
```

Nota: a chave `sends` é removida. A chave `espelhar`, `account` e `accountTemplates` são novas.

- [ ] **Step 2: Verificar referências a `mobileRoutes.sends`**

Run: `grep -rn "mobileRoutes.sends" dashboard/ --include='*.js' --include='*.jsx' | grep -v node_modules | grep -v .next`

Esperado: aparecem 1+ referências em `MobileShell.jsx`. Essas serão removidas na próxima task quando o `MobileShell` for reescrito. **Não corrigir agora** — a Task 1.5 substitui o `MobileShell` inteiro.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/mobile/routes.js
git commit -m "feat(mobile): novas rotas espelhar, account, account/templates; remove sends"
```

---

### Task 1.5: Refatorar `MobileShell.jsx` para chrome v2

**Files:**
- Modify: `dashboard/components/mobile/MobileShell.jsx`

- [ ] **Step 1: Substituir TODO o conteúdo de `MobileShell.jsx`**

```jsx
'use client'

import Link from 'next/link'
import { mobileRoutes } from '@/components/mobile/routes'
import { MobileIcon } from '@/components/mobile/MobileIcons'

const shellStyles = {
  root: {
    position: 'relative',
    margin: '0 auto',
    minHeight: '100vh',
    width: '100%',
    maxWidth: 480,
    background: 'var(--bg)',
    color: 'var(--ink)',
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px 10px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--line)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  topbarBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 32, height: 32, borderRadius: 9,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 14,
  },
  brandTxt: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    background: 'var(--bg-soft)', border: '1px solid var(--line)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink)', cursor: 'pointer',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--danger)',
    border: '2px solid var(--surface)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    background: 'var(--bg)',
    paddingBottom: 92,
  },
  bottomNav: {
    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: 480,
    background: 'color-mix(in oklab, var(--surface) 95%, transparent)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid var(--line)',
    paddingBottom: 24,
    paddingTop: 6,
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
    zIndex: 9,
  },
  navItem: (active) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '8px 4px',
    color: active ? 'var(--accent-strong)' : 'var(--ink-soft)',
    fontSize: 10.5, fontWeight: 500,
    textDecoration: 'none',
  }),
  navIconWrap: (active) => ({
    width: 44, height: 28, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'color-mix(in oklab, var(--accent) 28%, var(--surface))' : 'transparent',
    transition: 'background .15s',
  }),
  navCenterBtn: {
    width: 44, height: 44, borderRadius: 14,
    background: 'var(--ink)', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: -10, boxShadow: '0 6px 14px -4px rgba(0,0,0,0.25)',
  },
}

function NavIcon({ name }) {
  if (name === 'inicio') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  }
  if (name === 'espelhar') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
        <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
      </svg>
    )
  }
  if (name === 'criar') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    )
  }
  if (name === 'envios') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
      </svg>
    )
  }
  if (name === 'conta') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>
    )
  }
  return null
}

const tabs = [
  { key: 'inicio',   label: 'Início',   href: mobileRoutes.home },
  { key: 'espelhar', label: 'Espelhar', href: mobileRoutes.espelhar },
  { key: 'criar',    label: 'Criar',    href: mobileRoutes.offer, accent: true },
  { key: 'envios',   label: 'Envios',   href: mobileRoutes.logs },
  { key: 'conta',    label: 'Conta',    href: mobileRoutes.account },
]

export function MobileShell({ title = 'Conversor', active = 'inicio', hasAlert = false, children }) {
  return (
    <div style={shellStyles.root}>
      <header style={shellStyles.topbar}>
        <div style={shellStyles.topbarBrand}>
          <div style={shellStyles.brandMark}>b</div>
          <div style={shellStyles.brandTxt}>{title}</div>
        </div>
        <button type="button" style={shellStyles.iconBtn} aria-label="Notificações">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          {hasAlert ? <span style={shellStyles.notifDot} aria-hidden="true"/> : null}
        </button>
      </header>

      <main style={shellStyles.content} role="main">{children}</main>

      <nav style={shellStyles.bottomNav} aria-label="Navegação principal mobile">
        {tabs.map((tab) => {
          const isActive = active === tab.key
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              style={shellStyles.navItem(isActive)}
            >
              {tab.accent ? (
                <div style={shellStyles.navCenterBtn}><NavIcon name={tab.key}/></div>
              ) : (
                <div style={shellStyles.navIconWrap(isActive)}><NavIcon name={tab.key}/></div>
              )}
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function MobileStateCard({ title, description, actionLabel, onAction, tone = 'neutral' }) {
  const bg = tone === 'error' ? 'color-mix(in oklab, var(--danger) 10%, var(--surface))'
            : tone === 'success' ? 'color-mix(in oklab, var(--success) 10%, var(--surface))'
            : 'var(--surface)'
  const border = tone === 'error' ? 'color-mix(in oklab, var(--danger) 30%, var(--line))'
              : tone === 'success' ? 'color-mix(in oklab, var(--success) 30%, var(--line))'
              : 'var(--line)'
  return (
    <section
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: 16,
        margin: '16px',
      }}
      aria-live="polite"
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{description}</p>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 12,
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
```

Nota: `MobileStateCard` é preservado (com novo visual v2) porque `layout.js` e `MobileAsyncState.jsx` o importam.

- [ ] **Step 2: Build verifica que nada quebrou**

Run: `cd dashboard && npm run build`
Esperado: build passa sem erro. Páginas existentes ficam funcionais (rotas antigas como `/m/op/sends` ainda existem nesta fase, só perdem a referência no nav).

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/mobile/MobileShell.jsx
git commit -m "feat(mobile): chrome v2 com topbar brand + bottom nav 5 tabs"
```

---

### Task 1.6: Push da Fase 1

- [ ] **Step 1: Push**

```bash
git push -u origin claude/epic-bardeen-ipF65
```

---

## Phase 2 — Home (Checkpoint)

### Task 2.1: Refatorar `/m/page.js` (MobileHome v2)

**Files:**
- Modify: `dashboard/app/m/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-home.jsx`

- [ ] **Step 1: Ler o componente v2 de referência**

Run: `cat docs/superpowers/specs/v2-source/mobile-home.jsx`

Estudar o componente `MobileHome` (linha ~209 até final). Notar `homeStyles` (linhas 9-194) e o sub-componente `HomeSparkline` (linhas 197-207).

- [ ] **Step 2: Substituir TODO o conteúdo de `dashboard/app/m/page.js`**

Aplicar a Conversion Recipe:
- Wrapper: `<MobileFrame title="Conversor" active="inicio">` → `<MobileShell title="Conversor" active="inicio" hasAlert={true}>`
- Icons: `<Icon name="..." />` → `<MobileIcon name="..." />`
- Adicionar `'use client'`, imports, `useMobileRoutePerf('m/home')`
- Copiar fielmente `homeStyles` como const local
- Copiar `HomeSparkline` como function local
- Manter `useMobileHomeData()` e usar os mocks da Home v2 (linha ~211-218 do v2 - checklist). Para `summary`/`recent`: ainda podemos usar os mocks v2 hard-coded (linhas 232-374) já que o JSX referencia valores fixos como "147 promoções". Substituir mocks do v2 por `summary` e `recent` do hook é fora de escopo.

Estrutura do arquivo final:

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const homeStyles = {
  // ... copiar EXATAMENTE de docs/superpowers/specs/v2-source/mobile-home.jsx linhas 9-194
}

function HomeSparkline() {
  // ... copiar EXATAMENTE de docs/superpowers/specs/v2-source/mobile-home.jsx linhas 197-207
}

export default function MobileHomePage() {
  useMobileRoutePerf('m/home')
  const checklistDone = 5
  const hasAlert = true
  const isOnboarding = checklistDone < 5

  const checklist = [
    { label: 'Suas afiliadas (Shopee, ML…)', done: true },
    { label: 'Conectar WhatsApp',             done: true },
    { label: '1 grupo de origem',             done: true },
    { label: '1 grupo de destino',            done: true },
    { label: 'Ligar o espelhamento',          done: false, current: true },
  ]

  return (
    <MobileShell title="Conversor" active="inicio" hasAlert={hasAlert}>
      {/* JSX copiado das linhas 222-376 do v2, com <Icon> → <MobileIcon> */}
    </MobileShell>
  )
}
```

**IMPORTANTE:** Copiar o JSX inteiro do v2 (linhas 222-376 do source), trocando apenas:
- `<Icon name="..." size={...} stroke={...}/>` → `<MobileIcon name="..." size={...} stroke={...}/>`
- Remover o último wrapper `</MobileFrame>` e substituir o de abertura por `<MobileShell ...>`
- Remover `window.MobileHome = MobileHome;` no final

- [ ] **Step 3: Build verifica**

Run: `cd dashboard && npm run build`
Esperado: build passa.

- [ ] **Step 4: Commit + push**

```bash
git add dashboard/app/m/page.js
git commit -m "feat(mobile): home v2 com hero, alerta inline e checklist"
git push origin claude/epic-bardeen-ipF65
```

- [ ] **Step 5: CHECKPOINT MANUAL**

🛑 **PARAR.** Aguardar usuário validar a Home no navegador antes de prosseguir.

Comando para o usuário: `cd dashboard && npm run dev`, abrir `http://localhost:3000/m`.

Critério de aceite:
- Topbar mostra "b" (gradient accent) + "Conversor" + sino com dot vermelho
- Hero escuro com "Detectados / Postados" + sparkline
- Alerta inline vermelho no topo (3 envios falharam)
- Botão "Criar oferta agora" dominante
- 2 atalhos: "Espelhamento" / "Ver envios"
- Lista "Últimos envios" com 4 mocks
- Bottom nav 5 tabs (Início ativo)

Se algo está fora, ajustar antes de seguir.

---

## Phase 3 — Operações

### Task 3.1: Deletar `/m/op/sends/`

**Files:**
- Delete: `dashboard/app/m/op/sends/page.js`
- Delete: directory `dashboard/app/m/op/sends/`

- [ ] **Step 1: Deletar arquivo e diretório**

```bash
rm -rf dashboard/app/m/op/sends
```

- [ ] **Step 2: Verificar que nada referencia mais essa rota**

Run: `grep -rn "/m/op/sends\|mobileRoutes.sends" dashboard/ --include='*.js' --include='*.jsx' | grep -v node_modules | grep -v .next`
Esperado: vazio.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(mobile): remove rota /m/op/sends (consolidada em /m/op/logs)"
```

---

### Task 3.2: Refatorar `/m/op/offer/page.js` (MobileCriar v2)

**Files:**
- Modify: `dashboard/app/m/op/offer/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-criar.jsx`

- [ ] **Step 1: Ler o componente v2**

Run: `cat docs/superpowers/specs/v2-source/mobile-criar.jsx`

Esse é o arquivo mais longo (~37KB). Componente `MobileCriar` aceita props (`state='converted'`, `expand=false`, etc.). Para a refatoração, usar os defaults v2 e converter as props para constantes no topo do componente.

- [ ] **Step 2: Substituir TODO o conteúdo de `dashboard/app/m/op/offer/page.js`**

Aplicar Conversion Recipe. Estrutura:

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const criarStyles = {
  // copiar EXATAMENTE de mobile-criar.jsx (objeto criarStyles)
}

// Copiar quaisquer sub-componentes auxiliares do v2

export default function OfferPage() {
  useMobileRoutePerf('m/op/offer')
  const state = 'converted'
  const expand = false
  const bonuses = 'both'
  const bonusLayout = 'unified'

  return (
    <MobileShell title="Conversor" active="criar">
      {/* JSX copiado do v2 (MobileCriar return), <Icon> → <MobileIcon> */}
    </MobileShell>
  )
}
```

Regra: copiar fielmente o objeto `criarStyles` e o JSX completo do return do `MobileCriar`. Substituir `Icon` → `MobileIcon`. Substituir `MobileFrame` → `MobileShell`. Remover `window.MobileCriar = ...` final.

Se o v2 usa `mobi.btn(...)` ou `mobi.card`, já temos importado.

- [ ] **Step 3: Build verifica**

```bash
cd dashboard && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/m/op/offer/page.js
git commit -m "feat(mobile): offer v2 com criar oferta (input protagonista + bônus)"
```

---

### Task 3.3: Refatorar `/m/op/logs/page.js` (MobileEnvios v2)

**Files:**
- Modify: `dashboard/app/m/op/logs/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-envios.jsx`

- [ ] **Step 1: Ler o componente v2**

Run: `cat docs/superpowers/specs/v2-source/mobile-envios.jsx`

- [ ] **Step 2: Substituir TODO o conteúdo de `dashboard/app/m/op/logs/page.js`**

Aplicar Conversion Recipe. Tab `active="envios"`. Remover toda a infraestrutura velha (`VirtualList`, `useMockAsyncData`, `MobileErrorCard`, `MobileLoadingCard`, `LogRow`, `logItems` import, filtros antigos).

Estrutura:

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const envStyles = {
  // copiar de mobile-envios.jsx
}

export default function LogsPage() {
  useMobileRoutePerf('m/op/logs')
  return (
    <MobileShell title="Conversor" active="envios">
      {/* JSX do MobileEnvios v2 */}
    </MobileShell>
  )
}
```

- [ ] **Step 3: Build**

```bash
cd dashboard && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/m/op/logs/page.js
git commit -m "feat(mobile): logs v2 (envios) com lista protagonista"
```

---

### Task 3.4: Criar `/m/op/espelhar/page.js` (MobileEspelhar v2)

**Files:**
- Create: `dashboard/app/m/op/espelhar/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-espelhar.jsx`

- [ ] **Step 1: Criar diretório e ler v2**

```bash
mkdir -p dashboard/app/m/op/espelhar
cat docs/superpowers/specs/v2-source/mobile-espelhar.jsx
```

- [ ] **Step 2: Criar `dashboard/app/m/op/espelhar/page.js`**

Estrutura:

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const espStyles = {
  // copiar de mobile-espelhar.jsx
}

export default function EspelharPage() {
  useMobileRoutePerf('m/op/espelhar')
  const on = true
  return (
    <MobileShell title="Conversor" active="espelhar">
      {/* JSX do MobileEspelhar v2 */}
    </MobileShell>
  )
}
```

- [ ] **Step 3: Build**

```bash
cd dashboard && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/m/op/espelhar/page.js
git commit -m "feat(mobile): nova rota /m/op/espelhar com controle on/off v2"
```

---

### Task 3.5: Push da Fase 3

- [ ] **Step 1: Push**

```bash
git push origin claude/epic-bardeen-ipF65
```

---

## Phase 4 — Config

`mobile-config.jsx` contém os 4 componentes (`MobileWhatsApp`, `MobileGroups`, `MobileCreds`, `MobilePrefs`) + `MobileAssinatura` + `MobileTutorial` (esses 2 viram tasks da Phase 5 e Phase 6). Para Phase 4, abrir o arquivo source uma vez e extrair os 4 componentes.

### Task 4.1: Refatorar `/m/config/whatsapp/page.js`

**Files:**
- Modify: `dashboard/app/m/config/whatsapp/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-config.jsx` (componente `MobileWhatsApp`)

- [ ] **Step 1: Ler `mobile-config.jsx` e localizar `MobileWhatsApp`**

Run: `cat docs/superpowers/specs/v2-source/mobile-config.jsx`

- [ ] **Step 2: Substituir TODO o conteúdo de `dashboard/app/m/config/whatsapp/page.js`**

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const cfgStyles = {
  // copiar o objeto cfgStyles inteiro de mobile-config.jsx (linhas ~3-51)
}

export default function WhatsAppPage() {
  useMobileRoutePerf('m/config/whatsapp')
  return (
    <MobileShell title="Conversor" active="conta">
      {/* JSX do MobileWhatsApp v2 */}
    </MobileShell>
  )
}
```

Notas:
- `cfgStyles` é compartilhado com Groups/Creds/Prefs. Para evitar duplicação nas próximas tasks, **extrair `cfgStyles` para `dashboard/components/mobile/mobileStyles.js`** dentro desta task (adicionar `export const cfgStyles = {...}`) e importar nas pages. Mas para esta task: mantenha local; refatoramos para shared se as 4 pages tiverem mesma estrutura. Decisão: copiar local nas 4 pages inicialmente, depois Task 4.5 extrai pra shared.

- [ ] **Step 3: Build + commit**

```bash
cd dashboard && npm run build
git add dashboard/app/m/config/whatsapp/page.js
git commit -m "feat(mobile): config WhatsApp v2"
```

---

### Task 4.2: Refatorar `/m/config/groups/page.js`

**Files:**
- Modify: `dashboard/app/m/config/groups/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-config.jsx` (componente `MobileGroups`)

- [ ] **Step 1: Substituir TODO o conteúdo**

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const cfgStyles = {
  // mesmo cfgStyles da Task 4.1
}

export default function GroupsPage() {
  useMobileRoutePerf('m/config/groups')
  return (
    <MobileShell title="Conversor" active="conta">
      {/* JSX do MobileGroups v2 */}
    </MobileShell>
  )
}
```

- [ ] **Step 2: Build + commit**

```bash
cd dashboard && npm run build
git add dashboard/app/m/config/groups/page.js
git commit -m "feat(mobile): config Groups v2"
```

---

### Task 4.3: Refatorar `/m/config/credentials/page.js`

**Files:**
- Modify: `dashboard/app/m/config/credentials/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-config.jsx` (componente `MobileCreds`)

- [ ] **Step 1: Substituir TODO o conteúdo**

Mesma estrutura, com `useMobileRoutePerf('m/config/credentials')`, e JSX do `MobileCreds`.

- [ ] **Step 2: Build + commit**

```bash
cd dashboard && npm run build
git add dashboard/app/m/config/credentials/page.js
git commit -m "feat(mobile): config Credentials v2"
```

---

### Task 4.4: Refatorar `/m/config/preferences/page.js`

**Files:**
- Modify: `dashboard/app/m/config/preferences/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-config.jsx` (componente `MobilePrefs`)

- [ ] **Step 1: Substituir TODO o conteúdo**

Mesma estrutura, com `useMobileRoutePerf('m/config/preferences')`, JSX do `MobilePrefs`.

- [ ] **Step 2: Build + commit**

```bash
cd dashboard && npm run build
git add dashboard/app/m/config/preferences/page.js
git commit -m "feat(mobile): config Preferences v2"
```

---

### Task 4.5: Extrair `cfgStyles` para `mobileStyles.js` (DRY)

**Files:**
- Modify: `dashboard/components/mobile/mobileStyles.js`
- Modify: 4 páginas em `dashboard/app/m/config/*/page.js`

- [ ] **Step 1: Adicionar `cfgStyles` ao `mobileStyles.js`**

Adicionar ao final de `dashboard/components/mobile/mobileStyles.js`:

```js
export const cfgStyles = {
  pageH: { padding: '18px 20px 0' },
  pageEyebrow: { fontSize: 12, color: 'var(--ink-soft)' },
  pageTitle: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink)', marginTop: 2 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18 },
  cardP: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 18 },
  cardWrap: { padding: '14px 16px 0' },
  field: {
    width: '100%', padding: '12px 14px', fontSize: 14,
    background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 12,
    fontFamily: 'inherit', color: 'var(--ink)',
  },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 },
  row: (last) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
  }),
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' },
  rowSub: { fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 },
  toggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? 'var(--accent-strong)' : 'var(--bg-soft)',
    position: 'relative', flexShrink: 0, cursor: 'pointer',
  }),
  toggleKnob: (on) => ({
    width: 16, height: 16, borderRadius: '50%', background: 'white',
    position: 'absolute', top: 2, left: on ? 18 : 2,
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  }),
  pill: (tone) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 10.5, fontWeight: 600,
    padding: '3px 8px', borderRadius: 999,
    background: tone === 'success' ? 'color-mix(in oklab, var(--success) 18%, var(--surface))'
              : tone === 'danger' ? 'color-mix(in oklab, var(--danger) 18%, var(--surface))'
              : 'var(--bg-soft)',
    color: tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink)',
    border: '1px solid var(--line)',
  }),
  sectionLabel: { padding: '20px 20px 8px', fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  storeBadge: (color) => ({
    width: 32, height: 32, borderRadius: 8,
    background: color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 10.5, flexShrink: 0,
  }),
}
```

- [ ] **Step 2: Editar cada uma das 4 pages de config**

Em cada arquivo (`whatsapp/page.js`, `groups/page.js`, `credentials/page.js`, `preferences/page.js`):
- Remover o `const cfgStyles = { ... }` local
- Importar de shared: `import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'`

- [ ] **Step 3: Build + commit + push**

```bash
cd dashboard && npm run build
git add dashboard/components/mobile/mobileStyles.js dashboard/app/m/config
git commit -m "refactor(mobile): extrai cfgStyles para mobileStyles.js (DRY)"
git push origin claude/epic-bardeen-ipF65
```

---

## Phase 5 — Conta

### Task 5.1: Criar `/m/account/page.js` (MobileConta v2)

**Files:**
- Create: `dashboard/app/m/account/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-conta.jsx`

- [ ] **Step 1: Criar diretório e ler v2**

```bash
mkdir -p dashboard/app/m/account
cat docs/superpowers/specs/v2-source/mobile-conta.jsx
```

- [ ] **Step 2: Criar `dashboard/app/m/account/page.js`**

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const contaStyles = {
  // copiar do v2
}

export default function AccountPage() {
  useMobileRoutePerf('m/account')
  return (
    <MobileShell title="Conversor" active="conta">
      {/* JSX do MobileConta v2 */}
    </MobileShell>
  )
}
```

- [ ] **Step 3: Build + commit**

```bash
cd dashboard && npm run build
git add dashboard/app/m/account/page.js
git commit -m "feat(mobile): nova rota /m/account com tela Conta v2"
```

---

### Task 5.2: Criar `/m/account/templates/page.js` (MobileModelos v2)

**Files:**
- Create: `dashboard/app/m/account/templates/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-modelos.jsx`

- [ ] **Step 1: Criar diretório e ler v2**

```bash
mkdir -p dashboard/app/m/account/templates
cat docs/superpowers/specs/v2-source/mobile-modelos.jsx
```

- [ ] **Step 2: Criar `dashboard/app/m/account/templates/page.js`**

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const modStyles = {
  // copiar do v2
}

export default function TemplatesPage() {
  useMobileRoutePerf('m/account/templates')
  const view = 'list'
  return (
    <MobileShell title="Conversor" active="conta">
      {/* JSX do MobileModelos v2 (modo view=list por padrão) */}
    </MobileShell>
  )
}
```

- [ ] **Step 3: Build + commit**

```bash
cd dashboard && npm run build
git add dashboard/app/m/account/templates/page.js
git commit -m "feat(mobile): nova rota /m/account/templates com modelos de mensagem v2"
```

---

### Task 5.3: Refatorar `/m/account/subscription/page.js` (MobileAssinatura v2)

**Files:**
- Modify: `dashboard/app/m/account/subscription/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-config.jsx` (componente `MobileAssinatura`)

- [ ] **Step 1: Localizar `MobileAssinatura` no `mobile-config.jsx`**

Run: `grep -n "MobileAssinatura" docs/superpowers/specs/v2-source/mobile-config.jsx`

- [ ] **Step 2: Substituir TODO o conteúdo de `dashboard/app/m/account/subscription/page.js`**

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

export default function SubscriptionPage() {
  useMobileRoutePerf('m/account/subscription')
  return (
    <MobileShell title="Conversor" active="conta">
      {/* JSX do MobileAssinatura v2 */}
    </MobileShell>
  )
}
```

- [ ] **Step 3: Build + commit + push**

```bash
cd dashboard && npm run build
git add dashboard/app/m/account/subscription/page.js
git commit -m "feat(mobile): subscription v2"
git push origin claude/epic-bardeen-ipF65
```

---

## Phase 6 — Help

### Task 6.1: Refatorar `/m/help/tutorial/page.js` (MobileTutorial v2)

**Files:**
- Modify: `dashboard/app/m/help/tutorial/page.js`
- Reference: `docs/superpowers/specs/v2-source/mobile-config.jsx` (componente `MobileTutorial`)

- [ ] **Step 1: Substituir TODO o conteúdo**

```jsx
'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

export default function TutorialPage() {
  useMobileRoutePerf('m/help/tutorial')
  return (
    <MobileShell title="Conversor" active="conta">
      {/* JSX do MobileTutorial v2 */}
    </MobileShell>
  )
}
```

- [ ] **Step 2: Build + commit + push**

```bash
cd dashboard && npm run build
git add dashboard/app/m/help/tutorial/page.js
git commit -m "feat(mobile): tutorial v2"
git push origin claude/epic-bardeen-ipF65
```

---

## Phase 7 — Validação Final

### Task 7.1: Build limpo + verificação de rotas órfãs

- [ ] **Step 1: Build full sem cache**

```bash
cd dashboard && rm -rf .next && npm run build
```

Esperado: build passa.

- [ ] **Step 2: Verificar nenhuma referência órfã a rotas removidas**

Run:
```bash
grep -rn "/m/op/sends\|mobileRoutes.sends" dashboard/ --include='*.js' --include='*.jsx' | grep -v node_modules | grep -v .next
```

Esperado: vazio (rota foi removida).

- [ ] **Step 3: Listar todas as páginas mobile finais**

Run: `find dashboard/app/m -name "page.js" | sort`

Esperado:
```
dashboard/app/m/account/page.js
dashboard/app/m/account/subscription/page.js
dashboard/app/m/account/templates/page.js
dashboard/app/m/config/credentials/page.js
dashboard/app/m/config/groups/page.js
dashboard/app/m/config/preferences/page.js
dashboard/app/m/config/whatsapp/page.js
dashboard/app/m/help/tutorial/page.js
dashboard/app/m/op/converter/page.js
dashboard/app/m/op/espelhar/page.js
dashboard/app/m/op/logs/page.js
dashboard/app/m/op/offer/page.js
dashboard/app/m/page.js
```

13 páginas no total.

- [ ] **Step 4: Smoke test manual no navegador**

Run: `cd dashboard && npm run dev` (porta 3000)

Visitar cada uma das 13 rotas e confirmar que rendem sem erro de console:
- http://localhost:3000/m
- http://localhost:3000/m/op/converter (sem v2, ainda visual antigo)
- http://localhost:3000/m/op/offer
- http://localhost:3000/m/op/logs
- http://localhost:3000/m/op/espelhar
- http://localhost:3000/m/config/whatsapp
- http://localhost:3000/m/config/groups
- http://localhost:3000/m/config/credentials
- http://localhost:3000/m/config/preferences
- http://localhost:3000/m/help/tutorial
- http://localhost:3000/m/account
- http://localhost:3000/m/account/subscription
- http://localhost:3000/m/account/templates

Para cada rota: verificar que (a) carrega, (b) bottom nav mostra a tab ativa correta, (c) navegação entre tabs funciona, (d) topbar aparece com brand mark.

- [ ] **Step 5: Push final**

```bash
git push origin claude/epic-bardeen-ipF65
```

- [ ] **Step 6: Reportar ao usuário**

Mensagem ao usuário:
> Refactor mobile v2 completo. 13 rotas validadas no navegador. Branch `claude/epic-bardeen-ipF65` pushada. Pronto para PR contra `develop` quando quiser.

---

## Checklist de Cobertura (auto-revisão do plano)

- [x] CSS vars adicionadas (Task 1.1)
- [x] MobileIcons biblioteca criada (Task 1.2)
- [x] mobileStyles primitivos criados (Task 1.3, expandido em Task 4.5)
- [x] routes.js atualizado (Task 1.4)
- [x] MobileShell v2 reescrito (Task 1.5)
- [x] `/m` Home (Task 2.1, checkpoint)
- [x] `/m/op/converter` preservado (mencionado, nenhuma task)
- [x] `/m/op/offer` (Task 3.2)
- [x] `/m/op/logs` (Task 3.3)
- [x] `/m/op/espelhar` criado (Task 3.4)
- [x] `/m/op/sends` deletado (Task 3.1)
- [x] `/m/config/whatsapp` (Task 4.1)
- [x] `/m/config/groups` (Task 4.2)
- [x] `/m/config/credentials` (Task 4.3)
- [x] `/m/config/preferences` (Task 4.4)
- [x] cfgStyles DRY (Task 4.5)
- [x] `/m/account` criado (Task 5.1)
- [x] `/m/account/templates` criado (Task 5.2)
- [x] `/m/account/subscription` (Task 5.3)
- [x] `/m/help/tutorial` (Task 6.1)
- [x] Build limpo final (Task 7.1)
- [x] Smoke test todas as rotas (Task 7.1)

Total: 20 tasks executáveis distribuídas em 7 fases. Cada task termina em commit; cada fase termina em push.
