# Plano de execução — 2026-09-11

Substitui `PLANO_ISSUES_2026-09-10.md`, que foi escrito antes dos diagnósticos de
produção. Três das oito issues daquele plano mudam de prioridade ou de conteúdo
porque a medição contradisse a premissa.

Base: `ANALISE_SEO_2026-09-11.md`. Série comparável: `SERIE_HISTORICA_SEO.md`.
Fluxo canônico: branch de `develop` → PR contra `develop` → autodeploy staging →
validação → PR `develop` → `main`.

---

## A tese, em uma linha

> **A máquina de captura já funciona: 23% de visita para cadastro, 15,4% nas
> páginas comerciais. O que falta é apontá-la para o tráfego certo e parar de
> alimentar o que converte zero.**

Não é um plano de "gerar mais tráfego". É um plano de **realocação**: tirar
esforço de onde há impressão sem receita e pôr onde há receita sem impressão.

### O que a medição mudou no plano anterior

| Item de 10/09 | O que a medição mostrou | Consequência |
|---|---|---|
| Issue 1 — identidade da marca | A marca é citada em 9 de 16 quando a consulta usa o nome atual | **Rebaixada.** Vira só a colisão de fraude |
| Issue 3 — títulos de `/alternativas/*` | O cluster converte **0 em 147 visitas** | **Reescrita.** Título traria mais gente para uma página que não converte |
| Issue 5 — preço legível | Gemini passou a ler; Perplexity não | **Reduzida** a uma superfície |
| Issue 6 — rodar diagnósticos | **Feito.** É a base desta análise | Encerrada |

---

## Ordem de ataque

| # | Issue | Alavanca medida | Esforço | Prazo |
|---|---|---|---|---|
| **1** | Tier 1: destravar o índice | 5 páginas no ar desde 02/09 com **zero impressão** | M | 21d |
| **2** | Converter o cluster de comparação, ou parar de alimentá-lo | 147 visitas, 0 cadastros, 47% das impressões | M | 21d |
| **3** | Industrializar a citação por IA | ChatGPT converte 2,69× acima da participação | M | 30d |
| **4** | Ocupar `espelha grupos é confiável` | AI Overviews devolve golpe financeiro | P | 14d |
| **5** | Replicar a página de 30,8% | melhor página do site tem 250 impressões | M | 21d |
| **6** | Medir LTV e retenção | sem isso não há teto de CAC nem anúncio | P | 7d |
| **7** | Perplexity ler o preço | única superfície que ainda erra | P | 14d |
| **8** | Validador do CSV de IA | erro de maiúscula já falsificou um placar | P | 7d |

1, 3 e 6 correm em paralelo. A 2 decide o destino de sete páginas. A 5 depende de
saber quais consultas alimentam a página de 30,8% (item 2 dos dados que faltam).

---

## Issue 1 — Tier 1: as páginas EXISTEM e não entraram no índice

⚠️ **Esta issue foi reescrita em 2026-09-11, depois do plano publicado.** A versão
anterior mandava CRIAR as páginas Tier 1. Elas já existiam. Ver
"A falha de método que se repetiu três vezes", no fim deste arquivo.

**O que existe, verificado no repositório e em produção:**

| Página | Criada | Em `main` | HTTP | Tamanho | Sitemap | Impressões (3m) |
|---|---|---|---|---:|---|---:|
| `/shopee-afiliados-whatsapp` | 02/09 | sim | 200 | 83 KB | sim | **0** |
| `/mercado-livre-afiliados-whatsapp` | 02/09 | sim | 200 | 80 KB | sim | **0** |
| `/amazon-afiliados-whatsapp` | 02/09 | sim | 200 | 79 KB | sim | **0** |
| `/magalu-afiliados-whatsapp` | 02/09 | sim | — | — | sim | **0** |
| `/shein-afiliados-whatsapp` | 02/09 | sim | — | — | sim | **0** |

Sem `noindex`, com canônica própria e correta. **O trabalho foi feito. O Google
não indexou.**

**Não é "página nova demora".** Das 16 páginas criadas no MESMO dia, nove
ganharam impressão e sete não. As sem impressão são justamente as cinco de loja:

| Página criada em 02/09 | Impressões |
|---|---:|
| `/clonar-mensagens-de-grupo-de-afiliados` | 68 |
| `/conteudos` | 51 |
| `/precos` | 38 |
| `/bot-canais-whatsapp` | 10 |
| `/comparativos` | 9 |
| **as cinco de loja** | **0** |

**Duas hipóteses, e as duas têm ação:**

1. **Quase-duplicata.** As cinco saem do mesmo gerador
   (`dashboard/app/_preservationCommercialPages.js`) com a mesma estrutura,
   trocando só o nome da loja. Isso é exatamente o que cai no balde "Rastreada,
   mas não indexada" da Cobertura — que tem **24 páginas**.
2. **Órfãs.** Cada uma recebe **um único link interno real** (de `/conteudos`).
   Sem linkagem, o Google trata como periferia do site.

**Escopo, nesta ordem:**

1. **Inspeção de URL no Search Console** para as cinco, uma a uma. É o único
   lugar que diz o motivo exato: "Rastreada mas não indexada", "Detectada mas
   não indexada" ou "Duplicada sem canônica escolhida pelo usuário". **Pedir
   indexação** para cada uma na mesma tela.
2. **Diferenciar de verdade.** Se o motivo for duplicata, o conserto não é
   editar o template: é dar a cada loja conteúdo que só ela tem — comissão
   média da loja, prazo de aprovação do afiliado, particularidade do link
   (short link da Shopee, `?tag=` da Amazon, `partner_id` do ML). Isso já existe
   documentado no `AGENTS.md` e não está nas páginas.
3. **Linkagem interna.** Cada página comercial que já converte
   (`/bot-achadinhos-whatsapp`, `/automatizar-divulgacao-em-grupos-whatsapp`)
   deve apontar para a loja correspondente, e a home para as cinco.

**Aceite:** as cinco no índice em 21 dias, com impressão maior que zero. Só
então a conversa passa a ser sobre CTR e conteúdo.

**O que NÃO fazer:** criar página nova de Tier 1. Já existem cinco.

## Issue 2 — Converter a comparação, ou parar de alimentá-la

**O número:** 7 páginas, 147 visitas, 9 cliques, **0 cadastros** em 30 dias. E o
cluster ocupa 47% das impressões do site.

Duas hipóteses, e a medição separa as duas:

| Hipótese | Sinal | Ação |
|---|---|---|
| A página perde a pessoa | leu 50% = 25% em `achadinhos-bot`, 13,5% em `achadinho-pro` | reescrever a página |
| A intenção não converte | quem digita a marca do concorrente quer o concorrente | parar de investir |

**O dado favorece a segunda**, e já havia um sinal em 01/09: em `fluxopromo`
estamos na posição 4,8 com o título certo e mesmo assim 0 clique em 138
impressões.

**Escopo em duas etapas, com decisão no meio:**

1. **Teste controlado, 14 dias, só em `/alternativas/achadinhos-bot`** (a maior):
   CTA acima da dobra, oferta explícita (7 dias grátis sem cartão), remover a
   tabela comparativa do topo — ela é o que segura a pessoa antes do CTA.
2. **Decisão:** se a conversão continuar abaixo de 3%, **congelar a linha** como
   cidade e nicho: não deletar (o histórico do Google é ativo), parar de produzir
   e redirecionar o esforço para a Issue 1.

**Aceite:** decisão tomada com dado em 21 dias, não opinião.

⚠️ **Não deletar as páginas.** Perder link e histórico não ajuda, e elas seguram
47% das impressões — que é reputação de domínio mesmo sem converter.

---

## Issue 3 — Industrializar a citação por IA

**O número mais forte de todo o conjunto:** ChatGPT tem 13% das visitas e **35%
dos cadastros**. Índice 2,69×, contra 2,4× em 01/09.

E a citação já está funcionando: 9 de 16 na rodada de 11/09, contra 3 de 28 em
01/09.

**A lógica de por que isso converte melhor:** a IA já respondeu à objeção antes
do clique. Quem chega do Google está pesquisando; quem chega do ChatGPT **já foi
convencido**. Não é tráfego, é indicação.

**Escopo — produzir o que as IAs citam, no formato que elas citam:**

