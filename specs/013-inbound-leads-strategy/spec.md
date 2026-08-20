# Feature Specification: Estratégia de leads inbound — clique, indexação e ativação

**Feature Branch**: `claude/inbound-leads-strategy-yqtajg`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Estratégia de leads inbound: converter as impressões já conquistadas em cliques, destravar a indexação e consertar o gargalo de ativação. Seis entregas priorizadas P1..P6, com limites que não se cruzam (honestidade sobre banimento, ética em comparativo com concorrente, linhas de SEO congeladas por dado, política de memória e guards obrigatórios)."

## Contexto e problema

O site deixou de ter problema de visibilidade e passou a ter problema de **conversão em três degraus**:

| Degrau | Situação medida | Sintoma |
|---|---|---|
| Aparecer | Resolvido: impressões 1.102 → 2.902 e consultas distintas 13 → 29 entre 30/07 e 16/08 | — |
| **Ser clicado** | ~1.305 impressões rendendo 9 cliques em 9 páginas + 2 posts | dinheiro parado em página que já ranqueia |
| **Ser indexado** | Em 19/08: 85 páginas conhecidas não indexadas — 35 "Rastreada mas não indexada", 11 "Detectada mas não indexada" | racionamento de rastreamento: página nova entra na fila e não sai |
| **Ativar quem entra** | 55 pessoas parearam o WhatsApp, só 33 cadastraram credencial de loja; 22 pessoas (32% de quem não pagou) pararam nesse ponto | a pessoa acha que testou o robô e nunca viu funcionar |

Duas frentes novas apareceram no período e mudam onde vale investir: o site passou a ser
citado em respostas de IA do Google (88 impressões desde 17/06) e o ChatGPT já responde por
17% dos cadastros.

A ordem P1 → P6 não é preferência: é dependência. Consertar clique (P1) rende em dias sobre
tráfego que já existe. Destravar a indexação (P2) é **pré-requisito** para qualquer página
nova — publicar conteúdo novo com o rastreamento racionado desperdiça o trabalho. A etapa da
credencial (P3) é o maior valor absoluto da lista e não depende de SEO nenhum.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Título que dá motivo para clicar (Priority: P1)

Uma pessoa busca no Google, vê o resultado do site na primeira página e hoje passa direto.
Ela precisa entender, só pelo título e pela descrição, o que ganha ao clicar — e o título
precisa caber inteiro na tela do celular, que é de onde vêm 62% das impressões com metade do
CTR do computador.

**Why this priority**: mexe em duas linhas de texto por página, sobre tráfego que já existe e
já ranqueia. É o maior retorno por hora de trabalho da lista inteira e tem efeito em dias, não
em semanas.

**Independent Test**: pode ser entregue sozinha. Verifica-se lendo o título e a descrição de
cada uma das páginas alvo, conferindo o limite de caracteres e comparando o padrão com as
quatro páginas que já convertem hoje. O resultado se mede no Search Console 30 dias depois.

**Acceptance Scenarios**:

1. **Given** uma das 11 páginas alvo, **When** seu título é medido já com o sufixo que o site
   acrescenta automaticamente, **Then** o total não passa de 55 caracteres.
2. **Given** o título reescrito de qualquer página alvo, **When** ele é lido só até o ponto em
   que a tela de celular corta, **Then** o motivo para clicar já apareceu.
3. **Given** a página `/bot-achadinhos-whatsapp` (já tratada anteriormente), **When** o
   trabalho é executado, **Then** ela é usada como modelo de padrão e **não** é reescrita de novo.
4. **Given** as páginas de comparação com concorrente entre as alvo, **When** o novo título é
   escrito, **Then** ele diz "alternativa a X" e em nenhum momento se passa por X.
5. **Given** o conjunto reescrito, **When** os validadores de metadados do site rodam, **Then**
   nenhum título ou descrição fica duplicado com outra página.

---

### User Story 2 - Destravar a indexação antes de publicar qualquer coisa nova (Priority: P2)

