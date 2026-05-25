# Plano técnico detalhado — P2 e P3 (staging-first)

## Classificação
- Tipo: **[DESENVOLVIMENTO]**
- Escopo atual executado: **P2.0 + P2.1**

## Protocolo STRICT (resumo)
1. Erros fatais: evitar cutover sem backup validado e sem freeze controlado.
2. Breaking changes: troca de provider Prisma (`sqlite` -> `postgresql`) é breaking infra.
3. Efeito cascata: auth/sessão/pagamento/envio dependem de consistência transacional.
4. Isolamento: staging primeiro, sem tocar produção antes de aceite.
5. Bloqueio: qualquer divergência de consistência => bloquear promoção.

---

## P2 — Escala de dados


## Tabela única de status oficial (P2/P3)

| Item | Status de implementação | Validado Staging | Validado Produção | Observação |
|---|---|---|---|---|
| P2.0 Preparação | implementado completo | sim (artefatos/revisão) | n/a | Inventário + matriz + estratégia definidos |
| P2.1 Infra + schema paralelo | implementado parcial | parcial | não | scripts e schema prontos; falta evidência consolidada de execução fim-a-fim |
| P2.2 Consistência de dados | implementado parcial | não | não | script/checks criados; execução operacional pendente |
| P2.3 Separação trilha eventos | implementado parcial | parcial | não | dual-write implementado; falta reconciliação/soak formal |
| P2.4 Cutover produção | planejado | não | não | guard script existe; cutover real não executado |
| P3.0 Estado compartilhado Redis | implementado parcial | parcial | não | token revocation global implementado; throttles/dedup globais pendentes |
| P3.1 API stateless + LB | implementado parcial | não | não | checklist criado; validação com múltiplas réplicas pendente |
| P3.2 Worker sharding | implementado parcial | não | não | helpers+teste+plano; integração no bootstrap pendente |
| P3.3 Guardrails multi-sessão | implementado parcial avançado | parcial | não | enforcement runtime (dedup/throttle + fail-open/closed + circuit breaker) implementado; falta soak formal e promoção |


## P2.0 — Preparação (executado)

### Entregáveis
- Inventário de domínio (OLTP x Eventos):
  - OLTP crítico: `User`, `WaSession`, `Group`, `Credential`, `Payment`, `BotConfig`.
  - Evento/alto volume: `MessageLog`, `AnalyticsEvent`, `AffiliateClick`, `WebhookEvent`, `FollowLog`.
- Matriz de migração SQLite -> Postgres:
  - Datas, índices, unique constraints, campos nullable, IDs string/cuid.
- Estratégia de validação de consistência:
  - contagem por tabela,
  - amostragem de integridade relacional,
  - métricas financeiras (soma de `Payment.amount` por janela).

### Critérios de aceite
- Inventário e checklist aprovados.
- Runbook de rollback definido antes de qualquer cutover.

---

## P2.1 — Infra + schema em paralelo em staging (executado)

### Estratégia
1. Provisionar Postgres em staging.
2. Criar schema Prisma dedicado para Postgres em arquivo separado (`prisma/schema.postgres.prisma`).
3. Aplicar migrações no Postgres (staging) sem alterar produção.
4. Rodar checklist de saúde e readiness.

### Arquivos e artefatos
- `prisma/schema.postgres.prisma` (datasource `postgresql`).
- `scripts/p2_1_staging_postgres_prepare.sh` (preflight + migrate + checks).

### Critérios de aceite
- Migrações aplicam sem erro no Postgres staging.
- `GET /health` e `GET /ready` respondem com sucesso no staging pós-restart.
- Sem quebra de contrato externo no dashboard/API staging.

---

## P2.2 — Próximos passos (não executado nesta fase)
- Full load SQLite -> Postgres em staging.
- Delta sync curto + freeze de escrita para validação final.
- Testes funcionais ponta a ponta em staging.

## P2.3 — Separação trilha de eventos (não executado nesta fase)
- Isolar `MessageLog` / `AnalyticsEvent` / `AffiliateClick` / `WebhookEvent` em schema ou DB de eventos.
- Dual-write temporário com reconciliação.

## P2.4 — Cutover produção (não executado nesta fase)
- Janela controlada, backup final, rollback pronto e testado.

---

## P3 — Escala horizontal plena (plano)

1. Mover estado compartilhado para Redis:
   - revogação de token,
   - throttles/dedup globais,
   - marcadores de sessão distribuídos.
2. API stateless com réplicas + LB:
   - health/readiness checks,
   - sticky-session não obrigatório após remoção de estado local.
