# Plano de melhoria — 2026-09-11

Escrito sobre a medição de 11/09 (Search Console, diagnósticos próprios,
citação por IA em 4 superfícies) e sobre dois achados novos desta rodada.

## O que mudou o entendimento nesta rodada

**1. O Tier 1 não estava por fazer. Estava invisível.** As cinco páginas de
loja existem desde 02/09. A Inspeção de URL deu o veredito: "Detectada, mas
não indexada", "Último rastreamento: N/D", "Página de referência: Nenhuma
página foi detectada". O Google **nunca leu** essas páginas. Causa: um único
link interno, vindo de `/conteudos`, que é a página mais fraca do site
(posição 45, 51 impressões, 1 clique, 67 links na mesma tela).

**2. Não é caso isolado.** Varredura das 90 rotas indexáveis: **8 têm zero
link interno** e **51 estão abaixo de três**. O site produz páginas órfãs por
padrão.

**3. Os links internos das páginas fortes carregam UTM.** 119 links em 16
páginas apontam para `/rota?utm_source=seo&utm_medium=internal&...`. O
endereço que o Google descobre é a variante, não o endereço limpo. A
consolidação depende inteiramente da canônica.

**4. Comercial converte; comparação não.** Mesmo tema, resultados opostos:

| Página | Impressões | Visitas | Cadastros |
|---|---:|---:|---:|
| `/alternativas/achadinhos-bot` | 3.400 | 80 | **0** |
| `/bot-achadinhos-whatsapp` | 1.827 | 130 | **21** |

Cluster comercial converte visita em cadastro a **15,4%**; cluster de
comparação, a **0,0%**. Isso derruba a conclusão de 01/09 e 10/09 de que a
comparação era o motor de crescimento. Ela é motor de **impressão**, não de
receita.

**5. A citação por IA virou.** Na mesma superfície e mesma pergunta, entre
10/09 e 11/09: o Gemini passou de "planos de assinatura no site" para citar
Basic R$39 e Pro R$69 com conteúdo de plano; deixou de inventar uma
metodologia com pilares falsos e passou a citar `espelhagrupos.com.br` na
primeira linha; a Perplexity passou de "não conheço" para "ferramenta
legítima, não há indícios de golpe".

**6. O ChatGPT é o canal de maior qualidade.** 13% das visitas e **35% dos
cadastros** (índice 2,69×). Entrada por conteúdo é 34% dos cadastros e **58%
dos pagantes** (índice 1,71×).

---

## Ordem de ataque

Em ordem de retorno por esforço. Cada item diz o que muda e como se mede.

### 1. Descoberta — FEITO nesta rodada, falta pedir reindexação

**Estado:** as cinco páginas do Tier 1 passaram de 1 para 3+ links internos,
vindos das páginas que de fato têm impressão. Promium saiu de 1 link.
`test/marketing-paginas-orfas.test.js` reprova página nova com menos de três
links, com dívida histórica que só pode diminuir.

**Falta:** pedir reindexação das páginas **editadas** (lista na seção final).
Sem isso o Google demora a ver os links novos.

**Como medir:** Inspeção de URL das cinco em 7 dias. O veredito precisa sair
de "Detectada, mas não indexada". Primeira impressão no relatório Páginas é o
sinal definitivo.

### 2. Quitar a dívida das 51 páginas órfãs

8 páginas com zero link e 43 com um ou dois. Enquanto existirem, o site gasta
esforço editorial em página que o Google pode nunca ler.

**Ação:** por lote de 10, começando pelas que já têm impressão (sinal de que o
Google se interessa e falta reforço). As 8 com zero link primeiro.

**Como medir:** `DIVIDA_HISTORICA` no teste encolhendo a cada PR. Meta: zero
até a próxima análise mensal.

### 3. Tirar o UTM dos links internos

**Por quê:** o endereço descoberto pelo Google é a variante com parâmetro. O
custo é rastreamento gasto em duplicata e dependência total da canônica.

**Ação:** manter o rastreamento por `data-seo-cta`, que já existe em todos
esses links e não suja o endereço. Remover o querystring dos `href` internos
em `_comparisonContent.js`, `_preservationDecisionPages.js` e
`_preservationCommercialPages.js`.

**Cuidado:** confirmar antes que nenhum relatório do painel dependa desses
`utm_content` para atribuir cadastro interno. Se depender, migrar a leitura
para o `data-seo-cta` na mesma PR.

**Como medir:** zero `href` interno com `utm_` no HTML gerado. Guarda no mesmo
arquivo de teste.

