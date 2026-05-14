# Checklist — Indexação Search Console (Lote 3 — Dor)

Data: 2026-05-13

## URLs para inspeção e solicitação de indexação
- http://espelhagrupos.com.br/automatizar-divulgacao-em-grupos-whatsapp
- http://espelhagrupos.com.br/escalar-grupos-ofertas-sem-equipe
- http://espelhagrupos.com.br/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo
- http://espelhagrupos.com.br/padronizar-divulgacao-afiliado-whatsapp
- http://espelhagrupos.com.br/aumentar-conversao-em-grupos-de-cupons
- http://espelhagrupos.com.br/consistencia-postagens-em-grupos
- http://espelhagrupos.com.br/reduzir-tempo-operacional-em-grupos-whatsapp
- http://espelhagrupos.com.br/organizar-calendario-de-ofertas-no-whatsapp
- http://espelhagrupos.com.br/melhorar-alcance-em-grupos-de-promocoes
- http://espelhagrupos.com.br/rastrear-resultados-de-divulgacao-em-grupos

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
