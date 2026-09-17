# Feature Specification: Arquitetura multicanal de entrega (WhatsApp, Telegram e Story do Instagram)

**Feature Branch**: `017-multicanal-telegram-instagram`

**Created**: 2026-09-17

**Status**: Draft — contém 3 perguntas de clarificação em aberto

**Input**: User description: "Arquitetura multicanal de entrega — a mesma estrutura de espelhamento/ofertas passa a entregar em WhatsApp, Telegram e Story do Instagram, conforme escolha da cliente. Multicanal de verdade (a MESMA estrutura alimenta os três), a cliente escolhe o canal por destino, escalável e sem impactar o que já existe, e a estrutura deve crescer de forma saudável."

**Base de partida**: levantamento read-only do código em `scratchpad/levantamento-multicanal.md` (HEAD `66bc013`). A spec parte dele; nada aqui re-descobre o que já foi levantado.

---

## Contexto do produto

Hoje o produto entrega **somente no WhatsApp**. Tudo que a cliente monta — grupos de origem monitorados, grupos/canais de destino, filas de oferta, ofertas automáticas, conversão de link de afiliada, palavras bloqueadas, modelos de texto, preservação (ritmo/anti-ban) — existe uma vez só e termina num único ponto de envio, que fala WhatsApp.

Isso cria dois problemas. O primeiro é comercial: dez dos quatorze concorrentes mapeados já entregam também no Telegram, e a dona do produto quer publicar Stories do Instagram. O segundo é estrutural: se cada aplicativo novo virar um produto paralelo (sua própria origem, sua própria fila, sua própria conversão, seu próprio histórico), o custo de manutenção multiplica e as regras passam a divergir em silêncio — o mesmo modo de falha que o projeto já sofreu quando a mesma lógica existiu em dois lugares.

O que esta feature entrega é a **separação entre "o que publicar" e "onde publicar"**. O miolo do produto (origem → conversão → texto → fila → ritmo → registro) passa a ser um só, e cada aplicativo vira apenas a última etapa: quem sabe falar com aquele aplicativo. A cliente escolhe, **por destino**, em qual aplicativo aquele destino recebe.

O WhatsApp está em produção com dezenas de contas conectadas, e toda a preservação anti-ban existe por causa dele. **A regra que governa esta feature inteira é: o WhatsApp não pode regredir em nenhum caminho.**

---

## Vocabulário (leia antes de qualquer outra seção)

O repositório já usa duas palavras que **não podem** ser reaproveitadas aqui, sob pena de tornar o código e as telas ambíguos:

| Palavra já ocupada | O que já significa hoje | Onde |
|---|---|---|
| **"canal" / `channel`** | **Canal do WhatsApp** (`@newsletter`) — um tipo de destino dentro do WhatsApp | `Group.kind='channel'`, botão "Ver canal", `BotConfig.channel*`, comandos do supervisor |
| **"plataforma" / `platform`** | **LOJA / marketplace** (Shopee, Amazon, Mercado Livre, Magalu, SHEIN, AliExpress) | `BotConfig.platforms`, `Credential.platform`, `MessageLog.platform` |

Esta feature cunha um termo **novo e inequívoco**:

- **Termo canônico interno: "rede de entrega"** (`deliveryNetwork`), com os valores `whatsapp`, `telegram`, `instagram`.
- **Palavra usada com a cliente: "aplicativo"** — "Em qual aplicativo este destino recebe as ofertas?". É a palavra que ela já usa e não colide com nada na tela.

**FR de vocabulário (valem para código, telas, textos, registros e mensagens de erro):**

- Nenhuma superfície nova pode usar `channel`/"canal" nem `platform`/"plataforma" para se referir a WhatsApp, Telegram ou Instagram.
- Os valores da rede de entrega não podem colidir com os valores já existentes de `Group.kind` (`group`, `channel`).
- A cliente nunca lê "rede de entrega", "adaptador", "driver", "transporte", "Bot API", "Graph API", "webhook" ou "token" em nenhuma tela.

---

## Decisão de escopo: o Instagram entra nesta rodada?

**Decisão: NÃO entra como entrega funcional nesta rodada. Entra como rede declarada, com o modelo de dados e o contrato de entrega já preparados para recebê-la, e com uma fase 2 explicitamente definida.**

**Justificativa (não é adiamento por conveniência — é diferença de natureza):**

1. **Story do Instagram não é mensageria, é publicação.** Não existe "grupo de destino": a publicação vai para o perfil. Não existe espelhamento 1:1 (uma mensagem de origem → uma mensagem no destino); existe uma cota diária de publicações do perfil inteiro. Boa parte do que a cliente já configurou — modelo de texto, palavras bloqueadas por grupo, ritmo por destino, dedup por destino — muda de significado ou deixa de existir.
2. **O texto não é texto.** No Story não há corpo de mensagem: o texto vira sobreposição na imagem e o link vira adesivo. A "oferta" precisa ser redesenhada como peça visual 9:16, não como mensagem.
3. **A mídia é obrigatória e precisa estar em endereço público.** Hoje a oferta pode sair sem foto; no Story, sem imagem não há publicação. E a imagem precisa ser hospedada em endereço acessível publicamente, o que é uma capacidade que o produto não tem hoje.
4. **A conexão da conta é de outra natureza** (conta comercial vinculada a página, autorização que vence e precisa ser renovada sozinha) e cria uma superfície de falha silenciosa nova.
5. **Risco de moldar a abstração pelo caso mais divergente antes de ela estar provada.** Fazer os três de uma vez obriga a desenhar o contrato de entrega para publicação e para mensageria ao mesmo tempo, sem nenhum dos dois em produção — e o preço do erro recai sobre o WhatsApp, que é o produto vivo.

