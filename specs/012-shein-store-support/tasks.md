---

description: "Task list for SHEIN como 5ª loja de conversão de links"
---

# Tasks: SHEIN como 5ª loja de conversão de links

**Input**: Design documents from `/specs/012-shein-store-support/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/converter-shein.md,
contracts/credential-shein.md, contracts/registries.md

**Tests**: incluídas (feature exige regressão automatizada — FR-025). Todas db-free e sem rede
(`fetchImpl` injetado), como as das outras lojas. **Nenhuma task acessa a SHEIN** — a loja bloqueia
o VPS por captcha (research.md D-004). Validação manual em staging/produção **não** entra aqui —
está em `quickstart.md`, passos 4-7.

**Organization**: agrupado por user story, na ordem de prioridade do spec.md (US1 P1, US2 P1, US3
P2, US4 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivo diferente, sem dependência de task incompleta)
- **[Story]**: US1/US2/US3/US4, ou nenhum label nas fases Setup/Foundational/Polish

## Path Conventions

Monorepo existente: backend Node em `src/`, dashboard Next.js em `dashboard/`, testes em `test/`,
migrations em `prisma/migrations/`. Nenhum diretório novo.

---

## Phase 1: Setup

**Purpose**: criar o módulo conversor puro que todo o resto depende (núcleo isolado, testável sem
nenhum registry preenchido ainda).

- [X] T001 Criar `src/converters/shein.js` com as constantes exportadas do contrato
      (`SHEIN_PRODUCT_RE`, `SHEIN_GOODS_ID_RE`, `SHEIN_RISK_RE`, `THIRD_PARTY_PARAMS`,
      `OPAQUE_SHARE_PARAMS`, `PROGRAM_PARAMS`, `AFFILIATE_URL_FROM_PREFIX`) — portar exatamente de
      `scripts/diag-shein-affiliate-link.mjs` (ver `contracts/converter-shein.md`, seção
      "Constantes exportadas")

**Checkpoint**: arquivo existe, exporta as constantes; nada mais depende disso ainda.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o núcleo de resolução/conversão precisa existir e passar nos próprios testes antes de
qualquer registry ser preenchido — é o que os registries vão importar/consumir.

**⚠️ CRITICAL**: nenhuma task de US1/US2/US3/US4 pode começar antes do checkpoint desta fase.

- [X] T002 [P] Implementar `isSheinShortLink(url)` em `src/converters/shein.js` — `true` para host
      `onelink.shein.com` ou `shein.top` com prefixo `(?:[a-z0-9-]+\.)*` (contracts/converter-shein.md)
- [X] T003 [P] Implementar `extractSheinGoodsId(url)` em `src/converters/shein.js` — caminho
      `-p-<id>.html` ou query `goods_id=<id>`; `null` quando nenhum
- [X] T004 [P] Implementar `hasOpaqueShareToken(url)` em `src/converters/shein.js` — `true` se houver
      `shc` ou `link` na query
- [X] T005 [P] Implementar `stripSheinAffiliateTracking(url)` em `src/converters/shein.js` — remove
      `THIRD_PARTY_PARAMS` + toda chave `/^utm_/i`, preserva caminho/`goods_id`/demais params; URL
      inválida devolve a entrada inalterada
- [X] T006 Implementar `resolveSheinShortLink(url, { timeoutMs = 8000, maxHops = 6, fetchImpl =
      globalThis.fetch })` em `src/converters/shein.js` — portar `resolveOneLink` de
      `scripts/diag-shein-affiliate-link.mjs`: redirects manuais, cookie jar, ordem de decisão por
      hop do contrato (produto já revelado → retorna; `Location` casando `SHEIN_RISK_RE` → para no
      hop anterior; sem `Location` extrai de `<input id="url">` → meta-refresh → `location =` JS →
      `<link rel=canonical>`, sempre checando `/risk/` antes de seguir; sem destino/maxHops
      esgotado/erro de rede → última URL conhecida; nunca lança) (depende de T002)
- [X] T007 Implementar `convert(url, creds)` em `src/converters/shein.js` — os 9 passos do contrato
      (sem `creds.tag` → `null`; resolve shortlink se aplicável; token opaco → `null`; strip de
      tracking; aplica `koc_id`/`url_from` da cliente; garante `PROGRAM_PARAMS`; `linkKind`
      product/coupon; produto sem `goods_id` → `null`; exceção → `null`) (depende de T003, T004,
      T005, T006)
- [X] T008 [P] Criar `test/shein-shortlink-resolve.test.js` (db-free, `fetchImpl` mockado): 1º hop
      200 com `<input id="url">` segue para o destino; hop intermediário já com `goods_id` para ali;
      `Location` para `/risk/challenge` para no hop anterior; corpo HTML cujo único destino é
      `/risk/challenge` idem; cadeia sem fim para em `maxHops`; cookies do hop 1 reenviados no hop 2
      (depende de T006)
- [X] T009 [P] Criar `test/converters-shein.test.js` (db-free, `fetchImpl` mockado) cobrindo INV-1 a
      INV-6 do contrato: produto direto converte com identidade da cliente e `linkKind:'product'`;
      destino de outro afiliado perde a identidade dele e ganha a da cliente preservando `goods_id`
      (INV-1); `shc`/`link` → `null` (INV-2); produto sem `goods_id` → `null` (INV-3);
      `onelink`/`requestId`/`behaviorId`/`utm_*` ausentes da saída (INV-4); `fetchImpl` que rejeita →
      `null` (INV-5); cupom/campanha → `linkKind:'coupon'` sem depender de `COUPON_LINK_CONVERT`
      (INV-6); sem `creds.tag` → `null` (depende de T007)
- [X] T010 Rodar `node --test test/converters-shein.test.js test/shein-shortlink-resolve.test.js` e
      confirmar tudo verde antes de prosseguir (depende de T008, T009)

**Checkpoint**: `src/converters/shein.js` completo e testado isoladamente — nenhum registry ainda
sabe que ele existe. A partir daqui, US1 e US2 podem avançar em paralelo.

---

## Phase 3: User Story 1 - Cadastrar a SHEIN colando um link de afiliada (Priority: P1) 🎯 MVP

**Goal**: a cliente cadastra/edita/apaga a credencial SHEIN pelo painel — um campo só, aceitando
link ou número, com recusa explicada em linguagem leiga para o link errado.

**Independent Test**: cadastrar a SHEIN no painel com um link de afiliada válido e ver a loja
aparecer como pronta; repetir com o link de compartilhamento e ver o aviso explicando a diferença.

### Implementation for User Story 1

- [X] T011 [US1] `src/credentialHealth.js:3` — `PLATFORM_LABELS.shein = 'SHEIN'`
      (contracts/registries.md B1)
- [X] T012 [US1] `src/credentialHealth.js:51` — `REQUIRED_FIELDS.shein = ['tag']`
      (contracts/registries.md B2, depende de T011)
- [X] T013 [US1] `src/credentialHealth.js:200` — ramo `shein` em `sanitizeCredentialBody`: só
      dígitos → dígitos; link com `koc_id=<n>` → `<n>`; link com `url_from=affiliate_koc_<n>` →
      `<n>`; oneLink/`GM7`/`shc`/`link`/outra coisa → mantido como veio (reprovado na validação)
      (contracts/credential-shein.md, contracts/registries.md B4, depende de T011)
- [X] T014 [US1] `src/credentialHealth.js:66` — ramo `shein` em `getFormatWarnings`: valor final não
      numérico → recusa "era esperado o link de afiliada ou o número"; entrada com `GM7`/`shc`/`link`
      → recusa específica explicando o Gerador de Link do painel de afiliada; número muito curto →
      aviso leve não bloqueante (contracts/credential-shein.md, contracts/registries.md B3, depende
      de T011)
- [X] T015 [P] [US1] `prisma/schema.prisma:294` — default de `BotConfig.platforms` passa a incluir
      `shein` (contracts/registries.md B5)
- [X] T016 [US1] Criar migration DML `prisma/migrations/<ts>_botconfig_platforms_add_shein/migration.sql`
      idempotente, sem `ALTER TABLE`, conforme data-model.md seção 7 (`UPDATE "BotConfig" SET
      "platforms" = "platforms" || ',shein' WHERE ',' || COALESCE("platforms",'') || ',' NOT LIKE
      '%,shein,%'`) (contracts/registries.md B6, depende de T015)
- [X] T017 [P] [US1] `src/api/routes/config.js:12` — CSV default ganha `shein`
      (contracts/registries.md B7)
- [X] T018 [P] [US1] `src/bot-worker.js:633` — CSV default ganha `shein`
      (contracts/registries.md B8)
- [X] T019 [P] [US1] `scripts/reset-legacy-botconfig-fields.mjs:29` — CSV default ganha `shein`
      (contracts/registries.md B9)
- [X] T020 [P] [US1] `src/api/routes/groups.js:175` — whitelist `allowedPlatforms` ganha `'shein'`
      (contracts/registries.md B10)
- [X] T021 [P] [US1] `dashboard/lib/painel/affiliatePlatforms.js:75-86` — entrada `shein` (id,
      label, `instructions` e `fields` em linguagem leiga, `actionLinks` para a página do programa de
      afiliadas), no formato declarativo do Magalu (contracts/credential-shein.md, vocabulário
      obrigatório: "seu link de afiliada da SHEIN", "seu número de afiliada", "o link do botão de
      compartilhar do aplicativo não serve"; proibido: `koc_id`, `url_from`, `goods_id`, `aff_id`,
      `oneLink`, `affiliate_koc`, `GM7`, `token`, `parâmetro`, `query string`, `captcha`)
      (contracts/registries.md D14)
- [X] T022 [US1] Criar/estender teste de validação e normalização de credencial da SHEIN (junto de
      `test/credential-*` existente — usar o mesmo arquivo/padrão das outras lojas) cobrindo: número
      puro aceito; link de afiliada extrai o número; link com `url_from=affiliate_koc_<n>` extrai o
      número; link de compartilhamento (`GM7`/`shc`/`link`) recusado com mensagem que ensina; texto
      aleatório recusado (depende de T013, T014)
- [X] T023 [P] [US1] Atualizar `test/painel-linguagem-leiga.test.js` para cobrir a entrada `shein`
      de `affiliatePlatforms.js` — reprovar jargão (`koc_id`, `url_from`, `goods_id`, `GM7`, etc.)
      (contracts/registries.md, depende de T021)
- [X] T024 [P] [US1] Atualizar `test/painel-ids-afiliada-privacy.test.js` confirmando que a entrada
      `shein` não reintroduz "modo sem cookie" nem campo de sessão (depende de T021)
- [X] T025 [P] [US1] Atualizar `test/groups-route-image-mode.test.js` confirmando `shein` aceito na
      whitelist de `allowedPlatforms` (depende de T020)
- [X] T026 [P] [US1] Criar `test/migrations-botconfig-platforms-shein.test.js` confirmando que a
      migration de T016 é DML puro (sem `ALTER TABLE`) e idempotente (aplicar 2x sem efeito
      colateral), seguindo o padrão de `test/migrations-group-image-mode-preview.test.js` (depende
      de T016)
- [X] T027 [US1] Rodar `node --test test/painel-linguagem-leiga.test.js
      test/painel-ids-afiliada-privacy.test.js test/groups-route-image-mode.test.js
      test/migrations-botconfig-platforms-shein.test.js` e os testes de credencial de T022,
      confirmar tudo verde (depende de T022, T023, T024, T025, T026)

**Checkpoint**: US1 completa e testável isoladamente — cadastro/normalização/recusa/apagar
funcionam sem depender de US2/US3/US4. Explicitamente fora daqui: confirmar visualmente no painel
(staging) que a loja aparece ao lado das outras quatro — isso é `quickstart.md` passo 4a, não task.

---

## Phase 4: User Story 2 - Oferta de produto SHEIN é espelhada com a comissão da cliente (Priority: P1)

**Goal**: link de SHEIN numa mensagem monitorada é detectado, convertido e publicado com a
identidade da cliente; falha honesta (nada publicado) quando o produto não pode ser identificado.

**Independent Test**: publicar uma oferta com link de SHEIN num grupo monitorado e conferir no
grupo de destino que o link publicado leva ao mesmo produto e carrega a identificação da cliente.

**Depends on**: Phase 2 (núcleo `shein.js` já testado). Pode rodar em paralelo com Phase 3.

### Implementation for User Story 2

- [X] T028 [US2] `src/detector.js:4-9` — `PATTERNS.shein` com os domínios reais (`shein.com`,
      `br.shein.com`, `m.shein.com`, `us.shein.com`, `pt.shein.com`, `onelink.shein.com`,
      `api-shein.shein.com`, `shein.top`), mantendo o prefixo `(?:[a-z0-9-]+\.)*`, **sem**
      `s.shein.com` (não existe) — alimenta `detectLinks` e `isOfferUrl` (research.md D-012,
      contracts/registries.md A1)
- [X] T029 [US2] `src/converters/index.js:1-11` — `import { convert as convertShein } from
      './shein.js'` + entrada `shein` em `CONVERTERS` (contracts/registries.md A2, depende de T007,
      T028)
- [X] T030 [P] [US2] `src/converters/linkKind.js:24-27` — `PRODUCT_ID_DETECTORS.shein = (url) =>
      /-p-\d+|[?&]goods_id=\d+/i.test(url)` (contracts/registries.md A3)
- [X] T031 [P] [US2] Atualizar `test/detector.test.js` — domínios reais de SHEIN casam;
      `s.shein.com` e host colado (`notshein.com`) não casam (depende de T028)
- [X] T032 [P] [US2] Atualizar `test/link-kind.test.js` — produto (`goods_id`/`-p-<id>`) vs cupom
      para SHEIN (depende de T030)
- [X] T033 [US2] Rodar `node --test test/detector.test.js test/link-kind.test.js` e confirmar tudo
      verde (depende de T029, T031, T032)

**Checkpoint**: US2 completa — detecção + conversão + registro do dispatcher funcionam. O caminho
"loja não configurada" (US2 cenário 3) já é coberto pelo `convertLink` existente, sem código novo
(contracts/converter-shein.md). MVP = Phase 1+2+3+4.

---

## Phase 5: User Story 3 - A oferta de SHEIN sai com foto do produto (Priority: P2)

**Goal**: card clicável da oferta SHEIN sai com foto do produto (via `og:image` do oneLink) e nome
da loja no card; frase promocional genérica nunca vira título.

**Independent Test**: enviar uma oferta de SHEIN e conferir que o card tem foto em boa resolução e
o texto do grupo de origem como descrição.

**Depends on**: Phase 4 (US2) completa — a foto/card partem do link já convertido.

### Implementation for User Story 3

- [X] T034 [P] [US3] `src/bot-worker.js:1501` — `STORE_PREVIEW_TITLES.shein = 'SHEIN'` (o campo
      `title` do card nunca pode ser omitido — regressão PR #1186) (contracts/registries.md C1)
- [X] T035 [P] [US3] `src/converters/storeBrandCard.js:28` — `BRAND_STYLES.shein = { store: 'SHEIN',
      bg: '#000000', fg: '#FFFFFF', accent: '#FFFFFF' }` (contracts/registries.md C2)
- [X] T036 [P] [US3] `src/core/mirrorTemplate.js:17` — `PLATFORM_LABELS.shein = 'SHEIN'`
      (contracts/registries.md C3)
- [X] T037 [P] [US3] `src/core/copyLinter.js:11` — `BRAND_RE` ganha `shein`
      (contracts/registries.md C4)
- [X] T038 [US3] `src/converters/imageScrapers.js:419` — ramo `shein` em `fetchProductImage`: lê
      `og:image` da página do oneLink (não da página de produto) e remove o sufixo de miniatura
      (`_thumbnail_405x552`) do endereço em `img.ltwebstatic.com`, resultando na imagem original
      (research.md D-005); sem foto disponível, degrada sem erro (contracts/registries.md C5)
- [X] T039 [US3] `src/converters/productInfoScraper.js:254,278` — acrescentar a frase promocional
      genérica da SHEIN a `BOGUS_SCRAPE_TITLES` / `BOGUS_SCRAPE_TITLE_PATTERNS` como padrão (regex,
      não casamento exato) (research.md D-006, contracts/registries.md C6)
- [X] T040 [P] [US3] Atualizar `test/store-brand-card.test.js` — banner SHEIN renderiza; guarda
      estrutural de que `title` nunca é omitido continua valendo para SHEIN (depende de T034, T035)
- [X] T041 [P] [US3] Atualizar `test/product-info-scraper.test.js` — frase genérica da SHEIN
      reprovada como título (depende de T039)
- [X] T042 [P] [US3] Atualizar `test/mirror-template.test.js` — rótulo `SHEIN` da loja (depende de
      T036)
- [X] T043 [US3] Rodar `node --test test/store-brand-card.test.js test/product-info-scraper.test.js
      test/mirror-template.test.js` e confirmar tudo verde (depende de T040, T041, T042)

**Checkpoint**: US3 completa — card com foto e identidade visual, sem risco de título-lixo.

---

## Phase 6: User Story 4 - Cupom e campanha da SHEIN também convertem (Priority: P3)

**Goal**: links de SHEIN sem produto (cupom/campanha/vitrine) convertem pelo mesmo mecanismo, sem
depender de `COUPON_LINK_CONVERT`, com o mesmo banner de cupom das outras lojas.

**Independent Test**: espelhar uma mensagem com link de campanha/cupom de SHEIN e conferir que o
link publicado credita a cliente e sai com o tratamento visual de cupom.

**Depends on**: Phase 4 (US2) — o `convert()` já cobre `linkKind:'coupon'` (INV-6, coberto em T009);
Phase 5 (US3) — o banner de marca (`BRAND_STYLES.shein`, T035) é reaproveitado para o cupom.

### Implementation for User Story 4

- [X] T044 [US4] Conferir/ajustar em `src/bot-worker.js` (caminho de banner de cupom) que
      `linkKind:'coupon'` de SHEIN aciona o mesmo tratamento visual de cupom já aplicado a Shopee/
      Amazon/ML/Magalu, reusando `BRAND_STYLES.shein` de T035 — sem gate de `COUPON_LINK_CONVERT`
      (research.md D-008, depende de T029, T035)
- [X] T045 [US4] Estender `test/converters-shein.test.js` (ou teste de banner de cupom existente,
      se o tratamento visual tiver arquivo próprio) confirmando que o banner "CUPOM SHEIN" é
      acionado para `linkKind:'coupon'` sem `COUPON_LINK_CONVERT` setado (depende de T044)

**Checkpoint**: todas as 4 user stories funcionalmente completas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: fechar as duplicações restantes do painel (catálogos móveis e telas que não pertencem
a nenhuma user story isolada), e a passada final de regressão.

- [X] T046 [P] `dashboard/app/painel/converte-links/page.js:15` — `SUPPORTED_LINK_RE` ganha os
      domínios da SHEIN (contracts/registries.md D2)
- [X] T047 [P] `dashboard/app/painel/converte-links/page.js:42` — texto "Use um link de Amazon,
      Mercado Livre, Shopee ou Magazine Luiza" ganha SHEIN (contracts/registries.md D3)
- [X] T048 [P] `dashboard/app/painel/criar-oferta/page.js:25` — `STORES` ganha `{ test: /shein/i,
      name: 'SHEIN', bg: '#000000', fg: '#fff', mark: 'S' }` (contracts/registries.md D4)
- [X] T049 [P] `dashboard/app/painel/criar-oferta/page.js:286` — texto "Cole um link de …" ganha
      SHEIN (contracts/registries.md D5)
- [X] T050 [P] `dashboard/lib/mobileOfferComposer.js:60` — `COUPON_STORES` ganha `{ key: 'shein',
      nome: 'SHEIN', cor: '#000000' }` (contracts/registries.md D6)
- [X] T051 [P] `dashboard/lib/mobileOfferComposer.js:129` — detecção por host: `if
      (host.includes('shein')) return 'shein'` (contracts/registries.md D7)
- [X] T052 [P] `src/converters/offerEngine.js:52` — ramo SHEIN opcional em `inferTitleFromUrl`, só
      para `-p-<slug>` direto (contracts/registries.md D8)
- [X] T053 [P] `src/converters/productInfoScraper.js:310` — ramo SHEIN opcional em
      `extractTitleFromUrl`, mesma nota de D8 (contracts/registries.md D9)
- [X] T054 [P] `dashboard/app/painel/grupos/page.js:20` — `ALL_PLATFORMS` ganha `shein`
      (contracts/registries.md D10)
- [X] T055 [P] `dashboard/lib/mobileGroupPicker.js:44` — `MOBILE_GROUP_PLATFORMS` ganha `shein`
      (contracts/registries.md D11)
- [X] T056 [P] `dashboard/lib/mobileLogs.js:12` — `MOBILE_LOG_PLATFORM_LABEL.shein = 'SHEIN'`
      (contracts/registries.md D12)
- [X] T057 [P] `dashboard/lib/mobileCouponStore.js:9` — `DEFAULT_COUPON_LINKS` ganha `shein: ''`
      (contracts/registries.md D13)
- [X] T058 Atualizar os testes `test/mobile-*.test.js` relevantes para cobrir SHEIN nos catálogos
      móveis (`mobileOfferComposer`, `mobileGroupPicker`, `mobileLogs`, `mobileCouponStore`)
      (depende de T050, T051, T055, T056, T057)
- [X] T059 `cd dashboard && npm run build` — obrigatório: a allowlist de domínios/catálogos do
      painel vai para o bundle do Next; sem isso o painel segue dizendo "link não suportado" mesmo
      com o backend correto (contracts/registries.md, nota final; depende de T046-T057)
- [X] T060 Rodar a suíte inteira `npm test` na raiz e confirmar zero regressão nas quatro lojas
      existentes (FR-023, SC-007) — não corrigir nada fora do escopo desta feature se algo já
      estivesse quebrado antes; qualquer falha nova precisa ser resolvida antes de considerar a
      feature pronta (depende de todas as tasks anteriores)

**Não incluído aqui (pertence a `quickstart.md`, não a tasks.md)**: validação manual em staging
(passos 4a-4f), diagnóstico ao vivo com `scripts/diag-shein-affiliate-link.mjs` contra links reais,
e o gate de comissão no celular (quickstart.md passo 6) — nenhum agente consegue executar esses
passos sem acesso à SHEIN, e travá-los como checkbox aqui bloquearia o orquestrador do
`/speckit-flow` indefinidamente (mesmo problema já ocorrido na feature 011).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: depende de Phase 1 — BLOQUEIA todas as user stories
- **US1 (Phase 3)** e **US2 (Phase 4)**: ambas dependem só de Phase 2; podem rodar em paralelo entre si
- **US3 (Phase 5)**: depende de US2 (Phase 4) completa — o card/foto partem do link já convertido
- **US4 (Phase 6)**: depende de US2 (Phase 4, para `linkKind:'coupon'`) e de US3 (Phase 5, para
  `BRAND_STYLES.shein`)
- **Polish (Phase 7)**: depende de todas as user stories desejadas estarem completas; T059/T060 são
  os últimos passos, depois de tudo o resto

### User Story Dependencies

- **US1 (P1)**: independente de US2/US3/US4 — cadastro funciona mesmo sem conversão implementada
  (a loja aparece configurada; testar isoladamente com o painel)
- **US2 (P1)**: independente de US1 no código (o `convert()` já existe desde Phase 2); para ser
  testável fim-a-fim precisa de uma credencial cadastrada, mas isso é dado de teste, não dependência
  de implementação
- **US3 (P2)**: depende de US2 — precisa do link já convertido para montar o card
- **US4 (P3)**: depende de US2 (mecanismo de conversão) e US3 (banner de marca)

### Parallel Opportunities

- T002-T005 (dentro de Phase 2) são paralelos entre si — funções puras independentes no mesmo
  arquivo, mas sem dependência umas nas outras (cuidado: mesmo arquivo `shein.js`, paralelizar só se
  o processo de edição suportar merge sem conflito; caso contrário, tratar como sequencial curto)
- Phase 3 (US1) e Phase 4 (US2) podem ser executadas em paralelo por agentes diferentes após o
  checkpoint de Phase 2
- T015, T017-T020 (Phase 3) são paralelos — arquivos diferentes
- T021, T023-T026 (Phase 3) são paralelos — arquivos diferentes
- T030-T032 (Phase 4) são paralelos — arquivos diferentes
- T034-T037 (Phase 5) são paralelos — arquivos diferentes
- T046-T057 (Phase 7) são todos paralelos — arquivos diferentes, sem dependência entre si

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Depois de T001, lançar em paralelo as funções puras do módulo:
Task: "Implementar isSheinShortLink em src/converters/shein.js"
Task: "Implementar extractSheinGoodsId em src/converters/shein.js"
Task: "Implementar hasOpaqueShareToken em src/converters/shein.js"
Task: "Implementar stripSheinAffiliateTracking em src/converters/shein.js"
```

