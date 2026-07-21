# Feature Specification: Melhorias no programa de afiliados (rodada 1)

**Feature Branch**: `009-affiliate-improvements-r1`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Melhorias no programa de afiliados (rodada 1) — SEM captura de fingerprint do afiliado. Escopo: (1) estorno de comissão já paga vira dívida; (2) corrigir corrida initial/recurring; (3) endurecer atribuição órfã por dispositivo; (4) saque self-service com valor mínimo; (5) validar formato da chave PIX por tipo; (6) notificações ao afiliado por e-mail; (7) alarme operacional se a promoção pending->eligible parar; (8) corrigir inconsistências menores de contagem. FORA DE ESCOPO: captura de fingerprint (hash IP/UA) do afiliado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Estorno de comissão já paga vira dívida (Priority: P1)

Quando um pagamento do indicado é reembolsado ou sofre chargeback **depois** que a comissão do afiliado já foi marcada como paga, o valor precisa ser recuperado. Hoje o valor some silenciosamente porque só comissões ainda não pagas são revertidas. A partir de agora, o estorno de uma comissão já paga gera um **saldo devedor** do afiliado, que será descontado do próximo repasse. O afiliado vê esse saldo devedor no seu painel e o admin vê no painel administrativo.

**Why this priority**: É perda financeira direta e silenciosa (a empresa paga comissão sobre uma venda que foi desfeita e nunca recupera). É o item de maior impacto de dinheiro e confiança contábil.

**Independent Test**: Simular um reembolso/chargeback de um pagamento cuja comissão está com status "pago", e verificar que um lançamento negativo (dívida) é registrado no razão do afiliado, que o saldo devedor aparece no painel do afiliado e no admin, e que o próximo repasse desconta esse valor.

**Acceptance Scenarios**:

1. **Given** um afiliado com uma comissão de R$30 já marcada como "paga", **When** o pagamento do indicado é reembolsado/chargeback, **Then** um lançamento de estorno negativo de R$30 é registrado no razão do afiliado e o saldo devedor do afiliado passa a ser R$30.
2. **Given** um afiliado com saldo devedor de R$30 e novas comissões elegíveis somando R$100, **When** ocorre o próximo repasse, **Then** o valor repassado é R$70 (o saldo devedor é abatido) e o saldo devedor volta a zero.
3. **Given** um afiliado com saldo devedor, **When** ele abre o painel de afiliados, **Then** ele vê claramente o valor que deve e a explicação de que será descontado do próximo repasse.
4. **Given** um estorno de comissão **ainda não paga** (pending/eligible/approved/held), **When** o reembolso ocorre, **Then** o comportamento atual de reversão de status é preservado (nenhum saldo devedor é criado — só quando já estava paga).

---

### User Story 2 - Saque self-service com valor mínimo (Priority: P1)

O afiliado pode **solicitar o saque** do seu saldo disponível diretamente pelo painel, desde que o saldo disponível seja maior ou igual a um valor mínimo configurável. A solicitação entra num fluxo (solicitado → pago/recusado); o admin vê as solicitações e confirma o pagamento, reaproveitando o mecanismo existente de marcar comissões como pagas. A solicitação é bloqueada quando o saldo está abaixo do mínimo ou quando há saldo devedor pendente (US1).

**Why this priority**: Remove trabalho manual do admin de descobrir quem tem saldo e transforma o repasse num fluxo auditável e previsível para o afiliado. É o principal recurso novo de valor percebido pelo afiliado.

**Independent Test**: Com um afiliado cujo saldo disponível está acima do mínimo, solicitar saque pelo painel, verificar que a solicitação aparece para o admin, confirmar o pagamento como admin e verificar que as comissões correspondentes ficam pagas e a ação fica registrada na auditoria administrativa.

**Acceptance Scenarios**:

