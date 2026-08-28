# Feature Specification: Painel de vendas da Shopee

**Feature Branch**: `014-shopee-sales-dashboard`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Adicionar no menu lateral o item Vendas imediatamente abaixo de Painel e criar um painel completo das vendas atribuídas aos links da Shopee gerados pelo robô, sem alterar o comportamento atual."

## Contexto e problema

Hoje o robô já cria links de afiliada da Shopee identificados por `espelhagrupos`, e uma prova
técnica somente leitura confirmou que o relatório autorizado da conta devolve conversões,
pedidos, produtos, estados e comissões. A identificação retorna em `utmContent`, inclusive no
formato observado `espelhagrupos----`. Esses resultados ainda não estão acessíveis no painel.

A pessoa usuária precisa enxergar quanto o robô ajudou a vender sem confundir conversão
pendente com venda confirmada, comissão estimada com comissão recebida, nem o horário do clique
que converteu com uma contagem de todos os cliques. A entrega deve ser aditiva: consultar e
apresentar resultados não pode mudar geração de links, envio de ofertas, sessões do WhatsApp ou
qualquer fluxo atual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver o resultado gerado pelo robô (Priority: P1)

Uma afiliada abre o menu lateral, encontra **Vendas** imediatamente abaixo de **Painel** e vê,
para o período selecionado, quantas compras da Shopee foram atribuídas aos links do robô e qual
é a comissão correspondente.

**Why this priority**: é o valor central da funcionalidade e responde diretamente se o robô
está gerando resultado financeiro.

**Independent Test**: com uma conta que possua conversões próprias e de outras origens, abrir
Vendas e verificar que apenas as conversões identificadas pelo robô alimentam os indicadores
principais.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada, **When** ela vê o menu lateral, **Then** encontra
   **Vendas** imediatamente abaixo de **Painel** e consegue abrir a nova área.
2. **Given** conversões com `utmContent` igual a `espelhagrupos----`, **When** o painel calcula
   os resultados do robô, **Then** elas são reconhecidas porque o valor começa com
   `espelhagrupos`.
3. **Given** conversões com atribuição vazia ou de outra origem, **When** os indicadores do
   robô são calculados, **Then** essas conversões não entram nas compras nem nas comissões do
   robô.
4. **Given** dados disponíveis no período, **When** Vendas é aberta, **Then** a pessoa vê ao
   menos compras atribuídas ao robô, comissão estimada, comissão confirmada quando disponível e
   valor vendido atribuído ao robô.
5. **Given** valores monetários semelhantes em mais de um campo do relatório, **When** o total
   é calculado, **Then** o painel usa uma medida canônica por finalidade e não soma
   representações alternativas nem totais de pedidos com totais de itens.

---

### User Story 2 - Entender situação, pedidos e produtos (Priority: P2)

A afiliada precisa entender por que uma compra ainda não virou comissão confirmada e quais
produtos produziram os resultados, sem precisar consultar dados técnicos.

**Why this priority**: totais isolados podem induzir decisões erradas; estados, pedidos e
produtos tornam os números explicáveis e acionáveis.

**Independent Test**: carregar um conjunto com compras pendentes, não pagas, confirmadas,
canceladas ou reembolsadas disponíveis e conferir resumo, tabelas e linguagem apresentada.

**Acceptance Scenarios**:

1. **Given** conversões em estados diferentes, **When** o painel é exibido, **Then** ele separa
   pendentes, não pagas, confirmadas, canceladas e reembolsadas conforme os estados realmente
   disponibilizados pela fonte.
2. **Given** um estado desconhecido ou recém-criado, **When** ele aparece, **Then** o painel o
   apresenta como não classificado, sem tratá-lo como confirmado.
3. **Given** pedidos atribuídos ao robô, **When** a tabela de pedidos é consultada, **Then** ela
   mostra data, situação, valor e comissão aplicável sem revelar dados pessoais do comprador.
4. **Given** itens atribuídos ao robô, **When** a tabela de produtos é consultada, **Then** ela
   mostra produto, loja, quantidade, valor, situação e comissão aplicável.
5. **Given** uma compra com itens em estados diferentes, **When** os detalhes são exibidos,
   **Then** a diferença permanece visível e o total não é apresentado como inteiramente
   confirmado.

---

### User Story 3 - Explorar períodos e páginas de resultados (Priority: P3)

