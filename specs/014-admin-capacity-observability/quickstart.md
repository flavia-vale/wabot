# Quickstart de validação — aba Capacidade

## Pré-requisitos

- Branch da feature baseada em `develop` e dependências instaladas.
- Banco de teste descartável; nunca usar `prisma db push --force-reset` contra staging/prod.
- Para validação externa opcional, token Hetzner **somente leitura** no servidor. Os testes automatizados usam `fetch` injetado e não precisam de token/rede.

## 1. Preparar e validar schema

```bash
cd /workspace/wabot
npm install
NODE_ENV=test DATABASE_URL='file:/tmp/wabot-capacity-test.db' npx prisma migrate deploy
```

Esperado: migration de capacidade aplicada e Prisma gerado sem alterar banco operacional.

## 2. Testes focados do backend

```bash
NODE_ENV=test DATABASE_URL='file:/tmp/wabot-capacity-test.db' node --test --test-concurrency=1 \
  test/ops-capacity-linux-metrics.test.js \
  test/ops-capacity-process-metrics.test.js \
  test/ops-capacity-policy.test.js \
  test/ops-capacity-forecast.test.js \
  test/ops-capacity-alerts.test.js \
  test/ops-capacity-repository.test.js \
  test/admin-capacity-routes.test.js
```

Esperado: fixtures confirmam worker exato (sem contar coletor), `null` em falha, política de 350 MB/p95, forecast sem data artificial, lifecycle/cooldown e permissões.

## 3. Guardas do dashboard

```bash
node --test test/admin-capacity-page.test.js
cd dashboard && npm run lint && npm run build
```

Esperado: rota `/admin/capacidade` existe, só busca ao montar, pausa polling em aba oculta, não expõe segredos, oferece tabela alternativa aos gráficos e o build passa.

## 4. Regressão do repositório

```bash
cd /workspace/wabot
npm test
npm run typecheck
npm run arch:check
git diff --check
```

Esperado: suíte, typecheck, arquitetura e whitespace passam.

## 5. Validação local do contrato

Subir API/dashboard com banco de desenvolvimento e autenticar como admin com `tech:read`:

```bash
npm run api
# outro terminal
npm run dashboard
```

Validar:

1. Abrir `/admin`: nenhuma requisição `/api/admin/capacity/*` ocorre antes de navegar para **Capacidade**.
2. Abrir `/admin/capacidade`: `/current` responde em até 2 s com snapshot recente ou `insufficient_data` explícito.
3. Alternar 24h/7d/30d/90d e conferir unidades, timestamp, fonte e lacunas como lacunas.
4. Ocultar a aba do navegador por >30 s: polling pausa; ao voltar, retoma sem chamadas acumuladas.
5. Simular 10 clientes/3 meses/90%: resultado é consultivo e nenhum processo/registro operacional muda.
6. Usuário sem `tech:read` recebe 403 e não vê a entrada de navegação.

## 6. Cenários de resiliência

Executar testes/fixtures com:

- PM2 timeout e host válido: host continua disponível, processos `unavailable`.
- Hetzner 503: último inventário aparece como stale; local permanece utilizável.
- 795 MB de swap sem `swapOut`: estado informativo, não crítico.
- baixa `MemAvailable` + `swapOut` sustentado: alerta após duas amostras.
- 17 workers e 16 sessões: divergência explícita; limite usa contador conservador.
- staging parcialmente ligado: componentes individuais aparecem; ambiente não é rotulado `off`.
- mudança CX33→host maior: evento `host_changed`, política recalculada somente dali em diante.

## 7. Staging real antes de produção

Após testes, publicar PR contra `develop`, aguardar autodeploy e validar em `http://178.105.54.0:3006`. Confirmar consumo do coletor por 24 h (<1% CPU média, <50 MB adicionais) antes de promover `develop -> main`.

Integração opcional no `.env` do servidor (nunca commit):

```text
HCLOUD_READ_TOKEN=<token somente leitura>
HCLOUD_PROJECT_ID=14422101
HCLOUD_SERVER_ID=128727108
```

Aplicar env segue o procedimento PM2 canônico do ambiente. Não imprimir o token em logs/comandos compartilhados. A ausência das envs deve manter o baseline local e marcar a fonte como `baseline`.

## 8. Smoke de produção somente após staging

Verificações de leitura, sem rescale/restart:

```bash
pm2 status
free -h
df -h /
```

Abrir `/admin/capacidade`, conferir `wabot-prod / CX33 / 4 vCPU / 8 GB / 40 GB`, fontes e idade. A aba não deve apresentar qualquer botão de criar, excluir, desligar ou redimensionar VPS.
