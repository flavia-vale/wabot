# Contract — API ADMIN de capacidade

Base: `/api/admin/capacity`. Todas as respostas usam ISO-8601 UTC, campos desconhecidos como `null` e bloco `sources`. GET exige `tech:read`; mutação permitida exige `tech:write` e `AdminAuditLog`.

## GET `/current`

Retorna o último snapshot persistido e a síntese atual. Não dispara Hetzner nem coleta cara.

**200**:

```json
{
  "version": "admin-capacity-v1",
  "snapshot": {
    "collectedAt": "2026-08-27T15:48:40.000Z",
    "ageSeconds": 18,
    "completeness": "complete",
    "host": { "hostname": "wabot-prod", "serverType": "CX33", "architecture": "x86", "vcpu": 4, "memoryTotalMb": 8192, "diskTotalMb": 40960, "region": "eu-central", "source": "provider", "checkedAt": "..." },
    "decision": { "state": "attention", "sessions": 17, "safeLimit": 22, "estimatedMaximum": 25, "headroomSessions": 5, "headroomMemoryMb": 1750, "bottleneck": "memory", "recommendation": "Planejar aumento antes de 22 sessões", "policyVersion": "capacity-policy-v1", "reasons": [] },
    "resources": { "memory": {}, "cpu": {}, "disk": {}, "swap": {} },
    "counts": { "connectedSessions": 17, "activeCustomers": 17, "productionWorkers": 17, "stagingWorkers": 0 },
    "environments": [],
    "components": []
  },
  "forecastSummary": { "windowDays": 30, "centralThresholdAt": null, "range": null, "confidence": "insufficient", "reasonUnavailable": "minimum_history" },
  "activeAlerts": [],
  "sources": [],
  "refreshInProgress": false
}
```

**200 sem snapshot**: `snapshot:null`, estado resumido `insufficient_data`, fontes/diagnóstico; nunca um objeto saudável zerado.  
**403**: sem `tech:read`.

## GET `/history?period=24h|7d|30d|90d`

Retorna série downsampled e eventos. Default `30d`; outro valor dá **400**.

**200**: `{ version, period, granularity: "raw|hour|day", since, until, coverage, points:[{at,memoryAvailableMb,memoryFreeMb,memoryCacheMb,processRssTotalMb,cpuPercent,load1,load5,load15,swapUsedMb,swapInKbPerSec,swapOutKbPerSec,diskUsedMb,diskAvailableMb,diskUsedPercent,inodeUsedPercent,connectedSessions,productionWorkers,safeSessionLimit,state,sampleCount,expectedSampleCount}], events:[{type,occurredAt,severity,title,source}] }`.

Limite de pontos: 600; o servidor escolhe raw/rollup. `30d` usa rollup diário
(30 pontos) para cobrir a janela inteira sem truncar os últimos cinco dias.
`coverage` informa `{pointCount,expectedPoints,ratio,firstPointAt,lastPointAt}`;
começo/fim e lacunas permanecem explícitos. Ausência é `null`, não zero.

## GET `/forecast`

**200**: `{ version, generatedAt, calculatedAt, confidence, centralThresholdAt, range:{earliestAt,latestAt}|null, growth:{"7":{net,monthlyRate,sampleDays},"30":{...},"90":{...}}, adoptedWindowDays, reasonUnavailable, explanation, policyVersion }`.

Sem crescimento positivo/histórico: datas `null` e `reasonUnavailable` explícito.

## GET `/alerts?status=active|recovered&limit=50`

Retorna alertas sanitizados e eventos de recuperação. `limit` inteiro 1–100.

## Inventário e reconciliação em `GET /current`

`snapshot.host.inventory` contém os arrays sanitizados `servers`, `volumes`,
`primaryIps`, `floatingIps`, `loadBalancers`, seus `totals` e, quando
configurados, `quota:{value,source:"manual",checkedAt}` e
`cost:{monthlyEur,source:"manual",checkedAt}`. `inventoryStale`,
`inventoryAgeSeconds` e `inventoryErrorCode` tornam falha/cache explícitos.

`snapshot.reconciliation` usa a forma real
`{observedRssMb,processRssTotalMb,fixedBaseMb,accountedRssMb,unaccountedRssMb,status,unclassifiedComponents}`.
`observedRssMb` é a soma independente e limitada de `VmRSS` em `/proc`; o
contabilizado é a soma classificada de apps/workers, portanto Redis, daemon PM2
e outros processos aparecem de fato em `unaccountedRssMb`. Se `/proc` falhar ou
exceder o limite da varredura, observado/não contabilizado ficam desconhecidos.
`snapshot.divergences` compara todos os pares entre `productionWorkers`,
`connectedSessions` e `activeCustomers`, sem declarar nenhum como correto;
valores desconhecidos são `null`, nunca zero inferido.

## POST `/scenario`

Somente cálculo puro; exige `tech:read`, não audita como mutação operacional e não persiste.

Body:

```json
{ "newCustomers": 10, "horizonMonths": 3, "activationPercent": 90, "stagingExpectedOn": false }
```

**200**: `{ input, baselineAt, projectedSessions, headroomSessions, deficitSessions, incrementalMemoryMb, bottleneck, recommendation, assumptions, policyVersion }`.  
**400**: campo/limite inválido. Nenhuma ação de infraestrutura existe.

## POST `/refresh`

Exige `tech:write`; agenda/tenta uma coleta local sem aguardar Hetzner além do cache e grava `AdminAuditLog` (`admin.capacity.refresh`).

**202**: `{ accepted:true, refreshInProgress:true, requestedAt }`.  
**409**: já existe refresh em andamento; devolve estado sem iniciar outro.  
Nunca aceita URL, comando, server ID ou credencial no body.

## Integração com staging

A UI continua usando `GET/POST /api/admin/staging-power`. A API de capacidade apenas apresenta componentes/sugestão; não duplica nem contorna MFA, `tech:write`, confirmação ou auditoria.

## Segurança do contrato

- Nenhum campo pode conter `HCLOUD_READ_TOKEN`, headers Authorization, env ou cmdline bruto.
- Não existem endpoints de create/delete/rescale/power da Hetzner.
- Erros externos usam códigos seguros (`HCLOUD_TIMEOUT`, `HCLOUD_UNAVAILABLE`) e nunca ecoam corpo/header da resposta.
