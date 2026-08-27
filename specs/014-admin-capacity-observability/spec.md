# Feature Specification: Capacidade e previsibilidade da infraestrutura no ADMIN

**Feature Branch**: `work`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Criar uma aba Capacidade no ADMIN com observabilidade e previsibilidade da VPS Hetzner atual (wabot-prod, CX33 x86, 4 vCPU, 8 GB RAM, 40 GB, eu-central), mostrando decisão operacional, headroom seguro de sessões, RAM/CPU/disco/swap, PM2 e bot-workers por ambiente, histórico, forecast de crescimento 7/30/90d, simulador de novos clientes, integração Hetzner somente leitura e cacheada, alertas proativos, staging co-localizado e recomendação de prazo para upgrade. Não criar novo processo PM2; coletar de modo leve pela API existente; lazy-load na aba; tech:read/tech:write; auditável; resiliente a falhas parciais; nunca expor token nem permitir rescale/delete; seguir política de memória e staging do AGENTS.md."

## Contexto do produto

Produção e staging compartilham hoje a VPS `wabot-prod`, uma Hetzner CX33 x86 com 4 vCPU, 8 GB de RAM, 40 GB de disco e localização `eu-central`. Cada sessão WhatsApp conectada mantém um bot-worker próprio, e o crescimento de clientes aumenta principalmente o consumo de memória. A equipe hoje precisa combinar comandos na VPS, PM2 e o console da Hetzner para entender se ainda há espaço, tornando a decisão de upgrade reativa e dependente de conhecimento técnico.

A aba **Capacidade** deve transformar métricas em uma decisão operacional: qual é o estado atual, qual recurso será o primeiro gargalo, quantas sessões adicionais cabem com margem segura e quando agir se o ritmo de crescimento continuar. Ela oferece observabilidade e recomendação, mas nunca altera, redimensiona ou exclui infraestrutura.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entender capacidade e ação necessária imediatamente (Priority: P1)

Uma pessoa administradora com acesso técnico abre a aba Capacidade e vê, no primeiro bloco, o estado operacional, sessões atuais, headroom seguro, gargalo predominante, horizonte previsto e ação recomendada. Ela não precisa interpretar comandos ou gráficos para decidir se pode aguardar, planejar ou agir.

**Why this priority**: Esta é a decisão de negócio central. Métricas sem síntese não resolvem a dúvida sobre quantos clientes ainda cabem nem quando contratar mais capacidade.

**Independent Test**: Abrir a aba com uma fotografia conhecida de 17 sessões na CX33 e confirmar que a tela apresenta estado, limite seguro, headroom, gargalo e recomendação coerentes, com origem e horário dos dados.

**Acceptance Scenarios**:

1. **Given** há uma medição atual válida, **When** uma pessoa com permissão técnica abre Capacidade, **Then** ela vê em destaque o estado operacional, sessões atuais, limite seguro, headroom e próximo gargalo.
2. **Given** a margem está se aproximando do limite, **When** a aba calcula a decisão, **Then** ela apresenta uma recomendação acionável e um prazo ou faixa de prazo, sem falsa precisão.
3. **Given** há margem ampla, **When** a aba é aberta, **Then** ela informa que nenhuma ação é necessária e ainda mostra quais condições mudariam esse estado.
4. **Given** os dados são insuficientes ou antigos, **When** a aba é aberta, **Then** o estado é "dados insuficientes/desatualizados", nunca "saudável" por ausência de evidência.
5. **Given** a pessoa não possui acesso técnico, **When** tenta acessar a visão, **Then** os dados de infraestrutura não são exibidos.

---

### User Story 2 - Investigar recursos, processos e ambientes (Priority: P1)

A pessoa administradora investiga RAM, CPU, disco, swap, aplicações gerenciadas e bot-workers, separados entre produção e staging, para validar a causa da recomendação e detectar consumo anormal ou divergências.

**Why this priority**: A recomendação precisa ser explicável. O detalhamento permite diferenciar crescimento normal de vazamento, staging desnecessariamente ligado, disco crescente ou falha de coleta.

