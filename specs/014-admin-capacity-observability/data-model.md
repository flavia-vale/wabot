# Data model — Capacidade e previsibilidade

Todos os horários são UTC. Métricas ausentes usam `null`; zero significa uma medição confiável de zero. JSON persistido deve ser sanitizado e nunca conter cmdline completo, env, token, credencial ou PII.

## 1. CapacityHostProfile

Identidade/capacidade conhecida do host monitorado e último inventário do provedor.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String | cuid, PK |
| `hostKey` | String | único; estável, ex. `hetzner:128727108` |
| `hostname` | String | baseline `wabot-prod` |
| `provider` | String | `hetzner` inicialmente |
| `providerProjectId` | String? | identificador não secreto |
| `providerServerId` | String? | `128727108` inicialmente |
| `serverType` | String? | `CX33` inicialmente |
| `architecture` | String? | `x86` inicialmente |
| `vcpu` | Int? | >0 |
| `memoryTotalMb` | Int? | >0 |
| `diskTotalMb` | Int? | >0 |
| `region` | String? | `eu-central` inicialmente |
| `ipv4` | String? | valor público não secreto |
| `inventoryJson` | String | JSON sanitizado de servidores/volumes/IPs/backup/quota/custo |
| `source` | String | `provider`, `manual` ou `baseline` |
| `checkedAt` | DateTime? | idade explícita |
| `lastSuccessAt` | DateTime? | último dado externo válido |
| `errorCode` | String? | código seguro, sem corpo/token |
| `createdAt`,`updatedAt` | DateTime | auditoria temporal |

Relações: 1:N com snapshots, rollups, eventos e alertas.

## 2. CapacitySnapshot

Fotografia a cada cinco minutos. Campos gráficos ficam escalares; detalhes de componentes/fontes ficam em JSON.

| Grupo | Campos principais |
|---|---|
| Identidade | `id`, `hostProfileId`, `collectedAt`, `durationMs`, `completeness` (`complete|partial|failed`) |
| CPU | `cpuPercent`, `load1`, `load5`, `load15`, `uptimeSeconds` |
| RAM | `memoryTotalMb`, `memoryFreeMb`, `memoryAvailableMb`, `memoryCacheMb`, `processRssTotalMb`, `fixedBaseMb` |
| Swap | `swapTotalMb`, `swapUsedMb`, `swapInKbPerSec`, `swapOutKbPerSec` |
| Disco | `diskTotalMb`, `diskUsedMb`, `diskAvailableMb`, `diskUsedPercent`, `inodeUsedPercent` |
| Sessões | `connectedSessions`, `activeCustomers`, `productionWorkers`, `stagingWorkers` |
| Workers | `workerRssTotalMb`, `workerRssP50Mb`, `workerRssP95Mb`, `workerRssMaxMb` |
| Ambientes | `productionRssMb`, `stagingRssMb`, `stagingOnline` |
| Decisão | `policyVersion`, `safeSessionLimit`, `estimatedMaximum`, `headroomSessions`, `headroomMemoryMb`, `bottleneck`, `operationalState`, `decisionReasonsJson` |
| Fontes | `sourcesJson`, `componentsJson` |

Índices: `(hostProfileId,collectedAt)`, `(operationalState,collectedAt)`. Retenção raw mínima: 90 dias.

Validações:
- percentuais 0–100 quando presentes;
- contadores/memória não negativos;
- `headroomSessions` pode ser negativo;
- `safeSessionLimit <= estimatedMaximum` quando ambos presentes;
- decisão fica `insufficient_data` se fontes essenciais não forem confiáveis.

## 3. CapacityRollup

