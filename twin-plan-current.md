# Twin Development Plan
Generated: 2026-05-29 (revisão 2 — máximo reaproveitamento)
Task: criar nas rotas /m as funcionalidades críticas ausentes, REUSANDO tudo que já existe nas rotas não-mobile. Nada recriado — só criar o que não existe.
Quality Level: pragmatic

## Princípio desta revisão
> Reaproveitar TODAS as estruturas existentes das rotas não-mobile. Nada deve ser recriado, tudo reutilizado. Criar apenas o que não existe.

Fatos verificados que viabilizam o reuso total:
- **Tailwind v4 é global** (`app/globals.css` → `@import 'tailwindcss'`, importado no root `app/layout.js`). Logo, componentes desktop que usam `className` Tailwind **renderizam dentro das rotas `/m` sem alteração**. A premissa anterior de "recriar por incompatibilidade" estava errada.
- As páginas desktop de preservação (`monitoramento/page.js` e `configuracoes/page.js`) são **apenas composições finas** de componentes já existentes em `components/preservacao/`. Esses componentes são auto-suficientes (monitores buscam seus próprios dados) ou recebem `{value, onChange, disabled}` (forms).
- `UpsellShell` (`components/preservacao/UpsellShell.js`) e `canAccessAdvancedPreservation` (`lib/plan.js`) já existem → reusar para o gate Pro.
- `DELAY_PRESETS` e `normalizeKeywords` existem, porém **inline** em `app/dashboard/configuracoes/page.js`. Para reusar sem duplicar, **extrair para um módulo compartilhado** e importar nos dois lados.
- `api.scheduledList/Create/Cancel` já existem → reusar; só a UI mobile de agendamento não existe.

---

## Plano de Implementação

### A) Extrair lógica compartilhada já existente (refactor sem mudança de comportamento)

**Criar** `dashboard/lib/configShared.js` movendo (sem alterar) de `app/dashboard/configuracoes/page.js`:
- `DELAY_PRESETS` (fast 2/5, default 5/15, safe 15/30 + descrições — copiar exatamente)
- `normalizeKeywords(text)` (split vírgula / trim / lowercase / dedup)
- `parseDelay(value, label)` (validação 0–300, inteiro)

**Modificar** `app/dashboard/configuracoes/page.js` → passar a importar de `lib/configShared.js` (remove as definições locais; comportamento idêntico). Isso garante que desktop e mobile usem **a mesma** estrutura.

### B) Item 1.3 + 1.4 — Delay e Keywords no mobile (reuso de API e da lógica extraída)

**Modificar** `dashboard/lib/mobileConfigContracts.js`:
- Adicionar `'delayMin'`, `'delayMax'`, `'blockedKeywords'` a `MOBILE_CONFIG_CONTRACT_KEYS`.
- Em `buildMobilePreferencesPayload`: `delayMin`/`delayMax` via `parseDelay` (de `lib/configShared.js`); `blockedKeywords` via `normalizeKeywords(...).join(',')`.

**Modificar** `dashboard/app/m/config/preferences/page.js` (reusa `cfgStyles`, `api.getConfig/saveConfig`, `DELAY_PRESETS`, `normalizeKeywords` já existentes):
- Seção "Delay de envio": botões dos `DELAY_PRESETS` + dois inputs `number` (`delayMin`/`delayMax`) com a mesma validação `parseDelay`/`min<=max`.
- Seção "Keywords bloqueadas": textarea ligada a `blockedKeywords`, normalizada com `normalizeKeywords` ao salvar.

### C) Item 1.1 — Preservação/Anti-ban no mobile (reuso TOTAL dos componentes existentes)

**Criar** `dashboard/app/m/config/preservacao/page.js` — única peça nova; apenas **compõe** o que já existe:
- Gate: `api.me()` + `canAccessAdvancedPreservation` (de `lib/plan.js`). Sem acesso → renderiza `<UpsellShell />` (existente) dentro do `MobileShell`.
- Seção "Monitoramento": reusa **os mesmos 6 componentes** — `HealthOverview`, `RiskScoreSummary`, `RecentFollowsList`, `SnapshotsList`, `ProbeStatus`, `ClicksSummary` (empilhados em coluna).
- Seção "Configurações": reusa **os mesmos 7 forms** — `ThrottleForm`, `QuietHoursForm`, `FollowGuardForm`, `CopyVariationPoolEditor`, `ImageMutationToggle`, `ProbeToggle`, `ClickTrackerStatus` — com a **mesma** lógica load/diff/save de `api.preservationConfig`/`api.updatePreservationConfig` (espelhando o `configuracoes/page.js`, enviando só o patch).
- Wrapper: `MobileShell title="Anti-banimento" active="conta" showBack onBack={router.back}`.

> Nenhum form/card de preservação é recriado — todos importados de `components/preservacao/`.

### D) Item 1.2 — Agendamento no mobile (reuso de `api.scheduled*`)

**Modificar** `dashboard/app/m/op/offer/page.js`:
- Trocar o `<button disabled>Agendar em breve</button>` (linha ~1004, `criarStyles.schedBtn` já existe) por botão que abre modal inline com `datetime-local` (min = now+61s) → `api.scheduledCreate(editorText, ISO)`. Desabilitar sem texto. Feedback reusa o `sendFeedback` existente + link "Ver agendamentos".

**Criar** `dashboard/app/m/op/scheduled/page.js` — UI nova (não existe em lugar nenhum como componente), reusando `api.scheduledList/Cancel`, `MobileShell`, `cfgStyles`, `MobileLoadingCard/ErrorCard`. Lista itens, status como pill, "Cancelar" para pending/queued.

### E) Navegação (reuso da infra de rotas existente)

**Modificar** `dashboard/components/mobile/routes.js`: adicionar `preservacao: '/m/config/preservacao'` e `scheduled: '/m/op/scheduled'`.

**Modificar** `dashboard/app/m/account/page.js`: a linha "Anti-banimento" passa a apontar para `mobileRoutes.preservacao` (hoje vai para espelhar).

---

### Ordem de Implementação
1. `lib/configShared.js` (extrair) + ajustar `configuracoes/page.js` para importar — base reutilizável.
2. `mobileConfigContracts.js` — novos campos.
3. `routes.js` — registrar `preservacao` e `scheduled`.
4. `m/config/preferences/page.js` — delay + keywords.
5. `m/op/offer/page.js` — modal de agendamento.
6. `m/op/scheduled/page.js` — lista de agendados.
7. `m/config/preservacao/page.js` — compõe componentes existentes + gate.
8. `m/account/page.js` — link anti-ban → preservacao (por último).

### Riscos Técnicos
- Extração para `lib/configShared.js` não pode mudar comportamento do desktop — manter assinaturas idênticas e validar `configuracoes` ainda salva.
- `delayMin/Max` inteiros: usar `parseDelay`, não string vazia.
- `scheduledCreate` valida `> now+60s` no servidor — capturar erro e exibir.
- Componentes desktop de preservação usam Tailwind (global, ok), mas largura desktop (`max-w-*`, grid 2 col) pode ficar larga no mobile — empilhar em coluna única no wrapper mobile; não alterar os componentes.
- Salvar preservação: enviar só patch de `config` (sem `flags`).

## Próximo Passo
Para implementar: digite ok, continue ou approve. Para cancelar: cancel.
