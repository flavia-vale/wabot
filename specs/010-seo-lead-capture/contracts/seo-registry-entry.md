# Contract — SEO Registry Entry & Sitemap/Robots (US1, US4)

Interface interna: o registro de rotas indexáveis que alimenta sitemap, guards e lint.

## Fonte de verdade

`dashboard/lib/seo-registry.mjs` → `getIndexableSeoRoutes()` (consumido por
`app/sitemap.js`, `scripts/guard-seo-registry-coverage.mjs`,
`scripts/lint-seo-metadata-duplicates.mjs`).

## Novas entradas exigidas (FR-001)

```
{ path: '/cadastro',  title: <título único>, template: 'signup',       priority: <n>, changeFrequency: <freq>, lastModified: <iso>, indexable: true }
{ path: '/parcerias', title: <título único>, template: 'partnerships', priority: <n>, changeFrequency: <freq>, lastModified: <iso>, indexable: true }
```

(`title` opcional no shape do registro, mas recomendado para participar do lint; deve ser
único entre rotas indexáveis.)

## Mudança em entrada existente (FR-002)

`/conteudos`: definir um `title` explícito de **hub de conteúdo**, distinto do título do
artigo `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`.

## Contrato de comportamento (aceitação executável — FR-003)

- `npm run guard:seo-registry` (de `dashboard/`) → exit 0, sem listar `/cadastro` nem
  `/parcerias`.
- `npm run lint:seo-metadata` (de `dashboard/`) → exit 0, **sem** o par duplicado
  `/conteudos` × `/blog/comecar-afiliado-whatsapp-sem-grupo-grande`.
- `npm run validate:seo-p0` → verde (roda os dois acima).

## Sitemap / Robots (FR-008)

- `app/sitemap.js` gera a partir de `getIndexableSeoRoutes()` → as URLs `/cadastro`,
  `/parcerias` e as 6 páginas de blog aparecem automaticamente após o registro.
- `app/robots.js` deve continuar permitindo essas rotas (allow `/`; disallow apenas
  `/painel*`, `/api/admin/*`, `/api/auth/*`, `/api/dashboard/*`, `/api/payments/*`,
  `/promo-vip-7dias`). Nenhuma rota indexável nova pode cair no `disallow`.

## Invariantes (não regredir)

- Não alterar a lógica dos scripts guard/lint (são o critério objetivo).
- Não adicionar URL direto no `sitemap.js` (fonte única = registro).
