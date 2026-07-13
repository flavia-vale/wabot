# Feature Specification: Fallback de vitrine do Mercado Livre não usado apesar de vitrine cadastrada

**Feature Branch**: `004-ml-vitrine-fallback`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Corrigir o caso em que ofertas do Mercado Livre com link de vitrine/perfil de loja são marcadas como 'ignorado' no painel, mesmo quando a usuária TEM um link de vitrine próprio cadastrado nos IDs de afiliada do Mercado Livre."

## Contexto do incidente (produção)

Log observado pela cliente no painel (produção, canal Mercado Livre):

- **12/07/2026 21:14 — status "na fila"**: mensagem
  `🛍️ Minhas listas de recomendações ~De 72,90~ 💥 Por 49,90 👉 https://mercadolivre.com/…`
  — canal `mercadolivre` — Monitor `prd` → Alvo `prd`.
- **12/07/2026 21:14 — status "ignorado"** com motivo mostrado ao usuário:
  "Esse link era uma vitrine/perfil de outra loja, que o Mercado Livre não aceita
  converter em link de afiliado. A oferta saiu usando o link da SUA vitrine,
  cadastrado em IDs de afiliada → Mercado Livre."

**Contradição relatada**: a mensagem ao usuário afirma "A oferta saiu usando o
link da SUA vitrine", mas o status é **"ignorado"** e a oferta **não saiu**. A
cliente confirma que TEM um link de vitrine próprio cadastrado nos IDs de
afiliada do Mercado Livre e esperava que, havendo vitrine cadastrada, o sistema
usasse essa vitrine como substituto e a oferta saísse normalmente.

**Ponto de partida técnico já conhecido (a ser confirmado, não presumido)**: o
código já contém lógica de fallback de vitrine em `src/converters/mercadolivre.js`
(`buildVitrineFallback`, `isValidMlVitrineUrl`, `isDirectVitrineShare`). A feature
existe para descobrir **por que essa lógica não foi acionada neste caso real** e
corrigir a causa raiz, sem regredir os caminhos de produto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Oferta de vitrine sai usando a vitrine cadastrada da afiliada (Priority: P1)

Uma oferta chega de um canal monitorado do Mercado Livre contendo um link que o
ML não aceita converter em link de afiliado porque é uma vitrine/perfil/lista de
recomendações de outra loja. A usuária tem o link da SUA própria vitrine
cadastrado nos IDs de afiliada → Mercado Livre. A oferta espelhada deve sair para
o grupo de destino usando o link da vitrine própria da usuária, em vez de ser
ignorada.

**Why this priority**: É o problema central relatado pela cliente. Hoje a oferta
é perdida (marcada como "ignorado") mesmo com vitrine cadastrada, quebrando a
promessa de monetização e gerando suporte. Sem esta correção a feature não tem
valor.

**Independent Test**: Simular o processamento de uma mensagem de vitrine do ML
(link não convertível, og:title tipo "Minhas listas de recomendações") com uma
credencial que contém `vitrineUrl` válida cadastrada, e verificar que a oferta é
enviada com o link da vitrine cadastrada e o `MessageLog` fica com status de
sucesso (não "ignorado").

**Acceptance Scenarios**:

1. **Given** uma credencial ML da usuária com um `vitrineUrl` próprio válido
   cadastrado, **When** chega uma mensagem cujo link é uma vitrine/perfil de
   terceiro que o ML recusa converter, **Then** a oferta sai para o grupo de
   destino usando o link da vitrine cadastrada da usuária e o log registra
   sucesso (não "ignorado").
2. **Given** a mesma credencial, **When** o link original é uma vitrine de
   terceiro, **Then** o link original de terceiro NUNCA é encaminhado — apenas a
   vitrine própria da usuária (ou, na ausência dela, descarte seguro).
3. **Given** uma credencial **sem** `vitrineUrl` cadastrado, **When** chega uma
   mensagem de vitrine de terceiro não convertível, **Then** a mensagem ao
   usuário NÃO afirma que "a oferta saiu usando a SUA vitrine" (a mensagem exibida
   deve ser coerente com o desfecho real: orientar a cadastrar a vitrine).

---

### User Story 2 - Link de produto legítimo nunca é substituído pela vitrine (Priority: P1)

