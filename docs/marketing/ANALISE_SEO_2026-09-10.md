# Análise SEO + citação por IA — 2026-09-10

Antecipação da leitura mensal (a anterior é de 2026-09-01, nove dias antes).
Fontes: Search Console (Desempenho 3 meses + Cobertura, exports de 09/09),
Cloudflare AI Crawl Control (janela de 24h do dia 09) e 43 medições novas de
citação por IA em `ai_visibility_tracking.csv`.

Compare contra `ANALISE_SEO_2026-09-01.md` e
`REGISTRO_EXECUCAO_2026-08-16_A_09-02.md`. Não recomeçar do zero.

---

## Ressalvas de método (ler antes dos números)

1. **A janela é de 3 meses (08/06 a 07/09).** As leituras anteriores usaram 12
   meses. Onde comparo evolução, uso a série diária do `Gráfico.csv`, que é
   imune à escolha de janela.
2. **A tabela de consultas explica só 18% dos cliques** (57 de 318). O resto o
   Google anonimiza. Toda conclusão tirada da aba CONSULTAS vale para a fatia
   nomeada, nunca para o site inteiro.
3. **Os exports por dispositivo vieram truncados** (somam 26 e 31 cliques contra
   totais de 168 e 150). Servem para os totais, não para abrir por página.