1. **Given** um afiliado com saldo disponível de R$120 e mínimo configurado em R$50, **When** ele solicita saque, **Then** a solicitação é criada com status "solicitado" e fica visível para o admin.
2. **Given** um afiliado com saldo disponível de R$20 e mínimo de R$50, **When** ele tenta solicitar saque, **Then** a solicitação é rejeitada com mensagem clara informando o valor mínimo.
3. **Given** um afiliado com saldo devedor pendente (US1), **When** ele tenta solicitar saque, **Then** a solicitação é bloqueada com mensagem explicando o saldo devedor.
4. **Given** uma solicitação de saque "solicitada", **When** o admin confirma o pagamento, **Then** o status vira "pago", as comissões correspondentes são marcadas como pagas e a ação é registrada na auditoria administrativa.
5. **Given** uma solicitação de saque "solicitada", **When** o admin recusa, **Then** o status vira "recusado" com motivo e o saldo do afiliado permanece disponível.
6. **Given** um afiliado que já tem uma solicitação de saque em aberto, **When** ele tenta solicitar outra, **Then** o sistema impede uma segunda solicitação simultânea.

---

### User Story 3 - Validação do formato da chave PIX por tipo (Priority: P2)

Ao candidatar-se ao programa ou atualizar seus dados, o afiliado informa uma chave PIX e o tipo dela (CPF, telefone, e-mail ou aleatória). O sistema valida se o formato da chave bate com o tipo declarado e rejeita com mensagem clara quando não bate, evitando repasses para chaves inválidas. A cifragem em repouso da chave é preservada.

**Why this priority**: Evita falha de repasse por chave malformada (dinheiro que não chega ao afiliado e gera suporte), com baixo custo de implementação.

**Independent Test**: Enviar candidatura/atualização com combinações válidas e inválidas de tipo × chave e verificar que apenas as inválidas são rejeitadas com HTTP 400 e mensagem específica, e que a chave continua cifrada em repouso.

**Acceptance Scenarios**:

1. **Given** tipo "CPF" e uma chave que não é um CPF válido, **When** o afiliado salva, **Then** o sistema rejeita com erro 400 e mensagem clara.
2. **Given** tipo "e-mail" e uma chave com formato de e-mail válido, **When** o afiliado salva, **Then** a chave é aceita e armazenada cifrada.
3. **Given** tipo "telefone" e uma chave sem formato de telefone brasileiro, **When** o afiliado salva, **Then** o sistema rejeita com erro 400 e mensagem clara.
4. **Given** tipo "aleatória" e uma chave no formato de chave aleatória PIX, **When** o afiliado salva, **Then** a chave é aceita.

---

### User Story 4 - Endurecer atribuição órfã por dispositivo (Priority: P2)

A atribuição de toques anônimos por dispositivo (assinatura de rede/aparelho) hoje cola vendas de uma janela de 30 dias, o que em redes/aparelhos compartilhados pode creditar a venda de um estranho ao afiliado errado. O comportamento é endurecido: janela mais curta e configurável, e/ou a comissão resultante entra em revisão manual ("held") em vez de ser atribuída direto. O comportamento é configurável com um padrão seguro.

**Why this priority**: Reduz atribuição incorreta (fraude/erro) sem exigir captura de novos dados de fingerprint (fora de escopo). Importante para integridade, mas menos urgente que perdas financeiras diretas.

**Independent Test**: Com a configuração no padrão seguro, simular um toque anônimo por dispositivo dentro e fora da janela endurecida e verificar que atribuições dentro da janela entram em revisão manual (ou são recusadas conforme configuração) em vez de virar comissão paga automaticamente.

**Acceptance Scenarios**:

1. **Given** o padrão seguro ativo, **When** um toque anônimo por dispositivo é atribuído a um afiliado, **Then** a comissão resultante entra em revisão manual ("held") em vez de ser liberada automaticamente.
2. **Given** um toque de dispositivo mais antigo que a janela endurecida configurada, **When** o pagamento ocorre, **Then** nenhuma atribuição por dispositivo é feita.
3. **Given** a configuração ajustada por um administrador (janela e modo), **When** novas atribuições ocorrem, **Then** elas respeitam a configuração vigente.

