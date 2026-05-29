# Session Documentation
Date: 2026-05-29

## Summary
Implementadas 4 funcionalidades críticas na versão mobile (`dashboard/app/m/`) que existiam no desktop mas estavam ausentes: delay de envio, palavras bloqueadas, agendamento e preservação/anti-ban.

## Changes

### Features
- `feat(mobile/config)`: add campos delay de envio (`delayMin`/`delayMax`) e palavras bloqueadas em `m/config/preferences/page.js`
- `feat(mobile/config)`: add nova rota `m/config/preservacao/page.js` com gate Pro, monitoramento read-only e configurações de throttle/anti-ban
- `feat(mobile/op)`: add botão "Agendar" em `m/op/offer/page.js` com modal datetime-local → `api.scheduledCreate`
- `feat(mobile/op)`: add nova rota `m/op/scheduled/page.js` com listagem e cancelamento de agendamentos
- `feat(mobile/nav)`: add rotas `preservacao` e `scheduled` em `components/mobile/routes.js`
- `feat(mobile/account)`: add link Anti-banimento → preservacao em `m/account/page.js`

### Chore
- `chore(mobile/contracts)`: add `delayMin`, `delayMax`, `blockedKeywords` em `MOBILE_CONFIG_CONTRACT_KEYS`; helpers `clampDelayInt` e `normalizeKeywords` em `lib/mobileConfigContracts.js`

## Technical Decisions

- Reuso exclusivo do backend existente (`api.*`); frontend mobile-nativo com inline styles (cfgStyles/mobi, MobileShell) sem importar componentes Tailwind do desktop.
- Padrão `useEffect` com `window.setTimeout(()=>load(),0)` + flag `active` para satisfazer a regra eslint `react-hooks/set-state-in-effect` (mesmo padrão de `m/op/logs`).
- Estado do `min` do datetime-local calculado ao abrir o modal (não no render) para satisfazer `react-hooks/purity`.
- Inputs de preservação clampados para mínimo 1 — backend rejeita 0.
- Patch diferencial em `updatePreservationConfig` (sem campo `flags`) para não sobrescrever configurações não expostas na UI mobile.

## Validation
- eslint: 0 erros nos arquivos alterados.
- `npm run smoke:mobile-routes` (17 rotas) e `npm run smoke:mobile-p3`: passam.
- `npm run build` (Next.js webpack): exit 0; rotas `/m/config/preservacao` e `/m/op/scheduled` compiladas como estáticas.
- QA por browser não executada: sem backend/DB no container e rotas atrás da flag `NEXT_PUBLIC_ENABLE_MOBILE_PREVIEW`.

## Known Issues / Future Work
- `smoke:mobile-p1` (whatsapp sessionStart) e `smoke:mobile-p2` (rotas account/help, aviso templates) falham por problemas pré-existentes, não relacionados a estas mudanças.
- QA end-to-end em staging necessária antes de merge em `develop`.
