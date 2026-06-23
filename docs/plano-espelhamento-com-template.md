# Plano: Espelhamento com template próprio (montagem de oferta no relay)

> **Para a IA desenvolvedora:** este documento é a especificação da feature.
> Leia o `AGENTS.md` da raiz ANTES de começar — as regras dele valem
> integralmente e este plano não as substitui. A seção "O QUE NÃO PODE SER
> FEITO" no final é vinculante. Decisões de produto já tomadas com a cliente
> estão marcadas como **[DECIDIDO]** e não devem ser rediscutidas.

## 1. Dor do cliente e objetivo

Hoje o **espelhamento** (`src/bot-worker.js` → `processIncomingMessage`) é um
*relay de fidelidade*: pega a mensagem do grupo monitorado e reposta quase
idêntica, trocando **só os links** pelos do afiliado e reaproveitando a mídia
original. Para **filas, agendamento e ofertas automáticas** o cliente já pode
escolher um **template próprio** (montamos a mensagem do zero a partir de
título/preço/imagem). No espelhamento isso não existe — espelhamos tudo como
veio.

**Objetivo:** dar ao cliente a opção de, no espelhamento, **montar a mensagem
com o template dele** em vez de repostar a original. Para isso precisamos
extrair os dados estruturados (título, preço, imagem) da oferta e renderizar
com o template, exatamente como a automação faz.

## 2. A diferença conceitual (entender antes de codar)

São **duas filosofias opostas** de montagem:

| | Relay (atual) | Template (novo) |
|---|---|---|
| Texto | Caption original do upstream, links trocados in-place (`applyConversionsAndBranding`) | Montado do zero por `buildMobileOfferText(templateBody, …)` |
| Dados | Não extrai título/preço — a caption do upstream **é** o conteúdo | Extrai `{title, price, oldPrice, image}` via scrape |
| Mídia | Reaproveita o proto original via `relayMessage` (troca só caption) | `sendMessage` + imagem hi-res scrapada (igual à automação) |
| Links | Converte **todos** e substitui cada um | **Um** link primário (1 oferta = 1 produto) |

Ou seja: ligar o template **abandona o relay** e faz o espelhamento se comportar
como o `src/offerAutomation/dispatcher.js`. Não é um ajuste de formatação — é um
segundo caminho de montagem.

## 3. Decisões de produto **[DECIDIDO]**

1. **Fallback = relay clássico.** Se o modo template estiver ligado mas o scrape
   de título/preço falhar (loja lenta, anti-bot, sem credencial, timeout), a
   oferta **cai para o relay clássico** — nunca se perde uma oferta legítima. A
   saída fica eventualmente inconsistente (às vezes template, às vezes original),
   e isso é aceito.
2. **Configuração por grupo, com default global.** O modo, o template e a escolha
   "primeiro/último link" são **por grupo monitorado** (model `Group`), com um
   **default global** em `BotConfig` (espelha o padrão já usado por
   `imageMode`/`imageLinkTarget`, que têm override por grupo).
3. **Sem novo gate de plano.** Segue o gate que o espelhamento já tem hoje; não
   criar entitlement novo.
4. **Múltiplos links → escolher primeiro ou último.** O cliente sinaliza, por
   grupo, se o link a converter/ofertar é o **primeiro** ou o **último** da
   mensagem. A eleição considera **apenas links de loja conversíveis**
   (plataformas habilitadas), ignorando convites de grupo / cupons que venham
   juntos.

## 4. Riscos e mitigações (não ignorar)

1. **Latência no caminho quente (maior risco).** O incoming é uma **fila
   serial** com `MSG_QUEUE_TIMEOUT_MS=25s` por mensagem. O relay atual é barato;
   o template exige **scrape** (`fetchProductInfo`, Amazon BR ~1.3MB de HTML). Um
   scrape lento trava a fila inteira.
   **Mitigação:** o scrape do modo template roda com **timeout curto próprio**
   (reusar `PRODUCT_TITLE_FETCH_TIMEOUT_MS`/`CONVERSION_TIMEOUT_MS` como teto,
   bem abaixo dos 25s) e, ao estourar, **cai no relay** (decisão 3.1). Nunca
   deixar o scrape do template consumir o orçamento todo da mensagem.
2. **Mensagem com 2 produtos diferentes.** O template colapsa para **um** (o
   first/last). É perda de informação real — a UI precisa avisar que o modo
   template é ideal para mensagens de **um produto**.
