# Ajuste dos Planos — Automações e Filas viram diferenciais do Pro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinhar os planos à realidade do produto. Basic (R$39) passa a ser "operação manual em grupos"; Pro (R$69) ganha como diferenciais, além de canais e Preservação Avançada (gates já existentes), as **ofertas automáticas Shopee** e as **filas de ofertas** (gates novos). Atualizar a copy pública dos planos removendo promessas de features desativadas.

**Architecture:** Reusar a camada de entitlement central em `src/billing/plans.js` (mesmo padrão de `canUseChannels`/`canUseAdvancedPreservation`), aplicando o gate em três camadas: rota da API (403 `FEATURE_REQUIRES_PRO`), runtime dos crons (dispatcher pula dono sem entitlement — cobre também acesso expirado) e dashboard (tela de paywall com badge "Pro" + CTA, sem esconder a feature). Copy via migration aditiva em `LpPlan` + atualização do fallback `DEFAULT_LANDING_PLANS`.

**Tech Stack:** Node.js/Fastify, Prisma/SQLite, Next.js dashboard, node:test.

---

## 1. Decisões de produto (fechadas com a Flávia em 2026-06-11)

Complementam (não substituem) as decisões de 2026-05-18 em
`docs/superpowers/plans/2026-05-18-reestruturacao-planos-botinho.md`.

1. **Ofertas automáticas Shopee e filas de ofertas viram features Pro** (e do Trial ativo). Basic não cria, edita nem executa.
2. **Sem grandfathering.** Não há usuários reais em produção (apenas Flávia + uma amiga). Migração dura: automações ativas e filas de usuários Basic são desativadas/pausadas na migração.
3. **Não anunciar nem considerar na copy**: OAuth do Mercado Livre, rastreamento de cliques/shortlinks, post para status e feed global (desativados) e o bot do Telegram (fica fora da oferta comercial; segue como ferramenta interna com autorização manual por chat ID).
4. **Remover "Warmup" da copy do Pro** — não existe feature com esse nome; substituir por nomes reais (cadência, horários de descanso, variação de copy, limites).
5. **Citar os 4 marketplaces nominalmente** (Mercado Livre, Amazon, Shopee, Magalu) em vez de "links suportados".
6. **UX de bloqueio** segue a decisão #4 de 2026-05-18: mostrar a feature com badge "Pro" e CTA de upgrade, não esconder.
7. Preços inalterados: Basic R$39, Pro R$69, Trial 7 dias com experiência Pro completa.

## 2. Estado atual relevante

- Entitlements: `src/billing/plans.js` — só `canUseChannels` e `canUseAdvancedPreservation`; ambos `hasProLikeAccess` (Pro ou Trial ativo). Erros via `buildFeatureGateError()` → `FEATURE_REQUIRES_PRO`.
- Automações: rotas em `src/api/routes/offerAutomation.js`; execução em `src/offerAutomation/dispatcher.js` + `cron.js`. **Sem gate de plano.**
- Filas: rotas em `src/api/routes/offerQueue.js`; execução em `src/offerQueue/dispatcher.js` + `cron.js`. **Sem gate de plano.**
- Acesso expirado já bloqueia início de sessão (`src/domain/session/service.js:43`), mas os crons de automação/fila não checam expiração do dono.
- Copy pública: tabela `LpPlan` (atualizada por migrations aditivas, ex. `prisma/migrations/20260518183000_update_lp_plan_positioning/`) com fallback em `dashboard/lib/marketing-content.js` (`DEFAULT_LANDING_PLANS`). Há ainda `dashboard/public/pricing.md`.
- Dashboard: `/painel/ofertas-automaticas`, `/painel/filas` sem paywall; `/painel/criar-oferta` oferece modo "fila" como destino do envio.
- Padrão de cache para hot path: `getAdvancedPreservationAccess()` (TTL 60s) em `plans.js`.

## 3. Tarefas

### Fase A — Entitlements e gates de API

