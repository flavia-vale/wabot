# Feature Specification: Telegram como origem pela conta pessoal da cliente

**Feature Branch**: `018-telegram-conta-pessoal`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Telegram como ORIGEM pela conta pessoal da cliente (continuação da feature 017-multicanal-telegram-instagram, antiga 'Fatia 5'). A cliente conecta a própria conta do Telegram por QR e escolhe canais/grupos em que ela está como origens; as ofertas são espelhadas para destinos WhatsApp (pelo envio existente) e Telegram (pelo robô do Espelha Grupos e caixa de saída já existentes). Espelhamento cruzado nas 4 combinações."

---

## Contexto

A feature 017 colocou o Telegram como **destino**: o robô do Espelha Grupos publica nos grupos de Telegram da cliente (filas, ofertas automáticas e espelhamento WhatsApp → Telegram). Ficou de fora a **origem** de Telegram (antiga "Fatia 5"). O desenho antigo da Fatia 5 previa o robô do Espelha Grupos lendo a origem, o que exige que a cliente consiga colocar o robô dentro do grupo/canal de onde ela copia ofertas — na prática, ela quase nunca é dona desses grupos e canais.

Esta feature resolve isso por outro caminho: a cliente conecta **a própria conta do Telegram** (por QR, como faz com o WhatsApp) e escolhe, entre os grupos e canais em que ela já está, quais serão origens. A conta da cliente **só lê**; quem publica continua sendo o robô do Espelha Grupos (destinos de Telegram) ou o WhatsApp da cliente (destinos de WhatsApp).

| Origem → Destino | Situação |
|---|---|
| WhatsApp → WhatsApp | já existe, não muda |
| WhatsApp → Telegram | já existe (feature 017), não muda |
| Telegram → WhatsApp | **nova** |
| Telegram → Telegram | **nova** |

## Decisões da dona do produto (2026-10-03)

Registradas como decisões, não como perguntas:

- **D1 — Plano**: recurso do plano **Premium (R$ 99/mês)**, pelo mesmo direito que já libera o multicanal (o mesmo direito que já exige acesso em dia). Teste grátis, Basic e Pro não têm acesso.
- **D2 — Conta dedicada**: o produto **recomenda** (não exige) que a cliente use uma conta do Telegram só para isso.
- **D3 — Tratamento igual ao WhatsApp**: a oferta vinda do Telegram passa exatamente pelo mesmo tratamento do espelhamento do WhatsApp — conversão de links, modelo de texto, palavras bloqueadas, lojas permitidas, cupons, domínio próprio, texto adicional (rodapé) e trava de repetição —, reaproveitando o que já existe **sem mudar o comportamento do WhatsApp**.
- **D4 — Memória**: um processo novo e separado para a leitura do Telegram está **autorizado a ser medido em staging** (hipótese: ~100 MB fixos + 10–20 MB por conta conectada). O OK final para produção é da dona do produto **depois** da medição, conforme a política de memória do repo.
- **D5 — Prazo**: começar agora.

## Vocabulário (não regredir)

- Na tela: **"aplicativo"** (WhatsApp, Telegram), **"o robô do Espelha Grupos"**, **"sua conta do Telegram"**, "grupo", "origem", "destino".
- Nunca usar "canal" ou "plataforma" como sinônimo de aplicativo ("canal" já significa Canal do WhatsApp; "plataforma" já significa loja). Um canal **do Telegram** pode ser citado como "canal do Telegram" quando for o tipo de origem.
- Nada de jargão técnico em tela, e-mail ou aviso: proibido token, sessão, MTProto, api_id, chat_id, hash, código de autorização.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quem usa só WhatsApp não percebe nada (Priority: P1)

A cliente que não conecta o Telegram (ou que não é Premium) continua com o mesmo espelhamento, as mesmas telas e o mesmo comportamento de hoje.

**Why this priority**: é a regra "nada pode mudar para quem usa só WhatsApp". Uma regressão aqui atinge todas as clientes pagantes.

