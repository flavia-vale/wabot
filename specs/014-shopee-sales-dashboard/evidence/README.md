# Evidências de aceitação em staging

Esta pasta é o ponto de entrega para a validação **pós-merge em `develop`**. As
capturas não são produzidas durante a implementação porque o fluxo canônico só
implanta staging depois do merge. Nenhuma imagem foi fabricada ou capturada de
um ambiente sem esta feature.

## Gate operacional pós-merge

1. Aguarde o workflow de deploy de `develop` finalizar.
2. Acesse `http://178.105.54.0:3006` com uma conta de staging autorizada.
3. Confirme no desktop e em viewport móvel:
   - **Vendas** imediatamente abaixo de **Painel**;
   - carregamento dos filtros e quatro KPIs;
   - período de hoje, 7 dias, 30 dias e intervalo personalizado;
   - paginação independente de pedidos e produtos;
   - texto sobre “clique que resultou nesta compra” e a limitação de cobertura.
4. Registre uma captura anonimizada do caso com resultado em
   `success-desktop.png` e `success-mobile.png`.
5. Valide uma conta/período sem vendas atribuídas e registre
   `empty-desktop.png`.
6. Valide uma conta sem credencial Shopee (ou fixture segura equivalente) e
   registre `credential-error-desktop.png`.
7. Antes de salvar, confira que nenhuma captura contém App ID, chave secreta,
   identificador de comprador ou outro dado pessoal.

O aceite operacional só deve ser anotado após a execução real desses passos. A
ausência atual dos PNGs é intencional e não bloqueia o término da implementação.

## Rendered lifecycle acceptance (required after merge)

The pre-merge environment has no Chromium, DOM implementation, or React test renderer, and the package registry rejects those test dependencies with HTTP 403. Pre-merge coverage therefore executes the production-consumed `salesLifecycle.js` reducer/controller through `node:test`; it does not claim to mount React.

After merge and automatic staging deployment, manually exercise the rendered page at `http://178.105.54.0:3006/painel/vendas`: initial and refresh loading, successful and empty snapshots, all five stable error messages and retry, stale timestamp preservation, rapid filter changes (abort/out-of-order safety), invalid custom dates, active presets, and independent order/product pagination. Record dated screenshots and the tester/result here before production promotion.
