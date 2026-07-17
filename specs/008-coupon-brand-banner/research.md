# Phase 0 Research — Banner de marca "CUPOM + loja"

Contexto imutável já decidido com a usuária (não re-perguntar). As decisões abaixo consolidam o "como" técnico do gatilho reativado, sem inventar escopo fora da spec.

## D1 — Onde vive a decisão do banner

- **Decisão**: novo módulo LEAF puro `src/converters/couponBrandCardPolicy.js` exportando `shouldUseCouponBrandCard(input)` (booleano), sem I/O e sem importar `bot-worker.js`/`db.js`.
- **Rationale**: espelha o padrão consolidado do repo (`couponPolicy.js`, `reconnectPolicy.js`, `mlVitrinePolicy.js`) — mantém `bot-worker.js` enxuto e permite teste unitário sem sockets/DB. Concentra a blindagem tripla num único ponto auditável.
- **Alternativas rejeitadas**: inline em `buildManualLinkPreview` (infla o bot-worker, difícil de testar isoladamente, foi exatamente onde a regressão #1205 nasceu).

## D2 — Condição (a): `linkKind === 'coupon'`

- **Decisão**: consumir `primary.linkKind` como já resolvido por `resolveLinkKind` (linha ~2700 do bot-worker). Não tocar em `linkKind.js/resolveLinkKind` (FR-010).
- **Rationale**: a classificação já reflete o converter (que conhece ASIN/MLB internamente) com fallback por regex; alterá-la faria mais links virarem `coupon` (proibido por FR-010).

## D3 — Condição (b): sinal de TEXTO confirma cupom/vitrine

- **Decisão**: o sinal de texto é `isCouponAnnouncement(sanitizedText)` (já calculado em `isCouponMsg`, bot-worker ~linha 2463) OU o sinal de **vitrine ML** já existente no fluxo de conversão do Mercado Livre. `buildManualLinkPreview` passa a receber esse booleano combinado (`couponTextSignal`) do chamador, em vez de recalcular sobre o `text` já mutado do card.
- **Rationale**: `isCouponMsg` já existe no escopo do processamento da mensagem; passá-lo evita divergência entre o texto original e o texto final do preview. Para vitrine ML, reusar o marcador já produzido pelo converter (`mercadolivre.js`/`mlVitrinePolicy.js`) em vez de criar detector novo (Assumptions da spec: "nenhum novo detector precisa ser criado").
- **Ponto a confirmar na implementação (não bloqueia o plano)**: qual campo exato do `primary`/resultado de conversão marca "vitrine ML sem produto" para ser mapeado ao `couponTextSignal`. Se não houver flag dedicada acessível em `buildManualLinkPreview`, o caso vitrine é coberto por `isCouponAnnouncement` do texto + a condição (c) (URL sem MLB) — que já é suficiente para os cenários US2. A tarefa de implementação deve escolher o sinal mais específico disponível sem alargar `linkKind`.
- **Alternativas rejeitadas**: recalcular `isCouponAnnouncement` sobre o `text` do card (pode ter sido reescrito/branding aplicado); criar novo detector de vitrine (fora de escopo por decisão da usuária).

## D4 — Condição (c): URL resolvida sem ASIN/MLB

- **Decisão**: expor de `linkKind.js` um detector puro reutilizável (ex.: `urlHasProductId(platform, url)` baseado nos já existentes `AMAZON_ASIN_RE`/`MLB_ID_RE`/`PRODUCT_ID_DETECTORS`) e chamá-lo no LEAF sobre a URL resolvida (`primary.converted` e/ou `primary.url`). Banner só passa quando o detector retorna `false` para Amazon e ML.
- **Rationale**: reusa a regex canônica (fonte única de verdade de "o que é ID de produto"), evita duplicar padrões e mantém `resolveLinkKind` intacto — só adiciona um export (FR-010 preservado). É a trava direta contra a regressão: um produto por short link que porventura já tenha resolvido para uma URL com ASIN/MLB nunca recebe banner.
- **Alternativas rejeitadas**: reimplementar as regex no LEAF (duplicação, risco de divergir de `linkKind.js`).

## D5 — Flag de rollout

- **Decisão**: substituir `const COUPON_BRAND_CARD_ENABLED = false` por `const COUPON_BRAND_CARD_ENABLED = process.env.COUPON_BRAND_CARD_ENABLED === 'true'` (leitura em runtime; liga só com o literal `'true'`). Default OFF.
- **Rationale**: FR-003/SC-006 — rollback em prod = desligar a env sem redeploy. Mesmo padrão de `PREVIEW_CARD_HIDE_STORE_TITLE` logo abaixo no arquivo.
- **AGENTS.md**: documentar `COUPON_BRAND_CARD_ENABLED=true` como default em **staging** (blocos `.env` de staging e prod) e **OFF em prod** até validação (FR-013). `.env` é gitignored → aplicação manual no VPS.

## D6 — Invariante #1186 (`title` nunca omitido)

- **Decisão**: manter `title: storePreviewTitle(...)` sempre presente no `urlInfo`. Quando o banner é aplicado, `isCoupon=true` mantém o prefixo "Cupom <loja>" (mesmo texto do banner). Não alterar `storePreviewTitle` nem o guard estrutural `test/store-brand-card.test.js`.
- **Rationale**: omitir `title` derrubou o card em produção (#1186). FR-008/SC-005 exigem presença sempre.

## D7 — Falha de geração do banner

- **Decisão**: `buildStoreBrandCardImage` já cacheia `null` e não lança; no gatilho, banner ausente (`undefined`) faz o fluxo cair no caminho atual (sem banner) — se não houver thumbnail, `buildManualLinkPreview` retorna `null` e o Baileys tenta o preview automático. Nenhum `throw` novo introduzido.
- **Rationale**: FR-009 — falha de banner nunca interrompe o envio.

## D8 — Loja não suportada

- **Decisão**: `isBrandCardPlatform(platform)` (já em `storeBrandCard.js`) delimita Amazon/Shopee/Mercado Livre/Magalu; fora dessa lista, `buildStoreBrandCardImage` devolve `null` → sem banner. O LEAF pode checar `isBrandCardPlatform` como parte da decisão para não sequer marcar "usar banner" em loja não suportada.
- **Rationale**: FR-007 + edge case "loja não suportada".

## Itens sem NEEDS CLARIFICATION pendentes

Todas as incógnitas do Technical Context estão resolvidas. O único ponto de implementação em aberto (D3 — campo exato do sinal de vitrine ML) tem fallback seguro definido e não bloqueia planejamento nem tarefas.