A afiliada seleciona um intervalo de datas e percorre os resultados para acompanhar evolução e
localizar vendas específicas sem perder o contexto dos indicadores.

**Why this priority**: filtros e paginação transformam uma fotografia pontual em ferramenta de
acompanhamento recorrente.

**Independent Test**: alternar entre períodos predefinidos e um intervalo personalizado com
mais resultados do que cabem em uma página, verificando totais, filtros e navegação.

**Acceptance Scenarios**:

1. **Given** a abertura inicial, **When** nenhum filtro foi escolhido, **Then** o painel usa um
   período recente predefinido e informa claramente suas datas.
2. **Given** os atalhos de período, **When** a pessoa escolhe hoje, 7 dias ou 30 dias, **Then**
   todos os indicadores e tabelas passam a refletir o mesmo intervalo.
3. **Given** um intervalo personalizado válido, **When** ele é aplicado, **Then** o início e o
   fim são exibidos e usados de forma consistente.
4. **Given** mais resultados do que o limite visível, **When** a pessoa avança ou retorna uma
   página, **Then** vê o próximo conjunto sem duplicação ou omissão dentro da sequência.
5. **Given** filtros ativos, **When** a pessoa pagina, **Then** os filtros permanecem aplicados.

---

### User Story 4 - Confiar na atualização e nos limites dos dados (Priority: P4)

A afiliada entende quando os dados foram atualizados, o que fazer quando há falha e qual é o
limite real das métricas de clique.

**Why this priority**: informação financeira sem origem, atualidade e limites explícitos pode
gerar expectativas falsas e chamados de suporte.

**Independent Test**: simular carregamento, ausência de credencial, ausência de conversões,
dados antigos e indisponibilidade temporária, verificando as mensagens e preservação segura da
tela.

**Acceptance Scenarios**:

1. **Given** uma consulta em andamento, **When** Vendas abre, **Then** há estado de carregamento
   que preserva a estrutura visual e impede a leitura de números incompletos como finais.
2. **Given** dados atualizados, **When** são exibidos, **Then** o painel informa a data e hora da
   última atualização bem-sucedida.
3. **Given** nenhuma conversão do robô no período, **When** a consulta termina, **Then** aparece
   um estado vazio explicativo, com indicadores zerados, e não uma mensagem de erro.
4. **Given** credencial ausente ou inválida, **When** a pessoa abre Vendas, **Then** recebe uma
   orientação segura para regularizar a integração, sem exposição de segredo técnico.
5. **Given** indisponibilidade temporária da fonte, **When** a atualização falha, **Then** o
   painel distingue a falha da ausência de vendas, informa que os dados podem estar
   desatualizados e permite tentar novamente.
6. **Given** que `clickTime` existe somente nas conversões retornadas, **When** métricas de
   clique são apresentadas, **Then** elas são descritas apenas como horários de cliques que
   converteram; o painel não afirma total de cliques, cliques sem compra nem taxa de conversão.

### Edge Cases

- `utmContent` começa com `espelhagrupos` em combinação diferente de hífens ou com outros slots
  preenchidos: continua atribuído ao robô; ocorrências no meio de outra etiqueta não contam.
- Uma conversão muda de pendente para confirmada, cancelada ou reembolsada depois da primeira
  leitura: a visão posterior reflete o novo estado sem contar uma nova compra.
- Um pedido contém vários itens: compras/pedidos e itens não são tratados como a mesma unidade,
  e os indicadores deixam clara a unidade contada.
- Valores monetários ausentes: aparecem como indisponíveis onde necessário, nunca como zero
  confirmado por suposição.
- A fonte repete um registro entre páginas ou atualizações: ele não é contado duas vezes.
- O intervalo atravessa mudança de fuso horário: as datas exibidas e os limites usados mantêm o
  mesmo fuso informado à pessoa.
- Há credencial de outra pessoa no sistema: nenhuma existência, venda, produto ou comissão
  dessa conta aparece para a pessoa autenticada.
- Há conversões da conta Shopee provenientes de vídeo, site ou outra campanha sem a etiqueta do
  robô: podem existir na origem, mas não entram nos resultados apresentados como gerados pelo
  robô.
- A pessoa troca de página enquanto uma atualização está em andamento: a navegação continua
  segura e não mistura respostas de filtros diferentes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O menu lateral MUST exibir **Vendas** imediatamente abaixo de **Painel**, mantendo
  os demais itens e destinos existentes inalterados.
