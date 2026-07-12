# Contract: `npm run smoke` (CLI-like)

O único "interface" exposto pela feature é o comando npm. Contrato:

## Comando

```bash
npm run smoke
```

## Scripts no `package.json` (a serem adicionados)

```jsonc
{
  "scripts": {
    // presmoke espelha o pretest existente: reset do banco de teste isolado.
    "presmoke": "rm -f /tmp/wabot-test.db /tmp/wabot-test.db-wal /tmp/wabot-test.db-shm; NODE_ENV=test DATABASE_URL=\"file:/tmp/wabot-test.db\" prisma db push --skip-generate --force-reset",

    // smoke: subconjunto curado ENUMERADO EXPLICITAMENTE (não glob).
    "smoke": "NODE_ENV=test DATABASE_URL=\"file:/tmp/wabot-test.db\" node --test --test-concurrency=1 test/reconnect-policy.test.js test/session-persistence-policy.test.js test/supervisor-env-guard.test.js test/ops-mode-regression-guard.test.js test/env-modes.test.js test/message-dedup.test.js test/core/global-dedup.test.js test/core/mirror-dedup-key.test.js test/coupon-dedup-window.test.js test/offer-automation.test.js test/converters-amazon.test.js test/shopee-affiliate-info.test.js test/shopee-shortlink-resolve.test.js test/mercadolivre-resolve.test.js test/mobile-converter.test.js test/send-queue-backend.test.js test/send-queue-backend-dlq.test.js test/credential-crypto.test.js test/auth.test.js test/auth-rate-limit.test.js test/payments-webhook.test.js test/payments-service.test.js test/group-entitlements.test.js test/groups-route-image-mode.test.js test/bot-worker-retry-cache-wiring.test.js test/core/worker-spawn-options.test.js"
  }
}
```

> Observação de implementação (para a fase `tasks`/`implement`): a lista acima é a
> fonte de verdade da curadoria. Manter as chaves `test`/`pretest` **inalteradas**.

## Entradas

- Nenhum argumento. Sem flags. Sem variáveis de ambiente exigidas do usuário
  (o script define `NODE_ENV`/`DATABASE_URL` internamente).

## Saídas / pós-condições

| Situação | Exit code | Observável |
|---|---|---|
| Todos os 26 arquivos passam | `0` | resumo `node:test` com `# fail 0`; verde |
| Qualquer teste do subconjunto falha | `≠ 0` | `node:test` aponta o arquivo/teste que falhou |
| Um arquivo listado não existe (renome/move) | `≠ 0` | `node --test` erra (arquivo não encontrado) — **não** pula em silêncio (FR-007) |

## Invariantes do contrato

- **C-1**: `smoke` NÃO altera comportamento de produção; só executa testes já
  existentes (FR-012).
- **C-2**: `smoke` usa exatamente o mesmo par env/DB do `test`/`pretest`
  (FR-005): `NODE_ENV=test`, `DATABASE_URL=file:/tmp/wabot-test.db`.
- **C-3**: `smoke` roda ~15% dos arquivos → tempo de parede << `npm test`
  (FR-004, SC-002).
- **C-4**: lista **explícita** (não glob) — determinismo e falha visível (D1).
