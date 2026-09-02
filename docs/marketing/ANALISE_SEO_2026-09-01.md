# Análise SEO — 01/09/2026 (comparação com 16/08 e com o baseline de 30/07)

Fonte: export do Search Console de 01/09/2026, filtro "Últimos 3 meses" (mesma
janela e mesma metodologia das duas rodadas anteriores: **soma da aba Países**).
Somado a isso, dois diagnósticos próprios rodados no VPS de produção
(`diag-origem-cadastros.mjs` e `diag-paginas-seo.mjs`, janela de 30 dias) e o
relatório de **Cobertura/Indexação**, que não existia nas rodadas anteriores.

**Escopo:** Relatório 1 (Search Console) + Relatório 4 (referrals de IA, já
automatizado). Planejador e Trends **não** foram refeitos — a rodada completa
continua marcada para início de outubro.

---

## 1. Os números

| Métrica | 30/07 | 16/08 | **01/09** | vs. 16/08 |
|---|---:|---:|---:|---:|
| Cliques | 40 | 93 | **177** | +90% |
| Impressões | 1.102 | 2.902 | **5.773** | +99% |
| CTR | 3,63% | 3,20% | **3,07%** | −0,13 p.p. |
| **Consultas distintas** | 13 | 29 | **115** | +297% |
| Páginas com impressão | 60 | 77 | **79** | +2 |
| Posição média (Brasil) | 7,85 | 7,60 | **7,68** | estável |

Por mês fechado, que é a leitura mais limpa:

| Mês | Cliques | Impressões |
|---|---:|---:|
| Junho | 8 | 365 |
| Julho | 33 | 656 |
| **Agosto** | **136** | **4.739** |

Agosto sozinho vale **4× julho em cliques e 7× em impressões**. O salto que
começou em 04/08 (robots.txt da Cloudflare desbloqueado + IndexNow + unificação
de marca) não foi pico: sustentou-se o mês inteiro.

**Consultas distintas quadruplicaram** (29 → 115). É a métrica mais honesta de
progresso e a que mais se moveu: o site passou de "13 assuntos" em julho para
115 em agosto.

**Páginas com impressão praticamente não mudaram** (77 → 79) enquanto as
impressões dobraram. Ou seja: o crescimento veio de as MESMAS páginas
aparecerem mais, não de páginas novas entrando. Isso é importante para a seção
4 (indexação).

---

## 2. O tráfego de marca de concorrente virou o site inteiro

Em 16/08 as buscas por nome de concorrente eram 15% das impressões. Agora:

**16 consultas de marca de concorrente = 1.933 impressões = 92,3% de todas as
impressões de consulta do período — e 19 cliques.**

| Consulta | Impressões | Cliques | CTR | Posição |
|---|---:|---:|---:|---:|
| `achadinho pro` | 742 | 8 | 1,08% | 6,18 |
| `achadinhoosbot` | 367 | 1 | 0,27% | 7,04 |
| `achadinhosbot` | 275 | 0 | 0% | 6,46 |
| `achadinhos bot` | 221 | 6 | 2,71% | 6,95 |
| `achadinhopro` | 107 | 1 | 0,93% | 6,07 |
| `fluxopromo` | 98 | 0 | 0% | 5,26 |
| `shozap` | 67 | 1 | 1,49% | 6,28 |
| `achadinho bot` | 25 | 2 | 8% | 7,08 |
| `gigi promo bot` / `gigi bot` / `gigi prime bot` | 12 | 0 | 0% | 5,8–7,7 |

`achadinho pro` é hoje a **maior consulta do site** e nem existia no relatório
de 16/08. As páginas que a atendem:

| Página | Impressões | Cliques | CTR | Posição |
|---|---:|---:|---:|---:|
| `/alternativas/achadinhos-bot` | 1.281 | 17 | 1,33% | 6,48 |
| `/bot-achadinhos-whatsapp` | 1.234 | 34 | 2,76% | 7,31 |
| `/alternativas/achadinho-pro` | 270 | 7 | 2,59% | 5,56 |
| `/alternativas/bot-para-whatsapp-afiliados` | 169 | 3 | 1,78% | 12,87 |
| `/alternativas/fluxopromo` | 133 | 0 | 0% | 5,42 |
| `/alternativas/shozap` | 98 | 1 | 1,02% | 6,61 |
| `/alternativas/proafiliados` | 51 | 0 | 0% | 5,84 |
| `/alternativas/gigi-bot` | 54 | 1 | 1,85% | 15,57 |