**Independent Test**: com a feature desligada e ligada, rodar o espelhamento WhatsApp → WhatsApp e WhatsApp → Telegram de uma conta sem Telegram conectado e comparar resultado, textos, tempos e histórico.

**Acceptance Scenarios**:

1. **Given** uma cliente que não conectou a conta do Telegram, **When** uma oferta chega numa origem de WhatsApp, **Then** ela é tratada e entregue exatamente como antes desta feature.
2. **Given** uma cliente Basic ou Pro, **When** ela abre as telas de origens e destinos, **Then** não vê nenhuma opção nova além de, no máximo, o aviso de que o recurso é do Premium no mesmo padrão dos demais recursos bloqueados.
3. **Given** a leitura do Telegram parada ou com erro, **When** o espelhamento do WhatsApp roda, **Then** ele não é afetado (nem atraso, nem queda, nem reinício).

---

### User Story 2 - Conectar a conta do Telegram com segurança (Priority: P1)

A cliente Premium abre a tela de aplicativos, lê o que o Espelha Grupos vai e não vai fazer com a conta dela, aceita, e conecta a conta do Telegram lendo um QR pelo celular. Pode desconectar quando quiser, e ao desconectar tudo é apagado.

**Why this priority**: sem conexão não há origem; e é aqui que mora a confiança (acesso à conta pessoal, LGPD).

**Independent Test**: conectar uma conta de teste por QR, conferir o estado "conectada", desconectar e conferir que nada da conexão ficou guardado e que o Telegram da cliente mostra o acesso encerrado.

**Acceptance Scenarios**:

1. **Given** uma cliente Premium com acesso em dia, **When** ela escolhe conectar a conta do Telegram, **Then** vê antes um aviso claro de consentimento dizendo: o que é lido (só as origens que ela marcar), o que nunca é lido (conversas privadas e grupos não marcados), que a conta nunca publica nada, como desconectar e a recomendação de usar uma conta dedicada; só segue se aceitar.
2. **Given** o consentimento aceito, **When** a cliente lê o QR pelo aplicativo Telegram no celular, **Then** a tela passa para "conectada", mostrando o nome da conta (sem número completo de telefone nem nenhum segredo).
3. **Given** a conta da cliente tem verificação em duas etapas (senha do Telegram), **When** ela lê o QR, **Then** a tela pede a senha de verificação, usa só para concluir a conexão e nunca a guarda.
4. **Given** o QR expirou sem ser lido, **When** a cliente continua na tela, **Then** um novo QR aparece ou um botão para gerar outro, sem erro técnico.
5. **Given** uma conta conectada, **When** a cliente toca em "Desconectar", **Then** o acesso é encerrado também do lado do Telegram, a conexão guardada e a lista de origens do Telegram são apagadas, e a tela volta ao estado inicial.
6. **Given** uma cliente que não é Premium ou está com acesso vencido, **When** tenta conectar, **Then** é bloqueada com o aviso padrão de recurso do Premium.

---

### User Story 3 - Escolher origens do Telegram e espelhar para o WhatsApp (Priority: P1)

Com a conta conectada, a cliente vê a lista de grupos e canais do Telegram em que ela está, marca os que quer como origem e liga cada origem a destinos de WhatsApp. Quando sai uma oferta na origem, ela chega convertida, com o texto e o rodapé dela, no grupo de WhatsApp.

**Why this priority**: é o caso de uso principal (achadinhos vivem no Telegram, as compradoras estão no WhatsApp).

**Independent Test**: marcar um canal do Telegram de teste como origem ligado a um grupo de WhatsApp de teste, publicar uma oferta no canal e conferir que ela chega uma vez, convertida, no grupo de WhatsApp.

**Acceptance Scenarios**:

1. **Given** uma conta do Telegram conectada, **When** a cliente abre a escolha de origens, **Then** vê os grupos e canais do Telegram em que está, com o nome que ela conhece, e **nunca** as conversas privadas.
2. **Given** uma origem do Telegram ligada a um destino de WhatsApp e o WhatsApp da cliente conectado, **When** uma oferta é publicada na origem, **Then** ela é entregue no destino com link convertido, modelo de texto, cupom, domínio próprio e texto adicional exatamente como uma oferta vinda de uma origem de WhatsApp.
3. **Given** palavras bloqueadas ou lojas permitidas configuradas, **When** a oferta do Telegram não passa nessas regras, **Then** ela é descartada com o mesmo motivo que o WhatsApp registra.
4. **Given** o WhatsApp da cliente desconectado, **When** chega oferta de origem do Telegram com destino de WhatsApp, **Then** ela segue a mesma regra de hoje para WhatsApp desconectado e a cliente vê o motivo no histórico.
5. **Given** um grupo/canal do Telegram que a cliente **não** marcou, **When** sai mensagem nele, **Then** nada é lido, processado ou registrado.
6. **Given** a mesma mensagem de origem entregue mais de uma vez pelo Telegram, ou uma mensagem antiga reentregue depois de uma reconexão, **When** ela chega, **Then** é espelhada no máximo uma vez, e a antiga é descartada com motivo, como no WhatsApp.
7. **Given** várias ofertas seguidas na mesma origem, **When** são processadas, **Then** saem nos destinos na ordem em que chegaram, e uma mensagem travada não para as seguintes.

---

### User Story 4 - Espelhar do Telegram para o Telegram (Priority: P2)

A cliente liga uma origem do Telegram a um grupo de Telegram dela onde o robô do Espelha Grupos já publica. A oferta sai pelo robô do Espelha Grupos, nunca pela conta pessoal.

**Why this priority**: completa as 4 combinações; reaproveita a caixa de saída que já existe.

**Independent Test**: origem do Telegram ligada a um grupo de Telegram já ligado ao robô; publicar oferta na origem e conferir que chega publicada pelo robô, uma vez.

**Acceptance Scenarios**:

1. **Given** uma origem do Telegram ligada a um destino de Telegram, **When** chega uma oferta, **Then** ela é publicada pelo robô do Espelha Grupos, com o mesmo tratamento do WhatsApp e respeitando ritmo, horário e limite diário do destino como já acontece no Telegram.
2. **Given** qualquer combinação de origem e destino, **When** uma publicação é feita, **Then** ela nunca sai pela conta pessoal da cliente.

---

### User Story 5 - Nunca entrar em loop entre aplicativos (Priority: P1)

A conta pessoal da cliente está nos mesmos grupos onde o robô do Espelha Grupos publica. O sistema garante que uma oferta não fique indo e voltando entre aplicativos.

**Why this priority**: um loop multiplica mensagens nos grupos da cliente, queima a reputação dela e pode levar a bloqueio de conta nos dois aplicativos.

**Independent Test**: montar o cenário em que a conta da cliente está no grupo de destino de Telegram e conferir que (a) a oferta publicada pelo robô não é lida como nova, (b) a mesma oferta não volta para o destino de onde saiu, (c) a tela recusa o caminho de ida e volta.

**Acceptance Scenarios**:

1. **Given** a conta da cliente está num grupo do Telegram onde o robô do Espelha Grupos publica, **When** o robô publica uma oferta ali, **Then** a leitura ignora essa mensagem (não vira oferta nova), mesmo que o grupo esteja marcado como origem.
2. **Given** uma oferta já entregue num destino, **When** a mesma oferta (mesmo link) chega de novo por outro aplicativo, **Then** a trava de repetição vale entre aplicativos e ela não é entregue de novo naquele destino dentro da janela de repetição já usada hoje.
3. **Given** a cliente tem a origem A (de um aplicativo) ligada ao destino B (de outro aplicativo), **When** ela tenta ligar a origem B ao destino A, **Then** a tela bloqueia e explica em linguagem simples que isso faria as ofertas irem e voltarem sem parar.
4. **Given** qualquer aplicativo, **When** a cliente tenta usar o mesmo grupo como origem e destino, **Then** a trava atual continua valendo.

---

### User Story 6 - A conta conectada cai, é revogada ou é restrita (Priority: P2)

