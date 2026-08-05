# Feature Specification: Sequência de e-mail de nutrição de leads (BOTinho)

**Feature Branch**: `011-lead-nurture-emails`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Sequência de e-mail de nutrição de leads. Objetivo: transformar lead frio (quem baixou o lead magnet/checklist ou se cadastrou com e-mail real) em cliente, com uma trilha automática de e-mails ao longo de ~7 dias (ex.: dia 0 entrega/boas-vindas → dia 2 valor/prova → dia 5 convite ao teste grátis → dia 7 ativação). Conteúdo em pt-BR, marca BOTinho. Restrições canônicas OBRIGATÓRIAS (AGENTS.md): timer in-process com passada diária (setInterval + .unref()), sem novo processo/worker/Redis; reaproveitar src/email/mailer.js (no-op sem SMTP, só e-mails reais); LGPD (unsubscribe + opt-out); idempotência (nunca reenviar o mesmo passo); preferir derivar estado de AnalyticsEvent existente para evitar migration/DDL. Fora de escopo: editor visual, segmentação avançada, A/B test."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lead frio recebe a trilha automática de nutrição (Priority: P1)

Como pessoa que deixou o e-mail (baixou o checklist/lead magnet ou se cadastrou com e-mail real),
quero receber ao longo de ~7 dias uma sequência de e-mails úteis da BOTinho — entrega/boas-vindas,
prova de valor, convite ao teste grátis e ativação — para entender o produto no meu tempo e decidir
virar cliente sem precrisar lembrar de voltar sozinha.

**Why this priority**: É o coração da feature — a trilha fixa pós-lead. Sem ela nada mais existe.
Entrega valor de ponta a ponta mesmo que só este story seja construído (MVP: os leads começam a
receber a sequência automaticamente).

**Independent Test**: Registrar um lead com e-mail real, avançar o relógio simulado dia a dia e
confirmar que cada passo (dia 0, 2, 5, 7) é enviado uma única vez, na ordem certa, com conteúdo
pt-BR da marca BOTinho e link de descadastro presente em cada e-mail.

**Acceptance Scenarios**:

1. **Given** um lead novo com e-mail real que acabou de baixar o material, **When** a trilha é
   iniciada, **Then** o e-mail do dia 0 (entrega/boas-vindas) é enviado a esse contato.
2. **Given** um lead que já recebeu o e-mail do dia 0 há 2 dias, **When** a passada diária roda,
   **Then** o e-mail do dia 2 (valor/prova) é enviado e nenhum outro passo é disparado no mesmo dia.
3. **Given** um lead que já recebeu os passos até o dia 5, **When** completam-se 7 dias desde a
   entrada, **Then** o e-mail do dia 7 (ativação) é enviado e a trilha é considerada concluída.
4. **Given** um lead que percorreu toda a trilha, **When** a passada diária roda novamente,
   **Then** nenhum e-mail adicional da sequência é enviado.

---

### User Story 2 - Respeitar consentimento e descadastro (LGPD) (Priority: P1)

Como contato que recebe os e-mails, quero poder sair da lista a qualquer momento por um link de
descadastro em cada mensagem, e ter certeza de que, uma vez descadastrada, não recebo mais nenhum
passo da sequência — para que meu consentimento seja respeitado conforme a LGPD.

**Why this priority**: Requisito legal inegociável. Uma trilha automática sem opt-out confiável não
pode ir para produção. Mesma prioridade que o P1 do envio porque um bloqueia o outro.

**Independent Test**: Descadastrar um contato no meio da trilha (após o dia 0) e confirmar que os
passos seguintes (dia 2, 5, 7) não são enviados a ele, enquanto outros leads ativos seguem recebendo.

**Acceptance Scenarios**:

1. **Given** qualquer e-mail da sequência, **When** o contato o recebe, **Then** a mensagem contém um
   link de descadastro visível.
2. **Given** um contato que clicou em descadastrar, **When** a passada diária roda, **Then** nenhum
   passo futuro da sequência é enviado a esse contato.
3. **Given** um contato que descadastrou, **When** ele volta a baixar material depois, **Then** o
   sistema respeita o opt-out registrado e não reinicia a trilha automaticamente (o opt-out prevalece).
4. **Given** um "lead" cujo e-mail é o fallback interno (`user_*@sistema.com`) ou não é real,
   **When** a trilha avalia os destinatários, **Then** esse endereço nunca recebe e-mail.

---

### User Story 3 - Operação leve, à prova de reexecução e sem envio duplicado (Priority: P2)