3. **Eleição de link errada.** "Primeiro link" pode ser um convite de grupo.
   Mitigar elegendo entre `conversions` (já filtradas por plataforma
   habilitada/loja), nunca entre `detectLinks` cru.
4. **Reuso de conversão.** O espelhamento **já converteu** os links. Não chamar
   `buildScrapedOffer()` (ele converte de novo). Usar o link **já convertido**
   do `primary` e chamar **`fetchProductInfo`** (scraper) + `imageScrapers`
   diretamente — sem dupla conversão e sem duplicar lógica de scrape.
5. **Guard de título-mismatch fica inócuo.** Ele compara caption do upstream com
   título scrapado; no template a caption é **construída** a partir do título
   scrapado → mismatch impossível por construção. No caminho template, **pular**
   o guard (`TITLE_MISMATCH_GUARD`).

## 5. O que já existe (reaproveitar, não reinventar)

| Peça | Onde | Uso |
|---|---|---|
| Pipeline de incoming/relay | `src/bot-worker.js` `processIncomingMessage` (~1633–2160) | Ponto de inserção do novo caminho. **Não** alterar o ramo relay. |
| Conversão de links | já roda no incoming (`conversions[]`, ~1924–1955) | Reusar; eleger `primary` por first/last entre elas. |
| Engine de template | `dashboard/lib/mobileOfferComposer.js` `buildMobileOfferText` + `dashboard/lib/mobileTemplateStore.js` `composeTemplates` | Mesma usada pelo dispatcher de automação. Importar igual o dispatcher já faz. |
| Resolução de template do BotConfig | `src/offerAutomation/dispatcher.js` `resolveAutomationTemplateBody` / `parseTemplateStore` | **Extrair para um módulo compartilhado** (ex.: `src/core/offerTemplate.js`) em vez de copiar. |
| Scrape de título/preço | `src/converters/productInfoScraper.js` `fetchProductInfo` | Chamar no link convertido do `primary`. |
| Scrape de imagem hi-res | `src/converters/imageScrapers.js` (via `getImage()`/`resolveMonitoredImage` já no worker) | **Não tocar** (regras invioláveis). Apenas consumir. |
| Variação/branding | `src/core/copyVariation.js` `applyVariation` + `resolveCopyVariationPoolJson` | Aplicar no texto do template, como o dispatcher. |
| Override por grupo (precedente) | `Group.imageMode`, `Group.imageLinkTarget('first'|'last')`, `Group.fallbackToOriginal` | Mesmo padrão para os campos novos. |
| Envio | `sendBroadcast`/fila do worker, caminho `sendMessage`+imagem (mesmo da automação) | Reusar; não inventar caminho de envio. |

## 6. Arquitetura proposta

### 6.1 Prisma (migration ADITIVA — só `ADD COLUMN` nullable/`@default`)

```prisma
model Group {
  // ... campos existentes intactos ...
  mirrorMode        String  @default("relay")  // 'relay' | 'template'
  mirrorTemplateKey String?                     // chave em mobileTemplatesJson; null = usa default global
  primaryLinkTarget String  @default("first")  // 'first' | 'last' — link a converter/ofertar
}

model BotConfig {
  // ... campos existentes intactos ...
  mirrorModeDefault        String  @default("relay")
  mirrorTemplateKeyDefault String?
  primaryLinkTargetDefault String  @default("first")
}
```

`mirrorMode='relay'` como default garante **zero mudança de comportamento** para
quem não opta. Resolução efetiva por mensagem: valor do `Group` quando definido,
senão o `*Default` do `BotConfig` (mesmo padrão de fallback já usado por
`imageMode`).

Migration: `npx prisma migrate dev --name add_mirror_template_fields`. Só
`ALTER TABLE ADD COLUMN`. Nada destrutivo. **Validar em staging antes de prod**
(regra do AGENTS.md para migrations).

### 6.2 Módulo compartilhado de template — `src/core/offerTemplate.js`

Extrair do `dispatcher.js` (sem mudar o comportamento dele) as funções:
- `parseTemplateStore(mobileTemplatesJson)`
- `resolveTemplateBody(botConfig, templateKey, defaultKey)`

Tanto o `dispatcher.js` quanto o `bot-worker.js` passam a importar daqui. O
`dispatcher.js` deve continuar com testes verdes (`test/offer-automation.test.js`).

### 6.3 Backend — novo ramo no `processIncomingMessage` (`bot-worker.js`)

