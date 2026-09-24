# seo-marketing — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Página nova NUNCA nasce órfã (RCA 2026-09-11 — não regredir)

As cinco páginas comerciais do Tier 1 (`/shopee-afiliados-whatsapp`,
`/mercado-livre-afiliados-whatsapp`, `/amazon-afiliados-whatsapp`,
`/shein-afiliados-whatsapp`, `/magalu-afiliados-whatsapp`) estão em produção
desde **2026-09-02**, respondem 200, estão no `sitemap.xml`, sem `noindex`,
com canônica correta — e passaram **9 dias com ZERO impressão**.

A Inspeção de URL do Search Console deu o veredito exato:

```
A página não está indexada: Detectada, mas não indexada no momento
Detecção        Sitemaps: https://espelhagrupos.com.br/sitemap.xml
                Página de referência: Nenhuma página foi detectada
Último rastreamento: N/D
```

**O Google NUNCA LEU essas páginas.** Não é conteúdo duplicado (ele não chegou
a comparar), não é `noindex`, não é `robots.txt`. É **descoberta**: o único
link interno para as cinco saía de `/conteudos`, que é a página mais fraca do
site (posição 45, 51 impressões, 1 clique) e carrega 67 links na mesma tela.
Link solitário vindo de página sem força não convence o Google a gastar
rastreamento.

