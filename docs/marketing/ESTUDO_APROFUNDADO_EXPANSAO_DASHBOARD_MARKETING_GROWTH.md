# Estudo aprofundado — Expansões e melhorias do Dashboard Marketing & Growth

## 1) Protocolo de Operação e Análise de Risco (STRICT)

### Erros fatais
- Evitar consultas pesadas em tempo real para todos os cards (agregar por dia e servir snapshots).
- Evitar renderização bloqueante no client: preferir carregamento incremental por blocos (`overview`, `funnel`, `campaigns`, `cohorts`).
- Evitar loops de refresh automático curto (<30s); manter refresh manual e polling opcional com backoff.

### Breaking changes
- Não alterar shape de endpoints já usados no admin atual.
- Novas evoluções devem entrar em rotas novas e versionadas (`/api/admin/marketing/v2/*`) quando houver mudança de contrato.
- Evoluções de analytics devem ser aditivas (novos campos/eventos), sem remover eventos antigos.

### Efeito cascata
- Médio no backend: novos agregadores podem impactar latência de `/api/admin` se compartilharem pool sem limites.
- Médio no produto: mudança de definição de métrica pode alterar decisão de growth/CS/finance.

### Isolamento de ambiente
- Desenvolver e validar apenas em `develop` + staging (`3006`/`3004`).
- Proibir execução de migração sem validação de dados em staging.
- Não tocar `.env` de produção para experimentação de tracking.

### Bloqueio
- Se uma melhoria exigir redefinir métricas históricas sem plano de retrocompatibilidade, **parar** e executar plano de migração em staging antes.

---

## 2) Diagnóstico de maturidade atual

A solução atual já cobre:
1. visão executiva de KPI;
2. funil operacional;
3. campanhas e alertas;
4. quadro de experimentos.

Gaps para próxima evolução:
- atribuição ainda parcial (source/ref com baixa granularidade);
- ausência de coortes e retenção D7/D30 por canal/campanha;
- ausência de guardrails financeiros avançados (CAC/LTV por coorte);
- ausência de “score de confiança dos dados” por card (qualidade da mensuração);
- ausência de workflow de decisão integrado (owner, prazo, impacto esperado, resultado real).

---

## 3) Mapa de ampliação recomendado (próximas fases)

## Fase 4 — Data Trust & Governança de Métricas
Objetivo: garantir que o painel não só mostre números, mas números confiáveis.

### Entregas
- Indicador de confiabilidade por widget (alto/médio/baixo).
- Dicionário de métricas versionado no próprio admin (definição oficial).
- Alertas de anomalia de coleta (queda abrupta de eventos, spikes suspeitos).
- “Data freshness” por bloco (há quantos minutos foi atualizado).

### Impacto
- Reduz decisões erradas por interpretação de dado incompleto.
- Facilita alinhamento entre Growth, CS e Finance.

---

## Fase 5 — Atribuição e Receita Multi-toque (pragmática)
Objetivo: sair de atribuição simplificada para atribuição operacional útil.

### Entregas
- Modelo híbrido de atribuição:
  - last non-direct click (padrão de operação);
  - first touch (diagnóstico de descoberta);
  - assistida (apoio de canais no meio do funil).
- Comparador de modelos (delta de receita atribuída por canal).
- Receita líquida por campanha (descontando chargeback/cancelamentos quando aplicável).

### Impacto
- Melhora priorização de orçamento/canais.
- Evita superinvestir em canal que apenas “fecha” mas não “gera” demanda.

---

## Fase 6 — Retenção, Coortes e Qualidade de Receita
Objetivo: otimizar não só aquisição, mas retenção e LTV real.

### Entregas
- Coortes semanais/mensais por canal/campanha.
- Retenção D7, D15, D30 e curva de sobrevivência de assinatura.
- LTV parcial por coorte (30/60/90 dias).
- Payback estimado por canal.
- Sinalização de “receita frágil” (cresce entrada, cai retenção).

### Impacto
- Troca foco de vanity metrics para receita sustentável.

---