A linha `/alternativas/` foi produzida entre 16/08 e hoje, exatamente como a
recomendação nº 3 da rodada anterior mandava — e funcionou para trazer
impressão. Sete páginas de comparação estão em **posição 5–7 na média**.

**O problema não mudou de lugar, ficou maior.** 1.933 impressões de intenção
altíssima rendendo 19 cliques (CTR de ~1%). Em 16/08 eram 443 impressões e 4
cliques. Multiplicamos a exposição por 4,4 e mantivemos o mesmo CTR ruim.

⚠️ Estar em posição 5–6 com CTR de 1% significa uma coisa só: **o título e a
descrição não estão dizendo, na página de resultado, que aqui existe uma
alternativa.** Quem digita `achadinho pro` quer o Achadinho Pro; o único jeito
de ganhar esse clique é o título prometer comparação honesta — sem se passar
pelo concorrente e sem prometer o que ele não entrega.

---

## 3. Dinheiro parado: 879 impressões com zero clique

Dez páginas com 20+ impressões e **nenhum** clique:

| Página | Impressões | Posição |
|---|---:|---:|
| `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` | 344 | 7,28 |
| `/programa-de-afiliados` | 149 | 8,81 |
| `/alternativas/fluxopromo` | 133 | 5,42 |
| `/blog/como-divulgar-ofertas-mercado-livre-whatsapp` | 56 | 10,46 |
| `/alternativas/proafiliados` | 51 | 5,84 |
| `/anti-ban-whatsapp` | 36 | 19,31 |
| `/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero` | 33 | 11,21 |
| `/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo` | 28 | 7,93 |
| `/blog/quanto-custa-bot-para-whatsapp-afiliados` | 26 | 4,35 |
| `/blog/como-converter-link-de-afiliado-automaticamente-whatsapp` | 23 | 6,61 |

**Nenhuma das sete páginas apontadas em 16/08 foi consertada** — as três que
sobreviveram (`melhores-horarios`, `/programa-de-afiliados`,
`/alternativas/fluxopromo`) continuam em zero e agora com o DOBRO de impressão
desperdiçada. `/blog/quanto-custa-bot-para-whatsapp-afiliados` está em **posição
4,35** e não recebe um clique: é o caso mais gritante da lista.

Para calibrar, as páginas que convertem impressão em clique hoje:

| Página | Impressões | Cliques | CTR |
|---|---:|---:|---:|
| `/` | 232 | 46 | **19,83%** |
| `/bot-afiliados-whatsapp` | 128 | 13 | **10,16%** |
| `/padronizar-divulgacao-afiliado-whatsapp` | 31 | 3 | 9,68% |
| `/automatizar-divulgacao-em-grupos-whatsapp` | 236 | 20 | 8,47% |

### Celular continua convertendo metade do computador

| Dispositivo | Impressões | Cliques | CTR | Posição |
|---|---:|---:|---:|---:|
| Computador | 2.446 | 106 | **4,33%** | 11,32 |
| Celular | 3.296 | 71 | **2,15%** | 7,07 |

Idêntico ao diagnóstico de 16/08, e agora com uma pista nova: no celular a
posição média é **melhor** (7,07 contra 11,32) e o CTR é metade. Aparecemos mais
alto e clicam menos — isso aponta para **título cortado na tela pequena**, não
para público diferente. Conferir os títulos acima de 60 caracteres deixou de ser
hipótese e virou a explicação mais provável.

---

## 4. NOVO: um terço das páginas não está indexado

Primeira rodada com o relatório de Cobertura. Em 27/08: **77 indexadas contra 51
não indexadas.**