## Parallel Example: Phase 3 (US1) — registries independentes

```bash
Task: "prisma/schema.prisma:294 — default de BotConfig.platforms ganha shein"
Task: "src/api/routes/config.js:12 — CSV default ganha shein"
Task: "src/bot-worker.js:633 — CSV default ganha shein"
Task: "scripts/reset-legacy-botconfig-fields.mjs:29 — CSV default ganha shein"
Task: "src/api/routes/groups.js:175 — allowedPlatforms ganha shein"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1: Setup
2. Phase 2: Foundational (bloqueia tudo)
3. Phase 3: US1 (cadastro) + Phase 4: US2 (conversão) — em paralelo
4. **STOP e VALIDAR**: rodar os testes automatizados de US1 e US2; validação manual em staging fica
   para `quickstart.md`, fora do escopo de tasks.md
5. MVP entregue: SHEIN cadastrável e convertível, mesmo sem foto/cupom ainda

### Incremental Delivery

1. Setup + Foundational → núcleo `shein.js` pronto e testado isoladamente
2. US1 + US2 em paralelo → MVP (cadastro + comissão)
3. US3 → paridade visual (foto no card)
4. US4 → cupom/campanha
5. Polish → fecha as duplicações do painel + build do dashboard + regressão completa

---

## Notes

- [P] = arquivos diferentes, sem dependência
- [Story] mapeia a task para a user story correspondente (rastreabilidade)
- Todas as tasks de teste são db-free e sem rede (`fetchImpl` injetado) — nenhuma task acessa a
  SHEIN, mesmo indiretamente
- `scripts/diag-shein-affiliate-link.mjs` é referência de implementação para T001, T006, T007 — não
  editá-lo (é read-only, já commitado e validado ao vivo)
- Validação manual em staging/produção e o gate de comissão no celular vivem em `quickstart.md`
  (passos 4-7), nunca como checkbox aqui
- Commitar após cada task ou grupo lógico
- Parar em qualquer checkpoint para validar a story isoladamente

---

## Phase 8: Convergence

- [X] T061 Adicionar em `src/converters/shein.js` uma guarda de host no `convert()`: depois da resolução e antes de aplicar a identidade da cliente, recusar (`null`) quando a URL final não for de um domínio real da SHEIN (mesma lista canônica de `PATTERNS.shein` em `src/detector.js`), e cobrir com teste em `test/converters-shein.test.js` — hoje uma cadeia de redirecionamento que sai do domínio da SHEIN é publicada com os parâmetros de rastro do terceiro intactos, per FR-015 / FR-013 / FR-002 (partial)
- [X] T062 Recusar (`null`) em `src/converters/shein.js` o destino de landing do oneLink (`/ark/default`, conforme `data-model.md` §3.2) quando ele chegar sem `goods_id` — resolução que não concluiu deve falhar honestamente em vez de publicar a vitrine genérica como cupom; cobrir com teste em `test/converters-shein.test.js`, sem regredir cupom/campanha legítimos (INV-6), per US2/AC4 (partial)
- [X] T063 Acrescentar em `test/converters-shein.test.js` assertivas de que `campaign`, `campaign_id`, `ad_type`, `scene` e `test` vindos do link de origem chegam à saída **com o valor original** (usar valores diferentes dos `PROGRAM_PARAMS`, ex. `campaign=summer-sale`), fechando o ponto cego em que uma regressão de strip seria mascarada pelo re-preenchimento dos padrões, per FR-012 e contrato `stripSheinAffiliateTracking` (partial)
- [X] T064 Trocar `hasOpaqueShareToken` em `src/converters/shein.js` de checagem de valor truthy (`searchParams.get`) para checagem de presença (`searchParams.has`), de modo que `?shc=`/`?link=` vazios também sejam recusados, com teste correspondente, per contrato `converter-shein.md` (INV-2) (partial)

---

## Phase 9: Code Review Fixes

Achados da revisão de código (fase `review`) sobre o diff completo da branch contra
`origin/develop`. Ordem por severidade. Nenhum é de segurança; os três são defeitos reais
de correção/consistência com o `plan.md` e com o padrão já estabelecido pelos conversores
irmãos (`shopee.js`, `amazon.js`).

- [X] T065 Limitar a leitura do corpo HTML em `resolveSheinShortLink`
  (`src/converters/shein.js`): hoje faz `await res.text()` **sem teto de bytes**, enquanto os
  dois conversores irmãos que resolvem short link já capam a leitura
  (`readBodyLimited` + `SHORT_LINK_BODY_MAX_BYTES = 512KB` em `src/converters/shopee.js:285,179`
  e `256KB` em `src/converters/amazon.js:104,48`). Um hop de terceiro que sirva um corpo grande
  é lido inteiro para a memória dentro do pipeline de incoming do `bot-worker`, que roda sob
  teto de heap de 384MB (`BOT_WORKER_MAX_OLD_SPACE_MB`) — exatamente o que a "Política de
  memória" do AGENTS.md manda evitar. Reaproveitar o padrão existente (extrair o helper para um
  módulo compartilhado OU replicar o mesmo teto no `shein.js`), com teste que garanta que o
  corpo é truncado. Não mudar a semântica de resolução. (review)

- [X] T066 Dar um **prazo total** à resolução do oneLink em `src/converters/shein.js`: hoje
  `timeoutMs = 8000` é aplicado **por hop** (`AbortSignal.timeout(timeoutMs)` dentro do laço) e
  `maxHops = 6`, então o pior caso é **~48s** — acima do orçamento declarado no `plan.md`
  ("alvo ≤ 8s com no máximo 6 hops") e acima do `MSG_QUEUE_TIMEOUT_MS` (25s) do pipeline de
  incoming. Para comparação, `resolveShopeeShortLink` é chamado no `convert()` com
  `timeoutMs: 5000` (`src/converters/shopee.js:374`), pior caso 30s. Consequência concreta: uma
  cadeia de SHEIN lenta estoura o timeout do incoming e a **mensagem inteira** é perdida como
  `timeout:incoming` (categoria TIMEOUT, `status='error'`), em vez de a conversão daquele link
  falhar honestamente e o resto da mensagem seguir. Implementar um deadline global (ex.:
  `deadlineAt = Date.now() + totalTimeoutMs` com `totalTimeoutMs` default 8000, e o `signal` de
  cada hop derivado do que resta), sair do laço quando o prazo acabar e devolver a última URL
  conhecida (o `convert()` já recusa short link não resolvido). Cobrir em
  `test/shein-shortlink-resolve.test.js` com `fetchImpl` que atrasa, garantindo que o total
  respeita o prazo e que nada é lançado. (review)

- [X] T067 Ancorar (ou remover) o padrão `/economize muito agora/i` em
  `BOGUS_SCRAPE_TITLE_PATTERNS` (`src/converters/productInfoScraper.js`): a lista é **global,
  aplicada às cinco lojas**, e esse padrão é uma frase promocional genérica em português **sem
  nenhuma âncora de marca** — um título legítimo de produto de Amazon/Shopee/ML/Magalu que
  contenha essa frase passaria a ser descartado como título-lixo, o que fere FR-023 (zero
  regressão nas quatro lojas existentes). O próprio arquivo já documenta essa regra logo acima
  da lista ("NÃO usar 'navegador' sozinho — existe 'GPS navegador automotivo'"). O padrão irmão
  `/n[ãa]o perca esta oferta .{0,20}na shein/i` já cobre a frase real do oneLink e **está**
  ancorado na marca. Ou remover o padrão genérico, ou reescrevê-lo ancorado (ex.: exigir
  `shein` na mesma string). Ajustar `test/product-info-scraper.test.js` para cobrir tanto a
  frase real da SHEIN quanto um título legítimo de outra loja contendo "economize" que **não**
  pode ser descartado. (review)

---

## Phase 10: Code Review Fixes (2ª rodada)

- [X] T068 Transformar o strip de miniatura da SHEIN em **lista de candidatos com fallback** em
  `src/converters/imageScrapers.js`, em vez de uma reescrita destrutiva de via única.
  Hoje `resolveSheinImage` devolve `stripSheinImageThumbnailSuffix(image)` e
  `buildImageUrlCandidates` **não** tem ramo para `img.ltwebstatic.com`, então
  `fetchImageBuffer` faz **uma única tentativa**: se a URL sem `_thumbnail_<w>x<h>` responder
  404, redirecionar para placeholder, ou servir bytes que `validateDownloadedImage` reprova, a
  URL original de miniatura (que funcionava) já foi descartada e a oferta sai **sem foto** —
  degradando SC-004 (≥90% das ofertas convertidas com foto). Todas as outras transformações de
  CDN deste mesmo arquivo são candidate lists justamente por isso
  (`buildAmazonImageUrlCandidates`, `buildShopeeImageUrlCandidates`, o upgrade `D_NQ_NP_2X_` do
  ML), e o comentário da Amazon logo acima documenta exatamente esse modo de falha ("a URL sem
  sufixo fica por último porque alguns ASINs/CDNs devolvem placeholder branco nesse caminho").
  Implementar `isSheinImageUrl` + `buildSheinImageUrlCandidates` (URL sem o sufixo primeiro,
  URL original de miniatura como fallback) e plugar em `buildImageUrlCandidates`, mantendo
  `stripSheinImageThumbnailSuffix` como função pura. Cobrir em `test/image-scrapers.test.js`:
  a URL sem sufixo vem primeiro na lista e a original permanece como último candidato. (review)

- [X] T069 Eliminar o **fetch duplicado** do mesmo endereço no caminho de imagem da SHEIN em
  `src/converters/imageScrapers.js`. `resolveSheinImage(url)` é exatamente
  `resolveByHtmlLayers(url, { ua: BROWSER_UA })` + strip, e `fetchProductImage` executa
  `if (!image) image = await resolveByHtmlLayers(productUrl, { ua: BROWSER_UA })` logo em
  seguida — como `resolveByHtmlLayers` não é memoizada e o cache de `fetchProductImage` só é
  consultado no início da função, toda falha de imagem de SHEIN baixa o HTML do mesmo oneLink
  **duas vezes** dentro do pipeline de incoming (que tem orçamento de 25s,
  `MSG_QUEUE_TIMEOUT_MS`). Depois de T068 o ramo `else if (platform === 'shein')` deixa de
  precisar existir: basta a lista de candidatos, e o caminho genérico
  `resolveByHtmlLayers` já cobre a extração do `og:image`. Remover o ramo (ou fazê-lo não
  repetir a chamada genérica) e garantir por teste que só há uma busca de HTML por link. (review)

---

## Phase 11: Code Review Fixes (3ª rodada)

- [X] T070 Fechar o **furo da guarda de host** da SHEIN: hoje `isSheinHost` (e, na origem,
  `PATTERNS.shein` em `src/detector.js`) aceita domínios de terceiro que apenas *começam* com
  `shein.com`, porque o padrão do detector termina em `[^\s]*` (é um extrator de link em texto
  corrido, não um validador de host) e é reusado como validador em
  `src/converters/shein.js`. Verificado executando o código desta branch:

  ```
  isSheinHost('https://shein.com.evil.net/a')  // true  (deveria ser false)
  isSheinHost('https://shein.company.io/a')    // true  (deveria ser false)
  detectLinks('https://shein.com.attacker.net/x-p-1.html')
    // → [{ platform: 'shein', url: 'https://shein.com.attacker.net/x-p-1.html' }]
  convert('https://shein.com.evil.net/x-p-123.html?goods_id=123', { tag: '999' })
    // → { url: 'https://shein.com.evil.net/x-p-123.html?goods_id=123&koc_id=999
    //         &url_from=affiliate_koc_999&scene=1&...', linkKind: 'product' }
  ```

  Ou seja: um link de host de terceiro postado no grupo monitorado é reconhecido como SHEIN,
  passa pela guarda que existe exatamente para impedir isso (comentário em `isSheinHost`: "um
  redirect que escapou do domínio nunca pode receber koc_id/url_from dela nem ser publicado"),
  recebe a identidade da cliente e é **publicado no grupo de destino**. Fere FR-002 ("MUST NOT
  reconhecer domínios semelhantes que não pertençam à SHEIN") e esvazia FR-013/FR-015. Não
  depende de redirect: o link direto já basta.

  Correção: `isSheinHost` deve validar o host de forma **ancorada** (o hostname termina em
  `shein.com` / `shein.top`, com ponto separador — não "contém como prefixo"), e a entrada
  `shein` de `PATTERNS` em `src/detector.js` deve exigir um delimitador (`/`, `?`, `#` ou fim)
  logo após o domínio registrável, para não extrair `shein.com.attacker.net` como link de SHEIN.
  Manter a fonte única: a lista de domínios continua só em `PATTERNS.shein`; o que muda é a
  forma de casar. **Não alterar as entradas de Mercado Livre, Amazon, Shopee e Magalu**
  (FR-023 — Mercado Livre é referência de qualidade e não pode mudar).

  Cobrir com testes: em `test/converters-shein.test.js`, `convert` retorna `null` para
  `https://shein.com.evil.net/x-p-123.html?goods_id=123` e para uma cadeia de redirect que
  termina nesse host; em `test/detector.test.js`, `detectLinks`/`isOfferUrl` **não** reconhecem
  `https://shein.com.attacker.net/...` nem `https://shein.company.io/...`, e continuam
  reconhecendo `https://br.shein.com/...`, `https://m.shein.com/...`,
  `https://onelink.shein.com/...` e `https://shein.top/...`. (review)

