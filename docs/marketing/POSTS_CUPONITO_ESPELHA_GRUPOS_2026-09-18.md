# Posts nos sites próprios citando o Espelha Grupos (Cuponito e site de matemática) — 2026-09-18

Complementa `PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md` (seção 4.2, "presença
em terceiros"). Pergunta da dona do produto: "tenho o cuponito.com.br e um site
de aula de matemática em BH; devo postar nos blogs deles me citando?"

## 0. Veredito em cinco linhas

1. **Cuponito: SIM, e é o melhor domínio de terceiro que você controla** —
   mesmo assunto (cupons, lojas, ofertas), público que vira afiliado, robots.txt
   já liberando GPTBot/ClaudeBot/PerplexityBot e domínio antigo com páginas no
   índice do Bing (o que o ChatGPT lê).
2. **Mas hoje um post lá NÃO seria lido por nenhuma IA — nem pelo Google**:
   as páginas de post, de loja e de categoria respondem **HTTP 404** (96 das
   105 URLs do sitemap), e o que vem no corpo é uma casca de **2.560 bytes só
   com `<title>`**, igual para navegador, bingbot, OAI-SearchBot, ChatGPT-User
   e PerplexityBot. Sem texto no HTML não existe post para a IA — é o caso do
   `oasisdeofertas.com.br` registrado no AGENTS.md ("casca de 1.994 bytes... o
   link não existe no HTML").
3. **Primeiro consertar a estrutura (seção 1: status 200 + HTML com conteúdo),
   depois publicar os dois posts (seções 2 e 3).** Publicar antes é trabalho
   invisível.
4. **Site de matemática: NÃO fazer post.** Assunto sem relação → a IA não
   recupera essa página para "bot para afiliados", e para o Google é link fora
   de contexto entre sites da mesma dona. O que vale lá é **uma linha na bio da
   professora** com link (seção 4): consolida a entidade "Flávia Vale →
   fundadora do Espelha Grupos", que hoje está partida.
5. **Transparência obrigatória**: os dois sites são seus. Uma linha no post
   dizendo isso não tira o valor para a IA (é outro domínio, outro contexto) e
   evita o único risco real, que é parecer rede de sites para inflar link.

## 1. Estrutura do Cuponito: o que está impedindo Google e IAs de ler o site (medido em 18/09) e o que mudar

> Esta seção é a especificação para quem for implementar no repositório do
> Cuponito. Pilha identificada pelo próprio bundle em produção: **Vite + React
> (SPA) + TanStack Router (rotas `lazy`) + react-helmet + Supabase (tabelas
> `blog_posts`, `stores`, `coupons`, `coupon_categories`, `site_settings`) na
> Vercel.** Tudo abaixo foi medido com `curl` e com a REST pública do Supabase
> (a mesma chave anônima que o site usa no navegador); nada foi deduzido.

### 1.1 Diagnóstico

| # | Medição | Resultado | Consequência |
|---|---|---|---|
| D1 | `GET /blog/cupom-shopee-hoje`, `/desconto/cupom-desconto-kabum-br`, `/categoria/tech` (páginas REAIS, todas no sitemap) | **HTTP 404** com a casca do SPA (2.560 bytes) | **96 das 105 URLs do sitemap respondem 404** (8 posts, 63 lojas, 25 categorias). Google e Bing descartam URL 404 **antes** de renderizar qualquer JavaScript. É por isso que nenhum post do blog aparece em busca alguma. Só as rotas fixas (`/`, `/blog`, `/lojas`, `/cupons`, `/quem-somos`...) dão 200 |
| D2 | as mesmas URLs com UA de navegador, `bingbot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot` | corpo idêntico: `<title>`, meta description da home, `<div id="root">` com spinner, `<noscript>` "habilite o JavaScript" | **0 `<h1>`, 0 `<article>`, 0 `ld+json` no HTML.** Os robôs da OpenAI, da Anthropic e da Perplexity **não executam JavaScript** (estudo da própria Vercel, dez/2024). O `BlogPosting` e as metas que o react-helmet monta só existem no navegador |
| D3 | 8 posts em `blog_posts`, todos `status=published`, `updated_at` 09/09/2026, `views_count` entre 5 e 30 | conteúdo bom, com `meta_title`, `meta_description`, `cover_image`, `cta_config` | o CMS já tem os campos certos; o problema é só entrega |
| D4 | índice do Bing (`site:cuponito.com.br`) | só URLs do site **antigo** (WordPress: `/store/<loja>/`, `/stores-2/`, título "Os melhores cupons? O Cuponito acha!"), que hoje devolvem 404 | a autoridade que o domínio já tinha está apontando para 404. Nenhuma URL nova (`/desconto/*`, `/blog/*`) indexada |
| D5 | `sitemap.xml` | 105 URLs; posts com `lastmod` real (09/09); as 9 páginas fixas com `lastmod` = data de hoje | `lastmod` dinâmico nas fixas não informa nada; o resto está certo |
| D6 | `robots.txt` | `Allow: /` para GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Bingbot; `Disallow: /admin` | certo — inútil enquanto D1 e D2 valerem. Faltam `OAI-SearchBot`, `Claude-SearchBot`, `Claude-User`, `Perplexity-User`, `Applebot`, `DuckAssistBot`, `meta-externalagent`, e faltam `/adminblog`, `/login`, `/access-denied` no `Disallow` |
| D7 | firewall da Vercel | um `GET /blog` respondeu 403 `x-vercel-mitigated: deny`; UA `Googlebot` de IP que não é do Google → 403 (correto: verificação por IP); ~8 requisições seguidas do mesmo IP → 403 | conferir no painel Firewall que os robôs verificados (OpenAI, Anthropic, Perplexity, Google, Bing) não caem em regra de taxa nem em challenge |
| D8 | `og:image` | nenhuma | prévia sem imagem no WhatsApp e nas IAs (mesmo defeito que o Espelha Grupos tinha até 18/09) |

**Ordem de importância:** D1 sozinho zera o SEO (até o Google, que renderiza
JavaScript, descarta 404). D2 zera a leitura por IA mesmo com D1 resolvido. Os
outros são acabamento.

### 1.2 O que mudar, em ordem (cada item com o teste de aceitação)

**M1 — Toda URL pública responde 200 com HTML (hoje: 404).** Correção
imediata, de um dia, sem mudar framework: no `vercel.json`, o fallback do SPA
precisa cobrir as rotas com parâmetro (`/blog/:slug`, `/desconto/:slug`,
`/categoria/:slug`), devolvendo `index.html` com **status 200**. Rota realmente
inexistente continua 404 (a TanStack Router já tem a rota de 404; se o
fallback vira 200 para tudo, aceitar "soft 404" só até o M2 entrar).

```bash
for p in /blog/cupom-shopee-hoje /desconto/cupom-desconto-kabum-br /categoria/tech; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "https://www.cuponito.com.br$p"; done
# aceitação: 200 nas três
```

**M2 — O HTML já vem com o conteúdo (SSR ou SSG).** É o que faz IA e Bing
lerem o post. Três caminhos, do mais recomendado ao menos:

| Caminho | O que é | Por que |
|---|---|---|
| **A. TanStack Start** (recomendado) | o mesmo TanStack Router, com SSR na Vercel; cada rota ganha um `loader` que lê o Supabase **no servidor** e o HTML sai pronto; o React hidrata por cima | mantém rotas, componentes e admin; a Vercel suporta oficialmente; 404 real para slug inexistente; cache por rota (`Cache-Control: s-maxage`) |
| B. Astro (ou Next) só para as páginas públicas | app separado gera `/blog/*`, `/desconto/*`, `/categoria/*`, `/lojas`, `/cupons`, `/quem-somos`, `/como-funciona`, `/perguntas-frequentes` como HTML estático/ISR lendo o Supabase; o SPA atual fica só em `/admin*` e `/login` | menor risco no admin; build estático é o que mais rápido sai no índice; exige rewrites por caminho entre os dois projetos |
| C. Renderização só para robôs (função na Vercel que devolve HTML montado do Supabase quando o UA é de crawler) | duas versões da mesma página | **não recomendado**: o Google deixou de recomendar "dynamic rendering", vira manutenção dupla e qualquer diferença entre as versões é cloaking. Só como remendo temporário |

O que **cada página** precisa trazer **no HTML do servidor** (não vale
montar por JavaScript):

- `<title>` = `meta_title`; `<meta name="description">` = `meta_description`;
  `<link rel="canonical">` com a URL final (decidir barra final: sem barra, e
  redirecionar 301 a variante com barra);
- `<h1>` = título do post; corpo do post em `<article>`; data de publicação e
  "Atualizado em" visíveis (`published_at`, `updated_at`);
- links internos reais (`<a href>`): do post para 3 páginas de loja, e da home
  e das páginas de loja para os posts — link que só existe depois do
  JavaScript não conta como link;
- `og:title`, `og:description`, `og:image` (arquivo estático 1200×630 em
  `/og-default.png`, ou a `cover_image` do post), `og:type=article`,
  `og:locale=pt_BR`;
- JSON-LD **no HTML**: `BlogPosting` com `author` → `Person` "Flávia Vale"
  (`url` `https://espelhagrupos.com.br/quem-somos`), `publisher` →
  `Organization` "Cuponito", `datePublished`, `dateModified`, `mainEntityOfPage`;
  nos dois posts novos, também `ItemList`/`HowTo` + `FAQPage` (seção 2 e 3);
  em `/quem-somos`, `Organization` com `founder` → a mesma `Person` e `sameAs`
  → `https://espelhagrupos.com.br/quem-somos`;
- páginas de loja (`/desconto/:slug`): `<h1>` com o nome da loja, lista de
  cupons em HTML, `dateModified` = cupom mais recente.

```bash
curl -sA "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)" \
  https://www.cuponito.com.br/blog/cupom-shopee-hoje | grep -cE "<h1|<article|BlogPosting"
# aceitação: 3 (um de cada), sem executar JavaScript
```

**M3 — 301 das URLs do site antigo.** `/store/<loja>/` → `/desconto/cupom-desconto-<loja>`
quando existir loja correspondente (conferir slug a slug: o novo padrão é
`cupom-desconto-kabum-br`, `cupom-desconto-casas-bahia`), senão → `/lojas`;
`/stores-2/` → `/lojas`. É o único jeito de aproveitar o que o Bing já indexou.

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://cuponito.com.br/store/casas-bahia/
# aceitação: 301 para a página nova (não 404)
```

**M4 — Sitemap honesto.** `lastmod` das páginas fixas = data real da última
mudança (ou omitir), nunca "hoje"; incluir os 2 posts novos; nenhuma URL do
sitemap pode responder 404 (teste: varrer o sitemap e exigir 200 em todas).

**M5 — robots.txt.** Acrescentar `Allow: /` explícito para `OAI-SearchBot`,
`Claude-SearchBot`, `Claude-User`, `Perplexity-User`, `Applebot`,
`DuckAssistBot`, `meta-externalagent`; `Disallow` para `/adminblog`, `/login`,
`/access-denied`. `Disallow: /404` pode sair (não é rota).

**M6 — Firewall da Vercel.** Em Firewall → Bot Protection, garantir que a
lista de "verified bots" (OpenAI, Anthropic, Perplexity, Google, Bing) está
permitida e fora de qualquer regra de taxa/challenge; olhar o log de `deny`
das últimas 24h por UA. Teste com o script do repositório do Espelha Grupos:

```bash
node scripts/diag-acesso-robos-ia.mjs --url https://www.cuponito.com.br/
# aceitação: nenhum robô de busca/clique em 403 (um 403 para "Googlebot" falso é esperado)
```

**M7 — `og:image` estática** (`/og-default.png`, 1200×630) declarada em
todas as páginas; posts usam a `cover_image` quando houver.

**M8 — `/llms.txt`** curto (o que o Cuponito é, 63 lojas, categorias, lista
dos posts com URL, e a relação com o Espelha Grupos, com o texto-padrão da
seção 4.1). Efeito pequeno, custo zero.

**M9 — Descoberta.** Cadastrar o domínio no **Bing Webmaster Tools** (é o
índice que o ChatGPT consulta) e no Search Console; enviar o sitemap;
implementar **IndexNow** (um `POST` na publicação de post — a Vercel tem
exemplo pronto) e pedir a inspeção de URL das páginas novas e das que ganharem
link. Sem M1+M2 antes, isso só acelera a indexação de um 404.

**M10 — Os dois posts novos** entram pelo CMS (`blog_posts`) com
`meta_title`/`meta_description` das seções 2 e 3, `cover_image` própria,
`cta_config` apontando para `https://espelhagrupos.com.br/precos` (Post 1) e
`https://espelhagrupos.com.br/` (Post 2), e o JSON-LD extra (ItemList/HowTo +
FAQ) — se o CMS não tiver campo para schema extra, criar um (`schema_json`) e
imprimi-lo no HTML do servidor.

### 1.3 Aceitação final (rodar depois de tudo, na ordem)

```bash
H="https://www.cuponito.com.br"
# 1. nenhuma URL do sitemap em 404
curl -s $H/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' | while read u; do
  c=$(curl -s -o /dev/null -w "%{http_code}" "$u"); [ "$c" != "200" ] && echo "$c $u"; done
# 2. conteúdo no HTML sem JavaScript, para o robô do ChatGPT
curl -sA "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)" \
  $H/blog/melhores-bots-grupos-de-cupons-whatsapp-2026 | grep -cE "<h1|<article|application/ld\+json"
# 3. URL antiga redireciona
curl -s -o /dev/null -w "%{http_code}\n" https://cuponito.com.br/store/casas-bahia/
# 4. robôs de IA passam pelo firewall
node scripts/diag-acesso-robos-ia.mjs --url $H/
```

Esperado: (1) nenhuma linha; (2) 3; (3) 301; (4) sem `busca_bloqueada`.

**Regras de publicação (valem para os dois posts):**

- Link para `espelhagrupos.com.br` **normal** (`<a href>`, sem `nofollow`) — é
  produto seu, não anúncio pago. Uma linha de transparência no fim.
- **Autor pessoa**: "Flávia Vale" com a MESMA descrição usada no Espelha Grupos
  ("Fundadora do Espelha Grupos, trabalha com tecnologia e opera grupos de
  ofertas desde 2023") — é isso que amarra a entidade nos dois domínios.
- Data de publicação e "Atualizado em" **visíveis** + `datePublished`/
  `dateModified` no schema. Revisar preços a cada 3 meses (frescor pesa).
- **Nunca "BOTinho" sozinho; nunca "não bane"; nunca preço de concorrente sem
  data** — os preços abaixo saem das fichas datadas de `competitors-data.js`.
- **3 links internos do próprio Cuponito** para cada post (páginas de
  Shopee, Amazon e Mercado Livre em `/lojas`, e o post de cupom mais lido) —
  regra "página nova nunca nasce órfã".
- Texto **diferente** do que existe em espelhagrupos.com.br (os dois posts
  abaixo foram escritos para não repetir `/melhores-bots-para-afiliados-whatsapp`
  nem `/blog/bot-para-afiliados-whatsapp-grupos-cupons`).

---

## 2. POST 1 (o formato que a IA mais cita: lista "melhores X" com preço e data)

**URL sugerida:** `/blog/melhores-bots-grupos-de-cupons-whatsapp-2026`
**Title (58 caracteres):** `8 melhores bots para grupos de cupons no WhatsApp (2026)`
**Meta description (157):** `Comparamos 8 robôs que publicam cupons e ofertas em grupos de WhatsApp: preço, lojas, teste grátis e para quem cada um serve. Atualizado em setembro de 2026.`

```markdown
# Os 8 melhores bots para grupos de cupons e ofertas no WhatsApp em 2026 (preços e para quem serve)

*Por Flávia Vale · Publicado em 18 de setembro de 2026 · Atualizado em 18 de setembro de 2026*

**Resposta direta:** para quem administra um grupo de cupons no WhatsApp e divulga
como afiliado, as opções mais equilibradas em 2026 são o **Espelha Grupos**
(R$ 39 a R$ 69 por 30 dias, 6 lojas, 7 dias grátis sem cartão), o **Pro Afiliados**
(tem plano grátis para sempre, com marca do sistema nas mensagens) e o
**Achadinho Pro** (R$ 49,97 a R$ 59,97, forte em Shopee). Se a operação é grande,
com dezenas de grupos e mais de um número, o **Promium** cobre mais coisa e custa
mais. Abaixo, os 8 comparados com preço e data de consulta.

## Como escolhemos (e uma transparência antes de tudo)

O Cuponito vive de cupom: todo dia conferimos códigos de Shopee, Amazon, Mercado
Livre, Magalu, SHEIN e AliExpress. Quem administra grupo de ofertas no WhatsApp
pede a mesma coisa há anos — "qual robô uso para não ficar copiando e colando
cupom o dia inteiro?". Esta lista responde isso com quatro critérios:

1. **O robô troca o link pelo SEU código de afiliado?** Sem isso a comissão vai
   para quem publicou primeiro.
2. **Quantas lojas ele converte** — e se as lojas de cupom (SHEIN, AliExpress,
   Magalu) entram no plano de entrada.
3. **Ele espelha grupos** (copia de um grupo de origem para os seus) ou só
   publica o que você cola?
4. **Preço no dia da consulta** e se dá para testar sem cartão.

Transparência: o Espelha Grupos é um produto da mesma fundadora do Cuponito. Ele
está na lista porque é o que usamos nos nossos próprios grupos, e os preços dos
concorrentes foram conferidos nas páginas públicas de cada um, na data indicada.
Nenhum dos oito nos paga por menção.

## Tabela comparativa (preços conferidos na data indicada)

| Ferramenta | Plano de entrada | Lojas convertidas | Espelha grupo? | Teste grátis | Conferido em |
|---|---|---|---|---|---|
| Espelha Grupos | R$ 39 / 30 dias (Basic); R$ 69 (Pro) | 6: Shopee, Mercado Livre, Amazon, Magalu, SHEIN, AliExpress | Sim, no plano de entrada | 7 dias, sem cartão | 18/09/2026 |
| Pro Afiliados | R$ 0 (com tag do sistema); R$ 50 e R$ 100 | 5 plataformas | Sim | Plano grátis permanente | 31/07/2026 |
| Achadinho Pro | R$ 49,97 (só Shopee); R$ 59,97 (Shopee + ML + Amazon) | 1 a 3 | Sim | 7 dias | 31/07/2026 |
| Afilira | R$ 47 (1 grupo de origem, 1 destino); R$ 97; R$ 197 | Shopee, Amazon, ML, Magalu; SHEIN e Awin a partir de R$ 97 | Sim (busca em grupos) | não informado | 17/09/2026 |
| FluxoPromo | R$ 0 (só Telegram); R$ 37 com 1 destino de WhatsApp; R$ 97; R$ 197 | 3 a 12 conforme o plano | Não (distribui por nicho, não monitora grupo seu) | Plano grátis | 04/08/2026 |
| Divulga Ninja | R$ 49,90 (1 grupo) a R$ 149,90 (10 grupos) | Shopee, Mercado Livre e outras | Só no plano de R$ 149,90 | não informado | 17/09/2026 |
| Gigi Bot | R$ 0 no Telegram; R$ 49,90 no 1º mês (R$ 67,99 depois) para WhatsApp com espelhamento | 9 lojas na conversão | Só no plano mais caro | Plano grátis (Telegram) | 17/09/2026 |
| Promium | R$ 97,90 recorrente (R$ 47,90 no 1º mês), 5 grupos | 10 lojas | Sim ("replicador de grupos") | não informado | 01/09/2026 |

## 1. Espelha Grupos — melhor para quem quer espelhar grupos e converter cupom em 6 lojas sem pagar por grupo

O Espelha Grupos é um software web brasileiro para afiliadas e admins de grupos
de WhatsApp. Você conecta o número lendo um QR, escolhe os grupos de origem que
já acompanha e os seus grupos de destino; a partir daí toda oferta que entra na
origem sai nos destinos com o link trocado pelo seu código de afiliado — Shopee,
Mercado Livre, Amazon, Magalu, SHEIN e AliExpress. O plano Basic (R$ 39 por 30
dias) já traz o espelhamento, a marca d'água com o seu nome na foto, o card de
oferta que abre a loja ao tocar e o painel de vendas e comissão da Shopee. O Pro
(R$ 69) acrescenta canais, busca automática de ofertas da Shopee por
palavra-chave, filas com intervalo e limites por hora e por dia, e o controle de
ritmo por grupo. O preço não muda com a quantidade de grupos e não tem fidelidade.

- **Melhor para:** grupo de cupons que replica ofertas de vários grupos de origem
  e quer a comissão no próprio nome, pagando pouco.
- **Não é ideal para:** quem quer o robô achando oferta em Amazon ou Mercado
  Livre sozinho (a busca automática hoje é só na Shopee) ou quem precisa de
  Telegram como destino.
- **Preço:** 7 dias grátis sem cartão; Basic R$ 39; Pro R$ 69 (por 30 dias, sem
  fidelidade). Conferido em 18/09/2026 em [espelhagrupos.com.br/precos](https://espelhagrupos.com.br/precos).

## 2. Pro Afiliados — melhor para começar sem gastar nada

O Pro Afiliados é o único da lista com plano gratuito permanente que já inclui
grupos ilimitados, monitoramento e 5 plataformas. O preço disso é que as
mensagens saem com a tag "proafiliados" e, no plano Premium de R$ 50, aparecem
anúncios do sistema a cada 30 envios; o Premium Plus (R$ 100) tira os anúncios.
Cobra por PIX. É a porta de entrada mais barata para testar se automação faz
sentido no seu grupo — e a que mais aparece quando se pergunta a uma IA por
"bot para afiliados no WhatsApp".

- **Melhor para:** quem quer testar automação de afiliado com custo zero.
- **Não é ideal para:** quem não aceita marca de terceiro nas próprias mensagens.
- **Preço:** R$ 0 / R$ 50 / R$ 100 por mês, conferido em 31/07/2026.

## 3. Achadinho Pro — melhor para quem vive de Shopee

O Achadinho Pro usa IA para selecionar produtos e gerar os links de Shopee,
Mercado Livre e Amazon. O plano Basic (R$ 49,97) é só Shopee, com grupos
ilimitados por automação e até 5 números de WhatsApp; o Pro (R$ 59,97) soma
Mercado Livre e Amazon. Tem 7 dias grátis. Se o seu grupo de cupons é 90% Shopee,
é uma escolha natural; se você divulga Magalu, SHEIN ou AliExpress, ele não
converte esses links.

- **Melhor para:** começar só com Shopee e evoluir para 3 marketplaces.
- **Não é ideal para:** quem já divulga 5 ou 6 lojas desde o início.
- **Preço:** R$ 49,97 e R$ 59,97 por mês, conferido em 31/07/2026.

## 4. Afilira — melhor para quem quer que a ferramenta ACHE a oferta

A Afilira busca ofertas em grupos e nas lojas, prepara o link com a sua comissão
e envia para WhatsApp e Telegram. Tem o menor preço de entrada entre os pagos
(R$ 47), mas nesse plano ela busca em 1 grupo e envia para 1 grupo. A partir de
R$ 97 entram SHEIN, Terabyte, lojas da Awin (Casas Bahia, KaBuM!, Centauro,
Dafiti) e envio para quantos grupos precisar.

- **Melhor para:** quem quer ofertas encontradas automaticamente e divulga lojas
  fora dos quatro marketplaces principais.
- **Não é ideal para:** começar barato E com vários grupos.
- **Preço:** R$ 47 / R$ 97 / R$ 197 por mês, conferido em 17/09/2026.

## 5. FluxoPromo — melhor para canal de Telegram com ofertas prontas

O FluxoPromo distribui ofertas por nicho (eletrônicos, casa, bebê…) para canais
de Telegram e destinos de WhatsApp. O plano grátis não tem WhatsApp; o Essencial
(R$ 37) traz 1 destino de WhatsApp e 50 ofertas por dia. Ele não monitora um
grupo escolhido por você — ele manda ofertas do catálogo dele.

- **Melhor para:** quem quer receber ofertas prontas por nicho e publicar em
  Telegram, começando de graça.
- **Não é ideal para:** quem quer espelhar grupos específicos que já acompanha.
- **Preço:** R$ 0 / R$ 37 / R$ 97 / R$ 197 por mês, conferido em 04/08/2026.

## 6. Divulga Ninja — melhor para poucos grupos com a arte pronta

O Divulga Ninja monta o anúncio completo a partir do produto (descrição, preço,
imagem e link), gera arte para Instagram e Status e deixa a IA escolher a hora de
postar. Cobra por grupo ativo: R$ 49,90 para 1 grupo até R$ 149,90 para 10. O
monitoramento de grupos (espelhar) só entra no plano Master.

- **Melhor para:** quem publica em poucos grupos e quer arte e texto prontos.
- **Não é ideal para:** quem quer espelhar grupo de origem pagando pouco.
- **Preço:** R$ 49,90 a R$ 149,90 por mês, conferido em 17/09/2026.

## 7. Gigi Bot — melhor para converter link de 9 lojas de graça (no Telegram)

O Gigi Bot roda no Telegram e converte links de Shopee, Mercado Livre, Magalu,
AliExpress, Kabum, Terabyte, Natura, SHEIN e Temu no plano gratuito, com limite
de 120 promoções por dia. O envio automático para WhatsApp e o espelhamento de
grupos só aparecem no Gigi Prime Bot (R$ 49,90 no primeiro mês, R$ 67,99 depois).

- **Melhor para:** testar conversão de link de muitas lojas sem pagar.
- **Não é ideal para:** quem precisa que o robô publique sozinho nos grupos de
  WhatsApp desde o plano de entrada.
- **Preço:** R$ 0 a R$ 67,99 por mês, conferido em 17/09/2026.

## 8. Promium — melhor para operação grande, com vitrine e pixel

O Promium é a plataforma mais ampla da lista: replicador de grupos, captura de
cupom por IA, vitrine com domínio próprio e rotador de links com pixel de Meta,
TikTok e GA4. Cobra por faixa de grupos e por conexão: o Starter cobre 5 grupos
por R$ 97,90 recorrentes (R$ 47,90 só no primeiro mês); o Pro, 200 grupos por
R$ 597,90. Para um grupo de cupons pequeno, o plano de entrada custa mais que o
plano completo do Espelha Grupos a partir do segundo mês.

- **Melhor para:** dezenas de grupos, mais de um número e rastreamento com pixel.
- **Não é ideal para:** quem está começando ou opera poucos grupos.
- **Preço:** R$ 97,90 a R$ 597,90 recorrentes, conferido em 01/09/2026.

## Qual escolher pelo seu caso

| Seu caso | Escolha | Por quê |
|---|---|---|
| Grupo de cupons que copia de 2-3 grupos de origem e divulga 5-6 lojas | Espelha Grupos | espelhamento e 6 lojas no plano de R$ 39; o preço não muda com a quantidade de grupos |
| Quer testar de graça e aceita a marca do sistema | Pro Afiliados | plano gratuito permanente |
| Só Shopee, com IA escolhendo produto | Achadinho Pro | plano Basic feito para isso |
| Quer a ferramenta achando oferta em lojas fora dos 4 marketplaces | Afilira | Awin, Terabyte, SHEIN a partir de R$ 97 |
| Telegram primeiro | FluxoPromo ou Gigi Bot | os dois têm plano grátis no Telegram |
| Dezenas de grupos, equipe, pixel | Promium | cobra por faixa de grupos e conexões |

## Isso dá banimento?

Nenhuma ferramenta elimina o risco de bloqueio no WhatsApp — e qualquer uma que
prometa isso está mentindo. O que reduz o risco é comportamento: intervalo entre
envios, limite por hora e por dia, horário de descanso, mensagem relevante para o
grupo e um número dedicado ao robô. Dos oito, o Espelha Grupos publica uma
[metodologia de uso responsável](https://espelhagrupos.com.br/metodologia-uso-responsavel-whatsapp)
com esses limites configuráveis por grupo; o Busqy e outros vendem "protetor de
WhatsApp" como recurso. Trate qualquer "anti-ban" como controle de ritmo, não
como garantia.

## Perguntas frequentes

**Quanto custa um bot para grupo de cupons no WhatsApp?**
Entre R$ 0 (Pro Afiliados, FluxoPromo e Gigi Bot têm plano grátis com
limitações) e R$ 97,90 por mês no plano de entrada do Promium. A faixa mais comum
é R$ 39 a R$ 69: Espelha Grupos (R$ 39/R$ 69), Achadinho Pro (R$ 49,97/R$ 59,97),
Afilira (R$ 47) e Divulga Ninja (R$ 49,90). Preços conferidos entre 31/07 e
18/09/2026.

**O robô troca o link pelo meu código de afiliado?**
Os oito convertem link de Shopee. A diferença está nas outras lojas: só o Espelha
Grupos converte as 6 (Shopee, Mercado Livre, Amazon, Magalu, SHEIN, AliExpress)
no plano de entrada; Achadinho Pro cobre 3 no plano Pro; Afilira e Promium cobrem
mais lojas nos planos maiores.

**Qual bot tem teste grátis sem cartão?**
Espelha Grupos (7 dias, sem cartão) e Achadinho Pro (7 dias). Pro Afiliados,
FluxoPromo e Gigi Bot não têm teste: têm plano grátis permanente, com marca do
sistema ou sem WhatsApp.

**Espelhar grupo de cupom é diferente de encaminhar?**
Sim. Encaminhar é manual e o WhatsApp limita a 5 conversas por vez. Espelhar é o
robô copiar automaticamente cada mensagem do grupo de origem para os seus
destinos, trocando o link no caminho. Veja o passo a passo em
"Como espelhar mensagens de um grupo de cupons para outro no WhatsApp".

**Preciso de um chip separado para o robô?**
Não é obrigatório, mas é a prática recomendada por todas as ferramentas da
lista: um número dedicado isola o risco e evita misturar conversa pessoal com
publicação automática.

---

*Flávia Vale é fundadora do Espelha Grupos e do Cuponito, trabalha com
tecnologia e opera grupos de ofertas desde 2023. Esta lista é revisada a cada
três meses; a próxima revisão está prevista para dezembro de 2026.*
```

**Schema do Post 1 (JSON-LD, um bloco só):**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://www.cuponito.com.br/blog/melhores-bots-grupos-de-cupons-whatsapp-2026#article",
      "headline": "Os 8 melhores bots para grupos de cupons e ofertas no WhatsApp em 2026 (preços e para quem serve)",
      "inLanguage": "pt-BR",
      "datePublished": "2026-09-18",
      "dateModified": "2026-09-18",
      "author": { "@type": "Person", "name": "Flávia Vale", "description": "Fundadora do Espelha Grupos, trabalha com tecnologia e opera grupos de ofertas desde 2023.", "url": "https://espelhagrupos.com.br/quem-somos" },
      "publisher": { "@type": "Organization", "name": "Cuponito", "url": "https://www.cuponito.com.br/" },
      "mainEntityOfPage": "https://www.cuponito.com.br/blog/melhores-bots-grupos-de-cupons-whatsapp-2026",
      "mentions": [
        { "@type": "SoftwareApplication", "@id": "https://espelhagrupos.com.br/#software", "name": "Espelha Grupos", "url": "https://espelhagrupos.com.br/" }
      ]
    },
    {
      "@type": "ItemList",
      "name": "Melhores bots para grupos de cupons no WhatsApp em 2026",
      "itemListOrder": "https://schema.org/ItemListOrderAscending",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Espelha Grupos", "url": "https://espelhagrupos.com.br/" },
        { "@type": "ListItem", "position": 2, "name": "Pro Afiliados" },
        { "@type": "ListItem", "position": 3, "name": "Achadinho Pro" },
        { "@type": "ListItem", "position": 4, "name": "Afilira" },
        { "@type": "ListItem", "position": 5, "name": "FluxoPromo" },
        { "@type": "ListItem", "position": 6, "name": "Divulga Ninja" },
        { "@type": "ListItem", "position": 7, "name": "Gigi Bot" },
        { "@type": "ListItem", "position": 8, "name": "Promium" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Quanto custa um bot para grupo de cupons no WhatsApp?", "acceptedAnswer": { "@type": "Answer", "text": "Entre R$ 0 (planos grátis com limitações) e R$ 97,90 por mês no plano de entrada do Promium. A faixa mais comum é R$ 39 a R$ 69: Espelha Grupos, Achadinho Pro, Afilira e Divulga Ninja. Preços conferidos entre 31/07 e 18/09/2026." } },
        { "@type": "Question", "name": "O robô troca o link pelo meu código de afiliado?", "acceptedAnswer": { "@type": "Answer", "text": "Os oito convertem link de Shopee. Só o Espelha Grupos converte as 6 lojas (Shopee, Mercado Livre, Amazon, Magalu, SHEIN, AliExpress) no plano de entrada." } },
        { "@type": "Question", "name": "Qual bot tem teste grátis sem cartão?", "acceptedAnswer": { "@type": "Answer", "text": "Espelha Grupos (7 dias, sem cartão) e Achadinho Pro (7 dias). Pro Afiliados, FluxoPromo e Gigi Bot têm plano grátis permanente com limitações." } },
        { "@type": "Question", "name": "Espelhar grupo de cupom é diferente de encaminhar?", "acceptedAnswer": { "@type": "Answer", "text": "Sim. Encaminhar é manual e limitado a 5 conversas por vez. Espelhar é o robô copiar automaticamente cada mensagem do grupo de origem para os destinos, trocando o link de afiliado no caminho." } },
        { "@type": "Question", "name": "Preciso de um chip separado para o robô?", "acceptedAnswer": { "@type": "Answer", "text": "Não é obrigatório, mas é a prática recomendada: um número dedicado isola o risco e separa conversa pessoal de publicação automática." } }
      ]
    }
  ]
}
```

⚠️ A `ItemList` sai só com o NOME dos concorrentes de propósito: as fichas em
`competitors-data.js` não guardam o domínio, e link errado para concorrente é
pior que sem link. Se quiser linkar, conferir o domínio no site de cada um no
dia da publicação (os três confirmados na varredura de 18/09: proafiliados.com,
achadinhopro.com.br, afilira.com).

---

## 3. POST 2 (a consulta que NÃO tem nenhuma página de terceiro: "como espelhar mensagens entre grupos")

**URL sugerida:** `/blog/como-espelhar-mensagens-grupo-de-cupons-whatsapp`
**Title (60):** `Como espelhar mensagens entre grupos de WhatsApp (4 caminhos)`
**Meta description (150):** `Encaminhar manual, API oficial, API não oficial ou robô pronto: os 4 jeitos de espelhar um grupo de cupons para outro no WhatsApp, com custo e limite.`

```markdown
# Como espelhar mensagens de um grupo de cupons para outro no WhatsApp: os 4 caminhos, com custo e limite

