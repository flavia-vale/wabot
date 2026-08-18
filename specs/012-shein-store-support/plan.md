# Implementation Plan: SHEIN como 5ª loja de conversão de links

**Branch**: `012-shein-store-support` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-shein-store-support/spec.md`

## Summary

Adicionar a SHEIN como 5ª loja suportada, preenchendo os registries existentes (o sistema é
registry-driven: adicionar loja é preencher mapas já existentes, não criar arquitetura nova).

A conversão é **por parâmetro na própria URL**, igual ao Magalu — sem API, sem chave secreta, sem
cookie de sessão. A diferença em relação ao Magalu é que o link que chega do grupo monitorado quase
sempre é um `onelink.shein.com/...` de terceiro, que precisa ser **resolvido** antes de converter:

```
oneLink de terceiro  →  resolve (redirects manuais + <input id="url">, parando ANTES de /risk/)
                     →  extrai goods_id
                     →  remove tracking do terceiro (koc_id, url_from, onelink, requestId, behaviorId, utm_*)
                     →  pendura a identidade da cliente (koc_id + url_from=affiliate_koc_<id>)
                     →  { url, linkKind }
```

Qualquer falha nessa cadeia retorna `null` (falha honesta). O link de terceiro **nunca** é
encaminhado, nem em pedaço (FR-015, invariante do repo).

`scripts/diag-shein-affiliate-link.mjs` (já commitado, read-only) é a **referência direta** do
conversor: ele já implementa, validado ao vivo em 2026-08-18, a resolução do oneLink, a extração de
identidade, o strip de tracking de terceiro e as duas guardas de recusa. O conversor porta essa
lógica para `src/converters/shein.js` com `fetchImpl` injetável (testes sem rede).

Escopo entregue: detecção + conversão + credencial no painel + card com foto do produto + banner de
marca para cupom + testes de regressão. Fora do escopo: raspagem de título/preço da página de
produto (bloqueada por captcha para o servidor — ver research.md, D-004).

## Technical Context

**Language/Version**: Node.js ESM (mesmo runtime da API/worker), Next.js 14 (App Router) no dashboard

**Primary Dependencies**: **nenhuma nova** (FR-024). Usa `fetch` nativo, `URL` nativo, e o
`storeBrandCard` já existente (SVG local, sem CDN)

**Storage**: SQLite via Prisma. `Credential.platform` é string livre e `Credential.data` é JSON
cifrado (AES-256-GCM, `src/credentialCrypto.js`) → **nenhuma migration de schema para a credencial**.
Única migration: DML idempotente para `BotConfig.platforms`

**Testing**: `node:test`, db-free e sem rede (`fetchImpl` injetado), como os das outras lojas

**Target Platform**: VPS Linux (prod `~/wabot`, staging `~/wabot-staging`), PM2

**Project Type**: Monorepo — backend Node (`src/`) + dashboard Next.js (`dashboard/`)

**Performance Goals**: resolução do oneLink dentro do orçamento já existente do pipeline de incoming
(`MSG_QUEUE_TIMEOUT_MS` = 25s); alvo ≤ 8s com no máximo 6 hops

**Constraints**:
- Sem processo PM2 novo, sem dependência nova, sem cache grande em memória (política de memória do
  AGENTS.md). Impacto de RAM estimado: **desprezível** (~0, nenhuma estrutura persistente nova) —
  não aciona a REGRA #1 de super sinalização.
- Migration sem `ALTER TABLE` → não exige parar API/supervisor (pegadinha #8 não se aplica).
- Nenhum jargão técnico (`koc_id`, `url_from`, `goods_id`, `oneLink`) pode chegar à tela
  (`test/painel-linguagem-leiga.test.js` reprova).
- Nunca acessar a SHEIN a partir dos testes; comportamento já medido ao vivo em 2026-08-18.

**Scale/Scope**: 1 conversor novo + 1 resolvedor de short link + 1 resolvedor de imagem + ~20
registries a preencher (6 deles são a lista de domínios duplicada) + 1 migration DML + 2 arquivos de
teste novos + ~10 testes transversais atualizados.

## Constitution Check

`.specify/memory/constitution.md` está **não preenchido** (template com placeholders
`[PRINCIPLE_1_NAME]` etc.). Não há gates formais de constituição a avaliar.

Na ausência dela, o gate aplicado é o `AGENTS.md` (regras canônicas do repo). Verificação:

| Regra do AGENTS.md | Status |
|---|---|
| Política de memória (super sinalizar aumento de RAM) | ✅ nenhum processo/worker/cache novo; impacto ~0 |
| Sem dependência nova | ✅ só `fetch`/`URL` nativos |
| Link de terceiro nunca encaminhado | ✅ INV-1, guarda em `convert()` + teste dedicado |
| Linguagem leiga na superfície da cliente | ✅ FR-007, guarda em `painel-linguagem-leiga.test.js` |
| Migration DDL exige parar API/supervisor (pegadinha #8) | ✅ evitado — a migration é DML puro |
| Testes db-free e sem rede | ✅ `fetchImpl` injetado |
| Fluxo `feature → develop → staging → main` | ✅ ver quickstart.md |
| Lista de domínios duplicada em 6 lugares | ✅ as 6 tratadas (ver Project Structure) |

**Resultado: PASS.** Nenhuma violação a justificar → seção "Complexity Tracking" vazia.

## Project Structure

### Documentation (this feature)

```text
specs/012-shein-store-support/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas consolidadas
├── data-model.md        # Fase 1 — entidades e formatos de link
├── quickstart.md        # Fase 1 — como validar de ponta a ponta
├── contracts/
│   ├── converter-shein.md      # contrato de src/converters/shein.js
│   ├── credential-shein.md     # contrato da credencial + painel
│   └── registries.md           # checklist arquivo:linha de TODOS os registries
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Arquivos **novos** (3):

