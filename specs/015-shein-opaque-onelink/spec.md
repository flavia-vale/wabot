# Feature Specification: Conversão segura de oneLinks opacos da SHEIN

**Feature Branch**: `015-shein-opaque-onelink`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Suportar com segurança oneLinks da SHEIN que resolvem para `api-shein.shein.com/h5/sharejump/appjump` com tokens opacos `shc`/`link`, para que uma cliente com ID de afiliada válido e sem cookie ainda publique o link convertido longo quando o produto real puder ser comprovado; preservar todas as guardas de comissão, host e identidade, nunca publicar o link opaco/original quando o produto não puder ser comprovado e corrigir o diagnóstico enganoso de credencial inválida."

## Contexto do problema

O conversor da SHEIN já separa duas responsabilidades: o ID de afiliada é suficiente para montar o link longo que credita a cliente; o cookie é opcional e serve apenas para tentar gerar uma versão curta mais bonita. Esse comportamento funciona para oneLinks que revelam um destino com produto identificável.

Um formato novo observado em produção, por exemplo `onelink.shein.com/50/...?...shc=...`, resolve para `api-shein.shein.com/h5/sharejump/appjump`. O destino carrega o produto dentro de valores opacos (`shc` e `link`) e não expõe `goods_id`. Retirar `shc` da entrada não resolve: a SHEIN o recoloca no destino. A guarda atual recusa corretamente publicar esse destino sem prova do produto, mas o sistema não tenta obter uma página canônica verificável por meio do fluxo legítimo desse endpoint. A oferta é descartada e o painel mostra a mensagem genérica "confira se as credenciais estão válidas", embora o ID esteja válido e o cookie não seja necessário.

Esta feature amplia a resolução sem enfraquecer a regra central do produto: uma oferta só pode sair quando o sistema comprova o mesmo produto e consegue construir um endereço oficial limpo, contendo exclusivamente a identidade de afiliada da cliente. Na dúvida, a falha continua sendo fechada: nenhum link original, opaco ou de terceiro é publicado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publicar o produto de um oneLink opaco com link longo (Priority: P1)

Uma cliente com ID de afiliada SHEIN válido, mas sem cookie, recebe em um grupo monitorado uma oferta cujo oneLink resolve para o endpoint opaco de compartilhamento. Quando o fluxo da SHEIN permite comprovar de forma inequívoca qual é o produto, o BOTinho publica a oferta com um link longo oficial que aponta para esse mesmo produto e credita somente a cliente.

**Why this priority**: É o problema funcional confirmado em produção. Sem esse caminho, ofertas legítimas deixam de ser enviadas mesmo quando a cliente cadastrou tudo o que é obrigatório.

**Independent Test**: Processar uma amostra do formato opaco com um ID válido e cookie ausente; comprovar que o destino publicado é oficial, mantém o produto da origem, contém a identidade da cliente e não contém tokens ou identidade da origem.

**Acceptance Scenarios**:

1. **Given** uma cliente com ID SHEIN válido, sem cookie, e um oneLink que termina no endpoint opaco, **When** o sistema consegue obter uma página oficial com produto inequivocamente identificável, **Then** publica um link longo desse mesmo produto com a identidade da cliente.
2. **Given** o mesmo link conversível e uma cliente com cookie válido, **When** o sistema conclui a conversão segura, **Then** pode tentar o encurtamento já existente, mas qualquer falha nessa tentativa preserva o link longo convertido.
3. **Given** um oneLink antigo que já resolve diretamente para um produto identificável, **When** ele é processado, **Then** continua seguindo o comportamento atual sem passar a depender do novo caminho.
4. **Given** um link direto de produto SHEIN, **When** ele é processado, **Then** continua produzindo o mesmo resultado seguro de antes.

---

### User Story 2 - Falhar sem vazar comissão quando o produto não pode ser provado (Priority: P1)

Quando o endpoint opaco não permite chegar a um produto verificável, a cliente prefere que a oferta não saia a arriscar publicar comissão de outra pessoa ou levar o público a um destino diferente.

