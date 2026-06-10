# Plano — Ajustes na funcionalidade "Criar oferta"

> Spec para implementação por agente de IA. Leia o `AGENTS.md` da raiz antes de
> começar. Este plano foi escrito após investigação do código real em
> 2026-06-10; os caminhos e números de linha referem-se ao estado da branch
> `develop` nessa data.

## Objetivo (3 mudanças, todas na página "Criar oferta" do painel)

1. **Imagem do produto**: buscar e exibir a imagem da oferta, reaproveitando o
   mesmo pipeline de imagem usado no espelhamento de grupos e no bot do
   Telegram (`src/converters/imageScrapers.js`).
2. **Remover o card "Configurar envio"** (checkbox "Incluir CTA de grupo",
   botão "Editar template" com textarea, e a linha "Link da oferta: ...").
3. **Seletor de template**: o usuário deve poder **trocar** o template usado
   para montar a mensagem. Deve vir um por padrão (`automatico_classico`), e a
   lista deve ser a MESMA do resto do produto (presets + templates
   personalizados editados em `/painel/mensagens`).

## Mapa do código (estado atual — leia antes de mexer)

| Arquivo | Papel |
|---|---|
| `dashboard/app/painel/criar-oferta/page.js` | **A página alvo.** Form de link → `api.scrapeOffer` → card "Produto encontrado" → card "Configurar envio" (linhas ~226–246, o que será removido) → prévia `WhatsAppBubble` → copiar. Usa template hardcoded local `DEFAULT_TEMPLATE` com variáveis `{{title}}`/`{{link}}` e função local `applyTemplate`. |
| `dashboard/components/OfferBuilder.js` | Componente **legado** usado por `/dashboard/gerar-oferta` e `/dashboard/converte-links`. Consome o MESMO endpoint `scrape-offer`. **NÃO MEXER.** |
| `dashboard/lib/offerBuilderUi.js` | Helpers do OfferBuilder legado (`buildOfferPriceBlocks`, `getConversionStatusPresentation`, etc.). Testado em `test/offer-builder-ui-logic.test.js`. **NÃO MEXER.** A página alvo continua usando `getConversionStatusPresentation` e `buildOfferPriceBlocks` pode deixar de ser usado nela — só remova o import da página se ficar sem uso, sem tocar no lib. |
| `dashboard/lib/api.js` | `api.scrapeOffer(url)` (linha ~185) chama `POST /api/link-conversion/scrape-offer`. |
| `src/api/routes/linkConversion.js` | Handler `POST /scrape-offer` (linhas ~90–142). Valida URL + anti-SSRF (`assertPublicUrl`), chama `buildScrapedOffer`, devolve `{ title, oldPrice, newPrice, finalUrl, offerUrl, conversionWarning, conversion, scrapeWarning? }`. |
| `src/converters/offerEngine.js` | Motor único de oferta (painel + bot Telegram). **Contrato protegido — não alterar o shape de retorno nem `keepOriginalLink`.** |
| `src/converters/imageScrapers.js` | Pipeline de imagem do espelhamento: `fetchProductImage(platform, productUrl, creds)` → devolve **URL** hi-res da imagem (com cache interno e fallbacks por loja). Regras invioláveis no AGENTS.md (PR #422). **Só consumir, não modificar.** |
| `src/telegram/offerBot.js` | `fetchTelegramOfferImage()` (linhas ~143–178) é o **modelo de referência** de como consumir `fetchProductImage` para uma oferta. Roda texto e imagem em `Promise.all`. **Não modificar este arquivo.** |
| `src/detector.js` | `detectLinks(url)` → `[{ platform, ... }]`. Usado para inferir a plataforma do link. |
| `dashboard/lib/mobileOfferComposer.js` | `TEMPLATE_OPTIONS` (presets `automatico_classico` e `simples`) e `buildMobileOfferText({ product, link, template, templateBody, ... })` — o compositor canônico de mensagem de oferta a partir de template com variáveis `{produto}`, `{preço}`, `{preço_de}`, `{desconto}`, `{rating}`, `{vendas}`, `{link}`, `{loja}` e placeholders de automação `{{gancho}}`/`{{cta}}`/`{{convitegrupo}}` (removidos quando `preserveAutomationPlaceholders=false`, que é o default). |
| `dashboard/lib/mobileTemplateStore.js` | Store de templates do usuário: presets + overrides + customizados, persistido no backend (`BotConfig.mobileTemplatesJson`) com cache em localStorage. Funções úteis: `loadAllTemplates()` (síncrona, cache local), `loadTemplateStore()` (async, servidor), `composeTemplates(store)` → lista `{ key, name, body, ... }`. Editável pelo usuário em `/painel/mensagens`. |
| `dashboard/app/painel/WhatsAppBubble.js` | Balão de prévia. Hoje só renderiza texto. |

Testes existentes relevantes: `test/link-conversion-route.test.js`,
`test/offer-engine.test.js`, `test/telegram-offer-bot.test.js`,
`test/offer-builder-ui-logic.test.js`, `test/image-scrapers.test.js`,
`test/mobile-offer-composer.test.js`. **Todos devem continuar passando.**

---

## Tarefa 1 — Imagem da oferta

### Backend (`src/api/routes/linkConversion.js`, handler `/scrape-offer`)

1. Importar `fetchProductImage` de `../../converters/imageScrapers.js` e
   `detectLinks` de `../../detector.js` (confira o caminho relativo real do
   arquivo).
2. Dentro do handler, **em paralelo** com `buildScrapedOffer` (mesmo padrão de
   `buildTelegramOffer` em `src/telegram/offerBot.js`), resolver a imagem:

   ```js
   const platform = detectLinks(url)[0]?.platform || null
   const imagePromise = platform
     ? fetchProductImage(platform, url, credentialsMap.shopee || {})
         .catch(() => null)
     : Promise.resolve(null)

   const [offer, imageUrl] = await Promise.all([
     buildScrapedOffer({ ... /* chamada existente, intocada */ }),
     imagePromise,
   ])
   ```

   - As credenciais da imagem são **só** as da Shopee (`credentialsMap.shopee`),
     exatamente como faz o Telegram (`resolveShopeeImage` exige
     `appId`/`secretKey`; Amazon/ML ignoram o argumento).
   - A URL passada ao `fetchProductImage` é a **URL original do usuário**, que
     já passou pelo `assertPublicUrl` (anti-SSRF). Não usar URLs derivadas que
     não passaram pelo guard.
3. Adicionar ao objeto de resposta o campo novo: `imageUrl: imageUrl || null`.
   **Apenas ADICIONAR o campo** — todos os campos existentes da resposta ficam
   exatamente como estão (o `OfferBuilder.js` legado consome o mesmo endpoint
   e não pode quebrar).
4. A imagem é **best-effort**: qualquer falha vira `imageUrl: null` e jamais
   pode derrubar a request (por isso o `.catch(() => null)`).
5. **Não** baixar o buffer da imagem no backend para esse fluxo — o frontend
   só precisa da URL para renderizar `<img>`. (O download/normalização com
   `fetchImageBuffer`/`normalizeImageForWhatsApp` é para envio via Baileys e
   Telegram, não para o painel.)

### Frontend (`dashboard/app/painel/criar-oferta/page.js`)

1. No `runScrape()`, guardar `imageUrl: normalizeText(info?.imageUrl)` no
   estado `generated`.
2. No card **"Produto encontrado"**: quando `generated.imageUrl` existir,
   substituir o placeholder SVG (`<span className="pnl-prod-img">…`) por
   `<img src={generated.imageUrl} alt="" />` com o mesmo footprint visual
   (reusar/estender a classe `.pnl-prod-img`; `object-fit: cover`,
   `border-radius` igual). Adicionar `onError` que volta ao placeholder SVG
   (CDNs podem bloquear hotlink em casos raros).
3. Na **prévia do WhatsApp**: passar a imagem para o balão. Em
   `dashboard/app/painel/WhatsAppBubble.js`, adicionar prop **opcional**
   `imageUrl` que, quando presente, renderiza `<img>` no topo do balão
   (cantos arredondados, largura 100%, `max-height` razoável ~220px,
   `object-fit: cover`, com `onError` escondendo a imagem). Prop ausente =
   comportamento idêntico ao atual (**não quebrar os outros usos** do
   componente — procure por `<WhatsAppBubble` no repo e confirme que todos
   continuam renderizando igual).
4. O botão "Copiar oferta" continua copiando **só o texto** — a imagem na
   prévia é informativa (o usuário anexa a foto manualmente no WhatsApp ou os
   fluxos automáticos cuidam disso). Adicionar uma nota discreta sob a prévia
   quando houver imagem, ex.: "A imagem é ilustrativa — copie o texto e anexe
   a foto no WhatsApp." (opcional, mas recomendado).

### Testes

- Em `test/link-conversion-route.test.js`: novo(s) caso(s) cobrindo
  (a) resposta inclui `imageUrl` quando o resolver injetado devolve URL;
  (b) `imageUrl: null` quando o resolver falha/lança, **sem** afetar os demais
  campos. Injetar `fetchProductImage` fake — descobrir como o teste injeta as
  dependências hoje (o route factory recebe `opts`; se necessário, aceitar
  `fetchProductImage` via `opts` com default para o real, padrão já usado para
  `convertLink`/`fetchProductInfo`).
- **Nenhum teste existente pode ser alterado para "passar"** — se algum
  quebrar, a implementação está errada.

---

## Tarefa 2 — Remover o card "Configurar envio"

Em `dashboard/app/painel/criar-oferta/page.js` (linhas ~226–246 do estado
atual):

1. Remover a `<section className="pnl-card">` inteira que contém:
   - título "Configurar envio";
   - checkbox "Incluir CTA de grupo" + input `groupCtaText`;
   - botão "Editar template" + textarea do template;
   - linha "Link da oferta: {generated.link}".
2. Limpar o que ficar órfão **somente nesta página**: estados
   `includeGroupCta`, `groupCtaText`, `showTemplate`, `template` (este último
   será substituído pela Tarefa 3), a constante `DEFAULT_TEMPLATE`, a função
   local `applyTemplate`, e os imports de `OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT`
   e `toggleTemplateVisibility` de `@/lib/offerBuilderUi`.
3. O link convertido **não some da página**: a informação "✓ link de afiliado
   aplicado" no card do topo já existe e fica. O link em si continua dentro da
   mensagem gerada (variável `{link}` do template).

**NÃO** remover nada equivalente em `dashboard/components/OfferBuilder.js` —
o checkbox de CTA e o editor de template de lá pertencem ao fluxo legado e
ficam intactos.

---

## Tarefa 3 — Seletor de template

Substituir o template hardcoded da página pelo sistema de templates canônico
(o mesmo das ofertas automáticas / página `/painel/mensagens`).

### Comportamento

1. **Fonte da lista**: `composeTemplates` / `loadAllTemplates` +
   `loadTemplateStore` de `@/lib/mobileTemplateStore` — devolve presets
   (`automatico_classico`, `simples`, já com overrides do usuário aplicados) +
   templates customizados. No mount: renderizar imediatamente com
   `loadAllTemplates()` (cache local, síncrono) e em seguida atualizar com o
   resultado de `loadTemplateStore()` → `composeTemplates(store)` (fonte de
   verdade no servidor).
2. **Default**: `automatico_classico` (é o default canônico do produto — vide
   `DEFAULT_TEMPLATE_KEY` em `src/api/routes/offerAutomation.js`).
3. **Persistência da escolha**: localStorage, chave nova
   `wabot.criarOferta.templateKey.v1`. Ao carregar, se a chave salva não
   existir mais na lista (template customizado deletado), cair no default
   silenciosamente.
4. **UI**: um `<select>` (ou lista de chips) rotulado "Template", posicionado
   no card da prévia (acima do `WhatsAppBubble`) ou num card pequeno no lugar
   do card removido. Ao lado, um link "Gerenciar templates" para
   `/painel/mensagens` (é lá que o usuário edita/cria templates — **não**
   reintroduzir editor de template nesta página).
5. **Composição da mensagem**: trocar a `applyTemplate` local por
   `buildMobileOfferText` de `@/lib/mobileOfferComposer`:

   ```js
   const offerMessage = buildMobileOfferText({
     product: {
       title: generated?.title || '',
       price: generated?.newPrice ? formatOfferPrice(generated.newPrice) : '',
       oldPrice: generated?.oldPrice ? formatOfferPrice(generated.oldPrice) : '',
       discount: dp != null ? `-${dp}% OFF` : '',
       storeName: store?.name || '',
       platform: store ? undefined : undefined, // ver normalizeMobileOfferProduct
     },
     link: generated?.link || link,
     templateBody: selectedTemplate?.body,
     template: selectedTemplate?.key,
   })
   ```

   - **Antes de escrever**, ler `normalizeMobileOfferProduct` e
     `applyTemplateVariables` em `mobileOfferComposer.js` para mapear os campos
     exatamente (não chutar nomes).
   - `preserveAutomationPlaceholders` fica no default (`false`): os
     placeholders `{{gancho}}`/`{{cta}}`/`{{convitegrupo}}` são removidos da
     mensagem final — correto para cópia manual, onde não há pool de variações.
   - Manter o memo (`useMemo`) recomputando quando `generated`, `link` ou o
     template selecionado mudarem.
6. Conferir a prévia com dados parciais (sem preço antigo, sem preço, sem
   título) — não pode sobrar lixo tipo `~~` ou `De  por` visivelmente quebrado.
   `buildMobileOfferText` já lida com a maior parte; validar manualmente.

### Testes

- `test/mobile-offer-composer.test.js` cobre o compositor — não alterar.
- Se criar helper novo (ex.: resolução do template selecionado + fallback de
  chave inexistente), extraí-lo para função pura exportada (na própria página
  não dá para testar; pode ir em `dashboard/lib/`) e cobrir com teste novo
  `node:test` seguindo o padrão dos testes existentes (db-free, env-free).

---

## O QUE NÃO PODE SER FEITO (guardrails — violar qualquer item = PR rejeitada)

1. **NÃO alterar `src/converters/offerEngine.js`** (shape de retorno de
   `buildScrapedOffer`, semântica de `keepOriginalLink`, fallbacks). O bot do
   Telegram depende dele. A imagem entra na **rota**, não no motor.
2. **NÃO tocar em `src/telegram/offerBot.js`** nem em
   `src/telegram/offerBotRunner.js`.
3. **NÃO modificar `src/converters/imageScrapers.js`** — apenas importar e
   consumir. As regras invioláveis do PR #422 (AGENTS.md, seção "Image
   scrapers") valem: não mexer no caminho do Mercado Livre, não baixar
   `IMAGE_HIRES_MIN_DIMENSION_PX`, etc.
4. **NÃO remover/renomear nenhum campo existente** da resposta de
   `POST /api/link-conversion/scrape-offer` — só adicionar `imageUrl`. O
   `OfferBuilder.js` legado consome o mesmo endpoint.
5. **NÃO tocar em `dashboard/components/OfferBuilder.js` nem em
   `dashboard/lib/offerBuilderUi.js`** — `/dashboard/gerar-oferta` e
   `/dashboard/converte-links` continuam funcionando exatamente como hoje.
6. **NÃO quebrar os outros usos de `WhatsAppBubble`** — a prop `imageUrl` é
   opcional e a renderização sem ela é byte-a-byte a atual.
7. **NÃO criar migration / NÃO tocar em `prisma/schema.prisma`** — os
   templates já são persistidos em `BotConfig.mobileTemplatesJson`; a escolha
   do template da página fica em localStorage.
8. **NÃO introduzir fetch server-side de URLs arbitrárias** fora do fluxo já
   protegido por `assertPublicUrl` (anti-SSRF, seção D-2). O
   `fetchProductImage` só recebe a URL que já passou pelo guard.
9. **NÃO alterar testes existentes para fazê-los passar** — eles são o
   contrato. Só adicionar testes novos.
10. **NÃO mexer em portas, `.env`, `ecosystem.config.cjs`, workflows de
    deploy** — nada desta mudança exige isso.
11. **NÃO criar editor de template nesta página** — edição é em
    `/painel/mensagens`; aqui é só seleção.
12. **NÃO duplicar a lógica de composição de oferta** — usar
    `buildMobileOfferText` (frontend) e `buildScrapedOffer` (backend) já
    existentes. Nenhuma nova função "applyTemplate" paralela.
13. **Fluxo git**: branch de feature a partir de `develop`, PR **contra
    `develop`** (nunca `main`), sem amend em commits já enviados, validação em
    staging antes de promover (vide AGENTS.md).

## Validação antes de abrir a PR

```bash
node --test                      # suíte inteira na raiz (db-free)
cd dashboard && npm run build    # build do Next precisa passar
```

Validação manual em staging (`http://178.105.54.0:3006`), página
`/painel/criar-oferta`:

- [ ] Link de Amazon e de Mercado Livre: imagem aparece no card "Produto
      encontrado" e na prévia do WhatsApp.
- [ ] Link de loja sem imagem resolvível (ou Shopee sem credenciais): página
      funciona normal, placeholder SVG no lugar da imagem, sem erro visível.
- [ ] Card "Configurar envio" não existe mais; nenhum resíduo de CTA/textarea.
- [ ] Select de template lista presets + customizados criados em
      `/painel/mensagens`; default `automatico_classico`; troca atualiza a
      prévia na hora; escolha sobrevive a reload.
- [ ] "Copiar oferta" copia o texto do template selecionado com
      título/preços/link preenchidos e sem placeholders `{{...}}` sobrando.
- [ ] `/dashboard/gerar-oferta` e `/dashboard/converte-links` (fluxo legado)
      continuam idênticos ao comportamento atual.
