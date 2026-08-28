# Implementation Plan: Painel de vendas da Shopee

**Branch**: `014-shopee-sales-dashboard` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-shopee-sales-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Adicionar `/painel/vendas` imediatamente abaixo de Painel na navegação e uma rota Fastify
autenticada que consulta, em modo estritamente somente leitura, o `conversionReport` da
credencial Shopee da pessoa. Um adaptador de domínio normaliza o schema comprovado pela prova
técnica, seleciona apenas conversões cujo `utmContent` começa com `espelhagrupos`, deduplica
conversões/pedidos/itens e calcula medidas financeiras canônicas. A tela interativa preserva a
última resposta bem-sucedida durante retentativas, oferece períodos de hoje/7/30 dias e intervalo
personalizado, e apresenta resumo, estados, pedidos e produtos sem PII ou métricas de cliques não
comprovadas. A primeira versão faz leitura sob demanda, sem migration, cron, processo ou cache
global, preservando o isolamento por usuário e a política de memória do produto.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript ESM em Node.js 22; React 19.2.4 / Next.js 16.2.4

**Primary Dependencies**: Fastify 5.8, Prisma 5.22, Axios 1.7, Next.js App Router 16.2, React 19

**Storage**: SQLite existente somente para ler `Credential`; resultados Shopee permanecem transitórios (sem migration)

**Testing**: `node:test` para domínio/rota/contrato e guardas de UI; ESLint e `next build --webpack`

**Target Platform**: Linux/PM2; navegadores desktop e móveis suportados pelo dashboard responsivo

**Project Type**: aplicação web monorepo (API Fastify + dashboard Next.js)

**Performance Goals**: shell visível imediatamente; resposta de sucesso em até 15 s sob condições normais da Shopee; troca de página local imediata após a carga

**Constraints**: somente leitura; zero PII/segredos; sem alterar links/workers; no máximo 30 dias por consulta; subconsultas Shopee de até 7 dias; timeout e limites de páginas/registros; sem cache compartilhado entre usuários

**Scale/Scope**: uma nova tela, um endpoint autenticado e um módulo de integração/domínio; uma credencial Shopee por usuário; paginação de 20 linhas na UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo de constituição ainda contém apenas placeholders e, portanto, não define gates
executáveis. Aplicam-se as regras canônicas de `AGENTS.md`:

- **PASS — staging/deploy**: entrega aditiva na branch de feature, destinada a PR contra
  `develop`; nenhuma ação de produção faz parte do plano.
- **PASS — memória**: leitura é acionada pela tela; não cria processo PM2, cron, polling nem
  cache residente. Limites de janela/páginas evitam crescimento sem controle.
- **PASS — segurança**: autenticação Fastify e `req.user.sub` delimitam a única credencial lida;
  segredos ficam no backend e a resposta usa DTO allowlisted.
- **PASS — compatibilidade**: conversores, `manager.js`, bot-worker e supervisor não são
  modificados; a integração de relatório vive em módulo novo.
- **PASS — Next.js local**: o desenho segue a documentação instalada do Next 16.2.4: página
  server por padrão e uma ilha client somente para filtros, carga, retentativa e paginação.
- **PASS — testabilidade**: normalização, atribuição, deduplicação, status e finanças ficam em
  funções puras; a rota recebe dependências injetáveis como as rotas existentes.

**Rechecagem pós-design**: PASS. Contrato, modelo e quickstart mantêm os gates acima; não foi
introduzida exceção nem complexidade que exija justificativa.

## Project Structure

### Documentation (this feature)

```text
specs/014-shopee-sales-dashboard/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── api/
│   ├── routes/shopeeSales.js       # GET autenticado e validação do período
│   └── server.js                    # registro aditivo da rota
└── shopeeSales/
    ├── client.js                    # assinatura GraphQL e leitura paginada
    ├── report.js                    # query explícita do schema comprovado
    └── service.js                   # normalização, atribuição, dedupe e resumo

dashboard/
├── app/painel/
│   ├── nav.js                       # Vendas logo após Painel
│   └── vendas/
│       ├── page.js                  # composição server
│       ├── loading.js               # skeleton da rota
│       └── SalesDashboard.js        # ilha client interativa
└── lib/api.js                       # método tipado por contrato de uso

test/
├── shopee-sales-service.test.js
├── shopee-sales-route.test.js
└── painel-vendas.test.js
```

**Structure Decision**: manter a divisão já existente entre `src/` (domínio e API Fastify),
`dashboard/` (App Router) e `test/` (`node:test`). A integração de relatório não entra em
`src/converters/`, pois não converte nem gera links; isso reduz risco de regressão e evita que o
deploy considere a mudança como código carregado pelo bot-worker. O estado interativo fica no
menor componente client possível, conforme a documentação local do Next.js.

## Complexity Tracking

Nenhuma violação identificada; não há exceções para justificar.
