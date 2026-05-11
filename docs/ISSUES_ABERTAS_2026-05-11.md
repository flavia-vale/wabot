# Issues abertas — snapshot em 11/05/2026

Fonte: `BACKLOG.md` (status `open`).

## Resumo

- Total de issues abertas: **27**

## Lista completa

| ID | Título | Prioridade |
|---|---|---|
| FEAT-008 | Toast notifications no dashboard | baixa |
| BUG-XXX | Título curto | alta |
| SEC-001 | Cadastro permite senha fallback automática | crítica |
| SEC-002 | Fluxo promocional aceita telefone sintético | alta |
| SEC-003 | Área administrativa sem MFA obrigatório | crítica |
| SEC-004 | Bootstrap admin por email aumenta superfície de privilégio | alta |
| SEC-005 | Login sem controles claros de rate limit/lockout | alta |
| SEC-006 | Sessão JWT sem estratégia explícita de rotação/revogação | média |
| SEC-007 | Exposição de PII ainda ampla para alguns papéis | média |
| PAY-001 | Persistência de payload bruto de webhook sem minimização | alta |
| PAY-002 | Inferência de plano por valor pode gerar classificação incorreta | alta |
| PAY-003 | Reprocessamento manual de webhooks sem step-up auth | média |
| PAY-004 | Segurança do webhook depende de configuração de ambiente | média |
| PAY-005 | `processingResult` pode armazenar detalhes excessivos | média |
| INFRA-001 | URLs de produção configuradas em HTTP | crítica |
| INFRA-002 | HSTS condicionado ao protocolo detectado no app | alta |
| INFRA-003 | API ouvindo em 0.0.0.0 sem evidência de restrição de borda no repositório | média |
| INFRA-004 | Política de CORS depende de variável única e allowlist com IP bruto | média |
| INFRA-005 | Cookie de sessão sem política explícita de domínio e com SameSite=Lax | média |
| LGPD-001 | Coleta e retenção extensa de conteúdo de mensagens | alta |
| LGPD-002 | Base legal e consentimento não evidenciados no fluxo de analytics | alta |
| LGPD-003 | Retenção de trilhas administrativas sem política explícita por categoria | média |
| LGPD-004 | Logout não força revogação server-side de sessão | média |
| LGPD-005 | Exposição de dados de saúde operacional com potencial de inteligência interna | média |
| DEP-001 | Auditoria automatizada de vulnerabilidades indisponível no ambiente atual | alta |
| DEP-002 | Configuração de ambiente com aviso de `http-proxy` desconhecido no npm | média |
| DEP-003 | Projeto `landing` sem lockfile para rastreabilidade reprodutível | média |

## Observação de consistência

O arquivo `BACKLOG_ATUALIZADO_QA.md` cita 15 itens `open-validado`, enquanto este snapshot de `BACKLOG.md` retorna 27 `open`. Isso indica backlog em camadas diferentes (produto x segurança/infra/compliance) e precisa de consolidação em uma fonte única de verdade antes de planejar sprint.
