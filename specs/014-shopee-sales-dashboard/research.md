# Research: Painel de vendas da Shopee

## Decisão 1 — Consultar sob demanda, sem persistir conversões

**Decision**: a rota autenticada consulta o relatório ao abrir/atualizar Vendas e devolve um
snapshot transitório; o navegador preserva em memória o último snapshot bem-sucedido enquanto
uma retentativa acontece.

**Rationale**: cumpre a leitura somente leitura, não exige migration, cron ou processo novo, não
aumenta RAM permanentemente e evita armazenar uma segunda cópia de dados comerciais. Estados e
valores atualizados aparecem na próxima leitura sem duplicação porque o snapshot é reconstruído e
deduplicado pelas chaves da Shopee.

**Alternatives considered**: sincronização periódica persistida (mais atualizações em background,
migration e retenção/LGPD); cache global em memória (risco de mistura entre usuários e consumo
residente); consulta direta do navegador (exporia `secretKey`).

## Decisão 2 — Usar schema explícito comprovado, não introspecção em toda requisição

**Decision**: transformar o resultado da prova em uma query de produção com allowlist explícita
dos campos necessários: datas/IDs técnicos para dedupe, status e totais da conversão, `utmContent`,
pedidos e itens. IDs servem apenas internamente e não são apresentados sem necessidade.

**Rationale**: o probe real confirmou `ConversionReport`, `orders`, `items`,
`estimatedTotalCommission`, `netCommission`, `conversionStatus`, `utmContent` e paginação.
Introspecção dinâmica aumenta latência e superfície de dados, e pode selecionar novos campos
sensíveis automaticamente.

**Alternatives considered**: promover o probe inteiro (descartado por selecionar todo o schema e
ser uma ferramenta diagnóstica); hardcode dos campos planos originalmente presumidos (já provado
incorreto pela API brasileira).

## Decisão 3 — Atribuição por prefixo estrito

**Decision**: normalizar `utmContent` com trim/case-fold e aceitar somente valores que comecem com
`espelhagrupos`; `espelhagrupos----` conta, enquanto texto que contenha a palavra no meio não conta.

**Rationale**: reproduz a evidência real e os requisitos FR-004/FR-005, sem atribuir vendas de
Shopee Video ou outras campanhas da mesma conta.

**Alternatives considered**: `includes` (falso positivo); igualdade literal (perderia o formato
serializado com slots vazios); usar `referrer=Websites` (origem ampla, não identifica o robô).

## Decisão 4 — Finanças canônicas e classificação conservadora

**Decision**: usar uma medida única em cada nível: `actualAmount` dos itens para valor vendido,
`estimatedTotalCommission` no nível da conversão para comissão estimada e `netCommission` apenas
quando o status for conclusivamente confirmado. Nunca somar campos alternativos nem total de
conversão com comissão de item. `PENDING` e `UNPAID` têm categorias próprias; estados terminais
verificados entram em confirmado/cancelado/reembolsado; qualquer valor novo é “não classificado”.

**Rationale**: a amostra mostrou campos financeiros equivalentes com o mesmo total e estados
PENDING/UNPAID. A política evita triplicar comissão e impede promover um estado desconhecido a
confirmado.

**Alternatives considered**: somar todas as propriedades com “commission” (duplicação comprovada);
inferir confirmação por comissão positiva (incorreto para pendentes); usar somente status do item
(perde o estado da conversão/pedido).

## Decisão 5 — Janela limitada e paginação defensiva da origem

**Decision**: aceitar no produto no máximo 30 dias, dividir a leitura em blocos não sobrepostos de
até 7 dias e consumir a paginação/scroll suportada pela operação com limites de páginas, registros
e timeout. Deduplicar por `conversionId`, depois `orderId` e `itemId/modelId`.

**Rationale**: oferece os atalhos aprovados sem uma consulta monolítica e limita custo/latência. A
prova confirmou `pageInfo.scrollId/hasNextPage`; a introspecção do campo raiz deve ser coberta por
fixture de contrato para o argumento de continuidade suportado. Se a origem exceder os limites, a
API retorna erro explícito/incompleto, nunca um total silenciosamente parcial.

**Alternatives considered**: uma chamada de 30 dias (maior risco de timeout); paginação visual
direto na Shopee (não produz totais corretos do período); resultado parcial tratado como completo
(financeiramente enganoso).

## Decisão 6 — Endpoint único e DTO allowlisted

**Decision**: `GET /api/shopee-sales` recebe datas e páginas das duas tabelas e devolve resumo,
distribuição, pedidos, produtos, paginação e metadados da atualização em um único snapshot.

**Rationale**: todos os componentes refletem exatamente a mesma leitura/período, reduz chamadas à
Shopee e facilita manter o último snapshot coerente. `req.user.sub` é a única fonte do usuário.

**Alternatives considered**: endpoint por card/tabela (consultas repetidas e snapshots divergentes);
aceitar `userId` do cliente (falha de isolamento); devolver payload bruto (PII/superfície futura).

## Decisão 7 — Ilha client pequena no App Router

**Decision**: manter `page.js` como Server Component e colocar filtros, fetch autenticado,
retentativa e paginação em `SalesDashboard.js` com `'use client'`; `loading.js` fornece shell de
carregamento e a UI reaproveita classes de `painel.css`.

**Rationale**: a documentação local do Next 16.2.4 orienta Server Components por padrão e Client
Components apenas para estado/eventos/browser APIs. O token atual vive no browser via
`dashboard/lib/api.js`, portanto a chamada autenticada pertence à ilha client.

**Alternatives considered**: tornar toda a árvore client (bundle maior); fetch server direto à API
(não tem acesso ao token em `localStorage` do contrato atual); criar Route Handler Next extra
(proxy já existe e seria duplicação).

## Decisão 8 — Sem métrica de cliques totais

**Decision**: permitir somente a data/hora `clickTime` na linha de uma conversão, acompanhada do
texto “clique que resultou nesta compra”. Não criar KPI/gráfico de cliques ou conversão.

**Rationale**: `conversionReport` comprova cliques convertidos, não cliques sem compra.

**Alternatives considered**: tratar número de conversões como cliques (semântica falsa); ativar o
redirecionador próprio (fora do escopo e alteraria links).
