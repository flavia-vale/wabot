# Research — Estratégia de leads inbound (013)

Fase 0. Cada decisão abaixo foi tirada de leitura do código real, não de suposição.
Onde a investigação contradiz uma "Assumption" da spec, a mudança está marcada com
**REVISA A SPEC** e a justificativa.

---

## R1 — O `noindex` real: onde ligar as duas pontas

### Achado

`dashboard/lib/seo-registry.mjs` tem `indexable` em toda rota, mas o campo só é lido por
`getIndexableSeoRoutes()`, consumido por:

| Consumidor | O que faz com o campo |
|---|---|
| `dashboard/app/sitemap.js` | tira do sitemap |
| `scripts/notify-indexnow.mjs`, `dashboard/scripts/indexnow-submit.mjs` | tira da notificação de URLs |
| `dashboard/scripts/guard-seo-registry-coverage.mjs` | **exige** que toda rota pública esteja na lista de indexáveis |
| `dashboard/scripts/lint-seo-metadata-duplicates.mjs` | só confere duplicidade entre indexáveis |
| `dashboard/scripts/validate-seo-consistency.mjs` | só confere conflito com `robots.txt` entre indexáveis |
| `getSeoRoutesByCluster()` (registry) | tira dos blocos de links internos dos hubs |

**Nenhuma página deriva `robots` do campo.** Hoje `indexable: true` em 100% das rotas — ou
seja, o mecanismo nunca foi exercitado.

Já existe **um** `noindex` real no site, e ele é o precedente certo:
`dashboard/app/promo-vip-7dias/layout.js` exporta `metadata.robots = { index: false, follow: false }`.
Isso responde FR-013 de imediato (ver R7).

### Armadilha bloqueante (não estava na spec)

`guard-seo-registry-coverage.mjs` compara as rotas do sistema de arquivos com
`getIndexableSeoRoutes()`. **No instante em que a primeira rota virar `indexable: false`, o
guard reprova** com "rota pública sem entrada no seo-registry". Portanto FR-039 e FR-008 se
atropelam se o guard não for ajustado **antes** de marcar qualquer página. O ajuste é trocar
a base de comparação de `getIndexableSeoRoutes()` para `SEO_ROUTES` (cobertura = estar no
registro; indexação = decisão separada).

### Decisão

**Camada: chokepoint nos construtores de metadata, com helper único no registry.**

1. `seo-registry.mjs` ganha duas funções puras:
   - `getSeoRoute(path)` — devolve a entrada do registro (qualquer rota, indexável ou não);
   - `buildSeoRobots(path)` — devolve `{ index: false, follow: true }` quando
     `indexable === false`, e `undefined` caso contrário (ausência = herda o default do site,
     que é indexar; **não** emitir `index: true` explícito para não criar ruído nem divergir
     do comportamento atual das ~100 rotas indexáveis).
2. Os construtores de metadata passam a espalhar `...(buildSeoRobots(path) && { robots: buildSeoRobots(path) })`:
   - `dashboard/app/_lpShared.js` → `getLpMetadata()`
   - `dashboard/app/_seoHubShared.js` → `getSeoHubMetadata()`
   - `dashboard/app/_preservationCommercialPages.js` → `getPreservationCommercialMetadata()`
   - `dashboard/app/_comparisonContent.js` (construtor equivalente das páginas `/alternativas/*`)
3. Páginas escritas à mão (metadata literal no próprio `page.js`) chamam o mesmo helper.

**Por que não `layout.js` por página (padrão do `promo-vip-7dias`):** as 15 cidades, 11 nichos
e 10 dores **não têm arquivo próprio** — são todas a mesma rota dinâmica
`dashboard/app/[slug]/page.js`, com `generateStaticParams()` alimentado por
`getProgrammaticSeoSlugs()`. Não existe onde pendurar um layout por página. O chokepoint no
`getLpMetadata()` é o único ponto que alcança as três grades de uma vez.

