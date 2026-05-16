# CRO — Onda 4 (Escala e Governança)

Data: 2026-05-16  
Status: executado  
Escopo: transformar experimentação em rotina operacional com critérios de decisão, cadência e rollback seguro em staging.

## 1) Protocolo STRICT (gate obrigatório antes de cada experimento)

1. **Erros fatais:** sem loops/listeners órfãos, sem regressão de build/testes.
2. **Breaking changes:** proibido alterar contratos de API/schema sem plano de migração e janela de compatibilidade.
3. **Efeito cascata:** validar impacto no funil completo (`page_view -> cta_click -> signup -> first_send_success -> paid`).
4. **Isolamento:** todo experimento começa em `develop`, valida em `http://178.105.54.0:3006`.
5. **Bloqueio:** qualquer risco fatal/breaking => pausar rollout e abrir plano de correção em staging.

---

## 2) Cadência operacional

### Sprint quinzenal de CRO
- **D0 (planejamento):** priorizar até 2 experimentos por sprint.
- **D1-D3:** implementação + QA local.
- **D4-D7:** validação em staging (3006).
- **D8-D12:** coleta de dados com janela mínima definida.
- **D13-D14:** decisão formal (manter, iterar, reverter) + registro no log.

### Retro mensal
- Revisar ganhos/perdas por experimento.
- Revisar qualidade de dados (source/campaign coverage).
- Repriorizar backlog com base em impacto real.

---

## 3) Critérios de qualidade de experimento

Um experimento só pode iniciar se tiver:
- hipótese explícita (1 frase);
- métrica primária;
- guardrail de risco (ex.: queda máxima de signup/activation);
- tamanho da janela (mín. 7 dias corridos, salvo tráfego insuficiente);
- owner e data de revisão.

Um experimento só pode encerrar se tiver:
- decisão binária (`ship` / `iterate` / `rollback`);
- justificativa com dados;
- ação seguinte com prazo.

---

## 4) Metas de governança (90 dias)

- >= 90% experimentos com hipótese explícita.
- >= 85% experimentos com decisão formal registrada.
- <= 14 dias entre início e decisão para experimentos padrão.
- Cobertura de `source` >= 80% e `utm_campaign` >= 70% no funil de signup.

---

## 5) Ritual de decisão (template curto)

## [Experimento]
- **ID:** CRO-XXXX
- **Hipótese:**
- **Métrica primária:**
- **Guardrail:**
- **Período:**
- **Resultado:**
- **Decisão:** ship | iterate | rollback
- **Próxima ação e prazo:**

---

## 6) Checklist de rollout seguro (staging -> produção)

1. Resultado estatístico/operacional documentado.
2. Sem regressão de guardrails.
3. Smoke na rota afetada em staging (3006).
4. Registro de decisão no log de experimentos.
5. Somente então abrir fluxo `develop -> main`.

