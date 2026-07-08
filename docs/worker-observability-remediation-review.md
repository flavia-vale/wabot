# Revisão técnica — observabilidade, saúde e remediação de workers após troca de credenciais

Este documento resume o trabalho feito nas Sprints 1, 2 e 3 relacionadas ao incidente em que mensagens Amazon não foram espelhadas porque o worker ativo continuava usando regras/estado antigos após mudanças de credenciais/código.

O objetivo é dar contexto suficiente para outra IA ou pessoa revisar o PR com rapidez: **o que foi construído, onde foi construído, como funciona, por que existe e quais pontos merecem atenção na revisão**.

---

## 1. Contexto do problema

Durante a investigação em produção, a evidência principal foi:

- O usuário `flavia.vale@usp.br` tinha credencial Amazon salva com `tag` e `cookie` completo.
- O banco mostrava falhas de conversão com erro legado: `Credenciais de Amazon ausentes ou incompletas: ubid-acbbr, at-acbbr, x-acbbr`.
- O código atual já aceitava o `cookie` completo como suficiente para Amazon.
- O worker da usuária havia sido iniciado muito antes, pelo `bot-supervisor`, e podia permanecer vivo entre deploys.

Conclusão operacional: não bastava salvar a credencial ou recarregar config; era necessário **saber se o worker ativo estava rodando código/regras compatíveis** e, quando não estivesse, **reciclar o worker stale**.

---

## 2. Objetivos das Sprints

### Sprint 1 — Observabilidade e reload confiável

Objetivos:

1. Fazer o endpoint de credenciais aguardar o resultado real de `reloadConfig`.
2. Expor metadados seguros do worker em `metrics`.
3. Melhorar logs do supervisor ao receber `RELOAD_CONFIG`.

### Sprint 2 — Classificação de saúde do worker

Objetivos:

1. Classificar o worker como `ok`, `stale` ou `unknown` com base nos metadados de métricas.
2. Detectar worker antigo sem metadados.
3. Detectar mismatch de versão de regra de credenciais.
4. Retornar essa saúde no save de credenciais.

### Sprint 3 — Remediação automática

Objetivos:

1. Quando uma credencial Amazon for salva e o worker estiver stale, tentar reiniciar o worker.
2. Evitar start concorrente antes do worker antigo realmente liberar o slot.
3. Retornar ao chamador o resultado da tentativa de remediação.

---

## 3. Mapa dos arquivos criados/alterados

### 3.1 `src/workerMetadata.js`

**Responsabilidade:** gerar metadados seguros sobre o worker ativo.

Principais exports:

- `CREDENTIAL_RULES_VERSION`
- `buildWorkerMetadata()`

Campos gerados:

- `userId`
- `pid`
- `ppid`
- `startedAt`
- `gitSha`
- `cwd`
- `nodeVersion`
- `credentialRulesVersion`

Por que existe:

- Permite diferenciar worker atual de worker antigo.
- Permite diagnosticar workers vivos que sobreviveram a deploys.
- Evita depender somente de `pm2`, `ps` ou logs rotacionados.

Ponto de revisão:

- Confirmar se `CREDENTIAL_RULES_VERSION = 'amazon-cookie-complete-v1'` é o nome certo para a regra atual.
- Confirmar se novos ajustes de regra Amazon devem incrementar essa constante.

---

### 3.2 `src/bot-worker.js`

**Responsabilidade da alteração:** anexar metadados do worker na resposta de métricas.

O worker agora:

1. Importa `buildWorkerMetadata`.
2. Captura `WORKER_STARTED_AT` no boot.
3. Constrói `workerMetadata` uma vez.
4. Inclui `worker: workerMetadata` no payload de `metricsResult`.

Por que existe:

- `getBotMetrics(userId)` passa a informar qual worker está rodando.
- O endpoint de credenciais consegue avaliar se o worker está stale.

Ponto de revisão:

- Verificar se o payload de métricas continua compatível com consumidores antigos, já que foi apenas adicionado o campo `worker`.

---

### 3.3 `src/workerHealth.js`

**Responsabilidade:** classificar a saúde/versionamento do worker a partir das métricas.

Função principal:

```js
classifyWorkerHealth(metrics, expectedCredentialRulesVersion = CREDENTIAL_RULES_VERSION)
```

Estados retornados:

#### `unknown`

Quando `metrics` é `null`/ausente.

Exemplo:

```js
{
  status: 'unknown',
  reason: 'metrics_unavailable',
  restartRecommended: false
}
```

#### `stale` por ausência de metadados

Quando há métricas, mas não há `metrics.worker`.

Isso indica worker antigo, anterior à Sprint 1.

```js
{
  status: 'stale',
  reason: 'worker_metadata_missing',
  restartRecommended: true
}
```

