# Feature Specification: Arquitetura multicanal de entrega (WhatsApp, Telegram e Story do Instagram)

**Feature Branch**: `017-multicanal-telegram-instagram`

**Created**: 2026-09-17

**Última atualização**: 2026-09-17 — as três perguntas de clarificação foram respondidas pela dona do produto e estão incorporadas. Nenhuma pergunta de clarificação em aberto.

**Status**: Draft — pronta para `/speckit-plan`

**Input**: User description: "Arquitetura multicanal de entrega — a mesma estrutura de espelhamento/ofertas passa a entregar em WhatsApp, Telegram e Story do Instagram, conforme escolha da cliente. Multicanal de verdade (a MESMA estrutura alimenta os três), a cliente escolhe o canal por destino, escalável e sem impactar o que já existe, e a estrutura deve crescer de forma saudável."

**Base de partida**: levantamento read-only do código em `scratchpad/levantamento-multicanal.md` (HEAD `66bc013`). A spec parte dele; nada aqui re-descobre o que já foi levantado.

---

## Decisões da dona do produto (respondidas em 2026-09-17)

Estas três respostas moldam a spec inteira e estão desenvolvidas em requisitos e riscos ao longo do documento.

| # | Pergunta | Resposta | Onde vira requisito |
|---|---|---|---|
| **D1** | O robô do Telegram é da cliente ou nosso? | **Um robô único do produto.** A cliente apenas o adiciona aos grupos dela. Não existe, nesta rodada, caminho de "robô próprio da cliente". | FR-015 a FR-019, FR-039 a FR-045; riscos R13 e R14 |
| **D2** | Destino de Telegram conta na cota do plano? | **Multicanal só nos planos superiores.** É recurso de plano, não liberado para todo mundo. | FR-046 a FR-051; risco R15 |
| **D3** | Telegram é só destino ou também origem? | **Destino E origem na mesma rodada.** O Telegram também é grupo de origem monitorado. | US8, FR-052 a FR-060; riscos R16 e R17 |

---

## Contexto do produto

Hoje o produto entrega **somente no WhatsApp**. Tudo que a cliente monta — grupos de origem monitorados, grupos/canais de destino, filas de oferta, ofertas automáticas, conversão de link de afiliada, palavras bloqueadas, modelos de texto, preservação (ritmo/anti-ban) — existe uma vez só e termina num único ponto de envio, que fala WhatsApp.

Isso cria dois problemas. O primeiro é comercial: dez dos quatorze concorrentes mapeados já entregam também no Telegram, e a dona do produto quer publicar Stories do Instagram. O segundo é estrutural: se cada aplicativo novo virar um produto paralelo (sua própria origem, sua própria fila, sua própria conversão, seu próprio histórico), o custo de manutenção multiplica e as regras passam a divergir em silêncio — o mesmo modo de falha que o projeto já sofreu quando a mesma lógica existiu em dois lugares.

O que esta feature entrega é a **separação entre "o que publicar" e "onde publicar"**. O miolo do produto (origem → conversão → texto → fila → ritmo → registro) passa a ser um só, e cada aplicativo vira apenas as pontas: quem sabe **ler** de um aplicativo e quem sabe **publicar** nele. A cliente escolhe, **por destino**, em qual aplicativo aquele destino recebe — e, com a decisão D3, também pode monitorar origens no Telegram.

O WhatsApp está em produção com dezenas de contas conectadas, e toda a preservação anti-ban existe por causa dele. **A regra que governa esta feature inteira é: o WhatsApp não pode regredir em nenhum caminho.**

---

## Vocabulário (leia antes de qualquer outra seção)

O repositório já usa duas palavras que **não podem** ser reaproveitadas aqui, sob pena de tornar o código e as telas ambíguos:

| Palavra já ocupada | O que já significa hoje | Onde |
|---|---|---|
| **"canal" / `channel`** | **Canal do WhatsApp** (`@newsletter`) — um tipo de destino dentro do WhatsApp | `Group.kind='channel'`, botão "Ver canal", `BotConfig.channel*`, `FEATURE_CODES.CHANNELS` nos planos |
| **"plataforma" / `platform`** | **LOJA / marketplace** (Shopee, Amazon, Mercado Livre, Magalu, SHEIN, AliExpress) | `BotConfig.platforms`, `Credential.platform`, `MessageLog.platform` |

Esta feature cunha um termo **novo e inequívoco**:

- **Termo canônico interno: "rede de entrega"** (`deliveryNetwork`), com os valores `whatsapp`, `telegram`, `instagram`.
- **Palavra usada com a cliente: "aplicativo"** — "Em qual aplicativo este destino recebe as ofertas?". É a palavra que ela já usa e não colide com nada na tela.

**FR de vocabulário (valem para código, telas, textos, registros e mensagens de erro):**

- Nenhuma superfície nova pode usar `channel`/"canal" nem `platform`/"plataforma" para se referir a WhatsApp, Telegram ou Instagram.
- Os valores da rede de entrega não podem colidir com os valores já existentes de `Group.kind` (`group`, `channel`).
- O direito de plano criado por esta feature (D2) **não pode** ser nomeado reaproveitando `channels` — esse código de recurso já significa "Canal do WhatsApp".
- A cliente nunca lê "rede de entrega", "adaptador", "driver", "transporte", "Bot API", "Graph API", "webhook" ou "token" em nenhuma tela.

---

## Decisão de escopo: o Instagram entra nesta rodada?

**Decisão: NÃO entra como entrega funcional nesta rodada. Entra como rede declarada, com o modelo de dados e o contrato de entrega já preparados para recebê-la, e com uma fase 2 explicitamente definida.**

**Justificativa (não é adiamento por conveniência — é diferença de natureza):**

1. **Story do Instagram não é mensageria, é publicação.** Não existe "grupo de destino": a publicação vai para o perfil. Não existe espelhamento 1:1 (uma mensagem de origem → uma mensagem no destino); existe uma cota diária de publicações do perfil inteiro. Boa parte do que a cliente já configurou — modelo de texto, palavras bloqueadas por grupo, ritmo por destino, dedup por destino — muda de significado ou deixa de existir.
2. **O texto não é texto.** No Story não há corpo de mensagem: o texto vira sobreposição na imagem e o link vira adesivo. A "oferta" precisa ser redesenhada como peça visual 9:16, não como mensagem.
3. **A mídia é obrigatória e precisa estar em endereço público.** Hoje a oferta pode sair sem foto; no Story, sem imagem não há publicação. E a imagem precisa ser hospedada em endereço acessível publicamente, o que é uma capacidade que o produto não tem hoje.
4. **A conexão da conta é de outra natureza** (conta comercial vinculada a página, autorização que vence e precisa ser renovada sozinha) e cria uma superfície de falha silenciosa nova.
5. **Risco de moldar a abstração pelo caso mais divergente antes de ela estar provada.** Fazer os três de uma vez obriga a desenhar o contrato de entrega para publicação e para mensageria ao mesmo tempo, sem nenhum dos dois em produção — e o preço do erro recai sobre o WhatsApp, que é o produto vivo. Com D3 (Telegram também como origem), o escopo desta rodada já dobrou; somar o Instagram triplicaria.

