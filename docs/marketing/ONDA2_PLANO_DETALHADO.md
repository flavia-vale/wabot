# Onda 2 — Abrir o Tier 1 (o cluster de 50.000 buscas/mês)

Base: `ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`
Pré-requisito: Onda 1 (PRs #1362 e #1365)

**Objetivo da onda:** ocupar de verdade o cluster de afiliação por marketplace —
o único do levantamento com **50.000 buscas/mês e concorrência baixa**. A Onda 1
arrumou o vocabulário e destravou o que existia; a Onda 2 constrói o cluster.

---

## ⚠️ Bloqueio crítico antes de começar: os dados do ML estão errados

Você me mandou, como "comissão do Mercado Livre", este trecho:

> *"No Clássico, a tarifa varia entre 10% e 14% do valor da venda… Já o Premium
> tem tarifa entre 15% e 19%"*

**Isso não é comissão de afiliado — é a tarifa que o VENDEDOR paga ao Mercado
Livre para anunciar.** O próprio texto entrega: fala em *"custos de manter sua
loja operando"*, *"tipo de anúncio Clássico e Premium"* e manda continuar na
*"Universidade de Vendedores"*. É o custo de quem vende, não o ganho de quem
divulga.

**Por que isso importa muito:** se publicássemos "o Mercado Livre paga 10% a 19%
de comissão de afiliado", seria **factualmente errado**. Numa página cuja
autoridade vem justamente de citar número com fonte, um erro desse destrói a
credibilidade — e é o tipo de coisa que o Google e as IAs punem, não perdoam.
Por isso **não usei esse dado em nada**. A Onda 1 saiu só com Shopee e Amazon.

**A ordem de grandeza real é outra.** Fontes de terceiros indicam que a comissão
de afiliado do ML fica em torno de **4% a 16%, variando por categoria e por venda
direta vs. indireta**. Mas **isso é blog de terceiro, não fonte oficial** — não
publico número de comissão com essa procedência.

**O que preciso de você (B1-ML):**

1. Entre em https://www.mercadolivre.com.br/afiliados (logada na sua conta de afiliada)
2. Procure **"Comissões"**, **"Quanto vou ganhar"** ou **"Como funciona"** — dentro
   do painel de **afiliado**, não da conta de vendedor
3. Copie a tabela de **comissão por categoria**, anotando se distingue
   **venda direta** de **venda indireta**
4. Me mande com a data da consulta

Enquanto isso não chegar, **A1 fica parado**. O resto da onda anda sem ele.

---

## Onde estamos depois da Onda 1

| Página | Termo-alvo | Vol/mês | Conc. | Estado |
|---|---|---:|---|---|
| `/blog/como-ser-afiliado-shopee-whatsapp` | `shopee afiliados` | 50.000 | Baixa | ✅ guia com comissão real, pos. ~8,35 |
| `/blog/como-divulgar-ofertas-amazon-whatsapp` | `afiliado amazon` | 50.000 | Baixa | ✅ guia com comissão real, pos. ~8,41 |
| `/blog/como-divulgar-ofertas-mercado-livre-whatsapp` | `mercado livre afiliados` | **50.000** | **Baixa** | 🔴 fino, **zero impressão**, sem comissão |
| `/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp` | `programa de afiliados` | 5.000 | Média | 🟠 existe, zero impressão |
| — | `como se tornar afiliado shopee` | **50.000** | Média | 🔴 **ninguém mira nisso** |
| — | hub do cluster | — | — | 🔴 não existe |

**Dois buracos de 50.000 buscas/mês cada** e nenhum hub costurando o cluster.

---

# PARTE A — Ações que EU executo

### A1 — Guia do Mercado Livre no mesmo nível de Shopee e Amazon 🔴 MAIOR RETORNO

**Arquivo:** `dashboard/app/blog/_preservationBlogPosts.js`
**Bloqueado por:** B1-ML (comissão real)

`mercado livre afiliados` tem **50.000 buscas/mês com concorrência baixa** e a
página está com **zero impressão**. É o maior buraco isolado do site.

Mesmo tratamento que Shopee e Amazon receberam:
- título entrando por `Afiliado Mercado Livre` (hoje entra por "Como divulgar ofertas do Mercado Livre")
- tabela de comissão por categoria, com fonte e data
- seção sobre venda direta vs. indireta (se a tabela confirmar essa distinção)
- FAQ com as perguntas literais do Planejador
- autoria pessoa física (mesma flag `usePersonAuthor` da Onda 1)

---

### A2 — Hub do cluster de afiliados 🔴

**Novo:** `/programa-de-afiliados` (ou `/afiliados` — decidir em B2)
**Depende de:** nada. Pode começar já.

Hoje os três guias são **posts soltos**. Não há página que:
- capture a família `programa de afiliados` / `programa de afiliados shopee` / `…mercado livre` / `…amazon`
- distribua autoridade interna para os três guias
- sirva de resposta única para "qual programa de afiliados escolher"

**Formato:** comparativo — o tipo de conteúdo **mais citado por IA (~33% das
citações)**. Tabela lado a lado dos três programas: comissão, prazo de
atribuição, quando paga, exigência de aprovação, com fonte e data em cada célula.

⚠️ **Cuidado com canibalização** (risco #1 do estudo original): o hub **não pode**
tentar rankear para `shopee afiliados` — esse termo é do guia da Shopee. O hub
mira a comparação (`qual programa de afiliados`, `programa de afiliados`), e
**manda o clique para o guia certo**.

---

### A3 — Cobrir `como se tornar afiliado shopee` 🟠

**Volume: 50.000/mês, concorrência Média.** Quase do tamanho de `shopee
afiliados` — e hoje **nada no site mira nisso diretamente**.

**Minha recomendação: NÃO criar página nova.** Criar
`/blog/como-se-tornar-afiliado-shopee` competindo com
`/blog/como-ser-afiliado-shopee-whatsapp` é canibalização clássica — as duas
brigam entre si e nenhuma sobe. O guia da Shopee já está em posição 8,35;
dividir a força dele agora seria um erro.

**O que fazer em vez disso:** reforçar o guia existente para cobrir as duas
intenções — H2 com a frase literal (`Como se tornar afiliado Shopee`), passo a
passo numerado do cadastro (formato que o Google usa em snippet), e as variações
`shopee afiliados entrar` / `afiliado shopee como funciona` no FAQ.

Se em 60 dias o guia não pegar as duas intenções, aí sim reavaliar página
dedicada — **com dado, não com palpite**.

---

### A4 — Isca de captura alinhada à intenção 🔴 AFETA TODA A ONDA

**Arquivo:** `dashboard/components/marketing/LeadMagnetCard.jsx`

Achado ao inspecionar o código: **todos os posts do blog mostram a mesma isca**,
fixa no componente:

> *"Checklist de operação para divulgar ofertas no WhatsApp — padronize copy,
> links, horários, grupos de destino e métricas antes de ligar uma automação."*

Isso é para quem **já opera**. Quem busca `shopee afiliados` é **iniciante** —
muitas vezes nem se cadastrou no programa ainda. Oferecer checklist de operação
para quem ainda não tem operação é oferta fora de hora: o tráfego chega e não
converte.

**Segundo problema, mais sério:** o formulário aponta para
`/login?mode=register`. Ou seja, **não existe captura de e-mail de verdade** —
é um CTA de cadastro vestido de isca. Para tráfego informacional de topo de
funil (que é exatamente o Tier 1), pedir cadastro de cara é fricção alta demais.

**Proposta:** isca por cluster, não fixa. Para o cluster de afiliados, algo do
tipo *"Guia: escolha entre Shopee, Amazon e Mercado Livre — comissão, prazo de
pagamento e regras lado a lado"*. Precisa de decisão sua em **B3**.

---

### A5 — Links internos costurando o cluster 🟡

Os três guias **não linkam entre si** hoje. Cada um é uma ilha.

- os três guias ↔ o hub (A2)
- guia ↔ guia ("quer comparar com a Amazon?")
- guias → `/bot-afiliados-whatsapp` (a página comercial, que a Onda 1 já
  reposicionou) como passo final

É a peça mais barata da onda e a que faz o cluster funcionar como cluster.

---

### A6 — Reaproveitar o comparativo que já existe 🟡

`/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp` já existe e está
com zero impressão. Depois de A1 e A2, ele vira o **aprofundamento** do hub —
não deve competir com ele. Ajustar ângulo e linkar.

---

# PARTE B — Ações que VOCÊ executa

## 🔴 B1-ML — Comissão real do Mercado Livre (BLOQUEIA A1)

Passo a passo na seção de bloqueio, no topo deste documento.
**É o item de maior impacto da onda inteira** — destrava 50.000 buscas/mês.

## 🟠 B2 — Decidir a URL do hub

Qual você prefere para o hub do A2?

- **(a)** `/programa-de-afiliados` — casa exatamente com o termo buscado
- **(b)** `/afiliados` — mais curto, mais amplo, serve de guarda-chuva se um dia
  entrar Magalu/AliExpress
- **(c)** outra que você preferir

Minha sugestão: **(a)**, porque é literalmente a palavra que tem volume.

## 🟠 B3 — Decidir a isca de captura (A4)

Duas perguntas:

1. **Vale criar uma isca específica para o cluster de afiliados?** (hoje é uma só
   para o site inteiro, desalinhada dessa audiência)
2. **Quer captura de e-mail de verdade**, com o lead entrando numa lista antes de
   virar cadastro — ou mantém a fricção alta de mandar direto para `/login`?

A segunda pergunta é de produto, não de SEO: envolve onde o e-mail é guardado e
o que é enviado depois. Não decido isso sozinho.

## 🟡 B4 — Validar em staging e promover

Mesmo fluxo da Onda 1: merge em `develop` → staging (`:3006`) → validar → PR para
`main`.

---

# Ordem de execução

```
VOCÊ:  B1-ML  ────────────────────┐
                                  ↓
EU:    A2 (hub) → A3 → A5 → A6 → A1 (destrava com B1-ML)
                    ↑
       A4 depende de B3
```

**A2, A3, A5 e A6 não dependem de nada seu** — posso começar agora.
**A1 e A4** ficam parados esperando B1-ML e B3.

---

# Como medir a Onda 2

Comparar contra o baseline de 2026-07-30 (`AGENTS.md` → *Dados de mercado para
marketing*), em **60 dias**:

| Indicador | Baseline | Meta |
|---|---:|---:|
| Guia do ML: impressões | **0** | > 300 |
| Posição média dos 3 guias de marketplace | ~8,4 (2 deles) | < 5 |
| Consultas distintas do site | 13 | > 60 |
| Impressões totais | 1.154 | > 6.000 |
| Termos do Tier 1 no top 10 | 0 | ≥ 4 |

---

# O que a Onda 2 NÃO faz (e por quê)

| Não fazer | Motivo |
|---|---|
| Página nova para `como se tornar afiliado shopee` | canibaliza o guia que já está em pos. 8,35 (ver A3) |
| Guia de afiliado **Magalu** | único marketplace em queda no Trends — linha congelada |
| Perseguir `cupom amazon` (500.000/mês) | público é consumidor final, não afiliado — vira site de cupom, outro negócio |
| Mais LPs de cidade ou de nicho | linhas congeladas por dado (`AGENTS.md`) |
| Cluster "robô" | 12× menor que "bot" no Trends |

⚠️ Regra que continua valendo: entrar pela palavra do cliente **nunca** vira
promessa. Nenhuma página de comissão pode sugerir ganho garantido — comissão
depende de venda, categoria, aprovação e regras do programa.
