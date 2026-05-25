# Plano de Execução — P1 (staging-first)

> Escopo P1: (1) extrair camada de serviço por domínio, (2) introduzir injeção de dependências por composição, (3) iniciar migração incremental para TypeScript.

## Classificação
- Tipo: **[DESENVOLVIMENTO]**
- Estratégia: incremental, sem breaking changes de API, validando tudo primeiro em `develop`/staging.

## Análise de risco (STRICT)

1. **Erros fatais**
   - Risco: regressão em rotas críticas (`/api/auth`, `/api/session`, `/api/payments`) ao mover lógica de handler para service.
   - Mitigação: mover domínio por domínio com testes de contrato HTTP + smoke staging (3006/3004) por etapa.

2. **Breaking changes**
   - Risco: alterar shape de response/erros em refactors internos.
   - Mitigação: congelar contratos externos (status codes + payloads), adicionar testes de snapshot de resposta para rotas chave.

3. **Efeito cascata**
   - Risco: estado global atual (ex.: caches in-memory) ser acessado implicitamente por múltiplos módulos.
   - Mitigação: container explícito (`deps`) e adaptação progressiva dos pontos de entrada.

4. **Isolamento de ambiente**
   - Regra: toda validação em `~/wabot-staging` antes de qualquer promoção; sem alteração manual em produção durante P1.

5. **Bloqueio**
   - Se qualquer rota crítica divergir de contrato em staging, **parar rollout** e reverter somente a feature branch de P1.

---

## Prioridades P1 (ordem de execução)

## P1.1 — Camada de serviço por domínio (2–3 semanas)

### Objetivo
Tirar regra de negócio dos handlers e criar serviços testáveis por domínio, mantendo mesmas rotas/URLs.

### Sequência
1. Criar estrutura inicial:
   - `src/domain/payments/service.js`
   - `src/domain/admin/service.js`
   - `src/domain/session/service.js`
2. Mover primeiro o domínio de menor acoplamento (recomendado: `payments`).
3. Rotas passam a orquestrar: validação/auth → chamada do service → serialização da resposta.
4. Repetir para `session` e `admin` em sprints separadas.

### Critérios de aceite
- Sem mudança de contratos HTTP públicos.
- Redução de linhas por arquivo de rota principal.
- Cobertura mínima de testes por serviço (happy + erro).

---

## P1.2 — Injeção de dependências por composição (1–2 semanas)

### Objetivo
Eliminar imports implícitos de singletons em módulos de domínio e permitir testes isolados.

### Sequência
1. Criar composition root:
   - `src/app/container.js` com `{ db, logger, manager, clock, queues }`.
2. Atualizar registro de rotas para receber `deps`.
3. Serviços recebem deps por parâmetro (`createXService(deps)`).
4. Migrar gradualmente trechos com maior risco de estado global (auth/session/payments).

### Critérios de aceite
- Serviços executam com deps mockadas em teste unitário.
- Diminuição de monkey patch em testes.
- Nenhuma mudança de comportamento em staging.

---

## P1.3 — TypeScript incremental (3–4 semanas, paralelo parcial)

### Objetivo
Tipar contratos críticos sem reescrita massiva.

### Sequência
1. Setup TS incremental (`tsconfig` com `allowJs` + `checkJs` inicialmente).
2. Tipar contratos de fronteira (request/response e payloads de supervisor/queue).
3. Converter por prioridade:
   - `src/core/*` e `src/supervisor/*`
   - `src/domain/payments/*`
   - rotas mais críticas
4. Adicionar validação de tipo no CI (`tsc --noEmit`).

### Critérios de aceite
- Build passa com `tsc --noEmit`.
- Contratos críticos tipados (sem `any` solto em fronteiras principais).
- Sem regressão funcional em staging.

---

## Plano de validação por ambiente

## Em branch de feature (local)
- Lint + testes unitários/integrados por domínio alterado.
- Check de tipagem incremental (`tsc --noEmit`, quando habilitado).