**Why this priority**: A proteção da comissão é uma invariante do produto e tem a mesma prioridade da cobertura adicional. A feature não pode trocar segurança por volume de envios.

**Independent Test**: Processar respostas opacas, incompletas, maliciosas, fora da SHEIN e ambíguas; verificar que todas terminam sem publicação e que nenhum endereço de entrada ou intermediário aparece como URL convertida.

**Acceptance Scenarios**:

1. **Given** um oneLink que permanece opaco sem revelar um produto inequívoco, **When** a resolução termina, **Then** nenhuma oferta é publicada e nenhum link original/intermediário é usado como fallback.
2. **Given** a resolução conduz a um host que não pertence à allowlist oficial da SHEIN, **When** o sistema valida o destino, **Then** recusa a conversão.
3. **Given** a resolução conduz a uma página SHEIN sem identificador verificável de produto, **When** o sistema valida o destino, **Then** recusa a conversão.
4. **Given** o destino contém identidade de afiliado, sessão, requisição ou compartilhamento da origem, **When** um produto é comprovado, **Then** todos esses dados são removidos antes de a identidade da cliente ser aplicada.
5. **Given** falha de rede, timeout, resposta excessiva, ciclo de redirecionamento ou conteúdo inesperado, **When** a resolução não conclui com segurança, **Then** a conversão falha fechada, sem publicação parcial.

---

### User Story 3 - Ver o motivo verdadeiro quando o formato não converte (Priority: P2)

Quando uma oferta desse formato não pode ser convertida, a cliente vê no histórico uma explicação leiga de que aquele link de compartilhamento não revelou o produto. Ela não é orientada a recadastrar um ID que já está válido nem a cadastrar cookie como se ele fosse obrigatório.

**Why this priority**: O diagnóstico enganoso aumenta suporte e faz a cliente mexer em uma configuração correta. A conversão é o valor principal, mas a falha precisa ser acionável e honesta.

**Independent Test**: Forçar uma resposta opaca não resolvível com credencial válida e verificar o registro apresentado no painel, sem termos internos e sem menção indevida a credenciais inválidas.

**Acceptance Scenarios**:

1. **Given** um ID válido e um link opaco cujo produto não pode ser comprovado, **When** a conversão falha, **Then** o histórico informa em linguagem simples que o link de compartilhamento não revelou o produto.
2. **Given** um ID ausente ou inválido, **When** chega uma oferta SHEIN, **Then** o diagnóstico existente de falta de cadastro continua sendo usado.
3. **Given** uma falha de rede ou indisponibilidade temporária, **When** a conversão falha, **Then** o diagnóstico distingue indisponibilidade do formato não comprovável e de credencial ausente.
4. **Given** uma falha interna não classificada, **When** o painel apresenta o motivo, **Then** a mensagem não acusa credenciais sem evidência.

### Edge Cases

- O oneLink inicial não contém `shc`, mas o redirecionamento final introduz `shc` e `link`.
- Remover `shc` da URL inicial ainda leva ao mesmo endpoint opaco; remoção cega não conta como resolução.
- O endpoint opaco responde com HTML que contém múltiplos candidatos a produto ou valores conflitantes.
- Um valor opaco ou conteúdo retornado tenta indicar host externo, URL com credenciais embutidas, esquema não HTTP(S), domínio sósia ou redirecionamento de volta ao encurtador.
- A cadeia revela produto, mas também contém `koc_id`, `url_from`, `affiliate`, `ref`, `requestId`, `shc`, `link`, `onelink` ou outros rastros da origem.
- A cadeia revela um produto de país/região diferente; só pode ser aceita se continuar em host oficial permitido e a identidade da cliente puder ser aplicada sem alterar o produto.
- A resolução retorna campanha, vitrine ou cupom em vez de produto. Este fluxo novo não pode inventar um produto; a regra já existente para destinos não-produto verificáveis permanece separada.
- O conteúdo necessário só aparece após execução não confiável ou exige segredo/cookie da cliente. A feature não pode executar código remoto nem tornar cookie obrigatório para gerar o link longo.
- O encurtador falha depois de uma conversão longa segura; a oferta deve sair com o link longo.
- Duas URLs iguais aparecem na mesma mensagem; o comportamento de deduplicação existente não muda.