- [X] T071 Completar a allowlist de domínios do painel "Converte links":
  `SUPPORTED_LINK_RE` em `dashboard/app/painel/converte-links/page.js` ganhou
  `shein.com|onelink.shein.com|shein.top`, mas o prefixo do padrão é `(?:www\.)?`, então
  **`br.shein.com` e `m.shein.com` não casam** — e esses são justamente os hosts de destino que
  o próprio conversor produz (`data-model.md` §3, `convert()` devolve `m.shein.com/br/ark/...`
  e `br.shein.com/...-p-<id>.html`). Efeito: a cliente cola um link de SHEIN válido, o contador
  "Detectados" mostra `0` e, em texto longo, aparece o aviso de "nenhum link suportado
  encontrado", enquanto o espelhamento converte o mesmo link normalmente — exatamente o risco
  já previsto em `plan.md` ("Painel dizer 'link não suportado' enquanto o espelhamento
  funciona"). Ajustar o padrão para aceitar subdomínio de `shein.com` (mesma forma ancorada
  adotada em T070, sem alterar as entradas das outras quatro lojas) e cobrir com teste que
  `br.shein.com`/`m.shein.com`/`onelink.shein.com` contam como 1 link detectado. Lembrar que a
  allowlist vai para o bundle do Next: `cd dashboard && npm run build` depois da mudança. (review)

