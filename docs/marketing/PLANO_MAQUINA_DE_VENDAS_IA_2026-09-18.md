# Máquina de vendas por IA — o que fazer para o ChatGPT (e Gemini, Perplexity, AI Overviews) indicarem o Espelha Grupos

Data: 2026-09-18. Levantamento feito por 6 leitores em paralelo (docs de
marketing, código do site, site ao vivo, mecânica do ChatGPT com fontes de
2025-2026, onde os concorrentes aparecem, diretórios e comunidades) + buscas
reais nas consultas que uma afiliada faz + síntese + 3 críticos (já foi feito?
a mecânica está certa? vira venda?). Tudo abaixo cita a evidência. O que não
tem evidência não entrou.

**Ao abrir a próxima análise, comece por este arquivo e pelo
`REGISTRO_EXECUCAO_2026-08-16_A_09-02.md`.** Três análises seguidas (01/09,
10/09, 11/09) propuseram criar páginas que já existiam — ver AGENTS.md "O Tier
1 JÁ FOI EXECUTADO".

---

## 0. A resposta em dez linhas

1. **A IA não indica quem ela não vê em OUTROS sites.** Marcas são citadas
   6,5× mais via terceiros (listas "melhores X", comparativos, reviews, YouTube,
   Reddit) do que pelo próprio site. O Espelha Grupos tem **zero** presença de
   terceiros registrada; os 8 alvos de `ai_seo_presence_targets.csv` estão
   "planned" desde 05/2026. É a única alavanca grande que nunca foi puxada.
2. **O ChatGPT já é o canal que mais vende** (35-43% dos cadastros com
   `utm_source=chatgpt.com`, índice de qualidade 2,69×). Ele cita quando a
   pergunta é de categoria (3 de 7 em conta neutra). Gemini, Perplexity e AI
   Overviews citam **zero** nas consultas de categoria — e não é bloqueio:
   os robôs deles passam. É falta de sinal de terceiros e de entidade.
3. **O nosso lado tinha contradições que a IA lia** e foram consertadas hoje:
   `og:image` inexistente (404), FAQ e planos públicos dizendo 4 lojas (são 6),
   home com "4 lojas, mais chegando", `llms.txt` sem preço, medição de origem
   por IA desligada em 47% das impressões. Tudo em `develop` (commits
   5322852 e f287836).
4. **GPTBot e ClaudeBot estão barrados no WAF da Cloudflare** com o
   `robots.txt` limpo. Isso **não** impede citação (o robô de busca passa), mas
   impede o próximo modelo de aprender a marca. Decisão sua, 10 minutos no
   painel, sem código.
5. **`llms.txt` e schema não trazem citação sozinhos** (evidência forte:
   correlação zero em 300 mil domínios; Google diz que não usa). Servem para
   não contradizer. Já estão certos — não gastar mais tempo neles.
6. **O que vira citação, na ordem do peso medido:** menções em YouTube
   (correlação 0,737, o sinal mais forte), menções da marca em sites de
   terceiros (0,664), páginas "melhores X" de terceiros (43,8% das citações
   de topo de funil), frescor (conteúdo citado é 25,7% mais novo; atualização
   em <3 meses dobra a chance), texto com estatística/citação/quote nas
   primeiras linhas (+28-43%).
7. **O que vira VENDA é outra coisa:** a IA escolhe um produto por preço,
   avaliação e "melhor para <caso>". Hoje nenhuma página nossa diz "melhor
   para" e não existe avaliação de terceiros em lugar nenhum (Reclame Aqui,
   diretório, Google). Quem chega pela IA cai na home (12% de cadastro) ou
   numa comercial (15-30%); a comparação converte 0%.
8. **Ordem de ataque:** (a) presença em terceiros — 3 listas, 2 diretórios,
   canal do YouTube com o nome certo, 1 thread por mês; (b) decisão da
   Cloudflare; (c) indexação pendente (23 URLs + os lotes B e D esquecidos);
   (d) medição completa do roteiro (40 linhas, conta neutra) — hoje não existe
   dado depois de 11/09; (e) "melhor para" e prova de terceiros nas páginas
   que a IA já cita.
9. **Não fazer:** página nova de cidade/nicho/comparação, medir "BOTinho",
   prometer "não bane", anúncio antes de LTV, mais `llms.txt`/schema.