## Requirements *(mandatory)*

### Functional Requirements

**Resolução e prova do produto**

- **FR-001**: O sistema MUST reconhecer especificamente o endpoint oficial `api-shein.shein.com/h5/sharejump/appjump` como um destino intermediário opaco que pode exigir uma etapa adicional de resolução.
- **FR-002**: Para esse destino, o sistema MUST tentar obter um destino canônico somente por dados e transições verificáveis fornecidos pelo fluxo oficial da SHEIN, dentro dos limites operacionais já aplicados à resolução de links.
- **FR-003**: O sistema MUST considerar a resolução bem-sucedida somente quando um único produto puder ser comprovado de forma inequívoca por um identificador de produto aceito e por um host oficial permitido.
- **FR-004**: O sistema MUST NOT considerar a simples presença, remoção, cópia ou reescrita de `shc`/`link` como prova do produto.
- **FR-005**: O sistema MUST NOT executar JavaScript remoto nem código retornado pela SHEIN para descobrir o destino.
- **FR-006**: O sistema MUST aplicar limites finitos de tempo, quantidade de redirecionamentos e volume de resposta ao novo caminho, falhando fechado quando qualquer limite for atingido.

**Construção segura do link**

- **FR-007**: Após comprovar o produto, o sistema MUST construir um link longo oficial para o mesmo produto usando o ID de afiliada válido da cliente.
- **FR-008**: A ausência de cookie MUST NOT impedir a publicação do link longo convertido.
- **FR-009**: O cookie, quando presente, MUST continuar sendo usado somente na tentativa opcional de encurtar um link longo já convertido e seguro.
- **FR-010**: Antes da publicação, o sistema MUST remover tokens opacos e toda identidade/rastro da origem, incluindo no mínimo `shc`, `link`, `onelink`, `requestId`, identidade de afiliado anterior e parâmetros de sessão ou comportamento conhecidos.
- **FR-011**: O link publicado MUST conter exclusivamente a identidade afiliada da cliente nos campos de atribuição usados pelo programa SHEIN.
- **FR-012**: O sistema MUST verify que o identificador de produto do link publicado é o mesmo comprovado a partir da origem.

**Falha fechada e compatibilidade**

- **FR-013**: Se o produto não puder ser comprovado, o sistema MUST retornar falha de conversão e MUST NOT publicar a URL original, o endpoint opaco, qualquer intermediário ou uma URL parcialmente reescrita.
- **FR-014**: Destinos fora da allowlist exata de hosts SHEIN MUST ser recusados, inclusive domínios sósia, subdomínios malformados e URLs com credenciais embutidas.
- **FR-015**: Links SHEIN já suportados (produto direto, oneLink resolvível, campanha/cupom verificável) MUST preservar o comportamento atual.
- **FR-016**: O comportamento de Shopee, Amazon, Mercado Livre e Magazine Luiza MUST permanecer inalterado.
- **FR-017**: A feature MUST NOT adicionar processo persistente, fila, banco, migration ou dependência externa nova.

**Diagnóstico**

- **FR-018**: O sistema MUST distinguir, no resultado interno da conversão, pelo menos: credencial ausente/inválida, formato opaco sem produto comprovável, indisponibilidade/erro transitório e falha desconhecida.
- **FR-019**: Quando o formato opaco não revelar o produto, o painel MUST explicar em linguagem leiga que o link de compartilhamento não permitiu identificar o produto.
- **FR-020**: O diagnóstico de formato opaco MUST NOT orientar a cliente a recadastrar o ID nem sugerir que cookie seja obrigatório.
- **FR-021**: O diagnóstico existente de falta de ID MUST continuar exclusivo dos casos em que a validação da credencial realmente falhar.
- **FR-022**: Logs e diagnósticos MUST NOT registrar cookies, conteúdo de tokens opacos ou valores de credencial; URLs registradas devem seguir a política de sanitização existente.

