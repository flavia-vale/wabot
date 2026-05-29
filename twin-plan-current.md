# Twin Development Plan
Generated: 2026-05-29
Task: criar todas as funcionalidades listadas como ausentes e críticas nas rotas /m
Quality Level: pragmatic

## Análise Técnica

Quatro funcionalidades existentes no desktop (`dashboard/app/dashboard/`) estão ausentes ou desabilitadas na versão mobile (`dashboard/app/m/`):

- **1.3 — Delay de envio (editável):** desktop edita `delayMin`/`delayMax` (inteiros, segundos, 0–300, min<=max) via `api.saveConfig`. Mobile só edita `welcomeMsg`/`brandingCtaText`/`brandingGroupLink` (limitado por `MOBILE_CONFIG_CONTRACT_KEYS` em `dashboard/lib/mobileConfigContracts.js`).
- **1.4 — Keywords bloqueadas globais:** campo `blockedKeywords` (CSV, lowercase, dedup) — ausente no contrato e na UI mobile.
- **1.2 — Agendamento:** botão "Agendar em breve" desabilitado em `m/op/offer/page.js` (~linha 1004). API existe: `api.scheduledCreate(text, scheduledAtISO)` (sem jids, agenda p/ grupos role=post; valida > now+60s), `api.scheduledList()`, `api.scheduledCancel(id)`.
- **1.1 — Preservação/Anti-ban (Pro):** módulo desktop inteiro (config + monitoramento) sem equivalente mobile. API: `api.preservationConfig()` → `{config, flags}`, `api.updatePreservationConfig(patch)`, `api.preservationHealth/RiskScore/...`. Gate Pro: `canAccessAdvancedPreservation(me)` em `dashboard/lib/plan.js`.

**Infra mobile reutilizável:** `MobileShell`/`MobileStateCard` (`components/mobile/MobileShell.jsx`), `mobi`+`cfgStyles` (`mobileStyles.js`), `MobileLoadingCard`/`MobileErrorCard` (`MobileAsyncState.jsx`), `useMobileRoutePerf` (`MobileObservability.jsx`), rotas em `components/mobile/routes.js`. Bottom nav tem 5 tabs fixas; sub-páginas usam `active="conta"`/`"envios"` + `showBack/onBack`.

**Restrição importante:** os componentes desktop de `components/preservacao/` usam classes Tailwind, incompatíveis com o visual mobile (inline styles). Não reusar diretamente — recriar versões mobile simples com `cfgStyles`.

## Plano de Implementação

### Arquivos a Criar:
- `dashboard/app/m/config/preservacao/page.js` — tela de preservação/anti-ban mobile (gate Pro + config + saúde)
- `dashboard/app/m/op/scheduled/page.js` — lista de agendamentos com cancelamento

### Arquivos a Modificar:
- `dashboard/lib/mobileConfigContracts.js` — adicionar `'delayMin'`, `'delayMax'`, `'blockedKeywords'` a `MOBILE_CONFIG_CONTRACT_KEYS`; tratar `delayMin/Max` como inteiros (`parseInt`, fallback 0) e `blockedKeywords` como string em `buildMobilePreferencesPayload`.
- `dashboard/app/m/config/preferences/page.js` — seção "Delay de envio" (3 presets fast 2/5, default 5/15, safe 15/30 + inputs number com validação 0<=min<=max<=300); seção "Keywords bloqueadas" (textarea + normalização split/trim/lowercase/dedup/join).
- `dashboard/app/m/op/offer/page.js` — substituir botão desabilitado por botão que abre modal inline de agendamento (`datetime-local`, min=now+61s) → `api.scheduledCreate`; desabilitar se sem texto; link "Ver agendamentos" no feedback.
- `dashboard/components/mobile/routes.js` — adicionar `preservacao: '/m/config/preservacao'` e `scheduled: '/m/op/scheduled'`.
- `dashboard/app/m/account/page.js` — apontar a linha "Anti-banimento" para `mobileRoutes.preservacao` (hoje vai para espelhar); atualizar subtexto.

### Ordem de Implementação:
1. `mobileConfigContracts.js` — base para preferences salvar os novos campos.
2. `routes.js` — registrar rotas antes de qualquer `router.push`.
3. `preferences/page.js` — seções delay + keywords (autocontido).
4. `offer/page.js` — habilitar agendamento com modal inline.
5. `op/scheduled/page.js` — página de listagem/cancelamento.
6. `config/preservacao/page.js` — tela de preservação com gate Pro.
7. `account/page.js` — atualizar link (último, p/ não criar link quebrado).

### Riscos Técnicos:
- `delayMin/Max` inteiros: `buildMobilePreferencesPayload` deve `parseInt` (não string vazia) ou o backend rejeita.
- `scheduledCreate` valida `> now+60s` no servidor; capturar erro e exibir feedback se o client ficar stale.
- Não importar componentes de `components/preservacao/` (Tailwind) na tela mobile.
- Ao salvar preservação, enviar só patch de `config` (sem `flags`).

## Próximo Passo
Para implementar este plano, digite: ok, continue, ou approve
Para cancelar, digite: cancel ou inicie uma nova tarefa