10. **Como saber se funcionou em 30 dias:** placar do roteiro de medição
    (Trilha A de 3/7 para ≥5/7 no ChatGPT; Gemini/Perplexity/AIO de 0 para
    ≥1), cadastros com carimbo de IA (42/mês → 60), primeira menção de
    terceiro registrada no CSV, `node scripts/diag-acesso-robos-ia.mjs` sem
    403 nos robôs de busca.

---

## 1. O que está medido hoje (não re-estimar)

Fonte: `ai_visibility_tracking.csv` (87 linhas, 3 rodadas), `ANALISE_SEO_2026-09-11.md`,
`ROTEIRO_MEDICAO_IA.md`.

| Medida | Valor | Onde |
|---|---|---|
| ChatGPT Search, consultas de categoria, conta neutra | **3 de 7** ("espelhar mensagens" = 1ª escolha; "postar sem spam" = 1º sozinho) | CSV 10/09 |
| Gemini / Perplexity / AI Overviews, categoria | **0 de 28** medições | CSV 01/09 + 10/09 |
| Marca ("espelha grupos …"), 4 superfícies | 9 sim + 1 parcial em 16 (2 das 9 em conta logada) | CSV 11/09 |
| "espelha grupos whatsapp o que é" | **0 de 4** — o conceito é nosso, o crédito não | CSV 11/09 |
| Cadastros com carimbo de IA (30 dias) | 42 de 119 (35%); 01/09 era 31 de 72 (43%) | ANALISE 11/09 |
| Visita → cadastro por tipo de página | comercial 15,4% · home 12,1% · **comparação 0,0%** (147 visitas) | ANALISE 11/09 |
| Cadastro → pagante | 119 → 12 (10%); 58% dos pagantes entraram por conteúdo | ANALISE 11/09 |
| Concorrentes citados pelas IAs | 95 nomes; top: Achadinho Pro 11, ProAfiliados 11, Afilira 10, Ofertiva 9, Shozap 9, GoGoBot 6 | CSV |
| Concorrentes com ficha de preço nossa | 8 de 95 (Afilira, Ofertiva, GoGoBot **sem** ficha) | competitors-data.js |
| Última medição de qualquer coisa | **11/09** — 7 dias sem dado | git log + CSV |

O que a Perplexity disse, literalmente, que falta para nos citar (CSV linha
68): (1) presença em comparações recentes publicadas por **terceiros**; (2)
documentação pública clara de funcionalidades, preços e integrações; (3)
**múltiplas fontes independentes** citando a ferramenta como ativa. O item 2
já existe e provou funcionar (ChatGPT e Gemini leram `pricing.md`). Os itens
1 e 3 têm **zero** execução.

---

## 2. Como o ChatGPT decide quem citar e quem recomendar (com evidência)

Fontes lidas em 18/09 (URLs na seção 9). Resumo do que muda a decisão:

**Com busca ligada** (o modo que cita produtos): o ChatGPT reescreve a
pergunta em várias consultas, recupera ~33 URLs por pergunta via Bing +
OAI-SearchBot e cita ~metade. 30 domínios concentram 67% das citações; 85%
das páginas recuperadas nunca são citadas. Página fora do índice do Bing
tende a não ser citada — **o Bing Webmaster Tools nunca foi verificado por
nós** (gap).

**Sem busca**: responde do treino. Em 8 de 8 consultas devolveu zero produtos
nomeados. Com GPTBot barrado, isso não muda com o tempo.

**O que pesa, em ordem (correlações medidas em dezenas de milhares de marcas):**

| Sinal | Peso | Fonte |
|---|---|---|
| Menções da marca em **YouTube** | 0,737 (o mais forte) | Ahrefs, 75 mil marcas |
| Menções da marca em sites de terceiros | 0,664 | Ahrefs |
| Backlinks | 0,22 | Ahrefs |
| Páginas "melhores X" de terceiros | 43,8% das páginas citadas em topo de funil de software | Ahrefs |
| Marca citada via terceiros vs. próprio site | 6,5× | AirOps + Indig |
| Frescor | citado é 25,7% mais novo; ChatGPT cita páginas 393-458 dias mais novas; atualizar em <3 meses dobra a chance | Ahrefs, SE Ranking |
| Forma do texto | estatística, citação e quote: +28-43%; 44% das citações vêm dos primeiros 30% da página | paper GEO (KDD 2024), Growth Memo |
| `llms.txt` | **zero** (97% nunca lidos; Google não usa) | Ahrefs 300 mil domínios |
| Schema/JSON-LD sozinho | **zero** | Ahrefs 1.885 páginas |

