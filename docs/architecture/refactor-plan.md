# Plano pragmático de saneamento técnico do Wabot

Data: 2026-07-06

## 1. O diagnóstico do Frankenstein

### Puxadinho crítico: `src/bot-worker.js`

`src/bot-worker.js` é o principal arquivo Deus do backend. Ele abre socket Baileys, gerencia estado de sessão, aplica dedup local/global, lê e grava banco, converte links, baixa e normaliza imagens, aplica políticas de encaminhamento, monta payload de mensagem, controla filas, classifica erros, publica analytics e executa recuperação de sessão no mesmo processo. O tamanho atual torna qualquer mudança no pipeline de WhatsApp arriscada, porque regras de negócio e detalhes de infraestrutura estão misturados.

Sinais objetivos:

- Arquivo com milhares de linhas e dezenas de imports de camadas diferentes.
- Mistura de responsabilidades de domínio, infraestrutura, persistência e observabilidade.
- Comentários de incidentes embutidos no fluxo principal, mostrando que correções operacionais foram sendo adicionadas diretamente no worker.

### Puxadinho de acoplamento operacional: `manager.js`, `sessionCore` e `supervisor`

O projeto já tem uma fachada (`src/manager.js`) para escolher entre modo inline e remoto, mas o contrato real ainda é a superfície histórica de `sessionCore`. O supervisor importa `sessionCore` diretamente para executar comandos, enquanto rotas e dispatchers importam `manager.js`. Isso é uma melhoria importante, mas ainda não é uma porta de domínio explícita: o core do produto conhece detalhes do ciclo de vida WhatsApp, BullMQ, Redis e PM2 por convenção.

Risco: qualquer mudança no provedor de WhatsApp ou no mecanismo de supervisão tende a exigir ajuste em vários pontos, porque o contrato é “as funções que existem hoje”, não um caso de uso estável como `MessagingGateway.sendOffer()`.

### Duplicação conceitual: oferta existe em formatos diferentes

Hoje existem pelo menos três representações de “oferta”:

1. Oferta raspada para o painel (`buildScrapedOffer`).
2. Oferta automática Shopee (`offerAutomation/dispatcher.js`).
3. Mensagem espelhada de grupo monitorado (`bot-worker.js` + `messageProcessor.js`).

Cada uma decide título, preço, link, imagem, loja, variação de copy e dedup com formatos próprios. Isso força conversões ad hoc e aumenta risco de regressão quando uma loja muda o formato de link, preço, imagem ou cupom.

### Duplicação de composição de mensagem

A composição de texto aparece em locais distintos:

- `messageProcessor.js` sanitiza links, remove convites, aplica branding e substitui URLs.
- `offerAutomation/dispatcher.js` formata oferta automática e também usa composer do dashboard.
- O dashboard tem bibliotecas de template que são importadas pelo backend (`dashboard/lib/mobileOfferComposer.js` e `dashboard/lib/mobileTemplateStore.js`).

O backend depender de código dentro de `dashboard/` é um acoplamento invertido: a camada de aplicação passa a depender da UI. O correto é extrair o composer compartilhado para um pacote/módulo neutro em `src/application` ou `src/domain`, e o dashboard consumir esse módulo quando precisar prever a mensagem.

### Rotas grandes com regra de negócio embutida

Algumas rotas Fastify viraram mini-aplicações:

- `src/api/routes/admin.js`: mistura consultas administrativas, autorização, agregação, apresentação e ações operacionais.
- `src/api/routes/payments.js`: concentra detalhes de webhooks, Mercado Pago, conciliação e persistência.
- `src/api/routes/auth.js`: combina rate limit, autenticação, analytics e manipulação de usuário.
- `src/api/routes/linkConversion.js`: já delega parte para `offerEngine`, mas ainda carrega rate limit, anti-SSRF, credenciais, imagem e payload HTTP no mesmo arquivo.

Rotas deveriam ser adaptadores finos: validar entrada, chamar um caso de uso e traduzir erro para HTTP.