**Por que não um `middleware` ou header `X-Robots-Tag`:** exigiria runtime em toda requisição
(as páginas hoje são estáticas), e a spec pede o sinal no HTML entregue (FR-008).

**FR-010 fica garantido de graça:** `generateStaticParams()` continua listando **todos** os
slugs; sair do índice não tira a página do build nem do ar.

### Consequência aceita e registrada

`getSeoRoutesByCluster()` já filtra `indexable !== false`, então uma página marcada some dos
blocos "páginas relacionadas" dos hubs. É coerente com a intenção (o hub deixa de empurrar
sinal para uma página que queremos fora do índice) e não conflita com FR-009 — a própria
página continua seguindo os links dela para fora.

### Guard de regressão (novo)

`dashboard/scripts/validate-seo-consistency.mjs` ganha uma quarta checagem:
para toda rota com `indexable === false`, o arquivo que gera a metadata daquela rota **precisa**
referenciar `buildSeoRobots` (ou declarar `robots: { index: false` diretamente, caso do
`promo-vip-7dias`). Checagem estática de fonte, sem build — mesmo estilo dos validadores que
já existem. Falha ⇒ alguém marcou `indexable: false` sem ligar a ponta do HTML.

Espelho no `node:test` da raiz (`test/seo-noindex-guard.test.js`), porque o portão da raiz é o
que roda no CI de todo PR.

---

## R2 — A regra dos 55 caracteres: o que exatamente é medido

### Achado

O sufixo vem de `dashboard/app/layout.js`:

```
title: { default: 'Espelha Grupos | Bot para afiliados espelhar ofertas no WhatsApp',
         template: '%s | Espelha Grupos' }
```

`' | Espelha Grupos'` = **17 caracteres**. Só `dashboard/app/page.js` (home) escapa, usando
`title: { absolute: ... }`.

Medição real dos títulos de hoje (caracteres do texto cru, sem o sufixo):

| Página | Cru | Entregue (cru + 17) |
|---|---:|---:|
| `/bot-achadinhos-whatsapp` (modelo, FR-005) | **56** | 73 |
| `/bot-afiliados-whatsapp` (referência que converte) | 62 | 79 |
| `/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero` | 51 | 68 |
| `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` | 64 | 81 |
| `/alternativas/achadinhos-bot` | 75 | 92 |
| `/programa-de-afiliados` | 73 | 90 |
| `/blog/como-divulgar-ofertas-amazon-whatsapp` | 75 | 92 |

### Contradição interna da spec

FR-002 ("máximo 55 **contando o sufixo**") deixa **38 caracteres** para o texto da página.
Nenhum dos títulos que hoje convertem cabe em 38, e a própria página-modelo — que FR-005
proíbe reescrever — entrega 73. Aplicar FR-002 ao pé da letra reprovaria o modelo definido
por FR-005/FR-006 na mesma entrega.

### Decisão — **REVISA A SPEC** (Assumption "Medição de 55 caracteres")

O orçamento de **55 caracteres vale sobre a parte do título que a página escreve**; o sufixo
da marca é medido, exibido na mensagem de falha, e fica **fora** do orçamento.

Justificativa técnica, não conveniência:

1. O sufixo é **anexado no fim**, então é a primeira coisa que o Google corta no celular. Um
   orçamento que o inclui não descreve o que a pessoa lê — descreve o que ela não lê.
2. O Google reescreve/descarta o sufixo de marca com frequência; tratá-lo como custo fixo de
   17 caracteres força títulos telegráficos e piora justamente o "motivo para clicar" que a
   FR-003 exige.
3. Manter o sufixo é decisão de marca já canônica (unificação de marca de 2026-08-04, em
   `AGENTS.md`). Trocar as 11 páginas para `title.absolute` — a alternativa que tornaria os
   55 literais — apagaria a marca de 11 das páginas mais vistas do site.

### Cálculo exato que o teste usa (reaproveitando o padrão do PR #1420)

