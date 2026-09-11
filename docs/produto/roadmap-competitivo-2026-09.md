# Plano de pesquisa de mercado para priorizar o roadmap

**Atualizado em:** 10/09/2026

**Horizonte da pesquisa:** 30 dias

**Decisão ao final:** escolher, com dados, a primeira melhoria depois de SHEIN,
AliExpress e Instagram Stories.

## Mudança de abordagem

A versão anterior tentava ordenar funcionalidades sem dados suficientes de
demanda. Isso produzia hipóteses com aparência de roadmap. Esta versão corrige
o problema: **não recomenda a quarta implementação ainda**.

As únicas decisões mantidas são as já informadas pela direção:

1. concluir e validar SHEIN e AliExpress;
2. terminar Instagram Stories;
3. manter as demais ideias em descoberta até a coleta abaixo terminar.

Ao fim de 30 dias teremos quatro tipos de evidência:

- **demanda declarada:** buscas, tendências, anúncios e pesquisas;
- **demanda observada:** tarefas reais, abandonos, pedidos ao suporte e links
  que hoje não são atendidos;
- **disposição a pagar:** clique em proposta, pedido de acesso e pré-venda;
- **oferta concorrente:** recursos, preços, limites e reclamações comprovados.

Busca alta não basta para virar feature. Ela pode representar curiosidade, uma
intenção que o produto não atende ou uma dor pela qual ninguém paga.

## Perguntas que a pesquisa precisa responder

1. Quais tarefas consomem mais tempo da afiliada depois que o link já foi
   convertido?
2. Quais falhas causam perda de comissão ou fazem a cliente cancelar?
3. Quais funcionalidades levam alguém a escolher ou trocar de ferramenta?
4. Quais canais e lojas têm demanda real: Telegram, Stories, Temu, Kabum,
   Natura ou outros?
5. O mercado procura por “criar story”, “buscar oferta”, “agendar”, “medir
   comissão”, “evitar bloqueio” ou por outro resultado?
6. Por qual dessas melhorias uma cliente pagaria mais ou assinaria agora?

## Entregáveis no dia 30

| Entregável | Conteúdo mínimo |
| --- | --- |
| `mercado-keywords.csv` | termo, volume, tendência, CPC, concorrência, intenção e cluster de dor |
| `concorrentes-verificados.csv` | URL, preço recorrente, limites, canais, lojas, recursos e evidência datada |
| `entrevistas-jobs.csv` | segmento, tarefa, frequência, impacto, solução atual e frase literal anonimizada |
| `sinais-produto.csv` | pedidos, erros, links recusados, uso, cancelamentos e segmento afetado |
| `smoke-tests.csv` | proposta, visitas, cliques, leads qualificados, pré-vendas e custo |
| `priorizacao-roadmap.csv` | score por oportunidade, fontes, confiança, esforço e decisão |
| memo de decisão | uma aposta escolhida, uma reserva e as demais rejeitadas/postergadas |

## Frente 1 — Google Ads Keyword Planner

### Objetivo

Medir demanda de busca e valor comercial das **dores**, não apenas das marcas
concorrentes. CPC e concorrência são sinais imperfeitos, mas ajudam a separar
pesquisa informacional de problema com valor econômico.

### Configuração única

1. Abrir o Planejador de palavras-chave no Google Ads.
2. Usar **Brasil**, **Português**, **Google**, sem parceiros de pesquisa.
3. Coletar **últimos 12 meses** e também o detalhamento mensal.
4. Rodar “Descobrir novas palavras-chave” sem informar o domínio do BOTinho,
   para não filtrar ideias que ainda não existem no site.
5. Rodar “Ver volume de pesquisa e previsões” com a lista fechada abaixo.
6. Exportar CSV sem editar os valores originais.
7. Se a conta mostrar apenas faixas, manter as faixas; não transformar
   `1 mil–10 mil` em um número inventado. Só usar números exatos se a própria
   conta os fornecer.

### Lotes para descobrir termos novos

Rodar separadamente para o Google conseguir expandir cada intenção:

**A. Criação para Instagram**

```text
criar story de oferta
template story afiliado
story de promoção
gerador de story shopee
postar oferta no instagram
automatizar stories instagram
```

**B. Distribuição e agenda**

```text
agendar ofertas whatsapp
postar em vários grupos whatsapp
fila de ofertas
automatizar grupo de ofertas
enviar promoção automaticamente
bot telegram afiliados
```

**C. Resultado e comissão**