**Brasil:** o ChatGPT tem ~99% do tráfego de IA generativa; cita Reddit 3-4×
mais que nos EUA (9% das citações) e Wikipédia 4× menos; domínios `.com.br`
quase não aparecem. **Gemini e AI Overviews** saem do índice do Google
(página indexada, com snippet; só 38% das citações do AIO vêm do top-10).
**Perplexity** tem índice próprio e é a que mais cita Reddit.

**"Ser citado" ≠ "ser recomendado":** só 6-27% das marcas mais mencionadas
são também fontes. Para recomendar UM produto a IA pesa preço, avaliações e
adequação ao caso ("melhor para"); com specs iguais, recomenda a marca
conhecida 100% das vezes. Recomendação move tráfego real: 2,5× mais visitas e
o dobro de engajamento.

**Dois limites honestos:** todos os estudos são correlacionais e centrados
em inglês; os padrões mudam em semanas (Reddit caiu de 60% para 10% das
respostas do ChatGPT em um mês). Por isso a medição própria (seção 7) manda
mais que qualquer número daqui.

---

## 3. O que estava errado do nosso lado e foi consertado hoje (18/09)

Tudo em `develop`, commits `5322852` e `f287836`, testes verdes (3.688), build
do dashboard verde. Detalhe no AGENTS.md, seção "Robôs de IA barrados no WAF".

| Achado | Prova | Conserto | Guarda |
|---|---|---|---|
| `og:image` de 7 templates (inclusive as 5 páginas de loja) apontava para `/api/public/og`, rota que nunca existiu — **404 em produção**; home sem imagem | `curl` 404 | `dashboard/public/og-default.png` (1200×630) + `buildOgImageUrl` + home/layout | `test/og-image-existe.test.js` |
| `/api/public/faq` e `/api/public/plans` (abertos para as IAs) diziam **4 lojas**; a home hidratava com esse texto | `curl` em produção | migration DML guardada (só troca linha ainda igual ao seed) | `test/public-faq-plans-sync.test.js` |
| Home "4 lojas, mais chegando"; título da comercial que mais converte, 3 comparativos e 1 post com "4 lojas" | grep | 6 lojas, títulos mantêm o padrão com número | `test/inbound-titulos-clique.test.js` |
| `llms.txt` em inglês, sem preço, sem lojas, sem as páginas que convertem; Perplexity preenchia nosso preço com o de concorrente | leitura | reescrito (resumo pt-BR, preços, 6 lojas, Tier 1, /precos, comparações) | `test/llms-txt-sync.test.js` (toda URL existe no registro) |
| `/alternativas/*` e blog (47% das impressões) não mediam chegada por IA nem gravavam a landing do cadastro; Tier 1 caía em "Direto / ambíguo" | código | `PublicReferralTracker`; `signupOrigin` reconhece Tier 1 e páginas de 11/09; grok/deepseek/meta/mistral | `test/referral-tracking-cobertura.test.js`, `test/admin-funnel.test.js` |
| Schema: `WebSite` com codinome `WABOT`; LPs com `alternateName` igual ao nome; `/precos` com 4 lojas; páginas de loja sem data (promium com data anterior à criação) | grep | `WebSite #website`, `@id`, `inLanguage`, `featureList`; datas | `validate:seo-consistency` |
| **GPTBot e ClaudeBot com 403 no WAF** (robots.txt limpo); checagem mensal só olhava o robots.txt | `curl -A` ao vivo | `scripts/diag-acesso-robos-ia.mjs` + regra pura + checagem mensal em 2 níveis | `test/ops-ai-bot-access.test.js` |
| Template de PR mandava usar "BOTinho" como marca principal | leitura | regra atual | — |

⚠️ **A migration e o `og-default.png` só valem em produção depois de
`develop → main`.** Em staging valem no próximo deploy automático.

---

## 4. O que só você pode fazer — em ordem, com prazo

### 4.1 Esta semana (sem código)