O buscador está racionando o rastreamento do site: 85 páginas conhecidas fora do índice. A
causa provável é excesso de páginas parecidas entre si — páginas geradas por modelo, que
existem para preencher grade e não têm intenção própria. Enquanto isso não for resolvido,
qualquer página nova entra numa fila que não anda.

**Why this priority**: é bloqueante para P4, P5 e P6. Publicar conteúdo novo antes de destravar
é jogar trabalho fora.

**Independent Test**: pode ser entregue sozinha. Verifica-se conferindo que as páginas
escolhidas para sair do índice realmente emitem o sinal de "não indexe" no HTML entregue ao
buscador, que nenhuma página foi apagada, e que as páginas mantidas ganharam conteúdo que só
elas poderiam ter.

**Acceptance Scenarios**:

1. **Given** uma página marcada para sair do índice, **When** seu HTML é inspecionado, **Then**
   ele traz a instrução de não indexar **e** de continuar seguindo os links da página.
2. **Given** a mesma página, **When** o sitemap e a lista de notificação de URLs são gerados,
   **Then** ela não aparece em nenhum dos dois.
3. **Given** qualquer página das linhas congeladas por dado (cidade, nicho), **When** o trabalho
   termina, **Then** ela continua existindo e acessível — nenhuma página foi apagada.
4. **Given** uma página mantida no índice por ter intenção própria, **When** ela é comparada com
   as suas irmãs de mesmo modelo, **Then** ela traz conteúdo específico que nenhuma das outras
   poderia repetir.
5. **Given** a página bloqueada no arquivo de regras de robôs, **When** a investigação termina,
   **Then** há uma conclusão escrita dizendo qual é a página, se o bloqueio é intencional e o
   que fazer a respeito.

---

### User Story 3 - Avisar quem parou na etapa da credencial (Priority: P3)

Uma pessoa conecta o WhatsApp, monta o espelhamento e espera as ofertas saírem. Sem a
credencial da loja cadastrada, o robô se recusa a publicar de propósito — para não entregar a
comissão ao afiliado do grupo de origem. Hoje isso é silencioso para quem não abre o histórico
de envios: a pessoa conclui que o produto não funciona e vai embora.

**Why this priority**: é o maior valor absoluto da lista (32% de quem não pagou parou
exatamente aqui) e não depende de nada de SEO. Está em P3 e não em P1 apenas porque P1 e P2 são
mais baratos e destravam o resto.

**Independent Test**: pode ser entregue sozinha. Verifica-se simulando uma conta com WhatsApp
conectado e sem credencial de loja: o aviso precisa aparecer no painel, sem que a pessoa
precise procurar no histórico.

**Acceptance Scenarios**:

1. **Given** uma conta com WhatsApp conectado e nenhuma credencial de loja cadastrada, **When**
   um envio é bloqueado por falta de credencial, **Then** a pessoa vê um aviso dentro do painel
   sem precisar abrir o histórico de envios.
2. **Given** esse aviso, **When** ele é lido, **Then** ele explica o que aconteceu, por que
   aconteceu e qual é o próximo passo, com um caminho direto para a tela de cadastro da loja.
3. **Given** o texto do aviso, **When** ele é revisado, **Then** usa apenas "etiqueta de
   afiliada" e "código de acesso" — nunca "cookie", "SSID", "tag" ou qualquer outro termo técnico.
4. **Given** a loja em questão é a Shopee, **When** o aviso é montado, **Then** ele diz que as
   ofertas dessa loja **param de sair**.
5. **Given** a loja em questão é Mercado Livre ou Amazon, **When** o aviso é montado, **Then**
   ele diz que as ofertas **continuam saindo**, só com link mais comprido — nunca que o envio parou.
6. **Given** uma conta com todas as credenciais em ordem, **When** o painel é aberto, **Then**
   nenhum aviso desse tipo aparece.
7. **Given** os oito e-mails do grupo "Contato e escuta" que já existem, **When** o trabalho
   termina, **Then** eles continuam com disparo manual e nenhum envio automático foi criado.

---

### User Story 4 - Ser citada por motor de IA, não só ranquear (Priority: P4)