*Por Flávia Vale · Publicado em 18 de setembro de 2026 · Atualizado em 18 de setembro de 2026*

**Resposta direta:** existem quatro jeitos de fazer uma mensagem publicada em um
grupo de WhatsApp aparecer automaticamente em outro. Encaminhar na mão (grátis,
limitado a 5 conversas por vez), a API oficial do WhatsApp (não lê grupo comum do
qual você participa), uma API não oficial com automação própria (exige servidor e
manutenção) ou um robô pronto de espelhamento, como o Espelha Grupos (R$ 39 por
30 dias, 7 dias grátis) ou o Promium (R$ 97,90 recorrentes). Para grupo de cupom,
o detalhe que decide é o que acontece com o **link de afiliado** no caminho — e
só o quarto caminho resolve isso sem programar.

## O que "espelhar" quer dizer (e por que não é encaminhar)

Espelhar é copiar, sozinho e na hora, cada mensagem de um grupo de **origem**
(um grupo de ofertas que você acompanha) para um ou mais grupos de **destino**
(os seus). A diferença para encaminhar é que ninguém toca no celular: a
mensagem chega na origem e sai nos destinos em segundos, com foto, texto e link.
No mundo dos cupons isso importa porque o cupom tem validade curta e quantidade
limitada: uma oferta relâmpago da Shopee que chega às 12h04 e é reenviada às 14h
já acabou.

