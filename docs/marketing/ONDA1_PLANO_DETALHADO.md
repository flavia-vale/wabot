# Onda 1 — plano detalhado, dividido por responsável

Substitui `ONDA1_TAREFAS_EXECUTAVEIS.md`, que ficou vago demais e continha um
erro de leitura (abaixo).

---

## ⚠️ Correção antes de tudo: nem toda página com zero impressão é problema

Cruzei as 36 rotas com zero impressão contra a data de publicação real. O
resultado muda a prioridade:

| Publicada em | Idade | Páginas | Veredito |
|---|---:|---:|---|
| **2026-07-22** | **8 dias** | 6 | ✅ **Normal.** Página de 8 dias sem impressão é esperado |
| 2026-07-15 | 15 dias | 2 | ✅ Normal |
| 2026-05-18 | 2,5 meses | 6 | 🔴 **Problema real** |
| 2026-05-15 | 2,5 meses | 6 | 🔴 **Problema real** |
| sem data | — | 14 | 🟠 Investigar |

**Erro que eu cometi:** no documento anterior classifiquei
`/blog/como-divulgar-ofertas-mercado-livre-whatsapp`,
`/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp` e
`/blog/como-converter-link-de-afiliado-automaticamente-whatsapp` como
"prioridade máxima, zero impressão". **As três têm 8 dias de vida.** Não estão
quebradas — o Google ainda nem terminou de processar. A ação certa nelas é
**pedir indexação**, não reescrever.

O problema real são as **12 páginas de maio** que tiveram 2,5 meses e não
conseguiram uma impressão sequer.

---

# PARTE A — Ações que EU executo (código, entregue em PR)

Tudo aqui é edição de arquivo no repositório. Você só revisa e aprova.

### A1 — Expandir os 2 posts que já carregam o site 🔴 COMEÇAR POR AQUI

**Arquivo:** `dashboard/app/blog/_preservationBlogPosts.js`
**Páginas:** `como-ser-afiliado-shopee-whatsapp`, `como-divulgar-ofertas-amazon-whatsapp`

Hoje cada post tem 4 seções curtas. Viram guias completos:

| O que muda | De | Para |
|---|---|---|
| `title` | `Como ser afiliado Shopee e divulgar ofertas no WhatsApp` | `Shopee Afiliados: como se cadastrar e ganhar comissão (guia 2026)` |
| Seções | 4 curtas | 9–11, cobrindo cadastro, comissão, regras, erros, divulgação |
| FAQ | 2 perguntas | 8–10, usando as perguntas literais do Planejador |
| Tabela de comissão | ❌ | ✅ (depende do B1) |

**Por que primeiro:** as duas somam 42% das impressões e estão em posição ~8,4.
São as únicas páginas do site com tração comprovada.

**Depende de você:** B1 (dados de comissão).

---

### A2 — Diagnosticar e corrigir as 12 páginas de maio 🔴

**Páginas:**
`/metodologia-uso-responsavel-whatsapp` · `/botinho-vs-planilha-manual` ·
`/botinho-vs-ferramentas-genericas-automacao` · `/melhores-bots-para-afiliados-whatsapp` ·
`/glossario` · `/estudos-de-caso` · `/diagnostico-antiban-whatsapp` ·
`/faq-antiban-whatsapp` · `/como-funciona-botinho-canais` · `/protecao-antiban-botinho` ·
`/materiais/checklist-antiban-whatsapp` · `/ferramentas/calculadora-risco-whatsapp`

**O que eu faço em cada uma:**
1. Conferir se está indexada e se o título usa palavra buscada ou jargão.
2. Reescrever `title`/`description` pelo termo real de busca.
3. Adicionar bloco de resposta direta de 40–60 palavras no topo.
4. Adicionar links internos a partir das páginas fortes.

**Nota:** 6 dessas 12 são do cluster antiban — tratadas junto no A4.

---

### A3 — Reescrever títulos pelo termo de busca (site inteiro) 🟠

**Arquivos:** `dashboard/lib/seo-registry.mjs`,
`dashboard/app/_preservationCommercialPages.js`,
`dashboard/app/blog/_preservationBlogPosts.js`

