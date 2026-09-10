# Crítica ao plano de pesquisa e roadmap revisado

**Data:** 2026-09-10 · **Revisa:** `docs/produto/roadmap-competitivo-2026-09.md`

Este documento faz duas coisas: aponta onde o plano anterior erra e propõe a
ordem das próximas melhorias com o dado que **já existe** neste repositório mais
o que foi verificado hoje na concorrência.

---

## 1. O veredito em uma frase

O plano anterior é um **método correto aplicado à empresa errada**. Ele foi
escrito para um time de sete papéis com orçamento de mídia, e a operação tem
**14 pagantes, teto técnico de 20 robôs e uma pessoa**. Ele também propõe
coletar, em 30 dias, dado que este repositório mediu nos últimos 30.

O que ele acerta merece ser preservado. O que ele custa não se paga.

---

## 2. Os cinco erros

### 2.1 Custa mais que a receita do mês

O plano pede 3 smoke tests a **R$ 300–500 cada** (R$ 900 a R$ 1.500).

| Item | Valor |
|---|---:|
| Planos | R$ 39 (Basic) e R$ 69 (Pro) |
| Pagantes medidos (60 dias) | 14 |
| Receita recorrente no melhor caso | ~R$ 966/mês |
| Orçamento só de smoke test | R$ 900–1.500 |

O teste de disposição a pagar consome **de uma a uma vez e meia a receita
mensal inteira** para descobrir qual funcionalidade construir. Some 26
entrevistas de 30–40 minutos (~15 horas), 4 a 8 trials de concorrente, 7 CSVs e
uma reunião de decisão com sete responsáveis.

Os responsáveis listados — Marketing, Produto, CS, Dados/Engenharia, Growth,
Direção — **não existem**. São a mesma pessoa.

### 2.2 Manda coletar o que já foi coletado

O plano cita `ANALISE_SEO_2026-09-11.md` na bibliografia e depois agenda
"Semana 1: Search Console" como se partisse do zero. Ele não usa **um único
número** dos documentos que cita.

O que já está medido e o plano ignora:

| Pergunta do plano | Já respondido em | Resposta |
|---|---|---|
| Qual intenção gera cadastro? | `ANALISE_SEO_2026-09-11.md` | Página comercial converte 15,4% de visita em cadastro; comparação converte **0,0%** com 47% das impressões |
| Onde a cliente para? | `PLANO_ATIVACAO_FUNIL_2026-09-08.md` | 128 cadastros → 14 pagantes; a maior caixa recuperável são **32 pessoas que viram oferta sair e não pagaram** |
| Checkout é problema? | idem | **Não.** 14 iniciaram, 14 pagaram |
| Qual canal traz cliente? | `ANALISE_SEO_2026-09-11.md` | ChatGPT: 13% das visitas, **35% dos cadastros** |
| Volume real de busca da categoria | `ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md` | 8.923 termos do Planejador já coletados |

### 2.3 Erra a origem dos 14 concorrentes novos

O plano os chama de "nomes adicionados pela direção", sem dizer de onde vieram.
Vieram da coluna `competitors_cited` de `ai_visibility_tracking.csv` — são nomes
que **as IAs citaram** ao responder sobre a categoria.

Isso muda o que eles significam e o que fazer com eles:

- não são concorrentes verificados, são **concorrentes na resposta da IA**;
- alguns podem não existir. Busquei hoje: **Notifish não retornou nenhum
  resultado** de produto;
- alguns não são produto. **Growify** aparece como site de guias
  (`growify.pro/guias/...`), ou seja, concorrente de **conteúdo**, não de
  software. O próprio plano previu esse risco de homônimo — e depois listou o
  nome como concorrente mesmo assim.

Nenhum dos 14 tem ficha em `competitors-data.js`. As 16 fichas de lá são outras.

### 2.4 Não vê o teto que já está batendo

O plano pergunta qual funcionalidade traz mais clientes. A operação **não tem
onde colocá-los**.

