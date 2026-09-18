# aulasdematematicabh.com.br — por que não chega lead, o que mudar e o que postar (2026-09-18)

Irmão de `POSTS_CUPONITO_ESPELHA_GRUPOS_2026-09-18.md`. Tudo abaixo foi medido
em 18/09/2026 com `curl` (30 páginas do sitemap), consultas ao índice do Bing
(direto e via DuckDuckGo) e leitura do HTML/schema entregue aos robôs. O que
não deu para medir de fora está marcado como **verificar** — e a maior parte
disso mora no Search Console, na ficha do Google e no Superprof, que só a dona
consegue abrir.

⚠️ **Correção sobre a resposta anterior:** eu tinha assumido que a professora
do site era a Flávia. O site apresenta **Taciane Andrade** (licencianda em
Matemática pela UFMG) como a professora, com telefone, foto e depoimentos
dela. Então a linha "fundadora do Espelha Grupos" **não vai na bio da
professora** — vai num rodapé "quem mantém este site" (seção 4.1). Misturar as
duas pessoas na mesma bio derrubaria a confiança que a página constrói.

## 0. Veredito em seis linhas

1. **A estrutura técnica está bem feita** — é o oposto do Cuponito. Astro
   estático: todo robô (Bing, OAI-SearchBot, GPTBot, PerplexityBot) recebe os
   mesmos 47 KB com H1, texto, FAQ e schema; canonical, `og:image`, `llms.txt`,
   robots.txt liberando as IAs, preço na página, WhatsApp em todo lugar. **Não
   é a estrutura que está segurando os leads.**
2. **O site não aparece nas buscas que trazem aluno.** Nas 10 primeiras
   posições de "aula particular de matemática belo horizonte" (índice do Bing,
   via DuckDuckGo) estão Superprof, Suas Aulas Particulares, Preply, Aula
   Particular em Casa e três professores com site antigo — o seu não está.
   **Quantas páginas estão indexadas no Google e no Bing não dá para medir de
   fora** (os dois servem página genérica a consulta `site:` sem sessão — o
   teste com um domínio de controle provou isso): é o Search Console e o Bing
   Webmaster Tools que respondem (**verificar**).
3. **O site tem ~4 meses** (posts mais antigos de 15/05/2026, dez dos treze
   publicados em 11/09) e **nenhum link externo** apontando para ele. Um site
   assim não ranqueia contra marketplaces de 10-20 anos em semanas; ranqueia
   em meses, e só com sinal local.
4. **O canal que traz aluno particular numa cidade é o LOCAL**: ficha do
   Google com avaliações, Superprof/Profes, indicação de mãe para mãe, Instagram.
   A ficha do Google existe (está no schema), mas avaliações, categoria e
   verificação são **verificar**; o site não mostra nenhuma nota.
5. **O posicionamento está dividido**: o domínio e a marca dizem "BH", a home
   diz "online", o WhatsApp é **DDD 32 (Juiz de Fora)**, e há seis páginas de
   Cálculo/GAAL para universitários. Quem chega não sabe se a professora é de
   BH, se é online, ou se é de Juiz de Fora — e mãe que não entende em 5
   segundos vai para o Superprof.
6. **Não existe medição nenhuma** (sem GA4, GTM, Clarity, pixel, nada). Não
   dá para saber se chega visita, e o clique no WhatsApp não é contado. A
   primeira ação de todas é medir — senão o resto vira palpite.

## 1. Diagnóstico medido

