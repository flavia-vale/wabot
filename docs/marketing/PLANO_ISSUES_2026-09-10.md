# Plano de execução por issues — 2026-09-10

Deriva de `ANALISE_SEO_2026-09-10.md`. Cada issue nasce de uma medição daquele
documento, não de opinião. Fluxo canônico do repo: branch a partir de
`develop` → PR contra `develop` → autodeploy staging → validação manual →
PR `develop` → `main`.

## Correção do plano original, antes de tudo

O item 1 da análise dizia "sempre escrever BOTinho, o robô do Espelha Grupos".
**Isso está errado, e a medição de hoje é a prova.**

O repositório já tomou a decisão oposta em 2026-09-02 (`8823b68`, em `main`):
`BRAND_ORG_NAME` e `BRAND_PRODUCT_NAME` são os dois "Espelha Grupos", e
"BOTinho" ficou só como `alternateName` no schema. Verificado nesta sessão:
**zero ocorrências de "BOTinho" em texto de página pública**, uma linha de
desambiguação em `llms.txt` e outra em `pricing.md`.

Os dados de hoje sustentam a decisão que já foi tomada:

| Nome na consulta | Resultado nas IAs |
|---|---|
| "Espelha Grupos" | citado, descrito certo, preço certo, 1ª escolha em espelhamento |
| "BOTinho" | calçado, projeto social, peixe de aquário, BotConversa, Afiliados Pro Bot |

Emparelhar os dois nomes em texto novo **reintroduziria** a ambiguidade que o
`8823b68` removeu. O trabalho que resta não é escrever o nome antigo: é fazer
as citações antigas apontarem para a entidade certa. É a Issue 1.

---

## Segunda correção: o conjunto de consultas media o nome errado

Levantada pela dona do produto ao ler o plano, e ela está certa.

As rodadas de 01/09 e 10/09 usaram 8 consultas, **duas delas sobre "BOTinho"** —
o nome aposentado da superfície pública em 02/09. Contagem real de 10/09:

| | medições de 10/09 |
|---|---:|
| nome aposentado (`BOTinho preço`, `BOTinho metodologia`) | **12 de 43 (28%)** |
| nome atual (`espelha grupos whatsapp o que é`) | 3 |

Ou seja: gastamos quatro vezes mais medição no nome que não usamos do que no que
usamos, e concluímos que "a marca não é reconhecida". Era a pergunta errada.
Ninguém procura "botinho" (uma impressão em três meses de Search Console), e o
resultado — calçado, projeto social, peixe de aquário — fala do homônimo, não de
nós.

**O conjunto foi reescrito em `docs/marketing/ROTEIRO_MEDICAO_IA.md`**, em três
trilhas: categoria (5, série contínua, texto inalterado), marca atual (4, com
`espelha grupos preço` e `espelha grupos metodologia` substituindo as de
BOTinho) e contaminação (1, que continua sendo `BOTinho preço` — mas lida como
"algum concorrente está herdando nossas citações antigas?", que é o critério de
aceite da Issue 1, e **fora do placar da marca**).

⚠️ **Consequência no placar histórico:** o número de 10/09 sobe ao ser recontado
por essa divisão, porque duas consultas saem do denominador da marca. Registrar
as duas leituras lado a lado no relatório de 01/10 — nunca substituir a antiga
em silêncio.

---

## Ordem de ataque

| # | Issue | Impacto medido | Esforço | Risco |
|---|---|---|---|---|
| 1 | Amarrar as citações antigas à entidade certa | 3 IAs confundem a marca com concorrente ou calçado | M | baixo |
| 2 | Página de espelhamento | única consulta em que somos 1ª escolha; 2 de 4 IAs ensinam a construir | M | baixo |
| 3 | Títulos das páginas `/alternativas/*` | 5.055 impressões, 1,5% de CTR | P | baixo |
| 4 | Comparativo público com fonte | critério 1 da Perplexity, dito por ela | G | médio |
| 5 | Preço legível por Gemini e Perplexity | critério 2, com contraprova de que funciona | M | baixo |
| 6 | Rodar os dois diagnósticos | confirma ou derruba a hipótese da home | P | nenhum |
| 7 | Desperdício de impressão (10 páginas, 657 impressões, 0 clique) | pendente desde 01/09 | M | baixo |
| 8 | Automatizar a medição de citação por IA | 43 linhas coletadas na mão hoje | M | baixo |

