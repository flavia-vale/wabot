# Máquina de vendas por IA — o que fazer para o ChatGPT (e Gemini, Perplexity, AI Overviews) indicarem o Espelha Grupos

Data: 2026-09-18. Levantamento feito por 6 leitores em paralelo (docs de
marketing, código do site, site ao vivo, mecânica do ChatGPT com fontes de
2025-2026, onde os concorrentes aparecem, diretórios e comunidades) + 4 buscas
reais nas consultas que uma afiliada faz (≈45 buscas e ≈35 páginas abertas na
varredura de concorrentes; 4 buscas × 5 variações cada). Tudo abaixo cita a
evidência. O que não tem evidência não entrou.

**Ao abrir a próxima análise, comece por este arquivo e pelo
`REGISTRO_EXECUCAO_2026-08-16_A_09-02.md`.** Três análises seguidas (01/09,
10/09, 11/09) propuseram criar páginas que já existiam — ver AGENTS.md "O Tier
1 JÁ FOI EXECUTADO".

## Estado de implementação — verificado em 18/09/2026 (noite), site por site

Tudo medido de novo com `curl`/schema/REST pública (o que a ficha do Google,
o Search Console, o Bing WMT e o Reclame Aqui guardam não dá para ver de fora).
⚠️ **Correção de método:** a checagem "zero páginas no índice do Bing" feita de
manhã para o Cuponito e para o site de matemática **não vale** — a consulta
`site:` sem sessão devolve página genérica até para `superprof.com.br`
(controle). Indexação só se mede no Search Console / Bing Webmaster Tools.

### Espelha Grupos (produção) — o que era código já está no ar

