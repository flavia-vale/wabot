# Feature Specification: Fixar modo de imagem da oferta em "Preview clicável do WhatsApp"

**Feature Branch**: `claude/speckit-flow-image-default-0bdady`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "No caminho /painel/grupos, hoje o cliente escolhe de qual imagem pegar (qual fonte/modo de imagem usar para a oferta espelhada). Essa escolha deve ser REMOVIDA da experiência do cliente, fixando o comportamento no modo default 'Preview clicável do WhatsApp'."

## Contexto do produto

Hoje, na tela `/painel/grupos`, cada grupo monitorado tem um seletor **"Imagem da oferta"** (campo `imageMode` no grupo) com quatro opções:

- `preview` — **Preview clicável do WhatsApp** (card montado pelo bot: só a foto do produto, título e preço no texto; o clique abre o link).
- `fetch` — **Imagem oficial da loja** (busca a foto no site do produto e envia como imagem com legenda).
- `original` — **Imagem que veio na mensagem** (relay da mídia original).
- `none` — **Sem imagem (texto puro)**.

A decisão de negócio é **remover essa escolha do cliente** e fixar o comportamento no modo `preview` ("Preview clicável do WhatsApp") para todos os grupos, novos e existentes. O código que extrai imagens nas outras modalidades (scrapers hi-res de Amazon/ML/Shopee, buffers, relay de mídia original) **não deve ser apagado** — apenas fica dormente/preservado, com comentário claro no código de que a escolha foi desativada da experiência do usuário.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Oferta sempre sai como preview clicável (Priority: P1)

Como cliente que já usa o robô, quero que todas as minhas ofertas espelhadas saiam no formato "Preview clicável do WhatsApp" sem eu precisar configurar nada, para ter um comportamento consistente e sem risco de escolher um modo que gere problemas.

**Why this priority**: É o coração da mudança. Sem isso, a padronização do comportamento de envio não acontece e o objetivo da feature não é atingido. Precisa garantir que envio continua funcionando (invariante canônico do AGENTS.md: "não quebrar envio").

**Independent Test**: Com um grupo monitorado que antes estava em `fetch`/`original`/`none`, disparar uma oferta e confirmar que ela sai como card de preview clicável (foto do produto + texto com título/preço, clique abre o link) — igual ao que hoje só acontece quando `imageMode = preview`.

**Acceptance Scenarios**:

1. **Given** um grupo que antes tinha `imageMode = fetch`, **When** uma mensagem elegível é espelhada, **Then** a oferta sai como preview clicável do WhatsApp (não como imagem com legenda).
2. **Given** um grupo que antes tinha `imageMode = none`, **When** uma mensagem elegível é espelhada, **Then** a oferta sai como preview clicável do WhatsApp (não como texto puro sem card).
3. **Given** um grupo que já estava em `imageMode = preview`, **When** uma mensagem elegível é espelhada, **Then** o comportamento permanece idêntico ao de hoje (nenhuma regressão).

---

### User Story 2 - Migração graciosa dos clientes existentes (Priority: P1)

Como operador do sistema, quero que todos os grupos existentes que não estão em `preview` sejam migrados para `preview` de forma segura (sem perder dados, sem derrubar sessões, sem quebrar envio em vôo), para que a mudança valha para toda a base sem intervenção manual por cliente.

**Why this priority**: A base atual tem grupos em `fetch`, `original`, `none` e o próprio default de schema é `none`. Sem a migração, esses grupos continuariam no comportamento antigo mesmo com o seletor removido da UI. A migração precisa respeitar as pegadinhas de banco do AGENTS.md (WAL, SQLITE_BUSY, backup em prod, passar por staging antes de prod).

**Independent Test**: Rodar a migração em uma base de teste com grupos em todos os quatro modos e confirmar, via consulta ao banco, que todos passam a ter `imageMode = preview` e que nenhuma outra coluna do grupo foi alterada.

**Acceptance Scenarios**:

1. **Given** grupos com `imageMode` em `fetch`, `original`, `none` e valores legados/nulos, **When** a migração roda, **Then** todos passam a `preview` e os que já estavam em `preview` permanecem inalterados.
2. **Given** a migração já rodou uma vez, **When** ela roda novamente, **Then** o resultado é idêntico (idempotente) e nenhum erro é lançado.
3. **Given** um deploy que inclui a migração, **When** o deploy conclui, **Then** o sistema segue funcionando normalmente (login, painel, envio de ofertas) sem indisponibilidade além da janela normal de migração.

---

### User Story 3 - Seletor de imagem some do painel (Priority: P1)

Como cliente, ao abrir a configuração de um grupo em `/painel/grupos`, não quero mais ver a opção "Imagem da oferta" — a escolha deixa de existir na interface, reduzindo confusão e suporte.

**Why this priority**: É a face visível da mudança para o cliente. Sem remover o seletor, o cliente continuaria vendo uma escolha que não tem mais efeito (ou que confunde), gerando tickets de suporte.

**Independent Test**: Abrir a configuração de qualquer grupo no painel e confirmar que o bloco "Imagem da oferta" (seletor `preview`/`fetch`/`original`/`none` e textos auxiliares associados) não aparece mais.

**Acceptance Scenarios**:

1. **Given** um cliente na tela de configuração do grupo, **When** ele expande as configurações, **Then** o seletor "Imagem da oferta" e suas explicações não são exibidos.
2. **Given** o seletor removido, **When** o cliente salva outras configurações do grupo, **Then** o salvamento funciona normalmente e o grupo mantém `imageMode = preview`.

---

### User Story 4 - Novos grupos nascem em preview (Priority: P2)

Como cliente que adiciona um novo grupo monitorado, quero que ele já venha configurado no modo "Preview clicável do WhatsApp" por padrão, sem nenhuma etapa extra.

**Why this priority**: Garante que a padronização se sustenta no tempo, não só para a base atual. Depende de mudar o default de criação de grupo.

**Independent Test**: Criar um novo grupo monitorado (via painel e via qualquer caminho de criação por API) e confirmar que `imageMode` nasce como `preview`.

**Acceptance Scenarios**:

1. **Given** um cliente adicionando um novo grupo monitorado, **When** o grupo é criado, **Then** seu `imageMode` é `preview` sem nenhuma seleção manual.
2. **Given** qualquer caminho de criação de grupo no backend, **When** o grupo é persistido sem `imageMode` explícito, **Then** o valor efetivo é `preview`.

---

### Edge Cases

