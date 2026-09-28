# O que você precisa fazer — fila única, em ordem

> 📌 **A fila de trabalho unificada (suas ações, código e backlog) está em `PENDENCIAS_UNIFICADAS_2026-09-28.md`.** Este arquivo fica como registro e fonte de dados.

## O que ainda falta (resumo atualizado em 28/09/2026)

- [ ] Quando B29 estiver em produção, pedir a reindexação das 10 páginas com “Revisado em” e `dateModified`.
- [ ] Conferir no Bing `/`, `/precos`, `/bot-afiliados-whatsapp` e o post do vídeo; enviar as URLs que ainda não estiverem atualizadas.
- [ ] Coletar no Planejador o volume e a concorrência de `automação para afiliados` e `automação para afiliado shopee`.
- [ ] Terminar, no máximo 10 por dia, as levas de indexação ainda marcadas `⏳` nas seções abaixo.
- [ ] Falar por WhatsApp com as 63 pessoas que ativaram e sumiram e classificar as respostas; e-mail de pesquisa foi encerrado por não gerar resposta.
- [ ] Obter 3 a 5 depoimentos reais com autorização, sem reescrever promessas.
- [ ] Produzir os vídeos 2 a 8 e executar guest-parágrafos, contato com criadores e distribuição autorizada em Telegram/Quora.
- [ ] Em 15/10, decidir o teto de vagas; em 27/10, executar a rodada mensal completa e reavaliar anúncio pago com a renovação da turma de setembro.
- [ ] Mensalmente, conferir acesso dos robôs de IA na Cloudflare.

### O que já foi executado neste ciclo

- [x] Deploy das entregas de 27/09 e reindexação das páginas prioritárias e de `/alternativas/proafiliados` em 28/09.
- [x] Rodada manual das quatro IAs e correção da leitura de retenção.
- [x] Página “vale a pena?”, comparativo AchadinhosBot, textos de reembolso e vídeo 1 publicado e embutido.

> As tabelas detalhadas abaixo guardam URLs, datas e passos. Em conflito de status, vale este resumo e, depois, a linha detalhada com a data mais recente.

Substitui as quatro listas de indexação que existiam em paralelo
(`PAGINAS_PEDIR_INDEXACAO_2026-09-11.md`, a seção final de
`PLANO_MELHORIA_2026-09-11.md`, `PENDENCIAS_INDEXACAO.md` e
`ORGANICO_SPRINT1_INDEXACAO_CHECKLIST.md`). São **34 endereços** somados, e
quatro listas divergem em uma semana.

---

## ⭐⭐ Sua parte do plano SEO + GEO (27/09) — passo a passo, por prioridade

Fonte: `PLANO_SEO_GEO_2026-09-27.md` e `DIAGNOSTICO_MAQUINA_DE_VENDAS_2026-09-27.md`.
A parte de código é minha (PRs contra `develop`). Esta é a sua. Faça de cima
para baixo; cada item diz o que decide.

