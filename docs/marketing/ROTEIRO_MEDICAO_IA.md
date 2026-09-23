# Roteiro de medição de citação por IA (canônico)

Fonte de verdade do conjunto de consultas e do método. Toda rodada segue este
arquivo; os resultados vão para `ai_visibility_tracking.csv`.

Criado em 2026-09-10 para corrigir uma falha de método das rodadas anteriores.

---

## A falha que este roteiro corrige

As rodadas de 01/09 e 10/09 usaram 8 consultas, das quais **duas eram sobre
"BOTinho"** — um nome aposentado da superfície pública em 02/09 (`8823b68`, em
`main`). Só **uma** consulta usava o nome atual, e ela nem foi rodada em todas
as superfícies.

Contagem real de 10/09: **12 das 43 medições (28%) foram gastas no nome que não
usamos**, contra 3 no nome que usamos.

Isso produziu um placar pessimista e desalinhado. Medir "BOTinho preço" e
concluir que a marca não é reconhecida é medir a pergunta errada: ninguém
procura por esse nome (uma impressão em três meses de Search Console), e o
resultado — calçado, projeto social, peixe de aquário — diz mais sobre o
homônimo do que sobre nós.

**O nome antigo continua sendo medido, mas com outro propósito e outro peso.**
Ver a Trilha C.

---

## As três trilhas

### Trilha A — Categoria (5 consultas, série contínua)

Mede se aparecemos quando alguém procura a solução sem saber que existimos. É a
trilha com histórico desde 01/09 — **não alterar o texto destas cinco**, senão a
série quebra.

1. bot para afiliados no WhatsApp
2. ferramenta para divulgar ofertas em grupos de WhatsApp
3. como espelhar mensagens entre grupos de WhatsApp
4. como postar em vários grupos de WhatsApp ao mesmo tempo sem spam
5. como padronizar divulgação de cupons no WhatsApp

### Trilha B — Marca atual (4 consultas, nova)

Mede se a entidade "Espelha Grupos" existe e está descrita certo. **É esta a
trilha que responde "a marca funciona?"** — não a Trilha C.

6. espelha grupos whatsapp o que é *(já existia; passa a ser rodada nas 4 superfícies)*
7. **espelha grupos preço** *(substitui "BOTinho preço")*
8. **espelha grupos é confiável** *(nova — mede objeção, não só reconhecimento)*
9. **espelha grupos metodologia WhatsApp** *(substitui "BOTinho metodologia WhatsApp")*

⚠️ A #9 tem um comparativo valioso: em 10/09 o Google AI Overviews citou a nossa
página real de metodologia como fonte, perguntado pelo nome ANTIGO. Se ele
continuar citando com o nome novo, a página está ligada à entidade certa. Se
parar, a citação estava presa ao nome velho.

### Trilha C — Contaminação do nome antigo (1 consulta)

Não mede a marca. Mede **se as citações antigas estão sendo capturadas por
concorrentes** — é o critério de aceite da Issue 1.

10. BOTinho preço

Em 10/09 esta consulta devolveu, entre as quatro superfícies: calçado infantil,
Projeto Botinho do Corpo de Bombeiros, peixe de aquário (Hassar gabiru),
**BotConversa** e **Afiliados Pro Bot**. Os dois últimos são o problema — os
outros três são homônimos inofensivos.

**Registrar como `cluster: 'contaminacao'`**, nunca como `marca`. Um "não
citado" aqui não conta no placar da marca; o que conta é se um CONCORRENTE
aparece no lugar.

---

## Regras de método (as três que 10/09 ensinou)

**1. Conta neutra, sempre.** A rodada logada da dona do produto marcou 6
citações em 8; a mesma rodada em conta neutra marcou 3 em 7. O ChatGPT citava
"a operação que você já descreveu" e "seu grupo de 300 pessoas". Se uma rodada
logada for feita, registrar em linha separada com o sufixo no campo `platform`,
e **nunca usá-la no placar**.

**2. ChatGPT com busca ativada.** Sem busca, ele responde de treinamento e
devolve zero produtos nomeados — em 8 de 8 consultas. Marcar a plataforma como
`ChatGPT (sem busca)` quando for o caso, e não comparar com `ChatGPT Search`.

**3. Pergunta indutora é registrada como tal.** "O que faria você indicar o
Botinho" convida à invenção. No ChatGPT neutro gerou resposta no condicional
(honesta); no Gemini e na Perplexity gerou fato inventado — Telegram,
AliExpress, Nuvemshop, carrinho abandonado, nenhum deles nosso. A resposta
induzida **não vale como citação**; o que vale é o contraste entre superfícies.

---

## Superfícies (4)

ChatGPT Search · Google Gemini · Perplexity · Google AI Overviews

10 consultas × 4 superfícies = **40 linhas por rodada**.

---

## Placar

Só as Trilhas A e B entram: **9 consultas × 4 superfícies = 36 linhas**.

| Trilha | Pergunta que responde |
|---|---|
| A (5) | aparecemos para quem não nos conhece? |
| B (4) | a nossa marca existe e está descrita certo? |
| C (1) | concorrente está herdando nossas citações antigas? |

---

## Comparabilidade com as rodadas anteriores

- **Trilha A compara direto** com 01/09 e 10/09. É a série longa.
- **Trilha B começa em 01/10.** As consultas 7 e 9 substituem as de BOTinho;
  a comparação honesta é "o nome antigo falhava em X, o novo faz Y", nunca
  colocar os dois números na mesma linha da tabela.
- **Trilha C herda a série** de "BOTinho preço" (01/09 e 10/09), agora lida
  como contaminação em vez de marca.

⚠️ Ao reescrever o placar histórico com esta divisão, os números de 01/09 e
10/09 **mudam** — o de 10/09 sobe, porque 2 das 8 consultas saem do denominador
da marca. Registrar as duas leituras lado a lado no próximo relatório, não
substituir a antiga em silêncio.

---

## Gemini por script (desde 23/09)

A superfície Gemini pode ser medida sem navegador, pela API com a busca do
Google ligada:

```bash
cd ~/wabot && GEMINI_API_KEY=<chave> node scripts/medir-citacao-ia.mjs --saida=/tmp/gemini.csv --json=/tmp/gemini.json
cat /tmp/gemini.csv
```

- Chave grátis em https://aistudio.google.com/apikey. Nunca colar a chave no
  repositório, em PR ou em conversa.
- A linha sai com `platform` = `Gemini API (busca Google)` e `next_action` =
  `revisar`. **Não misturar com as linhas `Google Gemini`** das rodadas manuais:
  API e aplicativo podem responder diferente. Na primeira rodada, medir dos dois
  jeitos para calibrar.
- Regra de "citou": fonte `espelhagrupos.com.br` = sim; nas consultas de marca,
  o nome repetido sem fonte nossa = parcial (a pergunta já trazia o nome).
  Código em `src/ops/aiCitation.js`, teste em `test/ai-citation.test.js` (que
  também falha se as consultas do script divergirem das 10 deste roteiro).