Inserir **depois** de `conversions` montadas e **antes** do guard de mismatch
(~linha 2003). Em pseudo:

```
const mirrorMode = monitorGroup?.mirrorMode || cfg.botConfig.mirrorModeDefault || 'relay'
let templateOffer = null
if (mirrorMode === 'template' && conversions.length) {
  // 1) eleger link primário entre as CONVERSÕES (não detectLinks cru)
  const ordered = conversions.filter(c => c.platform !== 'nolink')
  const target = (monitorGroup?.primaryLinkTarget || cfg.botConfig.primaryLinkTargetDefault) === 'last'
    ? ordered[ordered.length - 1] : ordered[0]
  if (target) {
    // 2) scrape com TIMEOUT CURTO próprio; falha => null (=> fallback relay)
    const info = await withTimeout(fetchProductInfo(target.converted, { ...creds }), SCRAPE_BUDGET_MS).catch(() => null)
    if (info && (info.title || info.newPrice)) {
      const templateBody = resolveTemplateBody(cfg.botConfig, monitorGroup?.mirrorTemplateKey, cfg.botConfig.mirrorTemplateKeyDefault)
      const base = buildMobileOfferText({ product: {…info}, link: target.converted, templateBody })
      templateOffer = { primary: target, text: base }   // imagem via getImage() (já existe)
    }
  }
}
```

Regras do ramo template:
- Se `templateOffer` montado → no loop de destinos, usar **esse texto** (passando
  por `applyVariation` como o relay já faz), eleger `primary = templateOffer.primary`,
  **pular o guard de mismatch** e enviar pelo caminho `sendMessage`+imagem
  (`wantImage`/`getImage()`), **não** pelo `relayMessage`.
- Se `templateOffer == null` (modo off, sem conversão, scrape falhou/timeout) →
  **comportamento atual byte-a-byte** (relay clássico). **[DECIDIDO 3.1]**
- A imagem do template usa o mesmo `getImage()`/`resolveMonitoredImage` já
  presentes (respeitando `imageMode`/`imageLinkTarget`). Sem imagem disponível,
  segue como a automação faz hoje (texto/preview).

`SCRAPE_BUDGET_MS`: constante nova com default conservador (ex.: ~6s, bem abaixo
dos 25s da fila), override por env. **Não** desligar timeouts (regra AGENTS.md).

Dedup, log (`MessageLog`), throttle por canal e variação por canal-destino
permanecem como estão — o ramo template só muda **como o texto/mídia são
montados**, não a mecânica de envio/dedup/log.

### 6.4 Rotas / API

Os campos novos viajam pela rota de update de grupo já existente
(`src/api/routes/groups.js`) e pela config (`src/api/routes/config.js` para os
`*Default`). Reusar a validação/ownership existente (`userId: req.user.sub`).
Validar: `mirrorMode ∈ {relay,template}`, `primaryLinkTarget ∈ {first,last}`,
`mirrorTemplateKey` (quando setado) existe em `composeTemplates`. Confirmar os
nomes/contratos exatos das rotas ao implementar — **não** inventar rota nova se
a de grupo já aceita patch parcial.

### 6.5 Frontend

- **`/painel/grupos`** (onde já ficam `imageMode`/`imageLinkTarget` por grupo
  monitorado): adicionar, no editor do grupo de origem:
  - Toggle **"Montar com meu template"** (`mirrorMode`).
  - Ao ligar: `<select>` de template (de `composeTemplates`) + escolha
    **"Link a converter: primeiro / último da mensagem"** (`primaryLinkTarget`).
  - Aviso curto: "Ideal para mensagens de um produto. Com vários produtos, só o
    link escolhido vira oferta."
- **`/painel/configuracoes`**: os mesmos três como **default global**
  (`*Default`), no padrão dos defaults já existentes.
- **`/painel/espelhamento`**: a página é só leitura derivada hoje; opcional
  mostrar um badge "template" nos grupos que optaram. Não obrigatório nesta
  fase.
- `dashboard/lib/api.js`: estender os métodos de update de grupo/config com os
  campos novos.

### 6.6 Testes (node:test, db-free, deps injetadas — padrão da suíte)

- `test/mirror-template.test.js` (novo):
  - Eleição de link **first/last** entre conversões, **ignorando** link não-loja.
  - Montagem do texto via `buildMobileOfferText` com `info` mockado.
  - **Fallback para relay** quando o scrape retorna null/estoura timeout
    (clock/scrape fake) — assert de que o caminho relay foi tomado.
  - Modo `relay`/off não chama scrape e produz **exatamente** o texto atual.
  - Guard de mismatch é pulado no caminho template.
