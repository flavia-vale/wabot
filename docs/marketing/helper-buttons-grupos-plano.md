# Backlog de Implementação — Botões Helper na aba **GRUPOS**

## Classificação da demanda
**[DESENVOLVIMENTO]** com objetivo de execução: transformar o plano UX/marketing em issues técnicas prontas para sprint.

## Protocolo STRICT (análise antes de executar)
1. **Erros fatais:** mudanças propostas são front-end e telemetria; sem risco de loop/leak se escopo seguir as issues.
2. **Breaking changes:** não alterar contratos de API nesta fase; só consumir endpoints existentes.
3. **Efeito cascata:** impacto em navegação da aba GRUPOS e métricas de funil; rollout gradual.
4. **Isolamento de ambiente:** validar primeiro em `develop` + staging `http://178.105.54.0:3006`.
5. **Bloqueio:** se qualquer issue exigir mudança de contrato/API/schema, pausar e abrir issue separada para staging first.

---

## Visão de entrega
Objetivo: deixar a aba GRUPOS **mais amigável para pessoas com pouca familiaridade com tecnologia**, com próximo passo claro, mensagens humanas e recuperação simples de erro.

Definição de pronto macro:
- Usuário iniciante consegue criar grupo, gerar link e ativar automação sem ajuda externa.
- Cada erro crítico tem botão de correção imediata.
- Funil medido por eventos até `group_ready`.

---

## Épico

## EPIC-HELPERS-GRUPOS-01
**Título:** Jornada assistida da aba GRUPOS para usuário não técnico.

**Resultado esperado:** aumentar `% group_ready em 24h` para perfil iniciante.

**Métrica norte:** `group_ready` em até 24h após primeiro acesso na aba GRUPOS.

---

## Issues (prontas para GitHub)

## ISSUE 1 — Helper Mestre (topo com próximo passo)
**Tipo:** Front-end (dashboard)

**User story**
Como usuário iniciante, quero ver apenas o próximo passo principal para não ficar perdido.

**Escopo técnico**
- Criar componente de helper fixo no topo da aba GRUPOS.
- Exibir CTA principal dinâmico conforme estado do usuário:
  - `Criar meu primeiro grupo`
  - `Conectar WhatsApp`
  - `Gerar meu link`
- Exibir CTA secundário discreto: `Ver tutorial rápido (30s)`.

**Critérios de aceite**
- Apenas **1 CTA principal** visível por estado.
- Texto curto e sem termos técnicos.
- Comportamento responsivo mobile/desktop.

**Riscos**
- Poluição visual se competir com header atual.

**Teste em staging (3006)**
- Usuário novo acessa GRUPOS e identifica o próximo passo em até 5 segundos.

---

## ISSUE 2 — Empty states guiados (3 estados oficiais)
**Tipo:** Front-end + UX copy

**User story**
Como usuário não técnico, quero mensagens claras no estado vazio para saber exatamente o que fazer.

**Escopo técnico**
- Implementar 3 empty states:
  1. sem grupo (`Criar grupo agora`)
  2. grupo sem link (`Gerar meu link`)
  3. link pronto sem automação (`Ativar automação`)
- Incluir indicador de progresso por passo (1/3, 2/3, 3/3).

**Critérios de aceite**
- Cada estado possui 1 título, 1 subtexto e 1 CTA principal.
- Sem jargão técnico.

**Riscos**
- Regressão de layout em telas pequenas.

**Teste em staging (3006)**
- QA percorre os 3 estados e confirma ação esperada em cada um.

---

## ISSUE 3 — Tratamento de erro com CTA de resgate
**Tipo:** Front-end + mensagens de erro

**User story**
Como usuário iniciante, quando algo falhar quero um botão para resolver sem chamar suporte.

**Escopo técnico**
- Mapear erros frequentes da aba GRUPOS:
  - sessão desconectada
  - falta de permissão
  - falha transitória de envio
- Para cada erro, exibir mensagem humana + CTA:
  - `Reconectar`
  - `Como corrigir`
  - `Tentar novamente`

**Critérios de aceite**
- Nenhuma mensagem expõe termo técnico bruto (ex.: “erro 500”).
- Todo erro recuperável possui ação imediata.

**Riscos**
- Divergência entre códigos reais de erro e mapeamento de mensagem.

**Teste em staging (3006)**
- Simular 3 erros e validar taxa de recuperação sem refresh manual.

---

## ISSUE 4 — Quick actions no card de grupo
**Tipo:** Front-end interação

**User story**
Como operador, quero executar ações comuns com poucos cliques.

**Escopo técnico**
- Adicionar ações rápidas no card:
  - `Copiar link`
  - `Duplicar este grupo`
  - `Pausar`
  - `Retomar`
- Exibir feedback imediato de sucesso (toast/snackbar).

**Critérios de aceite**
- Botões com ícone + texto.
- Área de clique adequada para touch.
- Feedback visual em até 500ms após ação.

**Riscos**
- Excesso de ações no card pode confundir iniciante.

**Teste em staging (3006)**
- Usuário realiza as 4 ações sem abrir telas adicionais.

---

## ISSUE 5 — Instrumentação de analytics do funil GRUPOS
**Tipo:** Front-end tracking

**User story**
Como time de produto, quero medir o funil para comprovar impacto dos helpers.

**Escopo técnico**
Implementar eventos:
- `groups_helper_master_viewed`
- `groups_helper_master_clicked`
- `groups_empty_state_viewed`
- `groups_empty_state_cta_clicked`
- `groups_error_rescue_clicked`
- `groups_quick_action_clicked`
- `group_setup_step_completed`
- `group_ready`

Com propriedades mínimas:
- `user_profile`
- `step_name`
- `cta_label`
- `error_type`
- `time_to_next_step_seconds`

**Critérios de aceite**
- Eventos disparam 1x por interação esperada (sem duplicidade).
- Payload validado no ambiente de staging.

**Riscos**
- Ruído de evento prejudicar leitura do experimento.

**Teste em staging (3006)**
- Validar trilha completa de eventos do primeiro acesso até `group_ready`.

---

## ISSUE 6 — A/B test (controle vs helpers)
**Tipo:** Experimento produto

**User story**
Como squad, quero comparar experiência atual vs assistida para validar ganho real.

**Escopo técnico**
- Controle: experiência atual.
- Variante A: Helper Mestre + Empty states + erros com CTA de resgate.
- Duração mínima: 14 dias (ou N estatístico definido por analytics).

**Critérios de aceite**
- Dashboard de experimento com métrica primária: `% group_ready em 24h`.
- Corte por perfil iniciante.

**Riscos**
- Volume insuficiente para significância.

**Teste em staging (3006)**
- QA valida regras de elegibilidade e consistência da variante.

---

## Ordem sugerida de sprint
1. ISSUE 1
2. ISSUE 2
3. ISSUE 3
4. ISSUE 5
5. ISSUE 4
6. ISSUE 6

Motivo: primeiro clareza de jornada, depois recuperação de erro, depois medição e otimização.

---

## Definição de pronto por release (develop -> staging)
- [ ] Sem breaking change de API.
- [ ] Fluxo completo validado em `http://178.105.54.0:3006`.
- [ ] 3 testes com usuários não técnicos executados.
- [ ] Evidências (prints + eventos) anexadas na PR para `develop`.
- [ ] Plano de rollback de UI documentado (feature flag ou toggle).
