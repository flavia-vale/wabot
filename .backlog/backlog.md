# Wabot Backlog Técnico

Este arquivo é a fonte única da Central Técnica de Desenvolvimento em `/admin/pipeline`.
Cada tarefa deve manter os delimitadores `START_ISSUE` e `END_ISSUE` para que o parser consiga atualizar apenas o status do bloco.

<!-- START_ISSUE: WABOT-001 -->
### [CHORE] Criar Central Técnica de Desenvolvimento
- **ID:** WABOT-001
- **Tipo:** Chore                  # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** High            # [Low | Medium | High | Critical]
- **Status:** Review              # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** Infra                 # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-02

#### Descrição Técnica
Criar a rota interna `/admin/pipeline` para renderizar um Kanban técnico a partir deste arquivo centralizado.

#### Critérios de Aceite
- [x] Ler `.backlog/backlog.md` no backend administrativo.
- [x] Transformar blocos delimitados em JSON para o frontend.
- [x] Permitir atualizar exclusivamente a linha de status de cada issue.
<!-- END_ISSUE: WABOT-001 -->

---

<!-- START_ISSUE: WABOT-002 -->
### [SECURITY] Validar runbook de mudanças em produção
- **ID:** WABOT-002
- **Tipo:** Security              # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** Critical        # [Low | Medium | High | Critical]
- **Status:** Backlog             # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** Infra                 # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-02

#### Descrição Técnica
Mapear os passos que precisam ser validados em staging antes de qualquer alteração operacional que possa tocar PM2, `.env`, Redis ou banco de produção.

#### Critérios de Aceite
- [ ] Conferir se o runbook cita staging antes de produção.
- [ ] Listar comandos de verificação sem alterar `.env` ou banco.
<!-- END_ISSUE: WABOT-002 -->

---

<!-- START_ISSUE: WABOT-003 -->
### [REFACTOR] Simplificar conversor web de links para fluxo 1:1
- **ID:** WABOT-003
- **Tipo:** Refactor              # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** High            # [Low | Medium | High | Critical]
- **Status:** QA                  # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** UX                    # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-07

#### Descrição Técnica
Simplificar a versão web do conversor de links em `/painel/converte-links`, reduzindo complexidade visual e operacional. A experiência desejada pode ser 1:1 e deve se inspirar no fluxo mobile `/m/op/converter`, preservando o comportamento essencial de conversão sem etapas ou opções desnecessárias.

#### Critérios de Aceite
- [x] Mapear diferenças entre `/painel/converte-links` e `/m/op/converter` antes de implementar.
- [x] Reduzir a interface web para um fluxo simples de entrada de link e resultado convertido.
- [x] Manter validações, mensagens de erro e estados de carregamento necessários.
- [ ] Validar manualmente o fluxo em staging em `http://178.105.54.0:3006/painel/converte-links`.

#### Status de Implementação
- Sucesso: fluxo web simplificado para 1 link por vez, sem montador de oferta avançado.
- Pendente: validação manual em staging na porta 3006.
<!-- END_ISSUE: WABOT-003 -->

---

<!-- START_ISSUE: WABOT-004 -->
### [REFACTOR] Simplificar envio manual removendo segmentação avançada
- **ID:** WABOT-004
- **Tipo:** Refactor              # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** High            # [Low | Medium | High | Critical]
- **Status:** QA                  # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** UX                    # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-07

#### Descrição Técnica
Simplificar as telas de envio manual em `/painel/envio` e `/m/op/broadcast`, removendo as áreas de Smart Segmentador (MVP) e segmentação de destinos. A tela deve focar apenas no conteúdo da mensagem e na seleção direta de destinos.

#### Critérios de Aceite
- [x] Remover/ocultar a seção Smart Segmentador (MVP) das telas de envio.
- [x] Remover/ocultar a segmentação avançada de destinos.
- [x] Exibir somente o campo de mensagem e a seleção de `Destinos`.
- [x] Exibir o texto auxiliar: `Seu grupo de destino não está aqui? Clique aqui para adicionar`.
- [x] Adicionar botão/link para a página de cadastro de grupos de destino.
- [ ] Validar manualmente em staging em `/painel/envio` e `/m/op/broadcast`.

#### Status de Implementação
- Sucesso: telas web e mobile mostram mensagem, destinos diretos e CTA para cadastrar grupo.
- Pendente: validação manual em staging na porta 3006.
<!-- END_ISSUE: WABOT-004 -->