| Fato medido (AGENTS.md, RCA 2026-09-01) | Valor |
|---|---:|
| Teto de robôs simultâneos | 20 |
| RSS medido por robô | 272 MB |
| Recusas de conexão já acumuladas | 183 |

Com 14 pagantes mais trials, a operação opera perto do teto comercial, e uma
cliente que desliga o robô **perde a vaga**. Enquanto isso não muda, toda
melhoria de aquisição é convertida em recusa.

Priorizar aquisição antes de mexer no teto é otimizar uma restrição que não se
pode gastar.

### 2.5 Congela o roadmap por 30 dias sem precificar o congelamento

"Até os CSVs e o memo final existirem, qualquer ordem depois de Instagram
Stories é hipótese." SHEIN, AliExpress e Stories provavelmente não ocupam 30
dias. A pesquisa termina quando a fila já esvaziou — ou a fila esvazia antes e
não há nada decidido.

---

## 3. O que o plano acerta e deve ser mantido

Isto não é ruído; é a parte boa e ela sobrevive:

1. **Separar demanda declarada de demanda observada.** Busca alta não é dor.
2. **Trends + Keyword Planner contam como UMA família de evidência**, não duas.
3. **Não inventar número quando o Ads mostra faixa.**
4. **Não atribuir recurso a concorrente sem URL e data.** É a regra que já
   governa `competitors-data.js` e que impede citar preço não verificado.
5. **Identificar homônimo antes de atribuir.** Growify prova que a regra é
   necessária.
6. **Não misturar consumidor de cupom com afiliada procurando ferramenta.**
7. **Registrar evidência que contradiz a aposta preferida.**

---

## 4. O dado de mercado que faltava, coletado hoje

Fonte principal: comparativo público de 14 bots, publicado em 10/06/2026 e
atualizado em 01/08/2026 (`ofertasbot.com`), mais as páginas oficiais de cada
produto. Tudo verificável, com data.

### 4.1 Telegram é o recurso que mais nos falta

Publicam em Telegram: ProAfiliados, Pai das Ofertas, Shozap, DivulgaLinks,
PromoBot, FluxoPromo, Guru das Promoções, Divulgador Inteligente, Afilira (a
partir do plano Professional), Promium.

Nós: **não publicamos em Telegram.** É o recurso ausente mais comum entre os
concorrentes mapeados.

### 4.2 O piso de preço está abaixo do nosso, e há grátis permanente

| Produto | Entrada | Grátis |
|---|---|---|
| ProAfiliados | R$ 50 | **grátis para sempre** (com marca no envio) |
| Pai das Ofertas | **R$ 35,90** | 6 dias |
| Afilira | R$ 47 | **conta grátis** (1 sessão, 1 origem, 1 destino) |
| FluxoPromo | R$ 37 | **grátis, 20 ofertas/dia** |
| Achadinho Pro | R$ 49,97 | 7 dias |
| Shozap | R$ 50 | 5 dias |
| DivulgaLinks | R$ 69,90 | 7 dias |
| Promium | R$ 97,90 recorrente | não informa |
| **Nós** | **R$ 39** | 7 dias |

Nosso preço de entrada é competitivo. O que destoa é a **ausência de camada
gratuita permanente**, que quatro concorrentes usam como porta de entrada.

### 4.3 Instagram Stories não é diferencial — é paridade

Já atendem Instagram: Shozap, DivulgaLinks (com artes automáticas, R$ 69,90 a
R$ 169,90), Afiliado Inteligente, Divulgador Inteligente (Link Bio).

Isso **não é motivo para cancelar** a implementação — é motivo para não esperar
que ela sozinha ganhe cliente de concorrente. Vale como paridade e como resposta
a objeção, não como moat. Observação útil: a DivulgaLinks cobra **mais que o
nosso plano Pro** por uma proposta centrada em Instagram.

### 4.4 Lojas: onde estamos depois de SHEIN e AliExpress

