# Feature Specification: Cupons de desconto da própria cliente

**Feature Branch**: `017-client-coupon-catalog`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Cadastro de cupons de desconto da própria cliente, usáveis nos templates de oferta (inspirado no concorrente DivulgaNinja)."

## Contexto do problema

Hoje a cliente não tem onde guardar os cupons que ela mesma conquista com as
lojas. A única coisa parecida que existe é a variável `{linhaDeCupom}`, que
**copia a frase de cupom escrita pelo grupo de origem** — ou seja, divulga o
cupom de um concorrente, e só funciona quando a mensagem espelhada por acaso
traz um cupom escrito. Cupom próprio da cliente não tem lugar nenhum no produto.

Esta feature cria esse lugar: a cliente cadastra os cupons dela uma vez, marca
para qual loja cada um vale, e o robô insere sozinho o cupom certo em cada
oferta. A variável `{linhaDeCupom}` sai do produto na mesma entrega.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar e manter os cupons da loja (Priority: P1)

A cliente abre uma tela nova no painel, cadastra o código de cupom que a loja
deu para ela (por exemplo, 15% na Shopee), escolhe a loja, diz se é desconto em
porcentagem ou em reais e, se quiser, informa até quando o cupom vale. Ela pode
ligar, desligar, editar e apagar qualquer cupom a qualquer momento.

**Why this priority**: sem o cadastro não existe nada para publicar. É o pedaço
que entrega valor sozinho: mesmo antes de qualquer oferta sair com cupom, a
cliente já tem os cupons organizados num lugar só, com validade visível, em vez
de num bloco de notas.

**Independent Test**: cadastrar três cupons de lojas diferentes, desligar um,
apagar outro e recarregar a tela — a lista precisa refletir exatamente o que foi
feito, e o cupom com validade vencida precisa aparecer marcado como vencido.

**Acceptance Scenarios**:

1. **Given** a cliente na tela de cupons sem nenhum cupom cadastrado, **When**
   ela preenche código, loja, tipo de desconto e valor e salva, **Then** o cupom
   aparece na lista como ligado e válido.
2. **Given** um cupom cadastrado sem data de validade, **When** a cliente olha a
   lista, **Then** ele aparece como "não vence" e continua valendo por tempo
   indeterminado.
3. **Given** um cupom cujo último dia de validade já passou, **When** a cliente
   abre a lista, **Then** ele aparece claramente marcado como vencido e não é
   usado em nenhuma oferta, mesmo estando ligado.
4. **Given** a cliente tentando salvar um cupom sem código ou sem valor de
   desconto, **When** ela confirma, **Then** o sistema recusa e diz em linguagem
   simples o que falta preencher.
5. **Given** um cupom ligado, **When** a cliente o desliga, **Then** ele para de
   ser usado nas próximas ofertas imediatamente, sem ser apagado.

---

### User Story 2 - A oferta sai com o melhor cupom, sozinha (Priority: P1)

A cliente coloca a variável de cupom no template de oferta. A partir daí, toda
oferta que usar esse template e for de uma loja que tem cupom ativo sai com o
cupom já escrito. Quando há mais de um cupom ativo para aquela loja, o robô
escolhe o que dá **mais economia em reais** naquela oferta específica.

**Why this priority**: é a razão de existir do cadastro. Sem isso, o cadastro é
uma agenda; com isso, vira dinheiro na oferta.

**Independent Test**: com dois cupons ativos da mesma loja (um de 10% e um de
R$ 20) e uma oferta de R$ 300, a mensagem publicada precisa trazer o de 10%
(R$ 30 de economia). Na mesma oferta a R$ 100, precisa trazer o de R$ 20.

**Acceptance Scenarios**:

1. **Given** um único cupom ativo e válido da loja da oferta, **When** a oferta
   é publicada com um template que tem a variável de cupom, **Then** a mensagem
   sai com esse cupom.
