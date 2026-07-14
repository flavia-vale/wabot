# Feature Specification: Investigação e correção da expiração rápida dos cookies do Mercado Livre

**Feature Branch**: `005-ml-cookie-expiry`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Hoje os cookies cadastrados para MERCADO LIVRE estão expirando muito rápido. Precisamos entender por que isso está acontecendo e corrigir a causa. Investigar rotação de cookie via Set-Cookie descartada em vez de persistida, sondagem de saúde do painel batendo no ML sem cache, e mapear TODOS os pontos que leem/consomem a credencial ML. Precedente exato: specs/001-amazon-cookie-expiry."

## Contexto e natureza do trabalho

Este documento descreve uma **investigação + correção** (não uma feature nova de produto). As credenciais de afiliado do Mercado Livre (ML) ficam no campo `Credential.data` (cifrado em repouso via D-3 / `encryptCredential`) e envolvem mais de um tipo de segredo — cookie de sessão ML e/ou tokens OAuth — usados para resolver links, gerar links de afiliado e conferir o status da sessão no painel. A cliente relata que precisa recadastrar a credencial do ML com frequência alta demais: a sessão "morre" em horas/poucos dias em vez de durar o período natural esperado.

Existe um **precedente EXATO já resolvido nesta mesma base para a Amazon** (`specs/001-amazon-cookie-expiry`): persistir a rotação do `Set-Cookie` em todos os caminhos de chamada (inclusive o probe do painel) e adicionar cache TTL na sondagem de status. O padrão da Amazon deve ser usado como **referência de abordagem**, mas o mecanismo de sessão/afiliado do ML é **diferente** (cookie ML, tokens OAuth, fluxo de resolução de link próprio), então a investigação deve **confirmar como o ML realmente se comporta** antes de replicar cegamente a solução da Amazon.

O objetivo é: (1) **diagnosticar** por que a credencial do ML expira tão rápido, com evidências e não suposições; (2) **mapear todos os pontos** que leem/consomem a credencial ML e identificar onde uma rotação de sessão devolvida pelo ML seria descartada em vez de persistida; (3) **identificar chamadas de sondagem excessivas/desnecessárias** ao ML (em especial o probe de saúde no painel sem cache); (4) **corrigir** o que estiver acelerando a expiração sob nosso controle — persistindo qualquer rotação de sessão que o ML devolva (com re-encriptação D-3 via `encryptCredential`) e evitando chamadas redundantes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A credencial do Mercado Livre dura o tempo esperado sem recadastro frequente (Priority: P1)

Como afiliada que cadastrou a credencial do Mercado Livre uma vez, quero que ela continue válida pelo período natural de vida da sessão do ML, sem precisar recapturar e recolar cookie/tokens a cada poucas horas ou dias, para que minhas ofertas de links do ML continuem saindo com a comissão preservada e o painel continue lendo título/preço/imagem sem manutenção manual constante.

**Why this priority**: É a dor relatada pela cliente e o resultado final da investigação. Sem isso, o produto quebra a promessa de "cadastra uma vez e roda liso" e gera trabalho manual recorrente + janelas em que as ofertas do ML perdem comissão ou o painel mostra "não conseguimos ler título e preço desse link".

**Independent Test**: Cadastrar uma credencial ML válida, exercitar o fluxo normal de uso (conversões/resoluções de links ML e aberturas do painel) durante uma janela representativa, e confirmar que a sessão permanece "viva" por um tempo significativamente maior do que o observado hoje, sem recadastro.

**Acceptance Scenarios**:

1. **Given** uma credencial ML válida recém-cadastrada, **When** o sistema faz múltiplas resoluções/conversões de links ML ao longo do tempo, **Then** qualquer cookie/token rotacionado que o ML devolve é persistido (re-encriptado via D-3) e reutilizado na chamada seguinte — a sessão não morre por reenvio de token velho.
2. **Given** uma credencial ML válida, **When** a usuária abre o painel de credenciais várias vezes, **Then** cada abertura NÃO consome/descarta uma rotação de sessão nem acelera a expiração.
3. **Given** uma janela de uso normal representativa, **When** medimos o tempo até a credencial ML precisar de recadastro, **Then** esse tempo é mensuravelmente maior do que o baseline atual reportado.

---

### User Story 2 - Diagnóstico das causas da expiração rápida documentado com evidências (Priority: P1)

Como responsável técnico pela investigação, quero um diagnóstico escrito que confirme (com evidências de código/log) quais mecanismos estão encurtando a vida da sessão do ML e quais são apenas hipóteses descartadas, e que **mapeie todos os pontos** que leem/consomem a credencial ML, para que a correção ataque a causa raiz e não um sintoma.