#### `stale` por mismatch de regra

Quando `metrics.worker.credentialRulesVersion` difere da versão esperada.

```js
{
  status: 'stale',
  reason: 'credential_rules_version_mismatch',
  restartRecommended: true
}
```

#### `ok`

Quando a versão de regra bate com a esperada.

Por que existe:

- Separar a lógica pura de classificação da rota HTTP.
- Facilitar testes unitários.
- Permitir reuso futuro em `/session/status`, admin ou health checks.

Ponto de revisão:

- Avaliar se `unknown` deveria ou não recomendar restart em algum cenário de produção.
- Hoje `unknown` é conservador e não recomenda restart, porque ausência total de métricas pode significar bot offline ou erro transitório.

---

### 3.4 `src/workerRemediation.js`

**Responsabilidade:** tentar remediar worker stale com stop/start controlado.

Função principal:

```js
restartStaleWorkerIfNeeded({
  userId,
  platform,
  workerHealth,
  stopBot,
  startBot,
  isRunning,
  sleep,
  timeoutMs,
  pollMs,
})
```

Fluxo:

1. Se `workerHealth.restartRecommended` não for verdadeiro, retorna `attempted: false`.
2. Se `platform !== 'amazon'`, retorna `attempted: false`.
3. Chama `stopBot(userId)`.
4. Se não havia worker para parar, tenta `startBot(userId)`.
5. Se havia worker, aguarda `isRunning(userId)` virar falso.
6. Só depois chama `startBot(userId)`.
7. Se o worker antigo não sair dentro do timeout, não chama `startBot`, para evitar dois workers simultâneos para o mesmo `userId`.

Retornos principais:

- `worker_current`
- `platform_not_remediated`
- `stale_worker_start_attempted`
- `stale_worker_restarted`
- `stale_worker_stop_timeout`

Por que existe:

- `reloadConfig` atualiza config em memória, mas não atualiza o código carregado pelo processo Node já vivo.
- Se o worker antigo ainda exige cookies legados da Amazon, só reiniciar o worker carrega o código novo.
- A espera por `isRunning=false` evita sobreposição de dois sockets Baileys para a mesma sessão.

Pontos de revisão:

- Confirmar se a remediação deve ficar restrita a `platform === 'amazon'` ou ser generalizada no futuro.
- Confirmar se os defaults são adequados:
  - `WORKER_STALE_RESTART_WAIT_MS`, default `12000`.
  - `WORKER_STALE_RESTART_POLL_MS`, default `250`.
- Avaliar UX: reiniciar worker pode causar breve reconexão do WhatsApp; hoje isso só acontece quando o worker está stale e a credencial Amazon foi salva.

---

### 3.5 `src/api/routes/credentials.js`

**Responsabilidade da alteração:** transformar o save de credenciais em ponto de verificação e remediação.

Antes:

- Salvava credencial.
- Chamava `reloadConfig` de forma best-effort/síncrona simples.
- Retornava a credencial salva.

Agora:

1. Salva a credencial normalmente.
2. Aguarda `reloadConfig(req.user.sub)`.
3. Captura `configReloaded` e `configReloadError`.
4. Busca `getBotMetrics(req.user.sub)`.
5. Captura `workerMetricsError` se houver erro.
6. Calcula `workerHealth = classifyWorkerHealth(workerMetrics)`.
7. Chama `restartStaleWorker({ userId, platform, workerHealth })`.
8. Captura `workerRestart` e `workerRestartError`.
9. Loga tudo em um único `app.log.info`.
10. Retorna no payload:
    - `configReloaded`
    - `configReloadError`
    - `workerHealth`
    - `workerMetricsError`
    - `workerRestart`
    - `workerRestartError`

Dependências injetáveis:

- `reloadConfig`
- `getBotMetrics`
- `restartStaleWorker`

Por que injetar dependências:

- Facilita testes sem Redis, PM2 ou workers reais.
- Evita que testes de rota forkem bot-workers acidentalmente.
- Mantém produção usando o `manager.js` por default.

Pontos de revisão:

- Garantir que o endpoint continua salvando credencial mesmo quando reload, métricas ou restart falham.
- Garantir que `workerRestartError` não quebra o save.
- Avaliar se o payload público do endpoint pode expor `pid`, `cwd` ou `nodeVersion` via `workerHealth`. Hoje `workerHealth` só expõe versões/reason/status, não o objeto `worker` completo.

---

### 3.6 `src/supervisor/commandHandlers.js`

**Responsabilidade:** centralizar a lógica do comando remoto `RELOAD_CONFIG`.

Função principal:

```js
createReloadConfigHandler({ belongsToThisShard, sessionCore, logger })
```

