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

| Métrica | 30/07 | 16/08 | 01/09 | 10/09 |
|---|---:|---:|---:|---:|
| Cliques | 40 | 93 | 177 | — |
| Impressões | 1.102 | 2.902 | 5.773 | — |
| CTR | 3,63% | 3,20% | 3,07% | — |
| Posição média (Brasil) | 7,85 | 7,60 | 7,68 | 6,99 |
| Consultas distintas | 13 | 29 | 115 | — |
| Páginas com impressão | 60 | 77 | 79 | 86 |
| Indexadas / fora | — | — | 77 / 51 | 81 / 53 |

O marco de 10/09 usou janela de 3 meses e não é comparável linha a linha com os
anteriores (12 meses). O que é comparável é a série diária:

| Mês fechado | Cliques | Impressões | CTR |
|---|---:|---:|---:|
| Junho (a partir de 08) | 8 | 336 | 2,38% |
| Julho | 33 | 656 | 5,03% |
| Agosto | 153 | 5.286 | 2,89% |
| **1 a 7 de setembro** | **124** | **3.515** | **3,53%** |

Sete dias de setembro renderam 81% dos cliques de agosto inteiro, com o CTR
subindo junto com o volume.

### Concentração por cluster (medido em 10/09, janela de 3 meses)

| Cluster | Páginas | Cliques | Impressões | % das impressões |
|---|---:|---:|---:|---:|
| `/alternativas/*` | 7 | 76 | 5.055 | 47% |
| Home | 1 | 75 | 311 | 3% |
| Cidades | 8 | 2 | 55 | 0,5% |
| Nichos (`bot-ofertas-*`) | 12 | 5 | 127 | 1,2% |

### Dispositivo (10/09)

| | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| Computador | 168 | 4.269 | 3,94% | 9,24 |
| Celular | 150 | 5.448 | 2,75% | 6,64 |

Celular ranqueia melhor e converte pior — padrão estável desde 16/08.

---

## 2. Citação por IA

| Rodada | Medições | Citações | Observação |
|---|---:|---|---|
| 01/09 | 28 | **3** (todas ChatGPT Search) | 7 consultas × 4 superfícies |
| 10/09 | 43 | **10** (+1 parcial) | conjunto ainda media o nome aposentado |
| 11/09 | 16 | **9** (+1 parcial) | primeira rodada da Trilha B (marca atual) |

### Por superfície

| Superfície | 01/09 | 10/09 | 11/09 |
|---|---|---|---|
| ChatGPT Search | 3/7 | 3/7 (conta neutra) · 6/8 (conta logada, inflada) | 2/4 |
| Google AI Overviews | 0/7 | 1/8 | 2/4 |
| Google Gemini | 0/7 | 0/6 (+1 parcial) | **3/4** |
| Perplexity | 0/7 | 0/6 | 2/4 (+1 parcial) |

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

| Métrica | 01/09 | próxima leitura |
|---|---:|---|
| Cadastros vindos do ChatGPT | 43% (31 de 72 em 30 dias) | `diag-origem-cadastros.mjs` |
| Visitas vindas do ChatGPT | 18% | idem |
| Visitas vindas do Google | 70% | idem |
| Pagantes que entraram por página de conteúdo | 86% | idem |

O ChatGPT converte **2,4× acima** da sua participação em visitas. É a assimetria
mais forte de todo o conjunto e é o que sustenta priorizar citação por IA.

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

---

## 7. Correções de dado aplicadas a este arquivo

- **11/09:** três linhas de 01/09 gravavam `SIM` em maiúscula em
  `botinho_cited`, e qualquer contagem exata as perdia — foi assim que o placar
  de 01/09 apareceu como 0 em vez de 3. Valores normalizados para minúsculas. A
  validação do CSV (Issue 8) precisa travar o domínio dessa coluna.
