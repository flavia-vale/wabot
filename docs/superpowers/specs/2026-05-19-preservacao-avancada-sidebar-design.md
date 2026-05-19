# Preservação Avançada — Sidebar dedicada com Monitoramento + Configurações

**Status:** approved by stakeholder · pending implementation
**Author:** Claude (Opus 4.7) com decisões da Flávia
**Date:** 2026-05-19

## Objetivo

Expor todas as features do Phase 5 (anti-ban) como um módulo coeso e configurável no dashboard, transformando-as em diferencial real do plano **Pro** (e do Trial ativo). Hoje o backend já implementa as defesas mas elas rodam pra todos os usuários e não têm UI dedicada.

### Resultado esperado

- Usuários Pro/Trial conseguem monitorar saúde dos canais, ver risk score, snapshots, clicks e ajustar parâmetros finos de throttle/follow-guard/quiet-hours/variação/mutação.
- Usuários fora do Pro/Trial veem o módulo na sidebar com cadeado e uma página de upsell explicando o que ganham assinando.
- Bot-worker e cores deixam de aplicar lógica Phase 5 pra quem não tem Pro/Trial — vira diferencial pago de verdade.

## Decisões de produto

1. **Localização**: novo grupo na sidebar chamado `Preservação Avançada`, com 2 itens (`Monitoramento` e `Configurações avançadas`).
2. **Configurabilidade**: controles finos sempre visíveis (sem presets). Cada parâmetro com microcopy explicativa.
3. **Divisão**: Monitoramento = somente leitura; Configurações = formulário com todos os parâmetros editáveis.
4. **Gating na sidebar**: grupo sempre visível; itens recebem cadeado `🔒` pra não-Pro. Clicar leva pras páginas mas o layout intercepta e renderiza upsell.
5. **Defaults só ativos pra Pro/Trial**: bot-worker e cores checam plano. Quem não tem Pro/Trial perde Phase 5 silenciosamente (todos usuários ativos hoje têm Trial, então impacto inicial é zero).
6. **Empacotamento**: PR única (opção B). Justificativa: feature pequena o suficiente em volume de arquivos pra valer a pena uma revisão em bloco.

## Arquitetura

### Lógica de gating reutilizável

Novo módulo `src/core/planGating.js`:

```js
// Cache em memória de 60s por userId pra evitar martelar o DB no fan-out
export async function isAdvancedPreservationActive(userId, { db } = {}) {
  // Lê User.plan + User.accessExpiresAt
  // Retorna true se plan === 'pro' OU (plan === 'trial' && accessExpiresAt > now)
}
```

Espelha `canAccessAdvancedPreservation` que já existe inline em `dashboard/app/dashboard/configuracoes/page.js`. Frontend reusa via `dashboard/lib/plan.js`.

### Pontos de injeção do gating no backend

| Local | Comportamento sem Pro/Trial |
|------|----------------------------|
| `bot-worker.js` (fan-out loop) | Pula `channelThrottle.checkAndReserve`, `applyVariation`, `mutate`, stagger jitter. Mantém só o `delayMin/delayMax` legado de `BotConfig`. |
| `core/channelThrottle.js` | Função `checkAndReserve` recebe `{ userId }`; se gating off, retorna `{ allowed: true, reason: 'gating_off' }` sem consultar throttle. |
| `core/followGuard.js` | `decide()` recebe `{ userId }`; se gating off, retorna `{ allowed: true, reason: 'gating_off' }`. Rotas legadas em `groups.js` mantêm comportamento atual; gating estrito só nas rotas novas `/api/preservation/*`. |
| `core/copyVariation.js` | Caller (bot-worker) decide se chama ou não. Função em si fica agnóstica. |
| `core/imageMutation.js` | Idem — caller decide. |
| `core/channelProbe.js` | `runProbeWatchdog` itera todos os usuários e filtra por gating antes de chamar `recordProbeSeen`. |
| `jobs/channelSnapshot.js` | `captureAllForUser` recebe gating como parâmetro injetado; se off, retorna `{ captured: 0, skipped: 0, gated: 1 }`. Cron continua iterando todos os usuários mas cada um é filtrado. |
| `core/clickTracker.js` | **Sem gating**. Shortlinks continuam abertos pra todos (já é endpoint público + leve). Integração nos converters fica gated quando for feita. |

### Cache de plano

TTL 60s em `Map<userId, { plan, accessExpiresAt, fetchedAt }>`. Refresh lazy ao expirar. Sem invalidação ativa (60s é tolerável pra mudança de plano refletir). Cache vive no processo do `api`/`bot-worker`; após restart do PM2 é recriado.

## API — Novas rotas