---

### User Story 5 - Notificações ao afiliado por e-mail (Priority: P3)

O afiliado recebe e-mails informando eventos importantes do seu ciclo: candidatura aprovada, candidatura rejeitada, comissão liberada (ficou elegível) e comissão paga. O envio é silencioso e opcional — se o e-mail não estiver configurado no ambiente, nada é enviado e nenhum fluxo quebra. Só e-mails reais recebem mensagem (endereços de fallback do sistema são ignorados).

**Why this priority**: Melhora comunicação e percepção do programa, mas não é bloqueante e depende de infraestrutura de e-mail opcional.

**Independent Test**: Disparar cada um dos quatro eventos com o e-mail configurado e verificar o envio; repetir sem configuração de e-mail e verificar que o fluxo segue normalmente sem envio; verificar que endereços de fallback não recebem e-mail.

**Acceptance Scenarios**:

1. **Given** um afiliado com e-mail real e o envio configurado, **When** sua candidatura é aprovada, **Then** ele recebe um e-mail de aprovação.
2. **Given** o envio de e-mail **não** configurado no ambiente, **When** qualquer um dos quatro eventos ocorre, **Then** nenhum e-mail é enviado e o fluxo (aprovação/pagamento/etc.) conclui normalmente.
3. **Given** um afiliado cujo e-mail é um endereço de fallback do sistema, **When** um evento ocorre, **Then** nenhum e-mail é enviado.
4. **Given** o serviço de e-mail temporariamente indisponível, **When** um evento ocorre, **Then** o fluxo principal não falha (envio é best-effort).

---

### User Story 6 - Alarme operacional se a promoção pending→eligible parar (Priority: P3)

Se o processo periódico que promove comissões de "pendente" para "elegível" parar ou travar, comissões ficam presas e afiliados deixam de poder sacar sem que ninguém perceba. O sistema passa a emitir um alarme (log de erro + evento durável) quando existirem comissões pendentes cujo momento de elegibilidade já venceu há mais que um limiar sem terem sido promovidas.

**Why this priority**: É uma rede de segurança de observabilidade; valiosa mas só age quando outra coisa já falhou.

**Independent Test**: Criar comissões pendentes com data de elegibilidade vencida além do limiar e verificar que o alarme (log de erro + evento) é emitido; com comissões dentro do prazo, verificar que nenhum alarme é emitido.

**Acceptance Scenarios**:

1. **Given** comissões pendentes com elegibilidade vencida há mais que o limiar, **When** a verificação roda, **Then** um log de erro e um evento operacional (padrão `ops_*`) são emitidos.
2. **Given** nenhuma comissão pendente vencida além do limiar, **When** a verificação roda, **Then** nenhum alarme é emitido.

---

### User Story 7 - Corrigir corrida initial/recurring e inconsistências de contagem (Priority: P2)

Dois problemas de correção de dados/exibição: (a) dois pagamentos concorrentes do mesmo indicado podem, hoje, criar duas comissões "initial" — deve existir no máximo **uma** comissão "initial" por indicado; (b) o painel do afiliado conta "Vendas" (histórico mensal) incluindo comissões revertidas, enquanto o card "Vendas válidas" as exclui — os números precisam ficar consistentes (ambos excluindo revertidas), e deve haver um "total ganho na vida" (todas as comissões não revertidas) distinto do "total pago".

**Why this priority**: Corrige integridade de dados (comissão initial duplicada = pagamento indevido) e confiança nos números exibidos; menos urgente que perdas já pagas, mas de correção obrigatória.

**Independent Test**: Simular dois pagamentos concorrentes do mesmo indicado e verificar que só uma comissão "initial" é criada; abrir o painel do afiliado com comissões revertidas e verificar que "Vendas" e "Vendas válidas" batem (excluindo revertidas) e que "total ganho na vida" e "total pago" são distintos e corretos.

**Acceptance Scenarios**:

1. **Given** um indicado sem comissão initial, **When** dois pagamentos são processados concorrentemente, **Then** exatamente uma comissão "initial" é criada (a outra vira recurring ou é ignorada, sem duplicar).
2. **Given** a idempotência existente por identificador de pagamento, **When** o mesmo pagamento é processado duas vezes, **Then** nenhuma comissão duplicada é criada (comportamento preservado).
3. **Given** um afiliado com comissões revertidas, **When** ele abre o painel, **Then** a contagem de "Vendas" do histórico mensal e o card "Vendas válidas" excluem ambas as revertidas e coincidem.
4. **Given** um afiliado com comissões pagas, elegíveis e revertidas, **When** ele abre o painel, **Then** ele vê "total ganho na vida" (todas não revertidas) distinto de "total pago".

---

### Edge Cases

- **Estorno maior que o saldo disponível**: se o saldo devedor exceder o saldo elegível atual, o devedor persiste e continua sendo abatido de repasses futuros até zerar (não fica negativo o repasse).
- **Múltiplos estornos da mesma comissão**: o mesmo estorno não deve gerar dívida em duplicidade (idempotência do lançamento de dívida).
- **Saque solicitado e depois surge saldo devedor**: definir se uma solicitação já aberta é afetada por um estorno que chega antes da confirmação do admin (recomendado: o admin vê o devedor no momento da confirmação e o repasse é ajustado/recusado).
- **Chave PIX válida no formato mas de titular diferente**: validação de formato **não** garante titularidade (o antifraude de titularidade PIX já existente permanece separado).
- **Atribuição por dispositivo em "held" nunca revisada**: comissões em revisão manual precisam ser visíveis para o admin agir (não podem ficar invisíveis para sempre).
- **E-mail configurado mas endereço do afiliado inválido**: envio é best-effort; falha de envio não quebra o fluxo.
- **Alarme de promoção durante janela de manutenção**: o limiar deve ser tolerante o suficiente para não alarmar por atrasos normais do ciclo.

## Requirements *(mandatory)*

### Functional Requirements

**Estorno de comissão paga (US1)**

- **FR-001**: Quando um estorno (reembolso/chargeback) atinge uma comissão já com status "paga", o sistema MUST registrar um lançamento de dívida (valor negativo) no razão de comissões do afiliado, refletido como saldo devedor do afiliado.
- **FR-002**: O sistema MUST descontar o saldo devedor do afiliado do próximo repasse, sem tornar o valor repassado negativo (o devedor remanescente persiste para o repasse seguinte).
- **FR-003**: O lançamento de dívida MUST ser idempotente por estorno/pagamento — reprocessar o mesmo estorno não cria dívida duplicada.
- **FR-004**: O saldo devedor MUST ser exibido no painel do afiliado e no painel administrativo com explicação de que será descontado do próximo repasse.
- **FR-005**: Para estornos de comissões **ainda não pagas**, o sistema MUST preservar o comportamento atual de reversão de status (sem criar saldo devedor).

**Corrida initial/recurring (US7)**

- **FR-006**: O sistema MUST garantir no máximo uma comissão do tipo "initial" por indicado, mesmo sob pagamentos concorrentes.
- **FR-007**: O sistema MUST preservar a idempotência existente por identificador único de pagamento (nenhuma comissão duplicada para o mesmo pagamento).

**Atribuição órfã por dispositivo (US4)**

- **FR-008**: O sistema MUST endurecer a atribuição de toques anônimos por dispositivo, oferecendo janela de tempo configurável e/ou marcação da comissão resultante para revisão manual ("held") em vez de liberação automática.
- **FR-009**: O comportamento de endurecimento MUST ser configurável (por configuração do programa e/ou variável de ambiente) com um padrão seguro aplicado quando nada é configurado.
- **FR-010**: Comissões colocadas em revisão manual por essa regra MUST ser visíveis ao admin para decisão.

**Saque self-service (US2)**

