# Feature Specification: Banner de marca "CUPOM + loja" para cupom e vitrine

**Feature Branch**: `claude/showcase-coupon-images-fhfxgj`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Banner de marca 'CUPOM + loja' para mensagens de cupom e vitrine no modo preview do WhatsApp. Reativar o gerador de banner que já existe (`src/converters/storeBrandCard.js`), controlado por env, com blindagem para o banner só aparecer quando houver alta confiança de que o link NÃO é de produto."

## Contexto e problema

Hoje, quando uma mensagem espelhada é de **cupom** (voucher/campanha, sem produto) ou de **vitrine** (página de coleção de ofertas do Mercado Livre, sem produto único), o card de preview do WhatsApp sai de forma ruim: ou com a **foto de um produto aleatório** raspado da vitrine, ou **sem imagem nenhuma**. Robôs concorrentes já enviam uma imagem de banner própria nesses casos. A usuária quer o mesmo: um **banner de marca gerado automaticamente por loja**, com o texto "CUPOM" + o nome da loja.

O gerador de banner **já existe** no repositório (`src/converters/storeBrandCard.js`: banner quadrado 720x720, texto "CUPOM" + nome da loja, cor da marca, JPEG pequeno de ~15-40KB, cacheado 1x por processo por loja) e hoje está **desligado** por uma flag hardcoded (`const COUPON_BRAND_CARD_ENABLED = false` em `src/bot-worker.js`).

