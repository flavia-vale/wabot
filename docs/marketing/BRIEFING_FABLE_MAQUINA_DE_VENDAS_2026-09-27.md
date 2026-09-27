# Briefing — tornar o Espelha Grupos uma máquina de vendas (27/09/2026)

Prompt para abrir uma sessão nova de estudo profundo. Copiar tudo a partir de
"PROMPT" e colar na sessão.

---

## PROMPT

Você vai trabalhar comigo no **Espelha Grupos** (repo `flavia-vale/wabot`, site
`espelhagrupos.com.br`). Eu sou a dona do produto, não sou técnica. O objetivo é
um só: **transformar o Espelha Grupos numa máquina de vendas** — previsível,
medida e crescendo todo mês.

Até aqui fizemos muitas correções pontuais (títulos, páginas, links, textos).
Funcionaram, mas foram superficiais. Agora quero um estudo **profundo**, de ponta
a ponta, de aquisição a renovação, e um plano que eu consiga executar.

### Regra número um: DADO REAL, nada de achismo

- Toda afirmação precisa vir de um dado (banco, log, Search Console, Cloudflare,
  script de diagnóstico, código). Hipótese é dita como hipótese.
- **Pergunte o que quiser.** Eu consigo buscar qualquer contexto: rodar comando
  ou script no servidor, exportar relatório do Search Console, Bing, Cloudflare,
  Mercado Pago, prints do painel admin, respostas das IAs. Só me peça **o
  mínimo**, um pedido por pergunta, dizendo o que cada resposta decide.
- Antes de pedir, confira se o dado já existe nos arquivos listados abaixo — boa
  parte já está medida.
- Números de mercado ou benchmark só com **fonte e data**. Se não achar fonte
  confiável, não compare.

### O que ler primeiro (nesta ordem)

1. `AGENTS.md` — regras do repo (fluxo `develop` → staging → `main`, memória do
   servidor, estilo de resposta comigo). Obrigatório.
2. `docs/rca/seo-marketing.md` — tudo que já aprendemos de SEO e marca, e as
   linhas **congeladas por dado** (não reabrir sem dado novo).
3. `docs/marketing/SERIE_HISTORICA_SEO.md` — **a série de dados** (Google, IAs,
   cadastros, funil por página, LTV, robôs, Bing), com as correções de leitura.
4. `docs/marketing/PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md` — o plano anterior
   para IA/citação e o que foi decidido.
5. `docs/marketing/PLANO_ATIVACAO_FUNIL_2026-09-08.md` e
   `docs/marketing/AUDITORIA_REVOPS_FECHAMENTO_2026-09-01.md` — ativação e
   fechamento.
6. `docs/marketing/RESUMO_E_PLANO_2026-09-23.md`,
   `docs/marketing/SESSAO_2026-09-23_PROMPTS_E_DECISOES.md` e
   `docs/marketing/ACOES_FLAVIA_2026-09-11.md` — últimas decisões e pendências.
7. `docs/marketing/ai_visibility_tracking.csv` e `ROTEIRO_MEDICAO_IA.md` — a
   medição de citação por IA, resposta a resposta.

### O produto (confira no código antes de afirmar qualquer recurso)

- Robô que conecta no WhatsApp da afiliada (QR Code, roda no servidor 24h).
- **Espelhamento** (Basic e Pro): lê grupos/canais de origem que ela segue, troca
  o link pelo código de afiliada em **6 lojas** (Shopee, Mercado Livre, Amazon,
  Magalu, SHEIN, AliExpress), inclusive cupom, e publica nos grupos dela com o
  modelo de mensagem dela. Se a troca falhar, não publica.
- **Ofertas automáticas** (só Pro, só Shopee): busca por tema e desconto mínimo,
  sem grupo de origem.
- Pro também tem: Canais, filas, marca d'água, controle de ritmo e variação de
  texto, painel de vendas Shopee.
- **Preço:** Basic R$ 39 e Pro R$ 69 a cada 30 dias. **Teste grátis de 7 dias com
  o Pro completo, sem cartão.** Pagamento pelo Mercado Pago (avulso ou cobrança
  automática, ligada desde 01/09). Reembolso integral em até 7 dias do pagamento;
  depois, cancela sem multa e usa até o fim.
- Nome antigo: BOTinho (mesmo produto). Nunca usar "BOTinho" sozinho em texto
  público.

### Os dados até 27/09 (fonte entre parênteses)

**Google** (Search Console, 3 meses até 23/09)
- 680 cliques, 16.581 impressões, CTR 4,10%, 225 consultas, 113 páginas com
  impressão; 108 páginas indexadas (18/09).
- CTR semanal subindo: 2,52% → 3,53% → 4,77% → **5,75%**. Cliques de 1 a 21/09 =
  **3,2×** agosto inteiro.
- **~47% das impressões vêm de busca com nome de concorrente.** Maior consulta:
  "achadinho pro" (3.806 impressões, 39 cliques em 3 meses).
