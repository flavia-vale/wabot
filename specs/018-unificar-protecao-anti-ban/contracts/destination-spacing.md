# Contrato — módulo puro `src/core/destinationSpacing.js`

Ponto ÚNICO do **"Intervalo entre destinos"** (ex-"Atraso entre canais",
`BotConfig.channelStaggerJitterMs`) e da regra de FR-025 ("quando o intervalo
entre destinos e o gate do próprio destino se aplicam, vale a MAIOR espera — não
soma, não substitui"). Spec FR-022 a FR-026. Sem banco, sem rede, sem relógio
próprio (`now` entra por parâmetro), sem env lida no topo.

| Consumidor | Uso |
|---|---|
| `src/bot-worker.js` → `processSendJob` | decide o espaçamento, combina com o gate do destino, adia via `deferSendJob` e atualiza o estado em memória |
| `src/core/channelThrottle.js` → `checkAndReserve` | recebe a decisão de espaçamento e só reserva o slot do destino se a decisão combinada liberar |
| `scripts/diag-antiban-valores.mjs` | projetar atraso e vazão (import, nunca cópia) |

Nenhum outro arquivo pode calcular espera entre destinos nem combinar esperas.
Guardas estruturais no teste: (a) `staggerMs`/sorteio sobre
`channelStaggerJitterMs` não existe mais no `bot-worker.js`; (b) `processSendJob`
não faz `sleep(job.delayMs)`; (c) espera vinda do espaçamento sempre termina em
`deferSendJob`.

## Exports

```text
DESTINATION_SPACING_REASON = 'destination_spacing'

isDestinationSpacingEnabled(env = process.env) : boolean
  false somente se env.DESTINATION_SPACING === 'off'

toDestinationIntervalMs(botConfig) : number
  lê channelStaggerJitterMs; inteiro >= 0, teto 600000; inválido/ausente → 0
  (0 = sem espaçamento). NÃO aplica o padrão de 20 s: o padrão vem do banco.

decideDestinationSpacing({ now, destJid, intervalMs, state, enabled = true })
  : { allow: boolean, deferUntil?: number, reason?: 'destination_spacing' }
  allow quando: enabled=false, intervalMs<=0, state.lastSendAt==null,
                ou destJid === state.lastDestJid (mesmo destino é isento)
  senão: earliest = max(state.lastSendAt + intervalMs, state.nextFreeSlotAt ?? 0)
         allow se now >= earliest; senão { allow:false, deferUntil: earliest }

combineGateDecisions(destDecision, spacingDecision)
  : { allow, deferUntil?, reason?, source: 'destination'|'spacing'|'both'|null }
  allow só se as duas allow; senão devolve a de MAIOR deferUntil (FR-025)

reserveSpacingSlot(state, { now, destJid, intervalMs, deferredUntil = null }) : SpacingState
  - envio liberado (deferredUntil null): lastSendAt=now, lastDestJid=destJid
  - job adiado pelo espaçamento: nextFreeSlotAt = deferredUntil + intervalMs
  retorna NOVO objeto (não muta)
```

## Uso em `processSendJob` (ordem canônica preservada)

```text
resolver preservação → revalidar vínculo → descarte por idade (queueMaxAgeMin)
→ freio de pressão + descanso (sem job.delayMs)
→ spacing = decideDestinationSpacing(...)
→ dest    = decisão do destino SEM reservar (peek)   [se houver Group]
→ gate    = combineGateDecisions(dest, spacing)
   · gate.allow            → reserva do destino + reserveSpacingSlot(envio) → envia
   · espera vem do spacing → reserveSpacingSlot(adiado) + deferSendJob(job, gate)   (SEMPRE, mesmo curta)
   · espera só do destino  → comportamento atual (inline se <= THROTTLE_INLINE_WAIT_MAX_MS, senão defer)
```

`status@broadcast` e destino sem `Group`: só o espaçamento decide.

## Tabela de verdade mínima (vira teste)

| Cenário (intervalo 20 s) | Resultado |
|---|---|
| primeiro envio do worker (lastSendAt null) | allow |
| grupo A em t0, depois canal B em t0+5 s | defer até t0+20 s |
| grupo A em t0, depois grupo B em t0+25 s | allow (grupos também espaçam) |
| grupo A em t0, depois grupo A de novo em t0+5 s | espaçamento isento; decide o `minIntervalSec` de A |
| intervalo 0 | allow sempre |
| `DESTINATION_SPACING=off` | allow sempre |
| espaçamento pede 20 s, destino pede 90 s (min_interval) | defer 90 s (maior) |
| espaçamento pede 20 s, destino pede 3 s | defer 20 s via `deferSendJob` (nunca inline) |
| 3 jobs (B, C, D) chegam juntos após A em t0 | vagas t0+20, t0+40, t0+60 (cursor; sem cascata de re-adiamento) |
| job adiado pelo espaçamento | `MessageLog` volta a `queued` com motivo leigo; `enqueuedAt` preservado |