**Qualidade**

- **FR-023**: Testes automatizados MUST cobrir sucesso sem cookie, fallback longo após falha de encurtamento, falha fechada sem prova, host malicioso/sósia, ambiguidade de produto, limpeza de identidade, compatibilidade dos formatos SHEIN existentes e diagnóstico correto.
- **FR-024**: Fixtures de teste MUST usar tokens e IDs sintéticos; nenhum cookie, token opaco ou ID real coletado em produção pode ser versionado.
- **FR-025**: A entrega MUST passar por staging antes de produção e a validação manual MUST confirmar que o link publicado abre o mesmo produto e atribui a cliente, sem reinício não planejado de sessões em produção.

### Key Entities

- **OneLink opaco SHEIN**: link curto de entrada que termina no endpoint `sharejump/appjump` e carrega tokens que, isoladamente, não provam produto ou comissão.
- **Evidência de produto**: informação verificável obtida do fluxo oficial que identifica um único produto e permite conferir que origem e saída representam o mesmo item.
- **Destino canônico SHEIN**: endereço oficial, permitido e inspecionável do produto comprovado, antes da aplicação da identidade da cliente.
- **Link longo convertido**: endereço final do produto, limpo de identidade e rastros da origem, com o ID de afiliada da cliente.
- **Motivo de falha de conversão**: classificação segura e apresentável que diferencia configuração ausente, formato não comprovável, falha transitória e falha desconhecida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das fixtures representativas do novo formato que permitem comprovar um único produto produzem link longo válido mesmo sem cookie.
- **SC-002**: 100% dos links publicados pelos testes apontam para o mesmo identificador de produto comprovado na origem e contêm a identidade da cliente, nunca a identidade do originador.
- **SC-003**: 100% dos casos sem prova inequívoca, com host não permitido ou com evidência ambígua terminam sem publicação de URL.
- **SC-004**: Zero tokens `shc`/`link`, identificadores de requisição, sessão ou afiliado de origem aparecem nos links publicados ou nos dados sensíveis dos logs de teste.
- **SC-005**: Todos os testes existentes dos formatos SHEIN já suportados e das outras quatro lojas permanecem aprovados.
- **SC-006**: Em staging, uma conta com ID válido e cookie vazio consegue publicar uma amostra conversível do novo formato como link longo, abrindo o mesmo produto.
- **SC-007**: Em staging, uma amostra não comprovável é bloqueada e exibe o motivo correto sem mencionar credencial inválida.
- **SC-008**: Nenhum processo persistente ou consumo contínuo de memória é adicionado pela feature.

## Assumptions

- O ID numérico da afiliada continua sendo a única informação obrigatória para construir o link longo; o cookie permanece opcional e restrito ao encurtamento.
- Existe, para ao menos parte dos oneLinks opacos observados, uma transição oficial e verificável capaz de revelar um único produto sem executar código remoto. Quando não existir, o resultado correto permanece a recusa.
- A allowlist existente de hosts oficiais da SHEIN e as guardas de URL são a base e devem ser preservadas ou tornadas mais estritas, nunca ampliadas por correspondência parcial.
- A implementação reaproveitará o pipeline atual de detecção, conversão e registro; não haverá banco ou serviço auxiliar.
- A validação em produção depende de janela humana porque mudanças em `src/converters/` são carregadas pelos bot-workers e podem exigir reinício coordenado do supervisor pelo deploy.

## Out of Scope

- Publicar o oneLink original ou o endpoint `sharejump/appjump` como fallback.
- Tornar cookie obrigatório para conversão longa ou alterar o cadastro de credenciais SHEIN.
- Decodificar tokens opacos por suposição, engenharia reversa não verificável ou execução de código remoto.
- Garantir conversão de todo e qualquer link de compartilhamento; links sem prova de produto continuam bloqueados.
- Alterar deduplicação, filas, roteamento, card de preview ou conversores de outras lojas.
- Adicionar scraping de preço ou título do produto.
- Fazer cutover, reinício manual de produção ou qualquer alteração na VPS como parte da implementação local.
