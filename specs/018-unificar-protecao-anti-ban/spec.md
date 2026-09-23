# Feature Specification: Anti-banimento — unificar a proteção do número num lugar só (recurso PRO)

**Feature Branch**: `018-unificar-protecao-anti-ban`

**Created**: 2026-09-23

**Status**: Draft (clarificações Q1–Q3 respondidas em 2026-09-23)

**Input**: User description: "Unificar as configurações de segurança anti-ban ('Módulo de Preservação Avançada' / 'Preservação Pro') do painel num único lugar, com nome leigo e intuitivo, localização recomendada na navegação, remoção de campos técnicos da UI (ex.: 'tamanho da rajada' vira valor fixo no backend = valor padrão atual), e gate exclusivo do plano PRO. Hoje os controles estão espalhados em Monitoramento, 'Preservação Avançada' (configurações da conta), 'Preservação Pro' por grupo/canal e tela de Conexão WhatsApp. Pedidos: 1) unificar; 2) propor nome melhor com recomendação; 3) recomendar o melhor lugar do painel; 4) levantar campos que viram fixos vs. continuam editáveis; 5) sinalizar e restringir a contas PRO, definindo o comportamento para não-PRO. Restrições: não mudar o comportamento de envio por padrão; linguagem leiga; campos removidos da tela ficam dormentes no banco; rotas continuam aceitando o campo antigo; gate no padrão de entitlement do projeto; branch a partir de develop."

## Clarifications

### Session 2026-09-23

- Q1 (FR-008, nome da funcionalidade) → A: **"Anti-banimento"**. Escolha explícita da dona do produto, com base no termo mais usado no mercado brasileiro para esse tipo de recurso (Digisac, Wazzap e outros usam "anti-banimento"). Rejeitados: "Proteção do número", "Envio seguro", "Proteção anti-bloqueio", "Segurança do WhatsApp", "Cuidado com o número", "Blindagem anti-banimento", "Ritmo de envio seguro", "Proteção contra banimento".
- Q2 (FR-011, contas que personalizaram campos que viram fixos) → C: o valor fixo passa a valer para todas as contas, **exceto** as que já tinham gravado um valor **mais conservador** (mais lento/mais seguro) que o fixo — essas mantêm o próprio valor. Ninguém pode ficar mais exposto a banimento do que já estava.
- Q3 (FR-016, quem tem acesso) → A: **PRO + Premium + Trial ativo**, exatamente o que o backend já libera hoje. O "apenas PRO" do pedido original significava "não é para conta Basic", não excluir Premium/Trial. A divergência da tela (que esquece o Premium) é corrigida nesta feature.

## Contexto: o que existe hoje (levantado no código em 2026-09-23)

A cliente do produto é leiga (dona de grupo de ofertas). As configurações que protegem o número dela contra bloqueio do WhatsApp estão hoje em **quatro lugares**, com três nomes diferentes:

| Onde | Nome na tela | O que tem |
|---|---|---|
| Menu lateral, grupo "Preservação avançada" → **Monitoramento** | "Monitoramento" | painel de saúde: status por canal, score de risco, snapshots, cliques, observador externo, seguidas recentes (só leitura + liga/desliga do observador) |
| Mesmo grupo → **Preservação por grupo e canal** | "Presets" e "Destinos" | por destino: intervalo mínimo entre envios, "máximo de envios na janela", "janela de rajada", limite diário, horário de funcionamento, descartar oferta que esperou demais; presets reutilizáveis (Conservador / Médio / Leve) |
| Mesmo grupo → **Configurações avançadas** | "Configurações avançadas" | valem para a conta toda: "Atraso entre canais", limite de seguidas por dia, variação de imagem |
| Tela **Espelhamento**, painel do destino, aba "Anti-ban" | "Saúde deste destino" | status do canal + link "Preservação por grupo e canal →" (não edita nada ali) |
| Tela de upsell | "Módulo de Preservação Avançada" | lista de recursos e botão "Ativar Pro" |

Observações do levantamento que a feature precisa corrigir ou respeitar:

- **A tela de Conexão WhatsApp não tem, no código atual, nenhum controle de proteção** (busca por "preserv", "anti-ban", "limite", "horário" não achou nada). O item 4 do pedido deve ser confirmado na fase de plano; se não houver campo lá, nada a mover.
- **O acesso hoje não é "só PRO"**: o backend libera para **PRO, Premium e Trial ativo** (`canUseAdvancedPreservation`). A tela do painel usa uma checagem própria que libera **PRO e Trial, mas esquece o Premium** — uma cliente Premium hoje veria o upsell apesar de o backend liberar. A regra precisa passar a morar num lugar só.
- **Jargão já exposto na tela**: "Presets", "janela de rajada", "Máximo de envios na janela", "anti-flood", "mutação de imagem", "shadowban", "hash duplicado", "Score de risco", "Snapshots", "cap diário".
- Campos da conta que já são **dormentes** no banco (não lidos pelo robô desde a mudança para configuração por destino): `channelMinIntervalSec`, `channelBurstCap`, `channelBurstWindowSec`, `channelThrottleEnabled`, `channelQuietHoursJson`, `quietHoursEnabled`. Continuam dormentes.
- Valores padrão atuais do ritmo por destino (usados quando não há preset): intervalo 30s, 6 envios a cada 600s (10 min), sem limite diário, descarte após 300 min, horário de funcionamento desligado (8h–22h quando ligado). "Atraso entre canais" padrão: 20s.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encontrar e ajustar toda a proteção do número num lugar só (Priority: P1)

A cliente PRO quer deixar o robô "mais devagar" ou "só em horário comercial" num grupo, ou para a conta toda. Hoje ela precisa saber que o ritmo por grupo fica numa tela, o atraso entre canais em outra, e a saúde em uma terceira. Depois da mudança, existe **uma tela só, chamada "Anti-banimento"**, onde ela vê como o número está protegido e ajusta o que pode ajustar.

**Why this priority**: é o problema central relatado (espalhado e confuso). Sozinho já entrega valor, mesmo sem mudar gate ou campos.

**Independent Test**: com uma conta PRO, abrir o painel, achar a tela nova pelo menu em até 2 cliques e, nela, (a) ver a situação da proteção, (b) mudar o ritmo de um grupo específico, (c) mudar o ajuste que vale para a conta toda, e salvar — sem passar por nenhuma outra tela.

**Acceptance Scenarios**:

1. **Given** uma cliente PRO no painel, **When** ela procura a proteção do número, **Then** encontra um único item de menu chamado "Anti-banimento", e as três telas antigas (Monitoramento, Preservação por grupo e canal, Configurações avançadas) deixam de aparecer como itens separados.
2. **Given** a cliente na tela nova, **When** ela escolhe um grupo de destino, **Then** vê e altera o ritmo daquele grupo (quantas ofertas por dia, tempo entre uma e outra, horário de funcionamento, até quando esperar uma oferta atrasada) no mesmo lugar onde vê os ajustes que valem para a conta toda.
3. **Given** a cliente abre um endereço antigo (`/painel/preservacao`, `/painel/preservacao/monitoramento`, `/painel/preservacao/destinos`, `/painel/preservacao/configuracoes`) guardado em favorito, e-mail ou tutorial, **When** a página carrega, **Then** ela é levada à parte correspondente da tela nova, sem página de erro.
4. **Given** a cliente no painel de um destino dentro de Espelhamento, **When** ela quer mudar o ritmo daquele destino, **Then** um atalho a leva direto à tela nova já com aquele destino selecionado.

---

### User Story 2 - Só ver o que dá para entender, com o resto fixo e seguro (Priority: P1)

A cliente não sabe o que é "janela de rajada". Campos que exigem conhecimento técnico saem da tela e passam a usar um valor fixo e seguro, igual ao padrão de hoje. O que sobra é descrito em frases do dia a dia ("no máximo X ofertas por dia neste grupo", "espere pelo menos X minutos entre uma oferta e outra").

**Why this priority**: sem isso, unificar só junta a confusão num lugar. É o que torna a tela usável para leiga.

**Independent Test**: percorrer a tela nova e confirmar que nenhum termo da lista proibida aparece, e que um envio real de uma conta que nunca mexeu nesses campos segue com o mesmo ritmo de antes.

**Acceptance Scenarios**:

1. **Given** a tela nova, **When** qualquer pessoa a lê, **Then** nenhum destes termos aparece em rótulo, dica, aviso ou botão: burst, rajada, janela de rajada, throttle, jitter, preset, cap, anti-flood, shadowban, hash, snapshot, score, mutação, stagger.
2. **Given** um campo classificado como "fixo" (ver FR-010), **When** a tela é aberta, **Then** ele não é exibido nem editável.
3. **Given** uma conta que nunca alterou os campos que viram fixos, **When** o robô envia depois da mudança, **Then** o ritmo efetivo de envio é idêntico ao de antes.
4. **Given** um app/integração antiga que ainda envia um campo que virou fixo nas rotas atuais, **When** a requisição chega, **Then** ela é aceita sem erro (o valor é tratado conforme FR-013) e nenhum outro campo da mesma requisição é descartado.
5. **Given** uma conta que tinha gravado um valor mais conservador que o fixo num dos cinco campos de FR-011 (ex.: 1 envio a cada 10 minutos num destino), **When** o robô envia depois da mudança, **Then** continua usando o valor dela, não o fixo.
6. **Given** uma conta que tinha gravado um valor menos conservador que o fixo (ex.: atraso entre canais em 5 s, ou limites do destino desligados), **When** o robô envia depois da mudança, **Then** passa a usar o valor fixo — mais seguro que o de antes.

---

### User Story 3 - Saber que é recurso PRO e o que acontece se não for PRO (Priority: P2)

A tela deixa claro, com um selo visível, que é recurso do plano PRO (liberado também para Premium e para o Trial ativo). Quem não tem acesso vê a tela bloqueada com uma explicação curta, em linguagem simples, e um botão para conhecer o plano — e não consegue alterar nada, nem pela tela nem pela API.

**Why this priority**: é requisito de negócio (upsell) e de consistência (hoje tela e backend discordam). Depende da tela existir (US1).

**Independent Test**: entrar com uma conta de cada plano (Basic, Trial ativo, Trial vencido, PRO, Premium) e verificar o selo, o bloqueio e a resposta da API ao tentar salvar.

**Acceptance Scenarios**:

1. **Given** uma conta com acesso, **When** abre a tela, **Then** vê o selo "PRO" no título e no item de menu, e consegue editar e salvar.
2. **Given** uma conta sem acesso, **When** abre a tela, **Then** vê o comportamento definido em FR-017 (bloqueio com explicação e botão de conhecer o plano), e os campos não são editáveis.
3. **Given** uma conta sem acesso, **When** tenta salvar pela API, **Then** recebe recusa com mensagem em linguagem simples e nada é gravado.
4. **Given** uma conta Premium, **When** abre a tela, **Then** tem o mesmo acesso de uma conta PRO (hoje a tela a bloqueia por engano e mostra upsell indevido).
6. **Given** uma conta Trial ativo, **When** abre a tela, **Then** tem acesso completo; **Given** uma conta Trial vencido ou Basic, **Then** vê a tela bloqueada (FR-017).
5. **Given** uma conta que perde o acesso (plano vence ou cai para Basic), **When** o robô continua enviando, **Then** a proteção NÃO é desligada: o robô passa a usar o ritmo padrão seguro (FR-019), e a cliente só perde a possibilidade de ajustar.

---

### Edge Cases

- Conta com valores personalizados nos campos que viram fixos (ex.: uma conta que configurou 1 envio a cada 10 minutos num canal): o tratamento é o de FR-011: como 1 envio a cada 10 minutos é mais conservador que o fixo (6 a cada 10 min), a conta mantém o próprio valor. Em nenhuma hipótese a mudança pode deixar uma conta **mais rápida** do que ela tinha escolhido — isso aumentaria o risco de banimento justamente de quem escolheu ir devagar.
- Conta com valor personalizado **mais rápido** que o fixo (ex.: atraso entre canais em 0 s, limites do destino desligados, variação de imagem desligada): passa ao valor fixo. É a única mudança de comportamento prevista pela feature e sempre no sentido de **mais seguro**; a fase de plano deve medir quantas contas estão nessa situação antes do deploy e registrar o número.
- Campo com mais de um eixo (rajada = quantidade + janela): a comparação de "mais conservador" é feita **por campo, separadamente** (ver FR-011), nunca pela combinação — assim nenhum dos dois eixos fica mais permissivo do que estava.
- Conta com vários presets nomeados e destinos atribuídos a eles: a tela nova precisa continuar mostrando e aplicando a mesma configuração efetiva de cada destino, mesmo que a palavra "preset" suma da tela (ex.: vire "modelos de ritmo" ou escolha Conservador/Equilibrado/Rápido).
- Conta sem nenhum destino cadastrado: a tela mostra o ajuste da conta e uma frase explicando que o ritmo por grupo aparece quando ela tiver grupos de envio, com atalho para Espelhamento.
- Conta com muitos destinos (dezenas): a escolha do destino precisa continuar usável no celular (lista com busca ou agrupada), sem largura fixa que estoure a tela (regra do RCA de 2026-09-05 sobre balões/diálogos no celular).
- Salvar com valor fora da faixa permitida: a tela explica em frase qual é a faixa, e nada é gravado parcialmente.
- Trial que vence com a tela aberta: a próxima tentativa de salvar é recusada com a mesma mensagem de bloqueio; nenhum dado é perdido.
- O painel de saúde (antigo Monitoramento) sem dados ainda (conta nova): mostra estado "ainda sem medições" — nunca verde por ausência de dado.

