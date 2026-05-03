# Backlog atualizado após revisão de QA (maio/2026)

## Método de validação

Revisão completa do `BACKLOG.md` com foco em:
1. Conferência de **todas as issues `open`** (se ainda não estão implementadas).
2. Conferência de **todas as issues `done`** (se há evidência de correção no código atual).

> Nota: esta rodada foi uma **validação técnica por inspeção de código** no repositório local. Itens que dependem de comportamento em produção/integrações externas foram marcados como **`reteste-manual`**.

## Resultado consolidado

- **Total revisado:** 43 issues
- **Confirmadas como resolvidas (`done-validado`):** 12
- **Confirmadas como ainda pendentes (`open-validado`):** 15
- **Necessitam reteste funcional/manual (`reteste-manual`):** 16

---

## 1) Issues abertas — status validado

Todas as 15 issues abertas continuam pendentes no código atual.

### `open-validado` (continuam no backlog)
- UX-008
- UX-009
- UX-007
- BUG-020 *(produção: manter alta prioridade)*
- FEAT-002
- FEAT-004
- FEAT-005
- FEAT-006
- FEAT-007
- FEAT-008
- FEAT-009
- FEAT-010
- FEAT-011
- FEAT-012
- BUG-XXX *(placeholder, precisa detalhamento)*

---

## 2) Issues marcadas como done — revalidação

### `done-validado` (evidência direta no código)
- BUG-002 — senha mínima validada no registro.
- UX-001 — email normalizado com `toLowerCase()` em registro/login.
- BUG-009 — comparação de delay convertida para número no frontend.
- BUG-010 — validação de range `delayMin/delayMax` no backend.
- BUG-012 — `targetJids` parseado no `GET /scheduled`.
- UX-004 — confirmação antes de cancelar agendamento.
- BUG-019 — encerramento de WS após conexão.
- UX-006 — `<html lang="pt-BR">` no app.
- BUG-011 — fluxo de erro com feedback em configurações.
- BUG-005 — validação com `trim` no cadastro de grupos.
- BUG-006 — erros de operações de grupos exibidos no frontend.
- BUG-008 — validação de obrigatórios em credenciais por plataforma.

### `reteste-manual` (marcadas done, mas exigem teste funcional para garantir)
- BUG-001
- BUG-003
- BUG-004
- UX-002
- UX-003
- BUG-007
- BUG-013
- UX-005
- BUG-014
- BUG-015
- BUG-016
- BUG-017
- BUG-018
- SEC-001
- FEAT-001
- FEAT-003

---

## 3) Novo backlog priorizado (atualizado)

### Prioridade P1 (execução imediata)
1. BUG-020
2. FEAT-002
3. FEAT-005
4. BUG-XXX *(detalhar antes de estimar)*

### Prioridade P2 (alto impacto UX/adoção)
1. UX-008
2. UX-009
3. FEAT-004
4. FEAT-006
5. FEAT-010

### Prioridade P3 (incrementais)
1. UX-007
2. FEAT-007
3. FEAT-008
4. FEAT-009
5. FEAT-011
6. FEAT-012

---

## 4) Ações recomendadas

1. Criar uma sprint de **reteste-manual** para as 16 issues acima (principalmente segurança, webhook, sessão WA e produção).
2. Quebrar BUG-XXX em issue real com reprodução, impacto e critério de aceite.
3. Após reteste, atualizar `BACKLOG.md` com um novo status sugerido: `validated-done` / `validated-open`.
