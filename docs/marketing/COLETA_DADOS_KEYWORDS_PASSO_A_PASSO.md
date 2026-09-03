# Coleta de dados reais de palavras-chave — passo a passo

Objetivo: substituir as **estimativas** do estudo de 2026-07-28 por **números reais**.
São 3 relatórios. O nº 1 é o mais valioso e o mais rápido.

Ao terminar, me mande os arquivos exportados (CSV). Eu monto a matriz final de
prioridade com número real em vez de estimativa.

---

## RELATÓRIO 1 — Google Search Console (o mais importante)

**Por que primeiro:** é dado **exato** (não é faixa nem estimativa), é **grátis**,
é sobre o **seu** site, e mostra a mina de ouro: as buscas em que você já aparece
na **posição 8–20**. Essas são as vitórias mais rápidas que existem — falta pouco
para virar página 1.

### Passos

1. Acesse https://search.google.com/search-console
2. Escolha a propriedade `espelhagrupos.com.br`
   - *Se não existir*, me avise — a propriedade precisa ser criada e verificada antes.
3. Menu lateral → **Desempenho** → **Resultados da pesquisa**
4. No topo, clique no filtro de data → **Personalizado** → **Últimos 12 meses**
   (se o site for mais novo, pegue **Todo o período**)
5. Confirme que as 4 caixas de métrica estão **ligadas** (elas ficam azuis quando ativas):
   - Total de cliques
   - Total de impressões
   - CTR médio
   - **Posição média** ← esta costuma vir desligada, **precisa ligar**
6. Logo abaixo, selecione a aba **CONSULTAS**
7. Canto superior direito → botão **Exportar** → **CSV** (ou "Baixar CSV")
8. Repita o export na aba **PÁGINAS** (mesmo período, mesmas métricas)

### O que me mandar
- `Consultas.csv`
- `Páginas.csv`

### Observação
O Search Console limita a exportação da tela a 1.000 linhas. Está ótimo para o
que preciso. Se aparecer opção de exportar para Google Sheets, prefira — vem completo.

---

## RELATÓRIO 2 — Planejador de Palavras-Chave do Google

**Por que:** traz o volume de busca de termos em que você **ainda não aparece**
(o Search Console só mostra onde você já aparece).

### Pré-requisito e uma armadilha importante

Precisa de conta no **Google Ads** (criar é grátis, **não precisa rodar anúncio**).

⚠️ **Armadilha:** contas que nunca gastaram nada mostram o volume em **faixas**
("1 mil – 10 mil") em vez do número exato. Duas saídas:

- **Opção A (grátis):** aceitar as faixas. Já resolve 80% da priorização.
- **Opção B (~R$50):** rodar uma campanha mínima por alguns dias. Destrava o
  número exato **para sempre**. Se o plano é levar SEO a sério, vale.

Comece pela A. Se as faixas ficarem largas demais para decidir, aí faça a B.

### Como criar a conta sem cair na armadilha do anúncio

1. https://ads.google.com → **Começar agora**
2. O Google vai empurrar a criação de uma campanha. **Não crie.**
   Procure o link pequeno **"Alternar para o modo especialista"** ou
   **"Criar uma conta sem uma campanha"** (fica no rodapé, em letra menor)
3. Preencha país **Brasil**, fuso **Brasília**, moeda **BRL**
4. Finalize. Não precisa cadastrar cartão para usar o Planejador.

### Parte A — "Descobrir novas palavras-chave"

1. Ícone de ferramentas (chave inglesa) no topo → **Planejamento** →
   **Planejador de palavras-chave**
2. Clique em **Descobrir novas palavras-chave**
3. **Configure antes de rodar** (isso muda tudo):
   - **Local: Brasil** (remova "Todos os locais" se vier preenchido)
   - **Idioma: Português**
   - **Redes de Pesquisa: Google** (sem "parceiros de pesquisa")
   - **Período: Últimos 12 meses**
