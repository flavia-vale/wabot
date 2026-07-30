# Onda 1 — tarefas executáveis

Base: `ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`
Objetivo da onda: **destravar o que já existe** antes de produzir conteúdo novo.
É a onda mais barata — quase tudo aqui é reescrita, não criação.

> **Nada implementado.** Este é o plano de execução.

---

## Diagnóstico que gerou estas tarefas

Cruzamento do sitemap com o Search Console:

| | |
|---|---:|
| Rotas indexáveis no sitemap | **96** |
| Páginas com alguma impressão | **60** |
| **Rotas com ZERO impressão** | **36** |
| Indexadas (GSC, 23/07) | 76 |
| Não indexadas | 16 |

*(correção: no primeiro estudo eu disse "61 rotas" — a contagem certa é 96.)*

**Zero impressão em 2,5 meses ≈ a página não existe para o Google.** Ou não foi
indexada, ou foi indexada e nunca apareceu para ninguém. Nos dois casos, o
trabalho de escrevê-la está parado no estoque.

---

## T1 — Destravar as 4 páginas de Tier 1 com zero impressão 🔴 PRIORIDADE MÁXIMA

Estas são as páginas do cluster que os dados apontaram como o mais valioso
(afiliação/marketplace, 50.000 buscas/mês, concorrência baixa) e que **hoje não
recebem uma única impressão**:

| Página | Cluster | Termo-alvo real | Vol/mês |
|---|---|---|---:|
| `/blog/como-divulgar-ofertas-mercado-livre-whatsapp` | ML | `mercado livre afiliados` | 50.000 |
| `/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp` | comparativo | `programa de afiliados` | 5.000 |
| `/blog/como-converter-link-de-afiliado-automaticamente-whatsapp` | conversão | `link de afiliado` | — |
| `/bot-afiliados-whatsapp` | comercial | `afiliado` + ferramenta | — |

Chama atenção que `/bot-afiliados-whatsapp` — uma das páginas comerciais mais
importantes do site — tenha **zero impressão**.

**O que fazer em cada uma:**

1. Reescrever **título e H1 começando pelo termo de busca**, não pela marca nem
   pelo jargão interno.
   - ❌ hoje: `Como divulgar ofertas do Mercado Livre no WhatsApp | BOTinho`
   - ✅ alvo: `Afiliado Mercado Livre: como divulgar e ganhar comissão (2026)`
2. Abrir com uma **definição direta de 40–60 palavras** que responda a busca
   sozinha (isso é o que IA extrai e o que o Google usa como snippet).
3. Garantir **conteúdo próprio** — não template compartilhado.
4. Conferir se está no sitemap e se a canônica aponta para ela mesma.
5. Linkar a partir das duas páginas fortes (ver T3).

**Critério de aceite:** cada uma sai de 0 e passa a ter impressão no Search
Console em até 30 dias.

---

## T2 — Verificar bloqueios de indexação ✅ JÁ VERIFICADO — SEM AÇÃO

Conferi no código. Os bloqueios que o GSC reporta são **todos intencionais**:

| Item do GSC | Página real | Veredito |
|---|---|---|
| 3 × `noindex` | `/admin`, `/login`, `/promo-vip-7dias` | ✅ correto |
| 1 × bloqueada por robots | `/promo-vip-7dias` | ✅ correto |
| 1 × canônica alternativa | — | ✅ normal |

`/painel` também é `noindex`, como deve ser.

**Nenhuma ação necessária.** Marcado só para não gastar tempo investigando de novo.

*(Observação menor, não urgente: `/promo-vip-7dias` está com `noindex` **e**
bloqueada no robots ao mesmo tempo. Como o robots impede o Google de ler a
página, ele nunca chega a ver a tag `noindex`. O resultado prático é o desejado
— a página não indexa —, então não é problema. Só não é o jeito canônico.)*

---

## T3 — Empurrar as duas páginas que já carregam o site 🔴 ALTO RETORNO

São **42% de todas as impressões** e estão em posição ~8,4 — ou seja, no fim da
página 1. Pouco esforço as leva para o topo, onde o clique multiplica.

| Página | Impressões | Posição | Cliques |
|---|---:|---:|---:|
| `/blog/como-divulgar-ofertas-amazon-whatsapp` | 280 | 8,41 | 6 |
| `/blog/como-ser-afiliado-shopee-whatsapp` | 201 | 8,35 | 2 |

**Por que vale tanto:** subir de ~8 para ~3 costuma multiplicar o clique por
5–10×. E `/blog/como-ser-afiliado-shopee-whatsapp` ataca `shopee afiliados`
(50.000/mês, concorrência baixa) — o termo mais valioso do levantamento inteiro.

**O que fazer:**

