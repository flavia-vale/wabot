# Feature Specification: Investigação e correção da expiração rápida dos cookies da Amazon

**Feature Branch**: `001-amazon-cookie-expiry`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Hoje os cookies cadastrados para Amazon estão expirando muito rápido. Entenda o porquê isso está acontecendo. Estamos chamando excessivas vezes desnecessariamente? Entenda as possibilidades. Corrija o que possa estar fazendo os cookies se expirarem tão rápido."

## Contexto e natureza do trabalho

Este documento descreve uma **investigação + correção** (não uma feature nova de produto). As credenciais de afiliado da Amazon (cookie de sessão do SiteStripe) ficam no campo `Credential.data` (cifrado em repouso) e são usadas para gerar o link curto de afiliado (`amzn.to`) via a API `getShortUrl` da Amazon e para conferir o status da sessão no painel. A cliente relata que precisa recadastrar o cookie da Amazon com frequência alta demais — a sessão "morre" em horas/poucos dias em vez de durar as semanas esperadas.

O objetivo é: (1) **diagnosticar** por que a sessão expira tão rápido, com evidências e não suposições; (2) **identificar chamadas excessivas ou desnecessárias** que consomem/invalidam o cookie; (3) **corrigir** o que estiver acelerando a expiração, com critérios de aceitação mensuráveis. A entrega inclui um diagnóstico documentado das causas confirmadas e a correção das causas sob nosso controle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A sessão da Amazon dura o tempo esperado sem recadastro frequente (Priority: P1)

Como afiliada que cadastrou o cookie de sessão da Amazon uma vez, quero que ele continue válido pelo período natural de vida da sessão da Amazon, sem precisar recapturar e recolar o cookie a cada poucas horas ou dias, para que minhas ofertas continuem saindo com o link curto `amzn.to` (comissão preservada) sem manutenção manual constante.

**Why this priority**: É a dor relatada pela cliente e o resultado final da investigação. Sem isso, o produto quebra a promessa de "cadastra uma vez e roda liso" e gera trabalho manual recorrente + janelas em que as ofertas saem sem `amzn.to`.

**Independent Test**: Cadastrar um cookie de sessão válido, exercitar o fluxo normal de uso (conversões de links Amazon e aberturas do painel) durante uma janela representativa, e confirmar que a sessão permanece "viva" (gerando `amzn.to`) por um tempo significativamente maior do que o observado hoje, sem recadastro.

**Acceptance Scenarios**:

1. **Given** um cookie de sessão Amazon válido recém-cadastrado, **When** o sistema faz múltiplas conversões de links Amazon ao longo do tempo, **Then** o token rotacionado que a Amazon devolve é persistido e reutilizado na chamada seguinte (a sessão não morre por reenvio de token velho).
2. **Given** um cookie de sessão Amazon válido, **When** a usuária abre o painel de credenciais várias vezes, **Then** cada abertura NÃO consome/descarta uma rotação de sessão nem acelera a expiração.
3. **Given** uma janela de uso normal representativa, **When** medimos o tempo até a sessão precisar de recadastro, **Then** esse tempo é mensuravelmente maior do que o baseline atual reportado.

---

### User Story 2 - Diagnóstico das causas da expiração rápida documentado com evidências (Priority: P1)

Como responsável técnico pela investigação, quero um diagnóstico escrito que confirme (com evidências de código/log) quais mecanismos estão encurtando a vida da sessão da Amazon e quais são apenas hipóteses descartadas, para que a correção ataque a causa raiz e não um sintoma.

**Why this priority**: A demanda pede explicitamente "entenda o porquê" e "entenda as possibilidades" antes de corrigir. Sem diagnóstico com evidências, corremos o risco de "consertar" o sintoma (mensagem no painel) sem resolver a expiração.

**Independent Test**: Revisar o documento de diagnóstico e confirmar que cada causa provável foi classificada como confirmada, descartada ou não conclusiva, com a evidência correspondente (trecho de código, caminho de chamada, log ou métrica).

**Acceptance Scenarios**:

1. **Given** a lista de causas prováveis (rotação de token não persistida em algum caminho de chamada, chamadas de sondagem/probe que consomem rotação sem persistir, uso concorrente da mesma credencial por múltiplos processos, User-Agent/headers inconsistentes entre chamadas, ausência de cache que gera re-scraping repetido, sondagem do painel a cada carregamento), **When** a investigação é concluída, **Then** cada item tem um veredito (confirmada / descartada / inconclusiva) com evidência.
2. **Given** um caminho de chamada que gera o link curto (`getShortUrl`), **When** ele recebe cookies rotacionados no `Set-Cookie` da resposta, **Then** o diagnóstico documenta se cada caminho persiste ou descarta essa rotação.

---

