# Análise com dados reais — keywords, Search Console e Trends

Data: 2026-07-30
Fontes: Google Search Console (12 meses), Planejador de Palavras-Chave
(8.923 termos), Google Trends (12 meses, Brasil).

> ⚠️ **Este documento CORRIGE o estudo de 2026-07-28.** Naquele estudo os
> volumes eram estimativas por sinais de SERP. Os dados reais mostraram que
> **a premissa central estava errada.** Onde houver conflito, vale este aqui.

---

## 1. A correção que muda tudo

O estudo anterior dizia: *"ataque `bot/robô para grupos de ofertas` — alto volume,
baixa dificuldade"*. **Isso está errado.** Os números reais:

| Termo | Volume real/mês | Concorrência |
|---|---:|---|
| `bot para grupo whatsapp` | **500** | **Alta** |
| `bot de ofertas` | **~0** (Trends: 0 de 100) | — |
| `grupo de ofertas whatsapp` | 5.000 | Média |
| `achadinhos` | 5.000 | Baixa |
| **`shopee afiliados`** | **50.000** | **Baixa** |
| **`mercado livre afiliados`** | **50.000** | **Baixa** |
| **`afiliado amazon`** | **50.000** | **Baixa** |
| **`cupom amazon`** | **500.000** | Baixa |

**O mercado de "bot para grupo de ofertas" é 100× menor do que o mercado de
"como ser afiliado".** Não dá para construir máquina de leads em cima de 500
buscas/mês com concorrência alta. O erro foi meu: domínio de correspondência
exata (`achadinhopro`, `achadinhosbot`) me pareceu prova de volume alto. Não é —
prova só que alguém apostou no termo.

**O reposicionamento correto:** parar de disputar quem procura a **ferramenta**
e passar a capturar quem procura o **negócio**. O afiliado busca "shopee
afiliados" muito antes de saber que precisa de um robô. Quem chega primeiro nessa
etapa vende o robô depois.

---

## 2. O que o Search Console revelou

### O site é novo — isso reenquadra tudo

Os dados começam em **14/05/2026**. São **~2,5 meses**, não 12. Todo o
desempenho abaixo é de um site recém-nascido:

| Métrica | Valor |
|---|---:|
| Cliques (total) | **41** |
| Impressões (total) | **1.154** |
| Posição média (Brasil) | **7,85** |
| Consultas registradas | **13** |
| Páginas com impressão | 60 |

### O diagnóstico exato, em uma frase

**O site ranqueia bem (posição ~7,8) para termos que quase ninguém busca.**

Não é problema de SEO técnico nem de autoridade. Posição 7,8 com 2,5 meses de
vida é **bom**. O problema é o alvo: as páginas estão mirando demanda que não
existe.

Prova direta: `/automacao-whatsapp-afiliados` — a página que eu apontei como
"você é #1" — teve **14 impressões em 2,5 meses**. Ela ranqueia. Só que ninguém
procura.

### As páginas que puxam volume são exatamente as do Tier 1

| Página | Impressões | Posição |
|---|---:|---:|
| `/blog/como-divulgar-ofertas-amazon-whatsapp` | **280** | 8,41 |
| `/blog/como-ser-afiliado-shopee-whatsapp` | **201** | 8,35 |
| `/` (home) | 76 | 5,41 |
| `/automatizar-divulgacao-em-grupos-whatsapp` | 78 | 7,12 |
| `/bot-ofertas-infoprodutos-whatsapp` | 44 | 9,14 |
| … | | |
| `/automacao-whatsapp-afiliados` | **14** | 13,86 |
| `/bot-achadinhos-whatsapp` | **5** | 6,20 |

As duas maiores são **posts de blog sobre marketplace e afiliação** — exatamente
o cluster que os dados de volume apontam. Elas sozinhas são **42% de todas as
impressões do site**. O sinal não podia ser mais claro.

### As 15 páginas de cidade: confirmado que não servem

Somadas, as 15 LPs de cidade fizeram **~25 impressões em 2,5 meses**. Curitiba
teve 5, Vitória 2, Belém 1. A recomendação de congelar essa linha continua — agora
com dado, não com opinião.

### Você já aparece para buscas de marca do concorrente

Duas das 13 consultas são **`achadinhos bot`** e **`achadinhoosbot`** (posição
7 e 9,5). Gente procurando o concorrente pelo nome está vendo você. É pouco
volume, mas é a prova de que uma página de alternativa/comparação nominal
funcionaria.

### Indexação: melhorou muito, mas ainda trava 16 páginas

| | 14/05 | 23/07 |
|---|---:|---:|
| Indexadas | 15 | **76** |
| Não indexadas | 31 | **16** |

Tendência ótima. O que ainda falta destravar:

