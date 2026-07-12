# Phase 1 — Data Model: Smoke list (Etapa 0.5)

Esta feature **não introduz entidades de runtime** (sem schema Prisma, sem
tabelas, sem migração). O "modelo" aqui é conceitual: descreve a estrutura da
curadoria, para rastreabilidade eixo→arquivo (SC-003). Nada disso vira código de
`src/` — vive no `package.json` (lista) e no doc.

## Entidade: Eixo crítico

Uma categoria de comportamento "se quebrar, o produto cai / perde comissão / toma
ban".

| Campo | Descrição |
|---|---|
| `nome` | rótulo do eixo (ex.: "Reconexão honesta / badSession") |
| `motivo` | o que acontece se quebrar (queda de sessão, ban, comissão vazada…) |
| `arquivos[]` | 1..N arquivos de teste existentes que cobrem o eixo |

## Entidade: Subconjunto de smoke

A lista curada e **enumerada explicitamente** (ver plan D1) dos arquivos que
compõem `npm run smoke`. Mapa eixo → arquivo(s):

| Eixo crítico | Arquivo(s) | Toca DB? |
|---|---|---|
| Reconexão honesta / badSession | `test/reconnect-policy.test.js`, `test/session-persistence-policy.test.js` | não |
| Dupla-posse / modo inline↔remote | `test/supervisor-env-guard.test.js`, `test/ops-mode-regression-guard.test.js`, `test/env-modes.test.js` | parcial |
| Dedup (ban/spam e oferta perdida) | `test/message-dedup.test.js`, `test/core/global-dedup.test.js`, `test/core/mirror-dedup-key.test.js`, `test/coupon-dedup-window.test.js`, `test/offer-automation.test.js` | parcial |
| Conversão + comissão nunca vaza | `test/converters-amazon.test.js`, `test/shopee-affiliate-info.test.js`, `test/shopee-shortlink-resolve.test.js`, `test/mercadolivre-resolve.test.js`, `test/mobile-converter.test.js` | não |
| Envio com FOTO (serialização BullMQ) | `test/send-queue-backend.test.js`, `test/send-queue-backend-dlq.test.js` | não |
| Cripto de credencial | `test/credential-crypto.test.js` | não |
| Login / brute-force | `test/auth.test.js`, `test/auth-rate-limit.test.js` | sim |
| Pagamento | `test/payments-webhook.test.js`, `test/payments-service.test.js` | sim |
| imageMode sempre 'preview' | `test/group-entitlements.test.js`, `test/groups-route-image-mode.test.js` | parcial |
| Fiação do retry-cache | `test/bot-worker-retry-cache-wiring.test.js` | não |
| Teto de memória do worker | `test/core/worker-spawn-options.test.js` | não |

**Total: 26 arquivos / 11 eixos.** A coluna "Toca DB?" é indicativa e sustenta a
decisão de manter o `presmoke` (reset de DB) por segurança — os poucos que tocam
banco não podem sair falso-vermelho. A marcação definitiva de quais tocam DB é
consolidada no doc de Nível 1 (FR-006).

## Entidade: Checklist de regressão manual

O documento `docs/testing/regression-checklist.md`, com duas partes:

| Parte | Conteúdo |
|---|---|
| Nível 1 | o que o smoke cobre (a tabela acima) + como rodar (`npm run smoke`) + quais tocam DB |
| Nível 2 | ritual manual de staging (QR, restart remote, espelhamento com foto, clique no celular, dashboard, pagamento sandbox) + referência aos 3 smoke de deploy + lição comportamento-vs-regex |

## Regras / invariantes

- **INV-1**: cada eixo crítico tem ≥ 1 arquivo no subconjunto (SC-003).
- **INV-2**: todo arquivo listado existe em `test/`; ausência → smoke falha
  visivelmente (FR-007).
- **INV-3**: nenhum arquivo de `src/` ou teste existente é modificado (FR-012).