### User Story 3 - Chamadas excessivas/desnecessárias à Amazon são reduzidas (Priority: P2)

Como operadora do sistema, quero que o sistema não faça chamadas à Amazon (geração de link curto e sondagem de sessão) mais vezes do que o necessário, para reduzir a chance de a Amazon tratar o padrão como anômalo e para não desperdiçar rotações de sessão.

**Why this priority**: A própria demanda levanta "estamos chamando excessivas vezes desnecessariamente?". Reduzir chamadas redundantes ataca diretamente tanto o consumo de rotação quanto o risco de invalidação por comportamento anômalo, mas depende do diagnóstico da US2 para saber quais chamadas cortar.

**Independent Test**: Exercitar aberturas repetidas do painel e conversões repetidas do mesmo link em curta janela e confirmar que o número de chamadas efetivas à Amazon é menor do que hoje (via log/contador), sem perda de funcionalidade percebida.

**Acceptance Scenarios**:

1. **Given** a usuária abre o painel de credenciais N vezes em poucos minutos, **When** o status da sessão Amazon é exibido, **Then** o sistema não dispara N sondagens que consomem rotação de sessão (a sondagem é evitada quando redundante, por exemplo reaproveitando um resultado recente).
2. **Given** o mesmo link Amazon é convertido repetidamente em curta janela, **When** as conversões ocorrem, **Then** chamadas redundantes de geração de link curto são evitadas quando não agregam valor.
3. **Given** múltiplos processos podem processar credenciais da mesma afiliada, **When** eles usam o cookie Amazon, **Then** o diagnóstico confirma se há uso concorrente da mesma sessão e, se confirmado como causa, a correção serializa/coordena esse uso.

---

### Edge Cases

- **Cookie realmente expirado pela Amazon (fim de vida natural):** o sistema deve continuar sinalizando "cookies precisam ser renovados" no painel e cair no fallback `?tag=` (comissão preservada, sem `amzn.to`) — a correção NÃO deve mascarar expiração legítima como se a sessão estivesse viva.
- **Falha transitória (5xx/rede/timeout) vs. sessão morta (parede "Acessar Amazon"):** a investigação deve distinguir as duas; uma falha transitória não pode ser contada como expiração nem disparar recadastro desnecessário.
- **Rotação de token com `Set-Cookie` de limpeza (valor vazio):** diretivas que apagam cookie não podem sobrescrever/apagar o token válido persistido.
- **Persistência concorrente da rotação:** se dois caminhos persistem patches de cookie ao mesmo tempo, o último a escrever não pode reverter para um token mais velho (risco de "rejuvenescer" a sessão para um estado inválido).
- **Credencial no formato legado (3 cookies nomeados) vs. cookie completo:** a correção deve funcionar para ambos os formatos aceitos hoje sem quebrar credenciais já cadastradas.
- **Cookie cadastrado já parcialmente inválido:** o sistema deve reportar isso claramente em vez de entrar em loop de sondagem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A investigação MUST produzir um diagnóstico escrito que classifique cada causa provável da expiração rápida (ver US2) como confirmada, descartada ou inconclusiva, com evidência associada (trecho de código, caminho de chamada, log ou medição).
- **FR-002**: O sistema MUST persistir os cookies rotacionados que a Amazon devolve (no `Set-Cookie` da resposta de geração de link curto) em **todos** os caminhos de chamada que os recebem, de modo que a próxima chamada use o token fresco e a sessão não morra por reenvio de token velho.
- **FR-003**: A sondagem de status da sessão Amazon exibida no painel MUST NOT descartar silenciosamente uma rotação de sessão consumida — ou ela persiste a rotação, ou ela não deve consumir rotação (por exemplo, evitando disparar uma chamada que rotacione a sessão a cada carregamento do painel).
- **FR-004**: O sistema MUST evitar chamadas redundantes à Amazon (geração de link curto e sondagem de sessão) quando elas não agregam valor, por exemplo reaproveitando um resultado recente de status de sessão dentro de uma janela curta, em vez de sondar a cada carregamento do painel.
- **FR-005**: A investigação MUST determinar se a mesma credencial Amazon é usada concorrentemente por múltiplos processos/caminhos e, se isso for confirmado como causa de invalidação, a correção MUST coordenar/serializar esse uso para evitar rotações conflitantes.
- **FR-006**: As chamadas à Amazon feitas pelo sistema MUST usar headers (incluindo User-Agent) consistentes entre si, para não parecer tráfego anômalo capaz de invalidar a sessão; a investigação MUST verificar e documentar se há inconsistência hoje.
- **FR-007**: A correção MUST preservar a distinção entre falha transitória (transient: 5xx/rede/timeout) e sessão morta (parede de login) — falhas transitórias não podem ser contabilizadas como expiração nem disparar sinalização de "renovar cookies".
- **FR-008**: A correção MUST continuar sinalizando corretamente no painel quando a sessão está genuinamente expirada e continuar caindo no fallback `?tag=` (comissão preservada) — sem mascarar expiração legítima.
- **FR-009**: A correção MUST funcionar para os dois formatos de credencial aceitos hoje (cookie completo da sessão e os 3 cookies nomeados legados) sem quebrar credenciais já cadastradas.
- **FR-010**: A persistência de token rotacionado MUST ser resiliente a diretivas de limpeza (`Set-Cookie` com valor vazio) — não pode apagar/reverter o token válido já persistido.
- **FR-011**: O sistema MUST expor visibilidade operacional suficiente (log ou contador) para medir, antes e depois, quantas chamadas à Amazon acontecem e a frequência de expiração/recadastro, permitindo verificar objetivamente a melhoria.

