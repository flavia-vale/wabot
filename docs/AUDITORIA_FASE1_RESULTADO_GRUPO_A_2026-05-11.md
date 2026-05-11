# Relatório de Auditoria e Execução — Fase 1 (Grupo A)

Data: 11/05/2026
Escopo: validação de necessidade (sem implementação), com foco em confirmar itens já entregues.

## 1) BUG-002 — senha mínima no registro
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: validação explícita `password.length < 8` no registro e mensagem de erro correspondente.
- Status Final: **FEITO**

## 2) UX-001 — normalização de email
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: normalização centralizada em `normalizeEmail` usando `trim().toLowerCase()`.
- Status Final: **FEITO**

## 3) BUG-009 — comparação de delay numérica
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: parse e validação numérica de `delayMin`/`delayMax` no frontend e backend.
- Status Final: **FEITO**

## 4) BUG-010 — range `delayMin/delayMax`
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: bloqueio backend quando `delayMin > delayMax`.
- Status Final: **FEITO**

## 5) BUG-012 — parse de `targetJids` no GET /scheduled
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: resposta do endpoint de agendados faz `JSON.parse` em `targetJids`.
- Status Final: **FEITO**

## 6) UX-004 — confirmação antes de cancelar/remover
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: componente `ConfirmDialog` em fluxos críticos de exclusão/envio.
- Status Final: **FEITO**

## 7) BUG-019 — encerramento de WS após conexão
- Status da Verificação: **CONFIRMADO EM ABERTO (RETESTE MANUAL NECESSÁRIO)**
- Evidência: não há evidência direta nesta varredura estática que prove o comportamento runtime de encerramento pós-conexão.
- Ações Tomadas: apenas auditoria estática; sem alteração de código.
- Blindagem: pendente de teste funcional com sessão real no staging (porta 3006 + API 3004).
- Status Final: **PENDENTE DE RETESTE**

## 8) UX-006 — `<html lang="pt-BR">`
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: atributo `lang` já definido no app.
- Status Final: **FEITO**

## 9) BUG-011 — feedback de erro em configurações
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: mensagens de erro e validação no fluxo de configurações.
- Status Final: **FEITO**

## 10) BUG-005 — validação com trim em grupos
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: normalização de `waJid` e `name` com `trim` antes de validar.
- Status Final: **FEITO**

## 11) BUG-006 — erros de operações de grupos no frontend
- Status da Verificação: **CONFIRMADO EM ABERTO (RETESTE MANUAL NECESSÁRIO)**
- Evidência: há tratamento de erro em UI, mas confirmação de cobertura completa exige prova funcional em cenários de falha.
- Ações Tomadas: apenas auditoria estática; sem alteração de código.
- Blindagem: pendente suíte de testes de interface/fluxo de erro em staging.
- Status Final: **PENDENTE DE RETESTE**

## 12) BUG-008 — obrigatórios em credenciais
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: backend valida campos obrigatórios por plataforma e frontend reforça campos pendentes.
- Status Final: **FEITO**

---

## Consolidado Grupo A
- FEITO por evidência estática: **10/12**
- Pendente de reteste funcional (staging): **2/12** (BUG-019, BUG-006)

## Próximo passo recomendado
Executar Fase 1 do Grupo B (itens abertos de produto/UX) e, em paralelo, abrir checklist de reteste manual para os 2 itens acima em ambiente staging.