Quem pergunta a um assistente de IA "qual ferramenta usar para divulgar ofertas de afiliado no
WhatsApp" precisa encontrar uma página que **explica** — o que é, como funciona, quanto custa,
como escolher. As 88 impressões em respostas de IA mostram que é esse tipo de página que é
citada; as que só disputam nome de concorrente são ignoradas.

**Why this priority**: o canal já é real (17% dos cadastros vêm do ChatGPT) e o reforço recai
sobre uma página que já existe e já concentra quase 40% da visibilidade de IA — portanto não
cria página nova e não briga com o P2.

**Independent Test**: pode ser entregue sozinha. Verifica-se conferindo que a página passou a
responder, de forma direta e extraível, as quatro perguntas que a IA costuma citar.

**Acceptance Scenarios**:

1. **Given** a página de referência sobre o assunto, **When** ela é lida, **Then** responde de
   forma direta: o que é, como funciona, quanto custa e como escolher entre as opções.
2. **Given** essa página, **When** o trabalho termina, **Then** nenhuma página nova foi criada
   para atender este objetivo.
3. **Given** o trecho sobre banimento de conta, **When** ele é revisado, **Then** explica o
   risco com honestidade e em nenhum momento promete que a conta não será banida.

---

### User Story 5 - Uma página de comparação nova por vez (Priority: P5)

Quem digita o nome de um concorrente está a um passo da decisão. Essa linha gerou 48% de todo o
crescimento do período. Faltam seis concorrentes já mapeados sem página. Com o rastreamento
racionado, publicar as seis de uma vez desperdiça o trabalho.

**Why this priority**: é a linha comprovadamente eficaz, mas depende de P2 estar resolvido para
render. Entra depois da etapa de ativação porque tráfego novo em funil furado vale menos.

**Independent Test**: pode ser entregue sozinha. Verifica-se conferindo que **uma** página nova
foi publicada, que ela tem dado real com fonte e data, e que existe um checklist reaproveitável
para as próximas.

**Acceptance Scenarios**:

1. **Given** a lista de seis concorrentes sem página, **When** o trabalho termina, **Then**
   exatamente **uma** página nova foi publicada — a de maior evidência — e as outras cinco
   continuam pendentes.
2. **Given** a página publicada, **When** ela cita preço, plano ou comissão do concorrente,
   **Then** traz a fonte oficial e a data da consulta.
3. **Given** a página publicada, **When** ela é lida inteira, **Then** existe um trecho que diz
   em que situação o concorrente é a melhor escolha.
4. **Given** a página publicada, **When** o título e o texto são revisados, **Then** ela se
   apresenta como alternativa e em nenhum momento se passa pelo concorrente.
5. **Given** o trabalho concluído, **When** alguém for produzir a próxima da fila, **Then**
   existe um checklist escrito com o padrão a seguir e o ritmo de uma por semana, com verificação
   de entrada no índice antes da seguinte.

---

### User Story 6 - Abrir a frente de quem está virando afiliado (Priority: P6)

Hoje o site só é encontrado por quem já sabe que quer um robô. Quem está virando afiliado agora
— 50.000 buscas/mês em cada um dos três termos principais, concorrência baixa, zero consulta
nossa — não encontra nada. Essa pessoa precisa de um guia completo do programa de afiliados;
a ferramenta entra no fim, como quem resolve a parte chata.

**Why this priority**: é a maior oportunidade aberta do levantamento, mas é conteúdo novo com
efeito em 4 a 8 semanas e depende de P2. Fica por último por prazo de retorno, não por tamanho.

**Independent Test**: pode ser entregue sozinha. Verifica-se conferindo que o guia cobre as
etapas do programa de afiliados de ponta a ponta e que o produto aparece só no fim.

**Acceptance Scenarios**:

1. **Given** a frente Tier 1, **When** a primeira página é escolhida, **Then** é a da Shopee —
   a maior no interesse de busca e onde o site já tem aceitação.
2. **Given** o guia publicado, **When** ele é lido, **Then** cobre cadastro, comissão, regras e
   como divulgar, de ponta a ponta.
3. **Given** o guia publicado, **When** a menção ao produto é localizada, **Then** ela está no
   fim, apresentada como a ferramenta que resolve a parte repetitiva.
