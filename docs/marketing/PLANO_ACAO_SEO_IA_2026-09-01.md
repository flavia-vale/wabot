# Plano de ação — SEO e citação por IA (01/09/2026)

Fecha a rodada de 01/09 com os dados que faltavam: SERP real das consultas de
marca, consultas por página (canibalização), lista de páginas indexadas e a
página de preços do Promium. Base: `ANALISE_SEO_2026-09-01.md` e
`ai_visibility_tracking.csv`.

---

## 1. O achado que muda tudo: o título nomeia o concorrente ERRADO

`achadinho pro` é a maior consulta do site — **742 impressões**. Quem responde
por ela:

| Página | Impressões em `achadinho pro` |
|---|---:|
| `/alternativas/achadinhos-bot` | **631** |
| `/alternativas/achadinho-pro` | ~111 |

A página que o Google escolhe para `achadinho pro` é a do **AchadinhosBot** —
outro produto, outra empresa. E o título dela é literalmente
**"Alternativa ao AchadinhosBot: comparativo honesto"**.

Na SERP real, a pessoa que digitou `achadinho pro` vê:

```
Achadinhos Pro: Bot WhatsApp para Afiliados Shopee e ...   ← achadinhopro.com.br
Achadinhos Pro: Bot WhatsApp para Afiliados Shopee e ...   ← achadinho.pro
Achadinho PRO – Instale esta extensão para o Firefox
[vídeos]
Compra de Achadinhos Virais Pro não entregue e ...          ← Reclame Aqui
Alternativa ao AchadinhosBot: comparativo honesto           ← NÓS
```

**Não é título vago. É título com o nome errado.** O Google até reescreveu a
descrição com o texto certo ("O Achadinho Pro começa em R$ 49,97 por mês…"),
mas o título — que é o que a pessoa lê ao escanear — anuncia outra marca.

CTR de 1,1% em posição 6,28 deixa de ser mistério.

### O conserto

1. **Fazer `/alternativas/achadinho-pro` ganhar a consulta da irmã.** Hoje ela
   perde 631 a 111 para uma página sobre outro produto. Reforçar a
   correspondência de entidade (título, H1, primeiro parágrafo, `<title>` com a
   grafia exata que a pessoa digita) e reduzir a menção a "Achadinho Pro" dentro
   de `/alternativas/achadinhos-bot`, que é o que faz o Google confundir as duas.
2. **Títulos que ecoam a marca buscada**, como os concorrentes fazem. Nunca se
   passando por eles — mas a palavra que a pessoa digitou tem que aparecer no
   começo.

⚠️ Limite que não se cruza: dizer "alternativa a X" é honesto; parecer ser X não
é. A regra do `AGENTS.md` continua valendo.

---

## 2. Canibalização: existe, e é assimétrica

As duas páginas de achadinhos disputam 4 consultas. O Google alterna qual mostra:

| Consulta | `/bot-achadinhos-whatsapp` | `/alternativas/achadinhos-bot` |
|---|---:|---:|
| `achadinhoosbot` | **339** (pos 7,08) | 34 (pos 7,38) |
| `achadinhos bot` | **208** (pos 6,88) | 18 (pos 8,22) |
| `achadinhosbot` | 81 (pos 8,21) | **264** (pos 6,52) |
| `achadinho pro` | 2 | **631** |

**95% das impressões de `/bot-achadinhos-whatsapp` estão em consultas que ela
divide** com a irmã; do lado da `/alternativas/`, só 30%.

Não é empate destrutivo — o Google quase sempre escolhe uma. Mas em
`achadinhosbot` as duas aparecem com força, e é aí que se perde clique.

**Quem deve ficar com o quê:**

| Consulta | Página que deve vencer | Por quê |
|---|---|---|
| `achadinhoosbot`, `achadinhos bot`, `achadinhosbot` | `/alternativas/achadinhos-bot` | é a comparação com esse produto |
| `achadinho pro`, `achadinhopro` | `/alternativas/achadinho-pro` | idem, para o outro produto |
| `bot para achadinhos`, genéricas | `/bot-achadinhos-whatsapp` | é a página comercial, não comparativa |

---

## 3. O que a página que converte faz de diferente

| Página | Título | CTR |
|---|---|---:|
| `/bot-achadinhos-whatsapp` | "Bot para achadinhos no WhatsApp: **4 lojas e 7 dias grátis**" | **2,76%** |
| `/alternativas/achadinho-pro` | "Alternativa ao Achadinho Pro: **preço e marketplaces**" | 2,59% |
| `/alternativas/achadinhos-bot` | "Alternativa ao AchadinhosBot: **comparativo honesto**" | 1,33% |
| `/alternativas/fluxopromo` | "Alternativa ao FluxoPromo: preço e o que muda" | **0%** |

Número concreto no título dobra o CTR. "Comparativo honesto" não promete nada —
é adjetivo, não informação.

**Mas o caso FluxoPromo desmente a regra simples e é importante:** o título
nomeia a marca certa, diz "preço", estamos em **posição 3 na SERP real** — e
mesmo assim **zero clique em 133 impressões**. O primeiro resultado é o próprio
FluxoPromo.