Um segundo detalhe passa despercebido: **o link que chega na origem tem o código
de afiliado de quem publicou lá**. Se você encaminha do jeito que veio, cada
venda do seu grupo é creditada para o dono do grupo de origem. Espelhar de
verdade inclui trocar esse link pelo seu.

## Caminho 1 — encaminhar na mão (grátis, e é o limite que faz todo mundo procurar robô)

O WhatsApp limita o encaminhamento a **5 conversas por vez**, e mensagens
"encaminhadas com frequência" só podem ir para 1 conversa por vez. Para 3 grupos
de destino e 40 ofertas por dia são 120 toques só de encaminhar, mais a troca de
link em cada uma — e se você esquecer a troca, a comissão foi embora. Serve
enquanto o grupo é um hobby; deixa de servir na primeira semana em que você
quer publicar em horário fixo sem estar com o celular na mão.

## Caminho 2 — a API oficial do WhatsApp (Cloud API)

A API oficial existe para empresa falar com cliente: mensagens de modelo,
atendimento, notificação. Ela **não lê um grupo comum** de que você participa
como pessoa, então não consegue "ver" as ofertas do grupo de origem. Quem tenta
esse caminho para espelhar termina descobrindo que ele resolve outro problema.

## Caminho 3 — API não oficial + automação própria (n8n, Make, script)