- [x] **A1.** `src/billing/plans.js`: adicionar `FEATURE_CODES.OFFER_AUTOMATIONS` e `FEATURE_CODES.OFFER_QUEUES`; expor `canUseOfferAutomations()` e `canUseOfferQueues()` (= `hasProLikeAccess`) e incluí-los em `getPlanEntitlements()`. Estender `buildFeatureGateError()` com mensagens orientadas a benefício:
  - automações: `"As ofertas automáticas estão disponíveis no Trial ativo e no plano Pro."`
  - filas: `"As filas de ofertas estão disponíveis no Trial ativo e no plano Pro."`
- [x] **A2.** Generalizar o cache de `getAdvancedPreservationAccess` para um helper `getPlanAccess(userId, { db })` (TTL 60s, mesmo Map) que devolve os entitlements completos — evita um segundo cache paralelo. Manter `getAdvancedPreservationAccess` como wrapper para não tocar nos call sites existentes.
- [x] **A3.** `src/api/routes/offerAutomation.js`: bloquear `POST /`, `PUT /:id`, `POST /:id/run` e `GET /:id/preview` para quem não tem `canUseOfferAutomations` → 403 com `buildFeatureGateError(FEATURE_CODES.OFFER_AUTOMATIONS)`. `GET /` (lista) e `DELETE /:id` continuam liberados (UI precisa listar o que existe e o usuário pode limpar).
- [x] **A4.** `src/api/routes/offerQueue.js`: mesmo padrão — bloquear `POST /`, `PUT /:id`, `POST /:id/items`, `PUT /:id/items/:itemId` para não-entitled; `GET`s e `DELETE`s liberados.

### Fase B — Gate no runtime (crons)

- [ ] **B1.** `src/offerAutomation/dispatcher.js` (ou no ponto do `cron.js` que seleciona automações a rodar): antes de executar cada automação, checar `getPlanAccess(userId)`; se `canUseOfferAutomations` for falso (Basic OU acesso expirado), pular silenciosamente com log de aviso. Usa o cache de A2 — sem N+1 no tick do cron.
- [ ] **B2.** `src/offerQueue/dispatcher.js`: idem para drenagem de filas (`canUseOfferQueues`).

### Fase C — Migração de dados (sem grandfathering)

- [ ] **C1.** Migration aditiva (ou script idempotente em `scripts/`) que, para usuários com `plan='basic'`: desativa automações (`enabled/active = false` conforme o campo real do schema) e pausa filas (`enabled = false`). **Não apaga nada** — ao virar Pro, o usuário reativa manualmente. Antes de rodar em prod, conferir quantas linhas serão afetadas (esperado: zero ou quase, só 2 contas existem).
- [ ] **C2.** Validar em staging conforme pegadinha #8 do AGENTS.md se a migration tiver DDL (não deve ter — é só UPDATE/DML, convive com WAL).

### Fase D — Dashboard (paywalls)

- [ ] **D1.** Componente reutilizável de paywall (padrão da skill de paywalls): ícone de cadeado + nome da feature + 2–3 bullets de benefício + preço + CTA "Liberar com o Pro" (link para `/painel/plano`) + escape "Continuar sem". Tratar resposta 403 `FEATURE_REQUIRES_PRO` do client (`dashboard/lib/api.js`) de forma uniforme.
- [ ] **D2.** `/painel/ofertas-automaticas`: para Basic, renderizar a página em modo bloqueado (preview da feature + paywall), em vez de esconder do menu.
- [ ] **D3.** `/painel/filas`: idem.
- [ ] **D4.** `/painel/criar-oferta`: para Basic, a opção de envio "fila" aparece com badge "Pro" desabilitada (envio imediato e agendado seguem livres).
- [ ] **D5.** Copy do CTA com mental accounting: "R$69/mês — menos de R$2,30/dia" (opcional, um lugar só: card do Pro em `/painel/plano`).

### Fase E — Copy pública dos planos

