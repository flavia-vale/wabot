# Plano técnico — nova loja: TikTok Shop

Status: **proposta (2026-09-29), não iniciada.** Molde usado: entrada da SHEIN
(`specs/012-shein-store-support/tasks.md`, 84 tasks) e da AliExpress
(`specs/016-aliexpress-store-support`, `test/aliexpress-surface-contract.test.js`).
Id interno da loja: **`tiktokshop`** · rótulo na tela: **TikTok Shop**.

Regras do repo que valem para todo o plano: branch a partir de `develop`, PR
contra `develop`, staging antes de `main`; nada por suposição (Sprint 0 existe
para isso); mudança de robô em modo `remote` só vale após
`pm2 restart bot-supervisor --update-env` (reconecta TODAS as sessões — janela
anunciada); env nova exige `pm2 delete` + `start`.

---

## 0. O que ainda NÃO sabemos (e decide o desenho)

Tudo abaixo é **hipótese** até o Sprint 0 medir:

| # | Pergunta | Por que decide |
|---|---|---|
| H1 | Como a afiliada ganha comissão num link web: API oficial do Partner Center (OAuth por criadora), sessão do painel de afiliado (cookie, como AliExpress/SHEIN) ou parâmetro na URL? | Define credencial, cadastro, expiração e o `convert()` inteiro |
| H2 | Formatos reais de link que circulam nos grupos (`vt.tiktok.com`/`vm.tiktok.com` curto, `www.tiktok.com/view/product/<id>`, `shop.tiktok.com/...`, link de vitrine/campanha) | Define o detector e o `linkKind` |
| H3 | Link curto `vt/vm.tiktok.com` é ambíguo: pode ser **vídeo** e não produto | Hoje link de vídeo é apagado e a oferta sai; se virar "loja", pode travar oferta (ver R2) |
| H4 | O servidor (IP da VPS) consegue ler foto/título/preço da página de produto? (anti-bot, 403, página só JS) | Define imagem/preço ou cair no card da marca |
| H5 | Existe volume real? `ACOES_FLAVIA_2026-09-11.md` §3.3 diz que o +650% é aceleração, **não volume** | Go/no-go do projeto |

---

## Sprint 0 — Descoberta e go/no-go (1 semana, sem código de produção)

**Saída:** `specs/0xx-tiktok-shop-store-support/research.md` com decisão D-001…D-00n
e amostras reais. Nenhum sprint seguinte começa sem o gate aprovado.

- **#S0-1 Medir demanda real nos grupos monitorados** — criar
  `scripts/diag-tiktok-links.mjs` (read-only): contar, em 30 dias, mensagens
  recebidas com link `tiktok.com`, por formato (curto/produto/vídeo) e por
  cliente. Decide H5 e H2. Aceite: tabela com contagens e 20 amostras anonimizadas.
- **#S0-2 Descobrir o mecanismo de afiliação (H1)** — com conta de afiliada de
  teste: (a) API do Partner Center (escopos, região BR, OAuth, limites);
  (b) gerador de link do painel de afiliado web (requisição observada, como
  AliExpress); (c) parâmetro de identidade na URL. Aceite: link gerado para
  produto X aberto no celular cai no MESMO produto e aparece no relatório da
  afiliada (mesmo gate da AliExpress).
- **#S0-3 Resolução de link curto e classificação produto × vídeo (H3)** —
  medir hops, destino final, tempo e se dá para decidir "é produto" sem baixar
  a página inteira. Aceite: regra escrita + 10 casos de cada tipo.
- **#S0-4 Foto/título/preço pelo servidor (H4)** — testar da VPS (og:image,
  JSON embutido, API pública). Aceite: taxa de sucesso em 20 produtos.
  ⚠️ Se só funcionar com navegador headless → **SUPER SINALIZAR memória**
  (estimativa de RAM + alternativa leve: card da marca) antes de seguir.
- **#S0-5 Decisões de produto com a dona** — go/no-go; loja no Basic ou só PRO
  (`src/billing/plans.js`, `ProGate`); cores do card da marca (design system:
  entra no documento ANTES da tela); se TikTok Shop entra no alerta de
  credencial bloqueada (`src/credentialBlockAlert/message.js`).

---

## Sprint 1 — Conversor e detecção (núcleo, só testes, sem ligar)

- **#S1-1 `src/converters/tiktokshop.js`** — constantes de domínio (fonte única),
  `isTiktokShopHostname` **ancorado** (reusar `isHostInDomainList`; `tiktok.com.evil.net`
  nunca passa), `extractTiktokProductId`, `stripTiktokAffiliateTracking`
  (remove identidade de terceiro, insensível a maiúsculas, descarta `#`),
  `resolveTiktokShortLink` (HTTPS, máx. hops, prazo total, corpo limitado,
  `fetchImpl` injetável) e `convert(url, creds, options)` **fail-closed**:
  qualquer falha → `null`, nunca publica o link original; guarda de host na
  saída; credencial só em header, nunca em URL/erro/log.
