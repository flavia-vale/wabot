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

### Lote A — nunca foram pedidas, e nunca entraram no índice

Podem ser pedidas **assim que houver cota**: as páginas já estão no ar há
semanas e não dependem de nenhuma PR desta rodada.

- [ ] `/metodologia-uso-responsavel-whatsapp` ← **comece por esta**
- [ ] `/melhores-bots-para-afiliados-whatsapp`
- [ ] `/estudos-de-caso`
- [ ] `/confiabilidade-sessao-whatsapp`
- [ ] `/seguranca-credenciais-afiliado`
- [ ] `/botinho-vs-planilha-manual`

`/metodologia-uso-responsavel-whatsapp` é prioridade porque o Google AI
Overviews está preenchendo esse vazio com uma "Metodologia" INVENTADA, com
pilares de nome próprio e fontes falsas (medição de 01/09). A página existe e
responde exatamente isso — o Google só nunca a leu.

### Lote B — caíram do índice depois de já terem ranqueado

⚠️ **Esperar o deploy de produção das PRs #1554 e #1562.** A #1562 deu link
interno a estas quatro (eram alcançáveis só pelo sitemap) e a #1554 encurtou
títulos. Pedir antes indexa a versão velha.

- [ ] `/padronizar-divulgacao-afiliado-whatsapp` ← tinha o **melhor CTR do site (9,68%)**
- [ ] `/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo`
- [ ] `/reduzir-tempo-operacional-em-grupos-whatsapp`
- [ ] `/rastrear-resultados-de-divulgacao-em-grupos`

### Lote C — páginas novas da frente Tier 1

⚠️ **Esperar o deploy de produção** das PRs que as criam.

- [ ] `/shopee-afiliados-whatsapp`
- [ ] `/mercado-livre-afiliados-whatsapp`
- [ ] `/amazon-afiliados-whatsapp`
- [ ] `/shein-afiliados-whatsapp`
- [ ] `/magalu-afiliados-whatsapp`

### O que a evidência diz sobre pedir

Das 15 URLs pedidas em 04/08, **todas** estão indexadas hoje. Das 10 dos lotes A
e B, **nenhuma** foi pedida alguma vez — e nenhuma está indexada. A correlação é
limpa: pedido entra, sem pedido não entra.

Isso derruba a hipótese registrada em
`INVESTIGACAO_PAGINAS_FORA_DO_INDICE_2026-09-02.md` de que o conteúdo estaria
sendo recusado por qualidade. A causa mais provável é bem mais simples: ninguém
pediu.

Uma distinção que ainda vale saber, para ler o relatório de Cobertura: "detectada,
mas não indexada" é fila — o pedido resolve. "Rastreada, mas não indexada" é o
Google tendo olhado e declinado; o pedido recoloca na fila, e só se ele declinar
DE NOVO é que vira problema de conteúdo.

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