### 4. Levar o padrão comercial para onde há impressão

A comparação tem o volume; a comercial tem a conversão. Hoje as duas não se
conversam: `/alternativas/achadinhos-bot` (3.400 impressões, 0 cadastro) não
manda ninguém para `/bot-achadinhos-whatsapp` (21 cadastros).

**Ação:** em cada página `/alternativas/*`, um bloco de saída para a página
comercial equivalente, com a mesma promessa concreta que faz a comercial
converter. Sem prometer o que o concorrente não entrega, e sem preço de
concorrente que não tenha ficha datada em `competitors-data.js`.

**Como medir:** cadastros vindos de `/alternativas/*` saindo de zero. É o
único número que importa aqui.

### 5. Consertar o título das páginas com muita impressão e nenhum clique

Dez páginas somam 879 impressões e zero clique. Pior caso em posição 4,35.
Celular traz 57% das impressões, ranqueia melhor que o computador (7,07 contra
11,32) e converte metade (2,15% contra 4,33%) — o padrão de título cortado na
tela pequena.

**Referência do que funciona:** título com número concreto rende o dobro
("4 lojas e 7 dias grátis" = 2,76% contra "comparativo honesto" = 1,33%).

**Cuidado:** `/alternativas/achadinhos-bot` responde a `achadinho pro` (742
impressões) com um título que anuncia OUTRO produto. E há teto: em `fluxopromo`
estamos em posição 3 com o título certo e zero clique em 133 impressões — quem
digita a marca quer a marca.

**Como medir:** CTR das dez, mesma janela, na próxima análise.

### 6. Unificar a entidade de marca

O ChatGPT trata **Espelha Grupos e BOTinho como produtos concorrentes**
("posso fazer uma comparação BOTinho × Espelha Grupos"). A decisão de marca de
08/2026 existia para dar entidade única; a IA lê duas.

**Ação:** toda página diz, em texto e em schema (`publisher`, `brand`,
`alternateName`), que BOTinho é o robô do Espelha Grupos. Decidir o destino de
`/protecao-antiban-botinho`, `/como-funciona-botinho-canais`,
`/bot-comum-vs-botinho` e `/botinho-vs-*`: o nome aposentado está no endereço.

**Como medir:** repetir a Trilha B do `ROTEIRO_MEDICAO_IA.md` em conta neutra.
Nenhuma superfície pode voltar a tratar os dois nomes como produtos distintos.

### 7. Publicar a metodologia de forma citável

`/metodologia-uso-responsavel-whatsapp` nunca entrou no índice, e é exatamente
a página que faltava quando o Google AI Overviews **inventou** uma metodologia
com pilares nomeados e citou fontes.

**Ação:** entra na fila de descoberta do item 2, com prioridade. Página que não
existe de forma citável vira alucinação.

**Como medir:** consulta de metodologia nas 4 superfícies, sem invenção.

### 8. Colisões de nome

Três das quatro IAs leem "BOTinho" como calçado infantil. E `espelha grupos é
confiável` no Google AI Overviews devolve conteúdo de golpe de espelhamento de
tela, citando G1 e Banco Central.

**Ação:** nunca escrever "BOTinho" sozinho em texto público. Uma página que
responda diretamente à pergunta de confiança, separando espelhamento de grupos
de afiliados do golpe de espelhamento de tela.

**Cuidado:** a honestidade já está virando ativo — o Gemini escreve "modelo sem
promessas irrealistas" e o ChatGPT dá 7,5/10 citando a transparência. Não
trocar isso por promessa.

### 9. LTV e retenção

Bloqueia a decisão de mídia paga. 516 visitas externas → 119 cadastros (23%) →
12 pagantes (10%), 7,2 dias até o primeiro pagamento. Falta saber quanto tempo
o pagante fica.

**Ação:** medir antes de discutir anúncio. Sem LTV não há teto de custo por
aquisição, e sem teto qualquer campanha é aposta.

---

## Estado da execução (2026-09-11, fim do dia)

Sete dos nove itens estão em `develop`, com teste de guarda em cada um. A
suíte inteira passa (3.263 testes, zero falhas), `arch:check` limpo.