| # | Quando | O quê | Como | Tempo |
|---|---|---|---|---|
| 🔝 | assim que a PR dos links dos guias chegar em `main` | **Indexação dos guias por loja + 2 páginas editadas** (8 URLs, cabe em 1 dia): novas — `/guia/shopee-afiliados`, `/guia/amazon-afiliados`, `/guia/mercado-livre-afiliados`, `/guia/magalu-afiliados`, `/guia/shein-afiliados`, `/guia/aliexpress-afiliados`; editadas (ganharam links em "Continue lendo") — `/padronizar-divulgacao-afiliado-whatsapp`, `/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo` | Search Console → Inspeção de URL → conferir que abre em produção → Solicitar indexação | 15 min |
| 🔝 | assim que a PR B29 chegar em `main` | **Reindexação B29 — “Revisado em” + `dateModified`** (10 por dia): `/`, `/bot-afiliados-whatsapp`, `/bot-achadinhos-whatsapp`, `/bot-que-busca-ofertas-shopee-whatsapp`, `/shopee-afiliados-whatsapp`, `/mercado-livre-afiliados-whatsapp`, `/amazon-afiliados-whatsapp`, `/espelhar-grupos-whatsapp`, `/automacao-whatsapp-afiliados`, `/alternativas/achadinhos-bot` | Search Console → Inspeção de URL → conferir “Revisado em” e o `dateModified` no HTML → Solicitar indexação | 15 min |
| 1 | ✅ 28/09 | **Validar staging e levar `develop` → `main`** (7 PRs de 27/09: tela do dia 5, assinatura, ficha técnica, títulos, indicação, "é confiável", dados da pagadora) — **feito** | `http://178.105.54.0:3006`: home e `/precos` com a ficha técnica; `/espelha-grupos-e-confiavel` com os números; `/painel/plano` em conta de teste só com "Pagar agora"; card de indicação após 1ª oferta. Depois abrir PR `develop → main` | 20 min |
| 2 | ✅ 28/09 | **Reindexação, leva 🔝 das páginas alteradas — pedida em 28/09**: `/`, `/precos`, `/espelha-grupos-e-confiavel`, `/alternativas/achadinho-pro`, `/programa-de-afiliados`, `/quanto-ganha-afiliado-shopee`, `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`, `/amazon-afiliados-whatsapp`, `/espelhar-grupos-de-ofertas-vale-a-pena`, `/politica-de-reembolso` | Search Console → Inspeção de URL → produção conferida → indexação solicitada | 15 min |
| 🔝 | ✅ 28/09 | **Reindexação de `/alternativas/proafiliados` pedida em 28/09**: a página dizia "grátis 24/7, 5 plataformas, tag" e o modelo dele mudou (grátis 2 h/dia, linha de crédito + 1 post a cada 30 envios, 12 lojas, Telegram, Pix pré-pago). Produção conferida com "2 horas por dia" | Search Console → Inspeção de URL → indexação solicitada | 5 min |
| 3 | dia seguinte | **Bing Webmaster Tools, Inspeção de URL** de `/`, `/precos`, `/bot-afiliados-whatsapp`, `/blog/como-espelhar-mensagens-entre-grupos-whatsapp`; se faltar, "Enviar URL" | bing.com/webmasters → Inspeção. Decide se o ChatGPT (que busca pelo Bing) lê a versão atual | 10 min |
| 4 | dia seguinte | **Planejador de Palavras-Chave**: `automação para afiliados` e `automação para afiliado shopee` (volume e concorrência) | Google Ads → Planejador → "Descobrir novas palavras-chave". Me mande os dois números. Decide se o hub dos 3 modelos disputa o Google | 10 min |
| 5 | dias 2–4 | **Levas de indexação 1 a 4** (lista em `DIAGNOSTICO_MAQUINA_DE_VENDAS_2026-09-27.md`, item 4): novas de 23–27/09 → R1 (falavam errado do produto) → páginas de confiança/preço → R2 restante | 10 por dia, de cima para baixo | 15 min/dia |
| 6 | esta semana | **WhatsApp para os 63 que ativaram e sumiram** (SQL e mensagem no `DIAGNOSTICO_…`, item 2); anotar as respostas em 4 caixas: preço, função, medo de bloqueio, tempo/outro | 5 a 10 por dia; parar de mandar e-mail (zero respostas) | 20 min/dia |
| 7 | esta semana | **Depoimentos reais** (3 a 5) com nome e permissão por escrito, sem reescrever; frases que prometem resultado ou "nunca banido" ficam de fora | me mande o texto exato + nome + autorização; eu publico em `/espelha-grupos-e-confiavel` e `/estudos-de-caso` | 1 h |
| 8 | ✅ 28/09 | **Vídeo 1** publicado: https://www.youtube.com/watch?v=nch0Lo3Zz1U (e o Short vertical). Embutido no post `/blog/como-espelhar-mensagens-entre-grupos-whatsapp` e na tela Espelhamento do painel — reindexar o post na **Leva R7** | roteiro: QR → escolher origem → escolher destino → oferta saindo com o SEU link | 2 h |
| 9 | semanas 2–8 | **Vídeos 2 a 8**, um por semana, nesta ordem: "Bot para afiliados no WhatsApp: como funciona o Espelha Grupos (6 lojas, a partir de R$39)" · "Espelha Grupos é confiável? O que ele faz com o seu WhatsApp" (rosto; LinkedIn só tela) · "Robô que busca ofertas da Shopee sozinho" · "Ferramenta para divulgar ofertas em grupos: 6 opções comparadas em 2026" · "Como postar em vários grupos ao mesmo tempo sem spam" · "Quanto custa um bot de afiliados? Basic R$39, Pro R$69" · "Dá para usar pelo celular, sem computador?" | título = a pergunta, literal; nunca "anti-ban"; sempre "Espelha Grupos" na legenda | 2 h/semana |
| 10 | semana 2 | **Guest-parágrafo** em superfrete.com/blog/grupos-vendas-whatsapp e remessaonline.com.br/blog/grupo-de-promocoes-no-whatsapp (seções "Potencialize seus grupos"/"Vale a pena automatizar?" sem ferramenta citada) | e-mail ao editor oferecendo um parágrafo com exemplo real de espelhamento com link convertido; texto-padrão de 62 palavras do plano de 18/09 | 1 h |
| 11 | semanas 3–6 | **Criadores pequenos do YouTube** que ensinam "bot de achadinhos" (lista nominal em `PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md`, item 8): teste estendido + programa de afiliadas (30% recorrente) + pedir "Espelha Grupos" no TÍTULO do vídeo | contato pela descrição/Instagram do canal | 2 h |
| 12 | semanas 4–8 | **Comunidades oficiais no Telegram** (Shopee, Mercado Livre) com o checklist gratuito, só com autorização do admin; **Quora pt-BR** nas perguntas já indexadas ("Como ser afiliado Shopee?") com resposta completa e UMA menção | conteúdo, não anúncio | 1 h/semana |
| 13 | 15/10 | **Decidir o teto de vagas** (62 de 80; servidor com 22,6 GB livres e swap zero): proposta é 100 vagas, reinício anunciado do supervisor de madrugada | responder "sim" ou "não"; eu passo os 5 comandos | 5 min |
| 14 | 27/10 | **Rodada mensal de medição**: Trilhas A, B, C e a nova D (18 consultas × 4 IAs; Gemini pela API), conta neutra, ChatGPT com busca; `node scripts/validar-medicao-ia.mjs` antes de fechar. Junto: Search Console (3 meses + série diária), `diag-funil-ativacao --dias 30`, `diag-ltv-retencao`, `diag-motivo-nao-renovou`, `diag-origem-cadastros --dias 30`, SQL de `Subscription` e `referredBy` | roteiro em `ROTEIRO_MEDICAO_IA.md`; comandos na seção 6 do `DIAGNOSTICO_…` | 2 h |
| 15 | mensal | **Cloudflare**: `node scripts/diag-acesso-robos-ia.mjs` (19 robôs em 200) e a coluna "Unsuccessful" do AI Crawl Control para Claude-User/GPTBot | 5 min | 5 min |

**Não fazer:** e-mail como pesquisa; anúncio pago antes da renovação de outubro; prometer anti-ban ou Telegram; listicle de concorrente (ofertasbot = PromoBot); Reclame Aqui/G2 sem CNPJ; mudar título de página fora das listas do plano.

## ⭐ Suas prioridades a partir de 24/09 (lista viva — comece por aqui)

