# Checklist de indexação — Sprint orgânica IA 1

Data: 2026-05-14
Destino do PR: `develop`
Ambiente de validação: staging em `http://178.105.54.0:3006`

## URLs novas para validar e inspecionar

- [ ] `http://178.105.54.0:3006/blog/conferir-converter-link-afiliado-whatsapp`
- [ ] `http://178.105.54.0:3006/blog/bot-para-afiliados-whatsapp-grupos-cupons`
- [ ] `http://178.105.54.0:3006/materiais/checklist-divulgacao-ofertas-grupos-whatsapp`

## Validação técnica em staging

- [ ] Abrir cada URL na porta 3006 e confirmar status 200.
- [ ] Confirmar que o H1 aparece acima da dobra e corresponde ao tema da página.
- [ ] Confirmar resposta direta no primeiro bloco de conteúdo.
- [ ] Conferir title, description e canonical no HTML renderizado.
- [ ] Conferir FAQ visível na página.
- [ ] Conferir JSON-LD de `Article` e `FAQPage` no Rich Results Test ou validador equivalente.
- [ ] Abrir `http://178.105.54.0:3006/sitemap.xml` e confirmar as três URLs novas.
- [ ] Confirmar que `robots.txt` não bloqueia `/blog/` nem `/materiais/`.
- [ ] Testar CTAs e links internos, sem efetivar compra ou mexer em produção.

## Google Search Console

- [ ] Inspecionar `http://espelhagrupos.com.br/blog/conferir-converter-link-afiliado-whatsapp` após aprovação em staging e merge para produção.
- [ ] Inspecionar `http://espelhagrupos.com.br/blog/bot-para-afiliados-whatsapp-grupos-cupons` após aprovação em staging e merge para produção.
- [ ] Inspecionar `http://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp` após aprovação em staging e merge para produção.
- [ ] Solicitar indexação somente das URLs aprovadas.
- [ ] Anotar data de solicitação e status de cobertura.

## Revisão editorial/comercial

- [ ] Confirmar que o texto explica link monetizado, tag/código de afiliado e risco de perder comissão por link errado.
- [ ] Confirmar que nenhuma página promete integração aprovada com marketplaces, redes de afiliados ou plataformas externas.
- [ ] Confirmar que o CTA está adequado ao estágio de lista VIP/cadastro.
- [ ] Validar claims sensíveis com responsável humana antes de publicar posts sociais.
