# SEO + GEO — As-Is, To-Be, GAP e plano corretivo (2026-10-02)

Relatório fechado só com dado coletado em 02/10/2026. Nada aqui é estimativa.
Quando um dado faltou, está dito na seção 7. Decisões já congeladas em
`docs/rca/seo-marketing.md` (cidade, nicho, "robô", "espelhamento",
"automação whatsapp" genérico, mais `/alternativas/*`) não foram reabertas:
este relatório as **confirma** com dado novo.

## 0. Resumo em 8 linhas

1. **Funcionalidade não é porta de entrada.** 103 dos 116 termos de
   funcionalidade do CSV têm menos de 10 buscas/mês no Planejador. As 70
   funcionalidades são argumento de venda dentro da página, não título.
2. **Onde há busca, o site não está:** `afiliado netshoes` 5.000/mês,
   `afiliado kabum` 500, `rakuten afiliados` 500, `limite de membros grupo
   whatsapp` 500, `quanto ganha afiliado shopee` 500 — todos concorrência
   baixa. O produto converte Netshoes (Rakuten) e KaBuM (Awin) e tem Link
   Inteligente para grupo cheio, mas o site diz "6 lojas" e não tem página
   para nenhum desses termos.
3. **95% das impressões com consulta identificada são marca de concorrente**
   (`achadinho pro` 4.317, `achadinhos bot` 689, `shozap` 445…), com CTR
   abaixo de 1,4%. A busca pela nossa marca é 88 impressões.