- **FR-002**: A área Vendas MUST ser acessível apenas a uma pessoa autenticada e MUST usar
  exclusivamente a credencial Shopee pertencente a essa pessoa.
- **FR-003**: A obtenção de resultados MUST ser somente leitura e MUST NOT gerar links, alterar
  credenciais, pedidos, conversões, sessões, mensagens ou configurações.
- **FR-004**: O sistema MUST classificar como atribuída ao robô somente a conversão cujo
  `utmContent` começa com `espelhagrupos`, incluindo o formato observado
  `espelhagrupos----`.
- **FR-005**: O sistema MUST NOT incluir conversões sem essa atribuição nos indicadores,
  pedidos ou produtos apresentados como resultado do robô.
- **FR-006**: O painel MUST apresentar compras atribuídas, valor vendido, comissão estimada e
  comissão confirmada quando a fonte disponibilizar distinção suficiente.
- **FR-007**: Cada indicador MUST declarar sua unidade e natureza, distinguindo pedidos, itens,
  valores estimados, valores pendentes e valores confirmados.
- **FR-008**: Totais de comissão MUST usar uma única medida apropriada por indicador e MUST NOT
  somar campos alternativos equivalentes nem valores de nível de pedido com valores de nível de
  item.
- **FR-009**: O painel MUST apresentar uma distribuição de estados que reconheça pendente, não
  paga, confirmada, cancelada e reembolsada quando disponíveis, preservando estados
  desconhecidos como não classificados.
- **FR-010**: O painel MUST oferecer uma tabela paginada de pedidos com data, situação, valor e
  comissão aplicável.
- **FR-011**: O painel MUST oferecer uma tabela paginada de produtos com nome, loja, quantidade,
  valor, situação e comissão aplicável.
- **FR-012**: As tabelas MUST NOT exibir dados pessoais do comprador, segredos de credencial ou
  identificadores internos desnecessários.
- **FR-013**: A pessoa MUST poder filtrar todos os indicadores e tabelas por hoje, últimos 7
  dias, últimos 30 dias e intervalo personalizado.
- **FR-014**: O sistema MUST validar intervalos personalizados e explicar como corrigir datas
  inválidas ou fora da janela disponibilizada pela fonte.
- **FR-015**: A paginação MUST preservar período e filtros, evitar duplicidades visíveis e
  informar se há mais resultados.
- **FR-016**: O painel MUST mostrar estados distintos de carregamento, vazio, credencial ausente
  ou inválida, indisponibilidade temporária e sucesso.
- **FR-017**: O painel MUST exibir a data e hora da última atualização bem-sucedida e MUST
  sinalizar explicitamente quando os dados exibidos podem estar desatualizados.
- **FR-018**: Uma falha de atualização MUST NOT ser apresentada como zero vendas e MUST permitir
  nova tentativa sem repetir operações financeiras.
- **FR-019**: O painel MAY mostrar `clickTime` como data ou horário do clique associado a uma
  conversão, mas MUST explicar que ele cobre apenas cliques que aparecem em conversões.
- **FR-020**: O painel MUST NOT exibir ou alegar total de cliques, cliques sem compra ou taxa de
  conversão enquanto essa disponibilidade não tiver sido comprovada.
- **FR-021**: A sincronização MUST aceitar atualização posterior de estados e valores da mesma
  conversão sem duplicá-la.
- **FR-022**: Os resultados de uma pessoa MUST permanecer isolados dos de todas as outras,
  inclusive em totais, estados, filtros, paginação, erros e dados temporariamente exibidos.
- **FR-023**: A entrega MUST NOT alterar o comportamento dos links Shopee já gerados nem dos
  fluxos existentes de conversão, publicação, bot, supervisor, autenticação ou outras áreas do
  painel.
- **FR-024**: A apresentação MUST funcionar nas larguras já suportadas pelo painel, mantendo
  indicadores, filtros e tabelas legíveis e operáveis.

### Key Entities

- **Conversão atribuída ao robô**: ocorrência de compra devolvida pela conta Shopee da pessoa,
  identificada por uma atribuição iniciada em `espelhagrupos`; possui datas, estado e totais de
  comissão, podendo mudar após a primeira leitura.
- **Pedido**: agrupamento comercial dentro de uma conversão, com situação, valores e um ou mais
  itens; não deve ser confundido com a contagem de itens.
