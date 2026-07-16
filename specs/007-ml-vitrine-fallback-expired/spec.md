# Feature Specification: Fallback de vitrine do Mercado Livre quando o SSID está vencido

**Feature Branch**: `fix/ml-vitrine-fallback-expired`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Fallback de vitrine do Mercado Livre quando o SSID está vencido."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Oferta de vitrine de terceiro sai com a vitrine própria mesmo com SSID vencido (Priority: P1)

Uma afiliada monitora grupos que republicam ofertas de vitrine ("listas sociais") do Mercado Livre pertencentes a OUTRAS lojas (ex.: `/social/urubupromo/lists`, `/social/gatuna/lists`). A afiliada já cadastrou o link da sua própria vitrine no painel. Mesmo quando o cookie/SSID de credencial do Mercado Livre está expirado, a oferta espelhada deve sair apontando para a vitrine da própria afiliada, em vez de ser silenciosamente descartada.

**Why this priority**: É o núcleo da correção. Hoje, com SSID vencido, ofertas de vitrine legítimas são jogadas fora e a afiliada perde comissão sem entender o motivo. O SSID nunca tornaria a vitrine de um terceiro conversível — a vitrine própria cadastrada é sempre a saída correta e não depende do SSID.

**Independent Test**: Simular a conversão de um link de vitrine direta com credencial de SSID marcada como expirada e com vitrine própria cadastrada; verificar que o resultado é o link da vitrine cadastrada, com o aviso de "fallback de vitrine usado".

**Acceptance Scenarios**:

1. **Given** um link de vitrine direta do Mercado Livre (caminho `/social/...`) de outra loja, **and** o SSID da afiliada está expirado, **and** a afiliada tem uma vitrine própria cadastrada, **When** a oferta é processada, **Then** a oferta é enviada com o link da vitrine própria da afiliada e registrada com o aviso de fallback de vitrine.
2. **Given** o mesmo link de vitrine direta e uma vitrine própria cadastrada, **and** o erro do Mercado Livre é do tipo "fora do programa" (comportamento já existente), **When** a oferta é processada, **Then** o comportamento anterior é preservado (fallback de vitrine própria aplicado).

---

### User Story 2 - Motivo claro quando falta cadastrar a vitrine própria (Priority: P1)

Quando o link é uma vitrine direta, o SSID está vencido (ou fora do programa) e a afiliada NÃO cadastrou sua própria vitrine, a oferta é ignorada. O painel de "Envios" deve explicar que a oferta foi ignorada porque falta cadastrar o link da vitrine da própria afiliada e indicar exatamente onde cadastrar (Painel → IDs de afiliada → Mercado Livre). A mensagem NÃO pode sugerir "renovar o SSID", pois isso é enganoso — renovar o SSID não resolve link de vitrine de terceiro.

**Why this priority**: Sem essa correção, a afiliada vê a mensagem errada ("renove o SSID"), tenta renovar o cookie repetidamente e nunca resolve o problema real (a vitrine própria nunca foi cadastrada). O motivo honesto e acionável reduz suporte e frustração.

**Independent Test**: Simular a conversão de um link de vitrine direta com SSID expirado e SEM vitrine cadastrada; verificar que o motivo registrado/traduzido no painel aponta para "cadastrar a vitrine própria" e não menciona renovar SSID.

**Acceptance Scenarios**:

1. **Given** um link de vitrine direta, **and** SSID expirado, **and** nenhuma vitrine própria cadastrada, **When** a oferta é processada, **Then** a oferta é ignorada e o motivo exibido no painel diz que faltou cadastrar o link da vitrine da própria afiliada, indicando o caminho Painel → IDs de afiliada → Mercado Livre.
2. **Given** o mesmo cenário, **When** a afiliada lê o motivo no painel, **Then** o texto NÃO menciona renovar/atualizar o SSID.

---

### User Story 3 - Links que não são vitrine mantêm o comportamento atual (Priority: P1)

Para links que NÃO são vitrine direta (ex.: produto ambíguo resolvido via encurtador) com SSID expirado, o comportamento atual deve ser mantido: mensagem de renovar SSID / fallback de `partner_id`, sem regressão.

**Why this priority**: Garante que a correção seja cirúrgica e não altere o caminho de produto, onde renovar o SSID de fato é a ação correta.

**Independent Test**: Simular a conversão de um link de produto não-vitrine com SSID expirado; verificar que o comportamento e a mensagem atuais permanecem inalterados.

**Acceptance Scenarios**:

1. **Given** um link que não é vitrine direta (produto ambíguo via encurtador), **and** SSID expirado, **When** a oferta é processada, **Then** o comportamento atual (mensagem de renovar SSID / fallback de `partner_id`) é preservado.

---

### Edge Cases