- **#S1-2 Kill-switch `TIKTOKSHOP_ENABLED`** (padrão das outras lojas; default
  OFF em prod até validar) — desligado, `convert()` devolve `null` antes de
  tocar rede.
- **#S1-3 Detector** — `PATTERNS.tiktokshop` em `src/detector.js`, ancorado,
  casando só caminhos de loja (produto/vitrine) + curto conforme regra do S0-3.
- **#S1-4 Não confundir loja com rede social** — hoje `tiktok.com` está em
  `NEVER_RESOLVE_HOST_RE` (`src/core/customDomainLinkResolver.js:135`) e em
  `DOMAIN_SRC` (`src/core/sourceSignature.js:38`, apaga `tiktok.com/...` sem
  protocolo como assinatura). Liberar SÓ caminhos de loja; perfil/vídeo seguem
  sendo tratados como social. Teste de não regressão para os dois.
- **#S1-5 `linkKind`** — `PRODUCT_ID_DETECTORS.tiktokshop` e extrator de id em
  `src/converters/linkKind.js` (produto × cupom/campanha).
- **#S1-6 Registro** — `src/converters/index.js` (`CONVERTERS.tiktokshop`),
  `src/core/clientCouponPolicy.js` (`KNOWN_PLATFORMS` + domínios),
  `src/converters/ownAffiliateLink.js` (link já da própria cliente não reconverte),
  `src/converters/pastedLinkOwnership.js`.
- **#S1-7 Testes** — `test/converters-tiktokshop.test.js`,
  `test/tiktokshop-shortlink-resolve.test.js` (sem rede), `test/detector.test.js`,
  `test/link-kind.test.js`, testes de `sourceSignature`/`customDomainLinkResolver`.

## Sprint 2 — Cadastro da credencial (API + banco + painel)

- **#S2-1 Validação** — `src/credentialHealth.js`: `PLATFORM_LABELS`,
  `REQUIRED_FIELDS`, `sanitizeCredentialBody` (aceitar o formato que a cliente
  realmente tem em mãos), avisos de formato com recusa dura para texto errado.
- **#S2-2 (se H1 = OAuth)** rotas `start`/`callback` em `src/api/routes/`,
  renovação de token no molde de `src/converters/mlOAuthTokenPolicy.js` e trava
  de concorrência no molde de `mercadolivreCredentialLock.js`. **(se H1 =
  sessão)** exportação do Cookie-Editor como na AliExpress. Criptografia em
  repouso já existente (`Credential.data`).
- **#S2-3 Sondagem ao salvar** — `src/credentialSaveCheck.js` (label + texto
  próprio) — a cliente sabe na hora se a credencial funciona.
- **#S2-4 Vencimento** — `src/credentialExpiry/policy.js` e, se decidido no
  S0-5, `src/credentialBlockAlert/message.js`.
- **#S2-5 Banco e defaults** — `prisma/schema.prisma` (`BotConfig.platforms`
  default + `tiktokshop`), migration DML
  `prisma/migrations/<ts>_botconfig_platforms_add_tiktokshop` (mesmo cuidado da
  vírgula inicial da AliExpress), CSV default em `src/api/routes/config.js`,
  `src/bot-worker.js`, `scripts/reset-legacy-botconfig-fields.mjs`; whitelist
  em `src/api/routes/groups.js:238`. Teste
  `test/migrations-botconfig-platforms-tiktokshop.test.js`. Passa por staging.
- **#S2-6 Tela "IDs de afiliada"** — entrada em
  `dashboard/lib/painel/affiliatePlatforms.js` (instrução leiga, link do
  programa, nota de cuidado com a sessão) seguindo o design system v2.
  Testes `painel-linguagem-leiga` e `painel-ids-afiliada-privacy`.

## Sprint 3 — Publicação no WhatsApp (robô)

- **#S3-1 Rótulos** — `STORE_PREVIEW_TITLES` (`src/bot-worker.js`),
  `PLATFORM_LABELS` (`src/core/mirrorTemplate.js`), `BRAND_RE`
  (`src/core/copyLinter.js`), lista de marcas (`src/messageProcessor.js:221`),
  `src/api/routes/coupons.js`, `BRAND_STYLES` (`src/converters/storeBrandCard.js`,
  cores decididas no S0-5).
- **#S3-2 Foto** — ramo em `fetchProductImage` (`src/converters/imageScrapers.js`)
  conforme S0-4; se falhar, card da marca (`previewImageFallbackPolicy`).