**Uma tentativa anterior de ligar esse banner quebrou em produção** (hotfixes #1205/#1208). A causa raiz: a classificação de link (`linkKind`) marca como `'coupon'` **todo** link que não expõe um ID de produto (ASIN da Amazon / MLB do Mercado Livre) na URL. Um **produto real compartilhado por short link** (`amzn.to`, `amzn.divulgador.link`, `meli.la`) não revela o ID e foi classificado como `'coupon'` → recebeu o banner **no lugar da foto do produto**. A cliente viu produtos reais saindo com banner de cupom. **Esse é o bug que não pode voltar.**

Esta feature reativa o banner **com uma blindagem** que só o exibe quando houver **alta confiança** de que o link não é de produto, preservando o princípio "na dúvida, foto de produto".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mensagem de cupom sai com banner de marca (Priority: P1)

Um grupo monitorado recebe uma mensagem de **cupom** de uma loja suportada (Amazon, Shopee, Mercado Livre ou Magalu) — o texto anuncia um cupom/voucher e o link não aponta para um produto específico. Ao espelhar essa oferta no modo preview, o robô envia um card com o **banner de marca "CUPOM + <loja>"** como imagem, em vez de um produto aleatório ou nenhuma imagem.

**Why this priority**: É o valor central pedido pela usuária — mensagens de cupom deixam de sair "feias" (sem foto / com foto errada) e passam a ter uma identidade visual, como os concorrentes.

**Independent Test**: Com a feature ligada, enviar uma mensagem de cupom real de cada loja suportada em um grupo monitorado de staging e confirmar no celular que o card sai com o banner "CUPOM + loja".

**Acceptance Scenarios**:

1. **Given** a feature está ligada (env `COUPON_BRAND_CARD_ENABLED=true`) e chega uma mensagem cujo link primário é classificado como `coupon`, cujo texto confirma que é anúncio de cupom, e cuja URL resolvida não contém ASIN nem MLB, **When** o robô espelha a oferta no modo preview, **Then** o card sai com o banner de marca "CUPOM + <loja>" como imagem.
2. **Given** as mesmas condições acima para cada loja suportada (Amazon, Shopee, Mercado Livre, Magalu), **When** o banner é gerado, **Then** o texto exibido é "CUPOM" + o nome daquela loja, com a cor da marca correspondente.
3. **Given** que o card sai com o banner, **When** o card é montado, **Then** o campo de título do preview continua presente (nunca omitido).

---

### User Story 2 - Vitrine do Mercado Livre sai com banner (Priority: P1)

Um grupo monitorado recebe uma mensagem de **vitrine do Mercado Livre** (página de coleção/ofertas, sem um produto único) — hoje isso já cai em `linkKind: 'coupon'`. Ao espelhar no modo preview, o robô envia o mesmo banner de marca "CUPOM + Mercado Livre" em vez de raspar a foto de um produto aleatório da vitrine.

**Why this priority**: É o segundo caso "feio" que a usuária relatou (foto de produto aleatório da vitrine). O mesmo gatilho da US1 cobre esse caso — não é preciso um caminho separado.

**Independent Test**: Com a feature ligada, enviar um link de vitrine ML real em um grupo monitorado de staging e confirmar que o card sai com o banner, e não com um produto solto da vitrine.

**Acceptance Scenarios**:

1. **Given** a feature ligada e uma mensagem de vitrine ML (classificada como `coupon`, texto/sinal confirma vitrine, URL sem MLB de produto), **When** o robô espelha no modo preview, **Then** o card sai com o banner "CUPOM + Mercado Livre".
2. **Given** o mesmo banner visual usado para cupom, **When** a vitrine gera o banner, **Then** o visual e o texto são idênticos ao caso de cupom (o banner não muda entre cupom e vitrine).

---

### User Story 3 - Produto por short link continua saindo com FOTO (blindagem crítica) (Priority: P1)

Um grupo monitorado recebe um **produto real** compartilhado por **short link** (`amzn.to`, `amzn.divulgador.link`, `meli.la`, etc.) — a URL não expõe ASIN/MLB, então a classificação cai em `coupon`, **mas o texto não confirma cupom/vitrine**. O robô **NÃO** aplica o banner: a oferta continua saindo com a **foto do produto**, exatamente como hoje.

**Why this priority**: É o coração desta feature e a razão de a tentativa anterior ter quebrado. Sem essa blindagem, produtos reais voltariam a sair com banner de cupom (regressão #1205/#1208). É requisito de não-regressão obrigatório.

**Independent Test**: Com a feature ligada, enviar um produto Amazon e um produto ML por short link (sem ASIN/MLB na URL) e confirmar que ambos saem com a **foto do produto**, nunca com banner.

**Acceptance Scenarios**:

1. **Given** a feature ligada e um produto compartilhado por short link (classificado `coupon` por falta de ID na URL) cujo texto **não** confirma cupom/vitrine, **When** o robô espelha a oferta, **Then** o card sai com a foto do produto e **não** com o banner.
2. **Given** um link classificado `coupon` cuja URL resolvida **contém** ASIN (Amazon) ou MLB (Mercado Livre), **When** o robô decide a imagem, **Then** o banner **não** é aplicado (é tratado como produto).
3. **Given** a feature **desligada** (`COUPON_BRAND_CARD_ENABLED` ausente ou diferente de `true`), **When** qualquer mensagem (cupom, vitrine ou produto) é espelhada, **Then** o comportamento é idêntico ao de hoje (nenhum banner é enviado).

---

### Edge Cases

- **Loja não suportada pelo banner**: se o link for de uma loja fora da lista (Amazon, Shopee, Mercado Livre, Magalu), o gatilho não deve produzir banner — cai no comportamento atual (sem banner). "Na dúvida, foto de produto / comportamento atual".
- **Feature desligada**: com a env ausente/`false`, nenhum banner é enviado, independentemente da classificação — comportamento histórico preservado.
- **Falha ao gerar o banner**: se a geração do banner falhar por qualquer motivo, o envio da oferta não pode quebrar — cai no comportamento atual (sem banner / caminho existente).
- **Só um dos três sinais verdadeiro**: se `linkKind==='coupon'` mas o texto não confirma cupom/vitrine (ou a URL contém ASIN/MLB), o banner **não** aparece. As três condições são obrigatórias em conjunto.
- **Campo de título do preview**: mesmo com o banner, o card nunca pode ser montado sem o campo de título (invariante #1186 — o WhatsApp não renderiza o card sem título).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST poder enviar, no modo preview, um **banner de marca "CUPOM + <loja>"** como imagem do card para mensagens de cupom e de vitrine, reutilizando o gerador existente (`src/converters/storeBrandCard.js`), sem alterar o visual nem o texto do banner.
- **FR-002**: O banner MUST usar o **mesmo** visual e texto ("CUPOM" + nome da loja) tanto para cupom quanto para vitrine — não há variação de banner entre os dois casos.
- **FR-003**: O envio do banner MUST ser controlado por uma **variável de ambiente** `COUPON_BRAND_CARD_ENABLED`, com **default OFF**; o banner só é ativado quando o valor for exatamente `true`. Desligar a env MUST reverter o comportamento em produção sem necessidade de redeploy.
- **FR-004**: O banner MUST ser aplicado **somente** quando **todas** as três condições forem verdadeiras ao mesmo tempo: (a) o link primário é classificado como `coupon`; **E** (b) um sinal de **texto** confirma que a mensagem é anúncio de cupom **ou** detecção de vitrine do Mercado Livre; **E** (c) a URL resolvida **não** contém ASIN (Amazon) nem MLB (Mercado Livre).
- **FR-005**: Quando qualquer uma das três condições de FR-004 for falsa, o sistema MUST **não** aplicar o banner e MUST manter o comportamento atual (foto do produto quando houver, ou caminho existente), seguindo o princípio "na dúvida, foto de produto".
- **FR-006**: Um **produto real compartilhado por short link** (URL sem ASIN/MLB) cujo texto **não** confirme cupom/vitrine MUST continuar saindo com a **foto do produto** e **nunca** com o banner (não-regressão de #1205/#1208).
- **FR-007**: O banner MUST cobrir as lojas já suportadas pelo gerador existente: **Amazon, Shopee, Mercado Livre e Magalu**. Lojas fora dessa lista não recebem banner.
- **FR-008**: O card de preview MUST **sempre** conter o campo de título (`storePreviewTitle` presente), inclusive quando o banner for aplicado — o campo nunca pode ser omitido (invariante #1186).
- **FR-009**: Uma falha na geração do banner MUST **não** interromper o envio da oferta; o sistema degrada para o comportamento atual (sem banner).
- **FR-010**: A classificação de links (`linkKind`) MUST permanecer inalterada — esta feature **não** pode fazer mais links serem classificados como `coupon`.
- **FR-011**: O gerador de banner (`src/converters/storeBrandCard.js`) e seu teste (`test/store-brand-card.test.js`) MUST ser preservados (não removidos).
- **FR-012**: A suíte de testes desta feature MUST cobrir o cenário crítico de não-regressão: "produto Amazon/ML compartilhado por short link (sem ASIN/MLB na URL, texto sem sinal de cupom) → sai com FOTO do produto, NUNCA com banner".
- **FR-013**: A env `COUPON_BRAND_CARD_ENABLED=true` MUST ser documentada como **default em STAGING** no AGENTS.md (o `.env` é gitignored — aplicação manual no VPS), permanecendo **default OFF em produção** até validação em staging com links reais.

### Key Entities *(include if feature involves data)*

- **Banner de marca (store brand card)**: imagem quadrada 720x720 gerada por loja com o texto "CUPOM" + nome da loja e a cor da marca; JPEG de ~15-40KB; cacheado uma vez por processo por loja. Não é persistido em banco.
- **Sinal de decisão do banner**: composição das três condições de FR-004 (classificação `coupon`, sinal de texto de cupom/vitrine, ausência de ASIN/MLB na URL resolvida) que decide se o banner é aplicado.
- **Flag de rollout (`COUPON_BRAND_CARD_ENABLED`)**: variável de ambiente que liga/desliga a feature; default OFF; ligada só com valor `true`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com a feature ligada em staging, **100%** das mensagens de cupom de lojas suportadas (com texto confirmando cupom e URL sem ID de produto) saem com o banner "CUPOM + loja".
- **SC-002**: Com a feature ligada em staging, **100%** das mensagens de vitrine do Mercado Livre (sem produto único) saem com o banner, em vez de um produto aleatório da vitrine.
- **SC-003**: Com a feature ligada, **0%** dos produtos reais compartilhados por short link (Amazon/ML, sem ASIN/MLB na URL e sem sinal de texto de cupom) saem com banner — todos continuam saindo com a foto do produto (não-regressão de #1205/#1208).
- **SC-004**: Com a feature **desligada** (env ausente/`false`), **0%** de qualquer mensagem sai com banner — o comportamento é bit-a-bit igual ao de hoje.
- **SC-005**: Em **100%** dos cards enviados com banner, o campo de título do preview está presente (nenhum card deixa de renderizar por título omitido — invariante #1186).
- **SC-006**: O rollback em produção (desligar a env) reverte o comportamento **sem redeploy**, em menos de 1 minuto.

## Assumptions

- O gerador `src/converters/storeBrandCard.js` e as suas lojas suportadas (Amazon, Shopee, Mercado Livre, Magalu em `BRAND_STYLES`) estão funcionais e são reutilizados como estão — o visual/texto do banner não muda.
- O sinal de texto de cupom vem de `isCouponAnnouncement` (`src/messageProcessor.js`) e a detecção de vitrine ML já existente; nenhum novo detector precisa ser criado além de conectar esses sinais ao gatilho.
- A classificação `linkKind` (`src/converters/linkKind.js`) permanece intocada — a blindagem vive na decisão de aplicar o banner, não na classificação.
- O impacto de memória é desprezível (banner cacheado 1x por loja por processo, ~15-40KB) — **não** é mudança memory-heavy (Política de memória do AGENTS.md não é acionada).
- Desenvolvimento na branch `claude/showcase-coupon-images-fhfxgj`, com PR contra `develop`, seguindo o fluxo canônico feature → develop (autodeploy staging) → validação manual → main.
- **Fora de escopo**: upload de imagem própria pela cliente (descartado em favor do banner automático); qualquer mudança no visual/texto do banner; qualquer mudança em `linkKind` que faça mais links virarem `coupon`.