---

## Phase 12: Caça adversarial (sondagem manual)

Achados de uma sondagem adversarial rodada à mão contra o código desta branch,
fora das rodadas automáticas. `stripSheinAffiliateTracking` é uma **lista de
proibidos** (`THIRD_PARTY_PARAMS` + `utm_*`), e tudo que não está nela sobrevive.
Reproduzido: o identificador de OUTRO afiliado chega à saída em seis formas
diferentes.

Ressalva honesta: **não está provado** que a SHEIN credita o terceiro em nenhum
desses casos — chave de query costuma ser sensível a maiúsculas, e fragmento não
é enviado ao servidor (embora a SHEIN seja um site que roda no navegador e possa
ler `location.hash`). Mesmo assim, o contrato desta feature diz que o link de
terceiro nunca é encaminhado **nem em pedaço** (INV-1), e o custo de fechar é
baixo. Cada task abaixo tem o caso reproduzido junto.

- [X] T072 Tornar a remoção de parâmetro **insensível a maiúsculas** em
  `stripSheinAffiliateTracking` (`src/converters/shein.js`). Hoje
  `searchParams.delete('url_from')` não remove `URL_FROM`, e o identificador do
  terceiro sobrevive. Reproduzido:
  `.../a-p-1.html?goods_id=1&URL_FROM=affiliate_koc_<DELE>` →
  saída mantém `URL_FROM=affiliate_koc_<DELE>` ao lado do `url_from` da cliente.
  Idem `KOC_ID`. Cobrir os dois em `test/converters-shein.test.js`.

