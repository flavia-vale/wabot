# Auditoria do Painel Admin — negócio + técnica (2026-10-02)

Branch auditada: `develop` em `273e815`. Só análise: nenhum código ou banco foi alterado.
Toda afirmação aponta `arquivo:linha`. O que depende de dado de produção está marcado
**[hipótese]** com o comando mínimo (read-only, saída filtrada) para a dona confirmar na VPS.

## Resumo executivo

**Os 5 maiores problemas**

1. **Um arquivo faz o papel de painel inteiro.** `dashboard/app/admin/page.js` tem 3.780 linhas (67% das 5.661 linhas das telas), dispara 20 chamadas na abertura (`page.js:2632-2657`) e reimplementa dentro de abas o que `/admin/online`, `/admin/observabilidade`, `/admin/sucesso-cliente` e `/admin/afiliados` já fazem como página.
2. **"Pagante" tem 4 definições diferentes** e "online" tem 3 janelas de heartbeat distintas (90 s, 2 min, 5 min). O Início conta pagante pelo campo `plan` (`admin.js:772`), exatamente o que `payingStatus.js:7-9` proíbe. Números de telas diferentes não batem e ninguém sabe qual está certo.
3. **Vê-se o problema, não se age.** Não existe no painel: parar robô, sincronizar assinatura com o Mercado Pago, testar chave de loja, ver/reprocessar a DLQ de envio (rotas existem em `admin.js:3814-3870`, tela não), exportar/anonimizar LGPD, rodar diagnóstico de um cliente. São ~25 scripts que a dona roda por SSH.
4. **Quase nenhum alerta chega à dona antes do cliente reclamar.** Há 8 e-mails internos (`src/email/registry.js`), mas robô de pagante caído/cego, fila/DLQ crescendo, swap/OOM, credencial de loja vencida e supervisor morto **não geram aviso nenhum**. Capacidade alerta só em log (`server.js:751-755`).
5. **Custo escondido e ruído.** `/admin/online` faz polling a cada 15 s (`online/page.js:302-305`), cada chamada roda consulta de 48 h sem `take` (`admin.js:885`) **e grava uma linha de auditoria** (`admin.js:1536`): ~5.760 linhas/dia por aba aberta, guardadas 180 dias. `/logs/summary` lê até 30 dias de `MessageLog` sem limite (`admin.js:3409`). Marketing & Growth mostra número inventado (visitas = usuários × 12, `marketing-growth/page.js:184`).

**As 5 mudanças de maior impacto**

1. **Caixa de entrada "Hoje"** priorizada por receita (pagante com robô caído > lead que não conectou), com o botão da ação ao lado de cada item. Substitui o semáforo do Início e a fila de sucesso.
2. **Ficha 360° do cliente** (`/admin/clientes/[id]`) como centro: absorve o drawer do Online, o DetailPanel do Início, o contact-log, ajustar plano, reconectar/parar robô, DLQ, diagnóstico de conexão e de assinatura.
3. **Uma única fonte para pagante/online/ativo/em risco** no backend (`payingStatus.js` + um `sessionLiveness.js`), consumida por todas as rotas. Teste que falha se `plan IN PAID_PLANS` voltar a significar "pagante".
4. **Alertas para a dona por e-mail/WhatsApp** reaproveitando `adminAlerts.js`: pagante caído >2 h, cego >3 h, DLQ > 0, swap ativo, supervisor sem heartbeat, chave de loja recusada em N contas.
5. **Apagar/fundir 7 telas**: Marketing & Growth (dados fictícios), Pipeline (ferramenta de dev), Teste-shard (POC), Observabilidade (duplica Início) e as abas Online/Sucesso/Afiliados do Início; menu novo com 5 entradas.

---

## 1. Inventário

### 1.1 Telas (`dashboard/app/admin/`)

Legenda de estado: **U** usada · **D** duplicada · **M** morta/órfã · **X** experimental. "Órfã" = sem link em nenhum menu (grep em `dashboard/`). O único menu é a barra do topo em `page.js:2915-2946`; `layout.js` não tem navegação.