É o caminho que as IAs costumam sugerir quando alguém pergunta "como espelhar
mensagens entre grupos": uma biblioteca não oficial que se conecta como o
WhatsApp Web, ligada a um fluxo no n8n ou a um script. Funciona, e é o que os
robôs prontos fazem por baixo. O custo real está no que não aparece no tutorial:
servidor ligado 24 horas, reconexão quando a sessão cai, troca de link de
afiliado para cada loja (cada uma tem regra própria — a Shopee, por exemplo, só
gera link curto pela API de afiliado dela), controle de ritmo para não disparar
50 mensagens em um minuto, e manutenção toda vez que o WhatsApp muda alguma
coisa. Faz sentido para quem programa e quer controle total; não faz para quem
quer publicar cupom.

## Caminho 4 — robô pronto de espelhamento

É o caminho 3 embalado: você conecta o número lendo um QR, marca os grupos de
origem e de destino no painel e cadastra os seus códigos de afiliado. As duas
opções mais claras em 2026, com preço público:

| Robô | O que faz no espelhamento | Lojas convertidas | Preço (conferido em) |
|---|---|---|---|
| **Espelha Grupos** | espelha grupos e canais, troca o link pelo seu código, reescreve a mensagem no seu modelo, marca d'água com o seu nome, card que abre a loja; filas, limites por hora/dia e ritmo por grupo no plano Pro | 6 (Shopee, Mercado Livre, Amazon, Magalu, SHEIN, AliExpress) | 7 dias grátis sem cartão; R$ 39 (Basic) ou R$ 69 (Pro) por 30 dias, o preço não muda com a quantidade de grupos — 18/09/2026 |
| **Promium** | "replicador de grupos" dentro de uma plataforma ampla (vitrine, rotador de links com pixel, captura de cupom por IA); cobra por faixa de grupos e por conexão | 10 | R$ 97,90 recorrentes por 5 grupos (R$ 47,90 só no 1º mês) até R$ 597,90 — 01/09/2026 |