Se a cliente encerra o acesso pelo próprio Telegram, se o Telegram restringe a conta ou se a conexão cai, o sistema tenta voltar sozinho quando faz sentido, e avisa a cliente (e a operação) quando ela precisa agir.

**Why this priority**: sem isso, a origem para em silêncio e a cliente só descobre dias depois.

**Independent Test**: encerrar o acesso pelo app do Telegram (Configurações → Dispositivos) e conferir que a tela mostra "desconectada" com o que fazer, que a cliente recebe aviso e que as outras origens (WhatsApp) seguem funcionando.

**Acceptance Scenarios**:

1. **Given** uma queda passageira de conexão, **When** a conexão volta, **Then** a leitura recomeça sozinha, sem reprocessar mensagens antigas fora da janela de frescor.
2. **Given** a cliente encerrou o acesso pelo Telegram, **When** o sistema percebe, **Then** a conexão guardada é apagada, a tela mostra "sua conta do Telegram foi desconectada" com o botão de conectar de novo, e a cliente recebe um aviso.
3. **Given** o Telegram pediu para esperar antes de novas consultas, **When** isso acontece, **Then** o sistema espera o tempo pedido, sem insistir.
4. **Given** a conta da cliente foi restringida ou bloqueada pelo Telegram, **When** o sistema percebe, **Then** para de usar essa conta, avisa a cliente em linguagem simples e registra para a operação.
5. **Given** o leitor do Telegram travou ou caiu, **When** isso acontece, **Then** o WhatsApp e a API não são afetados, e a operação recebe aviso interno.
6. **Given** a assinatura Premium venceu, **When** o sistema percebe, **Then** a leitura das origens do Telegram para (sem apagar a escolha de origens), e volta quando o acesso for regularizado.

---

### User Story 7 - Lançamento controlado (Priority: P3)

A operação libera o recurso aos poucos, com termos de uso atualizados e o Premium explicando o recurso na página de preços.

**Why this priority**: necessário para produção, mas só depois de validar memória, regras de uso do Telegram e estabilidade.

**Independent Test**: com a liberação gradual ligada só para contas escolhidas, conferir que só elas veem a opção; conferir texto dos termos e da página de preços.

**Acceptance Scenarios**:

1. **Given** a liberação gradual, **When** uma cliente Premium fora da lista abre a tela, **Then** não vê a opção de conectar a conta do Telegram.
2. **Given** a liberação para todas, **When** a cliente lê os termos de uso, **Then** encontra o que é lido, o que nunca é lido, a recomendação de conta dedicada e o risco de restrição pelo Telegram.

---

### Edge Cases

- A cliente conecta a mesma conta do Telegram em duas contas do Espelha Grupos: a segunda conexão é recusada ou a primeira é encerrada, com aviso claro (nunca duas contas lendo a mesma conta do Telegram).
- A cliente sai do grupo/canal do Telegram que era origem: a origem passa a "com problema" com explicação, sem afetar as outras.
- A origem é um canal do Telegram (só o dono publica) ou um grupo (todos publicam): os dois tipos são aceitos; tópicos de supergrupo contam como o mesmo grupo.
- Mensagem editada ou apagada na origem depois de espelhada: não é reespelhada nem apagada no destino (mesmo comportamento do WhatsApp hoje).
- Mensagem com foto, álbum, só link, só texto, figurinha, enquete: só o que o espelhamento do WhatsApp já trata vira oferta; o resto é ignorado com motivo.
- Texto com formatação e links escondidos atrás de palavras: o link real é extraído para a conversão.
- A cliente marca dezenas de origens de uma vez: o sistema limita quantas origens entram por vez e quantas origens por conta, para não chamar atenção do Telegram.
- A conta da cliente é nova e entra em muitos canais em pouco tempo: o produto não entra em grupos ou canais pela cliente; ela entra pelo Telegram.
- Oferta chega com o leitor fora do ar por horas: ao voltar, mensagens fora da janela de frescor não são espelhadas.
- Premium vence com origens do Telegram ligadas: leitura para, nada é apagado, e volta ao regularizar; ao desconectar manualmente, tudo é apagado.
- A cliente apaga a conta do Espelha Grupos: a conexão com o Telegram é encerrada e apagada junto.

