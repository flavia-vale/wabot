# Reestruturação dos Planos do BOTinho Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar os planos para que o Basic de R$39 cubra apenas operação com **grupos**, enquanto o Pro cubra **grupos + canais + Módulo de Preservação Avançada**.

**Architecture:** A mudança deve separar três responsabilidades que hoje estão misturadas: definição comercial dos planos, autorização técnica por plano e apresentação/upgrade no dashboard. Criar uma camada central de entitlement evita espalhar `if (plan === 'pro')` em rotas, worker e componentes, reduz regressões em pagamentos e mantém o deploy seguro em staging antes de produção.

**Tech Stack:** Node.js/Fastify API, Prisma/SQLite, Next.js dashboard, React client components, node:test.

---

## 1. Resumo executivo

A estrutura atual já tem os campos necessários para diferenciar `trial`, `basic` e `pro` no usuário e já diferencia destinos `group` e `channel` na tabela `Group`. Porém, não há uma camada central de autorização por feature/plano: a API permite cadastrar canais para qualquer usuário autenticado, o dashboard exibe o botão de adicionar canal sem consultar o plano, e o worker carrega todos os grupos/canais cadastrados independentemente do plano.

Portanto, a reestruturação não exige, em princípio, uma migration de banco obrigatória para armazenar os novos planos. A parte de maior risco é de **contrato de produto**: usuários Basic existentes que já cadastraram canais precisam ser tratados para não continuar usando canais após a mudança, sem apagar dados. A recomendação é bloquear uso/criação/execução de canais no Basic, manter os registros no banco como “preservados”, e mostrar CTA de upgrade para Pro.

---

## 2. Estado atual encontrado no código

### 2.1 Dados e pagamentos

- `User.plan` é `String` com default `trial`, então hoje o sistema não tem enum rígido nem migration obrigatória para adicionar/remover planos.
- `Group.kind` é `String` com default `group`, então grupos e canais já compartilham a mesma entidade.
- `Payment.plan` armazena o plano pago aprovado.
- `LpPlan` guarda conteúdo público editável de landing/admin, com `features` em JSON string.
- O checkout aceita somente os planos presentes em `getBillingPlans()`; os defaults atuais são `basic` R$39 e `pro` R$69.
- A ativação de pagamento atualiza `User.plan` e `accessExpiresAt`, sem aplicar entitlements ou efeitos colaterais específicos de feature.

### 2.2 Conteúdo comercial

- `DEFAULT_LANDING_PLANS` hoje descreve Basic como “mesmos recursos essenciais do Pro mantendo anúncios” e Pro como “mesmos recursos do Basic, sem anúncios”. Isso conflita com a nova regra.
- A landing declara “Basic com anúncios e Pro sem anúncios”; essa comparação precisa virar “Basic para grupos” vs “Pro com grupos, canais e Módulo de Preservação Avançada”.
- A FAQ já fala em intervalos, filtros anti-spam e cadência responsável, mas precisa evitar promessa absoluta. A nova copy deve usar “Módulo de Preservação Avançada” e explicar redução de risco por cadência/limites/aquecimento, sempre com ressalva de que nenhum software elimina risco de bloqueio.

### 2.3 API de grupos/canais

- `groupsRoutes` aceita `kind` como `group` ou `channel` e permite cadastrar canais para qualquer usuário autenticado.
- Endpoints de canal (`resolve-channel-invite`, `resolve-channel-jid`, `follow-now`, `refresh-admin`, `wa/channels`) não verificam o plano.
- Alvos (`/:id/targets`) aceitam posts de qualquer `kind`; isso permite que monitor Basic direcione para canal se o canal existir.

### 2.4 Worker e envio