| # | Ação | Por quê (evidência) | Como | Tempo |
|---|---|---|---|---|
| 1 | **Decidir o GPTBot/ClaudeBot na Cloudflare** | 403 medido ao vivo; robô de treino barrado = a marca não entra no próximo modelo; concorrente que libera, entra | Cloudflare → espelhagrupos.com.br → **AI Crawl Control → Crawlers** → GPTBot: Allow; ClaudeBot: Allow (pode manter CCBot/Bytespider em Block). Se o painel mostrar "Block AI bots" legado, desligar. Depois: `node scripts/diag-acesso-robos-ia.mjs` — GPTBot tem que sair de 403 | 10 min |
| 2 | **Verificar o site no Bing Webmaster Tools** e ligar o relatório "AI Performance" | ChatGPT Search recupera via Bing; nunca conferimos se as 93 rotas estão no índice do Bing; a chave IndexNow responde 200 mas ninguém olha o resultado | bing.com/webmasters → adicionar site (importar do Search Console) → enviar sitemap → Site Explorer → anotar páginas indexadas no CSV | 30 min |
| 3 | **Renomear o canal do YouTube** de `@botinhoafiliado` para Espelha Grupos e pôr nome + preço + site na descrição de cada vídeo | menções em YouTube são o sinal mais forte (0,737); o canal hoje carrega o nome aposentado e é o único `sameAs` além do WhatsApp | YouTube Studio → Personalização → nome/handle; descrição padrão: "Espelha Grupos — bot para afiliadas espelhar ofertas no WhatsApp. 6 lojas. R$39/mês, 7 dias grátis. espelhagrupos.com.br" | 20 min |
| 4 | **Fechar a fila de indexação** — os 23 endereços pendentes + os lotes B e D que a fila de 11/09 esqueceu (`/padronizar-divulgacao-afiliado-whatsapp`, melhor CTR do site com 9,68%, e mais 4) | metodologia com 1 impressão vira alucinação; Tier 1 zerado por 9 dias por falta de pedido | Search Console → Inspeção de URL → 10/dia; registrar veredito das 4 páginas do Dia 1 (venceu hoje) em `ACOES_FLAVIA_2026-09-11.md` | 3 dias × 15 min |
| 5 | **Rodar a rodada COMPLETA do roteiro de medição** (10 consultas × 4 superfícies, conta neutra, ChatGPT com busca) | não existe dado depois de 11/09; a Trilha A nunca foi medida com o site atual; sem linha de base nada abaixo é avaliável | `ROTEIRO_MEDICAO_IA.md`; registrar Trilha C como `contaminacao`; anotar QUEM foi citado e a URL | 2 h |

### 4.2 Próximas 4 semanas (presença em terceiros — a alavanca nunca puxada)

Regra de linguagem em TODO lugar (é o que amarra a entidade): **"Espelha Grupos
— bot para afiliadas espelhar ofertas no WhatsApp. Converte o link para o seu
código de afiliada em 6 lojas (Shopee, Mercado Livre, Amazon, Magalu, SHEIN,
AliExpress) e publica sozinho, com controle de ritmo. R$39/mês, 7 dias
grátis. espelhagrupos.com.br"**. Nunca "BOTinho" sozinho. Nunca "não bane".

| # | Ação | Por quê | Como |
|---|---|---|---|
| 6 | **Entrar em 3 listas de terceiros** "melhores bots/ferramentas para afiliados no WhatsApp" que as IAs já citam | 43,8% das citações de topo de funil; é de onde os 95 concorrentes do CSV saíram; critério 1 da Perplexity | Lista concreta na seção 5 (leitor de concorrentes). Pedido curto ao autor com o texto-padrão acima + print do painel + link de teste; oferecer o dado de benchmark próprio em troca |
| 7 | **2 diretórios com perfil indexável** (B2B Stack e Capterra/GetApp em pt-BR; Product Hunt se couber) | ferramentas que o ChatGPT nomeia têm perfil em diretório em ~100% dos casos (Quoleady); é "fonte independente" para a Perplexity | cadastro grátis; mesma descrição; preço R$39/R$69; categoria "automação de WhatsApp / marketing de afiliados" |
| 8 | **Reclame Aqui com perfil reivindicado e resposta** + pedir a 5 clientes pagantes uma avaliação no Google/diretório | recomendação pesa avaliação; hoje não existe NENHUMA avaliação de terceiros | reivindicar perfil; responder tudo; pedir avaliação só a quem já pagou (nunca fabricar) |
| 9 | **1 thread por mês em comunidade** (Reddit em português, comunidades de afiliados Shopee/ML, Quora pt) respondendo "qual bot para grupos de WhatsApp / como espelhar ofertas / como não ser banida", **identificada como fabricante** | Reddit = 9% das citações do ChatGPT no Brasil, #1 na Perplexity; threads pequenas bastam | responder com honestidade (o que faz, o que não promete, preço); link só quando pedirem |
| 10 | **1 vídeo curto por semana no YouTube** cujo título é a pergunta que a IA recebe | sinal mais forte medido | "Bot para afiliados no WhatsApp: como funciona (Espelha Grupos)", "Como espelhar grupos de WhatsApp", "Espelha Grupos: preço e planos"; legenda em pt-BR; descrição padrão |
| 11 | **Fichas datadas dos 6 concorrentes que as IAs mais citam e não têm ficha** (Afilira 10, Ofertiva 9, GoGoBot 6, Afiliado Analytics 5, Afiliados Pro Bot 4, Whats.Ly 4) | sem ficha com `verifiedAt` não pode citar preço (FR-031); Promium ganhou página com 1 citação enquanto Afilira tem 10 e nada | print de preço + data → `competitors-data.js` (código) |