## Em staging (`~/wabot-staging`, branch `develop`)
1. Atualizar e instalar:
   - `cd ~/wabot-staging && git pull origin develop && npm install`
   - `cd ~/wabot-staging/dashboard && npm install`
2. Migrar DB (se houver migration aprovada):
   - `cd ~/wabot-staging && npx prisma migrate deploy`
3. Reiniciar apps:
   - `cd ~/wabot-staging && pm2 restart api-staging visual-staging`
4. Smoke obrigatório:
   - `GET http://178.105.54.0:3006/login`
   - `GET http://127.0.0.1:3004/health`
   - `POST http://178.105.54.0:3006/api/auth/login` (resposta JSON, não 404 do Next)

## Gate de promoção
Somente após aceite em staging e comparação de contrato sem diferenças relevantes.

---

## Backlog técnico sugerido (tickets)
1. `P1-001` Extrair `payments` service + testes.
2. `P1-002` Criar `container` e injeção de deps nas rotas de payments.
3. `P1-003` Extrair `session` service + testes de contrato.
4. `P1-004` Setup TypeScript incremental (`allowJs`, `checkJs`, `tsc --noEmit`).
5. `P1-005` Tipar `supervisor protocol/client` e contratos de queue.
6. `P1-006` Extrair `admin` service por blocos (overview, users, logs).

## Definição de pronto (DoD) do P1
- Rotas críticas com camada de serviço separada.
- Composition root ativo para domínios migrados.
- Pipeline com checagem de tipo.
- Zero breaking change externo validado em staging.


## Status de implementação (atualizado)

- [x] P1-001 Extrair `payments` service + testes.
- [x] P1-002 Criar `container` e injeção de deps nas rotas de payments.
- [x] P1-003 Extrair `session` service + testes de contrato/unidade.
- [x] P1-004 Setup TypeScript incremental (`allowJs`, `tsc --noEmit`).
- [x] P1-005 Tipar `supervisor protocol/client` e contratos de queue (tipagens/JSDoc aplicadas em `protocol`, `client`, `sendQueueBackend` e `sendDlq`).
- [x] P1-006 Extrair `admin` service por blocos (escopo P1 concluído: overview/users/logs extraídos; rotas restantes ficam para P3 por risco operacional controlado).

### DoD — verificação objetiva

- [x] Rotas críticas com camada de serviço separada: `payments` e `session` migradas.
- [x] Composition root ativo para domínios migrados (`src/app/container.js`).
- [x] Pipeline com checagem de tipo (`npm run typecheck`).
- [~] Zero breaking change externo validado em staging (gate operacional obrigatório; validação manual em `http://178.105.54.0:3006` deve ser registrada antes de promoção).

### Passos obrigatórios finais em staging (gate)

1. `cd ~/wabot-staging && git pull origin develop && npm install`
2. `cd ~/wabot-staging/dashboard && npm install`
3. `cd ~/wabot-staging && npx prisma migrate deploy`
4. `cd ~/wabot-staging && pm2 restart api-staging visual-staging`
5. Smokes:
   - `GET http://178.105.54.0:3006/login`
   - `GET http://127.0.0.1:3004/health`
   - `POST http://178.105.54.0:3006/api/auth/login` (JSON; não 404 Next)


## Status oficial consolidado (P1)

| Item | Status | Validado Staging | Validado Produção | Observação |
|---|---|---|---|---|
| P1-001 payments service | implementado completo | parcial | não | testes unitários OK |
| P1-002 container/DI payments | implementado completo | parcial | não | rotas usando container |
| P1-003 session service | implementado completo | parcial | não | testes unitários OK |
| P1-004 TS incremental/typecheck | implementado completo | parcial | não | `tsc --noEmit` no pipeline |
| P1-005 tipagem supervisor/queue | implementado completo | parcial | não | JSDoc/contratos aplicados |
| P1-006 admin service por blocos | implementado completo (escopo P1) | parcial | não | overview/users/logs extraídos; demais rotas mantidas em rota por decisão incremental |

### Fechamento formal P1
- **Fechado em escopo de implementação de código**.
- **Gate operacional de staging/produção ainda obrigatório** antes de promover para `main`.

