# Issues priorizadas — saída do estudo de mercado de 10/09/2026

Base: `docs/produto/pesquisa-mercado-2026-09-10.md` (Trends + Planejador +
11 consultas ao ChatGPT em duas contas) e `docs/produto/roadmap-2026-09-critica-e-revisao.md`.

Ordem = por dinheiro que custa hoje ÷ esforço, não por tamanho da feature.
Cada issue traz a evidência que a sustenta. Onde não há evidência, está escrito
que não há.

---

## Correção de método aplicada antes de escrever esta lista

`getIndexableSeoRoutes()` devolve **objetos de rota, não strings**. O comando
sugerido no AGENTS.md (`console.log(getIndexableSeoRoutes().join('\n'))`)
imprime `[object Object]` e faz qualquer busca por slug dar zero — foi assim
que uma checagem minha concluiu que as cinco páginas de loja não existiam.
Elas existem, indexáveis, desde 02/09, exatamente como o AGENTS.md afirma.

Comando correto:

```bash
node --input-type=module -e "
import { getIndexableSeoRoutes } from './dashboard/lib/seo-registry.mjs';
console.log(getIndexableSeoRoutes().map(r => r.path).join('\n'));
"
```

Estado medido do registry (90 rotas indexáveis):

| Tema | Rota existe? |
|---|---|
| Shopee, Mercado Livre, Amazon, SHEIN, Magalu (comercial) | sim, as cinco |
| **AliExpress (comercial)** | **não** |
| comissão / quanto ganha / vendas | **nenhuma** |
| cópia de grupo / marca d'água / proteger oferta | **nenhuma** |
| Telegram | nenhuma |
| Instagram / Stories | nenhuma |

---

## P0 — o produto entrega e o mercado não sabe

As três primeiras issues são a mesma ferida em três superfícies. A medição que
as justifica é direta: perguntado qual robô mostra o que você vendeu, o ChatGPT
coloca um concorrente à frente e diz de nós, textualmente, *"não parece ser o
melhor instrumento para responder 'qual oferta me deu R$ X de comissão?'. O
próprio site fala em logs de envio e rastreamento operacional."* Ele está
lendo o nosso site e o nosso site está errado. Em SHEIN e AliExpress não somos
citados em nenhuma das duas contas.

### P0-1 · `pricing.md` está desatualizado e é o arquivo que as IAs leem

**Problema.** `dashboard/public/pricing.md` linha 33 diz
`Affiliate link conversion: Mercado Livre, Amazon, Shopee and Magalu`. São
**seis** lojas: SHEIN e AliExpress entraram. O arquivo também não menciona em
lugar nenhum o painel de vendas e comissão, a marca d'água, o card clicável nem
o rastreio de cliques — e as duas únicas ocorrências de "commission" no arquivo
são **ressalvas** ("No revenue, commission, sales... guarantee"). Uma IA que lê
só este arquivo conclui, corretamente, que não medimos comissão.

**O que fazer.** Atualizar a lista de lojas para seis e acrescentar, em
linguagem factual e sem promessa de ganho:
- painel de vendas e comissão (pedidos, produtos, comissão estimada e
  confirmada, cobertura de cliques) — a rota já existe em
  `src/api/routes/shopeeSales.js` e a tela em `dashboard/app/painel/vendas/`;
- garimpo automático de ofertas da Shopee por palavra-chave e filtro;
- templates próprios de mensagem (a oferta é reescrita, não copiada);
- marca d'água na foto da oferta;
- card de oferta clicável;
- filas de envio com intervalo definido por destino;
- link curto próprio com rastreio de clique.

**Não regredir.** As ressalvas das linhas 24 e 61 continuam como estão — dizer
que medimos comissão não é prometer comissão, e a política de uso responsável
não muda. Nenhum preço de concorrente entra aqui.

**Custo de memória.** Zero, é arquivo estático.

**Guarda.** Teste que falha se a contagem de lojas em `pricing.md` divergir das
chaves de `PATTERNS` em `src/detector.js` — hoje as duas listas envelhecem
separadas, que é a causa do defeito.

---

### P0-2 · Tabela de planos e home dizem quatro lojas e nomeiam o produto por jargão

