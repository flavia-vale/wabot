# Série histórica — busca e citação por IA

Arquivo único de comparação. Toda análise nova começa por aqui, e acrescenta
uma coluna em vez de recomeçar a contagem.

Fontes por marco: Search Console (Desempenho + Cobertura), Cloudflare AI Crawl
Control, `ai_visibility_tracking.csv` e os diagnósticos próprios
(`diag-origem-cadastros.mjs`, `diag-paginas-seo.mjs`).

---

## 1. Busca (Search Console)

Compare sempre pela **soma da aba "Países"** — o painel-resumo inclui linhas sem
país atribuído e as duas metodologias não se misturam.

| Métrica | 30/07 | 16/08 | 01/09 | 10/09 | 16/09 | **23/09** |
|---|---:|---:|---:|---:|---:|---:|
| Cliques | 40 | 93 | 177 | — | 490 | **680** |
| Impressões | 1.102 | 2.902 | 5.773 | — | 13.362 | **16.581** |
| CTR | 3,63% | 3,20% | 3,07% | — | 3,67% | **4,10%** |
| Posição média (Brasil) | 7,85 | 7,60 | 7,68 | 6,99 | 6,62 | **6,47** |
| Consultas distintas | 13 | 29 | 115 | — | 180 | **225** |
| Páginas com impressão | 60 | 77 | 79 | 86 | 101 | **113** |
| Indexadas / fora | — | — | 77 / 51 | 81 / 53 | — | ver nota |

Os marcos de 10/09, 16/09 e 23/09 usaram janela de **3 meses** e não são
comparáveis linha a linha com os anteriores (12 meses). O que é comparável é a
série diária:

| Mês fechado | Cliques | Impressões | CTR |
|---|---:|---:|---:|
| Junho (a partir de 08) | 8 | 336 | 2,38% |
| Julho | 33 | 656 | 5,03% |
| Agosto | 153 | 5.286 | 2,89% |
| **1 a 21 de setembro** | **489** | **10.487** | **4,66%** |

Três semanas de setembro já renderam **3,2× os cliques de agosto inteiro**.

### Série semanal (`Gráfico.csv` de 23/09, semanas terminando no último dia com dado)

| Semana | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| 28/07–03/08 | 6 | 227 | 2,64% | 7,53 |
| 04/08–10/08 | 29 | 849 | 3,42% | 7,60 |
| 11/08–17/08 | 39 | 1.038 | 3,76% | 7,49 |
| 18/08–24/08 | 25 | 931 | 2,69% | 11,31 |
| 25/08–31/08 | 59 | 2.343 | 2,52% | 8,98 |
| 01/09–07/09 | 124 | 3.515 | 3,53% | 6,19 |
| 08/09–14/09 | 173 | 3.630 | 4,77% | 5,74 |
| **15/09–21/09** | **192** | **3.342** | **5,75%** | **5,94** |

A última semana teve **mais clique com menos impressão** — o crescimento passou
a vir da taxa de clique, não do volume. Quarta semana seguida de CTR subindo.

**Indexação em 23/09 (nota da tabela):** "Detectada, mas não indexada" caiu para
**4 páginas**, todas rotas renomeadas em 19/09 que ainda não foram rastreadas
(`/bot-comum-vs-espelha-grupos`, `/como-funciona-espelha-grupos-canais`,
`/espelha-grupos-vs-planilha-manual`, `/protecao-antiban-espelha-grupos` — os
nomes antigos respondem 308 para elas). "Rastreada, mas não indexada": 20
endereços, dos quais 11 são LPs de cidade/nicho **congeladas** (esperado), 6 são
arquivos (fonte, favicon, `llms.txt`, `pricing.md`) e 1 é página de verdade:
`/espelha-grupos-vs-ferramentas-genericas-automacao`, rastreada em 21/09.

### Páginas por loja (Tier 1), impressões / cliques na janela de 3 meses

