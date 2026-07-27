# Submissão do sitemap — Google Search Console e Bing Webmaster Tools

**Feature relacionada**: `specs/010-seo-lead-capture` (US4, FR-009).

Este é um passo **operacional/manual**, não código. O sitemap (`https://espelhagrupos.com.br/sitemap.xml`)
já é gerado automaticamente por `dashboard/app/sitemap.js`, derivado 100% de
`dashboard/lib/seo-registry.mjs` (`getIndexableSeoRoutes()`) — nenhuma submissão manual de
URL individual é necessária; basta garantir que os dois motores de busca conhecem o sitemap.

## Google Search Console

1. Acesse https://search.google.com/search-console.
2. Se a propriedade `espelhagrupos.com.br` ainda não estiver verificada:
   - Escolha o tipo de propriedade **Domínio** (cobre `http`/`https`/`www`/sem `www`) ou
     **Prefixo de URL** (`https://espelhagrupos.com.br`).
   - Siga o método de verificação sugerido (registro DNS `TXT` para propriedade de domínio, ou
     upload de arquivo HTML / meta tag / Google Analytics para prefixo de URL).
3. Com a propriedade verificada, vá em **Sitemaps** (menu lateral).
4. Em "Adicionar um novo sitemap", informe `sitemap.xml` (relativo à propriedade) e clique em
   **Enviar**.
5. Confira o status em alguns minutos/horas: deve aparecer "Êxito" com a contagem de URLs
   descobertas batendo com `getIndexableSeoRoutes()` (rodar
   `node -e "import('./dashboard/lib/seo-registry.mjs').then(m => console.log(m.getIndexableSeoRoutes().length))"`
   para conferir o número esperado).
6. Onde conferir indexação: **Cobertura** (ou "Páginas", nas versões mais novas) mostra
   quantas URLs do sitemap foram indexadas vs. excluídas, com o motivo de cada exclusão.

## Bing Webmaster Tools

1. Acesse https://www.bing.com/webmasters.
2. Adicione o site `https://espelhagrupos.com.br` (Bing aceita importar a verificação já feita
   no Google Search Console via "Importar do Google Search Console", o que evita reverificar
   DNS/meta tag do zero).
3. Vá em **Sitemaps** (menu lateral) → **Enviar sitemap** → informe
   `https://espelhagrupos.com.br/sitemap.xml`.
4. Onde conferir indexação: **Relatórios e Dados** → **Explorador de URL de páginas enviadas**
   ou o painel de **Sitemaps** mostra quantas URLs foram descobertas/indexadas.

## Quando repetir este passo

- Não é necessário reenviar a cada deploy — os dois motores rastreiam o sitemap
  periodicamente sozinhos assim que ele foi submetido uma vez.
- Reenviar (ou ao menos revisitar o painel) faz sentido após uma leva grande de páginas novas
  (como as desta feature) para acelerar a descoberta, ou se o número de URLs indexadas cair
  inesperadamente.

## Checklist rápido de validação (SC-002/FR-008/FR-009)

- [ ] Propriedade verificada no Google Search Console.
- [ ] Sitemap `sitemap.xml` submetido no Google Search Console.
- [ ] Propriedade verificada no Bing Webmaster Tools.
- [ ] Sitemap `sitemap.xml` submetido no Bing Webmaster Tools.
- [ ] Contagem de URLs no sitemap bate com `getIndexableSeoRoutes().length` no momento da
      submissão (incluindo as 6 páginas de blog novas + `/cadastro` + `/parcerias` desta
      feature).
