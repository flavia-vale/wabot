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

```
https://espelhagrupos.com.br/shopee-afiliados-whatsapp
https://espelhagrupos.com.br/mercado-livre-afiliados-whatsapp
https://espelhagrupos.com.br/amazon-afiliados-whatsapp
https://espelhagrupos.com.br/shein-afiliados-whatsapp
https://espelhagrupos.com.br/magalu-afiliados-whatsapp
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

## Prioridade 2 — criadas em 02/09 junto com as outras

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

O Search Console aceita poucas solicitações por dia. Faça a Prioridade 1 hoje,
inteira, e as demais nos dias seguintes. E lembre: pedir indexação de página
que o Google já leu e recusou não muda nada — o que muda é o conteúdo dela.