**Independent Test**: Fornecer medições conhecidas dos dois ambientes e confirmar que os cartões e a decomposição conciliam totais, distinguem memória disponível de memória livre e contam apenas workers reais.

**Acceptance Scenarios**:

1. **Given** existe uma medição recente do host, **When** a pessoa abre os detalhes, **Then** vê RAM total, disponível e efetivamente comprometida, CPU, carga, disco, inodes, swap usado e atividade de swap com unidades e estados compreensíveis.
2. **Given** produção e staging estão co-localizados, **When** a decomposição é exibida, **Then** processos, workers e consumo aparecem separados por ambiente e o custo atual de staging é explícito.
3. **Given** há swap ocupado sem movimentação contínua, **When** o estado é classificado, **Then** ele é informativo e não é tratado sozinho como saturação.
4. **Given** há atividade contínua de swap junto de pouca memória disponível, **When** o estado é classificado, **Then** a tela sinaliza pressão real e eleva a severidade.
5. **Given** a quantidade de workers diverge das sessões conectadas, **When** a coleta é consolidada, **Then** a divergência aparece como alerta com as duas contagens.
6. **Given** staging está ligado sem workers e fora de validação conhecida, **When** a aba é exibida, **Then** ela sugere a economia possível, mas não desliga nada automaticamente.

---

### User Story 3 - Acompanhar histórico e prever o limite (Priority: P2)

A pessoa administradora alterna entre 24 horas, 7, 30 e 90 dias para observar sessões, memória, swap, disco e eventos. A tela estima o crescimento de sessões em janelas de 7/30/90 dias e apresenta uma projeção com faixa e confiança.

**Why this priority**: Uma fotografia confirma o presente, mas planejamento exige distinguir um pico de uma tendência e antecipar quando a margem mínima será atingida.

**Independent Test**: Carregar 90 dias de amostras sintéticas com crescimento conhecido e confirmar tendências por janela, faixa prevista, confiança e ausência de forecast quando o histórico é insuficiente.

**Acceptance Scenarios**:

1. **Given** há histórico suficiente, **When** a pessoa seleciona um período, **Then** vê a evolução de sessões e recursos, o limite seguro aplicável e eventos relevantes no mesmo eixo temporal.
2. **Given** as janelas de 7, 30 e 90 dias têm ritmos diferentes, **When** o forecast é exibido, **Then** os três ritmos ficam disponíveis e a recomendação identifica a referência adotada.
3. **Given** o histórico é volátil, **When** uma data é estimada, **Then** a tela apresenta intervalo provável e confiança, em vez de uma data exata enganosa.
4. **Given** há menos histórico que o mínimo requerido, **When** a previsão é solicitada, **Then** a tela explica que ainda não há base suficiente e mantém somente a visão atual.
5. **Given** ocorreu deploy, mudança de staging, OOM ou mudança de capacidade, **When** o histórico cobre o evento, **Then** ele aparece como anotação e não é confundido com crescimento orgânico.

---

### User Story 4 - Simular crescimento de clientes (Priority: P2)

A pessoa administradora informa quantos novos clientes espera, o prazo e a proporção esperada de sessões ativas. A aba compara o cenário com a capacidade segura atual e indica déficit estimado e recomendação de planejamento, sem executar qualquer mudança.

**Why this priority**: Campanhas e vendas futuras podem exceder a tendência histórica; o simulador permite decidir antes de captar clientes.

**Independent Test**: Simular dez novos clientes em três meses com 90% de ativação e confirmar sessões projetadas, headroom ou déficit e recomendação, sem alterar dados persistidos nem infraestrutura.

**Acceptance Scenarios**:

1. **Given** valores válidos de crescimento e ativação, **When** o cenário é calculado, **Then** a pessoa vê sessões projetadas, margem ou déficit, memória estimada e prazo recomendado.
2. **Given** o cenário permanece abaixo do limite seguro, **When** o resultado aparece, **Then** a tela informa a margem remanescente sem recomendar upgrade desnecessário.
3. **Given** o cenário excede o limite seguro, **When** o resultado aparece, **Then** a tela informa o déficit e recomenda planejar capacidade antes do período informado.
4. **Given** a pessoa recalcula ou sai da aba, **When** nenhuma ação explícita de infraestrutura existe, **Then** o cenário não altera servidor, sessões, staging ou configuração operacional.