**O que "preparado para receber" significa, de forma verificável (não é promessa vaga):**

- O modelo de dados não pode assumir em nenhum lugar que um destino é uma conversa com outra pessoa. Um destino que é "o próprio perfil da cliente" tem que caber sem migração destrutiva.
- Cada rede **declara** o que sabe fazer (aceita texto? aceita botão? exige imagem? tem cota por dia? tem destinos múltiplos?), e o produto lê essa declaração em vez de deduzir por `if rede === 'whatsapp'`.
- Existe uma rede **fictícia, só de teste**, com capacidades reduzidas de publicação (exige imagem, não aceita texto longo, um destino só), que exercita o contrato de ponta a ponta. É ela que prova que a estrutura cresce sem reescrita — e prova hoje, não na fase 2.

**Fase 2 (fora do escopo desta spec, declarada para não sumir):** entrega em Story do Instagram, incluindo conexão da conta comercial, geração da peça 9:16, adesivo de link, cota diária e aviso de autorização vencida.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quem usa só WhatsApp não percebe nada (Priority: P1)

Uma cliente que hoje usa o produto só com WhatsApp abre o painel depois desta entrega e encontra tudo exatamente como deixou: os mesmos grupos de origem, os mesmos destinos, as mesmas filas, as mesmas ofertas automáticas, o mesmo histórico, a mesma preservação. As ofertas continuam saindo do mesmo jeito, com o mesmo formato, no mesmo ritmo. Ela não precisa escolher nada, migrar nada, nem reconectar nada.

**Why this priority**: é o requisito mais forte da dona do produto e a única coisa que não pode dar errado. Dezenas de contas em produção dependem disso; uma regressão aqui custa ofertas perdidas, sessões derrubadas e risco de banimento.

**Independent Test**: com uma conta só de WhatsApp, comparar antes e depois — mesmos destinos listados, mesma aparência da oferta publicada no grupo, mesmo registro no histórico, mesmo comportamento de ritmo e de bloqueio por repetição. Nenhuma ação da cliente é exigida.

**Acceptance Scenarios**:

1. **Given** uma conta com destinos, filas e ofertas automáticas já configurados só em WhatsApp, **When** a feature entra no ar, **Then** todos os destinos continuam funcionando sem que a cliente edite ou reconecte qualquer coisa.
2. **Given** um destino de WhatsApp existente sem nenhuma informação de aplicativo gravada, **When** uma oferta é espelhada para ele, **Then** ele é tratado como WhatsApp e a oferta sai com o mesmo conteúdo, formato e ritmo de antes.
3. **Given** um destino que é Canal do WhatsApp (`@newsletter`) com botão "Ver canal" ligado, **When** a oferta é publicada, **Then** o comportamento é idêntico ao de hoje, incluindo o botão.
4. **Given** uma oferta que hoje é bloqueada por repetição, por palavra bloqueada, por horário de funcionamento ou por idade na fila, **When** a mesma situação ocorre depois da feature, **Then** ela é bloqueada pelo mesmo motivo e o histórico mostra a mesma explicação.
5. **Given** a sessão de WhatsApp conectada, **When** a feature entra no ar, **Then** nenhuma sessão é desconectada, nenhum novo pareamento é exigido e nenhum código de acesso é apagado.

---

### User Story 2 - Conectar o Telegram sem QR, em poucos minutos (Priority: P1)

A cliente entra no painel, encontra o Telegram ao lado do WhatsApp e conecta seguindo um passo a passo em linguagem simples. Não existe leitura de QR nem pareamento por celular: ela informa o dado de acesso do robô e adiciona o robô ao grupo/canal onde quer receber as ofertas. Em seguida, os destinos disponíveis no Telegram aparecem para ela escolher, do mesmo jeito que os grupos do WhatsApp aparecem hoje.

**Why this priority**: sem conexão não existe destino de Telegram, e sem destino nada mais desta feature entrega valor.

**Independent Test**: conectar o Telegram numa conta de teste e ver os destinos aparecerem na lista; repetir com dado de acesso inválido e com o robô fora do grupo, e conferir que os dois casos são explicados sem jargão.

**Acceptance Scenarios**:

1. **Given** a cliente sem Telegram conectado, **When** ela informa um dado de acesso válido, **Then** o Telegram passa a constar como conectado e a tela mostra o nome do robô que ficou responsável.
2. **Given** o dado de acesso informado é inválido ou foi revogado, **When** ela tenta salvar, **Then** o sistema recusa na hora e explica, sem jargão, o que fazer.
3. **Given** o Telegram conectado e o robô **ainda não** adicionado a nenhum grupo/canal, **When** ela abre a lista de destinos, **Then** a lista aparece vazia com uma explicação do próximo passo, e não como erro.
4. **Given** o robô adicionado a um grupo mas **sem permissão de publicar**, **When** ela tenta escolher esse destino, **Then** o sistema avisa em linguagem simples que falta a permissão, e qual é.
5. **Given** o Telegram conectado, **When** ela desconecta, **Then** os destinos de Telegram param de receber, os destinos de WhatsApp continuam inalterados, e nada do histórico é apagado.
6. **Given** o dado de acesso do Telegram guardado, **When** ele é exibido de volta na tela, **Then** aparece mascarado, e é guardado com a mesma proteção em repouso já usada nas credenciais de loja.

