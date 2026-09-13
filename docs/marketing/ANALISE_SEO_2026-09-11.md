# Análise SEO + IA + funil — 2026-09-11

Substitui a leitura de 10/09 nos pontos em que a medição a contradisse. Série
comparável em `SERIE_HISTORICA_SEO.md`; plano de execução em
`PLANO_ISSUES_2026-09-11.md`.

Fontes: Search Console (3 meses + Cobertura, 09/09), Cloudflare AI Crawl Control,
16 medições novas de IA em `ai_visibility_tracking.csv`, e — pela primeira vez
nesta série — os dois diagnósticos próprios de produção, janela de 30 dias:
`diag-origem-cadastros.mjs` e `diag-paginas-seo.mjs`.

---

## O achado que reordena tudo

**Página comercial converte 15,4% da visita em cadastro. Página de comparação
converte 0,0%. E a comparação ocupa 47% das impressões do site.**

| Cluster | Páginas | Visitas 30d | Clique em CTA | Cadastros | Visita → cadastro |
|---|---:|---:|---:|---:|---:|
| Comerciais (`/bot-*`, `/automatizar-*`) | 7 | 246 | 42,7% | **38** | **15,4%** |
| Comparação (`/alternativas/*`) | 7 | 147 | 6,1% | **0** | **0,0%** |

Sete páginas de comparação, 147 visitas, **zero cadastro**. Não é margem de erro
nem amostra pequena demais: é zero absoluto em 30 dias.

O contraste dentro do mesmo tema fecha a questão:

| Página | Impressões (3m) | Visitas (30d) | CTA | Cadastros |
|---|---:|---:|---:|---:|
| `/alternativas/achadinhos-bot` | **3.400** | 80 | 5,0% | **0** |
| `/bot-achadinhos-whatsapp` | 1.827 | 130 | 40,0% | **21** |

A página com o DOBRO de impressões traz zero cadastro; a comercial, com metade,
traz 21. E na de comparação **75% saem antes da metade** (leu 50% = 25%).

**Isso derruba a conclusão de 01/09 e 10/09** de que "a linha de comparação com
concorrente é o motor de crescimento". Ela é motor de **impressão**. Não é motor
de receita. O erro foi medir o cluster por impressão porque era o único dado que
tínhamos; agora temos o funil inteiro.

---

## O funil completo, medido

```
516 visitas externas → 119 cadastros (23%) → 12 pagantes (10%)
                                           = 2,3% de visita a pagante
                                           7,2 dias até o 1º pagamento
```

**23% de visita para cadastro é uma taxa excelente** — a máquina de captura já
funciona. O problema não é converter: é para onde estamos apontando o tráfego.

### Onde o cadastro vira dinheiro

| Tipo de entrada | % dos cadastros | % dos pagantes | Índice |
|---|---:|---:|---:|
| **Página de conteúdo** | 34% | **58%** | **1,71×** |
| Home (ambíguo) | 50% | 33% | 0,66× |
| `/precos` | 3% | 8% | 2,67× |

Quem entra por conteúdo **paga 1,7× mais** que a média. Sete dos doze pagantes
do mês entraram assim.

### Onde a visita vira cadastro

| Canal | Visitas | Cadastros | Leitura |
|---|---:|---:|---|
| Google | 405 (78%) | 20 com `source=seo` | volume alto, atribuição fraca |
| **ChatGPT** | **66 (13%)** | **42 carimbados** | **35% dos cadastros do mês** |
| TikTok + Instagram | 23 (4%) | — | irrelevante hoje |
| Claude + Gemini | 8 (2%) | — | começando a aparecer |

⚠️ As duas colunas vêm de medições diferentes (`referral_visit` conta visita;
`utm_source` no cadastro é carimbo de primeiro toque, que sobrevive a sessões).
**Não dividir uma pela outra.** O que é comparável é a participação:

> **ChatGPT: 13% das visitas, 35% dos cadastros — índice 2,69×.**
> Em 01/09 era 2,4×. A assimetria não só se manteve, aumentou.

O Google traz **6× mais visita** e menos cadastro identificado. Não é que o
Google seja ruim: é que ele entrega gente pesquisando, e o ChatGPT entrega gente
que **já foi convencida pela resposta** antes de clicar.

---

## As páginas que são a fórmula

Ordenadas por visita → cadastro, o único ranking que importa:

| Página | Visitas | CTA | Cadastros | Visita → cadastro |
|---|---:|---:|---:|---:|
| `/automatizar-divulgacao-em-grupos-whatsapp` | 26 | 26,9% | 8 | **30,8%** |
| `/bot-ofertas-afiliados-whatsapp` | 21 | 28,6% | 5 | **23,8%** |
| `/bot-achadinhos-whatsapp` | 130 | 40,0% | 21 | **16,2%** |
| `/bot-afiliados-whatsapp` | 24 | 41,7% | 3 | 12,5% |
| `/` (home) | 497 | 26,0% | 60 | 12,1% |
| `/precos` | 61 | 16,4% | 3 | 4,9% |

**A melhor página do site tem 250 impressões.** `/automatizar-divulgacao-em-grupos-whatsapp`
converte 30,8% e quase ninguém a vê. É o oposto de `/alternativas/achadinhos-bot`:
3.400 impressões, zero cadastro.

Esse é o desperdício exato, em uma linha: **estamos comprando atenção onde ela
não converte e escondendo as páginas que convertem.**

---

## Citação por IA: a virada de 11/09

Primeira rodada com o conjunto corrigido de consultas (Trilha B, nome atual).

| Rodada | Medições | Citações |
|---|---:|---|
| 01/09 | 28 | 3 |
| 10/09 | 43 | 10 (+1 parcial) |
| **11/09** | **16** | **9 (+1 parcial)** |

| Consulta | Citações |
|---|---|
| espelha grupos preço | 3/4 (+1 parcial) |
| espelha grupos metodologia WhatsApp | 3/4 |
| espelha grupos é confiável | 3/4 |
| espelha grupos whatsapp o que é | 0/4 |

**A marca nunca foi desconhecida — o conjunto anterior media o nome aposentado.**
28% das medições de 10/09 foram gastas em "BOTinho", que teve **uma impressão em
três meses** de Search Console.

Três viradas na mesma superfície e na mesma pergunta, com um dia de diferença:

| Superfície | 10/09 | 11/09 |
|---|---|---|
| Gemini · preço | "mediante planos de assinatura no site" | Basic R$39, Pro R$69, conteúdo de cada plano, trial, Pix, sem fidelidade |
| Gemini · metodologia | inventou um "Funil BOTinho" com 5 pilares falsos | cita `espelhagrupos.com.br` na primeira linha |
| Perplexity · marca | não sabia que o produto existe; fundia com BotConversa e Afiliados Pro Bot | "ferramenta legítima, não há indícios de que seja site falso ou golpe" |

### A honestidade virou argumento de venda

Não é interpretação, é citação:

- **Gemini:** "Modelo sem promessas irrealistas: ao contrário de golpes de renda
  passiva rápida, vende-se como software utilitário."
- **ChatGPT:** nota **7,5/10 para testar**, e chama de "ponto positivo de
  transparência" o fato de dizermos que não garantimos contra bloqueio. Cita
  credenciais criptografadas, proteção contra força bruta e a recomendação de
  número dedicado.

A regra de nunca prometer resultado, escrita como limite ético, está voltando das
IAs como **diferencial competitivo**. Isso é um ativo, e precisa ser explorado de
propósito.

### Duas objeções novas, com ações opostas

**1. Colisão de fraude (Google AI Overviews).** `espelha grupos é confiável`
devolve golpe de espelhamento de tela: "amplamente utilizado por criminosos para
aplicar golpes financeiros", com G1 e Banco Central. O homônimo deixou de ser
calçado e virou crime — na consulta em que a pessoa decide se confia. É a
prioridade de reputação do trimestre.

**2. Objeção de modelo (Perplexity).** Ela nos chama de legítimos e em seguida
critica o **modelo**: conteúdo repetido, dependência de terceiros, sem
diferenciação, e recomenda "ferramentas que fazem garimpo próprio por IA". A
resposta já existe no produto — ofertas automáticas da Shopee no plano Pro — e
não está legível para ela. É objeção de posicionamento, não de confiança, e se
resolve com conteúdo, não com defesa.

---

## Busca: o crescimento é real e vem das mesmas páginas

| Mês fechado | Cliques | Impressões | CTR |
|---|---:|---:|---:|
| Junho (a partir de 08) | 8 | 336 | 2,38% |
| Julho | 33 | 656 | 5,03% |
| Agosto | 153 | 5.286 | 2,89% |
| **1 a 7 de setembro** | **124** | **3.515** | **3,53%** |

