# ofertas-automaticas-e-criar-oferta — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Dedup das ofertas automáticas (cruzada entre automações, por grupo)

Os **envios automáticos** (`src/offerAutomation/dispatcher.js`) NÃO passam pela
dedup de link do `bot-worker.js` (essa só vale para mensagens encaminhadas de
grupos monitorados). Eles enviam via `sendBroadcast` (manager.js) e têm dedup
própria. Antes, a dedup era só `automation.sentItemIds` — **per-automação**.
Resultado: N automações apontando pro mesmo grupo reenviavam o MESMO produto
(uma vez por automação), porque uma não conhecia o que a outra mandou.

Hoje há uma camada **cruzada por grupo de destino**, na tabela
`OfferAutomationSentLog (userId, destGroupJid, productKey, priceCents, sentAt)`:

1. Antes de enviar, o dispatcher carrega o que já saiu pro grupo dentro de
   `OFFER_AUTOMATION_DEDUP_WINDOW_MS` (default **120min**) e filtra os
   produtos por `productKey` (de `productDedupKey`).
2. **Exceção por preço:** se o `priceCents` atual difere de todos os preços
   com que aquele produto saiu dentro da janela, a oferta **passa** — é uma
   oferta nova de fato (relâmpago da manhã a R$X vs. da tarde a R$Y). Isso
   concilia a janela com o pedido histórico de não prender oferta legítima
   que voltou mais barata.
3. Cada envio grava uma linha em `OfferAutomationSentLog`; registros fora da
   janela são podados a cada run (a tabela fica limitada à janela por grupo).
4. `dedupeOffersByProduct` continua colapsando o mesmo produto **dentro de um
   lote** (mantém o primeiro), então mesmo-produto/preços-diferentes no MESMO
   envio vira uma oferta só — a exceção por preço só atua entre execuções.

Teste: `test/offer-automation.test.js`.

## A cliente nunca pôde escolher a busca das ofertas automáticas (RCA 2026-09-17)

Cliente reportou que "eletrodoméstico Brastemp" só trazia **capa de máquina de
lavar**, "cafeteira dolce gusto" só **cápsula reutilizável e produto de
limpeza**, e "mesa desmontável pegue e monte" só **mesa cavalete** — e pediu uma
opção de buscar "os itens mais vendidos".

**A ordenação por mais vendidos já estava ligada.** O que limitava era o outro
eixo. A `productOfferV2` da Shopee tem dois parâmetros independentes: `listType`
(de qual lista tirar os candidatos) e `sortType` (em que ordem devolvê-los). O
backend sempre gravou os dois (`OfferAutomation.listType`/`sortType`), a rota
sempre os validou e a `search-preview` sempre os aceitou — **só a tela nunca os
ofereceu**. Toda automação nascia com o padrão da rota: `sortType=2` (mais
vendidos) **dentro de** `listType=1` (maior comissão).

⚠️ **A primeira explicação estava ERRADA e foi derrubada por medição
(2026-09-17).** Escrevemos aqui e na tela que "a lista de maior comissão deixa
o produto caro de fora". Rodado em produção com a chave real
(`scripts/diag-busca-shopee.mjs`), para "eletrodoméstico Brastemp", as **TRÊS
listas devolveram os MESMOS 50 produtos, na MESMA ordem**: `listType` não
filtrou nada. Não repetir essa causa.

**Quem separa o produto do acessório é a ORDEM.** Medido em
"maquina de lavar Brastemp", dentro da mesma lista:

| Ordem | O que veio nos 5 primeiros |
|---|---|
| mais vendidos (`sortType=2`, nosso padrão) | cinco capas de máquina |
| maior comissão (`sortType=5`) | cinco capas, todas a 43% de comissão |
| **mais caros (`sortType=3`)** | **as máquinas de verdade: R$ 3.999, R$ 3.759, R$ 3.599, R$ 3.477** |