| # | Quando | O quê | Tempo |
|---|---|---|---|
| 🔝 | **assim que a PR `feat/video-espelhar-blog-painel` chegar em `main`** | **Leva R7 (28/09, vídeo)** (abaixo): 1 página — `/blog/como-espelhar-mensagens-entre-grupos-whatsapp` ganhou o vídeo embutido e a marcação VideoObject. Substitui o pedido dela na R6 | 2 min |
| 🔝 | **assim que `develop` chegar em `main`** | **Reindexação das páginas corrigidas — Leva R1** (abaixo): 10 páginas que diziam coisa errada sobre o produto. Passa na frente de qualquer outra indexação | 15 min |
| 🔝 | **junto com a R1, assim que a PR dos títulos chegar em `main`** | **Leva R5 (27/09)** (abaixo): 5 páginas com muita impressão e quase zero clique que ganharam título e descrição novos (Achadinho Pro, comissão de afiliado, quanto ganha afiliado Shopee, Mercado Livre e Amazon no WhatsApp). Inclui a maior consulta do site (`achadinho pro`, 4.005 impressões) | 10 min |
| 🔝 | **junto com a R5, assim que a PR do lote 2 de títulos chegar em `main`** | **Leva R6 (27/09, lote 2)** (abaixo): 8 páginas — 6 que ganharam título e descrição novos (AchadinhosBot já está na R4; Shozap, Gigi Bot, FluxoPromo, como ser afiliado Shopee, divulgar Amazon, melhor horário) e as 2 páginas de loja que ganharam o link "guia completo" (Shopee e Mercado Livre no WhatsApp) | 10 min |
| 🔝 | dia seguinte à R1 | **Leva R4 (27/09)** (abaixo): 7 páginas — comparativo do AchadinhosBot refeito, página nova "espelhar grupos vale a pena?", reembolso e as que ganharam link. Passa na frente da R2 porque inclui a 3ª página mais visitada do site | 15 min |
| 🔝 | junto com a R4, assim que a PR `feat/geo-bot-afiliados-hub-3-modelos` chegar em `main` | **Leva R6 (27/09)** (abaixo): 4 páginas — o hub dos 3 modelos de automação para afiliadas (título novo), o comparativo de bots que passou a apontar para ele, o topo da metodologia e `/precos` (ganhou o link). As 3 da R4 que também mudaram (`/bot-afiliados-whatsapp`, `/bot-achadinhos-whatsapp`, `/bot-que-busca-ofertas-shopee-whatsapp`) só podem ser pedidas DEPOIS desta PR em `main` | 10 min |
| 🔝 | depois da R4 | **Leva R2** (10 páginas) e, no outro dia, **Leva R3** (3 páginas) | 15 min cada |
| 🔝 | junto com a R4 (mesma PR de `develop` → `main`) | **Leva R6 (27/09, GEO)** (abaixo): 6 páginas que ganharam a ficha técnica com 3 linhas novas, a frase dos 3 modelos, o link para "espelhar grupos vale a pena?" e os dois posts do blog com título novo (um deles estava em 3,2 com ZERO clique). As que já estão na R1/R4 não repetem | 10 min |
| 1 | ✅ 25/09 | Indexação — Dia 8 (8 de 9 pedidas) | — |
| 2 | ✅ 23/09 | PR #1833 (dados de 23/09 + script do Gemini) e #1905 (modelo do Gemini) mergeadas em `develop` | — |
| 3 | ✅ 27/09 | Reembolso depois de 7 dias: não há, escrito com cuidado em `/politica-de-reembolso` | — |
| 4 | 24/09 | **Depoimentos:** confirmar que os 5 textos são de clientes reais, com permissão, e ajustar as frases que prometem resultado (ver nota abaixo) | 20 min |
| 5 | ✅ 25/09 | Indexação — Dia 9. **Falta:** as duas conferências no Bing (seção "Duas conferências") | 10 min |
| 6 | quando a PR da outra sessão chegar em `main` | **Indexação — Dia 10**: páginas novas (reembolso, ofertas automáticas da Shopee, 5 comparativos) e as editadas — a outra sessão entrega a lista | 15 min |
| 7 | 28/09 | Conferir se o Dia 7 entrou no índice (seção "Como conferir o Dia 7") | 10 min |
| 8 | 30/09 | **Medição:** export do Search Console (3 meses + `Gráfico.csv`), `diag-origem-cadastros --dias 30`, `diag-paginas-seo --dias 30` | 20 min |
| 9 | ✅ 27/09 | ~~Rodada de IA à mão no Gemini, Perplexity e AI Overviews~~ feita e registrada (placar em `SERIE_HISTORICA_SEO.md`, seção 2). Próxima rodada: ~11/10 — as 10 perguntas do `ROTEIRO_MEDICAO_IA.md`, aba anônima, sem pergunta extra. O Gemini por script **não roda grátis** (ver ROTEIRO, seção "Gemini por script"): só volta se você ativar a cobrança no AI Studio | 30 min |
| 10 | opcional | Regra na Cloudflare contra robôs de ataque — passo a passo em `SESSAO_2026-09-23_PROMPTS_E_DECISOES.md` | 5 min |
| 11 | quando der | Rodar em outras sessões os prompts de **segurança** e **funil comercial** (texto pronto em `SESSAO_2026-09-23_PROMPTS_E_DECISOES.md`). **Renovação: esperar** a turma de setembro renovar (1ª quinzena de outubro) — a leitura de 23/09 estava errada | — |
| 13 | ✅ 27/09 | Corrigida a frase do `pricing.md` que faz o Gemini dizer que o Basic é "operação manual" (o espelhamento é automático nos dois planos) | — |
| 14 | ✅ 27/09 | Criada a página `/espelhar-grupos-de-ofertas-vale-a-pena` respondendo "espelhar grupos vale a pena?" — contra-narrativa do Achadinhos Pro já é fonte do AI Overviews e da Perplexity; o Pro faz os dois (espelha e garimpa) | — |
| 15 | ✅ 27/09 | Refeita a `/alternativas/achadinhos-bot` (medir de novo em 30 dias; era 3ª página em visitas, 9,8% de clique e só 1 em 4 lia metade) | — |
| 12 | decisão sua | Ativar ou não a cobrança do Gemini (menos de R$ 2 por rodada, estimativa não conferida) | — |

**Regra da lista (pedido da Flávia, 24/09):** sempre que uma mudança de texto
em página pública precisar de reindexação, ela entra **no topo desta tabela**
(linha 🔝), antes das levas de indexação comuns — e só vale depois do deploy em
`main`. Página que já estava numa leva comum e mudou de texto sai de lá e vai
para a leva de reindexação (pedir antes do deploy gasta a cota com o texto velho).

**Nota sobre os depoimentos (item 4).** Só publicar texto de cliente real, com
autorização e sem mudar o sentido — depoimento inventado ou reescrito é
publicidade enganosa (CDC art. 37) e, se uma IA ou concorrente descobrir,
destrói a confiança que ele deveria criar. Três frases precisam da cliente
confirmar que disse exatamente isso ou de ajuste: "dobrar minhas comissões"
(resultado), "total estabilidade e zero dores de cabeça" com o módulo de
preservação (soa como promessa de que não bane — linha que o site não cruza) e
"converte sem errar".

---

## Antes de tudo: nada de indexação antes do deploy em produção

Tudo abaixo só vale depois que `develop` for validado em staging e mergeado em
`main`. **Pedir indexação antes disso é desperdiçar a cota** — o Google vai ler
a página velha, sem os links novos.

**Passo 0 (hoje):** validar em `http://178.105.54.0:3006` que as três páginas
novas abrem e que a tabela de preços mostra seis lojas.

```
http://178.105.54.0:3006/quanto-ganha-afiliado-shopee
http://178.105.54.0:3006/vendas-e-comissao-afiliado-whatsapp
http://178.105.54.0:3006/copiaram-minha-oferta-no-whatsapp
http://178.105.54.0:3006/precos
```

**Passo 0.1:** abrir PR de `develop` → `main` e aguardar o autodeploy.

---

## 1. Indexação — a fila, em ordem de prioridade

### 🔝 Reindexação das páginas corrigidas (PRs #1848 e #1850, 24/09) — ⏳ só depois do deploy em `main`

Estas páginas **já estão no Google com texto errado**: prometiam "pausa
preventiva", medir cliques e "Lista VIP", ou diziam que o produto não pausa o
canal (ele pausa por 1 h o canal que recusa envios, no plano Pro). Reindexar é
o que faz o Google (e as IAs que leem o índice) trocar o texto velho pelo
certo. Por isso passam na frente das levas comuns.