### Conversores com responsabilidade larga

`src/converters/*` concentra scraping, regras por marketplace, geração de link afiliado, tratamento de cupom, resolução de shortlink, fallback de imagem e validações operacionais. A pasta é valiosa, mas virou um “módulo utilitário gigante”. O ideal é separar:

- `AffiliateLinkService`: converte e saneia links.
- `ProductInfoProvider`: busca título/preço/imagem.
- `MarketplaceAdapter`: implementação por loja.
- `OfferAssembler`: transforma informações parciais em `Offer` canônico.

### Frontend com páginas Deus

No dashboard, páginas como `dashboard/app/admin/page.js`, `dashboard/app/painel/grupos/page.js` e `dashboard/app/painel/whatsapp/page.js` têm muita lógica de estado, chamada de API, composição visual e regras de apresentação juntas. Isso dificulta mexer em pequenos pedaços sem quebrar o fluxo completo.

## 2. A nova arquitetura proposta

A proposta não é reescrever tudo em Clean Architecture “pura”. É uma arquitetura em camadas pragmática, com portas explícitas nos pontos instáveis: WhatsApp, afiliados, scraping, filas e pagamentos.

```text
src/
  domain/
    offers/
      offer.js                 # tipos/normalizadores do objeto Offer canônico
      offerPolicy.js           # dedup, elegibilidade, regras de preço/cupom
      offerText.js             # composição pura de texto de oferta
    messaging/
      message.js               # OutboundMessage, MediaAttachment, Destination
      messagingPort.js         # contrato do gateway de mensagem
    affiliate/
      affiliateLink.js         # Value Objects e regras puras
    sessions/
      session.js               # estados e políticas de sessão

  application/
    offers/
      buildOfferFromUrl.js     # use case: URL -> Offer
      dispatchOffer.js         # use case: Offer -> destinos
      runAutomation.js         # orquestra automações sem saber de Shopee/Baileys
    messaging/
      sendMessage.js           # aplica policy + chama MessagingPort
      processIncomingMirror.js # pipeline de mensagem monitorada
    sessions/
      startSession.js
      stopSession.js
      getSessionStatus.js

  infrastructure/
    whatsapp/
      baileysGateway.js        # implementação do MessagingPort com Baileys
      baileysSessionRuntime.js # socket, auth state, reconnect
    marketplaces/
      shopeeAdapter.js
      amazonAdapter.js
      mercadoLivreAdapter.js
      magaluAdapter.js
    persistence/
      prismaRepositories.js
    queues/
      bullmqSendQueue.js
      memorySendQueue.js
    payments/
      mercadoPagoGateway.js
    observability/
      analyticsSink.js

  interfaces/
    http/
      routes/
        linkConversionRoutes.js
        sessionRoutes.js
        paymentsRoutes.js
    workers/
      botWorker.js             # fino: boot + wiring
      supervisorWorker.js      # fino: boot + wiring
    cron/
      offerAutomationCron.js

  shared/
    env.js
    errors.js
    result.js
    time.js
```

### Responsabilidade de cada camada

- `domain`: regras puras, sem banco, sem HTTP, sem Baileys, sem Redis. Deve ser fácil de testar com `node --test` sem fixtures pesadas.
- `application`: casos de uso. Orquestra domínio e portas, mas não conhece detalhes de SDK. Exemplo: “montar oferta a partir de URL”, “enviar oferta para grupos”, “processar mensagem monitorada”.
- `infrastructure`: adaptadores reais para ferramentas externas: Baileys, Shopee, Amazon, Mercado Livre, Prisma, BullMQ, Mercado Pago.
- `interfaces`: entradas do sistema: HTTP, workers, cron. Deve ser fino e chamar `application`.
- `shared`: utilitários transversais pequenos, sem regra de negócio.

### Objeto `Offer` canônico

Um formato único reduz duplicação entre scraper, painel, automação e WhatsApp:

```js
export function normalizeOffer(input) {
  return {
    idempotencyKey: input.idempotencyKey ?? null,
    source: input.source, // 'scraped-url' | 'automation' | 'mirrored-message'
    marketplace: input.marketplace, // 'shopee' | 'amazon' | 'mercadolivre' | 'magalu'
    title: input.title || 'Produto em oferta',
    pricing: {
      currentCents: input.currentCents ?? null,
      originalCents: input.originalCents ?? null,
      discountPct: input.discountPct ?? null,
    },
    links: {
      originalUrl: input.originalUrl,
      affiliateUrl: input.affiliateUrl ?? null,
      displayUrl: input.displayUrl ?? input.affiliateUrl ?? input.originalUrl,
      finalUrl: input.finalUrl ?? input.originalUrl,
    },
    media: {
      imageUrl: input.imageUrl ?? null,
      imageRefererUrl: input.imageRefererUrl ?? null,
    },
    metadata: {
      storeName: input.storeName ?? null,
      rating: input.rating ?? null,
      sales: input.sales ?? null,
      coupon: input.coupon ?? null,
    },
  }
}
```

Esse objeto deve ser a língua comum entre:

- `buildOfferFromUrl`.
- Preview do dashboard.
- Automação Shopee.
- Pipeline de espelhamento.
- Dedup e logs.

### Porta de mensagem para desacoplar WhatsApp

```js
// domain/messaging/messagingPort.js
export class MessagingPort {
  async sendText({ userId, destinations, text, idempotencyKey }) {
    throw new Error('Not implemented')
  }

  async sendMedia({ userId, destinations, media, caption, idempotencyKey }) {
    throw new Error('Not implemented')
  }

  async getStatus({ userId }) {
    throw new Error('Not implemented')
  }
}
```

Baileys vira só uma implementação:

```js
// infrastructure/whatsapp/baileysGateway.js
export function createBaileysMessagingGateway({ manager, logger }) {
  return {
    async sendText({ userId, destinations, text, options }) {
      return manager.sendBroadcast(userId, text, destinations, options)
    },
    async getStatus({ userId }) {
      return { running: await manager.isRunning(userId) }
    },
  }
}
```

Se amanhã trocar Baileys por API oficial/cloud, o core troca só o adapter.

## 3. Exemplo conceitual: antes vs. depois

### Antes: automação conhece tudo

Hoje a automação busca credenciais, chama Shopee, formata texto, aplica template do dashboard, consulta dedup, envia via manager e grava log no mesmo fluxo.

```js
export async function runAutomation(automation) {
  if (!(await isRunning(automation.userId))) return { skipped: 'bot_not_running' }

  const credRow = await db.credential.findUnique(...)
  const creds = parseCredentialData(credRow.data)
  const { offers } = await fetchOffers({ creds, keyword: automation.keyword })

  const message = formatOfferMessage(offers[0], automation.keyword)
  await sendBroadcast(automation.userId, message, [automation.destGroupJid])

  await db.offerAutomationSentLog.create(...)
}
```

Problemas:

- `runAutomation` depende de banco, Shopee, formato de oferta, template visual e WhatsApp.
- Testes precisam mockar muitas coisas.
- Uma mudança de formato de mensagem ou provedor WhatsApp afeta automação diretamente.

### Depois: use case pequeno com portas

```js
// application/offers/runAutomation.js
export function createRunAutomation({
  automationRepo,
  credentialRepo,
  offerProvider,
  offerPolicy,
  offerComposer,
  messagingGateway,
}) {
  return async function runAutomation(automationId) {
    const automation = await automationRepo.getById(automationId)
    const status = await messagingGateway.getStatus({ userId: automation.userId })
    if (!status.running) return { skipped: 'bot_not_running' }

    const credentials = await credentialRepo.getMarketplaceCredentials(
      automation.userId,
      automation.marketplace,
    )

    const candidates = await offerProvider.findOffers({ automation, credentials })
    const offer = await offerPolicy.pickSendableOffer({ automation, candidates })
    if (!offer) return { skipped: 'dedup_or_no_offer' }

    const text = offerComposer.toWhatsAppText({ offer, templateKey: automation.templateKey })

    await messagingGateway.sendText({
      userId: automation.userId,
      destinations: [automation.destGroupJid],
      text,
      idempotencyKey: offer.idempotencyKey,
    })

    await automationRepo.markSent({ automation, offer })
    return { sent: true, offerId: offer.idempotencyKey }
  }
}
```

