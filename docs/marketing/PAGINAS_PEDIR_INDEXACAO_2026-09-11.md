> ⚠️ **Fila substituída em 11/09/2026.** A lista única, priorizada por dia e
> com a cota da Inspeção de URL em conta, está em `ACOES_FLAVIA_2026-09-11.md`.
> Esta fica como histórico — quatro listas paralelas divergem em uma semana.

# Páginas para pedir indexação — 2026-09-11

Método: cruzamento das 90 rotas indexáveis do `seo-registry.mjs` contra as 86
linhas do relatório Páginas do Search Console (que só lista página COM
impressão). Resultado: **20 rotas com zero impressão**. Quatro delas não são
página de busca e ficam de fora do pedido.

Onde pedir: Search Console → Inspeção de URL → colar o endereço → "Solicitar
indexação". Antes de pedir, LEIA o veredito que a tela dá — é ele que diz a
causa, e a causa muda a ação.

## Prioridade 1 — Tier 1 (as cinco lojas)

Existem em produção desde 02/09, respondem 200, estão no sitemap, sem noindex.
Zero impressão em 9 dias. São o bloqueio da Issue 1.

**Pedidas em 11/09** (cota do dia esgotou nas quatro):

```
https://espelhagrupos.com.br/shopee-afiliados-whatsapp        ✅ pedida 11/09
https://espelhagrupos.com.br/mercado-livre-afiliados-whatsapp ✅ pedida 11/09
https://espelhagrupos.com.br/amazon-afiliados-whatsapp        ✅ pedida 11/09
https://espelhagrupos.com.br/shein-afiliados-whatsapp         ✅ pedida 11/09
```

**Primeira da fila de 12/09** — a cota acabou antes dela:

```
https://espelhagrupos.com.br/magalu-afiliados-whatsapp        ⏳ pendente
```

Anote o veredito de cada uma. Três respostas possíveis, com ações opostas:

- **"Rastreada, mas não indexada"** → o Google leu e escolheu não indexar.
  Pedir de novo não resolve. A causa provável é conteúdo quase igual entre as
  cinco (todas saem do mesmo gerador `_preservationCommercialPages.js`,
  variando o nome da loja). A ação é diferenciar o conteúdo, não insistir.
- **"Detectada, mas não indexada"** → o Google conhece o endereço e ainda não
  leu. Aqui o pedido de indexação de fato ajuda.
- **"Duplicada, o Google escolheu outra canônica"** → confirma o diagnóstico de
  conteúdo duplicado, e a tela diz qual página ele preferiu.

## Prioridade 2 — resto da fila de 12/09 (criadas em 02/09)

Mesma leva de 16 páginas; nove pegaram impressão e estas não.

```
https://espelhagrupos.com.br/alternativas/promium
https://espelhagrupos.com.br/estudos-de-caso
https://espelhagrupos.com.br/parcerias
https://espelhagrupos.com.br/ferramentas/calculadora-risco-whatsapp
https://espelhagrupos.com.br/ferramentas/calculadora-tempo-grupos-whatsapp
```

`/alternativas/promium` é a mais urgente das cinco: as consultas por nome de
concorrente são o maior volume de impressão do site, e esta é a única página de
comparação sem nenhuma.

## Prioridade 3 — páginas antigas que nunca entraram

```
https://espelhagrupos.com.br/escalar-grupos-ofertas-sem-equipe
https://espelhagrupos.com.br/aumentar-conversao-em-grupos-de-cupons
https://espelhagrupos.com.br/consistencia-postagens-em-grupos
https://espelhagrupos.com.br/organizar-calendario-de-ofertas-no-whatsapp
https://espelhagrupos.com.br/protecao-antiban-botinho
https://espelhagrupos.com.br/parceiro-influenciador
```

⚠️ `/protecao-antiban-botinho` carrega o nome aposentado no endereço. Pedir
indexação dela reforça a marca velha, que é o oposto do que a medição de IA
pede. Decidir primeiro se ela vira redirecionamento para uma rota com o nome
atual.

## Fora do pedido (não são página de busca)

- `/llms.txt` e `/pricing.md` — arquivos para robô de IA, não para o índice.
- `/cadastro` — formulário; não deve disputar busca.
- `/termos-parceria-influenciador` — página legal.

## Limite prático

O Search Console corta a cota de solicitações por dia, sem avisar antes — foi o
que aconteceu em 11/09, com a quinta página do Tier 1 já na fila. Por isso a
ordem importa: comece sempre pela página mais valiosa que ainda está pendente.

Fila de 12/09, nesta ordem:

1. `/magalu-afiliados-whatsapp` (sobra do Tier 1)
2. `/alternativas/promium`
3. `/estudos-de-caso`
4. `/parcerias`
5. as duas calculadoras em `/ferramentas`

E lembre: pedir indexação de página que o Google já leu e recusou não muda nada
— o que muda é o conteúdo dela.