**Problema.** `dashboard/lib/marketing-content.js` repete o erro em dois
pontos: linha 135 (`'Conversão de links: Mercado Livre, Amazon, Shopee e
Magalu'`) e linha 169 (FAQ, mesma lista). Além disso a expressão
**"Módulo de Preservação Avançada"** aparece 40 vezes em superfície pública —
é nome de casa, não diz o que faz, e nenhuma IA vai traduzir isso sozinha.

**O que fazer.**
1. Seis lojas nos dois pontos.
2. Substituir, nas superfícies de venda, o nome do módulo pelo que ele faz
   ("intervalo entre envios, limite por dia e horário de funcionamento por
   grupo, para o WhatsApp não tratar o envio como disparo em massa"). O nome
   pode continuar existindo **dentro** do produto; a porta de entrada é a dor.
3. Nomear na tabela de planos o que hoje não aparece: marca d'água, card
   clicável, templates próprios, painel de vendas.

**Não regredir.** A linha 89 (`'Não prometemos ganho financeiro, comissão ou
aumento garantido de vendas.'`) fica. Linguagem leiga em toda a superfície.

**Custo de memória.** Zero.

**Guarda.** `test/marketing-*`: falha se a lista de lojas da tabela de planos
divergir de `src/detector.js`.

---

### P0-3 · Página de vendas e comissão — escrita para o canal de IA, não para busca

**Problema.** É a pergunta em que perdemos de forma medida, e não temos página
nenhuma sobre o assunto (zero rotas com comissão/ganho/venda no registry).

⚠️ **Esta issue NÃO é uma landing de SEO.** O dado é explícito: todos os termos
do Lote B ("medir minhas vendas", "rastrear link afiliado") voltaram
**sem dados** no Planejador, e `rastrear link afiliado` ficou em **zero em 262
de 262 semanas** no Trends. Não existe busca. O que existe é IA respondendo a
pergunta e citando concorrente. O alvo é o canal de IA e a comparação, não o
Google.

**O que fazer.** Uma página que responda literalmente "como saber quanto eu
ganhei de comissão", mostrando o que o painel entrega hoje: pedidos atribuídos,
quantidade de itens, valor da venda, comissão estimada e confirmada, cobertura
de cliques, quebra por pedido e por produto.

**Não regredir.**
- Regra das páginas órfãs (RCA 2026-09-11): nasce com link de **no mínimo três**
  páginas já indexadas e com impressão; `/conteudos` e o sitemap não contam.
  Guarda em `test/marketing-paginas-orfas.test.js`.
- Nenhum número de comissão de exemplo pode ser apresentado como resultado
  típico.
- A entidade precisa aparecer inteira ("BOTinho é o robô do Espelha Grupos") —
  o ChatGPT ainda trata os dois nomes como produtos concorrentes.

**Custo de memória.** Zero, é página estática.

---

## P1 — instrumentação que desbloqueia decisão

### P1-4 · Registrar loja não suportada (e consertar o link sumindo em silêncio)

**Problema, em duas camadas.**

*Camada 1, defeito real.* `removeNonOfferUrls`
(`src/messageProcessor.js:89`) apaga toda URL que não case com as seis lojas de
`src/detector.js`. Uma oferta cujo único link é Temu, Kabum ou Natura é
**publicada com o link removido** — não vira `skip:no_valid_conversions`, não
gera linha de erro, não aparece no painel. A cliente vê uma oferta sem link e
não tem como saber por quê.

*Camada 2, cegueira.* Existe um marcador parcial em
`src/bot-worker.js:3465` (`unsupportedStoreSuffix`), mas ele só dispara no ramo
em que a **política** do grupo já bloqueou a mensagem, e **não guarda qual
domínio era**. Então hoje não há como responder "que loja minhas clientes estão
tentando usar e nós não suportamos".

*Por que isso decide dinheiro.* O Planejador e o Trends se contradizem em Temu:
`afiliado temu` aparece com 50.000/mês e +900% em 3 meses, enquanto
`programa de afiliados temu brasil` marca 500/mês e −90%, e o Trends mostra
índice 1,8 estável. Os dois saltos são artefato de balde (o Planejador arredonda
para 50/500/5.000/50.000 e um degrau vira ±900%). **Nenhum dos dois números
decide.** O que decide é quantas ofertas de Temu as nossas clientes já estão
tentando espelhar — dado que só a instrumentação produz.

**O que fazer.**
1. No caminho do strip, registrar que houve link de loja não suportada.
2. Guardar **apenas o domínio registrável** (`temu.com`), o **dia** e a
   **contagem**. Nunca a URL, o caminho, a query nem o texto da mensagem.
3. Poda automática em 30 dias.
4. Sinal durável agregado, na allowlist de `src/analytics.js` — nunca um evento
   por mensagem.
5. Sem processo PM2 novo: usar o caminho de sinal operacional que já existe.

**Instrução da dona do produto, ao pé da letra:** *"instrumente sem guardar
informações irrelevantes, apague logo em seguida o que não precisar."* Domínio
+ dia + contagem é o mínimo que responde a pergunta; qualquer coisa além disso
sai.

**Não regredir.** Nenhuma URL, caminho, query ou texto de mensagem pode ser
persistido — é a mesma regra que já vale para `referral_visit`, onde só o host
é gravado. Guarda no teste.

**Custo de memória.** Desprezível: um contador agregado por domínio por dia,
podado em 30 dias. Nenhum processo novo.

⚠️ **Deploy.** Mexe em `src/messageProcessor.js` e `src/bot-worker.js`. Em modo
`remote` o deploy da API **não** recarrega os bot-workers: só passa a valer
depois de `pm2 restart bot-supervisor`, que **reconecta todas as sessões de uma
vez** — anunciar antes. Os caminhos já estão em `WORKER_CODE_PATHS_RE`, então o
deploy reinicia sozinho.

---

## P2 — conteúdo onde a IA já recomenda e não cita ninguém

### P2-5 · "Copiaram meu grupo" — marca d'água e template próprio

**Problema.** Perguntado como proteger a oferta de ser copiada, o ChatGPT
recomenda **marca d'água e reescrita do texto** — exatamente o que o produto
faz — e **não cita produto nenhum**. É recomendação órfã: a resposta está
pronta e a vaga está vazia.

⚠️ **Também não é SEO.** Os seis termos do Lote C (cópia, proteção, marca
d'água) voltaram **sem dados** no Planejador. Zero busca. O alvo é o canal de IA
e a comparação.

**O que fazer.** Conteúdo que trate a dor pelo nome que a cliente usa
("copiaram meu grupo", "colam minha oferta") e mostre as duas defesas que já
existem: marca d'água na foto e template próprio que reescreve a mensagem em
vez de copiá-la.

**Não regredir.** Regra das páginas órfãs (≥3 links de páginas indexadas).
Nenhuma promessa de que a cópia se torna impossível.

**Custo de memória.** Zero.

---

### P2-6 · "Quanto ganha afiliado Shopee" — o único buraco de SEO com volume medido

**Problema.** A família `quanto ganha afiliado shopee` soma **~3.050 buscas/mês
com concorrência baixa (16–25)** e não temos página. É o único item desta lista
sustentado por volume de busca real.

Sinal de apoio: `/blog/como-ser-afiliado-shopee-whatsapp` já pega 433
impressões na periferia do tema, e `afiliado shopee` está estável em 71 no
Trends de 12 meses — mercado grande e sem queda.

**O que fazer.** Página que responda a pergunta com faixa de comissão por
categoria e o que muda o resultado, levando ao produto por consequência, não
por interrupção.

**Não regredir.**
- Regra das páginas órfãs: ≥3 links de páginas indexadas com impressão, e pedir
  reindexação **das páginas editadas**, não só da nova.
- Nenhum ganho pode ser apresentado como promessa nossa. A política já
  publicada diz que não prometemos comissão — a página cita faixas de mercado,
  com fonte, e não resultado esperado.

**Custo de memória.** Zero.

---

## P3 — features já decididas, com a expectativa corrigida

### P3-7 · Instagram Stories

Já decidido e mantido. **A expectativa é que muda.** `stories de oferta` ficou
em **zero em 262 de 262 semanas** no Trends — cinco anos sem uma única semana
com busca. Não é canal de aquisição para nós; é canal de publicação **para a
cliente**, que já usa Instagram. Vender Stories como porta de entrada de tráfego
seria vender uma expectativa que o dado nega.

Sinal de apoio para a cliente, não para nós: `ofertas instagram` está em 14,1
contra 53,2 de `ofertas whatsapp` — Instagram existe, é quatro vezes menor que
o WhatsApp e não está crescendo.

---

### P3-8 · Telegram como destino

**Telegram não fura a fila do Stories.** O argumento que eu mesmo usei antes
para promovê-lo (não consumir vaga de robô, com teto de 20) **morreu** quando a
dona do produto informou que o teto de produção é 40 e expansível.

O que sobra a favor: **10 dos 14 concorrentes têm Telegram**, então é paridade
cobrada em comparação. O que sobra contra: a intenção de busca é quase toda de
quem quer **entrar** num grupo, não automatizar um — ~8.950/mês de intenção de
entrada contra **50/mês** de `bot telegram afiliados`, razão de **179:1**. E
`ofertas telegram` passou **90% das semanas em zero**.

Mapa regional, se a decisão for feita: Telegram é mais forte em Paraíba (20%),
Maranhão (18%) e Alagoas (17%); WhatsApp domina em Paraná (78%) e São Paulo
(75%).

---

## P4 — higiene e próxima medição

### P4-9 · Fichar Comission e Ofertiva em `competitors-data.js`

**Problema.** O arquivo tem 17 fichas e **nenhum** dos 12 concorrentes que o
ChatGPT citou nesta rodada. Os dois mais relevantes:
- **Ofertiva** — R$39,90, citado nas **duas** contas, e é quem ganha de nós em
  SHEIN e AliExpress;
- **Comission** — R$47,90 a R$97,90.

⚠️ **Nenhum preço de concorrente pode ir para página pública antes da ficha
existir com `verifiedAt`.** É a regra que já vale para os demais.

Os outros dez, sem ficha e sem preço citável: RealLead, OrbitSender, Ripply,
LucreZap, Garimpa Links, Achify, Zaffo, AffiliSend, AutoLinks, Afiliado
Analytics.

**Correção de premissa registrada.** Os 14 nomes levantados na abertura deste
trabalho (Pai das Ofertas, Growify, Sincro, Zap Multigrupos, Notifish, Afiliados
Pro Bot, Easyfy, Ofertiva, Afflink, Afiliei, Promogram, Gestor de Links,
Afilira) **não estavam** em `competitors-data.js` — vieram da coluna
`competitors_cited` de `docs/marketing/ai_visibility_tracking.csv`, que registra
quem as IAs citam, não quem nós fichamos. Duas verificações a mais: **Notifish**
não devolve resultado de produto e **Growify** aparece como site de conteúdo
(`growify.pro/guias/...`), não como robô.

---

### P4-10 · Medir TikTok Shop e repetir as consultas de IA

`tiktok shop` apareceu com **+650%** nas consultas em ascensão de
`afiliado shopee`, e `divulga links` com **+250%**. Crescimento percentual em
consulta em ascensão **não é volume** — é aceleração sobre base que pode ser
mínima. Não decide nada sozinho; entra como item a medir na próxima rodada, com
o Planejador, não como frente.

Repetir as 11 consultas ao ChatGPT no próximo ciclo, depois que P0-1 a P0-3
estiverem em produção. É a única forma de saber se atualizar o que o site diz
muda o que a IA responde — e essa é a hipótese central de todo o bloco P0.

---

## O que derruba esta lista

- **Se P0-1 a P0-3 subirem e o ChatGPT continuar citando concorrente** nas
  mesmas perguntas, a hipótese de que a IA lê o nosso site está errada e o
  problema é de autoridade, não de conteúdo. A próxima rodada de consultas é o
  teste.
- **Se a instrumentação de P1-4 mostrar volume desprezível de loja não
  suportada**, Temu sai de pauta com dado, e o defeito do link sumindo continua
  valendo por si só — ele é bug, independente de volume.
- **Se `quanto ganha afiliado shopee` não trouxer impressão em 60 dias**, a
  leitura de que concorrência baixa + 3.050/mês é oportunidade estava errada, e
  o aprendizado vale para toda a linha de conteúdo informacional.
