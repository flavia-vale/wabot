> ⚠️ **Fila substituída em 11/09/2026** por `ACOES_FLAVIA_2026-09-11.md`.

# Checklist de indexação — Sprint orgânica IA 1

Data: 2026-05-14
Destino do PR: `develop`
Ambiente de validação: staging em `http://178.105.54.0:3006`

## Resultado desta execução (via VPS em staging)

- Validação executada no host com `cd /home/deploy/wabot-staging` usando `127.0.0.1:3006` e `127.0.0.1:3004`.
- As 3 URLs novas retornaram `status:200`.
- `sitemap.xml` contém as 3 URLs novas.
- `robots.txt` não bloqueia `/blog/` nem `/materiais/`.
- `GET http://127.0.0.1:3004/health` retornou `HTTP/1.1 200 OK` com `{"ok":true}`.

## URLs novas para validar e inspecionar

- [x] `http://178.105.54.0:3006/blog/conferir-converter-link-afiliado-whatsapp`
- [x] `http://178.105.54.0:3006/blog/bot-para-afiliados-whatsapp-grupos-cupons`
- [x] `http://178.105.54.0:3006/materiais/checklist-divulgacao-ofertas-grupos-whatsapp`

## Validação técnica em staging

- [x] Abrir cada URL na porta 3006 e confirmar status 200.
- [x] Confirmar que o H1 aparece acima da dobra e corresponde ao tema da página.
- [x] Confirmar resposta direta no primeiro bloco de conteúdo.
- [x] Conferir title, description e canonical no HTML renderizado.
- [x] Conferir FAQ visível na página.
- [x] Conferir JSON-LD de `Article` e `FAQPage` no Rich Results Test ou validador equivalente.
- [x] Abrir `http://178.105.54.0:3006/sitemap.xml` e confirmar as três URLs novas.
- [x] Confirmar que `robots.txt` não bloqueia `/blog/` nem `/materiais/`.
- [ ] Testar CTAs e links internos, sem efetivar compra ou mexer em produção.

## Google Search Console

- Google Search Console executado em 2026-05-14 para as 3 URLs aprovadas.

- [x] Inspecionar `http://espelhagrupos.com.br/blog/conferir-converter-link-afiliado-whatsapp` após aprovação em staging e merge para produção.
- [x] Inspecionar `http://espelhagrupos.com.br/blog/bot-para-afiliados-whatsapp-grupos-cupons` após aprovação em staging e merge para produção.
- [x] Inspecionar `http://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp` após aprovação em staging e merge para produção.
- [x] Solicitar indexação somente das URLs aprovadas.
- [x] Anotar data de solicitação e status de cobertura.

## Revisão editorial/comercial

- [x] Confirmar que o texto explica link monetizado, tag/código de afiliado e risco de perder comissão por link errado.
- [x] Confirmar que nenhuma página promete integração aprovada com marketplaces, redes de afiliados ou plataformas externas.
- [x] Confirmar que o CTA está adequado ao estágio de lista VIP/cadastro.
- [ ] Validar claims sensíveis com responsável humana antes de publicar posts sociais.

## Incremento 2026-05-14 (ativo adicional)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-afiliados-whatsapp` (status 200, H1, FAQ visível, CTA).
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-afiliados-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Incremento 2026-05-15 (próximo dia)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-pet-shop-whatsapp` (status 200, H1, FAQ, CTA).
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-pet-shop-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Incremento 2026-05-15 (turno 2)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-turismo-whatsapp` (status 200, H1, FAQ, CTA).
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-turismo-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Incremento 2026-05-16 (copywriting + nicho autopeças)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-autopecas-whatsapp` (status 200, H1, FAQ, CTA).
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-autopecas-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Incremento 2026-05-17 (nicho cursos)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-cursos-whatsapp` (status 200, H1, FAQ, CTA).
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-cursos-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Incremento 2026-05-18 (nicho infoprodutos)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-infoprodutos-whatsapp` (status 200, H1, FAQ, CTA).
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-infoprodutos-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Incremento sequencial 2026-05-19 (executado em 2026-05-15)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-restaurantes-whatsapp` (status 200, H1, resposta direta, FAQ visível, CTA e links internos).
- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-marketplace-whatsapp` (status 200, H1, resposta direta, FAQ visível, CTA, bloco de risco de afiliado e links internos).
- [ ] Confirmar presença das duas rotas em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-restaurantes-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-marketplace-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação das URLs aprovadas após inspeção.
- [ ] Validar claims comerciais e posts sociais antes de publicação/agendamento.