**Como pedir:** Search Console → Inspeção de URL → colar o endereço →
"Solicitar indexação". Antes, abrir a página em produção e conferir que o
texto novo está no ar (ex.: `/bot-canais-whatsapp` mostra "pausado sozinho por
1 hora"); se ainda mostrar o texto velho, o deploy não chegou — não pedir.

**Leva R1 — as que falavam errado do produto (1ª cota)**

```
https://espelhagrupos.com.br/bot-canais-whatsapp                        ⏳
https://espelhagrupos.com.br/bot-comum-vs-espelha-grupos                ⏳
https://espelhagrupos.com.br/como-funciona-espelha-grupos-canais        ⏳
https://espelhagrupos.com.br/blog/bot-whatsapp-antiban-existe           ⏳
https://espelhagrupos.com.br/blog/shadowban-whatsapp-canais             ⏳
https://espelhagrupos.com.br/blog/como-evitar-banimento-whatsapp-afiliados ⏳
https://espelhagrupos.com.br/blog/grupo-ou-canal-whatsapp-achadinhos    ⏳
https://espelhagrupos.com.br/blog/chip-dedicado-bot-whatsapp            ⏳
https://espelhagrupos.com.br/blog/migrar-grupo-achadinhos-para-canal    ⏳
https://espelhagrupos.com.br/diagnostico-antiban-whatsapp               ⏳
```

**Leva R5 — títulos reescritos em 27/09 (junto com a R1; a R4 pode esperar um dia)**

Conferir antes em produção (aba do navegador): `/alternativas/achadinho-pro`
começa com "Achadinho Pro: alternativa com 6 lojas"; `/programa-de-afiliados`
começa com "Comissão de afiliado". Medir o efeito pela série DIÁRIA do Search
Console, nunca pelo acumulado de 3 meses (ver `docs/rca/seo-marketing.md`).

```
https://espelhagrupos.com.br/alternativas/achadinho-pro                    ⏳
https://espelhagrupos.com.br/programa-de-afiliados                         ⏳
https://espelhagrupos.com.br/quanto-ganha-afiliado-shopee                  ⏳
https://espelhagrupos.com.br/blog/como-divulgar-ofertas-mercado-livre-whatsapp ⏳
https://espelhagrupos.com.br/amazon-afiliados-whatsapp                     ⏳
```

`/alternativas/achadinho-pro` já está na R4 — se a R5 for pedida antes, tirar
de lá para não gastar uma das 10 vagas do dia em duplicata.

**Leva R6 — lote 2 de títulos (27/09) + links do Tier 1 (junto com a R5, no dia seguinte se a cota acabar)**

Conferir antes em produção (aba do navegador): `/alternativas/shozap` começa
com "Alternativa ao Shozap: grupos ilimitados por R$ 39";
`/blog/como-ser-afiliado-shopee-whatsapp` começa com "Como ser afiliado
Shopee: 5 passos"; `/shopee-afiliados-whatsapp` mostra "Ainda não é afiliada?
Guia completo" logo abaixo do título. Medir pela série DIÁRIA.

```
https://espelhagrupos.com.br/blog/como-ser-afiliado-shopee-whatsapp        ⏳
https://espelhagrupos.com.br/blog/como-divulgar-ofertas-amazon-whatsapp    ⏳
https://espelhagrupos.com.br/blog/melhores-horarios-para-postar-ofertas-no-whatsapp ⏳
https://espelhagrupos.com.br/alternativas/shozap                           ⏳
https://espelhagrupos.com.br/alternativas/gigi-bot                         ⏳
https://espelhagrupos.com.br/alternativas/fluxopromo                       ⏳
https://espelhagrupos.com.br/shopee-afiliados-whatsapp                     ⏳
https://espelhagrupos.com.br/mercado-livre-afiliados-whatsapp              ⏳
```

`/alternativas/achadinhos-bot` (título novo neste lote também) já está na R4;
`/amazon-afiliados-whatsapp`, `/quanto-ganha-afiliado-shopee` e
`/blog/como-divulgar-ofertas-mercado-livre-whatsapp` (ganharam o bloco
"próximo passo"/"guia completo") já estão na R5 — não repetir.

**Leva R4 — mudanças de 27/09 (dia seguinte à R1, antes da R2)**

Conferir antes em produção: `/alternativas/achadinhos-bot` mostra "Procurando o
Achadinho Pro?" logo no primeiro bloco; `/politica-de-reembolso` mostra "Nada te
prende ao plano"; a página nova abre.

```
https://espelhagrupos.com.br/alternativas/achadinhos-bot                ⏳
https://espelhagrupos.com.br/espelhar-grupos-de-ofertas-vale-a-pena     ⏳ (nova)
https://espelhagrupos.com.br/politica-de-reembolso                      ⏳
https://espelhagrupos.com.br/alternativas/achadinho-pro                 ⏳
https://espelhagrupos.com.br/bot-achadinhos-whatsapp                    ⏳
https://espelhagrupos.com.br/bot-afiliados-whatsapp                     ⏳
https://espelhagrupos.com.br/bot-que-busca-ofertas-shopee-whatsapp      ⏳
```

No Bing Webmaster Tools, enviar as mesmas 7 em "Enviar URLs" (o aviso
automático do deploy também avisa, mas o envio manual acelera).

**Leva R7 — vídeo 1 no post (28/09; só depois do deploy em `main`)**

Conferir antes em produção: o post abre o vídeo logo depois do "Resumo
prático" e o código da página tem `"@type":"VideoObject"`. Depois, no Search
Console, "Testar URL publicada" → deve aparecer "Vídeos" entre os itens
detectados.

```
https://espelhagrupos.com.br/blog/como-espelhar-mensagens-entre-grupos-whatsapp     ⏳
```

No Bing Webmaster Tools, inspecionar a mesma URL (ela já está no item E1 do plano).

**Leva R6 — GEO de 27/09 (junto com a R4; só depois do deploy em `main`)**

Conferir antes em produção: a ficha técnica da home e de `/precos` tem as
linhas "Palavras bloqueadas", "Imagem e card da oferta preservados" e "Criar
oferta a partir de um link"; `/quem-somos` e `/espelha-grupos-e-confiavel`
abrem com "...cria a oferta a partir de um link e (no Pro) busca ofertas da
Shopee sozinho"; `/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp`
tem título "…6 opções" e `/blog/como-espelhar-mensagens-entre-grupos-whatsapp`
tem título "…4 jeitos". `/`, `/precos` e `/espelha-grupos-e-confiavel` já
estão na R1 e `/espelhar-grupos-de-ofertas-vale-a-pena` na R4 — não repetir.
`/blog/como-espelhar-mensagens-entre-grupos-whatsapp` saiu daqui e foi para a
**Leva R7** (ganhou o vídeo em 28/09): pedir uma vez só, depois daquela PR em `main`.

```
https://espelhagrupos.com.br/quem-somos                                             ⏳
https://espelhagrupos.com.br/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp ⏳
```

No Bing Webmaster Tools, além das 2 acima (e da R7), inspecionar `/llms.txt` e
`/pricing.md` (o ChatGPT recupera via Bing; a ficha nova está neles).

**Leva R6 — mudanças de 27/09 (PR `feat/geo-bot-afiliados-hub-3-modelos`, junto com a R4)**

Conferir antes em produção: `/automacao-whatsapp-afiliados` abre com o título
"Automação para afiliados no WhatsApp: 3 modelos, 8 bots" e mostra a tabela
das ferramentas; `/bot-afiliados-whatsapp` mostra a tabela "Espelha Grupos ×
Afilira × Achadinho Pro × Pro Afiliados"; `/metodologia-uso-responsavel-whatsapp`
começa com "Esta é a metodologia do Espelha Grupos para afiliadas".

⚠️ `/bot-afiliados-whatsapp`, `/bot-achadinhos-whatsapp` e
`/bot-que-busca-ofertas-shopee-whatsapp` já estão na R4 e TAMBÉM mudaram nesta
PR: pedir só depois que ela chegar em `main` (pedir antes gasta a cota com o
texto velho).

```
https://espelhagrupos.com.br/automacao-whatsapp-afiliados               ⏳ (título e conteúdo novos)
https://espelhagrupos.com.br/melhores-bots-para-afiliados-whatsapp      ⏳
https://espelhagrupos.com.br/metodologia-uso-responsavel-whatsapp       ⏳
https://espelhagrupos.com.br/precos                                     ⏳
```

No Bing Webmaster Tools, enviar as mesmas 4 em "Enviar URLs".

**Leva R2 — as 16 editoriais revisadas que restam (depois da R4)**

```
https://espelhagrupos.com.br/conteudos                                  ⏳
https://espelhagrupos.com.br/glossario                                  ⏳
https://espelhagrupos.com.br/estudos-de-caso                            ⏳
https://espelhagrupos.com.br/benchmarks/operacao-grupos-ofertas-whatsapp ⏳
https://espelhagrupos.com.br/blog/como-escalar-grupos-sem-operacao-manual ⏳
https://espelhagrupos.com.br/blog/checklist-padronizar-divulgacao-whatsapp ⏳
https://espelhagrupos.com.br/blog/conferir-converter-link-afiliado-whatsapp ⏳
https://espelhagrupos.com.br/blog/bot-para-afiliados-whatsapp-grupos-cupons ⏳
https://espelhagrupos.com.br/materiais/checklist-operacao-whatsapp      ⏳
https://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp ⏳
```

**Leva R3 — ajuste menor (se sobrar cota)**

```
https://espelhagrupos.com.br/seguranca-credenciais-afiliado             ⏳
https://espelhagrupos.com.br/blog/como-divulgar-ofertas-mercado-livre-whatsapp ⏳
https://espelhagrupos.com.br/quem-somos                                 ⏳
```

As landings e hubs que só trocaram o botão "Lista VIP" por "Testar 7 dias
grátis" **não** precisam de pedido: o Google relê sozinho, e a mudança não
altera o assunto da página.

### 📌 Estado em 12/09 — 17 pedidos feitos; falta o fim do Dia 4

| Leva | Pedidas | Pendentes |
|---|---|---|
| Dia 1 — páginas novas | 4 de 4 ✅ | — |
| Dia 2 — as cinco lojas | 5 de 5 ✅ | — |
| Dia 3 — quem ganhou os links | 5 de 5 ✅ | — |
| Dia 4 — blog que ganhou link | 3 de 5 | 2 |
| Dia 5 em diante | — | tudo |

**Próxima leva:** os 2 que faltam do Dia 4 e, na sequência, o Dia 5.

⚠️ **Desatualizado — pule para "Dia 7 (2026-09-21)" abaixo.** Esta tabela é o
retrato de 12/09; nada abaixo dela foi conferido contra o Search Console de
verdade. Em 21/09 um export real do Search Console mostrou que Dia 4/5/6
tinham ficado incompletos e que apareceram páginas novas (`/alternativas/*`)
nunca antes rastreadas — a fila real, hoje, é só o Dia 7.

As onze já pedidas foram conferidas ao vivo: **todas respondem 200 em produção
com o conteúdo novo**, incluindo os links de entrada e a página de confiança.
Pedido de indexação de página que ainda não subiu não vale — essa conferência é
o que separa "pedi e vai valer" de "pedi e o Google leu a versão velha".

⚠️ **Quatro das cinco lojas do Dia 2 já tinham sido pedidas em 11/09 de manhã,
antes de ganharem link de entrada**, e o veredito foi "Detectada, mas não
indexada / Último rastreamento: N/D / nenhuma página de referência". Repetir o
pedido **só faz sentido agora**, porque a causa mudou: antes não havia link
apontando para elas, agora há. Se o veredito voltar igual depois desta rodada,
o problema deixa de ser descoberta e passa a ser conteúdo quase igual entre as
cinco — e aí a ação é diferenciar o texto, não pedir de novo.

⚠️ **A Inspeção de URL tem cota de ~10 pedidos por dia.** A ordem importa. Faça
de cima para baixo, uma leva por dia.

### Dia 1 — as páginas novas (elas não existem no Google ainda)

```
https://espelhagrupos.com.br/quanto-ganha-afiliado-shopee          ✅ pedida 2026-09-11
https://espelhagrupos.com.br/vendas-e-comissao-afiliado-whatsapp   ✅ pedida 2026-09-11
https://espelhagrupos.com.br/copiaram-minha-oferta-no-whatsapp     ✅ pedida 2026-09-11
https://espelhagrupos.com.br/espelha-grupos-e-confiavel            ✅ pedida 2026-09-11
```

**Dia 1 concluído.** As quatro estão no ar (HTTP 200 conferido) com o conteúdo
novo, e a indexação foi pedida.

Das quatro, **só `/quanto-ganha-afiliado-shopee` tem volume de busca medido**
(~3.050/mês, concorrência baixa). As outras três existem para o canal de IA e
para a comparação — indexe do mesmo jeito, mas não cobre tráfego de busca delas.

### Dia 2 — as cinco páginas de loja que passaram 9 dias sem uma impressão

São elas que motivaram a regra de página órfã. Agora têm links de entrada.

```
https://espelhagrupos.com.br/magalu-afiliados-whatsapp         ✅ pedida 2026-09-11
https://espelhagrupos.com.br/shopee-afiliados-whatsapp         ✅ pedida 2026-09-11 (2ª vez)
https://espelhagrupos.com.br/mercado-livre-afiliados-whatsapp  ✅ pedida 2026-09-11 (2ª vez)
https://espelhagrupos.com.br/amazon-afiliados-whatsapp         ✅ pedida 2026-09-11 (2ª vez)
https://espelhagrupos.com.br/shein-afiliados-whatsapp          ✅ pedida 2026-09-11 (2ª vez)
```

**Dia 2 concluído.** Quatro delas já tinham sido pedidas em 11/09, ANTES de
ganharem os links de entrada — e o veredito naquele dia foi "Detectada, mas não
indexada", com "Último rastreamento: N/D" e nenhuma página de referência. Este
segundo pedido é o que vale: agora existe link interno apontando para elas.
`/magalu-afiliados-whatsapp` ficou de fora no dia 11 porque a cota acabou; é a
primeira vez que ela é pedida.

### Dia 3 — as páginas que GANHARAM os links novos

O Google precisa relê-las para ver que elas agora apontam para as páginas do
Dia 1. Sem isso o link novo demora a valer.

```
https://espelhagrupos.com.br/bot-afiliados-whatsapp                       ✅ pedida 2026-09-11
https://espelhagrupos.com.br/bot-achadinhos-whatsapp                      ✅ pedida 2026-09-11
https://espelhagrupos.com.br/clonar-mensagens-de-grupo-de-afiliados       ✅ pedida 2026-09-12
https://espelhagrupos.com.br/blog/como-ser-afiliado-shopee-whatsapp       ✅ pedida 2026-09-12
https://espelhagrupos.com.br/blog/quanto-custa-bot-para-whatsapp-afiliados ✅ pedida 2026-09-12
```

**Dia 3 concluído** (2 em 11/09, 3 em 12/09). As duas comerciais são as que
mais carregam link novo — elas apontam para a página de confiança, para o
espelhamento e para os posts que estavam órfãos.

⚠️ `/blog/quanto-custa-bot-para-whatsapp-afiliados` é o pior caso do site:
posição 4,35 e **zero clique** em centenas de impressões. Relê-la serve para o
link novo valer, mas o problema dela é o TÍTULO, não a indexação — está na
lista de ajustes do plano de melhoria.

### Dia 4 — o resto que ganhou link ou título novo

```
https://espelhagrupos.com.br/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero          ✅ pedida 2026-09-12
https://espelhagrupos.com.br/blog/como-converter-link-de-afiliado-automaticamente-whatsapp  ✅ pedida 2026-09-12
https://espelhagrupos.com.br/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp    ✅ pedida 2026-09-12
https://espelhagrupos.com.br/blog/como-divulgar-ofertas-amazon-whatsapp                     ✅ pedida 2026-09-22
https://espelhagrupos.com.br/blog/como-divulgar-ofertas-mercado-livre-whatsapp              ✅ pedida 2026-09-22
```

**Dia 4 concluído** (3 em 12/09, os 2 que faltavam em 22/09). Eram os que mais
aparecem hoje: `como-divulgar-ofertas-amazon-whatsapp` (450 impressões) e
`como-divulgar-ofertas-mercado-livre-whatsapp` — já pegam a periferia do Tier 1,
então relê-las é o que faz o link para as páginas de loja valer mais rápido.

### Dia 5 — ✅ CONCLUÍDO — títulos que mudaram e a entidade de marca

```
https://espelhagrupos.com.br/programa-de-afiliados                    ✅ pedida 2026-09-22
https://espelhagrupos.com.br/alternativas/proafiliados                ✅ pedida 2026-09-22
https://espelhagrupos.com.br/alternativas/promium                     ✅ pedida 2026-09-22
https://espelhagrupos.com.br/quem-somos                               ✅ pedida 2026-09-22
https://espelhagrupos.com.br/metodologia-uso-responsavel-whatsapp     ✅ pedida 2026-09-22
```

### Dia 6 — a cauda (menor prioridade, faça se sobrar cota)

```
https://espelhagrupos.com.br/estudos-de-caso                              ✅ pedida 2026-09-22
https://espelhagrupos.com.br/ferramentas/calculadora-risco-whatsapp       ✅ pedida 2026-09-22
https://espelhagrupos.com.br/escalar-grupos-ofertas-sem-equipe            ✅ pedida 2026-09-22
https://espelhagrupos.com.br/aumentar-conversao-em-grupos-de-cupons       ✅ pedida 2026-09-25
https://espelhagrupos.com.br/consistencia-postagens-em-grupos             ✅ pedida 2026-09-25
https://espelhagrupos.com.br/organizar-calendario-de-ofertas-no-whatsapp  ✅ pedida 2026-09-25
```

**Dia 6 concluído** (6 de 6 em 25/09).

`/parcerias`, `/parceiro-influenciador` e `/ferramentas/calculadora-tempo-grupos-whatsapp`
saíram daqui — o export do Search Console de 21/09 (abaixo) confirma que
continuam sem indexar, então foram promovidas para o Dia 7.
`/protecao-antiban-botinho` também saiu — a rota foi renomeada em 19/09 e não
apareceu como pendente no export; pedir o endereço antigo pediria a versão que
hoje só redireciona.

### ⚠️ Dias 7-10 antigos foram SUBSTITUÍDOS (21/09) — eram estimativa, isto é dado real

Você mandou o export do Search Console (relatório de Indexação de Páginas,
duas abas: "Rastreada, mas não indexada" e "Detectada, mas não indexada") e o
CSV do gráfico. As listas de "Dia 7" a "Dia 10" que estavam aqui antes eram
inferidas do histórico do projeto — nunca confirmadas contra o Search Console
de verdade. Jogue-as fora; o que segue é o que o relatório de hoje mostra.

**Não dá pra saber, olhando só o Search Console, o que você já PEDIU antes** —
o relatório mostra só o que está indexado ou não, não um histórico de pedidos.
Mas isso não importa: se a página ainda aparece como não indexada, pedir de
novo é a ação certa, independente de já ter pedido antes ou não.

### Dia 7 (2026-09-21) — ✅ CONCLUÍDO, as 10 pedidas em 2026-09-21

Exatamente 10 páginas reais (cabe num dia só de cota). Tirado direto das duas
abas "Rastreada, mas não indexada" e "Detectada, mas não indexada" do seu
export — retirando o que não é página (fontes `.woff2`, `favicon.ico`,
`llms.txt`, `pricing.md` — esses três últimos são de propósito, não devem ser
indexados como página de busca) e o que é linha CONGELADA de propósito (ver
aviso abaixo).

```
https://espelhagrupos.com.br/alternativas/afiliado-inteligente        ✅ pedida 2026-09-21
https://espelhagrupos.com.br/alternativas/afilimais                   ✅ pedida 2026-09-21
https://espelhagrupos.com.br/alternativas/afilira                     ✅ pedida 2026-09-21
https://espelhagrupos.com.br/alternativas/busqy                       ✅ pedida 2026-09-21
https://espelhagrupos.com.br/alternativas/divulga-ninja               ✅ pedida 2026-09-21
https://espelhagrupos.com.br/alternativas/ia-divulgadora              ✅ pedida 2026-09-21
https://espelhagrupos.com.br/alternativas/shark                       ✅ pedida 2026-09-21
https://espelhagrupos.com.br/parceiro-influenciador                   ✅ pedida 2026-09-21
https://espelhagrupos.com.br/parcerias                                ✅ pedida 2026-09-21
https://espelhagrupos.com.br/ferramentas/calculadora-tempo-grupos-whatsapp ✅ pedida 2026-09-21
```

**Dia 7 concluído.** Próxima ação é só conferência — ver "Como conferir o Dia
7" logo abaixo. A partir de **28/09** (7 dias depois), rode a Inspeção de URL
nas 10 acima; antes disso o veredito ainda não teve tempo de mudar.

As 7 páginas `/alternativas/*` são novidade: existem no site (conferido no
código), têm pelo menos 3 links internos cada uma — cumprem a regra de "página
nova não nasce órfã" — e o Google já as DETECTOU (achou por link/sitemap), só
falta indexar. É a categoria "Detectada, mas não indexada" inteira, sem sobrar
nenhuma.

⚠️ **Nove páginas apareceram como "Rastreada, mas não indexada" e NÃO estão na
lista acima — de propósito.** São as LPs de cidade
(`espelhar-grupos-whatsapp-brasilia/belem/goiania/campinas/belo-horizonte`) e
de nicho (`bot-ofertas-pet-shop/supermercado/moda/beleza-whatsapp`) — exatamente
as linhas que o AGENTS.md marca como **CONGELADAS** desde 30/07 (seção "SEO
orgânico — linhas CONGELADAS"): tiveram quase zero impressão quando testadas e
a decisão foi parar de investir nelas. O Google rastreou essas páginas e
decidiu, sozinho, não indexar — isso é o esperado, não um problema, e pedir
indexação nelas gastaria cota sem mudar nada (o Google já viu e escolheu não
indexar; pedir de novo não muda a decisão dele). **Não peça indexação para
essas 9.**

⚠️ **Duas outras páginas apareceram no relatório de VÍDEO (não no de
indexação), com data de rastreamento recente (16-21/09)**: isso é sinal
BOM — confirma que o Google está visitando o site ativamente agora — mas é um
relatório diferente ("por que o vídeo incorporado não virou resultado de
vídeo", não "a página está indexada"). Não precisa de ação: não afeta se a
página em si é indexada.

### Como conferir o Dia 7, a partir de 28/09

Inspeção de URL nas 10 do Dia 7. O veredito precisa sair de "Detectada" ou
"Rastreada, mas não indexada" para **"URL está no Google"**. Se
`/alternativas/*` continuar "Detectada" com "Último rastreamento: N/D" depois
de 7 dias, o problema deixa de ser indexação e passa a ser: link interno
insuficiente (a regra conta QUANTIDADE de link, não FORÇA — ver aviso em
"Página nova NUNCA nasce órfã" no AGENTS.md) ou conteúdo repetitivo demais
entre as `/alternativas/*` (mesmo risco que a rodada de 11/09 já flagou para as
páginas de loja).

**Adiantado em 23/09:** no export de 23/09, **nenhuma** `/alternativas/*` está
mais em "Detectada, mas não indexada", e três das sete do Dia 7 já têm
impressão (`afilimais` 3, `ia-divulgadora` 2, `shark` 1) — ou seja, estão
indexadas. Em 28/09 só falta conferir as quatro ainda sem impressão:
`busqy`, `afilira`, `divulga-ninja`, `afiliado-inteligente`.

### Como conferir que funcionou

Em **7 dias**, Inspeção de URL nas quatro do Dia 1. O veredito precisa sair de
"Detectada, mas não indexada" para **"URL está no Google"**. Se continuar
"Detectada" com "Último rastreamento: N/D", o problema é descoberta e o link
interno não bastou — aí a conversa é outra.

**✅ Conferido em 23/09 — Dia 1 e Dia 2 estão TODOS no Google.** Três por
Inspeção de URL (`/quanto-ganha-afiliado-shopee`, `/vendas-e-comissao-afiliado-whatsapp`,
`/copiaram-minha-oferta-no-whatsapp`: "O URL está no Google", último
rastreamento 11/09). As outras seis dispensam inspeção porque já recebem
impressão, e página com impressão está indexada: `/espelha-grupos-e-confiavel`
(36) e as cinco lojas (Shopee 61, Mercado Livre 55, Amazon 71, SHEIN 160,
Magalu 6).

### Leva de 23/09 — ✅ pedida (registrada em 23/09)

```
https://espelhagrupos.com.br/alternativas/achadinhos-bot              ✅ pedida 2026-09-23
https://espelhagrupos.com.br/alternativas/achadinho-pro               ✅ pedida 2026-09-23
https://espelhagrupos.com.br/bot-achadinhos-whatsapp                  ✅ pedida 2026-09-23
https://espelhagrupos.com.br/shopee-afiliados-whatsapp                ✅ pedida 2026-09-23
https://espelhagrupos.com.br/mercado-livre-afiliados-whatsapp         ✅ pedida 2026-09-23
https://espelhagrupos.com.br/amazon-afiliados-whatsapp                ✅ pedida 2026-09-23
https://espelhagrupos.com.br/shein-afiliados-whatsapp                 ✅ pedida 2026-09-23
https://espelhagrupos.com.br/magalu-afiliados-whatsapp                ✅ pedida 2026-09-23
https://espelhagrupos.com.br/alternativas/divulgador-inteligente      ✅ pedida 2026-09-23
https://espelhagrupos.com.br/alternativas/divulgalinks                ✅ pedida 2026-09-23
https://espelhagrupos.com.br/alternativas/lumi-ofertas-inteligentes   ⏳ deu "Tentar novamente" (cota) — vai para o Dia 8
```

### Dia 8 (2026-09-24) — ✅ pedida 2026-09-25 (8 de 9)

Tirado do export de indexação de 23/09. As quatro primeiras são as rotas
renomeadas em 19/09 que o Google **nunca rastreou** (os nomes antigos
`/…-botinho…` respondem 308 para elas) — são as de maior valor, porque carregam
a entidade da marca. As quatro seguintes ganharam links em 17/09 e nunca foram
pedidas.

```
https://espelhagrupos.com.br/protecao-antiban-espelha-grupos           ✅ pedida 2026-09-25
https://espelhagrupos.com.br/espelha-grupos-vs-planilha-manual          ✅ pedida 2026-09-25
https://espelhagrupos.com.br/alternativas/fluxopromo                    ✅ pedida 2026-09-25
https://espelhagrupos.com.br/alternativas/shozap                        ✅ pedida 2026-09-25
https://espelhagrupos.com.br/alternativas/gigi-bot                      ✅ pedida 2026-09-25
https://espelhagrupos.com.br/alternativas/bot-para-whatsapp-afiliados   ✅ pedida 2026-09-25
https://espelhagrupos.com.br/alternativas/lumi-ofertas-inteligentes     ✅ pedida 2026-09-25 (retentativa)
```

(24/09) `bot-comum-vs-espelha-grupos` e `como-funciona-espelha-grupos-canais`
saíram daqui: o texto delas mudou nas PRs #1848/#1850 e elas foram para a
**Leva R1**, que só vale depois do deploy em `main`.

### Dia 9 (2026-09-25) — ✅ pedida 2026-09-25

```
https://espelhagrupos.com.br/espelha-grupos-vs-ferramentas-genericas-automacao    ✅ pedida 2026-09-25
```

Foi **rastreada em 21/09 e não indexada**. Diferente das LPs congeladas, é uma
rota renomeada em 19/09 — vale um pedido. Se continuar fora depois disso, o
motivo é conteúdo, não descoberta.

### Duas conferências que ficaram da rodada de 23/09 (5 min cada)

1. **Bing → Inspeção de URL** em `/shopee-afiliados-whatsapp` e
   `/bot-achadinhos-whatsapp`. Decide se o Bing conhece as páginas que não
   apareceram no Explorador de sites. Se disser "não indexada", pedir
   indexação lá mesmo (o Bing aceita envio de URL).
2. **Cloudflare → AI Crawl Control → filtrar `Claude-User`** (e depois
   `Perplexity-User`), olhando os pedidos **sem sucesso**: print dos
   endereços e dos códigos (404, 301/308, 403). Decide se a falha de 70-81% é
   endereço inventado pela IA, endereço antigo ou bloqueio nosso.

---

## 2. Pesquisa de preço de concorrente — o que coletar e como

**Por que só você pode fazer:** a convenção do repo é que preço vai para
`dashboard/lib/competitors-data.js` com `verifiedAt`, **coletado por print da
página de preços do concorrente**. Foi assim com os 17 que já estão lá. Preço
que vem de resposta de IA não pode receber `verifiedAt`, e sem ficha nenhum
preço pode ser citado em página pública.

### Os dois que importam agora

| Concorrente | Por quê | Status |
|---|---|---|
| **Ofertiva** | citado nas **duas** contas do ChatGPT | ✅ **ficha criada em 22/09** — `dashboard/lib/competitors-data.js`, slug `ofertiva`, print de `ofertiva.app.br/#precos`. R$ 39,90 / R$ 69,90 / R$ 139,90 por mês, cobrança recorrente de verdade (não promo de 1º mês). Não converte Magalu; tem página na bio + Meta Pixel, que não temos. **Falta**: a página pública `/alternativas/ofertiva` (a ficha por si só não cita nada em página nenhuma) — próximo passo se você quiser. |
| **Comission** | citado como alternativa direta | ⏳ **ainda sem site encontrado.** Você não achou e eu também não achei buscando "Comission" + afiliados/WhatsApp (nem variações de grafia) — nenhum resultado bate com esse nome. Pode ser grafia diferente da que o ChatGPT usou, ou o produto pode ter saído do ar/trocado de nome. Se você tiver o link de onde a IA citou (ou um print da resposta), mando eu mesma atrás; sem isso não tem como confirmar preço nem criar ficha. |

### O que coletar de cada um (print da tela, não texto copiado)

1. **Página de preços inteira**, com todos os planos visíveis.
2. Para cada plano: **nome, preço recorrente e preço promocional de 1º mês**, se
   houver. ⚠️ Este é o ponto que mais engana — todos os planos do Promium
   anunciam promocional no primeiro mês, e comparar pelo promocional é comparar
   coisa diferente. Por isso a ficha dele guarda os dois números.
3. **O que limita a faixa de preço**: número de grupos, número de conexões de
   WhatsApp, número de lojas.
4. **Quais lojas ele converte** (é onde eles nos ganham hoje).
5. **Tem Telegram?** (10 dos 14 concorrentes têm — é paridade cobrada).
6. **A data da coleta.**

### Os outros dez, sem ficha e sem preço citável

Se sobrar tempo, na ordem: RealLead, OrbitSender, Ripply, LucreZap, Garimpa
Links, Achify, Zaffo, AffiliSend, AutoLinks, Afiliado Analytics.

Enquanto não tiverem ficha, **nenhum preço deles pode aparecer em página
pública** — nem numa comparação.

### ⚠️ Lembre que são dois mercados diferentes

Os concorrentes que as **IAs** citam (Ofertiva, Comission, Promium…) são
**quase disjuntos** dos que aparecem no **Search Console** (AchadinhosBot,
Achadinho Pro, FluxoPromo, Shozap). Só o segundo grupo tem página nossa
disputando hoje. Não existe "o ranking do mercado": existe o ranking de cada IA.

---

## 3. Medição da próxima rodada

### 3.1 Repetir as 11 consultas ao ChatGPT — este é o teste da hipótese inteira

Toda a rodada P0 partiu de uma hipótese: **a IA lê o nosso site, e o nosso site
estava errado**. O ChatGPT dizia de nós, textualmente, que não servimos para
responder "qual oferta me deu R$ X de comissão", citando o próprio site.

Refaça as mesmas 11 perguntas, nas **mesmas duas contas**, cerca de **30 dias
depois do deploy em produção**.

- Se passarmos a ser citados → a hipótese estava certa e vale continuar
  produzindo para esse canal.
- Se continuar igual → o problema é **autoridade**, não conteúdo, e o plano
  muda. Melhor descobrir com dado do que produzir mais cinco páginas.

### 3.2 Search Console — mês fechado

No começo de outubro, só o Relatório 1, comparando contra o baseline de 01/09:
177 cliques, 5.773 impressões, 115 consultas distintas.

**Não refazer Planejador e Trends agora.** Os dois medem volume de mercado, que
não muda em semanas. Rodada completa só em outubro.

### 3.3 TikTok Shop

Apareceu com +650% nas consultas em ascensão de `afiliado shopee`. **Isso não é
volume** — é aceleração sobre base que pode ser mínima. Medir no Planejador na
próxima rodada, não virar frente agora.

---

## 4. As três decisões que são suas, não minhas

### 4.1 Quando reiniciar o `bot-supervisor` (destrava a P1-4)

A P1-4 (registrar loja não suportada, e consertar o link que some em silêncio)
está detalhada em `docs/produto/backlog-p1-4-loja-nao-suportada.md`. Ela mexe em
código de robô, e em modo `remote` isso **reconecta todas as sessões de WhatsApp
de uma vez**. Precisa de janela anunciada.

O defeito que ela conserta é real e independente do resto: hoje uma oferta cujo
único link é de loja não suportada é **publicada sem o link**, em silêncio.

### 4.2 Telegram: sim ou não

- **A favor:** 10 dos 14 concorrentes têm. É paridade cobrada em comparação.
- **Contra:** a intenção de busca é quase toda de quem quer **entrar** num
  grupo, não automatizar um — ~8.950/mês contra **50/mês** de
  `bot telegram afiliados`. Razão de **179:1**.
- O argumento que eu mesmo usei antes para promovê-lo (não consumir vaga de
  robô) **morreu** quando você disse que o teto é 40 e expansível.

### 4.3 Branch protection (pendência antiga, só admin resolve)

`develop` e `main` ainda **não exigem** os checks `quality` e `no-undef` verdes
para permitir merge. Foi assim que duas PRs com lint vermelho entraram no mesmo
dia e quebraram staging (pegadinha #10). Nenhum agente de IA tem permissão para
configurar isso.

GitHub → Settings → Branches → Branch protection rules → (`develop` e `main`) →
"Require status checks to pass before merging" → marcar `quality` e `no-undef`.