4. ⚠️ **O segundo campo ("Insira um site para filtrar palavras-chave não
   relacionadas") deve ficar VAZIO.** Ele *remove* palavras que o Google julga
   não relacionadas ao site — ou seja, cortaria justamente "achadinhos", "robô"
   e "grátis", que são os termos que ainda não cobrimos e queremos descobrir.
   Preencher esse campo faz o relatório voltar só confirmando o que já existe.
5. ⚠️ **Desligue o bloqueador de anúncios** nessa aba. O Google Ads avisa na
   tela e o download do CSV falha com o bloqueador ativo.
6. Cole o **Lote 1** da lista abaixo → **Ver resultados**
7. Confira no topo dos resultados se o período está em **últimos 12 meses**
8. Canto superior direito → **Fazer o download das ideias de palavras-chave** → **CSV**
9. **Repita** para os Lotes 2, 3 e 4 (o Google aceita no máximo 10 sementes por vez)

### Parte B — "Ver o volume de pesquisa" (a lista fechada)

1. Volte ao Planejador → **Ver volume de pesquisa e previsões**
2. Cole a **LISTA COMPLETA** (última seção deste documento) de uma vez
3. Mesmas configurações: Brasil / Português / Google / 12 meses
4. Aba **Palavras-chave históricas** (não a de "Previsão")
5. **Download** → **CSV**

### O que me mandar
- Os 4 CSVs da Parte A
- O CSV da Parte B

---

## RELATÓRIO 3 — Google Trends (2 minutos, resolve uma dúvida específica)

**Por que:** o Planejador trata "bot" e "robô" como coisas separadas e não diz
qual está **crescendo**. O Trends responde isso e é grátis, sem login.

1. Acesse https://trends.google.com.br
2. Configure: **Brasil** · **Últimos 12 meses** · **Pesquisa na Web**
3. Faça **3 comparações** (o Trends compara até 5 termos por vez).
   Em cada uma, use o botão **Comparar** para adicionar os termos:

   **Comparação 1 — como o mercado chama a ferramenta**
   `bot whatsapp` · `robô whatsapp` · `automação whatsapp` · `bot de ofertas`

   **Comparação 2 — como o mercado chama o produto**
   `achadinhos` · `grupo de ofertas` · `promoções whatsapp` · `cupom de desconto`

   **Comparação 3 — marketplaces**
   `afiliado shopee` · `afiliado amazon` · `afiliado mercado livre` · `afiliado magalu`

4. Em cada comparação, clique no ícone de **download** (seta para baixo, canto
   superior direito do gráfico) → salva CSV

### O que me mandar
- Os 3 CSVs (ou só prints do gráfico — para o Trends, print resolve)

---

## SEMENTES PARA A PARTE A (copiar e colar, um lote por vez)

> **Calibragem importante.** Nesta tela o Google usa a semente para **expandir**.
> Semente **curta ou média** abre um leque grande de ideias; semente longa
> devolve pouca coisa. Por isso os lotes abaixo são curtos de propósito.
> As frases longas não se perdem — elas são medidas na **Parte B**, onde o
> objetivo é medir uma lista fechada, não descobrir.
>
> Pode colar tudo de uma vez **separado por vírgula** — o Google quebra em
> etiquetas sozinho.

### Lote 1 — núcleo bot / robô
```
bot para grupos de ofertas, robô para whatsapp, bot afiliados, grupo de ofertas whatsapp, achadinhos, automação whatsapp, afiliado shopee, divulgar ofertas, link de afiliado, grupo de achadinhos
```

### Lote 2 — marketplaces e links
```
afiliado amazon, afiliado mercado livre, afiliado magalu, converter link de afiliado, programa de afiliados, comissão de afiliado, shopee afiliados, vender como afiliado
```

### Lote 3 — topo de funil
```
grupo de whatsapp de promoções, como criar grupo de ofertas, ganhar dinheiro no whatsapp, cupom de desconto, promoções whatsapp, encher grupo de whatsapp, renda extra whatsapp
```

### Lote 4 — dor e concorrentes
```
whatsapp banido, disparo em massa whatsapp, enviar mensagem vários grupos, achadinho pro, proafiliados, shozap, bot whatsapp preço, chatbot whatsapp
```

---

## LISTA COMPLETA PARA A PARTE B (colar tudo de uma vez)

```
bot para grupos de ofertas whatsapp
robô para grupos de ofertas whatsapp
bot para grupos de achadinhos
robô para grupos de achadinhos
bot achadinhos whatsapp
robô achadinhos whatsapp
bot para achadinhos
automação para grupos de ofertas
automação para grupos de achadinhos
automação para afiliados
automação whatsapp afiliados
robô para afiliados
robô para afiliados whatsapp
bot para afiliados
bot para afiliados whatsapp
bot afiliados whatsapp grátis
bot para afiliados grátis
robô de vendas whatsapp
bot de ofertas whatsapp
bot de promoções whatsapp
bot de cupons whatsapp
automatizar grupo de whatsapp
automatizar grupos de ofertas
automatizar divulgação whatsapp
como automatizar grupo de ofertas no whatsapp
postar ofertas automaticamente no whatsapp
enviar ofertas automaticamente whatsapp
divulgar ofertas whatsapp automático
publicar promoções automaticamente
programa para postar em vários grupos do whatsapp
enviar mensagem para vários grupos whatsapp
gerenciar vários grupos de whatsapp
ferramenta para grupos de whatsapp
software para grupos de ofertas
plataforma para afiliados whatsapp
bot shopee whatsapp
bot shopee afiliados
automação shopee whatsapp
afiliado shopee whatsapp
como ser afiliado shopee
divulgar shopee no whatsapp
bot amazon whatsapp
afiliado amazon whatsapp
divulgar amazon no whatsapp
bot mercado livre whatsapp
afiliado mercado livre whatsapp
divulgar mercado livre whatsapp
bot magalu whatsapp
afiliado magalu divulgar
bot aliexpress whatsapp
afiliado aliexpress whatsapp
converter link de afiliado
converter link de afiliado automaticamente
gerar link de afiliado automaticamente
trocar link de afiliado automático
link de afiliado não está dando comissão
como saber se o link de afiliado está funcionando
encurtador de link de afiliado
como criar grupo de ofertas no whatsapp
como criar grupo de achadinhos
como montar grupo de ofertas
como encher grupo de achadinhos
como divulgar grupo de ofertas
como conseguir membros para grupo de whatsapp
grupo de achadinhos whatsapp
grupo de ofertas whatsapp entrar
grupo vip de ofertas whatsapp
canal de ofertas whatsapp
canal de achadinhos whatsapp
grupo ou canal whatsapp ofertas
quanto ganha com grupo de ofertas
quanto ganha um afiliado shopee
ganhar dinheiro com grupo de whatsapp
ganhar dinheiro como afiliado whatsapp
como ganhar dinheiro com achadinhos
vender no automático whatsapp
evitar banimento whatsapp
como não tomar ban no whatsapp
quantas mensagens posso enviar no whatsapp
limite de mensagens whatsapp
whatsapp banido o que fazer
whatsapp bloqueado divulgação
chip para bot whatsapp
número virtual para whatsapp bot
anti ban whatsapp
antiban whatsapp bot
bot whatsapp seguro
melhor bot para afiliados
melhor bot para grupos de ofertas
melhores ferramentas para afiliados
melhores bots para whatsapp
comparativo bot afiliados
alternativa ao proafiliados
alternativa ao achadinho pro
quanto custa bot para whatsapp
preço bot whatsapp afiliados
bot whatsapp mensalidade
teste grátis bot whatsapp
achadinho pro
proafiliados
shozap
fluxopromo
afilira
ia divulgadora
bot whatsapp e telegram
whatsapp ou telegram para grupo de ofertas
bot telegram afiliados
espelhar grupos whatsapp
espelhar grupo de whatsapp
copiar ofertas de outro grupo
repostar ofertas whatsapp
monitorar grupos de whatsapp
melhores horários para postar ofertas
agendar mensagem whatsapp grupo
disparo em massa whatsapp
botinho whatsapp
botinho bot
espelha grupos
```

---

## RELATÓRIO 5 — Cloudflare: carga no servidor (a partir de 09/2026)

**O que é:** quanto o site está sendo pedido, e quanto disso o NOSSO servidor
precisa atender. É a única fonte que liga o crescimento do marketing ao custo de
infraestrutura — e o site divide a mesma VPS com os robôs das clientes.

**Não substitui o Relatório 1.** "Visitante único" da Cloudflare conta robô,
monitoramento, visita direta e retorno; "clique" do Search Console conta só quem
veio de um resultado do Google. Foram 7.996 visitantes contra 177 cliques na
mesma janela — escalas diferentes porque medem coisas diferentes. **Nunca
comparar um número com o outro.**

### Passos (5 minutos)

1. Painel da Cloudflare → domínio `espelhagrupos.com.br` → **Analytics &
   Logs → Traffic** (o overview).
2. Período: **últimos 30 dias**.
3. Baixar o CSV de cada um destes cinco gráficos (botão de download no canto de
   cada card):
   - **Unique visitors**
   - **Total requests**
   - **Total data served**
   - **Percent cached**
   - **Data cached**
4. **Security → Bots** (ou "Requests by bot class"): baixar ou anotar a divisão
   entre robô e pessoa. ⚠️ **Este é o que faltou na primeira coleta** — sem ele
   não dá para provar que a subida de requisições é rastreamento, só inferir.
5. Salvar os CSVs em `docs/marketing/dados/cloudflare-<AAAA-MM-DD>/`.

### As três derivadas (nenhuma vem pronta no painel)

| Derivada | Conta | O que significa |
|---|---|---|
| **Requisições ao origin** | `requisições × (1 − cache%)` | A carga real na VPS. É o número que conversa com a política de memória. |
| **Requisições por visitante** | `requisições ÷ visitantes` | Sobe sem os visitantes subirem = rastreamento (robô de busca/IA varrendo). Sobem juntos = gente navegando mais. **Cair de repente com o site no ar = robô parou de vir** — conferir robots.txt e Cloudflare na hora. |
| **KB por requisição** | `dados servidos ÷ requisições` | Estável em ~3-5 KB. Subida súbita = página nova pesada ou mídia sem otimização. |

### Baseline para comparar (30 dias até 02/09/2026)

| Métrica | Valor |
|---|---:|
| Cache (média ponderada) | **28,9%** |
| Requisições por visitante | **64** (era 16 em 04/08) |
| Requisições/dia no origin | **21,7 mil** (era 3,5 mil em 04/08) |
| KB por requisição | **3,9** |

Análise completa da primeira rodada:
`docs/marketing/CLOUDFLARE_TRAFEGO_2026-09-03.md`.

---

## RELATÓRIO 4 — Referrals de IA (a partir de 08/2026)

**O que é:** quanta gente chegou ao site depois de ler uma resposta do ChatGPT,
da Perplexity, do Gemini ou do Claude. É a medida de "estou sendo citada por IA"
que vira lead de verdade.

**Não confundir com os relatórios 1-3.** Eles medem *onde está a demanda* e *o
que o Google mostra*. Este mede *se as IAs estão mandando gente*. Nenhum
substitui o outro, e nenhuma dessas fontes diz qual pergunta a pessoa fez à IA —
isso ninguém entrega hoje.

### 4A — Painel do BOTinho (fonte principal)

O site registra a origem de toda visita que vem de fora, no evento
`referral_visit` (`AnalyticsEvent`). Campos: `referrer_kind` (`ai` / `search` /
`social` / `other`), `referrer_source` (`chatgpt`, `perplexity`, `claude`,
`gemini`, `youtube`, `google`…) e `referrer_host`.

Privacidade: guardamos só o **host**, nunca a URL completa — URL de buscador
carrega o termo pesquisado, que é dado da pessoa. Ver
`dashboard/lib/ai-referral.js` e o teste `test/ai-referral.test.js`.

Vale mais que a Cloudflare porque liga a origem **à página** que a pessoa abriu
e ao que ela fez depois.

### 4B — Cloudflare AI Crawl Control (complemento)

Painel da Cloudflare → domínio → **AI Crawl Control**.

| Onde olhar | Para quê |
|---|---|
| **Metrics → referral trends** | pessoas chegando de resposta de IA |
| **Crawlers** | quais robôs entram e com que frequência |
| **Overview → Managed robots.txt** | ⚠️ conferir que continua **DESLIGADO** |

O terceiro item é o mais importante e leva 5 segundos: quando ligado, a
Cloudflare cola `Disallow: /` para GPTBot, ClaudeBot, Google-Extended e CCBot na
frente do `robots.txt` do site. Já aconteceu (veio ligado por padrão, descoberto
em 04/08/2026 e desligado). Se voltar a ligar, todo o trabalho de IA para de
valer em silêncio.

Conferência rápida, sem entrar no painel:

```bash
curl -s https://espelhagrupos.com.br/robots.txt | grep -c "Disallow: /$"
# 0 = certo. Qualquer número maior = o bloqueio voltou.
```

### O que anotar por mês

| Indicador | Onde |
|---|---|
| Visitas de IA no mês (total e por origem) | 4A |
| Páginas que mais receberam visita de IA | 4A |
| Visitas de IA ÷ visitas de busca | 4A |
| Perplexity e DuckDuckGo saíram de zero? | 4B |
| `Managed robots.txt` continua desligado? | 4B |

**Baseline zera em 04/08/2026.** Antes dessa data os robôs de treinamento
estavam bloqueados e o site não registrava origem nenhuma — número anterior a
isso não existe e não dá para comparar.

⚠️ Com o tráfego atual (41 cliques em 2,5 meses), esses números vão ser
pequenos por vários meses. **Não tirar conclusão de variação pequena** — dois
ou três meses de série valem mais que a leitura de um mês só.

---

## Sobre a marca (decidido em 08/2026: Espelha Grupos como marca, BOTinho como produto)

**Decisão tomada:** como o domínio `espelhagrupos.com.br` fica, *Espelha Grupos*
virou a marca principal (schema `Organization`, título das páginas, assinatura
dos artigos) e *BOTinho* o nome do produto (schema `SoftwareApplication`, corpo
do texto, painel, mensagens). Motivo: entidade única para Google e IA — uma IA
só cita com confiança uma marca que consegue identificar de forma consistente.

O registro abaixo é o que sustentou a decisão.


Registro do que já foi apurado, para não repetir a pesquisa depois:

- `botinho.com.br` → **indisponível**. Registrado desde 18/01/2007 por
  *Indústria de Calçados Botinho Ltda* (CNPJ 07.833.689/0001-84), ativo,
  renovação até 01/2027. Empresa em operação — improvável de vender barato.
- Consequência: existe uma **marca homônima** no Brasil. Não impede o uso
  (setores completamente distintos), mas significa que a busca por "botinho"
  puro devolve calçado. O nome sempre precisará de qualificador
  ("BOTinho WhatsApp", "BOTinho afiliados").
- Os dois exports acima incluem `botinho whatsapp`, `botinho bot` e
  `espelha grupos` de propósito: vão medir se a marca já tem busca própria
  e qual das duas identidades o mercado usa hoje.

**Decisão de domínio fica pendente até os dados chegarem.** Não faz sentido
escolher entre migrar de domínio, comprar variação (`.app`, `.com`, `use...`)
ou manter `espelhagrupos.com.br` antes de saber quanta autoridade e quanto
tráfego de marca já existem. O Relatório 1 responde isso.