- `loadConfig()` carrega todos os grupos do usuário, incluindo canais, e repassa ao worker.
- `ensureChannelSubscriptions()` se inscreve nos canais monitorados presentes na config.
- O path de envio para canal já sanitiza payloads com `stripChannelUnsafeFields()` antes de enviar, então a capacidade técnica de canais já existe.
- O Basic hoje recebe anúncios a cada 50 envios (`AD_TEXT`), mas a nova proposta não menciona anúncios. É necessário decidir se anúncios continuam existindo em Basic ou se essa diferenciação será removida.
- A rota de broadcast manual normaliza JIDs sempre como grupo (`JID_KIND.GROUP`), então o UI menciona grupo/canal, mas a API derruba canais em envio manual/agendado. Isso é um bug/limitação paralela que precisa ser tratado se “Pro inclui canais” também significar envio manual/agendado para canais.

### 2.5 Dashboard

- `/dashboard/grupos` mostra título “Grupos e Canais”, filtro de canais e botão “+ Adicionar canal” para todos.
- `AddChannelModal` não recebe nem consulta entitlement.
- `/dashboard/assinaturas` monta cards a partir dos planos públicos e defaults, mas não mostra comparação clara “grupos vs canais vs Módulo de Preservação Avançada”.
- `/dashboard/configuracoes` já tem delay, presets, filtros por palavra, plataformas e mensagens sem link. Esses recursos são candidatos a compor o “Módulo de Preservação Avançada”, mas hoje aparecem para todos.

---

## 3. Decisões de produto fechadas em 2026-05-18

Estas decisões foram confirmadas pela Flávia e devem ser tratadas como fonte de verdade quando a implementação começar. Não implementar nada agora; este plano fica guardado para retomada futura.

1. **Anúncios no Basic:** remover anúncios como diferencial principal. O posicionamento passa a ser Basic = grupos; Pro = grupos + canais + Módulo de Preservação Avançada. Se existir lógica legada de anúncio no worker, ela deve ser revisada na implementação para não conflitar com a nova comunicação.
2. **Trial:** trial deve experimentar recursos de Pro por 7 dias, incluindo grupos, canais e o Módulo de Preservação Avançada. Após expirar ou converter para Basic, o acesso segue as regras do plano pago escolhido.
3. **Clientes Basic com canais já cadastrados:** bloquear uso/criação/execução de canais imediatamente para Basic, sem apagar dados. Canais existentes ficam preservados e voltam automaticamente quando o usuário faz upgrade para Pro.
4. **UX de canal bloqueado:** mostrar canais/recurso bloqueado com badge “Pro”, em vez de esconder totalmente. O usuário deve entender que existe caminho de upgrade.
5. **Nome público do recurso de proteção:** usar **Módulo de Preservação Avançada**. A copy deve explicar que o módulo reduz risco por cadência, limites, aquecimento e alertas operacionais, sem prometer garantia de evitar banimento.
6. **Pacote Pro de preservação:** escopo completo: delay customizado, filtros, plataformas, mensagens sem link, descanso/progressive delay, limites de rajada, warmup e alertas de risco, implementados em fases se necessário.
7. **Delay/filtros no Basic:** Basic mantém delay e filtros básicos; Pro libera recursos avançados do Módulo de Preservação Avançada.
8. **Canais no Pro:** canais devem valer para tudo no Pro: espelhamento automático, envio manual e envio agendado.
9. **Preço Pro:** Pro permanece R$69 por 30 dias.
10. **Atualização de conteúdo `LpPlan`:** atualizar defaults no código e também criar migration/seed aditiva para alinhar as linhas de `LpPlan` em staging/prod.
11. **Reativação após upgrade:** canais preservados em conta Basic devem reativar automaticamente quando o usuário virar Pro.
12. **Limite de grupos no Basic:** Basic não terá limite técnico específico de quantidade de grupos por enquanto.
13. **CTA de upgrade:** usar copy orientada a benefício, exemplo: “Libere canais e o Módulo de Preservação Avançada com o Pro.”
14. **Execução:** nenhuma implementação por enquanto. O plano deve ficar salvo e será retomado depois.

---

## 4. Riscos STRICT

### Erros fatais

