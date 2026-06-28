# Auditoria de UX Writing — clareza textual do painel

Escopo auditado: textos do painel autenticado, login e áreas administrativas com maior risco de fricção cognitiva. O foco é reduzir dúvidas antes do clique, explicar estados de erro com próximos passos e substituir termos de sistema por linguagem orientada à tarefa do usuário.

## 1. Jargões técnicos e termos de sistema

### [Painel / Filas de ofertas]
- **O Texto Atual:** “Adicionar itens”.
- **O Risco de Interpretação:** “Itens” é um termo genérico. O usuário pode não entender se está adicionando produtos, links, mensagens ou regras de envio.
- **A Proposta de UX Writing (Solução):**
  - CTA: “Adicionar ofertas”.
  - Microtexto: “Cadastre ofertas nesta fila e escolha o ritmo em que elas serão enviadas aos grupos.”

### [Painel / Filas — paywall Pro]
- **O Texto Atual:** “Cadastre as ofertas de uma vez e o bot distribui ao longo do dia, sem rajadas.”
- **O Risco de Interpretação:** “Rajadas” é uma metáfora interna/técnica. Pode gerar dúvida sobre risco de bloqueio, volume de mensagens ou disparos simultâneos.
- **A Proposta de UX Writing (Solução):**
  - “Cadastre várias ofertas de uma vez e o bot envia aos poucos durante o dia.”
  - Ajuda opcional: “Isso evita muitos envios em sequência no mesmo grupo.”

### [Painel / Filas — limites]
- **O Texto Atual:** “Intervalo mínimo entre ofertas”, “Máximo de ofertas por hora”, “Máximo de ofertas por dia”.
- **O Risco de Interpretação:** Os rótulos são corretos, mas não explicam se o limite vale por fila, por grupo ou para toda a conta. Isso pode levar o usuário a configurar um volume errado.
- **A Proposta de UX Writing (Solução):**
  - “Tempo mínimo entre envios desta fila”.
  - “Máximo por hora nesta fila”.
  - “Máximo por dia nesta fila”.
  - Microtexto: “Essas regras valem só para esta fila.”

### [Painel / Configurações]
- **O Texto Atual:** “Cadência entre envios” e “evitando uma cadência robótica”.
- **O Risco de Interpretação:** “Cadência” é um termo de produto/marketing. “Robótica” é compreensível, mas pode soar abstrato. O usuário quer saber qual efeito prático isso tem nos grupos.
- **A Proposta de UX Writing (Solução):**
  - Título: “Tempo de espera entre mensagens”.
  - Descrição: “Antes de enviar cada mensagem, o bot espera um tempo aleatório dentro do intervalo escolhido. Isso deixa os envios mais naturais.”

### [Painel / Configurações — template]
- **O Texto Atual:** “Espelhamento com template (padrão global)”.
- **O Risco de Interpretação:** “Template”, “padrão global” e “espelhamento” exigem conhecimento prévio do produto. O usuário pode não entender se está alterando mensagens futuras, mensagens já enviadas ou todos os grupos.
- **A Proposta de UX Writing (Solução):**
  - Título: “Formato padrão das mensagens copiadas”.
  - Descrição: “Use este formato nos grupos que não têm uma configuração própria. Você ainda pode escolher outro formato em cada grupo.”
  - Campo: “Formato padrão da mensagem”.

### [Painel / Afiliados]
- **O Texto Atual:** “A janela de atribuição atual é de X dias, e a atribuição é congelada no momento do pagamento para reduzir disputas e perda de rastreio.”
- **O Risco de Interpretação:** “Janela de atribuição”, “atribuição congelada” e “rastreio” são jargões de afiliados/analytics. A regra é importante para dinheiro; qualquer ambiguidade aumenta suporte e contestação.
- **A Proposta de UX Writing (Solução):**
  - “Depois que alguém clica no seu link, você tem X dias corridos para receber a comissão se essa pessoa contratar. Quando o pagamento é confirmado, registramos definitivamente que a indicação é sua.”
  - Tooltip: “Dias corridos: conta fins de semana e feriados.”

## 2. Ambiguidade e falta de contexto

### [Painel / Filas — controle mestre]
- **O Texto Atual:** “Desativar todas” / “Ativar todas”.
- **O Risco de Interpretação:** O usuário pode não saber se “desativar” apaga ofertas, cancela envios pendentes ou apenas pausa temporariamente.
- **A Proposta de UX Writing (Solução):**
  - “Pausar todas as filas”.
  - “Retomar todas as filas”.
  - Confirmação opcional: “As ofertas cadastradas continuam salvas. Só os envios automáticos serão pausados.”