## Requirements *(mandatory)*

### Functional Requirements

**Unificação e localização**

- **FR-001**: O painel MUST ter um único ponto de entrada, chamado **"Anti-banimento"**, para toda a proteção do número da cliente contra banimento, substituindo as três telas atuais do grupo "Preservação avançada" (Monitoramento, Preservação por grupo e canal, Configurações avançadas).
- **FR-002**: A tela única MUST organizar o conteúdo em, no máximo, três partes na ordem de uso: (1) **Situação** — como o número está protegido agora (conteúdo do antigo Monitoramento, só leitura); (2) **Ritmo por grupo** — o que vale para cada grupo/canal de destino; (3) **Ajustes da conta** — o que vale para todos os destinos.
- **FR-003**: A tela única MUST ficar como **item próprio no menu lateral**, dentro do agrupamento de configuração/conta (junto de "Conexão WhatsApp" e "Minhas credenciais"), e NÃO dentro de Espelhamento. Racional: a proteção vale também para Filas, Ofertas automáticas e Enviar agora, não só para espelhamento; colocá-la dentro de Espelhamento esconderia o recurso de quem só usa filas e sobrecarregaria uma tela que acabou de ser reorganizada (RCA 2026-09-19: "ver no nível 1, configurar no nível 2").
- **FR-004**: O painel de destino em Espelhamento MUST manter o bloco de saúde daquele destino e oferecer um atalho que abre a tela única já com aquele destino selecionado (sem duplicar os controles de edição em dois lugares).
- **FR-005**: Os endereços antigos do módulo MUST continuar respondendo, redirecionando para a parte correspondente da tela única (mesma estratégia usada quando `/painel/grupos` virou `/painel/espelhamento`).
- **FR-006**: Todo texto que hoje aponta para as telas antigas (links no Espelhamento, mensagens de erro de plano, upsell, e-mails, tutorial) MUST passar a apontar para a tela única com o nome "Anti-banimento".
- **FR-006a**: A tela de **Conexão WhatsApp** MUST NOT conter controles de proteção anti-banimento; se a fase de plano encontrar algum (o levantamento de 2026-09-23 não achou), ele MUST ser removido dali e passar a existir só na tela "Anti-banimento", deixando no lugar no máximo um atalho para ela. **Ponto em aberto para o plan.md**: confirmar no código que não há nada a mover e, se houver, listar o quê.

**Nome**

- **FR-007**: A funcionalidade MUST ter um nome único, leigo, usado igual no menu, no título da tela, no selo de upsell, nas mensagens de erro de plano e na página de preços. Os nomes "Módulo de Preservação Avançada", "Preservação avançada", "Preservação Pro" e "Preservação por grupo e canal" MUST sair de todas as telas da cliente.
- **FR-008**: O nome oficial da funcionalidade é **"Anti-banimento"** (decisão da dona do produto, 2026-09-23). É o termo mais usado no mercado brasileiro para esse recurso, então é o que a cliente reconhece e busca. Usado igual em: item de menu, título da tela, selo/upsell, mensagens de erro de plano, atalho no Espelhamento, e-mails, tutorial e página de preços. Texto de apoio pode explicar em frase ("protege seu número contra banimento do WhatsApp"), mas o nome não varia.
- **FR-008a**: O nome "Anti-banimento" MUST NOT ser acompanhado de promessa de que o número não será banido. A tela e o upsell dizem que o recurso **reduz o risco** (limite canônico do AGENTS.md: "entrar pela palavra banido/anti-ban não pode virar promessa de que não banem").

**Campos: fixos vs. editáveis**

