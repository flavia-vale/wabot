# Feature Specification: SHEIN como 5ª loja de conversão de links

**Feature Branch**: `claude/shein-store-support-t2an1z`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Adicionar SHEIN como 5ª loja de conversão de links do BOTinho (além de Shopee, Amazon, Mercado Livre e Magalu). Contexto técnico validado ao vivo em 2026-08-18 (5 links resolvidos, 2 afiliados diferentes, 3 produtos); a cliente confirmou que a SHEIN paga a comissão pelo link montado por nós. Escopo: loja completa — detecção, conversão, painel de credenciais, card de preview com foto, banner de marca para cupom, testes."

## Contexto do produto

Hoje o BOTinho espelha ofertas de quatro lojas (Shopee, Amazon, Mercado Livre e Magalu) trocando o link do afiliado de origem pelo link da própria cliente, para que a comissão da venda seja dela. Links de SHEIN que aparecem nos grupos monitorados hoje **não são convertidos** — ou a oferta não sai, ou sairia creditando comissão a terceiros, o que a invariante do produto proíbe. A SHEIN é uma das maiores fontes de "achadinhos" dos grupos de oferta brasileiros, então cada link de SHEIN que passa hoje é comissão perdida.

A SHEIN credita a comissão por **parâmetro na própria URL** (mesmo mecanismo do Magalu), não por chamada a uma API de geração de link (como Shopee/Amazon/ML). Isso torna a loja mais simples de operar: a cliente cadastra um dado só, o número não vence, e não há sessão para monitorar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar a SHEIN colando um link de afiliada (Priority: P1)

A cliente entra no painel de lojas, encontra a SHEIN ao lado das outras quatro, cola **um link de afiliada dela mesma** (aquele que ela gera no Gerador de Link do painel de afiliada da SHEIN) e salva. O sistema extrai sozinho o número de identificação dela a partir do link; ela não precisa saber qual pedaço do link importa. Se ela colar um link do tipo errado (o gerado pelo botão "compartilhar" do aplicativo), o painel avisa na hora, em português simples, qual link ela deve pegar e onde.

**Why this priority**: Sem a credencial cadastrada nenhuma oferta de SHEIN pode ser convertida — é a porta de entrada de toda a funcionalidade. É também a única superfície que a cliente toca diretamente.

**Independent Test**: Cadastrar a SHEIN no painel com um link de afiliada válido e ver a loja aparecer como pronta; repetir com o link errado (de compartilhamento) e ver o aviso explicando a diferença. Entrega valor mesmo antes da conversão existir: a cliente já organizou a loja e sabe que o dado está certo.

**Acceptance Scenarios**:

1. **Given** a cliente está no painel de lojas com a SHEIN ainda não configurada, **When** ela cola um link de afiliada da SHEIN e salva, **Then** o sistema extrai e guarda o número de identificação dela e a loja passa a aparecer como configurada.
2. **Given** a cliente já sabe o número de identificação dela, **When** ela digita só o número no campo e salva, **Then** o sistema aceita igualmente e a loja fica configurada.
3. **Given** a cliente cola o link gerado pelo botão "compartilhar" do aplicativo da SHEIN, **When** ela tenta salvar, **Then** o sistema recusa e explica, sem jargão, que aquele link não serve e onde pegar o link certo.
4. **Given** a cliente cola um texto que não é link nem número reconhecível, **When** ela tenta salvar, **Then** o sistema recusa com uma mensagem que diz o que era esperado.
5. **Given** a SHEIN está configurada, **When** a cliente abre o painel de lojas, **Then** a SHEIN **não** exibe aviso de "código de acesso vencido" nem status de sessão — porque esse dado não vence.
6. **Given** a SHEIN está configurada, **When** a cliente clica em apagar os dados da loja, **Then** o dado é removido e a loja volta ao estado não configurado.

---

### User Story 2 - Oferta de produto SHEIN é espelhada com a comissão da cliente (Priority: P1)

Um grupo monitorado publica uma oferta com link de SHEIN (curto ou já expandido, de outro afiliado). O BOTinho reconhece que é SHEIN, descobre qual produto é, e publica no grupo de destino um link que credita a comissão à cliente. O link de terceiro nunca é reencaminhado.

**Why this priority**: É o valor central da feature — a razão de existir. Sem isso, cadastrar a loja não serve para nada.

**Independent Test**: Publicar uma oferta com link de SHEIN num grupo monitorado e conferir no grupo de destino que o link publicado leva ao mesmo produto e carrega a identificação da cliente, e não a do afiliado de origem.

**Acceptance Scenarios**:

1. **Given** a SHEIN configurada e um link curto de SHEIN de outro afiliado na mensagem monitorada, **When** o BOTinho processa a mensagem, **Then** a oferta espelhada sai com um link que aponta ao mesmo produto e credita a cliente.
2. **Given** um link de SHEIN que não permite identificar o produto (formato de compartilhamento do aplicativo, com o produto trancado em um código embaralhado), **When** o BOTinho processa a mensagem, **Then** a conversão **falha honestamente** e a oferta não é publicada — o link de terceiro nunca é enviado, nem parcialmente.
3. **Given** a SHEIN **não** configurada pela cliente, **When** chega uma oferta de SHEIN, **Then** a oferta não é publicada com link de terceiro, e o painel de registros mostra a razão de forma compreensível (falta configurar a loja).
4. **Given** a resolução do link de SHEIN não conclui (a loja não respondeu ou barrou o acesso), **When** o BOTinho processa a mensagem, **Then** a conversão falha honestamente e nada é publicado com o link original.
5. **Given** um link de SHEIN que já está em formato de página de destino com o produto identificável, **When** o BOTinho converte, **Then** só a identificação da cliente é aplicada; nenhum rastro da sessão de quem gerou o link original é copiado para o link publicado.
6. **Given** uma oferta de SHEIN convertida com sucesso, **When** ela é registrada no painel de registros, **Then** ela aparece como enviada, com a loja identificada como SHEIN.

---

### User Story 3 - A oferta de SHEIN sai com foto do produto (Priority: P2)

A oferta espelhada de SHEIN chega ao grupo como um card clicável com a foto do produto, do mesmo jeito que as ofertas das outras quatro lojas. O título da oferta continua sendo o texto que veio do grupo de origem — a SHEIN não fornece o nome real do produto por esse caminho, e a frase promocional genérica dela nunca pode virar o título da oferta.

**Why this priority**: Oferta sem foto tem desempenho muito pior nos grupos, e a paridade visual com as outras lojas é o que faz a SHEIN parecer "de primeira classe". Mas a conversão (P1) já entrega comissão mesmo sem a foto, por isso P2.

**Independent Test**: Enviar uma oferta de SHEIN e conferir no celular que o card aparece com a foto do produto em boa resolução e com o texto original do grupo de origem como descrição.

**Acceptance Scenarios**:

1. **Given** uma oferta de SHEIN convertida, **When** ela é publicada, **Then** o card exibe a foto do produto em resolução adequada para o card do WhatsApp.
2. **Given** a SHEIN não devolveu foto para aquele link, **When** a oferta é publicada, **Then** a oferta sai mesmo assim (sem foto), sem erro para a cliente.
3. **Given** a página de origem devolve apenas uma frase promocional genérica no lugar do nome do produto, **When** a oferta é montada, **Then** essa frase **nunca** é usada como título da oferta; o texto do grupo de origem é preservado.
4. **Given** uma oferta de SHEIN, **When** o card é montado, **Then** o nome da loja aparece no card assim como acontece para Amazon, Shopee, Mercado Livre e Magalu.

---

### User Story 4 - Cupom e campanha da SHEIN também convertem (Priority: P3)

Links de SHEIN que não apontam para um produto específico (cupom, campanha, vitrine) também são convertidos, creditando a cliente, sem depender de nenhuma autorização adicional — o mesmo tratamento já dado ao Magalu.

**Why this priority**: Complementa a cobertura, mas o volume dominante nos grupos é link de produto. Depende da conversão base já existir.

**Independent Test**: Espelhar uma mensagem com link de campanha/cupom de SHEIN e conferir que o link publicado credita a cliente.

**Acceptance Scenarios**:

1. **Given** um link de campanha ou cupom da SHEIN numa mensagem monitorada e a loja configurada, **When** o BOTinho converte, **Then** o link publicado credita a cliente e o link de terceiro não é publicado.
2. **Given** um link de cupom da SHEIN, **When** a oferta é publicada, **Then** ela recebe o mesmo tratamento visual de cupom já usado pelas outras lojas.

---

### Edge Cases