Resumo que preserva histórico após retenção raw.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String | cuid |
| `hostProfileId` | String | FK |
| `bucketStart` | DateTime | UTC truncado ao bucket |
| `granularity` | String | `hour` ou `day` |
| `sampleCount`,`expectedSampleCount` | Int | cobertura/confiança |
| `metricsJson` | String | min/avg/p50/p95/max das métricas relevantes |
| `sessionPeak`,`workerPeak` | Int? | série usada no forecast |
| `safeLimitMin` | Int? | menor limite no bucket |
| `worstState` | String | pior severidade observada |
| `policyVersionsJson` | String | versões vistas no bucket |
| `createdAt`,`updatedAt` | DateTime | upsert idempotente |

Restrição única: `(hostProfileId,granularity,bucketStart)`. Retenção: hora ≥12 meses; dia conforme política operacional.

## 4. CapacityEvent

Anotação imutável para explicar mudanças.

Campos: `id`, `hostProfileId`, `type` (`deploy|staging_changed|process_restart|oom|host_changed|policy_changed|manual_note`), `occurredAt`, `source`, `severity`, `title`, `detailsJson` sanitizado, `dedupeKey?`, `createdAt`.

Índices: `(hostProfileId,occurredAt)`, `(type,occurredAt)`; `dedupeKey` opcional único para importações idempotentes.

## 5. CapacityAlert

Lifecycle persistente de uma condição operacional.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | String | cuid |
| `hostProfileId` | String | FK |
| `type` | String | allowlist da política |
| `status` | String | `pending|active|recovered` |
| `severity` | String | `attention|plan_now|critical` |
| `conditionKey` | String | único por host/tipo/escopo ativo |
| `firstObservedAt`,`lastObservedAt` | DateTime | evidência |
| `consecutiveBreaches`,`consecutiveRecoveries` | Int | persistência |
| `lastNotifiedAt` | DateTime? | cooldown |
| `recoveredAt` | DateTime? | somente recovered |
| `observedValuesJson` | String | valores sanitizados |
| `recommendation` | String | ação humana, sem comando destrutivo automático |
| `policyVersion` | String | explicabilidade |
| `createdAt`,`updatedAt` | DateTime | lifecycle |

Transições:

```text
ausente -> pending (1ª violação)
pending -> active (2ª violação consecutiva)
pending -> removido/ignorado (normalizou antes de persistir)
active -> active (atualiza evidência; notifica só após 24h ou piora)
active -> recovered (2 medições normais consecutivas)
recovered -> novo pending (nova ocorrência cria novo ciclo)
```

## 6. CapacityPolicy (valor versionado, não tabela editável no MVP)

Objeto congelado no código e copiado nos resultados relevantes:

- `version = capacity-policy-v1`;
- reserva: `max(20%, 1536 MB, fixedBaseP95Mb)`;
- custo: `max(350 MB, workerRssP95Mb confiável)`;
- histórico mínimo: 7 dias/5 pontos; p95 dinâmico requer 14 dias;
- raw 90 d, rollup horário 12 meses;
- thresholds/persistência/cooldown.

Mudança de versão cria `CapacityEvent(policy_changed)` e não recalcula snapshots antigos.

## 7. Projeção e cenário (derivados, não persistidos)

### CapacityForecast

`windowDays`, `basedOn`, `sampleDays`, `coverage`, `growthSessionsPerDay`, `centralThresholdAt`, `earliestThresholdAt`, `latestThresholdAt`, `confidence`, `reasonUnavailable`, `bottleneck`, `policyVersion`, `calculatedAt`.

### CapacityScenario

Entrada validada: `newCustomers` inteiro 0–10.000, `horizonMonths` 1–36, `activationPercent` 0–100, `stagingExpectedOn` boolean opcional. Saída: `projectedSessions`, `headroomOrDeficit`, `incrementalMemoryMb`, `bottleneck`, `recommendedBy`, `assumptions`; nunca é salva nem dispara efeito.

## 8. Fonte/componente embutidos

`sourcesJson` contém somente `{name,status,observedAt,ageSeconds,errorCode}`. `componentsJson` contém `{key,environment,status,pid?,uptimeSeconds?,restartCount?,cpuPercent?,rssMb?,count?}`. Não persiste argumentos, caminhos completos ou stdout/stderr.
