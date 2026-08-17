# Análise SEO — 16/08/2026 (comparação com o baseline de 30/07)

Fonte: export do Search Console de 16/08/2026, filtro "Últimos 3 meses" (o site
só tem dado desde 15/05, então 3 meses ≈ toda a vida do site). Baseline anterior:
`ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`.

**Escopo desta rodada:** só o Relatório 1 (Search Console). Planejador e Trends
**não** foram refeitos de propósito — ver "O que não foi refeito" no fim.

---

## 1. Os números

Comparação pela mesma metodologia nas duas datas (soma da aba "Países"):

| Métrica | 30/07 | 16/08 | Variação |
|---|---:|---:|---:|
| Cliques | 40 | **93** | +133% |
| Impressões | 1.102 | **2.902** | +163% |
| CTR | 3,63% | 3,20% | −0,43 p.p. |
| **Consultas distintas** | 13 | **29** | +123% |
| Páginas com impressão | 60 | 77 | +17 |
| Posição média (Brasil) | 7,85 | 7,60 | melhora leve |

Consultas distintas é a métrica mais honesta de progresso: mede em quantos
assuntos diferentes o Google já considera o site uma resposta possível. Dobrou.

### A virada tem data

| Semana | Cliques | Impressões |
|---|---:|---:|
| 12–18/07 | 4 | 103 |
| 19–25/07 | 12 | 137 |
| 26/07–01/08 | 9 | 183 |
| **02–08/08** | **21** | **741** |
| **09–14/08** | **28** | **965** |

As impressões multiplicaram por **5,3** em duas semanas. A quebra acontece na
semana de 02/08 — que é exatamente quando o robots.txt da Cloudflare foi
desbloqueado, o IndexNow entrou no deploy, a identidade de marca foi unificada e
as indexações foram pedidas à mão (tudo em 04/08). Não é prova de causa, mas a
coincidência de data é forte e nenhuma outra mudança grande entrou na janela.

O CTR caiu (3,63% → 3,20%) porque as impressões cresceram mais rápido que os
cliques. Isso é normal quando páginas novas entram ranqueando em posição 7–10 —
e é justamente onde está o dinheiro parado (seção 3).

---

## 2. A descoberta principal: o tráfego que mais cresce é de marca de concorrente

Três consultas concentram **443 impressões** (15% de todo o período):

| Consulta | Impressões | Cliques | CTR | Posição |
|---|---:|---:|---:|---:|
| `achadinhoosbot` | 215 | 1 | 0,47% | 7,56 |
| `achadinhosbot` | 134 | 0 | 0% | 7,01 |
| `achadinhos bot` | 94 | 3 | 3,19% | 7,41 |

São pessoas digitando o nome de um concorrente (AchadinhosBot / AchadinBot, já
mapeado em `AGENTS.md`). Duas páginas nossas atendem essa busca:

| Página | Impressões | Cliques | CTR | Posição |
|---|---:|---:|---:|---:|
| `/bot-achadinhos-whatsapp` | 529 | 11 | 2,08% | 7,36 |
| `/alternativas/achadinhos-bot` | 226 | 4 | 1,77% | 6,79 |

`/bot-achadinhos-whatsapp` é hoje a **página com mais impressões de todo o
site** — e no baseline de 30/07 ela tinha 5 impressões. Só na semana de 07–13/08
foram 318 impressões (contra 122 na semana anterior).

E não é só um concorrente: `fluxopromo` (41 impressões, posição 5,78) e `shozap`
(11) também já aparecem, com `/alternativas/fluxopromo` em 51 impressões e
posição 6,0.

**Leitura:** as páginas de comparação com concorrente são o motor de
crescimento. Não as páginas de cidade nem as de nicho — que continuam em zero e
seguem corretamente congeladas.

**O problema:** 443 impressões de intenção altíssima rendendo 4 cliques. Quem
digita o nome exato de um produto quer aquele produto; para ganhar o clique o
título precisa dizer que aqui tem uma **alternativa** — sem prometer nada e sem
se passar pelo concorrente.

---

## 3. Dinheiro parado: páginas que ranqueiam e ninguém clica

Sete páginas somam **464 impressões e ZERO clique**:

| Página | Impressões | Posição |
|---|---:|---:|
| `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` | 176 | 7,10 |
| `/programa-de-afiliados` | 85 | 7,54 |
| `/alternativas/fluxopromo` | 51 | 6,00 |
| `/bot-ofertas-afiliados-whatsapp` | 49 | 9,61 |
| `/blog/conferir-converter-link-afiliado-whatsapp` | 37 | 7,46 |
| `/bot-ofertas-whatsapp` | 37 | 8,49 |
| `/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero` | 29 | 10,24 |