---

### User Story 5 - Consultar contratado, inventário e alertas (Priority: P3)

A pessoa administradora confere a identificação e capacidade contratada da VPS, a quantidade de recursos conhecida no projeto Hetzner e alertas operacionais. Os dados externos informam fonte e idade; indisponibilidade do provedor não derruba o restante da visão.

**Why this priority**: Completa a comparação contratado versus utilizado e reduz o risco de descobrir limites apenas ao tentar crescer, mas a observabilidade local já entrega valor sem a integração externa.

**Independent Test**: Exibir dados externos válidos, desatualizados e indisponíveis e confirmar que a visão local permanece utilizável, nenhum segredo aparece e nenhuma ação destrutiva está disponível.

**Acceptance Scenarios**:

1. **Given** a sincronização somente leitura está disponível, **When** a aba é aberta, **Then** mostra servidor, tipo, arquitetura, capacidade, região, inventário conhecido, fonte e última atualização.
2. **Given** o provedor externo está indisponível, **When** a aba é aberta, **Then** mantém o último dado válido identificado como desatualizado e preserva todas as métricas locais.
3. **Given** uma condição cruza um limiar de planejamento ou criticidade, **When** ela persiste pelo período mínimo, **Then** um alerta auditável é criado com evidência, severidade, recomendação e controle anti-spam.
4. **Given** a condição se recupera, **When** a próxima medição confirma recuperação, **Then** o histórico registra a normalização sem apagar a ocorrência anterior.
5. **Given** qualquer pessoa acessa a interface ou seus dados, **When** inspeciona conteúdo e respostas, **Then** nenhum token, segredo ou credencial do provedor é revelado.
6. **Given** uma pessoa com acesso de escrita usa uma ação permitida como atualização manual ou controle existente de staging, **When** confirma a ação, **Then** ela é autorizada e auditada; rescale, delete e criação de infraestrutura não existem nessa aba.

### Edge Cases

- Reinício do host ou contador cumulativo que volta a zero entre duas medições não pode virar pico negativo de consumo.
- Um worker cujo comando de coleta também contém o texto `bot-worker` não pode ser contado como sessão real.
- Workers recém-iniciados e workers em pico de mídia podem ter consumos muito diferentes; a capacidade não pode usar somente média baixa.
- Cache de arquivos recuperável não deve ser apresentado como memória permanentemente ocupada, nem swap como RAM adicional.
- Staging pode estar parcialmente ligado: a tela deve mostrar cada componente e nunca declarar o ambiente desligado enquanto algum processo dele permanecer ativo.
- Uma mudança de tamanho da VPS invalida a comparação direta com o limite anterior; o histórico deve marcar a mudança e recalcular a capacidade futura.
- Crescimento líquido zero ou negativo não produz uma data artificial de esgotamento.
- Um pico isolado, deploy ou campanha não deve dominar silenciosamente uma projeção de longo prazo.
- Falha de uma fonte (host, processos, sessões, histórico ou provedor) deve ser localizada; valores ausentes não podem ser convertidos em zero.
- Horários devem ser consistentes mesmo quando navegador, servidor e provedor usam fusos diferentes.
- Disco pode ficar sem espaço antes da RAM; a recomendação deve escolher o gargalo que ocorrer primeiro.
- Alertas repetidos não devem gerar spam; piora de severidade e recuperação continuam relevantes.

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e experiência**