### [Painel / Filas — switch de cada fila]
- **O Texto Atual:** título do switch “Ativar fila e enviar a primeira oferta agora”.
- **O Risco de Interpretação:** Este texto é claro sobre a consequência, mas aparece só como `title`; em mobile, o usuário geralmente não vê. O estado visual pode não comunicar que ativar pode enviar imediatamente.
- **A Proposta de UX Writing (Solução):**
  - Exibir microtexto fixo perto do botão quando há pendências: “Ao retomar, a próxima oferta pode sair agora se os limites permitirem.”
  - CTA alternativo: “Retomar envios”.

### [Painel / Filas — horário específico]
- **O Texto Atual:** “Selecionar horário de funcionamento SÓ dessa fila?”
- **O Risco de Interpretação:** Caixa alta em “SÓ” dá tom de alerta e pode parecer bronca. “Horário de funcionamento” não explica claramente que é a faixa em que as ofertas podem sair.
- **A Proposta de UX Writing (Solução):**
  - “Usar um horário próprio para esta fila”.
  - Microtexto: “Quando ativado, esta fila envia ofertas apenas entre os horários abaixo e ignora o horário geral configurado.”

### [Painel / Envios]
- **O Texto Atual:** “Acompanhe o que já foi processado e os envios programados”.
- **O Risco de Interpretação:** “Processado” pode significar enviado, bloqueado, convertido ou apenas analisado. O usuário pode confundir resultado técnico com envio real.
- **A Proposta de UX Writing (Solução):**
  - “Veja as ofertas já enviadas, bloqueadas ou com erro — e confira os próximos envios programados.”

### [Painel / Dashboard inicial]
- **O Texto Atual:** “links não passaram — fora dos filtros ou repetidos.”
- **O Risco de Interpretação:** “Não passaram” é vago. O usuário não sabe se o bot falhou, se bloqueou por segurança ou se precisa corrigir algo.
- **A Proposta de UX Writing (Solução):**
  - “links não foram enviados porque repetiam ofertas recentes ou não combinavam com seus filtros.”
  - Link de ajuda: “Ver motivos”.

## 3. Mensagens de erro e estados vazios

### [Painel / Configurações]
- **O Texto Atual:** “Falha ao carregar configurações” + erro técnico retornado.
- **O Risco de Interpretação:** A mensagem informa o problema, mas não orienta o próximo passo. Se o erro vier da API, pode aparecer com texto técnico.
- **A Proposta de UX Writing (Solução):**
  - “Não conseguimos carregar suas configurações agora.”
  - “Tente recarregar a página. Se continuar, chame o suporte e diga que o erro apareceu em Configurações.”
  - CTA: “Tentar novamente”.

### [Painel / Envios]
- **O Texto Atual:** “Falha ao carregar envios”.
- **O Risco de Interpretação:** Não explica se os envios foram perdidos ou se apenas a tela não carregou. Pode gerar ansiedade operacional.
- **A Proposta de UX Writing (Solução):**
  - “Não conseguimos mostrar seu histórico de envios agora.”
  - “Isso não significa que as mensagens pararam de sair. Recarregue a página para tentar de novo.”

### [Painel / Grupos]
- **O Texto Atual:** “Falha ao carregar grupos do WhatsApp”.
- **O Risco de Interpretação:** A mensagem já sugere confirmar conexão, mas poderia separar causa provável e ação em passos curtos para mobile.
- **A Proposta de UX Writing (Solução):**
  - “Não conseguimos buscar seus grupos no WhatsApp.”
  - Bullets: “1. Confira se o bot aparece como conectado. 2. Se não estiver, leia o QR Code de novo. 3. Depois, toque em ‘Carregar grupos’.”

### [Painel / Filas — empty state]
- **O Texto Atual:** “Nenhuma fila criada”.
- **O Risco de Interpretação:** O empty state é funcional, mas perde a chance de explicar a utilidade da tela em linguagem concreta.
- **A Proposta de UX Writing (Solução):**
  - Título: “Você ainda não criou uma fila de ofertas”.
  - Texto: “Crie uma fila para cadastrar várias ofertas e deixar o bot enviar aos poucos durante o dia.”
  - CTA: “Criar primeira fila”.

### [Login]
- **O Texto Atual:** “Falha na autenticação”.
- **O Risco de Interpretação:** “Autenticação” é termo técnico. O usuário pode não saber se errou senha, se o e-mail não existe ou se o sistema está instável.
- **A Proposta de UX Writing (Solução):**
  - Título: “Não conseguimos entrar na sua conta”.
  - Mensagem contextual: “Confira e-mail e senha. Se você acabou de criar a conta, tente novamente em alguns segundos.”

## 4. Arquitetura de informação e carga cognitiva