### 4.3 Decisões em aberto (trade-off explícito)

- **Liberar GPTBot/ClaudeBot** — ganha: a marca pode entrar no corpus do
  próximo modelo (o ChatGPT sem busca hoje não nos conhece). Perde: o
  conteúdo público (que já é público) passa a alimentar treino. Não muda nada
  no curto prazo (ChatGPT Search já lê).
- **Regra de escrita do nome antigo** — `PLANO_ISSUES_2026-09-10` manda
  "nunca emparelhar"; o commit e3f5273 escreveu "BOTinho é o nome do robô do
  Espelha Grupos" em 3 páginas. Os dois docs se contradizem; escolher UMA
  regra e medir com a Trilha C.
- **As 5 rotas com "botinho" no endereço** (27 impressões, 1 clique) —
  renomear com redirect ou manter; mexer em endereço público é decisão sua.
- **LTV** — nunca medido; bloqueia por regra própria qualquer decisão de
  anúncio. Script read-only irmão do `diag-origem-cadastros` resolve em 1h de
  código, mas a leitura é sua.

---

## 5. Onde os concorrentes aparecem e nós não (a preencher pela rodada)

*(Seção alimentada pelos leitores "onde os concorrentes aparecem" e
"diretórios e comunidades" e pelas 6 buscas reais — ver 5.1 a 5.3.)*

---

## 6. O que fazer no código nas próximas semanas (ranqueado)

| # | O quê | Por quê | Onde |
|---|---|---|---|
| 1 | **"Melhor para <caso>" + prova de terceiros em cada página comercial e comparativa** | a IA recomenda por adequação ao caso; hoje 0 ocorrências de "melhor para"; prova de terceiros = 0 | `_preservationCommercialPages.js`, `_comparisonContent.js` (campo `bestFit` já existe por FR-032 nas comparações; falta nas comerciais) |
| 2 | **Topo das 20 páginas prioritárias no padrão citado**: resposta afirmativa nas 3 primeiras linhas (o que é, para quem, quanto custa), 1-2 números próprios com fonte, 1 citação entre aspas, cabeçalho em pergunta, seções de 120-180 palavras | 44% das citações vêm dos primeiros 30%; +28-43% com estatística/quote | comerciais, Tier 1, `/espelha-grupos-e-confiavel`, `/metodologia` |
| 3 | **Frescor programático**: "Atualizado em" visível + `dateModified` em TODAS as 93 rotas (hoje 29 sem data) e ciclo trimestral de revisão das comerciais | conteúdo citado é 25,7% mais novo; página parada perde citação | `editorial-content.js`, templates |
| 4 | **Formato "Espelha Grupos vs <concorrente>"** com tabela (preço recorrente, lojas, limite de grupos, melhor para) reaproveitando `competitors-data.js`; `ItemList` em `/melhores-bots-para-afiliados-whatsapp` | consultas comparativas são respondidas listando nomes; não existe título "X vs Y" com concorrente nomeado | `_comparisonContent.js` |
| 5 | **Validadores SEO no gate** (`validate:seo-consistency`, `validate:editorial-freshness`) | nada bloqueia hoje; foi assim que as 5 Tier 1 entraram sem data | `package.json` `quality:gate` |
| 6 | **Validador do CSV de medição** (Issue 8) | um "SIM" maiúsculo zerou o placar de 01/09; a rodada mensal nunca foi cumprida | `scripts/` + teste |
| 7 | **LTV/retenção read-only** | destrava anúncio; "a issue mais barata com maior efeito" (11/09) | script irmão do `diag-origem-cadastros` |
| 8 | `sameAs` com os perfis reais criados em 4.2 (YouTube renomeado, diretórios, Instagram/LinkedIn se existirem) + item no Wikidata | consistência de entidade (evidência indireta) | `marketing-content.js:81-84` |