- **FR-001**: O ADMIN MUST oferecer uma aba principal denominada **Capacidade**, visível somente a pessoas com permissão de leitura técnica.
- **FR-002**: A aba MUST carregar seus dados somente quando for aberta e MUST interromper atualizações automáticas quando não estiver visível.
- **FR-003**: O primeiro bloco MUST apresentar estado operacional textual, sessões atuais, limite seguro, headroom, gargalo predominante, horizonte previsto, confiança e recomendação acionável.
- **FR-004**: Estados MUST combinar texto, ícone e cor e MUST incluir pelo menos: saudável, atenção, planejar agora, crítico e dados insuficientes/desatualizados.
- **FR-005**: Toda medição MUST informar horário, idade e fonte; dados ausentes ou antigos MUST NOT ser exibidos como zero nem classificados como saudáveis.
- **FR-006**: A visão MUST permanecer navegável em telas móveis e por teclado, sem depender apenas de cor para transmitir significado.

**Visão atual e explicabilidade**

- **FR-007**: O sistema MUST apresentar RAM total, disponível, livre, cache recuperável e consumo estimado dos processos de forma distinguível.
- **FR-008**: O sistema MUST apresentar CPU, carga de curto/médio/longo prazo, disco total/usado/disponível, inodes, swap total/usado e atividade recente de entrada/saída de swap.
- **FR-009**: O sistema MUST apresentar estado, tempo ativo, reinícios, CPU e memória dos processos operacionais relevantes.
- **FR-010**: O sistema MUST identificar bot-workers reais fora da lista superficial do gerenciador, excluir o próprio processo de coleta e mostrar contagem, consumo agregado, mediana, percentil conservador e máximo.
- **FR-011**: O sistema MUST separar produção e staging e conciliar o consumo de cada ambiente com o total observado do host.
- **FR-012**: O sistema MUST comparar workers reais, sessões conectadas e clientes ativos, sinalizando divergências sem assumir automaticamente qual fonte está correta.
- **FR-013**: O sistema MUST mostrar a contribuição do staging e sugerir desligamento somente quando aplicável, sem desligamento automático.
- **FR-014**: Qualquer controle de staging exibido MUST reutilizar as proteções, confirmação e auditoria existentes e MUST respeitar o modo operacional canônico do ambiente.

**Capacidade segura**

- **FR-015**: O sistema MUST calcular o limite seguro preservando uma reserva mínima do host e excluindo swap da capacidade disponível.
- **FR-016**: O custo de memória por sessão MUST usar uma estimativa conservadora de 350 MB enquanto não houver histórico suficiente e, posteriormente, o maior entre essa referência e o percentil conservador observado.
- **FR-017**: A reserva mínima MUST ser o maior valor entre 20% da RAM e 1,5 GB, acrescida da base fixa conservadora observada quando ela exceder essa reserva.
- **FR-018**: O limite seguro MUST ser arredondado para baixo e recalculado quando mudarem capacidade contratada, base fixa, consumo por sessão ou estado do staging.
- **FR-019**: O sistema MUST mostrar headroom em sessões e memória e MUST distinguir limite seguro de um máximo estimado não recomendado.
- **FR-020**: A recomendação MUST considerar RAM, CPU, disco, inodes, swap e divergências, escolhendo o gargalo que exigir ação primeiro.
- **FR-021**: Os limiares e fórmulas usados na decisão MUST ser explicáveis na própria visão e versionados junto a cada resultado histórico para evitar reinterpretação silenciosa.

**Histórico e forecast**

- **FR-022**: O sistema MUST guardar amostras leves em intervalos regulares sem introduzir processo operacional novo e sem interromper o serviço principal em caso de falha de coleta.
- **FR-023**: O histórico MUST permitir visualizar 24 horas, 7, 30 e 90 dias de sessões, RAM, swap, CPU, disco, workers, limite e estados.
- **FR-024**: O sistema MUST preservar amostras detalhadas por pelo menos 90 dias, resumos horários por pelo menos 12 meses e resumos diários e eventos críticos conforme a política operacional vigente.
- **FR-025**: O sistema MUST calcular crescimento líquido de sessões em janelas de 7, 30 e 90 dias, deixando explícita a janela adotada para a recomendação.
- **FR-026**: Uma previsão MUST apresentar valor central, faixa provável e nível de confiança baseado em quantidade e estabilidade do histórico.
- **FR-027**: O sistema MUST NOT apresentar data de esgotamento quando o histórico for insuficiente ou o crescimento não for positivo.
- **FR-028**: Deploys, mudanças de staging, reinícios, OOM, alteração de política e mudança de capacidade MUST ser anotados no histórico e considerados ao interpretar tendências.
- **FR-029**: A previsão MUST evitar falsa precisão e MUST atualizar-se quando novas medições ou novos dados de crescimento alterarem materialmente o horizonte.