- **Item vendido**: produto contido em um pedido, com loja, quantidade, valor, comissão e estado
  próprios quando disponíveis.
- **Resumo de vendas**: agregação das conversões atribuídas no período e filtros selecionados,
  com unidades e natureza financeira explícitas.
- **Atualização de vendas**: resultado de uma leitura autorizada, identificado por momento de
  sucesso, período, paginação e eventual condição de desatualização.
- **Credencial Shopee da pessoa**: autorização já cadastrada que delimita a conta consultada;
  seu conteúdo secreto nunca integra a apresentação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em teste de navegação, 100% das pessoas encontram **Vendas** imediatamente abaixo
  de **Painel** e chegam aos resultados em no máximo dois acionamentos após entrar no produto.
- **SC-002**: Em um conjunto de referência com origens mistas, 100% das conversões cujo
  `utmContent` começa com `espelhagrupos` são incluídas e 100% das demais são excluídas dos
  resultados do robô.
- **SC-003**: Para conjuntos de referência com pedidos de múltiplos itens e campos financeiros
  equivalentes, os totais do painel coincidem integralmente com os valores canônicos esperados,
  sem duplicação de comissão ou contagem.
- **SC-004**: 100% dos estados disponíveis no conjunto de referência aparecem na categoria
  correta ou, quando novos, como não classificados; nenhum estado desconhecido é mostrado como
  confirmado.
- **SC-005**: Uma pessoa consegue selecionar qualquer período oferecido, compreender os quatro
  indicadores principais e localizar um pedido ou produto em até 2 minutos, sem instrução
  externa.
- **SC-006**: Em testes com ao menos duas contas, nenhuma informação comercial, identificador
  desnecessário ou credencial de uma conta aparece na sessão da outra.
- **SC-007**: Carregamento, ausência de dados, credencial inválida e falha temporária são
  corretamente diferenciados em 100% dos cenários de aceitação e sempre informam a próxima ação
  possível.
- **SC-008**: 100% das telas que exibem resultados informam a última atualização bem-sucedida ou
  declaram claramente que ainda não há atualização disponível.
- **SC-009**: Nenhum texto, indicador ou gráfico da entrega afirma medir cliques sem compra,
  total de cliques ou taxa de conversão; referências a clique são explicitamente limitadas a
  conversões.
- **SC-010**: Todos os fluxos preexistentes de geração de links, envio de ofertas, sessões e
  navegação fora de Vendas permanecem aprovados nas verificações de regressão existentes.

## Assumptions

- A primeira versão cobre somente vendas da Shopee atribuídas aos links do robô; outras lojas
  ficam fora do escopo.
- A conta já possui uma credencial Shopee válida cadastrada no produto; Vendas não cria nem
  edita essa credencial.
- O período inicial padrão será os últimos 7 dias, por ser uma janela recente e compreensível;
  o limite efetivo do intervalo personalizado respeitará o que a fonte autorizada aceitar.
- Datas e valores monetários seguirão o padrão de apresentação já adotado para a pessoa no
  painel.
- Comissão confirmada só será exibida como tal quando os estados e valores disponíveis forem
  conclusivos; na dúvida, o valor permanece pendente ou indisponível.
- A identificação atual permite atribuir a compra ao robô como um todo, mas não a um grupo,
  mensagem ou oferta específica. Granularidade adicional de atribuição fica fora desta feature.
- Esta feature não comprova nem introduz medição de cliques sem conversão.

## Out of Scope

- Alterar a etiqueta atual, adicionar novos identificadores aos links ou atribuir vendas por
  grupo, mensagem ou campanha.
- Criar um redirecionador próprio ou qualquer mecanismo novo de rastreamento de cliques.
- Exibir total de cliques, cliques sem compra ou taxa clique-compra.
- Modificar, cancelar, confirmar ou reconciliar pedidos e comissões na Shopee.
- Editar credenciais Shopee dentro de Vendas.
- Incluir Mercado Livre, Amazon, SHEIN ou outras lojas nesta primeira entrega.
- Enviar alertas, e-mails ou notificações de venda.

## Dependencies

- Disponibilidade do relatório autorizado de conversões para a credencial Shopee da pessoa.
- Permanência do identificador `espelhagrupos` nos links atuais e sua devolução no campo de
  atribuição do relatório.
- Mapeamento verificável dos estados e valores financeiros realmente disponibilizados pela
  fonte, sem inferir confirmação quando ela não estiver explícita.
