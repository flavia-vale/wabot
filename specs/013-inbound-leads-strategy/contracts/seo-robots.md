# Contrato — sinal de não indexar derivado do registro

## Superfície nova em `dashboard/lib/seo-registry.mjs`

```js
/** Entrada do registro por caminho — indexável OU não. */
export function getSeoRoute(path) -> SeoRoute | null

/** Metadata `robots` do Next derivada do registro.
 *  Devolve undefined quando a rota é indexável (herda o default do site). */
export function buildSeoRobots(path) -> { index: false, follow: true } | undefined

/** Todas as rotas, sem filtro de indexação. Base da cobertura. */
export function getAllSeoRoutes() -> SeoRoute[]
```

`follow: true` é obrigatório (FR-009): a página sai do índice mas continua fazendo circular o
link interno. **Não copiar o `follow: false` de `/promo-vip-7dias`** — aquele é caso diferente
(landing promocional sem links internos de interesse) e permanece como está.

## Onde é consumido (chokepoints)

| Arquivo | Função |
|---|---|
| `dashboard/app/_lpShared.js` | `getLpMetadata()` — cobre as 36 páginas de grade da rota dinâmica `app/[slug]/page.js` |
| `dashboard/app/_seoHubShared.js` | `getSeoHubMetadata()` |
| `dashboard/app/_preservationCommercialPages.js` | `getPreservationCommercialMetadata()` |
| `dashboard/app/_comparisonContent.js` | construtor de metadata das rotas `/alternativas/*` |
| páginas com metadata literal | chamam `buildSeoRobots(path)` direto |

Forma de uso (não emitir `index: true` explícito em rota indexável):

```js
const robots = buildSeoRobots(path)
return { title, description, ...(robots ? { robots } : {}) }
```

**Por que não `layout.js` por página:** as 15 cidades + 11 nichos + 10 dores compartilham uma
única rota dinâmica — não existe arquivo por página onde pendurar o layout. O chokepoint no
construtor de metadata é o único ponto que alcança as três grades.

## Ajuste obrigatório e anterior a qualquer marcação

`dashboard/scripts/guard-seo-registry-coverage.mjs` compara as rotas do sistema de arquivos com
`getIndexableSeoRoutes()`. **A primeira rota marcada `indexable: false` reprova esse guard**
("rota pública sem entrada no seo-registry"). Trocar a base para `getAllSeoRoutes()`:
cobertura = estar no registro; indexação = decisão separada. Esse ajuste vem **antes** de
marcar qualquer página.

## Checagem nova em `dashboard/scripts/validate-seo-consistency.mjs`

Para cada rota com `indexable === false`, o arquivo que gera a metadata daquela rota precisa
referenciar `buildSeoRobots` (ou declarar `robots: { index: false` diretamente). Análise
estática de fonte, sem build — mesmo estilo dos validadores existentes.

Mensagem de falha:
```
ERRO: /rota está marcada como não indexável mas nenhuma metadata emite `robots`.
      O sinal só sairia do sitemap — a página continuaria sendo indexada.
```

## Checagem nova em `dashboard/scripts/lint-seo-metadata-duplicates.mjs`

1. Parser estendido para `_preservationCommercialPages.js` e `_comparisonContent.js` (hoje só
   entende `_lpShared.js`).
2. Regra nova de fonte única (FR-001): **se um mesmo `path` tiver `title` no registry e no
   módulo de conteúdo, reprova.** Foi exatamente essa divergência silenciosa que deixou o
   registry com o título antigo de `/bot-achadinhos-whatsapp` (66 chars) enquanto o ar servia
   o novo (56).

## Invariantes

| Regra | FR |
|---|---|
| `indexable: false` ⇒ fora do sitemap, fora do IndexNow **e** `robots` no HTML | FR-008, FR-011 |
| `follow: true` sempre | FR-009 |
| nenhuma rota some de `generateStaticParams()` nem do build | FR-010, SC-007 |
| título/descrição de um `path` moram em um lugar só | FR-001 |
