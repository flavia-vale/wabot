# Pendências de indexação no Google

Lista viva. Quando uma URL for indexada, risque daqui.

**Por que existe:** o IndexNow avisa Bing/DuckDuckGo/Yandex sozinho a cada deploy
de produção, mas **o Google não usa IndexNow** — precisa de pedido manual, um por
um, e tem cota diária (~10-12 URLs). Página nova sem pedido pode levar semanas
para ser rastreada.

**Como pedir:** Search Console → **Inspeção de URL** → colar a URL →
**Solicitar indexação**.

---

## Pendente

Só pedir **depois** que a PR correspondente estiver mergeada e o deploy de
produção tiver terminado — pedir antes indexa a versão velha e obriga a repetir.

Nada pendente.

---

## Já pedido em 04/08/2026

- [x] `/alternativas/proafiliados`
- [x] `/alternativas/shozap`
- [x] `/alternativas/fluxopromo`
- [x] `/bot-canal-whatsapp`
- [x] `/faq-antiban-whatsapp`
- [x] `/` (home — título mudou de "BOTinho" para "Espelha Grupos")
- [x] `/programa-de-afiliados`
- [x] `/alternativas/achadinhos-bot`
- [x] `/bot-afiliados-whatsapp`
- [x] `/bot-achadinhos-whatsapp`
- [x] `/anti-ban-whatsapp`
- [x] `/blog/como-ser-afiliado-shopee-whatsapp`
- [x] `/blog/como-divulgar-ofertas-amazon-whatsapp`
- [x] `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`
- [x] `/grupo-para-canal-whatsapp`

---

## Regra para páginas futuras

Toda rota nova ou com título/corpo reescrito entra nesta lista no MESMO PR que
a cria. Sem isso, a página fica publicada e o Google demora a achar — foi o que
aconteceu com as 36 rotas de impressão zero do baseline de 30/07.