---

### User Story 3 - Escolher o aplicativo por destino e receber o espelhamento lá (Priority: P1)

Ao cadastrar um destino, a cliente escolhe em qual aplicativo ele recebe. Um mesmo grupo de origem monitorado pode alimentar, ao mesmo tempo, destinos de WhatsApp **e** destinos de Telegram — não é preciso duplicar a origem, a conversão de link, o modelo de texto nem as palavras bloqueadas. A oferta chega nos dois, cada um com o formato que aquele aplicativo permite.

**Why this priority**: é o coração do pedido — "a MESMA estrutura alimenta os canais" e "a cliente escolhe o canal por destino". Sem isso, seriam dois produtos paralelos.

**Independent Test**: ligar uma origem a um destino de WhatsApp e um de Telegram, publicar uma oferta na origem, e conferir que ela chega nos dois com a comissão da cliente, o mesmo texto base e um registro por destino.

**Acceptance Scenarios**:

1. **Given** uma origem ligada a um destino de WhatsApp e um de Telegram, **When** uma oferta é publicada na origem, **Then** ela é espelhada para os dois, com o link de afiliada da cliente em ambos.
2. **Given** a mesma origem e os mesmos dois destinos, **When** a oferta é montada, **Then** a conversão de link, o modelo de texto, as variações de copy, as palavras bloqueadas e as lojas permitidas são aplicadas **uma vez só** e valem para os dois.
3. **Given** um destino cuja lista de origens ligadas está vazia por escolha explícita, **When** uma oferta chega, **Then** ele não recebe nada — a regra atual de "lista explícita vazia nunca significa todos" continua valendo, independentemente do aplicativo.
4. **Given** um destino de Telegram e um de WhatsApp com o mesmo identificador numérico/textual, **When** os dois são cadastrados, **Then** os dois coexistem sem conflito e cada um recebe o que lhe cabe.
5. **Given** um destino já cadastrado, **When** a cliente abre sua configuração, **Then** o aplicativo daquele destino é exibido claramente e não pode ser trocado por outro aplicativo (o identificador pertence a um aplicativo só).
6. **Given** uma oferta bloqueada por repetição num destino, **When** o outro destino é de outro aplicativo, **Then** o bloqueio de um **não** impede a entrega no outro — cada destino tem sua própria janela.

---

### US4 - Filas e ofertas automáticas entregam no Telegram sem configuração nova (Priority: P2)

As filas de oferta e as ofertas automáticas que a cliente já monta hoje passam a aceitar destino de Telegram exatamente como aceitam destino de WhatsApp. Ela não configura nada a mais: escolhe o destino na mesma lista de sempre.

**Why this priority**: é o que transforma "espelhar no Telegram" em "o produto inteiro funciona no Telegram". Depende da entrega base (US3) existir, por isso P2.

**Independent Test**: apontar uma fila e uma oferta automática existentes para um destino de Telegram e conferir que os envios saem, respeitam o ritmo daquele destino e aparecem no histórico.

**Acceptance Scenarios**:

1. **Given** uma fila de ofertas com destinos de WhatsApp e de Telegram, **When** ela drena, **Then** cada item é entregue nos dois, com um registro por destino.
2. **Given** uma oferta automática apontada para um destino de Telegram, **When** ela roda, **Then** a mesma proteção contra repetir o mesmo produto no mesmo destino continua valendo.
3. **Given** uma mensagem agendada com destinos em aplicativos diferentes, **When** ela dispara, **Then** todos os destinos recebem, e a falha em um **não** impede a entrega nos demais.
4. **Given** um destino de Telegram temporariamente indisponível, **When** a fila drena, **Then** os destinos de WhatsApp continuam saindo no ritmo normal — um aplicativo lento nunca segura os outros.

---

### US5 - A cliente entende o que aconteceu, em qualquer aplicativo (Priority: P2)

No histórico, cada linha diz **em qual aplicativo** a oferta saiu e, quando não saiu, **por quê**, em linguagem simples. Quando o Telegram para de funcionar (dado de acesso revogado, robô removido do grupo, permissão retirada), a cliente é avisada — não descobre porque as ofertas sumiram.

**Why this priority**: o modo de falha mais caro do projeto é o silencioso. Um aplicativo novo dobra a superfície de "parou e ninguém percebeu".

**Independent Test**: provocar cada falha de Telegram (dado revogado, robô removido, sem permissão, limite de ritmo do aplicativo) e conferir que o histórico e o aviso descrevem o caso certo, sem jargão.

**Acceptance Scenarios**:

1. **Given** uma oferta entregue, **When** a cliente abre o histórico, **Then** a linha identifica o aplicativo pelo qual ela saiu.
2. **Given** uma oferta já registrada antes desta feature, **When** a cliente abre o histórico, **Then** ela aparece como WhatsApp, sem lacuna nem "desconhecido".
3. **Given** o robô do Telegram foi removido do grupo de destino, **When** uma oferta tenta sair, **Then** a linha explica que o robô não está mais no grupo e o que fazer, e a cliente recebe um aviso.
4. **Given** o dado de acesso do Telegram foi revogado, **When** o sistema percebe, **Then** a cliente é avisada uma vez, com o que fazer, e os destinos de WhatsApp seguem sem nenhum aviso ou interrupção.
5. **Given** uma falha de Telegram, **When** o aviso é gerado, **Then** ele nunca afirma que as ofertas de WhatsApp pararam, e vice-versa.