2. **Given** dois cupons ativos e válidos da mesma loja, um de 10% e um de R$ 20,
   e uma oferta de R$ 300, **When** a oferta é publicada, **Then** sai o cupom de
   10%, porque economiza mais em reais.
3. **Given** os mesmos dois cupons e uma oferta de R$ 100, **When** a oferta é
   publicada, **Then** sai o cupom de R$ 20.
4. **Given** dois cupons que dão exatamente a mesma economia naquela oferta,
   **When** a oferta é publicada, **Then** sai o que foi cadastrado mais
   recentemente.
5. **Given** cupons ativos apenas da Amazon, **When** sai uma oferta da Shopee,
   **Then** nenhum cupom é inserido e a mensagem não fica com linha vazia,
   emoji solto, asterisco órfão nem qualquer resto de formatação.
6. **Given** que o preço daquela oferta não pôde ser lido com confiança,
   **When** existem cupons ativos e válidos daquela loja, **Then** o sistema
   ainda publica um cupom, escolhido por uma ordem fixa e previsível, em vez de
   publicar nenhum.

---

### User Story 3 - Ligar o cupom nas ofertas automáticas (Priority: P2)

No cadastro e na edição de uma automação de ofertas, a cliente marca uma opção
dizendo que aquela automação deve usar os cupons cadastrados e ativos. Automação
que ela não marcou continua funcionando exatamente como antes.

**Why this priority**: as ofertas automáticas são um volume grande e constante,
mas dependem do cadastro (P1) já existir. Além disso, mudar o comportamento de
automações antigas sem a cliente pedir seria pior que não entregar.

**Independent Test**: criar duas automações idênticas, marcar a opção em uma só,
e conferir que apenas as ofertas da automação marcada saem com cupom.

**Acceptance Scenarios**:

1. **Given** uma automação já existente de antes desta entrega, **When** o
   sistema é atualizado, **Then** ela continua enviando exatamente o mesmo texto
   de antes, sem cupom nenhum.
2. **Given** uma automação com a opção de cupons marcada, **When** ela dispara
   uma oferta de loja com cupom ativo, **Then** a oferta sai com o cupom.
3. **Given** uma automação com a opção marcada mas nenhum cupom ativo para
   aquela loja, **When** ela dispara, **Then** a oferta sai normalmente, sem
   cupom e sem sobra de formatação.
4. **Given** uma automação com a opção marcada, **When** a cliente desmarca a
   opção, **Then** os próximos envios daquela automação voltam a sair sem cupom.

---

### User Story 4 - Sair do `{linhaDeCupom}` sem quebrar template salvo (Priority: P2)

A cliente que já usava a variável `{linhaDeCupom}` nos templates dela não pode
ficar com template quebrado, nem ver o texto `{linhaDeCupom}` cru aparecendo na
tela de edição ou, pior, na mensagem enviada ao grupo.

**Why this priority**: é dívida obrigatória da mesma entrega — a variável antiga
divulga cupom de concorrente e precisa sair. Mas quebrar template de cliente em
produção é inaceitável, então a saída precisa ser cuidada.

**Independent Test**: pegar um template salvo contendo `{linhaDeCupom}`, aplicar
a atualização, abrir a tela de templates e publicar uma oferta com ele — nem a
tela nem a mensagem podem conter `{linhaDeCupom}` ou uma lacuna estranha.

**Acceptance Scenarios**:

1. **Given** um template salvo com `{linhaDeCupom}`, **When** a cliente abre a
   tela de templates depois da atualização, **Then** ela não vê o texto
   `{linhaDeCupom}` em lugar nenhum.
2. **Given** o mesmo template, **When** uma oferta é publicada com ele, **Then**
   a mensagem sai sem `{linhaDeCupom}` cru e sem linha vazia ou emoji solto no
   lugar onde a variável estava.
3. **Given** a lista de variáveis disponíveis na tela de templates, **When** a
   cliente a consulta, **Then** `{linhaDeCupom}` não é mais oferecida e a nova
   variável de cupom aparece com nome e exemplo em português simples.