---

## 7. O que NÃO fazer (derrubado por dado)

- Página nova por **cidade** (15 páginas: ~25 impressões em 2,5 meses),
  **nicho** (12: 127 impressões, 5 cliques), cluster "robô", "automação
  whatsapp"/"disparo em massa".
- **Mais páginas de comparação** até a Issue 2 decidir (converte 0% com 47%
  das impressões).
- **Criar as páginas do Tier 1** — existem desde 02/09.
- **Medir "BOTinho"** como marca (é Trilha C, contaminação).
- **Prometer "não bane"** — é o que as IAs elogiam (Gemini: "modelo sem
  promessas irrealistas"; ChatGPT: 7,5/10 pela transparência).
- **Avaliação fabricada, review falso, spam em comunidade** — além de
  proibido, a IA lê e a Perplexity já verificou "não há indícios de golpe".
- **Anúncio antes de medir LTV.**
- **Mais `llms.txt` e schema como alavanca** — manter o que existe.
- **Citar preço de concorrente sem ficha datada** (FR-031).

---

## 8. Como saber em 30 dias se funcionou

| Sinal | Hoje | Meta 18/10 | Onde medir |
|---|---|---|---|
| ChatGPT Search, Trilha A (categoria), conta neutra | 3/7 (10/09) | ≥ 5/7 | `ROTEIRO_MEDICAO_IA.md` → CSV |
| Gemini / Perplexity / AI Overviews, Trilha A | 0 | ≥ 1 cada | idem |
| "espelha grupos whatsapp o que é" | 0/4 | ≥ 2/4 | idem |
| Cadastros com carimbo de IA / mês | 42 | 60 | `node scripts/diag-origem-cadastros.mjs` |
| Cadastros vindos de `/alternativas` e blog com origem medida | 0 (não media) | > 0 | idem (novo tracker) |
| Menções de terceiros registradas | 0 | ≥ 3 listas + 2 diretórios | `ai_seo_presence_targets.csv` (status) |
| Robôs de busca com 200 | ok | ok | `node scripts/diag-acesso-robos-ia.mjs` |
| Bing: páginas indexadas | não medido | 93 | Bing Webmaster Tools |
| Home/`/precos` sem "4 lojas" em produção | após deploy em main | — | `curl` |

Rodar tudo em conta neutra. Rodada logada não entra no placar.

---

## 9. Fontes da mecânica (lidas em 18/09/2026)

- OpenAI, bots: https://developers.openai.com/api/docs/bots
- Cloudflare, AI Crawl Control e categorias de robô: https://developers.cloudflare.com/ai-crawl-control/reference/bots/ ; https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/
- Ahrefs — por que o ChatGPT cita páginas (1,4 M prompts): https://ahrefs.com/blog/why-chatgpt-cites-pages/
- Ahrefs — correlações de visibilidade em IA (YouTube 0,737): https://ahrefs.com/blog/ai-brand-visibility-correlations
- Ahrefs — listas "melhores X" (43,8%): https://ahrefs.com/blog/best-lists-research/
- Ahrefs — frescor: https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content
- Ahrefs — `llms.txt` (300 mil domínios): https://ahrefs.com/blog/llmstxt-study/ ; schema: https://ahrefs.com/blog/schema-ai-citations/
- AirOps — 2026 State of AI Search (6,5× via terceiros): https://www.airops.com/report/the-2026-state-of-ai-search
- Semrush — estudo de visibilidade (menção ≠ fonte): https://www.semrush.com/blog/ai-search-visibility-study-findings/
- Profound — Brasil (Reddit 9%): https://www.tryprofound.com/reports-guides/comportamento-de-prompts-e-citacoes-no-brasil
- Paper GEO (KDD 2024): https://arxiv.org/abs/2311.09735
- Bing — AI Performance no Webmaster Tools: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- Google — recursos de IA na Busca (sem markup especial): https://developers.google.com/search/docs/appearance/ai-features
- Perplexity — bots: https://docs.perplexity.ai/guides/bots
