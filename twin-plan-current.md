# Twin Development Plan
Generated: 2026-05-29 (revisão 3 — reuso de BACKEND, frontend mobile-nativo)
Task: criar nas rotas /m as funcionalidades críticas ausentes. Reaproveitar o BACKEND existente (APIs/endpoints). Construir o FRONTEND novo, inspirado no design das rotas /m já existentes.
Quality Level: pragmatic

## Princípio desta revisão
> Reaproveitar as **funcionalidades de backend** (funções `api.*` e endpoints já existentes). O **frontend** deve ser construído do zero, usando como inspiração o design já existente nas rotas `/m` (inline styles via `cfgStyles`/`mobi`, `MobileShell`, padrões de loading/erro/feedback).
>
> NÃO importar componentes do desktop (`components/preservacao/*`, etc.) — eles usam Tailwind/markup de desktop. Criar componentes/telas mobile-nativos.

Backend reaproveitado (nada novo no servidor):
- Config: `api.getConfig()` / `api.saveConfig(data)` — campos `delayMin`, `delayMax`, `blockedKeywords`.
- Agendamento: `api.scheduledList()` / `api.scheduledCreate(text, scheduledAtISO)` / `api.scheduledCancel(id)`.
- Preservação config: `api.preservationConfig()` → `{config, flags}` / `api.updatePreservationConfig(patch)`.
- Preservação monitoramento: `api.preservationHealth/RiskScore/Follows(limit)/Snapshots/Probe/Clicks()`.
- Gate Pro: `canAccessAdvancedPreservation(me)` em `lib/plan.js` + `api.me()`.

Frontend reaproveitado só como INSPIRAÇÃO/infra mobile já existente:
- `components/mobile/MobileShell.jsx` (`MobileShell`, `MobileStateCard`), `mobileStyles.js` (`mobi`, `cfgStyles`), `MobileAsyncState.jsx` (`MobileLoadingCard`, `MobileErrorCard`), `MobileObservability.jsx` (`useMobileRoutePerf`), `routes.js` (`mobileRoutes`).
- Telas-referência de padrão visual: `m/config/preferences`, `m/config/groups`, `m/config/whatsapp`, `m/op/logs`, `m/account`.

---

## Plano de Implementação

### A) Item 1.3 + 1.4 — Delay e Keywords no mobile

**Modificar** `dashboard/lib/mobileConfigContracts.js` (lib mobile):
- Adicionar `'delayMin'`, `'delayMax'`, `'blockedKeywords'` a `MOBILE_CONFIG_CONTRACT_KEYS`.
- Em `buildMobilePreferencesPayload`: `delayMin`/`delayMax` como inteiros (parse + clamp 0–300, garantir `min<=max`); `blockedKeywords` normalizado (split vírgula / trim / lowercase / dedup → join `,`). Lógica escrita aqui (mobile), não importada do desktop.

**Modificar** `dashboard/app/m/config/preferences/page.js` (frontend mobile-nativo, padrão das outras seções da própria página):
- Seção "Delay de envio": 3 chips de preset definidos localmente (`{fast:2/5, default:5/15, safe:15/30}`) + dois inputs `number` (`delayMin`/`delayMax`) usando `cfgStyles.field`/`cfgStyles.label`. Validação inline `0<=min<=max<=300`.
- Seção "Keywords bloqueadas": textarea (`cfgStyles.field`) ligada a `blockedKeywords` + nota "separe por vírgula". Normaliza no salvar.

### B) Item 1.2 — Agendamento no mobile

**Modificar** `dashboard/app/m/op/offer/page.js`:
- Substituir `<button disabled>Agendar em breve</button>` (linha ~1004, estilo `criarStyles.schedBtn` já existe) por botão que abre um modal/drawer inline mobile-nativo (overlay `position:fixed`, card com `cfgStyles`/`mobi`) com input `datetime-local` (min = now+61s). Confirmar → `api.scheduledCreate(editorText, new Date(value).toISOString())`. Desabilitar sem texto. Capturar erro do servidor (validação > now+60s) e mostrar no `sendFeedback` existente. Link "Ver agendamentos" → `mobileRoutes.scheduled`.