3. Workers sharded/multi-sessão:
   - shard por `userId` consistente,
   - limites por número/destino centralizados em Redis.

---

## Gate de promoção (obrigatório)
Somente promover para produção após:
1. validação completa em `http://178.105.54.0:3006`;
2. checks de consistência aprovados;
3. rollback testado em staging.

---

## P2.2 — Migração de dados + consistência (executável)

### Scripts
- `scripts/p2_2_staging_data_consistency_check.sh`
  - compara contagem por tabela entre SQLite e Postgres,
  - valida checksum financeiro (`Payment.amount` aprovado 30d),
  - modo estrito com `STRICT=1`.

### Execução em staging (exemplo)
```bash
SQLITE_DB_PATH=~/wabot-staging/prisma/staging.db \
PG_URL='postgresql://user:pass@host:5432/wabot_staging' \
STRICT=1 \
bash scripts/p2_2_staging_data_consistency_check.sh
```

### Critério de aceite P2.2
- `CONSISTENCY=OK` no modo estrito.
- Diferença zero nas tabelas críticas de OLTP.
- Checksum financeiro sem divergência.

## P2.3 — Separação de trilha de eventos (executável)

### Estratégia técnica
- Criar store de eventos em Postgres separado (schema ou database).
- Ativar dual-write para:
  - `MessageLog`, `AnalyticsEvent`, `AffiliateClick`, `WebhookEvent`, `FollowLog`.
- Backfill inicial + reconciliação periódica.
- Feature flag para rollback rápido de dual-write -> single-write OLTP.

### Script de checklist
- `scripts/p2_3_events_split_plan.sh`

### Execução
```bash
bash scripts/p2_3_events_split_plan.sh
```

### Critério de aceite P2.3
- Sem perda de eventos em soak de 24h.
- Reconciliação com diff zero nas entidades de evento.
- Sem aumento relevante de 5xx/latência nas rotas OLTP.


### Implementação incremental já entregue em P2.3

- Novo módulo `src/events/store.js` com modo `EVENT_STORE_MODE`:
  - `oltp` (default): escreve só no DB principal
  - `dual`: escreve no DB principal e tenta espelhar no events store
- Pontos integrados com dual-write:
  - `AnalyticsEvent` (`src/analytics.js`)
  - `AffiliateClick` (`src/core/clickTracker.js`)
  - `FollowLog` (`src/core/followGuard.js`)
  - `WebhookEvent` (`src/api/routes/payments.js`)
- Testes: `test/events-store.test.js` validando `oltp` e `dual`.

---

## P2.4 — Cutover produção (executável)

### Script
- `scripts/p2_4_prod_cutover_guard.sh` (gate/checklist de pré-cutover)

### Gate
- Exige marcador de aprovação de staging (`~/.p2_staging_approved` por padrão) antes de permitir sequência de produção.

## P3.0 — Estado compartilhado em Redis (implementação incremental)

### Entrega
- `src/core/tokenRevocationStore.js` com modo híbrido:
  - memória local sempre,
  - Redis opcional quando `REDIS_URL` e `REVOCATION_STORE_MODE!=memory`.
- `src/api/server.js` atualizado para usar `revokeTokenJtiGlobal` e `isTokenRevokedGlobal`.

### Rollback rápido
- Definir `REVOCATION_STORE_MODE=memory` para desabilitar Redis e voltar ao comportamento local.

## P3.1 — API stateless/lb readiness

### Script
- `scripts/p3_1_api_scaleout_check.sh` (checklist operacional)


## P3.2 — Sharding consistente de workers (implementação incremental)

### Entregas
- `src/supervisor/sharding.js`
  - `computeShardIndex(userId, shardCount)` (determinístico)
  - `buildShardTag(userId, shardCount)`
  - `shouldHandleUserOnShard(...)`
- `scripts/p3_2_worker_shard_plan.sh`
  - checklist operacional para rollout de shards em supervisor.
- `test/supervisor-sharding.test.js`
  - garante determinismo e segurança de bounds.

### Objetivo
- Permitir distribuição estável por `userId` para evitar ownership flapping em restarts/deploys.

## P3.3 — Guardrails multi-sessão e limites por destino

### Entregas
- `scripts/p3_3_multi_session_limits_check.sh` com checklist de hardening:
  - dedup global,
  - rate limit centralizado,
  - limite de sessões por processo,
  - soak test antes de produção.

### Próximo passo técnico
- Integrar o sharding ao bootstrap do `bot-supervisor` via env (`SHARD_COUNT`, `SHARD_INDEX`) e rejeitar sessões fora do shard local.