| Motivo | Páginas |
|---|---:|
| **Rastreada, mas não indexada** | **11** |
| Excluída por `noindex` | 3 |
| Bloqueada pelo `robots.txt` | 1 |
| Página alternativa com canônica adequada | 1 |

"Rastreada mas não indexada" em 11 páginas é o sintoma clássico de **conteúdo
fino** — o Google visitou, achou parecido demais com o que já tem e decidiu não
gastar índice. Bate com o diagnóstico das páginas-template.

---

## 3. Google Trends — quem cresce e quem não existe

Escala relativa 0–100, Brasil, 12 meses.

**Como o mercado chama a ferramenta**

| Termo | Média | Tendência |
|---|---:|---|
| `bot whatsapp` | 81,8 | estável |
| `automação whatsapp` | 34,3 | estável |
| `robô whatsapp` | 6,4 | **subindo** |
| `bot de ofertas` | **0,0** | inexistente |

⚠️ **Correção nº 2:** eu recomendei criar um cluster inteiro de "robô". Os dados
dizem que "robô" é **12× menor** que "bot". Está subindo, então vale uma variação
dentro das páginas existentes — mas **não** um cluster próprio. Cancelada como
prioridade.

E atenção: `bot whatsapp` (81,8) é grande, mas é o mercado de **atendimento
/ chatbot** (Blip, Wati, Zenvia). Não é o seu comprador.

**Como o mercado chama o produto**

| Termo | Média |
|---|---:|
| `cupom de desconto` | **61,1** |
| `achadinhos` | 2,6 |
| `grupo de ofertas` | 1,0 |
| `promoções whatsapp` | 1,0 |

**Marketplaces — onde concentrar**

| Termo | Média | Tendência |
|---|---:|---|
| `afiliado shopee` | **71,0** | estável |
| `afiliado mercado livre` | 28,5 | estável |
| `afiliado amazon` | 11,4 | estável |
| `afiliado magalu` | 3,2 | **caindo** |

**Ordem de prioridade dos marketplaces: Shopee ≫ Mercado Livre > Amazon ≫ Magalu.**
Magalu está caindo — não abrir frente nova ali.

---

## 4. A nova matriz de prioridade (com número real)

### 🥇 TIER 1 — Captar o afiliado antes do robô

Volume enorme, concorrência **baixa**, e é literalmente quem compra o BOTinho.
O site já tem tração aqui sem nunca ter atacado de propósito.

| Termo | Vol/mês | Conc. | Status hoje |
|---|---:|---|---|
| `shopee afiliados` / `shopee afiliado` | **50.000** | Baixa | 1 post, pos 8,35 |
| `mercado livre afiliados` / `afiliado mercado livre` | **50.000** | Baixa | ❌ |
| `afiliado amazon` / `associados amazon` | **50.000** | Baixa | 1 post, pos 8,41 |
| `como se tornar afiliado shopee` | **50.000** | Média | ❌ |
| `programa de afiliados shopee` | **50.000** | Média | ❌ |
| `como ser afiliado [shopee/ML/amazon]` | 5.000 cada | Média | ❌ |
| `programa de afiliados mercado livre` | 5.000 | **Baixa** | ❌ |
| `shopee afiliados entrar` | 5.000 | Baixa | ❌ |
| `afiliado shopee como funciona` | 5.000 | Média | ❌ |

**O que fazer:** um **guia completo por marketplace** — "Como ser afiliado
Shopee: guia 2026" — cobrindo cadastro, comissão, regras, como divulgar. O
BOTinho entra no fim, como a ferramenta que resolve a parte chata. É o funil
natural, e você já prova que ranqueia nisso.

### 🥈 TIER 2 — Medo de ban (dor aguda, concorrência baixa)

| Termo | Vol/mês | Conc. |
|---|---:|---|
| `whatsapp banido` | 5.000 | Baixa |
| `zap banido` | 5.000 | Baixa |
| `número banido whatsapp` | 5.000 | Baixa |
| `conta banida whatsapp` | 5.000 | Baixa |
| `você foi banido do whatsapp` | 5.000 | Baixa |
| `seu whatsapp foi banido` | 5.000 | Baixa |

São ~10 variações de 5.000 cada com concorrência baixa. Você já aparece em
`shadowban whatsapp` (posição 10,45) sem ter otimizado.

⚠️ **Ressalva de intenção:** boa parte de quem busca isso foi banida por motivo
nenhum a ver com afiliação. O tráfego é grande e barato, mas converte menos.
Tratar como topo de funil com isca, **não** como página de venda. E manter a
regra: **não prometer que não banem.**

### 🥉 TIER 3 — Achadinhos e grupos (menor do que eu disse, mas barato)