| # | Medição | Resultado | Leitura |
|---|---|---|---|
| D1 | HTML entregue por User-Agent (navegador, bingbot, OAI-SearchBot, GPTBot, PerplexityBot, Googlebot) | 200, **47.172 bytes idênticos**, 1 `<h1>` | site estático (Astro); robô de IA lê tudo sem JavaScript ✅ |
| D2 | `robots.txt` | `Allow: /` explícito para GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, Perplexity-User, ClaudeBot, Claude-Web, Google-Extended, Applebot, Amazonbot, DuckAssistBot, YouBot, MistralAI-User; `CCBot` bloqueado; `Sitemap:` apontando para `sitemap-index.xml` | ✅ (só falta `Claude-SearchBot`/`Claude-User`, os nomes atuais da Anthropic) |
| D3 | `sitemap-index.xml` → `sitemap-0.xml` | **29 URLs, todas 200**; **nenhuma `<lastmod>`** | sem data, o robô não sabe o que mudou; `/sitemap.xml` (o caminho que todo mundo digita) dá 404 |
| D4 | Índice do **Bing** (`site:` direto e via DuckDuckGo) | **não medido**: a consulta `site:` devolve página genérica sem sessão — o mesmo aconteceu com `site:superprof.com.br` (controle), então a resposta vazia não prova nada | conferir no Bing Webmaster Tools; o ChatGPT busca no Bing, então esse número importa |
| D5 | Índice do **Google** | não medido de fora (a busca serve página de consentimento) | **verificar** no Search Console: Páginas → indexadas × não indexadas; Desempenho → impressões por consulta |
| D6 | Ranking no índice do Bing para "aula particular de matemática belo horizonte" | top 10 = Superprof, Suas Aulas Particulares (2×), Aula Particular em Casa, Preply, Eduardo Borges, Saber Particular, Prof. João Maurício, Lista Tudo | zero páginas suas; três professores individuais estão lá — com sites de anos |
| D7 | Medição (GA/GTM/pixel/Clarity/Plausible) | **nenhuma** | não há como saber visitas nem cliques no WhatsApp |
| D8 | `<title>` das 30 páginas | **26 de 30 acima de 60 caracteres** (72 a 117; a home tem 105); `meta description` de 125 a 230 caracteres (limite útil ~155) | o Google corta e reescreve; o pedaço com "BH"/"UFMG" some do resultado |
| D9 | Schema (`@graph` na home) | `Person` (Taciane), `LocalBusiness`+`EducationalOrganization`, `WebSite`, `Service` com `Offer` (online R$ 45), `FAQPage`; `areaServed` = Brasil + BH + 6 cidades; `sameAs` = Superprof + ficha do Google (`cid=12313918382282770907`) | ✅ bem montado. **Sem `aggregateRating`/`review`** — e é para continuar sem, ver M9 |
| D10 | Telefone | `+55 32 99999-3956` em todas as páginas, schema e `llms.txt` | **DDD 32 = Juiz de Fora**, numa marca "BH"; a página de BH lista Juiz de Fora entre as cidades "mais longe, online" |
| D11 | Redirecionamentos | `http://` → **200** (não redireciona para https); `www.` → **200** (não redireciona para o domínio sem www); canonical aponta para o sem-www | duas cópias de cada página; o canonical remedeia, o 301 resolve |
| D12 | Datas | `datePublished` só nos posts; 3 posts de maio/2026, 10 de 11/09/2026; páginas de serviço sem data | site de ~4 meses; sem "atualizado em" visível |
| D13 | Presença fora do site | Superprof (perfil "primeira aula grátis"; o Superprof barra leitura automática → avaliações **verificar**); Instagram `@tacianeandrade8` aparece na busca pelo nome (**verificar** se é o dela); página do Facebook "Aulas de Matemática \| Belo Horizonte MG" com **3.246 curtidas** (**verificar** se é sua — se não for, é colisão de nome) | nenhum desses está no `sameAs` além do Superprof |
| D14 | Conversão na página | um único caminho: `wa.me` com mensagem pré-preenchida ("Vim da página inicial…"), aula diagnóstica gratuita, preço visível, 3 depoimentos de mães, FAQ | ✅ o caminho é bom; a mensagem pré-preenchida por página já permite saber de onde veio o lead — desde que alguém conte |

## 2. Por que não chega lead — as causas, em ordem de peso

1. **Ninguém acha o site.** Fora das 10 primeiras posições nas buscas que
   trazem aluno; indexação no Google e no Bing desconhecida; nenhum link
   externo; 4 meses de vida. Um site novo de serviço local precisa de dois
   empurrões que ainda não aconteceram: **ficha do Google com avaliações**
   (é ela que aparece no mapa quando a mãe busca "aula de matemática perto de
   mim") e **links/menções de fora** (a escola, o Superprof, o Instagram, um
   diretório local). Sem isso o conteúdo, mesmo bom, fica invisível.