**Why this priority**: A demanda pede explicitamente "entender por que" e mapear todos os consumidores da credencial antes de corrigir. Sem diagnóstico com evidências e sem o mapa completo dos caminhos, corremos o risco de "consertar" um caminho e deixar outro descartando a rotação.

**Independent Test**: Revisar o documento de diagnóstico e confirmar que (a) cada causa provável tem um veredito (confirmada / descartada / inconclusiva) com evidência associada, e (b) existe uma tabela mapeando cada ponto que lê/consome a credencial ML com a indicação de se persiste ou descarta uma eventual rotação.

**Acceptance Scenarios**:

1. **Given** a lista de causas prováveis (rotação de cookie/token não persistida em algum caminho de chamada, sondagem/probe do painel que consome rotação sem persistir e sem cache, uso concorrente da mesma credencial por múltiplos processos, headers/User-Agent inconsistentes, ausência de cache que gera re-scraping repetido, expiração de token OAuth não renovado), **When** a investigação é concluída, **Then** cada item tem um veredito com evidência.
2. **Given** o conjunto de pontos que leem/consomem a credencial ML (`src/converters/mercadolivre.js`, `src/credentialHealth.js`, `offerEngine`, `offerAutomation`, `bot-worker`, rotas de credenciais e `mlOAuth`), **When** a investigação é concluída, **Then** cada ponto é classificado quanto a se recebe uma rotação de sessão do ML e, em caso positivo, se a persiste (re-encriptada via D-3) ou a descarta.
3. **Given** o mecanismo de sessão do ML difere do da Amazon (cookie ML + tokens OAuth), **When** a investigação avalia se o padrão da Amazon (`specs/001-amazon-cookie-expiry`) se aplica, **Then** o diagnóstico documenta explicitamente quais partes do padrão Amazon valem para o ML e quais não valem (por comportamento diferente de sessão/afiliado).

---

### User Story 3 - Sondagem de saúde da credencial ML no painel deixa de bater no ML a cada abertura (Priority: P2)

Como operadora do sistema, quero que a sondagem de saúde da credencial ML exibida no painel não dispare uma chamada ao ML a cada abertura do painel, reaproveitando um resultado recente dentro de uma janela curta (cache TTL), para não consumir rotações de sessão nem parecer tráfego anômalo capaz de invalidar a sessão mais rápido.

**Why this priority**: A demanda levanta explicitamente a hipótese de que o probe de status/health da credencial ML no painel está batendo no ML a cada abertura, sem cache, acelerando a expiração — exatamente o padrão que já foi corrigido para a Amazon. Depende do diagnóstico da US2 para confirmar que o probe do ML de fato consome rotação, mas a mitigação (cache TTL) é de baixo risco e alto valor.

**Independent Test**: Abrir o painel de credenciais N vezes em poucos minutos e confirmar, via log/contador, que o número de chamadas efetivas ao ML pela sondagem é menor do que hoje (idealmente 1 por janela de cache), sem perda de funcionalidade percebida no status exibido.

**Acceptance Scenarios**:

1. **Given** a usuária abre o painel de credenciais N vezes em poucos minutos, **When** o status da sessão ML é exibido, **Then** o sistema não dispara N sondagens ao ML — a sondagem é servida de um resultado recente em cache dentro de uma janela curta (TTL).
2. **Given** a sondagem de saúde do ML recebe cookies/tokens rotacionados na resposta, **When** a sondagem executa, **Then** essa rotação é persistida (re-encriptada via D-3) e não descartada — ou a sondagem é redesenhada para não consumir rotação.
3. **Given** o mesmo link ML é resolvido/convertido repetidamente em curta janela, **When** as resoluções ocorrem, **Then** chamadas redundantes ao ML são evitadas quando não agregam valor.

---

### Edge Cases