4. **Given** um template que a cliente escrever daqui para a frente, **When** ela
   digitar `{linhaDeCupom}` manualmente, **Then** isso é tratado como texto não
   reconhecido e some da mensagem final, sem quebrar nada.

---

### Edge Cases

- **Cupom que vence entre o cadastro e o envio**: vale a validade no momento do
  envio, nunca a do momento em que a oferta foi criada ou enfileirada. Cupom que
  venceu ou foi desligado antes do envio não é publicado.
- **Oferta de loja que não está na lista de lojas suportadas**: nenhum cupom é
  inserido; a oferta sai normalmente.
- **Não foi possível identificar a loja da oferta**: nenhum cupom é inserido; a
  oferta sai normalmente (não adivinhar loja).
- **Cupom com desconto em reais maior que o preço da oferta**: a economia
  considerada na comparação é limitada ao preço da oferta, para não eleger um
  cupom de R$ 500 numa oferta de R$ 50 só por causa do número.
- **Porcentagem fora da faixa possível** (0 ou acima de 100) e **valor em reais
  igual ou menor que zero**: recusados no cadastro, com explicação simples.
- **Template contém a variável de cupom mais de uma vez**: o mesmo cupom aparece
  nas duas posições, sem erro.
- **Cliente sem nenhum cupom cadastrado**: tudo funciona como antes desta
  entrega; a variável de cupom simplesmente desaparece das mensagens.
- **Código de cupom repetido para a mesma loja**: permitido (a loja pode dar
  códigos parecidos), mas a tela avisa que já existe um igual.
- **Envio sem template** (mensagem espelhada crua, repasse): nada muda, nunca é
  inserido cupom.

## Requirements *(mandatory)*

### Functional Requirements

**Cadastro**

- **FR-001**: A cliente MUST poder cadastrar, editar, ligar/desligar e apagar
  cupons próprios numa tela do painel dedicada a isso.
- **FR-002**: Cada cupom MUST ter: código do cupom (obrigatório), loja
  (obrigatória), tipo de desconto — porcentagem ou valor em reais (obrigatório),
  valor do desconto (obrigatório), nome interno (opcional), validade (opcional) e
  estado ligado/desligado.
- **FR-003**: As lojas aceitas MUST ser exatamente as lojas já suportadas pelo
  produto: Amazon, Mercado Livre, Shopee, Magazine Luiza, SHEIN e AliExpress.
- **FR-004**: Cupom sem data de validade MUST ser tratado como cupom que nunca
  vence.
- **FR-005**: Cupom vencido MUST ser exibido como vencido na tela e MUST NOT ser
  usado em nenhuma oferta, mesmo que esteja ligado — o sistema não apaga nem
  desliga o cupom sozinho.
- **FR-006**: O sistema MUST recusar cadastro sem código, sem loja, sem valor, com
  porcentagem fora de 1 a 100 ou com valor em reais igual ou menor que zero,
  sempre explicando em linguagem simples o que falta.
- **FR-007**: Os cupons MUST pertencer a cada cliente separadamente — nenhuma
  cliente enxerga ou usa cupom de outra.

**Escolha do cupom**

- **FR-008**: Quando houver mais de um cupom ligado e não vencido da mesma loja
  da oferta, o sistema MUST escolher o que gerar **maior economia em reais**
  sobre o preço daquela oferta: porcentagem × preço para cupons percentuais, e o
  próprio valor para cupons em reais.
- **FR-009**: A economia considerada para um cupom em reais MUST ser limitada ao
  preço da oferta, para não superestimar cupom maior que o produto.
- **FR-010**: Em caso de empate na economia, o sistema MUST escolher o cupom
  cadastrado mais recentemente.
- **FR-011**: Quando o preço da oferta não for conhecido ou não for confiável, o
  sistema MUST NOT inventar comparação: escolhe por uma ordem fixa e previsível —
  maior porcentagem primeiro, depois maior valor em reais, depois o mais recente.
