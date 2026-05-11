# Relatório de Auditoria e Execução — Fase 1 (Grupo C)

Data: 11/05/2026  
Escopo: auditoria estática de Segurança, Pagamentos, Infra, LGPD e Dependências (sem implementação).

## Segurança (SEC)
- **SEC-001 (senha fallback)**: **CONFIRMADO EM ABERTO** — fluxo legado de fallback ainda é referenciado em `/register` com log de uso.
- **SEC-002 (telefone sintético no promo)**: **CONFIRMADO EM ABERTO** — não há evidência de validação anti-sintético robusta neste recorte.
- **SEC-003 (MFA admin obrigatório)**: **JÁ EXISTENTE — FEITO (PARCIAL)** — há validação de MFA para ações administrativas sensíveis; requer reteste funcional de cobertura.
- **SEC-004 (bootstrap admin por email)**: **CONFIRMADO EM ABERTO** — mecanismo de bootstrap por e-mail ainda existe e amplia superfície.
- **SEC-005 (rate limit/lockout login)**: **CONFIRMADO EM ABERTO** — não há evidência direta de lockout/rate-limit dedicado no login neste recorte.
- **SEC-006 (rotação/revogação JWT)**: **JÁ EXISTENTE — FEITO (PARCIAL)** — existe lista de revogação em memória e revogação no logout; falta evidência de estratégia robusta multi-instância.
- **SEC-007 (exposição de PII por papéis)**: **CONFIRMADO EM ABERTO** — exige avaliação de minimização/escopo por endpoint.

## Pagamentos (PAY)
- **PAY-001 (payload bruto webhook)**: **CONFIRMADO EM ABERTO** — persistência de `payload` integral em eventos.
- **PAY-002 (inferência de plano por valor)**: **CONFIRMADO EM ABERTO** — risco depende de lógica detalhada de reconciliação e regras de negócio.
- **PAY-003 (reprocessamento sem step-up auth)**: **CONFIRMADO EM ABERTO** — endpoint autenticado, mas sem evidência de MFA/step-up específico.
- **PAY-004 (segurança webhook dependente de env)**: **JÁ EXISTENTE — FEITO (PARCIAL)** — há fail-safe para ausência de `MP_WEBHOOK_SECRET` em produção; ainda depende de configuração correta.
- **PAY-005 (`processingResult` excessivo)**: **CONFIRMADO EM ABERTO** — campo persiste sumário/detalhes serializados.

## Infra (INFRA)
- **INFRA-001 (HTTP em produção)**: **CONFIRMADO EM ABERTO** — presença de fallbacks HTTP e risco de configuração divergente.
- **INFRA-002 (HSTS condicional)**: **CONFIRMADO EM ABERTO** — envio de HSTS condicionado ao protocolo percebido na app.
- **INFRA-003 (0.0.0.0 sem borda explícita)**: **CONFIRMADO EM ABERTO** — precisa evidência de restrição no proxy/borda.
- **INFRA-004 (CORS por variável única/IP)**: **CONFIRMADO EM ABERTO** — configuração depende de allowlist textual (`CORS_ORIGINS`).
- **INFRA-005 (cookie SameSite/Lax/domain)**: **CONFIRMADO EM ABERTO** — cookie sem domínio explícito e `SameSite=Lax`.

## LGPD (LGPD)
- **LGPD-001 (retenção extensa messageText)**: **CONFIRMADO EM ABERTO** — logs persistem `messageText` e metadados de origem/destino.
- **LGPD-002 (consentimento analytics)**: **CONFIRMADO EM ABERTO** — sem evidência clara de controle de consentimento por finalidade no recorte.
- **LGPD-003 (retenção por categoria)**: **CONFIRMADO EM ABERTO** — política de retenção não está explicitada no código revisado.
- **LGPD-004 (logout sem revogação server-side)**: **JÁ EXISTENTE — FEITO (PARCIAL)** — logout tenta revogar `jti`; precisa reteste em cenários distribuídos.
- **LGPD-005 (dados de saúde operacional)**: **CONFIRMADO EM ABERTO** — exposição depende de RBAC e minimização por tela/API.

## Dependências (DEP)
- **DEP-001 (auditoria automatizada de CVE indisponível)**: **CONFIRMADO EM ABERTO** — histórico documenta falha de `npm audit` no ambiente.
- **DEP-002 (env npm http-proxy ambíguo)**: **CONFIRMADO EM ABERTO** — pendência operacional de padronização.
- **DEP-003 (landing sem lockfile)**: **CONFIRMADO EM ABERTO** — ausência de `landing/package-lock.json`.

---

## Consolidado Grupo C
- FEITO (parcial, com reteste necessário): **4** (SEC-003, SEC-006, PAY-004, LGPD-004)
- CONFIRMADO EM ABERTO: **21**

## Próximo passo recomendado (Execução Cirúrgica)
1. Prioridade máxima: SEC-001, SEC-004, SEC-005, PAY-001, INFRA-001, LGPD-001.
2. Abrir plano de correção em staging com critério de aceite técnico por item.
3. Incluir blindagem anti-regressão (testes + validações de boot/config) para cada correção sensível.
