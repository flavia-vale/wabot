# Fase 0 — Baseline & Definition of Done (DoD)

## Objetivo
Congelar um baseline técnico **antes** das mudanças de hardening para evitar regressão silenciosa e permitir comparação objetiva entre "antes/depois".

## Escopo da Fase 0
1. Registrar comportamento atual (contrato) de:
   - fail-open/fail-closed no runtime;
   - `/api/admin/system/observability`;
   - `/metrics`;
   - `scripts/p2_4_prod_cutover_guard.sh` em `dry-run`.
2. Validar checklist de risco (STRICT) para bloquear avanço inseguro.
3. Formalizar DoD por item crítico das fases seguintes.

---

## Análise de risco STRICT (pré-execução)

### 1) Erros fatais
- Risco: mudanças em modo de fallback Redis e parser de env quebrarem fluxo de sessão/envio.
- Mitigação Fase 0: registrar baseline e exigir comparação pós-mudança com as mesmas verificações.

### 2) Breaking changes
- Risco: alteração semântica de `fail-open/fail-closed` mudar comportamento esperado em produção.
- Mitigação Fase 0: baseline explícito do comportamento atual e matriz de decisão documentada.

### 3) Efeito cascata
- Risco: novos contadores em supervisor exigirem atualização de observabilidade/admin.
- Mitigação Fase 0: snapshot atual de `/metrics` e `/api/admin/system/observability`.

### 4) Isolamento de ambiente
- Risco: validação acidental em produção.
- Mitigação Fase 0: execução canônica em staging (`~/wabot-staging`, portas 3006/3004).

### 5) Bloqueio
- Se não houver baseline completo + checklist assinado, **bloquear** início das fases 1–4.

---

## Checklist executável da Fase 0

No staging:

```bash
cd ~/wabot-staging
bash scripts/sprint_0_baseline_capture.sh
```

Saídas esperadas (artefatos):
- `docs/evidence/sprint0/baseline-runtime-env.txt`
- `docs/evidence/sprint0/baseline-observability.json`
- `docs/evidence/sprint0/baseline-metrics.txt`
- `docs/evidence/sprint0/baseline-cutover-dry-run.txt`
- `docs/evidence/sprint0/dod-checklist.md`

---

## DoD (Definition of Done) — Fase 0

A Fase 0 só é considerada concluída quando TODOS os itens abaixo estiverem verdadeiros:

- [ ] Baseline runtime/env gerado com timestamp e commit SHA.
- [ ] Snapshot de `/api/admin/system/observability` salvo.
- [ ] Snapshot de `/metrics` salvo.
- [ ] Execução de `p2_4_prod_cutover_guard.sh` em `dry-run` registrada.
- [ ] Checklist STRICT preenchido em `docs/evidence/sprint0/dod-checklist.md`.
- [ ] Sem uso de produção durante a coleta.

Status final esperado no log: `PHASE_0_DOD=OK`.

---

## Gate para seguir para Fase 1

Só avançar para Fase 1 (contrato fail-open/fail-closed + testes Redis) quando:
1. `PHASE_0_DOD=OK`;
2. artefatos estiverem versionados no PR;
3. baseline revisado e aprovado.