---

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e plano**

- **FR-001**: O recurso MUST estar disponível só para contas com o direito de multicanal do Premium com acesso em dia (D1); qualquer outra conta vê o aviso padrão de recurso do Premium.
- **FR-002**: O sistema MUST permitir ligar/desligar o recurso por ambiente e liberar por lista de contas (liberação gradual), sem afetar quem já usa WhatsApp e Telegram como destino.

**Conexão da conta**

- **FR-003**: Antes de conectar, a cliente MUST ver e aceitar um consentimento claro (o que é lido, o que nunca é lido, que a conta nunca publica, como desconectar, risco de restrição pelo Telegram, recomendação de conta dedicada — D2). O aceite MUST ficar registrado com data.
- **FR-004**: A conexão MUST ser feita lendo um QR com o aplicativo Telegram, com suporte à senha de verificação em duas etapas quando a conta tiver uma; a senha MUST NOT ser guardada.
- **FR-005**: A conexão guardada MUST ficar criptografada, no mesmo padrão já usado para as credenciais de afiliado.
- **FR-006**: Nenhum segredo da conexão MUST aparecer em tela, log, histórico, e-mail, aviso ao admin ou resposta da API.
- **FR-007**: "Desconectar" MUST encerrar o acesso também do lado do Telegram e apagar a conexão guardada, a lista de origens do Telegram e os dados de leitura ligados a ela.
- **FR-008**: Uma mesma conta do Telegram MUST NOT ser lida por duas contas do Espelha Grupos ao mesmo tempo.

**Leitura**

- **FR-009**: A conta pessoal MUST apenas ler; o sistema MUST NOT publicar, responder, reagir, marcar como lida, entrar ou sair de grupos com a conta da cliente.
- **FR-010**: O sistema MUST ler apenas as origens marcadas pela cliente; conversas privadas MUST NOT ser lidas, processadas, listadas ou registradas.
- **FR-011**: A lista para escolher origens MUST mostrar só grupos e canais do Telegram em que a cliente está, com o nome que ela conhece.
- **FR-012**: O sistema MUST ignorar mensagens publicadas pelo robô do Espelha Grupos (trava anti-loop "a").
- **FR-013**: O sistema MUST respeitar os pedidos de espera do Telegram e MUST limitar o número de origens por conta e o ritmo de consultas, para reduzir o risco de restrição.
- **FR-014**: A leitura do Telegram MUST rodar isolada do WhatsApp e da API, de forma que travar ou cair não afete nenhum dos dois.

**Tratamento e entrega**

- **FR-015**: Cada oferta lida MUST passar pelo mesmo tratamento do espelhamento do WhatsApp (D3): conversão de links, modelo de texto, palavras bloqueadas, lojas permitidas, cupons, domínio próprio, texto adicional, trava de repetição, janela de frescor e registro de motivo de descarte.
- **FR-016**: O comportamento do espelhamento para origens do WhatsApp MUST permanecer idêntico (mesmos resultados, textos, motivos e tempos).
- **FR-017**: Ofertas para destinos do WhatsApp MUST sair pelo WhatsApp da cliente e só quando ele estiver conectado, seguindo as regras de hoje (ritmo, intervalo entre destinos, horário).
- **FR-018**: Ofertas para destinos do Telegram MUST sair pelo robô do Espelha Grupos, pela caixa de saída já existente, com as regras de ritmo, horário e limite diário já aplicadas ao Telegram.
- **FR-019**: A mesma mensagem de origem MUST ser espelhada no máximo uma vez, mesmo se reentregue; a ordem por origem MUST ser preservada; uma mensagem travada MUST NOT parar a origem.
- **FR-020**: A trava de repetição por link MUST valer entre aplicativos: uma oferta já entregue num destino não volta a ele, venha de qual aplicativo vier (trava anti-loop "b").
- **FR-021**: Cada oferta da origem do Telegram MUST aparecer no histórico da cliente com origem, destino, aplicativo, resultado e motivo, nas mesmas telas do WhatsApp.

