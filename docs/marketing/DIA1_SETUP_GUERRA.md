# Dia 1 — Setup de guerra (fundação) — wabot

Data: 2026-05-10
Owner: Growth/Marketing

## 1) Documento “Oferta + Mensagem”

### Oferta de lançamento (proposta oficial)
- **Oferta principal:** Trial guiado de 7 dias do wabot.
- **Bônus onboarding:** sessão de setup assistido (30 minutos) + 3 templates prontos de operação.
- **Garantia operacional:** acompanhamento de ativação para alcançar o primeiro espelhamento em até 15 minutos após setup.
- **CTA padrão:** "Entrar no Trial Guiado".

### Mensagem central (positioning)
- **Headline:** "Espelhe grupos com consistência e escale sua operação sem trabalho manual."
- **Subheadline:** "O wabot automatiza sua distribuição em grupos e acelera seu resultado com menos esforço operacional."
- **Pilares de valor:**
  1. Economia de tempo
  2. Escala sem equipe adicional
  3. Consistência de publicação

### Provas e objeções
- **Prova social:** número de conexões bem-sucedidas e mensagens espelhadas (agregado).
- **Objeções mapeadas:** risco de bloqueio, complexidade de setup, retorno do investimento.
- **Resposta padrão:** onboarding assistido + melhores práticas + monitoramento de eventos de ativação.

---

## 2) Dashboard v1 (GA4 + eventos + planilha executiva)

### Estrutura do dashboard único
- **Fonte 1:** GA4 (aquisição e conversão)
- **Fonte 2:** eventos de produto (ativação no funil)
- **Fonte 3:** planilha executiva (resumo diário para decisões)

### Eventos de conversão (padrão v1)
1. `lp_view` — visualização de landing page
2. `cta_click` — clique em CTA principal
3. `lead_submit` — envio de formulário
4. `trial_start` — início de trial
5. `first_connection_success` — primeira conexão bem-sucedida
6. `first_mirror_success` — primeiro espelhamento bem-sucedido

### KPIs do dashboard v1
- Sessões por canal
- CTR de CTA
- Taxa LP → Lead
- Taxa Lead → Trial
- Taxa Trial → Ativado
- CPL/CPA por canal

---

## 3) Taxonomia UTM padrão

### Convenção
- `utm_source`: origem do tráfego
- `utm_medium`: tipo de mídia
- `utm_campaign`: campanha macro
- `utm_content`: variação de criativo
- `utm_term`: termo/segmento (quando aplicável)

### Padrão de nomenclatura
- tudo em minúsculo
- usar `-` para separador
- sem acentos e sem espaços

### Exemplos oficiais
- Meta Ads:
  - `utm_source=meta`
  - `utm_medium=paid-social`
  - `utm_campaign=launch-wabot-2026q2`
  - `utm_content=video-tempo-a`
- Google Ads:
  - `utm_source=google`
  - `utm_medium=paid-search`
  - `utm_campaign=launch-wabot-2026q2`
  - `utm_content=kw-espelhar-grupos`
- Parceiros:
  - `utm_source=parceiro-nome`
  - `utm_medium=affiliate`
  - `utm_campaign=launch-wabot-2026q2`
  - `utm_content=convite-direto`
- Orgânico social:
  - `utm_source=instagram`
  - `utm_medium=social-organic`
  - `utm_campaign=prelaunch-wabot`
  - `utm_content=carrossel-dor-escala`

---

## 4) Pipeline CRM funcional (Lead → MQL → Trial → Ativado)

### Estágios e critérios
1. **Lead**
   - Entrou via formulário/LP.
2. **MQL**
   - Perfil aderente + engajamento mínimo (ex.: abriu email/clicou CTA).
3. **Trial**
   - Conta criada e trial iniciado.
4. **Ativado**
   - Completou evento de sucesso: `first_mirror_success`.

### Automação mínima por estágio
- Lead: email de boas-vindas + convite trial guiado.
- MQL: sequência educacional (prova social + benefício principal).
- Trial: checklist de setup e suporte de ativação.
- Ativado: campanha de retenção + convite de indicação.

---

## Checklist de conclusão (Dia 1)
- [x] Documento “Oferta + Mensagem” definido
- [x] Dashboard v1 desenhado com KPIs e eventos
- [x] Taxonomia UTM padronizada
- [x] Pipeline CRM com critérios e automações mínimas