A razão está nos números da mesma saída: o acessório vende muito mais **e**
paga muito mais comissão (capa 43%, cápsula 23%; a máquina 4-7%, a cafeteira
3%). Então vendas e comissão empurram o acessório para cima — só o preço traz o
aparelho. **A escala de `commissionRate` é fração** (`0.23` = 23%), medida
aqui; antes não estava verificada em lugar nenhum do repositório.

⚠️ Segundo achado da medição: **"eletrodoméstico Brastemp" não trouxe máquina de
lavar em NENHUMA das seis combinações** — só capa e chave de fenda —, enquanto
"maquina de lavar Brastemp" trouxe. Categoria genérica não acha o produto no
catálogo de afiliado; nem lista nem ordem resolvem isso. Ao atender "só vem
acessório", conferir TRÊS coisas: a palavra-chave (nome do produto, não
categoria), a ordem, e a comissão extra abaixo.

| Peça | Onde |
|---|---|
| Opções em linguagem leiga (PURO) | `dashboard/lib/offerAutomationSearch.js` |
| Os dois campos no formulário + linha no card | `dashboard/app/painel/ofertas-automaticas/page.js` |

**Não regredir:**

- **O padrão continua `listType=1` / `sortType=2`.** Mudar o default trocaria a
  busca de toda automação nova sem ninguém ter pedido, e qual conjunto rende
  mais só se decide medindo em staging. O conserto é a escolha ficar VISÍVEL,
  não o produto escolher por ela. Teste falha se o default mudar sem decisão.
- **A busca escolhida aparece no card SEMPRE, inclusive quando é o padrão**
  (`describeSearchChoice`). A queixa não foi "a opção está errada", foi "eu não
  sabia que existia uma opção" — esconder no padrão recria o mesmo ponto cego.
- **A dica que resolve a queixa mora na ORDEM, não na lista**, e por isso a
  ordem vem primeiro no formulário e a lista ficou recolhida em "avançado".
  Cada opção de ordem tem a sua dica: "mais caros primeiro" diz que traz o
  APARELHO em vez do acessório; "mais vendidos" e "maior comissão" dizem que
  trazem o acessório. Sem isso a cliente troca a palavra-chave para sempre sem
  nunca chegar no que estava filtrando — foi o que aconteceu por três buscas.