1. **Expandir para guia completo.** Hoje são posts. O alvo é ser a melhor página
   do Brasil sobre "como ser afiliado Shopee": cadastro, comissão por categoria,
   regras, erros comuns, como divulgar, como acompanhar resultado.
2. **Título pelo termo exato de busca** (`Shopee Afiliados: como se cadastrar e
   ganhar comissão — guia 2026`).
3. **Tabela de comissão por categoria** — dado concreto é o que IA cita.
4. **FAQ** com as perguntas literais que aparecem no Planejador
   (`shopee afiliado como funciona`, `shopee afiliados entrar`).
5. **Data de atualização visível** + autor com credencial.
6. **Links internos** para as 4 páginas do T1 e para o trial.
7. **Isca de captura** no meio e no fim.

**Critério de aceite:** posição média das duas abaixo de 5 em 60 dias.

---

## T4 — Página de alternativa ao concorrente 🟠 BARATO E RÁPIDO

Duas das 13 consultas do site são **`achadinhos bot`** e **`achadinhoosbot`**
(posições 7 e 9,5). Pessoas procurando o concorrente **pelo nome** já estão
vendo você, sem nenhuma página feita para isso.

**Criar:** `/alternativas/achadinhos-bot`

**Regras inegociáveis:**
- Comparativo **justo e verificável**, com data e fonte de cada informação.
- Nada de depreciar o concorrente. Comparativo enviesado é penalizado por IA,
  além de risco jurídico e de reputação.
- Tabela lado a lado com critérios objetivos (preço, marketplaces suportados,
  conversão de cupom, canais, relatórios).
- Dizer honestamente onde o concorrente é melhor. Isso aumenta a citação por IA,
  não diminui.

**Critério de aceite:** indexada e aparecendo para `achadinhos bot` em 30 dias.

---

## T5 — Reescrever o cluster "antiban" pela palavra do cliente 🟡 MÉDIO

Descoberta do cruzamento: **4 páginas do cluster antiban têm zero impressão**:

- `/faq-antiban-whatsapp`
- `/protecao-antiban-botinho`
- `/materiais/checklist-antiban-whatsapp`
- `/diagnostico-antiban-whatsapp`

E `/anti-ban-whatsapp` tem 3 impressões.

**Por quê:** o conteúdo existe, mas usa "preservação avançada" e "antiban" —
enquanto o cliente busca `whatsapp banido` (5.000/mês, concorrência **baixa**),
`número banido whatsapp`, `conta banida whatsapp`, `zap banido`. São ~10
variações de 5.000 cada, quase sem concorrência.

O site **já aparece** para `shadowban whatsapp` (11 impressões, pos 10,45) sem
nunca ter otimizado — prova de que o cluster funciona.

**O que fazer:** entrar pela palavra do cliente no título e H1, e traduzir para o
termo próprio dentro da página.

⚠️ **Limite que não se cruza:** entrar pela palavra "banido" **não** pode virar
promessa de que não banem. Corrigir a expectativa dentro da página é honesto —
prometer é risco jurídico e quebra a política de uso responsável que já está no
`llms.txt`.

**Ressalva de conversão:** boa parte de quem busca isso foi banida por motivo
sem relação com afiliação. Tratar como topo de funil com isca, não como página
de venda.

---

## T6 — Congelar (decisão, não tarefa) ⛔

Confirmado por dado. **Não produzir mais nada nestas linhas:**

| Linha | Evidência |
|---|---|
| 15 LPs de cidade | ~25 impressões somadas em 2,5 meses; 5 delas em zero |
| 4 LPs de nicho novo (farmácia, autopeças, pet shop, beleza) | zero impressão |
| Cluster "robô" | Trends: 12× menor que "bot" |
| Magalu | único marketplace em queda |

**Não deletar** — perder link e histórico não ajuda. Só parar de investir.

---

## Ordem sugerida de execução

```
T2 (já feito)  →  T3  →  T1  →  T4  →  T5
                  ↑
            começa por aqui: maior retorno, menor esforço
```

**T3 primeiro** porque mexe em páginas que já têm tração comprovada — é a única
tarefa da onda com retorno praticamente garantido.

---

## Como saber se a Onda 1 funcionou

Medir em **60 dias**, no Search Console:

| Indicador | Hoje | Meta |
|---|---:|---:|
| Rotas com zero impressão | 36 | ≤ 25 |
| Posição média das 2 páginas do T3 | ~8,4 | < 5 |
| Impressões totais | 1.154 | > 4.000 |
| Consultas distintas registradas | 13 | > 40 |
| Páginas não indexadas | 16 | ≤ 8 |

O indicador mais honesto é **consultas distintas**: hoje são 13. Um site
saudável nesse nicho deveria estar na casa das centenas. É a métrica que mostra
se o site parou de falar sozinho.