Comportamento:

- Se o usuário não pertence ao shard, loga warn e retorna `false`.
- Se pertence, chama `sessionCore.reloadConfig(userId)`.
- Loga info quando aplicou.
- Loga warn quando não há worker ativo.

Por que existe:

- Antes a lógica era inline no map de comandos do supervisor.
- Separar em módulo facilita teste unitário.
- Logs deixam claro se o reload falhou por shard errado ou worker ausente.

Ponto de revisão:

- Confirmar se `false` é o contrato desejado para shard miss e worker ausente.

---

### 3.7 `src/supervisor/index.js`

**Responsabilidade da alteração:** usar o novo handler no comando `COMMAND.RELOAD_CONFIG`.

Antes:

```js
[COMMAND.RELOAD_CONFIG]: ({ userId }) => belongsToThisShard(userId) ? sessionCore.reloadConfig(userId) : false
```

Agora:

```js
[COMMAND.RELOAD_CONFIG]: createReloadConfigHandler({ belongsToThisShard, sessionCore, logger })
```

Por que existe:

- Reuso da lógica testável.
- Logs estruturados.

---

## 4. Testes adicionados

### 4.1 `test/sprint1-worker-observability.test.js`

Cobre:

- `buildWorkerMetadata` gerando campos esperados.
- `PUT /credentials/:platform` aguardando `reloadConfig` assíncrono.
- `PUT /credentials/:platform` preservando credencial quando `reloadConfig` falha.
- `createReloadConfigHandler` logando:
  - reload aplicado,
  - worker ausente,
  - usuário fora do shard.

Ponto de revisão:

- Esses testes usam injeção de dependência para evitar chamar manager/supervisor reais.

---

### 4.2 `test/sprint2-worker-health.test.js`

Cobre:

- Worker sem `metrics.worker` classificado como stale.
- Worker com `credentialRulesVersion` antiga classificado como stale.
- Worker com versão atual classificado como ok.
- `PUT /credentials/:platform` retornando `workerHealth` stale quando o worker ativo ainda é código antigo.

Ajuste importante:

- O helper do teste injeta `restartStaleWorker` no-op para não acionar a remediação real da Sprint 3 durante testes da Sprint 2.

---

### 4.3 `test/sprint3-worker-remediation.test.js`

Cobre:

- `restartStaleWorkerIfNeeded` não toca em worker quando health é ok.
- `restartStaleWorkerIfNeeded` para worker Amazon stale, espera `isRunning=false` e inicia novo worker.
- `PUT /credentials/:platform` chama remediação quando detecta mismatch e retorna `workerRestart`.

Ponto de revisão:

- O teste injeta `sleep` fake para não aguardar tempo real.
- O teste injeta `stopBot`, `startBot` e `isRunning` fake para não forkarem processos reais.

---

## 5. Contratos novos de resposta da API

Endpoint:

```http
PUT /credentials/:platform
```

Novos campos no JSON:

```json
{
  "configReloaded": true,
  "configReloadError": null,
  "workerHealth": {
    "status": "ok | stale | unknown",
    "reason": null,
    "expectedCredentialRulesVersion": "amazon-cookie-complete-v1",
    "actualCredentialRulesVersion": "amazon-cookie-complete-v1",
    "restartRecommended": false
  },
  "workerMetricsError": null,
  "workerRestart": {
    "attempted": false,
    "reason": "worker_current"
  },
  "workerRestartError": null
}
```

Exemplo para worker stale remediado:

```json
{
  "workerHealth": {
    "status": "stale",
    "reason": "credential_rules_version_mismatch",
    "expectedCredentialRulesVersion": "amazon-cookie-complete-v1",
    "actualCredentialRulesVersion": "legacy-amazon-cookies-v0",
    "restartRecommended": true
  },
  "workerRestart": {
    "attempted": true,
    "reason": "stale_worker_restarted",
    "stopped": true,
    "started": true,
    "timedOutWaitingStop": false
  }
}
```

---

## 6. Por que a solução foi construída assim

### 6.1 Por que não apenas `reloadConfig`?

Porque `reloadConfig` atualiza configuração em memória, mas não troca o código JS carregado no processo Node.

Se o worker vivo foi forkado antes de um deploy que mudou a validação da Amazon, ele pode continuar executando regra antiga até ser reiniciado.

### 6.2 Por que expor metadados do worker?

Sem metadados, a API não sabe se o worker está:

- rodando código antigo,
- rodando código novo,
- sem métricas,
- ou apenas com config antiga.

A identificação por `credentialRulesVersion` torna essa decisão objetiva.

### 6.3 Por que remediar só Amazon?

A causa investigada era específica da mudança de regra Amazon: cookie completo passou a ser suficiente, enquanto workers antigos ainda exigiam `ubid-acbbr`, `at-acbbr`, `x-acbbr`.