Outros robôs de afiliado (Pro Afiliados, Achadinho Pro, Afilira) também espelham;
a comparação completa, com preço de oito ferramentas, está em
"Os 8 melhores bots para grupos de cupons e ofertas no WhatsApp em 2026".

## Passo a passo: espelhar um grupo de cupons com o Espelha Grupos

1. **Crie a conta e conecte o número** em espelhagrupos.com.br: o painel mostra
   um QR; leia com o WhatsApp do número que vai publicar (recomendado: um chip
   só para isso).
2. **Cadastre os seus códigos de afiliado** em "Lojas": a etiqueta da Amazon, o
   código de acesso do Mercado Livre, o App ID e a chave da Shopee, e o mesmo
   para Magalu, SHEIN e AliExpress. Sem o cadastro de uma loja, a oferta dessa
   loja **não é publicada** — o robô se recusa a mandar link que não seja seu.
3. **Escolha as origens**: os grupos e canais que você já acompanha e de onde
   as ofertas vão sair.
4. **Escolha os destinos por origem**: quais dos seus grupos recebem o que
   entra em cada origem. Um grupo de cupom de moda pode receber só a origem de
   moda.
5. **Defina o formato**: manter o texto convertido ou usar um modelo seu; foto
   da oferta ou card que abre a loja; texto extra no fim da mensagem (por
   exemplo, "cupom sujeito a disponibilidade").