```text
relatório comissão afiliado
saber qual link vendeu
rastrear link de afiliado
link de afiliado sem comissão
analytics para afiliados
gerenciador de links afiliados
```

**D. Descoberta de produtos**

```text
buscar ofertas automaticamente
robô de ofertas shopee
ofertas prontas para afiliados
garimpo de ofertas
encontrar produtos para divulgar
ia para afiliados
```

**E. Operação e segurança**

```text
whatsapp desconectando bot
evitar bloqueio whatsapp
gerenciar vários grupos whatsapp
múltiplos números whatsapp
automação whatsapp segura
limite de mensagens whatsapp
```

**F. Lojas ainda não priorizadas**

```text
afiliado temu whatsapp
bot temu afiliados
afiliado kabum whatsapp
afiliado natura whatsapp
afiliado shein whatsapp
afiliado aliexpress whatsapp
```

### Colunas derivadas

Preservar as colunas originais e adicionar:

- `cluster_dor`: criar, distribuir, descobrir, medir, proteger ou operar;
- `intencao`: aprender, comparar ou contratar;
- `feature_candidata`;
- `volume_12m` ou `faixa_volume`;
- `crescimento_3m_vs_3m_anterior`;
- `cpc_topo_pagina_baixo` e `cpc_topo_pagina_alto`;
- `concorrencia_ads`;
- `marca`: sim/não;
- `observacao_ambiguidade`.

### Regra de leitura

- Priorizar clusters, não uma palavra isolada.
- Separar busca por marketplace de busca por ferramenta. “Afiliado SHEIN” não
  prova que a pessoa quer automação.
- CPC alto reforça intenção comercial; CPC baixo não elimina uma dor de nicho.
- Termos de marca medem consciência/alternativas, não necessariamente demanda
  por uma funcionalidade.

## Frente 2 — Google Trends

### Objetivo

Descobrir direção e sazonalidade. O Trends é um índice relativo de 0 a 100;
**não deve ser somado nem tratado como volume absoluto**.

### Comparações a executar

Configuração: **Brasil · últimos 5 anos · Pesquisa na Web**. Repetir em
**últimos 12 meses**. Exportar o CSV de interesse ao longo do tempo e consultas
relacionadas.

| Rodada | Termos |
| --- | --- |
| Linguagem da categoria | `bot afiliados`, `automação para afiliados`, `robô de ofertas`, `bot de ofertas`, `grupo de achadinhos` |
| Canal | `ofertas whatsapp`, `ofertas telegram`, `ofertas instagram`, `story de oferta`, `canal de ofertas` |
| Tarefa | `agendar ofertas`, `criar story`, `rastrear link afiliado`, `buscar ofertas`, `gerenciar grupos whatsapp` |
| Risco | `whatsapp banido`, `whatsapp desconectando`, `link afiliado não funciona`, `perder comissão afiliado`, `evitar bloqueio whatsapp` |
| Lojas | `afiliado shopee`, `afiliado amazon`, `afiliado mercado livre`, `afiliado shein`, `afiliado aliexpress` |
| Próximas lojas | `afiliado temu`, `afiliado kabum`, `afiliado natura`, `afiliado magalu`, `afiliado aliexpress` |

### Controles para não comparar errado

1. Manter um **termo-âncora** repetido entre rodadas quando for necessário
   comparar grupos diferentes.
2. Preferir “Tópico” quando o Trends oferecer um tópico inequívoco; registrar
   se foi tópico ou termo de pesquisa.
3. Verificar consultas relacionadas para detectar sentidos alheios ao produto.
4. Anotar picos de Black Friday, 9.9, 11.11 e datas de marketplace; não chamar
   sazonalidade de crescimento estrutural.
5. Repetir por região apenas depois da leitura Brasil, sem escolher região
   porque ela “parece boa”.

### Saída

Para cada cluster, registrar tendência de cinco anos, variação dos últimos 12
meses, sazonalidade, estados líderes e consultas em ascensão. O resultado é um
**sinal de timing**, combinado ao volume do Keyword Planner.

## Frente 3 — Search Console e dados próprios do site

### Objetivo

Encontrar demanda em que o BOTinho já aparece e medir qual intenção realmente
gera cadastro, não só impressão.

### Coleta

1. Search Console → Desempenho → Resultados da pesquisa.
2. Exportar consultas e páginas para 16 meses, 3 meses e 28 dias.
3. Manter cliques, impressões, CTR e posição.
4. Filtrar consultas pelos clusters da Frente 1 e por todos os concorrentes.
5. Juntar por página com eventos de visita, início de cadastro, cadastro,
   ativação, pagamento e cancelamento disponíveis no funil interno.