⚠️ **Estar no sitemap NÃO é descoberta.** O sitemap diz que a página existe; o
link interno diz que ela importa. Sem o segundo, ela entra numa fila que pode
nunca ser atendida. O comentário em `dashboard/app/conteudos/page.js` já
avisava disso ("Nasce linkada de propósito: a ação 8 mostrou que página que só
existe no sitemap acaba em 'rastreada, mas não indexada'") — o erro foi achar
que UM link de UMA página fraca cumpria a regra.

### Regra obrigatória para toda página nova

1. **Antes de abrir a PR**, escolher no mínimo **três** páginas já indexadas e
   com impressão que tratem do mesmo assunto, e linkar a página nova a partir
   delas. Preferir as de mais impressão no último relatório do Search Console
   — o link vale pela força de quem o dá.
2. `/conteudos` e o `sitemap.xml` **não contam** para esse mínimo. Os dois são
   índice, não recomendação.
3. **Pedir reindexação das páginas EDITADAS**, não só da página nova. O Google
   precisa reler quem passou a apontar para ela; sem isso o link novo demora a
   ser visto.
4. Ao terminar, entregar à dona do produto a lista de endereços para Inspeção
   de URL: a página nova **e** as que ganharam o link.

Guarda: `test/marketing-paginas-orfas.test.js` — falha se uma rota de
`getIndexableSeoRoutes()` tiver menos de 3 referências internas fora de
`/conteudos`, do sitemap e do próprio arquivo da página.

⚠️ **A guarda conta LINK, não conta FORÇA — e três links fracos não resolvem.**
Medido em 16/09, quem aponta para as cinco páginas do Tier 1:
`/programa-de-afiliados` (185 impressões, **zero clique**), `/conteudos` (que
por regra não conta), e as próprias páginas do Tier 1 entre si — todas zeradas.
SHEIN e Magalu não têm **nenhum** link vindo de página com impressão. Enquanto
isso, as oito páginas mais fortes do site (`/alternativas/*` e
`/bot-achadinhos-whatsapp`, juntas ~9.000 das 13.362 impressões) têm **zero**
links para o Tier 1. Página sem força não transfere força: o mínimo da regra 1
("três páginas já indexadas e COM impressão") é o que vale, e a guarda passa
mesmo quando ele não é cumprido. Conferir na mão com:

```bash
cd dashboard && grep -rl "/<slug>" app components lib | grep -v conteudos
```

### ⚠️ O Tier 1 JÁ FOI EXECUTADO — não dizer de novo que falta fazer

Três análises seguidas (01/09, 10/09, 11/09) afirmaram que "não existe página
comercial nossa disputando Tier 1". **É FALSO.** As cinco existem desde
02/09, em `main`, geradas por `dashboard/app/_preservationCommercialPages.js`.
O plano de 11/09 chegou a abrir uma issue para CRIAR o que existia havia nove
dias.

**Causa do erro de método:** o relatório **Páginas** do Search Console lista
somente página **com impressão**. Página com zero impressão simplesmente não
aparece na exportação. Ler "ausente do relatório" como "não existe" é o erro —
e ele se repete a cada rodada porque a exportação parece completa.

**Regra de método (obrigatória em toda análise de SEO):** antes de escrever
que uma página não existe, conferir no repositório:

```bash
node --input-type=module -e "
import { getIndexableSeoRoutes } from './dashboard/lib/seo-registry.mjs';
console.log(getIndexableSeoRoutes().map(r => r.path).join('\n'));
"
ls dashboard/app/<slug>/page.js
```

⚠️ **`getIndexableSeoRoutes()` devolve OBJETOS de rota, não strings** — sem o
`.map(r => r.path)` a saída vira `[object Object]` e qualquer busca por slug dá
zero, o que se lê exatamente como "a página não existe". Foi assim que uma
checagem de 11/09 concluiu que as cinco páginas de loja não existiam; elas
existem e estão indexáveis desde 02/09.

Rota presente no registry + arquivo em disco = **a página existe**. Zero
impressão é problema de **descoberta ou de indexação**, nunca prova de
ausência. Os dois diagnósticos pedem ações opostas: criar página que já existe
é desperdício; tratar como "falta criar" esconde o problema real, que é o
Google não estar lendo.

## SEO orgânico — linhas CONGELADAS por dado (2026-07-30, não reabrir)

Decidido com dado real do Google (Search Console 12m + Planejador com 8.923
termos + Trends). Análise completa em
`docs/marketing/ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`.

**NÃO produzir mais páginas nestas linhas:**

| Linha congelada | Evidência que sustenta |
|---|---|
| LPs por **cidade** (`espelhar-grupos-whatsapp-<cidade>`) | as 15 somaram ~25 impressões em 2,5 meses; 5 delas em zero |
| LPs de **nicho** novo (farmácia, autopeças, pet shop, beleza) | zero impressão em 2,5 meses |
| Cluster **"robô"** como termo próprio | Trends: "robô whatsapp" é 12× menor que "bot whatsapp" |
| ~~**Magalu** como frente nova~~ **(reaberto em 02/09 — ver nota abaixo)** | único marketplace em queda no Trends |
| `automação whatsapp` / `disparo em massa` | 5.000/mês mas concorrência **alta**, e é mercado de atendimento corporativo (Blip/Wati), não afiliado |
| **`espelhamento de grupos`** e variações (congelado em 16/09) | abaixo do piso de reporte do Planejador; ver nota abaixo |

**"Espelhamento" NÃO é porta de entrada — testado por três caminhos em 16/09.**
A suspeita era razoável: usamos a palavra 79 vezes no corpo do site, os
concorrentes usam, e ela nunca virou título nem H1. Os três métodos deram o
mesmo veredito:

| Método | Resultado |
|---|---|
| Autocomplete do Google | `espelhamento de` completa para **tela, tela iPhone, tela do celular no pc, Samsung, Roku TV, pintura, carro** — nada sobre grupos |
| Search Console, 3 meses, filtro `espelh` | só `espelha grupos` (19 impressões, CTR 89%, posição 1,1 — **é a nossa marca**) e `quero espelhar` (1). Zero por "espelhamento" |
| Planejador | `espelhamento de grupos`, `espelhamento de grupos whatsapp`, `espelhar grupos whatsapp`, `copiar mensagens de um grupo para outro`, `replicar mensagens whatsapp` → **todos abaixo do piso de reporte** (< 10/mês) |

**A armadilha:** `espelhamento whatsapp` tem **5.000/mês com concorrência
baixa** e, olhado isolado, parece a maior oportunidade do site. Não é. A
vizinhança denuncia a intenção: `aplicativo para espelhar whatsapp em outro
celular` (5.000), `espelhar whatsapp em outro celular` (500), `espelhamento
whatsapp no pc` (500), `espelhar whatsapp na tv` (50). **Quem busca quer usar o
WhatsApp em dois aparelhos** — é público de suporte técnico, não afiliado, e
atraí-lo é abandono garantido.

Há um motivo a mais para não ir: "espelhar whatsapp em outro celular" é o
território dos aplicativos de espionagem de conversa alheia (o `-90% ano a ano`
nesse termo tem cara de o Google ter derrubado o nicho). Não é vizinhança onde
esta marca deve aparecer.

**Magalu foi reaberto em 2026-09-02, por decisão explícita da dona do produto.**
O congelamento vinha do Trends (único marketplace da lista em queda), e isso é
argumento de **prioridade**, não de correção — a prioridade é decisão dela. A
reabertura vale **só** para a página comercial `/magalu-afiliados-whatsapp`, no
mesmo padrão das outras lojas da frente Tier 1 (Shopee, Mercado Livre, Amazon e
SHEIN). Cidade, nicho e dor seguem congelados, e qualquer OUTRA rota de Magalu
exige decisão nova — a guarda `FR-033` em
`test/marketing-limites-que-nao-se-cruzam.test.js` passou a aceitar essa rota e
só ela, em vez de ter sido apagada.

**Não deletar as páginas existentes** — perder link e histórico não ajuda. Só
parar de investir.

**Onde está a demanda real (atacar aqui):** o público **antes** de precisar do
robô. `shopee afiliados`, `mercado livre afiliados`, `afiliado amazon` —
50.000/mês cada, concorrência **baixa**. Contra `bot para grupo whatsapp`, que
tem **500/mês e concorrência alta**. Ordem dos marketplaces: Shopee ≫ Mercado
Livre > Amazon ≫ Magalu.

**Regra de vocabulário:** título e H1 entram pela palavra que o cliente busca
("whatsapp banido", "achadinhos", "afiliado shopee"); o termo próprio da casa
("Módulo de Preservação Avançada", "cadência", "espelhamento") é explicado
**dentro** da página, não usado como porta de entrada. No caso de
"espelhamento" isso deixou de ser convenção e virou dado medido — ver a linha
congelada acima.

⚠️ **Limite que não se cruza:** entrar pela palavra "banido"/"anti-ban" **não**
pode virar promessa de que não banem. Corrigir a expectativa dentro da página é
honesto; prometer é risco jurídico e contraria a política de uso responsável já
publicada no `llms.txt`.

## Datas, "Melhor para" e validadores de SEO (23/09/2026 — não regredir)

- **`EDITORIAL_DATES` é a fonte ÚNICA da data** de toda rota indexável: o
  `lastmod` do sitemap, o `dateModified` e o "Atualizado em" visível saem dela.
  Nunca inventar data: `updatedAt` só muda quando o CONTEÚDO muda.
- **Toda página de `_preservationCommercialPages.js` tem "Melhor para / Não é
  ideal para"** — a IA recomenda por adequação. Guarda:
  `test/paginas-comerciais-melhor-para-e-data.test.js`.
- **Validadores de SEO rodam na PR e em `npm test`** (consistência, cobertura
  do registro, duplicidade de metadata). O de frescor (120 dias) só AVISA —
  resolve-se revisando a página, não mexendo na data.
  Guarda: `test/seo-validadores-gate.test.js`.
- **"Espelha Grupos" também no admin e no painel**, e o LinkedIn da empresa em
  `https://www.linkedin.com/company/espelha-grupos/` (decisão da dona do
  produto). Guarda: `test/marca-unica-espelha-grupos.test.js`.
- **Medição de IA:** `node scripts/validar-medicao-ia.mjs` antes de fechar o
  placar (um "SIM" maiúsculo zerou o de 01/09).

## Dados de mercado para marketing (canônico — usar em toda decisão de SEO/conteúdo)

Baseline de **2026-07-30**, fonte: Search Console (12 meses), Planejador de
Palavras-Chave (8.923 termos, Brasil/PT), Google Trends (12 meses, Brasil).
Análise completa em `docs/marketing/ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`.
**Toda conversa de marketing/SEO/conteúdo deve partir destes números — não
re-estimar por sinal de SERP quando este dado real já existe.**

### Tiers de palavra-chave (volume/mês, concorrência)

| Tier | Termos | Volume | Concorrência | Observação |
|---|---|---:|---|---|
| **1 — prioridade máxima** | `shopee afiliados`, `mercado livre afiliados`, `afiliado amazon`/`associados amazon` | 50.000 cada | **Baixa** | maior oportunidade do levantamento |
| 1 | `como se tornar afiliado shopee`, `programa de afiliados shopee` | 50.000 | Média | |
| 1 | `como ser afiliado [shopee/ML/amazon]` | 5.000 cada | Média | |
| 1 | `programa de afiliados mercado livre`, `shopee afiliados entrar` | 5.000 | Baixa | |
| **2 — dor aguda** | `whatsapp banido`, `zap banido`, `número banido whatsapp`, `conta banida whatsapp` | 5.000 cada | **Baixa** | tratar como topo de funil, não venda direta |
| **3 — secundário** | `achadinhos`/`achadinho`, `grupo de ofertas whatsapp`, `grupo de promoções whatsapp` | 5.000 cada | Baixa/Média | ⚠️ quem busca "grupo de ofertas" quer **entrar**, não criar — só serve como isca |
| **4 — estacionado** | `cupom amazon`, `cupom mercadolivre` | 500.000 | Baixa | público é consumidor final, não afiliado — não perseguir agora |
| **5 — evitar** | `bot`/`robô para grupo whatsapp` | 500 | **Alta** | é onde o site tenta competir hoje; não é onde está o volume |

Ordem de prioridade dos marketplaces (Trends, estável salvo Magalu):
**Shopee ≫ Mercado Livre > Amazon ≫ Magalu (em queda)**.

### Baseline do site (Search Console — atualizado 2026-09-23)

| Métrica | 30/07 | 16/08 | 01/09 | 16/09 | **23/09** |
|---|---:|---:|---:|---:|---:|
| Cliques (soma da aba "Países") | 40 | 93 | 177 | 490 | **680** |
| Impressões | 1.102 | 2.902 | 5.773 | 13.362 | **16.581** |
| CTR | 3,63% | 3,20% | 3,07% | 3,67% | **4,10%** |
| Consultas distintas | 13 | 29 | 115 | 180 | **225** ← métrica mais honesta de progresso |
| Páginas com impressão | 60 | 77 | 79 | 101 | **113** |

Compare sempre pela soma da aba "Países" (o painel-resumo dá 41/1.154 em 30/07
porque inclui linhas sem país atribuído — as duas metodologias não se misturam).
16/09 e 23/09 usam janela de **3 meses**; a série completa, semana a semana,
mora em `docs/marketing/SERIE_HISTORICA_SEO.md`.

**Leitura de 23/09, pela série semanal (não pelo acumulado):** o CTR subiu pela
quarta semana seguida — **2,52% → 3,53% → 4,77% → 5,75%** (25/08 a 21/09) — e a
última semana teve **mais clique com menos impressão** (192 cliques contra 173;
3.342 impressões contra 3.630). Setembro, até o dia 21, já tem **489 cliques,
3,2× agosto inteiro**. A busca pelo nome da marca, `espelha grupos`, foi de
19 para **51 impressões e de 17 para 39 cliques** em uma semana.

**A entrega de 20/08 (títulos reescritos, marca duplicada removida, 25 rotas
mortas fora do índice) funcionou, e dá para medir sem depender do acumulado.**
Janelas de 25 dias, antes × depois, da série diária do `Gráfico.csv`:

| Janela | Impressões | Cliques | CTR |
|---|---:|---:|---:|
| 26/07 a 19/08 | 2.370 | 83 | 3,50% |
| **21/08 a 14/09** | **10.129** | **375** | **3,70%** |

E o CTR ainda subia semana a semana conforme o Google recrawleava os títulos
novos: **2,52% (25–31/08) → 3,53% (01–07/09) → 4,77% (08–14/09)**. Ao avaliar
efeito de mudança de título, use a série diária — o acumulado de 3 meses
dilui o depois com o antes e esconde exatamente o que se quer medir.

**A hipótese do celular estava certa e o conserto pegou.** Em 16/08 o celular
trazia 62% das impressões com CTR menos da metade do computador, e a leitura
registrada foi "título cortado na tela pequena, não público diferente". Depois
de encurtar os títulos para 55 caracteres e tirar o sufixo de marca duplicado:

| | 16/08 | **16/09** |
|---|---:|---:|
| Celular | 2,07% | **3,20%** |
| Computador | 5,10% | 4,31% |

A distância caiu de 2,5× para 1,35×.

**Buscas por nome de CONCORRENTE são ~47% de TODAS as impressões do site**
(6.309 de 13.362) e 96% das impressões das consultas nomeadas. Maior consulta
do site inteiro: **`achadinho pro`, 3.217 impressões**. As páginas que atendem:
`/alternativas/achadinhos-bot` (4.930), `/bot-achadinhos-whatsapp` (2.514, com
CTR de **5,0%** contra 2,08% em 16/08) e `/alternativas/achadinho-pro` (859,
publicada em 20/08 — **uma** página, não seis, e pegou o maior termo do site).
**A linha de comparação com concorrente é o motor de crescimento**, confirmado
em escala. Nunca se passar pelo concorrente, nunca prometer o que ele não
entrega sem fonte e data.

**Três páginas continuam sem clique mesmo depois da reescrita de 20/08** — não
insistir no mesmo ajuste, elas precisam de outra abordagem:

| Página | Impressões 16/09 | Cliques 16/09 | Impressões 23/09 | Cliques 23/09 |
|---|---:|---:|---:|---:|
| `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` | 477 | **1** | 518 | **3** |
| `/programa-de-afiliados` | 185 | **0** | 217 | **0** |
| `/bot-ofertas-whatsapp` (hub de nichos) | **8** (era 37) | 0 | 3 | 0 |

O hub de nichos encolheu porque as 10 páginas-filhas saíram do índice em 20/08
— custo previsto da decisão, registrado aqui para não ser diagnosticado como
bug depois.

**Tier 1: as cinco páginas EXISTEM desde 02/09 — o que falta é o Google LER.**
Conferido no registry e em disco em 16/09: `/shopee-afiliados-whatsapp`,
`/mercado-livre-afiliados-whatsapp`, `/amazon-afiliados-whatsapp`,
`/shein-afiliados-whatsapp`, `/magalu-afiliados-whatsapp`. Somadas, 14 consultas
de marketplace/afiliado e ~30 impressões — isso é **descoberta/indexação**, não
ausência (ver "Página nova NUNCA nasce órfã": o único link interno delas sai de
`/conteudos`, a página mais fraca do site). ⚠️ Foi a **quarta** vez que uma
análise escreveu "falta atacar o Tier 1"; o erro de método é sempre o mesmo e
está documentado acima — o relatório **Páginas** só lista página COM impressão,
então página zerada não aparece na exportação, e "ausente do relatório" foi lido
como "não existe".

**23/09 — o link resolveu a descoberta, não a disputa.** Em 17/09 as oito
`/alternativas/*` e a `/bot-achadinhos-whatsapp` passaram a linkar as cinco
lojas. Uma semana depois, as cinco páginas somam **353 impressões e 7 cliques
(eram 123 e 1)**: Shopee 61, Mercado Livre 55, Amazon 71, SHEIN 160, Magalu 6.
Mas as **consultas** de marketplace mal andaram (33 → 49 impressões) e os
termos-cabeça de 50.000/mês (`shopee afiliados`, `mercado livre afiliados`,
`afiliado amazon`) **continuam fora**: as páginas aparecem para cauda longa
(`grupo de afiliados shein whatsapp`, `bot para afiliados mercado livre`). O
problema deixou de ser "o Google não lê" e passou a ser "o Google lê e não
coloca no termo principal".

**Citação por IA, medido em campo pela 1ª vez em 01/09** (7 consultas
prioritárias × 4 superfícies, 28/28 linhas em
`docs/marketing/ai_visibility_tracking.csv`): **ChatGPT cita em 3 de 7 e acerta
o preço; Gemini, Perplexity e Google AI Overviews citam em 0 de 7.**

- **Três das quatro IAs acham que a marca é calçado.** `BOTinho preço` devolve
  botinha infantil no Gemini, na Perplexity e no AI Overviews (este último com
  preço e links de loja). **Nunca escrever "BOTinho" sozinho em texto público** —
  sempre "BOTinho WhatsApp" ou "Espelha Grupos".
- **Página que não existe de forma citável vira alucinação.** Em `BOTinho
  metodologia` o AI Overviews **inventou** uma metodologia com pilares nomeados
  **e citou fontes**; o Gemini fez o mesmo sem fontes; só a Perplexity foi
  honesta e disse que não conhecia.
- **Espelhamento não é lido como produto nosso**: a Perplexity trata
  "espelhador de grupos" como categoria com nome próprio e lista concorrentes;
  o AI Overviews cita uma ferramenta só. É a consulta com menos concorrência de
  citação — o alvo mais barato.
- **Cupom foi lido como CRM/atendimento** por Gemini, Perplexity e AI Overviews;
  só o ChatGPT entendeu o contexto de afiliado, e é onde somos citados.
- Concorrentes que as IAs citam são **quase disjuntos** dos do Search Console
  (Promium, GoGoBot, OfertaFlux, FluxZap, Ripply, ZincLink, Busqy, DivulgaNinja
  e outros) — e as listas das próprias IAs quase não se sobrepõem entre si: não
  existe "o ranking do mercado", existe o ranking de cada IA.

**43% dos cadastros vêm do ChatGPT** (31 de 72 em 30 dias, carimbados com
`utm_source=chatgpt.com`), com apenas 18% das visitas — enquanto o Google traz
70% das visitas. Citação por IA deixou de ser aposta de futuro: é hoje o canal
que mais traz cliente. 86% dos pagantes entraram por página de conteúdo.

**23/09 (30 dias):** o número absoluto do ChatGPT subiu e a fatia caiu, porque o
resto cresceu mais rápido — **54 de 205 cadastros (26%)** vieram com o carimbo
do ChatGPT; eram 31 de 72. Pagantes no período: **18 (9%)**, 8 deles entrando
por página de conteúdo. ⚠️ A fatia de VISITAS do ChatGPT (8% das visitas com
referenciador) **não é comparável** com a de cadastros: o app e o navegador
embutido do ChatGPT tiram o referenciador, então a visita some da conta e o
cadastro não (ele é contado pelo `utm_source`). Não dividir um pelo outro.

**A entidade está partida em duas (achado de 01/09, corrigir).** Perguntado o
que o faria recomendar cada nome, o ChatGPT tratou **Espelha Grupos e BOTinho
como produtos concorrentes** ("posso fazer uma comparação BOTinho × Espelha
Grupos"; "eu compararia Espelha Grupos, Promium, BOTinho"). A decisão de marca
de 08/2026 existia para dar entidade ÚNICA — na prática a IA leu duas. Toda
página precisa dizer, em texto e em schema (`publisher`/`brand`/`alternateName`),
que **BOTinho é o robô do Espelha Grupos**.

**O título nomeia o concorrente errado na maior consulta do site.** `achadinho
pro` (742 impressões) é respondida por `/alternativas/achadinhos-bot` — página
cujo título anuncia OUTRO produto ("Alternativa ao AchadinhosBot") — que ganha da
`/alternativas/achadinho-pro` por 631 a 111. CTR de 1,1% em posição 6,28 é isso,
não título vago. Título com número concreto rende o dobro ("4 lojas e 7 dias
grátis" = 2,76%; "comparativo honesto" = 1,33%). ⚠️ Há **teto** nessas consultas:
em `fluxopromo` estamos em posição 3 com o título certo e mesmo assim 0 clique em
133 impressões — quem digita a marca quer a marca.

**Indexação NÃO é o gargalo (revisto em 01/09).** As 7 páginas `/alternativas/*`
estão TODAS indexadas. Das 20 rotas do registry fora do índice, 16 nunca
entraram — entre elas `/metodologia-uso-responsavel-whatsapp`, que é exatamente
a página que faltava para o Google AI Overviews não inventar uma "Metodologia
BOTinho". E `/padronizar-divulgacao-afiliado-whatsapp` (CTR 9,68%, o melhor do
site) CAIU do índice.

Análise completa em `docs/marketing/ANALISE_SEO_2026-09-01.md`; plano de ação
priorizado, SERP real e benchmark do Promium em
`docs/marketing/PLANO_ACAO_SEO_IA_2026-09-01.md`.

Tier 1 (`shopee afiliados` etc., 50.000/mês, concorrência baixa) segue com
**41 impressões (2%) e zero clique** — não existe página comercial nossa
disputando, pelo terceiro relatório seguido. Maior oportunidade aberta. Sinal
novo: `/blog/como-divulgar-ofertas-amazon-whatsapp` (450 impressões) e
`/blog/como-ser-afiliado-shopee-whatsapp` (433) já pegam a periferia do tema.

### Concorrentes mapeados

Achadinho Pro, ProAfiliados, FluxoPromo, Shozap, Afilira, AchadinhosBot /
AchadinBot, IA Divulgadora, Devzapp (blog), Shark Pomo Bot, Lumi Ofertas
Inteligentes, Gigi Bot. **Promium** — agora com página própria
(`/alternativas/promium`, 02/09) e ficha completa em `competitors-data.js`:
R$97,90 a R$597,90/mês no valor **recorrente**, cobrando por faixa de grupos
(5/20/50/200) e por número de conexões. O plano de ENTRADA custa 42% mais que o
nosso Pro de R$69. ⚠️ Todos os planos dele anunciam preço promocional no 1º mês
— comparar pelo promocional é comparar coisa diferente, e por isso o campo
`price` de cada faixa carrega os dois números. Ele cobre MAIS que nós (10 lojas,
Telegram, vitrine com domínio próprio, rotador de links com pixel de
Meta/TikTok/GA4) e tem 13 páginas de "Automação \<loja\> para WhatsApp" no
rodapé — SEO programático por loja × recurso, o mesmo eixo da nossa frente
Tier 1.

Citados pelas IAs em 01/09 e **ainda não mapeados** (nenhum tem ficha em
`competitors-data.js`, então nenhum preço deles pode ser citado em página
pública): GoGoBot, OfertaFlux, FluxZap, Ripply, Núcleo do Afiliado,
DivulgaNinja, DivulgaLinks, Afilimais, ZincLink, Busqy, Notifish, Whats.Ly,
Radar das Promos, Ofertiva, BotAdmin, Afiliados Pro Bot, GeekZap, HouSoft,
WHAMetrics Bridge. Lembre que essa lista é **quase disjunta** da que o Search
Console mostra (AchadinhosBot, Achadinho Pro, FluxoPromo, Shozap) — são dois
mercados diferentes, e só um tem página nossa disputando. Preços e planos coletados por print em 2026-07-31 —
ver `docs/marketing/ONDA1_PLANO_DETALHADO.md` (B2) para o detalhe por
concorrente antes de citar preço em qualquer página pública.

### Registro de execução (comparar contra ele, não recomeçar do zero)

`docs/marketing/REGISTRO_EXECUCAO_2026-08-16_A_09-02.md` guarda o ciclo fechado
em 02/09: os três marcos de medição lado a lado (30/07, 16/08, 01/09), as 25 PRs
que entraram em produção, o que a medição **derrubou** (indexação não era
qualidade de conteúdo; título longo não mata clique — os dois mais longos são os
que mais convertem) e o que medir na rodada seguinte. Ao abrir a próxima
análise, comece por ele.

### 🔁 Atualizar mensalmente

No começo de cada mês, sugerir à usuária repetir **só o Relatório 1 (Search
Console)** do passo a passo de
`docs/marketing/COLETA_DADOS_KEYWORDS_PASSO_A_PASSO.md` e comparar contra o
baseline acima — principalmente **consultas distintas** e as páginas com muita
impressão e pouco clique. Rodar junto o relatório de **Cobertura/Indexação** e
os dois diagnósticos próprios (`scripts/diag-origem-cadastros.mjs` e
`scripts/diag-paginas-seo.mjs`, 30 dias). Atualizar esta seção e a data do
cabeçalho.

**Para medir efeito de mudança de título, use a série diária (`Gráfico.csv`),
não o acumulado.** O export de "Últimos 3 meses" mistura o antes com o depois e
dilui justamente o que se quer medir — em 16/09, o acumulado dava CTR de 3,67%
enquanto a semana corrente já estava em 4,77%. Recorte duas janelas do mesmo
tamanho em volta da data da mudança e compare.

**Não refazer Planejador e Trends todo mês.** Os dois medem volume de mercado,
que não muda em semanas, e as decisões que dependem deles já estão congeladas
(seção "SEO orgânico — linhas CONGELADAS"). Rodada completa dos quatro
relatórios: **a cada ~3 meses** (próxima em outubro/2026). O Relatório 4
(referrals de IA) não precisa mais de coleta manual —
`scripts/diag-origem-cadastros.mjs` já produz.

**Referrals de IA (Relatório 4, baseline zera em 2026-08-04).** O site grava a
origem de toda visita externa no evento `referral_visit` (`AnalyticsEvent`),
classificada por `dashboard/lib/ai-referral.js` em `ai`/`search`/`social`/
`other`. **Só o host do referenciador é gravado, nunca a URL completa** — URL de
buscador carrega o termo pesquisado, que é dado da pessoa; não regredir isso
(guard em `test/ai-referral.test.js`). **Todo evento público passa por TRÊS
allowlists, e faltar em qualquer uma descarta o dado sem erro nenhum:**
`PUBLIC_PERSISTED_EVENTS` (`dashboard/lib/analytics.js`) autoriza o navegador a
enviar, `PUBLIC_ANALYTICS_EVENTS` (`src/analytics.js`) autoriza a rota a aceitar
e `ANALYTICS_EVENTS` (idem) autoriza a gravação. Foi assim que
`organic_page_view` e `organic_cta_click` — as **duas primeiras etapas do funil
canônico** de `docs/marketing/event-taxonomy-v1.md` — ficaram desde 2026-05 sendo
descartadas: estavam só na terceira. O funil de SEO só passava a existir no
`signup_created`, e não havia como separar "ninguém acha a página" de "acham e
não clicam", que pedem consertos opostos. Corrigido em 2026-08-17 (guard em
`test/pagina-achadinhos-clique.test.js`, leitura em
`scripts/diag-paginas-seo.mjs`). Lembre que a allowlist do navegador vai para o
**bundle**: mudança nela só vale depois de `npm run build` no dashboard.
Cuidado ao renomear os campos: `sanitizeAnalyticsMetadata` descarta
qualquer chave que case com `/(token|secret|…|key|url|…)/i`, então algo como
`referrer_url` seria descartado em silêncio.

**Conferir todo mês que a Cloudflare não voltou a bloquear as IAs — nos DOIS
níveis, robots.txt e WAF:**

```bash
curl -s https://espelhagrupos.com.br/robots.txt | grep -c "Disallow: /$"   # 0 = ok
node scripts/diag-acesso-robos-ia.mjs   # pede a home com o nome de cada robô; exit 1 = robô de busca/clique barrado
```

O `Managed robots.txt` da Cloudflare veio **ligado por padrão** e colava
`Disallow: /` para GPTBot, ClaudeBot, Google-Extended e CCBot na frente do
`robots.txt` do site — descoberto e desligado em 2026-08-04. Enquanto esteve
ligado, os robôs de *resposta* (OAI-SearchBot, Claude-SearchBot) passavam, mas
os de *indexação/treino* não. Se voltar a ligar, o trabalho de IA para de valer
em silêncio.

⚠️ **O robots.txt limpo NÃO prova que os robôs passam** (RCA 2026-09-18, abaixo):
o bloqueio pode estar no WAF, e aí a resposta é 403 com o robots.txt dizendo
`Allow: /`. Só a segunda linha enxerga isso.

### Robôs de IA barrados no WAF com robots.txt limpo (RCA 2026-09-18 — não regredir)

Medido em produção em 18/09, pedindo a home com o User-Agent de cada robô a
partir do mesmo IP (`scripts/diag-acesso-robos-ia.mjs`):

| Robô | Papel | Resposta |
|---|---|---|
| navegador comum (controle) | — | 200 |
| OAI-SearchBot (busca do ChatGPT), ChatGPT-User (clique), PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User, Googlebot, Google-Extended, bingbot, DuckAssistBot, Applebot, meta-externalagent, MistralAI-User | busca / clique / treino | 200 |
| **GPTBot** (treino da OpenAI), **ClaudeBot** (treino da Anthropic), CCBot, Bytespider, Amazonbot | treino | **403** |

Dois nomes emprestados, mesmo IP, respostas diferentes → a regra é por
categoria de User-Agent: é o bloqueio de **"AI crawlers de treino"** da
Cloudflare (Security → Bots → AI Crawl Control / regra gerenciada), ligado por
padrão em domínio novo desde jul/2025. O `robots.txt` não enxerga nada disso e
a checagem mensal antiga passava verde.

**O que isso muda, e o que não muda:**

- **Não impede a citação no ChatGPT com busca, na Perplexity, no Gemini nem no
  AI Overviews** — todos leem pelo robô de *busca*, que passa. O placar de
  citação de 09/2026 foi medido com este bloqueio ligado.
- **Impede que o próximo modelo aprenda a marca no treino.** Sem busca, o
  ChatGPT já devolve zero produtos nomeados em 8 de 8 consultas
  (`ROTEIRO_MEDICAO_IA.md`); com GPTBot barrado, isso não muda com o tempo.
  Concorrente que libera o GPTBot entra no modelo; nós não.
- **É decisão da dona, não defeito.** Liberar GPTBot/ClaudeBot troca
  privacidade do conteúdo público (que já é público) por presença no treino.
  Se liberar: Cloudflare → Security → Bots → AI Crawl Control → permitir
  GPTBot e ClaudeBot (pode manter CCBot/Bytespider barrados). Depois rodar o
  script de novo: GPTBot tem que sair de 403.

**Não regredir:** a checagem mensal tem as duas linhas; `src/ops/aiBotAccess.js`
é a regra pura (papel do robô decide a gravidade: busca/clique barrado reprova,
treino barrado só avisa; sem medição confiável nunca afirma bloqueio) e
`test/ops-ai-bot-access.test.js` a guarda. Um 200 para nome emprestado não
prova que o robô real passa (a Cloudflare pode checar o IP); um 403 é prova
forte.

**O bloqueio mora em DOIS lugares do painel, e o script só enxerga um** (visto
nos prints de 18/09): (1) Security → Settings → "Configure AI bot policies" →
categoria **Training = Disallow** — é a regra por User-Agent que devolve o 403
de 25 bytes "Your request was blocked." ao nome emprestado; (2) AI Crawl
Control → Crawlers → botão **"Block Crawler"** por robô, que age sobre o robô
REAL (verificado por IP). No print, **Claude-User** (o clique na citação do
Claude) estava com "Block Crawler" ligado e **45 recusas em 7 dias** — e o
script dava 200 para ele, porque o nome emprestado do VPS não é o robô
verificado. Ou seja: **a coluna "Unsuccessful" do painel é a medição do robô
real; o script mede só a regra por categoria.** Conferir os dois. "Enable Bot
Preference Sync" fica DESLIGADO: ele reescreve o `robots.txt` na borda, que é
exatamente o que o `Managed robots.txt` fazia (RCA 2026-08-04).

### O site dizia coisas diferentes para a IA e para a pessoa (mesmo RCA, 2026-09-18)

Achados do inventário de legibilidade por IA, todos corrigidos no mesmo dia:

- **`og:image` apontava para `/api/public/og`, rota que nunca existiu** (404 em
  produção) em 7 templates, inclusive as 5 páginas de loja do Tier 1; a home
  não declarava imagem nenhuma. Prévia sem imagem no WhatsApp, no ChatGPT e na
  Perplexity. Hoje é um arquivo estático (`dashboard/public/og-default.png`,
  gerado por `node scripts/build-og-image.mjs`); guarda em
  `test/og-image-existe.test.js`. **Nunca voltar a servir OG por rota.**
- **`/api/public/faq` e `/api/public/plans`** — abertos no `robots.txt`
  justamente para as IAs — devolviam o seed de 05-06/2026: "4 lojas" (Shopee,
  ML, Amazon, Magalu) quando são 6. A home troca o FAQ estático pelo da API ao
  hidratar e `/precos` prefere as features do banco, então o texto VISÍVEL
  também dizia 4 enquanto `pricing.md` e o JSON-LD diziam 6. Migration DML
  guardada (`20260918120000_sync_public_faq_plans_six_stores`: só troca a linha
  que ainda está com o texto do seed; edição feita no admin não é sobrescrita)
  + `test/public-faq-plans-sync.test.js`, que falha se `DEFAULT_LANDING_PLANS`
  / `CORE_FAQ_ITEMS` mudarem sem migration nova de sincronia. Lojas agora vêm
  de UMA constante (`SUPPORTED_STORES`).
- **`llms.txt`** não citava preço nem as 6 lojas e omitia as páginas que
  convertem (Tier 1 por loja, `/precos`, `/espelha-grupos-e-confiavel`,
  `/alternativas/*`) — e a Perplexity preenchia o nosso preço com o de
  concorrente. Reescrito (resumo pt-BR + preços + lojas + páginas);
  `test/llms-txt-sync.test.js` exige preço = `DEFAULT_LANDING_PLANS`, as 6
  lojas, as páginas de venda e que **toda URL exista no registro SEO**.
- **A chegada por IA não era medida onde estão 47% das impressões.** Só 15
  templates emitiam `referral_visit` e gravavam o cookie de primeira página;
  `/alternativas/*` e os 19 posts do blog não. `PublicReferralTracker`
  (mesma regra de privacidade: só o host) entrou no `ComparisonPageTracker` e
  no `ArticleShell`; `signupOrigin.js` passou a reconhecer as páginas do Tier 1
  e de 11/09 (cadastro vindo delas caía em "Direto / ambíguo") e mais motores
  (grok, deepseek, meta, mistral). Guarda: `test/referral-tracking-cobertura.test.js`.
- **Resíduos de entidade no schema:** `/conteudos` declarava `WebSite` com o
  codinome interno `WABOT`; as LPs programáticas emitiam `alternateName` igual
  ao próprio nome e `brand` solto; a `Product` de `/precos` descrevia 4 lojas;
  as 5 páginas Tier 1 e `/alternativas/promium` não tinham data (o promium
  caía no fallback 2026-05-15, antes de existir). O layout raiz agora emite
  `WebSite` (`#website`) e `SoftwareApplication` com `@id`, `inLanguage` e
  `featureList`; páginas apontam para `#organization`/`#website` por `@id`.
- **O template de PR mandava usar "BOTinho" como marca principal**
  (`.github/PULL_REQUEST_TEMPLATE.md`) — contrário à decisão de 02/09. Quem
  seguisse o checklist reintroduzia o nome aposentado.

## Nome antigo fora do texto público e rotas renomeadas (decisão 2026-09-19 — não regredir)

Decisão da dona do produto em 19/09/2026, depois da medição de 11/09 (o
ChatGPT tratava o nome antigo e "Espelha Grupos" como produtos concorrentes;
três das quatro IAs leem o nome antigo solto como calçado infantil):

- **Em superfície pública escreve-se SÓ "Espelha Grupos"** — nem o nome antigo
  sozinho, nem emparelhado ("X é o nome do robô do Espelha Grupos"). A versão
  emparelhada existiu de 11/09 a 19/09 em seis páginas e foi retirada. A
  ligação com as citações antigas fica **só** no schema (`alternateName`, via
  `BRAND_LEGACY_NAME`) e na linha de "nome anterior" do `llms.txt`/`pricing.md`.
  Área logada (painel, admin, login) não é superfície pública e pode manter.
- **As 5 rotas que carregavam o nome antigo no endereço foram renomeadas** com
  redirect permanente (`LEGACY_ROUTE_REDIRECTS` em `dashboard/next.config.mjs`):
  `/bot-comum-vs-espelha-grupos`, `/como-funciona-espelha-grupos-canais`,
  `/protecao-antiban-espelha-grupos`, `/espelha-grupos-vs-planilha-manual`,
  `/espelha-grupos-vs-ferramentas-genericas-automacao`. Somavam 27 impressões
  e 1 clique em 3 meses; o redirect preserva o que havia. Não remover os
  redirects: sem eles o Google devolve 404 para quem já indexou o endereço
  antigo.
- `sameAs` da Organization leva também o Instagram oficial (`@espelhagrupos`,
  `BRAND_INSTAGRAM_URL`).

Guarda: `test/nome-antigo-fora-do-texto-publico.test.js` (varre `dashboard/app`
fora da área logada, `dashboard/components` e `lp-config.mjs`; exige o redirect
de cada rota antiga e que o destino exista no registro SEO).

**Páginas de resposta (mesma data):** três posts com título igual à pergunta
que as IAs recebem — `/blog/como-espelhar-mensagens-entre-grupos-whatsapp`
(HowTo + tabela dos 4 caminhos), `/blog/melhores-automacoes-para-afiliado-shopee-2026`
(ItemList) e `/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp` —
cada um com bloco de conversão (preço, "melhor para", CTA), sem preço de
concorrente (só nome + link para a ficha datada em `/alternativas`) e linkados
de páginas com impressão. O schema HowTo/ItemList é **derivado das seções**
(`schema: 'HowTo'` + `steps`, `schema: 'ItemList'` + `items` em
`_preservationBlogPosts.js`): o que a pessoa lê é o que a IA lê. Lista comum
sem a flag não vira ItemList.

**LTV e retenção:** `scripts/diag-ltv-retencao.mjs` (read-only, contas de
teste fora) sobre `src/domain/admin/ltvRetention.js` (puro). Realizado e
projetado nunca viram um número só; retenção sai da COBERTURA paga (plano de
90 dias não "cancela" no mês seguinte); coorte nova devolve `null`, não zero;
menos de 5 pagantes ou zero cancelamento observado → sem projeção. O plano de
marketing bloqueia anúncio pago até esse número existir. Teste:
`test/admin-ltv-retencao.test.js`.
