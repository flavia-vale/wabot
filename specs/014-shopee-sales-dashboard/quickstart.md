# Quickstart: validar o painel de vendas da Shopee

## Pré-requisitos

- Branch da feature baseada em `develop`.
- Node/npm instalados e dependências do root/dashboard disponíveis.
- Banco de teste ou staging com credencial Shopee válida e cifrada.
- Nunca colar `appId`, `secretKey`, pedido bruto ou saída de `--show-sample` em tickets.

## 1. Verificações automatizadas

```bash
node --test test/shopee-sales-service.test.js test/shopee-sales-route.test.js test/painel-vendas.test.js
node --test test/shopee-conversion-report-probe.test.js test/converters-shopee.test.js
cd dashboard && npm run lint && npm run build
```

Esperado: atribuição por prefixo, dedupe, finanças, estados desconhecidos, isolamento, erros e
posição do menu passam; build do Next 16.2.4 conclui sem regressão.

## 2. Validar o contrato da API localmente

Com API/dashboard locais e uma sessão de teste, chamar pelo próprio painel/proxy:

```text
GET /api/shopee-sales?from=2026-08-21&to=2026-08-27&orderPage=1&productPage=1&limit=20&timeZone=America%2FSao_Paulo
```

Comparar a forma com `contracts/shopee-sales.openapi.yaml`. Confirmar:

1. resposta não inclui `secretKey`, `appId`, `userId` nem dados de comprador;
2. somente `utmContent` iniciado por `espelhagrupos` entra no snapshot;
3. `PENDING`, `UNPAID` e desconhecidos não viram comissão confirmada;
4. falha/timeout retorna código explícito, não totais zerados;
5. intervalo acima de 30 dias retorna `INVALID_PERIOD`.

## 3. Validação manual em staging

Após merge em `develop` e autodeploy, usar `http://178.105.54.0:3006`:

1. entrar com a conta de teste;
2. confirmar **Vendas** imediatamente abaixo de **Painel**;
3. abrir Vendas e comparar 7 dias com o relatório/probe read-only;
4. alternar Hoje, 7 dias, 30 dias e intervalo personalizado;
5. paginar pedidos e produtos e conferir que período/filtros permanecem;
6. simular rede indisponível e confirmar que o último snapshot permanece marcado como
   desatualizado com ação **Tentar novamente**;
7. usar conta sem credencial e conta com credencial recusada para conferir mensagens distintas;
8. em viewport móvel, verificar cards, filtros e tabelas roláveis/legíveis;
9. confirmar que qualquer horário de clique diz “clique que resultou nesta compra” e que não há
   total de cliques/taxa de conversão.

## 4. Regressão operacional

Não há migration, alteração de `.env`, reinício manual de supervisor ou cutover. Confirmar que:

- geração de short link Shopee continua enviando `espelhagrupos` sem mudança;
- envio manual/automático e sessões WhatsApp seguem funcionando;
- navegar nas demais páginas do painel mantém destinos e ordem, exceto a inserção aditiva de
  Vendas;
- abrir Vendas não grava Credential, MessageLog ou qualquer tabela.

## 5. Evidência visual

Como a mudança é perceptível, capturar screenshots desktop e móvel da tela em staging com dados
de teste anonimizados, incluindo estado de sucesso e ao menos um estado vazio/erro seguro.

## Resultado da implementação (2026-08-27)

- Pipeline aditivo implementado em `src/shopeeSales/`, com query explícita, janelas de sete dias, paginação e limites defensivos.
- Endpoint autenticado `GET /api/shopee-sales` não expõe credenciais, usuário, comprador nem payload bruto.
- `/painel/vendas` inclui filtros, KPIs, estados conservadores, tabelas, paginação, retry e aviso sobre cliques convertidos.
- Status conhecidos: `PENDING`, `UNPAID`, `COMPLETED`/`CONFIRMED`/`APPROVED`, `CANCELLED`/`CANCELED` e `REFUNDED`; valores novos ficam não classificados.
- Testes focados, ESLint e build de produção passaram.
- Validação visual autenticada em staging e evidências permanecem pendentes até a branch ser implantada em `http://178.105.54.0:3006`.
- O handoff operacional, nomes esperados das evidências e checklist de
  anonimização estão em `evidence/README.md`. A execução real permanece como
  gate de aceite pós-merge em `develop`, não como tarefa de implementação
  pré-merge.

## Review remediation verification

The focused test, lint, and production-build commands above are the canonical
current verification. They must be rerun after report-contract or UI changes;
a historical successful run is never a substitute for current output.

### Test harness note

The repository environment cannot download a DOM/component renderer (the npm registry returns HTTP 403). The dashboard lifecycle is therefore extracted into `salesLifecycle.js`, consumed directly by `SalesDashboard`, and exercised through dependency-free executable `node:test` action sequences. Only navigation order remains a static source guard.
