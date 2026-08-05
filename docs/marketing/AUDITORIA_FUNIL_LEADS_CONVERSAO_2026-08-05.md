# Auditoria de funil — por que os leads não chegam (e não convertem)

Data: 2026-08-05
Escopo: diagnóstico de causa raiz + SEO/atração + copy/CRO + plano por prazo.
Base: código real do site (`dashboard/app`, `dashboard/components/landing`,
`dashboard/lib/marketing-content.js`) e os dados já consolidados em
`ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md` e `ESTUDO_INBOUND_LEADS_SEO_IA_2026-07-28.md`.

> Este documento é uma auditoria. Nada foi alterado no site.

---

## 0. Resumo em uma frase

O site não tem problema de volume de conteúdo (96 rotas, 20 posts) — tem
problema de **alvo** (atrai quem não compra), de **credibilidade** (prova social
inventada) e de **passagem** (não existe página de preço indexável, o CTA
principal do topo não leva ao cadastro, e o produto só entrega valor depois de
o cliente parear o WhatsApp dele).

Ordem de impacto: **credibilidade > passagem > alvo de tráfego**. Não adianta
trazer mais gente para um funil que fura.

---

## 1. Diagnóstico de gargalos (causa raiz)

### 1.1 🔴 Prova social fabricada — risco de crédito e risco jurídico

`dashboard/components/landing/Social.jsx` publica hoje:

- "Mais de **1.200 afiliadas** deixaram o copia-e-cola"
- **R$ 4,2M** em comissões geradas · **380k** links convertidos · **4,9 ★**
- 3 depoimentos com nome e foto (avatar em gradiente), entre eles
  *"Em duas semanas paguei a assinatura do ano"* e
  *"durmo e acordo com comissão pingando"*.

Não há nenhum lastro desses números no repositório. A referência interna mais
próxima de escala real (`PARCERIA_INFLUENCIADORES_AFILIADOS_2026-08-04.md`)
trabalha com **25 indicados pagantes** e **~R$1.400 de MRR novo** como *meta*.
O Search Console registra **41 cliques** no site inteiro em ~2,5 meses.

Três consequências, em ordem de gravidade:

1. **Jurídico.** Promessa de resultado financeiro em peça publicitária
   (CDC art. 37, publicidade enganosa; e o CONAR trata número não comprovável
   como afirmação enganosa). O próprio site declara em `PRODUCT_LIMITATIONS`:
   *"Não prometemos ganho financeiro, comissão ou aumento garantido de vendas"* —
   a home contradiz a própria política, na mesma página.
2. **Conversão.** 1.200 clientes + R$4,2M + 4,9★ com **zero avaliação
   verificável**, zero print, zero @ de Instagram real e avatar genérico é o
   padrão visual de site que o público de afiliado já aprendeu a desconfiar.
   Quem tem 1.200 clientes mostra print. O bloco derruba confiança em vez de
   construir.
3. **IA / autoridade.** ChatGPT e Perplexity checam número contra fonte externa.
   Número não corroborado em lugar nenhum reduz a chance de citação — que é
   justamente o canal em que o site vem apostando (`llms.txt`, IndexNow).

**Esta é a correção nº 1 do plano.** É a mais barata (uma tarde) e a de maior
retorno assimétrico.

### 1.2 🔴 Identidade dividida: domínio ≠ marca ≠ nav

| Superfície | Nome exibido |
|---|---|
| Domínio | `espelhagrupos.com.br` |
| `<title>` da home | "Espelha Grupos \| Bot para afiliados espelhar ofertas no WhatsApp" |
| Logo/nav da home | **BOTinho** |
| YouTube oficial | `@botinhoafiliado` |
| E-mail de suporte | `contato@espelhagrupos.com.br` |

O visitante que chega do Google lê "Espelha Grupos" no resultado e encontra
"BOTinho" no topo da página. Isso é **micro-atrito de 3 segundos no momento mais
caro do funil** (o primeiro contato) e, para Google/IA, são duas entidades sem
`sameAs` que as ligue. Já apontado no estudo de 2026-07-28 e **ainda não
resolvido** — porque a decisão é de negócio, não técnica.