- **Grupo com `imageMode` nulo ou valor legado desconhecido**: deve ser tratado como qualquer outro não-preview e migrado para `preview`.
- **Envio em vôo durante a migração**: mensagens já enfileiradas não podem ser perdidas nem duplicadas; a migração só troca a configuração de fonte da imagem, não o pipeline de envio.
- **Shopee sem foto oficial**: no modo `preview` o card usa a imagem resolvida pelos scrapers/afiliado; se não houver imagem, o card sai compacto (sem foto), como já acontece hoje no caminho `preview` — nenhuma oferta deve deixar de ser enviada por falta de imagem.
- **Código de extração dormante**: os scrapers hi-res e o relay de mídia original deixam de ser acionados pela escolha do usuário, mas o código permanece no repositório, comentado como desativado — não pode ser removido nem quebrar o build/os testes existentes.
- **Cliente com automações/ofertas automáticas**: o dispatcher de ofertas automáticas continua funcionando; a mudança de `imageMode` não pode alterar dedup, taxonomia de erro nem status de `MessageLog`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST tratar `preview` ("Preview clicável do WhatsApp") como o único modo de imagem efetivo para toda oferta espelhada, independentemente do valor histórico de `imageMode` do grupo.
- **FR-002**: O sistema MUST migrar todos os grupos existentes cujo `imageMode` não seja `preview` (incluindo `fetch`, `original`, `none`, nulos e valores legados) para `preview`, de forma idempotente e sem alterar qualquer outra coluna do grupo.
- **FR-003**: O sistema MUST criar todo novo grupo com `imageMode = preview` por padrão, em todos os caminhos de criação (painel e API).
- **FR-004**: A interface `/painel/grupos` MUST NOT exibir o seletor "Imagem da oferta" nem seus textos auxiliares associados; a escolha deixa de existir na experiência do cliente.
- **FR-005**: O sistema MUST continuar enviando ofertas normalmente após a mudança — nenhuma regressão no pipeline de envio, dedup, taxonomia de erro (`MessageLog.errorMsg`) ou status de `MessageLog`.
- **FR-006**: O sistema MUST preservar (não remover) a lógica de extração das outras fontes de imagem (scrapers hi-res de Amazon/ML/Shopee, download de buffers, relay de mídia original), deixando esse código dormante com comentário claro de que a escolha foi desativada da experiência do usuário nesta mudança.
- **FR-007**: A mudança MUST ser documentada em `AGENTS.md` e/ou em `docs/`, registrando a decisão de fixar o modo `preview`, o motivo, e o fato de o código de extração ficar dormante/preservado.
- **FR-008**: A migração de dados MUST seguir as convenções canônicas do repositório (validação em staging antes de produção, backup de produção antes de rodar, cuidado com SQLITE_BUSY/WAL parando a API quando necessário) e não pode substituir nem apagar dados existentes.
- **FR-009**: O comportamento efetivo `preview` MUST ser aplicado independentemente de eventual valor residual de `imageMode` que escape à migração (defesa em profundidade no pipeline de envio), de modo que nenhum grupo caia em `fetch`/`original`/`none` após a mudança.

### Key Entities *(include if feature involves data)*

- **Grupo monitorado**: entidade de configuração por usuário que hoje carrega o campo `imageMode` (valores `preview`/`fetch`/`original`/`none`). Após a mudança, o valor canônico de todos os grupos passa a ser `preview` e o campo deixa de ser editável pelo cliente.
- **Oferta espelhada**: a mensagem de saída montada a partir de uma mensagem monitorada; seu formato de imagem passa a ser sempre o card de preview clicável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos grupos existentes ficam com `imageMode = preview` após a migração (nenhum grupo em `fetch`/`original`/`none`/nulo).
- **SC-002**: 100% dos grupos criados após a mudança nascem com `imageMode = preview`, sem intervenção manual.
- **SC-003**: 0 grupos exibem o seletor "Imagem da oferta" no painel após a mudança.
- **SC-004**: A taxa de sucesso de envio de ofertas (proporção de `MessageLog.status = success` sobre tentativas elegíveis) não piora em comparação com o período anterior à mudança — nenhuma regressão de envio observável.
- **SC-005**: O código de extração das outras fontes de imagem permanece presente no repositório e a suíte de testes existente (incluindo `test/image-scrapers.test.js`) continua passando.

## Assumptions

- O modo `preview` já existe e é comportamento estável em produção (é a opção "Preview clicável do WhatsApp" atual); a mudança fixa esse comportamento, não cria um novo modo.
- O campo de configuração da fonte de imagem é `imageMode` no grupo (confirmado em `prisma/schema.prisma`, `dashboard/app/painel/grupos/page.js`, `src/bot-worker.js`, `src/monitoredRelayPolicy.js`, `src/api/routes/groups.js`).
- A migração de dados pode ser feita por script versionado idempotente e/ou migration Prisma, seguindo o fluxo canônico do AGENTS.md (feature → develop → staging → main).
- "Não quebrar nada" significa preservar o pipeline de envio, dedup, taxonomia de erro e status de `MessageLog`, além de manter os testes existentes verdes.
- O código dormante de extração de imagem permanece importado/compilável para não quebrar build ou testes, mesmo sem ser acionado pela escolha do usuário.
- A remoção do seletor no painel não exige remover o campo `imageMode` do schema (mantê-lo simplifica a migração graciosa e a defesa em profundidade); a coluna permanece, apenas deixa de ser editável pelo cliente.