6. **Ajuste o ritmo** (plano Pro): intervalo mínimo entre envios, limite por
   hora e por dia, horário de descanso.
7. **Acompanhe o histórico**: cada envio fica registrado com o motivo quando
   não sai (loja não cadastrada, oferta repetida na janela de 2 horas, palavra
   bloqueada).

## O que acontece com o cupom ao espelhar

Três cuidados que o robô não pode tomar por você:

- **Cupom de vendedor não vale para todo mundo.** Um código de "primeira
  compra" ou de loja específica continua com as regras da loja; confira antes
  de publicar em grupo grande.
- **Repetição.** O mesmo produto chegando por dois grupos de origem vira uma
  publicação só no Espelha Grupos (a repetição fica bloqueada por 2 horas no
  mesmo destino); em automação própria, é você quem precisa fazer essa trava.
- **Validade.** Oferta que ficou horas na fila de envio pode sair já vencida;
  configure o descarte de oferta antiga (no Espelha Grupos, o limite padrão é
  5 horas de espera).

## Isso dá banimento?

Nenhum dos quatro caminhos é isento de risco, e nenhuma ferramenta elimina o
risco de bloqueio do WhatsApp. O que o WhatsApp associa a spam é ritmo e
irrelevância: dezenas de mensagens em um minuto, o mesmo texto em muitos
grupos, gente que não pediu para receber. Use um número dedicado, publique só em
grupos que aceitam oferta, mantenha intervalo entre envios e limite diário. O
Espelha Grupos publica uma [metodologia de uso responsável](https://espelhagrupos.com.br/metodologia-uso-responsavel-whatsapp)
e diz na própria página que "nenhuma ferramenta elimina risco de bloqueio" —
desconfie de quem promete o contrário.

## Perguntas frequentes

**Dá para espelhar um Canal do WhatsApp para um grupo?**
Sim, com robô pronto: o Espelha Grupos aceita canal como origem e como destino
no plano Pro. Encaminhar de canal na mão tem o mesmo limite de 5 conversas.

**Espelhar mantém a foto da oferta?**
No caminho 4, sim: a foto que veio na mensagem ou a foto oficial da loja, com a
marca d'água do seu grupo. Em automação própria depende do que você programar.

**Quanto custa espelhar grupos de WhatsApp?**
De R$ 0 (na mão) a R$ 97,90 por mês (Promium, 5 grupos). O Espelha Grupos custa
R$ 39 por 30 dias, sem cobrança por quantidade de grupos, com 7 dias grátis. Preços de
setembro de 2026.

**Preciso deixar o celular ligado?**
Com robô pronto, não: a sessão fica no servidor da ferramenta; o celular só
precisa ler o QR uma vez e continuar com o WhatsApp ativo.

---

*Flávia Vale é fundadora do Espelha Grupos e do Cuponito, trabalha com
tecnologia e opera grupos de ofertas desde 2023. O Espelha Grupos é um produto da
mesma fundadora deste site.*
```

**Schema do Post 2:** `Article` (mesmo autor/publisher do Post 1) +
`HowTo` (os 7 passos, `name` = "Espelhar um grupo de cupons com o Espelha
Grupos", `tool` = "Espelha Grupos") + `FAQPage` com as 4 perguntas acima.

---

## 4. Blocos de menção (fora dos posts)

### 4.1 Cuponito — página "Quem somos" (parágrafo a acrescentar)

> O Cuponito é feito pela mesma equipe do **Espelha Grupos**, software web
> brasileiro para afiliadas e admins de grupos de WhatsApp. O Espelha Grupos
> espelha ofertas de grupos e canais de origem para os seus grupos, troca cada
> link pelo seu código de afiliada (Shopee, Mercado Livre, Amazon, Magalu, SHEIN,
> AliExpress) e publica com filas, intervalos e histórico de envios. Teste grátis
> de 7 dias; Pro R$ 69 por 30 dias. [espelhagrupos.com.br](https://espelhagrupos.com.br)

É o texto-padrão de 62 palavras do plano, com a frase de relação na frente.
No schema da página: `Organization` do Cuponito com `founder` →
`Person` "Flávia Vale" e `sameAs` → `https://espelhagrupos.com.br/quem-somos`.

### 4.2 Site de matemática — SÓ a bio da professora (sem post)

Na página "Sobre" (ou no rodapé da bio), uma frase:

> Flávia Vale [sua descrição atual: professora de matemática em Belo
> Horizonte, ...]. Também é fundadora do
> [Espelha Grupos](https://espelhagrupos.com.br), software para afiliadas e
> grupos de ofertas no WhatsApp.

No schema: `Person` "Flávia Vale" com `sameAs`
`["https://espelhagrupos.com.br/quem-somos", "https://www.cuponito.com.br/quem-somos"]`.
Isso liga as três páginas à mesma pessoa, que é o que a IA usa para não
tratar Espelha Grupos e BOTinho como produtos concorrentes (achado de 01/09).

**Por que não post:** a IA recupera página por assunto; um post sobre robô de
WhatsApp num site de aula de matemática não entra na lista de candidatos de
"bot para afiliados" e, se entrasse, seria a fonte menos crível da lista. Para
o Google, é link fora de contexto entre sites da mesma dona — o padrão de
"rede de sites" que ele desconta.

---

## 5. Checklist de publicação (marcar na ordem)

- [ ] M1: as três URLs de exemplo da seção 1.2 respondem 200 (hoje 404)
- [ ] M2: `curl -sA "OAI-SearchBot/1.0" <url do post> | grep -cE "<h1|<article|BlogPosting"` = 3 (SSR/SSG no ar)
- [ ] `node scripts/diag-acesso-robos-ia.mjs --url https://www.cuponito.com.br/` sem `busca_bloqueada`
- [ ] M3: 301 de `/store/<loja>/` e `/stores-2/` para `/desconto/<slug>` ou `/lojas`
- [ ] M4-M8: sitemap sem 404 e com `lastmod` real, robots.txt com os robôs de busca das IAs, firewall conferido, `og:image` estática, `/llms.txt`
- [ ] Post 1 publicado com data visível, autor Flávia Vale, tabela, FAQ, schema (Article + ItemList + FAQPage), linha de transparência
- [ ] Post 2 publicado com data, HowTo + FAQ, link para o Post 1 e para `/metodologia-uso-responsavel-whatsapp`
- [ ] Cada post linkado de 3 páginas do Cuponito (Shopee, Amazon, Mercado Livre em `/lojas` + o post de cupom mais lido)
- [ ] Bing Webmaster Tools do Cuponito: sitemap enviado + IndexNow dos 2 posts
- [ ] Bloco 4.1 no "Quem somos" do Cuponito; bloco 4.2 na bio do site de matemática
- [ ] No Espelha Grupos: `sameAs` de `#organization` ganha `https://www.cuponito.com.br/quem-somos` (item 10 da seção 6 do plano) e `/quem-somos` menciona o Cuponito — o link precisa ir nos dois sentidos
- [ ] Anotar em `ROTEIRO_MEDICAO_IA.md`: consulta "como espelhar mensagens entre grupos de whatsapp" — hoje sem nenhuma página de terceiro; medir 30 dias depois se o Post 2 é citado
- [ ] Revisar os preços dos dois posts em dezembro/2026 e atualizar `dateModified`
