# 2026-06-01 — Paridade mobile P2

Continuação da paridade mobile (`/m`). Após P0 (PR #759) e P1 (PR #760, já
mergeadas em `develop`), esta sessão entregou os itens **P2**.

## Itens entregues

### P2-8 — Mensagem de boas-vindas por grupo de destino
`app/m/config/groups/page.js`: grupos `role=post` ganharam botão **Config** (reusa
`expandedConfigId`) com `<textarea>` `welcomeMsg` salvo no `onBlur`
(`updateGroup`, trima→`null`, só quando muda).

### P2-9 — "Incluir mensagens sem link" por grupo (Pro)
`app/m/config/groups/page.js`: no painel do monitor, toggle `forwardMode`
(`LINK_ONLY`↔`ALLOW_NO_LINK`) + `<select>` `noLinkScope`. Gate Pro via
`api.me()` + `canAccessAdvancedPreservation` (`@/lib/plan`). **Ao desligar envia
`noLinkScope:null`** (backend rejeita `LINK_ONLY`+scope com 400).

### P2-10 — Copy Variation Pool na preservação
`app/m/config/preservacao/page.js`: card "Variações de texto" (greetings/ctas/
trailers, 1 item por linha) integrado ao `draft`/`buildDifferentialPatch`/
`saveConfig` via `copyVariationPoolJson`.

### P2-11 — Taxonomia de erros + contadores server-side nos logs
`app/m/op/logs/page.js`: bloco de métricas "Últimos 7 dias" (`api.logsSummary('7d')`,
`useEffect` não-bloqueante). `lib/mobileLogs.js`: tradução de
`warning:ml_ssid_expired`. Chips de filtro client-side preservados.

## Helpers puros novos (com testes)
- `dashboard/lib/mobileCopyVariationPool.js` — `parsePool`/`writePool`/`countPool`
  (parse defensivo; `writePool` vazio → `''`).
- `dashboard/lib/mobileLogsSummary.js` — `normalizeSummaryCounts` (defaults,
  tolera null), `summaryDeliveryRateLabel` (só `[0,1]` → `%`).

Testes: `test/mobile-copy-variation-pool.test.js`, `test/mobile-logs-summary.test.js`,
e caso novo em `test/mobile-logs.test.js`. **Suíte mobile: 105/105.**

## Decisões / tradeoffs
- Backend rejeita `LINK_ONLY`+`noLinkScope!=null` → sempre enviar `noLinkScope:null`
  ao desligar.
- `parsePool` nunca lança; `writePool` emite `''` quando o pool está vazio (não
  persiste objeto redundante).
- `api.me()` em grupos com `.catch(()=>null)` → `canUseChannels=false` (controles
  Pro desabilitados, sem bloquear a página).
- Métricas dos logs com período fixo (7 dias, rótulo explícito); os chips seguem
  contando só os logs carregados.

## Validação
- 105/105 testes unitários (`node --test test/mobile-*.test.js`).
- QA por navegador (Playwright) **não executável** no container (sem
  `node_modules`/browser); validação por testes + revisão estática manual
  (twin-reviewer caiu por limite de sessão; revisão dos pontos críticos feita à mão).
- Recomendado validar em staging (3006) antes de promover `develop → main`.
