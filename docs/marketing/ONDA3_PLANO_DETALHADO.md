# Onda 3 — Marca do concorrente, achadinhos e o cluster de ban

Base: `ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`
Pré-requisitos: Onda 1 (#1362, #1365) e Onda 2 (#1369), ambas mergeadas.

**Objetivo:** capturar a demanda de **Tier 2 e 3** (dor aguda e achadinhos) e
abrir a frente de **autoridade**, que é o que faz IA citar. A Onda 1 trocou a
porta de entrada dessas páginas; a Onda 3 troca o que tem dentro.

---

## O que a Onda 1 realmente fez nesses clusters (e o que não fez)

Importante para não achar que já está pronto:

| Página | Onda 1 mudou | Ainda é o conteúdo antigo |
|---|---|---|
| `/anti-ban-whatsapp` | título, H1, `lead` | `problem`, `bullets`, `process`, FAQ (3 perguntas) |
| `/faq-antiban-whatsapp` | título, H1, `intro` | as 6 respostas |
| `/protecao-antiban-botinho` | título, H1, `intro` | as 4 camadas + FAQ |
| `/bot-achadinhos-whatsapp` | título, H1, `lead` | `problem`, `bullets`, `process`, FAQ (3 perguntas) |

Ou seja: **a porta entrou pela palavra do cliente, mas a sala continua falando
jargão.** Quem clica em "WhatsApp banido divulgando ofertas" cai num texto sobre
"Módulo de Preservação Avançada", "cadência" e "espelhamento". Isso derruba
tempo de permanência e é ruim para citação por IA, que extrai passagens do
corpo, não do título.

---

# Blocos da Onda 3

## 🥇 A1 — `/alternativas/achadinhos-bot` (era o T4 da Onda 1, agora desbloqueado)

**Por que é o primeiro:** duas das **13 consultas** que o site registra no
Search Console são `achadinhos bot` e `achadinhoosbot` (posições 7 e 9,5).
Pessoas procurando o concorrente **pelo nome** já estão vendo o site, sem
nenhuma página feita para isso. É a única oportunidade do plano em que a
demanda já está comprovadamente chegando.

**Estava bloqueado** por falta de dados verificáveis do concorrente. A Onda 2
resolveu isso: `competitors-data.js` já tem `achadinhosbot` e `achadinho-pro`
com preço, planos, forças e fraquezas verificados por print em 31/07/2026.

**Regras inegociáveis** (mesmas do plano original):
- comparativo **justo e verificável**, com data e fonte;
- **dizer onde o concorrente é melhor** — isso aumenta citação por IA, não diminui;
- nada de depreciar. Comparativo enviesado é penalizado por IA e é risco jurídico.

## 🥈 A2 — Reconstruir o corpo de `/bot-achadinhos-whatsapp`

`achadinhos` tem **5.000 buscas/mês, concorrência baixa**. A página hoje usa o
template comercial genérico: fala de "canais", "preservação" e "migração", não
de achadinhos.

Reescrever `problem`, `bullets`, `process` e FAQ para responder o que a pessoa
realmente quer saber: como achar achadinho bom, como não repetir oferta, como
manter o grupo ativo sem virar spam.

⚠️ **Não criar página nova para `grupo de achadinhos`** (500/mês) — canibalizaria.
E lembrar da ressalva do estudo: quem busca "grupo de achadinhos" quer **entrar**
num grupo, não criar. Serve como isca, não como página de venda.

## 🥉 A3 — Aprofundar o cluster de ban

`whatsapp banido` e variações somam **~10 termos de 5.000/mês com concorrência
baixa** — o maior volume de dor aguda do levantamento. O site já aparece para
`shadowban whatsapp` (11 impressões, pos 10,45) **sem nunca ter otimizado**.

Reescrever o corpo das 3 páginas do cluster para responder de fato:
- por que o WhatsApp bane quem divulga oferta;
- o que fazer **depois** de ser banido (recurso, prazo, chance real);
- o que muda entre número banido, conta banida e shadowban;
- o que dá para controlar de verdade.

Cobrir as variações (`número banido`, `conta banida`, `zap banido`) **dentro**
das páginas existentes, via H2 e FAQ — mesma lógica anti-canibalização que
funcionou no A3 da Onda 2.

⚠️ **Limite que não se cruza:** nada disso pode virar promessa de imunidade.
Já está assim hoje e precisa continuar.

## 🏅 A4 — Medição de citação por IA (processo, não página)

O estudo aponta que ser citado por IA é metade do objetivo, e hoje não há
medição nenhuma. Já existem `docs/marketing/ai_visibility_tracking.csv` e um
playbook mensal — **reaproveitar, não criar processo novo**.

Definir as 20 consultas fixas a checar mensalmente em ChatGPT, Perplexity e
AI Overviews, e registrar a linha de base.

---

# Fora do escopo desta onda

| Item | Por quê |
|---|---|
| **Benchmark com dados próprios** | É a peça mais citável possível, mas depende de extrair e anonimizar dados reais de operação — decisão de produto/privacidade, não de SEO. Fica para quando houver OK explícito. |
| **YouTube (5 vídeos)** | Não é trabalho de repositório. |
| **Presença em terceiros** | Idem — é outreach, não código. |
| **Comparativos nominais contra todos os 5** | O `/alternativas/bot-para-whatsapp-afiliados` já cobre os 5 numa página. Páginas 1-a-1 só valem para quem tem busca de marca comprovada — hoje, só o AchadinhosBot (A1). |

---

# Como medir

Comparar contra o baseline de 2026-07-30 (`AGENTS.md` → *Dados de mercado para
marketing*), em 60 dias:

| Indicador | Baseline | Meta |
|---|---:|---:|
| `/alternativas/achadinhos-bot` aparecendo para `achadinhos bot` | não existe | top 10 |
| `/bot-achadinhos-whatsapp` — impressões | 5 | > 150 |
| Cluster de ban — impressões somadas | ~14 | > 400 |
| Consultas distintas do site | 13 | > 60 |

---

# Regras que continuam valendo

- **Linhas congeladas** (`AGENTS.md`): sem LP de cidade, sem LP de nicho novo,
  sem cluster "robô", sem Magalu.
- **Entrar pela palavra do cliente**, traduzir o termo da casa dentro da página.
- **Nenhuma promessa** de imunidade a banimento ou de ganho de comissão.
- **Comparativo só com dado datado e fonte.**