**O que "preparado para receber" significa, de forma verificável (não é promessa vaga):**

- O modelo de dados não pode assumir em nenhum lugar que um destino é uma conversa com outra pessoa. Um destino que é "o próprio perfil da cliente" tem que caber sem migração destrutiva.
- Cada rede **declara** o que sabe fazer (aceita texto? aceita botão? exige imagem? tem cota por dia? tem destinos múltiplos? sabe ler origem?), e o produto lê essa declaração em vez de deduzir por `if rede === 'whatsapp'`.
- Existe uma rede **fictícia, só de teste**, com capacidades reduzidas de publicação (exige imagem, não aceita texto longo, um destino só, não sabe ler origem), que exercita o contrato de ponta a ponta. É ela que prova que a estrutura cresce sem reescrita — e prova hoje, não na fase 2.

**Fase 2 (fora do escopo desta spec, declarada para não sumir):** entrega em Story do Instagram, incluindo conexão da conta comercial, geração da peça 9:16, adesivo de link, cota diária e aviso de autorização vencida.

---

## Decisão de escopo: espelhamento cruzado entre redes

**Decisão: o espelhamento cruzado está DENTRO do escopo.** Uma origem de Telegram pode alimentar destinos de WhatsApp, e uma origem de WhatsApp pode alimentar destinos de Telegram, na mesma conta e ao mesmo tempo.

**Justificativa**: excluir o cruzamento significaria, na prática, construir dois produtos paralelos — exatamente o que o requisito 1 da dona do produto proíbe. O miolo que decide "desta origem, para quais destinos" já trabalha com identificadores opacos; obrigá-lo a recusar um destino por ele ser de outra rede seria **acrescentar** uma restrição artificial, não evitar trabalho. Além disso, é o caso de uso mais provável na prática: a cliente descobre ofertas num grupo de Telegram e quer publicá-las no grupo de WhatsApp onde estão as clientes dela.

**O que o cruzamento NÃO afrouxa**: cada destino continua respeitando as regras da própria rede (ritmo, formato, capacidades) e a preservação do WhatsApp continua exatamente como é hoje, independentemente de a origem ser de qual aplicativo.

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
6. **Given** uma conta cujo plano não dá direito ao multicanal, **When** ela usa o produto, **Then** nada muda para ela e nenhuma tela passa a exibir aviso, bloqueio ou erro por causa desta feature.

---

### User Story 2 - Ligar o Telegram adicionando o robô do produto (Priority: P1)

A cliente com plano que dá direito ao multicanal entra no painel, encontra o Telegram e liga seguindo um passo a passo em linguagem simples. Não existe leitura de QR, nem pareamento por celular, **nem nada para ela copiar e colar**: o robô é o do Espelha Grupos, e o que ela faz é **adicionar esse robô ao grupo ou canal dela e dar a ele permissão de publicar**. Em seguida, os destinos disponíveis no Telegram aparecem para ela escolher, do mesmo jeito que os grupos do WhatsApp aparecem hoje.

**Why this priority**: sem a ligação não existe destino nem origem de Telegram, e sem isso nada mais desta feature entrega valor.

**Independent Test**: numa conta de teste com plano elegível, adicionar o robô do produto a um grupo real e ver o destino aparecer na lista; repetir com o robô fora do grupo e com o robô sem permissão de publicar, e conferir que os dois casos são explicados sem jargão.

**Acceptance Scenarios**:

1. **Given** a cliente com plano elegível e o Telegram ainda não ligado, **When** ela abre a tela do Telegram, **Then** ela recebe um passo a passo simples que a leva a **adicionar o robô do Espelha Grupos** ao grupo dela e a torná-lo administrador com permissão de publicar.
2. **Given** o robô **ainda não** adicionado a nenhum grupo/canal, **When** ela abre a lista de destinos, **Then** a lista aparece vazia com uma explicação do próximo passo, e **não** como erro.
3. **Given** o robô adicionado a um grupo mas **sem permissão de publicar**, **When** ela tenta escolher esse destino, **Then** o sistema avisa em linguagem simples que falta a permissão e qual é ela.
4. **Given** o robô adicionado e com permissão, **When** ela abre a lista, **Then** o destino aparece pronto, identificado pelo nome do grupo como ela o conhece.
5. **Given** um destino de Telegram já escolhido, **When** ela remove o robô do grupo, **Then** o destino passa a constar com problema, com a explicação do que aconteceu e do que fazer, e **nenhum** destino de WhatsApp é afetado.
6. **Given** a cliente quer parar de usar o Telegram, **When** ela desliga pelo painel, **Then** os destinos de Telegram param de receber, os de WhatsApp continuam inalterados e nenhum histórico é apagado.
7. **Given** qualquer tela do Telegram, **When** a cliente a abre, **Then** ela **não** vê nem precisa informar dado de acesso, chave, código ou identificador técnico de robô — o robô é do produto.

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

### User Story 4 - Filas e ofertas automáticas entregam no Telegram sem configuração nova (Priority: P2)

As filas de oferta e as ofertas automáticas que a cliente já monta hoje passam a aceitar destino de Telegram exatamente como aceitam destino de WhatsApp. Ela não configura nada a mais: escolhe o destino na mesma lista de sempre.

**Why this priority**: é o que transforma "espelhar no Telegram" em "o produto inteiro funciona no Telegram". Depende da entrega base (US3) existir, por isso P2.

**Independent Test**: apontar uma fila e uma oferta automática existentes para um destino de Telegram e conferir que os envios saem, respeitam o ritmo daquele destino e aparecem no histórico.

**Acceptance Scenarios**:

1. **Given** uma fila de ofertas com destinos de WhatsApp e de Telegram, **When** ela drena, **Then** cada item é entregue nos dois, com um registro por destino.
2. **Given** uma oferta automática apontada para um destino de Telegram, **When** ela roda, **Then** a mesma proteção contra repetir o mesmo produto no mesmo destino continua valendo.
3. **Given** uma mensagem agendada com destinos em aplicativos diferentes, **When** ela dispara, **Then** todos os destinos recebem, e a falha em um **não** impede a entrega nos demais.
4. **Given** um destino de Telegram temporariamente indisponível, **When** a fila drena, **Then** os destinos de WhatsApp continuam saindo no ritmo normal — um aplicativo lento nunca segura os outros.

---

### User Story 5 - A cliente entende o que aconteceu, em qualquer aplicativo (Priority: P2)

No histórico, cada linha diz **em qual aplicativo** a oferta saiu e, quando não saiu, **por quê**, em linguagem simples. Quando o Telegram para de funcionar para ela (robô removido do grupo, permissão retirada, espera por limite de ritmo), ela é avisada — não descobre porque as ofertas sumiram.