---

<!-- START_ISSUE: WABOT-005 -->
### [BUG] Corrigir identificação de mensagens de oferta automática nos logs
- **ID:** WABOT-005
- **Tipo:** Bug                   # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** High            # [Low | Medium | High | Critical]
- **Status:** QA                  # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** UX                    # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-07

#### Descrição Técnica
Nas páginas de logs `/painel/envios` e `/m/op/logs`, mensagens originadas por oferta automática estão aparecendo como envio manual. Ajustar a origem exibida para diferenciar corretamente ofertas automáticas de envios manuais.

#### Critérios de Aceite
- [x] Identificar no backend/modelo de log qual campo diferencia envio manual de oferta automática.
- [x] Ajustar a renderização da origem nas páginas web e mobile.
- [x] Garantir que envios manuais continuem aparecendo como manuais.
- [x] Garantir que ofertas automáticas apareçam como oferta automática.
- [ ] Validar manualmente em staging em `/painel/envios` e `/m/op/logs`.

#### Status de Implementação
- Sucesso: broadcast de oferta automática grava origem própria e logs web/mobile exibem `Oferta automática`.
- Pendente: validação manual em staging na porta 3006 com envio real de automação.
<!-- END_ISSUE: WABOT-005 -->

---

<!-- START_ISSUE: WABOT-006 -->
### [CHORE] Renomear menu Mensagens para Templates, ganchos e CTA
- **ID:** WABOT-006
- **Tipo:** Chore                 # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** Medium          # [Low | Medium | High | Critical]
- **Status:** QA                  # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** UX                    # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-07

#### Descrição Técnica
Atualizar a nomenclatura do item de navegação que hoje aparece como `Mensagens` para `Templates, ganchos e CTA` no sidebar web e na área mobile/account, mantendo os links atuais para as mesmas páginas.

#### Critérios de Aceite
- [x] Alterar o label no sidebar web relacionado a `/painel/mensagens`.
- [x] Alterar o label em `/m/account`.
- [x] Manter as rotas e permissões existentes sem alteração funcional.
- [ ] Validar visualmente em staging no desktop e mobile.

#### Status de Implementação
- Sucesso: labels atualizados sem mudar rotas.
- Pendente: validação visual manual em staging no desktop e mobile.
<!-- END_ISSUE: WABOT-006 -->

---

<!-- START_ISSUE: WABOT-007 -->
### [REFACTOR] Unificar variáveis de templates com nomes canônicos
- **ID:** WABOT-007
- **Tipo:** Refactor              # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** High            # [Low | Medium | High | Critical]
- **Status:** QA                  # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** UX                    # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-07

#### Descrição Técnica
Estudar todos os pontos onde variáveis de templates são exibidas, montadas, salvas ou interpoladas, pois há divergência de nomenclatura como `greeting` em alguns lugares e `gancho` em outros. Unificar para nomes canônicos em português: `gancho`, `cta` e `convitegrupo`.

#### Critérios de Aceite
- [x] Mapear todas as variáveis usadas na criação, edição, preview e envio de templates.
- [x] Definir compatibilidade/migração para valores legados como `greeting`, se existirem em dados salvos.
- [x] Padronizar a UI para exibir `gancho`, `cta` e `convitegrupo`.
- [x] Padronizar a interpolação para aceitar os nomes canônicos sem quebrar templates existentes.
- [x] Adicionar ou atualizar testes cobrindo interpolação e preview de templates.

#### Status de Implementação
- Sucesso: UI padronizada para `gancho`, `cta` e `convitegrupo`; aliases legados continuam aceitos internamente para compatibilidade.
- Pendente: validação manual de templates reais em staging.
<!-- END_ISSUE: WABOT-007 -->

---

<!-- START_ISSUE: WABOT-008 -->
### [BUG] Corrigir cópia das variáveis na página de templates
- **ID:** WABOT-008
- **Tipo:** Bug                   # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** Medium          # [Low | Medium | High | Critical]
- **Status:** QA                  # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** UX                    # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-07

#### Descrição Técnica
Na página `/painel/mensagens`, as variáveis parecem copiáveis, mas a ação não copia o conteúdo de fato. Ajustar o comportamento para copiar a variável correta para a área de transferência e informar sucesso/erro ao usuário.