Prefixo: `/api/preservation`. Todas com middleware de auth existente + middleware adicional `requirePreservationAccess` que retorna `402 Payment Required` se gating off.

```
GET  /api/preservation/config                                → BotConfig do usuário (campos Phase 5)
PUT  /api/preservation/config                                → atualiza BotConfig (validação manual)
GET  /api/preservation/monitoring/health                     → ChannelHealth + groups
GET  /api/preservation/monitoring/risk-score                 → reusa reportRiskScore.collectScoreInputs
POST /api/preservation/monitoring/risk-score/recompute-all   → loop em todos canais-destino
GET  /api/preservation/monitoring/follows                    → FollowLog do usuário (limit/offset)
GET  /api/preservation/monitoring/snapshots                  → counts + último por canal-destino
GET  /api/preservation/monitoring/probe                      → estado consolidado
GET  /api/preservation/monitoring/clicks                     → reusa getClickStats agregado
```

Implementação: novo arquivo `src/api/routes/preservation.js`. Registrado em `src/api/server.js` com prefix `/api/preservation`.

### Payload do `PUT /api/preservation/config`

Body aceita parcial. Campos editáveis:

```ts
{
  channelMinIntervalSec?: number (>=1)
  channelBurstCap?: number (>=1)
  channelBurstWindowSec?: number (>=60)
  channelDailyCap?: number | null (>=1 ou null)
  channelStaggerJitterMs?: number (>=0)
  channelQuietHoursJson?: string (JSON válido com {startHour, endHour, tz})
  maxDailyFollows?: number (1..50)
  copyVariationPoolJson?: string (JSON válido)
  imageMutationEnabled?: boolean
  probeEnabled?: boolean
}
```

Campos read-only no GET: `probeAccountSessionId` (setado por config server-side), `clickTrackerSaltConfigured` (true/false baseado em `process.env.CLICK_HASH_SALT`), `shortlinkBaseUrl` (vem de `process.env.SHORTLINK_BASE_URL`).

## Frontend

### Sidebar (`dashboard/app/dashboard/DashboardClientLayout.js`)

Novo grupo após "Configuração":

```js
{
  title: 'Preservação Avançada',
  pro: true,
  items: [
    { href: '/dashboard/preservacao/monitoramento', icon: '📊', label: 'Monitoramento' },
    { href: '/dashboard/preservacao/configuracoes',  icon: '⚙️', label: 'Configurações avançadas' },
  ],
},
```

Render do item: quando `group.pro && !canAccessAdvancedPreservation(planSubject)`, sufixar `🔒` no label, aplicar `opacity-70`. Continua clicável.

### Estrutura de arquivos novos

```
dashboard/app/dashboard/preservacao/
  page.js                              → redirect 302 pra /monitoramento
  layout.js                            → wrapper client; renderiza UpsellShell ou children baseado em plan
  monitoramento/page.js                → grid de cards read-only
  configuracoes/page.js                → form com seções colapsáveis

dashboard/components/preservacao/
  UpsellShell.js                       → hero + 6 cards de feature + CTAs
  HealthOverview.js                    → tabela compacta de saúde
  RiskScoreSummary.js                  → score médio + breakdown + botão recalcular
  RecentFollowsList.js                 → últimos 20 follows
  SnapshotsList.js                     → counts + último por canal
  ClicksSummary.js                     → totais + top 5 links
  ProbeStatus.js                       → estado do probe
  ThrottleForm.js                      → 5 inputs de throttle
  FollowGuardForm.js                   → maxDailyFollows
  QuietHoursForm.js                    → editor de quiet hours
  CopyVariationPoolEditor.js           → textarea JSON com preview
  ImageMutationToggle.js               → toggle
  ProbeToggle.js                       → toggle + descrição

dashboard/lib/plan.js                  → centraliza canAccessAdvancedPreservation
```

### UpsellShell — conteúdo

- Hero: `🛡️ Módulo de Preservação Avançada`
- Subtítulo: "Mantenha seus canais saudáveis com camadas extras de defesa estatística."
- 6 cards (ícone + título + 1 frase):
  - 📈 Limite inteligente de envios por canal
  - 🐢 Espaçamento humano entre canais
  - 🎲 Variação automática de textos
  - 🖼️ Mutação leve de imagens
  - 🩺 Monitoramento de saúde dos canais
  - 🔭 Probe externo (detecção precoce de banimento)
  - 📊 Score de risco de denúncia
  - 📸 Snapshots diários dos canais
- Microcopy: "Disponível no plano Pro e durante o Trial."
- CTA primário: `Ativar Pro` → `/dashboard/assinaturas`
- CTA secundário: `Ver detalhes do plano` → `/planos`

### Monitoramento — cards