| Página | 16/09 | **23/09** |
|---|---:|---:|
| `/shopee-afiliados-whatsapp` | 21 / 1 | **61 / 3** |
| `/mercado-livre-afiliados-whatsapp` | 14 / 0 | **55 / 1** |
| `/amazon-afiliados-whatsapp` | 32 / 0 | **71 / 0** |
| `/shein-afiliados-whatsapp` | 55 / 0 | **160 / 3** |
| `/magalu-afiliados-whatsapp` | 1 / 0 | **6 / 0** |
| **Total** | **123 / 1** | **353 / 7** |

O salto veio na semana em que as páginas mais fortes passaram a linkar as lojas
(17/09). As **consultas** de marketplace mal andaram (33 → 49 impressões): as
páginas aparecem em cauda longa, e os termos-cabeça de 50.000/mês seguem fora.

### Comparativos novos de 17/09 (primeira semana)

Seis das dez já aparecem: `divulgalinks` 18, `divulgador-inteligente` 12,
`lumi-ofertas-inteligentes` 7, `afilimais` 3, `ia-divulgadora` 2, `shark` 1
impressões. Ainda sem impressão: `busqy`, `afilira`, `divulga-ninja`,
`afiliado-inteligente` (pedidas em 21/09). E os nomes já aparecem como busca:
`divulgalinks preço` (4), `afilimais` (3), `lumi ofertas inteligentes` (2),
`divulgalinks planos` (1) — pouco, mas **não é zero**, ao contrário do que se
supôs em 17/09.

### Marca

| Consulta | 16/09 | **23/09** |
|---|---|---|
| `espelha grupos` | 19 impressões / 17 cliques / posição 1,11 | **51 / 39 / 1,06** |

Buscas por nome de concorrente seguem **95% das impressões** (7.400 de 7.800
nas consultas listadas). `achadinho pro` sozinha: 3.806 impressões, 39 cliques
(1,0%), posição 6,18.

### Concentração por cluster (medido em 10/09, janela de 3 meses)

| Cluster | Páginas | Cliques | Impressões | % das impressões |
|---|---:|---:|---:|---:|
| `/alternativas/*` | 7 | 76 | 5.055 | 47% |
| Home | 1 | 75 | 311 | 3% |
| Cidades | 8 | 2 | 55 | 0,5% |
| Nichos (`bot-ofertas-*`) | 12 | 5 | 127 | 1,2% |

### Dispositivo

| | 10/09 CTR | 16/09 CTR | **23/09 cliques** | **23/09 impressões** | **23/09 CTR** | 23/09 posição |
|---|---:|---:|---:|---:|---:|---:|
| Computador | 3,94% | 4,31% | 357 | 7.360 | **4,85%** | 7,78 |
| Celular | 2,75% | 3,20% | 320 | 9.101 | **3,52%** | 6,28 |

Celular ranqueia melhor e converte pior — padrão estável desde 16/08. A
distância está parada em ~1,35-1,4× desde que os títulos foram encurtados.

---

## 2. Citação por IA

| Rodada | Medições | Citações | Observação |
|---|---:|---|---|
| 01/09 | 28 | **3** (todas ChatGPT Search) | 7 consultas × 4 superfícies |
| 10/09 | 43 | **10** (+1 parcial) | conjunto ainda media o nome aposentado |
| 11/09 | 16 | **9** (+1 parcial) | primeira rodada da Trilha B (marca atual) |
| 23/09 | 10 (só ChatGPT até agora) | **5** | Trilha A 2/5 · Trilha B 3/4 · Trilha C sem contaminação |

### Por superfície

| Superfície | 01/09 | 10/09 | 11/09 | 23/09 |
|---|---|---|---|---|
| ChatGPT Search | 3/7 | 3/7 (conta neutra) · 6/8 (conta logada, inflada) | 2/4 | **5/9** (A 2/5 · B 3/4) |
| Google AI Overviews | 0/7 | 1/8 | 2/4 | ⏳ |
| Google Gemini | 0/7 | 0/6 (+1 parcial) | **3/4** | ⏳ |
| Perplexity | 0/7 | 0/6 | 2/4 (+1 parcial) | ⏳ |