- **#S3-3 Título e preço** — `src/converters/productInfoScraper.js` e
  `inferTitleFromUrl` (`src/converters/offerEngine.js`); preço só se a fonte
  for confiável (lição do buy box da Amazon: preço errado é pior que sem preço).
- **#S3-4 Cupom/campanha** — caminho do banner de cupom no `bot-worker.js`,
  respeitando `COUPON_LINK_CONVERT`.
- **#S3-5 Guarda de publicação** — confirmar com teste que link TikTok não
  convertido cai em `src/core/mirrorLinkGuard.js` (não envia com link de
  terceiro) e que link de **vídeo** continua só removido (oferta sai) — ver R2.
- **#S3-6 Testes de contrato** — `test/tiktokshop-surface-contract.test.js`
  (todas as superfícies estáticas, como o da AliExpress) e
  `test/tiktokshop-platform-integration.test.js`.

## Sprint 4 — Superfícies do painel

- **#S4-1** `dashboard/app/painel/converte-links/page.js` (texto + detecção),
  `dashboard/app/painel/criar-oferta/page.js` (`STORES` + texto),
  `dashboard/lib/mobileOfferComposer.js` (`COUPON_STORES` + host).
- **#S4-2** `dashboard/app/painel/grupos/page.js` (`ALL_PLATFORMS`),
  `dashboard/lib/mobileGroupPicker.js`, `dashboard/app/painel/espelhamento/page.js`.
- **#S4-3** `dashboard/lib/mobileLogs.js`, `dashboard/lib/mobileCouponStore.js`,
  `dashboard/lib/painel/logsCopy.js` (motivos de falha em linguagem leiga),
  `src/domain/painel/conversionTest.js` (lista de lojas no texto).
- **#S4-4** Texto de `dashboard/app/painel/ofertas-automaticas/page.js`
  ("garimpo só na Shopee" passa a citar TikTok Shop entre as que não têm).
- **#S4-5** Gate Basic × PRO (se decidido) em `src/billing/plans.js` +
  `ProGate`. `cd dashboard && npm run build` obrigatório + `npm test` na raiz.

## Sprint 5 — Observabilidade, docs e rollout

- **#S5-1 Diagnóstico** — `scripts/diag-tiktokshop.mjs` (read-only):
  conversões por resultado/motivo nas últimas 72 h, foto sim/não, credenciais
  vencidas.
- **#S5-2 Documentação** — seção "TikTok Shop (não regredir)" em
  `docs/rca/lojas-conversao.md` + linha no mapa de sintomas do `AGENTS.md`
  (respeitar teto de 40 KB).
- **#S5-3 Staging** — deploy, `TIKTOKSHOP_ENABLED=true` só em staging
  (`pm2 delete` + `start`), roteiro: cadastrar credencial, espelhar oferta real,
  abrir no celular, conferir mesmo produto e atribuição no relatório da afiliada.
- **#S5-4 Produção** — PR `develop` → `main`; janela anunciada para
  `pm2 restart bot-supervisor --update-env`; ligar env; acompanhar
  `diag-tiktokshop.mjs` por 72 h. Rollback = env `false` (sem redeploy).

## Sprint 6 — Marketing/SEO (opcional, só após produção)

- Página `tiktok-shop-afiliados-whatsapp` + `dashboard/lib/seo-registry.mjs`,
  contagem de lojas em comparativos/preços/glossário
  (`dashboard/app/_comparisonContent.js`, `competitors-data.js`,
  `marketing-content.js`), e-mails que listam lojas. Páginas já indexadas que
  mudarem → leva 🔝 de reindexação em `docs/marketing/ACOES_FLAVIA_2026-09-11.md`.

---

## Fora do escopo

Garimpo automático no TikTok Shop (`src/offerAutomation/` é só Shopee),
Instagram Stories, P1-4 "loja não suportada" (continua no backlog próprio).

## Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Não existir forma web de atribuir comissão (só pelo app) | Gate do S0-2; sem prova de atribuição, projeto para |
| R2 | Link curto de vídeo virar "loja" e travar oferta que hoje sai | Classificar antes (S0-3/S1-3); teste explícito no S3-5 |
| R3 | Anti-bot bloquear foto/preço da VPS | Card da marca; nunca headless sem SUPER SINALIZAR |
| R4 | Sessão/token da afiliada cair com frequência | Sondagem ao salvar + aviso de vencimento (S2-3/S2-4) |
| R5 | Reinício do supervisor derruba sessões | Janela anunciada; kill-switch permite subir o código desligado |

## Memória

Sem processo PM2 novo, sem cache novo, sem fila nova: conversão é HTTP dentro do
bot-worker já existente — impacto de RAM desprezível. Única exceção possível:
headless no S0-4 (bloqueado até OK explícito).