1. **🩺 Saúde dos canais** — tabela: canal, status (🟢🟡🔴⚫), última falha, motivo pause. Fonte: `GET /api/preservation/monitoring/health`.
2. **📊 Risk score consolidado** — média 0-100, barra visual, breakdown (posts/follower, diversidade, denúncias). Botão "Recalcular tudo agora".
3. **👣 Follows recentes** — últimos 20 com timestamp, canal, status.
4. **📸 Snapshots** — counts + data do último por canal.
5. **🔭 Probe** — estado, último ping, próxima janela.
6. **🔗 Clicks** — total de shortlinks, total de clicks, top 5.

Cada card é independente: erro em um não derruba a página, mostra estado vazio com mensagem curta. Refresh manual por botão; sem polling automático na v1.

### Configurações — seções

Form único com seções claras (sem collapse na v1, scroll vertical normal). Salva via `PUT /api/preservation/config`.

1. **⏱️ Espaçamento entre canais (Throttle)** — `channelMinIntervalSec`, `channelBurstCap`, `channelBurstWindowSec`, `channelDailyCap`, `channelStaggerJitterMs`. Microcopy por input.
2. **🌙 Janela silenciosa** — quiet hours JSON: 2 inputs de hora + select de timezone.
3. **👣 Follow guard** — `maxDailyFollows` (slider 1-10).
4. **🎲 Pool de variação de copy** — textarea JSON validada em tempo real, preview ao lado, botão "Restaurar exemplo".
5. **🖼️ Mutação de imagem** — toggle.
6. **🔭 Probe externo** — toggle + `probeAccountSessionId` read-only.
7. **🔗 Click tracker** — `SHORTLINK_BASE_URL` (read-only) + indicador "Salt configurado: ✅/❌".

Botão "Salvar tudo" no rodapé; otimista UI + toast.

## Testes

### Unit (node:test)

- `test/core/planGating.test.js` (NEW) — `isAdvancedPreservationActive` cobre: pro, trial ativo, trial expirado, basic, sem `accessExpiresAt`, cache TTL.
- `test/core/channelThrottle.test.js` — adicionar caso "pula throttle quando plan gating off".
- `test/core/followGuard.test.js` — adicionar caso "rejeita follow quando plan gating off".
- `test/jobs/channelSnapshot.test.js` — adicionar caso "ignora usuário fora do Pro".

### Rotas

- `test/api/routes/preservation.config.test.js` (NEW) — GET retorna campos certos; PUT valida tipos; 402 sem Pro.
- `test/api/routes/preservation.monitoring.test.js` (NEW) — happy path por endpoint; 402 sem Pro.

### Manual em staging

- Login com usuário trial ativo → grupo aparece sem cadeado.
- Login com basic → grupo aparece com 🔒; clicar mostra UpsellShell.
- Mudar config e salvar → reload mostra valor persistido.
- Smoke do shortlink continua funcionando (não regrediu).

## Riscos

1. **Bot-worker comportamento muda em prod**: usuários sem Pro/Trial perdem Phase 5 silenciosamente. **Mitigação**: validar em staging com user basic antes de prod. Hoje praticamente todos os usuários ativos têm Trial, então impacto operacional inicial é zero.
2. **Rotas legadas em `groups.js`**: mantêm comportamento atual (sem 402). Gating estrito só nas rotas novas `/api/preservation/*`. UI legada checa gating no client antes de chamar.
3. **Cache de 60s no plano**: mudança de plano leva até 60s pra refletir no comportamento do bot. Aceitável.
4. **Nenhuma migration**: todos os campos já existem no schema.

## Ordem dos commits dentro do PR

1. `src/core/planGating.js` + teste
2. Gating em `channelThrottle`, `followGuard`, `channelSnapshot`, `channelProbe` (+ testes)
3. Wrap em `bot-worker.js`
4. `src/api/routes/preservation.js` + registro em `server.js` + testes
5. `dashboard/lib/plan.js`
6. Sidebar (DashboardClientLayout)
7. Páginas `/dashboard/preservacao/*` + layout + UpsellShell
8. Componentes de Monitoramento
9. Componentes de Configurações
10. Helpers em `dashboard/lib/api.js`

## Fora do escopo

- Histórico de risk score em série temporal (deferido — UI extra).
- Botão "forçar despausar" canal (deferido).
- Integração do click tracker nos `src/converters/*` (toca bloco protegido — feature separada).
- PR-5.C.4 real (usar `getClickStats` no risk score — depende de integração nos converters).
- Multi-session WA pra probe real (feature maior, separada).
- Presets de "Conservador / Recomendado / Agressivo" no form (deferido — pode virar layer adicional depois).
