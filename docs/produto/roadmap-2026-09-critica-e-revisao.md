# Roadmap de produto — o que vem depois de SHEIN, AliExpress e Stories

**Data:** 2026-09-10 · **Substitui:** `docs/produto/roadmap-competitivo-2026-09.md`
(plano de 30 dias de pesquisa) e a primeira versão deste arquivo.

Decisões da direção já incorporadas: o teto de robôs **não é restrição**
(`MAX_SESSIONS_PER_PROCESS=40`, expansível), falar com as 32 clientes paradas
**saiu do plano** (não houve contato), e Instagram Stories **continua na fila**.

---

## 1. O fio que amarra tudo

A objeção que o mercado faz a nós **já está respondida dentro do produto — e não
está sendo dita em lugar nenhum.**

Duas fontes que não se conhecem dizem a mesma coisa:

- o comparativo público de 14 bots (`ofertasbot.com`, atualizado 01/08/2026)
  afirma que "a diferenciação vem de chegar primeiro na oferta", desqualificando
  quem só espelha grupo de terceiro;
- a Perplexity, medida em 11/09 (`ANALISE_SEO_2026-09-11.md`), critica em nós
  exatamente isso: "conteúdo repetido, dependência de terceiros, sem
  diferenciação", e recomenda "ferramentas que fazem garimpo próprio por IA".

Nós temos garimpo próprio (Shopee), temos mensagem totalmente reescrita por
template, temos marca d'água na foto e temos painel de comissão por produto. A
palavra **"comissão"** aparece no site inteiro **uma vez**: no aviso de que não
prometemos comissão.

**Por isso o primeiro item do roadmap não é código.**

---

## 2. Resposta direta: Telegram fura a fila do Stories? **Não.**

E o motivo é que **meu próprio argumento morreu** com a informação do teto.

Na versão anterior eu defendi Telegram na frente porque ele atenderia mais
cliente sem consumir vaga de robô (272 MB por sessão WhatsApp, teto de 20). Com
o teto em 40 e expansível, economizar vaga deixou de ser prêmio. Sem isso,
Telegram é paridade competitiva comum — a mesma categoria de Stories, que já
foi decidido e ainda não teve uma linha escrita. Trocar a ordem agora custa
replanejamento e não compra nada mensurável.

**Quem fura a fila é a divulgação do que já existe** — não gasta semana de
engenharia, e é onde a comparação está sendo perdida hoje.

---

## 3. O que o produto faz e o mercado não sabe

Levantado no código e conferido contra `dashboard/lib/marketing-content.js` e
`dashboard/public/pricing.md`:

| Recurso | Onde está no produto | Aparece para quem ainda não é cliente? |
|---|---|---|
| **Painel de vendas** — compras atribuídas, comissão estimada e confirmada, por pedido e por produto | `/painel/vendas` (1º item do menu) | **Não.** Zero menção |
| **Marca d'água na foto da oferta** | Preservação → destinos | **Não.** Zero menção |
| **Card clicável que abre a loja** | global | **Não.** Zero menção |
| **SHEIN e AliExpress** | conversores | **Não.** O site ainda diz "ML, Amazon, Shopee e Magalu" |
| **Rastreador de clique com link curto próprio** | `/r/:hash` | **Não.** Zero menção |
| **Mensagem totalmente reescrita por template** (30+ variáveis: `{{oferta}}`, `{{valor}}`, `{{cupomLink}}`, `{{grupoLink}}`…) | `/painel/mensagens` | Uma linha: "Templates de mensagem personalizáveis". Sem exemplo, sem imagem |
| **Garimpo automático da Shopee** | `/painel/ofertas-automaticas` | Uma linha dentro do plano Pro |
| **Filas com intervalo, teto por hora e por dia** | `/painel/filas` | Uma linha |
| **Preservação**: intervalo mínimo, rajada, teto diário, horário de descanso, variação de copy, descarte de oferta velha | `/painel/preservacao` | Só como **"Módulo de Preservação Avançada"** |
| **Programa de indicações com pagamento por PIX** | `/painel/afiliados` | Só no `pricing.md` (arquivo para IA), não na página |