4. **Given** o guia publicado, **When** ele é comparado com as outras páginas do site, **Then**
   é conteúdo denso e único, sem trechos repetidos de página-modelo.

---

### Edge Cases

- **Título já curto mas sem motivo para clicar**: caber em 55 caracteres não basta; se o motivo
  não estiver no começo, o trabalho não está feito.
- **Página com intenção própria mas conteúdo pobre**: não pode ser marcada para sair do índice
  só por ser fraca — a decisão é engordar ou tirar do índice, e engordar tem precedência quando
  a intenção existe.
- **Página em linha congelada por dado**: continua existindo, não recebe investimento novo e
  entra na avaliação de saída do índice como qualquer outra — mas nunca é apagada.
- **Conta com uma loja em ordem e outra faltando**: o aviso precisa falar só da loja que falta,
  com o vocabulário certo daquela loja.
- **Loja cadastrada mas com código vencido**: é situação diferente de "não cadastrou" e já tem
  aviso próprio no sistema — o aviso novo não pode duplicar nem contradizer o existente.
- **Concorrente sem preço público**: sem fonte oficial e data, a página não cita preço — diz que
  não é público.
- **Concorrente que mudou de preço depois da publicação**: a data de consulta na página é o que
  protege a afirmação; sem ela a página fica insustentável.
- **Página nova não entra no índice em uma semana**: é o sinal de que P2 não está resolvido — a
  próxima da fila não é publicada até entrar.

## Requirements *(mandatory)*

### Functional Requirements — Clique (P1)

- **FR-001**: O sistema MUST manter título e descrição de cada página em uma fonte única, de
  modo que a reescrita de uma página não exija editar dois lugares.
- **FR-002**: Cada título reescrito MUST ter no máximo 55 caracteres **contando o sufixo** que o
  site acrescenta automaticamente.
- **FR-003**: Cada título reescrito MUST trazer o motivo para clicar no começo do texto.
- **FR-004**: As 11 páginas alvo MUST ser reescritas: as sete com zero clique
  (`/blog/melhores-horarios-para-postar-ofertas-no-whatsapp`, `/programa-de-afiliados`,
  `/alternativas/fluxopromo`, `/bot-ofertas-afiliados-whatsapp`,
  `/blog/conferir-converter-link-afiliado-whatsapp`, `/bot-ofertas-whatsapp`,
  `/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero`), mais `/alternativas/achadinhos-bot`,
  mais os dois posts de marketplace (`/blog/como-divulgar-ofertas-amazon-whatsapp` e
  `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`).
- **FR-005**: A página `/bot-achadinhos-whatsapp` MUST ser usada como modelo do padrão e MUST
  NOT ser reescrita novamente.
- **FR-006**: O padrão adotado MUST ser derivado das quatro páginas que hoje convertem melhor
  (`/`, `/bot-afiliados-whatsapp`, `/automatizar-divulgacao-em-grupos-whatsapp`,
  `/padronizar-divulgacao-afiliado-whatsapp`).
- **FR-007**: Nenhum título ou descrição reescrito MUST ficar duplicado com o de outra página do site.

### Functional Requirements — Indexação (P2)

- **FR-008**: O sistema MUST emitir, no HTML da página, a instrução real de não indexar para
  toda página marcada como não indexável — hoje a marcação só remove a página do sitemap e da
  notificação de URLs, sem efeito no HTML.
- **FR-009**: A instrução de não indexar MUST manter o seguimento dos links da página, para não
  cortar a circulação interna.
- **FR-010**: Nenhuma página MUST ser apagada — a saída do índice é por instrução, nunca por remoção.
- **FR-011**: Toda página marcada como não indexável MUST desaparecer simultaneamente do
  sitemap, da notificação de URLs e da indexação — as três pontas não podem divergir.
- **FR-012**: As páginas de mesmo modelo MUST ser triadas entre "tem intenção própria" (recebe
  conteúdo exclusivo) e "existe só para preencher grade" (sai do índice), com o critério de
  triagem registrado por escrito.
