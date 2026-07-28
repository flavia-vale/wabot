# Estudo profundo — Máquina de leads inbound (Google + IAs)

Data: 2026-07-28
Escopo: pesquisa de palavras-chave do nicho, análise de concorrência real na SERP,
auditoria do que já existe no site e plano priorizado para dominar as buscas de
"automação/robô para grupos de ofertas e achadinhos" e "afiliados".

> **Este documento é um estudo. Nada foi implementado.**

---

## 1. Resumo executivo — o que eu descobri

O site **já é forte** e não é iniciante: 61 rotas indexáveis no sitemap, hubs,
19 posts de blog, LPs por cidade e nicho, `llms.txt`, `pricing.md`, schema
JSON-LD, robots dinâmico. Isso está acima da média do nicho.

O problema **não é falta de conteúdo. É o vocabulário e o alvo.**

O site foi escrito no idioma da empresa, não no idioma de quem busca:

| Palavra usada no site | Ocorrências | Quem busca isso no Google |
|---|---:|---|
| "cadência" | 219 | ~ninguém |
| "Preservação Avançada" | 104 | ~ninguém (termo inventado) |
| "espelhamento" / "espelhar" | 220 | pouquíssimos |
| **"achadinho(s)"** | **73** (concentrado em 3 páginas) | **muito** |
| **"grátis"** | **13** | **muitíssimo** |
| **"robô"** | **11** | **muito** |
| **"automático"** | **9** | **muito** |

Resultado prático, medido na SERP real hoje:

- ✅ Para `automação para grupos de ofertas whatsapp` → **BOTinho aparece em 1º/2º**.
- ❌ Para `robô para grupos de achadinhos whatsapp` → **BOTinho não aparece**.
- ❌ Para `bot afiliados whatsapp grátis` → **BOTinho não aparece**.
- ⚠️ Para `bot shopee whatsapp afiliados grupos` → só um post de blog, não a página comercial.

Ou seja: **o site ganha exatamente na palavra que menos gente busca e perde
exatamente nas que mais convertem.**

Além disso há três problemas estruturais que sozinhos travam o crescimento:

1. **Marca ≠ domínio.** O domínio é `espelhagrupos.com.br`, a marca é "BOTinho".
   Para o Google e principalmente para as IAs, isso são duas entidades diferentes.
   Ninguém "vira referência" com identidade dividida.
2. **Título da home começa pela marca** (`BOTinho | Bot para Afiliados no WhatsApp`).
   A marca tem volume de busca ~zero. O espaço mais valioso do site está gasto.
3. **SEO programático apontado para a dimensão errada.** Existem 15 páginas de
   cidade (`espelhar grupos whatsapp São Paulo`, `...Belém`, `...Vitória`).
   Ninguém busca automação de afiliado por cidade. Enquanto isso, a dimensão que
   *tem* busca — **marketplace × intenção** (Shopee, Amazon, Mercado Livre,
   Magalu, AliExpress, Temu) — está quase descoberta.

---

## 2. Metodologia e limitação honesta

**O que eu fiz:** consultei a SERP real do Google para as consultas-alvo,
mapeei quem ocupa a página 1, analisei a composição dos resultados (marca
oficial vs. blog vs. YouTube vs. fórum) e cruzei com o inventário completo de
páginas do repositório.

**Limitação que você precisa saber:** eu **não tenho acesso** a Keyword Planner,
Ahrefs ou Semrush neste ambiente. Portanto **os volumes abaixo são estimativas**,
derivadas de sinais indiretos e confiáveis, mas estimativas:

- quantidade e maturidade de concorrentes pagando para atacar o termo;
- se existem **domínios de correspondência exata** no termo (sinal fortíssimo de
  volume comercial: ninguém registra `achadinhopro.com.br`, `achadinhosbot.com.br`
  e `achadinbot.com` para um termo sem busca);
- presença de YouTube e TikTok na página 1 (sinal de volume popular alto);
- se a SERP é dominada por blog genérico (= termo fácil) ou por produto (= termo disputado).

**Recomendação:** antes de executar, valide os 20 termos do Bloco A no Keyword
Planner (é grátis com conta Google Ads) ou no Ubersuggest. É 1 hora de trabalho
e transforma estimativa em número.