| Item | Estado | Evidência |
|---|---|---|
| `og:image` real (`/og-default.png`) | ✅ no ar | home declara `og-default.png`, arquivo responde 200 |
| FAQ e planos públicos com 6 lojas | ✅ no ar | `/api/public/faq` e `/plans` trazem "seis lojas", SHEIN, AliExpress (migration aplicada) |
| `llms.txt` com preço, lojas e páginas comerciais | ✅ no ar | `R$69` presente |
| Entidade única (`WebSite #website`, `SoftwareApplication #software`) | ✅ no ar | `#website` no HTML da home |
| Medição de chegada por IA em `/alternativas` e blog | ✅ no ar (PR #1743 mergeada em `main` hoje) | commits 5322852, f287836 em `main` |
| **GPTBot/ClaudeBot na Cloudflare** (4.1 item 2) | ❌ pendente | `diag-acesso-robos-ia`: GPTBot, ClaudeBot, Amazonbot, CCBot, Bytespider = 403; busca/clique = 200 |
| **Listicle ofertasbot.com** (4.1 item 1) | ❌ não estamos | as 2 ocorrências de "espelha grupos" na página são a expressão genérica "quem espelha grupos", não a marca |
| **YouTube renomeado** (4.1 item 4) | ❌ pendente | `@botinhoafiliado` ainda "BOTinho - YouTube"; `@espelhagrupos` não existe |
| Reclame Aqui (4.1 item 3) | ? | página protegida por challenge; não dá para ver de fora |
| Bing WMT, fila de indexação, rodada de medição (4.1 itens 5-7) | ? | só dentro das ferramentas |
| `/bot-afiliados-whatsapp` reescrita (seção 6 item 1) | ✅ no `develop` (aguarda develop→main) | H1 com preço e teste, tabela de preço estática, "Melhor para / Não é ideal para", comparação com Pro Afiliados, Afilira e Achadinho Pro, 6 lojas em todo o texto, `dateModified` 2026-09-18. O `title` ficou: é exceção MEDIDA (8,09% de clique) e só muda com dado de Search Console |
| Fundadora ligada ao Cuponito e `/quem-somos` citando o Cuponito (link nos dois sentidos) | ✅ no `develop` (aguarda develop→main) | `Organization.founder` → `Person #founder` (Flávia Vale) com `sameAs` para `cuponito.com.br/quem-somos#person` e `aulasdematematicabh.com.br/#flavia` — no `sameAs` da PESSOA, não da Organization (o Cuponito é outra empresa; a entidade comum é a pessoa); `/quem-somos` ganhou "Quem faz" com link normal para o Cuponito |

### Cuponito — a estrutura foi consertada; faltam os dois posts

| Item (doc `POSTS_CUPONITO_…`) | Estado | Evidência |
|---|---|---|
| M1 rotas dinâmicas em 200 | ✅ | `/blog/<slug>`, `/desconto/<slug>`, `/categoria/<slug>`, `/quem-somos` = 200 |
| M2 HTML com conteúdo no servidor | ✅ nas páginas internas | post real com UA OAI-SearchBot: `<h1>`, `<article>`, `BlogPosting` = 3/3; canonical, `og:*`, `dateModified`, 7 links internos no HTML |
| M2 na **home e no `/blog`** | ⚠️ ainda casca | `/` e `/blog` continuam com 3.488 bytes, 0 `<h1>`, 0 schema — as duas páginas que mais recebem link ainda são invisíveis |
| M3 301 das URLs antigas | ✅ | `/store/casas-bahia/` → `/desconto/cupom-desconto-casas-bahia` (3 saltos; um 301 direto seria melhor) |
| M4 sitemap com `lastmod` real | ✅ | 12 datas distintas, de 04/2026 a 09/2026 |
| M5 robots.txt | ✅ | OAI-SearchBot, Claude-SearchBot, Claude-User, Applebot, DuckAssistBot, meta-externalagent listados |
| M6 firewall / robôs de treino | ✅ **liberado** (medido do VPS em 18/09: `curl -A "GPTBot/1.0"` = 200) | ⚠️ a leitura anterior ("GPTBot/ClaudeBot/CCBot = 403 na Vercel") estava **errada**: o 403 vinha com `x-vercel-mitigated: deny` e batia também no User-Agent de navegador comum — era o firewall da Vercel barrando o **IP do ambiente de análise** (datacenter, rajada de requisições), não uma regra de robô de treino. Refeito com pausa entre pedidos: GPTBot, ClaudeBot, CCBot e OAI-SearchBot = 200. **Medir robô de fora só vale de um IP limpo** (o VPS serve); um 403 com `x-vercel-mitigated: deny` no navegador de controle invalida a medição inteira |
| M7 `og:image` | ✅ | `/og-default.png` 200; post usa a `cover_image` |
| M8 `llms.txt` | ✅ | no ar, cita as 6 lojas e "administradores de grupos de cupons e afiliados" |
| 4.1 "Quem somos" com o Espelha Grupos | ✅ | H2 "Cuponito e Espelha Grupos", link, `Person` Flávia Vale no schema |
| **M10 os dois posts** | ✅ (publicados na noite de 18/09) | `/blog/melhores-bots-grupos-de-cupons-whatsapp-2026` e `/blog/como-espelhar-mensagens-grupo-de-cupons-whatsapp` respondem 200 com HTML no servidor |
| Bing WMT / IndexNow | ? | não mensurável de fora |

### Site de matemática — metade feita; o que falta é o que traz lead

| Item (doc `SITE_MATEMATICA_BH_…`) | Estado | Evidência |
|---|---|---|
| 4.1 rodapé "quem mantém este site" + schema | ✅ | texto no rodapé; `Person #flavia` como `creator`/`maintainer` do `WebSite` |
| M6 301 http→https, www→apex, `/sitemap.xml` → índice | ✅ | os três respondem 301 |
| sitemap com `lastmod` | ✅ | 33 URLs, 33 `lastmod` |
| M10 robots.txt | ✅ | `Claude-SearchBot` presente |
| 4.6 posts locais | ✅ 4 de 7 | Coltec, CEFET-MG, Colégio Militar e Cálculo 1 UFMG/PUC publicados em 18/09, 1.100-1.500 palavras, 10-16 links internos, CTA próprio; linkados da home |
| **M1 medição** (GA4/Analytics, Search Console, Bing WMT) | ❌ | nenhum script externo no HTML; ferramentas não verificáveis de fora |
| **M2/M3 ficha do Google + avaliações** | ? | só dentro da ficha |
| **M4 posicionamento** (BH-primeiro, telefone) | ❌ | H1 igual ("Matemática que finalmente faz sentido — pro 6º ano…"); DDD 32 em 9 lugares da home |
| **M5 títulos ≤ 60** | ❌ | serviço: 106-121 caracteres; posts novos: 72-83 (o sufixo "\| Aulas de Matemática BH" estoura) |
| posts novos sem `FAQPage` | ⚠️ | os 4 têm FAQ em texto mas sem schema |
| M7/M8 "atualizado em" nas páginas de serviço, `sameAs` completo | ❌ / ? | sem data nas 8 páginas de serviço; Instagram/Facebook não confirmados |

### O que fazer agora, em ordem (o que ainda não foi feito e mais pesa)

1. **Cloudflare (Espelha Grupos): decidir GPTBot/ClaudeBot.** Na Vercel (Cuponito) já está liberado — a medição anterior estava contaminada pelo IP do ambiente de análise (ver M6). Conferir o Espelha Grupos **do VPS**, não de fora: `cd ~/wabot && node scripts/diag-acesso-robos-ia.mjs`.
2. **Cuponito: publicar os dois posts** (seções 2 e 3 do doc) — a estrutura já lê; e renderizar `/` e `/blog` no servidor (hoje são as duas únicas páginas ainda vazias).
3. **Espelha Grupos: pedir inclusão no listicle do ofertasbot.com** (o e-mail pronto está no item 1 da 4.1) e **renomear o YouTube**.
4. **Matemática: medir e ficha do Google** (M1-M3) — sem isso os 4 posts novos não têm como virar lead mensurável; depois títulos (M5) e H1/telefone (M4).
5. **Código no Espelha Grupos:** `sameAs` com Cuponito + `/quem-somos` citando o Cuponito; reescrever `/bot-afiliados-whatsapp` (seção 6 item 1).
6. Rodada de medição de IA (4.1 item 7) só depois dos itens 1-3, senão mede o estado antigo.

---

## 0. A resposta em dez linhas

1. **Fora do nosso site, o Espelha Grupos não existe.** Zero menções de
   terceiros confirmadas (busca pelo nome devolve só espelhagrupos.com.br;
   GitHub fora do nosso repo = 0; YouTube/TikTok/Reddit/LinkedIn = 0). Os 8
   alvos de `ai_seo_presence_targets.csv` estão "planned" desde 05/2026. É a
   única alavanca grande que nunca foi puxada — e a única que separa o ChatGPT
   (cita) das outras três IAs (não citam).
2. **O ChatGPT já é o canal que mais vende** (35-43% dos cadastros com
   `utm_source=chatgpt.com`, índice de qualidade 2,69×). Cita quando a pergunta
   é de categoria (3 de 7 em conta neutra). Gemini, Perplexity e AI Overviews
   citam **zero** nas consultas de categoria — e não é bloqueio: os robôs
   deles passam.
3. **Um listicle de terceiro domina a categoria e não nos lista:**
   ofertasbot.com "os 14 melhores bots de ofertas" (autor nomeado, atualizado
   01/08/2026) apareceu em ~metade das 40 buscas da varredura; 10 dos 14 nomes
   dele foram citados pelas IAs no nosso CSV. O contato do autor é público.
   Pedir inclusão estava no plano de 01/09 (ação 12) e nunca foi feito.
4. **Quem as IAs mais citam não está em diretório nenhum.** Afilira (10
   citações), Ofertiva (9), Afiliado Analytics (5) têm ZERO menção de terceiro
   — o que têm é site com páginas por loja × canal, título igual à pergunta e
   nome único. Zero dos 8 mais citados está em B2B Stack, Capterra, G2, Product
   Hunt, Reddit ou Quora. Diretório não é onde a IA acha esta categoria.
5. **O nosso lado tinha contradições que a IA lia** e foram consertadas hoje:
   `og:image` inexistente (404), FAQ e planos públicos dizendo 4 lojas (são 6),
   home com "4 lojas, mais chegando", `llms.txt` sem preço, medição de origem
   por IA desligada em 47% das impressões. Tudo em `develop` (commits
   `5322852`, `f287836`).
6. **GPTBot e ClaudeBot estão barrados no WAF da Cloudflare** com o
   `robots.txt` limpo. Não impede citação (o robô de busca passa), mas impede o
   próximo modelo de aprender a marca. Decisão sua, 10 minutos, sem código.
7. **`llms.txt` e schema não trazem citação sozinhos** (correlação zero em 300
   mil domínios; Google diz que não usa). Servem para não contradizer. Já
   estão certos — não gastar mais tempo neles.
8. **O que vira citação, na ordem do peso medido:** menção em YouTube (0,737),
   menção da marca em sites de terceiros (0,664), páginas "melhores X" (43,8%
   das citações de topo de funil), frescor (atualização em <3 meses dobra a
   chance), texto com número/quote nas primeiras linhas (+28-43%).
9. **O que vira VENDA é outra coisa:** a IA escolhe UM produto por preço,
   avaliação e "melhor para <caso>". Nenhuma página nossa diz "melhor para",
   não existe avaliação de terceiros em lugar nenhum, e a comparação converte
   0% (147 visitas, 0 cadastro) enquanto a comercial converte 15-30%.
10. **Ordem de ataque:** (a) o listicle do ofertasbot + Reclame Aqui + canal
    do YouTube com o nome certo; (b) decisão da Cloudflare + Bing Webmaster
    Tools; (c) indexação pendente (23 URLs + lotes B e D esquecidos); (d)
    medição completa do roteiro (não existe dado depois de 11/09); (e) as 3
    páginas de RESPOSTA às perguntas que a IA recebe + "melhor para" nas
    comerciais. **Não fazer:** cidade/nicho, medir "BOTinho", prometer "não
    bane", anúncio antes de LTV, diretórios em massa, mais `llms.txt`/schema.

---

## 1. O que está medido hoje (não re-estimar)

Fonte: `ai_visibility_tracking.csv` (87 linhas, 3 rodadas), `ANALISE_SEO_2026-09-11.md`,
`ROTEIRO_MEDICAO_IA.md`.

| Medida | Valor | Onde |
|---|---|---|
| ChatGPT Search, consultas de categoria, conta neutra | **3 de 7** ("espelhar mensagens" = 1ª escolha; "postar sem spam" = 1º sozinho) | CSV 10/09 |
| Gemini / Perplexity / AI Overviews, categoria | **0 de 28** medições | CSV 01/09 + 10/09 |
| Marca ("espelha grupos …"), 4 superfícies | 9 sim + 1 parcial em 16 (2 das 9 em conta logada) | CSV 11/09 |
| "espelha grupos whatsapp o que é" | **0 de 4** — o conceito é nosso, o crédito não | CSV 11/09 |
| Cadastros com carimbo de IA (30 dias) | 42 de 119 (35%); 01/09 era 31 de 72 (43%) | ANALISE 11/09 |
| Visita → cadastro por tipo de página | comercial 15,4% · home 12,1% · **comparação 0,0%** (147 visitas) | ANALISE 11/09 |
| Cadastro → pagante | 119 → 12 (10%); 58% dos pagantes entraram por conteúdo | ANALISE 11/09 |
| Concorrentes citados pelas IAs | 95 nomes; top: Achadinho Pro 11, ProAfiliados 11, Afilira 10, Ofertiva 9, Shozap 9, GoGoBot 6 | CSV |
| Concorrentes com ficha de preço nossa | 8 de 95 (Afilira, Ofertiva, GoGoBot **sem** ficha) | competitors-data.js |
| Menções de terceiros ao Espelha Grupos | **0** confirmadas | varredura 18/09 |
| Última medição de qualquer coisa | **11/09** — 7 dias sem dado | git log + CSV |

O que a Perplexity disse, literalmente, que falta para nos citar (CSV linha
68): (1) presença em comparações recentes publicadas por **terceiros**; (2)
documentação pública clara de funcionalidades, preços e integrações; (3)
**múltiplas fontes independentes** citando a ferramenta como ativa. O item 2
já existe e provou funcionar (ChatGPT e Gemini leram `pricing.md`). Os itens
1 e 3 têm **zero** execução.

---

## 2. Como o ChatGPT decide quem citar e quem recomendar (com evidência)

Fontes lidas em 18/09 (URLs na seção 9).

**Com busca ligada** (o modo que cita produtos): o ChatGPT reescreve a
pergunta em várias consultas, recupera ~33 URLs por pergunta via Bing +
OAI-SearchBot e cita ~metade. 30 domínios concentram 67% das citações; 85%
das páginas recuperadas nunca são citadas. Página fora do índice do Bing
tende a não ser citada — **o Bing Webmaster Tools nunca foi verificado por
nós**.

**Sem busca**: responde do treino. Em 8 de 8 consultas devolveu zero produtos
nomeados. Com GPTBot barrado, isso não muda com o tempo.

**O que pesa, em ordem (correlações medidas em dezenas de milhares de marcas):**

| Sinal | Peso | Fonte |
|---|---|---|
| Menções da marca em **YouTube** | 0,737 (o mais forte) | Ahrefs, 75 mil marcas |
| Menções da marca em sites de terceiros | 0,664 | Ahrefs |
| Backlinks | 0,22 | Ahrefs |
| Páginas "melhores X" de terceiros | 43,8% das páginas citadas em topo de funil de software | Ahrefs |
| Marca citada via terceiros vs. próprio site | 6,5× | AirOps + Indig |
| Frescor | citado é 25,7% mais novo; atualizar em <3 meses dobra a chance | Ahrefs, SE Ranking |
| Forma do texto | estatística, citação e quote: +28-43%; 44% das citações vêm dos primeiros 30% da página | paper GEO (KDD 2024), Growth Memo |
| `llms.txt` | **zero** (97% nunca lidos; Google não usa) | Ahrefs 300 mil domínios |
| Schema/JSON-LD sozinho | **zero** | Ahrefs 1.885 páginas |

**Brasil (o que muda em português):** o ChatGPT tem ~99% do tráfego de IA
generativa; no único estudo em pt-BR (Ranqia, 3,1 M de citações) **61% da
influência vem do site da própria empresa** e só 2,6% de social — ou seja, em
português o próprio site pesa mais que nos estudos americanos, e diretórios
são secundários. Canaltech é o 15º domínio mais usado pelo ChatGPT no Brasil.
Domínios `.com.br` quase não aparecem nos rankings globais. **Gemini e AI
Overviews** saem do índice do Google (só 38% das citações do AIO vêm do
top-10). **Perplexity** tem índice próprio e é a que mais cita Reddit.

**"Ser citado" ≠ "ser recomendado":** só 6-27% das marcas mais mencionadas
são também fontes. Para recomendar UM produto a IA pesa preço, avaliações e
adequação ao caso ("melhor para"); com specs iguais, recomenda a marca
conhecida 100% das vezes. Recomendação move tráfego real: 2,5× mais visitas.

**Dois limites honestos:** todos os estudos são correlacionais e centrados em
inglês; os padrões mudam em semanas (Reddit caiu de 60% para 10% das
respostas do ChatGPT em um mês). Por isso a medição própria (seção 8) manda
mais que qualquer número daqui.

---

## 3. O que estava errado do nosso lado e foi consertado hoje (18/09)

Tudo em `develop`, commits `5322852` e `f287836`, testes verdes (3.688), build
do dashboard verde. Detalhe no AGENTS.md, seção "Robôs de IA barrados no WAF".

| Achado | Prova | Conserto | Guarda |
|---|---|---|---|
| `og:image` de 7 templates (inclusive as 5 páginas de loja) apontava para `/api/public/og`, rota que nunca existiu — **404 em produção**; home sem imagem | `curl` 404 | `dashboard/public/og-default.png` (1200×630) + `buildOgImageUrl` + home/layout | `test/og-image-existe.test.js` |
| `/api/public/faq` e `/api/public/plans` (abertos para as IAs) diziam **4 lojas**; a home hidratava com esse texto | `curl` em produção | migration DML guardada (só troca linha ainda igual ao seed) | `test/public-faq-plans-sync.test.js` |
| Home "4 lojas, mais chegando"; título da comercial que mais converte, 3 comparativos e 1 post com "4 lojas" | grep | 6 lojas, títulos mantêm o padrão com número | `test/inbound-titulos-clique.test.js` |
| `llms.txt` em inglês, sem preço, sem lojas, sem as páginas que convertem; Perplexity preenchia nosso preço com o de concorrente | leitura | reescrito (resumo pt-BR, preços, 6 lojas, Tier 1, /precos, comparações) | `test/llms-txt-sync.test.js` (toda URL existe no registro) |
| `/alternativas/*` e blog (47% das impressões) não mediam chegada por IA nem gravavam a landing do cadastro; Tier 1 caía em "Direto / ambíguo" | código | `PublicReferralTracker`; `signupOrigin` reconhece Tier 1 e páginas de 11/09; grok/deepseek/meta/mistral | `test/referral-tracking-cobertura.test.js`, `test/admin-funnel.test.js` |
| Schema: `WebSite` com codinome `WABOT`; LPs com `alternateName` igual ao nome; `/precos` com 4 lojas; páginas de loja sem data | grep | `WebSite #website`, `@id`, `inLanguage`, `featureList`; datas | `validate:seo-consistency` |
| **GPTBot e ClaudeBot com 403 no WAF** (robots.txt limpo); checagem mensal só olhava o robots.txt | `curl -A` ao vivo, 24 UAs × 3 caminhos | `scripts/diag-acesso-robos-ia.mjs` + regra pura + checagem mensal em 2 níveis | `test/ops-ai-bot-access.test.js` |
| Template de PR mandava usar "BOTinho" como marca principal | leitura | regra atual | — |

⚠️ **A migration e o `og-default.png` só valem em produção depois de
`develop → main`.** Em staging valem no próximo deploy automático.

---

## 4. O que só você pode fazer — em ordem, com prazo

### 4.1 Esta semana (sem código)

| # | Ação | Por quê (evidência) | Como | Tempo |
|---|---|---|---|---|
| 1 | **Pedir inclusão no listicle do ofertasbot.com** ("os 14 melhores bots de ofertas para afiliados") | é a ÚNICA página de terceiro na SERP de "bot para afiliados no WhatsApp" (nas 4 buscas), apareceu em ~metade das 40 buscas da varredura, foi atualizada em 01/08/2026 (ele atualiza), 10 dos 14 listados foram citados pelas IAs; ação 12 do plano de 01/09, nunca executada | e-mail para `shodirodrigo@gmail.com` (autor: Rodrigo Sumioshi, fundador do PromoBot) com cópia no Telegram `@ofertasbotalert` e LinkedIn `/in/rodrigosumioshi`, no formato da tabela dele: nome, 6 lojas, R$39/R$69, 7 dias grátis sem cartão, grupos ilimitados, tipo "espelhador + ofertas automáticas". Oferecer em troca ficha datada do PromoBot na nossa página | 1 h |
| 2 | **Decidir o GPTBot/ClaudeBot na Cloudflare** | 403 medido ao vivo em 24 nomes de robô; robô de treino barrado = a marca não entra no próximo modelo; concorrente que libera, entra | Cloudflare → espelhagrupos.com.br → **AI Crawl Control → Crawlers** → GPTBot: Allow; ClaudeBot: Allow (pode manter CCBot/Bytespider em Block). Se o painel mostrar "Block AI bots" legado, desligar. Depois: `node scripts/diag-acesso-robos-ia.mjs` — GPTBot tem que sair de 403 | 10 min |
| 3 | **Reclame Aqui: reivindicar o perfil da empresa (CNPJ)** e responder tudo em ≤24h | grátis; responde direto à consulta "espelha grupos é confiável" (Trilha B); nenhum dos 8 concorrentes mais citados tem perfil — primeiro a chegar; já aparece na SERP da maior consulta do site ("achadinho pro"); sem perfil, a primeira reclamação de terceiro cria a página sem a nossa descrição | `solucoes.reclameaqui.com.br/cadastro-empresa` com o texto-padrão da seção 4.2 | 1 h |
| 4 | **Renomear o canal do YouTube** de `@botinhoafiliado` para Espelha Grupos e pôr nome + preço + site na descrição de cada vídeo | menção em YouTube é o sinal mais forte (0,737) e lidera Perplexity (31%) e AI Overviews (21%) — as duas em que estamos em 0; o canal hoje carrega o nome aposentado | YouTube Studio → Personalização; descrição padrão = texto-padrão da 4.2 | 20 min |
| 5 | **Verificar o site no Bing Webmaster Tools** e ligar o relatório "AI Performance" | ChatGPT Search recupera via Bing; nunca conferimos se as 93 rotas estão no índice do Bing (não deu para medir de fora: o Bing serve página genérica sem sessão) | bing.com/webmasters → importar do Search Console → enviar sitemap → anotar páginas indexadas | 30 min |
| 6 | **Fechar a fila de indexação** — os 23 endereços pendentes + os lotes B e D que a fila de 11/09 esqueceu (`/padronizar-divulgacao-afiliado-whatsapp`, melhor CTR do site, e mais 4) | metodologia com 1 impressão vira alucinação; Tier 1 zerado por 9 dias por falta de pedido | Search Console → Inspeção de URL → 10/dia; registrar o veredito das 4 páginas do Dia 1 (venceu 18/09) em `ACOES_FLAVIA_2026-09-11.md` | 3 dias × 15 min |
| 7 | **Rodar a rodada COMPLETA do roteiro de medição** (10 consultas × 4 superfícies, conta neutra, ChatGPT com busca) | não existe dado depois de 11/09; a Trilha A nunca foi medida com o site atual; sem linha de base nada abaixo é avaliável | `ROTEIRO_MEDICAO_IA.md`; registrar Trilha C como `contaminacao`; anotar QUEM foi citado e a URL | 2 h |

### 4.2 Próximas 4 semanas (presença em terceiros — a alavanca nunca puxada)

**Texto-padrão (62 palavras), idêntico em TODO lugar — é o que amarra a
entidade; nome, domínio e números nunca mudam; nunca "BOTinho" sozinho; nunca
"não bane":**

> Espelha Grupos é um software web brasileiro para afiliadas e admins de grupos
> de WhatsApp. Espelha ofertas de grupos e canais de origem para os seus grupos,
> troca cada link pelo seu código de afiliada (Shopee, Mercado Livre, Amazon,
> Magalu, SHEIN, AliExpress) e publica com filas, intervalos e histórico de
> envios. Teste grátis de 7 dias; Pro R$69 por 30 dias. espelhagrupos.com.br

**Camada 1 — onde a evidência desta categoria aponta (fazer primeiro):**

| # | Ação | Por quê | Como |
|---|---|---|---|
| 8 | **Criadores pequenos do YouTube que já fazem "bot para grupo de achadinhos"**: oferecer teste estendido + comissão de afiliada (o programa já existe: 30% recorrente, PIX) e pedir o nome "Espelha Grupos" no TÍTULO | o AI Overviews embutiu vídeos do YouTube na resposta de "bot para afiliados" (CSV 01/09); o único vídeo de terceiro com nome de produto no título é do DisparaPromo; nenhum título cita Espelha Grupos | Cintya Clemente (`6aI-KsGRhlY`), Patricia Angelo - MKT Digital com IA (`BaAJckFTzfU`), Henrique Hard (`ovq0bVws4DM`), CUPONS DE DESCONTOS & PROMOÇÕES (`bfTRcDzOMbY`), Mayara Prado (`02apCIdAAi4`), DICASDOSANDRO (`bShY5gsICbI`, "COMO FAZER ESPELHAMENTO NO WHATSAPP"), Denise Souza (hoje ensina Pro Afiliados). Contato pela descrição/Instagram do canal |
| 9 | **1 vídeo curto por semana no canal renomeado**, título = a pergunta que a IA recebe | sinal mais forte medido; consulta "espelhar mensagens ENTRE grupos" não tem NENHUM vídeo (só "espelhar WhatsApp em dois celulares") | "Como espelhar mensagens entre grupos de WhatsApp (sem API)", "Bot para afiliados no WhatsApp: como funciona (Espelha Grupos)", "Testei 5 automações para afiliado Shopee no WhatsApp"; legenda pt-BR; descrição = texto-padrão |
| 10 | **3-5 TikToks de tela do painel** (QR → escolher grupos → oferta convertida) com "Espelha Grupos" e "espelhamento de grupos" na legenda | o TikTok gera páginas `/discover/<termo>` indexadas — Shozap e GoGoBot já têm as delas sem esforço; nenhuma existe para nós | conta própria; formato de `@ofertivaapp` e `@achadinhoprobr` |
| 11 | **Repositório PÚBLICO no GitHub** (`espelhagrupos/docs`: glossário do espelhamento, metodologia de uso responsável, exemplos de mensagem convertida) com README "Espelha Grupos é o robô de espelhamento de grupos de WhatsApp para afiliadas" | READMEs do GitHub aparecem na página 1 de quase toda busca do tema; o ChatGPT citou OfertaFlux, cuja única existência viva é um README | 2-3 h; não abre o código do produto |
| 12 | **Guest-parágrafo nas duas páginas de terceiro com autoridade que já ranqueiam e não citam ferramenta nenhuma** | superfrete.com/blog/grupos-vendas-whatsapp (1º na busca exata de "ferramenta para divulgar ofertas") e remessaonline.com.br/blog/grupo-de-promocoes-no-whatsapp (08/2026) têm seções "Potencialize seus grupos" / "Vale a pena automatizar?" sem produto citado | pitch ao editor: um parágrafo nomeando o Espelha Grupos como exemplo de espelhador com conversão de link de afiliada |
| 13 | **Fichas datadas dos concorrentes que as IAs mais citam e não têm ficha** (print de preço + data → `competitors-data.js`): Afilira, Ofertiva, GoGoBot, Afiliado Analytics, Afiliados Pro Bot, Whats.Ly, PromoBot, Pai das Ofertas, DisparaPromo, Growify | sem ficha não pode citar preço (FR-031); a varredura já coletou os preços (seção 5.2) — falta o print | 1 sessão de dados |

**Camada 2 — evidência geral forte, evidência na categoria fraca (custo zero, depois da camada 1):**

| # | Ação | Por quê | Como |
|---|---|---|---|
| 14 | **Página da empresa no LinkedIn + 1 artigo Pulse por semana** assinado por você | LinkedIn = 14% das respostas do ChatGPT Search; artigos Pulse são 50-66% das citações de LinkedIn; mediana de só 15-25 reações basta | 2 h setup + 2 h/semana; texto-padrão + CNPJ |
| 15 | **Medium**: republicar (com canonical) os 4-6 posts do blog com mais impressão | Medium é top-3 do ChatGPT (Semrush) e o maior "gainer" pós-09/2025; canonical não canibaliza | 3 h |
| 16 | **Quora em português**: responder as perguntas já indexadas ("Como ser afiliado Shopee?", "Como vender bem no Shopee como afiliado?") com resposta educativa completa e UMA menção contextual | perguntas existem e estão indexadas; multiplicador 4,1× no ChatGPT (Contently). **Reddit em pt-BR não tem thread nenhuma sobre o tema** (3 buscas) — não criar thread promocional | 30 min por resposta |
| 17 | **Comunidades oficiais no Telegram** ("Criadores e Afiliados \| Shopee Brasil Oficial", "Afiliados e Criadores Mercado Livre Brasil"): publicar o checklist gratuito de revisão de link — conteúdo, não anúncio, com autorização do admin | é onde a demanda está (33-58 mil acessos por grupo); canais públicos `t.me/s/` são indexados; prioridade A em `ai_seo_presence_targets.csv` desde 05/2026 | 1 h/semana |

**Camada 3 — só depois (e o que NÃO fazer):**

- **G2** (único diretório de software presente nos rankings de citação;
  listagem grátis com e-mail `@espelhagrupos.com.br`; desde 02/2026 o mesmo
  painel cobre Capterra/GetApp/Software Advice, com diretório em português
  "Software para Marketing de Afiliados" **vazio de concorrentes**) — depois
  de ter 5+ clientes pagantes dispostas a avaliar. Nunca avaliação fabricada.
- **Pitch de pauta com dado próprio** (ex.: "43% dos cadastros vêm do
  ChatGPT") para Canaltech (15º domínio mais usado pelo ChatGPT no Brasil),
  Startupi (`contato@startupi.com.br`) e E-Commerce Brasil — é o que destrava
  o Wikidata (que exige cobertura independente; press release, LinkedIn e
  Crunchbase não contam).
- **Não existe "avaliação no Google"**: o Google Business Profile é inelegível
  para negócio 100% online, e o Bing Places exige endereço físico. Apagar
  essa ideia de qualquer plano.
- **Não pagar** BetaList (US$29-129) nem There's An AI For That (US$49-347;
  o produto não é "AI tool"). **Não gastar tempo** com Product Hunt,
  AlternativeTo, SaaSHub, Crunchbase, B2B Stack agora: zero dos 8
  concorrentes citados está lá, e as IAs não os acharam lá.

### 4.3 Decisões em aberto (trade-off explícito)

- **Liberar GPTBot/ClaudeBot** — ganha: a marca pode entrar no corpus do
  próximo modelo. Perde: o conteúdo público (que já é público) alimenta
  treino. Não muda nada no curto prazo.
- **Páginas novas de resposta (seção 6, itens 1-3) × a regra de 11/09 "não
  produzir mais páginas de comparação até a Issue 2 decidir".** A regra nasceu
  de dado real (comparação converte 0%). A varredura de hoje mostrou o outro
  lado: os concorrentes mais citados são citados **das próprias páginas** com
  título igual à pergunta, e as 3 consultas medidas não têm página nossa que
  responda de frente. Recomendação: fazer as 3 páginas de resposta **com o
  bloco de conversão já embutido** (preço, "melhor para", CTA para a
  comercial), e não mais páginas "Alternativa ao X". Decisão sua.
- **Regra de escrita do nome antigo** — `PLANO_ISSUES_2026-09-10` manda
  "nunca emparelhar"; o commit e3f5273 escreveu "BOTinho é o nome do robô do
  Espelha Grupos" em 3 páginas. Escolher UMA regra e medir com a Trilha C.
- **As 5 rotas com "botinho" no endereço** (27 impressões, 1 clique) —
  renomear com redirect ou manter.
- **LTV** — nunca medido; bloqueia por regra própria a decisão de anúncio.

---

## 5. Onde os concorrentes aparecem e nós não (varredura de 18/09)

### 5.1 O mapa

| Lugar | Quem está | Nós | O que fazer |
|---|---|---|---|
| **Listicle ofertasbot.com** "14 melhores bots" (PromoBot, autor Rodrigo Sumioshi, atualizado 01/08/2026) | PromoBot, Divulgador Inteligente, Pro Afiliados, Pai das Ofertas, Shozap, DivulgaLinks, Afiliado Inteligente, Bot do Afiliado, Busqy, Gigi Prime Bot, Guru das Promoções, Divulga Ninja, FluxoPromo, Achadinho Pro | **não** | item 1 da 4.1 |
| **Comparativo achadinhopro.com.br** "melhores ferramentas para afiliados Shopee 2026" (#1 nas 4 buscas de "melhor automação para afiliado shopee") | ProAfiliados, IA Divulgadora, Shozap, TrocaLink, Linqor, Easyfy, Achadinho Pro | não | concorrente direto; pedir é possível, aceitar é improvável — o caminho é a nossa própria página (seção 6) |
| **nexoafiliados.com** ("blog de terceiro") | Pro Afiliados | — | **é satélite**: mesmo CNPJ do Pro Afiliados (50.135.013/0001-46). Registrar isso na nossa `/alternativas/proafiliados` |
| **YouTube** (criadores pequenos) | Pro Afiliados (canal próprio + canal de terceira "Denise Souza"), DisparaPromo (único com nome no título de vídeo de terceiro), Host2b, Afiliados Pro Bot | **0** | itens 4, 8, 9 |
| **TikTok `/discover/`** (páginas indexadas geradas de hashtag) | Shozap, GoGoBot, "bot pra whatsapp de achadinhos shopee", "guru das promoções" | 0 | item 10 |
| **GitHub** (READMEs e docs de pesquisa de outros devs) | Pro Afiliados, Afilira, Achadinho Pro, OfertaFlux (só existe lá — o domínio caiu) | 0 fora do nosso repo | item 11 |
| **Reclame Aqui** | só a página automática de proafiliados.com | 0 | item 3 |
| B2B Stack, Capterra/GetApp BR, G2, Product Hunt, AlternativeTo, SaaSHub, AppSumo, Reddit, Quora, LinkedIn, Trustpilot, Wikipedia, notícias, Hotmart | **nenhum dos 8 mais citados** | 0 | não é onde a IA acha esta categoria (camada 3) |

**A correlação que muda a leitura:** Pro Afiliados, Shozap e Achadinho Pro
(com presença de terceiros) e Afilira, Ofertiva e Afiliado Analytics (com
**zero** presença de terceiros) têm o MESMO patamar de citação (9-11 vs 5-10).
O que os 6 têm em comum: site com muitas páginas por loja × canal, título
igual à pergunta, preço na página e nome único sem colisão. Os 2 com colisão
de nome (GoGoBot = app de viagens na Wikipedia; Growify = agências) ficam
abaixo — o mesmo "BOTinho = calçado" que já medimos. **Isso bate com o único
estudo em pt-BR (Ranqia): 61% da influência vem do site da própria empresa.**
Ou seja: terceiros abrem Gemini/Perplexity/AIO; o próprio site, quando responde
a pergunta de frente, é o que o ChatGPT lê.

### 5.2 Preços coletados na varredura (para virar ficha datada — print antes de citar)

| Concorrente | Planos (visto em 18/09) | Contato/entidade |
|---|---|---|
| Pro Afiliados | Grátis / Premium R$50 / Premium Plus R$100 (PIX) | proafiliados.com, .com.br, nexoafiliados.com (mesmo CNPJ) |
| Achadinho Pro | Basic R$49,97 (só Shopee) / Pro R$59,97; 7 dias grátis | achadinhopro.com.br |
| Shozap | preço **não visível** no site ("Carregando planos…"); terceiros divergem (R$50-300 / R$50-150 / R$69,90-169,90) — **não citar** | shozap.com.br; extensão na Chrome Web Store |
| Afilira | Starter R$47 / Professional R$97 / Enterprise R$197 | afilira.com; CNPJ 66.579.767/0001-25 |
| Ofertiva | Essencial R$39,90 / Profissional R$69,90 / Escala R$139,90 | ofertiva.app.br; CNPJ 60.077.357/0001-08 |
| Afiliado Analytics | R$47,90 / 127,90 / 197,90 (trial 3 dias) | afiliadoanalytics.com.br |
| Growify | R$39,90 / 79,90 / 149,90 | growify.pro |
| GoGoBot | GO grátis (1 grupo) / PLUS R$37 / MAX R$47 | gogobot.com.br |
| DisparaPromo | Essencial R$39,99 / Max R$66,99 / Ultra R$129,99; 10 lojas | lp.disparapromo.com.br |
| PromoBot | R$47-197 | ofertasbot.com |
| Pai das Ofertas | R$35,90-75,90 | paidasofertas.com |
| LucreShop | a partir de R$29,90; teste 3 dias | lucreshop.com.br |
| OfertaFlux | **domínio fora do ar em 18/09** — o ChatGPT cita produto morto | — |

Nomes novos sem ficha (só nome + URL + data, para a medição mensal): Linqor,
TrocaLink, Easyfy, Send2x, Devzapp, AfiliBot, Automatisa Grupos, HypeFlow,
Botize, Afilialink, Zap Multigrupos, Afiliados Pro Bot, AchadinBot, Host2b,
Bot do Afiliado, Guru das Promoções, ActiveZap, IA Divulgadora, Promoenvia,
AutoProd, GeekZap, Boter.

### 5.3 O que cada busca real mostrou (quem vence e por quê)

| Consulta | Quem vence hoje | Por quê | Nós | O que ganharia |
|---|---|---|---|---|
| **bot para afiliados no WhatsApp** | Pro Afiliados (4 URLs na SERP: .com ×2, .com.br, canal do YouTube) | título igual à consulta + "Grátis"; FAQ; páginas "vs" nomeando concorrentes | `/bot-afiliados-whatsapp` (CTR 10%!) **não apareceu em nenhuma das 4 buscas** | (1) o listicle; (2) reescrever a nossa página: título "Bot de afiliados para WhatsApp: espelha grupos e converte links (R$69/mês, 7 dias grátis)", H1 igual, FAQ com schema (Afilira tem, nós não temos nessa página), tabela de preço em HTML estático, bloco "Espelha Grupos vs Pro Afiliados / Afilira / Achadinho Pro" linkando as `/alternativas` que já existem |
| **como espelhar mensagens entre grupos de WhatsApp** | Promium (`/replicador-grupos-whatsapp`) — o único que responde à intenção | o resto é doc oficial do WhatsApp (encaminhar/fixar) e tutoriais genéricos; Gemini/Perplexity/AIO respondem com API/gambiarra (GREEN-API, Z-API, n8n) | só na busca com o nome; o hub tem H1 "Espelhar grupos do WhatsApp sem programar", que não contém "mensagens entre grupos" | página de RESPOSTA `/blog/como-espelhar-mensagens-entre-grupos-de-whatsapp` com título exato, tabela dos 4 caminhos (encaminhar manual com limite de 5, Cloud API não lê grupo comum, API não-oficial + n8n exige servidor, produto pronto: Promium × Espelha Grupos com preço), seção "isso dá banimento?" de frente (o AIO emoldura a categoria como risco), HowTo + FAQ. **Consulta VAZIA fora do site**: nenhum vídeo, nenhum tópico — um vídeo com esse título seria a única fonte de terceiro |
| **melhor automação para afiliado shopee no whatsapp** | listicle do Achadinho Pro (#1 nas 4 buscas) | "melhores ferramentas … 2026" + tabela comparativa; o resto são landings "Automação Shopee para WhatsApp" (ActiveZap, TrocaLink, Promium, IA Divulgadora, Shozap) | não aparecemos em nenhum dos ~13 resultados; `/melhores-bots-para-afiliados-whatsapp` é guia de critérios sem Shopee no título, sem ano, sem tabela | página "Melhores automações para afiliado Shopee no WhatsApp em 2026: 8 ferramentas comparadas (preço, lojas, espelhamento)" com tabela (só quem tem ficha), data visível, ItemList + FAQ; vídeo "Testei 5 automações…" (vídeo ocupou a posição 2 da busca "melhores") |
| **ferramenta para divulgar ofertas em grupos de WhatsApp** | ninguém de terceiro: blogs dos próprios fornecedores (AutoProd em 3/4 buscas, Devzapp 3/5, Promoenvia, LucreShop, GeekZap) com "guia completo" + 2026 | as duas páginas de terceiro com autoridade (superfrete, remessaonline) **não citam ferramenta nenhuma** | só na busca com o nome | guia longo "Ferramenta para divulgar ofertas em grupos de WhatsApp: as 6 opções comparadas (2026)" + guest-parágrafo nas duas páginas de terceiro (item 12) |

Em NENHUMA das 4 consultas existe página de terceiro que mencione Espelha
Grupos, espelhagrupos.com.br ou BOTinho (20 páginas abertas e conferidas).

---

## 6. O que fazer no código nas próximas semanas (ranqueado)

| # | O quê | Por quê | Onde |
|---|---|---|---|
| 1 | **Reescrever `/bot-afiliados-whatsapp`** no formato que vence a SERP: título com a consulta literal + preço + teste, H1 igual, FAQ com schema `FAQPage`, tabela de preço estática, bloco "vs" linkando as `/alternativas` existentes, "melhor para" | a página tem CTR 10% quando aparece e não apareceu em nenhuma busca; Afilira e Pro Afiliados vencem exatamente com esse formato | `_preservationCommercialPages.js` |
| 2 | **3 páginas de RESPOSTA** (decisão em 4.3): "como espelhar mensagens entre grupos" (HowTo + tabela dos 4 caminhos), "melhores automações para afiliado Shopee 2026" (ItemList), "ferramenta para divulgar ofertas em grupos 2026" — cada uma com bloco de conversão e linkada de 3 páginas com impressão (`/alternativas/achadinhos-bot` 4.930 imp., `/bot-achadinhos-whatsapp` 2.514, `/blog/como-divulgar-ofertas-amazon-whatsapp`) | são as perguntas que a IA recebe e não temos página que responda de frente; consultas 2 e 4 estão vazias de terceiros | `/blog/*`, `_comparisonContent.js` |
| 3 | **"Melhor para <caso>" + prova de terceiros em cada página comercial** | a IA recomenda por adequação; 0 ocorrências hoje | comerciais, Tier 1 |
| 4 | **Topo das 20 páginas prioritárias no padrão citado**: resposta afirmativa nas 3 primeiras linhas (o que é, para quem, quanto custa), 1-2 números próprios com fonte, 1 citação entre aspas, cabeçalho em pergunta, seções de 120-180 palavras | 44% das citações vêm dos primeiros 30%; +28-43% com estatística/quote | comerciais, Tier 1, `/espelha-grupos-e-confiavel`, `/metodologia` |
| 5 | **Frescor programático**: "Atualizado em" visível + `dateModified` em TODAS as 93 rotas (29 sem data) e ciclo trimestral das comerciais | citado é 25,7% mais novo; página parada perde citação | `editorial-content.js`, templates |
| 6 | **Fichas + nota na `/alternativas/proafiliados`** (nexoafiliados = mesmo CNPJ) e ficha do OfertaFlux "fora do ar" | regra FR-031; evidência de que o ChatGPT cita produto morto | `competitors-data.js` |
| 7 | **Validadores SEO no gate** (`validate:seo-consistency`, `validate:editorial-freshness`) | foi assim que as 5 Tier 1 entraram sem data | `package.json` |
| 8 | **Validador do CSV de medição** (Issue 8) | um "SIM" maiúsculo zerou o placar de 01/09 | `scripts/` + teste |
| 9 | **LTV/retenção read-only** | destrava anúncio | script irmão do `diag-origem-cadastros` |
| 10 | `sameAs` com os perfis reais criados (YouTube renomeado, LinkedIn, TikTok, GitHub) | consistência de entidade | `marketing-content.js:81-84` |

---

## 7. O que NÃO fazer (derrubado por dado)

- Página nova por **cidade** (15 páginas: ~25 impressões em 2,5 meses),
  **nicho** (12: 127 impressões, 5 cliques), cluster "robô", "automação
  whatsapp"/"disparo em massa", "espelhamento de grupos" como porta de entrada
  (abaixo do piso do Planejador; a vizinhança é "espelhar WhatsApp em outro
  celular").
- **Mais páginas "Alternativa ao X"** sem bloco de conversão (0% de cadastro
  com 47% das impressões).
- **Criar as páginas do Tier 1** — existem desde 02/09.
- **Medir "BOTinho"** como marca (é Trilha C, contaminação).
- **Prometer "não bane"** — é o que as IAs elogiam (Gemini: "modelo sem
  promessas irrealistas"; ChatGPT: 7,5/10 pela transparência).
- **Avaliação fabricada, review falso, thread promocional, spam em
  comunidade** — proibido, e a Perplexity já verificou "não há indícios de
  golpe": isso é o ativo.
- **Diretórios em massa e diretórios pagos** — nenhum dos 8 concorrentes
  citados está em diretório; G2 só quando houver avaliações reais.
- **Anúncio antes de medir LTV.**
- **Mais `llms.txt` e schema como alavanca** — manter o que existe.
- **Citar preço de concorrente sem ficha datada** (FR-031) — Shozap nem tem
  preço visível.

---

## 8. Como saber em 30 dias se funcionou

| Sinal | Hoje | Meta 18/10 | Onde medir |
|---|---|---|---|
| ChatGPT Search, Trilha A (categoria), conta neutra | 3/7 (10/09) | ≥ 5/7 | `ROTEIRO_MEDICAO_IA.md` → CSV |
| Gemini / Perplexity / AI Overviews, Trilha A | 0 | ≥ 1 cada | idem |
| "espelha grupos whatsapp o que é" | 0/4 | ≥ 2/4 | idem |
| Menções de terceiros ao Espelha Grupos | 0 | ≥ 3 (listicle, 1 vídeo com nome no título, Reclame Aqui) | busca pelo nome; `ai_seo_presence_targets.csv` |
| Cadastros com carimbo de IA / mês | 42 | 60 | `node scripts/diag-origem-cadastros.mjs` |
| Cadastros vindos de `/alternativas` e blog com origem medida | 0 (não media) | > 0 | idem (tracker novo) |
| Robôs de busca com 200 | ok | ok | `node scripts/diag-acesso-robos-ia.mjs` |
| Bing: páginas indexadas | não medido | 93 | Bing Webmaster Tools |
| `/bot-afiliados-whatsapp` aparece na busca "bot para afiliados no WhatsApp" | não | sim (top-10) | busca em janela anônima |

Rodar tudo em conta neutra. Rodada logada não entra no placar.

---

## 9. Fontes da mecânica (lidas em 18/09/2026)

- OpenAI, bots: https://developers.openai.com/api/docs/bots
- Cloudflare, AI Crawl Control e categorias de robô: https://developers.cloudflare.com/ai-crawl-control/reference/bots/ ; https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/
- Ahrefs — por que o ChatGPT cita páginas (1,4 M prompts): https://ahrefs.com/blog/why-chatgpt-cites-pages/
- Ahrefs — correlações de visibilidade em IA (YouTube 0,737): https://ahrefs.com/blog/ai-brand-visibility-correlations
- Ahrefs — listas "melhores X" (43,8%): https://ahrefs.com/blog/best-lists-research/
- Ahrefs — frescor: https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content
- Ahrefs — `llms.txt` (300 mil domínios): https://ahrefs.com/blog/llmstxt-study/ ; schema: https://ahrefs.com/blog/schema-ai-citations/
- AirOps — 2026 State of AI Search (6,5× via terceiros): https://www.airops.com/report/the-2026-state-of-ai-search
- Semrush — estudo de visibilidade (menção ≠ fonte): https://www.semrush.com/blog/ai-search-visibility-study-findings/ ; LinkedIn: https://www.semrush.com/blog/linkedin-ai-visibility-study/
- Ranqia — quem influencia o ChatGPT no Brasil (3,1 M citações, pt-BR): https://www.ranqia.ai/papers/quem-influencia-o-chatgpt-no-brasil-2026/
- Profound — Brasil (Reddit 9%): https://www.tryprofound.com/reports-guides/comportamento-de-prompts-e-citacoes-no-brasil
- Paper GEO (KDD 2024): https://arxiv.org/abs/2311.09735
- Bing — AI Performance no Webmaster Tools: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- Google — recursos de IA na Busca (sem markup especial): https://developers.google.com/search/docs/appearance/ai-features ; Business Profile inelegível para negócio só online: https://support.google.com/business/answer/13763036
- Perplexity — bots: https://docs.perplexity.ai/guides/bots
- Listicle que domina a categoria: https://ofertasbot.com/blog/melhores-bots-de-ofertas-para-afiliados
- Comparativo do Achadinho Pro: https://achadinhopro.com.br/blog/melhores-ferramentas-afiliados-shopee-2026