4. **O ChatGPT já é o 1º canal de cadastro fora da marca: 27% (92 de 343)**
   em 90 dias. Mas em janela anônima ele **não reconhece o nome** ("pode ser
   uma ferramenta ou a descrição de uma função") e **não nos cita** em "melhor
   bot para afiliado Shopee" (cita Ofertiva e Drope). Só nos cita quando é
   mandado pesquisar — e aí nos põe em 1º para espelhamento.
5. **A Visão geral de IA do Google** nos cita em "espelhar", "anti-ban" e
   na pergunta de marca; **omite** em "melhor bot Shopee" e "converter link
   automaticamente". Quando descreve o produto, repete "6 lojas" e ignora
   Awin/Rakuten — é o nosso próprio texto voltando.
6. **Vocabulário do mercado** (Autocomplete + PAA + YouTube + 8 concorrentes):
   "bot de afiliados", "automação para afiliados (Shopee)", "afiliado shopee
   no automático", "piloto automático", "24/7 na nuvem", "garimpo/radar",
   "lotar grupo", "grátis". "Espelhar" no Google é tela/Canva/SketchUp;
   "espelhamento de grupos" é jargão dos concorrentes, sem busca.
7. **Concorrentes anunciam igual entre si**: H1 "Bot de afiliados / Automação
   de promoções para afiliados no WhatsApp **e Telegram**", N lojas (12, 20+),
   "radar", "anti-ban", preço de entrada R$37–R$50 ou grátis. Quase ninguém
   paga anúncio no Google (só ProAfiliados/Afilira, mesmo dono, e Ofertiva).
   No Meta, Ofertiva e Shozap aparecem pelos anúncios **das clientes** (página
   na bio / landing de produto), não por anúncio próprio.
8. **O que já converte**: `/bot-achadinhos-whatsapp` (236 cliques, 6%),
   `/bot-afiliados-whatsapp` (92, 8,8%), home (280, 32%). 43% dos pagantes
   entraram por página de conteúdo. O padrão que funciona é "bot + público
   (afiliados/achadinhos) + whatsapp", não "bot + funcionalidade".

## 1. Fontes usadas (tudo de 02/10/2026)

| Dado | Fonte | Tamanho |
|---|---|---|
| Lista de funcionalidades | `FUNCIONALIDADES_PARA_PESQUISA_2026-10-02.csv` (70 linhas), conferida contra `src/converters/`, `src/core/`, painel | 70 func., 116 termos |
| Volume de busca | Planejador de Palavras-Chave, Brasil/PT, set/2025–ago/2026, 7 exports | 158 termos (114 dos 116) |
| Busca orgânica própria | Search Console, 3 meses: Consultas (309), Páginas (136), Cobertura | 925 cliques / 22.617 impr. (aba Páginas) |
| Origem de cadastros | `scripts/diag-origem-cadastros.mjs --dias 90` na VPS | 343 cadastros, 47 pagantes |
| Linguagem do cliente | Autocomplete (6 buscas), PAA/"Outras pessoas pesquisaram" (10 buscas), YouTube (1ª página de 2 buscas) | — |
| IA generativa | ChatGPT (5 perguntas, anônimo) + Visão geral de IA do Google (5) | 10 respostas |
| Concorrentes | Home + preços de Promium, ProAfiliados, Afilira, Achadinhos Pro, FluxoPromo, Shozap, GoGoBot, Ofertiva (`scratchpad/dados/concorrentes_8_2026-10-02.md`) | 8 sites, HTTP 200 |
| Anúncios | Google Ads Transparency + Meta Ad Library (8 nomes) | — |
| SERP | Top 10 anônimo de 8 termos | — |
| Bing | Bing Webmaster, 28/07–30/09 | 27 cliques / ~480 impr. (irrelevante) |

Fora de escopo por decisão da usuária: Gemini/Perplexity/Copilot e posts de
grupos/Reddit.

## 2. As-Is — o que fazemos × como apresentamos

### 2.1 Funcionalidades (70) × demanda de busca

Dos 116 termos de hipótese, só 11 passam do piso de 10 buscas/mês:

| Termo | Busca/mês | Conc. | Funcionalidade do CSV | Página hoje |
|---|---:|---|---|---|
| afiliado netshoes | 5.000 | Baixa | #29 Rakuten (Netshoes) | **nenhuma**; Rakuten só em nota do `llms.txt` |
| afiliado kabum | 500 | Baixa | #28 Awin (KaBuM) | **nenhuma** |
| rakuten afiliados | 500 | Baixa | #29 | **nenhuma** |
| afiliado rakuten | 50 | Baixa | #29 | nenhuma |
| limite de membros grupo whatsapp | 500 | Baixa | #54/#55 Link Inteligente + aviso de grupo cheio | **nenhuma** (recurso é PRO e só aparece no painel) |
| grupo whatsapp lotado | 50 | Baixa | #54/#55 | nenhuma |
| quanto ganha afiliado shopee | 500 | Baixa | #68 calculadora | `/quanto-ganha-afiliado-shopee` existe: 312 impr., **2 cliques (0,64%)**, posição 7,6 |
| evitar banimento whatsapp | 50 | **Alta** | #45–49 ritmo/aquecimento/risco | `/anti-ban-whatsapp` 165 impr., 4 cliques, pos. 10,4 |
| converter link shopee afiliado | 50 | Baixa | #22 | `/blog/como-converter-link-de-afiliado-automaticamente-whatsapp` 183 impr., 5 cliques |
| garimpo de ofertas | 50 | Baixa | #50 Garimpo Shopee | `/bot-que-busca-ofertas-shopee-whatsapp` (sem a palavra "garimpo" no título) |
| spintax whatsapp | 50 | Baixa | #39 Frases que variam (PRO) | nenhuma |

Os outros 103 (conectar por QR, reconexão, palavras bloqueadas, marca d'água,
filas, agendar, canais, comunidades, relatórios, Pix, reembolso, indicação…)
**não têm busca mensurável**. Continuam sendo o que vende dentro da página e o
que a IA usa para nos descrever — mas nenhum deles sustenta uma página própria.

### 2.2 Como o site se apresenta hoje (títulos e H1 reais, 02/10)

| Página | Título | H1 | Leitura |
|---|---|---|---|
| `/` | Espelha Grupos \| Bot para afiliados espelhar ofertas no WhatsApp | Chega de copiar e colar oferta uma por uma. 💜 | Dor certa; "espelhar" no título é a nossa palavra, não a do cliente |
| `/bot-afiliados-whatsapp` | Bot para Afiliados no WhatsApp: Shopee, Amazon e Mercado Livre | Bot para afiliados no WhatsApp: R$ 39 por 30 dias, 7 dias grátis | Melhor CTR do site (8,8%) |
| `/bot-achadinhos-whatsapp` | Bot de achadinhos no WhatsApp: 6 lojas, 7 dias grátis | Bot para achadinhos no WhatsApp: as ofertas saem sozinhas | Página que mais converte (236 cliques) |
| `/automacao-whatsapp-afiliados` | Automação de afiliados no WhatsApp: 3 modelos, 8 bots | idem | Não aparece no top 10 de "automação para afiliados" (Shozap é #1) |
| `/bot-que-busca-ofertas-shopee-whatsapp` | Bot que busca ofertas da Shopee sozinho no WhatsApp | idem | Mercado chama de "garimpo"/"radar" |
| `/precos` | Preços: quanto custa o robô de ofertas no WhatsApp | Quanto custa o robô de ofertas para WhatsApp? | "robô" (congelado) só aqui |
| `llms.txt` | "troca o link pelo seu código de afiliada em **6 lojas**… Também converte as lojas em que a afiliada é aprovada na Awin e na Rakuten" | — | A IA repete "6 lojas" e descarta a frase seguinte |

### 2.3 De onde vêm os cliques e os cadastros

Search Console, 3 meses (aba Páginas: 925 cliques / 22.617 impressões):

| Grupo de páginas | Páginas | Impressões | Cliques | CTR |
|---|---:|---:|---:|---:|
| `/alternativas/*` | 24 | 10.046 (44%) | 151 | 1,5% |
| `/blog/*` | 23 | 2.971 | 51 | 1,7% |
| Home | 1 | 873 | 280 | 32% |
| `/bot-achadinhos-whatsapp` + `/bot-afiliados-whatsapp` | 2 | 5.007 | 328 | 6,5% |

Consultas (309 identificadas, 9.357 impressões): **8.900 impressões (95%) são
nomes de concorrente**. Consultas genéricas com intenção de ferramenta somam
menos de 100 impressões (`bot para grupo de promoções` 11, `bot para grupo de
ofertas whatsapp` 8, `grupo de whatsapp que pode postar tudo` 37).

Cadastros (90 dias, 343): landing 66%, seo 18%, direct 8%, affiliate 7%.
**Por IA: ChatGPT 92 (27%)** via `utm_source=chatgpt.com`. Por tipo de página:
home 47%, página de conteúdo 34%. **Pagantes (47): 47% home, 43% conteúdo.**

Páginas com impressão e zero clique (diagnóstico pendente, ver seção 7):
`/programa-de-afiliados` 242 impr. (provável colisão com "programa de
afiliados shopee/ML" — a página é o nosso indique-e-ganhe),
`/blog/como-divulgar-ofertas-mercado-livre-whatsapp` 188,
`/amazon-afiliados-whatsapp` 113, `/blog/quanto-custa-bot-para-whatsapp-afiliados` 89.

Cobertura: 18 "rastreada, não indexada", 15 noindex (intencional), 9 canônica
alternativa, 1 bloqueada por robots. Sem erro crítico.

## 3. To-Be — como o mercado busca e como os concorrentes se posicionam

### 3.1 Como o cliente escreve (Autocomplete + PAA + YouTube)

| Entrada | O que o Google completa / pergunta | Intenção |
|---|---|---|
| `bot whatsapp afiliado` | bot afiliado whatsapp; bot afiliado; **bot afiliado shopee**; bot de promoções whatsapp; bot afiliado telegram; bot para grupo whatsapp **grátis**; bot afiliado mercado livre | ferramenta, por loja, grátis |
| `robô de ofertas` | robô de ofertas shopee / whatsapp; robô de promoções; **robô afiliado shopee**; achadinhos bot telegram; achadinhos pro; oferta inteligente | ferramenta; "robô" existe mas puxa marcas de concorrente |
| `automação shopee afiliado` | **automação para afiliados shopee**; afiliado shopee **automático** / **no automático**; automatização shopee; api shopee afiliados; busqy; divulgador inteligente shopee **gratuito** | ferramenta Shopee |
| `espelhar grupo` | telegram; whatsapp; **no sketchup**; **no canva**; grátis. PAA: "modo espelhamento no WhatsApp", "qual aplicativo espelha o WhatsApp" | mista: tela/design/espionagem — confirma congelamento |
| `grupo de achadinhos` | da shopee whatsapp; telegram; mercado livre; shein; **link de grupo** | consumidor querendo ENTRAR |
| `canal whatsapp ofertas` | amazon; promoções; melhores grupos de promoções | consumidor |
| PAA `afiliado amazon` | **Pode divulgar link de afiliado Amazon no WhatsApp?** | dúvida de afiliado iniciante — é nossa |
| PAA `automação para afiliados` | **Como automatizar afiliado Shopee?**; **Qual IA divulga links de afiliados?**; o marketing de afiliados é uma furada? | ferramenta |
| PAA `bot de ofertas whatsapp` | Qual o melhor bot para WhatsApp?; Qual o melhor robô divulgador **gratuito**? | lista/comparação |

YouTube (1ª página): títulos vencedores em caixa alta no padrão
"AFILIADO SHOPEE: COMO GERAR (GRÁTIS) ANÚNCIO AUTOMÁTICO PARA GRUPOS DE
WHATSAPP E TELEGRAM" (92 mil), "Como LOTAR grupos de achadinhos e vender no
automático" (120 mil), "Como enviar mensagem automática para grupos do
WhatsApp" (202 mil). Ferramentas com vídeo de terceiros: DivulgaNinja,
DivulgaLinks, GigiPrimeBot, AchadinhosBot, Afiliados Pro Bot, Sena Flow.
**Espelha Grupos: zero vídeos.**

### 3.2 Como os 8 concorrentes se anunciam (home, 02/10)

| | Título / H1 | Lojas | Canais | Preço de entrada | Arquitetura SEO |
|---|---|---|---|---|---|
| Promium | "Automação de Promoções no WhatsApp e Telegram para Afiliados" | 20+ (inclui Awin, Rakuten, TikTok Shop) | WA + TG | R$97,90 | 12× `/automacao-<loja>-whatsapp` |
| ProAfiliados | "Bot de Afiliados para WhatsApp e Telegram" / "Seu grupo de ofertas no piloto automático" | 12 (Awin, Lomadee, Rakuten) | WA + TG + Status | **Grátis** (2 h/dia), R$50, R$100 | `/bot-shopee-afiliados`, `/espelhar-grupos-whatsapp`, 11× `/alternativa/*`, blog "melhores bots" |
| Afilira | "Bot de Afiliados para WhatsApp e Telegram: ofertas 24/7" | 4 + AliExpress; Awin a partir do 2º plano | WA + TG | R$47 (conta grátis) | `/bot-<loja>-afiliados`, `/afilira-vs-pro-afiliados`, "anti-ban em todos os planos" |
| Achadinhos Pro | "Bot WhatsApp para Afiliados Shopee e Amazon" / "Seus grupos vendendo o dia inteiro. Sem você postar nada." | 3 | WA | R$49,97, 7 dias grátis | `/comparativo`, blog; **#1 em "bot de ofertas whatsapp" e #2 em "achadinhos"** |
| FluxoPromo | "Automatize sua operação de afiliados" (Telegram primeiro) | 12 | TG + WA | R$37 | `/<loja>`, `/automacao-telegram`, "vs" |
| Shozap | "Venda no automático" / "Automação para Afiliados" | 5 | WA + TG + IG | R$50 | nenhuma página interna; **#1 em "automação para afiliados"** |
| GoGoBot | "Automação de Ofertas no WhatsApp para Afiliados" | 5 (TikTok Shop) | WA | Grátis / R$37 / R$47, por convite | nenhuma |
| Ofertiva | "SUAS OFERTAS NO WHATSAPP. 100% NO AUTOMÁTICO." | 5 | WA | R$39,90, garantia 7 dias | `/marketplaces/*`, `/recursos/*` (radar, espelhamento, página na bio) |

Padrões que se repetem em 6 de 8: **"bot de afiliados" ou "automação para
afiliados" no H1**, "WhatsApp e Telegram", "piloto automático / 24/7 / na
nuvem", "N lojas", "radar/garimpo", "anti-ban/ritmo humano", preço de entrada
R$37–R$50 ou grátis. Nome das funcionalidades em frase de resultado ("Seu
link. Sempre.", "Digite air fryer. O robô acha e posta.", "Um link que enche
vários grupos").

Anúncios: Google Ads só ProAfiliados + Afilira (mesmo anunciante, Alan dos
Santos de Borba) e Ofertiva (1). Meta: Ofertiva tem 1 anúncio institucional
("Pare de perder tempo montando oferta por oferta… a partir de R$ 39,90/mês")
e **4 anúncios de clientes** usando `ofertiva.app.br/bio/<slug>` para lotar
grupo; Shozap aparece em 5 anúncios de uma cliente com landing
`shopee.shozap.com.br`. Ou seja: os concorrentes viram domínio de **tráfego
pago das clientes**, que é link para o site deles.

### 3.3 O que as IAs respondem hoje

| Pergunta | ChatGPT (anônimo) | Visão geral de IA do Google |
|---|---|---|
| melhor bot de ofertas para afiliado Shopee | Ofertiva, Drope CRM. **Sem nós.** Critério: "garimpo próprio > espelhar" | ProAfiliados, Achadinhos Pro, Shozap, DivulgaNinja, Afilira. **Sem nós.** |
| como espelhar grupos automaticamente | genérico; ao pesquisar: Fivee, AfiliTools, **Espelha Grupos (1º a testar)**, GoGoBot, Growify | Achadinhos Pro, ProAfiliados, IA Divulgadora, "Espelha Grupos / BotVaro" (fontes: nosso blog + reel) |
| converter link automaticamente | Easyfy, Afflink, PromoZap, Afilira, **Espelha Grupos** | PromoZap, Shozap, IA Divulgadora, Achadinhos Pro, DivulgaLinks. **Sem nós.** |
| evitar banimento | genérico, sem ferramenta | cita `/anti-ban-whatsapp` em "varie os textos" |
| o que é o Espelha Grupos | **não reconhece como marca** | reconhece: "software web para afiliados… **6 lojas**… busca Shopee no Pro… logs, cadência, revisão humana" |

Critérios que o ChatGPT usa para recomendar (texto dele): API oficial da
Shopee; **trava que não publica se a conversão falhar** (ele destacou a nossa);
quantos grupos monitora; controle de intervalo; **garimpo próprio além de
espelhar**; Sub-ID por grupo. O Google cita quem tem **página de lista**
(proafiliados.com/blog/melhores-bots…) e **vídeo no YouTube**.

## 4. Análise de GAP

| # | GAP | Evidência | Efeito |
|---|---|---|---|
| G1 | **Awin e Rakuten escondidos.** Site e `llms.txt` dizem "6 lojas"; Netshoes/KaBuM/C&A/Casas Bahia não têm página nem aparecem no título de nada | `afiliado netshoes` 5.000, `afiliado kabum` 500, `rakuten afiliados` 500; Google IA descreve "6 lojas"; Promium/ProAfiliados anunciam "20+"/"12 lojas" | Perdemos a única demanda nova com volume e parecemos menores que somos |
| G2 | **Marca invisível para o ChatGPT anônimo** apesar de ser 27% dos cadastros | "pode ser nome de ferramenta ou descrição"; só nos acha ao pesquisar | O canal que mais traz cadastro depende de o usuário pedir pesquisa |
| G3 | **Fora das listas "melhor bot Shopee"** nas duas IAs | IA cita quem tem lista/comparativo próprio e vídeo; `/melhores-bots-para-afiliados-whatsapp` é "como comparar", sem nomes | Sem citação na pergunta de maior intenção de compra |
| G4 | **Palavra de entrada ≠ palavra do cliente.** Título da home e das páginas usa "espelhar/espelhamento"; cliente e concorrente usam "bot de afiliados", "automação para afiliados Shopee", "no automático", "garimpo/radar" | Autocomplete, PAA, 6/8 concorrentes; página `/automacao-whatsapp-afiliados` fora do top 10 | Só somos #1 no termo sem busca |
| G5 | **Tráfego orgânico é 95% marca de concorrente com CTR 1%** | 24 páginas `/alternativas/*` = 44% das impressões, 16% dos cliques | Volume que não vira clique; já congelado criar mais |
| G6 | **Link Inteligente e aviso de grupo cheio invisíveis fora do painel** | `limite de membros grupo whatsapp` 500 + `grupo whatsapp lotado` 50; concorrentes vendem "um link que enche vários grupos" e "página na bio" e recebem tráfego pago das clientes | Recurso PRO que resolve dor com busca, sem página |
| G7 | **Páginas com impressão e zero clique** | `/programa-de-afiliados` 242/0; `/amazon-afiliados-whatsapp` 113/0; `/quanto-ganha-afiliado-shopee` 312/2 com termo de 500/mês | Título não responde à consulta |
| G8 | **Zero YouTube** | 0 vídeos; IA do Google cita YouTube em 3 das 5 respostas; top views 92–202 mil | Sem fonte de terceiros para GEO |
| G9 | **Telegram** aparece em 6/8 concorrentes e no Autocomplete; não atendemos | Decisão de produto, não de marketing | Registrar; não prometer |
| G10 | **"Grátis"** está no Autocomplete, no YouTube (3 dos 5 vídeos mais vistos) e em 3 concorrentes (ProAfiliados, Afilira, GoGoBot) | Temos "7 dias grátis sem cartão" — presente no título de 2 páginas | Falta usar na home e nos títulos das páginas de loja |

Bing: 27 cliques em 2 meses. Não é gap, é irrelevância; manter o básico.

## 5. Plano de ação corretivo (ordem de execução)

Regra: cada item nasce em branch, PR contra `develop`, staging, depois `main`.
Página nova segue "nunca nasce órfã" (`docs/rca/seo-marketing.md`). Nada aqui
promete "não bane", Telegram, ou cita preço de concorrente sem ficha em
`competitors-data.js`.

### Frente 1 — GEO: fatos consistentes e marca reconhecível (G1, G2, G3)

1. **Reescrever o fato "6 lojas" em todas as fontes de verdade** (`llms.txt`,
   `pricing.md`, home, `/quem-somos`, `_seoHubShared.js`, `/precos`) para uma
   frase única: "6 lojas com código próprio (Shopee, Mercado Livre, Amazon,
   Magalu, SHEIN, AliExpress) **+ as lojas em que você é aprovada na Awin
   (KaBuM, C&A, Casas Bahia) e na Rakuten (Netshoes)**". Medir: Visão geral
   de IA de "o que é o Espelha Grupos" passa a citar Awin/Rakuten.
2. **Página-resposta de marca** `/o-que-e-espelha-grupos` (ou reforçar
   `/quem-somos` com esse H1): o que é, para quem, o que faz, o que não faz
   (Telegram, API oficial), preço, garantia, trava de link, com data. Medir:
   ChatGPT anônimo reconhece a marca na pergunta 5.
3. **Responder aos 6 critérios do ChatGPT numa página só** (API oficial
   Shopee; trava de link; grupos monitorados; intervalo/ritmo; garimpo próprio;
   rastreio por grupo): hoje estão espalhados. Candidata: evoluir
   `/melhores-bots-para-afiliados-whatsapp` de "como comparar" para "como
   comparar + como o Espelha Grupos responde a cada critério", com a tabela de
   8 bots já datada de `/automacao-whatsapp-afiliados`. Medir: citação em
   "melhor bot para afiliado Shopee" nas duas IAs.
4. **Pedir indexação** no Search Console e Bing das páginas tocadas (regra do
   `ACOES_FLAVIA` para página já no Google).

### Frente 2 — SEO: entrar onde há busca e temos produto (G1, G6, G7)

5. **Páginas de rede no padrão Tier 1** (mesmo molde de
   `/shopee-afiliados-whatsapp`): `/netshoes-afiliados-whatsapp` (5.000/mês),
   `/kabum-afiliados-whatsapp` (500), `/rakuten-afiliados-whatsapp` (500),
   `/awin-afiliados-whatsapp` (volume a confirmar, seção 7). Conteúdo: como
   entrar no programa (intenção da busca) + como o robô converte os links
   dessas lojas + aviso de "loja aprovada". Linkadas na home, no hub de lojas e
   no rodapé.
6. **Página do Link Inteligente** `/link-para-varios-grupos-whatsapp` (ou
   `/grupo-whatsapp-lotado`): entra por "limite de membros grupo whatsapp" e
   "grupo whatsapp lotado", explica o limite real do WhatsApp, o aviso de
   grupo cheio e o rodízio `/g/<slug>`. É o mesmo recurso que Achadinhos Pro
   ("Link Inteligente") e Promium ("Um link que enche vários grupos") usam como
   argumento e que gera tráfego pago das clientes para a Ofertiva.
7. **Corrigir títulos das páginas com impressão sem clique**:
   `/quanto-ganha-afiliado-shopee` (título passa a conter exatamente "quanto
   ganha afiliado shopee" + número/ano), `/amazon-afiliados-whatsapp`,
   `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`. Para
   `/programa-de-afiliados` decidir após o dado da seção 7 (se a consulta é
   "programa de afiliados shopee", renomear para `/indique-e-ganhe` e
   redirecionar). Medir pela série diária, duas janelas iguais.
8. **Renomear "busca ofertas sozinho" para a palavra do mercado**: título de
   `/bot-que-busca-ofertas-shopee-whatsapp` passa a "Garimpo de ofertas da
   Shopee no automático (radar)…". Única troca de vocabulário com dado
   (`garimpo de ofertas` 50, Autocomplete "afiliado shopee no automático").

### Frente 3 — Vocabulário de entrada (G4, G10)

9. **Título da home**: trocar "Bot para afiliados espelhar ofertas no
   WhatsApp" por "Bot de afiliados para WhatsApp: 7 dias grátis, sem cartão |
   Espelha Grupos". "Espelhar" fica no H2/corpo. Medir: CTR da home na
   consulta não-marca (hoje a home só clica por marca).
10. **Hub `/automacao-whatsapp-afiliados`**: H1 e primeiro parágrafo com
    "automação para afiliados Shopee no automático" (Autocomplete) e as PAA
    "Como automatizar afiliado Shopee?" e "Qual IA divulga links de
    afiliados?" como H2 com resposta direta. Medir: entrar no top 10 de
    "automação para afiliados" (Shozap é #1 com home sem conteúdo).
11. **"7 dias grátis sem cartão" no título** das 5 páginas de loja Tier 1 e
    das 4 novas de rede.

### Frente 4 — `/alternativas/*` (G5)

12. Não criar. Nos 3 maiores (`achadinhos-bot` 7.131 impr./1,35%,
    `achadinho-pro` 1.018/2,85%, `shozap` 538/0,93%) testar título
    "X ou Espelha Grupos: preço, lojas e 7 dias grátis (2026)". Medir 4 semanas
    pela série diária; se o CTR não passar de 2,5%, parar de mexer.

### Frente 5 — Vídeo como fonte de terceiros (G8)

13. Um vídeo de 8–12 min no padrão de título que o YouTube já premia:
    "AFILIADO SHOPEE: como postar ofertas no automático nos grupos de WhatsApp
    (7 dias grátis)". Embedar em `/bot-afiliados-whatsapp` e na página de
    marca. Já previsto na Frente C de `PLANO_SEO_GEO_2026-09-27.md`; aqui ganha
    o título e a prova de que a IA do Google cita YouTube.

### Frente 6 — Medição (sem ela nada acima é avaliável)

14. Mensal, 1º dia útil: (a) Search Console Consultas + Páginas, 3 meses;
    (b) `diag-origem-cadastros.mjs --dias 30` (acompanhar % ChatGPT e %
    pagantes por conteúdo); (c) as 5 perguntas no ChatGPT anônimo e na Visão
    geral do Google, marcando citado/não citado e o fato "lojas" que a IA
    repete. Planilha em `docs/marketing/SERIE_HISTORICA_SEO.md`.

Metas em 90 dias (baseline 02/10): consultas distintas 309 → 450; cliques de
consultas **não-marca-de-concorrente** 300 → 600; cadastros via ChatGPT 27% →
35% mantendo o total; citação em "melhor bot Shopee" 0/2 → 2/2; Visão geral
de IA citando Awin/Rakuten na pergunta de marca.

## 6. O que NÃO fazer (derrubado por dado nesta rodada)

- Página por funcionalidade (QR, reconexão, marca d'água, filas, agendar,
  relatórios, Pix, reembolso…): 103 termos abaixo do piso. Viram seção de
  página, FAQ e `llms.txt`, não URL.
- Cluster "espelhar/espelhamento" como entrada: Autocomplete e PAA levam a tela,
  Canva e SketchUp. Já somos #1 no único termo com intenção certa.
- "Robô" como vocabulário de título: puxa marcas de concorrente no Autocomplete.
- Prometer Telegram ou "anti-ban"; o ChatGPT classificou todos como "risco
  alto/real" e nós já publicamos uso responsável.
- Mais `/alternativas/*` e anúncio pago agora: o mercado quase não paga Google
  Ads; a disputa é orgânica e por IA.

## 7. Dados que faltam (um pedido por pergunta)

1. Search Console → Páginas → `/programa-de-afiliados` → aba Consultas.
   Decide: renomear/redirecionar (G7) ou só trocar o título.
2. Planejador: `awin afiliados`, `programa de afiliados awin`, `casas bahia
   afiliados`, `c&a afiliados`, `centauro afiliados`, `dafiti afiliados`.
   Decide: se `/awin-afiliados-whatsapp` entra na Frente 2 ou só KaBuM.
3. Depois do deploy da Frente 1 em `main`: repetir as 5 perguntas no ChatGPT
   anônimo. Decide: se o reconhecimento de marca melhorou ou se o problema é
   só histórico de conta.

## 8. Registro de execução (uma frente por PR, contra `develop`)

| Frente | Branch | Estado | O que entrou |
|---|---|---|---|
| 1 — GEO: fatos e marca | `feat/seo-geo-f1-fatos-lojas-awin-rakuten` | PR aberta (03/10) | `STORES_FACT_PT` (6 lojas + Awin/Rakuten) em definição da marca, ficha técnica, `llms.txt`, `pricing.md`, home, `/quem-somos`, `/precos`, hub de automação, FAQ público e plano Basic (migration DML guardada); `/quem-somos` vira página-resposta "O que é o Espelha Grupos"; `/melhores-bots-para-afiliados-whatsapp` ganha os 6 critérios respondidos (Sub-ID por grupo = não) e a tabela dos 8 bots; leva 🔝 de reindexação em `ACOES_FLAVIA`. Guarda: `test/fato-lojas-awin-rakuten.test.js` |
| 2 — SEO: rede, Link Inteligente, títulos | — | pendente | — |
| 3 — Vocabulário de entrada | `feat/seo-geo-f3-vocabulario-entrada` | PR aberta (03/10) | Título da home "Bot de afiliados para WhatsApp: 7 dias grátis \| Espelha Grupos" ("sem cartão" não coube nos 70 do Bing; fica no corpo); hub `/automacao-whatsapp-afiliados` com H1 e 1º parágrafo "automação para afiliados Shopee no automático" e as PAA "Como automatizar afiliado Shopee?" e "Qual IA divulga links de afiliados?" como H2 (também no FAQPage); "7 dias grátis" no título de Shopee, Mercado Livre, SHEIN e Magalu (Amazon já tinha) |
| 4 — `/alternativas/*` (títulos dos 3 maiores) | — | pendente | — |
| 5 — Vídeo | — | pendente | — |