Benefícios:

- O caso de uso é legível como regra de negócio.
- Shopee, Prisma, Baileys e templates são plugáveis.
- Testes unitários ficam simples: mocks de portas, sem socket e sem banco real.
- O mesmo `Offer` pode alimentar preview, automação e envio.

## 4. O cronograma de faxina

### Fase 0 — Congelar contratos e medir hotspots (1 a 2 dias)

Objetivo: evitar piorar o acoplamento enquanto a faxina começa.

Ações:

1. Criar uma regra de contribuição: novas rotas não podem importar `sessionCore` direto; usar porta/fachada.
2. Mapear importações críticas: `manager.js`, `sessionCore`, `db.js`, `dashboard/lib` importado por backend.
3. Adicionar uma página curta em `docs/architecture/` com os contratos alvo (`Offer`, `MessagingGateway`, `MarketplaceAdapter`).
4. Registrar baseline de testes atuais para saber quando uma refatoração quebrou comportamento.

Ganho imediato: menos regressão por “mais um remendo”.

### Fase 1 — Extrair domínio puro de oferta e mensagem (3 a 5 dias)

Objetivo: atacar o maior volume de duplicação sem mexer no socket WhatsApp.

Ações:

1. Criar `src/domain/offers/offer.js` com `normalizeOffer`, `offerDedupKey` e helpers de preço.
2. Criar `src/domain/offers/offerText.js` e mover composição pura de texto para fora do dashboard.
3. Fazer `dashboard/lib/mobileOfferComposer.js` virar wrapper ou consumidor do módulo compartilhado.
4. Adaptar `offerEngine` e `offerAutomation/dispatcher` para retornarem/consumirem `Offer` canônico.
5. Cobrir com testes unitários puros.

Ganho imediato: preview, automação e envio passam a falar a mesma língua.

### Fase 2 — Afinar rotas HTTP (3 a 7 dias)

Objetivo: transformar rotas grandes em adaptadores.

Ações:

1. Extrair use case `application/offers/buildOfferFromUrl.js` a partir de `linkConversionRoutes` + `offerEngine`.
2. Extrair `application/payments/handlePaymentWebhook.js` a partir de `payments.js`.
3. Extrair serviços administrativos de `admin.js` em consultas/use cases pequenos.
4. Padronizar erros com `AppError { code, statusCode, message, details }`.

Ganho imediato: rotas ficam menores, testes ficam mais baratos, endpoints param de carregar regra de negócio.

### Fase 3 — Criar porta `MessagingGateway` antes de mexer no worker (5 a 10 dias)

Objetivo: desacoplar core do WhatsApp sem reescrever `bot-worker.js`.

Ações:

1. Criar `src/domain/messaging/messagingPort.js` com contrato mínimo: `sendText`, `sendMedia`, `getStatus`.
2. Criar adapter `src/infrastructure/whatsapp/currentManagerGateway.js` usando `manager.js` por baixo.
3. Alterar automações e filas para dependerem do gateway injetado, não de `manager.js` direto.
4. Manter `manager.js` como compatibilidade temporária.

Ganho imediato: novas features de envio não acoplam mais a Baileys/sessionCore.

### Fase 4 — Quebrar `bot-worker.js` em fatias testáveis (contínuo, em PRs pequenos)

Objetivo: reduzir risco do arquivo Deus sem parar produção.

Ordem recomendada:

1. `incomingMessageParser`: extrair leitura de texto, link e mídia.
2. `mirrorPolicyService`: extrair decisão de encaminhar, bloquear ou sanitizar.
3. `conversionPipeline`: extrair link original → link convertido → warning/fallback.
4. `mediaPipeline`: extrair resolução/download/normalização de imagem.
5. `sendOrchestrator`: extrair fila, timeout, retry e gravação de logs.
6. `sessionRuntime`: deixar socket/reconnect/heartbeat isolados.

