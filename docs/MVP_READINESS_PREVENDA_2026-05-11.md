# 🎯 Análise de Viabilidade Comercial: WABOT

**Data da análise:** 11/05/2026  
**Base analisada:** backlog técnico/QA, issues de readiness MVP, documentação de analytics e auditorias de UX/Design já registradas no repositório.

## Status Atual

**~82% pronto para venda (MVP assistido).**

Leitura executiva:
- O núcleo de valor já existe e está funcional em boa parte do fluxo (captura, processamento e envio), com correções importantes já concluídas.
- Existe base mínima de confiança pública (Termos/Privacidade/Quem Somos/Suporte) e trilha de onboarding inicial implementada.
- O maior risco para abrir vendas hoje não é “falta de produto”, e sim **confiabilidade operacional + previsibilidade de jornada real em produção** (especialmente pontos ainda `open` e itens que exigem reteste manual).

---

## FASE 1 — Análise de Prontidão (Readiness)

### 1) Core Value (valor principal ponta a ponta)

**Diagnóstico:** Parcialmente pronto, com lacunas críticas.

O que já sustenta o valor:
- Fluxo central do bot existe com módulos de sessão WhatsApp, grupos, credenciais e envio.
- Parte dos bugs de qualidade/sanitização já foi tratada (ex.: validações de cadastro e grupos, UX de alguns erros).

Lacunas que podem quebrar entrega de valor no uso real:
- **BUG-020 (`/dashboard/logs` 404 em produção)**: sem logs confiáveis para o usuário, a percepção é de “bot não funciona”, mesmo quando funciona.
- **FEAT-002 (conexão WA desconectado + pareamento por número)**: fricção de setup no ponto mais sensível do produto.
- **FEAT-005 (grupos alvo por grupo monitorado)** e **FEAT-006 (filtros por grupo monitorado)**: limita qualidade de controle operacional para casos reais.
- **16 itens em `reteste-manual`**: risco de regressão/instabilidade em cenários não confirmados em execução fim a fim.

### 2) Jornada de Pagamento/Assinatura

**Diagnóstico:** Estruturalmente pronta para MVP, mas com risco de confiança se não houver reteste operacional completo.

Pontos positivos:
- Fluxo com Mercado Pago já tratado em documentação como pronto para MVP.
- Endurecimento de webhook e clareza de estado de pagamento foram mapeados como concluídos.

Lacunas de risco antes de escalar vendas:
- Necessidade de **reteste manual obrigatório** do funil real (checkout → webhook → ativação → retorno de status em UI).
- Possível desalinhamento entre copy comercial e comportamento em ambiente real se variáveis/env de produção divergirem do esperado.

### 3) Onboarding e Suporte

**Diagnóstico:** Base pronta, porém ainda vulnerável a abandono na ativação inicial.

Pontos positivos:
- Checklist de primeiros passos e suporte/FAQ mínimos foram marcados como concluídos.

Lacunas:
- Itens de UX abertos (como ordem/priorização de ações em Grupos) ainda afetam a curva de aprendizado.
- Sem reteste prático da jornada completa de usuário novo, existe risco de “onboarding que parece bom no código, mas falha no comportamento real”.

### 4) Legal & Confiança

**Diagnóstico:** Mínimo legal presente para MVP.

Pontos positivos:
- Camada pública com páginas essenciais (Termos, Privacidade, Quem Somos, Suporte) foi entregue.

Risco residual:
- Confiança comercial pode ser corroída se operação (logs, status, conexão) estiver inconsistente, mesmo com legal em dia.

### 5) Analytics

**Diagnóstico:** MVP de analytics implementado com boa base de privacidade.

Pontos positivos:
- Eventos principais de funil já definidos e instrumentados (cadastro, login, conexão, checkout, pagamento, 1º sucesso, erro).
- Sanitização de dados sensíveis documentada.

Lacunas:
- Ainda falta disciplina de operação: rotina de leitura dos eventos, painel/consulta frequente e meta de conversão por etapa para tomada de decisão semanal.

---

## FASE 2 — Checklist para Lançamento

## O que é Impeditivo (Blockers)

1. **Fechar todas as pendências P1 abertas que afetam operação/entrega de valor**:
   - BUG-020, FEAT-002, FEAT-005 e detalhamento do BUG-XXX.
2. **Executar sprint de reteste manual dos 16 itens sinalizados** com evidência de resultado.
3. **Garantir estabilidade do fluxo de ativação e observabilidade do cliente** (especialmente logs e status reais).
4. **Validar jornada de pagamento em ambiente equivalente ao de produção** com casos success/pending/failure e webhook assinado.
5. **Definir runbook de suporte inicial (primeiras 2 semanas)** com tempo de resposta e triagem padrão.

## O que é Desejável (Nice-to-have) para v1.1

- Melhorias UX de priorização visual e ergonomia de fluxo (ex.: refinamentos em Grupos).
- Conversores e funcionalidades incrementais não essenciais para validar monetização inicial.
- Expansões avançadas de analytics (dash executivo/A-B testing/automações de CRM).

## Risco de Churn (onde cliente pode desistir)

1. **Ativação técnica inicial** (conectar WhatsApp e entender estado de sessão).
2. **Percepção de “não está funcionando” por ausência/inconsistência de logs**.
3. **Pagamento aprovado sem clareza imediata de status ativado**.
4. **Falta de feedback contextual quando algo falha na configuração**.
5. **Primeiro valor demorado** (usuário não chega rápido ao primeiro envio com sucesso).

---

## 📋 Roadmap de Emergência (Pré-venda)

### Top 5 ações imediatas (ordem de prioridade)

1. **War-room de confiabilidade (48h):** corrigir BUG-020 + FEAT-002 e validar sessão/logs ponta a ponta.
2. **Sprint de reteste manual (P0):** executar e documentar os 16 casos `reteste-manual` com resultado binário (pass/fail) e plano de correção.
3. **Hardening de pagamento em staging espelhado de produção:** retestar checkout e webhook com evidências (success/pending/failure).
4. **Playbook de ativação e suporte de lançamento:** script de onboarding assistido, FAQ operacional e mensagens de contingência para pagamento/conexão.
5. **Painel operacional de conversão diário:** consultas padrão de analytics + checklist de decisão (onde houve queda no funil e ação corretiva do dia).

---

## Resumo crítico (buracos que impedem vender hoje)

Se o carrinho abrir hoje, o principal risco não é jurídico nem ausência total de funcionalidades: é **churn precoce por instabilidade percebida**. Em especial:
- pontos operacionais abertos de alta prioridade;
- falta de confirmação prática dos itens marcados como “done” mas ainda sem reteste funcional conclusivo;
- risco de quebra de confiança no momento mais sensível (ativação + pagamento + prova de funcionamento).

**Conclusão executiva:** tecnicamente perto de vender, mas ainda em zona de risco para reputação se abrir tráfego sem a rodada final de estabilização e reteste.