- [X] T073 **Descartar o fragmento** (`#...`) na saída de `convert()`. Hoje ele
  passa intacto: `.../a-p-1.html?goods_id=1#url_from=affiliate_koc_<DELE>` sai com
  o fragmento preservado. Fragmento não vai ao servidor, mas a SHEIN é um site que
  roda no navegador e pode ler `location.hash` — e o fragmento nunca carrega
  informação de destino que a gente precise. Cobrir com teste.

- [X] T074 Rede de segurança final em `convert()`: **recusar (`null`) quando a URL
  montada ainda contiver um identificador de afiliado que não seja o da cliente**.
  Fecha de uma vez a classe inteira de vazamento por parâmetro que ainda não
  conhecemos, sem precisar adivinhar nomes. Casos reproduzidos que passam hoje:
  - nome de parâmetro desconhecido: `&partner_koc=<DELE>`
  - parâmetro aninhado URL-encoded: `&next=https%3A%2F%2F...%3Furl_from%3Daffiliate_koc_<DELE>`
    (a parte `affiliate_koc_<DELE>` fica legível na string final)
  - no caminho: `/affiliate_koc_<DELE>/a-p-1.html`
  Cuidado ao implementar: o identificador da PRÓPRIA cliente aparece
  legitimamente duas vezes (`koc_id` e dentro de `url_from`) — a checagem precisa
  ignorar essas ocorrências e reprovar só as demais. Preferir recusar a tentar
  limpar: melhor não enviar a oferta do que enviar link com comissão de outra
  pessoa.