### [Painel / Afiliados — regras]
- **O Texto Atual:** Blocos longos explicando repasse, reembolso, link exclusivo e atribuição.
- **O Risco de Interpretação:** As regras são importantes, mas aparecem em parágrafos longos. Em mobile, usuários tendem a pular e depois podem abrir suporte por dúvidas de pagamento.
- **A Proposta de UX Writing (Solução):**
  - Transformar em bullets curtos:
    - “A comissão só é liberada X dias corridos após o pagamento.”
    - “Se o cliente pedir reembolso nesse período, a comissão é cancelada.”
    - “A indicação só conta quando a pessoa se cadastra pelo seu link.”
    - “Após o pagamento, a indicação fica registrada em seu nome.”

### [Painel / Configurações — múltiplos salvamentos]
- **O Texto Atual:** “Salvar cadência” e “Salvar padrão de espelhamento” na mesma página.
- **O Risco de Interpretação:** Como cada bloco salva a página inteira por trás, o usuário pode acreditar que só aquele bloco foi salvo. Isso é aceitável, mas precisa ser consistente.
- **A Proposta de UX Writing (Solução):**
  - Escolha definida: opção B.
  - Manter botões por bloco, mas com feedback específico: “Tempo entre mensagens salvo.” / “Formato padrão salvo.”
  - Exibir o feedback perto do bloco salvo, para o usuário entender qual alteração foi confirmada.

### [Painel / Consistência terminológica]
- **O Texto Atual:** “itens”, “ofertas”, “envios” e “mensagens” aparecem como objetos próximos.
- **O Risco de Interpretação:** O usuário pode não entender a hierarquia: oferta vira mensagem, item fica em fila, envio é o resultado. Isso aumenta carga cognitiva.
- **A Proposta de UX Writing (Solução):**
  - Manter “Fila” como nome do recurso.
  - Usar “Oferta” para o produto/link cadastrado dentro de uma fila.
  - Usar “Envio” para a tentativa ou resultado de mandar uma oferta ao grupo.
  - Usar “Mensagem” para o texto final que chega no WhatsApp.
  - Evitar “item” na interface final; usar “oferta”.

## Prioridade recomendada

1. Trocar “itens” por “ofertas” dentro do recurso de Filas, mantendo “Filas” como nome do recurso.
2. Reescrever regras de afiliados em bullets com “dias corridos” e explicação de quando começa a contar.
3. Trocar “cadência” por “tempo de espera entre mensagens”.
4. Melhorar mensagens de erro com ação recomendada e reduzir termos técnicos como “autenticação”.
5. Padronizar o vocabulário “fila → oferta → envio → mensagem” em todo o painel.

## Plano de implementação por sprints

### Sprint 1 — Vocabulário de Filas e ofertas

**Objetivo:** manter “Filas” como nome do recurso e remover ambiguidades em torno de “itens”.

**Escopo de mudança:**
- Trocar “Adicionar itens” por “Adicionar ofertas” em CTAs, labels, aria-labels e textos de ajuda.
- Manter “Fila”, “Nova fila”, “Editar fila” e “Filas” como termos oficiais do recurso.
- Ajustar todos os textos contextuais para explicar que uma oferta é o produto/link cadastrado dentro de uma fila.
- Atualizar empty states e mensagens de orientação sem trocar o nome do recurso.

**Mensagens de ajuda que devem entrar junto:**
- Ao criar/editar fila: “Cadastre ofertas nesta fila e escolha o ritmo em que elas serão enviadas aos grupos.”
- Nos limites da fila: “Essas regras valem só para esta fila.”
- No empty state: “Crie uma fila para cadastrar várias ofertas e deixar o bot enviar aos poucos durante o dia.”

**Critério de aceite:**
- Nenhuma tela recomenda trocar “Filas” por “Listas”.
- Usuário entende que “oferta” é o conteúdo cadastrado dentro da fila.
- CTAs deixam claro que a ação adiciona ofertas, não itens genéricos.

### Sprint 2 — Configurações e salvamento por bloco

**Objetivo:** reduzir jargões em Configurações e adotar a opção B para múltiplos salvamentos.

**Decisão para múltiplos salvamentos:** opção B — manter botões por bloco, mas cada bloco deve ter feedback próprio e específico.

**Escopo de mudança:**
- Trocar “Cadência entre envios” por “Tempo de espera entre mensagens”.
- Trocar a descrição “evitando uma cadência robótica” por texto orientado ao usuário.
- Trocar “Espelhamento com template (padrão global)” por “Formato padrão das mensagens copiadas”.
- Manter botões separados por bloco, com feedback contextual após salvar.
- Garantir que o feedback apareça perto do bloco salvo, não apenas em um aviso genérico na página.