Com SHEIN e AliExpress entregues chegamos a **seis** lojas (Mercado Livre,
Amazon, Shopee, Magalu, SHEIN, AliExpress). Concorrentes anunciam mais:

- Afilira: "18+ plataformas";
- FluxoPromo: 8 lojas, incluindo **Kabum, Nike e Centauro**;
- Gigi Prime Bot e PromoBot: **Kabum**;
- DivulgaLinks: **Natura**;
- Promium: 10 lojas.

**Kabum é a loja fora do nosso catálogo que mais aparece** entre concorrentes.

### 4.5 Duas fontes independentes atacam o nosso modelo

O comparativo do PromoBot afirma que "a diferenciação vem de chegar primeiro na
oferta", defendendo monitorar a **fonte** em vez de espelhar grupo de terceiro.

A Perplexity, medida em 11/09 e registrada em `ANALISE_SEO_2026-09-11.md`,
critica exatamente isso em nós: conteúdo repetido, dependência de terceiros, e
recomenda "ferramentas que fazem garimpo próprio por IA".

Duas fontes que não se conhecem convergem na mesma objeção. O produto **já tem**
a resposta — ofertas automáticas da Shopee no plano Pro — e ela não está legível
nem para a IA nem, provavelmente, para a cliente.

---

## 5. O buraco de medição que ninguém viu (e é o mais barato de fechar)

Espelhamos grupos de ofertas. Isso significa que o nosso banco contém um **censo
ao vivo de quais lojas as afiliadas brasileiras realmente publicam**. É um dado
melhor que Google Trends para decidir a próxima loja, e é nosso.

**Só que hoje ele não existe, e o motivo é um defeito.**

`detectLinks` (`src/detector.js`) é uma lista fechada de seis lojas. E
`removeNonOfferUrls` (`src/messageProcessor.js`) **apaga** qualquer URL que não
seja de uma delas.

Consequência dupla:

1. **Não conseguimos contar.** Um link de Temu, Kabum, Natura ou Nike que chega
   num grupo monitorado nunca vira linha de `MessageLog` — some antes.
2. **A oferta sai sem o link.** Se a mensagem espelhada trazia só um link de
   loja não suportada, ela é publicada **com o link removido**. Não vira
   `skip:no_valid_conversions`, não vira erro, não aparece em lugar nenhum.

Quanto isso acontece hoje: **não sabemos**. E é exatamente a pergunta "qual
loja vem depois".

O conserto é pequeno: contar host de URL descartada, agregado, sem guardar a URL
inteira. Dias, não 30 dias, e custo zero de mídia.

---

## 6. Roadmap proposto

Ordem por retorno medido dividido por custo, não por tamanho da queda.

### Em andamento — não mexer

| # | Item | Razão |
|---|---|---|
| 0 | SHEIN e AliExpress | já em execução |
| 0 | Instagram Stories | já decidido; ver §4.3 sobre expectativa |

### 1º — Teto de robôs: decidir antes de atrair mais gente

**Por quê:** 20 vagas, 272 MB por robô, 183 recusas já registradas. Sem isso,
aquisição vira recusa.

⚠️ **Mudança memory-heavy — REGRA #1 do AGENTS.md.** Subir o teto exige RAM
adicional (~272 MB por vaga) e **reiniciar o `bot-supervisor`, o que reconecta
TODAS as sessões de uma vez**. Não aplicar sem OK explícito e aviso prévio.

Alternativas mais leves, na ordem: desligar staging quando não há validação
(libera ~1–1,4 GB), confirmar o teto de heap por worker, e medir o custo real
por vaga hoje antes de comprar RAM.

**Decisão que cabe à direção:** aceitar o teto atual e priorizar receita por
cliente, ou pagar mais VPS e priorizar volume.

### 2º — As 32 que viram oferta sair e não pagaram

**Por quê:** é a maior caixa recuperável do funil, com teto de **+32 pagantes**,
e quem chega ao checkout paga a ~100%. Custo baixo: e-mail e timing.