Já verificado e **sem achado** nesta sondagem (não gerar task):
`shein.com.evil.net`, `notshein.com`, `https://shein.com@evil.net` (userinfo),
punycode, homógrafo cirílico, `br-shein.com`, hostname com ponto final e
`evil.net/br.shein.com` são todos recusados pela guarda. Barra invertida e barra
dupla são aceitas **corretamente** — o endereço é de fato da SHEIN, e o conversor
publica a forma normalizada, então não há divergência entre o que validamos e o
que a cliente abre. Parâmetro repetido (`url_from=a&url_from=b`) é removido nas
duas ocorrências.

---

## Phase 13: Caça adversarial — eixos 3 a 6

Eixo 3 (cadeia de redirect) e eixo 4 (recursos) sondados, **sem achado**:
laço infinito, ping-pong entre hosts, `Location` vazio/malformado,
`javascript:`/`data:`, redirect para fora do domínio, `<input id="url">` vazio,
com entidade HTML ou múltiplos, Content-Type mentindo, 500 cookies gigantes e
`fetch` que lança — o resolvedor nunca trava nem lança, e `convert()` recusa
todos os desfechos perigosos. O teto de 512KB corta na hora certa (input antes
do teto resolve, depois do teto degrada para recusa) e o orçamento total é
respeitado (servidor lento aborta em 3000ms de 3000ms).

Um caso pareceu travar (corpo pendurado) e foi **descartado após verificação**:
só trava quando o `fetchImpl` injetado não propaga o `AbortSignal` para a
leitura do corpo. O `fetch` do Node propaga, e com ele o abort ocorre no prazo.
Não é alcançável em produção.

- [X] T075 **O painel pede um link que o cadastro recusa.** A instrução diz
  "use o Gerador de Link para gerar o seu link de afiliada. Cole aqui o link
  inteiro" e o rótulo do campo é "Seu link de afiliada da SHEIN (ou seu número
  de afiliada)" (`dashboard/lib/painel/affiliatePlatforms.js:89,97`). Mas
  `validateCredentialData('shein', ...)` **recusa** exatamente esse link:

      https://onelink.shein.com/48/5z6ad6oma2ac   → RECUSA
      "Não reconhecemos esse texto. Era esperado o seu link de afiliada da SHEIN"

  Só passam o número puro e a forma **já resolvida**
  (`...?url_from=affiliate_koc_<n>`), que a cliente nunca vê — é um estado
  intermediário interno. Causa: extrair o número de um oneLink exige resolver o
  link pela rede, e a validação é pura/offline por contrato.

  Isso reproduz o RCA já documentado no AGENTS.md (cliente do Mercado Livre que
  salvou 17 vezes em 4h30 vendo verde e sem funcionar), só que pior: aqui ela
  cola o que foi mandado colar e é recusada, com uma mensagem que pede de volta
  a mesma coisa que ela colou. Toda cliente nova esbarra nisso no primeiro passo.

  Correção: **resolver o oneLink na rota de save** (`PUT /credentials/:platform`
  em `src/api/routes/credentials.js`), reusando `resolveSheinShortLink`, e
  persistir o número extraído. A rota já faz sondagem de rede para outras lojas,
  então o lugar é esse; a validação pura continua pura. Falha de rede não pode
  virar recusa seca — se não der para resolver, explicar em linguagem leiga que
  não deu para conferir agora e que ela pode colar o número.
  Cobrir com teste de rota (fetch injetado) e manter o vocabulário leigo.