| Item | Estado | O que mudou de fato |
|---|---|---|
| 1. Descoberta do Tier 1 | **feito** | as cinco saíram de 1 para 3+ links de entrada |
| 2. Dívida de páginas órfãs | **feito** | de 9 rotas com zero e 26 com 1-2, para **zero abaixo de três** |
| 3. UTM nos links internos | **feito** | de 119 links para **zero**; `/login` e `/cadastro` mantêm |
| 4. Comparação → comercial | **feito** | as 8 páginas apontam para a comercial, em bloco próprio |
| 5. Título com muita impressão e zero clique | **feito** | 3 títulos passaram a entregar o número |
| 6. Entidade de marca | **feito** | frase citável em `/quem-somos` e na metodologia |
| 7. Metodologia citável | **feito** | passou a ter 3 links; era o item 2 na prática |
| 8. Colisões de nome | **feito** | `/espelha-grupos-e-confiavel` responde a pergunta |
| 9. LTV e retenção | **pendente** | depende de medição no VPS — não dá para fazer daqui |

### O que a execução DERRUBOU

**A primeira guarda de páginas órfãs media errado.** Ela lia os arquivos-fonte,
e link montado em laço não existe no texto do arquivo: páginas com ONZE links de
entrada apareciam como órfãs com zero. A contagem passou a ser no HTML
construído, que é o que o Google lê. Sem essa correção, o trabalho do item 2
teria sido feito no lugar errado.

**A causa da orfandade era estrutural, não falta de link escrito.** Tanto as
páginas de dor quanto as comparações escolhiam relacionadas cortando nos três
primeiros do grupo: todas linkavam as mesmas três e o resto ficava com um link
em todo o site. A janela agora gira pela posição da própria rota — cada página
continua mostrando três links, e o grupo inteiro virou alcançável.

### Achados que não estavam no plano

- **`/cadastro` estava no sitemap como indexável e é só um redirecionamento**
  para `/login?mode=register`, que existe para preservar o `?aff=` das
  indicações. Pedir indexação de um redirect não faz sentido. Saiu do índice; os
  links de afiliada seguem funcionando igual.
- **O `utm_content` dos links internos era redundante**: o evento de clique já
  grava cta, posição, estágio, destino e href. Tirar o UTM não custou medição.

### Decisão que ficou para a dona do produto

**As cinco rotas com o nome aposentado no endereço** —
`/protecao-antiban-botinho`, `/como-funciona-botinho-canais`,
`/bot-comum-vs-botinho`, `/botinho-vs-planilha-manual` e
`/botinho-vs-ferramentas-genericas-automacao`. Somam 27 impressões e 1 clique,
então renomear custa quase nada de histórico — mas mexer em endereço público é
mudança de fora para fora e exige redirecionamento. Não fiz por conta própria.

## Páginas para pedir reindexação AGORA

Editadas ou criadas neste ciclo. O Google precisa relê-las para ver os links
novos e os títulos novos. **Só depois do deploy em produção** — antes disso o
link ainda não existe lá.

Página nova (peça primeiro):

```
https://espelhagrupos.com.br/espelha-grupos-e-confiavel
```

Títulos que mudaram (o clique depende de o Google reler):

```
https://espelhagrupos.com.br/programa-de-afiliados
https://espelhagrupos.com.br/blog/como-divulgar-ofertas-mercado-livre-whatsapp
https://espelhagrupos.com.br/alternativas/proafiliados
```

Entidade de marca, agora dita em texto:

```
https://espelhagrupos.com.br/quem-somos
https://espelhagrupos.com.br/metodologia-uso-responsavel-whatsapp
```

Ganharam links para o Tier 1 e para os posts que estavam órfãos:

```
https://espelhagrupos.com.br/bot-afiliados-whatsapp
https://espelhagrupos.com.br/bot-achadinhos-whatsapp
https://espelhagrupos.com.br/blog/como-ser-afiliado-shopee-whatsapp
https://espelhagrupos.com.br/blog/como-divulgar-ofertas-amazon-whatsapp
https://espelhagrupos.com.br/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp
https://espelhagrupos.com.br/clonar-mensagens-de-grupo-de-afiliados
https://espelhagrupos.com.br/parcerias
```

Continua valendo a fila de `PAGINAS_PEDIR_INDEXACAO_2026-09-11.md`, com
`/magalu-afiliados-whatsapp` na frente.

⚠️ A cota diária corta sem avisar. Comece sempre pela mais valiosa que ainda
estiver pendente.

## O que NÃO fazer

- Não criar página nova enquanto houver 51 órfãs. Página que o Google não lê
  não rende nada, e o custo editorial é o mesmo.
- Não reabrir cidade, nicho ou o cluster "robô" (linhas congeladas por dado em
  2026-07-30).
- Não citar preço de concorrente sem ficha datada em `competitors-data.js`.
  Preço dito por IA não é fonte.
- Não prometer ausência de banimento, mesmo entrando pela palavra "banido".