4. **Uma das rodadas de IA está inflada.** A primeira passada do ChatGPT Search
   saiu de conta logada com personalização ("seu grupo de 300 pessoas, ~50
   ofertas/dia") e marcou 6 citações em 8. A repetição em conta neutra marcou 3
   em 7. **Vale a conta neutra.**
5. **A pergunta indutora contamina.** "O que faria você indicar o botinho"
   convida à invenção. No ChatGPT neutro gerou resposta no condicional (honesta);
   no Gemini e na Perplexity gerou fato inventado. O contraste é dado; a resposta
   induzida em si não é.
6. **O print da Cloudflare é de 24 horas**, não a tendência mensal pedida.

---

## 1. Busca: a primeira semana de setembro rendeu quase agosto inteiro

| Janela | Cliques | Impressões | CTR |
|---|---:|---:|---:|
| Junho (a partir de 08) | 8 | 336 | 2,38% |
| Julho | 33 | 656 | 5,03% |
| Agosto | 153 | 5.286 | 2,89% |
| **1 a 7 de setembro** | **124** | **3.515** | **3,53%** |

Sete dias em ritmo de ~530 cliques/mês. Não é pico: os sete dias vieram todos
acima de 15 cliques, o que nunca tinha acontecido. O CTR subiu junto com o
volume, o que é o contrário do padrão de agosto.

### A home explodiu — e é o achado novo

75 cliques, 311 impressões, **CTR 24,12%**, posição 4,68. Em 01/09 ela não
figurava entre as páginas relevantes.

CTR de 24% com poucas impressões é a assinatura de busca por marca: quem digita
já sabe o nome. A home não aparece na tabela de consultas (bucket anonimizado),
então **não há prova direta de qual termo trouxe esses cliques**.

**Hipótese, não fato:** gente lê a resposta de uma IA e depois procura a marca no
Google. Sustentação: 43% dos cadastros vinham do ChatGPT com 18% das visitas
(medição de 01/09). Confirmação depende de `scripts/diag-origem-cadastros.mjs`,
que não pôde rodar nesta sessão (clone sem `.env` e sem banco).

### As páginas de comparação continuam sendo o motor

| Cluster | Páginas | Cliques | Impressões |
|---|---:|---:|---:|
| `/alternativas/*` | 7 | 76 | 5.055 |
| Cidades (`espelhar-grupos-whatsapp-*`) | 8 | 2 | 55 |
| Nichos (`bot-ofertas-*`) | 12 | 5 | 127 |

Sete páginas de comparação valem 47% das impressões do site. Vinte páginas de
cidade e nicho valem 1,7%. **O congelamento de cidade e nicho decidido em
30/07 segue correto** e ganhou mais uma medição a favor.

### O desperdício está concentrado e nomeado

| Página | Impressões | Cliques | Posição |
|---|---:|---:|---:|
| `/alternativas/achadinhos-bot` | 3.400 | 48 | 6,34 |
| `/blog/como-ser-afiliado-shopee-whatsapp` | 488 | 4 | 9,65 |
| `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` | 469 | 1 | 7,08 |
| `/programa-de-afiliados` | 174 | 0 | 8,52 |

46 páginas tiveram impressão e zero clique, somando 657 impressões.

`/alternativas/achadinhos-bot` é a maior página do site e responde `achadinho pro`
(2.167 impressões) com um **título que anuncia outro produto**. É o mesmo
problema apontado em 01/09, não corrigido, e agora custa o dobro.

⚠️ **Há teto nessas consultas.** Em `fluxopromo` estamos em posição 4,84 com o
título certo e mesmo assim 2 cliques em 138 impressões. Quem digita a marca do
concorrente quer a marca do concorrente. Melhorar título rende, mas não vira 10%.

### Celular: o padrão de 01/09 se manteve

| Dispositivo | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| Computador | 168 | 4.269 | 3,94% | 9,24 |
| Celular | 150 | 5.448 | 2,75% | 6,64 |

Celular ranqueia melhor e converte pior. Aponta para título cortado na tela
pequena, não para público diferente.

### Indexação: parada, e não foi ela que trouxe o crescimento

81 indexadas contra 53 fora, praticamente igual a 01/09 (77 e 51).

| Motivo | Páginas |
|---|---:|
| Rastreada, mas não indexada | 24 |
| Detectada, mas não indexada | 11 |
| Página alternativa com canônica adequada | 9 |
| Excluída por noindex | 8 |
| Bloqueada pelo robots.txt | 1 |

Os 17 últimos (canônica, noindex, robots) são decisões nossas e provavelmente
corretas. Os 35 primeiros são o Google decidindo não indexar.

**O crescimento veio das mesmas páginas aparecendo em mais buscas.** Isso
reforça a conclusão de 01/09: indexação não é o gargalo do tráfego. Mas é o
gargalo da **citação por IA** — ver seção 3.

### Tier 1 continua em zero, pelo terceiro relatório seguido

`afiliado shopee`, `afiliado amazon`, `mercado livre afiliados` (50.000/mês cada,
concorrência baixa) somam algumas dezenas de impressões e nenhum clique. Não
existe página comercial nossa disputando. Sinal de periferia:
`/blog/como-divulgar-ofertas-amazon-whatsapp` (509 impressões) e
`/blog/como-ser-afiliado-shopee-whatsapp` (488).

---

## 2. Citação por IA: o placar e o que ele esconde

| Superfície | Citações | Observação |
|---|---|---|
| ChatGPT Search (conta neutra) | **3 em 7** | linha de referência |
| Google AI Overviews | 1 em 8 | |
| Google Gemini | 0 em 6 (1 parcial) | inventa recursos |
| Perplexity | 0 em 6 | troca nossa identidade |
| ChatGPT sem busca | 0 em 8 | entidade não existe sem busca |
| *ChatGPT Search (conta da dona)* | *6 em 8* | *inflada, não usar* |

### O padrão que explica quase tudo

> **"Espelha Grupos" existe. "BOTinho" não.**

Onde a consulta usa o nome da marca, somos citados e descritos corretamente.
Onde usa o nome do robô, o termo bate em outra coisa.

**O que "BOTinho" devolve hoje, por superfície:**

| Superfície | O que o nome virou |
|---|---|
| Google AI Overviews | calçado infantil + rede de pesca |
| Google Gemini | calçado + Projeto Botinho (bombeiros) + **peixe de aquário** (Hassar gabiru) |
| Perplexity | **Afiliados Pro Bot** (concorrente) e **BotConversa** (concorrente) |
| Perplexity (2ª forma) | substantivo comum: "ferramentas tipo botinho, APIs não oficiais" |
| ChatGPT Search neutro | "resultados trazem ferramentas diferentes com nomes semelhantes" |

Em 01/09 o problema era descrito como "a entidade está partida em duas". Hoje é
mais grave e mais preciso: **uma das metades morreu e a outra funciona.** E a
metade morta está sendo ocupada por concorrentes.

⚠️ **Regressão medida:** em 01/09 o ChatGPT Search acertava o preço (Pro R$69,
teste de 7 dias). Hoje, em conta neutra, diz que não encontra fonte pública
confiável. A causa que ele mesmo dá é o homônimo.

### Espelhamento é a nossa consulta — e divide as IAs ao meio

| Superfície | Resultado em `como espelhar mensagens entre grupos` |
|---|---|
| ChatGPT Search neutro | **1ª escolha explícita**, medalha de ouro em tabela de 6 |
| Google AI Overviews | não cita (só WHAMetrics Bridge) |
| Google Gemini | não cita; ensina a **construir** (Z-API/Evolution + Make/n8n) |
| Perplexity | não cita; recomenda **Afiliados Pro Bot** |

Duas das quatro superfícies respondem essa consulta ensinando a montar por conta
própria. Isso é vaga aberta, não concorrência perdida.

### Uma surpresa que contraria as outras superfícies

Em `postar em vários grupos sem spam`, o ChatGPT neutro cita **BOTinho em
primeiro e sozinho**, sem concorrente nomeado. É a única consulta do dia em que
esse nome funciona por conta própria. AI Overviews, Gemini e Perplexity tratam a
mesma consulta como hostil a produto. Vale reavaliar antes de descartá-la.

### Uma vitória real, e limitada

`BOTinho metodologia WhatsApp` no Google AI Overviews: em 01/09 ele **inventou**
uma metodologia com pilares nomeados e citou fontes falsas. Hoje cita
`/metodologia-uso-responsavel-whatsapp` como fonte real e acerta espelhamento,
conversão de link, revisão humana e registros.

Duas ressalvas honestas:
- Ele **renomeou** os nossos princípios. A página diz Permissão, Revisão humana,
  Cadência, Registros e Sem promessa de ganho. Ele publicou "5 pilares: Oferta,
  Link, Grupo, Copy, Cadência".
- A página tem **1 impressão** no Search Console. O ganho é citação, não busca.
- O Gemini, no MESMO dia e na MESMA consulta, inventou um "Funil BOTinho" do
  zero. As duas superfícies do Google divergem entre si.

### Risco de suporte, não só de marketing

O Gemini afirmou como fato quatro coisas que não fazemos:

- espelhamento **Telegram → WhatsApp** e suporte a **AliExpress**
- "disparo híbrido WhatsApp + Telegram"
- integração nativa com **Nuvemshop, Loja Integrada e Tray**
- **recuperação de carrinho abandonado** e cupom de boas-vindas

Quem pergunta ao Gemini sai achando que o produto tem Telegram e carrinho
abandonado. Assina, não encontra, pede reembolso. Isso não é lacuna de
visibilidade, é expectativa fabricada por terceiro.

### O briefing que a Perplexity entregou de graça

Perguntada por que não nos cita, ela respondeu com três critérios objetivos:

1. presença em **comparações recentes** (2025-2026) publicadas por terceiros;
2. **documentação pública clara** sobre funcionalidades, preços e integrações;
3. **múltiplas fontes independentes** citando a ferramenta como ativa.

E conclui que o Botinho "pode ser uma ferramenta mais nova, um apelido informal
de outra plataforma, ou uma solução com menos material público". Ela não sabe
qual das três — e as três são o mesmo problema.

**Contraprova de que o critério 2 funciona:** o ChatGPT leu `pricing.md` e
acertou "a partir de R$39/30 dias e teste de 7 dias". Em 01/09 a anotação era que
o preço do Basic não estava legível para robô. Foi corrigido, e a correção
apareceu na medição. O mesmo arquivo **não** chegou ao Gemini (que só diz
"mediante planos de assinatura no site") nem à Perplexity (que não sabe que o
software existe).

---

## 3. Robôs de IA: entram, e o Googlebot quase não

Janela de 24h (09/09), Cloudflare AI Crawl Control:

| Robô | Requisições | Dados |
|---|---:|---:|
| BingBot | 49 | 594,72 kB |
| ChatGPT-User | 41 | 553,31 kB |
| OAI-SearchBot | 33 | 224,04 kB |
| Claude-User | 18 | 42,44 kB |
| GPTBot | 15 | — |
| Googlebot | — | 32,98 kB |

`robots.txt` conferido nesta sessão: **0 bloqueios**. A Cloudflare continua
desligada.

O volume do Googlebot é chamativo de baixo perto dos demais, mas **uma janela de
24 horas num painel que existe para medir robô de IA não é evidência suficiente**
sobre o Google. Anotar e reconferir com janela maior antes de concluir.

---

## 4. O que fazer, em ordem

Cada item aqui sai de uma medição desta análise, não de opinião.

**1. Consertar o nome em todo texto público.** Nunca "BOTinho" sozinho. Sempre
"BOTinho, o robô do Espelha Grupos". Em `pricing.md` já existe uma linha de
desambiguação e ela não bastou: a Perplexity funde a marca com dois concorrentes
diferentes. A afirmação precisa estar no corpo das páginas e no schema
(`brand`, `alternateName`, `publisher`), não só num arquivo de dados.

**2. Atacar espelhamento.** É a única consulta em que somos primeira escolha
espontânea, e duas das quatro IAs respondem ensinando a construir com n8n. Página
que entre por "como espelhar mensagens entre grupos" e trate o risco de frente.

**3. Consertar o título de `/alternativas/achadinhos-bot`.** Maior página do
site, 3.400 impressões, 1,41% de CTR, título que anuncia outro produto. Pendente
desde 01/09. Lembrar do teto: melhora, não multiplica.

**4. Publicar comparação pública, com fonte.** É o critério 1 da Perplexity. Já
temos `competitors-data.js`; faltam fichas para os **21 concorrentes novos**
descobertos hoje (lista na seção 5).

**5. Tornar preço e recursos legíveis para Gemini e Perplexity.** O critério 2
comprovadamente funciona: o ChatGPT leu e acertou. Investigar por que as outras
duas não alcançam `pricing.md`.

**6. Rodar os dois diagnósticos que faltaram** (`diag-origem-cadastros.mjs` e
`diag-paginas-seo.mjs`) para confirmar ou derrubar a hipótese da home.

**7. Não investir em cidade e nicho.** Segue congelado, com mais uma medição a
favor (20 páginas, 1,7% das impressões).

---

## 5. Concorrentes novos descobertos hoje (nenhum com ficha)

Nenhum preço abaixo pode ir para página pública antes de entrar em
`competitors-data.js` com fonte e data.

**Com preço observado:** Afilira (~R$47/mês), Ofertiva (R$39,90/mês),
Afiliados Pro Bot (R$99,90/mês promocional), Pro Afiliados (~R$50/mês),
Achadinho Pro (~R$49,97/mês).

**Sem preço:** Easyfy, Afiliados Turbo, Afflink, Afiliei, Promogram, Gestor de
Links, Pai das Ofertas, Growify, Sincro, Zap Multigrupos, Notifish, PromoZap,
LucreShop, BotAdmin, Gigi Prime Bot, TrocaLink, Oferta Inteligente, Divulgador
Inteligente, PromoBot, AutoForward Text.

⚠️ Essa lista é quase disjunta da que o Search Console mostra (AchadinhosBot,
Achadinho Pro, FluxoPromo, Shozap). São dois mercados diferentes, e só um tem
página nossa disputando.

---

## 6. Para a próxima rodada

- Repetir as 8 consultas **sempre em conta neutra**, e registrar a rodada
  logada em separado se for feita.
- Refazer no ChatGPT com busca ativada as consultas em que a rodada sem busca
  falhou, para separar "falta de entidade" de "falta de busca".
- Cloudflare com janela mensal, não 24h.
- Conferir se `pricing.md` passou a ser lido por Gemini e Perplexity — é a
  métrica de sucesso do item 5.
- Reconferir o volume do Googlebot com janela maior.

Rodada completa dos quatro relatórios de palavra-chave (Planejador e Trends
inclusos) segue prevista para **outubro/2026**. Volume de mercado não muda em
semanas.