1. **Página de comparação de categoria**, datada e com fonte por linha — é o
   critério 1 que a Perplexity nomeou explicitamente ("presença em comparações
   recentes de 2025-2026").
2. **Responder a objeção de modelo da Perplexity.** Ela nos chama de legítimos e
   critica o modelo de espelhamento, recomendando "garimpo próprio por IA". Isso
   já existe no Pro (ofertas automáticas da Shopee) e não está legível. Página
   que explique espelhamento **e** garimpo como duas camadas do mesmo produto.
3. **Transformar a transparência em ativo explícito.** Gemini e ChatGPT já citam
   nossa honestidade como diferencial. Uma página de "o que não prometemos"
   consolida o que hoje está espalhado.
4. **Mapear os 22 concorrentes novos** em `competitors-data.js`, priorizando os 8
   que apareceram em mais de uma superfície.

**Regra inegociável:** preço de concorrente em página pública só depois de ficha
datada com fonte. Preço citado por IA **não é fonte** — o Gemini inventou quatro
recursos nossos em 10/09.

**Aceite:** 12 citações em 16 na rodada de 01/10, e ao menos uma citação da
Perplexity numa consulta de **categoria** (hoje ela só cita nas de marca).

---

## Issue 4 — Ocupar `espelha grupos é confiável`

**Urgência de reputação.** O Google AI Overviews responde essa consulta com
**golpe de espelhamento de tela**: "amplamente utilizado por criminosos para
aplicar golpes financeiros", citando G1 e Banco Central.

A pessoa que digita isso está a um passo de assinar. Ela recebe conteúdo sobre
crime financeiro.

**Escopo:** página que ocupe o termo com o que as outras três IAs já dizem de
nós — legitimidade, transparência sobre risco de bloqueio, credenciais
criptografadas, pagamento por Mercado Pago com cancelamento pelo painel, número
dedicado recomendado. Schema `FAQPage`, porque é o formato que o AI Overviews
mais cita.

**O material já existe e está espalhado:** `/seguranca-credenciais-afiliado`,
`/metodologia-uso-responsavel-whatsapp` e a política do `llms.txt`. Falta uma
página que responda **a pergunta como ela é feita**.

**Aceite:** a consulta deixa de devolver conteúdo de fraude no AI Overviews em 30
dias. Se não sair, escalar para desambiguação explícita ("Espelha Grupos não é
espelhamento de tela").

---

## Issue 5 — Replicar a página de 30,8%

`/automatizar-divulgacao-em-grupos-whatsapp` converte **30,8% de visita em
cadastro** — a melhor do site — e tem **250 impressões**. É o inverso exato do
problema do cluster de comparação.

| Página | Visita → cadastro | Impressões |
|---|---:|---:|
| `/automatizar-divulgacao-em-grupos-whatsapp` | **30,8%** | 250 |
| `/bot-ofertas-afiliados-whatsapp` | 23,8% | 29 |
| `/alternativas/achadinhos-bot` | 0,0% | 3.400 |

**Escopo:** descobrir por quais consultas essas duas já aparecem (Search Console
filtrado por página), reforçar exatamente esses termos, e replicar o padrão delas
nas páginas da Issue 1.

**Por que não é só "trazer mais tráfego para elas":** o valor está em entender
**por que** convertem 2× melhor que as outras comerciais, e levar isso para as
páginas Tier 1 antes de escrevê-las. Esta issue alimenta a Issue 1.

**Aceite:** o padrão documentado e aplicado nas três páginas Tier 1.

---

## Issue 6 — Medir LTV e retenção

O `diag-origem-cadastros.mjs` avisa sozinho: mede o tempo até o primeiro
pagamento (**7,2 dias**) e não mede quantos meses o assinante fica.

**Sem LTV não existe teto de CAC, e sem teto de CAC não se liga anúncio.** Hoje
sabemos que um cadastro vira pagante em 10% dos casos e em 7 dias. Não sabemos se
esse pagante vale R$69 ou R$690.

**Escopo:** estender o script (ou criar um irmão) para ler `Payment` e
`Subscription` por conta e devolver meses de permanência, receita acumulada e
taxa de renovação. Os dados já existem — a aba de cobranças recorrentes do admin
lê as mesmas tabelas.

**Aceite:** LTV médio e mediano por origem de cadastro. **É a issue mais barata
com maior efeito sobre decisão**, porque destrava a conversa de anúncio.

---

## Issue 7 — Perplexity ler o preço

Única superfície que ainda erra. Em `espelha grupos preço` ela diz "não encontrei
um preço confirmado na página oficial" e **preenche a lacuna com preço de
concorrente** (Afiliado Analytics, Pai das Ofertas).

O Gemini resolveu sozinho entre 10/09 e 11/09, então o conserto do `pricing.md`
funcionou — falta descobrir por que não alcança a Perplexity.

**Escopo:** conferir se `PerplexityBot` aparece no Cloudflare com janela de 30
dias; garantir `pricing.md` no `sitemap.xml` e referenciado no `llms.txt`; preço
em HTML legível na `/precos` com schema `Offer`.

⚠️ Um desfecho legítimo é descobrir que ela **não rastreia o site**. Nesse caso,
fechar com o achado registrado.

**Aceite:** `espelha grupos preço` devolve R$39 ou R$69 na Perplexity, ou o
achado de que ela não rastreia.

---

## Issue 8 — Validador do CSV de IA

**Não é higiene, é correção de um erro que já aconteceu.** Três linhas de 01/09
gravavam `SIM` em maiúscula, e o placar daquela rodada apareceu como **0 em vez
de 3** ao ser recontado hoje.

**Escopo:** script que valide colunas obrigatórias, domínio fechado de
`botinho_cited` (`sim`/`nao`/`parcial`), plataforma dentro de lista fechada, e
que **falhe** se uma rodada não marcar conta neutra. Mais um relatório que
imprima o placar por rodada e superfície.

**Aceite:** a rodada de 01/10 sai em menos de 20 minutos de trabalho manual e
compara automaticamente contra 11/09, 10/09 e 01/09.

---

## O que NÃO fazer

- **Cidade e nicho seguem congelados.** 20 páginas, 1,7% das impressões, quarta
  medição a favor.
- **Não produzir mais páginas de comparação** até a Issue 2 decidir.
- **Não citar preço de concorrente** sem ficha datada.
- **Não prometer que não banem** — é literalmente o que as IAs elogiam em nós.
- **Não deletar página nenhuma**, nem as que convertem zero.
- **Não ligar anúncio antes da Issue 6.** Sem LTV, o teto de CAC é chute.

---

## Metas para 01/10

| Indicador | Hoje | Meta |
|---|---:|---|
| Citações por IA (16 medições) | 9 | 12 |
| Superfícies que devolvem fraude na consulta de confiança | 1 | 0 |
| Cadastros/mês | 119 | 150 |
| Cadastros vindos de página de conteúdo | 34% | 45% |
| Conversão do cluster de comparação | 0,0% | 3% ou linha congelada |
| Tier 1 | 0 cliques | primeira página no ar e medida |
| LTV | desconhecido | medido |


---

## A falha de método que se repetiu três vezes

**O que aconteceu.** As análises de 01/09, 10/09 e 11/09 afirmaram, cada uma,
que "não existe página comercial nossa disputando Tier 1". As páginas existem em
produção desde **02/09**. A de 11/09 chegou a abrir uma issue para criá-las.

**Por que passou.** O relatório de Páginas do Search Console **só lista páginas
que tiveram impressão**. Página com zero impressão não aparece — ela é invisível
ali. Eu li a ausência no relatório como ausência da página, e nunca conferi o
repositório.

**Por que isso é grave.** Os dois estados pedem ações opostas:

| Estado real | Ação correta |
|---|---|
| A página não existe | escrever a página |
| A página existe e não indexou | inspeção de URL, diferenciação, linkagem |

Três ciclos de análise apontaram para a ação errada, e o trabalho já entregue
ficou invisível para quem decide.

**A guarda, obrigatória a partir daqui.** Antes de escrever em qualquer análise
que uma página "não existe" ou "não foi feita":

```bash
ls dashboard/app | grep -i <termo>
grep -c "<rota>" dashboard/lib/seo-registry.mjs
curl -s -o /dev/null -w "%{http_code}\n" https://espelhagrupos.com.br/<rota>
```

**Ausência no Search Console prova que ninguém viu a página. Nunca prova que ela
não existe.** A frase honesta é "a página está no ar e não recebeu impressão" —
que é um diagnóstico diferente, e mais acionável.
