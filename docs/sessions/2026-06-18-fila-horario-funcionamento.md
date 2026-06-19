# Horário de funcionamento por fila (OfferQueue)

Data: 2026-06-18

## O que mudou

Cada fila (`OfferQueue`) agora pode ter um **horário de funcionamento próprio**
que **substitui** (override) a janela silenciosa global do `BotConfig`.

- Toggle no cadastro/edição da fila: **"Selecionar horário de funcionamento SÓ
  dessa fila?"**.
- **Marcado** → a fila obedece somente `operatingHoursStart`/`operatingHoursEnd`
  e **ignora** a janela silenciosa global. Fora desse horário a fila não drena.
- **Desmarcado** (default) → a fila **segue a janela silenciosa global**
  (`BotConfig.quietHoursEnabled` + `channelQuietHoursJson`).

Permite ter uma fila rodando 24h e outra que não roda das 22h às 6h, de forma
independente por fila.

## Arquivos

- `prisma/schema.prisma` — `OfferQueue` ganhou `operatingHoursEnabled` (Boolean,
  default false), `operatingHoursStart` e `operatingHoursEnd` (String? "HH:mm",
  America/Sao_Paulo).
- `prisma/migrations/20260618130000_add_offer_queue_operating_hours/` — 3 ALTERs.
- `src/offerQueue/operatingHours.js` (novo) — `isOutsideOperatingHours(now,
  start, end, tz)` + `parseHHMM`. Suporta cruzamento de meia-noite; fail-open
  (config inválida = 24h). Módulo folha, testável sem banco.
- `src/offerQueue/dispatcher.js` — em `drainQueueUnlocked()`, logo após o check
  de bot online: ramo override (horário da fila) vs. ramo global (carrega
  `botConfig` e aplica `quietHoursState`). Novos skips: `outside_operating_hours`
  e `quiet_hours`.
- `src/core/channelThrottle.js` — `parseQuietHours` passou a ser exportado para
  reúso no dispatcher.
- `src/api/routes/offerQueue.js` — `POST /` e `PUT /:id` aceitam/validam (HH:mm)
  /persistem os 3 campos; desligar o toggle zera `start`/`end`.
- `dashboard/app/painel/filas/page.js` — toggle + dois `<input type="time">`
  condicionais, texto explicativo, e resumo da fila mostra `funciona HH:mm–HH:mm`.

## Decisões / caveats

- **Semântica = override** (não acúmulo): escolha explícita da usuária.
- **Caveat de canais:** a janela silenciosa global também é reaplicada para
  destinos canal (`@newsletter`) no `processSendJob` do bot-worker. Logo, uma
  fila com horário próprio que envie para **canal** durante a janela silenciosa
  global ainda seria barrada lá embaixo. O override funciona plenamente para
  **grupos** (caso dominante). Honrar override para canais exigiria flag
  `bypassQuietHours` pelo caminho `sendBroadcast → IPC → worker` (follow-up,
  fora do escopo atual).
- **Sem regressão para quem não usa quiet:** `quietHoursEnabled` default é
  `false`, então o ramo OFF só bloqueia quando a usuária habilitou a janela
  silenciosa global.

## Testes

- `test/offer-queue-operating-hours.test.js` (novo) — helper puro: janela normal,
  cruzamento de meia-noite, bordas, fail-open.
- `test/offer-queue-dispatcher.test.js` — 4 testes novos: fora do horário (skip),
  dentro do horário ignora quiet global, sem horário segue quiet global, quiet
  global desligado não bloqueia.
- `test/offer-queue-routes.test.js` — 1 teste novo: validação HH:mm + persistência
  + zerar campos ao desligar.

Suite alvo verde: `node --test test/offer-queue-*.test.js`.
