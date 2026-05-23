# Sprint A — Hardening técnico (executing-plans)

## Objetivo
Blindar os riscos operacionais mais críticos antes da promoção:
1. Matriz de fail-open/fail-closed para dedup/rate-limit global.
2. Política de shard ownership e sanity check por instância.
3. Perfil de circuit breaker por processo.

## Entregáveis
- `scripts/sprint_a_runtime_guardrail_check.sh`
  - valida env e ranges críticos: `GLOBAL_*`, `REDIS_FAIL_MODE`, `SHARD_*`, `MAX_SESSIONS_PER_PROCESS`, `SESSION_CIRCUIT_BREAKER_MODE`.
- Ajuste de robustez de comparação em runtime para guardrails (`===` em vez de `==`).

## Sequência de execução (staging)
1. Atualizar staging (`develop`) e instalar deps.
2. Rodar checker:
   ```bash
   cd ~/wabot-staging && bash scripts/sprint_a_runtime_guardrail_check.sh
   ```
3. Reiniciar `api-staging` e `bot-supervisor-staging`.
4. Validar observabilidade:
   - `GET /api/admin/system/observability`
   - `GET /metrics`
5. Registrar GO/NO-GO em `docs/p3-soak-evidence.md`.

## Critérios de aceite
- Checker retorna `OK: matriz de guardrails válida`.
- Sem `session_owner_mismatch_total` crescente em operação normal.
- Sem disparo contínuo de `session_circuit_breaker_alert`.