---

## 3. Mapa da concorrência (quem realmente ocupa a SERP)

| Concorrente | Domínio | Posicionamento | Força |
|---|---|---|---|
| **Achadinho Pro** | achadinhopro.com.br | "achadinhos" + IA + Shopee | **O mais perigoso.** Domínio exato + blog forte + rankeia em comparativos |
| **ProAfiliados** | proafiliados.com.br / .com | "Grátis" + WhatsApp **e** Telegram | Aparece em quase toda busca. Dois domínios. Isca do plano grátis |
| **FluxoPromo** | fluxopromo.com | Telegram-first, WhatsApp como add-on | Forte no "grátis" |
| **Shozap** | shozap.com.br | Multicanal (WA+TG+Instagram) + 4 marketplaces | Cobertura ampla de marketplaces |
| **Afilira** | afilira.com | Shopee-first | Nichado em Shopee |
| **AchadinhosBot / AchadinBot** | achadinhosbot.com.br / achadinbot.com | Domínios exatos de "achadinhos" | Dominam a palavra sem esforço |
| **IA Divulgadora** | iadivulgadora.com.br | "IA" no nome | Explora o hype de IA |
| **Devzapp** | blog.devzapp.com.br | **Blog** de conteúdo | Rouba tráfego informacional de todo mundo |
| **Shark Pomo Bot** | sharkgestao.com | IA + reescrita de copy | Médio |

### Três leituras estratégicas

**a) Todo mundo lidera com "GRÁTIS".** ProAfiliados chama o produto de "Bot
Afiliados WhatsApp e Telegram **Grátis**". FluxoPromo idem. O BOTinho tem 7 dias
grátis de verdade (plano Pro completo) e **não comunica isso onde é buscado**.
Isso é dinheiro parado.

**b) Todo mundo é WhatsApp + Telegram.** O BOTinho é só WhatsApp. Isso é uma
decisão de produto legítima, mas custa tráfego: uma fatia grande das buscas
inclui "telegram". Não estou sugerindo construir Telegram — estou apontando que
existe um cluster de conteúdo aí ("por que operar só no WhatsApp", "WhatsApp ou
Telegram para grupo de ofertas") que captura essa busca **sem precisar do produto**.

**c) O blog da Devzapp rankeia sem ser concorrente direto.** Prova de que o
conteúdo informacional deste nicho é **fácil de rankear**. É a porta de entrada
mais barata que existe aqui.

---

## 4. Pesquisa de palavras-chave — os clusters

Notação: **Vol** = volume estimado (Alto / Médio / Baixo). **Dif** = dificuldade
estimada de rankear. **Score** = prioridade (volume alto + dificuldade baixa = topo).

### 🥇 BLOCO A — Atacar primeiro (muito buscado + fácil de rankear)

Estas são as **oportunidades assimétricas**: têm demanda real e a página 1 hoje
está fraca ou ocupada por conteúdo genérico que o BOTinho supera facilmente.