- **Link de compartilhamento do aplicativo (armadilha crítica)**: existe um formato de link de SHEIN em que o produto fica trancado num código embaralhado e não há como identificá-lo. Trocar apenas a identificação do afiliado nesse formato produziria um link que **parece** convertido mas pode creditar a comissão a quem compartilhou. A conversão precisa **recusar** esse formato, nunca publicá-lo.
- **Sistema antifraude da SHEIN no meio do caminho**: a cadeia de redirecionamento pode terminar numa página de verificação de robô, que responde como se fosse uma página normal. A resolução precisa parar antes disso e usar o passo anterior — que é onde os dados estão. Se não conseguir, falha honesta.
- **Página do produto inacessível para o BOTinho**: a página de produto da SHEIN é bloqueada pelo sistema antifraude quando acessada pelo servidor. Título e preço **não** podem ser buscados de lá; a feature não depende disso.
- **Loja não configurada**: oferta de SHEIN chegando antes de a cliente cadastrar a loja — nunca publicar o link de terceiro; registrar de forma compreensível.
- **Dado de identificação inválido/removido depois de cadastrado**: a conversão falha honestamente, sem publicar o original.
- **Link de SHEIN de outro país** (domínios internacionais): tratado como SHEIN para efeito de detecção; a conversão segue a mesma regra (só publica se conseguir identificar o produto e aplicar a identificação da cliente).
- **Domínio parecido mas inexistente**: apenas os domínios reais da SHEIN são reconhecidos; nada é assumido por semelhança de nome.

## Requirements *(mandatory)*

### Functional Requirements

**Detecção e catálogo de lojas**

- **FR-001**: O sistema MUST reconhecer a SHEIN como loja suportada em todos os pontos onde hoje reconhece Shopee, Amazon, Mercado Livre e Magalu (detecção de link, rotulagem da loja em registros e painéis, seleção de conversor).
- **FR-002**: O sistema MUST reconhecer como SHEIN apenas os domínios reais da loja (incluindo os domínios de encurtamento e de redirecionamento usados pelo programa de afiliados), e MUST NOT reconhecer domínios semelhantes que não pertençam à SHEIN.
- **FR-003**: A SHEIN MUST aparecer para a cliente com nome e identidade visual próprios, no mesmo nível das outras quatro lojas.

**Credencial da cliente**

- **FR-004**: O sistema MUST oferecer à cliente **um único campo** para configurar a SHEIN, aceitando tanto um link de afiliada dela quanto o número de identificação diretamente.
- **FR-005**: Ao salvar, o sistema MUST extrair sozinho o número de identificação da cliente a partir do link colado, sem exigir que ela saiba qual parte do link importa.
- **FR-006**: Ao salvar, o sistema MUST distinguir o link de afiliada (aceito) do link de compartilhamento do aplicativo (recusado) e, no caso recusado, MUST explicar em linguagem leiga qual link pegar e onde.
- **FR-007**: Toda a linguagem exibida à cliente para a SHEIN MUST ser leiga: nenhum nome técnico de parâmetro ou de campo interno pode aparecer na tela, em rótulo, dica, aviso ou mensagem de erro.
- **FR-008**: A SHEIN MUST NOT participar das verificações de validade de sessão nem dos avisos de "código de acesso vencido" — o dado cadastrado não vence.
- **FR-009**: A cliente MUST poder apagar o dado cadastrado da SHEIN pelo painel, e a operação MUST ser idempotente (apagar duas vezes não gera erro).
- **FR-010**: O dado de identificação da cliente MUST ser guardado com a mesma proteção em repouso já aplicada às credenciais das outras lojas.

**Conversão**

- **FR-011**: O sistema MUST resolver links curtos/encurtados de SHEIN até encontrar o endereço que identifica o produto, parando **antes** de entrar na página de verificação antifraude da loja.
- **FR-012**: O sistema MUST publicar um link que credite a comissão à cliente configurada, aplicando somente a identificação dela sobre o endereço do produto.
- **FR-013**: O sistema MUST NOT copiar para o link publicado nenhum rastro da sessão de quem gerou o link de origem (identificadores de requisição, de comportamento ou de sessão).
- **FR-014**: O sistema MUST recusar a conversão (falha honesta, nada publicado) quando o produto não puder ser identificado a partir do link — em particular no formato de compartilhamento do aplicativo, em que o produto fica trancado num código embaralhado.
- **FR-015**: O sistema MUST NOT encaminhar o link de terceiro em nenhuma circunstância, nem parcialmente, nem como resultado de conversão parcial. Falha de conversão sempre resulta em não publicar.
- **FR-016**: Links de SHEIN que não apontam para um produto específico (cupom, campanha, vitrine) MUST ser convertidos pelo mesmo mecanismo, sem depender de autorização adicional (paridade com o tratamento já dado ao Magalu).
- **FR-017**: Quando a conversão falhar, a razão MUST ser registrada com uma explicação compreensível para a cliente no painel de registros, usando a taxonomia de erros já existente.

**Apresentação da oferta**

