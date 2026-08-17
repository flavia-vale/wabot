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
- [ ] T060 Rodar a suíte inteira `npm test` na raiz e confirmar zero regressão nas quatro lojas
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
</content>
