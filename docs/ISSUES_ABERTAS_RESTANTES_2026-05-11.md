# Lista consolidada — issues ainda em aberto (11/05/2026)

Critério: consolidado após auditoria Fase 1 (Grupos A/B/C) + execução pontual em auth.

## A) Abertas por reteste obrigatório (já há evidência parcial de implementação)

1. BUG-019 — encerramento de WS pós-conexão (reteste funcional)
2. BUG-006 — cobertura de erros de operações de grupos (reteste funcional)
3. BUG-020 — `/dashboard/logs` 404 em produção (reteste em ambiente alvo)
4. FEAT-002 — pareamento por número e estabilidade de conexão (reteste funcional)
5. SEC-003 — MFA admin (cobertura funcional completa)
6. SEC-006 — revogação/rotação JWT em cenário multi-instância
7. PAY-004 — segurança de webhook dependente de configuração de ambiente
8. LGPD-004 — revogação efetiva de sessão após logout em cenários distribuídos
9. SEC-001 — senha fallback no cadastro **(corrigida em código; pendente validação final/fechamento de backlog)**

## B) Abertas confirmadas (pendência real de implementação/triagem)

10. UX-009 — ocultar card/formulário de adição manual de grupos
11. UX-007 — item aberto sem critério técnico consolidado
12. FEAT-004 — conversor AliExpress
13. BUG-XXX — placeholder sem definição
14. SEC-002 — fluxo promo aceita telefone sintético
15. SEC-004 — bootstrap admin por email
16. SEC-005 — rate limit/lockout de login
17. SEC-007 — exposição de PII por papéis
18. PAY-001 — payload bruto de webhook sem minimização
19. PAY-002 — inferência de plano por valor
20. PAY-003 — reprocessamento de webhook sem step-up auth
21. PAY-005 — `processingResult` com detalhes excessivos
22. INFRA-001 — URLs/fallbacks HTTP em produção
23. INFRA-002 — HSTS condicional
24. INFRA-003 — bind/restrição de borda não comprovados
25. INFRA-004 — CORS por configuração textual única
26. INFRA-005 — cookie sem domínio explícito e `SameSite=Lax`
27. LGPD-001 — retenção extensa de `messageText`
28. LGPD-002 — consentimento analytics por finalidade
29. LGPD-003 — política de retenção por categoria
30. LGPD-005 — exposição de dados de saúde operacional
31. DEP-001 — `npm audit` indisponível no ambiente
32. DEP-002 — `http-proxy` legado no npm env
33. DEP-003 — `landing` sem lockfile

## Resumo executivo
- Total ainda em aberto: **33**
- Em reteste obrigatório: **9**
- Confirmadas pendentes: **24**

## Prioridade de execução recomendada (curto prazo)
1. SEC-004, SEC-005, PAY-001, INFRA-001, LGPD-001
2. BUG-020, FEAT-004, UX-009
3. DEP-001/DEP-003 para blindagem de pipeline