**Why this priority**: o modo de falha mais caro do projeto é o silencioso. Um aplicativo novo dobra a superfície de "parou e ninguém percebeu".

**Independent Test**: provocar cada falha de Telegram (robô removido, sem permissão, limite de ritmo, grupo apagado) e conferir que o histórico e o aviso descrevem o caso certo, sem jargão.

**Acceptance Scenarios**:

1. **Given** uma oferta entregue, **When** a cliente abre o histórico, **Then** a linha identifica o aplicativo pelo qual ela saiu.
2. **Given** uma oferta já registrada antes desta feature, **When** a cliente abre o histórico, **Then** ela aparece como WhatsApp, sem lacuna nem "desconhecido".
3. **Given** o robô do produto foi removido do grupo de destino, **When** uma oferta tenta sair, **Then** a linha explica que o robô não está mais no grupo e o que fazer, e a cliente recebe um aviso.
4. **Given** uma entrega adiada por limite de ritmo do Telegram, **When** a cliente olha o histórico, **Then** ela vê que a oferta está esperando para sair — nunca uma linha que sugira que ela foi perdida.
5. **Given** uma falha de Telegram, **When** o aviso é gerado, **Then** ele nunca afirma que as ofertas de WhatsApp pararam, e vice-versa.

---

### User Story 6 - Cada aplicativo tem o seu ritmo e a sua aparência, sem esconder a diferença (Priority: P3)

O que cada aplicativo consegue fazer é diferente, e o produto diz isso em vez de fingir que é tudo igual. A cliente não vê opções que aquele aplicativo não suporta, e quando uma oferta precisa sair mais simples do que sairia no WhatsApp, isso é declarado — não acontece em silêncio.

**Why this priority**: evita o pior desfecho de uma abstração: a cliente configurar algo que nunca teve efeito. Mas a entrega básica já vale sem isso, por isso P3.

**Independent Test**: abrir a configuração de um destino de Telegram e conferir que as opções exclusivas do WhatsApp não aparecem; publicar uma oferta cujo formato completo não cabe no Telegram e conferir que ela sai degradada e que o registro diz o que foi reduzido.

**Acceptance Scenarios**:

1. **Given** um destino de Telegram, **When** a cliente abre sua configuração, **Then** as opções que só existem no WhatsApp (botão "Ver canal", por exemplo) não são oferecidas.
2. **Given** uma oferta com um recurso que o aplicativo de destino não suporta, **When** ela é publicada, **Then** ela **sai** na melhor forma possível naquele aplicativo, e o registro diz o que foi reduzido.
3. **Given** os limites de ritmo próprios do Telegram, **When** muitas ofertas saem em sequência, **Then** o sistema respeita esses limites sem perder oferta e sem travar os outros destinos.
4. **Given** um destino de WhatsApp, **When** a cliente abre sua configuração, **Then** todas as opções de preservação e formato que existem hoje continuam disponíveis e com o mesmo efeito.

---

### User Story 7 - Um aplicativo novo entra sem reescrita (Priority: P3)

Quando o produto for entregar num quarto aplicativo (Story do Instagram na fase 2, ou outro depois), isso deve custar apenas ensinar ao sistema como falar com aquele aplicativo — e não mexer no espelhamento, na conversão, nas filas, no histórico ou no WhatsApp.

**Why this priority**: é o requisito "crescer de forma saudável". Não entrega valor à cliente hoje, mas é o que impede a próxima rodada de virar reescrita.

**Independent Test**: uma rede fictícia, existente apenas em teste, com capacidades reduzidas de publicação (exige imagem, um destino só, sem botão, não sabe ler origem) é entregue de ponta a ponta sem alterar nenhum arquivo específico de WhatsApp ou de Telegram.

**Acceptance Scenarios**:

1. **Given** a rede fictícia de teste, **When** ela é ligada, **Then** origem, conversão, texto, fila, ritmo, dedup e histórico funcionam com ela sem nenhuma alteração nos módulos compartilhados.
2. **Given** a rede fictícia declara que **não** aceita botão e **exige** imagem, **When** uma oferta sem imagem é enviada a ela, **Then** o sistema trata o caso pela declaração da rede, e não por uma condição escrita especificamente para ela.
3. **Given** a rede fictícia declara que **não sabe ler origem**, **When** a cliente tenta usá-la como origem monitorada, **Then** a opção nem é oferecida, decidida pela declaração de capacidades.
4. **Given** um destino de publicação (um destino só, sem conversa do outro lado) na rede fictícia, **When** ele é cadastrado e recebe uma publicação, **Then** o modelo de dados o aceita sem campo vazio forçado e sem alteração destrutiva.

---

### User Story 8 - Monitorar um grupo de Telegram como origem (Priority: P2)

A cliente adiciona o robô do produto também a um grupo de Telegram de onde ela quer **pegar** ofertas, e passa a monitorá-lo como já monitora grupos de WhatsApp. As ofertas publicadas ali são convertidas para o link de afiliada dela e espelhadas para os destinos que ela escolheu — inclusive destinos de WhatsApp.

**Why this priority**: é metade da decisão D3 e um caso de uso real (muitos grupos de achadinhos vivem no Telegram). Mas depende de o miolo compartilhado já estar de pé, por isso P2 e não P1.

**Independent Test**: adicionar o robô a um grupo de Telegram real, cadastrá-lo como origem, publicar uma oferta lá e conferir que ela chega convertida no destino de WhatsApp escolhido, uma vez só.

**Acceptance Scenarios**:

1. **Given** o robô adicionado a um grupo de Telegram com permissão de ler, **When** a cliente abre a lista de origens, **Then** o grupo aparece disponível para ser monitorado, com o nome como ela o conhece.
2. **Given** uma origem de Telegram ligada a um destino de WhatsApp, **When** uma oferta é publicada no grupo de Telegram, **Then** ela é convertida e espelhada para o destino de WhatsApp com o link de afiliada da cliente.
3. **Given** a mesma mensagem de origem sendo entregue mais de uma vez pelo aplicativo, **When** o sistema a processa, **Then** ela é espelhada **uma vez só**.
4. **Given** uma mensagem antiga ou reentregue pelo aplicativo depois de muito tempo, **When** ela chega, **Then** ela **não** volta a ser espelhada, e o descarte fica registrado com o motivo.
5. **Given** várias mensagens chegando da mesma origem, **When** elas são processadas, **Then** a ordem de publicação nos destinos respeita a ordem em que elas chegaram na origem.
6. **Given** uma mensagem que trava no processamento, **When** as mensagens seguintes da mesma origem chegam, **Then** elas continuam sendo processadas — uma mensagem travada nunca para a origem inteira.
7. **Given** a cliente remove o robô do grupo de origem, ou retira a permissão de leitura, **When** o sistema percebe, **Then** a origem passa a constar com problema, com a explicação e o que fazer, e as demais origens (de qualquer aplicativo) seguem funcionando.
8. **Given** uma origem de Telegram, **When** a cliente configura palavras bloqueadas, lojas permitidas, modelo de texto e destinos ligados, **Then** ela usa exatamente as mesmas telas e regras que já usa para origens de WhatsApp.

