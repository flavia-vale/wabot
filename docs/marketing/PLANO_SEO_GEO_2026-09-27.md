# Máquina de SEO e GEO — ser a resposta para "automação para afiliados" e "espelhamento de grupos" (2026-09-27)

Fonte: rodada de IA de 23–27/09 (10 consultas × 4 IAs, conta neutra, `.docx` de
27/09, inclusive as perguntas "o que faria você citar o Espelha Grupos?"),
Search Console de 3 meses (Consultas e Páginas), `SERIE_HISTORICA_SEO.md`,
Cloudflare 30 dias, código do repositório (registro SEO, ficha técnica,
recursos do produto). GEO = Generative Engine Optimization: aparecer, e ser
recomendado, na resposta das IAs. O que é hipótese está marcado.

Regras herdadas (não reabrir sem dado novo): linhas congeladas de
`docs/rca/seo-marketing.md` (cidade, nicho, "robô", "espelhamento de grupos"
como porta de entrada no Google, "automação whatsapp"/"disparo em massa" =
mercado corporativo); nunca prometer anti-ban; nunca "BOTinho" solto; preço de
concorrente só com ficha datada; só recurso que existe no código.

---

## 1. O placar de 27/09, consulta a consulta

✓ = citou o Espelha Grupos sem ser induzido · ~ = citou só depois de pedir
"pesquise"/"o que faria você citar" · ✗ = não citou.

| Consulta | Gemini | Perplexity | Google AIO | ChatGPT | Quem a IA cita no lugar (fonte que ela lê) |
|---|---|---|---|---|---|
| bot para afiliados no WhatsApp | ✗ | ✓ 6º ("lojas variam") | ✗ | ✓ 2º | Achadinhos Pro, Pro Afiliados, Afilira, DivulgaLinks, Shozap (páginas próprias: proafiliados.com, afilira.com, achadinhopro.com.br) |
| ferramenta para divulgar ofertas em grupos | ✗ | ✗ | ✓ 4º | ✓ 1º | Shozap, Ofertiva, DivulgaLinks, Pro Afiliados, LucreShop, Pai das Ofertas, Garimpa Links (sites próprios) |
| como espelhar mensagens entre grupos | ✓ 1º | ✓ | ✗ (sem nomes) | ✗ (sem nomes) | Z-API, Evolution API, BotConversa, WHAMetrics, Afiliado Analytics, 2Chat |
| como postar em vários grupos sem spam | ✗ | ✗ | ✗ | ~ | Comunidades do WhatsApp, extensões (WAWebSender, WA Group Sender), Z-API, Gupshup, Notifish, Whato |
| como padronizar divulgação de cupons | ✗ | ✗ | ✗ | ~ | ManyChat, WATI, Zoko, Kommo, Respond.io, SellFlux (anúncio) |
| espelha grupos o que é | ✓ | ✓ | ✓ | ✓ | (AIO cita também Achadinhos Pro "vale a pena?") |
| espelha grupos preço | ✓ | ✓ | ✓ | ✓ | Gemini: "Basic = operação manual" (errado) |
| espelha grupos é confiável | ✓ | ✗ (responde sobre a prática) | ✓ | ✓ | Perplexity: ProAfiliados, Shozap, IA Divulgadora; AIO: Achadinhos Pro "vale a pena?" e conclui "migre para curadoria própria" |
| espelha grupos metodologia | ✗ (lê como lançamento digital) | ✓ | ✓ | ✗ | Whapi, WHAMetrics, Migalhas (STJ) |
| Trilha C: BOTinho preço | calçado | calçado | calçado | "não encontrei" | nenhum concorrente herdou |

Placar: **19 de 36**. Marca 13/16. **Categoria 6/20.** Só uma consulta de
categoria tem 2 IAs nos citando espontaneamente ("como espelhar"). Duas
consultas (postar em vários grupos, padronizar cupons) têm **zero** em 4 IAs.

## 2. Por que perdemos onde perdemos (5 padrões, com a evidência)