| # | Palavra-chave | Vol | Dif | Por que é a melhor aposta | Status hoje |
|---|---|---|---|---|---|
| 1 | **bot para achadinhos whatsapp** | Alto | Média | 3 domínios exatos provam o volume; nenhum tem conteúdo profundo | Página existe mas é **thin** (7 linhas de template) |
| 2 | **robô para grupos de ofertas whatsapp** | Alto | **Baixa** | Ninguém otimiza para "robô", só para "bot" | ❌ Zero cobertura |
| 3 | **bot afiliados whatsapp grátis** | Alto | Média | Você tem 7 dias grátis de verdade e não usa | ❌ Zero cobertura |
| 4 | **como automatizar grupo de ofertas no whatsapp** | Alto | **Baixa** | SERP dominada por blog genérico e YouTube | ⚠️ Parcial |
| 5 | **bot shopee whatsapp automático** | Muito Alto | Média | Shopee é o marketplace #1 do nicho | ⚠️ Só 1 post de blog |
| 6 | **como encher grupo de achadinhos** | Alto | **Baixa** | Só blogs de terceiros ocupam | ❌ Zero cobertura |
| 7 | **melhores bots para afiliados 2026** | Médio | **Baixa** | Comparativo é o formato #1 citado por IA (33%) | ⚠️ Página existe, não rankeia |
| 8 | **postar ofertas automaticamente no whatsapp** | Alto | Baixa | Linguagem literal do usuário | ⚠️ Parcial |
| 9 | **bot ofertas amazon whatsapp** | Alto | Média | Segundo maior marketplace | ❌ Só blog |
| 10 | **converter link de afiliado automaticamente** | Médio | **Baixa** | Você é tecnicamente superior aqui (cupom + produto) | ✅ Tem post, precisa virar página de produto |
| 11 | **grupo de ofertas whatsapp como criar** | Muito Alto | Baixa | Topo de funil massivo, vira lead | ⚠️ Tem post, pode dominar |
| 12 | **bot mercado livre whatsapp afiliado** | Médio | Baixa | Você tem integração real e profunda com ML | ❌ Só blog |
| 13 | **automatizar divulgação shopee** | Alto | Média | — | ⚠️ Parcial |
| 14 | **robô para afiliados whatsapp** | Alto | Baixa | Mesmo caso do #2: "robô" está livre | ❌ Zero |
| 15 | **quanto ganha com grupo de ofertas whatsapp** | Alto | **Muito baixa** | Isca perfeita de topo de funil | ❌ Zero |
| 16 | **whatsapp ou telegram para grupo de ofertas** | Médio | Baixa | Captura busca de Telegram sem ter Telegram | ❌ Zero |
| 17 | **bot magalu / aliexpress whatsapp** | Baixo-Médio | **Muito baixa** | Cauda longa quase sem concorrência | ❌ Zero |
| 18 | **link de afiliado não está dando comissão** | Médio | **Muito baixa** | Dor aguda; você tem RCA real sobre isso (Amazon tag) | ❌ Zero |
| 19 | **quantas mensagens posso mandar no whatsapp sem tomar ban** | Alto | Baixa | Dor #1 do nicho | ⚠️ Existe sob nome errado |
| 20 | **ferramenta para gerenciar vários grupos de whatsapp** | Alto | Média | — | ⚠️ Parcial |

### 🥈 BLOCO B — Manter e defender (você já ganha)

`automação whatsapp afiliados`, `automação para grupos de ofertas`,
`espelhar grupos whatsapp`, `bot para afiliados whatsapp`.
São vitórias reais. **Não mexer no que rankeia** — só reforçar links internos.

### 🥉 BLOCO C — Alto volume, difícil (fase 2, 6+ meses)

`chatbot whatsapp`, `automação whatsapp`, `whatsapp business api`.
SERP dominada por Blip, Zenvia, Wati, Take. **Não gaste esforço aqui agora** —
é outro mercado (atendimento corporativo), não o seu.

### ⛔ BLOCO D — Parar de investir

As **15 páginas de cidade** (`espelhar grupos whatsapp São Paulo/Recife/Belém/...`).
Ninguém procura automação de afiliado por cidade — o afiliado opera remoto. Essas
páginas usam template quase idêntico (risco de *thin content* / *doorway pages*,
que o Google penaliza) e consomem orçamento de rastreamento que deveria ir para
as páginas de marketplace. **Recomendação: não deletar de imediato** (perde link),
mas congelar produção e reaproveitar o mesmo motor programático para a dimensão
certa (marketplace × nicho × intenção).

---

## 5. Os 6 problemas estruturais que travam tudo

### P1 — Identidade dividida (marca vs. domínio) 🔴 CRÍTICO

`espelhagrupos.com.br` renderiza "BOTinho". Para o Google e, sobretudo, para as
IAs, **entidade é tudo**: uma IA só cita com confiança uma marca que ela consegue
identificar de forma consistente. Hoje, quem pergunta "qual o melhor bot de
ofertas?" para uma IA não tem como conectar "BOTinho" a "espelhagrupos.com.br".