### Key Entities *(include if feature involves data)*

- **Credencial Amazon (`Credential.data`, platform `amazon`)**: guarda o cookie de sessão do SiteStripe (formato completo ou 3 cookies nomeados legados) e a `tag` de afiliada; cifrada em repouso. É o recurso cuja validade está expirando cedo demais. Rotaciona quando a Amazon devolve `Set-Cookie`.
- **Sessão de afiliada Amazon (conceitual)**: o estado "viva / expirada / falha transitória" da sessão, derivado das respostas da Amazon; consumido pelo painel para avisar a usuária e pelo fluxo de conversão para decidir entre `amzn.to` e fallback `?tag=`.
- **Rotação de token (patch de credencial)**: o conjunto de cookies atualizados que a Amazon devolve e que precisa ser persistido para manter a sessão viva ao longo do uso.
- **Sondagem de status (probe)**: a verificação de saúde da sessão disparada pelo painel; candidata a consumir rotações sem persisti-las.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após a correção, o tempo médio até um cookie de sessão Amazon precisar de recadastro aumenta de forma mensurável em relação ao baseline atual reportado pela cliente (meta: a sessão dura pelo menos o horizonte natural esperado de dias, não horas), medido em uso real ou em janela de teste representativa.
- **SC-002**: 100% dos caminhos de chamada que recebem cookies rotacionados da Amazon passam a persistir essa rotação (nenhum caminho descarta rotação silenciosamente), verificável por revisão + teste.
- **SC-003**: Abrir o painel de credenciais repetidamente (por exemplo, 10 vezes em poucos minutos) não gera 10 chamadas que consomem rotação de sessão da Amazon — o número de chamadas efetivas cai em relação ao comportamento atual (contável em log).
- **SC-004**: Nenhuma regressão nos fluxos existentes: ofertas de links Amazon válidos continuam saindo com `amzn.to` quando a sessão está viva, e continuam caindo no fallback `?tag=` com aviso de "renovar cookies" quando genuinamente expirada.
- **SC-005**: O diagnóstico entrega um veredito (confirmada / descartada / inconclusiva) para cada causa provável listada, com evidência — 0 itens sem veredito.
- **SC-006**: Falhas transitórias (5xx/rede/timeout) não são mais contabilizadas nem exibidas como "cookies expirados", verificável por teste que simula resposta transitória.

## Assumptions

- O baseline de "expira muito rápido" é da ordem de horas a poucos dias hoje; a expectativa natural de uma sessão SiteStripe válida é da ordem de semanas. A melhoria será medida contra o comportamento atual observado, mesmo que o valor absoluto de vida útil dependa da própria Amazon.
- Parte da vida útil da sessão é controlada exclusivamente pela Amazon (política de expiração do lado deles) e está fora do nosso alcance; o escopo desta correção é eliminar tudo que **nós** fazemos que acelera a expiração (não persistir rotação, sondar/converter em excesso, uso concorrente conflitante, headers inconsistentes).
- Já existe mecanismo de captura e persistência de cookies rotacionados via patch de credencial; a investigação deve verificar se ele é alcançado em todos os caminhos relevantes (em especial o caminho de sondagem do painel, que lê a credencial direto do banco e pode não carregar o gancho de persistência).
- A captura do cookie pela usuária (via extensão de export ou header cru do DevTools) permanece o método de cadastro; esta investigação não muda a forma de cadastrar, apenas prolonga a validade do que foi cadastrado.
- Nenhuma mudança de porta, processo PM2 novo ou aumento significativo de memória é esperada; se a correção exigir cache/coordenação com custo de memória relevante, isso será sinalizado explicitamente antes de aplicar (política de memória do projeto) e alternativas mais leves serão oferecidas.
- Mudanças de comportamento que alterem semântica de fail-open/fail-closed ou frequência de chamadas serão validadas em staging antes de produção, seguindo o fluxo canônico do projeto.
