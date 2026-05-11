# Checklist — Indexação Search Console (Lote 1)

Data: 2026-05-11

## URLs para inspeção e solicitação de indexação
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-sao-paulo
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-rio-de-janeiro
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-belo-horizonte
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-curitiba
- http://espelhagrupos.com.br/espelhar-grupos-whatsapp-porto-alegre
- http://espelhagrupos.com.br/bot-ofertas-supermercado-whatsapp
- http://espelhagrupos.com.br/bot-ofertas-farmacia-whatsapp
- http://espelhagrupos.com.br/bot-ofertas-eletronicos-whatsapp
- http://espelhagrupos.com.br/bot-ofertas-moda-whatsapp
- http://espelhagrupos.com.br/bot-ofertas-beleza-whatsapp

## Procedimento
1. Abrir Google Search Console da propriedade `espelhagrupos.com.br`.
2. Usar "Inspeção de URL" para cada uma das 10 URLs.
3. Clicar em "Solicitar indexação" quando elegível.
4. Registrar status (Enviada / Em processamento / Indexada).

## Validação técnica (antes de solicitar indexação)

Use os comandos abaixo para confirmar que o schema `Product` está presente no HTML publicado.

1. Testar uma LP específica (ex.: São Paulo):

```bash
curl -sL "http://espelhagrupos.com.br/espelhar-grupos-whatsapp-sao-paulo" \
  | tr -d '\n' \
  | grep -o '"@type":"Product"[^<]*' \
  | head -c 1200
```

2. Se o comando acima não retornar nada, rode uma validação menos restritiva:

```bash
curl -sL "http://espelhagrupos.com.br/espelhar-grupos-whatsapp-sao-paulo" \
  | tr -d '\n' \
  | grep -o 'application/ld+json[^<]*' \
  | head -c 2000
```

3. Se ainda vier vazio, verificar se a página está no ar e sem bloqueio:

```bash
curl -I "http://espelhagrupos.com.br/espelhar-grupos-whatsapp-sao-paulo"
```

4. Validar em lote as 10 LPs (retorna `OK` quando encontra `"@type":"Product"`):

```bash
for slug in \
  espelhar-grupos-whatsapp-sao-paulo \
  espelhar-grupos-whatsapp-rio-de-janeiro \
  espelhar-grupos-whatsapp-belo-horizonte \
  espelhar-grupos-whatsapp-curitiba \
  espelhar-grupos-whatsapp-porto-alegre \
  bot-ofertas-supermercado-whatsapp \
  bot-ofertas-farmacia-whatsapp \
  bot-ofertas-eletronicos-whatsapp \
  bot-ofertas-moda-whatsapp \
  bot-ofertas-beleza-whatsapp; do
  if curl -sL "http://espelhagrupos.com.br/$slug" | tr -d '\n' | grep -q '"@type":"Product"'; then
    echo "OK  - $slug"
  else
    echo "FALHA - $slug"
  fi
done
```

## Status inicial
- [x] Lista pronta
- [x] Sitemap pronto
- [ ] Envio executado por usuário com permissão da propriedade
