# Evidência de Soak P3.2/P3.3

Objetivo: comprovar, em staging com workers reais, que a plataforma sustenta a
carga do beta sem `SQLITE_BUSY`, sem vazamento de memória nos workers e com
latência dentro do SLO. **O resultado define o limite comercial de tenants do
beta — não prometer 50 tenants sem esta evidência preenchida.**

## Procedimento

### 1. Pré-condições
- Staging em `BOT_SUPERVISOR_MODE=remote` (ver `docs/deploy/supervisor-cutover.md`).
- `MAX_SESSIONS_PER_PROCESS` no valor atual (default conservador **20**).
- Pelo menos 3–5 contas de teste com sessão WhatsApp conectada e grupos de
  destino cadastrados (números de teste, não de produção).
- `METRICS_TOKEN` setado na `api-staging` (ou rodar o harness de dentro do VPS,
  onde `/metrics` é liberado para loopback).

### 2. Gerar carga (24–48h)
```bash
# logar cada conta de teste e coletar o JWT (cookie token) via /api/auth/login
SOAK_BASE_URL=http://178.105.54.0:3006 \
SOAK_TOKENS=<jwt1>,<jwt2>,<jwt3> \
SOAK_DURATION_MIN=2880 \
SOAK_BROADCAST_EVERY_MS=20000 \
SOAK_METRICS_TOKEN=<metrics_token> \
node scripts/soak_test.mjs soak-staging-$(date +%Y%m%d).json
```
O harness mede latência (p50/p95/p99), taxa de erro e amostra `/metrics`.

### 3. Coletar em paralelo (no VPS, durante a janela)
- **SQLITE_BUSY**: `grep -c "SQLITE_BUSY\|database is locked" ~/.pm2/logs/*staging*`
  no início e no fim (deve permanecer **0**).
- **RSS por worker**: `ps -o rss,command -C node | grep bot-worker` periodicamente
  (a cada hora) — observar se cresce monotonicamente (vazamento) ou estabiliza.
- **WAL**: `ls -la ~/wabot-staging/prisma/staging.db-wal` — não deve crescer
  sem checkpoint.
- **Event-loop / CPU**: `pm2 monit` ou `pm2 describe api-staging`.

### 4. Critérios de aprovação (GO)
| Métrica | Limite |
|---|---|
| `SQLITE_BUSY` na janela | 0 |
| Taxa 5xx da API | < 1% |
| p95 latência rotas comuns | < 500 ms |
| p99 latência escrita | dentro do SLO acordado |
| RSS por worker | estabiliza (sem crescimento monotônico) |
| `session_owner_mismatch_total` | 0 (shard único) ou só transições esperadas |
| `session_quarantine_total` | 0 (nenhuma sessão em churn) |
| Job mais antigo em fila | < 5 min |

Qualquer item vermelho = **NO-GO**: reduzir o limite comercial de tenants à
capacidade comprovada e/ou priorizar a migração Postgres (Onda 2).

---

## Resultado da execução (preencher após a rodada)

- Ambiente: staging
- Data/janela: ____ (início) → ____ (fim), ____ h
- Tenants virtuais no harness: ____
- Sessões WhatsApp conectadas: ____
- SHARD_COUNT/SHARD_INDEX: ____
- `MAX_SESSIONS_PER_PROCESS`: ____
- Arquivo de resultado do harness: ____

| Métrica | Início | Fim |
|---|---|---|
| SQLITE_BUSY (contagem nos logs) | ____ | ____ |
| Taxa 5xx API | ____ | ____ |
| p95 / p99 latência (ms) | ____ | ____ |
| RSS médio por worker (MB) | ____ | ____ |
| WAL size (MB) | ____ | ____ |
| session_owner_mismatch_total | ____ | ____ |
| session_circuit_breaker_alert_total | ____ | ____ |
| session_quarantine_total | ____ | ____ |

- Erros de envio e dedup global observados: ____
- Limite comercial de tenants comprovado: ____
- **Conclusão: GO / NO-GO** — ____