- Extração de `src/core/offerTemplate.js`: garantir `test/offer-automation.test.js`
  continua verde (sem mudança de comportamento do dispatcher).
- Rodar **a suíte inteira** (`node --test`): tudo que passa hoje continua
  passando.

## 7. Ordem de implementação (commits pequenos)

1. **Prisma**: campos novos em `Group` + `BotConfig` + migration aditiva.
2. **Refactor seguro**: extrair `src/core/offerTemplate.js` do dispatcher; manter
   testes do dispatcher verdes.
3. **Backend**: ramo template em `processIncomingMessage` com timeout + fallback
   relay; constante `SCRAPE_BUDGET_MS`. Testes novos.
4. **API**: aceitar/validar campos novos nas rotas de grupo e config.
5. **Frontend**: editor de grupo + defaults em configurações + `lib/api.js`.
6. **Validação manual em staging** (fluxo AGENTS.md): PR contra `develop`,
   autodeploy, testar em `http://178.105.54.0:3006` — relay intacto, template
   monta certo, first/last respeitado, fallback funciona com loja lenta.

## 8. O QUE NÃO PODE SER FEITO (vinculante)

1. **NÃO alterar o ramo relay (atual)** do `processIncomingMessage` — incoming,
   dedup (`registerDedupBlock`), timeouts, fila serial, `relayMessage`. O modo
   template é um **ramo adicional**; com `mirrorMode='relay'` (default) o
   comportamento é byte-a-byte o de hoje.
2. **NÃO tocar em `src/converters/imageScrapers.js`** (regras invioláveis do
   AGENTS.md). Apenas **consumir** via `getImage()`/`resolveMonitoredImage`.
3. **NÃO converter o link duas vezes**: usar o link **já convertido** do incoming
   e chamar `fetchProductInfo` — **não** chamar `buildScrapedOffer()` (ele
   re-converte) nem duplicar lógica de scrape/conversão fora do `offerEngine`.
4. **NÃO desligar timeouts.** O scrape do template tem teto próprio curto e, ao
   estourar, **cai no relay**. Nunca deixar o template travar a fila serial.
5. **NÃO eleger o link primário a partir de `detectLinks` cru** — sempre entre as
   `conversions` (filtradas por plataforma habilitada), para não pegar convite de
   grupo/cupom.
6. **NÃO fazer migration destrutiva** (DROP/RENAME/ALTER de coluna existente). Só
   `ADD COLUMN` nullable / com `@default`. Validar em staging antes de prod.
7. **NÃO inventar prefixos novos de `MessageLog.errorMsg`** — usar a taxonomia
   existente (`src/errorTaxonomy.js`).
8. **NÃO importar `sessionCore` direto** — envio sempre pelos caminhos existentes
   do worker (funciona em inline e remote).
9. **NÃO duplicar a engine de template**: reusar `buildMobileOfferText` /
   `composeTemplates` e o módulo compartilhado `src/core/offerTemplate.js`.
10. **NÃO criar PR contra `main`** — branch a partir de `develop`, PR contra
    `develop`, validar em staging. Não fazer amend em commit já mergeado.
11. **NÃO criar novo gate de plano** — segue o gate atual do espelhamento.
12. **NÃO deixar testes dependentes de banco real ou env** — deps injetadas.
13. **NÃO esquecer ownership**: toda query nas rotas filtra por
    `userId: req.user.sub`.

## 9. Critérios de aceite

- [ ] Grupo com `mirrorMode='relay'` (default) → espelhamento **idêntico** ao de
  hoje (texto, mídia, dedup, logs).
- [ ] Grupo com `mirrorMode='template'` e mensagem de 1 produto → sai a mensagem
  **montada com o template do cliente**, com título/preço scrapados e a foto do
  produto.
- [ ] `primaryLinkTarget='first'|'last'` com mensagem de 2 links de loja →
  converte/oferta o link certo; link de convite/cupom não é eleito.
- [ ] Scrape falho/lento no modo template → **cai no relay clássico**, sem perder
  a oferta e sem travar a fila.
- [ ] Default global aplicado quando o grupo não define; override por grupo
  prevalece.
- [ ] `node --test` 100% verde, suíte pré-existente intacta (incl.
  `test/offer-automation.test.js` após o refactor).
- [ ] Espelhamentos existentes (sem optar pelo template) seguem funcionando.
