# Proposta — Aba "Marketing & Growth" no Admin

## 1) Protocolo de Operação e Análise de Risco (STRICT)

### Erros fatais
- Não introduzir loops de polling agressivo na UI; atualização recomendada por evento + refresh manual.
- Evitar queries pesadas sem paginação (listas de leads/campanhas).
- Não bloquear render com cálculo de métricas no client; agregação deve vir pronta da API.

### Breaking changes
- **Sem breaking change na fase 1**: criar endpoints novos (`/api/admin/marketing/*`) sem alterar contratos atuais do Admin/CS.
- Evoluir schema somente com migration incremental e compatível com dados existentes.

### Efeito cascata
- Baixo na navegação: nova aba isolada no Admin.
- Médio em observabilidade: novas métricas devem reaproveitar telemetria já existente para evitar duplicidade de eventos.

### Isolamento de ambiente
- Toda validação inicial em `develop` + staging (`:3006` visual / `:3004` API).
- Nenhuma alteração direta em `.env`/DB de produção.

### Bloqueio
- Se houver necessidade de alterar contrato já consumido por outras telas, **parar** e versionar endpoint (`v2`) antes de avançar.

---

## 2) Objetivo da aba
Criar uma central executiva no Admin para responder, em menos de 5 minutos:
1. Quais canais trazem melhor aquisição?
2. Onde está vazando conversão (visita → cadastro → assinatura)?
3. Quais campanhas geram receita e retenção, não apenas clique?

---

## 3) Estrutura da aba (inspirada no estilo da aba CS)

### A) Header de comando
- Período (7d, 30d, 90d, custom).
- Filtro por canal (`organic`, `instagram`, `linkedin`, `x`, `referral`, `direct`).
- Filtro por campanha (`utm_campaign`).
- Botão `Atualizar` + timestamp da última atualização.

### B) Cards KPI (topo)
- **Leads totais** (com delta vs período anterior).
- **Taxa de cadastro** (visita → cadastro).
- **Taxa de ativação** (cadastro → primeiro espelhamento válido).
- **Conversão paga** (trial/cadastro → assinatura ativa).
- **CAC estimado** (quando houver custo de mídia).
- **MRR influenciado por marketing** (novas assinaturas atribuídas a campanhas).

### C) Funil principal (visual)
1. Sessões/visitantes únicos
2. Leads capturados
3. Cadastros concluídos
4. Ativações (evento de valor)
5. Assinaturas

Com taxa de queda por etapa + alerta em vermelho quando a queda ultrapassar limite (ex.: >35%).

### D) Painel de canais (growth)
Tabela com:
- Canal
- Sessões
- Leads
- CVR lead
- Cadastros
- CVR cadastro
- Assinaturas
- Receita atribuída
- Tendência 7d

### E) Campanhas/UTM (execução)
Ranking por `utm_campaign` e `utm_content`:
- Volume
- Qualidade (ativação e retenção D7)
- Receita
- Status (`escalar`, `otimizar`, `pausar`)

### F) Alertas automáticos (playbook)
- Queda abrupta de tráfego (>30% d/d)
- Queda de CVR em etapa crítica
- Campanha com alto clique e baixa ativação
- Canal com CPL subindo por 3 dias seguidos

---

## 4) Métricas-chave (North Star + supporting)

## North Star
- **Active Revenue Accounts via Marketing (ARAM)**: contas pagas ativas com origem atribuída a marketing no período.

## Supporting metrics
- Visitantes únicos
- Leads
- Lead→Cadastro
- Cadastro→Ativação
- Ativação→Pagamento
- Payback estimado por canal
- Retenção D7/D30 por origem

---

## 5) Modelo de dados mínimo (Fase 1)

## Eventos recomendados
- `page_view` (com utm_source/medium/campaign/content)
- `lead_captured`
- `signup_completed`
- `first_value_action` (primeiro espelhamento válido)
- `subscription_activated`

## Dimensões
- `date`
- `channel`
- `campaign`
- `content`
- `plan`
- `country/state` (se aplicável)

## Saídas agregadas
- Endpoint `adminMarketingOverview`
- Endpoint `adminMarketingFunnel`
- Endpoint `adminMarketingChannels`
- Endpoint `adminMarketingCampaigns`
- Endpoint `adminMarketingAlerts`

---

## 6) UX da tomada de decisão (estilo Corey Haines)
- **Diagnóstico rápido**: “o que piorou hoje?” (alertas + deltas no topo).
- **Hipótese orientada a experimento**: cada card/link abre drill-down com recomendação de ação.
- **Ritmo semanal**: seção “Top 3 apostas da semana” + resultado da semana anterior.

Formato sugerido no rodapé da aba:
- Aposta
- Métrica alvo
- Janela de avaliação
- Resultado
- Decisão (manter/escalar/parar)

---

## 7) Roadmap de implementação (sem quebrar nada)

### Fase 0 — Descoberta (1 dia)
- Mapear eventos já existentes no dashboard/admin.
- Definir lacunas de instrumentação.

### Fase 1 — MVP da aba (3–5 dias)
- Nova rota no admin: `/admin/marketing-growth`.
- 5 cards KPI + funil + tabela de canais.
- Alertas básicos por thresholds.

### Fase 2 — Atribuição e receita (3–4 dias)
- Painel por campanha/UTM.
- Receita atribuída e retenção por origem.

### Fase 3 — Operação de growth (2–3 dias)
- Quadro de experimentos (hipóteses, status, resultado).
- Recomendador simples de priorização por impacto x esforço.

---

## 8) Cenários de teste em staging (porta 3006)
1. Acesso com usuário sem permissão de admin growth → mensagem de acesso restrito.
2. Carregamento com dados vazios → estado vazio amigável sem erro de render.
3. Filtro por período/canal/campanha atualiza KPIs e funil corretamente.
4. Alertas disparam ao simular queda de conversão.
5. Nenhuma regressão na aba `/admin` atual e em `/admin/sucesso-cliente`.

---

## 9) Definição de pronto (DoD)
- Aba disponível no Admin com navegação clara.
- KPIs e funil respondendo em <2s (dataset normal).
- Sem alterar comportamento da aba CS.
- Cobertura mínima de testes para agregadores de métricas.
- Validado em staging antes de qualquer promoção para `main`.