**O que decidir:** escolher **um** nome e usá-lo em todo lugar (título, H1,
`llms.txt`, schema `Organization`, perfis sociais, YouTube). Se a marca é BOTinho,
avaliar migrar para um domínio compatível (com redirecionamento 301, sem perder
autoridade). Se o domínio é para ficar, "Espelha Grupos" precisa virar a marca
principal e "BOTinho" o nome do produto — declarado assim no schema.

**Esta é a decisão mais importante do relatório e é sua, não minha.**

### P2 — Vocabulário inventado 🔴 CRÍTICO

"Módulo de Preservação Avançada" (104 menções) é um termo que **não existe fora
da empresa**. O mercado busca "anti-ban", "não tomar ban", "sem ser banido".
"Cadência" (219 menções) — o mercado diz "intervalo", "de quanto em quanto tempo".
"Espelhamento" — o mercado diz "repostar", "copiar ofertas de outro grupo".

Não é sobre abandonar o termo próprio (ele é bom para diferenciação e é honesto,
já que "anti-ban" é promessa que ninguém pode cumprir). É sobre **entrar pela
palavra do cliente e traduzir dentro da página**: título e H1 com a palavra que
ele busca, e no corpo explicar por que vocês chamam de preservação avançada.

### P3 — Títulos começando pela marca 🟠 ALTO

`BOTinho | Bot para Afiliados no WhatsApp` → o Google dá mais peso ao início do
título e a marca tem volume ~zero. Todas as LPs terminam em `| BOTinho`,
consumindo caracteres úteis. Auditoria anterior já apontou títulos duplicando
`| BOTinho | BOTinho` — verificar se foi corrigido.

### P4 — Páginas comerciais são "cascas" 🟠 ALTO

`/bot-achadinhos-whatsapp` tem **7 linhas** e só chama um template compartilhado
com dezenas de outras páginas. Página de casca não rankeia em termo disputado e
não é citada por IA (IA extrai passagens densas e específicas, não template).
As páginas do Bloco A precisam de conteúdo próprio, dados próprios, exemplos próprios.

### P5 — Zero exploração de fontes de terceiros 🟠 ALTO

Dado do setor: **marcas são citadas por IA 6,5× mais via fontes de terceiros do
que pelo próprio site**. As IAs puxam de YouTube, Reddit, fóruns e listas
"melhores ferramentas". Hoje o BOTinho não aparece em nenhuma lista de terceiros
— enquanto Achadinho Pro escreve o próprio comparativo e rankeia com ele.

### P6 — Nenhuma isca de captura de e-mail no topo de funil 🟡 MÉDIO