| Motivo | Páginas | Leitura |
|---|---:|---|
| Rastreada, mas não indexada | 26 | o Google leu e decidiu não indexar |
| Detectada, mas não indexada | 11 | está na fila (validação já aprovada) |
| Página alternativa com tag canônica adequada | 9 | normal, é canônico funcionando |
| Excluída por `noindex` | 4 | intencional |
| **Bloqueada pelo robots.txt** | **1** | ⚠️ conferir se é intencional |

As 26 "rastreada, mas não indexada" são o número que importa: o Google visitou e
achou que a página não acrescenta nada ao índice. Como as impressões dobraram
sem páginas novas entrarem (seção 1), é aqui que está o teto do crescimento
atual. Causa típica: páginas muito parecidas entre si — exatamente o risco da
produção em série de `/alternativas/` e das LPs de cidade/nicho já congeladas.

A linha "Bloqueada pelo robots.txt" é uma página só e pode ser intencional, mas
precisa ser conferida — o `robots.txt` da Cloudflare já veio ligado por engano
uma vez.

Conferência do bloqueio das IAs feita nesta rodada: **`0` — segue desbloqueado.**

---

## 5. O que os dados próprios mostram (e o Search Console não mostra)

30 dias, produção, via `diag-origem-cadastros.mjs` e `diag-paginas-seo.mjs`.

**72 cadastros, 7 pagantes, 6,2 dias entre cadastro e primeiro pagamento.**

### A descoberta da rodada: o ChatGPT converte muito melhor que o Google

| Origem | Visitas | Cadastros |
|---|---:|---:|
| Google (busca) | 211 (70% das visitas) | — |
| **ChatGPT** | **55 (18% das visitas)** | **31 (43% dos cadastros)** |
| TikTok | 17 | — |
| Instagram / Bing / Brave / Claude / Facebook | 19 | — |

O ChatGPT carimba `utm_source=chatgpt.com` no link, então esses 31 cadastros são
rastro direto, não inferência. **18% das visitas viram 43% dos cadastros.** O
Google traz quase 4× mais gente e não aparece com nada perto disso.

⚠️ Não é comparação perfeita — a visita vinda do Google raramente carrega
etiqueta, então parte dela se esconde em "landing" e "direct". Mas a ordem de
grandeza é grande demais para ser só atribuição: quem chega por uma resposta de
IA já veio decidido, e quem chega pelo Google veio pesquisando.

**Consequência prática:** o trabalho de ser citado pelas IAs (Relatório 4 /
`AI_SEO_MONITORAMENTO_MENSAL_PLAYBOOK.md`) deixou de ser aposta de futuro — é
hoje o canal que mais traz cliente. Merece o mesmo esforço que o SEO clássico.

### Conteúdo é o que traz pagante

- **38%** dos cadastros entraram por página de conteúdo (ninguém digita
  `/blog/...` de cabeça — é SEO com alta confiança).
- Desses 7 pagantes, **6 (86%)** entraram por página de conteúdo.

O conteúdo não traz só volume: traz quem paga.

### O funil por página confirma onde está o gargalo

| Página | Impressões (Google) | Visitas | Clique em CTA | Cadastros |
|---|---:|---:|---:|---:|
| `/bot-achadinhos-whatsapp` | 1.234 | 42 | 18 (42,9%) | **10** |
| `/alternativas/achadinhos-bot` | 1.281 | não medido | — | não medido |
| `/bot-ofertas-afiliados-whatsapp` | 37 | 21 | 6 (28,6%) | 6 |
| `/automatizar-divulgacao-em-grupos-whatsapp` | 236 | 15 | 6 (40%) | 8 |

`/bot-achadinhos-whatsapp` é a prova: quando a pessoa chega, **43% clicam no CTA
e 10 viraram cadastro**. A página funciona. O que falta é clique no Google.

⚠️ **A linha de `/alternativas/achadinhos-bot` não é comparável com as
outras.** As páginas `/alternativas/*` disparam `comparison_page_view`, e
`scripts/diag-paginas-seo.mjs` lia só `organic_page_view` — o script era cego
para elas. O dado existe no banco; a leitura é que não o alcançava. **O funil
dela não foi medido nesta rodada**, e o número acima não diz nada sobre a
página. Corrigido em 02/09: o diagnóstico passou a ler os três eventos de
comparação, inclusive `comparison_scroll_50`, que separa "o título ganhou o
clique e a página perdeu a pessoa" de "ninguém clicou no Google".