**Criar** `dashboard/app/m/op/scheduled/page.js` (frontend mobile-nativo, inspirado em `m/op/logs`):
- `useMobileRoutePerf('m/op/scheduled')`; carrega `api.scheduledList()`.
- Lista de cards: texto truncado, data/hora `toLocaleString('pt-BR')`, status como pill (`cfgStyles.pill`/padrão de `m/op/logs`), botão "Cancelar" (`api.scheduledCancel(id)` + reload) p/ status `pending`/`queued`.
- `MobileLoadingCard`/`MobileErrorCard`; empty state; `MobileShell title="Agendamentos" active="envios" showBack onBack={router.back}`.

### C) Item 1.1 — Preservação/Anti-ban no mobile (frontend novo, backend reusado)

**Criar** `dashboard/app/m/config/preservacao/page.js` — tela mobile-nativa que consome os endpoints de preservação:
- `useMobileRoutePerf('m/config/preservacao')`.
- Gate: `api.me()` + `canAccessAdvancedPreservation`. Sem acesso → card de upsell mobile-nativo (lista de benefícios em texto + botão p/ `mobileRoutes.accountSubscription`), construído com `cfgStyles`/`mobi` (NÃO importar `UpsellShell` desktop).
- Carrega `api.preservationConfig()` (config+flags) e os monitores.
- **Seção Monitoramento** (cards mobile-nativos read-only, inspirados em `m/op/logs`/`m/page`): saúde dos canais (`preservationHealth`), score de risco (`preservationRiskScore`), follows recentes (`preservationFollows`), snapshots (`preservationSnapshots`), probe (`preservationProbe`), cliques (`preservationClicks`). Pills de status reusando padrão visual mobile.
- **Seção Configurações** (forms mobile-nativos com `cfgStyles`): controles equivalentes aos do desktop, escrevendo os mesmos campos no patch — throttle (`channelMinIntervalSec`, `channelBurstCap`, `channelDailyCap`, `channelStaggerJitterMs` + presets), horário silencioso (`channelQuietHoursJson` start/end/tz), follow guard, pool de variação de texto, mutação de imagem (toggle), probe (toggle + session id), status do click tracker (read-only via `flags`).
  - Durante a implementação, ler cada componente em `components/preservacao/` apenas para extrair os **nomes exatos dos campos** que o backend espera (não importar markup).
- Salvar: diff `draft` vs `config` → `api.updatePreservationConfig(patch)` (só `config`, sem `flags`), espelhando a lógica de patch do desktop.
- `MobileShell title="Anti-banimento" active="conta" showBack onBack={router.back}`.

### D) Navegação (infra mobile existente)

**Modificar** `dashboard/components/mobile/routes.js`: adicionar `preservacao: '/m/config/preservacao'` e `scheduled: '/m/op/scheduled'`.

**Modificar** `dashboard/app/m/account/page.js`: linha "Anti-banimento" passa a apontar para `mobileRoutes.preservacao` (hoje vai p/ espelhar); ajustar subtexto.

---

### Ordem de Implementação
1. `mobileConfigContracts.js` — campos delay/keywords + normalização (mobile).
2. `routes.js` — registrar `preservacao` e `scheduled`.
3. `m/config/preferences/page.js` — seções delay + keywords.
4. `m/op/offer/page.js` — modal de agendamento.
5. `m/op/scheduled/page.js` — lista de agendados.
6. `m/config/preservacao/page.js` — tela de preservação (gate + monitor + config).
7. `m/account/page.js` — link anti-ban → preservacao (por último).

### Riscos Técnicos
- `delayMin/Max` inteiros: parse/clamp no contrato mobile; nunca enviar string vazia.
- `scheduledCreate` valida `> now+60s` no servidor — capturar e exibir erro se o client ficar stale.
- Preservação: ao salvar, enviar só patch de `config` (sem `flags`); usar os nomes de campo exatos do backend (conferir nos componentes desktop, sem importá-los).
- Não importar nenhum componente de `components/preservacao/` ou outros do desktop — todo frontend é mobile-nativo.
- Cobertura dos controles de preservação no mobile deve mapear 1:1 os campos do backend para não corromper config existente (campos não enviados ficam inalterados pelo patch diferencial).

## Próximo Passo
Para implementar: digite ok, continue ou approve. Para cancelar: cancel.
