# Contract — Comportamento do modo de imagem após a fixação em `preview`

Contrato de comportamento entre a UI (`/painel/grupos`), a API de grupos e o
pipeline de envio (`bot-worker`). Não é uma API nova; documenta o contrato que os
componentes existentes passam a honrar.

## C-1 — Runtime do pipeline: `imageMode` efetivo = `preview`

- **Dado** um grupo monitorado com `imageMode` persistido qualquer (`preview`,
  `fetch`, `original`, `none`, nulo ou legado),
- **Quando** uma mensagem elegível é espelhada,
- **Então** `resolveGroupEntitlements()` devolve `imageMode: 'preview'` no `cfg`, e
  a oferta sai como **card de preview clicável** (`buildManualLinkPreview` +
  `buildMonitoredMessagePayload({ image: null, useLinkPreview: true })`).
- **Invariante**: nenhum grupo cai nos ramos `fetch`/`original`/`none` em runtime.

## C-2 — API `PUT /api/groups/:id`

- Continua aceitando o campo `imageMode` no body e validando o enum
  `['none','fetch','original','preview']` (código **dormante**, mantido para
  reativação futura). A UI **não envia mais** esse campo.
- **Dado** um `PUT` sem `imageMode`, **Então** o grupo é atualizado sem alterar a
  coluna `imageMode` (comportamento atual: `...(imageMode !== undefined ? {...} : {})`).
- **Contrato de resposta**: inalterado.

## C-3 — Criação de grupo (`POST /api/groups`)

- **Dado** qualquer criação de grupo (monitor ou destino), **Então** o grupo é
  persistido com `imageMode = 'preview'`.
- **Defesa em profundidade**: se algum caminho não passar `imageMode`, o
  `@default("preview")` do schema aplica o mesmo valor.

## C-4 — UI `/painel/grupos`

- **Dado** o cliente expandindo a configuração de um grupo, **Então** o bloco
  "Imagem da oferta" (select + textos auxiliares + avisos `cfg-inline-warn`) **não
  é renderizado**.
- **Dado** o cliente salvando outras configs, **Então** o salvamento funciona e o
  grupo mantém `imageMode = 'preview'`.

## C-5 — Não-regressão (envio / dedup / logs)

- `MessageLog.status`, `MessageLog.errorMsg` (taxonomia de `errorTaxonomy.js`),
  `SendDedupKey`, `dedupHits` e o backend BullMQ/memória: **inalterados**.
- Ofertas automáticas (`src/offerAutomation/`): **inalteradas** (não consomem
  `imageMode`).
- `test/image-scrapers.test.js` e demais suites existentes: **permanecem verdes**
  (código de extração preservado, apenas dormente).
