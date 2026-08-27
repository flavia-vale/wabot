# Contract — coletor interno de capacidade

## `collectCapacitySnapshot(options)`

Superfície interna chamada pelo sweep da API e pelo refresh manual autorizado.

```text
collectCapacitySnapshot({
  now,
  db,
  fs,
  os,
  statfs,
  execFile,
  fetch,
  env,
  logger,
  timeoutMs
}) -> Promise<CollectionResult>
```

`CollectionResult`:

```json
{
  "snapshot": {},
  "sources": [
    { "name": "host", "status": "ok", "observedAt": "...", "errorCode": null },
    { "name": "processes", "status": "unavailable", "observedAt": "...", "errorCode": "PM2_TIMEOUT" }
  ],
  "alertsEvaluated": true,
  "durationMs": 42
}
```

## Invariantes

- Nunca inclui env, token, cmdline integral, stdout/stderr ou dados pessoais.
- Cada adaptador retorna `null` para campo desconhecido; não converte falha em zero.
- Uma fonte falhar não rejeita o resultado das demais; apenas falha de persistência impede publicar um snapshot como recente.
- Há no máximo uma coleta em andamento por processo. Nova chamada durante coleta devolve o último snapshot com `refreshInProgress=true`.
- Timeout default global ≤10 s; PM2 e Hetzner têm timeouts menores e independentes.
- `pm2` é chamado via `execFile(PM2_BIN, ['jlist'])`, sem shell.
- Hetzner aceita somente método GET e endpoints definidos no cliente; refresh externo respeita TTL de 6 h mesmo quando o polling do dashboard é de 30 s.
- A passada periódica não lança ao timer; loga código seguro e mantém a API ativa.

## Worker válido

Um PID é contado quando `/proc/<pid>/cmdline` contém um executável Node e um argumento de script cujo caminho normalizado é exatamente um dos roots allowlisted mais `/src/bot-worker.js`. Processos que apenas contêm essa string em regex/comando/coleta são excluídos.

## Deltas cumulativos

CPU e `pswpin/pswpout` usam amostra anterior monotônica. Após reboot, PID/boot-id novo, contador menor ou primeira amostra, os rates ficam `null` em vez de negativos.

## Sweep

```text
boot best-effort -> interval 5 min com unref
  collect -> persist raw -> upsert rollups -> evaluate alerts -> retention best-effort
```

Rollup/retention podem falhar sem invalidar o raw já salvo. Alertas nunca executam ações operacionais.