- Páginas por loja (Shopee, ML, Amazon, SHEIN, Magalu): 353 impressões, 7
  cliques — o Google achou, mas não disputam os termos grandes ("shopee
  afiliados", 50 mil buscas/mês, concorrência baixa).
- Celular clica menos: 3,52% contra 4,85% no computador.

**Cadastros e vendas** (`diag-origem-cadastros.mjs --dias 30`, 27/09)
- **214 cadastros → 24 pagantes (11%)**, 6,6 dias em média entre cadastro e 1º
  pagamento.
- **60 cadastros (28%) vieram do ChatGPT** (carimbo `utm_source=chatgpt.com`).
  Visitas: Google 88%, ChatGPT 7% (a visita do ChatGPT é subcontada — o app tira
  o referenciador; conte pelo cadastro).
- 37% dos cadastros entram por página de conteúdo; pagantes: home 12, página de
  busca 9, preços 1, comparativo 1, blog 1.

**Funil por página** (`diag-paginas-seo.mjs --dias 30`, 27/09)

| Página | Visitas | Clique no CTA | Cadastros |
|---|---:|---:|---:|
| `/` | 1.054 | 25,8% | 110 |
| `/bot-achadinhos-whatsapp` | 312 | 37,8% | 38 |
| `/alternativas/achadinhos-bot` | 133 | 9,8% (só 24,8% leem metade) | 4 |
| `/precos` | 125 | 25,6% | 6 |
| `/bot-afiliados-whatsapp` | 116 | 48,3% | 16 |

Total 2.108 visitas, 27,1% clicam num CTA. Comparativos (`/alternativas/*`)
convertem muito menos que as páginas comerciais do mesmo tema.

**Receita e retenção** (`diag-ltv-retencao.mjs`, 27/09)
- 38 clientes já pagaram, **R$ 2.123,10** no total; média R$ 55,87 por cliente
  (mediana R$ 47); Pro 18 clientes (R$ 1.303), Basic 20 (R$ 820).
- Coorte de agosto: **7 de 7 renovaram**. Só 3 cancelamentos na história (7%/mês
  em 44 cliente-mês). Projeção do script: R$ 689 por cliente, confiança média.
- ⚠️ 26 dos 38 pagaram pela primeira vez em setembro: **a renovação deles
  (primeira quinzena de outubro) é o dado que falta** para decidir anúncio pago.
  A leitura de 23/09 "o gargalo é retenção" estava errada (média incluía quem
  ainda não chegou à data de renovar).

**Citação por IA** (rodada 23–27/09, 10 perguntas × 4 IAs, conta neutra)
- **19 de 36** no placar. Perguntas sobre a marca: 13/16. Perguntas de categoria
  (quem ainda não nos conhece): **6/20** — o ponto fraco.
- "Espelha grupos o que é" foi de 0/4 para 3/4: a marca passou a existir.
- Em "bot para afiliados no WhatsApp" só a Perplexity nos cita (5º, fraco). A
  categoria é ocupada por **Achadinhos Pro, Afilira, ProAfiliados, Shozap,
  DivulgaLinks**.
- Objeções que as IAs levantam: pouca prova independente (sem CNPJ, sem Reclame
  Aqui, poucas avaliações de terceiros); "espelhar grupos não vale a pena"
  (argumento de concorrente, já respondido em
  `/espelhar-grupos-de-ofertas-vale-a-pena`).

**Robôs e Bing** (Cloudflare 30 dias; Bing Webmaster, primeira leitura)
- 7 mil pedidos de robôs; OpenAI 1,84 mil (mais que Bing 1,26 mil e Google 844).
- Bing: 265 impressões, 17 cliques em 8 semanas (11 de marca). IndexNow ok.

### O que já foi feito (não refazer)

Títulos reescritos (20/08); nome único Espelha Grupos (02/09) e rotas renomeadas
(19/09); páginas por loja (02/09) com links internos (17/09); ~23 comparativos
`/alternativas/*`; política de reembolso, página de ofertas automáticas e 5
comparativos novos (23/09); página "espelhar vale a pena?", comparativo do
AchadinhosBot refeito e correção do `pricing.md` (27/09); roteiro de medição por
IA e scripts de diagnóstico (`scripts/diag-*.mjs`, só leitura).

### Limites reais (não propor o que esbarra neles sem me perguntar)

- **Não temos CNPJ** — nada de Reclame Aqui nem razão social por enquanto.
- **Clientes não respondem e-mail** — pesquisa por e-mail não funciona.
- **Anúncio pago está adiado** até a turma de setembro renovar (outubro).
- Depoimentos: só publicar de cliente real, com permissão, sem reescrever.
- Nunca prometer que o número não será bloqueado (anti-ban garantido).
- Preço de concorrente só com fonte oficial e data.
- Linhas de SEO congeladas por dado: páginas por cidade, por nicho, "robô" como
  termo, "espelhamento de grupos" como porta de entrada no Google.
- Servidor: qualquer coisa que aumente memória precisa de aviso antes (regra de
  memória do `AGENTS.md`).
- Código: branch a partir de `develop`, PR contra `develop`, nunca direto em
  `main`.

### O que eu quero de você

1. **Primeiro, perguntas.** Leia os arquivos, veja o que falta e me peça os
   dados — agrupados, do mais importante para o menos, cada um dizendo o que
   decide. Não comece o plano antes de ter o dado.
2. **Diagnóstico da máquina inteira, com números:** aquisição (Google, IAs,
   outros canais) → visita → cadastro → ativação no teste (conectou WhatsApp,
   cadastrou loja, teve oferta publicada) → pagamento → renovação → indicação.
   Onde está a maior perda **absoluta**, e por quê, com dado.
3. **O plano da máquina de vendas:** até 10 ações em ordem de impacto por
   esforço, cada uma com a métrica que prova se funcionou, o prazo para medir e
   quem faz (eu ou código). Diga também o que **parar** de fazer.
4. **Metas para 30 e 90 dias** ancoradas nos números atuais (cadastros, taxa de
   conversão, pagantes, receita).
5. Cite as boas práticas de mercado que usar (ex.: AARRR, Product-Led Growth,
   análise de coorte), sempre adaptadas aos nossos dados, nunca no lugar deles.
6. Não implemente nada antes de eu aprovar o plano.

Fale comigo em linguagem simples, direta, sem introdução. Quando for problema,
use: O que aconteceu · Porque · O que deve ser feito · Como.