---

### US6 - Cada aplicativo tem o seu ritmo e a sua aparência, sem esconder a diferença (Priority: P3)

O que cada aplicativo consegue fazer é diferente, e o produto diz isso em vez de fingir que é tudo igual. A cliente não vê opções que aquele aplicativo não suporta, e quando uma oferta precisa sair mais simples do que sairia no WhatsApp, isso é declarado — não acontece em silêncio.

**Why this priority**: evita o pior desfecho de uma abstração: a cliente configurar algo que nunca teve efeito. Mas a entrega básica já vale sem isso, por isso P3.

**Independent Test**: abrir a configuração de um destino de Telegram e conferir que as opções exclusivas do WhatsApp não aparecem; publicar uma oferta cujo formato completo não cabe no Telegram e conferir que ela sai degradada e que o registro diz o que foi reduzido.

**Acceptance Scenarios**:

1. **Given** um destino de Telegram, **When** a cliente abre sua configuração, **Then** as opções que só existem no WhatsApp (botão "Ver canal", por exemplo) não são oferecidas.
2. **Given** uma oferta com um recurso que o aplicativo de destino não suporta, **When** ela é publicada, **Then** ela **sai** na melhor forma possível naquele aplicativo, e o registro diz o que foi reduzido.
3. **Given** os limites de ritmo próprios do Telegram, **When** muitas ofertas saem em sequência, **Then** o sistema respeita esses limites sem perder oferta e sem travar os outros destinos.
4. **Given** um destino de WhatsApp, **When** a cliente abre sua configuração, **Then** todas as opções de preservação e formato que existem hoje continuam disponíveis e com o mesmo efeito.

---

### US7 - Um aplicativo novo entra sem reescrita (Priority: P3)

Quando o produto for entregar num quarto aplicativo (Story do Instagram na fase 2, ou outro depois), isso deve custar apenas ensinar ao sistema como falar com aquele aplicativo — e não mexer no espelhamento, na conversão, nas filas, no histórico ou no WhatsApp.

**Why this priority**: é o requisito "crescer de forma saudável". Não entrega valor à cliente hoje, mas é o que impede a próxima rodada de virar reescrita.

**Independent Test**: uma rede fictícia, existente apenas em teste, com capacidades reduzidas de publicação (exige imagem, um destino só, sem botão) é entregue de ponta a ponta sem alterar nenhum arquivo específico de WhatsApp ou de Telegram.

**Acceptance Scenarios**:

1. **Given** a rede fictícia de teste, **When** ela é ligada, **Then** origem, conversão, texto, fila, ritmo, dedup e histórico funcionam com ela sem nenhuma alteração nos módulos compartilhados.
2. **Given** a rede fictícia declara que **não** aceita botão e **exige** imagem, **When** uma oferta sem imagem é enviada a ela, **Then** o sistema trata o caso pela declaração da rede, e não por uma condição escrita especificamente para ela.
3. **Given** um destino de publicação (um destino só, sem conversa do outro lado) na rede fictícia, **When** ele é cadastrado e recebe uma publicação, **Then** o modelo de dados o aceita sem campo vazio forçado e sem alteração destrutiva.

---

### Edge Cases

- **Destino antigo sem aplicativo gravado**: todo destino gravado até hoje é WhatsApp. A ausência do dado nunca pode virar erro, lista vazia ou "desconhecido" — tem que significar WhatsApp.
- **Identificadores iguais em aplicativos diferentes**: o mesmo texto/número pode identificar destinos diferentes em aplicativos diferentes. A unicidade precisa considerar o aplicativo, sem quebrar o que já está gravado.
- **Origem monitorada apontando só para destinos de Telegram**: o espelhamento precisa acontecer normalmente mesmo que nenhum destino seja de WhatsApp.
- **Repetição entre aplicativos**: a mesma oferta saindo no WhatsApp e no Telegram **não** é duplicata — são destinos diferentes. Bloquear o segundo por causa do primeiro perderia oferta legítima.
- **Um aplicativo fora do ar**: a indisponibilidade de um aplicativo não pode atrasar, travar ou derrubar a entrega nos outros — a lição do incidente em que um único destino lento derrubou a vazão de todos.
- **Falha parcial num lote**: um destino que falha não pode abortar os demais do mesmo lote nem apagar o progresso já feito.
- **Robô do Telegram removido do grupo no meio de uma fila**: os envios seguintes falham com motivo próprio e a fila continua para os outros destinos.
- **Limite de ritmo do Telegram atingido**: a oferta é adiada, não perdida, e o adiamento não congela os demais destinos.
- **Cliente conecta Telegram e nunca escolhe destino**: nada muda no WhatsApp; nenhum aviso de erro é gerado.
- **Cliente desconecta o WhatsApp mas mantém o Telegram**: os destinos de Telegram continuam recebendo normalmente.
- **Destino de Telegram apagado enquanto um envio já está na fila**: o envio é descartado antes de sair, pelo mesmo princípio já aplicado hoje aos destinos desligados do WhatsApp.
- **Aviso de conta parada**: os avisos de saúde já existentes não podem passar a disparar em duplicidade só porque a conta agora tem dois aplicativos.

---

## Requirements *(mandatory)*

### Functional Requirements

**Vocabulário e modelo conceitual**