- **Credencial realmente expirada pelo ML (fim de vida natural):** o sistema deve continuar sinalizando "credencial precisa ser renovada" no painel e cair no fallback seguro (sem vazar o link de terceiro / preservando a invariante de comissão) — a correção NÃO deve mascarar expiração legítima como sessão viva.
- **Falha transitória (5xx/rede/timeout) vs. sessão morta (parede de login/anti-bot):** a investigação deve distinguir as duas; uma falha transitória não pode ser contada como expiração nem disparar recadastro/sinalização de "renovar credencial".
- **Rotação com `Set-Cookie` de limpeza (valor vazio):** diretivas que apagam cookie não podem sobrescrever/apagar o cookie/token válido persistido.
- **Token OAuth expirado com refresh disponível:** se o ML usa OAuth com refresh token, a investigação deve determinar se o refresh está sendo feito e persistido; expiração de access token com refresh válido não deve exigir recadastro manual.
- **Persistência concorrente da rotação:** se dois caminhos persistem patches de credencial ao mesmo tempo, o último a escrever não pode reverter para um token/cookie mais velho (risco de "rejuvenescer" a sessão para um estado inválido).
- **Re-encriptação D-3 idempotente:** persistir a rotação deve passar por `encryptCredential` (formato `v1:...`), sem recifrar valor já cifrado e sem gravar segredo em texto puro.
- **Formatos de credencial ML aceitos hoje (cookie ML puro, tokens OAuth, ou combinação):** a correção deve funcionar para todos os formatos já cadastrados sem quebrá-los.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A investigação MUST produzir um diagnóstico escrito que classifique cada causa provável da expiração rápida do ML (ver US2) como confirmada, descartada ou inconclusiva, com evidência associada (trecho de código, caminho de chamada, log ou medição).
- **FR-002**: A investigação MUST entregar um mapa de TODOS os pontos que leem/consomem a credencial ML (`src/converters/mercadolivre.js`, `src/credentialHealth.js`, `offerEngine`, `offerAutomation`, `bot-worker`, rotas de credenciais e `mlOAuth`), indicando para cada ponto se recebe uma rotação de sessão do ML e, em caso positivo, se a persiste ou a descarta.
- **FR-003**: O sistema MUST persistir os cookies/tokens rotacionados que o ML devolve (no `Set-Cookie` ou equivalente da resposta) em **todos** os caminhos de chamada que os recebem, re-encriptando via D-3 (`encryptCredential`), de modo que a próxima chamada use o token fresco e a sessão não morra por reenvio de token velho.
- **FR-004**: A sondagem de status/saúde da credencial ML exibida no painel MUST NOT descartar silenciosamente uma rotação de sessão consumida — ou ela persiste a rotação (re-encriptada via D-3), ou ela não deve consumir rotação (por exemplo, evitando disparar uma chamada que rotacione a sessão a cada carregamento do painel).
- **FR-005**: O sistema MUST evitar chamadas redundantes ao ML (sondagem de sessão e resolução/conversão de link) quando elas não agregam valor, por exemplo servindo o status de sessão de um resultado recente em cache dentro de uma janela curta (TTL configurável), em vez de sondar o ML a cada carregamento do painel.
- **FR-006**: A investigação MUST determinar se a mesma credencial ML é usada concorrentemente por múltiplos processos/caminhos e, se isso for confirmado como causa de invalidação, a correção MUST coordenar/serializar esse uso para evitar rotações conflitantes.
- **FR-007**: As chamadas ao ML feitas pelo sistema MUST usar headers (incluindo User-Agent) consistentes entre si; a investigação MUST verificar e documentar se há inconsistência hoje que possa parecer tráfego anômalo e invalidar a sessão.
- **FR-008**: A correção MUST preservar a distinção entre falha transitória (5xx/rede/timeout) e sessão morta (parede de login/anti-bot) — falhas transitórias não podem ser contabilizadas como expiração nem disparar sinalização de "renovar credencial".
- **FR-009**: Se o ML usa OAuth com refresh token, a investigação MUST determinar se o refresh de access token está sendo feito e persistido (re-encriptado via D-3); a correção MUST renovar e persistir tokens quando aplicável, sem exigir recadastro manual enquanto o refresh for válido.
- **FR-010**: A correção MUST continuar sinalizando corretamente no painel quando a credencial ML está genuinamente expirada e continuar caindo no fallback seguro (invariante de comissão preservada, link de terceiro nunca encaminhado) — sem mascarar expiração legítima.
- **FR-011**: A persistência de rotação MUST ser resiliente a diretivas de limpeza (`Set-Cookie` com valor vazio) e MUST usar `encryptCredential` de forma idempotente — não pode apagar/reverter o token válido já persistido nem gravar segredo em texto puro.
- **FR-012**: A correção MUST funcionar para todos os formatos de credencial ML aceitos hoje (cookie ML, tokens OAuth ou combinação) sem quebrar credenciais já cadastradas.
- **FR-013**: O sistema MUST expor visibilidade operacional suficiente (log ou contador) para medir, antes e depois, quantas chamadas ao ML acontecem (por sondagem e por conversão) e a frequência de expiração/recadastro, permitindo verificar objetivamente a melhoria.

### Key Entities *(include if feature involves data)*