Sete dias renderam 81% dos cliques de agosto inteiro, com CTR subindo junto com
o volume. Indexação praticamente parada (81 contra 53) — **o crescimento veio das
mesmas páginas aparecendo em mais buscas**, não de páginas novas.

**Tier 1 continua em zero pelo quarto relatório seguido — e a causa NÃO é a que
eu escrevi.** As cinco páginas de loja (`/shopee-afiliados-whatsapp`,
`/mercado-livre-afiliados-whatsapp`, `/amazon-afiliados-whatsapp`,
`/magalu-afiliados-whatsapp`, `/shein-afiliados-whatsapp`) **existem em produção
desde 02/09**, respondem 200, estão no sitemap, sem `noindex` e com canônica
própria. Elas têm **zero impressão** porque o Google não as indexou — não porque
não foram feitas. Correção registrada em `PLANO_ISSUES_2026-09-11.md`, seção "A
falha de método que se repetiu três vezes".

Agora sabemos o que isso custa. Página comercial converte 15,4% de visita em
cadastro. **Projeção, com as premissas à vista:** 50.000 buscas/mês, 1% de
clique na posição 5-8, 15,4% de cadastro, 10% de pagante, R$69 no Pro.

| | Estimativa |
|---|---:|
| Visitas/mês | 500 |
| Cadastros/mês | 77 |
| Pagantes/mês | 8 |
| Receita recorrente adicionada por mês | ~R$530 |

⚠️ É projeção, não medição. As três premissas (CTR de 1%, conversão igual à das
comerciais atuais, 10% de pagante) precisam ser verificadas na primeira página
publicada. Mas a ordem de grandeza é o argumento: **uma única frente Tier 1 vale
mais que as sete páginas de comparação juntas**, que hoje valem zero.

---

## Desperdício nomeado

| Página | Impressões (3m) | Visitas | Cadastros | Diagnóstico |
|---|---:|---:|---:|---|
| `/alternativas/achadinhos-bot` | 3.400 | 80 | 0 | título anuncia OUTRO produto; 75% saem antes da metade |
| `/alternativas/achadinho-pro` | 599 | 37 | 0 | 86% saem antes da metade |
| `/alternativas/bot-para-whatsapp-afiliados` | 216 | 13 | 0 | **zero clique, zero leitura** |
| `/blog/melhores-horarios-para-postar-ofertas` | 469 | — | 0 | CTR 0,21% |
| `/programa-de-afiliados` | 174 | — | 0 | CTR 0% |

46 páginas tiveram impressão e zero clique no Search Console, somando 657
impressões.

Anotação de qualidade de dado: `/bot-ofertas-moda-whatsapp` registra **CTA de
105,3%** (20 cliques em 19 visitas), o que é impossível. Provável clique sem
`organic_page_view` correspondente. Não muda nenhuma conclusão — a página tem
19 visitas — mas a instrumentação merece conferência.

---

## O que muda em relação a 10/09

| Conclusão de 10/09 | Status |
|---|---|
| "A marca não existe como entidade para as IAs" | **Derrubada.** Media o nome errado. |
| "Comparação com concorrente é o motor de crescimento" | **Derrubada.** É motor de impressão; converte zero. |
| "Preço não é legível para Gemini e Perplexity" | **Metade resolvida.** Gemini lê. Perplexity não. |
| "A home saltou por busca de marca" | **Confirmada em parte.** 497 visitas, 60 cadastros; 27 deles com carimbo do ChatGPT. |
| "Espelhamento é a consulta mais forte" | **Mantida.** |
| "Cidade e nicho congelados" | **Mantida.** 20 páginas, 1,7% das impressões. |
| "Tier 1 em zero" | **Mantida**, agora com o custo calculado. |

---

## Dados que ainda faltam para decidir melhor

1. **Quantos meses o assinante fica.** O próprio script avisa que não mede
   renovação. Sem isso não existe LTV, e sem LTV não existe teto de CAC — que é
   a decisão de ligar ou não anúncios.
2. **Search Console por consulta filtrado nas páginas comerciais.** Saber quais
   termos já trazem os 15,4% permite dobrar a aposta em vez de adivinhar.
3. **Cloudflare com janela de 30 dias**, não 24h, para medir o Googlebot e ver se
   PerplexityBot passa a rastrear.
4. **`diag-funil-ativacao.mjs`** — os 119 cadastros contra 12 pagantes escondem
   onde a pessoa para depois de entrar. Se o gargalo estiver na ativação, atrair
   mais gente rende menos que consertar o que já entrou.