- Link de vitrine direta + SSID expirado + vitrine própria cadastrada → sai com a vitrine própria (US1).
- Link de vitrine direta + SSID expirado + sem vitrine própria → ignorada com motivo "vitrine ausente" (US2).
- Link de vitrine direta + erro "fora do programa" (unsupported_url) → continua aplicando o fallback de vitrine própria como hoje (não regredir a feature 004).
- Link de produto não-vitrine + SSID expirado → mensagem de renovar SSID inalterada (US3).
- Distinção entre "falha de credencial que o SSID resolve" (produto) e "falha estrutural que o SSID não resolve" (vitrine de terceiro) precisa ser respeitada em toda mensagem exibida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE aplicar o fallback de vitrine própria cadastrada quando o link já é uma vitrine direta do Mercado Livre E existe vitrine própria cadastrada, independentemente de o motivo da falha do Mercado Livre ser "credencial/SSID expirado" ou "fora do programa" (unsupported_url).
- **FR-002**: O sistema DEVE preservar, no resultado da conversão bem-sucedida por fallback, o aviso indicando que a vitrine própria foi usada (mesmo aviso já existente da feature 004).
- **FR-003**: Quando o link é vitrine direta, a falha é de SSID expirado (ou fora do programa) e NÃO há vitrine própria cadastrada, o sistema DEVE ignorar a oferta e registrar um motivo específico de "vitrine própria ausente".
- **FR-004**: O motivo de "vitrine própria ausente" exibido no painel de Envios DEVE explicar que a oferta foi ignorada porque falta cadastrar o link da vitrine da própria afiliada e indicar onde cadastrar (Painel → IDs de afiliada → Mercado Livre).
- **FR-005**: O motivo de "vitrine própria ausente" NÃO DEVE mencionar renovar/atualizar o SSID.
- **FR-006**: Para links que não são vitrine direta com SSID expirado, o sistema DEVE preservar o comportamento atual (mensagem de renovar SSID / fallback de `partner_id`) sem regressão.
- **FR-007**: O motivo de "vitrine própria ausente" DEVE respeitar a taxonomia canônica de motivos de Envios: reutilizar um prefixo existente da categoria de bloqueio por configuração OU, se um novo prefixo/motivo for necessário, atualizar simultaneamente a definição da taxonomia e o tradutor humano do painel.
- **FR-008**: A mudança NÃO DEVE alterar o caminho de conversão de links de produto do Mercado Livre.

### Key Entities *(include if feature involves data)*

- **Link de vitrine direta**: link do Mercado Livre cujo caminho identifica uma "lista social" (`/social/...`). Pode pertencer à própria afiliada ou a um terceiro.
- **Vitrine própria cadastrada**: link de vitrine que a afiliada configurou no painel (IDs de afiliada → Mercado Livre), usado como destino de fallback.
- **Motivo de Envio (registro de log)**: campo textual que classifica por que uma oferta foi enviada, ignorada ou falhou, exibido de forma humanizada no painel de Envios.
- **Tipo de falha do Mercado Livre**: classificação do erro retornado (ex.: "expirado" para SSID vencido, "fora do programa" para link não elegível).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das ofertas de vitrine direta de terceiro, com vitrine própria cadastrada e SSID expirado, saem apontando para a vitrine própria da afiliada (0% de descarte silencioso nesse cenário).
- **SC-002**: Em 100% dos casos de vitrine direta sem vitrine própria cadastrada, o motivo exibido no painel indica "cadastrar a vitrine própria" e não menciona renovar SSID.
- **SC-003**: 0 regressões no caminho de produto não-vitrine com SSID expirado (a mensagem de renovar SSID continua exibida).
- **SC-004**: Cobertura de teste automatizado para os três cenários: (a) vitrine direta + expired + com vitrine → retorna vitrine cadastrada; (b) vitrine direta + expired + sem vitrine → motivo "vitrine ausente"; (c) produto não-vitrine + expired → comportamento atual preservado.

## Assumptions

- Existe uma forma programática de detectar que um link já é vitrine direta (caminho `/social/...`) e uma forma de determinar se há vitrine própria cadastrada nas credenciais da afiliada — ambas já disponíveis no sistema (`isDirectVitrineShare`, `buildVitrineFallback`).
- O tipo de falha do Mercado Livre já é classificado (ex.: "expirado" vs. "fora do programa") no ponto onde o fallback é decidido.
- O aviso de "fallback de vitrine usado" já existe (feature 004) e será reutilizado sem alteração de semântica.
- A correção é memory-neutral e não requer migração de schema de banco.
- O caminho de conversão de produto do Mercado Livre permanece intocado.

## Out of Scope

- Alerta automático de expiração de SSID.
- Reprocessamento de mensagens já ignoradas.
- Qualquer alteração no caminho de conversão de links de produto.