**Montagem de caminhos**

- **FR-022**: A tela MUST bloquear o caminho de ida e volta entre aplicativos diferentes (origem A → destino B e origem B → destino A), com explicação em linguagem simples (trava anti-loop "c").
- **FR-023**: A trava atual (o mesmo grupo não pode ser origem e destino) MUST continuar valendo.
- **FR-024**: Origens do Telegram MUST usar as mesmas telas e regras de configuração das origens do WhatsApp (destinos ligados, palavras bloqueadas, lojas permitidas, modelo de texto).

**Robustez e avisos**

- **FR-025**: Quedas passageiras MUST ser recuperadas sozinhas, sem reprocessar mensagens fora da janela de frescor.
- **FR-026**: Acesso encerrado pela cliente no Telegram, conta restrita ou bloqueada MUST levar o estado a "desconectada"/"com problema" na tela, com o que fazer, e a cliente MUST ser avisada (tela + e-mail); a operação MUST ser avisada por aviso interno.
- **FR-027**: Premium vencido MUST parar a leitura sem apagar a configuração; voltar o acesso MUST retomar a leitura.
- **FR-028**: Apagar a conta do Espelha Grupos MUST encerrar e apagar a conexão do Telegram.
- **FR-029**: A operação MUST ter um diagnóstico de leitura (contas conectadas, estado, última mensagem lida, descartes por motivo) sem expor segredos.

**Texto e lançamento**

- **FR-030**: Todo texto de tela, e-mail e aviso MUST seguir o vocabulário desta spec e o design system v2.
- **FR-031**: Os termos de uso MUST ser atualizados antes da liberação para todas, e a página de preços MUST citar o recurso no Premium.

### Key Entities

- **Conexão da conta do Telegram**: uma por conta do Espelha Grupos; estado (conectando, conectada, desconectada, com problema, pausada por plano), nome visível da conta, conexão guardada criptografada, data do consentimento, data da última leitura.
- **Origem do Telegram**: grupo ou canal do Telegram marcado pela cliente; identificador próprio do Telegram (que não colide com WhatsApp), nome, tipo (grupo/canal), estado e as mesmas configurações de uma origem do WhatsApp.
- **Mensagem lida**: registro mínimo para não espelhar duas vezes e manter a ordem (origem, identificador da mensagem, data); sem guardar conversas fora das origens.
- **Envio**: o mesmo registro de histórico já usado, com o aplicativo da origem e do destino.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero diferença de comportamento para contas só de WhatsApp: testes de regressão do espelhamento passam sem alteração e, em staging, 24 h de observação sem mudança em envios, descartes e quedas.
- **SC-002**: Uma cliente Premium conecta a conta do Telegram e marca a primeira origem em menos de 3 minutos, sem ajuda.
- **SC-003**: 95% das ofertas de origens do Telegram chegam ao destino em até 1 minuto além do tempo que a mesma oferta levaria vinda de uma origem do WhatsApp (descontado o ritmo do destino).
- **SC-004**: Zero loop em teste dirigido: com a conta da cliente presente nos grupos de destino, nenhuma oferta é publicada duas vezes no mesmo destino.
- **SC-005**: Zero mensagens de conversas privadas ou de grupos não marcados registradas em qualquer lugar (verificado por auditoria de logs e banco em staging).
- **SC-006**: Zero segredos da conexão encontrados em logs, e-mails ou respostas da API (verificado por busca dirigida).
- **SC-007**: Após desconectar, 100% dos dados da conexão e das origens do Telegram da conta somem, e o Telegram da cliente mostra o acesso encerrado.
- **SC-008**: Conta revogada ou restrita é percebida e avisada à cliente em até 15 minutos.
- **SC-009**: Memória medida em staging fica dentro do que a dona do produto aprovar (hipótese de partida: ~100 MB + 10–20 MB por conta conectada) antes de ir para produção.
- **SC-010**: Nenhuma conta de teste restringida pelo Telegram durante a fase de validação e o período de liberação gradual.

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| **Acesso total à conta da cliente** (confiança, LGPD) | Uma conexão vazada dá acesso à conta inteira dela | Consentimento explícito e registrado; conexão criptografada; só ler origens marcadas; nunca ler privado; segredo nunca em log/tela/e-mail; desconectar apaga tudo e encerra do lado do Telegram; recomendação de conta dedicada (D2). |
| **Restrição/banimento da conta pelo Telegram** | A cliente perde a conta pessoal | Só leitura; nunca entrar em grupos pela cliente; limite de origens por conta e de ritmo; respeitar pedidos de espera; liberação gradual; aviso nos termos. |
| **Regras de uso do Telegram** | O Telegram pode proibir esse tipo de uso de aplicativo de terceiros | Fase 0 confere as regras antes de qualquer código de produção; registro oficial do aplicativo no Telegram; decisão de seguir é da dona do produto com base nisso. |
| **Estabilidade da biblioteca de leitura** | Travamento ou vazamento derrubaria outras partes | Leitura em processo próprio, isolado da API e dos robôs do WhatsApp (FR-014), com aviso interno se cair. |
| **Loops de espelhamento** | Mensagens repetidas sem fim nos grupos da cliente | Travas anti-loop a, b e c (FR-012, FR-020, FR-022) + trava atual (FR-023), com teste dirigido (SC-004). |
| **Memória** | Processo novo consome RAM do servidor compartilhado | Medição em staging autorizada (D4); OK final da dona do produto antes de produção; alternativa mais leve avaliada no plano. |
| **Comportamento do WhatsApp mudar sem querer** | Regressão para todas as clientes | Reaproveitar o tratamento sem alterá-lo (FR-016); testes de regressão; observação em staging (SC-001). |