**Leitura:** existe um teto nas consultas de marca. Quem digita o nome exato de
um produto na maioria das vezes quer aquele produto. Melhorar o título sobe o
CTR de 1% para talvez 3-4% — não para 15%. Isso não invalida a ação nº1 (1.933
impressões a 3% são ~58 cliques contra 19 hoje), mas **calibra a expectativa**:
essa linha não substitui a frente Tier 1.

---

## 4. Indexação: era alarme falso — mas revelou outra coisa

Cruzando a lista de 77 páginas indexadas com o registry de rotas:

- **As 7 páginas `/alternativas/*` estão TODAS indexadas.** A linha que mais
  cresce **não** está sendo barrada. A prioridade que a análise de 01/09 sugeria
  ("tratar indexação antes de produzir mais") **cai**.
- Das 20 rotas do registry fora do índice, **16 nunca entraram** e 4 caíram
  depois de já terem tido impressão (70 impressões perdidas).

Só que a lista das que nunca entraram tem dois nomes que doem:

```
/metodologia-uso-responsavel-whatsapp      ← nunca indexada
/melhores-bots-para-afiliados-whatsapp     ← nunca indexada
/estudos-de-caso                           ← nunca indexada
/confiabilidade-sessao-whatsapp            ← nunca indexada
/seguranca-credenciais-afiliado            ← nunca indexada
/botinho-vs-planilha-manual                ← nunca indexada
```

**`/metodologia-uso-responsavel-whatsapp` é exatamente a página que o Google AI
Overviews precisava para não inventar uma "Metodologia BOTinho".** Ela existe,
está publicada, e o Google nunca a indexou. O vazio que virou alucinação não é
falta de conteúdo — é conteúdo que não entrou no índice.

Caíram do índice depois de ranquear:

| Página | Impressões que tinha |
|---|---:|
| `/padronizar-divulgacao-afiliado-whatsapp` | 31 (3 cliques, CTR 9,68%) |
| `/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo` | 28 |
| `/reduzir-tempo-operacional-em-grupos-whatsapp` | 9 |
| `/rastrear-resultados-de-divulgacao-em-grupos` | 2 |

A primeira tinha o **melhor CTR do site** (9,68%) e saiu do índice.

---

## 5. As IAs acham que somos DOIS produtos concorrentes

O achado mais grave da rodada, e veio da pergunta de volta ao ChatGPT.

Perguntado o que o faria recomendar cada nome, ele respondeu tratando
**Espelha Grupos e BOTinho como ferramentas diferentes, de empresas diferentes**:

> "Espelha Grupos → 'quero replicar mensagens.'
> BOTinho → 'quero montar uma operação automatizada de ofertas.'"

> "posso fazer uma comparação objetiva BOTinho × Espelha Grupos, ponto a ponto,
> e dizer em quais pesquisas eu recomendaria cada um"

> "eu compararia Espelha Grupos, Promium, BOTinho e outras antes de recomendar"

Na última frase ele lista **Espelha Grupos e BOTinho lado a lado com o Promium**,
como três concorrentes.

**Causa:** a decisão de marca de 08/2026 (Espelha Grupos = marca no schema
`Organization`; BOTinho = produto no schema `SoftwareApplication`) foi tomada
justamente para dar **entidade única** ao Google e às IAs. Na prática, com os dois
nomes circulando em superfícies diferentes, a IA leu **duas entidades**.

Isso explica um número que estava solto: só o ChatGPT nos cita, e mesmo assim em
3 de 7 — a força da marca está dividida em dois.

**Conserto (não é redesign de marca — é vínculo explícito):**
- toda página deve dizer, em texto corrido e no schema, que **BOTinho é o
  produto do Espelha Grupos** — `SoftwareApplication` com
  `publisher`/`brand` apontando para a `Organization`, e `alternateName`;
- uma frase de identidade repetida em toda página: *"BOTinho, o robô do Espelha
  Grupos"*;
- no `llms.txt` (que, aliás, **não está indexado**), declarar a equivalência.

---

## 6. Promium: o benchmark que a IA colocou à nossa frente