```text
src/converters/shein.js                       # conversor + resolvedor de short link
test/converters-shein.test.js                 # conversão, guardas de recusa, invariante
test/shein-shortlink-resolve.test.js          # cadeia de hops, <input id="url">, parada em /risk/
prisma/migrations/<ts>_botconfig_platforms_add_shein/migration.sql   # DML idempotente
```

Arquivos **alterados**, por camada (linhas conferidas no código atual):

```text
# A. Conversão (núcleo)
src/converters/index.js:1-11          import + entrada `shein` em CONVERTERS
src/detector.js:4-9                   PATTERNS.shein (domínios reais)
src/converters/linkKind.js:24-27      PRODUCT_ID_DETECTORS.shein (defesa em profundidade)

# B. Credencial e configuração
src/credentialHealth.js:3,51,66       PLATFORM_LABELS, REQUIRED_FIELDS, getFormatWarnings
src/credentialHealth.js:200           sanitizeCredentialBody → normaliza link colado em identificador
prisma/schema.prisma:294              default de BotConfig.platforms passa a incluir `shein`
src/api/routes/config.js:12           CSV default
src/bot-worker.js:633                 CSV default
scripts/reset-legacy-botconfig-fields.mjs:29   CSV default
src/api/routes/groups.js:175          whitelist allowedPlatforms
# (NÃO tocar: src/credentialSaveCheck.js:25 e src/credentialExpiry/policy.js:19 — FR-008)

# C. Apresentação da oferta
src/bot-worker.js:1501                STORE_PREVIEW_TITLES.shein = 'SHEIN'
src/converters/storeBrandCard.js:28   BRAND_STYLES.shein (preto/branco)
src/core/mirrorTemplate.js:17         PLATFORM_LABELS.shein
src/core/copyLinter.js:11             BRAND_RE ganha `shein`
src/converters/imageScrapers.js:419   fetchProductImage → ramo shein (og:image do oneLink + strip CDN)
src/converters/productInfoScraper.js:254,278   BOGUS_SCRAPE_TITLES / _PATTERNS (frase genérica)
# (NÃO tocar: src/bot-worker.js:234 TITLE_MISMATCH_GUARD_PLATFORMS — ver research.md D-007)

# D. Painel (as 6 duplicações de domínio + catálogos de loja)
dashboard/lib/painel/affiliatePlatforms.js:75-86    entrada `shein` (1 campo, linguagem leiga)
dashboard/app/painel/converte-links/page.js:15,42   SUPPORTED_LINK_RE + texto do erro
dashboard/app/painel/criar-oferta/page.js:25,286    STORES + texto "Cole um link de…"
dashboard/lib/mobileOfferComposer.js:60,129         COUPON_STORES + detecção por host
dashboard/app/painel/grupos/page.js:20              ALL_PLATFORMS
dashboard/lib/mobileGroupPicker.js:44               MOBILE_GROUP_PLATFORMS
dashboard/lib/mobileLogs.js:12                      MOBILE_LOG_PLATFORM_LABEL
dashboard/lib/mobileCouponStore.js:9                DEFAULT_COUPON_LINKS

# E. Testes transversais a atualizar
test/detector.test.js, test/link-kind.test.js, test/store-brand-card.test.js,
test/product-info-scraper.test.js, test/mirror-template.test.js,
test/painel-linguagem-leiga.test.js, test/painel-ids-afiliada-privacy.test.js,
test/groups-route-image-mode.test.js, test/mobile-*.test.js,
test/migrations-botconfig-platforms-shein.test.js (novo)
```