**Mensagens de ajuda que devem entrar junto:**
- Em tempo de espera: “Antes de enviar cada mensagem, o bot espera um tempo aleatório dentro do intervalo escolhido. Isso deixa os envios mais naturais.”
- Em formato padrão: “Use este formato nos grupos que não têm uma configuração própria. Você ainda pode escolher outro formato em cada grupo.”
- Feedback do bloco de tempo: “Tempo entre mensagens salvo.”
- Feedback do bloco de formato: “Formato padrão salvo.”

**Critério de aceite:**
- Cada botão de salvar informa exatamente o que foi salvo.
- O usuário não precisa interpretar “cadência”, “template” ou “padrão global”.
- A página mantém salvamento por seção, conforme opção B.

### Sprint 3 — Afiliados, regras financeiras e contexto de prazo

**Objetivo:** deixar regras de comissão, repasse e atribuição claras o suficiente para evitar dúvidas de pagamento.

**Escopo de mudança:**
- Reescrever os blocos longos de afiliados em bullets curtos.
- Explicar que os prazos são em dias corridos.
- Explicar quando começa a contagem: pagamento confirmado do cliente para repasse; clique no link para atribuição.
- Trocar “janela de atribuição”, “atribuição congelada” e “rastreio” por linguagem natural.

**Mensagens de ajuda que devem entrar junto:**
- Tooltip ou nota em prazo: “Dias corridos contam fins de semana e feriados.”
- Nota de repasse: “A comissão só é liberada depois do prazo de segurança, contado a partir do pagamento confirmado do cliente.”
- Nota de indicação: “A indicação só conta quando a pessoa se cadastra pelo seu link.”
- Nota de confirmação: “Quando o pagamento é confirmado, registramos definitivamente que a indicação é sua.”

**Critério de aceite:**
- O usuário entende quanto recebe, quando recebe e por que pode não receber.
- O texto explica reembolso sem soar punitivo ou alarmista.
- Não há termos de analytics/afiliados sem tradução para linguagem comum.

### Sprint 4 — Erros, estados vazios e próximos passos

**Objetivo:** transformar erros e estados vazios em mensagens orientadoras, com causa provável e ação recomendada.

**Escopo de mudança:**
- Reescrever erros de Configurações, Envios, Grupos e Login.
- Incluir CTA ou instrução de próximo passo em cada erro recuperável.
- Separar mensagens em título curto + texto de ação.
- Evitar expor mensagens técnicas brutas sem contextualização.

**Mensagens de ajuda que devem entrar junto:**
- Configurações: “Tente recarregar a página. Se continuar, chame o suporte e diga que o erro apareceu em Configurações.”
- Envios: “Isso não significa que as mensagens pararam de sair. Recarregue a página para tentar de novo.”
- Grupos: “1. Confira se o bot aparece como conectado. 2. Se não estiver, leia o QR Code de novo. 3. Depois, toque em ‘Carregar grupos’.”
- Login: “Confira e-mail e senha. Se você acabou de criar a conta, tente novamente em alguns segundos.”

**Critério de aceite:**
- Cada erro responde: o que aconteceu, se há risco para o usuário e o que fazer agora.
- Empty states explicam o valor da tela antes do CTA.
- Nenhum erro principal usa “autenticação” como título para usuário final.

### Sprint 5 — Consistência final, acessibilidade textual e QA de conteúdo

**Objetivo:** garantir que o vocabulário fique consistente em todo o painel e que as mensagens de ajuda também estejam presentes em estados mobile e acessíveis.

**Escopo de mudança:**
- Revisar o painel inteiro para padronizar “fila → oferta → envio → mensagem”.
- Verificar labels visíveis, placeholders, aria-labels, titles, tooltips, empty states, alerts e mensagens de erro.
- Garantir que informações críticas não existam apenas em `title`, porque mobile não exibe tooltip nativo de hover.
- Revisar consistência de tom: claro, orientador e sem culpa ao usuário.

**Mensagens de ajuda que devem entrar junto:**
- Switch de fila com pendências: “Ao retomar, a próxima oferta pode sair agora se os limites permitirem.”
- Controle mestre: “As ofertas cadastradas continuam salvas. Só os envios automáticos serão pausados.”
- Dashboard inicial: “Links não foram enviados porque repetiam ofertas recentes ou não combinavam com seus filtros.”

**Critério de aceite:**
- O mesmo conceito tem o mesmo nome em todas as páginas.
- Textos contextuais aparecem também em mobile e leitores de tela quando afetam decisão do usuário.
- A revisão final não encontra ocorrências de “itens” em contexto em que o usuário final deveria ler “ofertas”.