## Fases de entrega (para guiar o plano)

0. **Validação**: registro do aplicativo no Telegram (my.telegram.org), conta de teste, conferência das regras de uso do Telegram, medição de memória em staging.
1. **Conectar conta**: consentimento, QR, verificação em duas etapas, criptografia, desconectar, tela.
2. **Escolher e ler origens**: lista de grupos/canais, marcação, leitura só das marcadas, trava anti-loop "a".
3. **Tratar e entregar**: tratamento igual ao WhatsApp, entrega para WhatsApp e para Telegram, travas "b" e "c", histórico.
4. **Robustez**: reconexão, conta revogada/restrita, pedidos de espera, avisos à cliente e à operação, limites, diagnóstico.
5. **Lançamento**: termos de uso, página de preços, liberação gradual.

## Assumptions

- A janela de frescor, a janela da trava de repetição e as regras de ritmo são as mesmas já usadas no espelhamento do WhatsApp e na caixa de saída do Telegram.
- O destino de Telegram já está ligado ao robô do Espelha Grupos pelo fluxo da feature 017; esta feature não muda esse fluxo.
- Limite inicial sugerido de origens do Telegram por conta: igual ao limite de origens do plano Premium para WhatsApp; o número exato é definido no plano após a Fase 0.
- Mídia: a primeira versão trata texto + link e foto com legenda, como o espelhamento do WhatsApp; outros tipos são ignorados com motivo.
- O aviso à cliente usa os canais já existentes (tela + e-mail); o aviso à operação usa o aviso interno já existente do multicanal.
- A escolha da biblioteca de leitura e a forma de isolamento do processo são decisões de plano.
- Staging e produção usam registros/contas de teste separados, como já acontece com o robô do Telegram.

## Out of Scope

- Publicar com a conta pessoal da cliente (sempre robô do Espelha Grupos ou WhatsApp da cliente).
- Ler conversas privadas ou grupos não marcados.
- Entrar em grupos/canais pela cliente.
- Instagram como origem.
- Reespelhar edições ou apagar no destino mensagens apagadas na origem.
- Mudanças no espelhamento WhatsApp → WhatsApp e WhatsApp → Telegram além do necessário para as travas anti-loop entre aplicativos.