Regra: cada extração deve mover código com teste de caracterização antes de mudar comportamento.

Ganho imediato: incidentes passam a ser corrigidos no módulo certo, não no worker inteiro.

### Fase 5 — Reorganizar conversores por adapter de marketplace (5 a 10 dias)

Objetivo: deixar cada loja plugável e reduzir efeitos colaterais.

Ações:

1. Definir `MarketplaceAdapter`:
   - `detect(url)`
   - `convertLink(url, credentials)`
   - `fetchProductInfo(url, credentials)`
   - `fetchProductImage(url, credentials)`
2. Migrar Shopee primeiro, por ser a mais complexa em shortlink/cupom.
3. Migrar Amazon, Mercado Livre e Magalu em PRs separados.
4. Manter `src/converters/index.js` como fachada legada até todos os consumidores migrarem.

Ganho imediato: mudança em uma loja deixa de ameaçar as outras.

### Fase 6 — Limpar dashboard com componentes e hooks (contínuo)

Objetivo: reduzir páginas Deus sem reescrever UI.

Ações:

1. Para cada página grande, extrair `components/`, `hooks/` e `api-client` local.
2. Começar por admin e WhatsApp, que têm maior complexidade operacional.
3. Manter snapshots visuais ou smoke manual em staging para páginas críticas.

Ganho imediato: UI fica mais barata de evoluir e menos propensa a regressões.

## 5. Riscos reais da refatoração e como controlar

A refatoração tem risco, mas o maior risco seria tentar fazer tudo de uma vez. O plano recomendado é incremental, por trás de fachadas e contratos, sempre mantendo o comportamento atual funcionando em produção.

### Riscos principais

1. **Quebrar envio ou sessão WhatsApp**
   - Onde mora o risco: qualquer mudança próxima de `bot-worker.js`, `sessionCore`, `manager.js` ou supervisor.
   - Impacto: sessão cair, QR/status ficar incorreto, mensagens não enviarem ou duplicarem.
   - Mitigação: primeiro criar `MessagingGateway` usando o `manager.js` atual por baixo; só depois mover consumidores para essa porta. O comportamento externo permanece igual enquanto a arquitetura muda por dentro.

2. **Duplicar ou bloquear ofertas por erro de dedup**
   - Onde mora o risco: automações, `MessageLog`, dedup local/global e `OfferAutomationSentLog`.
   - Impacto: spam em grupos, perda de oferta legítima ou risco de ban por repetição.
   - Mitigação: extrair dedup como regra pura com testes de caracterização antes de trocar qualquer query ou chave.

3. **Perder comissão por mudança em conversores**
   - Onde mora o risco: Shopee, Mercado Livre, Amazon, Magalu, shortlinks, cupom e fallback.
   - Impacto: link enviado sem afiliado correto, cupom removido indevidamente ou link quebrado no WhatsApp.
   - Mitigação: migrar marketplace por marketplace, começando por adapters que preservem a fachada antiga (`src/converters/index.js`). Nunca trocar todos os conversores no mesmo PR.

4. **Desalinhar preview do dashboard e mensagem enviada**
   - Onde mora o risco: composição de oferta no backend e no dashboard.
   - Impacto: a usuária vê uma oferta no painel, mas o WhatsApp envia texto/link diferente.
   - Mitigação: extrair primeiro um composer compartilhado puro e fazer backend e dashboard consumirem o mesmo contrato.

5. **Introduzir arquitetura bonita, mas complexa demais**
   - Onde mora o risco: criar camadas, classes abstratas e factories demais antes de haver necessidade real.
   - Impacto: mais arquivos, mais boilerplate e menos velocidade.
   - Mitigação: usar arquitetura em camadas “mínima”: módulo puro + use case + adapter apenas onde há dependência externa real.