1. **A IA lê a pergunta com outra intenção.** "Postar em vários grupos sem
   spam" e "padronizar cupons" são respondidas como problema de EMPRESA
   (Comunidades, API oficial, CRM, ManyChat, WATI). O Gemini, perguntado por
   que não nos citou em cupons: "as ferramentas citadas são 1-para-1
   (atendimento, carrinho); o Espelha Grupos atua em redes de grupos". Não é
   ausência de página: é que a pergunta, solta, não é de afiliada. Ação:
   responder essas duas de frente **para afiliada**, e medir também perguntas
   com a intenção certa (Trilha D, §6).
2. **Quem vence tem página própria com o título igual à pergunta, e é lido
   como fonte.** Gemini e AIO citam proafiliados.com, afilira.com,
   shozap.com.br, ofertiva.app.br, achadinhopro.com.br. Nós só somos fonte em
   "como espelhar" (Gemini cita espelhagrupos.com.br em 1º) e nas de marca.
   Ação: cada consulta de categoria com UMA página nossa cujo título é a
   pergunta, com resposta afirmativa nas 3 primeiras linhas, tabela e FAQ.
3. **Os índices carregam fatos velhos nossos.** Perplexity: "4 lojas", "até
   20 origens". Gemini: "WhatsApp e Telegram", "Basic = manual". Perplexity
   na tabela: "lojas suportadas variam". A ficha técnica (PR #1926) corrige
   a fonte; falta chegar a `main`, ser reindexada no Google e inspecionada no
   Bing (o ChatGPT recupera via Bing).
4. **A objeção "espelhar não vale a pena" é de concorrente e está vencendo
   na nossa marca.** AIO em "é confiável" e "o que é" cita a página do
   Achadinhos Pro e conclui "migre para curadoria própria ou IA". Perplexity
   em "é confiável" responde só sobre a prática: "arriscado e pouco
   sustentável". Nossa resposta (`/espelhar-grupos-de-ofertas-vale-a-pena`)
   está em produção desde 27/09 13:06, ainda não indexada. E a IA não sabe
   que **também temos garimpo** (ofertas automáticas da Shopee, 43 contas
   ativas) e criação de oferta a partir do link: os três modelos que a
   própria Perplexity descreve (espelhador, curadoria automática,
   formatador) existem no produto.
5. **Sem terceiros, Gemini/AIO/Perplexity não nos põem na lista.** A
   Perplexity, induzida, foi explícita de novo: comparações de terceiros,
   documentação clara, múltiplas fontes independentes. O que temos fora do
   site continua sendo zero. (Fontes de mecanismo em
   `PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md`, seção 9: YouTube 0,737,
   menções em terceiros 0,664, listas "melhores X" 43,8%.)

O que as IAs disseram, literalmente, que nos faria ser citadas: Gemini →
"referência direta em espelhamento", "filtro de palavras-chave", "preserva
imagem/vídeo/card", "Telegram → WhatsApp" (não temos, não prometer);
Perplexity → "comparativos recentes de terceiros, documentação pública de
recursos/preços/integrações, fontes independentes dizendo que está ativa";
Gemini em cupons → "redes de grupos próprios, cupom relâmpago padronizado em
todos os grupos a partir de um painel". Filtro de palavras existe
("Palavras bloqueadas", tela Espelhamento) e mídia preservada existe; nenhum
dos dois está na ficha técnica.

## 3. Posicionamento: dois pilares, uma frase

- **Pilar 1 — Espelhamento de grupos (ser o TOP 1).** É onde já somos fonte
  (Gemini 1º, Perplexity, AIO e ChatGPT na marca). Consolidar: a página que
  define o termo, a que responde "vale a pena?", a que compara os 4 caminhos.
- **Pilar 2 — Automação para afiliadas no WhatsApp.** Os três modelos que o
  mercado (Perplexity) usa para classificar: espelhador (Basic e Pro),
  garimpo automático (ofertas automáticas da Shopee, Pro) e formatador
  (criar oferta a partir do link, Basic e Pro). Só afirmar "os três" depois
  de conferir cada um na ficha (`dashboard/lib/ficha-tecnica.js`).

Frase canônica (já na ficha; ajustar para incluir os três modelos): "Espelha
Grupos é um software web para afiliadas que espelha ofertas de grupos e
canais do WhatsApp para os seus grupos, troca o link pelo seu código em 6
lojas, cria a oferta a partir de um link e (no Pro) busca ofertas da Shopee
sozinho." Nunca "Telegram". Nunca "anti-ban".

⚠️ Vocabulário e linhas congeladas: "espelhamento de grupos" continua fora dos
títulos do Google (medido em 16/09: abaixo do piso do Planejador; vizinhança
"espelhar WhatsApp em outro celular"). Nas IAs a pergunta chega com a palavra
("como espelhar mensagens entre grupos") e aí a página de resposta usa a
palavra da pergunta. "Automação whatsapp" (corporativo) segue congelada;
"automação para afiliados" é outra intenção e **ainda não tem volume medido**
(dado a coletar: 1 consulta no Planejador, §7).

## 4. O plano, por frente

Cada ação tem métrica, prazo de leitura e dono. "Código" = eu; "Flávia" = você.

### Frente A — Fatos canônicos e frescor (fecha o padrão 3)

| # | Ação | Métrica | Prazo | Dono |
|---|---|---|---|---|
| A1 | `develop` → `main` com as 7 PRs de hoje; reindexar `/`, `/precos`, `/espelha-grupos-e-confiavel`, `/alternativas/achadinho-pro`, `/programa-de-afiliados`, `/quanto-ganha-afiliado-shopee`, `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`, `/amazon-afiliados-whatsapp`; inspecionar no Bing WMT `/`, `/precos`, `/bot-afiliados-whatsapp` | Perplexity e Gemini param de dizer "4 lojas", "Telegram", "Basic manual" | próxima rodada (30 dias) | Flávia |
| A2 | Ficha técnica ganha 3 linhas que a IA pediu e existem: "Palavras bloqueadas (filtro do que não espelhar)", "Imagem/card preservados", "Criar oferta a partir de um link (formatador)" | Gemini em "o que faria citar" deixa de listar filtro/mídia como ausentes | 30 dias | Código |
| A3 | Frase canônica com os 3 modelos em: home, /precos, llms.txt, pricing.md, /quem-somos, /espelha-grupos-e-confiavel (mesma frase, byte a byte; teste já existe, só ampliar) | "o que é" 4/4 com descrição dos 3 modelos | 30 dias | Código |
| A4 | Reindexação mensal das 12 páginas-resposta (§B) toda vez que mudarem; `EDITORIAL_DATES` só quando o conteúdo muda | "Atualizado em" < 90 dias em todas | contínuo | Flávia (10/dia) |

### Frente B — Uma página-resposta por consulta perdida (fecha os padrões 1, 2 e 4)

Regra de forma (medida em `PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md`, §2):
título = a pergunta literal; 3 primeiras linhas com a resposta (o que, para
quem, quanto custa); tabela; 1-2 números próprios com data; FAQ com schema;
bloco de conversão; linkada de 3 páginas com impressão; sem preço de
concorrente sem ficha datada. **Reescrever a página que já existe, não
criar outra** (regra do repo: 4 análises seguidas propuseram criar o que
existia).

| # | Consulta | Página (existe) | O que muda | Métrica |
|---|---|---|---|---|
| B1 | como postar em vários grupos de WhatsApp ao mesmo tempo sem spam | `/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo` (279 imp., CTR 1,4%, pos. 5,1) | Título = a pergunta. Tabela dos 4 caminhos que TODAS as IAs listam (encaminhar até 5 · Comunidades · extensão de navegador · robô de afiliada com fila e intervalo), com prós/contras honestos e a linha "para afiliada com grupos próprios". Seção "o que o WhatsApp considera spam" (consentimento, ritmo, conteúdo). HowTo + FAQ. Bloco de conversão | 0/4 → ≥ 2/4; CTR 1,4% → 3% |
| B2 | como padronizar divulgação de cupons no WhatsApp | `/padronizar-divulgacao-afiliado-whatsapp` (89 imp., CTR 3,4%, pos. 5,3) + `/blog/checklist-padronizar-divulgacao-whatsapp` | Título = a pergunta, com "para afiliadas" no H1. Modelo de mensagem pronto (o Gemini e o ChatGPT entregam template; entregar o nosso, com cupom convertido nas 6 lojas), variação de texto, "mesma mensagem em todos os grupos a partir de um painel" (o que o Gemini disse que nos faria citar). FAQ | 0/4 → ≥ 1/4 |
| B3 | bot para afiliados no WhatsApp | `/bot-afiliados-whatsapp` (942 imp., CTR 8,5%, pos. 5,5; já reescrita em 20/09) | Adicionar FAQ com schema (Afilira tem; nós não nesta página), tabela "Espelha Grupos × Afilira × Achadinho Pro × Pro Afiliados" só com fichas datadas, "melhor para / não é ideal para", e a linha dos 3 modelos | Gemini e AIO ≥ 1 citação; CTR mantém ≥ 8% |
| B4 | ferramenta para divulgar ofertas em grupos de WhatsApp | `/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp` (30 imp., CTR 6,7%, **pos. 3,8**) | Virar lista "as 6 opções comparadas em 2026" (ItemList) com a nossa linha primeiro e as 5 com ficha datada; data visível; link de 3 páginas fortes | Gemini e Perplexity ≥ 1 (hoje 0); impressões 30 → 150 |
| B5 | como espelhar mensagens entre grupos | `/blog/como-espelhar-mensagens-entre-grupos-whatsapp` (59 imp., **pos. 3,2, 0 cliques**) | Problema é o título/descrição, não a posição: reescrever para ter clique ("sem programar, em 4 caminhos, com o link trocado pelo seu"); manter HowTo | CTR 0% → 4%; AIO e ChatGPT passam a nomear ferramenta |
| B6 | "espelhar grupos vale a pena?" (a objeção) | `/espelhar-grupos-de-ofertas-vale-a-pena` (no ar desde 27/09) | Pedir indexação; linkar de `/espelha-grupos-e-confiavel`, home, `/bot-achadinhos-whatsapp`, `/alternativas/achadinhos-bot` (6.508 imp.) e `/alternativas/achadinho-pro`; FAQ na página "é confiável" com a pergunta literal "Espelhar grupos vale a pena?" apontando para ela; frase-âncora "espelhamento + garimpo: a Espelha Grupos faz os dois" | AIO em "é confiável" e "o que é" cita a NOSSA página em vez do Achadinhos Pro |
| B7 | automação para afiliados no WhatsApp (categoria que queremos nomear) | `/automacao-whatsapp-afiliados` (35 imp., pos. 12,6) e `/melhores-bots-para-afiliados-whatsapp` (67 imp., pos. 7,5) | Fundir num hub "Automação para afiliadas no WhatsApp em 2026: os 3 modelos (espelhador, garimpo, formatador) e 8 ferramentas comparadas" (a primeira vira canônica, a segunda redireciona ou aponta); tabela só com ficha datada; "melhor para" por modelo | Nova Trilha D (§6) ≥ 4/8 na 1ª rodada; posição < 8 |
| B8 | metodologia | `/metodologia-uso-responsavel-whatsapp` (8 imp., pos. 2,6) | Só o topo: 3 primeiras linhas dizendo "metodologia do Espelha Grupos para afiliadas espelharem ofertas com segurança", para o Gemini parar de ler como lançamento digital | Gemini ≥ parcial |

Ordem de B: B6 → B4 → B5 → B1 → B3 → B7 → B2 → B8 (impacto ÷ esforço; B6 e
B4/B5 são ajustes em página que já ranqueia no top 4).

### Frente C — Terceiros e vídeo (fecha o padrão 5)

Sem CNPJ não há Reclame Aqui nem G2 com avaliação verificada. O que dá para
fazer, em ordem de peso medido:

| # | Ação | Métrica | Prazo | Dono |
|---|---|---|---|---|
| C1 | 8 vídeos, um por semana, título = a pergunta (lista e ordem em `DIAGNOSTICO_MAQUINA_DE_VENDAS_2026-09-27.md`, item 9); YouTube + TikTok + Instagram; LinkedIn só versão de tela; descrição = frase canônica + link da página-resposta correspondente | AIO embute vídeo nosso em "bot para afiliados"; Gemini/Perplexity ≥ 2 cada na Trilha A | 60 dias | Flávia |
| C2 | Guest-parágrafo nas 2 páginas de terceiro com autoridade que já ranqueiam e não citam ferramenta (superfrete, remessaonline) | 1 menção de terceiro publicada | 30 dias | Flávia |
| C3 | Criadores pequenos do YouTube que ensinam "bot de achadinhos" (lista no plano de 18/09): teste estendido + programa de afiliadas (30% recorrente, já existe) + "Espelha Grupos" no título | 1 vídeo de terceiro com o nome no título | 60 dias | Flávia |
| C4 | Depoimentos reais com permissão (3 a 5) em `/espelha-grupos-e-confiavel` e `/estudos-de-caso` | ChatGPT deixa de dizer "poucas avaliações independentes" | 30 dias | Flávia colhe, código publica |
| C5 | Repositório público `espelhagrupos/docs` (glossário, metodologia, exemplos de mensagem convertida) e Medium com canonical dos 4 posts com mais impressão | 2 domínios de terceiro citando o nome | 60 dias | Código + Flávia |
| C6 | Comunidades oficiais no Telegram (Shopee, Mercado Livre) com o checklist gratuito, com autorização do admin; Quora pt-BR nas perguntas indexadas | menções indexadas `t.me/s/` | contínuo | Flávia |

Não fazer: pedir inclusão em listicle de concorrente (ofertasbot = PromoBot),
diretórios em massa/pagos, thread promocional, avaliação fabricada.

### Frente D — Google: ganhar clique onde já aparecemos e disputar Tier 1

| # | Ação | Dado | Métrica |
|---|---|---|---|
| D1 | Próximas 8 páginas com impressão e pouco clique (depois das 5 de hoje): `/alternativas/achadinhos-bot` (6.508 imp., CTR 1,38%; a maior do site), `/blog/como-divulgar-ofertas-amazon-whatsapp` (618, 1,6%), `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` (547, 0,55%), `/blog/como-ser-afiliado-shopee-whatsapp` (532, 0,56%, **pos. 9,4**), `/alternativas/shozap` (531, 0,94%), `/postar-em-varios-grupos…` (279, 1,4%; = B1), `/alternativas/gigi-bot` (216, 0,93%), `/alternativas/fluxopromo` (203, 0,99%, pos. 4,9: teto de quem busca a marca) | Páginas.csv 3 meses | +60 cliques/mês somados; medir pela série diária |
| D2 | Tier 1 pela porta que já abre: `/blog/como-ser-afiliado-shopee-whatsapp` está na página 1 (pos. 9,4) para a periferia de "como ser afiliado shopee" (5.000/mês, média). Fundir força: esse post e `/quanto-ganha-afiliado-shopee` linkam para `/shopee-afiliados-whatsapp` como "próximo passo", e a comercial linka de volta; mesmo desenho para ML e Amazon | Planejador 30/07 | 3 páginas de loja com ≥ 1 consulta-cabeça em posição < 20 |
| D3 | FAQ com schema nas 12 páginas-resposta (hoje só as comerciais têm) | grep no repo | 12/12 |
| D4 | Não mexer em título que está subindo (CTR semanal 5,75%) fora das listas D1/B | série semanal | CTR semanal ≥ 5% |

### Frente E — Bing e recuperação do ChatGPT

- E1: inspecionar no Bing WMT `/`, `/precos`, `/bot-afiliados-whatsapp`,
  `/blog/como-espelhar-mensagens-entre-grupos-whatsapp`; se faltar, "Enviar
  URL". O ChatGPT com busca recupera via Bing; o Explorador de sites do Bing
  mostrou só 38 das rotas atuais (teto de exportação ou ausência: a inspeção
  decide). Dono: Flávia. Métrica: 4/4 indexadas no Bing.
- E2: conferir mensalmente que os robôs de busca das IAs passam
  (`node scripts/diag-acesso-robos-ia.mjs`, 2 níveis). Dono: Flávia.

### Frente F — Medição (sem ela nada acima é avaliável)

| # | Ação | Dono |
|---|---|---|
| F1 | **Trilha D — intenção de compra (8 consultas, série nova a partir de 10/2026):** "melhor bot para afiliado shopee no whatsapp" · "robô que busca ofertas da shopee sozinho" · "automação para afiliados no whatsapp" · "espelhar grupos de ofertas whatsapp vale a pena" · "ferramenta para afiliada divulgar ofertas em grupos" · "bot de achadinhos para whatsapp" · "como ser afiliada shopee e divulgar no whatsapp" · "espelha grupos ou afilira". Trilhas A/B/C não mudam (série). Entra no `ROTEIRO_MEDICAO_IA.md`, em `scripts/medir-citacao-ia.mjs` e no teste que trava as consultas | Código |
| F2 | Rodada mensal completa (A+B+C+D × 4 IAs), conta neutra, ChatGPT com busca; Gemini pela API; anotar QUEM foi citado e a URL; `node scripts/validar-medicao-ia.mjs` antes de fechar | Flávia |
| F3 | Placar por consulta × IA como o da §1, acrescentado à `SERIE_HISTORICA_SEO.md` (coluna nova, nunca recomeçar) | Código |
| F4 | Registro de "fatos errados ditos pela IA" (Telegram, Basic manual, 4 lojas, 20 origens) e da fonte que ela citou; zerar a lista é meta | Código (planilha no repo) |

## 5. Ordem de execução

- **Semanas 1–2:** A1 (deploy + reindexação + Bing), B6, B4, B5, A2, A3, F1.
  Flávia: C1 vídeo 1, C4 depoimentos, E1.
- **Semanas 3–4:** B1, B3, D1 (primeiras 4 páginas), D3 nas páginas tocadas.
  Flávia: C1 vídeos 2–3, C2 guest-parágrafo.
- **Semanas 5–8:** B7, B2, D1 (restantes), D2. Flávia: C1 vídeos 4–6, C3, C6.
- **Semanas 9–12:** B8, C5, revisão trimestral do Planejador (out/2026) e
  segunda rodada completa de medição. Flávia: C1 vídeos 7–8.

## 6. Metas GEO e SEO, ancoradas em 27/09

| Métrica | Hoje | 30 dias (27/10) | 60 dias | 90 dias (27/12) |
|---|---:|---:|---:|---:|
| Categoria, Trilha A (5 × 4) | 6/20 | 10/20 | 13/20 | 16/20 |
| Gemini e AIO na Trilha A | 1 e 1 | 2 e 2 | 3 e 3 | 4 e 4 |
| Marca, Trilha B (4 × 4) | 13/16 | 15/16 | 16/16 | 16/16 |
| Trilha D (8 × 4), série nova | — | linha de base | +25% | ≥ 20/32 |
| Fatos errados ditos pelas IAs | 4 | 1 | 0 | 0 |
| AIO em "é confiável" cita a nossa página "vale a pena" | não | sim | sim | sim |
| Menções de terceiros ao nome (fora do site) | 0 | 2 | 5 | 8 |
| Páginas-resposta com FAQ + data + 3 links de entrada | 3 de 12 | 8 | 12 | 12 |
| Cliques Google/mês (série diária) | ~680/3 meses (≈ 190/semana em set.) | 250/semana | 320/semana | 400/semana |
| Cadastros com carimbo de IA/mês | 60 | 70 | 85 | 100 |

## 7. Dados que faltam (um pedido por pergunta)

1. Planejador de Palavras-Chave: "automação para afiliados" e "automação para
   afiliado shopee" (volume e concorrência). Decide se B7 vira porta de
   entrada no Google ou só página de resposta para IA.
2. Bing WMT → Inspeção das 4 URLs de E1. Decide se o ChatGPT neutro está
   lendo a versão atual.
3. Depois do deploy em `main`: rodada de ChatGPT em janela anônima nas 5 de
   categoria. Decide o quanto do 5/9 de hoje era histórico da conta.

## 8. O que NÃO fazer (derrubado por dado ou por regra)

- Página nova para "postar em vários grupos" ou "cupons" com intenção
  corporativa (CRM/API oficial): é o mercado de Blip/Wati, congelado em
  16/09. Só a versão para afiliada, na página que já existe.
- Prometer Telegram, "anti-ban", "não bane", CPF/CNPJ que não temos.
- Mais `/alternativas/*` novos (23 já; 47% das impressões, 1,4% CTR, 3% de
  cadastro). Melhorar os 8 de D1, não criar.
- Mais `llms.txt`/schema como alavanca isolada: manter certo, não investir.
- Trocar título de página que está subindo fora das listas.
- Medir "BOTinho" como marca; alterar o texto das Trilhas A/B (quebra a série).