Existem materiais (`/materiais/checklist-*`) e ferramentas (calculadoras), o que é
ótimo. Mas as buscas de maior volume são informacionais ("como criar grupo de
ofertas", "quanto ganha") e não há um caminho claro dessas páginas para captura.
Tráfego sem captura é tráfego perdido.

---

## 6. Ser encontrado pelas IAs (ChatGPT, Perplexity, Gemini, AI Overviews)

Isso é metade do seu pedido e merece tratamento separado, porque **as regras são
diferentes do Google**. No Google você quer *rankear*. Nas IAs você quer ser
*citado* — e uma página de posição 15 pode ser citada se estiver bem estruturada.

### O que já está certo ✅

`llms.txt` existe e é **muito bom** (define produto, público, limites de uso,
páginas citáveis). `pricing.md` existe com preços abertos — isso é o que faz um
agente de IA conseguir comparar o BOTinho com concorrentes que escondem preço.
Vocês estão à frente de 95% do mercado brasileiro nesse ponto.

### O que falta 🔧

1. **Verificar se os robôs de IA estão liberados.** O `robots.txt` atual usa só
   `User-agent: *`. Não há bloqueio explícito, o que é bom — mas vale declarar
   explicitamente `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended` e
   `ChatGPT-User` como permitidos, para não depender de interpretação.
2. **Blocos de resposta extraíveis.** IA extrai trechos de 40–60 palavras que
   fazem sentido sozinhos. As páginas hoje são narrativas. Cada página do Bloco A
   precisa começar com uma definição direta e autossuficiente.
3. **Estatísticas próprias.** Citar dados aumenta a chance de citação em ~40%.
   Vocês têm um ativo raro: **dados reais de operação** (volume de ofertas
   espelhadas, taxa de bloqueio por repetição, horários de maior conversão). Uma
   página de *benchmark* anual com números próprios e anonimizados seria a peça
   mais citável do nicho inteiro — ninguém no Brasil tem isso.
4. **Comparativos honestos.** Comparativo é ~33% de todas as citações de IA.
   Existem `/comparativos` e `/alternativas`, mas comparam o BOTinho com
   "planilha manual" e "ferramentas genéricas" — categorias abstratas. **IA quer
   nome contra nome.** Comparativos justos e verificáveis contra Achadinho Pro,
   ProAfiliados, Shozap, FluxoPromo. Justo é obrigatório: IA penaliza comparativo
   enviesado, e comparativo desonesto é risco jurídico e de reputação.
5. **Autoria com credencial.** Conteúdo com autor identificado é mais citado.
   Hoje os posts não têm autor visível com expertise declarada.
6. **Presença fora do site.** YouTube (respondendo "como criar grupo de ofertas"),
   respostas em fóruns/Reddit, e presença em listas de terceiros.

---

## 7. Plano de ação priorizado

Ordenado por **retorno ÷ esforço**. Cada bloco é independente.

### Onda 0 — Decisões (você decide, ninguém executa antes)

| # | Decisão | Por quê |
|---|---|---|
| 0.1 | **Marca única: BOTinho ou Espelha Grupos?** | Trava P1. Nada de entidade avança sem isso |
| 0.2 | Migrar domínio ou manter e realinhar marca? | Consequência de 0.1 |
| 0.3 | Vamos falar "anti-ban" no título (traduzindo depois) ou manter só "preservação"? | Trava ~20% do volume do nicho |
| 0.4 | Validar os 20 termos do Bloco A no Keyword Planner | Troca estimativa por número |

### Onda 1 — Correções baratas de alto impacto (dias)

| # | Ação | Impacto |
|---|---|---|
| 1.1 | Reescrever títulos e H1 começando pela palavra-chave, não pela marca | Alto |
| 1.2 | Adicionar `grátis` / `7 dias grátis` nos títulos e descrições comerciais | Alto |
| 1.3 | Declarar explicitamente os robôs de IA no `robots.txt` | Médio |
| 1.4 | Reescrever a abertura das páginas comerciais com definição direta em 40–60 palavras | Alto (IA) |
| 1.5 | Adicionar autor com credencial nos posts | Médio (IA) |
| 1.6 | Congelar novas páginas de cidade | Evita dano |

### Onda 2 — Ocupar o Bloco A (semanas)

| # | Ação | Alvo |
|---|---|---|
| 2.1 | **Reconstruir `/bot-achadinhos-whatsapp` como página forte** (não template) | #1 |
| 2.2 | Criar cluster **"robô"** — espelhando as páginas "bot" com o termo popular | #2, #14 |
| 2.3 | Criar página **"bot para afiliados grátis"** vendendo o trial de 7 dias | #3 |
| 2.4 | Criar **hub por marketplace**: Shopee, Amazon, Mercado Livre, Magalu, AliExpress — página comercial densa por loja | #5, #9, #12, #17 |
| 2.5 | Guias de topo de funil: "como criar grupo de ofertas do zero", "como encher grupo de achadinhos", "quanto ganha" — **cada um com isca de e-mail** | #4, #6, #11, #15 |
| 2.6 | Página de dor: "meu link de afiliado não está dando comissão" | #18 |
| 2.7 | Página "quantas mensagens sem tomar ban" (entrar pela palavra do cliente) | #19 |

### Onda 3 — Autoridade e IA (mês 2–3)

| # | Ação |
|---|---|
| 3.1 | **Benchmark anual com dados próprios** — a peça mais citável possível |
| 3.2 | Comparativos nominais e justos vs. Achadinho Pro, ProAfiliados, Shozap, FluxoPromo |
| 3.3 | Página "melhores robôs para afiliados 2026" — formato mais citado por IA |
| 3.4 | YouTube: 5 vídeos respondendo as buscas do Bloco A |
| 3.5 | Presença em terceiros (listas, fóruns, comunidades de afiliados) |
| 3.6 | Rotina mensal de medição de citação em ChatGPT/Perplexity/AI Overviews |

### Onda 4 — Conversão (contínuo)

Tráfego sem captura não é lead. Cada página de topo de funil precisa de uma
saída clara: calculadora, checklist ou trial. Já existe infraestrutura
(`/ferramentas`, `/materiais`) — falta **conectar** às páginas novas.

---

## 8. Como medir (senão vira achismo)

| Métrica | Onde | Meta 90 dias |
|---|---|---|
| Termos do Bloco A no top 10 | Search Console | 12 dos 20 |
| Cliques orgânicos/mês | Search Console | +150% |
| Leads orgânicos (cadastro via busca) | Analytics interno + UTM | referência mês 1 → 3× |
| Citações em IA (20 consultas fixas) | Checagem manual mensal | de ~0 para 8 |
| Páginas indexadas de fato | Search Console | ≥90% do sitemap |

Já existem `docs/marketing/ai_visibility_tracking.csv` e um playbook mensal —
**reaproveitar em vez de criar novo processo.**

---

## 9. Os 5 riscos

1. **Canibalização.** Criar página de "robô" idêntica à de "bot" faz as duas
   competirem entre si. Precisam ter ângulo e conteúdo genuinamente diferentes.
2. **Thin content em escala.** O erro das páginas de cidade repetido em
   marketplace destrói mais do que constrói. Cada página nova precisa de conteúdo
   próprio real.
3. **Promessa indevida.** Entrar pela palavra "anti-ban" **não pode** virar
   promessa de que não há banimento. Entrar pela palavra e corrigir a expectativa
   dentro da página é honesto; prometer é risco jurídico e de reputação.
4. **Comparativo enviesado.** IA penaliza e concorrente processa. Só comparativo
   verificável, com data e fonte.
5. **Migração de domínio mal feita.** Se a decisão 0.1 levar a trocar de domínio,
   sem 301 correto perde-se tudo que foi construído. Exige plano próprio.

---

## 10. As 3 coisas que eu faria primeiro se fosse só escolher três

1. **Decidir a marca única** (Onda 0.1) — sem isso, nenhuma IA vai te citar com confiança.
2. **Reconstruir a página de achadinhos e criar o cluster "robô"** — é o volume
   mais alto com a barreira mais baixa, e hoje está entregue de graça para
   três concorrentes com domínio exato.
3. **Publicar um benchmark com dados reais da operação** — é o único ativo que
   nenhum concorrente do Brasil consegue copiar, e é exatamente o tipo de
   conteúdo que IA cita.

---

## Fontes consultadas (SERP real, julho/2026)

- [Achadinho Pro](https://achadinhopro.com.br/) · [comparativo Shopee 2026](https://achadinhopro.com.br/blog/melhores-ferramentas-afiliados-shopee-2026)
- [ProAfiliados](https://proafiliados.com/) · [bot-grupos-ofertas](https://www.proafiliados.com.br/bot-grupos-ofertas)
- [FluxoPromo](https://fluxopromo.com/) · [FluxoPromo WhatsApp](https://fluxopromo.com/whatsapp)
- [Shozap](https://shozap.com.br/) · [Afilira](https://afilira.com/bot-afiliados-shopee) · [Shark Pomo Bot](https://www.sharkgestao.com/)
- [AchadinhosBot](https://achadinhosbot.com.br/) · [AchadinBot](https://achadinbot.com/) · [IA Divulgadora](https://iadivulgadora.com.br/)
- [Blog Devzapp — achadinhos](https://blog.devzapp.com.br/post/vender-encher-grupos-achadinhos-whatsapp) · [Grupify](https://www.grupify.com.br/)
- [DivulgaLinks](https://pro.divulgalinks.com.br/landing) · [Filipe Souza — N8N + WPPConnect](https://filipesouza.com.br/como-automatizar-grupos-de-afiliados-amazon-e-shopee-no-whatsapp-n8n-wppconnect/)
- Página do BOTinho que já rankeia: [automacao-whatsapp-afiliados](https://espelhagrupos.com.br/automacao-whatsapp-afiliados)