`test/pagina-achadinhos-clique.test.js` já estabeleceu a forma: ler a fonte, extrair o
`title:` do bloco da página, medir, e nomear o sufixo como constante. O padrão é reaproveitado
tal e qual; muda só a origem dos dados (agora são 11 páginas) e o número:

```js
const SUFIXO_TEMPLATE = ' | Espelha Grupos'      // dashboard/app/layout.js
const ORCAMENTO_TITULO = 55                       // FR-002, medido sobre o texto da página
const tituloEntregue = (bruto) => bruto + SUFIXO_TEMPLATE   // o que vai no <title>
// falha: `${bruto.length} chars (entregue: "${tituloEntregue(bruto)}" = ${...}) passa de 55`
```

- **Escopo do orçamento 55**: as 11 páginas de FR-004 (que estão sendo escritas agora, então
  55 é alcançável).
- **`/bot-achadinhos-whatsapp` (56)**: FR-005 proíbe reescrever. Fica com o teto que já tem
  (`<= 60`, em `test/pagina-achadinhos-clique.test.js`), **sem afrouxar** nada existente. É
  exceção documentada, não precedente.
- Descrição: `<= 160` (mesmo limite já usado no teste do PR #1420).

### Fonte única do título (FR-001) — achado que exige trabalho

Título e descrição das páginas comerciais estão **em dois lugares e já divergiram**:

| Onde | Título de `/bot-achadinhos-whatsapp` |
|---|---|
| `dashboard/app/_preservationCommercialPages.js` (o que vai ao ar) | `Bot para achadinhos no WhatsApp: 4 lojas e 7 dias grátis` (56) |
| `dashboard/lib/seo-registry.mjs` | `Bot para Achadinhos no WhatsApp: automatize seus grupos de ofertas` (66, **antigo**) |

Quem renderiza é o primeiro; o registry ficou com o texto de antes do PR #1420 e ninguém
percebeu porque nenhum validador compara os dois.

**Decisão:** a fonte única é **o módulo que renderiza a página**. Para as rotas que têm módulo
de conteúdo próprio (`_preservationCommercialPages.js`, `_comparisonContent.js`, `_lpShared.js`,
`_seoHubShared.js`), o registry **deixa de carregar `title`/`description`**; para as demais
(páginas com metadata literal), o registry segue sendo a fonte.

`lint-seo-metadata-duplicates.mjs` já sabe fazer isso para `_lpShared.js` — o parser é
estendido para os outros dois módulos. E ganha uma checagem nova: **se um `path` tiver título
nos dois lugares, reprova** (é a divergência acima virando erro em vez de silêncio).

---

## R3 — Aviso de credencial no painel (P3): de onde vem o dado

### Achados

1. **A linha do bloqueio guarda a loja.** `src/bot-worker.js:3044` grava
   `status: 'skipped'`, `errorMsg: 'skip:no_valid_conversions'` **e**
   `platform: links[0]?.platform`. Então o vocabulário por loja (FR-018/FR-019) sai do
   registro, sem inferência.
2. **Nenhuma rota existente entrega isso.**
   - `GET /logs/summary` joga `skip:no_valid_conversions` no balde `skippedConfig` junto com
     palavra bloqueada, título divergente etc., e nem seleciona `platform`. Não serve.
   - `GET /dashboard/status` (`src/api/routes/dashboard.js`, 24 linhas) devolve só
     `hasCredentials: credCount > 0` — booleano global, não sabe **qual** loja falta.
   - `GET /credentials/` devolve o cadastro, não os bloqueios.
   ⇒ **Precisa de rota nova.**
3. **O índice necessário já existe:** `@@index([userId, status, sentAt])` em `MessageLog`.
4. **O ponto de exibição já é um componente só.** `dashboard/components/ActivationChecklist.js`
   é renderizado tanto em `dashboard/app/painel/page.js` (tela inicial) quanto em
   `dashboard/app/painel/checklist/page.js`. Um componente cobre os dois pontos da Assumption.
   O terceiro ponto (histórico) **já existe**: `explainErrorMsg` em
   `dashboard/lib/painel/logsCopy.js:59` já traduz o prefixo.
5. **O texto do histórico hoje é genérico e não distingue loja:** "Nenhum link da mensagem
   pôde ser convertido em link de afiliado." Não diz o que fazer, não nomeia a loja, e é igual
   para Shopee e para ML/Amazon — ou seja, viola FR-016/FR-018/FR-019 na superfície onde a
   informação já aparece.

### Decisão

**Rota nova, enxuta, em `src/api/routes/logs.js`:**

```
GET /logs/credential-block   (autenticada)
```

Uma consulta indexada (`userId`, `status: 'skipped'`, `sentAt >= agora - 7d`,
`errorMsg startsWith 'skip:no_valid_conversions'`), agregada por `platform`, cruzada com
`db.credential.findMany({ where: { userId }, select: { platform: true } })` para separar os
dois casos de FR-020:

| Situação | Existe linha em `Credential`? | Quem avisa |
|---|---|---|
| Nunca cadastrou | não | **este aviso** (novo) |
| Cadastrou e o código venceu / chave recusada | sim | aviso que já existe (`src/credentialExpiry/`) — o novo **cala a boca** |

**Texto em módulo puro novo, `src/credentialBlockAlert/message.js`**, espelhando o desenho de
`src/credentialExpiry/message.js` — que é onde a inversão da Shopee já está resolvida e
comentada. Duas famílias **estruturalmente separadas** (constantes distintas, nunca um
template com variável de consequência):

- `mercadolivre` / `amazon` → "as ofertas continuam saindo, só com link mais comprido";
- `shopee` → "as ofertas da Shopee param de sair".

Vocabulário reusado de `src/credentialHealth.js` (`friendlyFieldName`,
`describeMissingCredentials`): "etiqueta de afiliada", "código de acesso"; na Shopee, "chave".
Nada de "cookie", "SSID", "tag" (FR-017).

### Custo de operação — a razão de ser rota separada

`ActivationChecklist` faz **poll de `/dashboard/status` a cada 10 s**. Pendurar a agregação ali
multiplicaria a consulta por 6/min por cliente aberta no painel. A rota nova é chamada **no
mount e no `focus` da janela, sem intervalo** — e por isso **não precisa de cache**, o que
evita criar um segundo `Map` sem despejo (o `summaryCache` de `logs.js` já é um `Map` sem
eviction; replicar o padrão adicionaria vazamento, ainda que pequeno). Zero memória nova.

### Onde aparece

| Ponto | Como |
|---|---|
| Tela inicial do painel | `ActivationChecklist` (já renderizado lá) |
| Checklist de configuração | mesmo componente |
| Histórico de envios | `explainErrorMsg` reescrito para nomear a loja e o próximo passo |

Link direto para `/painel/ids-afiliada` (FR-016). O aviso some sozinho quando a credencial é
cadastrada (FR-021), porque a rota deixa de reportar aquela loja.

**Confirma a Assumption "onde o aviso aparece"** — com a economia de que dois dos três pontos
saem de um componente só.

---

## R4 — Ordem de execução e dependências

```
P1 (clique)  ──┐
P2 (indexação) ┼──> P3 (ativação)  ──> P4 (autoridade) ──> P5 (comparação) ──> P6 (Tier 1)
               │                                              ▲                    ▲
               └──────────── bloqueia ─────────────────────────┴────────────────────┘
```

- **P2 bloqueia P5 e P6** (FR-014): publicar página nova com o rastreamento racionado é jogar
  trabalho fora. O plano trata isso como portão explícito, não como recomendação.
- **P4 não é bloqueado por P2** — reforça `/bot-afiliados-whatsapp`, que já existe (FR-024).
  Fica depois de P3 só por ordem de valor.
- **P3 é independente de tudo** (não toca SEO). Poderia ir primeiro; fica em P3 porque P1 e P2
  são mais baratos e P2 destrava o resto.
- **P1 antes de P2 por dentro do mesmo arquivo**: os dois mexem em `seo-registry.mjs`. Fazer
  P1 primeiro (títulos) e P2 depois (campo `indexable` + helper) evita conflito no mesmo bloco.

---

## R5 — Política de memória

Levantamento honesto do que esta entrega acrescenta em execução:

| Item | Custo de memória |
|---|---|
| Reescrita de títulos/descrições | zero (texto em arquivo já carregado) |
| `buildSeoRobots()` + campo `indexable` | zero (função pura, build-time) |
| Páginas novas (1 comparação + 1 guia) | zero em RAM de processo (Next estático) |
| `GET /logs/credential-block` | **zero permanente** — uma consulta indexada por chamada, sem cache, sem estrutura em memória |
| Módulo puro `credentialBlockAlert/message.js` | desprezível (constantes de texto) |
| Guards e testes novos | só CI |

**Nenhum processo PM2 novo, nenhuma dependência nova, nenhum cache em memória, nenhuma
mudança de concorrência.** A Assumption da spec se confirma.

> **Gatilho de aviso prévio (regra #1 da política de memória do `AGENTS.md`).** Se durante a
> execução alguma das opções abaixo for cogitada, ela **para** e vai para a usuária com
> estimativa antes de qualquer linha de código:
> - pendurar a agregação no poll de 10 s do `/dashboard/status`;
> - criar cache em memória para o aviso (segundo `Map` sem despejo);
> - qualquer dependência nova no `dashboard/` para gerar metadata;
> - qualquer processo/worker novo para varrer `MessageLog`.
>
> Em todos os casos a alternativa mais leve já escolhida acima é a recomendação a manter.

---

## R6 — Portões de qualidade e guardas novos

### O que já existe e precisa continuar verde

| Comando | Onde | Risco desta feature |
|---|---|---|
| `npm run guard:config-page` | `dashboard/` | baixo |
| `npm run validate:seo-consistency` | `dashboard/` | ganha checagem nova (R1) |
| `npm run lint:seo-metadata` | `dashboard/` | ganha parser novo + checagem de divergência (R2) |
| `npm run guard:seo-registry` | `dashboard/` | **quebra** se não for ajustado antes de P2 (R1) |
| `npm run validate:editorial-freshness` | `dashboard/` | exige `EDITORIAL_DATES` para toda rota de conteúdo nova |
| `npm run validate:schema-templates` | `dashboard/` | exige `schemaTypes` coerente nas rotas novas |
| `npm test` | raiz | todos os guards novos entram aqui |

### Guardas novos (FR-041), um por regra que regride em silêncio

| Arquivo | Regra protegida | FR |
|---|---|---|
| `test/inbound-titulos-clique.test.js` | 11 títulos ≤ 55 (+ sufixo medido), descrição ≤ 160, motivo no começo, achadinhos intocado, sem duplicidade | FR-002..FR-007, SC-001 |
| `test/seo-noindex-guard.test.js` | toda rota `indexable:false` emite `robots` no HTML; nenhuma sumiu do build; título/descrição em um lugar só | FR-008..FR-011, SC-005 |
| `test/painel-aviso-credencial.test.js` | vocabulário leigo; **Shopee diz "param de sair"**; ML/Amazon dizem "continuam saindo"; textos não se fundem; some quando cadastra | FR-017..FR-021, SC-009 |
| `test/marketing-limites-que-nao-se-cruzam.test.js` | varre o texto publicado: zero promessa de não-banimento; todo preço de concorrente com fonte+data; todo comparativo com "onde o concorrente é melhor"; nenhuma frente congelada reaberta | FR-029..FR-034, SC-013 |

**Como o guard de preço fica objetivo:** `dashboard/lib/competitors-data.js` já exige
`verifiedAt` e `source` por concorrente (Achadinho Pro: verificado em 31/07/2026, com fonte
registrada). O teste casa todo padrão de preço (`R$ \d`) no texto das páginas de comparação
contra um concorrente com `verifiedAt`+`source` — preço solto no texto reprova.

**Como o guard de banimento fica objetivo:** lista de padrões proibidos
(`não será banido`, `sem risco de ban`, `100% seguro`, `anti-ban garantido`, `nunca bane`…)
varrida sobre o texto publicado. Entrar pela palavra "banido" continua permitido — é a
promessa que reprova, exatamente como diz FR-029.

---

## R7 — `/promo-vip-7dias`: conclusão de FR-013 (já resolvida na leitura)

- **Qual é a página**: `/promo-vip-7dias`.
- **O bloqueio é intencional?** **Sim, e em duas camadas coerentes.**
  `dashboard/public/robots.txt` traz `Disallow: /promo-vip-7dias`, e
  `dashboard/app/promo-vip-7dias/layout.js` declara `robots: { index: false, follow: false }`.
  É uma landing promocional temporária de cupom VIP, que não deve ranquear.
  `guard-seo-registry-coverage.mjs` já a lista em `privatePrefixes`, e
  `validate-seo-consistency.mjs` não acusa conflito porque ela não é rota indexável.
- **O que fazer**: **nada além de registrar**. As três pontas já concordam entre si. É, aliás,
  o único `noindex` real do site hoje e serve de referência do formato do sinal.
- Único detalhe a anotar: ela usa `follow: false`, enquanto FR-009 pede `follow: true` para as
  páginas que saírem do índice agora. São casos diferentes — a promo não tem links internos que
  interesse circular; as páginas de grade têm. `buildSeoRobots()` devolve `follow: true`, e a
  promo **fica como está** (não é rota do registry).

---

## R8 — Escolha da página de comparação (Assumption confirmada)

**Achadinho Pro** se confirma, e por um motivo mais forte do que a spec supunha: os dados dele
**já estão coletados com fonte e data** em `dashboard/lib/competitors-data.js`
(`slug: 'achadinho-pro'`, dois planos com preço, `verifiedAt: '2026-07-31'`, `source:` print da
página de preços). Ou seja, a página nasce satisfazendo FR-031 sem depender de coleta nova —
o que não é verdade para Afilira, IA Divulgadora, Shark Pomo Bot, Lumi e Gigi Bot.

Some-se a evidência de demanda já registrada no `AGENTS.md` (443 impressões em
`achadinhoosbot`/`achadinhosbot`/`achadinhos bot`) e a página irmã `/alternativas/achadinhos-bot`
já existente, que dá o par recíproco de links.

Estrutura a seguir: a mesma de `/alternativas/proafiliados` em
`dashboard/app/_comparisonContent.js` — `tldr`, `directAnswer`, `rows`, `criteria`,
`botinhoDifferentials`, **`bestFit`** (é este campo que atende FR-032) e `notIdealFit`.

---

## R9 — Critério de triagem para sair do índice — **REVISA A SPEC**

A Assumption da spec ("gerada por modelo, sem intenção própria, **zero impressão nos últimos
três meses**") tem um furo operacional: o dado de impressão por página vive no Search Console,
fora do repositório. Um critério que nenhum teste consegue verificar não é auditável e não pode
virar guard.

**Critério ajustado, em duas partes:**

1. **Parte medível no repositório (vira guard):** a rota é `template: 'programmatic-lp'`
   (grade gerada por modelo) **e** não tem conteúdo exclusivo declarado — nenhum bloco próprio
   em `_lpShared.js` além do que o modelo gera a partir do slug.
2. **Parte medível fora (vira registro escrito, não guard):** zero impressão em 3 meses no
   Search Console, anotado por página no documento de triagem, com a data da consulta.

A decisão final por página é registrada em `specs/013-inbound-leads-strategy/triagem-indexacao.md`
(exigido por FR-012), com as duas evidências lado a lado. Páginas com qualquer impressão ou
intenção própria são **engordadas, não retiradas** — conforme o edge case da spec, e nenhuma é
apagada (FR-010/FR-034).