Decisão necessária (não dá para adiar de novo): **uma marca só na superfície
pública**. Recomendação: manter `BOTinho` como marca (é o nome do canal do
YouTube e o que a cliente fala), usar "Espelha Grupos" apenas como razão
social/citação legal, e alinhar `<title>`, nav e OG num nome só. O domínio pode
continuar — domínio descritivo não atrapalha; identidade dupla atrapalha.

### 1.3 🟠 O tráfego que chega não tem intenção de compra

Dado próprio (`ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`):

- 96 rotas indexáveis, **36 com zero impressão**, 16 não indexadas.
- 15 LPs por cidade = **~25 impressões em 2,5 meses**; 5 delas zeradas.
- LPs de nicho (farmácia, autopeças, pet shop, beleza) = zero impressão.
- As 2 páginas que puxam 42% das impressões são posts de blog de
  **topo de funil** (`como-divulgar-ofertas-amazon-whatsapp`,
  `como-ser-afiliado-shopee-whatsapp`) — quem lê isso ainda **não tem grupo**,
  logo ainda não tem o problema que o produto resolve.

Ou seja: as poucas impressões que existem vêm de gente a 2-3 meses da compra, e
o site não tem ponte entre "quero ser afiliado" e "preciso de robô".

O termo comercial de fundo de funil (`bot para grupo whatsapp`, 500/mês,
concorrência alta) é o único onde o site tenta competir de frente — o pior
custo-benefício do levantamento.

### 1.4 🟠 Passagem quebrada: não existe rota de preço

Não há `/precos` nem `/planos`. O preço vive em `#planos`, âncora dentro da
home, renderizada **client-side** (`Pricing.jsx` é `'use client'` e busca
`/api/public/plans` no `useEffect`).

Três perdas somadas:

1. **SEO.** "quanto custa bot whatsapp", "preço", "bot whatsapp afiliados
   valor" são as buscas mais comerciais que existem no nicho. Existe um post de
   blog (`/blog/quanto-custa-bot-para-whatsapp-afiliados`) mas **nenhuma página
   de produto** para rankear com preço. Concorrente com `/precos` ganha por WO.
2. **Compartilhamento.** Não existe link para mandar no WhatsApp de um lead
   perguntando preço. Hoje é "entra no site e rola até embaixo".
3. **Renderização.** Como os valores chegam por fetch no cliente, o preço
   **não está no HTML inicial** — nem para o crawler, nem para IA, nem para
   quem tem conexão ruim (que é boa parte do público mobile).

### 1.5 🟠 O CTA principal do topo não leva ao cadastro

No `Hero.jsx`, o botão de maior contraste da barra de navegação — **"Começar
grátis"** — aponta para `href="#planos"`. Ele **rola a página**, não inicia
cadastro. O botão que de fato cadastra é o do corpo do hero
("Conectar meu WhatsApp" → `buildRegisterHref`).

Dois defeitos:

- O CTA com maior expectativa de ação ("começar") entrega a menor ação (rolar).
- "Conectar meu WhatsApp" como CTA primário **pede a coisa que mais assusta**
  antes de qualquer valor entregue. Para o público (afiliada com medo de ban,
  Tier 2 do nosso próprio levantamento de keywords: `whatsapp banido`,
  `conta banida whatsapp`, 5.000/mês cada), "conectar meu WhatsApp" lê-se como
  "entregar minha conta para um desconhecido". É o pior verbo possível na porta
  de entrada.

### 1.6 🟡 Ativação: o valor só aparece depois do pareamento

O cadastro em si é razoável (`/login?mode=register`): nome, e-mail, celular,
senha, aceite de termos, código de indicação opcional. 5 campos — aceitável,
mas o **celular obrigatório** custa conversão num primeiro contato.

O problema maior é depois: entre "criei conta" e "vi valor" existe
**parear o WhatsApp por QR code**. Enquanto isso não acontece, o painel não
mostra nada de útil. É o degrau onde o trial de 7 dias morre — e o relógio dos
7 dias corre **desde o cadastro**, não desde a ativação, o que pune justamente
quem hesitou por medo.

### 1.7 🟡 Vocabulário interno vazando para a porta de entrada