Preços coletados em 01/09 (promium.space/#planos):

| Plano | 1º mês | Depois | Grupos WhatsApp | Instâncias |
|---|---:|---:|---:|---:|
| Starter | R$ 47,90 | R$ 97,90 | 5 | 1 |
| Basic | R$ 97,90 | R$ 197,90 | 20 | 1 |
| Intermediário | R$ 297,90 | R$ 397,90 | 50 | 2 |
| Pro | R$ 497,90 | R$ 597,90 | 200 | 3 |

**Nosso Pro é R$ 69/mês.** O plano de entrada deles custa R$ 97,90 recorrente —
**42% mais caro que o nosso plano completo**, com 5 grupos.

O que eles têm e vale mapear: replicador de grupos, monitoramento de grupos,
captura de cupom por IA, fila de envios com intervalo, vitrine de produtos com
domínio próprio, rotador de links com pixel (Meta/TikTok/GA4), 10 lojas,
Telegram.

⚠️ **O que eles fazem melhor que nós em SEO, e é copiável:** o rodapé tem **13
páginas de "Automação \<loja\> para WhatsApp"** — Shopee, Mercado Livre, Amazon,
TikTok Shop, Magalu, Shein, Natura — mais páginas por **recurso**
(`/monitoramento-grupos-whatsapp`, `/replicador-grupos-whatsapp`,
`/captura-cupons-whatsapp`, `/rotador-links-grupos-whatsapp`).

É SEO programático por **loja × recurso** — a mesma mecânica que congelamos para
cidade e nicho, mas num eixo que tem demanda real (Tier 1: `shopee afiliados`,
50.000/mês). Nossa maior oportunidade aberta e o concorrente já está nela.

**Não copiar preço nem promessa.** Somos mais baratos; a comparação é factual e
já está no `competitors-data.js`. Falta criar `/alternativas/promium`.

---

## 7. O que a IA disse que falta (literal)

Ela listou os gatilhos que a fariam recomendar. Vale como especificação:

- **espelhamento grupo → grupo explicado sem jargão**: escolher origem, escolher
  destinos, pronto — deixando claro que **não precisa de API, n8n ou
  programação**. Esse é o argumento comercial mais forte contra as respostas que
  as IAs dão hoje (GREEN-API, Z-API, Evolution, MacroDroid, Make);
- **dizer se preserva a mensagem original ou recria** — texto, imagem, vídeo,
  legenda, cupom;
- **filtros** ("espelhe só o que tem Amazon/Shopee/ML");
- **transformação antes de publicar** (o "antes e depois" da mensagem);
- **controle de duplicidade** entre origens — que nós temos e não contamos;
- **transparência sobre risco**, em vez de "sem risco de ban" — o que já é a
  nossa política e é um diferencial que não estamos usando;
- **preço claro** e relação custo/benefício por número de grupos.

Quase tudo isso o produto **já faz**. O que falta é estar escrito de forma
citável na página.

---

## 8. Ordem de execução

### Agora (texto em página que já ranqueia — efeito em dias)

1. **Resolver a troca de identidade em `achadinho pro`** (seção 1). 742
   impressões, a maior consulta do site, respondida por página com o nome errado
   no título.
2. **Título e descrição das 7 `/alternativas/*`** com número concreto, no padrão
   que dá 2,76% em vez de 1,33%. Calibrar expectativa pela seção 3.
3. **Separar as duas páginas de achadinhos** por consulta-alvo (seção 2).
4. **Expor o preço do plano Basic** na página de preços, em texto legível por
   robô — apontado pela própria IA.
5. **Títulos acima de 60 caracteres**: celular traz 57% das impressões, ranqueia
   melhor e converte metade.

### Esta semana (entidade e índice)

6. **Vincular BOTinho ↔ Espelha Grupos** em schema e texto (seção 5). É o
   conserto de maior alcance para citação por IA.
7. **Pedir indexação das 6 páginas que nunca entraram**, começando por
   `/metodologia-uso-responsavel-whatsapp` — é a que está sendo preenchida por
   alucinação no Google AI Overviews.
8. **Investigar as 4 que caíram do índice**, em especial
   `/padronizar-divulgacao-afiliado-whatsapp` (CTR 9,68%, o melhor do site).

### Próximas semanas (conteúdo novo)

9. **`/alternativas/promium`** — único concorrente que uma IA colocou à nossa
   frente.
10. **Reescrever a página de espelhamento** como produto pronto, com a lista da
    seção 7. As quatro IAs respondem essa consulta com API e gambiarra; é a
    consulta com menos concorrência de citação das sete.
11. **Abrir a frente Tier 1 por loja × recurso**, no eixo que o Promium já
    ocupa e que tem 50.000 buscas/mês com concorrência baixa. Apoiada nas duas
    páginas de blog que já ranqueiam (`como-divulgar-ofertas-amazon-whatsapp`,
    450 imp; `como-ser-afiliado-shopee-whatsapp`, 433 imp).
12. **Entrar nos roundups de terceiros.** `ofertasbot.com` publica "os 14
    Melhores Bots de Ofertas" e aparece na SERP de `fluxopromo` — não estamos
    lá. É a fonte que as IAs leem.

### Fora do escopo agora

- Cidade e nicho: congelados por dado, sem mudança.
- Indexação como prioridade máxima: **rebaixada** — as `/alternativas/` estão
  todas indexadas.
- Planejador e Trends: rodada completa em outubro.

---

## 9. O que ainda não sabemos

- **Se `/alternativas/achadinho-pro` consegue tomar a consulta da irmã** — é
  disputa entre duas páginas nossas, e o Google decide. A ação é reforçar a
  correspondência, não há garantia.
- **Qual é o teto de CTR numa consulta de marca alheia.** O caso FluxoPromo
  (posição 3, zero clique) sugere que é baixo. Medir depois da mudança de título,
  não antes.
- **Por que 6 páginas nunca foram indexadas.** Pode ser conteúdo fino, falta de
  link interno ou fila do Google. Não foi investigado.
