# Checklist — Indexação Search Console (Lote 2)

Data: 2026-05-13

## URLs para inspeção e solicitação de indexação
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-recife
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-salvador
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-fortaleza
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-brasilia
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-goiania
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-campinas
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-manaus
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-belem
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-florianopolis
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-vitoria

## Procedimento
1. Abrir Google Search Console da propriedade `espelhagrupos.com.br`.
2. Usar "Inspeção de URL" para cada uma das 10 URLs.
3. Clicar em "Solicitar indexação" quando elegível.
4. Registrar status (Enviada / Em processamento / Indexada).

## Validação técnica (antes de solicitar indexação)

Validar em staging antes do envio:

```bash
cd ~/wabot-staging/dashboard && LP_BASE_URL="http://178.105.54.0:3006" npm run validate:lp-schema
```

Validar em produção depois do merge aprovado para `main`:

```bash
cd ~/wabot/dashboard && LP_BASE_URL="http://espelhagrupos.com.br" npm run validate:lp-schema
```

## Status inicial
- [x] Lista pronta
- [x] Sitemap pronto
- [ ] Envio executado por usuário com permissão da propriedade