⚠️ **`/precos`: os 19 visitantes e o "zero clique em CTA" NÃO sustentam a
conclusão que estava aqui.** Os botões "Assinar Basic" e "Assinar Pro"
(`components/landing/Pricing.jsx`) não tinham `data-seo-cta`, e o
`OrganicPageTracker` só conta clique em elemento que carrega esse atributo —
não havia o que contar. Instrumentado em 02/09; a próxima rodada é a primeira
que consegue dizer se a página converte.

---

## 6. Tier 1 continua aberto — mas deu o primeiro sinal

`shopee afiliados`, `mercado livre afiliados`, `afiliado amazon` (50.000
buscas/mês cada, concorrência baixa) somam **41 impressões, 2% do total, zero
clique**. Segue sem página nossa disputando, pelo terceiro relatório seguido.

O sinal novo é que duas páginas de blog começaram a pegar a periferia do tema:

| Página | Impressões | Cliques | Posição |
|---|---:|---:|---:|
| `/blog/como-divulgar-ofertas-amazon-whatsapp` | 450 | 7 | 8,55 |
| `/blog/como-ser-afiliado-shopee-whatsapp` | 433 | 4 | 9,76 |

São a 3ª e a 4ª páginas com mais impressão do site, criadas depois de 16/08.
Consulta correspondente: `como divulgar link de afiliado amazon no whatsapp` (13
impressões, posição 10).

**Leitura:** o caminho para o Tier 1 já está aberto pelo conteúdo de blog. Falta
a página comercial de destino para esses termos.

---

## 7. O que fazer, em ordem

1. **Título e descrição das páginas de `/alternativas/` e de
   `/bot-achadinhos-whatsapp`.** 1.933 impressões de intenção máxima rendendo 19
   cliques. É a mesma recomendação nº 1 de 16/08, não feita, e o custo de não
   fazer quadruplicou. Maior retorno por hora de trabalho de toda a lista.
   ⚠️ Dizer "alternativa a X", nunca se passar por X, nunca prometer o que o
   concorrente não entrega sem fonte e data.
2. **Título e descrição das 10 páginas com zero clique** (879 impressões).
   Também repetida de 16/08. Começar por
   `/blog/quanto-custa-bot-para-whatsapp-afiliados` (posição 4,35!) e
   `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` (344 impressões).
3. **Conferir títulos acima de 60 caracteres.** O celular traz 57% das
   impressões, ranqueia melhor que o computador e converte metade — corte de
   título é a explicação mais provável.
4. ~~**Corrigir `scripts/diag-paginas-seo.mjs` para ler também
   `comparison_page_view`.**~~ **Feito em 02/09.** O diagnóstico passou a ler
   `comparison_page_view`, `comparison_cta_click` e `comparison_scroll_50`, e a
   aceitar o campo `page_slug`. A linha `/alternativas/*` — incluindo a maior
   página de impressão do site — deixa de ser invisível no funil.
5. **Olhar `/precos`** — 19 visitas, zero clique em CTA.
6. **Tratar as 26 páginas "rastreada, mas não indexada"** antes de produzir mais
   `/alternativas/`. Produzir mais páginas parecidas com um terço da casa fora do
   índice pode piorar o problema em vez de crescer.
7. **Abrir a frente Tier 1** com página comercial, apoiada nas duas páginas de
   blog que já ranqueiam. Continua sendo a maior oportunidade do levantamento.
8. **Tratar a citação por IA como canal principal**, não experimental — 43% dos
   cadastros vieram de lá. Rodar o playbook mensal de citação
   (`AI_SEO_MONITORAMENTO_MENSAL_PLAYBOOK.md`), que segue sem execução
   registrada desde 05/2026.

Itens 1 a 5 mexem em texto de página que já existe e já ranqueia — efeito em
dias. Itens 6 a 8 são trabalho estrutural — efeito em semanas.