Uma oferta chega de um canal monitorado do Mercado Livre contendo um link de
**produto** legítimo (conversível em link de afiliado). O sistema deve converter
e enviar o link de produto normalmente, e NUNCA substituí-lo pela vitrine
cadastrada da usuária.

**Why this priority**: A correção da User Story 1 não pode introduzir falso
positivo. Substituir um link de produto real pela vitrine genérica degradaria a
oferta (o cliente final perde o produto específico anunciado) e é uma regressão
inaceitável. É requisito de igual criticidade ao fix principal.

**Independent Test**: Processar uma mensagem com link de produto ML conversível e
verificar que o link enviado é o link de produto convertido (afiliado da
usuária), e que `buildVitrineFallback` NÃO é acionado.

**Acceptance Scenarios**:

1. **Given** uma credencial ML com `vitrineUrl` cadastrado, **When** chega uma
   mensagem com link de **produto** conversível, **Then** a oferta sai com o link
   de produto convertido (afiliado da usuária) e a vitrine NÃO é usada.
2. **Given** um link ML ambíguo (aterrissagem incerta, não claramente vitrine),
   **When** o sistema não tem CERTEZA de que é vitrine/perfil, **Then** o fallback
   de vitrine NÃO substitui o link — o caminho existente de descarte seguro é
   mantido (sem culpar vitrine/credencial indevidamente).

---

### User Story 3 - Diagnóstico em produção antes de propor a correção (Priority: P1)

Antes de propor qualquer correção de código, a causa raiz deve ser confirmada com
dados reais da VPS de produção — não presumida. Deve-se identificar, para o caso
concreto de 12/07/2026 21:14, qual ramo de código foi executado e por que o
fallback de vitrine não foi acionado (vitrine não carregada nas credenciais?
`vitrineUrl` reprovado por `isValidMlVitrineUrl`? caminho `isDirectVitrineShare`
retornou falso e descartou? mensagem de usuário desalinhada do desfecho real?).

**Why this priority**: A regra canônica do repo e o pedido explícito da usuária
exigem "não supor nada" e usar comandos reais contra a VPS. Sem confirmar o ramo
real executado, a correção pode atacar o sintoma errado.

**Independent Test**: Os comandos de investigação (abaixo) são executados contra
produção e produzem evidência que aponta o ramo de código real; a causa raiz fica
documentada no plano com a linha de log / registro de banco que a comprova.

**Acceptance Scenarios**:

1. **Given** acesso à VPS de produção, **When** o agente de plano/investigação
   roda os comandos listados na seção "Investigação obrigatória em produção",
   **Then** fica documentado (a) o registro `MessageLog` do evento ignorado, (b)
   se a `Credential`/`AffiliateProfile` de Mercado Livre da usuária contém
   `vitrineUrl` e se este é válido, e (c) a(s) linha(s) de `bot.log` que mostram o
   ramo executado (recusa do ML, fallback tentado ou não).
2. **Given** essa evidência, **When** o plano é redigido, **Then** a causa raiz
   citada referencia a evidência real coletada (não uma suposição).

---

### Edge Cases

- **`vitrineUrl` cadastrada porém malformada/inválida** (não passa em
  `isValidMlVitrineUrl`): a oferta não deve sair com um link quebrado; deve cair
  no descarte seguro e a mensagem ao usuário deve orientar a corrigir o cadastro,
  sem afirmar que a oferta saiu.
- **Mensagem contém múltiplos links** (produto + vitrine, ou vitrine + cupom): a
  regra de "só substituir quando for de fato vitrine" deve valer por link; um link
  de produto presente não pode ser trocado pela vitrine.
- **Recusa ambígua do ML** (erro que não é claramente "vitrine de terceiro", ex.:
  exclusão do programa de afiliados / SSID expirado / 403 / 429): não tratar como
  vitrine; manter descarte seguro atual sem culpar a vitrine/credencial.
- **Link que aterrissa em vitrine só após resolução server-side** (não veio como
  link de vitrine direto na mensagem): manter o comportamento conservador atual
  (`isDirectVitrineShare`) — não afirmar vitrine sem certeza.