**ChatGPT em 23/09 (busca ligada, conta não informada, sem sinal de
personalização):** cita e recomenda em "ferramenta para divulgar ofertas" e em
"como espelhar mensagens"; **não** cita em "bot para afiliados", que ele lê como
bot de catálogo (Afilira, Easyfy, Shozap, LucreShop). Trilha B: preço certo,
metodologia virou (0 em 11/09 → citado com o nosso vocabulário), e
**"o que é" segue 0** — terceira rodada seguida em que "espelha grupos" é lido
como expressão, não como marca. Marca partida de novo ("Espelha Grupos, BOTinho
e alternativas").

⚠️ **Objeção nova, a mais séria da rodada:** perguntado se é confiável, o
ChatGPT pesquisou e concluiu "não diria ainda que é confiável no sentido
empresarial" — **não há CNPJ nem razão social em nenhuma página do site**
(conferido no código em 23/09), não há página no Reclame Aqui e há poucas
avaliações independentes. É a objeção que a IA entrega a quem vai conectar o
WhatsApp. Publicar a identificação jurídica é decisão da dona do produto.

### As três viradas de 11/09, na mesma superfície e mesma pergunta

| Superfície | 10/09 | 11/09 |
|---|---|---|
| Gemini · preço | "mediante planos de assinatura no site" | Basic R$39, Pro R$69, conteúdo de cada plano, trial, Pix, sem fidelidade |
| Gemini · metodologia | inventou um "Funil BOTinho" com 5 pilares falsos | cita `espelhagrupos.com.br` na primeira linha |
| Perplexity · marca | não sabia que o software existe; fundia com BotConversa e Afiliados Pro Bot | "ferramenta legítima, não há indícios de que seja site falso ou golpe" |

**A diferença entre 10/09 e 11/09 é o NOME na consulta, não o site.** A retirada
de "BOTinho" da superfície pública entrou em `main` em 02/09 (`8823b68`); as duas
rodadas mediram o mesmo site.

### Resultado por consulta (11/09)

| Consulta | Citações |
|---|---|
| espelha grupos preço | 3/4 (+1 parcial) |
| espelha grupos metodologia WhatsApp | 3/4 |
| espelha grupos é confiável | 3/4 |
| espelha grupos whatsapp o que é | **0/4** |

ChatGPT em 23/09: preço ✅, metodologia ✅ (virou), é confiável ✅ com objeção
de CNPJ, o que é ❌.

---

## 3. Colisões de nome, por rodada

| Rodada | Nome medido | O que a IA devolve |
|---|---|---|
| 01/09 | BOTinho | calçado infantil (3 de 4 superfícies) |
| 10/09 | BOTinho | calçado, Projeto Botinho (bombeiros), peixe de aquário, BotConversa, Afiliados Pro Bot |
| 11/09 | Espelha Grupos | produto correto em 9 de 16 — **exceto** `é confiável` no AI Overviews, que devolve **golpe de espelhamento de tela** |

A colisão mudou de natureza: deixou de ser um homônimo inofensivo (calçado) e
passou a ser **fraude**, na consulta em que a pessoa decide se confia.

---

## 4. Origem de cadastro e receita

| Métrica | 01/09 | **23/09** (30 dias, desde 24/08) |
|---|---:|---:|
| Cadastros no período | 72 | **205** |
| Cadastros com carimbo do ChatGPT | 43% (31 de 72) | **26% (54 de 205)** |
| Cadastros que entraram por página de conteúdo | — | 37% (75) |
| Visitas vindas do ChatGPT (por referenciador) | 18% | 8% (78 de 1.034) — ver aviso |
| Visitas vindas do Google | 70% | 86% (892) |
| Pagantes no período | — | **18 (9% dos cadastros)** |
| Pagantes que entraram por página de conteúdo | 86% | 44% (8 de 18) — janelas diferentes |
| Dias entre cadastro e 1º pagamento | — | 7,4 (≈ o teste grátis) |

O ChatGPT converte **2,4× acima** da sua participação em visitas. É a assimetria
mais forte de todo o conjunto e é o que sustenta priorizar citação por IA.

⚠️ **23/09 — não calcular essa assimetria de novo com estes números.** A visita
é contada pelo referenciador, que o app e o navegador embutido do ChatGPT
removem; o cadastro é contado pelo `utm_source`, que sobrevive. Com 78 visitas e
54 cadastros, a "conversão" daria 69%, o que só prova que a visita está
subcontada. O número confiável é o de cadastros: **54 por mês**, contra a meta
de 60 até 18/10 (`PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md`, seção 8).

Entrada dos cadastros de 23/09: home 50% (102, ambíguo — inclui 44 que chegaram
em `/?utm_source=chatgpt.com`), página de busca 32% (66), direto no cadastro
11%, comparativo 3% (6), `/precos` 2%, blog 1%.

### Funil por página (`diag-paginas-seo.mjs --dias 30`, 23/09)

| Página | Visitas | Clique em CTA | Cadastros |
|---|---:|---:|---:|
| `/` | 993 | 25,7% | 102 |
| `/bot-achadinhos-whatsapp` | 303 | 38,9% | 39 |
| `/alternativas/achadinhos-bot` | 131 | **7,6%** | 3 |
| `/precos` | 105 | 19,0% | 5 |
| `/bot-afiliados-whatsapp` | 102 | **47,1%** | 14 |
| `/alternativas/achadinho-pro` | 58 | 19,0% | 1 |

Páginas com 5+ visitas e **zero** clique: `/alternativas/bot-para-whatsapp-afiliados`
(14), `/alternativas/shozap` (13), `/rastrear-resultados-de-divulgacao-em-grupos` (8).
Os comparativos novos de 17/09 têm 1-2 visitas cada: cedo demais para ler.

## 4b. LTV e retenção (`diag-ltv-retencao.mjs`, primeira leitura em 23/09)

| Realizado (medido) | Valor |
|---|---:|
| Clientes pagantes | 30 |
| Receita aprovada somada | R$ 1.613,10 |
| Valor médio por cliente (mediana) | R$ 53,77 (R$ 39,00) |
| Meses pagos por cliente, média | 1,13 |
| Renovaram ao menos uma vez | 17% — Pro 29% (de 14), Basic 6% (de 16) |

| Coorte do 1º pagamento | Clientes | Ainda pagando 1 mês depois |
|---|---:|---|
| 2026-07 | 2 | 1 de 2 |
| 2026-08 | 8 | 4 de 4 mensuráveis |
| 2026-09 | 18 | — (ainda não chegou a hora de renovar) |

Projeção do script: cancelamento de 9%/mês (3 em 34 cliente-mês), vida de 11
meses, **R$ 527 por cliente — confiança média**.

⚠️ **Não decidir anúncio com a projeção.** Ela se apoia em 34 cliente-mês e 3
cancelamentos. 18 dos 30 pagantes entraram em setembro e ainda não chegaram à
primeira renovação — é por isso que "renovaram 17%" parece baixo. O que decide
é essa coorte renovar ou não, na primeira quinzena de outubro. Até lá, o teto
de gasto por cadastro fica entre **≈ R$ 4,70** (valor realizado × 8,8% de
conversão, 18 de 205) e **≈ R$ 46** (valor projetado × 8,8%) — uma diferença de
10×, que só o dado de outubro fecha.

---

## 5. Robôs de IA (Cloudflare, janela de 24h em 09/09)

| Robô | Requisições | Dados |
|---|---:|---:|
| BingBot | 49 | 594,72 kB |
| ChatGPT-User | 41 | 553,31 kB |
| OAI-SearchBot | 33 | 224,04 kB |
| Claude-User | 18 | 42,44 kB |
| GPTBot | 15 | — |
| Googlebot | — | 32,98 kB |

Janela de 24h num painel feito para medir robô de IA **não** é evidência sobre o
Googlebot. Reconferir com janela mensal.

`robots.txt` conferido em 10/09: **0 bloqueios**.

**23/09:** `robots.txt` com 0 bloqueios e `node scripts/diag-acesso-robos-ia.mjs`
com **19 de 19 robôs em 200** (GPTBot, ClaudeBot, PerplexityBot, Googlebot,
bingbot e os demais). O bloqueio da Cloudflare de 18/09 segue desfeito. Números
de visita por robô em janela de 30 dias: pendente (Cloudflare → AI Crawl Control).

### 30 dias (Cloudflare AI Crawl Control, 24/08 a 23/09)

**7 mil pedidos**, 5 mil respondidos, 2 mil sem sucesso. Página mais lida: a
home (765). Só a OpenAI somou **1,84 mil** pedidos atendidos, mais que o
Bing (1,26 mil) e o Google (844).

| Robô | Atendidos | Sem sucesso | % sem sucesso | Quem é |
|---|---:|---:|---:|---|
| BingBot | 1.260 | 4 | 0% | busca |
| Googlebot | 844 | 23 | 3% | busca |
| ChatGPT-User | 773 | 81 | 9% | **pessoa perguntando ao ChatGPT agora** |
| OAI-SearchBot | 644 | 92 | 12% | índice de busca do ChatGPT |
| GPTBot | 420 | 167 | 28% | treino OpenAI |
| ClaudeBot | 391 | 182 | 32% | treino Anthropic |
| Applebot | 199 | 82 | 29% | Siri/Apple |
| Bytespider | 181 | 82 | 31% | ByteDance |
| PerplexityBot | 180 | 137 | 43% | índice da Perplexity |
| Claude-User | 132 | **308** | **70%** | pessoa perguntando ao Claude agora |
| Perplexity-User | 30 | **130** | **81%** | pessoa perguntando à Perplexity agora |
| MistralAI-User | 28 | 72 | 72% | pessoa perguntando ao Mistral agora |
| DuckAssistBot | 26 | 34 | 57% | DuckDuckGo |
| Claude-SearchBot | 24 | 38 | 61% | índice do Claude |
| Meta-ExternalAgent | 18 | 31 | 63% | Meta |
| TikTok Spider | 6 | 634 | 99% | TikTok (irrelevante) |
| Amazonbot | 5 | 91 | 95% | Amazon |
| CCBot | 6 | 84 | 93% | Common Crawl |

⚠️ **Achado a investigar, não conclusão:** os robôs que buscam a página **na
hora em que uma pessoa pergunta** falham muito mais no Claude (70%), na
Perplexity (81%) e no Mistral (72%) do que no ChatGPT (9%). Três causas
possíveis, com ações opostas: endereço inventado pela IA (404, sem ação nossa),
endereço antigo renomeado em 19/09 (redirecionamento contado como falha?) ou
bloqueio da Cloudflare por reputação do IP de nuvem (ação nossa). O
`diag-acesso-robos-ia.mjs` deu 19/19 em 200 **na home**, então não é bloqueio
por nome de robô. O que separa: no AI Crawl Control, filtrar Claude-User e
Perplexity-User e ver os códigos e os endereços dos pedidos sem sucesso.

**Série diária exportada (23/09)** — Claude-User e Perplexity-User por dia. O
arquivo traz só a contagem, **sem código nem endereço**, e a soma (123 e 17) não
bate com nenhum dos totais do painel, então não serve para separar sucesso de
falha. O que ela mostra: **pico em 18/09** nos dois (Claude-User 29, 6× a média;
Perplexity-User 13, contra zero nos 25 dias anteriores) — **o mesmo dia do
bloqueio da Cloudflare**. *Hipótese:* parte das falhas é daquele bloqueio, já
desfeito. Confirma-se abrindo o detalhe de um dos robôs e olhando o código de
resposta.

### Bing Webmaster Tools (primeira leitura, 23/09)

| Janela | Impressões | Cliques | CTR |
|---|---:|---:|---:|
| 28/07 a 21/09 (8 semanas) | 265 | 17 | 6,4% |
| 14 a 21/09 (8 dias) | 126 | 10 | 7,9% |

- Metade das impressões de 8 semanas veio nos últimos 8 dias.
- O Bing é **~1,6%** do volume do Google (16.581 impressões em 3 meses).
- **11 dos 17 cliques são de marca** (`espelha grupos` 5, `espelha grupo` 4,
  `espelhargrupos.com.br` 2). `achadinhosbot` e variações: 28 impressões,
  posição ~7, 0 clique.
- Muitas consultas longas e de comparação ("afilira bot afiliados whatsapp
  preço avaliação", "pro afiliados whatsapp bot avaliação preço", "shozap
  ferramenta afiliados site oficial preço"). *Hipótese não verificada:* são
  buscas que as IAs fazem por baixo para montar a resposta.
- **IndexNow funciona:** o deploy de produção de 23/09 avisou o Bing de **106
  endereços, status 200**.
- O Explorador de sites exportou **50** endereços da raiz, e só 38 deles estão
  entre as rotas atuais. Faltam as 5 páginas de loja, `/bot-achadinhos-whatsapp`
  e todas as renomeadas em 19/09; sobram 12 antigas (cidades, nichos, nomes com
  "botinho"). ⚠️ 50 exatos pode ser teto da exportação: **não concluir** que o
  Bing não conhece essas páginas antes de inspecionar uma delas no próprio Bing.

---

## 6. O que cada rodada derrubou

- **16/08:** indexação não era problema de qualidade de conteúdo.
- **01/09:** título longo não mata clique — os dois mais longos são os que mais
  convertem.
- **10/09:** indexação não é o gargalo do tráfego; o crescimento veio das mesmas
  páginas aparecendo em mais buscas.
- **11/09:** a marca não era desconhecida pelas IAs — o conjunto de consultas é
  que media o nome aposentado. **28% das medições de 10/09 foram gastas num nome
  que ninguém procura.**
- **23/09:** a falta de impressão das páginas por loja era **descoberta**, e o
  link interno a resolveu (123 → 353 impressões em uma semana). Mas o Google as
  põe em cauda longa, não nos termos de 50.000/mês — a próxima pergunta é de
  disputa, não de indexação.
- **23/09:** "ninguém busca o nome dos concorrentes novos" era falso:
  `divulgalinks preço`, `afilimais` e `lumi ofertas inteligentes` já aparecem
  como consulta na primeira semana.
- **23/09:** a fatia do ChatGPT nas visitas não serve para calcular conversão —
  o referenciador some no app. Contar só pelo carimbo no cadastro.
- **11/09 (segunda correção):** "não existe página comercial nossa disputando
  Tier 1" era **falso nas três análises que o afirmaram**. As cinco páginas de
  loja existem em produção desde 02/09 e têm zero impressão porque não foram
  indexadas. O relatório de Páginas do Search Console só lista páginas COM
  impressão — ausência ali nunca prova ausência da página.

---

## 7. Correções de dado aplicadas a este arquivo

- **11/09:** três linhas de 01/09 gravavam `SIM` em maiúscula em
  `botinho_cited`, e qualquer contagem exata as perdia — foi assim que o placar
  de 01/09 apareceu como 0 em vez de 3. Valores normalizados para minúsculas. A
  validação do CSV (Issue 8) precisa travar o domínio dessa coluna.

- **11/09 — conferir o repositório antes de afirmar que algo não foi feito.**
  Antes de escrever numa análise que uma página não existe:

  ```bash
  ls dashboard/app | grep -i <termo>
  grep -c "<rota>" dashboard/lib/seo-registry.mjs
  curl -s -o /dev/null -w "%{http_code}\n" https://espelhagrupos.com.br/<rota>
  ```

  Página com zero impressão **não aparece** no relatório de Páginas. "Não está no
  relatório" e "não existe" são estados diferentes, com ações opostas.