⚠️ **"Módulo de Preservação Avançada" viola a regra de vocabulário do próprio
AGENTS.md**: termo da casa é para explicar dentro da página, nunca para ser a
porta de entrada. Como nome de recurso na tabela de planos, ele não diz nada
para quem está decidindo.

---

## 4. Mapa competitivo verificado (10/09/2026)

Fontes: comparativo público de 14 bots (publicado 10/06, atualizado 01/08/2026)
e páginas oficiais de cada produto. Tudo com URL e data — regra de
`competitors-data.js`.

### 4.1 Paridade que TEMOS e não dizemos

**Relatório de venda e comissão não é diferencial nosso — é a mesa mínima.**
AfiliTools (R$99/mês) anuncia "relatório de vendas, relatório de cliques e
indicadores por grupo, canal e marketplace". Acelera Afiliado anuncia "relatório
Shopee, relatório AliExpress, status de vendas, origem dos links, melhores
horários, mais vendidos". Shozap idem.

Ou seja: **perdemos a comparação num recurso que temos construído e escondido.**
Isso não é oportunidade de roadmap, é oportunidade de página.

### 4.2 Paridade que NOS FALTA

| Falta | Quem já tem | Peso |
|---|---|---|
| **Telegram** | ProAfiliados, Pai das Ofertas, Shozap, DivulgaLinks, PromoBot, FluxoPromo, Afilira, Promium, Guru das Promoções, Divulgador Inteligente | **o mais comum de todos** |
| **Vitrine / site próprio / link na bio** | Pai das Ofertas, DivulgaLinks, Promium, Shozap, Afiliado Inteligente, Divulgador Inteligente | alto |
| **Camada gratuita permanente** | ProAfiliados, FluxoPromo (20 ofertas/dia), Afilira, Pai das Ofertas (Shopee), Guru | alto |
| **Instagram** | Shozap, DivulgaLinks, Afiliado Inteligente, Divulgador Inteligente | **em andamento** |
| **Mais lojas** | Afilira "18+", FluxoPromo (Kabum, Nike, Centauro), Gigi Prime e PromoBot (Kabum), DivulgaLinks (Natura) | médio |

### 4.3 Piso de preço do mercado

| Produto | Entrada recorrente | Grátis |
|---|---|---|
| Pai das Ofertas | **R$ 35,90** | 6 dias |
| FluxoPromo | R$ 37 | **permanente, 20 ofertas/dia** |
| Afilira | R$ 47 | **conta grátis** |
| Achadinho Pro | R$ 49,97 | 7 dias |
| ProAfiliados | R$ 50 | **permanente, com marca no envio** |
| Shozap | R$ 50 | 5 dias |
| DivulgaLinks | R$ 69,90 | 7 dias |
| AfiliTools | R$ 99 | — |
| Promium | R$ 97,90 | não informa |
| **Nós** | **R$ 39** | 7 dias |

Nosso preço está bem posicionado. O que destoa é não ter porta de entrada
gratuita.

### 4.4 O único candidato a buraco real

**Ninguém anuncia marca d'água na foto da oferta.** Busca ampla não encontrou
um concorrente sequer oferecendo isso.

E há uma dor conhecida que casa com ele: neste mercado **todo mundo espelha o
grupo de todo mundo** — é literalmente o que o nosso produto faz e o que os
concorrentes chamam de "espelhador". Quem monta grupo bom é copiado no dia
seguinte, com a foto e tudo. Marca d'água é a resposta direta a isso, e nós já
a temos.

⚠️ **Isso ainda é hipótese.** Ausência de anúncio prova só que ninguém vende
assim, não que a cliente pague por isso. É o que a pesquisa da §6 vai testar.

---

## 5. Roadmap

### Em andamento — não mexer
| # | Item |
|---|---|
| 0 | SHEIN e AliExpress |

