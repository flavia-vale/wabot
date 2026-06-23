# Plano B / Fase 3 — Teardown do global (checklist ordenado)

- **Data:** 2026-06-22
- **Status:** parcialmente implementado (flip do gate) + checklist do restante
  IRREVERSÍVEL pendente de validação em staging.
- **Pré-requisito (bloqueante):** Fases 1–2 mergeadas em `develop`, seed rodado
  em staging (`scripts/seed-preservation-presets.mjs`) e fluxo validado (criar
  preset, marcar padrão, atribuir a destino, conferir horário de funcionamento +
  anti-ban no envio real). **Nada abaixo deve ir para prod antes disso.**

## Já feito neste PR (reversível, code-only)

- `bot-worker.js`: o gate de envio usa **sempre** `destPreservation`
  (`resolveDestinationPreservation`) — a config por destino é a única fonte de
  verdade. Sem preset/override cai no preset default da conta e, na falta dele,
  no `HARD_DEFAULT` (nunca sem proteção anti-ban). O fallback para a global do
  `BotConfig` foi aposentado **no caminho de envio**.
- `channelThrottle.js`: o ramo legado de `checkAndReserve` (global +
  `decide()`) ficou marcado como DEPRECATED — código morto em produção, mantido
  só por retrocompat até a remoção física das colunas.

## Pendente (IRREVERSÍVEL — fazer em ordem, cada passo um PR, staging antes)

1. **Migrar quem ainda lê a global** (não é envio):
   - `src/core/preservationFeatures.js` + `src/billing/plans.js`
     (`isPreservationActive`): "preservação ativa" hoje deriva de
     `botConfig.channelThrottleEnabled`/`quietHoursEnabled`. Redefinir o sinal
     (ex.: existe preset com throttle/horário ligado? toggle de conta dedicado?).
   - `src/offerQueue/dispatcher.js` (`evaluateQueueGate`): o ramo `else` ainda
     pré-checa `botConfig.quietHoursEnabled`/`channelQuietHoursJson`. Como a fila
     já passa `ignoreGlobalQuietHours`, alinhar com o horário do destino.
   - **Stagger**: `channelStaggerJitterMs` é usado no `bot-worker` para o atraso
     entre canais. Decidir destino do campo (mover para preset? manter como
     config de conta separada?). NÃO dropar antes de realocar.
2. **Remover a UI/rotas da global de preservação**:
   - `dashboard/app/painel/preservacao/configuracoes/page.js`: tirar
     `ThrottleForm` + `QuietHoursForm` (passam a viver só por destino/preset).
     Avaliar o que resta na página (follow guard, image mutation continuam).
   - `src/api/routes/preservation.js`: aposentar os campos de cadência/quiet do
     `GET/PUT /config` (manter só o que sobrou).
   - `dashboard/components/preservacao/QuietHoursForm.js` e `ThrottleForm.js`:
     remover quando não houver mais consumidor.
3. **Remover o ramo legado** de `checkAndReserve` + a função `decide()` (e seus
   testes), já que `decideDestination` é o único caminho.
4. **Migração de schema (drop de colunas)** — só por último, com backup:
   - `BotConfig`: `channelMinIntervalSec`, `channelBurstCap`,
     `channelBurstWindowSec`, `channelDailyCap`, `channelQuietHoursJson`,
     `channelThrottleEnabled`, `quietHoursEnabled` (e `channelStaggerJitterMs`
     **só** depois do passo 1 reposicionar o stagger).
   - `Group`: `quietHoursEnabled`, `quietHoursJson` (override legado por grupo).
   - SQLite: drop de coluna exige rebuild de tabela — gerar via
     `prisma migrate diff` e revisar à mão (não incluir drift de outras
     tabelas). Parar apps PM2 que seguram o SQLite antes do DDL (pegadinha #8).
     Backup (`scripts/backup_prod.sh`) antes em prod.

## Critério de pronto

- Nenhuma leitura de campo de preservação do `BotConfig`/`Group` legado em
  `grep -rn "channelQuietHoursJson\|channelThrottleEnabled\|quietHoursEnabled"
  src/` fora de migração.
- Painel só mostra preservação por destino/preset.
- Suíte verde; staging validado por ≥1 ciclo de envio real.