- [X] T076 `validateCredentialData('shein', ...)` aceita número com **zero à
  esquerda** (`0001150365562` → configurado) e **de comprimento arbitrário**
  (60 dígitos → configurado). O primeiro gera `url_from=affiliate_koc_000...`,
  que não corresponde à conta real — comissão perdida em silêncio, sem nada na
  tela. Normalizar removendo zeros à esquerda e recusar comprimento fora de uma
  faixa plausível (os números reais observados têm 10 dígitos), com mensagem
  leiga. Cobrir com teste.

### Eixo 6 (interação com o resto do sistema) — sondado, sem achado

- As quatro lojas antigas continuam sendo detectadas (Mercado Livre, Amazon,
  Shopee, Magalu), com o link no formato real de cada uma.
- O sanitizador de mensagem **preserva** o link de SHEIN — que era o problema
  original desta feature (link apagado da mensagem espelhada).
- `resolveLinkKind` classifica certo: `goods_id` → `product`, `/ark/default`
  sem produto → `coupon`. Banner de marca registrado para a loja.
- **Conversão é canonizante, e isso faz a dedup existente funcionar de graça:**
  o mesmo produto chegando por dois afiliados de origem diferentes (oneLinks
  distintos, `koc_id` distintos, `requestId`/`behaviorId` distintos) produz
  saída **byte a byte idêntica**, então a dedup por link do worker reconhece a
  repetição sem precisar de código novo.
- Verificado o risco inverso (canonização engolir oferta legítima): duas
  campanhas diferentes e dois produtos diferentes continuam gerando endereços
  distintos. Nenhuma oferta legítima vira duplicata.

Observação sem task: landing `/ark/default` que chega **com** os parâmetros do
programa mas **sem** `goods_id` converte como cupom em vez de ser recusada pela
regra do T062. Não é vazamento nem link quebrado — é uma página de campanha real
da SHEIN, e só é alcançável quando a cadeia de fato chegou nela (resolução que
falha devolve o short link, que é recusado). Fica registrado como comportamento
conhecido, não como defeito.

---

## Phase 14: Convergence

- [X] T077 Estreitar a **rede de segurança do T074** em `convert()`
  (`src/converters/shein.js`) para não recusar link legítimo da SHEIN per FR-012 /
  US2-AC1 (contradicts). Hoje a checagem conta ocorrências da substring `koc`
  (case-insensitive) na **URL final inteira** — caminho, nomes e valores de todos os
  parâmetros — contra um esperado de três (o `koc_id=<tag>` e o `affiliate_koc_<tag>`
  que nós escrevemos, mais o `ad_type`). Qualquer `koc` legítimo em outro lugar
  estoura a conta e a oferta é **descartada em silêncio** (nada publicado, comissão
  perdida). Reproduzido executando o código desta branch, com
  `fetchImpl` que rejeita (sem rede) e `tag: '1150365562'`:

  ```
  convert('https://br.shein.com/Kocotree-Kids-Backpack-p-12345.html')      → null   (marca real vendida na SHEIN)
  convert('https://br.shein.com/womens-koch-jacket-p-999.html')            → null
  convert('https://m.shein.com/br/ark/default?campaign=kocobeauty')        → null   (cupom/campanha legítimo)
  convert('https://br.shein.com/a-p-1.html?ad_type=KOC&ad_type=KOC')       → null   (ad_type repetido na origem)
  ```

  O slug da SHEIN é o nome do produto, e o valor de `campaign` vem da origem — os
  dois são texto livre que a gente não controla, então a classe de falso positivo é
  aberta, não uma curiosidade pontual. Recusar oferta boa é o oposto do que a rede de
  segurança existe para fazer, e é invisível: não há aviso no painel, só ausência.

  Correção: fazer a checagem **por parâmetro**, e não por varredura da string inteira —
  ignorar caminho/slug e os dois parâmetros que nós mesmos escrevemos (`koc_id`,
  `url_from`) mais `ad_type`, e reprovar quando **qualquer outro** nome ou valor de
  parâmetro (inclusive depois de decodificar uma vez, para pegar o caso aninhado)
  carregar um identificador de afiliado que não seja o da cliente. Manter a filosofia
  do T074 (preferir recusar a tentar limpar) e a mensagem/comentário explicando por quê.

  Não regredir: os três vazamentos reproduzidos no T074 precisam continuar retornando
  `null` — `&partner_koc=<terceiro>` (nome de parâmetro desconhecido),
  `&next=<URL-encoded contendo url_from=affiliate_koc_<terceiro>>` (aninhado) e
  `/affiliate_koc_<terceiro>/a-p-1.html` (no caminho) — assim como
  `URL_FROM`/`KOC_ID` maiúsculos (T072) e o descarte do fragmento (T073).

  Cobrir em `test/converters-shein.test.js`, no mesmo bloco do T074: produto com `koc`
  no slug converte (`linkKind: 'product'`), cupom com `koc` no valor de `campaign`
  converte (`linkKind: 'coupon'`), `ad_type` repetido na origem converte — e os três
  casos de vazamento continuam `null`. Todos sem rede (`fetchImpl` injetado).

---

## Phase 15: Convergence

- [X] T078 Fechar o vazamento de identificador de terceiro em **formato solto** (`KOC<dígitos>`)
  na rede de segurança de `convert()` (`src/converters/shein.js`) per FR-013 / FR-015 (partial).
  Hoje a regra (b) só inspeciona o valor de parâmetros cujo **nome** contém `koc`, e a regra (a)
  só casa `affiliate_koc_<dígitos>`. Um identificador de terceiro escrito em qualquer outro
  parâmetro preservado passa e é publicado. Reproduzido executando o código desta branch, sem
  rede (`fetchImpl` que rejeita) e `tag: '1150365562'`:

  ```
  convert('https://br.shein.com/a-p-1.html?goods_id=1&ad_type=KOC5849195695')
    → publica  ...&ad_type=KOC5849195695&koc_id=1150365562&url_from=affiliate_koc_1150365562...
  ```

  Nota de diagnóstico já apurada (não repetir a investigação): a exceção de `ad_type` no conjunto
  `EXEMPT_KOC_PARAMS` **não** é a causa — a chave `ad_type` não casa `/koc/i`, então a exceção é
  inalcançável e remover ou manter ela não muda nada. A lacuna é da regra por nome de parâmetro,
  e vale para qualquer parâmetro preservado, não só `ad_type`.

  Correção: acrescentar uma checagem por **formato de identificador** — `koc`, separador opcional
  (`_`/`-`/nada), seguido de uma sequência longa de dígitos (o id real da SHEIN tem ~10) — aplicada
  ao caminho e aos valores dos parâmetros da URL final, recusando quando os dígitos não forem os da
  própria cliente. Manter a filosofia do T077: casar formato de identificador, nunca a substring
  solta `koc`, e preferir recusar a tentar limpar.

  Não regredir (os falsos positivos que o T077 fechou precisam continuar convertendo): `Kocotree`
  e `koch` no slug, `campaign=kocobeauty`, `ad_type=KOC` legítimo (sem dígitos) e `ad_type=CUSTOM`
  preservado do T063; e os três vazamentos do T074 (`partner_koc=<terceiro>`, aninhado
  URL-encoded, no caminho) continuam `null`.

  Cobrir em `test/converters-shein.test.js`, no mesmo bloco do T074/T077: `ad_type=KOC<id-de-terceiro>`
  → `null`; identificador em formato solto num parâmetro de nome desconhecido → `null`; e os casos
  legítimos acima convertendo normalmente. Todos sem rede (`fetchImpl` injetado).

