# Auditoria Fase 1 — Lista inicial de suspeitas (11/05/2026)

Objetivo: separar o que **provavelmente já está feito** do que **provavelmente ainda precisa de correção**, antes de qualquer implementação.

## Grupo A — Suspeitas de JÁ FEITO (priorizar validação por evidência no código)

Base: itens `done-validado` em `BACKLOG_ATUALIZADO_QA.md`.

1. BUG-002 — senha mínima validada no registro
2. UX-001 — normalização de email com `toLowerCase`
3. BUG-009 — comparação de delay convertida para número
4. BUG-010 — validação de range `delayMin/delayMax`
5. BUG-012 — `targetJids` parseado no `GET /scheduled`
6. UX-004 — confirmação antes de cancelar agendamento
7. BUG-019 — encerramento de WS após conexão
8. UX-006 — `<html lang="pt-BR">` no app
9. BUG-011 — fluxo de erro com feedback em configurações
10. BUG-005 — validação com `trim` no cadastro de grupos
11. BUG-006 — erros de operações de grupos no frontend
12. BUG-008 — validação de obrigatórios em credenciais

## Grupo B — Suspeitas de PRECISA CORREÇÃO (confirmadas abertas)

Base: `open-validado` em `BACKLOG_ATUALIZADO_QA.md`.

1. UX-008
2. UX-009
3. UX-007
4. BUG-020
5. FEAT-002
6. FEAT-004
7. FEAT-005
8. FEAT-006
9. FEAT-007
10. FEAT-008
11. FEAT-009
12. FEAT-010
13. FEAT-011
14. FEAT-012
15. BUG-XXX

## Grupo C — Suspeitas de risco alto (abertas em backlog de segurança/infra/compliance)

Base: `BACKLOG.md` com status `open`.

1. SEC-001
2. SEC-002
3. SEC-003
4. SEC-004
5. SEC-005
6. SEC-006
7. SEC-007
8. PAY-001
9. PAY-002
10. PAY-003
11. PAY-004
12. PAY-005
13. INFRA-001
14. INFRA-002
15. INFRA-003
16. INFRA-004
17. INFRA-005
18. LGPD-001
19. LGPD-002
20. LGPD-003
21. LGPD-004
22. LGPD-005
23. DEP-001
24. DEP-002
25. DEP-003

## Observação para execução

A ordem recomendada de auditoria Fase 1 é:
1) Grupo A (provar FEITO e limpar backlog),
2) Grupo B (produto/UX),
3) Grupo C (segurança, pagamento, infra e LGPD).