| Tela | Objetivo declarado | Quem usa / quando | Dados (origem) | Ações | Custo | Estado |
|---|---|---|---|---|---|---|
| `page.js` Início (3.780 l.) | "O que precisa de decisão agora" (`:2961`), com 6 abas internas (`:121-128`): Início, Online, Sucesso, Afiliados, Financeiro, Config + aba oculta Observabilidade (`:2942`) | Dona, todo dia | 20 endpoints na carga (`:2632-2657`): overview, users, wa-disconnected, sessions, session-telemetry, logs, logs/summary 24h, finance/overview, payments, subscriptions, success/overview+queue, system/health+metrics+observability, online(120), lp-content, legal/terms, qualidade-entrega. Cards de cenário (`online.summary.scenarios`, `:2969-3020`), Online agora, Pagantes, Erros 24h, Foto 48h, Banco/site, Trabalhos parados (`:3022-3078`), tabela Gestão de clientes (`:2709`), WhatsAppDisconnectedTable (`:3488`) | reconectar robô (`:2513`, sem confirm), ajustar acesso (`:2814`), contact-log (`:2824`), pagamento manual (`:2243`), estorno PIX com confirm (`:2434`), liga/desliga staging (`:1862`), aprovar/pagar comissão (`:2558-2564`), editar planos/FAQ/termos/tutorial (`:2843-2894`) | Sem polling, mas selo "Atualização em tempo real" (`:2964`) mente. 20 chamadas, 3 delas sem `take` (ver 3.5). Botão Atualizar refaz as 20 | **U + D** (hub que duplica 4 páginas) |
| `clientes/page.js` (268) | "Clientes — clique para ver o histórico" (`:172-173`) | Dona, para achar cliente | `GET /customers` paginado 50 (`:140`): PayingTag, SharedPhoneTag, situação, plano, cobrança, vence em, LTV, grupos, envios 30d, WhatsApp, números | Só leitura: busca, filtro situação, ordenação, paginação | Em lote, sem N+1 (`docs/rca/admin.md`) | **U** |
| `clientes/[id]/page.js` (493) | "Histórico do cliente" (`:444`) | Dona, antes de falar com cliente | `GET /customers/:id/history` (`:410`): 6 números do cabeçalho, abas Cadastro/Financeiro/Técnico/Uso, linha do tempo (`:484`) | Só editar limite de automações (`:276-333`, sem confirm). **Nenhuma outra ação** | `messageLog` take 20.000 (`admin.js:3300`) | **U** — candidata a centro |
| `online/page.js` (502) | "Usuários e conexões agora · tempo real" (`:350-352`) | Dona, quando alguém reclama | `GET /online` (`:277-298`): online agora, estabilidade, tabela por usuário, drawer com quedas/erros/grupos derrubando (`:127-258`) | reconectar (`:316`, **sem confirm**), filtros, link wa.me | **Polling 15 s sem checar aba visível** (`:302-305`); cada chamada = consulta 48 h sem `take` + 1 linha `AdminAuditLog` (`admin.js:1536`) | **D + órfã** (só a aba Online do Início aponta para o mesmo endpoint; nenhum link para `/admin/online`) |
| `capacidade/page.js` (37 + 439 em `components/`) | "Capacidade e previsibilidade" (`:36`), `tech:read` | Dona, ao decidir vaga/servidor | `capacity/current,history,forecast,alerts` (`:21-27`): decisão, saúde de RAM/CPU/disco/swap, inventário, processos, staging, histórico, simulador | Atualizar agora com confirm (`:29`), desligar staging com confirm (`CapacityEnvironments.js:10`), simular cenário | Polling 60 min só com aba visível. Leve | **U** |
| `observabilidade/page.js` (487) | "Wabot Mission Control · Etapa 1 da Fase 1" (`:341-343`) — texto de roadmap | Ninguém regular | system/health+metrics+observability, logs/summary **7d**, sessions (`:258-264`); golden signals, GO/NO-GO, mapa de dependências, top rotas, DLQs | **Reprocessar DLQ de pagamento sem confirm** (`:157-162`, com MFA) | `logs/summary 7d` sem `take` (`admin.js:3409`) | **D** (igual à aba Observabilidade do Início `page.js:3083-3190`) + só linkada de `/admin/online:357` |
| `erros/page.js` (81) | "Erros, sem adivinhação" (`:69`) | Dona, quando sobe erro | `GET /errors/observability` (`:50-56`): falhas reais, causas novas, clientes afetadas, bloqueios esperados, tendência, grupos, impactadas | Só leitura; link para histórico do cliente | Teto 20k+20k (`admin.js:3363`) | **U** — mas é a 3ª contagem de erro (ver 3.4) |
| `pipeline/page.js` (259) | "Central Técnica de Desenvolvimento — Kanban do backlog.md" (`:217-219`) | Dev | `GET /pipeline` lê `.backlog/backlog.md` | mover card (`PATCH`) | Leve | **M** (ferramenta de dev, órfã) |
| `funil/page.js` (304) | "Onde as pessoas param" (`:127-128`) | Dona, semanal | `GET /funnel?weeks` (`:107`): 7 etapas, maior perda, medianas, 9 motivos de parada com "falar com", origens, semana a semana | Só leitura | `user.findMany` sem take até 26 sem. (`service.js:625`) | **U** (bem guardada por teste) |
| `sucesso-cliente/page.js` (342) | "Fila orientada por risco" (`:194-196`) | Atendimento | success/overview+queue+metrics (`:75-79`): 6 cards, funil de retenção 7d, SLA, fila com prioridade/peso | Registrar contato (`:291`), Ajustar plano (`:310`), wa.me | Leve; "Follow-ups vencidos" aparece 2× (`:208`, `:234`) | **D + órfã**; **acesso por lista de e-mails fixa no código** (`:11`) |
| `marketing-growth/page.js` (723 + 158) | "Aquisição, conversão e receita em visão executiva" (`:508`) | Ninguém | 14 chamadas (`:113-128`). **Visitas = usuários × 12** (`:184`), canais com % e tendências fixas (`:229-238`), Experiment OS/Idea Engine de seed (`:271-354`), checklist com IP de staging (`:30-62`) | Só leitura | Período ignorado na 1ª carga (`:120-127`) | **M** (dados fictícios, órfã). Só `CampanhaCanaisFunil` tem teste e dado real |
| `emails/page.js` (937) | "Contato com cliente" e-mail + WhatsApp (`:868-869`) | Dona, campanhas | emails/summary, templates, batches, sends, whatsapp/history+connected | editar/testar/restaurar modelo, disparo em massa com confirm (`:332`), cancelar lote, WhatsApp individual (**sem confirm** `:625`) e em massa (confirm `:638`) | `GET /batches` N+1: 30 lotes × 4 counts (`adminEmails.js:330-335`) | **U** |
| `afiliados/page.js` (981) | "Admin / Afiliados", 5 abas (`:922-928`) | Dona, mensal | affiliates, referrals, commissions, payout-requests, settings | aprovar/rejeitar, override, aprovar/pagar/reverter comissão, **"Pagar elegíveis do mês" em massa sem confirm** (`:462-490`), saques, config | N+1 em mark-all-paid (`affiliate.js:564`) | **U + D** (aba Afiliados do Início repete approve/mark-paid `page.js:2549-2572`) |
| `teste-shard/page.js` (71) | "Teste controlado · shard WhatsApp · 4 contas" (`:57`) | Dev, durante POC | shard-poc/overview, polling 5 s (`:30`) | mover/rollback com confirm (`:46-49`) | Leve | **X** (POC; env `WA_SESSION_SHARD_POC`, `admin.js:1404`) |

**Padrão visual:** nenhuma tela admin usa `pnl-*`/tokens do design system v2; todas usam Tailwind com cinzas (`text-gray-900`, `bg-gray-100`), e `teste-shard` usa tema escuro próprio. O checklist do DS diz "Nada de Tailwind no painel" e "tokens, nunca hex solto".

### 1.2 Backend (`src/api/routes/admin.js`, `adminEmails.js`, `affiliate.js`)

Resumo das 70+ rotas (tabela completa no apêndice A):

- Autorização: `requireAdmin(req, reply, perm)` (`admin.js:701`); papéis em `ROLE_PERMISSIONS` **triplicado** (`admin.js:45`, `adminEmails.js:26`, `affiliate.js:29`). Toda escrita exige MFA step-up (`admin.js:155-160`).
- Auditoria: `admin.js` grava `AdminAuditLog` **até em leituras** (`:1536` online, `:1515` users…), mas GETs de capacity, staging-power, qualidade-entrega e todo `adminEmails.js` **não** gravam. Em `affiliate.js`, approve/reject/settings/override escrevem **sem auditoria** (`:392, :411, :598, :670`).
- Rotas **sem nenhuma tela** (mortas ou "escondidas"): `send-dlq/*` (listar/retry/apagar/purge, `admin.js:3814-3870`), `users/:id/block` e `unblock` (`:3102, :3137`), `GET /faq`, `GET /billing/webhooks`, `GET /automation-quota`.
- Módulos de domínio prontos **sem rota**: `ltvRetention.js`, `churnReason.js`, `outreachSegments.js` (só scripts e testes).

### 1.3 Scripts (`scripts/`): a observabilidade escondida

137 arquivos; ~64 `diag-*`. Tabela completa no apêndice B. O que importa para o painel:

| Grupo | Scripts | Já no painel? | Deveria virar botão/tela |
|---|---|---|---|
| Diagnóstico de 1 cliente | `diag-nao-conecta`, `diag-envios-vazios`, `diag-fila-grupo`, `diag-fila-parada`, `diag-destinos-gemeos`, `testar-recorrencia`, `diag-assinatura-recusada`, `conferir-voucher`, `diag-awin`, `diag-rakuten` | parcial (dados crus espalhados em online/histórico) | **Sim** — aba "Diagnóstico" na ficha 360° |
| Ação sobre 1 cliente | `parar-sessao` (grava sempre, `:36`), `sincronizar-assinatura --aplicar`, `apontar-grupos-para-template`, `definir-template-espelhamento`, `lgpd_data_request`, `apagar-conta`, `fix-assinatura-aparelho` | não (só reconectar existe) | **Sim** — botões na ficha, com confirmação |
| Segmentos de contato | `contato-ativo-semanal` (10 grupos, `outreachSegments.js`), `diag-sem-etiqueta`, `diag-ativou-e-sumiu`, `diag-clientes-depoimento` | parcial (success/queue tem outra regra) | **Sim** — a própria caixa de entrada |
| Frota / capacidade | `diag-frota-cega`, `wa-forbidden-report`, `diag-vagas-robos`, `diag-clientes-sem-vaga`, `diag-shopee-chave-por-conta`, `diag-ml-credencial-por-conta`, `diag-lojas-nao-suportadas` | parcial (cegueira e vagas sim; 403, credencial por conta e loja não suportada não) | **Sim** — cards em Operação + alerta |
| Receita | `diag-ltv-retencao`, `diag-motivo-nao-renovou`, `diag-roi-conciliacao`, `diag-financeiro-periodo` | não (LTV/churn) / sim (financeiro) | **Sim** — tela Receita |
| Investigação profunda de loja/imagem | `diag-ml-*`, `diag-shein-*`, `diag-shopee-foto`, `diag-aguardando-*`, `diag-preview-sem-imagem` | não | Não — terminal, uso raro, rede externa |
| Obsoletos / one-shot | `migrate-*`, `seed-*`, `cleanup-*`, `snapshot-image-mode`, `basic-sem-recursos-pro`, `backfill-numeros-whatsapp`, probes pré-implementação | — | Não; mover para `scripts/arquivo/` |