- **FR-011**: O afiliado MUST poder solicitar saque pelo painel quando o saldo disponível for maior ou igual a um valor mínimo configurável.
- **FR-012**: O sistema MUST bloquear solicitações de saque quando o saldo disponível estiver abaixo do mínimo, com mensagem clara informando o mínimo.
- **FR-013**: O sistema MUST bloquear solicitações de saque quando o afiliado tiver saldo devedor pendente (FR-001), com mensagem clara.
- **FR-014**: O sistema MUST impedir mais de uma solicitação de saque em aberto por afiliado simultaneamente.
- **FR-015**: A solicitação de saque MUST ter estados: solicitado → pago ou recusado.
- **FR-016**: O admin MUST poder confirmar o pagamento de uma solicitação, reaproveitando o mecanismo existente de marcar comissões como pagas, e poder recusá-la com motivo.
- **FR-017**: Ações administrativas sobre solicitações de saque (confirmar/recusar) MUST ser registradas na auditoria administrativa.
- **FR-018**: O valor mínimo de saque MUST ser configurável (novo parâmetro nas configurações do programa de afiliados).

**Validação de chave PIX (US3)**

- **FR-019**: Nas rotas de candidatura e de atualização de dados do afiliado, o sistema MUST validar que o formato da chave PIX corresponde ao tipo declarado (CPF, telefone, e-mail, aleatória).
- **FR-020**: O sistema MUST rejeitar chave com formato incompatível com o tipo, retornando erro de validação (HTTP 400) com mensagem clara.
- **FR-021**: A cifragem em repouso da chave PIX (AES-256-GCM, idempotente, no-op sem chave de ambiente) MUST ser preservada intacta.

**Notificações por e-mail (US5)**

- **FR-022**: O sistema MUST enviar e-mail ao afiliado nos eventos: candidatura aprovada, candidatura rejeitada, comissão liberada (pendente→elegível) e comissão paga.
- **FR-023**: O envio de e-mail MUST ser silenciosamente no-op quando o e-mail não estiver configurado no ambiente, e best-effort (fire-and-forget) de modo a nunca quebrar o fluxo principal.
- **FR-024**: O sistema MUST enviar e-mail apenas para endereços reais, ignorando endereços de fallback do sistema.

**Alarme operacional (US6)**

- **FR-025**: O sistema MUST emitir log de erro e evento durável (nome no padrão `ops_*`) quando existirem comissões pendentes com momento de elegibilidade vencido há mais que um limiar sem terem sido promovidas.
- **FR-026**: O sistema MUST não emitir o alarme quando não houver comissões vencidas além do limiar.

**Inconsistências de contagem (US7)**

- **FR-027**: O sistema MUST alinhar a contagem de "Vendas" do histórico mensal com o card "Vendas válidas", ambos excluindo comissões revertidas.
- **FR-028**: O sistema MUST expor um "total ganho na vida" (soma de todas as comissões não revertidas) distinto do "total pago".

**Restrições transversais (canônicas)**

- **FR-029**: Mudanças de banco MUST ser preferencialmente aditivas e idempotentes, com cuidado de lock em SQLite (DML puro convive com WAL; DDL exige parar processos) e passar por staging antes de produção.
- **FR-030**: Lógica financeira nova (cálculo de saldo devedor, abatimento em repasse, validação de PIX, decisão de endurecimento de atribuição) MUST ser implementada preferencialmente em módulos puros e testáveis, com testes que não dependem de banco ou de variáveis de ambiente.
- **FR-031**: A feature MUST NOT capturar fingerprint (hash de IP/UA) do afiliado — explicitamente fora de escopo.

### Key Entities *(include if feature involves data)*