**Structure Decision**: monorepo existente, sem diretório novo. A feature é **aditiva por
registries**: um módulo de conversão novo (`src/converters/shein.js`) e entradas nos mapas já
existentes. Nenhum arquivo é reescrito, nenhuma abstração nova é introduzida — é o mesmo formato das
quatro lojas atuais, o que mantém FR-023 (zero regressão) barato de garantir.

## Ordem de implementação (dependências)

```
1. src/converters/shein.js  ─────────┐  (núcleo puro + resolvedor, testável isolado)
2. registries de detecção/conversão  │  detector, index, linkKind
3. credencial + painel de lojas      ├─→ 5. testes transversais + build do dashboard
4. apresentação (card, imagem, bogus)│
   + migration DML                   ┘
```

US1 (credencial) e US2 (conversão) são ambos P1 e podem ser feitos em paralelo depois do passo 1;
US3 (foto) e US4 (cupom) dependem de US2.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Link de compartilhamento (`shc`/`link`, prefixo `GM7`) publicado como se fosse convertido — creditaria comissão a quem compartilhou | Guarda dupla: recusa por falta de `goods_id` **e** por presença de token opaco. Teste dedicado. Mesma guarda no save da credencial (FR-006) |
| Resolução entrar no captcha `/risk/challenge` (responde HTTP 200) e perder o hop com os dados | `SHEIN_RISK_RE` checado **antes** de seguir cada hop; parada no hop anterior. Nunca concluir "existe" por status 200 |
| Painel dizer "link não suportado" enquanto o espelhamento funciona | Checklist de 6 duplicações em `contracts/registries.md`, todas obrigatórias na mesma PR |
| Frase promocional genérica virar título da oferta | `BOGUS_SCRAPE_TITLES` + `BOGUS_SCRAPE_TITLE_PATTERNS`, com teste |
| Allowlist do painel não valer em staging | O bundle do Next carrega a lista → `cd dashboard && npm run build` é obrigatório antes de validar |
| Comissão não creditar (armadilha do RCA da Amazon e do `partner_id` do ML) | Já resolvido: a cliente confirmou o crédito pelo link montado (research.md D-001). Reconferir com um clique real em staging antes de `main` |

## Complexity Tracking

Sem violações de gate — seção não aplicável.