- **FR-009**: Todo campo que continuar editável MUST ser apresentado em frase do dia a dia com exemplo, e continuar oferecendo as escolhas prontas (hoje Conservador / Médio / Leve), renomeadas em linguagem leiga (ex.: "Bem devagar", "Equilibrado", "Mais rápido").
- **FR-010**: A classificação de cada campo exposto hoje MUST seguir esta tabela; o tratamento de contas com valor personalizado nos campos fixos segue FR-011:

| Campo atual (tela antiga) | Recomendação | Frase na tela nova (se editável) | Valor fixo (se fixo) |
|---|---|---|---|
| Intervalo mínimo entre envios | **Editável** | "Esperar pelo menos X minutos entre uma oferta e outra neste grupo" | — |
| Limite diário | **Editável** | "No máximo X ofertas por dia neste grupo (vazio = sem limite)" | — |
| Horário de funcionamento (liga/desliga, início, fim) | **Editável** | "Enviar só entre Xh e Yh" | — |
| Descartar oferta que esperou mais de X min | **Editável** (avançado, recolhido) | "Se a oferta ficar esperando mais de X horas, não enviar (já pode estar sem estoque)" | — |
| Máximo de envios na janela ("tamanho da rajada") | **Fixo** | — | 6 (padrão atual) |
| Janela de rajada (segundos) | **Fixo** | — | 600 s = 10 min (padrão atual) |
| Liga/desliga dos limites anti-ban do destino | **Fixo ligado** | — | ligado (padrão atual) |
| Atraso entre canais | **Fixo** | — | 20 s (padrão atual, RCA 2026-07-28: aumentar atrasa TODOS os envios da conta) |
| Limite de seguidas por dia (canais) | **Editável** | "Seguir no máximo X canais por dia" | — |
| Variação de imagem | **Fixo ligado** | — | ligado (padrão atual) |
| Observador externo (liga/desliga) | **Editável** (parte Situação) | "Vigiar se seus canais estão sendo escondidos" | — |

- **FR-011**: Os campos que viram fixos são exatamente cinco, e a migração segue a regra **"vale o mais conservador entre o valor que a conta já tinha e o valor fixo"** (decisão Q2 = opção C). O valor fixo vale para todas as contas, exceto as que já tinham gravado um valor mais conservador, que mantêm o próprio valor. A comparação é feita **campo a campo**, e o sentido de "mais conservador" depende do campo:

| Campo que vira fixo | Valor fixo | "Mais conservador" significa | Conta mantém o próprio valor quando | Conta passa ao fixo quando |
|---|---|---|---|---|
| Tamanho da rajada (máximo de envios na janela), por destino/modelo | 6 envios | valor **menor** (menos envios por janela) | valor gravado < 6 | valor gravado > 6 |
| Janela da rajada, por destino/modelo | 600 s (10 min) | valor **maior** (janela mais longa) | valor gravado > 600 s | valor gravado < 600 s |
| Liga/desliga dos limites do destino, por destino/modelo | ligado | **ligado** | está ligado (coincide com o fixo) | está desligado → passa a ligado |
| Atraso entre canais, conta | 20 s | valor **maior** (mais espera) | valor gravado > 20 s | valor gravado < 20 s (inclusive 0) |
| Variação de imagem, conta | ligado | **ligado** | está ligado (coincide com o fixo) | está desligado → passa a ligado |

  Regras complementares:
  - Valor igual ao fixo: nada muda.
  - Destino ou modelo **sem valor próprio** (herdando) continua herdando; a regra se aplica em cada nível onde houver valor gravado (destino, modelo, conta), e a precedência de FR-014/Key Entities não muda.
  - A regra vale para sempre, não só no momento do deploy: o valor efetivo usado pelo robô é sempre o mais conservador entre o gravado e o fixo, então dado legado e requisição antiga (FR-013) nunca deixam o envio mais permissivo que o fixo.
  - Como os campos saem da tela, a conta que ficou com valor mais conservador não consegue mais editá-lo pela tela; a fase de plano deve decidir se a tela mostra uma frase informativa ("este grupo usa um ritmo mais cuidadoso que o padrão") para que tela e robô não pareçam discordar.