- **Os rótulos da lista NÃO podem voltar a prometer filtro** ("só maior
  comissão", "só os que mais vendem"): a medição mostrou que ele não acontece,
  e a promessa faz a cliente mexer no campo errado. O campo continua na tela
  porque a medição cobriu duas palavras-chave, não todas — tirá-lo seria
  decidir por ela sem dado que sustente. Teste falha se a promessa voltar.
- **A fila de revisão não força mais `sortType: 2`**
  (`reviewDiscoveryService.js`). Forçar fazia sentido enquanto a escolha não
  existia na tela; com ela, virou um jeito silencioso de descartar o que a
  cliente pediu.
- **O botão de LIGAR "Priorizar ofertas com comissão extra do vendedor" saiu da
  tela (2026-09-17), mas o campo NÃO foi desligado.** Ele não é um filtro a
  mais: `resolveOffers` faz DUAS buscas e devolve `[...comissãoExtra,
  ...restantes]`, e como `runAutomation` manda os primeiros `offersPerSend`,
  com 1 produto por envio a oferta de comissão extra sai SEMPRE, por cima da
  ordem escolhida — "mais baratos primeiro" chega a publicar o item de R$500 no
  lugar do de R$10 (medido em teste).
- **A regra é grandfathering, e ela é a invariante desta seção: automação que já
  existe não pode mudar de comportamento sozinha no deploy.** Os dois grupos:
  quem **nunca marcou** não muda nada (uma busca, na ordem escolhida); quem
  **já tinha marcado** continua enviando exatamente igual. Isso sai de graça das
  rotas — o `POST` grava `Boolean(prioritizeAMS ?? false)`, então automação nova
  nasce sem a opção, e o `PUT` só escreve o campo quando ele vem no corpo, então
  a tela deixar de enviá-lo PRESERVA o valor de quem tem.
- **O controle voltou à tela SÓ como saída**: renderizado apenas quando
  `form.prioritizeAMS` já é verdadeiro e o clique só escreve `false`. Não existe
  caminho para ligar — nem na tela nova, nem em automação nova. Teste falha se
  `prioritizeAMS: e.target.checked` voltar, se o campo entrar no `emptyForm`, ou
  se `openEdit` parar de carregar o valor salvo (sem ele a cliente ficaria presa
  na opção, sem conseguir desligar).
- **Enquanto o campo agir, o card DIZ** (`describeSearchChoice` + etiqueta
  "⚡ Comissão extra priorizada (opção antiga)"). É por ali que a cliente
  descobre que a opção existe e pode ser desligada; prometer "mais baratos"
  enquanto a comissão extra fura a fila seria mentir na etiqueta.
- ⚠️ **NÃO fazer migration convertendo quem tinha a opção para "maior comissão
  primeiro" (`sortType=5`).** Além de mudar o envio dessas contas sem ninguém
  pedir, jogaria justamente elas mais fundo na combinação que mais reproduz a
  queixa original (comissão em cima de comissão). Quem quiser trocar, desmarca e
  escolhe a ordem — decisão da cliente, não do deploy.
- ⚠️ **Prioridade de comissão extra + "só maior comissão" se somam** e empurram
  a busca para o acessório barato duas vezes — é a combinação que mais reproduz
  a queixa original. Ao atender um relato de "só vem acessório", conferir as
  DUAS coisas, nunca só a palavra-chave.
- Quantas contas ainda estão no legado (read-only, no diretório do ambiente):
  `sqlite3 prisma/prod.db "SELECT COUNT(*) FROM OfferAutomation WHERE prioritizeAMS = 1;"`
  Zerou? Aí sim o caminho das duas buscas pode ser removido de vez.
- **Valor inválido cai no padrão**, nunca derruba a tela: automação antiga com
  campo vazio precisa continuar abrindo para edição.
- Linguagem leiga: nada de `listType`, `sortType`, `productOfferV2` na tela —
  teste falha se jargão voltar.
- **Custo: zero.** Nenhuma consulta nova, nenhum processo novo, nenhuma
  migration (as colunas já existiam), **zero impacto de RAM**.

⚠️ **Ofertas automáticas são 100% Shopee.** Amazon, Mercado Livre, Magalu, SHEIN
e AliExpress só CONVERTEM link existente — não têm busca por palavra-chave em
lugar nenhum do repositório. Não prometer à cliente ordenação nas outras lojas.

⚠️ **Só a Shopee sabe o que cada lista devolve.** `POST
/api/offer-automations/search-preview` roda a MESMA busca sem enviar nada e sem
gravar — é por ali que se compara as combinações antes de decidir. Ele existe
desde sempre e **nenhuma tela o chama**; ligar esse botão no painel é o passo
seguinte natural desta mudança.

### A lista saiu da tela: uma escolha só (2026-09-17, depois da medição)

Cinco palavras-chave, cada uma nas três listas, com a chave real em produção:

| Palavra-chave | listType 0 / 1 / 2 |
|---|---|
| eletrodoméstico Brastemp | 45 / 45 / 45 — mesmos produtos, mesma ordem |
| maquina de lavar Brastemp | 47 / 47 / 47 — idem |
| fone de ouvido bluetooth | 49 / 49 / 49 — idem |
| air fryer | 43 / 43 / 43 — idem |
| perfume importado | 48 / 48 / 48 — idem |

`listType` **não filtrou nada em nenhuma delas**. Campo que não muda o
resultado não é escolha: ele fazia a cliente decidir à toa e desviava da ordem,
que é o que resolve. Então a tela ficou com **uma pergunta só** ("O que você
quer que apareça primeiro?") e a lista virou decisão do produto.

| Peça | Onde |
|---|---|
| Decisão da lista (PURA, chokepoint ÚNICO) | `src/offerAutomation/searchListType.js` |
| Consumo | `resolveOffers` (`dispatcher.js`) — cobre envio, fila de revisão e `search-preview` |

**Não regredir:**

- **O valor gravado em `OfferAutomation.listType` é IGNORADO no envio** — mesmo
  padrão de `Group.imageMode`: coluna dormente, rota continua aceitando (para
  não quebrar chamador antigo), sem migration. Teste falha se `automation.listType`
  voltar ao `dispatcher.js`.
- **O padrão passou de 1 para 0** porque **0 é o único valor que a Shopee
  documenta** ("todos"); o 1 não aparece na documentação dela em lugar nenhum e
  foi escolhido no olho quando `listType=2` se mostrou estreito demais. Com as
  duas provadas equivalentes em cinco palavras-chave, ficar no documentado é o
  que dá para defender. **Isso só é seguro por causa da medição** — não trocar
  de novo sem repetir o `scripts/diag-busca-shopee.mjs`.
- **`OFFER_SEARCH_LIST_TYPE` é o escape hatch**: `=1` volta ao histórico sem
  deploy (pegadinha #1 — `pm2 delete` + `start`). Valor inválido cai no padrão;
  `.env` mal preenchido nunca pode derrubar a busca de todo mundo.
- **Os rótulos são os nomes da documentação da Shopee, traduzidos, na ORDEM
  dela** (1 Relevância, 2 Mais vendidos, 3 Maior preço, 4 Menor preço, 5 Maior
  comissão) — decisão da dona do produto, 2026-09-17: não inventar opção nem
  renomear "Maior preço" para "o produto em si". O que a API faz é ordenar por
  preço; que isso traga o aparelho em vez do acessório é **efeito medido**, e
  efeito medido vai na DICA, nunca no rótulo. Teste falha se os rótulos ou a
  ordem divergirem da documentação.
- **O padrão continua "Mais vendidos"** — ninguém tem a busca trocada em
  silêncio.
- **O card diz só a ordem** (`Busca: mais vendidos`), e continua dizendo quando
  a comissão extra legada fura a fila.

Para medir de novo (read-only, com a chave real da conta, no diretório do
ambiente):

```bash
cd ~/wabot && node scripts/diag-busca-shopee.mjs <email> "eletrodoméstico Brastemp"
cd ~/wabot && node scripts/diag-busca-shopee.mjs <email> "cafeteira dolce gusto" --lista=1
```

Sem `--lista`, compara as TRÊS listas com a mesma ordem; com `--lista=N`,
compara as CINCO ordens dentro daquela lista. `--desconto=0` é o padrão de
propósito (mostra a lista crua, antes do filtro da automação). A comissão sai
**crua** — a escala é **fração** (`0.23` = 23%), confirmada pela medição de
2026-09-17; ela continua saindo crua de propósito, para a próxima rodada
conferir em vez de confiar nesta linha.

⚠️ **`productCatId` (filtro por categoria) existe na API e nunca foi usado** —
é o parâmetro com mais cara de resolver a queixa original ("só vem acessório"),
e não foi atacado. Os outros não usados: `shopId`, `itemId`, `matchId`.
`isKeySeller` existe no banco e nunca apareceu na tela (sempre `false`).

Testes: `test/ofertas-automaticas-escolha-da-busca.test.js`,
`test/diag-busca-shopee.test.js`.

## Oferta do "Criar oferta" saindo com `{preço}` cru (RCA 2026-09-19 — não regredir)

Cliente (`julianepumuceno16@gmail.com`) mandou dois prints de ofertas publicadas
no grupo pelo **Criar oferta** (não é espelhamento): uma com
`~De: ~ | 🛒 Por R$ 502,55` e outra com `~De: ~ | 🛒 Por {preço}` — o nome da
variável, cru, dentro da mensagem que foi para o grupo.

Três defeitos encadeados, todos nossos:

1. **`applyTemplateVariables` devolvia o PRÓPRIO token quando o valor faltava**
   (`price || '{preço}'`, `title || '{produto}'`). Isso faz sentido na prévia do
   editor de templates e nunca pode chegar ao WhatsApp.
2. **A limpeza de preço antigo vazio era escrita à mão para os DOIS templates de
   fábrica.** Template personalizado (o caso dela, com os dois preços na mesma
   linha separados por `|`) ficava com a decoração órfã `~De: ~ |`.
3. **O painel só avisava quando título E preço faltavam**
   (`if (!title && !newPrice)`). Com o título lido e o preço não — que é
   exatamente o caso dos dois prints — **nenhum aviso aparecia**, e a cliente
   enviava achando que estava tudo certo.

Hoje todo valor vazio vira uma marca invisível e a limpeza é **genérica**: o
trecho da linha (entre `|`) que só tinha aquele valor some inteiro; se a linha
era só isso, a linha some. Os preços entram marcados, então título de produto
com `|` no meio não é partido ao meio pela limpeza. O painel ganhou faixa fixa
acima da prévia quando o preço não foi lido.

**Não regredir:**

- **Nenhum valor vazio pode voltar a virar o próprio token.** Publicar o nome da
  variável no grupo é o pior desfecho possível — é a cliente aparecendo amadora
  para o público dela.
- **Não inventar texto no lugar do preço** ("consulte na loja", preço antigo
  como atual): preço errado publicado é pior que oferta sem preço. A linha some
  e o painel avisa.
- **A limpeza é genérica, não por template.** Regra nova escrita para a forma de
  um template específico volta a deixar template personalizado quebrado, que é a
  causa #2.
- **O aviso do painel separa "faltou o título" de "faltou o preço".** Juntar os
  dois num `&&` é literalmente a causa #3.
- A correção vale para as **três** superfícies que usam o mesmo compositor:
  Criar oferta, ofertas automáticas (`offerAutomation/dispatcher.js`) e o
  template de espelhamento (`core/mirrorTemplate.js`).

⚠️ **Por que o preço não foi lido continua sendo assunto à parte:** os dois
casos eram Amazon, que serve página de CAPTCHA para IP de datacenter em parte
dos requests (`isAmazonBlockedHtml` + retries em `productInfoScraper.js`).
Melhorar essa leitura é outra frente; nada disso justifica publicar `{preço}`.

Testes: `test/criar-oferta-sem-preco.test.js`,
`test/mobile-offer-composer.test.js`.

## Motor único de oferta (`src/converters/offerEngine.js`) — não duplicar lógica

O **Painel "Criar oferta"** (`/m/op/offer` → `POST
/api/link-conversion/scrape-offer`) monta uma oferta (título + preço + link) a
partir de um link colado. A busca de título/preço (converter → resolver URL →
scrapar com credenciais → fallback) vive em **um só lugar**:
**`buildScrapedOffer()` em `src/converters/offerEngine.js`**. Mantido como ponto
único para que qualquer futuro consumidor de oferta reaproveite a mesma lógica
em vez de duplicá-la.

Qual link aparece na oferta final é controlado pela flag `keepOriginalLink`:

| Consumidor              | `keepOriginalLink` | `displayUrl` (link na oferta) |
|-------------------------|--------------------|-------------------------------|
| Painel "Criar oferta"   | `true` (**temporário**, 2026-06) | link **original** colado pelo usuário |

**MODO TEMPORÁRIO (2026-06):** como a conversão só funcionava bem para links
do próprio afiliado, o painel "Criar oferta" usa `keepOriginalLink: true`: a UI
avisa que o link colado precisa ser o do próprio afiliado, e a rota
`/scrape-offer` devolve `conversion: null` e `conversionWarning: null` (a UI não
exibe mais status de conversão). A conversão ainda roda **internamente** só para
buscar título/preço (resolve short link/`/up/`, cookie ML). Contrato histórico a
restaurar quando a conversão voltar: painel com `keepOriginalLink: false` (link
convertido na oferta) + metadados de conversão na resposta.

**Regras:**
- **Não duplicar** a lógica de converter/scrapar/fallback fora de
  `offerEngine.js`. Qualquer novo consumidor de oferta deve chamar
  `buildScrapedOffer()`.
- Exceção no scraper **não** vira erro pro usuário: o motor degrada para
  fallback mínimo (`inferTitleFromUrl` + `scrapeWarning`).
- Links de recomendação ML `/up/MLBU...` são reconhecidos como landing em
  `isMercadoLivreLandingUrl` (`productInfoScraper.js`) e resolvidos para a URL
  canônica do produto via `wid=MLB...` do fragmento — defesa em profundidade
  mesmo quando o link não passa pela conversão.

Testes: `test/offer-engine.test.js` (motor),
`test/link-conversion-route.test.js`.

### "Criar oferta" com link da Shopee saía SEM IMAGEM (RCA 2026-09-16 — não regredir)

A oferta chegava com **título e preço certos e sem foto**. A assimetria tem
nome e lugar: a rota `POST /api/link-conversion/scrape-offer` buscava a foto
por `offer.finalUrl` **cru**, e `finalUrl` é onde o fetch de HTML TERMINOU —
na Shopee ele termina com frequência numa parede anti-bot
(`/unsupported.html`, `verify/traffic`) que **perde (shopId, itemId)**. Sem os
ids não existe foto: a Shopee tem uma fonte só que funciona, e ela precisa dos
ids.

O caminho de **título/preço já se protegia disso desde sempre** —
`shopeeApiSourceUrl` (`productInfoScraper.js`) escolhe
`[finalUrl, resolvedUrl, url].find(tem ids)` justamente porque "o fetch de HTML
pode ter redirecionado para uma página anti-bot". O caminho da **foto** não
escolhia nada. Era só isso.

Medido ao vivo, com o resolver real e **sem credencial de Shopee**:

| endereço passado ao resolver | resultado |
|---|---|
| `shopee.com.br/product/<shopId>/<itemId>` | **foto OK** |
| `shopee.com.br/unsupported.html?...` | **sem foto** (todas as fontes) |

Ou seja: **o endereço escolhido é o que decide se a foto vem**, não a
credencial.

| Peça | Onde |
|---|---|
| Escolha do endereço (PURA, sem rede) | `src/core/offerImageSource.js` |
| `resolvedUrl` exposto pelo scraper | `fetchProductInfo` (`productInfoScraper.js`) |
| Repassado pelo motor | `buildScrapedOffer` (`offerEngine.js`) |

**Não regredir:**

- **A ordem dos candidatos é `[finalUrl, resolvedUrl, offerUrl, url]`**, a
  MESMA de `shopeeApiSourceUrl`. `finalUrl` primeiro preserva byte a byte o
  comportamento de Amazon/ML/SHEIN; quem resgata a Shopee é a **preferência
  por candidato com ids**, não a troca de ordem. Inverter a ordem muda loja
  que hoje funciona.
- **Parede anti-bot nunca é candidato** (`isDeadEndImageSourceUrl`:
  `unsupported.html`, `/gz/account-verification`, `suspicious-traffic`).
  `verify/traffic?next=...` **continua valendo** — `extractShopeeIds` decodifica
  a URL embutida e os ids estão lá.
- **Fail-safe é TENTAR**: sem candidato utilizável, usa o primeiro mesmo assim.
  Desistir por dúvida é oferta sem foto garantida.
- **A escolha é PURA e acontece antes de qualquer fetch** — zero ida à rede a
  mais.
- **O caminho da foto deixou de ser MUDO.** `fetchProductImage` trata o próprio
  erro e devolve `null`, então "saiu sem imagem" chegava ao log sem motivo
  nenhum (mesma família do RCA do card de preview). A rota agora passa
  `onDiagnostic` e loga `Criar oferta: loja não devolveu foto do produto` com
  o endereço usado e as etapas (`shopee_sem_credencial`, `shopee_sem_ids`,
  `shopee_api_erro`, `shopee_item_fora_do_catalogo`…). É por aí que se separa
  "chave recusada" de "item fora do catálogo de afiliado" sem adivinhar.

⚠️ Isto **não conserta chave da Shopee recusada** (`10020`) nem item fora do
catálogo de afiliado — nesses casos a foto segue impossível pela API, e agora
o log diz qual dos dois é.

Teste: `test/criar-oferta-imagem-shopee.test.js`.

### "Criar oferta" com link da Shopee saía SEM NOME NEM PREÇO (RCA 2026-09-23)

Mesma família do RCA acima, no caminho de **título/preço**, não de foto —
`fetchShopeeProductInfo` (a única fonte que funciona com credencial) tinha
`catch { return null }` **sem nenhum diagnóstico**, e o fallback público v4
(`fetchShopeeItemInfo`) já era conhecido como instável. As duas fontes podiam
morrer juntas em silêncio total: nome, preço e foto vazios, sem uma linha de
log explicando por quê.

**Causa raiz medida em produção** (conta `nandavieiraf@gmail.com`, link
`https://s.shopee.com.br/3qNKeP0T3u`, resolvido corretamente para
`shopId=515433918 itemId=19997980913` — a resolução do short link **não** era
o problema): a API de afiliado respondia **200** com o erro

```
error [10035]: You currently do not have access to the Shopee Affiliate Open
API Platform. Please check the error code description on the front-end page
and contact the Shopee Affiliate team
```

⚠️ **Primeira correção estava ERRADA e foi derrubada pela própria cliente no
mesmo dia.** A primeira versão deste fix tratou `10035` como equivalente a
`10020` ("Invalid Signature") — mesma classe de "chave recusada, TODA
conversão para". Isso teria disparado o e-mail `chave_shopee_recusada`
("as ofertas da Shopee pararam de sair") — e a cliente relatou que o
**espelhamento dela continuava publicando ofertas de Shopee normalmente**
o tempo todo, só "Criar oferta" via em branco. Mandar aquele e-mail teria
sido uma mentira nova, pior que o silêncio original.

**A explicação: a API de afiliado tem DUAS operações com autorização
SEPARADA no mesmo endpoint.** `convert()`/espelhamento usa a mutation
`generateShortLink` (gera o link em si) — não bateu em `10035` nesta conta.
`fetchShopeeProductInfo` (título/preço), `fetchShopeeImage` (foto),
`checkShopeeSession` (sondagem) e `offerAutomation/shopeeOffers.js` (busca
das ofertas automáticas) usam a query `productOfferV2` (catálogo/descoberta
de ofertas) — foi essa que devolveu `10035`. A Shopee libera/nega acesso por
MÓDULO da API, não pela chave inteira: o direito básico de gerar link de
afiliado é separado do módulo de catálogo. Diferente de `10020`, que é falha
de assinatura e por isso derruba **qualquer** chamada (inclusive
`generateShortLink`).

**Não regredir:**

- **`10035` NUNCA entra em `SHOPEE_AUTH_REJECTED_CODES`** — só `10020`
  continua lá. `SHOPEE_PRODUCT_OFFER_DENIED_CODE` (`src/converters/shopee.js`)
  documenta o porquê no topo do arquivo. Fazer o contrário manda a cliente
  ler "as ofertas da Shopee pararam de sair" quando o espelhamento dela está
  de pé — exatamente o erro cometido e corrigido nesta mesma rodada.
- **O diagnóstico distingue os dois casos por ESTÁGIO**, não só por mensagem
  crua: `fetchShopeeProductInfo`/`fetchShopeeImage` reportam
  `shopee_sem_acesso_catalogo_ofertas` (via `stageForShopeeApiError`) quando o
  código é `10035`, e `shopee_api_erro` para qualquer outro erro do corpo
  (que PODE ser chave morta de verdade e merece investigação). Quem lê o log
  não pode concluir "chave recusada" a partir de um `shopee_api_erro` genérico
  sem olhar o `detail`.
- `fetchShopeeProductInfo` ganhou `onDiagnostic`, no MESMO contrato de
  `fetchShopeeImage` (`{ stage, detail }`): `shopee_sem_credencial`,
  `shopee_sem_ids`, `shopee_sem_acesso_catalogo_ofertas`, `shopee_api_erro`,
  `shopee_item_fora_do_catalogo`, `shopee_catalogo_sem_titulo_ou_preco`,
  `shopee_api_falhou`. O fallback público v4 (`fetchShopeeItemInfo`) ganhou os
  mesmos sinais (`shopee_v4_sem_ids`, `shopee_v4_http_erro`,
  `shopee_v4_sem_item`, `shopee_v4_falhou`). `buildScrapedOffer`/
  `offerEngine.js` repassam `onDiagnostic` e a rota `/scrape-offer` loga
  `Criar oferta: loja não devolveu título nem preço do produto` quando os três
  campos saem vazios — mesmo padrão do log de foto ausente.
- **Isto não conserta conta sem acesso ao módulo de catálogo/ofertas** — só a
  própria Shopee libera isso (a cliente precisa contatar o time de afiliados
  dela). O que muda é parar de ser silencioso: hoje o log diz exatamente qual
  dos dois problemas é, sem escrever script avulso de novo.
- Diagnóstico reutilizável para qualquer link específico:
  `scripts/diag-criar-oferta-shopee.mjs <email> <url>` (read-only, mostra a
  resposta CRUA da API de afiliado e do fallback v4 lado a lado). Para
  confirmar se é este caso ou chave morta de verdade, compare com o
  espelhamento: se ele continua publicando Shopee normalmente, é `10035`
  (módulo de catálogo), não a chave inteira.

Testes: `test/shopee-affiliate-info.test.js`, `test/credential-expiry-alert.test.js`.

## Fila de revisão das ofertas automáticas (2026-09-13, DESLIGADA por padrão)

`OfferAutomation.publicationMode` aceita `direct` (histórico) e `review`: em
`review` o cron não publica — ele DESCOBRE ofertas e enfileira em
`OfferAutomationReviewItem` para a cliente aprovar antes de sair.

| Peça | Onde |
|---|---|
| Interruptores | `src/offerAutomation/reviewFlags.js` |
| Descoberta | `src/offerAutomation/reviewDiscoveryService.js` |
| Entrega do que foi aprovado | `src/offerAutomation/reviewDeliveryService.js` |
| Rotas | `src/api/routes/offerAutomationReview.js` |
| Tela | `dashboard/app/painel/ofertas-automaticas/page.js` |

**Não regredir:**

- **Nasce DESLIGADA e em duas chaves.** `OFFER_AUTOMATION_REVIEW_ENABLED` liga
  a fila; `OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED` libera a ENTREGA do que
  foi aprovado. Separadas de propósito: dá para acumular fila e conferir o que
  ela escolheria antes de deixar qualquer coisa sair.
  `OFFER_AUTOMATION_REVIEW_USER_IDS` limita a contas nomeadas (vazio = todas).
- **`destGroupJid` virou anulável** por causa deste modo. Todo caminho que o lê
  precisa tolerar `null` — inclusive a dedup cruzada por grupo
  (`OfferAutomationSentLog`), que é PULADA quando não há destino WhatsApp.
- **`publicationMode` desconhecido PULA a automação**, nunca cai em `direct`:
  publicar por engano é irreversível.
- Sem processo PM2 novo — roda no cron de automação que já existia.