- **Perfil de Afiliado**: representa o afiliado no programa; ganha um conceito de **saldo devedor** (valor a abater de repasses futuros) além dos dados existentes (incluindo chave PIX cifrada e seu tipo).
- **Comissão de Afiliado**: crédito gerado por um pagamento de indicado; tem tipo ("initial"/"recurring") e status (pendente/elegível/aprovada/em revisão/paga/revertida); no máximo uma "initial" por indicado.
- **Lançamento no Razão de Comissões**: registro contábil por afiliado; passa a incluir lançamentos negativos de dívida/estorno quando uma comissão já paga é estornada.
- **Configurações do Programa de Afiliados**: passa a incluir valor mínimo de saque e parâmetros de endurecimento da atribuição por dispositivo (janela e modo).
- **Solicitação de Saque** (nova): pedido do afiliado para receber o saldo disponível; tem valor, estado (solicitado/pago/recusado), motivo de recusa e vínculo com as comissões liquidadas e com o registro de auditoria administrativa.
- **Toque de Atribuição**: toque anônimo por dispositivo que pode ser colado a um indicado; a atribuição resultante passa a poder entrar em revisão manual conforme configuração.
- **Evento Operacional / Analítico**: evento durável (padrão `ops_*`) emitido pelo alarme de promoção travada.
- **Registro de Auditoria Administrativa**: passa a registrar confirmações/recusas de solicitações de saque.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos estornos que atingem comissões já pagas resultam em saldo devedor registrado e visível (nenhuma perda silenciosa).
- **SC-002**: Nenhum indicado possui mais de uma comissão "initial", mesmo sob processamento concorrente de pagamentos.
- **SC-003**: 100% das solicitações de saque abaixo do mínimo ou com saldo devedor pendente são bloqueadas com mensagem clara.
- **SC-004**: O afiliado consegue solicitar um saque válido e ter o pagamento confirmado pelo admin, com a ação registrada na auditoria, em um único fluxo sem intervenção manual fora do painel.
- **SC-005**: 100% das chaves PIX com formato incompatível com o tipo declarado são rejeitadas antes de qualquer tentativa de repasse.
- **SC-006**: O programa funciona normalmente com e sem configuração de e-mail; nenhum fluxo de afiliado falha por causa de envio de e-mail.
- **SC-007**: Quando a promoção pendente→elegível para por mais que o limiar, um alarme é emitido em até um ciclo de verificação.
- **SC-008**: As contagens de "Vendas" e "Vendas válidas" no painel coincidem (ambas excluindo revertidas) e "total ganho na vida" ≠ "total pago" quando há comissões elegíveis/pendentes não pagas.
- **SC-009**: Nenhum dado de fingerprint (IP/UA) do afiliado é capturado ou armazenado por esta feature.

## Assumptions

- **Valor mínimo de saque padrão**: assumido em R$50,00 (5000 centavos) como default seguro, ajustável por configuração; o valor final é decisão de negócio confirmável no planejamento.
- **Janela endurecida de atribuição por dispositivo (default seguro)**: assumida uma janela mais curta que os 30 dias atuais (ex.: 7 dias) **e** a comissão resultante entrando em revisão manual ("held") por padrão; ambos configuráveis. O modo exato (janela curta, held, ou ambos) é confirmável no planejamento.
- **Limiar do alarme de promoção travada**: assumido um limiar tolerante a atrasos normais do ciclo (ex.: elegibilidade vencida há mais de 24h) para evitar falso-positivo; valor final confirmável no planejamento.
- **Formatos de chave PIX**: validação de formato para CPF (11 dígitos com validação de dígito verificador), telefone (padrão brasileiro E.164/celular), e-mail (formato de e-mail) e aleatória (UUID/EVP); validação de **formato**, não de titularidade (o antifraude de titularidade PIX existente permanece separado).
- **Uma solicitação de saque por vez**: assume-se que o afiliado só pode ter uma solicitação em aberto simultaneamente.
- **Reaproveitamento do mark-paid**: a confirmação de pagamento de saque reutiliza o mecanismo existente de marcar comissões como pagas (mark-paid / mark-all-paid).
- **Endereços de fallback**: e-mails no padrão `user_*@sistema.com` são considerados fallback e não recebem notificação.
- **Fluxo de entrega**: todas as mudanças seguem o fluxo canônico feature → develop → staging → main; sem alterações memory-heavy previstas.