### Cortes obrigatórios

- marca BOTinho/Espelha Grupos versus não marca;
- dor versus marketplace versus concorrente;
- desktop versus celular;
- novo versus recorrente, quando disponível;
- página de conteúdo versus comercial versus alternativa;
- consulta na posição 1–3, 4–10, 11–20 e acima de 20.

### Decisões que esse dado permite

- impressão alta + CTR baixo: problema de posicionamento/snippet;
- visita alta + cadastro baixo: intenção ou proposta inadequada;
- cadastro alto + ativação baixa: promessa não chega ao primeiro valor;
- ativação alta + pagamento baixo: valor/preço/onboarding;
- pagamento alto em um cluster: sinal forte para produto e aquisição.

Não usar volume de busca como proxy de receita quando o funil já mostra que um
cluster recebe visitas e não converte.

## Frente 4 — pesquisa competitiva verificável

### Universo obrigatório

**Nomes já estruturados em `competitors-data.js`:** Achadinho Pro,
AchadinhosBot, ProAfiliados, Shozap, Promium, FluxoPromo, Lumi Ofertas
Inteligentes, Gigi Bot, Divulgador Inteligente, Divulga Ninja, Gigi Prime Bot,
Busqy e DivulgaLinks.

**Nomes adicionados pela direção:** Pai das Ofertas, Growify, Sincro,
Zap Multigrupos, Notifish, Afiliados Pro Bot, Easyfy, Ofertiva (pista inicial
de R$ 39,90/mês), Afiliados Turbo, Afflink, Afiliei, Promogram,
Gestor de Links e Afilira.

### Primeiro: identificar quem realmente concorre

Para cada nome, pesquisar no Google:

```text
"NOME EXATO"
"NOME EXATO" preço
"NOME EXATO" afiliados
"NOME EXATO" whatsapp
"NOME EXATO" instagram
"NOME EXATO" reclamação OR cancelar OR problema
site:youtube.com "NOME EXATO"
site:instagram.com "NOME EXATO"
```

Registrar o domínio oficial e a empresa antes de atribuir qualquer recurso.
Growify, Sincro e Gestor de Links, por exemplo, podem ter homônimos. Se não for
possível provar a identidade, marcar `não identificado`, nunca completar por
semelhança de nome.

### Depois: preencher a ficha com prova

| Campo | Evidência aceita |
| --- | --- |
| Preço | página de planos/checkout datada; separar promoção inicial de recorrência |
| Recurso | documentação, tela do produto ou execução em trial |
| Limite | termos, plano, checkout ou teste reproduzível |
| Posicionamento | homepage/anúncio oficial, guardando a frase e URL |
| Reclamação | padrão repetido em avaliações/comentários; uma fala isolada não vira conclusão |
| Estabilidade | teste próprio datado; nunca inferir da promessa comercial |

Para os oito concorrentes com maior sobreposição, fazer trial ou demo e
executar as mesmas tarefas: cadastrar loja, converter link curto, criar oferta,
agendar, enviar a dois destinos, localizar erro e exportar/ver resultado.

### Biblioteca de anúncios

1. Pesquisar cada marca na **Meta Ad Library**, país Brasil, anúncios ativos e
   inativos quando disponível.
2. Pesquisar no **Google Ads Transparency Center**.
3. Salvar data, promessa, dor, CTA, formato e há quanto tempo a peça aparece.
4. Marcar uma mensagem como sinal forte somente se reaparecer por pelo menos
   quatro semanas ou em múltiplas peças. Longevidade sugere investimento, mas
   não prova rentabilidade.
5. Não copiar criativo; usar os padrões para formular perguntas e smoke tests.

## Frente 5 — voz do mercado

### Entrevistas comportamentais

Em 14 dias, entrevistar:

- 8 clientes pagantes ativas;
- 5 ex-pagantes;
- 5 trials que não ativaram;
- 4 afiliadas que pagam concorrente;
- 4 afiliadas que fazem tudo manualmente.

Cada conversa dura 30–40 minutos e inclui compartilhamento de tela da última
oferta publicada. Não apresentar o roadmap antes de entender a rotina.

Perguntas:

1. “Mostre a última oferta desde onde encontrou até onde publicou.”
2. “Onde precisou copiar, editar, esperar ou conferir?”
3. “Conte a última vez em que uma oferta saiu errada ou sem comissão.”
4. “Como decide o que publicar de novo amanhã?”
5. “Como sabe qual canal ou oferta vendeu?”
6. “Qual ferramenta tentou e por que manteve ou abandonou?”
7. “O que faria você trocar de ferramenta este mês?”
8. “Qual parte você pagaria para nunca mais fazer manualmente?”

Codificar cada relato por tarefa, frequência, minutos gastos, impacto em
receita, workaround, ferramenta atual e disposição a trocar. Uma sugestão de
feature sem episódio real recebe baixa confiança.

### Pesquisa quantitativa

Enviar depois das entrevistas, usando a linguagem que as afiliadas realmente
usaram. Amostra mínima desejada: 80 respostas, separando pagantes, trials,
churns e não clientes.

Pedir que cada pessoa escolha e ordene **as três maiores dores**, entre:

- criar imagem/Story;
- encontrar boas ofertas;
- converter sem perder comissão;
- publicar em vários canais;
- programar horários e volume;
- saber qual oferta vendeu;
- manter WhatsApp conectado/seguro;
- operar mais números/equipe;
- divulgar novas lojas;
- outra, em texto livre.

Adicionar duas perguntas econômicas: “qual problema você já paga para
resolver?” e “qual melhoria justificaria pagar mais?”. Não perguntar apenas
“você usaria?”, pois respostas hipotéticas tendem a superestimar demanda.

## Frente 6 — sinais do próprio produto e suporte

### Consultas e contagens

Extrair, de forma agregada e respeitando LGPD:

- links recebidos por marketplace e links recusados por domínio/formato;
- falhas de conversão e envio por categoria;
- uso de filas, agendamento, canais, limites e automações;
- tempo entre cadastro, primeira credencial, primeiro envio e pagamento;
- tickets/contatos categorizados por dor;
- motivo de cancelamento e recurso citado;
- clientes com mais de uma operação, número ou usuário compartilhando acesso;
- volume de criação manual versus espelhamento/automação.

Antes de instrumentar algo novo, usar o que já existe. Toda consulta pesada em
produção deve ser somente leitura, agregada, executada fora do pico e revisada
para não expor cliente.

### Quadro semanal de evidência

| Sinal | Exemplo de força alta |
| --- | --- |
| Frequência | ≥20% do segmento enfrenta semanalmente |
| Impacto | perda de comissão, cancelamento ou ≥2 h/semana |
| Comportamento | já usa planilha, Canva, outro bot ou trabalho manual |
| Receita | aparece em deals perdidos, upgrade ou churn |
| Produto | erro/uso observável confirma o relato |

## Frente 7 — smoke tests de disposição a pagar

Selecionar as três dores líderes após as duas primeiras semanas. Para cada uma,
criar uma página simples com a mesma estrutura e tráfego comparável:

- problema e resultado, sem afirmar que o recurso já existe;
- mockup claramente identificado como prévia;
- CTA “Quero participar do piloto”;
- pergunta sobre solução atual e urgência;
- opção de pré-reserva apenas se houver política clara de reembolso e prazo.

Rodar anúncios de busca de correspondência exata/frase para os clusters
comerciais e, separadamente, convidar segmentos equivalentes da base. Não
misturar tráfego de marca com não marca.

### Orçamento inicial

- R$ 300–500 por hipótese **ou** até 100 visitas qualificadas;
- mesma janela, geografia, dispositivo e regra de conversão;
- palavras negativas para intenção de emprego, curso, download e consumidor de
  cupom quando não forem o ICP;
- encerrar cedo apenas por problema ético/técnico, não porque os primeiros dez
  cliques foram ruins.

### Métricas

1. CTR do anúncio: a promessa chama atenção?
2. visita → pedido de piloto: a dor mobiliza ação?
3. lead → entrevista agendada: é público real?
4. entrevista → compromisso concreto/pré-venda: existe disposição a pagar?
5. custo por lead qualificado, não apenas custo por clique.

O vencedor não é necessariamente o maior CTR. Feature curiosa recebe clique;
dor econômica recebe compromisso.

## Como transformar os dados em prioridade

### Score baseado em evidências

Cada oportunidade recebe nota de 0 a 5:

| Dimensão | Peso | Fonte |
| --- | ---: | --- |
| Frequência da dor | 20% | entrevistas, survey, suporte e produto |
| Impacto financeiro/tempo/risco | 20% | episódios observados e churn/deals |
| Disposição a pagar | 20% | smoke test, pré-venda, upgrade ou gasto atual |
| Tamanho e direção da demanda | 15% | Keyword Planner + Trends |
| Lacuna competitiva | 10% | trials, páginas e reviews verificados |
| Aderência à estratégia do BOTinho | 10% | conversão segura e distribuição |
| Confiança da evidência | 5% | quantidade, qualidade e triangulação |

Calcular `score_mercado` pela soma ponderada. Depois dividir por esforço
estimado em faixas (`P=1`, `M=2`, `G=3`, `GG=5`) para ordenar a discussão — sem
permitir que uma estimativa técnica falsa dê precisão artificial.

### Gates mínimos

Uma melhoria só pode ser selecionada quando tiver:

- evidência em pelo menos **três fontes**, sendo uma comportamental;
- pelo menos cinco relatos do mesmo job em dois segmentos ou sinal quantitativo
  equivalente;
- smoke test com lead qualificado ou prova de gasto/workaround atual;
- definição do segmento beneficiado e do problema que deixará de existir;
- métrica de sucesso e critério de abandono;
- viabilidade técnica e de política para integrações externas.

Google Trends + Keyword Planner contam como uma família de evidência, não duas
provas independentes da mesma demanda.

## Cronograma de 30 dias

| Semana | Ações | Saída |
| --- | --- | --- |
| 1 | Ads Keyword Planner, Trends, Search Console, taxonomia de suporte e identificação dos 27 nomes | mapa inicial de demanda e concorrentes válidos |
| 2 | 12 entrevistas, 4 demos/trials concorrentes, biblioteca de anúncios e leitura dos sinais do produto | top 6 dores com evidência |
| 3 | demais entrevistas, survey e 3 smoke tests | top 3 com demanda e intenção comparáveis |
| 4 | concluir testes, estimar esforço, scorear, fazer reunião de decisão | aposta principal, reserva e backlog rejeitado |

### Reunião de decisão

Para cada candidata, apresentar em uma página:

- job e segmento;
- tamanho/tendência de busca;
- cinco evidências comportamentais;
- sinal de produto/suporte;
- como as alternativas resolvem hoje;
- resultado do smoke test;
- esforço, risco externo e métrica de sucesso;
- argumento para **não** construir.

A direção escolhe uma aposta e uma reserva. Todo o resto recebe motivo e data de
revisão; não fica como “prioridade média” eterna.

## Responsáveis sugeridos

| Trabalho | Responsável | Revisão |
| --- | --- | --- |
| Keyword Planner, Trends, Search Console e anúncios | Marketing | Produto |
| Entrevistas e survey | Produto + CS | Direção |
| Dados de produto, funil e erros | Dados/Engenharia | Produto + privacidade |
| Trials e fichas de concorrentes | Produto | Marketing |
| Smoke tests | Growth | Produto + direção |
| Esforço e riscos de integração | Engenharia | Produto |
| Score e memo final | Produto | todos os responsáveis |

## Regras para não voltar ao “achômetro”

- Não escrever “maior concorrente” sem dado de tráfego, clientes, receita ou
  consideração de compra. Usar “maior sobreposição funcional” quando for isso.
- Não atribuir recurso a concorrente sem URL/tela e data.
- Não transformar volume de busca em receita projetada sem conversão e LTV.
- Não escolher feature por votação simples; intensidade e disposição a pagar
  importam mais que quantidade de “sim”.
- Não tratar ausência de busca como ausência de dor: tarefas novas podem ser
  descobertas em comportamento e workaround.
- Não misturar consumidor procurando cupom com afiliada procurando ferramenta.
- Não usar um único cliente grande como mercado inteiro.
- Não apresentar mockup de smoke test como funcionalidade disponível.
- Registrar também evidências que contradizem a aposta preferida.

## Materiais internos relacionados

- `docs/marketing/COLETA_DADOS_KEYWORDS_PASSO_A_PASSO.md`: procedimento já
  existente para Search Console, Keyword Planner e Trends.
- `docs/marketing/ANALISE_SEO_2026-09-11.md`: leitura mais recente do funil e da
  demanda orgânica já coletada.
- `dashboard/lib/competitors-data.js`: fonte central atual de perfis
  competitivos, que deve receber apenas dados verificáveis e datados.

Até os CSVs e o memo final existirem, qualquer ordem depois de Instagram
Stories é **hipótese de pesquisa**, não roadmap aprovado.