Padrão hoje: `<Assunto> | BOTinho` — marca no fim, jargão no começo.
Padrão alvo: **termo buscado primeiro**, marca só quando sobra espaço.

Exemplos concretos:

| Página | Hoje | Proposto |
|---|---|---|
| `/bot-afiliados-whatsapp` | `Bot para afiliados no WhatsApp` | `Bot para Afiliados no WhatsApp: automatize Shopee, Amazon e Mercado Livre` |
| `/anti-ban-whatsapp` | `Módulo de Preservação Avançada para WhatsApp` | `WhatsApp banido por divulgar ofertas: como reduzir o risco` |
| home | `BOTinho \| Bot para Afiliados no WhatsApp` | `Bot para Afiliados no WhatsApp — Shopee, Amazon e Mercado Livre \| BOTinho` |

---

### A4 — Reescrever o cluster antiban pela palavra do cliente 🟠

6 páginas do cluster estão com zero impressão há 2,5 meses. O conteúdo existe,
mas fala "preservação avançada" enquanto o cliente busca `whatsapp banido`
(5.000/mês, concorrência **baixa**).

Entro pela palavra do cliente no título e traduzo para o termo próprio dentro
da página.

⚠️ **Limite que não cruzo:** entrar pela palavra "banido" não vira promessa de
que não banem. Corrigir a expectativa dentro da página é honesto; prometer é
risco jurídico e contraria a política de uso responsável já publicada no
`llms.txt`.

---

### A5 — Criar `/alternativas/achadinhos-bot` 🟠

Você já aparece para `achadinhos bot` e `achadinhoosbot` sem página nenhuma.

Crio a rota, registro no `seo-registry.mjs` e escrevo comparativo **justo**:
tabela lado a lado, critérios objetivos, e dizendo onde o concorrente é melhor.
Comparativo enviesado é penalizado por IA e é risco jurídico — não vale a pena.

**Depende de você:** B2 (confirmar preço e recursos atuais do concorrente).

---

### A6 — Links internos e blocos extraíveis 🟡

- Ligar as páginas fortes (A1) às páginas fracas do mesmo assunto.
- Abrir cada página prioritária com resposta direta de 40–60 palavras (é o
  formato que o Google usa como snippet e a IA extrai como citação).
- Atualizar `updatedAt` em `lib/editorial-content.js` do que eu mexer.

---

### A7 — Registrar o congelamento 🟡

Documentar no `AGENTS.md` que **não se produz mais** LP de cidade, LP de nicho
novo, cluster "robô" nem Magalu — com o dado que sustenta a decisão, para nenhum
agente futuro reabrir a linha.

---

# PARTE B — Ações que VOCÊ executa (passo a passo)

## B1 — Levantar as comissões reais dos marketplaces 🔴 BLOQUEIA O A1

**Por que só você:** os percentuais oficiais ficam dentro dos painéis de
afiliado, logados. Eu não tenho acesso — e **não vou inventar número**, porque
dado errado sobre comissão destrói a confiança da página inteira.

**Shopee**
1. Entre em https://affiliate.shopee.com.br
2. Menu **Comissão** (ou "Taxas de Comissão")
3. Print ou copie a tabela **por categoria** (eletrônicos, moda, casa…)
4. Anote também: comissão de produto novo vs. recorrente, se houver

**Mercado Livre**
1. Entre em https://www.mercadolivre.com.br/afiliados
2. Vá em **Comissões** / **Como funciona**
3. Copie a tabela por categoria

**Amazon Associados**
1. Entre em https://associados.amazon.com.br
2. Rodapé → **Taxas de comissão** (ou "Programa de Taxas Padrão")
3. Copie a tabela por categoria

**Me mande:** print ou texto das 3 tabelas + a data da consulta (vou publicar a
data na página, porque comissão muda e página desatualizada perde credibilidade).

---

## B2 — Conferir preço e recursos do concorrente 🟠 BLOQUEIA O A5

**Por que só você:** preciso de dado verificável e com data para um comparativo
honesto. Não vou publicar informação sobre concorrente que eu não consiga datar.

1. Abra https://achadinhosbot.com.br e https://achadinhopro.com.br
2. Anote de cada um: **preço dos planos**, marketplaces suportados, se tem
   Telegram, se tem teste grátis, se converte cupom
3. Anote a **data** em que consultou