"Módulo de Preservação Avançada" (104 ocorrências), "cadência" (219),
"espelhamento" (220) são termos que ninguém busca e que o visitante novo não
decodifica. A regra já está escrita no `AGENTS.md` ("o termo próprio da casa é
explicado dentro da página, não usado como porta de entrada") — e a home
descumpre: o card de destaque do plano Pro é literalmente
"Canais + Automação + Preservação".

---

## 2. Auditoria de SEO e atração

### 2.1 O que já está certo (não mexer)

Infra acima da média do nicho: sitemap dinâmico com registro único
(`seo-registry.mjs`), IndexNow no deploy de produção, `llms.txt`, JSON-LD
(FAQPage/Organization), robots dinâmico, rastreio de referral de IA
(`referral_visit`), e a auditoria mensal do `robots.txt` gerenciado da
Cloudflare. Isso é ativo real — o gargalo não é técnico.

### 2.2 Onde está a demanda (já medida, não re-estimar)

| Tier | Termo | Volume/mês | Concorrência |
|---|---|---:|---|
| 1 | `shopee afiliados`, `mercado livre afiliados`, `afiliado amazon` | 50.000 cada | **Baixa** |
| 1 | `como ser afiliado [loja]` | 5.000 cada | Média |
| 2 | `whatsapp banido`, `conta banida whatsapp`, `número banido` | 5.000 cada | **Baixa** |
| 3 | `achadinhos`, `grupo de ofertas whatsapp` | 5.000 cada | Baixa/Média |
| 5 ❌ | `bot para grupo whatsapp` | 500 | **Alta** ← é aqui que o site compete |

### 2.3 Prioridades estruturais (nesta ordem)

1. **Criar `/precos` como rota real e server-rendered.** Preço no HTML inicial,
   FAQ de cobrança (o que acontece ao fim do trial, cancelamento, formas de
   pagamento), tabela comparativa Basic × Pro, schema `Product`/`Offer`.
   Manter `#planos` na home como âncora que aponta para lá. É a maior lacuna
   comercial do site.
2. **Ponte de intenção nos 2 posts que já rankeiam.** As duas páginas com
   tração hoje não têm oferta contextual forte. Inserir, no meio do conteúdo
   (não no fim), um bloco "você já tem grupo? o passo seguinte é X" apontando
   para `/precos` ou para a ferramenta gratuita. Ganho imediato sem tráfego novo.
3. **Cluster "banido" como topo de funil de dor.** 5.000/mês, concorrência
   baixa, e já existem os ativos (`/anti-ban-whatsapp`,
   `/diagnostico-antiban-whatsapp`, `/ferramentas/calculadora-risco-whatsapp`).
   Falta entrar pela palavra que a pessoa digita ("whatsapp banido", "por que
   meu zap foi banido") em vez do termo da casa.
   ⚠️ Limite que não se cruza: entrar pela palavra "banido" **não** vira
   promessa de que não banem — corrigir expectativa é honesto, prometer é risco.
4. **Congelar de vez cidade e nicho.** Sem novas páginas nessas linhas
   (já decidido no `AGENTS.md`). Não deletar as existentes; parar de investir e
   redirecionar o esforço.
5. **Podar/consolidar as 36 rotas com zero impressão.** Conteúdo fino em massa
   dilui autoridade do domínio. Fundir em hubs mais fortes com 301, mantendo o
   link.
6. **A dimensão que falta é marketplace × intenção**, não cidade:
   Shopee/ML/Amazon × (ser afiliado, divulgar, converter link, grupo).
   Shopee primeiro — é o maior no Trends e o de concorrência mais baixa.

---

## 3. Auditoria de copywriting e CRO

### 3.1 Teste dos 5 segundos — a home reprova

Headline atual (variante padrão):
> "Promoções conferidas viram **rotina no seu grupo/canal.**"

Subtítulo (91 palavras de leitura, uma frase só):
> "Você indica os grupos e/ou canais que quer monitorar (de promoções, ofertas,
> achadinhos). O bot detecta cada link da Shopee, ML ou Amazon, **usa as
> credenciais cadastradas quando aplicável** e reposta no seu próprio grupo e/ou
> canal de clientes **com controle operacional**."

Problemas objetivos:

- "rotina" e "controle operacional" são **benefícios de processo**. O comprador
  quer **comissão sem trabalho manual** e **sem tomar ban**.
- "e/ou" aparece 3× em duas frases. É linguagem de contrato, não de venda.
- "quando aplicável", "credenciais cadastradas" — ressalva jurídica no lugar de
  maior atenção da página. Ressalva é necessária; o lugar dela é a seção de uso
  responsável, que já existe logo abaixo.
- Não há **para quem é** na primeira dobra. "Afiliada" não aparece na headline.

Alternativa a testar (mesma promessa, sem inventar resultado):
> **H1:** Suas ofertas de afiliada, postadas sozinhas — no seu ritmo, sem
> copiar e colar.
> **Sub:** Você escolhe os grupos que já acompanha. O robô pega os links da
> Shopee, Amazon e Mercado Livre, troca pelo seu link de afiliada e posta no seu
> grupo com intervalo controlado. Você revisa o que quiser antes.

Entra pela palavra que a pessoa usa (afiliada, robô, copiar e colar), promete
trabalho a menos (não dinheiro a mais) e o "intervalo controlado" carrega a
preservação sem o jargão.

### 3.2 CTA

| Onde | Hoje | Problema | Sugestão |
|---|---|---|---|
| Nav (botão de destaque) | "Começar grátis" → `#planos` | promete começar, só rola | apontar para o cadastro |
| Hero primário | "Conectar meu WhatsApp" | pede o ato mais assustador antes de qualquer valor | "Testar 7 dias grátis" / "Criar minha conta grátis" |
| Hero secundário | "Ver como funciona" → `#como` | ok | manter |
| Pricing | "Começar teste grátis" / "Assinar Basic" | ok | manter |

Os selos de confiança do hero ("Sem cartão para testar", "Configura em 4
minutos", "Cancela quando quiser") são bons e verificáveis — **mantenha e
promova**: são a melhor coisa da primeira dobra e estão em fonte 13,5px,
abaixo da linha de dobra no mobile.

### 3.3 Prova social — o que colocar no lugar do que sai

Substituir o bloco inventado por prova **verificável**, mesmo que menor:

1. **Print real de painel** (com dados borrados) mostrando envios feitos —
   número de mensagens espelhadas é dado que o próprio sistema tem
   (`MessageLog`), é honesto e é impressionante sem prometer comissão.
2. **1 a 3 depoimentos reais com autorização**, nome + @ do Instagram/canal
   verificável. Três reais valem mais que doze inventados.
3. **Vídeo do canal oficial** (`@botinhoafiliado`) embutido — já existe e é
   prova viva de que tem gente atrás do produto.
4. **Enquanto não houver depoimento colhido:** trocar o bloco por
   transparência ("somos um time pequeno, atendemos por WhatsApp, respondemos
   em até 1 dia útil") + os selos de confiança. Vazio honesto converte mais que
   cheio duvidoso — e não gera passivo.

Regra permanente: **nenhum número no site sem fonte rastreável**, e nenhum
depoimento sem autorização por escrito.

### 3.4 Fricção

- **Preço renderizado no cliente** → risco de tela vazia/flash no momento da
  decisão. Server-render com fallback estático (`DEFAULT_LANDING_PLANS` já
  existe, use como valor inicial em vez de estado nulo).
- **Celular obrigatório no cadastro** → tornar opcional ou pedir depois, na
  primeira tela do painel. Cada campo obrigatório a mais custa conversão.
- **Trial de 7 dias contando do cadastro** → contar da **ativação** (primeiro
  pareamento). Quem trava no QR hoje perde o trial sem nunca ter usado.
- **Sem tela de valor antes do pareamento** → montar um painel de "primeiro
  passo" que mostre uma oferta convertida de exemplo (o motor
  `buildScrapedOffer` já faz isso em `/criar-oferta`) antes de pedir o QR.
  Deixar a pessoa **colar um link e ver o resultado convertido** sem conectar
  nada é o maior ganho de ativação disponível.

---

## 4. Plano de ação

### Quick wins — 7 a 14 dias

| # | Ação | Onde | Por quê |
|---|---|---|---|
| 1 | **Remover estatísticas e depoimentos não comprovados** | `dashboard/components/landing/Social.jsx` (e o gêmeo em `landing/src/components/Social.jsx`) | risco jurídico + contradiz a própria política do site |
| 2 | Substituir por selos de confiança + vídeo do canal oficial | idem | prova verificável, custo zero |
| 3 | **Nav "Começar grátis" apontar para o cadastro**, não `#planos` | `Hero.jsx` | CTA de maior destaque hoje não converte |
| 4 | **Trocar CTA primário do hero** para "Testar 7 dias grátis" | `Hero.jsx` | "Conectar meu WhatsApp" assusta antes de entregar valor |
| 5 | **Criar `/precos`** server-rendered, com FAQ de cobrança e schema Offer | rota nova | maior lacuna comercial; termo de maior intenção |
| 6 | **Preço no HTML inicial** (usar `DEFAULT_LANDING_PLANS` como estado inicial) | `Pricing.jsx` | preço invisível para crawler/IA |
| 7 | **Celular opcional no cadastro** | `app/login/page.js` | menos campo obrigatório = mais cadastro |
| 8 | Reescrever H1 + subtítulo da home (versão da §3.1) | `Hero.jsx` | teste dos 5 segundos |
| 9 | **Decidir a marca única** e alinhar nav/title/OG | `marketing-content.js` + metadata | identidade dividida trava marca e IA |
| 10 | Bloco de ponte no meio dos 2 posts que rankeiam | `app/blog/...` | 42% das impressões sem oferta contextual |

Todos passam por `develop` → staging → validação → `main`, como sempre.

### Médio prazo — 30 a 90 dias

1. **Cluster Shopee afiliados** (Tier 1, 50k/mês, concorrência baixa):
   3 a 5 peças entrando pela palavra da pessoa, com ponte explícita para o
   produto no meio do texto. Shopee primeiro, ML depois, Amazon terceiro.
2. **Cluster "whatsapp banido"** (Tier 2): reposicionar os ativos anti-ban que
   já existem para entrar pela dor, com o limite de promessa respeitado.
3. **Contar o trial da ativação**, não do cadastro; e-mail de resgate no dia 2
   para quem não pareou (o transporte SMTP já existe em `src/email/mailer.js`).
4. **Demo sem pareamento**: colar link → ver oferta convertida, antes do QR.
5. **Poda de conteúdo fino**: consolidar as 36 rotas zeradas em hubs, com 301.
6. **Fechar a instrumentação do funil.** Os eventos já existem
   (`referral_visit`, `signup_started_from_seo`, `signup_created`,
   `checkout_started`) — falta a **leitura**: um painel com visitante → cadastro
   → pareamento → checkout → pagante, por origem. Sem isso, toda decisão daqui
   para frente continua sendo palpite.
7. **Colher 5 depoimentos reais com autorização** entre os clientes atuais.
8. **Programa de parceria com influenciadoras** (plano já escrito em
   `PARCERIA_INFLUENCIADORES_AFILIADOS_2026-08-04.md`) — no estágio atual de
   tráfego, indicação converte mais rápido que SEO.

### Longo prazo — posicionamento e autoridade

1. **Uma marca, uma entidade.** Nome único em site, YouTube, Instagram, e
   `sameAs` ligando tudo. É pré-requisito para ser citado por IA.
2. **Ser a referência em "afiliado sem tomar ban"**, não em "bot de WhatsApp".
   O primeiro é dor com volume e concorrência baixa; o segundo é briga cara com
   dezenas de bots iguais.
3. **Conteúdo com dado próprio.** O sistema mede coisas que ninguém mais mede
   (cadência real que sobrevive, taxa de queda de sessão, horário de melhor
   entrega). Publicar um estudo anual anonimizado disso gera link e citação de
   IA — é o único ativo que concorrente não copia.
4. **Presença fora do site** (YouTube, comunidades de afiliado, parcerias): o
   próprio estudo interno mediu que marca é citada por IA ~6,5× mais via fonte
   de terceiro do que pelo próprio site.
5. **Recoleta mensal** de Search Console + Planejador + Trends + referrals de
   IA contra o baseline de 2026-07-30, olhando **consultas distintas** e
   posição das páginas fortes — não impressões totais.

---

## 5. Dados que faltam para refinar (perguntas objetivas)

1. Quantos cadastros/mês hoje, e quantos viram pagantes?
2. Dos cadastrados, quantos chegam a parear o WhatsApp? (é a hipótese de maior
   vazamento)
3. Qual a origem dos clientes atuais — indicação, Instagram, YouTube ou busca?
4. Os 1.200/R$4,2M/4,9★ têm alguma fonte que eu não encontrei no repo?
5. Existe algum cliente disposto a dar depoimento com nome e print?

Com (1) e (2) dá para dizer se o problema é topo (não chega gente) ou meio
(chega e não ativa) — hoje a evidência aponta para **os dois**, com o meio
sendo mais barato de consertar.