- **FR-012**: O comportamento seguro MUST ser publicar algum cupom válido em vez
  de nenhum. Nenhum cupom só quando de fato não existe cupom ligado e válido
  daquela loja.
- **FR-013**: A decisão de qual cupom usar MUST viver numa regra isolada, sem
  depender de banco de dados nem de internet, e MUST ter teste automatizado
  próprio cobrindo comparação, empate, cupom vencido, cupom desligado, preço
  ausente e teto do valor em reais.
- **FR-014**: A validade e o estado ligado/desligado que valem MUST ser os do
  **momento do envio**, não os do momento em que a oferta foi criada, gerada ou
  enfileirada.

**Variável de template**

- **FR-015**: MUST existir uma variável nova de cupom nos templates de oferta, com
  nome em português simples e coerente com as variáveis que já existem.
- **FR-016**: A variável MUST aparecer na lista de variáveis disponíveis da tela
  de templates, com rótulo e exemplo compreensíveis para leiga.
- **FR-017**: Quando não houver cupom aplicável, a variável MUST desaparecer da
  mensagem sem deixar linha vazia, espaço duplo, emoji solto, asterisco ou
  pontuação órfã — o mesmo cuidado já aplicado às demais variáveis não
  resolvidas.
- **FR-018**: O texto publicado do cupom MUST ser compreensível sozinho, indicando
  o código e o desconto de forma leiga.

**Remoção do `{linhaDeCupom}`**

- **FR-019**: A variável `{linhaDeCupom}` MUST ser removida do produto: sai da
  lista de variáveis oferecidas, deixa de ser preenchida e deixa de copiar a
  frase de cupom do grupo de origem.
- **FR-020**: Templates já salvos que contenham `{linhaDeCupom}` MUST continuar
  funcionando: nem a tela de edição nem a mensagem enviada podem exibir o texto
  cru `{linhaDeCupom}`, e o lugar onde ela estava não pode virar lacuna, linha
  vazia ou sobra de formatação.
- **FR-021**: A remoção MUST NOT afetar as demais variáveis do template, em
  especial a que traz o preço escrito na oferta de origem, que continua existindo
  e funcionando.

**Onde o cupom vale**

- **FR-022**: No cadastro e na edição de uma automação de ofertas MUST existir uma
  opção para inserir os cupons cadastrados e ativos naquela automação.
- **FR-023**: Automações que já existiam MUST continuar com o comportamento atual
  (sem cupom) até que a cliente marque a opção — a atualização não pode mudar
  sozinha o que já está no ar.
- **FR-024**: Na fila de ofertas e no espelhamento de grupos monitorados, o cupom
  MUST entrar **somente** quando o envio estiver usando template **e** o template
  contiver a variável de cupom. Sem template ou sem a variável, nada muda.
- **FR-025**: O painel "Criar oferta" MUST ficar fora desta versão: ele não ganha
  escolha de cupom nem pré-visualização de cupom.

**Linguagem e qualidade**

- **FR-026**: Toda a superfície visível (tela de cupons, opção da automação,
  rótulo e exemplo da variável, mensagens de erro e avisos) MUST usar linguagem
  leiga em português, sem jargão técnico. MUST existir teste que falha se jargão
  voltar.
- **FR-027**: A feature MUST NOT introduzir processo novo em execução contínua nem
  aumento relevante de consumo de memória; usa o banco existente mais uma tabela
  nova.
- **FR-028**: A mudança de banco MUST ser apenas aditiva (nada é removido nem
  renomeado no que já existe).

### Key Entities

- **Cupom da cliente**: um código de desconto que pertence a uma cliente e vale
  para uma loja. Guarda o código, um nome interno opcional, o tipo de desconto
  (porcentagem ou reais), o valor, a loja, a validade opcional, o estado
  ligado/desligado e a data de cadastro (que é o critério de desempate).
- **Automação de ofertas** (já existe): ganha a informação de que aquela
  automação usa ou não os cupons cadastrados.