O código foi escrito de forma extensível, mas o restart automático está limitado a `platform === 'amazon'` para reduzir impacto operacional.

### 6.4 Por que esperar `isRunning=false` antes de `startBot`?

O core tem uma proteção importante: o slot de worker só é liberado no `exit` do processo.

Começar um novo worker enquanto o antigo ainda está vivo pode criar dois sockets Baileys para o mesmo `userId`, o que aumenta risco de conflito/reconnect loop.

---

## 7. Riscos e pontos para a próxima IA revisar

1. **Risco operacional de restart automático**
   - Reiniciar worker pode causar breve reconexão do WhatsApp.
   - Revisar se isso é aceitável sempre que salvar credenciais Amazon.

2. **Timeout de parada**
   - Se `stopBot` não liberar o slot dentro de `WORKER_STALE_RESTART_WAIT_MS`, a remediação não chama `startBot`.
   - Isso é seguro contra duplicidade, mas pode deixar o worker antigo até o health monitor agir.

3. **Sem retentativa automática após timeout**
   - Hoje a resposta indica `stale_worker_stop_timeout`.
   - Uma melhoria futura seria agendar retry assíncrono ou emitir evento operacional.

4. **Não há UI dedicada ainda**
   - O endpoint retorna os campos, mas a interface pode ainda não mostrar um alerta amigável.
   - Próximo passo de produto: exibir mensagem quando `workerHealth.status === 'stale'` ou `workerRestart.attempted === true`.

5. **Versionamento manual**
   - `CREDENTIAL_RULES_VERSION` precisa ser incrementado manualmente quando a semântica de validação/conversão mudar.
   - Se esquecer de incrementar, a detecção de stale perde força.

6. **Escopo limitado a Amazon**
   - Se Shopee/ML tiverem mudança semelhante no futuro, será necessário ampliar a política de remediação.

7. **Cobertura de testes source-regex existente**
   - A suíte completa do repo continua falhando em testes legados/baseados em regex de fonte que não foram tocados por esta mudança.
   - Os testes focados das Sprints passam.

---

## 8. Comandos de teste usados

### Testes focados

```bash
rm -f /tmp/wabot-test.db /tmp/wabot-test.db-wal /tmp/wabot-test.db-shm && \
NODE_ENV=test DATABASE_URL="file:/tmp/wabot-test.db" npx prisma db push --skip-generate --force-reset >/tmp/prisma_push.log && \
NODE_ENV=test DB_SKIP_PRAGMAS=1 DATABASE_URL="file:/tmp/wabot-test.db" node --test --test-concurrency=1 \
  test/sprint1-worker-observability.test.js \
  test/sprint2-worker-health.test.js \
  test/sprint3-worker-remediation.test.js \
  test/supervisor-client.test.js \
  test/credential-health-amazon.test.js
```

### Typecheck e diff check

```bash
npm run typecheck && git diff --check
```

### Suíte completa

```bash
npm test
```

Resultado observado:

- Testes focados passaram.
- Typecheck passou.
- `git diff --check` passou.
- `npm test` falhou em testes já existentes fora do escopo desta mudança, especialmente testes de source/regex em arquivos de dashboard/bot-worker.

---

## 9. Checklist sugerido para revisão

- [ ] Confirmar se `CREDENTIAL_RULES_VERSION` representa corretamente a regra Amazon atual.
- [ ] Confirmar se o payload extra do `PUT /credentials/:platform` é aceitável para o frontend.
- [ ] Confirmar se reiniciar worker automaticamente no save de credencial Amazon é desejado em produção.
- [ ] Confirmar se a espera por `isRunning=false` cobre modo `inline` e `remote` de forma equivalente.
- [ ] Validar se logs têm informação suficiente para debugar:
  - reload aplicado,
  - métricas ausentes,
  - worker stale,
  - restart tentado,
  - timeout de restart.
- [ ] Avaliar se deve haver um `AnalyticsEvent` operacional para `worker_stale_detected` e `worker_stale_restarted`.
- [ ] Avaliar se o dashboard deve mostrar alerta quando `workerRestart.attempted === true`.

---

## 10. Resumo executivo

A mudança transforma o save de credenciais Amazon em um ponto de validação operacional:

1. salva a credencial;
2. recarrega config;
3. consulta métricas do worker;
4. classifica se o worker está atual ou stale;
5. se stale e Amazon, tenta reciclar o worker com segurança;
6. retorna tudo ao chamador.

Isso ataca a causa raiz observada: workers persistentes do `bot-supervisor` podem sobreviver a deploys e continuar rodando regras antigas mesmo após a credencial estar correta no banco.
