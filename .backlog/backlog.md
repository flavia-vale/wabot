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