---

## 2. Análise de negócio

Cliques contados a partir de `/admin`. "Acionável" = o botão da ação está na mesma tela.

### 2.1 Receita

| Pergunta | Respondida? | Onde | Cliques | Acionável? | Observação |
|---|---|---|---|---|---|
| MRR | sim | Início → aba Financeiro (`finance/overview`) | 1 | — | `activeMrr` conta por `plan` (`admin.js:2060`), não por pagamento aprovado |
| Quantos pagantes | **sim, com 4 respostas** | Início card (`:772` por `plan`), Online (`:1042` Payment+Charge), Financeiro (`:2054` all-time), clientes (`payingStatus`) | 0-1 | — | Ver 3.4 |
| Inadimplência / cobrança recusada | parcial | Financeiro → cobranças; e-mail `admin_cobranca_recusada` | 2 | não (não há "sincronizar com MP" nem "reenviar cobrança") | `sincronizar-assinatura.mjs` só por SSH |
| Churn e motivo | **não** | — | — | — | `ltvRetention.js` e `churnReason.js` prontos, sem rota; `diag-motivo-nao-renovou.mjs` só SSH |
| LTV por cliente / coorte | parcial | histórico do cliente (total pago) | 2 | — | LTV por coorte só `diag-ltv-retencao.mjs` |
| ROI por cliente / custo operacional | sim | Financeiro → ROI (`finance/roi`, custos `PUT /finance/costs`) | 2 | sim (editar custos) | ROI_ROW_LIMIT 20k (`admin.js:2377`) |

### 2.2 Aquisição / ativação

| Pergunta | Respondida? | Onde | Cliques | Acionável? |
|---|---|---|---|---|
| Cadastro → conectou → loja → grupos → oferta → pagou | sim | `/admin/funil` (7 etapas, 9 motivos, "falar com") | 1 | parcial: link para histórico, mas lá não há "mandar e-mail/WhatsApp" |
| Origem do cadastro | sim | Funil → "Por onde chegaram"; `signupOrigin.js` | 1 | — |
| Onde trava | sim | Funil → "Por que pararam" | 1 | parcial |
| Pareamento falhou (obstáculo nosso) | parcial | Funil separa "não pediu" de "tentou e não conseguiu"; detalhe só `diag-pareamento-falhou.mjs` | 1 | não |
| Campanhas/UTM | parcial | `CampanhaCanaisFunil` (dado real) dentro de Marketing & Growth (dado fictício ao redor) | 1 (URL digitada) | — |

### 2.3 Saúde do cliente (antes de ele reclamar)

| Pergunta | Respondida? | Onde | Cliques | Acionável? |
|---|---|---|---|---|
| Quem está com robô caído | sim | Início cards de cenário / Online / WhatsAppDisconnectedTable | 0-1 | parcial: só **reconectar**; não há **parar**, nem "mandar QR por WhatsApp" |
| Quem está cego (conectado sem receber) | sim | cenário "Sem receber" (`admin.js:855-879`, janela 3 h) | 1 | só reconectar |
| Quem parou de enviar | parcial | risco `paid_stale_48h` (`admin.js:573-593`, por `plan`) e e-mail à cliente `robo_parado` | 1 | não |
| Credencial de loja vencida / chave recusada | **não no painel** | sondagem diária avisa só a **cliente** (`credentialExpiry/sweep.js:131`); `credentialHealth.js` só valida formato (`:381-397`) | — | não; `diag-shopee-chave-por-conta` e `diag-ml-credencial-por-conta` só SSH |
| Link não convertendo | parcial | `/admin/erros` (categoria), `skip:no_valid_conversions` no histórico | 2 | não |
| Perto de cancelar | parcial | success/queue (prioridade), subscriptions `expiring_soon` | 1 | registrar contato / ajustar plano |
| Risco de ban do chip (403) | **não** | `ops_wa_forbidden` só em `AnalyticsEvent`; `wa-forbidden-report.mjs` | — | — |

### 2.4 Operação / capacidade

| Pergunta | Respondida? | Onde | Acionável? |
|---|---|---|---|
| Vagas de robô, RAM, swap, disco | sim | `/admin/capacidade` | parcial (desligar staging, atualizar) |
| Quem ocupa as vagas / quem foi recusado | não | `diag-vagas-robos`, `diag-clientes-sem-vaga` | — |
| Fila parada / DLQ de envio | **não** | rotas `send-dlq/*` sem tela; total da DLQ 1×/dia (`dlqMaintenance.js:20-30`); profundidade da fila BullMQ não exposta | rotas de retry/purge existem sem tela |
| Erros por tipo | sim, 3 vezes diferentes | Início (`overview.errors24h`), Observabilidade (`logs/summary`), `/admin/erros` | — |
| Supervisor vivo, código velho nos workers | parcial | `system/observability` (supervisor); `ops_stale_worker_code` só log (`server.js:799`) | — |

### 2.5 Produto