- [ ] **E1.** Migration aditiva `update_lp_plan_automation_pro` com o novo conteúdo (abaixo).
- [ ] **E2.** Atualizar `DEFAULT_LANDING_PLANS` em `dashboard/lib/marketing-content.js` com o MESMO conteúdo (fallback precisa espelhar o banco).
- [ ] **E3.** Atualizar `dashboard/public/pricing.md` e revisar `dashboard/components/landing/Pricing.jsx` (badge do Pro: trocar "Canais + Preservação Avançada" por "Canais + Automação + Preservação").

**Conteúdo canônico dos planos:**

| Campo | Trial | Basic | Pro |
|---|---|---|---|
| title | `Teste grátis` | `Basic` | `Pro` |
| price | `R$0` | `R$39` | `R$69` |
| description | `Experimente por 7 dias tudo do Pro: grupos, canais, ofertas automáticas, filas e o Módulo de Preservação Avançada.` | `Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.` | `Piloto automático e escala: tudo do Basic + canais, ofertas automáticas, filas de envio e Módulo de Preservação Avançada.` |

features (JSON):

```json
// trial
["Tudo do plano Pro por 7 dias","Espelhamento em grupos e canais","Ofertas automáticas e filas de envio","Módulo de Preservação Avançada","Relatórios de envio completos"]
// basic
["Espelhamento de grupos (monitor → destinos)","Conversão de links: Mercado Livre, Amazon, Shopee e Magalu","Criar oferta a partir de link (título, preço e imagem)","Envio imediato e agendado","Templates de mensagem personalizáveis","Relatórios de envio com histórico completo"]
// pro
["Tudo do Basic","Monitoramento e envio em canais","Ofertas automáticas da Shopee (palavra-chave, filtros e dedup inteligente)","Filas de ofertas com limites por hora e por dia","Módulo de Preservação Avançada (cadência, horários de descanso, variação de copy e limites)"]
```

Proibido na copy: warmup, OAuth ML, rastreamento de cliques, post para status, feed global, bot do Telegram.

### Fase F — Testes

- [x] **F1.** Estender `test/billing-plans.test.js`: novos entitlements por plano/trial ativo/expirado; `buildFeatureGateError` para os dois feature codes novos.
- [x] **F2.** Novo `test/api/routes/offer-automation.plan-gates.test.js` (espelhar o padrão de `test/api/routes/broadcast.plan-gates.test.js`): Basic recebe 403 em create/update/run/preview; Pro e Trial ativo passam; lista continua acessível.
- [x] **F3.** Novo `test/api/routes/offer-queue.plan-gates.test.js`: idem para filas.
- [ ] **F4.** Teste de dispatcher: automação/fila de dono Basic (ou com acesso expirado) é pulada sem erro.
- [ ] **F5.** Rodar a suíte completa (`node --test`) e o guard do dashboard (`npm run guard:config-page`).

### Fase G — Deploy

- [ ] **G1.** PR contra `develop` (nunca `main`). Autodeploy de staging aplica a migration de copy e a de dados.
- [ ] **G2.** Validação manual em staging (`http://178.105.54.0:3006`): landing mostra a nova copy; conta Basic vê paywalls e recebe 403 nas rotas; conta Pro/Trial opera normal; cron não executa automação de Basic.
- [ ] **G3.** Só depois: PR `develop → main`. Rodar `scripts/backup_prod.sh` antes do deploy de prod (há migration de dados).

## 4. Fora de escopo (registrado para o futuro)

- Plano anual com desconto como âncora de preço (em vez de um 3º tier).
- Tela de trial expirado no painel (resumo do que o usuário realizou + CTA) — hoje o bloqueio de sessão expirada já existe; a tela é melhoria de conversão.
- Vínculo Telegram ↔ conta de usuário (pré-requisito se um dia o bot entrar na oferta comercial).
- Reativar e reintroduzir na copy: OAuth ML, rastreamento de cliques, post para status, feed global.
