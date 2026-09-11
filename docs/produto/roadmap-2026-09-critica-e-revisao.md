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

**A medição de 10/09 confirmou isso com número.** A demanda de busca por
ferramenta de Telegram é de **50 por mês** (`bot telegram afiliados`), contra
**~8.950 por mês** de gente querendo ENTRAR num grupo de ofertas do Telegram.
E `ofertas telegram` ficou em zero em **90% das 262 semanas** medidas. Telegram
é paridade competitiva, não demanda.

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

**A pesquisa de 10/09 testou, e o resultado foi melhor do que a hipótese.**
Os seis termos de busca deram zero — ninguém procura isso no Google. Mas o
ChatGPT, perguntado "copiaram meu grupo de ofertas inteiro, como me proteger?",
responde com uma lista cujo item 4 é literalmente **"Crie uma 'marca d'água'
nas ofertas"** — e **não cita produto nenhum na resposta inteira**.

Consulta sem concorrência de citação, funcionalidade pronta, nenhum concorrente
anunciando. Vira **conteúdo**, não engenharia — item 5º da §5.

---

## 5. Roadmap

### Em andamento — não mexer
| # | Item |
|---|---|
| 0 | SHEIN e AliExpress |

### 1º — Dizer o que o produto já faz (fura a fila)

**Custo:** zero engenharia de produto. É página, texto e imagem.

⚠️ **A medição de 10/09 corrigiu o ALVO desta frente: é o canal de IA, não o
SEO.** Nenhum termo de "medir minha venda" tem volume de busca —
`relatorio de vendas shopee afiliado`, `saber qual link vendeu`,
`painel de vendas afiliado` e `como saber quanto vendi como afiliado` voltaram
todos **sem dados**, e `rastrear link afiliado` deu **zero em 262 de 262
semanas** do Trends. **Não fazer landing page de busca para isso.**

O que existe é pior e mais caro: perguntado qual bot mostra quanto se vendeu, o
ChatGPT põe um concorrente em primeiro e diz sobre nós que *"não parece ser o
melhor instrumento… o próprio site fala em logs de envio e rastreamento
operacional"*. **Ele leu o nosso site e concluiu, corretamente pelo que está
escrito, que não temos o que temos.**

O que entra, em ordem de impacto:

1. **Página de vendas e comissão — escrita para a IA ler.** É a resposta pronta
   ao "como sei o que vendeu", que três concorrentes anunciam e nós
   escondemos.
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

**A medição de 10/09 endureceu esse ajuste.** `stories de oferta` deu **zero em
262 de 262 semanas** de Trends — cinco anos sem uma única busca.
`divulgar ofertas no instagram` e `postar oferta automatica instagram` vieram
**sem dados** no Planejador. As 13 variantes de "divulgar link de afiliado no
Instagram" somam ~450/mês, e quatro delas são de infoproduto (Hotmart, Eduzz),
que não é o nosso mercado.

**A leitura correta:** Stories não é funcionalidade que alguém procura. É um
canal de captação que entregamos **para a cliente usar** — o ChatGPT desenha
exatamente o fluxo `Instagram → WhatsApp → Venda`. A mensagem de lançamento é
"traga gente nova para o seu grupo", nunca "novidade que faz escolher a gente".

### 4º — Telegram

O recurso ausente mais comum entre os concorrentes mapeados (10 de 14). Entra
depois de Stories, pelo motivo da §2 — agora com número: **50 buscas/mês pela
ferramenta contra ~8.950 de gente querendo entrar num grupo**, e `ofertas
telegram` em zero em 90% das 262 semanas.

Se um dia for feito, o mapa por estado diz onde ele pega: **Paraíba 20%,
Maranhão 18%, Alagoas 17%, Sergipe 16%** — Norte e Nordeste. No Sul e Sudeste
o WhatsApp domina (Paraná 78%, São Paulo 75%).

### 5º — Marca d'água como CONTEÚDO (novo, saiu da medição)

**Custo:** conteúdo. A funcionalidade já existe.

Perguntado "copiaram meu grupo de ofertas inteiro, como me proteger?", o
ChatGPT responde com uma lista cujo item 4 é **"Crie uma 'marca d'água' nas
ofertas"** — e não cita produto nenhum na resposta inteira. Junto, recomenda
personalizar a mensagem para identificar a origem, que é o nosso template.

Consulta sem concorrência de citação + funcionalidade pronta + nenhum
concorrente anunciando. É o alvo mais barato do levantamento.

⚠️ **Sem busca no Google** (os seis termos deram zero). Isso é peça para o canal
de IA e para a página de comparação, não para SEO.

### 6º — "Quanto ganha afiliado Shopee" (novo, saiu da medição)

Sete variantes somam **~3.050 buscas/mês com concorrência baixa** (índice 16 a
25), e não temos página nenhuma nisso. É a mesma lógica do Tier 1 do AGENTS.md:
capturar quem procura o **negócio** antes de precisar do robô.

Confirmado pelas consultas em ascensão de `comissao afiliado`: **shopee
+1.650%, comissao shopee +1.150%, afiliado mercado livre +550%**.

⚠️ Vale a regra de página nova do AGENTS.md: **nasce linkada de pelo menos três
páginas já indexadas**, e `/conteudos` não conta.

### Em observação, com o gatilho que os tira daqui

| Item | Sai da observação quando |
|---|---|
| Camada gratuita permanente | decidido junto com a política de preço — o teto de robôs não é mais o impeditivo |
| Vitrine / link na bio | 6 concorrentes têm; sem demanda medida ainda |
| **Temu** | a medição do 2º mostrar link de Temu chegando. **Planejador diz 50.000/mês; Trends diz 1,8 e plano** — os dois não podem estar certos |
| **TikTok Shop** | **+650%** nas consultas em ascensão de `afiliado shopee`; confirmar na próxima medição |
| ~~Natura, Kabum~~ | **descartados por dado.** Natura é modelo de revenda com concorrência média; Kabum tem 500/mês e zero no Trends |
| Fichar os 12 concorrentes citados pelo ChatGPT | quando houver dia para trial. **Comission e Ofertiva primeiro** |

---

## 6. A pesquisa foi executada em 10/09 — resultados

Os quatro lotes do Planejador, as quatro rodadas do Trends, as consultas
relacionadas e onze respostas do ChatGPT foram coletados e lidos.

**Resultado completo: `docs/produto/pesquisa-mercado-2026-09-10.md`.**

O que ela mudou neste roadmap, em resumo:

| Achado | Efeito |
|---|---|
| `stories de oferta` deu **zero em 262 de 262 semanas** (5 anos) | Stories continua no 3º lugar, com expectativa corrigida |
| Telegram: **179 buscas de "quero entrar num grupo" para cada 1 de "quero a ferramenta"** | confirma o 4º lugar |
| **Nenhum** termo de "medir minha venda" tem volume — e o ChatGPT diz que não fazemos relatório de comissão | o item 1º muda de alvo: canal de IA, não SEO |
| Os seis termos de cópia/proteção deram zero, **mas o ChatGPT recomenda "marca d'água" pelo nome** e não cita produto nenhum | entra como item 5º, de conteúdo |
| `quanto ganha afiliado shopee` soma **~3.050/mês com concorrência baixa** | entra como item 6º |
| `afiliado temu` = 50.000/mês no Planejador **contra 1,8 e plano no Trends** | não vira roadmap; a instrumentação do 2º resolve |
| Natura (concorrência média, modelo de revenda) e Kabum (500/mês) | descartados por dado |
| **TikTok Shop +650%** nas consultas em ascensão de `afiliado shopee` | observação para a próxima medição |


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