- **Template de oferta** (já existe): ganha a variável nova de cupom e perde a
  variável `{linhaDeCupom}`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cliente cadastra o primeiro cupom em menos de 1 minuto, sem
  precisar de ajuda do suporte.
- **SC-002**: Em 100% das ofertas de loja com cupom ligado e válido, publicadas
  por template que contém a variável de cupom, o cupom aparece na mensagem.
- **SC-003**: Em 100% das ofertas sem cupom aplicável, a mensagem sai sem
  qualquer resto visível — nenhuma linha vazia extra, emoji solto ou marcador de
  variável.
- **SC-004**: Zero ocorrências do texto `{linhaDeCupom}` em mensagens publicadas e
  em telas do painel após a entrega.
- **SC-005**: Zero automações existentes mudam de comportamento sem a cliente ter
  marcado a opção.
- **SC-006**: Quando há mais de um cupom concorrendo, o cupom publicado é o de
  maior economia em reais em 100% dos casos com preço conhecido, verificável por
  teste automatizado.
- **SC-007**: Zero chamadas a banco ou internet dentro da regra de escolha do
  cupom, verificável por teste automatizado.
- **SC-008**: Nenhum processo novo em execução contínua e nenhum aumento relevante
  de memória medido após a entrega.

## Assumptions

- **Comparação simplificada**: como esta versão **não** tem valor mínimo de
  compra, teto de desconto nem limite de usos, a comparação entre cupons é
  apenas porcentagem × preço contra valor fixo em reais. Se esses campos entrarem
  numa versão futura, a regra de escolha precisará ser revista — esta premissa
  fica registrada de propósito.
- **Fora de escopo nesta versão**: valor mínimo de compra, teto de desconto,
  limite de quantidade de usos, painel "Criar oferta", cupom por grupo de
  destino, cupom por produto específico, validação do cupom junto à loja
  (o produto confia no que a cliente cadastrou) e qualquer relatório de uso ou
  desempenho de cupom.
- **Sem verificação junto à loja**: o produto não tem como saber se o cupom
  realmente funciona no site da loja; a responsabilidade pelo código cadastrado é
  da cliente. A tela deve deixar isso claro sem assustar.
- **Loja da oferta**: é identificada pelo mesmo mecanismo que o produto já usa
  para saber de que loja é um link. Quando esse mecanismo não conclui, nenhum
  cupom é inserido.
- **Preço da oferta**: quando existe, vem do mesmo dado que já alimenta o preço no
  template. Nos caminhos em que esse dado não é confiável, vale a ordem fixa do
  FR-011.
- **Momento da decisão**: o cupom é escolhido e escrito na hora do envio, e não no
  momento em que a oferta foi criada ou enfileirada — é isso que garante o FR-014
  para itens que ficam esperando na fila.
- **Migração do `{linhaDeCupom}`**: os templates salvos não precisam ser
  reescritos no banco para a cliente ficar protegida; o essencial é que nem a
  tela nem a mensagem exibam o texto cru. Reescrever o template salvo é uma opção
  de implementação, não uma exigência da spec.
- **Fluxo de entrega**: branch a partir de `develop`, PR contra `develop`, nunca
  direto para `main`.

## Nota de operação (obrigatória na entrega)

Em produção no modo em que a API delega o ciclo de vida dos robôs ao supervisor,
**o deploy da API não recarrega os robôs**. Portanto:

- a tela de cupons, o cadastro e a opção da automação passam a valer assim que a
  API sobe;
- o efeito no **espelhamento de grupos monitorados** e na **fila de ofertas** só
  passa a valer depois de reiniciar o supervisor dos robôs — o que **reconecta
  todas as sessões de WhatsApp de uma vez**.

Esse reinício é decisão humana, anunciada antes, nunca feito às cegas. Enquanto
ele não acontecer, o comportamento esperado é: cupons cadastrados normalmente,
mas ofertas espelhadas e da fila ainda saindo sem cupom. Isso é o esperado, não
defeito.