- Evitar loops no dashboard ao buscar `/api/me` e `/api/public/plans`; entitlements devem ser carregados uma vez e derivados em memória.
- Evitar `reloadConfig()` em cascata ao bloquear canais no Basic; não fazer updates automáticos em massa ao abrir a tela.
- Não alterar worker para matar processo quando houver canal bloqueado; apenas filtrar canais não permitidos.

### Breaking changes

- Criar uma API nova de entitlement é mudança de contrato; deve ser aditiva, não quebrar `/api/auth/me`.
- Bloquear `POST /api/groups` para `kind=channel` em Basic muda comportamento atual de usuários Basic.
- Se broadcast passar a aceitar canais, `normalizeTargetJids()` muda contrato e precisa aceitar grupo ou canal sem quebrar grupos.

### Efeito cascata

- Conteúdo de planos alimenta landing, dashboard assinaturas, admin de LP e checkout; atualizar apenas um lugar deixa mensagens inconsistentes.
- Worker, rotas de grupos, rotas de broadcast e UI precisam concordar sobre o que Basic pode fazer.
- Testes de canal existentes precisam continuar passando para usuário Pro/admin, e novos testes devem garantir bloqueio Basic.

### Isolamento de ambiente

- Não tocar `.env`, banco de produção ou paths do VPS.
- Se houver seed/update de `LpPlan`, deve ser migration/seed testado em `develop`/staging antes de produção.
- Não alterar portas.

### Bloqueio

- Se a implementação exigir migration destrutiva ou limpeza de canais de Basic, parar e validar manualmente em staging.
- Não fazer deploy em produção sem validar `/dashboard/grupos`, `/dashboard/assinaturas`, checkout Basic/Pro e worker com conta Basic e Pro na porta 3006.

---

## 5. Arquitetura proposta

### 5.1 Criar uma camada central de planos/entitlements

**Criar:** `src/billing/plans.js`

Responsabilidade:

- Normalizar plano (`trial`, `basic`, `pro`).
- Expor matriz de capacidades:
  - `canUseGroups`
  - `canUseChannels`
  - `canUseAntiBanProtection`
  - `showsAds` ou `shouldInjectBasicAds` se anúncios continuarem.
- Expor helpers puros para API/worker/testes:
  - `normalizePlan(plan)`
  - `getPlanEntitlements(plan)`
  - `canUseChannels(plan)`
  - `canUseAdvancedPreservation(plan)`
  - `assertFeatureAllowed(plan, feature)` ou `buildFeatureGateError(feature, requiredPlan)`

Matriz recomendada inicial:

| Plano | Grupos | Canais | Módulo de Preservação Avançada | Observação |
|---|---:|---:|---:|---|
| trial | sim | sim por 7 dias | sim por 7 dias | Trial experimenta Pro durante a janela gratuita |
| basic | sim | não | básico | Plano de R$39 focado em grupos, com delay/filtros básicos |
| pro | sim | sim | avançado/completo | Plano com canais e Módulo de Preservação Avançada |

### 5.2 API: bloquear canais fora do trial ativo/Pro

**Modificar:** `src/api/routes/groups.js`

Regras:

- `POST /api/groups` com `kind='channel'` deve consultar `User.plan`/vigência e retornar `403 FEATURE_REQUIRES_PRO` para Basic. Trial ativo e Pro podem usar canais.
- `resolve-channel-invite`, `resolve-channel-jid`, `follow-now`, `refresh-admin`, `wa/channels` devem exigir trial ativo ou Pro.
- `PUT /:id/targets` deve impedir que Basic salve canal como monitor ou destino. Mesmo que o canal exista de legado, a operação deve bloquear uso.
- `GET /api/groups` pode continuar retornando canais preservados para o dashboard mostrar bloqueado/upgrade; não apagar dados.

Resposta recomendada:

```json
{
  "error": "Canais estão disponíveis no plano Pro.",
  "code": "FEATURE_REQUIRES_PRO",
  "feature": "channels",
  "requiredPlan": "pro"
}
```

### 5.3 Worker: filtrar canais para Basic

**Modificar:** `src/bot-worker.js`

Regras:

- `loadConfig()` deve montar config com canais apenas se `canUseChannels(user.plan)` for verdadeiro.
- Para Basic, preservar grupos `kind !== 'channel'` e remover canais de `monitor`, `monitorJids`, `post`, `postDetails` e `targetPostJids`. Trial ativo e Pro mantêm canais.
- Logar um aviso informativo com contagem de canais bloqueados, sem encerrar o processo.
- `ensureChannelSubscriptions()` naturalmente não terá canais se a config vier filtrada.

### 5.4 Broadcast manual/agendado: decidir suporte a canais no Pro

**Modificar:** `src/api/routes/broadcast.js`

Cenário recomendado:

- Para Basic, manter somente grupos.
- Para trial ativo e Pro, aceitar JIDs de grupo e canal com `ensureJid(jid, detectKind/jid)` ou helper novo `ensureMirrorableJid()`.
- Ao carregar destinos default, filtrar canais se plano não permite.
- Ajustar mensagens de erro para “Nenhum grupo/canal de destino permitido no seu plano”.

Decisão fechada: canais também devem funcionar no envio manual e no envio agendado para trial ativo e Pro. Basic deve filtrar/bloquear canais em todos esses fluxos.

### 5.5 Módulo de Preservação Avançada como feature do trial ativo/Pro

**Modificar:** `src/api/routes/config.js`, `dashboard/app/dashboard/configuracoes/page.js`, possivelmente `src/smartDelay.js`/worker se houver limites por plano.

Decisão de produto:

- Usar o nome **Módulo de Preservação Avançada** para o pacote de controles de cadência e segurança, sem prometer eliminação de banimento.
- Basic mantém delay e filtros básicos.
- Pro libera controles avançados: presets avançados, limites de rajada, warmup, descanso/progressive delay e alertas de risco.
- Trial ativo deve experimentar os recursos Pro por 7 dias.
- API deve ser fonte da verdade: bloquear updates de campos avançados quando usuário não é Pro nem trial ativo, mesmo se alguém chamar a API diretamente.

Campos candidatos ao módulo avançado:

- Delay customizado (`delayMin`, `delayMax`) e presets avançados.
- `blockedKeywords` global e por grupo em modo básico para Basic e modo avançado para Pro, se houver diferença de granularidade.
- `allowedPlatforms` global/por grupo em modo básico para Basic e modo avançado para Pro, se houver diferença de granularidade.
- `forwardMode=ALLOW_NO_LINK` e `noLinkScope`, conforme decisão final de risco durante implementação.
- Descanso/progressive delay.
- Limites de rajada, warmup, probe/quarantine e alertas de risco.

Atenção: manter recursos básicos já existentes para Basic quando possível. O Pro deve liberar a camada avançada e os fluxos de canais, sem retirar de forma abrupta controles básicos que ajudam a operação responsável.

### 5.6 Dashboard: paywall e UX

**Modificar:**

- `dashboard/app/dashboard/grupos/page.js`
- `dashboard/components/AddChannelModal.js`
- `dashboard/app/dashboard/configuracoes/page.js`
- `dashboard/app/dashboard/assinaturas/page.js`
- possivelmente criar `dashboard/lib/plans.js` ou consumir entitlements vindos da API.

Regras:

- Usuário Basic vê canais como recurso Pro:
  - botão “+ Adicionar canal” desabilitado ou abre paywall leve;
  - filtro “Canais” pode existir, mas com badge Pro;
  - canais legados aparecem com badge “Bloqueado no Basic — faça upgrade para reativar”.
- AddChannelModal só deve abrir se trial ativo ou Pro; caso contrário, mostrar upgrade CTA.
- Configurações do Módulo de Preservação Avançada devem mostrar badge Pro e CTA para `/dashboard/assinaturas` quando forem avançadas.
- Assinaturas deve comparar claramente:
  - Basic R$39: grupos, conversão de links, histórico, delay/filtros básicos e recursos essenciais.
  - Pro R$69: tudo do Basic + canais + Módulo de Preservação Avançada.