---

### User Story 9 - O multicanal é um recurso do plano, e isso é dito com clareza (Priority: P2)

A cliente cujo plano não dá direito ao multicanal vê que o recurso existe, entende em uma frase simples por que ela ainda não pode usar, e tem um caminho direto para mudar de plano. Ela nunca descobre o bloqueio depois de já ter configurado tudo.

**Why this priority**: é decisão comercial da dona do produto (D2) e, sem ela, o recurso sairia liberado para todos. Bloqueio malfeito é o que produz cliente irritada e dado perdido.

**Independent Test**: com uma conta de plano não elegível, tentar chegar ao Telegram pela tela e, em seguida, simular um destino de Telegram já existente que deixou de caber no plano — conferir que os dois caminhos são bloqueados e explicados.

**Acceptance Scenarios**:

1. **Given** uma conta de plano não elegível, **When** ela abre a área de destinos, **Then** o Telegram aparece identificado como recurso de plano superior, com explicação leiga e caminho para mudar de plano — nunca uma frase seca do tipo "seu plano não permite".
2. **Given** uma conta de plano não elegível, **When** ela tenta cadastrar um destino ou uma origem de Telegram, **Then** o cadastro é recusado com a mesma explicação.
3. **Given** uma conta que **tinha** plano elegível, com destino e origem de Telegram ativos, **When** ela é rebaixada de plano, **Then** o Telegram para de publicar e de ler, a configuração dela **não é apagada**, e ela é avisada do que aconteceu e do que fazer.
4. **Given** essa mesma conta rebaixada, **When** ela volta ao plano elegível, **Then** os destinos e origens de Telegram voltam a funcionar como estavam, sem ela precisar reconfigurar.
5. **Given** uma conta de plano não elegível, **When** ela usa o WhatsApp, **Then** nada é bloqueado, atrasado ou avisado por causa desta feature.

---

### US10 - A operação enxerga quando o robô do produto para para todo mundo (Priority: P1)

Como o robô do Telegram é **único** e serve todas as clientes (D1), um bloqueio, limitação ou queda dele atinge a base inteira de uma vez — tanto a publicação quanto a leitura das origens. Quem opera o produto precisa saber disso **sem entrar no servidor**, e existir um caminho declarado de contingência.

**Why this priority**: é o risco estrutural criado pela decisão D1. Uma falha que atinge todas as clientes ao mesmo tempo e que ninguém percebe é o pior desfecho possível desta feature.

**Independent Test**: simular o robô bloqueado/limitado e conferir que o painel de operação mostra o estado, que um aviso interno é gerado, e que o WhatsApp de todas as contas segue intacto.

**Acceptance Scenarios**:

1. **Given** o robô do produto bloqueado ou limitado pelo aplicativo, **When** isso acontece, **Then** o estado aparece no painel de operação e um aviso interno é gerado, sem ninguém precisar abrir o servidor.
2. **Given** o robô indisponível, **When** as clientes usam o produto, **Then** as entregas e as leituras de WhatsApp de **todas** elas seguem normais.
3. **Given** o robô indisponível, **When** ofertas de Telegram deveriam sair, **Then** elas esperam dentro das regras de espera já existentes e não são perdidas em silêncio.
4. **Given** o robô voltou, **When** a fila drena, **Then** as ofertas que esperavam saem, respeitando o ritmo e as regras de idade já existentes.
5. **Given** um pico de uso de uma cliente, **When** o orçamento global de envio do robô fica disputado, **Then** nenhuma cliente fica sem entrega por causa do volume de outra.

---

### Edge Cases

- **Destino antigo sem aplicativo gravado**: todo destino gravado até hoje é WhatsApp. A ausência do dado nunca pode virar erro, lista vazia ou "desconhecido" — tem que significar WhatsApp.
- **Identificadores iguais em aplicativos diferentes**: o mesmo texto/número pode identificar destinos diferentes em aplicativos diferentes. A unicidade precisa considerar o aplicativo, sem quebrar o que já está gravado.
- **Origem monitorada apontando só para destinos de Telegram**: o espelhamento precisa acontecer normalmente mesmo que nenhum destino seja de WhatsApp.
- **Origem de Telegram apontando só para destinos de WhatsApp**: caso principal do cruzamento entre redes; precisa funcionar sem nenhuma configuração extra.
- **Repetição entre aplicativos**: a mesma oferta saindo no WhatsApp e no Telegram **não** é duplicata — são destinos diferentes. Bloquear o segundo por causa do primeiro perderia oferta legítima.
- **Mesma mensagem de origem entregue duas vezes pelo aplicativo**: precisa produzir um espelhamento só, mesmo que as duas entregas cheguem com segundos de diferença.
- **Mensagem antiga reentregue pelo aplicativo**: não pode reentrar no fluxo; o descarte precisa ser registrado com motivo, nunca silencioso.
- **Um aplicativo fora do ar**: a indisponibilidade de um aplicativo não pode atrasar, travar ou derrubar a entrega nos outros — a lição do incidente em que um único destino lento derrubou a vazão de todos.
- **Falha parcial num lote**: um destino que falha não pode abortar os demais do mesmo lote nem apagar o progresso já feito.
- **Robô removido do grupo no meio de uma fila**: os envios seguintes falham com motivo próprio e a fila continua para os outros destinos.
- **Limite de ritmo do robô único atingido**: a oferta é adiada, não perdida, e o adiamento não congela os demais destinos nem prejudica outras clientes.
- **Cliente com plano elegível liga o Telegram e nunca escolhe destino**: nada muda no WhatsApp; nenhum aviso de erro é gerado.
- **Cliente desconecta o WhatsApp mas mantém o Telegram**: os destinos de Telegram continuam recebendo normalmente.
- **Cliente rebaixa de plano com destino de Telegram ativo**: a publicação e a leitura param, a configuração fica guardada, e ela é avisada. Nada é apagado.
- **Destino de Telegram apagado enquanto um envio já está na fila**: o envio é descartado antes de sair, pelo mesmo princípio já aplicado hoje aos destinos desligados do WhatsApp.
- **Aviso de conta parada**: os avisos de saúde já existentes não podem passar a disparar em duplicidade só porque a conta agora tem dois aplicativos.

---

## Requirements *(mandatory)*

### Functional Requirements

**Vocabulário e modelo conceitual**