Como dona do produto, quero que a sequência rode dentro da própria API, com carga de memória
desprezível e sem nunca mandar o mesmo passo duas vezes para o mesmo contato — mesmo que a API
reinicie, o timer rode fora de hora ou a passada diária execute mais de uma vez — para não gastar
RAM extra no VPS nem irritar leads com e-mails repetidos.

**Why this priority**: Garante que a feature caiba nas restrições canônicas de memória e
confiabilidade. Depende do envio (US1) existir para ser observável, por isso P2.

**Independent Test**: Rodar a passada diária duas vezes seguidas no mesmo dia e após um reinício
simulado da API; confirmar que cada passo elegível é enviado no máximo uma vez por contato e que
nenhum processo/worker/serviço novo é criado.

**Acceptance Scenarios**:

1. **Given** um lead elegível para o passo do dia 2, **When** a passada diária é executada duas vezes
   no mesmo dia, **Then** o e-mail do dia 2 é enviado exatamente uma vez.
2. **Given** a API que reinicia depois de já ter enviado o dia 0 a um lead, **When** ela volta e a
   passada roda, **Then** o dia 0 não é reenviado; o próximo passo elegível é retomado do ponto certo.
3. **Given** o ambiente sem variáveis SMTP configuradas, **When** a passada diária roda, **Then**
   nenhuma tentativa real de envio quebra o fluxo (as funções de e-mail viram no-op silencioso) e a
   suíte de testes segue rodando sem banco/SMTP.

---

### Edge Cases

- **Sem SMTP configurado**: todas as funções de e-mail viram no-op silencioso; a passada não lança erro
  e não marca o passo como enviado indevidamente (para não "queimar" passos que nunca saíram de fato).
- **E-mail inválido/fallback (`user_*@sistema.com`)**: nunca entra na trilha.
- **Lead entrou há mais de 7 dias antes da feature existir (backlog)**: definir se leads pré-existentes
  entram na trilha ou só leads novos a partir do go-live (ver Assumptions).
- **Falha pontual de envio de um contato**: não deve abortar a passada inteira nem os demais contatos
  (isolamento por item, mesma lição canônica das filas que travavam por um item).
- **Passada perdida** (API estava fora no dia): ao voltar, o passo elegível cujo prazo já passou é
  enviado na próxima passada (a elegibilidade é por "já se passaram N dias desde a entrada", não por
  "hoje é exatamente o dia N").
- **Contato conclui a ação antes do fim da trilha** (ex.: já virou cliente/ativou): fora de escopo
  cortar a trilha por conversão nesta versão (ver Fora de Escopo) — a trilha fixa completa mesmo assim,
  salvo opt-out.
- **Descadastro no exato momento entre a seleção e o envio**: o opt-out deve ser verificado o mais
  próximo possível do envio para minimizar corrida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST enviar uma trilha fixa de nutrição com 4 passos em pt-BR, marca BOTinho,
  nos marcos dia 0 (entrega/boas-vindas), dia 2 (valor/prova), dia 5 (convite ao teste grátis) e
  dia 7 (ativação), a partir da entrada do lead.
- **FR-002**: O sistema MUST considerar como lead elegível quem baixou o lead magnet/checklist ou se
  cadastrou com e-mail real; endereços de fallback (`user_*@sistema.com`) e e-mails não reais MUST ser
  excluídos.
- **FR-003**: O sistema MUST agendar a sequência via um timer in-process na API com passada diária,
  seguindo o mesmo padrão dos timers de limpeza existentes (`setInterval` + `.unref()`, declarado em
  nível de módulo). O sistema MUST NOT criar novo processo/app PM2, novo cron dedicado, novo worker,
  nem depender de Redis/BullMQ ou de cache em memória grande.
- **FR-004**: Cada e-mail da sequência MUST conter um link de descadastro (unsubscribe) funcional.
- **FR-005**: O sistema MUST respeitar o opt-out: um contato descadastrado MUST NOT receber nenhum
  passo futuro da sequência.
- **FR-006**: O sistema MUST garantir idempotência — cada passo MUST ser enviado no máximo uma vez por
  contato, mesmo diante de reexecução da passada no mesmo dia, execução dupla ou reinício da API.
- **FR-007**: O sistema MUST reaproveitar o transporte de e-mail existente (`src/email/mailer.js`);
  sem variáveis SMTP configuradas, todas as funções MUST virar no-op silencioso, mantendo os testes
  livres de banco e de SMTP.