### 5.7 Conteúdo público e admin

**Modificar:**

- `dashboard/lib/marketing-content.js`
- `dashboard/components/landing/Pricing.jsx`
- `dashboard/app/admin/page.js` somente se placeholder/copy do editor ficar inconsistente.
- Migrations/seeds de `LpPlan`, se o conteúdo do banco precisar ser alinhado automaticamente em staging/prod.

Regras:

- Atualizar defaults do Basic/Pro.
- Atualizar badge do Pro de “Sem anúncios” para “Canais + Preservação Avançada”.
- Manter copy responsável: “reduz risco”, “cadência segura”, “proteção operacional”; nunca “garante que não será banido”.

### 5.8 Testes

**Adicionar/alterar:**

- `test/billing-plans.test.js` para helper puro de entitlement.
- `test/api/routes/groups.channel.test.js` para bloquear canais em Basic e permitir em trial ativo/Pro.
- `test/broadcast.test.js` ou ampliar teste existente para Basic filtrar canais e Pro aceitar, se broadcast for incluído.
- `test/smart-delay.test.js` se novos helpers/limites do Módulo de Preservação Avançada forem criados.
- Teste de conteúdo público se houver validação de planos default.

---


## 6. Sprints de implementação

### Sprint 1 — Fundação de entitlements e bloqueio técnico seguro

**Status:** implementada nesta etapa inicial.

**Objetivo:** criar a camada central de planos e impedir que Basic crie/use canais pela API ou pelo worker, sem apagar dados legados.

**Escopo:**
- Criar `src/billing/plans.js` com normalização de plano e permissões por plano/vigência.
- Criar helper puro para montar configuração de grupos/canais respeitando entitlements.
- Bloquear endpoints de canal para Basic em `src/api/routes/groups.js`, permitindo Trial ativo e Pro.
- Filtrar canais no worker para Basic, preservando registros no banco.
- Testar `test/billing-plans.test.js`, `test/group-entitlements.test.js` e `test/api/routes/groups.channel.test.js`.

**Fora do escopo:** dashboard, copy pública, migration/seed de `LpPlan`, broadcast manual/agendado e controles avançados do módulo.

### Sprint 2 — Broadcast manual/agendado com canais para Trial ativo/Pro

**Objetivo:** alinhar envio manual e agendado com a decisão de que canais valem para tudo no Trial ativo/Pro.

**Escopo:**
- Ajustar `src/api/routes/broadcast.js` para aceitar `@newsletter` quando o plano permitir.
- Filtrar/bloquear canais para Basic em envio imediato e agendado.
- Ajustar `dashboard/app/dashboard/envio/page.js` para exibir canais conforme plano ou com badge/CTA Pro.
- Adicionar testes de broadcast para Basic vs Trial ativo/Pro.

### Sprint 3 — Dashboard paywall e UX de upgrade

**Objetivo:** fazer a UI explicar e vender o upgrade sem depender da UI como fonte de segurança.

**Escopo:**
- Atualizar `/dashboard/grupos` e `AddChannelModal` para Basic ver canais bloqueados com badge Pro.
- Mostrar canais legados preservados como “bloqueado no Basic”.
- Atualizar `/dashboard/assinaturas` com comparação Basic vs Pro e CTA “Libere canais e o Módulo de Preservação Avançada com o Pro”.
- Rodar build do dashboard e, se mudança visual for perceptível, capturar screenshot em ambiente local/staging quando disponível.

### Sprint 4 — Conteúdo público, Admin e `LpPlan`

**Objetivo:** alinhar landing, defaults e conteúdo editável do banco com o novo posicionamento.

**Escopo:**
- Atualizar `dashboard/lib/marketing-content.js` e componentes de pricing.
- Atualizar placeholders/copy do Admin se necessário.
- Criar migration/seed aditiva para `LpPlan` com Basic grupos e Pro canais + Preservação Avançada.
- Validar que o checkout continua usando R$39/R$69 e que `getBillingPlans()` segue compatível.

### Sprint 5 — Módulo de Preservação Avançada