## Fase 7 — Growth OS (execução dentro do dashboard)
Objetivo: transformar análise em execução com cadência.

### Entregas
- Backlog de experimentos integrado no painel.
- Priorização ICE/RICE automática com dados históricos.
- Workflow por experimento:
  - hipótese;
  - owner;
  - data de início/fim;
  - resultado esperado vs real;
  - decisão final (escalar/manter/encerrar).
- Scoreboard semanal (win rate, impacto acumulado em receita).

### Impacto
- Reduz gap entre “insight” e “ação”.
- Cria memória operacional de growth.

---

## 4) Melhorias específicas de UX (estilo command center)

1. **Modo executivo (5 min):** apenas 6 KPIs + 3 riscos + 3 oportunidades.
2. **Modo analista (deep dive):** drill-down por canal/campanha/coorte.
3. **Timeline de eventos de negócio:** picos/quedas com anotações (campanha lançada, ajuste de preço, incidente).
4. **Comparador de período com explicação automática:** “+12% por aumento de ativação no Instagram”.
5. **Cards com CTA operacional:** cada risco abre ação recomendada com owner sugerido.

---

## 5) Arquitetura de dados sugerida (incremental, sem ruptura)

## Camada A — Event store (já existente, evolutiva)
- Manter `AnalyticsEvent` como trilha canônica.
- Padronizar `metadata` por evento com schema lógico:
  - `source`, `medium`, `campaign`, `content`, `term`, `experiment_id`, `landing_page`, `device`.

## Camada B — Tabelas de agregação diária
- `marketing_daily_overview`
- `marketing_daily_campaign`
- `marketing_daily_cohort`

(geradas por job incremental, reduzindo carga em query online)

## Camada C — API de leitura para Admin
- `/api/admin/marketing/overview`
- `/api/admin/marketing/funnel`
- `/api/admin/marketing/campaigns`
- `/api/admin/marketing/cohorts`
- `/api/admin/marketing/alerts`

---

## 6) Regras de qualidade de mensuração

Checklist mínimo para cada métrica crítica:
- cobertura (% de registros com UTM válido);
- latência de disponibilidade (near real-time vs batch);
- sensibilidade a duplicidade;
- reconciliação com financeiro (pagamentos aprovados líquidos);
- dono da métrica (owner explícito).

---

## 7) Backlog priorizado (90 dias)

## Sprint A (semanas 1-2)
- Data trust badges
- Dicionário de métricas
- Alertas de integridade de tracking

## Sprint B (semanas 3-5)
- Atribuição híbrida v1
- Comparador first touch vs last touch
- Receita líquida por campanha

## Sprint C (semanas 6-8)
- Coortes D7/D30
- LTV 30/60/90
- Payback por canal

## Sprint D (semanas 9-12)
- Growth OS (experimentos com workflow completo)
- Score semanal de impacto
- Relatório executivo automático

---

## 8) Cenários de validação em staging (porta 3006)

1. Página abre com dados parciais sem quebrar layout.
2. Filtros de período/canal/campanha atualizam todos os blocos.
3. Comparador de modelo de atribuição não altera métricas históricas padrão sem confirmação.
4. Coortes não extrapolam datas futuras e respeitam timezone.
5. Alertas de data trust disparam quando cobertura UTM cai abaixo do limiar.
6. Sem regressão nas telas `/admin` e `/admin/sucesso-cliente`.

---

## 9) KPIs de sucesso da evolução do dashboard

- Tempo de decisão semanal do time (meta: -40%).
- Percentual de experimentos com hipótese explícita (meta: >90%).
- Taxa de experimentos com decisão formal registrada (meta: >85%).
- Crescimento de MRR com retenção estável (qualidade de receita).
- Redução de divergência entre dados de marketing e financeiro.

---

## 10) Recomendação prática imediata

Executar primeiro a trilha **Data Trust + Coortes** antes de sofisticar atribuição multi-toque completa.

Motivo:
- sem confiança e retenção, a atribuição vira “bonita” mas pouco acionável;
- com confiança + retenção, toda decisão de mídia e onboarding fica mais precisa.