- **FR-001**: O sistema MUST adotar um termo próprio e único para "aplicativo onde a oferta é entregue" (rede de entrega), distinto de "canal" (Canal do WhatsApp) e de "plataforma" (loja), em código, dados, telas, registros e mensagens.
- **FR-002**: Os valores da rede de entrega MUST NOT colidir com valores já usados por `Group.kind` (`group`, `channel`).
- **FR-003**: Para a cliente, o conceito MUST ser apresentado como "aplicativo". Nenhum termo técnico (adaptador, driver, transporte, token, API, webhook) pode aparecer em qualquer texto que ela leia.

**Estrutura compartilhada (multicanal de verdade)**

- **FR-004**: Origens monitoradas, roteamento origem→destino, conversão de link de afiliada, montagem de texto/modelo/variações, palavras bloqueadas, lojas permitidas, dedup, filas de envio, filas de oferta, ofertas automáticas, mensagens agendadas, entitlements e histórico MUST existir **uma vez só** e servir a todas as redes de entrega.
- **FR-005**: Uma mesma origem monitorada MUST poder alimentar destinos de redes diferentes simultaneamente, sem duplicar origem, conversão, modelo de texto ou configuração de conteúdo.
- **FR-006**: A escolha da rede de entrega MUST ser **por destino**, feita pela cliente no cadastro do destino.
- **FR-007**: Cada rede de entrega MUST **declarar** suas capacidades (aceita texto isolado; aceita imagem; exige imagem; aceita botão; aceita card clicável; aceita vídeo; permite marca d'água; tem múltiplos destinos ou destino único; limites de ritmo próprios), e o produto MUST decidir o que oferecer e o que degradar lendo essa declaração, nunca por condição escrita para uma rede específica.
- **FR-008**: O sistema MUST NOT oferecer à cliente, num destino, uma opção que a rede daquele destino não suporta.
- **FR-009**: Quando o formato completo de uma oferta não couber na rede de destino, a oferta MUST ser entregue na melhor forma possível ali (degradação declarada) e o registro MUST dizer o que foi reduzido. Degradação silenciosa é proibida.

**Não-regressão do WhatsApp (invariante da feature)**

- **FR-010**: O comportamento observável do WhatsApp — conteúdo publicado, formato da mensagem, card, foto, botão de canal, marca d'água, ritmo, preservação, dedup, bloqueios, taxonomia de erro e textos do histórico — MUST permanecer idêntico ao de hoje.
- **FR-011**: A entrada desta feature MUST NOT desconectar sessões de WhatsApp, exigir novo pareamento, apagar credencial de sessão ou alterar o estado de qualquer sessão conectada.
- **FR-012**: Nenhum destino, fila, oferta automática, mensagem agendada ou registro já gravado MUST ser reescrito, migrado destrutivamente ou exigir ação da cliente.
- **FR-013**: Um destino sem rede de entrega gravada MUST ser tratado como WhatsApp em todos os caminhos de leitura, sem erro e sem estado "desconhecido".
- **FR-014**: As regras críticas já existentes MUST continuar valendo sem alteração, em particular: lista explícita de destinos vazia nunca significa "todos"; revalidação do destino no momento do envio; descarte por idade na fila; isolamento de falha por item dentro de um lote; preservação e ritmo por destino.

**Conexão e destinos do Telegram**

- **FR-015**: A cliente MUST poder conectar o Telegram informando o dado de acesso do robô, **sem** leitura de QR e **sem** pareamento por celular.
- **FR-016**: O dado de acesso do Telegram MUST ser guardado com a mesma proteção em repouso já aplicada às credenciais existentes, exibido mascarado, e nunca aparecer em endereço, registro, log ou mensagem de erro.
- **FR-017**: O sistema MUST validar o dado de acesso no momento em que a cliente o informa e recusar, em linguagem simples, quando ele for inválido ou revogado.
- **FR-018**: O sistema MUST listar para a cliente os destinos de Telegram disponíveis, e MUST distinguir, em linguagem simples, os três casos: robô não adicionado ao destino; robô adicionado sem permissão de publicar; destino pronto.
- **FR-019**: A cliente MUST poder desconectar o Telegram; ao desconectar, os destinos de Telegram param de receber, o WhatsApp permanece inalterado e nenhum histórico é apagado.
- **FR-020**: A rede de um destino MUST ser definida no cadastro e MUST NOT ser trocada por outra rede depois, já que o identificador do destino pertence a um aplicativo só.

**Entrega, ritmo e isolamento**

- **FR-021**: A indisponibilidade, lentidão ou limite de ritmo de uma rede MUST NOT atrasar, travar ou derrubar a entrega nas demais redes da mesma conta.
- **FR-022**: Os limites de ritmo próprios de cada rede MUST ser respeitados adiando a entrega, nunca descartando a oferta — exceto pelas regras de descarte já existentes (idade na fila, destino desligado, repetição).
- **FR-023**: A dedup MUST tratar destinos de redes diferentes como destinos independentes: a entrega num destino nunca bloqueia a entrega noutro destino de outra rede.
- **FR-024**: A falha de entrega num destino MUST NOT abortar o restante do lote nem apagar o progresso já registrado.
- **FR-025**: A conta da cliente MUST continuar respeitando as regras de preservação já existentes nos destinos de WhatsApp, sem que a existência de destinos de outra rede afrouxe ou altere esses limites.

**Visibilidade e avisos**

- **FR-026**: O histórico MUST registrar, para cada envio, por qual rede de entrega ele saiu.
- **FR-027**: Registros gravados antes desta feature MUST aparecer como WhatsApp, sem lacuna, sem "desconhecido" e sem migração destrutiva.
- **FR-028**: As falhas específicas de cada rede MUST ter motivo próprio, traduzido para linguagem leiga no histórico, dentro da taxonomia de erro já existente.
- **FR-029**: A cliente MUST ser avisada quando uma rede parar de funcionar (dado de acesso revogado, robô removido do destino, permissão retirada), com o que fazer, respeitando as travas de aviso já existentes (conta parada, teto semanal, janela anti-repetição).
- **FR-030**: Nenhum aviso MUST afirmar que as entregas de uma rede pararam quando na verdade pararam as de outra.

**Crescimento saudável**

- **FR-031**: Adicionar uma rede nova MUST NOT exigir alteração nos módulos compartilhados (origem, roteamento, conversão, texto, filas, dedup, preservação, histórico, entitlements) nem em módulos específicos de outra rede.
- **FR-032**: A feature MUST incluir uma rede fictícia, existente apenas em ambiente de teste, com capacidades de publicação reduzidas (destino único, imagem obrigatória, sem botão), exercitada de ponta a ponta como prova verificável do FR-031.
- **FR-033**: O modelo de dados MUST acomodar um destino que é "o próprio perfil da cliente" (publicação, sem conversa do outro lado) sem campo vazio forçado e sem alteração destrutiva futura.
- **FR-034**: O Story do Instagram MUST ser declarado como rede de entrega conhecida e explicitamente **não disponível** nesta rodada; a cliente MUST NOT poder selecioná-lo, e a tela MUST NOT prometer o que ainda não existe.

**Restrições operacionais (condições de aceitação da entrega)**

- **FR-035**: A feature MUST NOT introduzir processo de execução novo por cliente. Qualquer necessidade de processo novo MUST ser sinalizada explicitamente à dona do produto com estimativa de memória antes de ser implementada — o servidor está com folga zero pela política vigente.
- **FR-036**: A entrega do Telegram MUST NOT depender de mudança que quebre o contrato entre a API e o supervisor de sessões. Se um contrato novo for inevitável, o sistema MUST continuar funcionando enquanto as duas pontas estiverem em versões diferentes, sem quebrar o WhatsApp.
- **FR-037**: A feature MUST funcionar sem exigir reinício do supervisor de sessões para entrar em vigor nos caminhos que não são de WhatsApp; onde isso for inevitável, a spec MUST declarar que é decisão humana anunciada (reiniciar reconecta todas as sessões de WhatsApp de uma vez).
- **FR-038**: Toda regra crítica desta feature (não-regressão do WhatsApp, destino sem rede = WhatsApp, isolamento entre redes, dedup por destino, degradação declarada, ausência de opção não suportada) MUST ser coberta por testes automatizados de regressão.

### Key Entities

- **Rede de entrega**: o aplicativo por onde a oferta é publicada (`whatsapp`, `telegram`, `instagram`). Tem nome exibido à cliente, estado de disponibilidade no produto e uma **declaração de capacidades**.
- **Declaração de capacidades da rede**: o que aquela rede sabe fazer (texto, imagem, imagem obrigatória, botão, card, vídeo, marca d'água, destino único vs múltiplos, limites de ritmo). É lida pelo produto para decidir o que oferecer e o que degradar.
- **Destino**: onde a oferta é publicada. Passa a ter, além do identificador que já tem, a rede à qual pertence. Destino sem rede gravada é WhatsApp.
- **Conexão da cliente com a rede**: o que autoriza o produto a publicar naquela rede — sessão pareada no WhatsApp; dado de acesso do robô no Telegram; autorização de conta comercial no Instagram (fase 2). Cada conexão tem estado (conectada, com problema, desconectada) e um motivo em linguagem leiga quando há problema.
- **Oferta neutra**: o conteúdo pronto para publicar, independente de aplicativo (texto, link convertido, imagem, dados do produto). É o que o miolo compartilhado produz e o que cada rede traduz para o seu formato.
- **Registro de envio**: a linha do histórico, que passa a dizer também por qual rede a entrega saiu e, quando houve, o que foi reduzido.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das contas que usam somente WhatsApp continuam entregando sem nenhuma ação da cliente — zero destinos precisando ser reeditados, zero sessões reconectadas, zero pareamentos novos.
- **SC-002**: Zero diferença observável no conteúdo, formato e ritmo das ofertas publicadas no WhatsApp entre antes e depois da entrega, medida em amostra real de ofertas dos dois períodos.
- **SC-003**: 100% dos destinos e registros gravados antes da feature são lidos como WhatsApp, sem lacuna e sem estado "desconhecido".
- **SC-004**: A cliente conecta o Telegram e vê o primeiro destino disponível em menos de 5 minutos, sem abrir suporte e sem consultar documentação externa além do passo a passo da própria tela.
- **SC-005**: Uma oferta publicada numa origem ligada a destinos de dois aplicativos chega aos dois, com o link de afiliada da cliente em ambos, em 100% dos casos de teste.
- **SC-006**: A indisponibilidade total de uma rede por 30 minutos não produz nenhum atraso mensurável nas entregas das demais redes da mesma conta.
- **SC-007**: 100% das falhas específicas do Telegram (acesso revogado, robô removido, sem permissão, limite de ritmo) produzem um motivo próprio no histórico e, quando aplicável, um aviso — nenhuma delas aparece como falha genérica.
- **SC-008**: Nenhum termo técnico aparece em qualquer tela, aviso ou mensagem de erro relacionada a aplicativos de entrega.
- **SC-009**: A rede fictícia de teste é entregue de ponta a ponta sem que nenhum arquivo específico de WhatsApp ou de Telegram seja alterado — prova de que uma rede nova não exige reescrita.
- **SC-010**: A feature entra em produção sem nenhum processo de execução novo e sem aumento mensurável do consumo de memória por conta de WhatsApp.
- **SC-011**: Nenhuma opção não suportada por uma rede é oferecida à cliente num destino daquela rede, verificado em todas as telas de configuração de destino.
- **SC-012**: 100% das ofertas que precisaram sair em formato reduzido registram o que foi reduzido.

---

## Riscos e impactos mapeados

Pedido explícito da dona do produto. Cada item é um modo de falha real, com o comportamento esperado que a implementação precisa garantir.

| # | Risco | Por que é real neste repositório | Comportamento exigido |
|---|---|---|---|
| **R1** | Tocar o ponto único de envio do WhatsApp | O envio real do WhatsApp vive num único ponto, no caminho mais crítico do produto. Abstrair esse ponto mexe em todo envio de todas as contas em produção. | O WhatsApp passa pelo caminho novo produzindo exatamente o mesmo resultado de hoje, coberto por regressão. Nenhuma alteração no conteúdo publicado. |
| **R2** | Contrato entre API e supervisor de sessões é protegido | Mudança que quebre esse contrato exige as duas pontas subindo juntas; em modo remoto, o deploy da API não recarrega os processos de sessão, então as pontas podem ficar em versões diferentes. | A entrega do Telegram não depende de mudança que quebre esse contrato. Se algo novo for inevitável, o sistema tolera as duas pontas divergentes sem quebrar o WhatsApp. |
| **R3** | Custo de memória | O servidor está com folga zero pela política vigente. Um processo por cliente para Telegram estouraria o teto. | Nenhum processo novo por cliente. Qualquer processo novo é decisão humana com estimativa anunciada antes. |
| **R4** | Dedup compartilhada entre redes | A chave de bloqueio por repetição é por destino; se a rede não entrar na identidade do destino, a entrega numa rede pode bloquear a outra em silêncio. | Destinos de redes diferentes são independentes para efeito de repetição. |
| **R5** | Fila de envio serial | Já houve incidente em que um único destino lento derrubou a vazão de todos. Uma rede com limites de ritmo próprios recria exatamente esse cenário. | Lentidão ou indisponibilidade de uma rede não segura nenhuma outra. Espera vira adiamento, nunca bloqueio do consumidor. |
| **R6** | Ambiguidade de vocabulário na tela | "Canal" já significa Canal do WhatsApp para a cliente. Usar a mesma palavra para Telegram criaria confusão direta na configuração de destino. | Termo novo no código; para a cliente, "aplicativo". Proibido reusar "canal" e "plataforma". |
| **R7** | Cotas de plano | Destinos passam a poder ser de aplicativos diferentes; se a cota de destinos do plano não for revista conscientemente, a cliente pode ganhar ou perder direito sem que ninguém tenha decidido isso. | Ver Q2 — decisão comercial pendente, não pode ser inventada. |
| **R8** | Falha silenciosa da nova rede | O modo de falha mais caro do projeto é "parou e ninguém percebeu". Uma rede nova dobra essa superfície. | Toda falha de rede tem motivo próprio, aviso e explicação leiga. Nenhuma falha genérica. |
| **R9** | Código novo não valer nos processos de sessão | Em modo remoto, correção que mora no processo de sessão só passa a valer depois de um reinício que reconecta todas as sessões de WhatsApp. | Onde for inevitável, é decisão humana anunciada; o desenho deve minimizar o que precisa morar ali. |
| **R10** | Unicidade de destino | A unicidade atual de destino não considera aplicativo. Passar a considerar sem cuidado pode recusar destinos já gravados. | Identificadores iguais em aplicativos diferentes coexistem; nada do que já está gravado é recusado. |
| **R11** | Avisos em duplicidade | Os avisos de saúde por conta já existem; uma conta com dois aplicativos pode passar a receber dois avisos pelo mesmo assunto. | As travas de aviso já existentes continuam valendo; nenhum assunto gera aviso duplicado. |
| **R12** | Moldar a abstração pelo caso mais divergente | Story do Instagram é publicação, não mensageria. Desenhar para ele sem nenhuma rede nova provada em produção arrisca uma abstração errada, e o preço recai sobre o WhatsApp. | Instagram fica como fase 2 declarada; o contrato nasce preparado e é provado por uma rede fictícia de teste, não por suposição. |

---

## Assumptions

- Todo destino, fila, oferta automática e registro existente hoje é de WhatsApp; a ausência de informação de rede significa WhatsApp e nunca precisa ser regravada.
- O Telegram nesta rodada é **destino** de entrega (ver Q3 — se ele também for origem monitorada, o escopo muda materialmente).
- A cliente já tem, ou consegue obter, o dado de acesso do robô do Telegram; a feature não cobre criar conta no Telegram.
- A identidade do destino é opaca para o miolo compartilhado — o que muda é quem sabe traduzi-la, não quem a carrega.
- O texto base da oferta continua vindo do grupo de origem e da montagem já existente; cada rede o adapta ao seu formato, sem reescrever a oferta.
- A preservação/anti-ban continua sendo, no WhatsApp, exatamente o que é hoje. Em outras redes, "preservação" significa respeitar os limites daquela rede, não replicar as regras desenhadas para o risco de banimento do WhatsApp.
- Entrega segue o fluxo canônico do projeto: branch → PR contra `develop` → validação em homologação → PR para produção.
- A validação em homologação com uma conta real de Telegram é gate obrigatório antes de produção.

---

## Out of Scope

- Entrega funcional em Story do Instagram (fase 2 declarada; só o preparo do modelo de dados e do contrato entra agora).
- Telegram como **origem** monitorada (pendente de Q3).
- Recursos exclusivos do Telegram sem equivalente no produto (enquetes, respostas automáticas, comandos, botões interativos).
- Migração de destinos existentes de WhatsApp para outro aplicativo.
- Qualquer alteração no comportamento de conversão de link de afiliada, nas lojas suportadas ou na montagem do texto da oferta.
- Qualquer alteração nas regras de preservação/anti-ban do WhatsApp.
- Um quarto aplicativo além dos três citados.

---

## Gate manual obrigatório (antes de produção)

1. Numa conta de homologação só com WhatsApp, comparar antes e depois: destinos listados, oferta publicada num grupo real, oferta publicada num Canal do WhatsApp com botão, histórico e bloqueios. Nenhuma diferença observável.
2. Conectar um robô real de Telegram, adicionar a um grupo real e a um canal real, e conferir a listagem dos destinos nos três estados (não adicionado, sem permissão, pronto).
3. Ligar uma origem real a um destino de WhatsApp e um de Telegram e conferir, no celular, que a mesma oferta chega nos dois com o link de afiliada da cliente.
4. Apontar uma fila e uma oferta automática para um destino de Telegram e conferir entrega, ritmo e histórico.
5. Provocar cada falha de Telegram (acesso revogado, robô removido do grupo, permissão retirada, limite de ritmo) e conferir motivo próprio no histórico, aviso à cliente e ausência total de efeito sobre os destinos de WhatsApp.
6. Manter a conta em observação por 24 h e confirmar que não houve aumento de quedas de sessão de WhatsApp, de consumo de memória, nem avisos duplicados.

---

## Perguntas de clarificação em aberto

Estas três mudam materialmente o trabalho e **não têm resposta padrão razoável**. A spec não as inventou.

### Q1 — O robô do Telegram é da cliente ou é nosso?

**Contexto**: FR-015 a FR-019 descrevem a conexão do Telegram sem dizer de quem é o robô.

**O que precisamos saber**: cada cliente cria e informa o dado de acesso do **robô dela**, ou existe **um robô único do produto** que ela apenas adiciona aos destinos dela?

| Opção | Resposta | Implicações |
|---|---|---|
| A | Cada cliente traz o robô dela | Marca e nome do robô são dela; limites de ritmo são por cliente (não compartilhados); o passo a passo de conexão é mais longo; o suporte precisa ensinar a criar o robô; nós guardamos um dado de acesso por cliente. |
| B | Um robô único do produto | Conexão muito mais simples (ela só adiciona o robô ao grupo); marca nossa aparece nos grupos dela; **os limites de ritmo passam a ser compartilhados entre todas as clientes** — uma cliente em volume alto pode atrapalhar as outras; bloqueio do nosso robô derruba todas de uma vez. |
| C | Padrão é o nosso, com opção de usar o próprio | Melhor experiência inicial e escape para quem quer marca própria; custa manter os dois caminhos. |
| Custom | Outra resposta | Descrever o arranjo desejado. |

### Q2 — Destino de Telegram conta na cota de destinos do plano?

**Contexto**: R7. Os planos hoje limitam quantidade de destinos, e todos são de WhatsApp.

**O que precisamos saber**: um destino de Telegram consome a mesma cota, tem cota própria, ou o multicanal é um diferencial de plano superior?

| Opção | Resposta | Implicações |
|---|---|---|
| A | Mesma cota, sem distinção | Mais simples de explicar e de implementar; quem já paga ganha o aplicativo novo sem pagar mais. |
| B | Cota própria por aplicativo | Mais espaço para a cliente; cobrança e explicação ficam mais complexas; exige nova regra de plano. |
| C | Multicanal só nos planos superiores | Vira alavanca comercial de upgrade; exige bloqueio por plano na tela e no envio, e texto explicando por que ela não pode usar. |
| Custom | Outra resposta | Descrever a regra comercial desejada. |

### Q3 — O Telegram é só destino, ou também origem monitorada?

**Contexto**: o pedido fala em "entregar" nos três aplicativos, o que sugere só destino. Mas espelhar ofertas **de** grupos de Telegram é um caso de uso natural e muda o escopo materialmente.

**O que precisamos saber**: nesta rodada, o Telegram é apenas destino, ou também pode ser grupo de origem monitorado?

| Opção | Resposta | Implicações |
|---|---|---|
| A | Só destino nesta rodada | Escopo menor e mais seguro; a estrutura já nasce capaz de receber origem depois; a cliente continua monitorando origens só no WhatsApp. |
| B | Destino e origem na mesma rodada | Dobra o escopo: leitura de mensagens de grupo, permissões de leitura do robô, ordem e deduplicação de entrada, e um caminho de entrada novo que precisa da mesma blindagem que o de WhatsApp levou anos para ganhar. |
| Custom | Outra resposta | Descrever o escopo desejado. |