| Termo | Vol/mês | Conc. |
|---|---:|---|
| `achadinhos` / `achadinho` | 5.000 | Baixa |
| `grupo de ofertas whatsapp` | 5.000 | Média |
| `grupo de promoções whatsapp` | 5.000 | Média |
| `grupo de achadinhos` | 500 | Média |

⚠️ **Cuidado com a intenção:** quem busca "grupo de ofertas whatsapp" quer
**entrar** num grupo, não **criar** um. Não é seu comprador. Só vale como isca
(ex.: lista de grupos → captura e-mail → oferecer criar o próprio).

### ⚪ TIER 4 — Cupom: volume gigante, público errado

`cupom amazon` 500.000 · `cupom mercadolivre` 500.000 · `cupons de desconto` 50.000

É o maior volume do levantamento inteiro. **E eu recomendo não perseguir agora.**
Quem busca "cupom amazon" é **consumidor final**, não afiliado. Você viraria site
de cupom, competindo com Cuponomia e Méliuz — outro negócio, outra estrutura.

Guardar como opção futura: é o público **do seu cliente**. Se um dia fizer sentido
uma ferramenta gratuita de cupom que capture afiliados, o volume está lá.

### ⛔ TIER 5 — Parar de investir

- **"bot/robô para grupos de ofertas"** — 500/mês, concorrência alta. Manter as
  páginas que existem (já ranqueiam), **não expandir**.
- **Cluster "robô"** — cancelado, 12× menor que "bot".
- **15 LPs de cidade** — 25 impressões em 2,5 meses. Congelar.
- **`automação whatsapp` / `disparo em massa`** — 5.000 mas concorrência **alta**
  e é o mercado de atendimento corporativo. Não é seu comprador.
- **Magalu** — único marketplace em queda.

---

## 5. Plano revisado

### Onda 1 — Destravar o que já existe (dias)

| # | Ação | Por quê |
|---|---|---|
| 1.1 | Investigar as **11 páginas "rastreada mas não indexada"** e engordar com conteúdo próprio | Página não indexada = zero chance |
| 1.2 | Conferir as **3 `noindex`** e **1 bloqueada por robots** — são intencionais? | Pode ser bloqueio acidental |
| 1.3 | Reforçar `/blog/como-ser-afiliado-shopee-whatsapp` e `/blog/como-divulgar-ofertas-amazon-whatsapp` | São 42% das impressões, estão em pos ~8,4 — falta pouco para o topo |
| 1.4 | Criar `/alternativas/achadinhos-bot` | Você já aparece para a busca de marca deles |

### Onda 2 — Abrir o Tier 1 (semanas)

| # | Ação |
|---|---|
| 2.1 | **Guia "Como ser afiliado Shopee"** — completo, o melhor do Brasil |
| 2.2 | Mesmo guia para **Mercado Livre** |
| 2.3 | Mesmo guia para **Amazon (Associados)** |
| 2.4 | Página **"programa de afiliados: qual escolher"** comparando os 3 |
| 2.5 | Cada guia com **isca de captura** e o BOTinho como passo final |

### Onda 3 — Ban e achadinhos (mês 2)

| # | Ação |
|---|---|
| 3.1 | Cluster de ban entrando pela palavra do cliente ("whatsapp banido", "número banido") — sem prometer imunidade |
| 3.2 | Reconstruir `/bot-achadinhos-whatsapp` com conteúdo próprio |

### Onda 4 — Autoridade e IA

Mantém o que o estudo anterior propôs (benchmark com dados próprios,
comparativos nominais, presença em terceiros). Nada ali foi contrariado pelos dados.

---

## 6. Limitação honesta destes números

Os volumes vêm em **faixas** (500.000 / 50.000 / 5.000 / 500 / 50), não em número
exato — é a conta do Google Ads sem gasto, como avisado no passo a passo. Então:

- ✅ **Confiável:** a comparação relativa. Diferenças de 10× e 100× são reais e
  não mudam com refinamento.
- ⚠️ **Não confiável:** o número absoluto. "50.000" pode ser 30.000 ou 90.000.

Para a decisão que temos pela frente, a comparação relativa basta. Se for
necessário refinar (ex.: escolher entre dois termos da mesma faixa), aí vale
destravar o número exato com uma campanha mínima.

---

## 7. Resumo em três linhas

1. **O site não tem problema de SEO — tem problema de alvo.** Posição 7,8 com
   2,5 meses é bom. O alvo é que não tem demanda.
2. **O dinheiro está em "como ser afiliado [marketplace]"** (50.000/mês,
   concorrência baixa), não em "bot para grupos de ofertas" (500/mês,
   concorrência alta).
3. **As duas páginas que já puxam 42% das impressões são exatamente desse tipo.**
   O site já provou que funciona — só nunca atacou de propósito.