- **FR-008**: O sistema SHOULD derivar o estado da sequência (qual passo já foi enviado, quando enviar
  o próximo) de eventos duráveis `AnalyticsEvent` já existentes/estendidos via allowlist em
  `src/analytics.js`, evitando migration/DDL. Se uma tabela nova for inevitável, isso MUST ser
  registrado explicitamente como decisão a validar, ciente do risco de lock em DDL (pegadinha #8).
- **FR-009**: A falha de envio para um contato MUST NOT abortar a passada nem impedir os demais
  contatos de serem processados (isolamento por item).
- **FR-010**: O sistema MUST NOT alterar `.env`, portas ou pipeline de deploy; o trabalho MUST seguir o
  fluxo feature → develop → main.
- **FR-011**: Passos cujo prazo já venceu (por passada perdida) MUST ser enviados na próxima passada,
  com a elegibilidade baseada no tempo decorrido desde a entrada do lead, não em "hoje é o dia N".
- **FR-012**: O acréscimo de memória em regime MUST ser desprezível (sem processo/worker/heap novo);
  as alternativas mais pesadas (cron dedicado, worker, fila Redis/BullMQ) MUST ficar registradas como
  descartadas por decisão de memória.

### Key Entities *(include if feature involves data)*

- **Lead/Contato**: pessoa que deixou um e-mail real (via lead magnet/checklist ou cadastro). Atributos
  relevantes: e-mail, momento de entrada na trilha, se é e-mail real (exclui fallback), estado de
  opt-out.
- **Passo da sequência**: definição fixa de um e-mail da trilha (marco em dias desde a entrada, assunto
  e corpo em pt-BR da marca BOTinho, presença do link de descadastro).
- **Estado de progresso do lead**: qual(is) passo(s) já foi(ram) enviado(s) a cada contato — derivado,
  de preferência, de eventos `AnalyticsEvent` duráveis para evitar tabela nova.
- **Registro de descadastro (opt-out)**: marca durável de que um contato pediu para sair; consultada
  antes de cada envio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos leads com e-mail real e sem opt-out recebem o e-mail do dia 0 dentro de 24h da
  entrada na trilha.
- **SC-002**: 0 e-mails duplicados — nenhum contato recebe o mesmo passo da sequência mais de uma vez,
  mesmo sob execução dupla da passada ou reinício da API (verificável em teste).
- **SC-003**: 0 e-mails enviados a contatos descadastrados após o registro do opt-out.
- **SC-004**: 100% dos e-mails da sequência contêm link de descadastro funcional.
- **SC-005**: Acréscimo de memória em regime desprezível — nenhum novo processo/app PM2, worker ou
  serviço long-running criado (verificável pela ausência de novos apps no ecosystem e pela ausência de
  dependência de Redis para esta feature).
- **SC-006**: Com SMTP ausente, 100% das execuções da passada terminam sem erro e sem marcar passos como
  enviados (no-op silencioso), e a suíte de testes roda sem banco/SMTP.

## Assumptions

- **Origem do opt-in**: considera-se consentimento implícito o ato de baixar o material ou se cadastrar
  com e-mail real; não há necessidade de double opt-in adicional nesta versão.
- **Escopo de leads na virada**: a trilha vale para leads que entram a partir do go-live da feature;
  leads pré-existentes de mais de 7 dias não são reprocessados retroativamente (decisão de menor risco;
  reavaliar se houver interesse em backfill).
- **Marcos fixos**: os dias 0/2/5/7 e os quatro temas (entrega, valor/prova, teste grátis, ativação) são
  fixos nesta versão — sem editor visual, sem ramificação por comportamento.
- **Reuso de infra**: reaproveita o transporte SMTP existente (`src/email/mailer.js`) e o padrão de
  timers in-process já presentes em `src/api/server.js`.
- **Fonte de estado**: preferência forte por derivar progresso e opt-in de `AnalyticsEvent` já
  existentes (padrão da feature 010, que gravou `landing_page` na metadata de `signup_created` em vez de
  criar coluna), evitando migration. Uma tabela nova só entra como decisão explícita a validar.
- **Base de leads**: assume-se que a origem dos leads reais (cadastro/lead magnet) já registra e-mail e
  um evento durável de entrada; a feature consome essa origem, não a cria.
- **Conteúdo dos e-mails**: textos pt-BR da marca BOTinho; tom e cópia finais podem ser ajustados sem
  mudar a estrutura da trilha.

## Fora de Escopo (nesta versão)

- Editor visual de campanhas.
- Segmentação avançada de público.
- Teste A/B de e-mail.
- Cortar a trilha automaticamente por conversão (ex.: parar ao virar cliente) — a trilha fixa completa,
  salvo opt-out.
- Backfill de leads antigos (>7 dias) existentes antes do go-live.