- [X] T079 Tornar a decodificação da rede de segurança de `convert()` (`src/converters/shein.js`)
  **iterativa e limitada**, em vez de uma passada única, per FR-013 / FR-015 (partial). O helper
  `decodeOnce` decodifica exatamente uma vez, então um identificador de terceiro com duplo encoding
  atravessa a checagem. Reproduzido nas mesmas condições do T078:

  ```
  convert('https://br.shein.com/a-p-1.html?goods_id=1&next=affiliate%255Fkoc%255F5849195695')
    → publica o parâmetro com o identificador do terceiro intacto
  ```

  Encoding simples continua sendo pego corretamente (`next=affiliate%5Fkoc%5F...` e
  `next=...url_from%3Daffiliate_koc_...` já retornam `null`) — o buraco é só a segunda camada.

  Correção: decodificar repetidamente até o valor estabilizar, com **teto pequeno de iterações**
  (evitar trabalho ilimitado em entrada hostil) e tolerância a sequência inválida (uma decodificação
  que lança deve parar o laço e usar o último valor válido, nunca derrubar a conversão). Aplicar a
  mesma normalização aos dois lugares que hoje chamam `decodeOnce` (a varredura da URL final e o
  valor de cada parâmetro), e ao formato novo introduzido pelo T078.

  Não regredir: nenhum dos links legítimos do T077 pode passar a ser recusado pela decodificação
  extra — a decodificação repetida não pode transformar slug/campanha de texto livre em falso
  positivo.

  Cobrir em `test/converters-shein.test.js`: `%255F` (duplo encoding) → `null`; `%5F` e `%3D`
  (encoding simples) continuam `null`; entrada com `%` inválido (`%zz`) não lança e segue o
  caminho normal de decisão; e os casos legítimos do T077 continuam convertendo. Todos sem rede.

---

## Phase 16: Link curto (oneLink da SHEIN)

Escopo novo, pedido pela cliente: hoje a oferta sai com o link longo
(`m.shein.com/br/ark/default?...`) e o concorrente publica o curto
(`onelink.shein.com/48/<código>`).

**Caminho CONFIRMADO ao vivo** (teste feito pela cliente no navegador dela,
logada no painel de afiliada — não é hipótese):

    GET  {origin}/api/others/getSiteInfo     header: bff-source: shein;pwa
      -> { SiteUID, token, memberId, appLanguage }
    POST {origin}/affiliate/api/share/link/from/url
      headers: token, siteuid, language, localcountry:'BR', mi:<memberId>,
               Content-Type: application/json; charset=utf-8,
               X-Requested-With: XMLHttpRequest, Accept: application/json
      body:    { url, language, uid:<memberId> }
      -> { code:"0", info:{ oneLink } }

Resultado real: `https://onelink.shein.com/48/5zdjzeumrua5?ismg_ol=GGkS8InolgI_01_KOC-C`

Dois fatos que sustentam a implementação:
- a chamada NÃO exigiu assinatura anti-robô (x-gw-auth/armor/x-anti) — só o
  `token` derivado da sessão. É o que torna a chamada de servidor viável;
- `memberId` é **o mesmo número** já guardado em `creds.tag` (confirmado pela
  cliente), então não é preciso pedir identificador novo.

Não existe alternativa pública: o código do oneLink é registro opaco criado no
servidor (código inventado cai na home, `shein.top` não aceita nada arbitrário).

- [X] T080 Campo `cookie` **opcional** para SHEIN. `REQUIRED_FIELDS.shein`
  continua `['tag']` — o cookie NÃO entra em required, porque sem ele tudo
  continua funcionando (link longo, comissão certa). No painel
  (`dashboard/lib/painel/affiliatePlatforms.js`, entrada `shein`): `required:
  false`, `sensitive: true`, `cookieField: true`. Vocabulário obrigatório:
  "código de acesso da SHEIN", nunca "cookie"/"token"/"memberId". O texto tem
  que ser da família ML/Amazon ("sem ele o link só fica mais comprido"), NUNCA
  da família Shopee ("as ofertas param de sair") — aqui as ofertas continuam
  saindo, e dizer o contrário seria a mentira que o AGENTS.md proíbe. Conferir
  que o valor passa pelo `encryptCredential` como os demais (esquema D-3).

- [X] T081 `shortenSheinLink(longUrl, creds, { fetchImpl })` em
  `src/converters/shein.js`. Passo 1 cunha o token pelo `getSiteInfo` com o
  cookie. **Guarda de identidade — a parte mais importante:** `memberId` vazio
  → `null` (código de acesso venceu); `memberId` diferente de `creds.tag` →
  `null` + log de aviso. Nunca publicar oneLink emitido por outra conta; é o
  mesmo princípio das guardas T074/T077. Passo 2 chama o gerador e, com
  `code === '0'`, devolve `info.oneLink` **como veio** — não reescrever nem
  remover parâmetro (mesma lição do `generateShortLink` da Shopee, que só
  funciona devolvendo o short link como-está). Qualquer outro desfecho →
  `null`. Nunca lança. Orçamento de tempo TOTAL curto (~6s para as duas
  chamadas somadas), no espírito do `totalTimeoutMs` do
  `resolveSheinShortLink`: roda dentro do pipeline de mensagens, que tem teto
  de 25s (`MSG_QUEUE_TIMEOUT_MS`). Cache do token em escopo de MÓDULO por
  `tag`, TTL curto (~10min) — o token traz timestamp de emissão embutido, e
  cunhar um por oferta é desperdício.

- [X] T082 Ligar no `convert()`. O encurtamento acontece **depois** de o link
  longo estar pronto e ter passado por TODAS as guardas existentes (host
  ancorado, token opaco `shc`/`link`, `/ark/default` sem `goods_id`, rede de
  segurança de identificador de terceiro) — não reordenar nada disso. Sem
  `creds.cookie`, nem tenta. `null` do encurtador → publica o link longo. O
  fallback é o comportamento de hoje, já validado em todas as rodadas
  anteriores. Kill-switch `SHEIN_SHORTLINK_ENABLED` (default ligado, `'false'`
  desliga) para cortar em produção sem redeploy; o opt-in de verdade é a
  própria existência do cookie.

- [X] T083 `test/shein-shortlink.test.js` (novo, db-free, sem rede, fetch
  injetado): encurta quando há cookie e o identificador bate; **identificador
  divergente → `null` e link longo publicado** (o teste mais importante);
  identificador vazio → link longo; `code != '0'` → link longo; falha de rede
  ou estouro de prazo → link longo, sem lançar; sem cookie → o gerador nem é
  chamado (asserção de que o fetch não foi invocado); kill-switch desligado →
  não chama; oneLink publicado exatamente como a SHEIN devolveu, com os
  parâmetros dela.

- [X] T084 Guarda de não-regressão: somar casos a
  `test/converters-shein.test.js` provando que nenhuma das guardas T072-T079
  mudou de comportamento com o encurtamento ligado, e que as outras quatro
  lojas seguem intocadas.