As issues 1, 2, 3 e 6 podem correr em paralelo. A 4 depende da 1 (a ficha do
concorrente cita a nossa entidade). A 5 depende da 4 só se a comparação entrar
no mesmo arquivo público.

---

## Issue 1 — Amarrar as citações antigas à entidade certa

**Medição.** A Perplexity afirma que "BotConversa é muitas vezes chamada
carinhosamente de BOTinho" e que "o Botinho, também chamado de Afiliados Pro
Bot" — duas fusões com concorrentes diferentes, no mesmo dia. O Gemini lista
quatro significados para o nome, incluindo peixe de aquário. O ChatGPT em conta
neutra diz: "os resultados estão trazendo ferramentas diferentes com nomes
semelhantes".

**Não é problema de texto nosso.** A retirada do nome shipou em `main` em
02/09, oito dias antes desta medição. O que falta é o sinal de identidade.

**Escopo:**

1. `alternateName` presente no schema `Organization` **e** `SoftwareApplication`
   de todas as páginas, não só onde já está. Auditar
   `dashboard/lib/marketing-content.js`, `dashboard/lib/editorial-content.js`,
   `dashboard/app/layout.js` e os três geradores compartilhados
   (`_lpShared.js`, `_organicNicheLanding.js`, `_preservationDecisionPages.js`).
2. `sameAs` completo no `Organization` — perfis oficiais são o sinal mais forte
   de desambiguação que existe para entidade nova.
3. Uma seção de identidade em `llms.txt`, explícita: qual é o nome, qual é o
   nome anterior, e **quais produtos NÃO somos** (BotConversa, Afiliados Pro
   Bot, Achadinho Pro). É o único arquivo que as IAs leem como declaração.
4. Uma página `/o-que-e-espelha-grupos` curta, respondendo em uma frase o que a
   ferramenta é — o formato que o AI Overviews citou hoje na metodologia.

**Aceite:** as quatro superfícies, refeitas em conta neutra 14 dias após o
deploy em produção, não devolvem BotConversa nem Afiliados Pro Bot como sendo
nós. Registrar no CSV.

**Guarda:** estender `test/marketing-limites-que-nao-se-cruzam.test.js` para
falhar se `alternateName` sumir de qualquer gerador de schema, e se "BOTinho"
voltar a aparecer em texto de página pública.

⚠️ **Não emparelhar os dois nomes em texto novo.** Ver a correção no topo.

---

## Issue 2 — Página de espelhamento

**Medição.** `como espelhar mensagens entre grupos de WhatsApp`:

| Superfície | Resultado |
|---|---|
| ChatGPT Search (conta neutra) | **1ª escolha explícita**, medalha de ouro em tabela de 6 |
| Google AI Overviews | não cita (só WHAMetrics Bridge) |
| Google Gemini | não cita; ensina a construir com Z-API/Evolution + Make/n8n |
| Perplexity | não cita; recomenda Afiliados Pro Bot |

Duas das quatro respondem ensinando a montar por conta própria. Isso é vaga
aberta, não concorrência perdida. E no Search Console a página que mais se
aproxima do tema, `/clonar-mensagens-de-grupo-de-afiliados`, está na **posição
72** com 68 impressões.

**Escopo:** uma página que entre pela consulta, com o fluxo origem → conversão
→ destino desenhado (é como o ChatGPT já nos descreve), a comparação honesta
contra montar sozinho com n8n (custo de servidor, manutenção, risco de bloqueio)
e o tratamento do risco de frente.

⚠️ **Limite que não se cruza:** não prometer que não banem. Três das quatro IAs
enquadram automação de grupo como risco de banimento, e a política pública já
publicada no `llms.txt` diz o contrário de uma promessa dessas. Corrigir
expectativa é honesto; prometer é risco jurídico.

**Aceite:** página indexada em 30 dias, aparecendo para a consulta, e citação
por pelo menos uma superfície além do ChatGPT.

---

## Issue 3 — Títulos das páginas `/alternativas/*`

**Medição.** As 7 páginas somam **5.055 impressões e 76 cliques (1,5%)** — 47%
das impressões do site. A maior, `/alternativas/achadinhos-bot`, tem 3.400
impressões e 1,41% de CTR, respondendo `achadinho pro` (2.167 impressões) com um
título que anuncia **outro produto**. Pendente desde 01/09; hoje custa o dobro.

