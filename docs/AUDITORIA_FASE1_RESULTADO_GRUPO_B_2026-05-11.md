# Relatório de Auditoria e Execução — Fase 1 (Grupo B)

Data: 11/05/2026  
Escopo: auditoria de necessidade (sem implementação) para itens abertos de produto/UX.

## UX-008 — Card “Carregar grupos existentes” primeiro
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: no fluxo de `Grupos`, o bloco “Carregar grupos existentes” aparece antes de “Monitorar” e “Postar”.
- Status Final: **FEITO**

## UX-009 — Ocultar “Adicionar manualmente”
- Status da Verificação: **CONFIRMADO EM ABERTO**
- Evidência: a tela ainda possui `handleManualAdd`, estado `manualForm` e validação de JID manual.
- Ações Tomadas: sem alteração de código.
- Blindagem: sugerido remover formulário manual e handlers associados em patch dedicado.
- Status Final: **PENDENTE**

## UX-007 — item aberto sem evidência consolidada neste recorte
- Status da Verificação: **CONFIRMADO EM ABERTO (TRIAGEM NECESSÁRIA)**
- Evidência: não foi identificado no recorte atual documentação técnica suficiente para fechamento automático.
- Ações Tomadas: sem alteração de código.
- Blindagem: detalhar critério de aceite da issue antes de implementar.
- Status Final: **PENDENTE**

## BUG-020 — `/dashboard/logs` 404 em produção
- Status da Verificação: **CONFIRMADO EM ABERTO (RETESTE EM STAGING/PROD NECESSÁRIO)**
- Evidência: a página existe no código (`dashboard/app/dashboard/logs/page.js`), mas a issue é de comportamento em produção; precisa prova funcional no ambiente alvo.
- Ações Tomadas: sem alteração de código.
- Blindagem: checklist de deploy + smoke test de rota após restart.
- Status Final: **PENDENTE DE RETESTE**

## FEAT-002 — Conexão WhatsApp (desconectado + pareamento por número)
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO (PARCIAL VALIDADO)**
- Evidência: rota `/pairing-code` no backend e UI com fluxo de telefone/código no dashboard.
- Observação: ainda requer reteste funcional de estabilidade.
- Status Final: **FEITO (com reteste recomendado)**

## FEAT-004 — Conversor AliExpress
- Status da Verificação: **CONFIRMADO EM ABERTO**
- Evidência: não foi encontrada implementação explícita de conversor AliExpress no recorte de conversores.
- Ações Tomadas: sem alteração de código.
- Blindagem: adicionar suite de testes específica para novo conversor quando implementar.
- Status Final: **PENDENTE**

## FEAT-005 — Grupos alvo por grupo monitorado
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: UI de grupos já exibe ação “Configurar alvos” por grupo monitorado.
- Status Final: **FEITO**

## FEAT-006 — Filtros por grupo monitorado
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: tela de grupos possui campos de filtros por grupo (palavras bloqueadas e plataformas permitidas).
- Status Final: **FEITO**

## FEAT-007 — Welcome message por grupo de disparo
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: campo `welcomeMsg` por grupo de postagem na UI.
- Status Final: **FEITO**

## FEAT-008 — Toast notifications no dashboard
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: `ToastProvider` e uso de `useToast` em páginas do dashboard.
- Status Final: **FEITO**

## FEAT-009 — Modal de confirmação customizado
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: componente reutilizável `ConfirmDialog` em múltiplos fluxos críticos.
- Status Final: **FEITO**

## FEAT-010 — Instruções inline em credenciais
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: página de credenciais com instruções, tutorial e alertas contextuais.
- Status Final: **FEITO**

## FEAT-011 — Feed Global
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: `feedGlobal` presente em configuração backend e frontend.
- Status Final: **FEITO**

## FEAT-012 — Postar no Status do WhatsApp
- Status da Verificação: **JÁ EXISTENTE — MARCADO COMO FEITO**
- Evidência: `postToStatus` presente em configuração backend e frontend.
- Status Final: **FEITO**

## BUG-XXX — placeholder sem definição
- Status da Verificação: **CONFIRMADO EM ABERTO (TRIAGEM OBRIGATÓRIA)**
- Evidência: issue sem descrição completa/critério de aceite.
- Ações Tomadas: sem alteração de código.
- Blindagem: bloquear implementação até detalhamento.
- Status Final: **PENDENTE**

---

## Consolidado Grupo B
- FEITO (por evidência estática): **10**
- PENDENTE: **5** (UX-009, UX-007, BUG-020, FEAT-004, BUG-XXX)

## Próximo passo recomendado
1. Rodar retestes manuais em staging para BUG-020 e FEAT-002.
2. Abrir patch cirúrgico para UX-009.
3. Detalhar UX-007 e BUG-XXX antes de qualquer implementação.