#### Critérios de Aceite
- [x] Identificar todos os chips/botões de variável que aparentam ser copiáveis.
- [x] Implementar cópia real via clipboard com fallback seguro quando necessário.
- [x] Exibir feedback visual após copiar com sucesso.
- [x] Exibir feedback de erro quando o navegador bloquear a cópia.
- [ ] Validar manualmente em staging em `/painel/mensagens`.

#### Status de Implementação
- Sucesso: chips de variáveis usam helper real de clipboard com fallback e feedback.
- Pendente: validação manual em navegador real no staging.
<!-- END_ISSUE: WABOT-008 -->

---

<!-- START_ISSUE: WABOT-009 -->
### [CHORE] Remover seção de branding não funcional das configurações
- **ID:** WABOT-009
- **Tipo:** Chore                 # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** Medium          # [Low | Medium | High | Critical]
- **Status:** QA                  # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** UX                    # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-07

#### Descrição Técnica
Remover da página `/painel/configuracoes` a seção de branding que não é mais funcional, evitando que o usuário tente configurar algo sem efeito no produto.

#### Critérios de Aceite
- [x] Localizar a seção de branding em `/painel/configuracoes`.
- [x] Remover a UI e estados relacionados que não tenham efeito funcional.
- [x] Garantir que outras configurações da página continuem funcionando.
- [ ] Validar manualmente em staging em `/painel/configuracoes`.

#### Status de Implementação
- Sucesso: seção visual de branding removida da página de configurações, preservando round-trip interno para não apagar dados existentes.
- Pendente: validação manual em staging na porta 3006.
<!-- END_ISSUE: WABOT-009 -->

---

<!-- START_ISSUE: WABOT-010 -->
### [CHORE] Definir gatilho mensurável de cutover SQLite -> Postgres (destravar P2)
- **ID:** WABOT-010
- **Tipo:** Chore                  # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** High            # [Low | Medium | High | Critical]
- **Status:** Backlog             # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** Infra                 # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-16

#### Descrição Técnica
Origem: auditoria de engenharia (achado C2). O SQLite é hoje o teto estrutural
de escala: `api`, `bot-supervisor`, workers, `snapshot-cron` e o bot do Telegram
escrevem no MESMO arquivo, e o WAL resolve leitura concorrente mas a escrita
segue serial (um writer por vez). O `AGENTS.md` já é uma crônica de combate a
isso (pegadinha #8: `prisma migrate deploy` quebrando com `SQLITE_BUSY`; WAL +
`busy_timeout` aplicados em todo boot).

A migração para Postgres NÃO é uma decisão em aberto — já existe o épico **P2**
scaffoldado (`docs/p2-p3-technical-plan.md`, `prisma/schema.postgres.prisma`,
`scripts/p2_1..p2_4_*`). O problema é que P2.1/P2.2/P2.4 estão parados em
"parcial/planejado" sem **critério objetivo** que dispare a execução. Esta issue
NÃO reimplementa o P2: ela define o gatilho e a evidência que promovem o P2 de
"parcial" para "executado em staging -> prod", evitando que o cutover seja
decidido por um incidente em produção em vez de por um limiar planejado.

#### Critérios de Aceite
- [ ] Definir 3-4 gatilhos mensuráveis e instrumentados (ex.: ocorrências de
      `SQLITE_BUSY`/semana fora de janela de deploy > 0; nº de sessões WhatsApp
      simultâneas acima de um teto; latência p99 de escrita em `MessageLog`).
- [ ] Adicionar coleta/alerta desses sinais (reusar `AnalyticsEvent`/healthcheck
      existentes) para que o gatilho seja observável, não subjetivo.
- [ ] Executar `scripts/p2_2_staging_data_consistency_check.sh` em staging com
      `STRICT=1` e anexar evidência (`CONSISTENCY=OK`) ao P2.2.
- [ ] Documentar e testar o runbook de rollback de cutover ANTES de qualquer
      promoção (gate obrigatório do P2.4 / `p2_4_prod_cutover_guard.sh`).
- [ ] Decisão registrada com a usuária: confirmar o teto de cada gatilho e a
      ordem feature -> develop -> main para o cutover.

#### Status de Implementação
- Pendente: somente registro de demanda (triagem). Nenhuma mudança de código
  ou infra executada nesta issue.
<!-- END_ISSUE: WABOT-010 -->

---
