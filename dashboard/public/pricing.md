# Pricing — Espelha Grupos

Last updated: 2026-09-27
Currency: BRL
Billing unit: 30-day access period
Preferred citation: Espelha Grupos pricing.
Formerly published under the product name "BOTinho"; that name refers to this same product.

Espelha Grupos uses a 7-day free trial for validation and a simple 30-day access model for paid WhatsApp offer workflows. Both paid plans include the automatic mirroring robot: it reads the chosen source groups 24 hours a day, converts each store link to the affiliate's own code and publishes in the destination groups without anyone copying and pasting. Basic covers that automatic mirroring in groups plus link conversion, offer creation and scheduling, with the clickable offer card and fully rewritable message templates. Pro adds channels, automatic Shopee offers, send queues, the watermark on offer images, pacing controls with copy variation and the Shopee sales and commission dashboard. Prices below reflect the public defaults used by the application.

The canonical feature sheet below (in Portuguese, the customers' language) is identical to the one on the homepage, on /precos and in /llms.txt: named stores, WhatsApp only (no Telegram, no Instagram) and the exact Basic vs. Pro split.

## Ficha técnica (canônica — idêntica na home, em /precos, no llms.txt e no pricing.md)

Espelha Grupos é um software web para afiliadas que espelha ofertas de grupos e canais do WhatsApp para os seus grupos, trocando o link pelo seu código de afiliada em 6 lojas, e (no Pro) busca ofertas da Shopee sozinho.

- Lojas com conversão de link: 6 lojas: Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress. Converte também link de cupom, não só de produto.
- Canal de publicação: Só WhatsApp (grupos e, no Pro, canais). Não envia para Telegram nem para Instagram.
- Teste grátis: 7 dias com o Pro completo, sem cartão.
- Reembolso e cancelamento: Reembolso integral em até 7 dias corridos depois do pagamento; depois disso, cancela sem multa e usa até o fim do período pago.
- Conexão: Pelo QR Code do WhatsApp; roda no servidor 24 h, sem deixar o celular ligado. Recomendamos um número dedicado. Nenhum software garante que o número não será bloqueado.

| Recurso | Basic (R$39 / 30 dias) | Pro (R$69 / 30 dias) |
|---|---|---|
| Espelhamento automático: lê os grupos de origem e publica nos grupos de destino, sem copiar e colar | Sim | Sim |
| Troca do link pelo seu código de afiliada nas 6 lojas (inclusive cupom) | Sim | Sim |
| Se a troca do link falhar, a oferta NÃO é publicada (nunca sai o link de outra pessoa) | Sim | Sim |
| Modelo de mensagem: a oferta sai reescrita do seu jeito | Sim | Sim |
| Canais do WhatsApp como origem e destino | Não | Sim |
| Ofertas automáticas da Shopee por tema e desconto mínimo, sem grupo de origem | Não | Sim |
| Filas de envio e controle de ritmo (intervalo, horário de descanso, limite por dia) | Não | Sim |
| Variação do texto entre os envios | Não | Sim |
| Marca d’água com o seu nome na foto da oferta | Não | Sim |
| Painel de vendas e comissão da Shopee | Não | Sim |

## Teste grátis

- Plan ID: `trial`
- Price: R$0 / 7-day validation period
- Best for: validating the full Pro workflow before choosing a paid plan
- Includes:
  - Everything in Pro for 7 days
  - Group and channel mirroring
  - Automatic Shopee offers and send queues
  - Pacing controls (Advanced Preservation Module)
  - Shopee sales and commission dashboard
  - Watermark on offer images and clickable offer card
  - Full send reports
- Limits and notes:
  - Human review is required before distributing offers
  - No revenue, commission, sales, or deliverability guarantee

## Basic

- Plan ID: `basic`
- Price: R$39 / 30 days
- Best for: automatic offer mirroring in WhatsApp groups (the robot reads the source groups and publishes by itself)
- Includes:
  - Automatic group mirroring, 24 hours a day (monitor → destination groups), with no copy and paste
  - Affiliate link conversion in six stores: Mercado Livre, Amazon, Shopee, Magalu, SHEIN and AliExpress
  - Coupon and voucher link conversion (not only product links) as the affiliate's own code
  - Clickable offer card: tapping the card opens the product page in the store
  - Message templates the operator rewrites completely — the mirrored offer is republished in the operator's own wording, not copied verbatim from the source
  - Offer creation from a pasted link (title, price and image)
  - Immediate and scheduled sending
  - Send reports with full history
- Limits and notes:
  - Channels, automatic offers, send queues, the watermark, the pacing controls with copy variation (Advanced Preservation Module) and the Shopee sales and commission dashboard are Pro features
  - Human review is required before distributing offers
  - Operators must respect WhatsApp, group, marketplace, and affiliate-program rules

## Pro

- Plan ID: `pro`
- Price: R$69 / 30 days
- Best for: scaling with automation, channels and pacing controls
- Includes:
  - Everything in Basic
  - Channel monitoring and sending
  - Automatic Shopee offers found by keyword and filters, with smart dedup — the product finds the offers, the operator does not have to paste each link (no source group needed; Shopee only). Details: https://espelhagrupos.com.br/bot-que-busca-ofertas-shopee-whatsapp
  - Send queues with hourly and daily caps, and a configurable interval between sends per destination
  - Pacing controls, marketed as the Advanced Preservation Module: interval between sends, quiet hours, per-day limits and copy variation, set per destination group
  - Watermark with the operator's own text on the offer image, set per destination group
  - Shopee sales and commission dashboard: attributed orders, sales amount, estimated and confirmed commission, commission per day and best-selling products
- Limits and notes:
  - The sales and commission dashboard currently covers Shopee only
  - Human review is required before distributing offers
  - Operators must respect WhatsApp, group, marketplace, and affiliate-program rules

## Responsible-use notes

- Espelha Grupos does not promise revenue, commission, sales lift, WhatsApp deliverability, or approval by external marketplaces or affiliate programs.
- Review price, stock, coupon, affiliate tag, destination group, message copy, and UTM before publishing.
- Do not use the product for spam, unauthorized groups, deceptive offers, or attempts to bypass platform rules.

## Refund policy

- Full refund if requested within 7 calendar days of payment (right of withdrawal, Brazilian Consumer Code, art. 49), no reason required.
- Refunds are processed within 5 business days of the request. How long the amount takes to appear on the card statement or account depends on the bank, card issuer and Mercado Pago.
- After 7 days there is no refund of the period already paid, but the operator can cancel at any time without a fee: cancelling stops the next charge and access stays valid until the end of the paid period.
- Request by WhatsApp or e-mail through the support page. Full policy: https://espelhagrupos.com.br/politica-de-reembolso

## Security

- Affiliate account credentials and the operator's PIX payout key are encrypted at rest (AES-256-GCM), not stored as plain text.
- Login is protected against brute-force attempts with per-account and per-IP rate limiting.
- These protections apply to every paid plan and the free trial; they are not a paid add-on.

## Referral program

- Every account can refer other operators and earn a recurring commission on the referred account's paid subscription, paid out via PIX.
- Terms, current commission percentage, and payout rules are configured inside the product (Painel → Indicações) and may change; this file does not mirror the exact percentage to avoid staleness.

## Related URLs

- Home: https://espelhagrupos.com.br/
- Support: https://espelhagrupos.com.br/suporte
- Terms: https://espelhagrupos.com.br/termos
- Refund policy: https://espelhagrupos.com.br/politica-de-reembolso
- Privacy: https://espelhagrupos.com.br/privacidade