### 1º — Dizer o que o produto já faz (fura a fila)

**Custo:** zero engenharia de produto. É página, texto e imagem.

O que entra, em ordem de impacto:

1. **Página de vendas e comissão.** É a resposta pronta ao "como sei o que
   vendeu", que três concorrentes anunciam e nós escondemos.
2. **Corrigir a lista de lojas** em toda superfície: são **seis** (ML, Amazon,
   Shopee, Magalu, SHEIN, AliExpress), não quatro. Isso está errado hoje na
   tabela de planos, na home e no `pricing.md`.
3. **Trocar "Módulo de Preservação Avançada"** pelo que ele faz, em português
   de cliente: intervalo entre envios, teto por hora e por dia, horário de
   descanso, variação automática do texto.
4. **Marca d'água e card clicável** ganham nome e imagem — os dois só existem
   como decisão interna hoje.
5. **Template próprio vira argumento anti-"conteúdo repetido"**, com exemplo
   lado a lado: a oferta como chegou × a oferta reescrita com a marca dela.
   Essa é a resposta literal à objeção da Perplexity.
6. **`pricing.md` atualizado** — é o arquivo que as IAs leem, e o ChatGPT já
   traz **35% dos cadastros com 13% das visitas**. Corrigir uma linha ali vale
   mais que uma página nova.

**Como medir:** as páginas comerciais convertem **15,4% de visita em cadastro**
e as de comparação **0,0%**. Toda peça desta frente nasce no padrão comercial,
nunca no de comparação.

### 2º — Ligar a medição de loja não suportada (roda em paralelo)

Hoje `detectLinks` (`src/detector.js`) conhece **seis lojas** e
`removeNonOfferUrls` (`src/messageProcessor.js`) **apaga** qualquer URL que não
seja de uma delas. Dois efeitos:

- **não conseguimos contar** qual loja as afiliadas de verdade publicam;
- **a oferta sai sem o link** quando a mensagem espelhada só trazia link de
  loja não suportada. Não vira erro, não vira linha, não aparece.

Espelhamos grupos de ofertas: o nosso banco pode conter o censo ao vivo de quais
lojas o mercado publica. É dado melhor que Trends para "qual loja depois", e é
nosso.

**Guarda de privacidade, do jeito que você pediu — guardar o mínimo e apagar
logo:**

| Guarda | Regra |
|---|---|
| O que é gravado | **só o domínio** (`temu.com`), o dia e uma contagem |
| O que **nunca** é gravado | URL completa, caminho, parâmetros, texto da mensagem, nome do grupo |
| Escrita | agregada em memória no worker e descarregada de tempos em tempos — **nunca uma escrita por mensagem** |
| Retenção | **30 dias**, com poda automática na mesma passada que já existe |
| Custo | tabela minúscula, **nenhum processo PM2 novo, zero impacto de RAM** |

⚠️ Em modo `remote` o deploy da API **não** recarrega os bot-workers — isto só
passa a contar depois de `pm2 restart bot-supervisor`, o que reconecta todas as
sessões. Anunciar antes.

**Prazo até virar decisão:** 2 a 4 semanas de coleta passiva. Nenhuma
entrevista, nenhuma mídia paga.

### 3º — Instagram Stories (como já decidido)

Mantido. Só ajuste de expectativa: **é paridade, não vantagem** — quatro
concorrentes já entregam, e a DivulgaLinks cobra R$ 69,90 a R$ 169,90 numa
proposta centrada em Instagram, acima do nosso Pro. Serve para não perder
comparação e para justificar preço, não para ganhar cliente de concorrente
sozinho.

### 4º — Telegram

O recurso ausente mais comum entre os concorrentes mapeados (10 de 14). Entra
depois de Stories, pelo motivo da §2.

### Em observação, com o gatilho que os tira daqui