**Simulador**

- **FR-030**: Pessoas com leitura técnica MUST poder simular quantidade de novos clientes, prazo e percentual esperado de ativação de sessão.
- **FR-031**: O resultado MUST informar sessões projetadas, headroom ou déficit, memória incremental estimada, gargalo e prazo recomendado.
- **FR-032**: Cenários MUST ser somente consultivos e MUST NOT alterar infraestrutura, processos, sessões, staging ou a recomendação oficial persistida.
- **FR-033**: Entradas inválidas ou extremas MUST ser recusadas com limites e explicação compreensíveis.

**Hetzner, segurança e resiliência**

- **FR-034**: A visão MUST reconhecer como baseline inicial o servidor `wabot-prod`, tipo CX33, x86, 4 vCPU, 8 GB RAM, 40 GB, região `eu-central`, permitindo que uma mudança contratada posterior substitua o baseline sem alteração da interface.
- **FR-035**: A integração com o provedor MUST ser estritamente somente leitura, usar dados cacheados e limitar sua frequência de atualização.
- **FR-036**: Segredos e tokens MUST permanecer fora da interface, respostas ao navegador, históricos, auditorias e mensagens de erro.
- **FR-037**: A aba MUST NOT oferecer criação, exclusão, redimensionamento, desligamento da VPS nem qualquer outra mutação de infraestrutura do provedor.
- **FR-038**: Falha ou lentidão do provedor MUST NOT bloquear nem degradar a coleta local; o último dado válido pode ser mostrado com indicação explícita de idade.
- **FR-039**: Inventário, quota e custo MUST identificar se a fonte é sincronizada ou informada manualmente e quando foi conferida pela última vez.
- **FR-040**: Leituras MUST exigir permissão técnica de leitura; atualização manual e ações operacionais já autorizadas MUST exigir permissão técnica de escrita e gerar auditoria.
- **FR-041**: A coleta MUST ser leve, ter limite de duração, evitar comandos interpretados por shell com entrada variável e não criar novo processo PM2.
- **FR-042**: Falhas parciais MUST produzir estado parcial com diagnóstico por fonte, preservando todas as medições confiáveis restantes.

**Alertas**

- **FR-043**: O sistema MUST gerar alertas para margem segura baixa, previsão de limite próxima, pressão contínua de swap, pouco espaço em disco, OOM, coleta atrasada, divergência de workers/sessões e staging ocioso por período prolongado.
- **FR-044**: Cada alerta MUST registrar condição, valores observados, severidade, início, última observação, recomendação e recuperação quando ocorrer.
- **FR-045**: Alertas MUST aplicar período de persistência e anti-spam; repetição só deve notificar novamente quando a severidade piorar ou após a janela definida.
- **FR-046**: Alertas MUST ser somente informativos e MUST NOT reiniciar processos, desconectar sessões, desligar staging ou alterar infraestrutura automaticamente.

### Key Entities