**Já está especificado** em `PLANO_ATIVACAO_FUNIL_2026-09-08.md` (item D6) e
**não é código** — é contato. Pré-requisito esquecido: sem `SMTP_*` no `.env`
nenhum e-mail sai, em silêncio.

### 3º — Instrumentar loja não suportada

**Por quê:** transforma "qual loja depois" de opinião em contagem, com dado
próprio, em dias. E fecha o defeito de publicar oferta sem link.

**Entrega:** contador agregado por host descartado + a decisão de Kabum/Temu/
Natura sai da própria medição em 2 a 4 semanas de coleta passiva, sem
entrevista e sem mídia paga.

### 4º — Telegram como destino

**Por quê:** recurso ausente mais comum entre concorrentes (§4.1).

**Hipótese que precisa de spike antes de virar tarefa:** o Telegram usa API de
bot por HTTP, sem socket persistente por cliente, então um destino Telegram
pode custar uma fração dos 272 MB de uma sessão WhatsApp. Se confirmado, é a
única funcionalidade da lista que **atende mais cliente sem consumir vaga** —
o que a conecta diretamente ao item 1. **Não tratar como fato até o spike.**

### 5º — Tornar legível o garimpo que já existe

**Por quê:** duas fontes independentes acusam o modelo de ser espelho de
terceiro (§4.5), e a resposta já está no produto.

Custo baixo, é posicionamento e conteúdo, não engenharia.

### Fica em observação, com motivo

| Item | Motivo |
|---|---|
| Camada gratuita permanente | quatro concorrentes usam; mas cada conta grátis ocupa **uma vaga do teto de 20**. Só faz sentido depois do item 1 |
| Vitrine com domínio próprio | aparece em 4 concorrentes; nenhuma evidência de demanda nossa ainda |
| Kabum, Temu, Natura | decisão sai do item 3, não de achismo |
| Multi-número / equipe | sem sinal no funil atual |

---

## 7. A pesquisa que ainda vale a pena — 5 dias, não 30

Só o que não está no repositório e não sai da instrumentação.

| # | Trabalho | Tempo | Por que não dá para pular |
|---|---|---|---|
| 1 | **Uma rodada do Planejador** nos lotes de canal e loja | 2 h | O estudo de 30/07 tem 8.923 termos e **zero** cobertura de Telegram, Instagram, Stories, Kabum, Temu, Natura, AliExpress, SHEIN e vitrine. Conferido: a lacuna é real |
| 2 | Ficha verificada de **4 concorrentes**: Afilira, Pai das Ofertas, Zap Multigrupos, Ofertiva | 3 h | Todos confirmados como reais hoje; nenhum tem ficha. Regra de `competitors-data.js`: URL e data, senão não entra |
| 3 | **5 conversas**, não 26 — com as 32 do item 2 do roadmap | 3 h | A conversa já é necessária para recuperar receita; a pesquisa pega carona |

Não fazer agora: smoke test pago (§2.1), survey de 80 respostas, trials de 8
concorrentes, os 7 CSVs.

**Regra de corte:** se um dado não muda a ordem do §6, não é coletado.

---

## 8. O que derruba esta proposta

Registrado de propósito, na regra do próprio plano anterior:

- **Se o teto de 20 não estiver de fato batendo hoje**, o item 1 cai para
  terceiro e o item 2 vira primeiro. Verificável em minutos com o diagnóstico de
  vagas do AGENTS.md — **fazer isso antes de aceitar este roadmap**.
- **Se a instrumentação do item 3 mostrar quase nada** de loja não suportada,
  a frente de lojas morre e Telegram sobe.
- **Se o spike do Telegram mostrar custo de RAM comparável ao do WhatsApp**,
  ele perde o argumento principal e vira paridade competitiva comum.
- As projeções de §4 são de **páginas públicas de concorrente**, que podem
  anunciar mais do que entregam. Nenhuma foi testada em trial.
