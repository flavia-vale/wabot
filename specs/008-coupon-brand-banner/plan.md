# Implementation Plan: Banner de marca "CUPOM + loja" para cupom e vitrine

**Branch**: `claude/showcase-coupon-images-fhfxgj` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-coupon-brand-banner/spec.md`

## Summary

Reativar o gerador de banner de marca já existente (`src/converters/storeBrandCard.js`, "CUPOM" + nome da loja para Amazon/Shopee/Mercado Livre/Magalu, visual intocado) no modo preview do WhatsApp, controlado pela env `COUPON_BRAND_CARD_ENABLED` (default OFF). O núcleo da feature é uma **blindagem tripla** que só aplica o banner quando as três condições são verdadeiras ao mesmo tempo: (a) `primary.linkKind === 'coupon'`, (b) um sinal de **texto** confirma cupom/vitrine, e (c) a URL resolvida **não** contém ASIN (Amazon) nem MLB (Mercado Livre). A decisão é extraída para um **módulo LEAF puro e testável** (`src/converters/couponBrandCardPolicy.js`), seguindo o padrão do repo (`couponPolicy.js`, `reconnectPolicy.js`, `mlVitrinePolicy.js`), reusando os detectores de ASIN/MLB de `linkKind.js`. Isso impede a regressão #1205/#1208 (produto por short link saindo com banner de cupom). Sem migration, sem impacto de memória relevante.

## Technical Context

**Language/Version**: Node.js (ESM, `import`/`export`), mesmo runtime dos bot-workers

**Primary Dependencies**: `sharp` (já usado por `storeBrandCard.js`); Baileys (link preview do card); nenhuma dependência nova

**Storage**: N/A — banner é gerado em runtime e cacheado 1x por processo por loja; sem persistência, sem coluna nova, sem migration

**Testing**: `node:test` (`node --test`), padrão do repo; testes unitários puros sobre o módulo LEAF + guard estrutural existente de `storeBrandCard`

**Target Platform**: VPS Linux (bot-worker `fork()` da API/supervisor)

**Project Type**: Serviço backend Node (monólito wabot) — single project

**Performance Goals**: Nenhuma mudança de throughput; banner cacheado em `Map` por processo (~15-40KB por loja), custo desprezível no caminho de envio

**Constraints**: Não regredir #1205/#1208 (produto short link → foto, nunca banner); invariante #1186 (`title` do card nunca omitido); FR-010 (não alterar `linkKind`, nenhum link novo vira `coupon`); default OFF em prod; rollback = desligar env sem redeploy

**Scale/Scope**: 3 arquivos de código tocados (`bot-worker.js`, novo módulo LEAF, `linkKind.js` só ganha um export), `AGENTS.md` (docs de env), e testes. Sem novo processo PM2, sem Redis, sem heap adicional

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` é um template não preenchido (placeholders `[PRINCIPLE_x]`) — não há princípios ratificados a verificar. Aplica-se, no lugar, o `AGENTS.md` canônico do wabot:

- **Fluxo feature → develop → main**: PR contra `develop`, autodeploy staging, validação manual, depois `develop → main`. ✅ respeitado (branch `claude/showcase-coupon-images-fhfxgj`, PR contra `develop`).
- **Política de memória (super-sinalizar)**: banner cacheado 1x/loja/processo (~15-40KB) — **não** é mudança memory-heavy; a política não é acionada. ✅
- **Invariante #1186** (`title` sempre presente): preservada por FR-008 + guard estrutural. ✅
- **Módulos LEAF puros/testáveis** para lógica de decisão (padrão `couponPolicy.js`/`reconnectPolicy.js`/`mlVitrinePolicy.js`): adotado. ✅
- **Sem migration / sem troca de portas / sem `.env` de prod alterado sem OK**: nenhum desses toques. ✅

**Resultado**: PASS (sem violações; sem Complexity Tracking a justificar).

## Project Structure

### Documentation (this feature)

```text
specs/008-coupon-brand-banner/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 — decisões de wiring dos 3 sinais
├── data-model.md        # Phase 1 — entidades lógicas (sem persistência)
├── quickstart.md        # Phase 1 — como validar em staging
├── contracts/
│   └── couponBrandCardPolicy.md   # Contrato do módulo LEAF de decisão
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── converters/
│   ├── couponBrandCardPolicy.js   # NOVO — módulo LEAF puro: shouldUseCouponBrandCard()
│   ├── linkKind.js                # ganha export do detector de ASIN/MLB (sem alterar resolveLinkKind)
│   └── storeBrandCard.js          # PRESERVADO/intocado (visual não muda) — só reativado
├── messageProcessor.js            # PRESERVADO — isCouponAnnouncement/looksLikeGenericCoupon reusados
└── bot-worker.js                  # gatilho: lê env + chama policy em buildManualLinkPreview

test/
├── coupon-brand-card-policy.test.js   # NOVO — unit puro do LEAF (as 3 condições + matriz)
├── store-brand-card.test.js           # PRESERVADO (guard estrutural, não remover)
└── bot-worker-manual-link-preview-channel.test.js  # ajustar/estender p/ o gatilho

AGENTS.md   # docs: COUPON_BRAND_CARD_ENABLED=true default STAGING, OFF prod
```

**Structure Decision**: Single project (monólito wabot). A lógica de decisão vai para um novo módulo LEAF em `src/converters/` (mesma pasta de `couponPolicy.js`/`mlVitrinePolicy.js`), sem I/O e sem importar `bot-worker.js`/`db.js`, para permitir teste unitário isolado. `bot-worker.js` apenas lê a env e delega a decisão ao módulo; `linkKind.js` expõe o detector de ID de produto já existente (adição de export, `resolveLinkKind` inalterado → FR-010).

## Complexity Tracking

> Sem violações de Constitution/AGENTS — seção não aplicável.