- **FR-001**: O sistema MUST adotar um termo próprio e único para "aplicativo onde a oferta é entregue ou de onde ela é lida" (rede de entrega), distinto de "canal" (Canal do WhatsApp) e de "plataforma" (loja), em código, dados, telas, registros e mensagens.
- **FR-002**: Os valores da rede de entrega MUST NOT colidir com valores já usados por `Group.kind` (`group`, `channel`).
- **FR-003**: Para a cliente, o conceito MUST ser apresentado como "aplicativo". Nenhum termo técnico (adaptador, driver, transporte, token, API, webhook) pode aparecer em qualquer texto que ela leia.

**Estrutura compartilhada (multicanal de verdade)**

- **FR-004**: Origens monitoradas, roteamento origem→destino, conversão de link de afiliada, montagem de texto/modelo/variações, palavras bloqueadas, lojas permitidas, dedup, filas de envio, filas de oferta, ofertas automáticas, mensagens agendadas, entitlements e histórico MUST existir **uma vez só** e servir a todas as redes de entrega.
- **FR-005**: Uma mesma origem monitorada MUST poder alimentar destinos de redes diferentes simultaneamente, sem duplicar origem, conversão, modelo de texto ou configuração de conteúdo.
- **FR-006**: A escolha da rede de entrega MUST ser **por destino**, feita pela cliente no cadastro do destino.
- **FR-007**: Cada rede de entrega MUST **declarar** suas capacidades (aceita texto isolado; aceita imagem; exige imagem; aceita botão; aceita card clicável; aceita vídeo; permite marca d'água; tem múltiplos destinos ou destino único; sabe ler origem; limites de ritmo próprios), e o produto MUST decidir o que oferecer e o que degradar lendo essa declaração, nunca por condição escrita para uma rede específica.
- **FR-008**: O sistema MUST NOT oferecer à cliente, num destino ou numa origem, uma opção que a rede daquele destino/origem não suporta.
- **FR-009**: Quando o formato completo de uma oferta não couber na rede de destino, a oferta MUST ser entregue na melhor forma possível ali (degradação declarada) e o registro MUST dizer o que foi reduzido. Degradação silenciosa é proibida.
- **FR-010b**: O espelhamento cruzado entre redes (origem de uma rede → destino de outra) MUST funcionar sem configuração adicional, nos dois sentidos.

**Não-regressão do WhatsApp (invariante da feature)**

- **FR-010**: O comportamento observável do WhatsApp — conteúdo publicado, formato da mensagem, card, foto, botão de canal, marca d'água, ritmo, preservação, dedup, bloqueios, taxonomia de erro e textos do histórico — MUST permanecer idêntico ao de hoje.
- **FR-011**: A entrada desta feature MUST NOT desconectar sessões de WhatsApp, exigir novo pareamento, apagar credencial de sessão ou alterar o estado de qualquer sessão conectada.
- **FR-012**: Nenhum destino, origem, fila, oferta automática, mensagem agendada ou registro já gravado MUST ser reescrito, migrado destrutivamente ou exigir ação da cliente.
- **FR-013**: Um destino ou origem sem rede de entrega gravada MUST ser tratado como WhatsApp em todos os caminhos de leitura, sem erro e sem estado "desconhecido".
- **FR-014**: As regras críticas já existentes MUST continuar valendo sem alteração, em particular: lista explícita de destinos vazia nunca significa "todos"; revalidação do destino no momento do envio; descarte por idade na fila; isolamento de falha por item dentro de um lote; preservação e ritmo por destino.

**Ligação do Telegram — robô único do produto (D1)**

- **FR-015**: O Telegram MUST ser servido por **um único robô do produto**. O sistema MUST NOT oferecer, nesta rodada, caminho para a cliente usar um robô próprio.
- **FR-016**: O dado de acesso do robô MUST ser tratado como **segredo de infraestrutura do produto** (configuração do ambiente), e MUST NOT entrar no fluxo de credenciais de loja, no cadastro da cliente, em nenhuma tela da cliente, em registro, log ou mensagem de erro.
- **FR-017**: A cliente MUST ligar o Telegram **sem informar nenhum dado de acesso**: o passo a passo consiste em adicionar o robô do produto ao grupo/canal dela e conceder a permissão necessária.
- **FR-018**: O sistema MUST listar para a cliente os destinos e origens de Telegram disponíveis, e MUST distinguir, em linguagem simples, os casos: robô não adicionado; robô adicionado sem a permissão necessária; pronto.
- **FR-019**: A cliente MUST poder desligar o Telegram; ao desligar, destinos e origens de Telegram param de funcionar, o WhatsApp permanece inalterado e nenhum histórico é apagado.
- **FR-039**: O orçamento global de envio do robô único MUST ser repartido com **justiça entre clientes**: nenhuma cliente em volume alto pode consumir o orçamento das demais a ponto de atrasar ou impedir a entrega delas.
- **FR-040**: Quando o limite global do robô for atingido, a oferta MUST **esperar** e ser entregue depois, dentro das regras de espera e de idade já existentes. Ela MUST NOT ser descartada em silêncio nem registrada como entregue.
- **FR-041**: O estado do robô único (funcionando, limitado, bloqueado, indisponível) MUST ser visível para quem opera o produto **sem acesso ao servidor**, e MUST gerar aviso interno quando deixar de funcionar.
- **FR-042**: A indisponibilidade do robô único MUST NOT afetar, em nenhuma conta, a entrega ou a leitura de WhatsApp.
- **FR-043**: A spec MUST declarar um caminho de contingência para o robô indisponível — no mínimo: as ofertas esperam sem se perder, a operação é avisada, o produto continua inteiro no WhatsApp, e existe um procedimento definido para substituir o robô sem que as clientes percam configuração.
- **FR-044**: A linguagem usada com a cliente MUST deixar claro que o robô é do produto (por exemplo: "o robô do Espelha Grupos precisa ser administrador do seu grupo"), sem jargão e sem sugerir que ela precisa criar ou configurar um robô.
- **FR-045**: O sistema MUST reconhecer e explicar, com motivo próprio, as situações em que o robô perde acesso a um grupo específico da cliente (removido do grupo, permissão retirada, grupo apagado), sem confundi-las com a indisponibilidade global do robô.

**Direito de plano (D2)**

- **FR-046**: O multicanal MUST ser um recurso de plano superior, seguindo o mesmo padrão dos recursos já restritos do produto. O direito MUST ter código próprio e MUST NOT reaproveitar o código de recurso `channels` (que já significa Canal do WhatsApp).
- **FR-047**: O bloqueio por plano MUST existir em **duas camadas**: na tela (a cliente sem direito não consegue cadastrar destino nem origem de Telegram) e no envio/leitura (um destino ou origem que já existia e deixou de caber no plano para de publicar e de ler). Bloqueio só na tela é insuficiente.
- **FR-048**: A recusa por plano MUST ser explicada em linguagem leiga, dizendo o que o recurso faz e como obtê-lo, com caminho direto para a mudança de plano. Frases secas do tipo "seu plano não permite" são proibidas.
- **FR-049**: No rebaixamento de plano, a configuração de Telegram da cliente (destinos, origens, ligações, preferências) MUST ser **preservada**, não apagada, e ela MUST ser avisada do que parou e do que fazer.
- **FR-050**: Ao voltar para um plano elegível, os destinos e origens de Telegram MUST voltar a funcionar como estavam, sem a cliente precisar reconfigurar.
- **FR-051**: Contas sem direito ao multicanal MUST NOT sofrer qualquer mudança de comportamento, aviso, bloqueio ou atraso no WhatsApp por causa desta feature.

**Telegram como origem monitorada (D3)**

- **FR-052**: A cliente com direito ao multicanal MUST poder cadastrar um grupo de Telegram como origem monitorada, usando as mesmas telas e as mesmas regras de conteúdo (palavras bloqueadas, lojas permitidas, modelo de texto, destinos ligados) que já usa para origens de WhatsApp.
- **FR-053**: O sistema MUST reconhecer e explicar, em linguagem simples, quando o robô não tem a permissão necessária para ler o grupo de origem, ou foi removido dele.
- **FR-054**: Mensagens que chegam de uma origem de Telegram MUST passar pela mesma blindagem de entrada que o WhatsApp acumulou, com o comportamento exigido a seguir (FR-055 a FR-058). A blindagem MUST ser exigida explicitamente, não herdada por suposição.
- **FR-055**: **Entrega repetida da mesma mensagem** MUST produzir um espelhamento só, mesmo quando as entregas chegam com poucos segundos de diferença e mesmo quando chegam por processos diferentes.
- **FR-056**: **Mensagem antiga ou reentregue** MUST NOT reentrar no fluxo de espelhamento. O descarte MUST ser registrado com motivo e idade, nunca em silêncio.
- **FR-057**: A **ordem** de processamento MUST ser preservada por origem: mensagens da mesma origem são espelhadas na ordem em que chegaram.
- **FR-058**: Uma mensagem que trave no processamento MUST NOT impedir o processamento das mensagens seguintes da mesma origem.
- **FR-059**: Uma origem de Telegram com problema MUST NOT afetar o funcionamento das demais origens, de qualquer rede.
- **FR-060**: Uma mesma oferta que apareça em mais de uma origem monitorada (inclusive em redes diferentes) MUST continuar sendo bloqueada por repetição no destino pelas regras já existentes — a origem ser de outra rede não é motivo para publicar duas vezes.

**Entrega, ritmo e isolamento**

- **FR-021**: A indisponibilidade, lentidão ou limite de ritmo de uma rede MUST NOT atrasar, travar ou derrubar a entrega nas demais redes da mesma conta.
- **FR-022**: Os limites de ritmo próprios de cada rede MUST ser respeitados adiando a entrega, nunca descartando a oferta — exceto pelas regras de descarte já existentes (idade na fila, destino desligado, repetição).
- **FR-023**: A dedup MUST tratar destinos de redes diferentes como destinos independentes: a entrega num destino nunca bloqueia a entrega noutro destino de outra rede.
- **FR-024**: A falha de entrega num destino MUST NOT abortar o restante do lote nem apagar o progresso já registrado.
- **FR-025**: A conta da cliente MUST continuar respeitando as regras de preservação já existentes nos destinos de WhatsApp, sem que a existência de destinos ou origens de outra rede afrouxe ou altere esses limites.

**Visibilidade e avisos**

- **FR-026**: O histórico MUST registrar, para cada envio, por qual rede de entrega ele saiu.
- **FR-027**: Registros gravados antes desta feature MUST aparecer como WhatsApp, sem lacuna, sem "desconhecido" e sem migração destrutiva.
- **FR-028**: As falhas específicas de cada rede MUST ter motivo próprio, traduzido para linguagem leiga no histórico, dentro da taxonomia de erro já existente.
- **FR-029**: A cliente MUST ser avisada quando uma rede parar de funcionar para ela (robô removido do grupo, permissão retirada, direito de plano perdido), com o que fazer, respeitando as travas de aviso já existentes (conta parada, teto semanal, janela anti-repetição).
- **FR-030**: Nenhum aviso MUST afirmar que as entregas de uma rede pararam quando na verdade pararam as de outra.

**Crescimento saudável**

- **FR-031**: Adicionar uma rede nova MUST NOT exigir alteração nos módulos compartilhados (origem, roteamento, conversão, texto, filas, dedup, preservação, histórico, entitlements) nem em módulos específicos de outra rede.
- **FR-032**: A feature MUST incluir uma rede fictícia, existente apenas em ambiente de teste, com capacidades reduzidas de publicação (destino único, imagem obrigatória, sem botão, sem leitura de origem), exercitada de ponta a ponta como prova verificável do FR-031.
- **FR-033**: O modelo de dados MUST acomodar um destino que é "o próprio perfil da cliente" (publicação, sem conversa do outro lado) sem campo vazio forçado e sem alteração destrutiva futura.
- **FR-034**: O Story do Instagram MUST ser declarado como rede de entrega conhecida e explicitamente **não disponível** nesta rodada; a cliente MUST NOT poder selecioná-lo, e a tela MUST NOT prometer o que ainda não existe.

**Restrições operacionais (condições de aceitação da entrega)**

- **FR-035**: A feature MUST NOT introduzir processo de execução novo por cliente. Qualquer necessidade de processo novo MUST ser sinalizada explicitamente à dona do produto com estimativa de memória antes de ser implementada — o servidor está com folga zero pela política vigente.
- **FR-036**: A entrega do Telegram MUST NOT depender de mudança que quebre o contrato entre a API e o supervisor de sessões. Se um contrato novo for inevitável, o sistema MUST continuar funcionando enquanto as duas pontas estiverem em versões diferentes, sem quebrar o WhatsApp.
- **FR-037**: A feature MUST funcionar sem exigir reinício do supervisor de sessões para entrar em vigor nos caminhos que não são de WhatsApp; onde isso for inevitável, a spec MUST declarar que é decisão humana anunciada (reiniciar reconecta todas as sessões de WhatsApp de uma vez).
- **FR-038**: Toda regra crítica desta feature (não-regressão do WhatsApp, destino sem rede = WhatsApp, isolamento entre redes, dedup por destino, degradação declarada, ausência de opção não suportada, justiça entre clientes no robô único, bloqueio por plano nas duas camadas, blindagem de entrada do Telegram) MUST ser coberta por testes automatizados de regressão.

### Key Entities

- **Rede de entrega**: o aplicativo por onde a oferta é publicada ou de onde ela é lida (`whatsapp`, `telegram`, `instagram`). Tem nome exibido à cliente, estado de disponibilidade no produto e uma **declaração de capacidades**.
- **Declaração de capacidades da rede**: o que aquela rede sabe fazer (texto, imagem, imagem obrigatória, botão, card, vídeo, marca d'água, destino único vs múltiplos, saber ler origem, limites de ritmo). É lida pelo produto para decidir o que oferecer e o que degradar.
- **Destino**: onde a oferta é publicada. Passa a ter, além do identificador que já tem, a rede à qual pertence. Destino sem rede gravada é WhatsApp.
- **Origem monitorada**: de onde as ofertas são lidas. Passa a poder ser de WhatsApp ou de Telegram; sem rede gravada é WhatsApp.
- **Ligação da cliente com a rede**: o que autoriza o produto a publicar/ler naquela rede — sessão pareada no WhatsApp; **presença e permissão do robô do produto** no grupo, no Telegram; autorização de conta comercial no Instagram (fase 2). Cada ligação tem estado (pronta, com problema, desligada) e um motivo em linguagem leiga quando há problema.
- **Robô do produto no Telegram**: recurso único e compartilhado por todas as clientes. Seu dado de acesso é segredo de infraestrutura, nunca credencial de cliente. Tem estado global (funcionando, limitado, bloqueado) e um orçamento de envio repartido com justiça entre clientes.
- **Direito de plano ao multicanal**: recurso de plano superior, com código próprio, verificado na tela e no momento do envio/leitura.
- **Oferta neutra**: o conteúdo pronto para publicar, independente de aplicativo (texto, link convertido, imagem, dados do produto). É o que o miolo compartilhado produz e o que cada rede traduz para o seu formato.
- **Registro de envio**: a linha do histórico, que passa a dizer também por qual rede a entrega saiu e, quando houve, o que foi reduzido.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das contas que usam somente WhatsApp continuam entregando sem nenhuma ação da cliente — zero destinos precisando ser reeditados, zero sessões reconectadas, zero pareamentos novos.
- **SC-002**: Zero diferença observável no conteúdo, formato e ritmo das ofertas publicadas no WhatsApp entre antes e depois da entrega, medida em amostra real de ofertas dos dois períodos.
- **SC-003**: 100% dos destinos, origens e registros gravados antes da feature são lidos como WhatsApp, sem lacuna e sem estado "desconhecido".
- **SC-004**: A cliente com plano elegível liga o Telegram e vê o primeiro destino disponível em menos de 5 minutos, sem abrir suporte, sem documentação externa e **sem informar nenhum dado de acesso**.
- **SC-005**: Uma oferta publicada numa origem ligada a destinos de dois aplicativos chega aos dois, com o link de afiliada da cliente em ambos, em 100% dos casos de teste.
- **SC-006**: A indisponibilidade total de uma rede por 30 minutos não produz nenhum atraso mensurável nas entregas das demais redes da mesma conta, e nenhuma oferta é perdida por causa dela.
- **SC-007**: 100% das falhas específicas do Telegram (robô removido, sem permissão, grupo apagado, espera por limite de ritmo, robô indisponível) produzem um motivo próprio no histórico e, quando aplicável, um aviso — nenhuma delas aparece como falha genérica.
- **SC-008**: Nenhum termo técnico aparece em qualquer tela, aviso ou mensagem de erro relacionada a aplicativos de entrega, e nenhuma tela da cliente pede ou exibe dado de acesso de robô.
- **SC-009**: A rede fictícia de teste é entregue de ponta a ponta sem que nenhum arquivo específico de WhatsApp ou de Telegram seja alterado — prova de que uma rede nova não exige reescrita.
- **SC-010**: A feature entra em produção sem nenhum processo de execução novo e sem aumento mensurável do consumo de memória por conta de WhatsApp.
- **SC-011**: Nenhuma opção não suportada por uma rede é oferecida à cliente num destino ou origem daquela rede, verificado em todas as telas de configuração.
- **SC-012**: 100% das ofertas que precisaram sair em formato reduzido registram o que foi reduzido.
- **SC-013**: Num teste com uma conta em volume alto e outras contas em volume normal disputando o robô único, 100% das contas em volume normal continuam entregando dentro do ritmo esperado.
- **SC-014**: 100% das tentativas de usar o multicanal sem direito de plano são recusadas nas duas camadas (tela e envio/leitura), sempre com explicação leiga e caminho para mudar de plano.
- **SC-015**: Num rebaixamento de plano com Telegram ativo, 100% da configuração da cliente é preservada e ela recebe um aviso — zero dado apagado.
- **SC-016**: Uma mensagem de origem de Telegram entregue duas vezes pelo aplicativo produz exatamente um espelhamento por destino, em 100% dos casos de teste.
- **SC-017**: Uma mensagem travada numa origem de Telegram não impede o processamento das seguintes daquela origem, verificado em teste.
- **SC-018**: Quando o robô único fica indisponível, a operação é avisada e o estado fica visível sem acesso ao servidor, em 100% dos casos simulados.

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
| **R6** | Ambiguidade de vocabulário na tela | "Canal" já significa Canal do WhatsApp para a cliente. Usar a mesma palavra para Telegram criaria confusão direta na configuração de destino. | Termo novo no código; para a cliente, "aplicativo". Proibido reusar "canal" e "plataforma", inclusive no código do direito de plano. |
| **R7** | Cotas e direitos de plano | Destinos e origens passam a poder ser de aplicativos diferentes; sem decisão consciente, a cliente ganharia ou perderia direito sem ninguém ter decidido. | Resolvido por D2: recurso de plano superior, bloqueado em duas camadas, com preservação de dado no rebaixamento. |
| **R8** | Falha silenciosa da nova rede | O modo de falha mais caro do projeto é "parou e ninguém percebeu". Uma rede nova dobra essa superfície, e com origem (D3) dobra de novo. | Toda falha de rede tem motivo próprio, aviso e explicação leiga. Nenhuma falha genérica. |
| **R9** | Código novo não valer nos processos de sessão | Em modo remoto, correção que mora no processo de sessão só passa a valer depois de um reinício que reconecta todas as sessões de WhatsApp. | Onde for inevitável, é decisão humana anunciada; o desenho deve minimizar o que precisa morar ali. |
| **R10** | Unicidade de destino | A unicidade atual de destino não considera aplicativo. Passar a considerar sem cuidado pode recusar destinos já gravados. | Identificadores iguais em aplicativos diferentes coexistem; nada do que já está gravado é recusado. |
| **R11** | Avisos em duplicidade | Os avisos de saúde por conta já existem; uma conta com dois aplicativos pode passar a receber dois avisos pelo mesmo assunto. | As travas de aviso já existentes continuam valendo; nenhum assunto gera aviso duplicado. |
| **R12** | Moldar a abstração pelo caso mais divergente | Story do Instagram é publicação, não mensageria. Desenhar para ele sem nenhuma rede nova provada em produção arrisca uma abstração errada, e o preço recai sobre o WhatsApp. | Instagram fica como fase 2 declarada; o contrato nasce preparado e é provado por uma rede fictícia de teste, não por suposição. |
| **R13** | **Robô único como ponto único de falha (D1)** | Um robô só serve todas as clientes. Bloqueio, limitação ou queda dele atinge a base inteira de uma vez — e, com D3, derruba junto a **leitura** de todas as origens de Telegram de todo mundo. | Estado do robô visível para a operação sem acesso ao servidor; aviso interno ao parar; ofertas esperam sem se perder; WhatsApp intacto em todas as contas; caminho de contingência declarado para substituir o robô sem perda de configuração das clientes. |
| **R14** | **Orçamento de ritmo compartilhado entre clientes (D1)** | Com robô único, o limite de ritmo do aplicativo passa a ser um recurso comum. Uma cliente em volume alto pode consumir o orçamento das demais. | Repartição com justiça entre clientes; nenhuma cliente fica sem entrega por causa do volume de outra; ao atingir o limite global, a oferta espera e é entregue depois. |
| **R15** | **Bloqueio de plano que vaza (D2)** | Bloquear só na tela é o padrão que vaza: um destino cadastrado antes do rebaixamento continuaria publicando. E apagar a configuração da cliente ao rebaixar seria perda de dado silenciosa. | Bloqueio nas duas camadas (tela e envio/leitura); configuração preservada no rebaixamento; aviso explicando; volta automática ao reassinar. |
| **R16** | **Caminho de entrada novo sem a blindagem que o WhatsApp levou anos para ganhar (D3)** | A entrada do WhatsApp acumulou proteções por causa de incidentes reais: mensagem espelhada N vezes por reentrega, mensagem antiga reentrando no fluxo, fila de entrada travada por uma mensagem. Uma origem nova nasce sem nada disso. | Dedup de mensagem de entrada, descarte de mensagem antiga/reentregue com motivo registrado, ordem por origem e isolamento de mensagem travada são **exigidos explicitamente** na entrada do Telegram, não herdados por suposição. |
| **R17** | **Leitura de todas as origens dependendo do mesmo robô (D1 + D3)** | Combinação das duas decisões: não é só a publicação que é centralizada — a leitura das origens de todas as clientes também depende do mesmo robô. Um limite ou bloqueio para de ler para todo mundo junto. | Mesma exigência de R13 aplicada à leitura: estado visível, aviso à operação, WhatsApp intacto, e clareza para a cliente de que o problema não é o grupo dela. |

---

## Assumptions

- Todo destino, origem, fila, oferta automática e registro existente hoje é de WhatsApp; a ausência de informação de rede significa WhatsApp e nunca precisa ser regravada.
- **A marca do produto aparece nos grupos das clientes.** Como o robô é único e do produto (D1), o nome e a identidade dele ficam visíveis para os membros dos grupos da cliente. Isso é aceito conscientemente e faz parte da linguagem usada com ela ("o robô do Espelha Grupos precisa ser administrador do seu grupo").
- **A fronteira de plano segue o padrão já existente no produto.** Os planos hoje são `trial`, `basic` e `pro`, e os recursos restritos (Canal do WhatsApp, preservação avançada, ofertas automáticas, filas de oferta) são liberados para **Pro ou teste grátis ativo**. A suposição é que o multicanal segue exatamente essa mesma fronteira. ⚠️ **Isto é suposição, não fato**: o código define o padrão, mas não determina sozinho que o multicanal deva cair nele. Se a dona do produto quiser outra fronteira (por exemplo, liberar ou não durante o teste grátis), é decisão dela e precisa ser confirmada antes do plano.
- A identidade do destino e da origem é opaca para o miolo compartilhado — o que muda é quem sabe traduzi-la, não quem a carrega.
- O texto base da oferta continua vindo do grupo de origem e da montagem já existente; cada rede o adapta ao seu formato, sem reescrever a oferta.
- A preservação/anti-ban continua sendo, no WhatsApp, exatamente o que é hoje. Em outras redes, "preservação" significa respeitar os limites daquela rede, não replicar as regras desenhadas para o risco de banimento do WhatsApp.
- O risco do Telegram é diferente do risco do WhatsApp: não há banimento de chip da cliente, mas há limitação ou bloqueio do robô do produto — que, por ser único, atinge todas as clientes ao mesmo tempo.
- Entrega segue o fluxo canônico do projeto: branch → PR contra `develop` → validação em homologação → PR para produção.
- A validação em homologação com grupos reais de Telegram (um de destino e um de origem) é gate obrigatório antes de produção.

---

## Out of Scope

- Entrega funcional em Story do Instagram (fase 2 declarada; só o preparo do modelo de dados e do contrato entra agora).
- Caminho para a cliente usar um robô próprio de Telegram (decisão D1 — robô único do produto nesta rodada).
- Recursos exclusivos do Telegram sem equivalente no produto (enquetes, respostas automáticas, comandos, botões interativos).
- Conversas diretas no Telegram como origem ou destino (apenas grupos e canais).
- Migração de destinos ou origens existentes de WhatsApp para outro aplicativo.
- Qualquer alteração no comportamento de conversão de link de afiliada, nas lojas suportadas ou na montagem do texto da oferta.
- Qualquer alteração nas regras de preservação/anti-ban do WhatsApp.
- Um quarto aplicativo além dos três citados.

---

## Gate manual obrigatório (antes de produção)

1. Numa conta de homologação só com WhatsApp, comparar antes e depois: destinos e origens listados, oferta publicada num grupo real, oferta publicada num Canal do WhatsApp com botão, histórico e bloqueios. Nenhuma diferença observável.
2. Com plano elegível, adicionar o robô do produto a um grupo real e a um canal real e conferir a listagem dos destinos nos três estados (não adicionado, sem permissão, pronto) — **sem a cliente informar nenhum dado de acesso**.
3. Ligar uma origem real de WhatsApp a um destino de WhatsApp e um de Telegram e conferir, no celular, que a mesma oferta chega nos dois com o link de afiliada da cliente.
4. Cadastrar um grupo real de Telegram como **origem**, publicar uma oferta lá e conferir que ela chega convertida no destino de WhatsApp — **uma vez só**. Repetir forçando entrega repetida e mensagem antiga, e conferir dedup e descarte registrado.
5. Apontar uma fila e uma oferta automática para um destino de Telegram e conferir entrega, ritmo e histórico.
6. Provocar cada falha de Telegram (robô removido do grupo de destino, robô removido do grupo de origem, permissão retirada, limite de ritmo, robô indisponível) e conferir motivo próprio no histórico, aviso à cliente, aviso interno à operação quando for o robô global, e ausência total de efeito sobre os destinos de WhatsApp.
7. Com uma conta de plano não elegível, tentar cadastrar destino e origem de Telegram e conferir a recusa nas duas camadas, com o texto de upgrade. Rebaixar uma conta que tinha Telegram ativo e conferir que a publicação e a leitura param, que **nada é apagado** e que ela é avisada; reassinar e conferir que tudo volta.
8. Simular disputa de ritmo: uma conta em volume alto e outras em volume normal, e conferir que as normais continuam entregando.
9. Manter as contas em observação por 24 h e confirmar que não houve aumento de quedas de sessão de WhatsApp, de consumo de memória, nem avisos duplicados.