- **FR-018**: A oferta espelhada de SHEIN MUST sair como card clicável com a foto do produto, na melhor resolução disponível, quando a foto puder ser obtida.
- **FR-019**: Se a foto não puder ser obtida, a oferta MUST ser publicada mesmo assim, sem erro para a cliente.
- **FR-020**: A frase promocional genérica que a SHEIN devolve no lugar do nome do produto MUST NOT ser usada como título da oferta em nenhuma superfície; o texto que veio do grupo de origem é preservado.
- **FR-021**: A oferta de SHEIN MUST exibir o nome da loja no card, do mesmo modo que as demais lojas.
- **FR-022**: Ofertas de cupom da SHEIN MUST receber o mesmo tratamento visual de cupom já aplicado às outras lojas.

**Qualidade e operação**

- **FR-023**: O comportamento das quatro lojas já existentes MUST permanecer inalterado — nenhuma regressão em detecção, conversão, painel, card ou avisos.
- **FR-024**: A feature MUST NOT introduzir processo de execução novo nem dependência externa nova.
- **FR-025**: As regras críticas (recusa do formato não conversível, não vazamento do link de terceiro, não vazamento do título genérico, parada antes da página antifraude, não cópia de rastro de sessão) MUST ser cobertas por testes automatizados de regressão.

### Key Entities

- **Loja SHEIN**: nova entrada no catálogo de lojas suportadas, com nome exibido, domínios reconhecidos, regra de conversão própria e identidade visual.
- **Credencial SHEIN da cliente**: um único dado — o número de identificação de afiliada dela — guardado protegido, sem validade, extraído de um link colado ou informado diretamente.
- **Link de SHEIN de origem**: link encontrado na mensagem monitorada; pode ser encurtado, expandido conversível, ou de compartilhamento (não conversível).
- **Link de SHEIN publicado**: link resultante, contendo o produto de origem e a identificação da cliente, e nada da sessão de quem gerou o original.
- **Foto do produto**: imagem obtida pelo caminho de resolução do link, usada no card, na maior resolução disponível.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cliente consegue configurar a SHEIN colando um link e salvando, em menos de 1 minuto, sem consultar ajuda externa.
- **SC-002**: 100% das ofertas de SHEIN publicadas creditam a comissão à cliente configurada — nenhuma oferta publicada carrega identificação de terceiro.
- **SC-003**: 100% dos links de SHEIN em que o produto não pode ser identificado resultam em oferta **não publicada** (nunca em link de terceiro publicado).
- **SC-004**: Pelo menos 90% das ofertas de SHEIN convertidas com sucesso são publicadas com a foto do produto no card.
- **SC-005**: Nenhuma oferta de SHEIN é publicada com a frase promocional genérica da loja como título.
- **SC-006**: Nenhum termo técnico interno aparece em qualquer tela ou mensagem relacionada à SHEIN vista pela cliente.
- **SC-007**: Após a entrada da SHEIN, as taxas de sucesso de conversão das quatro lojas existentes permanecem iguais às do período anterior (sem regressão).
- **SC-008**: A cliente que colar o tipo errado de link recebe, no mesmo momento do salvamento, uma orientação que a leva ao link certo sem precisar abrir suporte.

## Assumptions

- A comissão da SHEIN é creditada pelo parâmetro de identificação na própria URL, sem chamada a serviço de geração de link — confirmado pela cliente e validado em campo.
- Os parâmetros do programa que não variam entre afiliadas são tratados como constantes do sistema e **não** fazem parte do que a cliente cadastra.
- Título e preço do produto SHEIN **não** são obtidos da página do produto (bloqueada para o servidor). O texto da oferta continua vindo do grupo de origem, como já acontece hoje no espelhamento.
- A foto do produto é obtida pelo mesmo caminho de resolução do link, não exigindo acesso à página de produto.
- A cliente já possui conta ativa no programa de afiliados da SHEIN e sabe gerar um link no painel dela; a feature não cobre cadastro na SHEIN.
- Não há necessidade de monitorar validade da credencial da SHEIN, pois o identificador é permanente.
- A funcionalidade reaproveita integralmente a infraestrutura existente de conversão, credenciais, registros e montagem de card — sem novos processos, filas ou dependências.
- O material de referência técnica já validado (plano aprovado e ferramenta de diagnóstico já versionada no repositório) é a fonte de verdade sobre o comportamento da SHEIN; não é necessária nova investigação externa.
- Entrega segue o fluxo canônico do projeto: validação em ambiente de homologação antes de produção.

## Out of Scope

- Raspagem de título e preço a partir da página de produto da SHEIN.
- Qualquer integração por API com a SHEIN (não existe API pública de link ou de produto para este programa).
- Suporte ao formato de link de compartilhamento do aplicativo como link conversível.
- Adição de qualquer loja além da SHEIN.
- Monitoramento de validade/expiração da credencial da SHEIN.
