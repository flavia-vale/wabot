# Session Documentation
Date: 2026-06-11

## Summary
Consolidada a consulta de histórico e agendamentos em `/painel/envios`, com Histórico como visão padrão e Próximos envios em `?view=scheduled`. A API agora lista apenas agendamentos ativos e restringe o cancelamento de forma atômica ao estado `pending`.

## Changes
- feat(envios): unificar Histórico e Próximos envios em abas, preservando `/painel/agendados` como redirect de compatibilidade.
- feat(envios): consolidar o sidebar em um único item Envios e identificar execuções originadas por agendamento no histórico.
- fix(api): filtrar `GET /scheduled` para `pending`/`queued` e cancelar via atualização condicional apenas mensagens `pending`, com respostas 404/409.
- test(envios): cobrir contrato da API, tabs, estado vazio, refresh, cancelamento, sidebar e redirect legado.
- test(routing): alinhar o baseline `variations`/`messages` ao `routeMap` canônico, que compartilha intencionalmente `/painel/mensagens`.

## Technical Decisions
- `ScheduledMessage` continua representando o planejamento agregado e `MessageLog` a execução por destino; a consolidação é de experiência, não de persistência.
- Histórico permanece como padrão para preservar o comportamento da rota existente; `searchParams` assíncrono seleciona a visão de agendados no Server Component do Next.js 16.
- Itens `queued` são visíveis, mas não canceláveis. O `updateMany` condicionado a `pending` evita corrida com o worker sem permitir cancelar trabalho já enfileirado.
- A rota legada foi mantida como ponte porque o `routeMap` não representa query strings.

## Development, Review and QA Cycle
1. Iteração 1 — desenvolvimento: implementadas API, extração do histórico, visão de próximos envios, tabs, sidebar, redirect e testes focados.
2. Iteração 2 — review/QA: restaurada cobertura de navegação removida durante a mudança. O teste de roteamento bloqueou a validação ao exigir unicidade de destinos no painel e tratar `variations` como sem equivalente web; o bloqueador foi corrigido ajustando o teste baseline ao `routeMap` canônico, no qual `variations` e `messages` convergem intencionalmente em `/painel/mensagens`.

## Validation
- Testes focados: 30/30 aprovados para API de agendamentos, UI de Envios, sidebar e roteamento de variantes.
- Lint do dashboard: sem erros; permaneceu um warning preexistente de `<img>` em `WhatsAppBubble.js`.
- Build de produção do dashboard: aprovado com Next.js 16.2.4; permaneceu o aviso preexistente de depreciação da convenção `middleware`.
- QA HTTP local no build: `/painel/envios` e `/painel/envios?view=scheduled` responderam 200; `/painel/agendados` respondeu 200 prerenderizado contendo o redirect Next `307` para `/painel/envios?view=scheduled`.
- Suíte completa: 850/855 testes aprovados. As cinco falhas observadas são de baseline fora deste escopo (`deploy-safe-staging`, `events-store`, contrato de config sem `DATABASE_URL` e dois testes que referenciam páginas mobile ausentes); os testes da consolidação permaneceram verdes.

## Known Issues / Future Work
- Screenshot não foi capturada porque o ambiente não disponibilizava browser automatizado nem sessão autenticada; a validação visual ficou limitada ao build e ao QA HTTP.