- **FR-013**: A investigação da página bloqueada no arquivo de regras de robôs MUST terminar com
  conclusão documentada: qual é a página, se o bloqueio é intencional e o que fazer.
- **FR-014**: Nenhuma página nova MUST ser publicada antes de FR-008 a FR-012 estarem concluídos.

### Functional Requirements — Ativação (P3)

- **FR-015**: O painel MUST avisar a pessoa quando um envio for bloqueado por falta de
  credencial de loja, sem exigir que ela abra o histórico de envios.
- **FR-016**: O aviso MUST dizer o que aconteceu, por quê, e oferecer caminho direto para a tela
  de cadastro da loja.
- **FR-017**: O aviso MUST usar exclusivamente "etiqueta de afiliada" e "código de acesso", e
  MUST NOT conter "cookie", "SSID", "tag" ou qualquer outro termo técnico.
- **FR-018**: Para a Shopee, o aviso MUST dizer que as ofertas daquela loja **param de sair**.
- **FR-019**: Para Mercado Livre e Amazon, o aviso MUST dizer que as ofertas **continuam saindo**
  com link mais comprido, e MUST NOT afirmar que o envio parou.
- **FR-020**: O aviso MUST distinguir "nunca cadastrou" de "cadastrou e o código venceu", sem
  duplicar nem contradizer o aviso de código vencido já existente.
- **FR-021**: O aviso MUST desaparecer quando a credencial correspondente for cadastrada.
- **FR-022**: Os oito e-mails do grupo "Contato e escuta" MUST permanecer de disparo manual —
  nenhum envio automático MUST ser criado; apenas o caminho de uso MUST ser documentado.

### Functional Requirements — Autoridade e conteúdo (P4, P5, P6)

- **FR-023**: A página de referência sobre o assunto (`/bot-afiliados-whatsapp`) MUST responder,
  de forma direta e localizável, o que é, como funciona, quanto custa e como escolher.
- **FR-024**: O objetivo de citação por IA MUST ser atendido reforçando página existente —
  nenhuma página nova MUST ser criada para esse fim.
- **FR-025**: Exatamente **uma** página de comparação nova MUST ser publicada nesta entrega,
  escolhida por maior evidência entre Achadinho Pro, Afilira, IA Divulgadora, Shark Pomo Bot,
  Lumi Ofertas Inteligentes e Gigi Bot.
- **FR-026**: Um checklist reaproveitável MUST ser deixado pronto para as páginas de comparação
  seguintes, no ritmo de uma por semana com verificação de entrada no índice antes da próxima.
- **FR-027**: A primeira página da frente Tier 1 MUST ser a da Shopee, cobrindo cadastro,
  comissão, regras e como divulgar, com a menção ao produto apenas no fim.
- **FR-028**: Toda página nova MUST ser conteúdo denso e único, sem trechos repetidos de outras
  páginas do site.

### Functional Requirements — Limites que não se cruzam

> Violação de qualquer item desta seção reprova a entrega em revisão.

- **FR-029**: Nenhum texto MUST prometer que a conta não será banida. Entrar pela palavra
  "banido"/"anti-ban" é permitido; corrigir a expectativa dentro da página é obrigatório;
  prometer é proibido.
- **FR-030**: Todo comparativo MUST se apresentar como "alternativa a X" e MUST NOT se passar por X.
- **FR-031**: Todo comparativo MUST NOT citar preço ou comissão sem fonte oficial e data de consulta.
- **FR-032**: Todo comparativo MUST dizer em que situação o concorrente é a melhor escolha.
- **FR-033**: Nenhuma frente congelada por dado MUST ser reaberta: sem página por cidade, sem
  página de nicho novo, sem tratar "robô" como termo próprio, sem Magalu como frente nova, sem
  "automação whatsapp" nem "disparo em massa".
- **FR-034**: As páginas já existentes das linhas congeladas MUST NOT ser apagadas.
- **FR-035**: Nenhuma configuração de ambiente nem banco de produção MUST ser alterado.
- **FR-036**: Nenhuma mudança que aumente o consumo de memória MUST ser aplicada sem aviso
  explícito e aprovação prévia da usuária.