Se preferir, me mande só os prints — eu monto a tabela.

---

## B3 — Decidir a autoria das páginas 🟠

**Por que é sua:** é decisão de marca e de exposição pessoal, não técnica.

Hoje o autor é `Equipe editorial do BOTinho`, do tipo `Organization`. Para
E-E-A-T e para citação por IA, **autor pessoa física com credencial funciona
melhor** — a IA prefere fonte com gente identificável atrás.

Escolha uma:
- **(a)** Autor pessoa real (seu nome + uma linha de credencial, ex.: "operou
  grupos de ofertas desde X, fundadora do BOTinho"). **Melhor para SEO/IA.**
- **(b)** Manter como organização. Mais discreto, funciona menos.

Me diga a letra. Se for (a), me mande nome e a linha de credencial.

---

## B4 — Pedir indexação das 6 páginas novas 🔴 FAÇA HOJE, LEVA 10 MIN

**Por que só você:** exige login no Search Console.

Estas 6 têm 8 dias e ainda não foram processadas. Pedir indexação acelera de
semanas para dias — e é a ação de **maior retorno por minuto** desta onda:

```
/blog/como-divulgar-ofertas-mercado-livre-whatsapp
/blog/quanto-custa-bot-para-whatsapp-afiliados
/blog/melhores-horarios-para-postar-ofertas-no-whatsapp
/blog/como-converter-link-de-afiliado-automaticamente-whatsapp
/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp
/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero
```

**Passo a passo (repetir para cada uma):**
1. Abra https://search.google.com/search-console
2. Cole a URL completa na **barra de busca do topo** (a que diz "Inspecionar
   qualquer URL"), ex.:
   `https://espelhagrupos.com.br/blog/como-divulgar-ofertas-mercado-livre-whatsapp`
3. Enter → aguarde o teste (10–30s)
4. Clique em **SOLICITAR INDEXAÇÃO**
5. Aguarde a confirmação e repita com a próxima

⚠️ O Google limita a ~10 solicitações por dia. São 6, então cabe numa sessão.

---

## B5 — Confirmar que o sitemap está enviado 🟠 2 MIN

1. Search Console → menu lateral → **Sitemaps**
2. Confira se `sitemap.xml` aparece com status **Sucesso**
3. Se **não** aparecer: digite `sitemap.xml` no campo "Adicionar novo sitemap"
   e clique em **Enviar**
4. Me diga quantas URLs ele reporta como descobertas (espero ~96)

---

## B6 — Validar em staging e promover 🟡 DEPOIS DO MEU PR

Fluxo canônico do repo:
1. Reviso e você aprova o PR contra `develop`
2. Merge em `develop` → deploy automático para staging
3. Você valida em `http://178.105.54.0:3006` — conferir que as páginas
   reescritas abrem, títulos corretos, nada quebrado
4. Só depois: PR `develop` → `main`

---

## B7 — Medir em 60 dias 🟢

Search Console → Desempenho → comparar com hoje:

| Indicador | Hoje | Meta 60d |
|---|---:|---:|
| Consultas distintas | 13 | > 40 |
| Impressões | 1.154 | > 4.000 |
| Posição das 2 páginas do A1 | ~8,4 | < 5 |
| Rotas com zero impressão | 36 | ≤ 25 |
| Páginas não indexadas | 16 | ≤ 8 |

**A métrica mais honesta é "consultas distintas".** Hoje são 13. É o número que
mostra se o site parou de falar sozinho.

---

# Ordem de execução

```
VOCÊ, hoje:        B4 (indexação)  →  B5 (sitemap)      ← 15 min, maior retorno imediato
VOCÊ, esta semana: B1 (comissões)  →  B2  →  B3
EU, ao receber B1: A1  →  A2/A4  →  A3  →  A5  →  A6  →  A7
VOCÊ, ao fim:      B6 (staging → prod)  →  B7 (medir em 60d)
```

**Você não precisa esperar por mim para fazer B4 e B5.** São 15 minutos e
destravam 6 páginas que já estão prontas e publicadas.

Eu posso começar A2, A3, A4, A6 e A7 imediatamente — nenhuma depende de você.
Só A1 (comissões) e A5 (dados do concorrente) ficam bloqueadas.
