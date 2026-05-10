# Auditoria Crítica de Observabilidade (Admin + CS)

## Escopo analisado
- `app/admin/page.js`
- `app/admin/sucesso-cliente/page.js`

## 1) Inventário do que existe hoje (e o que isso permite decidir)

### Admin (`/admin`)
**Elementos atuais relevantes:**
- Cards de estatísticas com volume total, ativos, receita 30d, envios 24h, erros 24h e taxa de sucesso 24h.
- Filtros de risco (`stale`, `missing_phone`, `expiring_soon`, `missing_credentials`, etc.).
- Tabela/lista de clientes com `riskFlags` e drill-down por cliente.
- Drill-down com LTV, estado do bot, WhatsApp, erros 24h, pagamentos recentes e últimos logs.

**Leitura crítica:**
- Bom nível de detalhe operacional por cliente, mas pouca visão temporal para detectar tendência (ex.: queda gradual de sucesso antes de virar incidente).
- KPIs financeiros e operacionais aparecem juntos, porém sem “estado do sistema” explícito (Bom/Neutro/Crítico) em 5 segundos.
- Forte dependência de tabela: alto esforço cognitivo para identificar prioridades sistêmicas.

### Sucesso do Cliente (`/admin/sucesso-cliente`)
**Elementos atuais relevantes:**
- Cards: total, churn risk 3d/7d, ativos/expirados.
- Fila priorizada por vencimento.
- Tabela com operação (bot/WA/grupos), atividade, “já enviou?”, riscos, validade e ação de contato.
- Drill-down e ajuste manual de validade.

**Leitura crítica:**
- Excelente base para playbook de CS tático (contato 1:1), mas ainda reativa.
- “Health Score” existe no rótulo, mas não existe score composto real.
- Falta medição explícita de Time to Value e churn silencioso (queda de uso sem cancelamento).

## 2) Pontos cegos que podem estar gerando perda de receita

1. **Sem tendência minuto/hora para receita e sucesso de envio**
   - Existe fotografia 24h/30d, mas não há curva para detectar degradação precoce.
2. **Churn silencioso submedido**
   - Hoje a priorização favorece vencimento/risco explícito; usuários que ainda pagam e reduziram uso podem passar despercebidos.
3. **Sem correlação unificada erro técnico x risco financeiro**
   - Logs e pagamentos aparecem no drill-down, porém não há score/alerta que combine “cliente pagante + WA desconectado + erro alto”.
4. **Sem semáforo de incidentes de negócio**
   - Não há gatilho visual global para “agir agora” (ex.: QR code failure rate > limiar, receita hora -5%).
5. **LTV e ARPU sem coorte**
   - LTV aparece por cliente, mas falta visão por plano/coorte para orientar pricing e retenção.

## 3) Crítica UI/UX de dados (implacável)

1. **Hierarquia visual insuficiente para crise**
   - Cards informativos não distinguem claramente “normal vs crítico”.
   - A regra dos 5 segundos ainda falha para diagnóstico macro.
2. **Excesso de tabela para decisão executiva**
   - Tabela é ótima para operação manual, ruim para detectar padrões sistêmicos.
3. **Data-to-Ink ratio melhorável**
   - Muitos chips e textos por linha; pouca codificação visual agregada por tendência/gravidade.
4. **Ausência de baseline e variação percentual**
   - KPI absoluto sem delta vs hora anterior/dia anterior reduz acionabilidade.

## 4) Blueprint do Dashboard Perfeito (Single Source of Truth)

## Painel A — Operação (NOC de negócio)
**Objetivo:** detectar e conter incidentes em minutos.

Widgets (topo, semáforo):
- `Receita/hora (R$/h)` com delta vs média das últimas 24h.
- `Taxa de sucesso de envio (5m, 1h, 24h)`.
- `QR/WA conexão saudável (%)`.
- `Clientes pagantes impactados agora`.

Visuais:
- Linha temporal 24h (receita, sucesso, erros).
- Heatmap de falhas por etapa (conexão, credencial, envio, pagamento webhook).
- Fila de incidentes acionáveis (SLA + responsável).

Alertas críticos:
- Receita hora < -5% baseline => vermelho.
- Erro QR/WA > X% por 10 min => vermelho.
- Pagante sem sessão WA > 24h => amarelo/vermelho.

## Painel B — Financeiro
**Objetivo:** proteger expansão e margem.

KPIs:
- MRR, ARPU, LTV (por plano e coorte), churn rate real-time (rolling 30d), inadimplência.
- Conversão trial -> pago, recuperação pós-falha operacional.

Visuais:
- Cohort de retenção (D7/D30/D60).
- Funil (trial, onboarding, primeiro valor, renovação).

## Painel C — Saúde do Cliente (CS Command Center)
**Objetivo:** prevenir churn e acelerar valor percebido.

KPIs:
- Health Score composto (0-100).
- Time to Value (cadastro -> 1º cupom enviado com sucesso).
- Silent churn index (queda de uso sem cancelamento).

Filas inteligentes:
- “Pagou + WA desconectado > 24h”.
- “Sem primeiro sucesso em 48h”.
- “Erros 24h altos + plano premium”.

## 5) Plano de implementação de métricas (aproveitando backend atual)

## Fase 1 (rápida, baixo risco)
1. **Health Score v1 (0-100)**
   - Componentes sugeridos: login recente, sucesso de envio 7d, sessão WA, erros 24h, status pagamento.
2. **Time to Value v1**
   - Diferença entre `createdAt` e primeiro `success log`.
3. **Alertas visuais por limiar**
   - Badges semáforo em cards existentes com deltas de curto prazo.
4. **Delta em KPIs atuais**
   - Exibir variação % vs período anterior.

## Fase 2 (analítica)
1. ARPU/LTV por plano e coorte.
2. Churn em tempo real (rolling) + decomposição por causa provável.
3. Silent churn score (quebra de frequência de uso).

## Fase 3 (proatividade total)
1. Motor de alertas com escalonamento (owner CS/SRE).
2. Playbooks automáticos por incidente.
3. Predição de churn com features de operação + financeiro.

## 6) Definições técnicas recomendadas

- **Churn Rate (rolling 30d):** cancelados_30d / base_ativa_início_30d.
- **ARPU:** receita_recorrente_mensal / clientes_ativos_pagantes.
- **LTV (proxy inicial):** ARPU / churn_mensal.
- **Health Score (exemplo):**
  - Atividade (25), sucesso envio (25), conectividade WA (20), erro invertido (15), pagamento em dia (15).
- **TTV:** primeiro sucesso - data de criação.

## 7) Regra de priorização para UI (5 segundos)

Topo obrigatório (sempre visível):
1. Estado do dia: **Bom / Atenção / Crítico**.
2. Receita hora (delta).
3. Pagantes impactados agora.
4. Taxa de sucesso de envio (1h).
5. Fila “agir agora” (top 10 contas).

## 8) O que remover/compactar agora

- Reduzir cards redundantes sem delta/ação.
- Mover detalhes extensos para drill-down lateral (não no fluxo principal).
- Consolidar chips de risco em score + 1 motivo principal + botão “ver todos”.

## 9) Próximo passo prático

Implementar um **MVP de Observabilidade Proativa** no Admin com:
- Semáforo global de operação.
- 4 KPIs acionáveis com delta.
- 3 filas inteligentes de CS.
- Trend chart 24h para sucesso/erro/receita.