| Item | Sai da observação quando |
|---|---|
| Camada gratuita permanente | decidido junto com a política de preço — o teto de robôs não é mais o impeditivo |
| Vitrine / link na bio | a pesquisa da §6 mostrar demanda; 6 concorrentes têm |
| Kabum, Temu, Natura, Nike | a medição do item 2 apontar volume real |
| Marca d'água como frente de aquisição | os testes de §6.3 e §6.4 confirmarem a dor |

---

## 6. A pesquisa — pronta para colar

Regra de corte, válida para tudo aqui: **se o resultado não muda a ordem da §5,
não coleta.**

E a regra de leitura que continua valendo do plano anterior, porque está certa:
**Planejador e Trends são UMA família de evidência, não duas provas
independentes.** Volume alto não é dor; ausência de busca não é ausência de dor
(marca d'água é exatamente esse caso).

### 6.1 Google Ads — Planejador de Palavras-Chave

Configuração: **Brasil · Português · Google, sem parceiros · últimos 12 meses**,
com detalhamento mensal. Se a conta mostrar faixa (`1 mil–10 mil`), **manter a
faixa** — não inventar número.

O estudo de 30/07 já tem 8.923 termos e cobre "afiliado \<loja\>". Conferi: ele
**não tem uma linha** sobre Telegram, Instagram, Stories, vitrine, comissão,
Kabum, Temu, Natura, SHEIN ou AliExpress. São esses quatro lotes, e só eles.

**Lote A — canal (decide Telegram × Stories com número)**
```
bot telegram afiliados
canal de ofertas telegram
grupo de ofertas telegram
criar canal de ofertas
divulgar ofertas no instagram
stories de ofertas
como divulgar link de afiliado no instagram
postar oferta automatica instagram
```

**Lote B — resultado e comissão (valida a página do item 1)**
```
como saber quanto vendi como afiliado
relatorio de vendas shopee afiliado
comissao shopee afiliado como ver
rastrear link de afiliado
saber qual link vendeu
painel de vendas afiliado
quanto ganha afiliado shopee
```

**Lote C — cópia e proteção (testa a hipótese da marca d'água)**
```
copiaram meu grupo de ofertas
proteger grupo de ofertas whatsapp
colocar marca no post de oferta
personalizar mensagem de oferta
como se diferenciar como afiliado
meu grupo esta igual aos outros
```

**Lote D — lojas fora do nosso catálogo**
```
afiliado temu
afiliado kabum
afiliado natura
divulgar ofertas kabum
programa de afiliados temu brasil
```

Colunas a acrescentar sem apagar as originais: `cluster` (canal / resultado /
proteção / loja), `intencao` (aprender · comparar · contratar), `marca` (sim ·
não), `feature_candidata` e `observacao_ambiguidade`.

**Leitura:** o que decide é o **cluster**, nunca um termo isolado. E separar
loja de ferramenta: quem busca `afiliado temu` quer entrar no programa, não
comprar robô.

### 6.2 Google Trends

**Brasil · Pesquisa na Web.** Rodar em **5 anos** (direção) e repetir em
**12 meses** (momento). Manter `ofertas whatsapp` como **âncora repetida** em
toda rodada — sem âncora comum, as rodadas não se comparam entre si.

| Rodada | Termos | O que decide |
|---|---|---|
| Canal | `ofertas whatsapp` · `ofertas telegram` · `ofertas instagram` | Telegram está crescendo ou é herança? |
| Formato | `canal de ofertas` · `grupo de ofertas` · `stories de oferta` | vale investir em canal? |
| Resultado | `ofertas whatsapp` · `comissao afiliado` · `rastrear link afiliado` | o público mede o que ganha? |
| Loja nova | `afiliado shopee` (âncora) · `afiliado temu` · `afiliado kabum` · `afiliado natura` | qual loja tem massa de verdade |

Anotar picos de Black Friday, 9.9 e 11.11 — **sazonalidade não é crescimento.**
Preferir "Tópico" quando o Trends oferecer um inequívoco, e registrar se foi
tópico ou termo.

### 6.3 As IAs — perguntar como CLIENTE, não como marca

Esta é a frente com maior retorno e a que está sendo subaproveitada. O ChatGPT
traz **35% dos cadastros com 13% das visitas** (índice 2,69×), e as rodadas de
`ai_visibility_tracking.csv` até aqui mediram **a marca**. O que falta medir é a
**decisão de compra**.

Rodar cada pergunta em **ChatGPT, Gemini, Perplexity e Google AI Overviews**, e
registrar três coisas: fomos citados, **quem** foi citado, e — o mais valioso —
**qual critério a IA usou para recomendar**. Esse critério é o que precisa estar
escrito na página.

**Bloco 1 — escolha de ferramenta**
```
Qual a melhor ferramenta para divulgar ofertas de afiliado no WhatsApp em 2026?
Quero automatizar meu grupo de ofertas. O que devo levar em conta para escolher?
Qual bot de afiliados mostra quanto eu vendi e qual oferta deu comissão?
Existe ferramenta de afiliado que funciona com SHEIN e AliExpress?
```

**Bloco 2 — a dor, sem nome de produto**
```
Copiaram meu grupo de ofertas inteiro. Como me proteger?
Como fazer minhas ofertas ficarem diferentes das do concorrente?
Meu WhatsApp foi banido divulgando ofertas. O que fazer para não acontecer de novo?
Como saber qual oferta do meu grupo realmente vendeu?
Vale mais a pena divulgar ofertas no WhatsApp, Telegram ou Instagram?
```

**Bloco 3 — objeção direta (é a que já nos derrubou uma vez)**
```
Ferramenta que só espelha grupo de terceiro vale a pena para afiliado?
Qual ferramenta de afiliado tem garimpo próprio de ofertas?
```

**Como ler:** concorrente citado que não conhecemos vira linha nova para
verificar. Critério repetido em três das quatro IAs vira seção de página. E
lembre do que a medição de 01/09 já mostrou: **as listas das IAs quase não se
sobrepõem** — não existe "o ranking do mercado", existe o de cada IA.

### 6.4 Concorrentes — verificar 5, não 27

Regra de `competitors-data.js`: sem URL e data, não entra, e preço sem prova
não vai para página pública.

Confirmados como reais hoje e **sem ficha**: **Afilira** (R$47, conta grátis,
"18+ plataformas", WhatsApp+Telegram), **Pai das Ofertas** (R$35,90, 6 dias
grátis, vitrine própria), **AfiliTools/trocalink** (R$99, relatório de vendas e
de cliques), **Acelera Afiliado** (relatórios Shopee e AliExpress),
**Zap Multigrupos** e **Ofertiva**.

Duas correções ao que veio da lista anterior: **Notifish não retorna resultado
de produto** em busca aberta, e **Growify aparece como site de guias**
(`growify.pro/guias/…`), ou seja, concorrente de conteúdo, não de software. Os
14 nomes daquela lista vieram da coluna `competitors_cited` de
`ai_visibility_tracking.csv` — são citados por IA, não verificados.

Nos que abrirem trial, executar a MESMA tarefa e cronometrar: cadastrar loja,
converter um link de cupom, publicar em dois destinos, achar o erro quando não
sair, e ver o relatório de comissão. É o que separa promessa de página de
entrega real.

---

## 7. O que derruba este plano

- **Se a divulgação do item 1 não mover cadastro em 30 dias**, a hipótese "o
  produto está escondido" cai e o problema volta a ser de produto.
- **Se a medição do item 2 mostrar quase nada** de loja não suportada, a frente
  de lojas morre e Telegram sobe.
- **Se o Lote C e o Bloco 2 não acharem a dor de cópia**, marca d'água fica como
  detalhe de recurso e não vira frente de aquisição.
- **Se o Trends mostrar Telegram em queda estrutural**, ele desce na fila
  mesmo sendo o recurso mais comum entre concorrentes — recurso comum pode ser
  herança de mercado, não demanda atual.
- Preço e recurso de concorrente saem de **página pública deles**, que pode
  anunciar mais do que entrega. Nenhum foi testado em trial ainda.