---

## 8. Citação por IA — primeira medição de campo (01/09)

As 20 consultas do `AI_SEO_MONITORAMENTO_MENSAL_PLAYBOOK.md` nunca tinham sido
rodadas: `ai_visibility_tracking.csv` estava com `checked_at` vazio desde
05/2026. Nesta rodada as 7 consultas prioritárias foram medidas nas **quatro**
superfícies — ChatGPT, Gemini, Perplexity e Google AI Overviews. **28 de 28
linhas preenchidas.** Gemini foi registrado como plataforma própria, não como
AI Overviews: são superfícies diferentes e misturá-las estragaria a série.

### Placar: ChatGPT 3 de 7. Todas as outras, 0 de 7.

| Consulta | ChatGPT | Gemini | Perplexity | AI Overviews |
|---|---|---|---|---|
| postar em vários grupos sem spam | ✅ **1º lugar** | ❌ | ❌ | ❌ |
| padronizar divulgação de cupons | ✅ 2º lugar | ❌ | ❌ | ❌ |
| BOTinho preço | ✅ **preço correto** | ❌ calçado | ❌ calçado | ❌ calçado |
| bot para afiliados no WhatsApp | ❌ | ❌ | ❌ | ❌ |
| ferramenta para divulgar ofertas | ❌ | ❌ | ❌ | ❌ |
| espelhar mensagens entre grupos | ❌ | ❌ | ❌ | ❌ |
| BOTinho metodologia | ❌ | ❌ **inventou** | ❌ (honesta) | ❌ **inventou com fontes** |

### O ChatGPT nos conhece. As outras três não fazem ideia de que existimos.

Isso bate exatamente com a seção 5: **43% dos cadastros vêm do ChatGPT** e
nenhum das outras. Não é sorte de amostra — é reconhecimento de marca medido em
duas fontes independentes.

No ChatGPT, `BOTinho preço` devolve **R$69/30 dias e teste de 7 dias sem
cartão**, com link. Ele ainda apontou uma lacuna real que não tínhamos visto: **o
preço do plano Basic não está legível na página**.

### Três das quatro IAs acham que somos calçado infantil

`BOTinho preço` devolve:

- **Gemini** — colônia de férias do Corpo de Bombeiros, calçado infantil, rede
  de pesca de nylon;
- **Perplexity** — botinha de bebê (R$40–200) e kits "Boti Baby" do Boticário;
  pediu para a pessoa esclarecer se era calçado "ou algum produto chamado
  BOTinho";
- **Google AI Overviews** — *"calçados infantis da marca Botinho custam entre
  R$49,99 e R$109,99"*, com links para Pittol, Centauro e Amazon.

Não é ruído: é o nome. O `AGENTS.md` já registrava o risco do homônimo desde a
pesquisa de domínio ("a busca por 'botinho' puro devolve calçado") — agora está
medido em três superfícies. **Escrever "BOTinho" sozinho em texto público
entrega a consulta para uma fábrica de calçados.**

### O vazio de conteúdo vira alucinação — e o pior caso é o do Google

Em `BOTinho metodologia WhatsApp`:

- o **AI Overviews** inventou uma "Metodologia BOTinho" com pilares nomeados
  (Atração e Gatilho, Qualificação, Fluxo de Valor, Integração CRM, Transição
  Humana) **e citou fontes para sustentá-la**. Alucinação com aparência de fato
  verificado, na superfície de maior alcance;
- o **Gemini** fez o mesmo, sem fontes;
- a **Perplexity** foi a única honesta: disse que "BOTinho" não é uma metodologia
  reconhecida e pediu o material.

Página que não existe de forma citável não fica neutra. O espaço é preenchido, e
entregue a quem perguntou pela marca.

### Espelhamento: a categoria existe e não estamos nela

A **Perplexity** foi a única a tratar espelhamento como **categoria de produto
com nome próprio** — "espelhador de grupos" — e listou concorrentes que a
oferecem, chegando a descrever o menu de outro produto. É a consulta que mais se
parece com o que fazemos, e não aparecemos em nenhuma das quatro.

