# Sprint B — Governança operacional e gate de promoção

## Objetivo
Fechar o ciclo operacional do hardening:
1. observabilidade consolidada para decisão GO/NO-GO,
2. execução obrigatória do P2.4 em `dry-run`,
3. evidência de soak preenchida antes de promoção.

## Checklist executável
```bash
cd ~/wabot-staging
bash scripts/sprint_b_operational_gate.sh
```

## Requisitos
- `docs/p3-soak-evidence.md` sem placeholders (`____`).
- `/api/admin/system/observability` acessível e sem recomendação `no-go`.
- `scripts/p2_4_prod_cutover_guard.sh` passando em `MODE=dry-run`.

## Critério de aceite
- saída final: `SPRINT_B_GATE=OK`
- somente com esse estado é permitido abrir promoção para produção.