- **Desalinhamento mensagem × status**: hoje o texto ao usuário diz "a oferta
  saiu usando sua vitrine" enquanto o status é "ignorado". O desfecho e a mensagem
  exibida devem ser sempre coerentes entre si.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Quando o link original de uma oferta do Mercado Livre for de fato
  uma vitrine/perfil/lista de recomendações de terceiro que o ML recusa converter
  em link de afiliado, E a usuária tiver um `vitrineUrl` próprio válido cadastrado,
  o sistema MUST enviar a oferta usando o link da vitrine cadastrada da usuária em
  vez de marcá-la como "ignorado".
- **FR-002**: O sistema MUST substituir o link pela vitrine cadastrada SOMENTE
  quando houver certeza de que o link original é uma vitrine/perfil (não
  convertível). Um link de **produto** legítimo NUNCA MUST ser substituído pela
  vitrine (proibição de falso positivo).
- **FR-003**: O sistema MUST preservar a invariante de segurança canônica: o link
  original de terceiro NUNCA é encaminhado. Se não houver vitrine cadastrada
  válida e o link não for convertível, a oferta cai no descarte seguro existente.
- **FR-004**: A mensagem/motivo exibida ao usuário no painel MUST ser coerente com
  o desfecho real: só afirmar que "a oferta saiu usando a SUA vitrine" quando a
  oferta efetivamente saiu com a vitrine; quando for ignorada por falta de vitrine
  cadastrada, a mensagem deve orientar a cadastrar a vitrine sem alegar envio.
- **FR-005**: O sistema MUST manter inalterados os caminhos de conversão de
  **produto** de `src/converters/mercadolivre.js` (não regredir a conversão de
  links de produto conversíveis).
- **FR-006**: O sistema MUST manter o comportamento conservador para recusas
  ambíguas do ML (SSID expirado, 403, 429, exclusão do programa, aterrissagem
  incerta): nesses casos não tratar como vitrine nem substituir pela vitrine
  cadastrada.
- **FR-007**: O comportamento corrigido MUST ser coberto por teste automatizado
  (node:test) que falhe se a regressão voltar — cobrindo tanto o caso "vitrine
  cadastrada → oferta sai com vitrine" quanto o caso "link de produto → NÃO
  substitui pela vitrine".
