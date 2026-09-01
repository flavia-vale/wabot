# Implementation Plan: Capacidade e previsibilidade da infraestrutura no ADMIN

**Branch**: `014-admin-capacity-observability` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-admin-capacity-observability/spec.md`

## Summary

Adicionar uma rota ADMIN dedicada e carregada sob demanda que converte métricas locais do host, PM2, processos reais, sessões e inventário Hetzner read-only em uma decisão explicável de capacidade. A API existente fará uma coleta isolada a cada cinco minutos (`setInterval().unref()`), persistirá snapshots leves no SQLite via Prisma, calculará limite/alertas/forecast em módulos puros e servirá contratos parciais resilientes. O dashboard exibirá fotografia, histórico, simulador e recomendação sem oferecer mutações de infraestrutura; o controle de staging continuará reutilizando o fluxo existente.

## Technical Context

**Language/Version**: JavaScript ESM em Node.js 20+; React 19.2.4 e Next.js 16.2.4  
**Primary Dependencies**: Fastify 5, Prisma 5.22/SQLite, React/Next/Tailwind; APIs nativas `node:os`, `node:fs`, `node:child_process`, `node:perf_hooks` e `fetch`  
**Storage**: SQLite existente, com Prisma; snapshots detalhados, rollups horários/diários, eventos e alertas de capacidade  
**Testing**: `node:test` sequencial, testes puros/injetáveis, testes de contrato de rota e guardas estáticas do dashboard  
**Target Platform**: Ubuntu Linux x86-64 em Hetzner Cloud, processo Fastify gerenciado por PM2; navegador moderno responsivo  
**Project Type**: Aplicação web monorepo lógico (API Node em `src/`, dashboard Next em `dashboard/`)  
**Performance Goals**: snapshot recente servido em <2 s p95; coleta <1% CPU média e <50 MB adicionais em 24 h; alerta persistente detectado em até 10 min  
**Constraints**: nenhum processo PM2 novo; intervalo padrão de 5 min; sem shell com entrada variável; Hetzner read-only e cache ≥6 h; token nunca serializado; falha parcial localizada; demais abas não carregam capacidade; swap não conta como capacidade; SQLite single-host  
**Scale/Scope**: um host inicial CX33, ~17 workers atuais, 24 amostras/dia, 2.160 amostras detalhadas/90 d e até 8.760 rollups horários/ano; estrutura preparada para identificar host sem prometer coleta multi-host nesta entrega

## Constitution Check

*GATE inicial e pós-design: PASS.*

O arquivo `.specify/memory/constitution.md` contém apenas placeholders e não define gates executáveis. Aplicam-se as regras canônicas de `AGENTS.md` e do spec:

- **PASS — staging antes de produção**: a entrega seguirá branch/PR para `develop`; não prevê cutover de supervisor ou mutação de produção.
- **PASS — orçamento de memória**: reutiliza o processo da API, `unref()`, coleta limitada e retenção; nenhum daemon/PM2/dependência pesada.
- **PASS — segurança operacional**: leitura local usa APIs nativas/`execFile`; Hetzner é read-only; nenhum rescale/delete/restart; staging reutiliza autorização, MFA e auditoria existentes.
- **PASS — gerência de sessão**: nenhuma rota importará `sessionCore`; contagens vêm do banco e de `/proc`, sem assumir posse ou agir sobre workers.
- **PASS — testabilidade/resiliência**: política, forecast, parsing e consolidação são módulos puros/injetáveis; cada fonte produz estado próprio e `null`, nunca zero fabricado.
- **PASS — privacidade**: cmdlines são classificadas no servidor e não são retornadas integralmente; tokens/envs/paths sensíveis não entram em snapshot, audit log ou resposta.

Rechecagem pós-design: o modelo e os contratos abaixo mantêm todos os gates. A persistência adicional é necessária para FR-023–FR-029 e não introduz serviço novo.

## Project Structure

### Documentation (this feature)

```text
specs/014-admin-capacity-observability/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── admin-capacity-api.md
│   └── capacity-collector.md
└── tasks.md                 # criado posteriormente por /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── api/
│   ├── routes/admin.js                 # rotas /admin/capacity e auditoria
│   └── server.js                       # startCapacitySweep no processo existente
├── ops/
│   ├── capacity/
│   │   ├── collector.js                # orquestra fontes com timeout/isolamento
│   │   ├── linuxMetrics.js             # /proc, os, statfs
│   │   ├── processMetrics.js           # PM2 + workers reais
│   │   ├── hetznerClient.js            # read-only, cacheado
│   │   ├── policy.js                   # limite, gargalo e severidade (puro)
│   │   ├── forecast.js                 # tendências/faixa/confiança (puro)
│   │   ├── alerts.js                   # ciclo de vida/cooldown (puro + store)
│   │   ├── repository.js               # snapshots, rollups, retenção
│   │   ├── service.js                  # contratos current/history/forecast
│   │   └── contract.js                 # sanitização/versionamento da resposta
│   └── stagingPower.js                 # controle existente, apenas reutilizado
└── analytics.js                        # allowlist somente se canal existente exigir evento

dashboard/
├── app/admin/
│   ├── page.js                         # navegação/atalho, sem eager fetch
│   └── capacidade/
│       ├── page.js                     # tela lazy por rota
│       └── components/                 # decisão, recursos, gráfico, cenário, fontes
└── lib/api.js                           # cliente das rotas capacity

prisma/
├── schema.prisma
└── migrations/<timestamp>_admin_capacity_observability/

test/
├── ops-capacity-linux-metrics.test.js
├── ops-capacity-process-metrics.test.js
├── ops-capacity-policy.test.js
├── ops-capacity-forecast.test.js
├── ops-capacity-alerts.test.js
├── ops-capacity-repository.test.js
├── admin-capacity-routes.test.js
└── admin-capacity-page.test.js
```

**Structure Decision**: preservar a separação existente entre Fastify e Next. A coleta e as regras ficam em `src/ops/capacity/`, fora da rota, para testes db-free; a rota apenas autentica, valida e audita. A tela ganha rota própria `/admin/capacidade`, que garante lazy-load por navegação e evita ampliar ainda mais `dashboard/app/admin/page.js`.

## Complexity Tracking

Nenhuma violação constitucional. As novas tabelas são a menor solução que preserva histórico, versão de política, ciclo de alertas e retenção sem instalar uma plataforma externa de observabilidade.