- **Credencial ML (`Credential.data`, platform `mercadolivre`)**: guarda o(s) segredo(s) de sessão do Mercado Livre (cookie ML e/ou tokens OAuth) e dados de afiliado; cifrada em repouso via D-3. É o recurso cuja validade está expirando cedo demais. Pode rotacionar quando o ML devolve `Set-Cookie` ou quando um access token OAuth é renovado.
- **Sessão de afiliada ML (conceitual)**: o estado "viva / expirada / falha transitória" da sessão, derivado das respostas do ML; consumido pelo painel para avisar a usuária e pelo fluxo de conversão para decidir entre link de afiliado e fallback seguro.
- **Rotação de sessão (patch de credencial)**: o conjunto de cookies/tokens atualizados que o ML devolve e que precisa ser persistido (re-encriptado via D-3) para manter a sessão viva ao longo do uso.
- **Sondagem de status (probe)**: a verificação de saúde da sessão ML disparada pelo painel; candidata a consumir rotações sem persisti-las e a bater no ML a cada abertura sem cache.
- **Token OAuth ML (se aplicável)**: access token + refresh token; access token expira mais rápido e deve ser renovado via refresh e persistido, sem exigir recadastro manual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após a correção, o tempo médio até uma credencial ML precisar de recadastro aumenta de forma mensurável em relação ao baseline atual reportado pela cliente (meta: a sessão dura pelo menos o horizonte natural esperado de dias, não horas), medido em uso real ou em janela de teste representativa.
- **SC-002**: 100% dos pontos que recebem uma rotação de sessão do ML passam a persistir essa rotação (re-encriptada via D-3); nenhum caminho descarta rotação silenciosamente, verificável por revisão + teste.
- **SC-003**: Abrir o painel de credenciais repetidamente (por exemplo, 10 vezes em poucos minutos) não gera 10 sondagens efetivas ao ML — o número de chamadas efetivas cai em relação ao comportamento atual (contável em log), idealmente 1 por janela de cache.
- **SC-004**: Nenhuma regressão nos fluxos existentes: links ML válidos continuam sendo resolvidos/convertidos com comissão preservada quando a sessão está viva, e continuam caindo no fallback seguro com aviso de "renovar credencial" quando genuinamente expirada; o link de terceiro nunca é encaminhado.
- **SC-005**: O diagnóstico entrega um veredito (confirmada / descartada / inconclusiva) para cada causa provável listada e um mapa completo dos pontos que consomem a credencial ML — 0 itens sem veredito e 0 pontos sem classificação de persiste/descarta.
- **SC-006**: Falhas transitórias (5xx/rede/timeout) não são mais contabilizadas nem exibidas como "credencial expirada", verificável por teste que simula resposta transitória.
- **SC-007**: Toda persistência de rotação de credencial ML passa por `encryptCredential` (formato `v1:...`), sem gravar segredo em texto puro, verificável por teste db-free/env-free.

## Assumptions

- O baseline de "expira muito rápido" é da ordem de horas a poucos dias hoje; a expectativa natural de uma sessão ML válida é da ordem de dias/semanas. A melhoria será medida contra o comportamento atual observado, mesmo que o valor absoluto de vida útil dependa do próprio ML.
- Parte da vida útil da sessão é controlada exclusivamente pelo ML (política de expiração do lado deles) e está fora do nosso alcance; o escopo desta correção é eliminar tudo que **nós** fazemos que acelera a expiração (não persistir rotação, sondar/converter em excesso, uso concorrente conflitante, headers inconsistentes, OAuth não renovado).
- O padrão de solução da Amazon (`specs/001-amazon-cookie-expiry`) é referência de abordagem, mas o mecanismo de sessão/afiliado do ML é diferente; a investigação confirmará empiricamente o comportamento do ML antes de replicar a solução.
- Já existe mecanismo de persistência de patch de credencial e re-encriptação D-3 (`encryptCredential`); a investigação deve verificar se ele é alcançado em todos os caminhos relevantes do ML (em especial o probe do painel, que pode ler a credencial direto do banco sem carregar o gancho de persistência).
- Os testes seguirão o padrão canônico do projeto: `node:test`, db-free/env-free, com injeção de dependência via `opts` para simular respostas do ML (rotação, expiração, transiente) sem rede real.
- Nenhuma mudança de porta, processo PM2 novo ou aumento significativo de memória é esperada; um cache TTL da sondagem é in-memory de baixo custo, mas se exigir custo de memória relevante isso será sinalizado explicitamente antes de aplicar (política de memória do projeto) e alternativas mais leves serão oferecidas.
- Mudanças de comportamento que alterem semântica de fail-open/fail-closed ou frequência de chamadas serão validadas em staging antes de produção, seguindo o fluxo canônico feature → develop → main.