6. **Refatoração longa ficar pela metade**
   - Onde mora o risco: abrir muitos PRs estruturais sem ganho de produto visível.
   - Impacto: duas arquiteturas convivem por tempo demais e a equipe se perde.
   - Mitigação: cada fase precisa terminar com um ganho concreto: menos import acoplado, arquivo menor, teste novo ou contrato reutilizado por dois consumidores.

### O que NÃO fazer

- Não reescrever `bot-worker.js` inteiro em um PR.
- Não trocar `manager.js`/`sessionCore`/supervisor ao mesmo tempo.
- Não migrar todos os marketplaces juntos.
- Não mexer em schema/banco junto com reorganização arquitetural, salvo se for inevitável.
- Não alterar comportamento de produção no mesmo PR em que apenas move código.

### Estratégia segura: refatorar aos poucos

Não precisa e não deve ser tudo de uma vez. A estratégia segura é o padrão **Strangler Fig**: criar uma fachada nova ao lado do código antigo, migrar um consumidor por vez e apagar o caminho antigo só quando não houver mais uso.

Sequência segura:

1. **Criar contrato novo sem mudar comportamento**
   - Exemplo: criar `MessagingGateway`, mas a implementação inicial só chama `manager.sendBroadcast()` e `manager.isRunning()`.
   - Resultado: zero mudança funcional.

2. **Migrar um consumidor pequeno**
   - Exemplo: mover `offerAutomation/dispatcher.js` para usar `MessagingGateway` em vez de importar `manager.js` direto.
   - Resultado: valida o contrato em um fluxo real, mas controlado.

3. **Adicionar teste de caracterização**
   - O teste comprova que o texto, dedup, link e status continuam iguais ao comportamento antigo.
   - Resultado: confiança para repetir o padrão em outro fluxo.

4. **Migrar o próximo consumidor**
   - Exemplo: fila de ofertas, depois rotas de broadcast, depois processamento de mensagens monitoradas.
   - Resultado: a dependência direta do sistema antigo diminui gradualmente.

5. **Só então simplificar o núcleo antigo**
   - Quando poucos consumidores dependerem de `bot-worker.js`/`sessionCore` diretamente, fica seguro dividir o arquivo em módulos menores.
   - Resultado: menos risco de queda de sessão ou regressão operacional.

### Ordem de menor risco para maior risco

1. **Baixo risco:** extrair funções puras de preço, texto, normalização de oferta e payloads.
2. **Baixo/médio risco:** mover composer compartilhado para fora do dashboard e manter wrappers compatíveis.
3. **Médio risco:** criar `MessagingGateway` e migrar automações/filas para ele.
4. **Médio/alto risco:** separar adapters de marketplaces, um por vez.
5. **Alto risco:** fatiar `bot-worker.js`, porque ele mistura socket, sessão, dedup, envio, mídia e recuperação operacional.
6. **Altíssimo risco:** trocar provedor WhatsApp, modo supervisor ou modelo de fila. Isso só deve acontecer depois da porta de mensagens estar estável.

### Critério de parada por fase

Cada fase deve ser pequena o suficiente para poder ser revertida sozinha. Um PR saudável deve responder “sim” para estas perguntas:

- Se isso der errado, consigo reverter sem afetar outras fases?
- O comportamento externo continua igual?
- Existe teste cobrindo o comportamento antigo?
- Staging consegue validar o fluxo principal antes de ir para produção?
- A mudança reduz pelo menos um acoplamento real?

Se alguma resposta for “não”, a fase está grande demais e precisa ser quebrada.

## Princípios para guiar a execução

1. Não fazer big bang rewrite.
2. Sempre criar fachada antes de trocar implementação.
3. Extrair código primeiro; mudar comportamento depois.
4. Preferir módulos puros e pequenos a classes abstratas demais.
5. Toda regra que já causou incidente merece teste de caracterização.
6. Backend não deve importar `dashboard/lib`; ambos devem depender de um módulo neutro.
7. `bot-worker.js` deve virar bootstrap + wiring, não regra de negócio.