**Objetivo:** separar recursos básicos de segurança dos recursos avançados Pro.

**Escopo:**
- Definir campos básicos vs avançados em `config` e `groups`.
- Manter delay/filtros básicos no Basic.
- Liberar limites de rajada, warmup, descanso/progressive delay e alertas de risco para Trial ativo/Pro.
- Criar testes para bloqueio de campos avançados em Basic.

### Sprint 6 — Validação integrada em staging

**Objetivo:** validar ponta a ponta na porta 3006 antes de qualquer promoção para produção.

**Escopo:**
- Rodar suíte focada e build do dashboard.
- Validar Basic, Trial ativo e Pro em staging.
- Conferir que canais Basic são preservados e reativam automaticamente após upgrade.
- Conferir checkout Basic/Pro e conteúdo público.

---

## 7. Plano de implementação em tarefas pequenas

### Task 1: Centralizar matriz de planos

**Files:**
- Create: `src/billing/plans.js`
- Create/Modify test: `test/billing-plans.test.js`

- [ ] Criar testes de matriz: `basic` não pode canais nem módulo avançado; `trial` ativo e `pro` podem.
- [ ] Implementar helpers puros em `src/billing/plans.js`.
- [ ] Rodar `node --test test/billing-plans.test.js`.
- [ ] Commit: `feat: centralize plan entitlements`.

### Task 2: Gate de canais na API

**Files:**
- Modify: `src/api/routes/groups.js`
- Modify: `test/api/routes/groups.channel.test.js`

- [ ] Adicionar helper local ou importado para buscar plano do usuário autenticado.
- [ ] Bloquear criação/resolução/listagem/follow/refresh de canais para Basic, permitindo trial ativo e Pro.
- [ ] Garantir que grupo `kind='group'` continue permitido para Basic.
- [ ] Adicionar testes 403 para Basic e 200 para trial ativo/Pro.
- [ ] Rodar `node --test test/api/routes/groups.channel.test.js`.
- [ ] Commit: `feat: gate channel features to pro plan`.

### Task 3: Filtrar canais no worker para Basic

**Files:**
- Modify: `src/bot-worker.js`
- Add/Modify test: avaliar extração de helper puro para testar sem subir worker completo.

- [ ] Extrair helper puro `filterGroupsByEntitlements(userGroups, plan, targetsByMonitor)` se necessário.
- [ ] Garantir que `monitor`, `monitorJids`, `post`, `postDetails` e `targetPostJids` não incluam canais para Basic, mas incluam para trial ativo/Pro.
- [ ] Logar contagem de canais preservados mas bloqueados.
- [ ] Rodar teste unitário do helper.
- [ ] Commit: `feat: prevent basic workers from using channels`.

### Task 4: Decidir e ajustar broadcast para canais Pro

**Files:**
- Modify: `src/api/routes/broadcast.js`
- Modify: `dashboard/app/dashboard/envio/page.js`
- Add/Modify test: `test/broadcast.test.js` se existir, ou novo teste focado.

- [ ] Aceitar `@newsletter` para trial ativo e Pro no broadcast manual/agendado, e filtrar/bloquear canais para Basic.
- [ ] Manter copy de canais na tela de envio manual/agendado apenas quando o plano permitir ou quando houver paywall/badge Pro claro.
- [ ] Rodar teste da rota.
- [ ] Commit: `feat: align broadcast destinations with plan entitlements`.

### Task 5: Definir Módulo de Preservação Avançada na API

**Files:**
- Modify: `src/api/routes/config.js`
- Modify: `src/api/routes/groups.js` para filtros por grupo, se forem parte da camada avançada.
- Add/Modify tests: testes de config e groups update.

- [ ] Definir lista final de campos básicos vs avançados.
- [ ] Bloquear alteração de campos avançados para Basic com `FEATURE_REQUIRES_PRO`, mantendo trial ativo com permissões de Pro por 7 dias.
- [ ] Manter defaults seguros para todos os planos.
- [ ] Rodar testes de config/groups.
- [ ] Commit: `feat: gate preservation module controls to pro`.

