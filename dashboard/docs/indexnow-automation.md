# IndexNow — submissão automática de URLs (Bing, Yandex, DuckDuckGo, Naver)

Automatiza o "avisar os buscadores que temos páginas novas" para os motores que
suportam o protocolo **IndexNow**. Um único `POST` com a lista de URLs
indexáveis, derivada de `lib/seo-registry.mjs` (`getIndexableSeoRoutes()`).

## O que cobre (e o que não cobre)

| Destino | Coberto? | Como |
|---|---|---|
| **Bing** | ✅ | IndexNow nativo. |
| **Yandex / DuckDuckGo / Naver** | ✅ | Compartilham o mesmo endpoint IndexNow. |
| **IAs (ChatGPT, Copilot, Perplexity)** | ↪️ indireto | ChatGPT/Copilot puxam o índice do **Bing** — submeter ao IndexNow acelera a descoberta por essas IAs. Não há API de submissão direta para IAs. |
| **Google** | ❌ | Google **não usa IndexNow**. Para o Google: sitemap + rastreamento natural — ver [`../../docs/deploy/seo-search-console-submission.md`](../../docs/deploy/seo-search-console-submission.md). A Indexing API do Google é restrita a `JobPosting`/`BroadcastEvent`; usá-la para páginas comuns viola os termos. |

## Como funciona

1. A chave do IndexNow é um arquivo público: `public/<KEY>.txt` (conteúdo = a
   própria chave), servido em `https://espelhagrupos.com.br/<KEY>.txt`. É esse
   arquivo que prova a posse do domínio — **não é segredo**.
2. O script `scripts/indexnow-submit.mjs` monta o payload
   (`{ host, key, keyLocation, urlList }`) e faz `POST` para
   `https://api.indexnow.org/indexnow`.
3. Chave atual: `fa4326c71e4b5b768c893e56db7e045d` (default no script + arquivo
   em `public/`). Rotação: gere outra, troque o arquivo `public/<KEY>.txt` e
   defina `INDEXNOW_KEY` (ou atualize o default).

## Uso

```bash
cd dashboard
npm run indexnow:submit -- --dry-run   # só imprime o payload, não envia
npm run indexnow:submit                # submete de verdade
```

Sobrescrever a chave sem mexer no código:

```bash
INDEXNOW_KEY=<outra-chave> npm run indexnow:submit
```

## Quando rodar

- **Sob demanda**, após uma leva de páginas novas (como a deste ciclo de SEO).
- Opcionalmente, **1× por deploy** de produção. Para automatizar no deploy, basta
  acrescentar um passo `npm run indexnow:submit` ao final do workflow **de
  produção** (`main`) — de propósito **fora** deste PR, porque alterar o fluxo de
  deploy pede validação à parte (regra canônica do `AGENTS.md`). Enquanto isso não
  é feito, rodar o comando manualmente já resolve.
- **Não** precisa rodar a cada request nem manter processo no ar: é one-off.

## Custo (política de memória do repo)

Processo pontual: um `POST` HTTP e sai. **Não** cria processo PM2/worker, **não**
usa Redis/BullMQ, **não** mantém cache em memória nem eleva heap. `fetch` é nativo
(Node ≥ 18), **sem dependência nova**.

## Pré-requisito para funcionar em produção

O arquivo `public/<KEY>.txt` precisa estar acessível em
`https://espelhagrupos.com.br/<KEY>.txt` (é servido automaticamente pelo Next a
partir de `public/`). Sem isso o IndexNow responde `403 key not found`. Como o
sitemap e o próprio site só existem em produção, a submissão real deve ser feita
**depois** do merge em `main` e do deploy — em staging serve só para validar o
`--dry-run`.
