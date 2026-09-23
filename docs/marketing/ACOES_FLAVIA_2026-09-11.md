# O que você precisa fazer — fila única, em ordem

Substitui as quatro listas de indexação que existiam em paralelo
(`PAGINAS_PEDIR_INDEXACAO_2026-09-11.md`, a seção final de
`PLANO_MELHORIA_2026-09-11.md`, `PENDENCIAS_INDEXACAO.md` e
`ORGANICO_SPRINT1_INDEXACAO_CHECKLIST.md`). São **34 endereços** somados, e
quatro listas divergem em uma semana.

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
https://espelhagrupos.com.br/aumentar-conversao-em-grupos-de-cupons       ⏳ pendente
https://espelhagrupos.com.br/consistencia-postagens-em-grupos             ⏳ pendente
https://espelhagrupos.com.br/organizar-calendario-de-ofertas-no-whatsapp  ⏳ pendente
```

**Dia 6 pela metade** (3 de 6 em 22/09). Faltam só as 3 marcadas `⏳ pendente`
acima — peça-as quando sobrar cota num próximo dia.

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

### Como conferir que funcionou

Em **7 dias**, Inspeção de URL nas quatro do Dia 1. O veredito precisa sair de
"Detectada, mas não indexada" para **"URL está no Google"**. Se continuar
"Detectada" com "Último rastreamento: N/D", o problema é descoberta e o link
interno não bastou — aí a conversa é outra.

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