### Task 6: Dashboard paywall e mensagens

**Files:**
- Modify: `dashboard/app/dashboard/grupos/page.js`
- Modify: `dashboard/components/AddChannelModal.js`
- Modify: `dashboard/app/dashboard/configuracoes/page.js`
- Modify: `dashboard/app/dashboard/assinaturas/page.js`
- Possibly create: `dashboard/lib/plans.js`

- [ ] Carregar plano atual via `api.me()` ou endpoint dedicado.
- [ ] Desabilitar/transformar botão de canal em CTA de upgrade para Basic.
- [ ] Mostrar estado bloqueado para canais legados.
- [ ] Mostrar badge/CTA Pro nos controles do Módulo de Preservação Avançada avançados.
- [ ] Melhorar comparação Basic vs Pro na página de assinaturas.
- [ ] Rodar build do dashboard.
- [ ] Commit: `feat: add plan-aware dashboard paywalls`.

### Task 7: Atualizar conteúdo público e LP/admin

**Files:**
- Modify: `dashboard/lib/marketing-content.js`
- Modify: `dashboard/components/landing/Pricing.jsx`
- Modify: `dashboard/app/admin/page.js` se necessário.
- Optional migration: `prisma/migrations/<timestamp>_update_plan_positioning/migration.sql` apenas se for indispensável atualizar `LpPlan` do banco.

- [ ] Atualizar defaults: Basic grupos; Pro grupos+canais+Módulo de Preservação Avançada.
- [ ] Atualizar badge do Pro.
- [ ] Atualizar copy de segurança sem promessa absoluta.
- [ ] Se usar migration de conteúdo, testar `npx prisma migrate deploy` em staging antes de produção.
- [ ] Commit: `feat: update public plan positioning`.

### Task 8: Validação integrada em staging

**Files:**
- No code unless bugs are found.

- [ ] Rodar testes unitários relevantes na branch.
- [ ] Buildar dashboard.
- [ ] Abrir PR contra `develop`.
- [ ] Validar staging `http://178.105.54.0:3006`:
  - Basic não cadastra canal.
  - Basic continua cadastrando grupos.
  - Basic não usa canais legados no worker.
  - Trial ativo e Pro cadastram canal, resolvem convite/JID e seguem canal monitor.
  - Pro acessa controles do Módulo de Preservação Avançada.
  - Checkout Basic/Pro mantém preços corretos.
- [ ] Só depois abrir PR `develop` → `main`.

---

## 8. Comandos de verificação recomendados

```bash
node --test test/billing-plans.test.js
node --test test/api/routes/groups.channel.test.js
node --test test/smart-delay.test.js
node --test test/payments-webhook.test.js
npm test -- --runInBand
cd dashboard && npm run build
```

Se `npm test -- --runInBand` não existir neste projeto, usar os comandos `node --test` focados e o build do dashboard como verificação mínima.

---

## 9. Critérios de aceite

- Basic R$39 aparece publicamente e no dashboard como plano de **grupos**.
- Pro aparece publicamente e no dashboard como plano de **grupos + canais + Módulo de Preservação Avançada**.
- API impede uso/criação de canais por `basic`, mas permite durante trial ativo e Pro.
- Worker não processa canais para `basic`, mesmo que existam registros legados; trial ativo e Pro continuam processando canais.
- Pro continua usando canais sem regressão.
- O Módulo de Preservação Avançada fica tecnicamente ligado ao Pro, mantendo recursos básicos de delay/filtros no Basic e deixando claro que o Pro libera a camada avançada.
- Nenhuma alteração toca produção diretamente; tudo passa por `develop` e staging.

---

## 10. Observações finais

A implementação deve ser feita sem apagar dados de canais existentes. O bloqueio deve ser reversível via upgrade para Pro. A principal recomendação técnica é não depender de copy ou UI para controlar plano: a autorização precisa morar na API/worker, e a UI apenas explica e converte para upgrade.