- **Perfil de capacidade do host**: identidade e recursos contratados do servidor, incluindo tipo, arquitetura, CPU, RAM, disco, localização, fonte e validade do dado.
- **Snapshot de capacidade**: fotografia temporal das métricas confiáveis, sessões, workers, ambientes, política aplicada, limite seguro, headroom, gargalo e estado.
- **Componente operacional**: API, dashboard, supervisor, bot-worker, Redis ou componente de staging, com ambiente, estado e consumo observado.
- **Política de capacidade**: conjunto versionado de reservas, custo conservador por sessão, limiares, persistência e regras de severidade.
- **Projeção de capacidade**: tendência por janela, valor central, faixa, confiança, gargalo e horizonte para atingir um limiar.
- **Cenário simulado**: entradas temporárias de crescimento e seus resultados consultivos, sem efeito operacional.
- **Evento de capacidade**: deploy, mudança de staging, reinício, OOM, alteração de host/política ou outra anotação que explica uma variação.
- **Alerta de capacidade**: condição persistente com evidências, severidade, ciclo de vida, recomendação e controle anti-spam.
- **Fonte de medição**: host, processos, sessões, histórico, provedor ou valor manual, com horário, estado e erro localizado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa administradora identifica estado, gargalo, headroom e ação recomendada em até 30 segundos após abrir a aba.
- **SC-002**: Em cenários de referência, 100% das decisões exibidas podem ser explicadas pelos valores, política e fontes visíveis na tela.
- **SC-003**: A contagem exibida de bot-workers reais coincide com os processos válidos do host em 100% dos cenários automatizados, sem contar o coletor.
- **SC-004**: Para histórico suficiente, a tela apresenta tendências de 7/30/90 dias, faixa e confiança; para histórico insuficiente ou crescimento não positivo, apresenta 0 datas artificiais de esgotamento.
- **SC-005**: Uma pessoa conclui uma simulação de crescimento e entende margem ou déficit em menos de 1 minuto, sem provocar qualquer alteração operacional.
- **SC-006**: Uma falha isolada de qualquer fonte mantém disponíveis 100% dos dados confiáveis das demais fontes e identifica claramente o que ficou indisponível.
- **SC-007**: Nenhum segredo do provedor aparece em interface, tráfego para o navegador, histórico, auditoria ou erro em todos os testes de segurança.
- **SC-008**: A abertura das demais abas do ADMIN não inicia coleta ou carregamento de Capacidade, e ocultar a aba interrompe sua atualização periódica.
- **SC-009**: Alertas persistentes são detectados em até 10 minutos após cruzarem o limiar e não geram mais de uma notificação por tipo em 24 horas sem piora de severidade.
- **SC-010**: A coleta periódica acrescenta menos de 1% de CPU média e menos de 50 MB de memória ao processo existente durante uma janela de 24 horas sob carga representativa.
- **SC-011**: Mudanças de servidor, staging, deploy e incidentes críticos ficam correlacionáveis com as métricas históricas em 100% dos eventos registrados.
- **SC-012**: A visão atual fica disponível em até 2 segundos para 95% das aberturas quando existe snapshot recente, inclusive se o provedor externo estiver indisponível.

## Assumptions

- A primeira implantação monitora um único host co-localizado, mas os dados não ficam amarrados permanentemente ao nome ou tamanho atual.
- Uma sessão conectada normalmente corresponde a um bot-worker; divergências são observáveis e exigem investigação, não correção automática.
- A referência conservadora inicial é 350 MB por sessão e a reserva mínima é o maior entre 20% da RAM e 1,5 GB, conforme a política operacional vigente.
- Coleta detalhada a cada cinco minutos oferece previsibilidade suficiente sem exigir observação em tempo real por segundo.
- O histórico começa a ser construído após a implantação; não se presume reconstrução perfeita de períodos anteriores.
- Custos ou quotas que o provedor não disponibilize de forma confiável podem ser registrados manualmente, sempre identificados como tal.
- Alertas usam os canais administrativos já disponíveis; criar uma central externa de incidentes não faz parte desta entrega.
- O controle já existente de staging pode ser referenciado pela aba, mas nenhuma nova automação de desligamento é autorizada.
- O fluxo de entrega continua passando por staging antes de produção e qualquer mudança futura de capacidade ou processo exige decisão humana.

## Out of Scope

- Redimensionar, criar, excluir, reiniciar ou desligar servidores pelo ADMIN.
- Reiniciar supervisor, API, workers ou sessões automaticamente em resposta a alertas.
- Substituir uma plataforma completa de monitoramento de infraestrutura ou central de incidentes.
- Monitorar servidores dedicados ou projetos externos não cadastrados nesta primeira entrega.
- Cobrança automática, compra de recursos ou alteração de plano Hetzner.
- Prometer uma quantidade absoluta de clientes sem margem ou sem considerar o comportamento real dos workers.
- Criar um novo processo PM2, daemon ou serviço dedicado de coleta.