Estar na primeira página e não receber clique é problema de **título e
descrição**, não de conteúdo nem de link. É o conserto mais barato que existe em
SEO: mexer em duas linhas de texto por página, sem escrever conteúdo novo.

Para calibrar, as páginas que **convertem** impressão em clique hoje:

| Página | Impressões | Cliques | CTR |
|---|---:|---:|---:|
| `/` | 137 | 22 | **16,06%** |
| `/bot-afiliados-whatsapp` | 75 | 10 | **13,33%** |
| `/automatizar-divulgacao-em-grupos-whatsapp` | 173 | 14 | 8,09% |
| `/padronizar-divulgacao-afiliado-whatsapp` | 28 | 3 | 10,71% |

Vale copiar o padrão de título dessas quatro para as sete de cima.

### Celular converte metade do computador

| Dispositivo | Impressões | Cliques | CTR |
|---|---:|---:|---:|
| Computador | 1.099 | 56 | **5,10%** |
| Celular | 1.786 | 37 | **2,07%** |

O celular traz 62% das impressões e menos da metade do CTR. Duas causas
possíveis: título cortado na tela pequena (o celular mostra menos caracteres) ou
o público que busca nome de concorrente ser majoritariamente mobile. Conferir os
títulos com mais de 60 caracteres antes de investigar mais fundo.

---

## 4. O que ainda não foi atacado

O Tier 1 do baseline — `shopee afiliados`, `mercado livre afiliados`,
`afiliado amazon`, 50.000 buscas/mês cada e concorrência **baixa** — aparece com
**zero consulta** no Search Console. Não é que ranqueia mal: é que não existe
página nossa disputando esses termos.

O que já chega é o público de "depois": quem busca bot, grupo de ofertas,
achadinhos. Falta o de "antes": quem está virando afiliado agora.

Aparecem em posição ruim (sinal de que há conteúdo mas fraco):
`bot afiliado mercado livre` (27,5), `cadastro de afiliado shopee` (19),
`como criar grupo de ofertas no whatsapp` (29).

`botinho` teve **1 impressão** no período — confirma que não havia marca a
perder na unificação para Espelha Grupos.

---

## 5. O que fazer, em ordem

1. **Reescrever título e descrição de `/bot-achadinhos-whatsapp` e
   `/alternativas/achadinhos-bot`.** 443 impressões de intenção máxima rendendo
   4 cliques. Maior retorno por hora de trabalho de toda a lista.
   ⚠️ Dizer "alternativa a X", nunca se passar por X, nunca prometer o que o
   concorrente não entrega sem fonte e data.
2. **Reescrever título e descrição das sete páginas com zero clique.** 464
   impressões desperdiçadas; conserto de duas linhas por página.
3. **Completar as páginas de `/alternativas/`** para os concorrentes já mapeados
   e ainda sem página (Achadinho Pro, ProAfiliados, Afilira, IA Divulgadora,
   Shark Pomo Bot, Lumi, Gigi Bot). Esta é a linha que está funcionando — é onde
   vale produzir, ao contrário de cidade e nicho.
4. **Conferir tamanho dos títulos** (alvo: até 60 caracteres) por causa do CTR
   de celular.
5. **Abrir a frente Tier 1** (`shopee afiliados` / `mercado livre afiliados` /
   `afiliado amazon`). É a maior oportunidade do levantamento e continua sem
   nenhuma página. Decisão de esforço, não de dado.

Ordem 1 e 2 mexem em texto de página que já existe e já ranqueia — efeito em
dias. Ordem 3 e 5 são conteúdo novo — efeito em 4 a 8 semanas.

---

## 6. O que não foi refeito (e por quê)

| Relatório | Refazer agora? | Motivo |
|---|---|---|
| 1 — Search Console | ✅ feito | única fonte que se move em 2 semanas |
| 2 — Planejador de palavras-chave | ❌ não | mede volume de mercado, que não muda em 18 dias; as decisões que dependem dele estão congeladas em `AGENTS.md` |
| 3 — Google Trends | ❌ não | idem; a ordem Shopee ≫ ML > Amazon ≫ Magalu não vira em duas semanas |
| 4 — Referrals de IA | ✅ automático | `scripts/diag-origem-cadastros.mjs` já produz — não precisa mais coleta manual |

Próxima rodada **completa** (os quatro relatórios): **início de outubro/2026**,
quando houver ~60 dias de dado depois de 04/08. Até lá, só o Relatório 1, uma
vez por mês.