- **FR-037**: Todo texto novo MUST ser em português do Brasil, em linguagem simples, sem jargão
  técnico na tela da cliente.

### Functional Requirements — Portões de qualidade

- **FR-038**: A verificação de regressão da página de configuração MUST passar.
- **FR-039**: As cinco verificações de conteúdo e metadados MUST passar: consistência de SEO,
  duplicidade de metadados, cobertura do registro de páginas, frescor editorial e validade dos
  modelos de dados estruturados.
- **FR-040**: A suíte de testes automatizados da raiz do projeto MUST continuar integralmente verde.
- **FR-041**: Cada regra desta especificação que possa regredir em silêncio MUST ter teste
  automatizado que falhe quando a regra for violada — em especial o limite de caracteres do
  título, a emissão real da instrução de não indexar, o vocabulário leigo do aviso de credencial
  e a inversão de vocabulário da Shopee.

### Key Entities

- **Página do site**: um endereço público com título, descrição, decisão de indexação, modelo
  de origem e histórico de desempenho (impressões, cliques, posição).
- **Registro central de páginas**: fonte única de título, descrição e decisão de indexação de
  todas as páginas; alimenta simultaneamente o HTML da página, o sitemap e a notificação de URLs.
- **Página de comparação**: página dedicada a um concorrente, com dado verificado, fonte oficial,
  data de consulta e o trecho de honestidade sobre onde o concorrente é melhor.
- **Aviso de credencial no painel**: mensagem exibida à cliente quando um envio é bloqueado por
  falta de credencial, com loja envolvida, texto conforme o vocabulário daquela loja e caminho
  para resolver.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nenhum título das páginas alvo passa de 55 caracteres já contando o sufixo
  automático — verificável imediatamente, sem esperar dado de busca.
- **SC-002**: As 11 páginas alvo saem de 9 cliques em ~1.305 impressões para pelo menos 40
  cliques no mesmo volume de impressões, medido 30 dias após a publicação (CTR de 0,7% para ≥3%).
- **SC-003**: Nenhuma das sete páginas hoje com zero clique continua em zero clique 30 dias
  após a publicação.
- **SC-004**: A diferença de aproveitamento entre celular e computador cai pela metade — de
  celular convertendo 2,07% contra 5,10% do computador para no máximo o dobro de distância.
- **SC-005**: Toda página marcada para sair do índice traz a instrução real no HTML entregue —
  verificação de 100% das páginas marcadas, sem exceção.
- **SC-006**: O número de páginas conhecidas e não indexadas cai de 85 para no máximo 50 em até
  60 dias, com o grupo "Rastreada mas não indexada" (35) caindo pelo menos à metade.
- **SC-007**: Nenhuma página foi apagada — a contagem de endereços públicos que respondem antes
  e depois da entrega é a mesma ou maior.
- **SC-008**: A proporção de pessoas que conectam o WhatsApp e cadastram credencial de loja sobe
  de 60% (33 de 55) para pelo menos 80%, medido nos 60 dias seguintes.
- **SC-009**: Nenhum aviso do painel contém termo técnico proibido — verificação automatizada
  com 100% de cobertura sobre os textos exibidos.
- **SC-010**: A página de referência responde as quatro perguntas de decisão (o que é, como
  funciona, quanto custa, como escolher) e a visibilidade em respostas de IA cresce sobre a
  base de 88 impressões em 60 dias.
- **SC-011**: Exatamente uma página de comparação nova foi publicada, e ela entra no índice em
  até 14 dias — condição para publicar a seguinte.
- **SC-012**: A frente Tier 1 sai de zero consulta para pelo menos uma consulta com impressão no
  Search Console em até 60 dias.
- **SC-013**: Zero ocorrência de promessa de não-banimento, zero ocorrência de preço de
  concorrente sem fonte e data, e zero página de comparação sem o trecho de onde o concorrente
  é melhor — verificação de 100% do texto publicado.
- **SC-014**: Todos os portões de qualidade passam e a suíte de testes segue verde na entrega.

## Assumptions

Decisões tomadas por padrão razoável, na ausência de definição explícita — todas revisáveis na
fase de planejamento:

- **Escolha da página de comparação a publicar**: assume-se **Achadinho Pro**, por ser o
  concorrente do mesmo grupo de marca que já concentra 443 impressões de intenção altíssima
  (`achadinhoosbot`, `achadinhosbot`, `achadinhos bot`) e portanto o de maior evidência
  disponível. As outras cinco ficam na fila, uma por semana.
- **Critério de triagem para sair do índice**: assume-se "página gerada por modelo, sem intenção
  de busca própria comprovada, com zero impressão nos últimos três meses". Páginas com qualquer
  impressão ou intenção própria são engordadas, não retiradas.
- **Onde o aviso de credencial aparece**: assume-se a tela inicial do painel e a tela do
  checklist de configuração — os dois pontos por onde passa quem acabou de conectar o WhatsApp —
  além do histórico de envios, onde a informação já existe.
- **Medição de "55 caracteres"**: assume-se contagem do texto final entregue ao buscador, já com
  o sufixo automático aplicado, e não do texto cru cadastrado.
- **Janela de medição**: assume-se 30 dias para os efeitos de clique (P1) e 60 dias para os
  efeitos de indexação e conteúdo novo (P2, P4, P5, P6), consistente com o prazo histórico
  observado no próprio site.
- **Não há mudança de infraestrutura**: a entrega é texto, metadados e uma tela de aviso; assume-se
  consumo de memória inalterado. Se o planejamento revelar o contrário, a política de aviso
  prévio se aplica antes de qualquer execução.

## Dependencies

- **Branch e integração**: o trabalho ocorre na branch já existente
  `claude/inbound-leads-strategy-yqtajg`, criada a partir de `develop`. O PR final é contra
  `develop`, nunca contra `main`. Nenhuma branch nova é criada por esta feature.
- **Registro central de páginas** (`dashboard/lib/seo-registry.mjs`): fonte única de título,
  descrição e decisão de indexação. Hoje a marcação de não indexável alimenta apenas o sitemap e
  a notificação de URLs — a emissão do sinal no HTML da página não existe e precisa ser criada.
- **Arquivo de regras de robôs** (`dashboard/public/robots.txt`): fonte única do site. A página
  suspeita de bloqueio (`/promo-vip-7dias`) aparece lá como bloqueada **e** já declara bloqueio
  próprio no seu layout — indício forte de bloqueio intencional, a ser confirmado e documentado
  em FR-013.
- **Páginas de comparação já existentes** (`dashboard/app/alternativas/`): achadinhos-bot,
  bot-para-whatsapp-afiliados, fluxopromo, proafiliados, shozap. As seis restantes estão na fila.
- **Recusa de publicação sem credencial** (`skip:no_valid_conversions`, em `src/bot-worker.js`):
  comportamento intencional de proteção de comissão. Esta feature **não** altera essa recusa —
  apenas torna visível para a cliente que ela aconteceu.
- **Vocabulário leigo já canônico** (`src/credentialHealth.js`): "etiqueta de afiliada", "código
  de acesso"; e a inversão obrigatória do texto da Shopee. O aviso novo reutiliza esse
  vocabulário em vez de criar outro.
- **E-mails do grupo "Contato e escuta"** (`src/email/registry.js`): oito e-mails já existentes,
  sempre manuais. Esta feature não os automatiza.
- **Regras canônicas de marketing e linhas congeladas**: `AGENTS.md` (seções "SEO orgânico —
  linhas CONGELADAS", "Dados de mercado para marketing", "Política de memória") e
  `docs/marketing/ANALISE_SEO_2026-08-16.md`.

## Out of Scope

- Publicar as outras cinco páginas de comparação (ficam na fila de uma por semana).
- Abrir as frentes de Mercado Livre e Amazon do Tier 1 (só Shopee nesta entrega).
- Qualquer página nova por cidade ou por nicho, e qualquer investimento nas linhas congeladas por dado.
- Automatizar o disparo dos e-mails de escuta.
- Alterar o comportamento de recusa de publicação sem credencial.
- Mudanças de infraestrutura, ambiente ou banco de produção.