- **FR-008 (processo)**: A causa raiz MUST ser confirmada com comandos reais
  contra a VPS de produção antes de propor a correção (ver "Investigação
  obrigatória em produção"). Suposições não são aceitas como base para o fix.
- **FR-009**: A correção MUST seguir o fluxo canônico do repo (feature → develop →
  autodeploy staging → validação em staging → develop → main) e ser validada em
  staging antes de produção.

### Investigação obrigatória em produção *(pré-requisito do plano — não supor nada)*

O agente de plano/investigação DEVE executar comandos reais na VPS de produção
(`REMOTE_HOST` do workflow, diretório `~/wabot`, banco `prisma/prod.db`) e
registrar as evidências. Comandos de referência (ajustar identificadores conforme
o caso real), a serem confirmados/expandidos durante o plano:

1. **Registro do evento ignorado no `MessageLog`** (achar a linha de 12/07 21:14
   do canal `mercadolivre`, ver `status`, `errorMsg`, `originalUrl`,
   `convertedUrl`, `userId`, `destGroup`):
   ```bash
   sqlite3 ~/wabot/prisma/prod.db "SELECT id, createdAt, userId, status, errorMsg, substr(originalUrl,1,80), substr(convertedUrl,1,80) FROM MessageLog WHERE createdAt >= '2026-07-12 21:10' AND createdAt <= '2026-07-12 21:20' ORDER BY createdAt;"
   ```
2. **Credenciais/perfil de afiliada do Mercado Livre da usuária** (confirmar se há
   `vitrineUrl` cadastrado e se é válido — lembrar que `Credential.data` é cifrado
   AES-256-GCM; usar o caminho de leitura da aplicação ou script que decifra, não
   presumir texto puro):
   ```bash
   sqlite3 ~/wabot/prisma/prod.db "SELECT id, userId, provider, substr(data,1,40) FROM Credential WHERE userId='<USERID>' AND provider LIKE '%mercadolivre%';"
   # e/ou AffiliateProfile, conforme onde vitrineUrl está persistido — confirmar o modelo real
   ```
3. **Linhas de `bot.log` do worker** que mostram o ramo executado (recusa do ML,
   `buildVitrineFallback`, `isDirectVitrineShare`, mensagem "usando vitrine
   cadastrada" ou "descartando"):
   ```bash
   grep -niE "vitrine|createLink|error_code|isDirectVitrineShare|cupom" /home/deploy/BOTinho-shared/logs/bot.log | grep -i "2026-07-12" | tail -60
   ```
4. Confirmar em qual modelo/campo o `vitrineUrl` é persistido e como é carregado
   nas `creds` que chegam a `convert()` (mapear o caminho real de leitura), para
   diagnosticar se o problema é "vitrine não chegou nas creds" vs. "vitrine chegou
   mas foi reprovada/ramo não acionado".

> Nota: os identificadores exatos (userId, nomes de coluna/modelo, caminho do
> `bot.log`) devem ser confirmados na investigação — esta lista é o ponto de
> partida, não um valor presumido.

### Key Entities *(include if feature involves data)*

- **Credencial / Perfil de afiliada do Mercado Livre da usuária**: contém o
  `vitrineUrl` próprio cadastrado (campo de vitrine junto das demais credenciais
  ML). É a fonte do link substituto. Persistência cifrada (D-3). Confirmar modelo
  real (`Credential` e/ou `AffiliateProfile`) na investigação.
- **MessageLog**: registro por mensagem espelhada, com `status`, `errorMsg`
  (taxonomia canônica), `originalUrl`, `convertedUrl`. Fonte de verdade do desfecho
  "ignorado" observado.
- **Oferta / link original**: link recebido do canal monitorado, classificável
  como produto (conversível) vs. vitrine/perfil (não convertível). A classificação
  correta é o que separa "substituir pela vitrine" de "converter normalmente".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos em que o link original é comprovadamente uma
  vitrine/perfil não convertível E a usuária tem `vitrineUrl` válido cadastrado, a
  oferta sai com o link da vitrine cadastrada (status de sucesso), 0% marcada como
  "ignorado" por esse motivo.
- **SC-002**: 0% de links de produto conversíveis são substituídos pela vitrine
  (zero falso positivo) — verificado por teste automatizado e pela validação em
  staging.
- **SC-003**: Em 100% dos casos, o link original de terceiro não é encaminhado
  (invariante de segurança preservada).
- **SC-004**: A mensagem exibida ao usuário no painel é coerente com o desfecho em
  100% dos casos (nunca afirma "a oferta saiu usando sua vitrine" quando a oferta
  foi ignorada).
- **SC-005**: A causa raiz do incidente de 12/07/2026 21:14 é documentada no plano
  com evidência real coletada da VPS de produção (log/registro de banco), não com
  suposição.
- **SC-006**: Existe teste automatizado que falha se a regressão retornar (oferta
  de vitrine com vitrine cadastrada voltando a ser ignorada, ou produto sendo
  substituído por vitrine).

## Assumptions

- O `vitrineUrl` da usuária é persistido junto das credenciais/perfil de afiliada
  do Mercado Livre e está disponível (ou deveria estar) nas `creds` que chegam a
  `convert()` em `src/converters/mercadolivre.js`. O caminho exato de persistência
  e carregamento será confirmado na investigação, não presumido.
- A lógica de fallback de vitrine já existente (`buildVitrineFallback`,
  `isValidMlVitrineUrl`, `isDirectVitrineShare`) é o ponto de correção; a feature
  presume que a causa raiz está em um destes eixos: (a) vitrine não chega nas
  creds, (b) vitrine reprovada por validação, (c) ramo de decisão descarta antes
  de tentar o fallback, ou (d) mensagem ao usuário desalinhada do desfecho. A
  investigação em produção definirá qual.
- A validação final "a vitrine realmente credita comissão ao clicar" depende de
  teste manual em dispositivo real (não verificável no sandbox), conforme já
  registrado no AGENTS.md para conversão de cupom/ML; a saída correta do link é o
  que esta feature garante, não a atribuição de comissão do ML em si.
- O ambiente de staging (`inline`, `~/wabot-staging`) é usado para validar a
  correção antes de produção, conforme fluxo canônico.