| Pergunta | Respondida? | Onde |
|---|---|---|
| Uso PRO × Basic (quem usa marca d'água, variação, automação) | não | só `basic-sem-recursos-pro.mjs` |
| Lojas mais usadas | parcial | Início → "envios e imagem por loja" (`qualidade-entrega`); histórico do cliente → lojas |
| Lojas não suportadas pedidas | **não** | `ops_unsupported_store_daily` só em `diag-lojas-nao-suportadas.mjs` |

### 2.6 Classificação das métricas existentes

**Decide algo (manter, dar botão):** cards de cenário do Início (paradas sem ninguém tentando, sem receber, caindo demais, cliente teve que agir, fonte dessincronizada); pagantes online; trabalhos parados (DLQ); foto 48h; funil 7 etapas + motivos; cobranças recusadas; vence em 5 dias; capacidade (decisão + swap + vagas); erros "causas novas" e "clientes afetadas"; fila de e-mail/erros do dia; comissões pendentes/saques.

**Contexto útil (manter recolhido):** estabilidade %, envios 30d/7d/24h por cliente, linha do tempo do cliente, origem do cadastro, histórico de capacidade, top rotas da API, semana a semana do funil, SLA de follow-up.

**Ruído (remover):** "Métricas executivas completas" de `STAT_LABELS` (`page.js:14-31`, 18 números sem decisão); "Gate operacional de promoção" (`:3110-3127`, duplicado em Observabilidade); "Contrato safe-summary" (`observabilidade:454`); "Mapa vivo de dependências"; heap/latência/uptime da API no Início; tudo em Marketing & Growth exceto `CampanhaCanaisFunil`; cards de telemetria de sessão (`session-telemetry` lê `AdminAuditLog`, `admin.js:3718`); "Experimento"/"Peso valor" na fila de sucesso; "Follow-ups vencidos" repetido; Pipeline Kanban.

---

## 3. Análise técnica da observabilidade

### 3.1 Sinais que existem × que chegam ao painel

| Sinal | Onde nasce | Persistência / retenção | Chega ao painel? |
|---|---|---|---|
| 37 `ops_*` (`operationalSignals.js:19-104`) | contador em memória **do processo da API** + `AnalyticsEvent` | `AnalyticsEvent` **sem retenção** (maior tabela sem limpeza) | Só 3 eventos (`wa_reception_blind`, `group_desync_*`, `admin.js:878-882, 1268`). Os `wa_*` nascem no worker e **não entram no contador da API** (ponto cego) |
| `ops_unsupported_store_daily` | bot-worker watchdog 5 min | 30 dias (`unsupportedStoreSignal.js:107-113`) | Não |
| `WaConnectionEvent` | worker/supervisor | 14 dias (`waConnectionTelemetry.js:54-60`) | Sim (online, histórico) |
| `MessageLog` | worker | 90 dias (`server.js:172`) | Sim (erros, logs, histórico, funil) |
| `receptionHealth.js` (ok/blind/starved/quiet/offline, janela 20 min) | só bot-worker (`bot-worker.js:132`) | emite `wa_reception_blind` 1×/h | Painel usa outra janela (3 h, `admin.js:855-879`) |
| `credentialHealth.js` | API | — | Sim, mas é **validação de formato**, não de vencimento (`:381-397`) |
| Sondagem de vencimento ML/Amazon/Shopee | `credentialExpiry/sweep.js:131`, diária | `AnalyticsEvent credential_expiry_alert_sent` | **Não** (avisa só a cliente) |
| BullMQ fila de envio + DLQ | `sendQueueBackend.js:138-141` (só com `QUEUE_BACKEND=bullmq`, `bot-worker.js:1654`) | Redis | DLQ: rota sem tela; total 1×/dia. Profundidade da fila: **nenhum lugar** |
| Supervisor heartbeat, quarentena, circuit breaker | Redis (`supervisor/index.js:461-496`, `operationalCounters.js`) | — | Sim (`system/observability`) |
| `CapacitySnapshot/Alert/Event` | sweep 1 h (`ops/capacity/sweep.js:17`) | 90 d / 365 d rollup | Sim (`/admin/capacidade`) |
| `/metrics` Prometheus | `server.js:663` | — | Nenhum coletor no repositório |
| `AdminAuditLog` | toda rota admin | 180 d | Só 2 leituras (`admin.js:3295` acessos liberados, `:3721` telemetria). **Não há tela "quem fez o quê"** |

### 3.2 Lacunas (só via SSH/script ou não medido)

- **Não medido em lugar nenhum:** profundidade da fila de envio em memória/BullMQ; tempo entre oferta chegar e sair (latência de espelhamento); uso real de recursos PRO; quantos clientes com chave de loja recusada **agora** (só sondagem ao vivo nos scripts).
- **Medido, só em script:** 403 do WhatsApp por chip (`wa-forbidden-report`), vagas ocupadas/recusas (`diag-vagas-robos`, `diag-clientes-sem-vaga`), loja não suportada, LTV/churn/motivo, segmentos de contato semanal, assinatura divergente do MP (`sincronizar-assinatura`), código velho nos workers após deploy (`diag-ofertas-com-imagem` lê `ops/codeVersion`).
- **Medido, só em log de arquivo (`bot.log`):** cegueira por frota (`diag-frota-cega`), "Aguardando mensagem", domínio próprio, tamanho de thumb.

### 3.3 Alertas proativos

Só e-mail (`src/email/adminAlerts.js`, destino `ADMIN_ALERT_EMAIL`, padrão fixo em `:26`, silêncio 24 h `:29`). Oito gatilhos (`registry.js`): `admin_conexao_falhou`, `admin_vagas_acabando` (≤2 vagas, 15 min, silêncio 12 h), `admin_cobranca_recusada`, `admin_cobranca_maquina_parada`, `admin_api_com_erro` (só schema divergente), `admin_numero_repetido`, `admin_teste_repetido`, `admin_pagamento_com_falha`.

**Sem alerta para a dona** (é "entrar e olhar"):

| Situação | Hoje |
|---|---|
| Robô de **pagante** caído ou cego | só tela; e-mail vai para a **cliente** após 24 h (`lifecyclePolicy.js:229-271`) |
| Fila parada / DLQ > 0 | nada (total 1×/dia em métrica) |
| Swap ativo, OOM, disco ≥ 75 % | `CapacityAlert` só em log/tabela (`server.js:751-755`); Telegram só se o cron `healthcheck_alerts.sh` existir **[hipótese: não confirmável pelo repo]** |
| Credencial de loja vencida | só a cliente |
| Supervisor morto com API viva | `/health` responde ok sem checar (`server.js:656`) |
| Código velho nos workers após deploy | `ops_stale_worker_code` só log (`server.js:799`) |
| Erro 5xx / banco fora | nada por e-mail |

Comando para confirmar o cron do healthcheck (decide se Telegram existe; vazio = não existe):
```bash
crontab -l 2>/dev/null | grep -c healthcheck_alerts
```

### 3.4 Consistência: mesma métrica, contas diferentes

| Conceito | Definições encontradas |
|---|---|
| **Pagante** | (a) `payingStatus.js:31-42` + `payingLoader.js:105-116`: Payment aprovado e acesso vigente — **a canônica**; (b) `admin.js:1042-1049` (online): Payment **ou** SubscriptionCharge aprovada; (c) `admin.js:772` (overview) e `:2060` (finance), `:2422` (roi): `plan IN PAID_PLANS` + vencimento — **usa `plan`, proibido por `payingStatus.js:7-9`**; (d) `ltvRetention.js:98-130`: cobertura do pagamento + 7 dias de carência. `PAID_PLANS` definido 4× (`admin.js:58`, `lifecyclePolicy.js:40`, `manualPayment.js:3`, `checkoutOffer.js:23` — este sem `premium`) |
| **Online** | `admin.js:827-833` (connected, ou connecting com heartbeat ≤ 2 min); overview `:779` (só connected); `sessionOwnership.js:40` (stale 5 min); `supervisor/index.js:484` e `sessionCore.js:44` (90 s); funil "já conectou" inclui quem tem `phone` (`service.js:705-714`) |
| **Ativo** | `user.status='active'` (= não bloqueado, `admin.js:770`); `service.js:473` (plano ≠ trial + vigente); `getSubscriptionStatus` (`admin.js:209-215`, vence em > 7 d); `ltvRetention.js:117` |
| **Em risco / stale** | `buildRiskFlags` (`admin.js:573-593`) por `plan`; "Pagante em risco" em `service.js:338-342` por everPaid; `success/metrics` stale **sem** filtro de plano (`:1886`) |
| **Erros 24 h** | `overview.errors24h`, `logs/summary 24h` (`ErrorVolumeCard`), `errors/observability` — três fontes, três classificações |
| **Cegueira** | 20 min no worker (`receptionHealth.js`) × 3 h no painel (`admin.js:855`) |

### 3.5 Performance e custo (política de memória do `AGENTS.md`)

| Ponto | Arquivo | Custo | Proposta (sem RAM nova) |
|---|---|---|---|
| Polling 15 s sem `visibilityState` + auditoria por leitura | `online/page.js:302`, `admin.js:1536`, `admin.js:681` | ~5.760 consultas 48 h + 5.760 linhas `AdminAuditLog`/dia por aba | polling 60 s só com aba visível; **não auditar leituras repetitivas** (auditar só escrita e exportação) |
| `logs/summary` sem `take`, até 30 d | `admin.js:3390-3409` | carrega todo `MessageLog` do período em memória da API (500 MB de teto PM2) | `groupBy` no SQLite ou teto 20k como em `errors/observability` |
| `system/observability` sem `take` 24 h | `admin.js:1692` | idem | `groupBy status` |
| `buildFleetScenarios`: eventos 48 h sem `take` + `distinct` do Prisma em memória | `admin.js:871-891` | roda a cada polling | `groupBy userId` |
| Funil `user.findMany` sem take | `service.js:625` | 26 semanas | aceitável hoje; teto por coorte |
| `GET /batches` N+1 (120 queries) | `adminEmails.js:330-335` | leve | um `groupBy` |
| `AnalyticsEvent` sem retenção | `schema.prisma:824` | cresce para sempre | retenção 90 d para `ops_*` (confirmar tamanho antes) |

Comando para medir o custo real da auditoria de leitura (decide prioridade do item 1):
```bash
sqlite3 prisma/prod.db "SELECT action, COUNT(*) FROM AdminAuditLog WHERE createdAt > datetime('now','-7 days') GROUP BY action ORDER BY 2 DESC LIMIT 10"
```
E o tamanho do `AnalyticsEvent`:
```bash
sqlite3 prisma/prod.db "SELECT COUNT(*), MIN(createdAt) FROM AnalyticsEvent WHERE event LIKE 'ops_%'"
```

**Memória de qualquer proposta deste documento:** todas são leitura/escrita em rotas já existentes, sem processo PM2 novo, sem cache em memória, sem fila nova → **zero RAM adicional**. A única exceção sinalizada é o item "alertas" se for feito por processo separado — a proposta é rodar dentro dos `setInterval` da API que já existem (`server.js:817-832`), também sem RAM nova.

### 3.6 Segurança das ações

| Ação | Permissão | Motivo obrigatório | Confirmação na tela | Auditoria |
|---|---|---|---|---|
| Reconectar robô | tech:write | não | **não** (online e Início) | sim |
| Bloquear/banir (`users/:id/block`) | **support:write** (mesmo nível de registrar contato) | sim | sem tela | sim |
| Ajustar plano/acesso | billing:write | ≥5 chars | não | sim |
| Pagamento manual | billing:write | opcional | não | sim |
| Estorno | billing:write | sim | confirm | sim |
| DLQ retry/apagar/**purge** | admin:write | **não** | sem tela | sim |
| Reprocessar DLQ pagamento | MFA | não | **não** | — |
| Pagar elegíveis do mês (afiliados) | billing:write | não | **não** | sim; approve/reject/override **não** |
| Envio e-mail em massa | admin:write | `confirmTotal` **opcional** (`adminEmails.js:296`) | confirm | sim |
| WhatsApp em massa | support:write | sem trava de repetição (`:540`) | confirm | sim |
| Desligar staging | tech:write | não | confirm só em Capacidade | sim |
| Fila de sucesso | — | — | **lista de e-mails fixa no código** (`sucesso-cliente/page.js:11`) | — |

Falta: tela de auditoria ("quem fez o quê"), padrão único de confirmação dupla para destrutivas (purge, ban, pagar em massa, apagar conta), e papel separado para destrutivas.

---

## 4. Ações que faltam (hoje = terminal/SQL)

Risco: **B** baixo (reversível) · **M** médio · **A** alto (irreversível ou afeta terceiros). "2×" = confirmação dupla (digitar e-mail/valor + motivo).

| Ação | Onde deveria ficar | Risco | Confirmação | Reaproveitar |
|---|---|---|---|---|
| Parar robô (marca `stopped_by_user`) | Ficha 360° / caixa de entrada | B | simples + motivo | `scripts/parar-sessao.mjs:36` (mesmo comando do painel da cliente via `manager`) |
| Reconectar com confirmação e motivo | idem | B | simples | rota existente `admin.js:1555` |
| Sincronizar assinatura com o MP | Ficha → Financeiro | M (grava `Subscription`) | simples, mostra diff antes | `sincronizar-assinatura.mjs` (importar a função, não o script) |
| Testar renovação (6 elos) | Ficha → Financeiro | B (read, rede MP) | — | `testar-recorrencia.mjs` |
| Diagnóstico de cobrança recusada | Ficha → Financeiro | B | — | `diag-assinatura-recusada.mjs --no-live` |
| Ver / reprocessar / apagar DLQ de envio | Ficha → Robô; Operação | M / **A** (purge) | retry simples; purge 2× | rotas `admin.js:3814-3870` já prontas |
| Diagnóstico de conexão | Ficha → Robô | B | — | `diag-nao-conecta.mjs` (reescrever como módulo em `src/domain/admin/`) |
| "Por que não envia" (elo por elo) | Ficha → Robô | B | — | `diag-envios-vazios.mjs`, `diag-fila-grupo.mjs` |
| Testar chave de loja do cliente | Ficha → Lojas | B (rede Shopee/ML) | — | `diag-shopee-chave.mjs`, `credentialExpiry/sweep.js` (já sonda diariamente; expor o último resultado) |
| Reenviar e-mail (senha, voucher, vencimento) | Ficha → Contato | B | simples | motor de e-mail (`adminEmails.js:214` já faz teste) |
| Mandar WhatsApp para o cliente | Ficha → Contato | M | simples (hoje sem) | `adminEmails.js:497` |
| Bloquear / desbloquear | Ficha → Conta | **A** | 2× + motivo + papel `admin`/`owner` | rotas `admin.js:3102, :3137` (subir permissão) |
| Exportar / anonimizar LGPD | Ficha → Conta | **A** | 2× | `domain/lgpd/dataRequest.js` via `lgpd_data_request.mjs` |
| Apagar conta | Ficha → Conta | **A** | 2× + e-mail digitado | `apagar-conta.mjs` (só owner) |
| Apontar grupos para template / editar template da cliente | Ficha → Espelhamento | M | simples, mostra antes/depois | `apontar-grupos-para-template.mjs`, `definir-template-espelhamento.mjs` |
| Ajustar limite de automações | já existe | B | adicionar confirm | — |
| Gerar lista de contato da semana (CSV) | Caixa de entrada → "Contato da semana" | B (dado pessoal) | — | `outreachSegments.js` (puro, sem rota) |
| Marcar ocupantes de vaga / recusas | Operação → Capacidade | B | — | `diag-vagas-robos.mjs`, `diag-clientes-sem-vaga.mjs` |
| Ver auditoria (quem fez o quê) | Operação → Auditoria | B | — | `AdminAuditLog` |
| Pagar elegíveis do mês com confirmação | Receita → Afiliados | **A** (dinheiro) | 2× com total | rota existente |

---

## 5. Proposta de arquitetura de informação

### 5.1 Menu novo (5 entradas, 7 telas a menos)

Eixo proposto na tarefa, mantido com um ajuste: **Crescimento** absorve Funil + canais; **Afiliados** e **E-mails/Contato** viram abas de Receita e de Clientes, não entradas de menu.

| Menu | Tela | Pergunta que responde |
|---|---|---|
| **Hoje** | caixa de entrada priorizada | o que precisa de mim agora |
| **Clientes** | lista + ficha 360° | quem é, como está, o que faço |
| **Receita** | MRR/pagantes/cobranças/churn/LTV/ROI + Afiliados | quanto entra, quem some, quanto custa |
| **Crescimento** | funil 7 etapas + motivos + origens/UTM | onde as pessoas param |
| **Operação** | capacidade + filas/DLQ + erros + auditoria + staging | o servidor aguenta, o que quebrou |

Config (planos LP, FAQ, termos, tutorial, modelos de e-mail) fica em **Operação → Conteúdo e modelos** (uso raro, não merece menu).

### 5.2 Mapa tela antiga → destino

| Tela antiga | Destino | Ação |
|---|---|---|
| Início (semáforo + cards) | **Hoje** | fundir (cards de cenário viram linhas da caixa) |
| Início → aba Online | Hoje + Ficha 360° | apagar aba |
| Início → aba Sucesso | Hoje (filtro "atendimento") | apagar aba |
| Início → aba Financeiro | **Receita** | mover |
| Início → aba Afiliados | Receita → Afiliados | apagar aba (já existe `/admin/afiliados`) |
| Início → aba Observabilidade / Config | Operação | mover |
| `/admin/online` | Hoje (filtro "robô") + Ficha | apagar página; manter 1 drawer |
| `/admin/observabilidade` | Operação → Saúde | apagar (GO/NO-GO vira 4 chips) |
| `/admin/erros` | Operação → Erros | manter, única fonte de erro |
| `/admin/capacidade` | Operação → Capacidade | manter + ocupantes de vaga |
| `/admin/clientes`, `/[id]` | **Clientes** | manter, ficha vira centro |
| `/admin/sucesso-cliente` | Hoje | apagar (contact-log e ajustar plano vão para a ficha) |
| `/admin/funil` | **Crescimento** | manter |
| `/admin/marketing-growth` | Crescimento → aba Canais (só `CampanhaCanaisFunil`) | apagar o resto |
| `/admin/emails` | Clientes → Contato em massa + Operação → Modelos | dividir |
| `/admin/afiliados` | Receita → Afiliados | mover |
| `/admin/pipeline` | fora do admin (ferramenta de dev) | apagar do menu |
| `/admin/teste-shard` | Operação → Experimentos (só com env ligada) | esconder |

### 5.3 Caixa de entrada "Hoje" (wireframe textual)

Prioridade = **peso financeiro × gravidade × tempo**. Peso: pagante (`payingStatus` canônico) 3 · ex-pagante 2 · trial com oferta publicada 1,5 · lead 1. Gravidade: robô caído/cego 3 · cobrança recusada 3 · credencial recusada 2 · parou de enviar 2 · vence em 5 d 1,5 · nunca publicou 1. Cada linha tem a **ação primária** à direita e "ver ficha" como secundária. Regra herdada de `outreachSegments.js`: **cada cliente aparece em uma linha só**, a de maior prioridade.

```
┌ Hoje ────────────────────────────────────────────── [Atualizar] ┐
│ 19/900  Hoje                                                      │
│ 13/400  O que precisa de você agora, do mais caro ao mais barato. │
│                                                                   │
│ [chip --danger] 4 pagantes sem robô   [chip --warn] 3 cobranças   │
│ [chip --accent-2] 6 trials parados    [chip --bg-soft] 2 infra    │
│                                                                   │
│ ── Agora (pagantes) ─────────────────────────────────────────── │
│ ● Ana P.  $  Robô caído há 3 h · "ela desconectou pelo celular"   │
│                        [Reconectar] [WhatsApp] [Parar robô] ficha │
│ ● Bia L.  $  Conectada e sem receber há 4 h                       │
│                        [Reconectar] [Diagnóstico]           ficha │
│ ● Carla   $  Cobrança recusada ontem (cartão)                     │
│                        [Sincronizar MP] [Reenviar cobrança] ficha │
│ ── Esta semana ──────────────────────────────────────────────── │
│ ○ Dani    trial  Publicou 12 ofertas, não foi ao pagamento        │
│                        [E-mail voucher] [WhatsApp]          ficha │
│ ○ Eva     trial  Conectou e nunca cadastrou loja (dia 6)          │
│                        [E-mail "cadastre a loja"]           ficha │
│ ── Servidor ──────────────────────────────────────────────────── │
│ ▲ Swap em uso há 2 h · 71/80 vagas            [Ver capacidade]    │
│ ▲ Fila de envio: 3 trabalhos parados (2 clientes)  [Ver DLQ]      │
│                                                                   │
│ ▸ Contato da semana (10 grupos, CSV)                              │
└───────────────────────────────────────────────────────────────────┘
```
Tokens: fundo `--bg`, cards `--surface` raio 18 borda `--line`, pagante `$` em `--accent-strong`, caído `--danger`, cobrança `--warn`, trial `--accent-2`, texto `--ink`/`--ink-soft`, Figtree, botão primário pílula verde, um por linha.

### 5.4 Ficha 360° do cliente (wireframe textual)

```
┌ ← Clientes                                                        ┐
│ 19/900  Ana Paula · ana@…  [$ Pagante] [PRO] [2 números]          │
│ 13/400  Cliente desde 12/03 · vence 30/10 · R$ 540 pagos          │
│ Cabeçalho (6 números, guardado por teste):                        │
│  Situação | Plano | Vence em | Total pago | Envios 30d | Quedas 7d │
│                                                                   │
│ Abas: Robô · Financeiro · Lojas · Espelhamento · Contato · Conta  │
│ ── Robô ─────────────────────────────────────────────────────── │
│  Estado: caído há 3 h · motivo: "ela desconectou pelo celular"    │
│  [Reconectar] [Parar robô] [Diagnóstico de conexão] [Ver DLQ (2)] │
│  Quedas 7 d (8 linhas) · Por que caiu · Grupos derrubando         │
│ ── Financeiro ──────────────────────────────────────────────── │
│  Assinatura MP: ativa · próxima cobrança 30/10 · último webhook ok │
│  [Sincronizar com MP] [Testar renovação] [Ajustar plano] [Pgto manual] │
│  Pagamentos (8) · Acessos liberados na mão (8) · LTV              │
│ ── Lojas ───────────────────────────────────────────────────── │
│  Shopee: chave ok (sondada hoje) · ML: código vencido há 2 d       │
│  [Testar chave] [E-mail "renove o código"]                        │
│ ── Espelhamento ────────────────────────────────────────────── │
│  3 origens → 2 destinos · template "Padrão" · marca d'água on     │
│  [Apontar grupos para template] [Editar template]                 │
│ ── Contato ─────────────────────────────────────────────────── │
│  Último contato 20/09 (WhatsApp) · follow-up 05/10                │
│  [Registrar contato] [WhatsApp] [Reenviar e-mail ▾]               │
│ ── Conta ───────────────────────────────────────────────────── │
│  Origem do cadastro · termos · último acesso · automações [editar] │
│  [Bloquear 2×] [Exportar LGPD] [Anonimizar 2×] [Apagar conta 2×]  │
│ ── Linha do tempo (só marcos) ──────────────────────────────── │
└───────────────────────────────────────────────────────────────────┘
```
Regras herdadas de `docs/rca/admin.md`: cabeçalho 6 números, 8 linhas por lista, só marcos na linha do tempo, linguagem leiga, telefone mascarado por papel. Botões destrutivos em `--danger` com gaveta de confirmação (nível 2), nunca formulário aberto.

### 5.5 Receita, Crescimento, Operação (resumo)

- **Receita:** 4 KPIs (MRR, pagantes **canônicos**, cobranças recusadas 30 d, churn mensal com motivo voluntário/involuntário de `churnReason.js`), tabela de cobranças com [Sincronizar MP], LTV por coorte (`ltvRetention.js`), ROI/custos (já existe), aba Afiliados (tela atual com confirmação 2× no pagamento em massa).
- **Crescimento:** `/admin/funil` como está + aba Canais com `CampanhaCanaisFunil`. Cada "falar com" ganha [E-mail] e [WhatsApp] inline.
- **Operação:** Capacidade (atual + ocupantes de vaga + recusas) · Filas (DLQ por cliente com retry/purge 2×, profundidade da fila) · Erros (`/admin/erros`, única fonte) · Saúde (4 chips: banco, 5xx, supervisor, código dos workers) · Auditoria (quem fez o quê, 30 d) · Conteúdo e modelos · Experimentos (teste-shard, só com env).

---

## 6. Plano de execução

Cada fatia = 1 PR contra `develop`, com teste. **RAM: todas zero** (leitura/rotas existentes, sem processo novo, sem cache em memória). Impacto ●●● alto · esforço ◔ ≤1 dia, ◑ 2-3 d, ● 1 sem.

### Quick wins (≤ 1 dia cada)

| # | Título | Problema | Arquivos | Critério de aceite | Impacto |
|---|---|---|---|---|---|
| Q1 | Polling do Online: 60 s, só aba visível, sem auditar leitura | 5.760 consultas + linhas de auditoria/dia | `dashboard/app/admin/online/page.js:302`, `src/api/routes/admin.js:1536` | teste falha se `setInterval` < 60 s ou sem `visibilityState`; `admin.online.read` não grava mais | ●●● |
| Q2 | `logs/summary` e `system/observability` com `groupBy` ou teto 20k | lê `MessageLog` inteiro | `admin.js:3409`, `:1692` | teste com 25k linhas não passa de 20k em memória; números iguais aos de antes | ●●○ |
| Q3 | Pagante canônico no overview/finance/roi | 4 definições | `admin.js:772, 2060, 2422` → `payingLoader` | teste `admin-paying-tag` falha se `plan: { in: PAID_PLANS }` significar pagante em `admin.js` | ●●● |
| Q4 | Confirmação + motivo em reconectar, DLQ reprocessar, pagar elegíveis, WhatsApp individual | destrutivas sem confirm | `online/page.js:316`, `page.js:2513`, `observabilidade:157`, `afiliados:462`, `emails:625` | `test/dialogos-no-celular` cobre; grep por `confirm(` nas 5 ações | ●●○ |
| Q5 | Apagar Marketing & Growth (mantendo `CampanhaCanaisFunil` em `/admin/funil`) | dados fictícios | `marketing-growth/*`, `funil/page.js`, `lib/api.js:470-509` | tela some; teste `campanha-canais-funil` passa; rotas `marketing/*` só as usadas | ●●○ |
| Q6 | Tirar Pipeline e Teste-shard do menu; esconder shard sem env | ferramentas de dev no admin | `page.js:2919-2920` | link só com `tech:read` **e** env; teste de nav | ●○○ |
| Q7 | Lista de e-mails fixa → permissão | `sucesso-cliente/page.js:11` | idem + `ROLE_PERMISSIONS` | grep falha se e-mail literal em `dashboard/app/admin` | ●○○ |
| Q8 | Auditoria em approve/reject/settings/override de afiliados; `confirmTotal` obrigatório no envio em massa | escritas sem rastro | `affiliate.js:392, 411, 598, 670`, `adminEmails.js:296` | teste de rota verifica `AdminAuditLog` | ●●○ |
| Q9 | Mover scripts obsoletos para `scripts/arquivo/` + README | 20+ scripts one-shot no meio dos úteis | `scripts/` | lista do apêndice B(c); testes que importam continuam passando | ●○○ |

### Fatias médias (2-3 dias)

| # | Título | Problema | Arquivos | Critério de aceite |
|---|---|---|---|---|
| M1 | `sessionLiveness.js`: uma janela de "online/cego" | 3 janelas de heartbeat, 2 de cegueira | novo `src/domain/session/sessionLiveness.js`; `admin.js:827-833, 855`, `sessionOwnership.js:40` | todas as rotas importam; teste puro |
| M2 | Ficha 360° — aba Robô com ações | ver sem agir | `clientes/[id]/page.js`; rotas `online/:id/reconnect`, nova `POST /users/:id/session/stop` (usa `manager` como `parar-sessao.mjs`), `GET /send-dlq/:userId` | reconectar/parar/DLQ na ficha com confirm + motivo; auditados |
| M3 | Ficha 360° — aba Financeiro com Sincronizar MP + Testar renovação | só SSH | nova `src/domain/payments/subscriptionSync.js` extraída de `sincronizar-assinatura.mjs`; script passa a importar | mostra diff antes de gravar; `billing:write`; teste puro da extração |
| M4 | Alertas para a dona (dentro dos sweeps existentes) | nada avisa | `src/email/adminAlerts.js`, `registry.js`, `server.js:296-307` (sweep 15 min) | 5 gatilhos: pagante caído > 2 h, cego > 3 h, DLQ > 0, swap ativo + < 20 % RAM, supervisor sem heartbeat; silêncio 12 h; teste de política puro. **RAM zero** (mesmo `setInterval`) |
| M5 | Tela Operação → Filas (DLQ por cliente) | rotas sem tela | nova `dashboard/app/admin/operacao/filas/page.js`; rotas `admin.js:3814-3870` | listar/retry/purge 2×; teste de visibilidade |
| M6 | Credencial de loja no painel | só a cliente sabe | expor último resultado de `credentialExpiry/sweep.js` por usuário; card na ficha → Lojas e linha na caixa | sem sondagem nova; dado vem do `AnalyticsEvent credential_expiry_alert_sent` |
| M7 | Retenção de `AnalyticsEvent ops_*` (90 d) | cresce para sempre | `server.js:202-208` | **antes**: rodar o `sqlite3` da seção 3.5; depois: `deleteMany` diário em lote |
| M8 | Tela Auditoria (quem fez o quê) | log gravado, nunca lido | nova rota `GET /audit?days=30` + tela em Operação | filtra por ação/alvo; só `owner`/`admin` |

### Fatias grandes (1 semana)

| # | Título | Problema | Arquivos | Critério de aceite |
|---|---|---|---|---|
| G1 | Caixa de entrada "Hoje" | semáforo sem ação, fila em outra tela | nova `src/domain/admin/inboxPriority.js` (puro, herda `outreachSegments.js` + cenários de `buildFleetScenarios`) + `GET /admin/inbox` + tela; depois apagar abas Online/Sucesso do Início | 1 cliente = 1 linha; ordem por peso×gravidade; cada linha com ação; teste puro da prioridade; RAM zero (reusa consultas do `/online`) |
| G2 | Quebrar `page.js` em Receita e Operação | 3.780 linhas | `page.js` → `receita/page.js`, `operacao/page.js`; apagar `/admin/observabilidade` | nenhuma tela > 600 linhas; testes `admin-painel-inicio` adaptados |
| G3 | Receita: churn com motivo, LTV por coorte | módulos sem rota | rotas sobre `ltvRetention.js`, `churnReason.js` | números iguais aos dos `diag-ltv-retencao` / `diag-motivo-nao-renovou` |
| G4 | Diagnóstico de 1 cliente no painel | `diag-nao-conecta`, `diag-envios-vazios` só SSH | extrair regras para `src/domain/admin/diagnostics/*.js`; scripts passam a importar; rota `GET /users/:id/diagnostico` | saída em frases leigas; sem `bot.log` (só banco/Redis); teste puro |
| G5 | Design system no admin | Tailwind cinza, sem tokens | migrar telas novas para `pnl-*`/tokens; adicionar seção "Admin" ao DS v2 (decidir com a dona antes) | `test/painel-escala-de-fontes` passa no admin |

**Ordem sugerida:** Q1 → Q3 → Q4 → Q2 → M1 → M4 → M2 → G1 → M3 → M5/M6 → G2 → demais. Q1 e Q3 mudam número que a dona já olha todo dia: avisar antes do deploy em `main`.

---

## Apêndice A — rotas admin (resumo por grupo)

Permissões: `owner` tudo; `admin` sem `admin:write`/`billing:write`; `billing_admin`; `support`; `tech_support`; `read_only` (`admin.js:45-52`).

| Grupo | Rotas (linha em `admin.js`) | Perm. | Auditada | Tela que usa |
|---|---|---|---|---|
| Visão geral | `GET /overview` (1508) | admin:read | sim | Início |
| Clientes | `GET /users` (1515), `/users/wa-disconnected` (1522), `/users/:id` (3165), `/customers` (3252), `/customers/:id/history` (3262), `/automation-quota` (3902) + PATCH (3958) | support:read/write | sim | Início, clientes, [id] |
| Acesso/plano | `POST /users/:id/access` (3058) billing:write; `/block` (3102), `/unblock` (3137) support:write | — | sim | Início, sucesso; **block sem tela** |
| Online | `GET /online` (1533), `/online/:id` (1613), `POST /online/:id/reconnect` (1555, tech:write) | support:read | sim | Início, online |
| Sucesso | `/success/overview` (1737), `/queue` (1776), `/metrics` (1865), `POST /users/:id/contact-log` (1933) | support | sim | Início, sucesso |
| Financeiro | `/finance/overview` (1986), `/subscription-charges` (2192), `PUT /finance/costs` (2327), `/finance/roi` (2360), `/payments` (2526), `POST /payments/:id/refund` (2565), `POST /payments/manual` (2590), `/subscriptions` (2942), `/billing/webhooks` (2904) | billing | sim | Início → Financeiro |
| Marketing | `/marketing/*` (2632-2870) | admin:read | sim | marketing-growth |
| Funil | `/funnel` (3245) | support:read | sim | funil |
| Logs/erros | `/logs` (3345), `/errors/observability` (3352), `/logs/summary` (3387) | support:read | sim | Início, erros, observabilidade |
| Sistema | `/system/health` (1627), `/metrics` (1666), `/observability` (1677), `/session-telemetry` (3718), `/sessions` (3741) | tech/support | sim | Início, observabilidade |
| Capacidade | `/capacity/*` (1430-1464), `/qualidade-entrega` (1478), `/staging-power` (3875/3885) | tech | parcial (GETs não) | capacidade, Início |
| DLQ envio | `/send-dlq/:userId` + retry/delete/purge (3814-3870) | admin:write | sim | **nenhuma** |
| Conteúdo | `/legal/terms`, `/lp-content/*`, `/faq*` (3468-3696) | admin | sim | Início → Config |
| Pipeline / shard | (1485-1492), (1362-1423) | tech | sim | pipeline, teste-shard |
| E-mails (`adminEmails.js`) | templates, send, batches, sends, summary, whatsapp/* (96-542) | admin / support | só escritas | emails |
| Afiliados (`affiliate.js`) | listas (203-590), approve/reject (392/411 **sem auditoria**), comissões (463-542), saques (243-270), settings/override (598/670 **sem auditoria**) | billing | parcial | afiliados, Início |

## Apêndice B — scripts por categoria

**(a) Precisam de rede externa ou segredo:** MP (`sincronizar-assinatura`, `testar-recorrencia`, `diag-assinatura-recusada`); Shopee (`diag-busca-shopee`, `diag-criar-oferta-shopee`, `diag-shopee-chave*`, `diag-shopee-foto`, `diag-fila-parada` e `diag-oferta-descartada` sem `--no-live`); ML (`diag-ml-shortlink`, `-cookie-poisoning`, `-rotacao-cookie`, `-muro-taxa`, `-social-featured`, `exp-ml-manter-viva`); Amazon (`diag-amazon-*`); SHEIN (`diag-shein-*`); Awin/Rakuten/Lomadee com flag; `creds.json` locais (`diag-aguardando-*`, `diag-identidade-aparelho`, `fix-assinatura-aparelho`).

**(b) Citados como procedimento em `AGENTS.md`/`docs/rca`:** `backfill-numeros-whatsapp`, `basic-sem-recursos-pro`, `diag-aguardando-mensagem`, `diag-amazon-clicks/-preco`, `diag-assinatura-recusada`, `diag-awin`, `diag-rakuten`, `diag-busca-shopee`, `diag-criar-oferta-shopee`, `diag-dominio-proprio`, `diag-email-vencimento`, `diag-fila-grupo`, `diag-fila-parada`, `diag-frota-cega`, `diag-identidade-aparelho`, `diag-lojas-nao-suportadas`, `diag-memoria-*`, `diag-mirror-duplicates`, `diag-ml-*`, `diag-nao-conecta`, `diag-oferta-descartada`, `diag-offer-review`, `diag-origem-cadastros`, `diag-paginas-seo`, `diag-preview-sem-imagem`, `diag-sem-etiqueta`, `diag-shopee-*`, `diag-tag-pagante`, `diag-thumb-por-origem`, `diag-vagas-robos`, `diag-clientes-sem-vaga`, `fix-assinatura-aparelho`, `sincronizar-assinatura`, `testar-recorrencia`, `contato-ativo-semanal`, `parar-sessao`, `quarantine-wa-message`, `conferir-voucher`, `diag-ltv-retencao`, `diag-funil-ativacao`, `diag-envios-vazios`, `diag-multi-numero-demanda`.

**(c) Obsoletos pela função (trabalho pontual já feito):** `cleanup-cookieless-flag`, `cleanup-test-fixture-users`, `migrate-credentials-encrypt`, `migrate-affiliate-pixkey-encrypt`, `migrate-group-template-null-to-relay`, `reset-legacy-botconfig-fields`, `seed-preservation-presets`, `seed-copy-variations`, `snapshot-image-mode`, `basic-sem-recursos-pro`, `backfill-numeros-whatsapp`, `desligar-rastreio-cliques`, `diag-mirror-duplicates`, `p2_*`, `p3_*`, `sprint_*.sh`, `instagram-story-poc`, `marketing-funnel-baseline`, `diag-shein-affiliate-link`, `diag-shein-shortlink`, `shopee-linktype-probe`, `debug-shopee-offers`. Nenhum aponta para tabela/arquivo inexistente; são obsoletos por já terem cumprido o papel. `apagar-conta.mjs` tem e-mail real de cliente no exemplo de uso: remover.

**Scripts que escrevem SEM flag de simulação:** `parar-sessao.mjs:36`, `reset-admin-password.mjs`, `run_channel_snapshots.mjs` (cron), `pressure-logs`.

## Apêndice C — dados de produção que faltam (comandos read-only)

| Decide | Comando (rodar em `~/wabot`) | Leitura |
|---|---|---|
| Prioridade de Q1 | `sqlite3 prisma/prod.db "SELECT action, COUNT(*) FROM AdminAuditLog WHERE createdAt > datetime('now','-7 days') GROUP BY action ORDER BY 2 DESC LIMIT 5"` | se `admin.online.read` for o maior, Q1 vai primeiro |
| Prioridade de M7 | `sqlite3 prisma/prod.db "SELECT COUNT(*) FROM AnalyticsEvent WHERE event LIKE 'ops_%'"` | > 500k = M7 sobe |
| Telegram existe? | `crontab -l 2>/dev/null \| grep -c healthcheck_alerts` | 0 = não há alerta de infra nenhum |
| Fila é BullMQ? | `pm2 env $(pm2 id bot-supervisor \| tr -d '[] ') \| grep -c QUEUE_BACKEND=bullmq` | 0 = DLQ de envio não existe em prod; M5 muda de escopo |
| Divergência de pagantes | `node scripts/diag-tag-pagante.mjs \| tail -n 5` vs. card do Início | diferença > 0 confirma Q3 |
| Tamanho de `logs/summary` | `sqlite3 prisma/prod.db "SELECT COUNT(*) FROM MessageLog WHERE sentAt > datetime('now','-30 days')"` | > 100k = Q2 urgente |