- **FR-012**: Todo campo que deixar de ser exibido MUST continuar existindo no banco como **dormente** (sem remoção de coluna, sem migration destrutiva), documentado no AGENTS.md, no mesmo padrão já usado para `Group.imageMode` e para os campos de throttle da conta que já são dormentes.
- **FR-013**: As rotas atuais de configuração de proteção (conta, presets e destino) MUST continuar aceitando os campos que viraram fixos sem retornar erro e sem descartar o restante da requisição; o valor recebido nesses campos é tratado pela regra de FR-011 (vale o mais conservador entre o recebido e o fixo; valor menos conservador que o fixo não tem efeito no envio).
- **FR-014**: A mudança MUST NOT alterar o ritmo efetivo de envio de nenhuma conta que esteja com os valores padrão; o comportamento do robô (cadência, horário, descarte por idade, espera entre canais) permanece o mesmo, exceto, por FR-011, as contas que tinham gravado valor menos conservador que o fixo — que passam ao fixo, sempre no sentido de mais seguro.

**Plano / acesso**

- **FR-015**: A regra de quem tem acesso MUST morar num único lugar — a regra de direito por plano que o backend já usa hoje (`canUseAdvancedPreservation`) — e a tela MUST consumir essa mesma regra (por exemplo, via o direito já calculado pelo backend e entregue ao painel), sem reimplementar uma checagem própria de plano. Tela e API não podem discordar sobre quem tem acesso.
- **FR-015a**: A checagem própria da tela que existe hoje (`canAccessAdvancedPreservation`, que libera PRO e Trial mas **esquece o Premium** e mostra upsell indevido para conta Premium) MUST ser corrigida como parte desta feature, deixando de ser uma segunda fonte da regra. Uma verificação automatizada MUST falhar se tela e backend voltarem a divergir para qualquer um dos cinco perfis de SC-006.
- **FR-016**: Os planos com acesso são **PRO, Premium e Trial ativo** — exatamente o que o backend libera hoje (decisão Q3 = opção A). Basic, Trial vencido e conta sem plano não têm acesso. O selo mostra "PRO" (nome comercial do recurso), mas Premium e Trial ativo usam a tela sem nenhum bloqueio ou upsell.
- **FR-017**: Para conta sem acesso, a tela MUST aparecer no menu com selo "PRO" e abrir **visível e bloqueada**: um resumo em linguagem simples do que o recurso faz (sem jargão), o aviso de que o robô já a protege com o ritmo padrão seguro, e um botão para conhecer o plano PRO. Ela NÃO é ocultada — ocultar esconde o motivo de pagar.
- **FR-018**: A API MUST recusar gravações de conta sem acesso com mensagem leiga (ex.: "O Anti-banimento é um recurso do plano PRO."), sem gravar nada, e registrar essa recusa como já é feito para os demais recursos por plano.
- **FR-019**: Conta sem acesso (ou que perdeu acesso) MUST continuar protegida pelo ritmo padrão seguro; perder o plano nunca desliga a proteção. O que valia gravado para essa conta enquanto ela tinha acesso segue a mesma regra de hoje para contas que caem de plano (a fase de plano deve confirmar e documentar qual é).
- **FR-020**: O selo "PRO" MUST aparecer no item de menu, no título da tela e no atalho do Espelhamento, e não pode depender só de cor (texto "PRO" visível).

**Linguagem**

- **FR-021**: Nenhum termo técnico da lista do cenário US2-1 pode aparecer em tela, dica, erro ou e-mail relacionado; uma verificação automatizada MUST falhar se algum voltar, como já existe em outras superfícies do painel.

### Key Entities