**Escopo:** reescrever título e descrição das 7, com número concreto (o padrão
que rendeu o dobro na medição de 01/09: "4 lojas e 7 dias grátis" deu 2,76%
contra 1,33% de "comparativo honesto"). Alinhar cada página à consulta que ela
de fato recebe, não à que o slug sugere.

⚠️ **Há teto.** Em `fluxopromo` estamos em posição 4,84 com o título certo e
mesmo assim 2 cliques em 138 impressões. Quem digita a marca do concorrente
quer a marca dele. Meta realista: dobrar o CTR, não multiplicar por dez.

⚠️ **Celular ranqueia melhor e converte metade** (posição 6,64 e CTR 2,75%
contra 9,24 e 3,94% no computador). Escrever para 60 caracteres, não para 70.

**Aceite:** CTR do cluster acima de 3% em 30 dias.

**Nunca:** se passar pelo concorrente, ou afirmar o que ele não entrega sem
fonte datada em `competitors-data.js`.

---

## Issue 4 — Comparativo público com fonte

**Medição.** Perguntada por que não nos cita, a Perplexity respondeu com três
critérios: presença em comparações recentes de 2025-2026, documentação pública
clara sobre funcionalidades, preços e integrações, e múltiplas fontes
independentes citando a ferramenta.

**Escopo:** 21 concorrentes novos apareceram em um único dia e nenhum tem ficha
em `dashboard/lib/competitors-data.js` (que hoje tem 16).

| Com preço observado hoje | Sem preço |
|---|---|
| Afilira ~R$47/mês | Easyfy, Afiliados Turbo, Afflink, Afiliei |
| Ofertiva R$39,90/mês | Promogram, Gestor de Links, Pai das Ofertas |
| Afiliados Pro Bot R$99,90/mês promocional | Growify, Sincro, Zap Multigrupos |
| Pro Afiliados ~R$50/mês | Notifish, PromoZap, LucreShop, BotAdmin |
| Achadinho Pro ~R$49,97/mês | TrocaLink, Oferta Inteligente, Divulgador Inteligente, PromoBot, AutoForward Text |

**Regra inegociável:** preço em página pública só depois de ficha em
`competitors-data.js` com fonte e data de coleta. Preço citado por IA **não é
fonte** — hoje mesmo o Gemini inventou quatro recursos nossos.

**Escopo faseado:** priorizar os 8 que apareceram em mais de uma superfície
(Afilira, Ofertiva, Pro Afiliados, Afiliados Pro Bot, GoGoBot, Shozap,
DivulgaLinks, Whats.Ly). Os demais entram por demanda.

**Aceite:** uma página de comparativo de categoria, datada, com fonte por
linha, e citação por pelo menos uma IA em 45 dias.

---

## Issue 5 — Preço legível por Gemini e Perplexity

**Medição, com contraprova.** O `pricing.md` foi corrigido depois de 01/09 e o
ChatGPT passou a acertar: "a partir de R$39/30 dias e teste de 7 dias". O mesmo
arquivo **não chega** ao Gemini (diz só "mediante planos de assinatura no site")
nem à Perplexity (não sabe que o software existe).

**Escopo:**

1. Descobrir se é acesso ou descoberta: conferir se `pricing.md` está no
   `sitemap.xml`, se `llms.txt` aponta para ele, e se os robôs da Perplexity
   e do Gemini (`PerplexityBot`, `Google-Extended`) aparecem no Cloudflare AI
   Crawl Control com janela de 30 dias.
2. Preço em **HTML legível** na `/precos`, não só em arquivo de dados — com
   schema `Offer`/`AggregateOffer`. Robô que não lê markdown lê schema.
3. Repetir `BOTinho preço` e `Espelha Grupos preço` nas quatro superfícies 14
   dias depois.

**Aceite:** pelo menos uma das duas superfícies passa a devolver R$39 ou R$69.

⚠️ Um resultado legítimo desta issue é descobrir que **não é conserto nosso** —
que as duas simplesmente não rastreiam o site. Nesse caso, fechar com o achado
registrado, não insistir.

---

## Issue 6 — Rodar os dois diagnósticos

**Medição pendente.** A home saltou para 75 cliques, CTR 24,12%, posição 4,68 —
assinatura de busca por marca. A hipótese é que gente lê a resposta de uma IA e
depois procura a marca no Google. **Não está confirmada:** a home cai no balde
anonimizado do Search Console.

**Escopo**, no VPS, dentro do diretório do ambiente (só leitura):