2. **O canal errado está recebendo o esforço.** O blog tem 13 posts em
   consultas NACIONAIS de altíssima concorrência ("como estudar matemática
   sozinho", "quanto custa aula particular", "matemática no ENEM: o que mais
   cai") — nessas, quem ranqueia é Superprof, Stoodi, Brasil Escola, Descomplica.
   Enquanto isso não existe UMA página para as buscas que uma mãe de BH faz e
   os grandes não cobrem: prova de admissão do **Coltec (UFMG)**, do
   **CEFET-MG** e do **Colégio Militar (CMBH)**; recuperação de matemática nas
   escolas de BH; Cálculo 1 na UFMG/PUC Minas.
3. **Posicionamento dividido** (D10, home "online" × domínio "BH" × DDD 32 ×
   Cálculo para faculdade). Cada visita precisa decidir em segundos "é para
   mim?". Hoje a home responde "online, 6º ao 3º ano"; a mãe de BH que queria
   presencial precisa achar a página certa no menu.
4. **Sem prova social fora do site.** Três depoimentos no próprio site valem
   pouco; **avaliação no Google e no Superprof** é o que decide na prática, e
   não há nenhuma nota visível em lugar nenhum.
5. **Sem medição** — pode até estar chegando visita e ninguém saber; ou pode
   ser zero. Hoje é impossível distinguir.
6. Detalhes que somam (títulos cortados, sem `lastmod`, sem 301, sem
   "atualizado em") — corrigir, mas não é o que muda o número.

## 3. O que mudar na estrutura (em ordem; cada item com teste)

**M1 — Medir (dia 1).** Instalar **GA4** (ou Cloudflare Web Analytics, mais
leve) e registrar o evento de clique no WhatsApp; cadastrar no **Google Search
Console** e no **Bing Webmaster Tools** (importa do Search Console em um
clique); enviar `sitemap-index.xml` nos dois; pedir inspeção de URL das 8
páginas de serviço. Ligar **IndexNow** (Astro: pacote `astro-indexnow`, ou um
`POST` no deploy). Teste: em 7 dias, Search Console → Desempenho mostra
impressões; Bing WMT → "Páginas indexadas" > 0.

**M2 — Ficha do Google (é o canal local; dia 1).** Abrir a ficha do `cid`
que já está no schema e conferir: verificada? categoria principal
"Professor(a) particular" ou "Serviço de aulas particulares"? área de
atendimento = BH + as 6 cidades (sem endereço exposto: é serviço a domicílio)?
telefone igual ao do site? horário igual ao `OpeningHoursSpecification`
(seg-sex 8-21, sáb 9-14)? link do site com `?utm_source=google&utm_medium=gbp`?
foto da professora e 5+ fotos reais? Serviços cadastrados (reforço, ENEM,
Cálculo) com preço "a partir de"? **Perguntas e respostas** preenchidas com as
6 do FAQ? Uma **postagem por semana** (o mesmo conteúdo do Instagram). Teste:
buscar "aula de matemática" no Google Maps a partir de BH e a ficha aparecer.

**M3 — Avaliações (o que mais move o ponteiro; semanas 1-4).** Pedir a cada
família atendida (as três dos depoimentos primeiro) uma avaliação **na ficha
do Google** e **no Superprof**, com o link direto (`https://g.page/r/<id>/review`,
pega na ficha). Roteiro de mensagem na seção 4.5. Meta: 10 avaliações no
Google em 30 dias. **Não** oferecer nada em troca (viola as regras do Google
e vira remoção).

**M4 — Unificar o posicionamento.** Decisão da dona, mas a recomendação é:
a marca é **BH** (é o que o domínio promete e é onde a busca local acontece);
a home passa a responder primeiro "aula particular de matemática em Belo
Horizonte, presencial na casa do aluno **ou** online", o online vira o segundo
parágrafo, e as páginas de faculdade ganham um bloco próprio ("universitário?
veja Cálculo, GAAL e Estatística"). H1 sugerido:
`Aula particular de matemática em BH — presencial ou online, com professora da UFMG`.
Sobre o telefone: ou um número **(31)** (chip pré-pago serve; o WhatsApp
Business migra) ou uma linha honesta ao lado do número: "WhatsApp (32) — atendo
Belo Horizonte presencialmente e todo o Brasil online". Nunca deixar a mãe
descobrir o DDD sozinha. **O mesmo número tem que estar na ficha do Google.**

**M5 — Títulos e descrições (26 páginas).** Regra: título ≤ 60 caracteres,
com a consulta no começo e "BH" ou "online" no título, sem o sufixo
"| Aulas de Matemática BH" quando ele estoura o limite; descrição ≤ 155.
Prontos para colar:

| Página | Título novo (≤60) |
|---|---|
| `/` | Aula particular de matemática em BH e online (UFMG) |
| `/aulas-particulares-matematica-bh` | Aula particular de matemática em BH, na casa do aluno |
| `/aulas-de-matematica-online` | Aula de matemática online ao vivo: R$ 45 por 50 min |
| `/reforco-escolar-matematica` | Reforço escolar de matemática: fundamental e médio |
| `/enem-matematica` | Matemática para o ENEM: preparação individual em BH |
| `/professor-particular-de-matematica` | Professora particular de matemática: aula individual |
| `/aulas-particulares-ensino-superior` | Aula particular de Cálculo, GAAL e Estatística em BH |
| `/aula-particular-de-calculo-1` | Aula particular de Cálculo 1: limites e derivadas |
| `/aula-particular-de-calculo-2` | Aula particular de Cálculo 2: integrais e séries |
| `/aula-particular-de-calculo-3` | Aula particular de Cálculo 3: várias variáveis |
| `/aula-particular-de-pre-calculo` | Aula particular de Pré-cálculo: base para o Cálculo 1 |
| `/aula-particular-de-estatistica-e-probabilidade` | Aula particular de Estatística e Probabilidade |
| `/aula-particular-de-geometria-analitica-e-algebra-linear` | Aula particular de GAAL: Geometria Analítica e Álgebra |
| `/sobre` | Taciane Andrade, professora de matemática (UFMG) |
| `/contato` | Contato: agende a aula diagnóstica gratuita |
| `/blog` | Blog: matemática para pais e alunos de BH |

Teste: `curl -s <url> | grep -o "<title>[^<]*" | wc -c` ≤ 68 em todas.

**M6 — Redirecionamentos e sitemap.** Na Cloudflare: "Always Use HTTPS"
ligado (http → https 301) e uma Redirect Rule `www.` → domínio sem www (301).
No Astro: `@astrojs/sitemap` com `lastmod` (opção `serialize` lendo a data do
frontmatter) e um redirect `/sitemap.xml` → `/sitemap-index.xml`. Teste:
`curl -sI http://aulasdematematicabh.com.br/ | grep -i location` = https;
`curl -s .../sitemap-0.xml | grep -c lastmod` = 29.

**M7 — "Atualizado em" visível + `dateModified`** nas 8 páginas de serviço
(hoje só os posts têm data). Revisar preço e texto a cada 3 meses.

**M8 — `sameAs` completo e consistente** na `Person` e no `LocalBusiness`:
ficha do Google, Superprof, Instagram (se `@tacianeandrade8` for o dela),
Facebook (se a página de 3.246 curtidas for sua), LinkedIn. Mesmo nome, mesmo
telefone, mesma foto em todos (NAP consistente é sinal local).

**M9 — O que NÃO fazer no schema.** Não adicionar `aggregateRating`/`review`
com os depoimentos do próprio site: o Google trata avaliação servida pela
própria empresa como "self-serving" e não exibe (e pode penalizar rich results).
A nota vem da ficha do Google — e aparece no mapa, que é onde importa.

**M10 — robots.txt**: acrescentar `Claude-SearchBot` e `Claude-User` (nomes
atuais); manter o resto.

**M11 — Facebook.** Se a página "Aulas de Matemática | Belo Horizonte MG"
(3.246 curtidas) for sua: renomear/atualizar com a professora, o site e o
WhatsApp, e linkar no `sameAs` — 3 mil pessoas é mais audiência do que o site
tem. Se **não** for sua: é colisão de nome com uma página estabelecida; a
saída é a marca virar "Taciane Andrade — Matemática BH" em título, ficha e
redes (o domínio pode ficar).

**M12 — Página nova só linkada.** Toda página nova (seção 4.4) entra com 3
links internos de páginas já existentes (home, a página de serviço do tema e o
post relacionado) e pedido de inspeção no Search Console. Regra idêntica à do
Espelha Grupos: página no sitemap não é página descoberta.

## 4. O que postar

### 4.1 Rodapé "quem mantém este site" (onde entra o Espelha Grupos)

Não na bio da professora. Um bloco no rodapé (ou no fim de `/sobre`, em
tamanho menor):

> Site mantido por **Flávia Vale**, fundadora do
> [Espelha Grupos](https://espelhagrupos.com.br). As aulas são dadas por
> Taciane Andrade; o site, o conteúdo e a tecnologia são cuidados pela Flávia.

No schema: `WebSite.publisher` → `Person` "Flávia Vale" com `sameAs`
`["https://espelhagrupos.com.br/quem-somos", "https://www.cuponito.com.br/quem-somos"]`.
É o que amarra a pessoa às três entidades sem misturar a professora com o
produto. Efeito para o Espelha Grupos: pequeno (assunto sem relação), mas
consolida a entidade "Flávia Vale" que hoje as IAs leem partida.

### 4.2 Bio da professora (`/sobre` e ficha do Google), texto pronto

> Sou Taciane Andrade, licencianda em Matemática pela UFMG. Dou aula
> particular de matemática para alunos do 6º ano ao 3º do ensino médio e para
> quem está travado em Cálculo, GAAL e Estatística na faculdade. Atendo
> presencialmente em Belo Horizonte e em Contagem, Nova Lima, Sabará, Santa
> Luzia, Ribeirão das Neves e Vespasiano — na casa do aluno — e online, ao
> vivo, para todo o Brasil. A primeira aula é diagnóstica e gratuita: 30
> minutos para entender onde está a dificuldade e montar um plano. Aula
> online de 50 minutos: R$ 45; presencial a partir de R$ 50, com deslocamento
> incluso. Sem plataforma, sem taxa, sem cadastro: você fala direto comigo
> pelo WhatsApp.

(Se a decisão do M4 for o número (31), trocar antes de publicar.)

### 4.3 Descrição da ficha do Google (750 caracteres, texto pronto)

> Aula particular de matemática em Belo Horizonte com Taciane Andrade,
> licencianda em Matemática pela UFMG. Reforço escolar do 6º ano ao 3º do
> ensino médio, preparação para o ENEM e para as provas de admissão do Coltec,
> do CEFET-MG e do Colégio Militar, e apoio em Cálculo, GAAL e Estatística
> para universitários. Presencial na casa do aluno em BH, Contagem, Nova Lima,
> Sabará, Santa Luzia, Ribeirão das Neves e Vespasiano, ou online ao vivo.
> Primeira aula diagnóstica gratuita. Aula online R$ 45; presencial a partir
> de R$ 50 com deslocamento incluso. Contato direto pelo WhatsApp, sem
> plataforma nem taxa.

Serviços a cadastrar na ficha (um a um, com preço "a partir de"): Reforço
escolar de matemática; Preparação para o ENEM; Preparação Coltec/CEFET/CMBH;
Cálculo 1, 2 e 3; GAAL; Estatística e Probabilidade; Aula online.

### 4.4 Instagram (bio) e Superprof

Instagram (150 caracteres):
> Professora de matemática (UFMG) | BH presencial + online | 6º ano ao 3º EM,
> ENEM, Cálculo | 1ª aula grátis 👇

Superprof: mesmo texto da 4.2; título do anúncio
"Professora de matemática (UFMG) — BH presencial e online, 1ª aula grátis";
responder toda mensagem em menos de 2 horas (o Superprof ranqueia por tempo
de resposta) e pedir avaliação a cada aluno concluído.

### 4.5 Pedido de avaliação (mensagem pronta, WhatsApp)

> Oi, [nome]! Fiquei muito feliz com o resultado do [aluno]. Posso te pedir
> um favor de 2 minutos? Uma avaliação sua no Google ajuda outras famílias de
> BH a me encontrarem. É só abrir este link e escrever o que você me contou
> sobre a prova: [link g.page/r/…/review]. Muito obrigada!

### 4.6 Blog: o que escrever (o que os grandes não cobrem e uma mãe de BH busca)

Regra: título ≤ 60, a cidade ou a instituição no título, uma pergunta de
mãe/aluno por post, CTA para a aula diagnóstica com mensagem pré-preenchida
própria, 3 links internos, `datePublished` real. **Não** escrever mais posts
nacionais genéricos até estes existirem.

| # | Título (≤60) | Para quem | Por que |
|---|---|---|---|
| 1 | Prova de matemática do Coltec (UFMG): como preparar | mãe/aluno do 9º ano em BH | busca sazonal forte em BH; nenhum marketplace tem página específica |
| 2 | Matemática do CEFET-MG: o que estudar para a prova | idem | idem |
| 3 | Colégio Militar de BH: matemática do concurso de admissão | pais de 5º e 9º ano | idem; público que paga aula particular |
| 4 | Recuperação de matemática em BH: o que fazer em novembro | pais de aluno em recuperação | sazonal (publicar até 10/10); a versão nacional já existe, esta fala do calendário das escolas daqui |
| 5 | Cálculo 1 na UFMG e na PUC Minas: por que reprova tanto | universitário de BH | as 6 páginas de Cálculo não têm nenhuma porta de entrada local |
| 6 | Aula particular de matemática em BH: preço por região (2026) | mãe comparando preço | a consulta "quanto custa" existe em versão nacional; a local converte |
| 7 | Reforço de matemática para alunos do [Colégio X] em BH | pais da escola | **só para escolas onde já há aluno** — a página "Conheço a escola do seu filho" promete isso; uma página por escola real, nunca por escola imaginada |

**Post 1 escrito (colar no CMS; conferir no edital do ano os números que
estão entre colchetes):**

```markdown
# Prova de matemática do Coltec (UFMG): como preparar seu filho para a seleção

*Por Taciane Andrade · Publicado em [data] · Atualizado em [data]*

**Resposta direta:** a seleção do Coltec cobra a matemática do ensino
fundamental inteiro, com peso grande em proporcionalidade, geometria e
interpretação de problema — não em fórmula decorada. Um aluno do 9º ano com
base razoável precisa de **[4 a 6] meses** de preparação dirigida, uma aula
por semana mais lista; um aluno com lacunas do 7º e 8º ano precisa começar
antes. Abaixo: o que cai, como avaliar de onde o seu filho parte e como
organizar as semanas.

## O que a prova cobra (e o que ela não cobra)

O Colégio Técnico da UFMG seleciona para o ensino médio integrado ao
técnico, e a prova de matemática é de **fundamental**: números e operações,
frações e porcentagem, razão e proporção, equações do 1º e do 2º grau,
funções básicas, geometria plana (área, perímetro, ângulos, semelhança),
noções de estatística e leitura de gráficos. O que derruba aluno não é
conteúdo novo — é a **combinação**: um problema de porcentagem dentro de um
gráfico, uma área que exige montar uma equação. Confira sempre o edital do
ano: número de questões, peso e datas mudam ([edital vigente]).

## Por onde começar: a aula diagnóstica

Antes de qualquer cronograma eu faço 30 minutos de diagnóstico, gratuitos:
oito a dez questões no estilo da prova, uma por tema. O resultado diz o que
importa — **quais lacunas dos anos anteriores** estão presentes. Metade dos
alunos que "vão mal em matemática" no 9º ano tropeçam em fração e proporção do
7º. Preparar para o Coltec sem fechar isso é estudar em cima de areia.

## O plano de semanas

1. **Semanas 1-4: base.** Frações, porcentagem, razão e proporção, com
   problemas no formato da prova. Nada de 2º grau ainda.
2. **Semanas 5-10: álgebra e funções.** Equações do 1º e 2º grau, sistemas,
   função afim, sempre saindo de um problema em texto.
3. **Semanas 11-16: geometria.** Área, perímetro, ângulos, semelhança de
   triângulos, Pitágoras — os temas com mais questão de "combinação".
4. **Últimas 4 semanas: provas anteriores cronometradas.** Uma por semana,
   corrigida junto; o erro repetido vira a aula da semana.

Uma aula de 50 minutos por semana com lista de 20 questões entre as aulas dá
conta desse plano. Duas por semana só fazem sentido quando o diagnóstico mostra
lacunas em mais de três temas.

## O que os pais podem fazer em casa

Cobrar a lista feita (não corrigida — feita), garantir que a prova antiga
seja resolvida com relógio, e não comparar com o colega que "já sabe tudo".
Aluno que entra no Coltec sem base sofre no técnico; a preparação é para
**entrar preparado**, não só para entrar.

## Perguntas frequentes

**Meu filho está no 8º ano. É cedo para começar?**
Não para fechar a base. Um semestre de aula quinzenal no 8º ano deixa o 9º
inteiro para a prova em si.

**Presencial ou online funciona melhor para o Coltec?**
As duas, desde que a aula seja individual e com lista entre elas. Em BH e
região eu vou até a casa do aluno; fora, é online ao vivo.

**Quanto custa a preparação?**
Aula online de 50 minutos: R$ 45. Presencial em BH: a partir de R$ 50, com
deslocamento incluso. Pacote mensal com desconto. A aula diagnóstica é
gratuita.

---

*Taciane Andrade é licencianda em Matemática pela UFMG e dá aulas
particulares em Belo Horizonte e online.*
[Agendar a aula diagnóstica gratuita pelo WhatsApp →](https://wa.me/5532999993956?text=Oi!%20Vim%20do%20post%20sobre%20o%20Coltec%20e%20quero%20agendar%20a%20aula%20diagn%C3%B3stica.)
```

Os posts 2 e 3 seguem o mesmo esqueleto (o que a prova cobra → diagnóstico →
plano → o que os pais fazem → FAQ), trocando instituição, público e edital.
Não copiar o texto: o Google junta páginas gêmeas e mostra uma só.

## 5. Checklist e o que medir

- [ ] M1: GA4/Cloudflare Analytics + evento de clique no WhatsApp; Search Console + Bing WMT; sitemap enviado; IndexNow
- [ ] M2: ficha do Google conferida (categoria, área, telefone, horário, serviços, fotos, Q&A) + 1 post/semana
- [ ] M3: 10 avaliações no Google em 30 dias (mensagem da 4.5)
- [ ] M4: decisão BH-primeiro na home + telefone (31) ou linha explicando o (32); mesmo número na ficha
- [ ] M5: 16 títulos e descrições trocados (tabela acima)
- [ ] M6: 301 http→https e www→apex; `lastmod` no sitemap; `/sitemap.xml` redirecionando
- [ ] M7: "Atualizado em" nas 8 páginas de serviço
- [ ] M8: `sameAs` com Instagram/Facebook/LinkedIn confirmados
- [ ] M10: `Claude-SearchBot` e `Claude-User` no robots.txt
- [ ] 4.1: rodapé "quem mantém este site" + `WebSite.publisher`
- [ ] 4.6: posts 1-4 publicados até 10/10 (o 4 é sazonal), cada um linkado de 3 páginas

**Métricas em 30 / 60 / 90 dias (Search Console + ficha do Google):**

| Métrica | 30 dias | 60 dias | 90 dias |
|---|---|---|---|
| páginas indexadas no Google | ≥ 20 de 29 | 29 | 29 + posts novos |
| páginas indexadas no Bing (Bing WMT) | medido | ≥ 20 | todas |
| impressões/mês no Search Console | qualquer número (hoje é desconhecido) | 2× o mês anterior | consulta com "belo horizonte" ou "bh" entre as 10 maiores |
| avaliações na ficha do Google | 10 | 15 | 20, nota ≥ 4,8 |
| cliques no WhatsApp (GA4) | medido | ≥ 10/semana | ≥ 20/semana |
| visualizações da ficha (Maps) | medido | crescendo | crescendo |

O que **não** fazer: comprar avaliação; criar página por bairro de BH sem
atender o bairro; escrever mais posts nacionais genéricos; adicionar
`aggregateRating` com depoimento próprio; pagar anúncio antes de M1-M3 (sem
medição e sem avaliação, anúncio compra clique que não vira contato).