- **Configuração de proteção da conta**: ajustes que valem para todos os destinos (hoje: atraso entre canais, limite de seguidas, variação de imagem, observador). Parte vira fixa, parte continua editável.
- **Modelo de ritmo** (hoje "preset"): um conjunto nomeado de ritmo (intervalo, limite diário, horário, descarte por idade, e os campos que viram fixos) que pode ser atribuído a vários destinos; um deles é o padrão da conta.
- **Ritmo de um destino**: a configuração efetiva de um grupo/canal de envio — ajuste próprio do destino, senão o modelo atribuído, senão o padrão da conta, senão o padrão do sistema. A ordem de precedência não muda.
- **Direito de acesso por plano**: regra única (a do backend) que diz se a conta pode ajustar o Anti-banimento: PRO, Premium e Trial ativo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma cliente PRO encontra e altera o ritmo de um grupo específico em até 2 cliques a partir de qualquer tela do painel, sem passar por outra tela de configuração.
- **SC-002**: O número de itens de menu relacionados à proteção cai de 3 para 1.
- **SC-003**: Zero termos técnicos da lista proibida nas telas da funcionalidade (verificado automaticamente).
- **SC-004**: 100% das contas com valores padrão mantêm exatamente o mesmo ritmo efetivo de envio antes e depois da mudança (conferido comparando a configuração efetiva resolvida de cada destino antes/depois em staging).
- **SC-005**: Nenhuma conta passa a enviar mais rápido do que a configuração que tinha antes (conferido em staging comparando, destino a destino, o valor efetivo antes/depois em cada um dos cinco campos de FR-011: nenhum pode ficar menos conservador).
- **SC-005a**: 100% das contas com acesso Premium abrem a tela sem upsell (hoje 0%).
- **SC-006**: Tela e API concordam em 100% dos casos sobre quem tem acesso, para os cinco perfis (Basic, Trial ativo, Trial vencido, PRO, Premium).
- **SC-007**: Todos os endereços antigos do módulo abrem a tela nova (nenhum erro de página não encontrada).
- **SC-008**: Queda no volume de dúvidas de suporte do tipo "onde configuro o limite/horário do grupo" nas 4 semanas após a entrega, comparada às 4 semanas anteriores.

## Assumptions

- A mudança é de **onde e como a cliente configura**, não de como o robô envia. Nenhum valor efetivo muda por padrão (AGENTS.md: "Atraso entre canais", "Fila entupida por UM destino", ordem canônica de `processSendJob`).
- A precedência de configuração por destino (ajuste do destino → modelo atribuído → padrão da conta → padrão do sistema) permanece como está.
- Não há rota de API nova obrigatória; as rotas atuais continuam, com compatibilidade retroativa. Nenhum processo novo, nenhuma dependência nova: **zero impacto de RAM** (política de memória do AGENTS.md).
- Os campos de throttle da conta que já são dormentes (`channelMinIntervalSec`, `channelBurstCap`, `channelBurstWindowSec`, `channelThrottleEnabled`, `channelQuietHoursJson`, `quietHoursEnabled`) continuam dormentes e não voltam para a tela.
- "Variação de texto" (`copyVariationEnabled`) e o conjunto de frases variáveis não fazem parte do escopo desta tela, salvo se a fase de plano achar que estão expostos hoje; se estiverem, entram na tabela de FR-010.
- A localização (FR-003: item próprio no menu de configuração de conta, com atalho no painel de destino do Espelhamento) e o comportamento para quem não tem acesso (FR-017: visível com selo PRO e bloqueada com botão de upgrade) ficam mantidos como decididos. A alternativa avaliada e descartada foi colocar dentro de Espelhamento (rejeitada porque a proteção vale para todos os tipos de envio) e dentro de "Plano"/"Conta" (rejeitada porque mistura cobrança com operação diária).
- A tela de Conexão WhatsApp não tem controles de proteção no código atual; ainda assim, é **ponto em aberto para o plan.md** confirmar isso e, se houver algum controle, removê-lo/redirecioná-lo para a tela "Anti-banimento" (FR-006a).
- Fluxo canônico do repositório: esta spec nasce na branch `018-unificar-protecao-anti-ban` criada a partir de `develop`; PR contra `develop`, validação em staging (`http://178.105.54.0:3006`) antes de `develop → main`; nunca push direto em `develop`.
- A página pública de preços e o upsell passam a usar o nome "Anti-banimento"; a mudança de texto em página pública indexada segue as regras de SEO do AGENTS.md, incluindo o limite de não prometer que o número não será banido (FR-008a).

## Pontos em aberto para a fase de plano

- Confirmar no código que a tela de Conexão WhatsApp não tem controles de proteção; se tiver, listar e mover (FR-006a).
- Medir, em produção (read-only) antes do deploy, quantas contas/destinos têm valor menos conservador que o fixo em cada um dos cinco campos de FR-011 — são as únicas que mudam de comportamento (sempre para mais seguro).
- Decidir onde a regra "mais conservador entre gravado e fixo" é aplicada (na leitura da configuração efetiva, e/ou por migration DML não destrutiva), garantindo que valha também para requisições antigas (FR-013).
- Decidir como a tela mostra destino que ficou com ritmo mais cuidadoso que o padrão (FR-011, última regra complementar).
- Confirmar o que acontece hoje com a configuração gravada quando a conta perde o acesso (FR-019).