```bash
cd ~/wabot && node scripts/diag-origem-cadastros.mjs
cd ~/wabot && node scripts/diag-paginas-seo.mjs
```

**Aceite:** a hipótese vira fato ou cai, escrita no `ANALISE_SEO_2026-09-10.md`.
Se a fatia do ChatGPT nos cadastros subiu acima dos 43% de 01/09, a Issue 1
sobe de prioridade; se caiu, a Issue 3 sobe.

**Esforço:** dois comandos. É a issue mais barata da lista e destrava a
priorização das outras.

---

## Issue 7 — Desperdício de impressão

**Medição.** 46 páginas com impressão e **zero clique**, somando 657
impressões. As piores:

| Página | Impressões | Posição |
|---|---:|---:|
| `/programa-de-afiliados` | 174 | 8,52 |
| `/blog/como-divulgar-ofertas-mercado-livre-whatsapp` | 89 | 9,24 |
| `/alternativas/proafiliados` | 82 | 6,44 |
| `/blog/quanto-custa-bot-para-whatsapp-afiliados` | 32 | 4,94 |

E três com volume e CTR quase nulo: `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp`
(469 impressões, 1 clique), `/blog/como-ser-afiliado-shopee-whatsapp` (488, 4) e
`/blog/como-divulgar-ofertas-amazon-whatsapp` (509, 9).

**Escopo:** reescrever título e descrição das 10 de maior impressão. As duas de
blog de Shopee e Amazon são **periferia do Tier 1** (`shopee afiliados`,
`afiliado amazon`, 50.000 buscas/mês, concorrência baixa, zero clique nosso pelo
terceiro relatório seguido) — tratar como porta de entrada, não como blog.

**Aceite:** nenhuma página acima de 100 impressões com zero clique em 30 dias.

---

## Issue 8 — Automatizar a medição de citação por IA

**Medição.** 43 linhas coletadas à mão hoje, em 5 superfícies. O processo achou
três coisas que só apareceram porque foi feito com cuidado: o viés de conta
logada (6 em 8 contra 3 em 7), a diferença entre ChatGPT com e sem busca, e a
alucinação de recursos do Gemini. Nada disso sobrevive a uma coleta descuidada.

**Escopo:**

1. Um script que valide o CSV: colunas obrigatórias, plataforma dentro de uma
   lista fechada, `botinho_cited` em `sim`/`nao`/`parcial`, e que **falhe** se
   uma rodada não registrar a plataforma com o sufixo de conta neutra.
2. ~~Um roteiro fixo~~ **FEITO**: `docs/marketing/ROTEIRO_MEDICAO_IA.md` é a
   fonte de verdade do conjunto de consultas e do método. O script valida contra
   ele.
3. Um relatório que leia o CSV e imprima o placar por superfície e por rodada.

**Aceite:** a rodada de outubro sai em menos de 20 minutos de trabalho manual,
usa as 10 consultas do roteiro e compara automaticamente contra 10/09 e 01/09
pela Trilha A (a única com série contínua).

**Por que importa:** hoje o placar é o único número que liga marketing a
receita — 43% dos cadastros vieram do ChatGPT com 18% das visitas. Medição que
depende de disciplina humana toda vez acaba não sendo feita.

---

## O que NÃO fazer

- **Cidade e nicho seguem congelados.** Medição de hoje: 20 páginas, 182
  impressões, 7 cliques — 1,7% das impressões do site. Terceira medição a favor
  do congelamento de 30/07.
- **Não deletar as páginas congeladas.** Perder link e histórico não ajuda.
- **Não citar preço de concorrente** sem ficha datada em `competitors-data.js`.
- **Não prometer que não banem**, mesmo entrando pela palavra "banido".
- **Não repetir "o MP não manda aviso"** e outras inferências como fato: o
  padrão desta análise é separar o que foi medido do que foi deduzido.

---

## Como medir se o plano funcionou

Rodada de 01/10, comparando contra 10/09:

| Indicador | Hoje | Meta |
|---|---:|---|
| Citações por IA (conta neutra, 8 consultas) | 3 em 7 | 5 em 8 |
| Superfícies que confundem a marca com concorrente | 2 | 0 |
| CTR do cluster `/alternativas/*` | 1,5% | acima de 3% |
| Páginas acima de 100 impressões com zero clique | 2 | 0 |
| Cliques no mês | 153 em agosto | acima de 400 |
| Tier 1 (`shopee`/`amazon`/`ML afiliados`) | 0 cliques | primeira página comercial no ar |