No **AI Overviews** a mesma consulta cita **uma ferramenta só** (WHAMetrics
Bridge). É a consulta com menos concorrência de citação das sete — o alvo mais
barato do levantamento.

### Cupom: três das quatro leram como CRM, não como afiliado

Gemini, Perplexity e AI Overviews responderam `como padronizar divulgação de
cupons` com ManyChat, WATI, Blip, Zenvia, RD Station, Kommo, SleekFlow,
AiSensy — atendimento corporativo. Nenhuma ferramenta de afiliado. **Só o
ChatGPT entendeu o contexto certo — e é exatamente onde somos citados.**

### As quatro IAs discordam por completo numa consulta

`como postar em vários grupos sem spam` é onde o ChatGPT nos coloca em primeiro
lugar com recomendação explícita. Gemini, Perplexity e AI Overviews não citam
**ferramenta nenhuma** ali: respondem com Comunidades do WhatsApp, API oficial e
aviso de banimento. É a consulta de maior valor comercial das sete e a de
leitura mais oposta entre as superfícies.

### O mapa de concorrentes está desatualizado

Nomes citados pelas IAs e ausentes do nosso mapa: **Promium, GoGoBot, OfertaFlux,
FluxZap, Ripply, Núcleo do Afiliado, DivulgaNinja, DivulgaLinks, Afilimais, Lumi
Ofertas, Whats.Ly, Notifish, Radar das Promos, ZincLink, Ofertiva, Busqy,
BotAdmin, Afiliados Pro Bot, GeekZap, HouSoft, WHAMetrics Bridge**. O ChatGPT
chamou o **Promium** de "o mais completo" na consulta de cupons, à nossa frente.

⚠️ Duas observações que mudam o mapa:

1. a lista que as IAs citam é **quase disjunta** da que o Search Console mostra
   (AchadinhosBot, Achadinho Pro, FluxoPromo, Shozap). São dois mercados
   diferentes, e só um tem página nossa disputando;
2. as listas das próprias IAs **quase não se sobrepõem entre si** — ChatGPT e
   Perplexity não citaram um único nome em comum na consulta de ferramentas. Não
   existe "o ranking do mercado": existe o ranking de cada IA.

### O que fazer com isso

1. **Expor o preço do Basic** na página de preços, em texto legível por robô —
   apontado pela própria IA, conserto de minutos.
2. **Publicar a metodologia** como página citável (passos numerados, definições,
   nome próprio). É o que o Google está preenchendo com invenção agora.
3. **Sempre qualificar a marca** ("BOTinho WhatsApp", "Espelha Grupos") em todo
   texto público. Três de quatro IAs entendem "BOTinho" como calçado.
4. **Atacar `espelhar mensagens entre grupos`** — nossa categoria principal, e a
   consulta com menos concorrência de citação das sete.
5. **Amarrar o vocabulário de cupom ao contexto de afiliado**, não ao de
   atendimento — foi assim que três IAs erraram a intenção.
6. **Mapear os concorrentes novos**, começando por Promium.

Registro completo, consulta por consulta e plataforma por plataforma, em
`docs/marketing/ai_visibility_tracking.csv`.

---

## 9. O que não foi refeito (e por quê)

| Relatório | Refeito? | Motivo |
|---|---|---|
| 1 — Search Console | ✅ | única fonte que se move em duas semanas |
| 2 — Planejador de palavras-chave | ❌ | mede volume de mercado; decisões congeladas no `AGENTS.md` |
| 3 — Google Trends | ❌ | idem |
| 4 — Referrals de IA | ✅ automático | `diag-origem-cadastros.mjs` |
| Citação por IA (playbook manual) | ✅ **1ª vez, completa** | ChatGPT, Gemini, Perplexity e AI Overviews — 28/28 linhas |
| Cobertura / Indexação | ✅ **novo** | passa a fazer parte da rodada mensal |

Próxima rodada **completa** (os quatro relatórios): **início de outubro/2026**.
Até lá, mensal: Relatório 1 + Cobertura + os dois scripts de diagnóstico.
