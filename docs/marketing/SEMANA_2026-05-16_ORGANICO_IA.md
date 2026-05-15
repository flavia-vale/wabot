# Sprint orgânica IA — Semana 2026-05-16

## O que já existia antes

- LPs de nicho já criadas no ciclo anterior: afiliados, pet shop e turismo.
- Checklist incremental de indexação já ativo para validação em staging e inspeção no Search Console.

## O que foi continuado

- Execução do próximo ativo pendente do backlog de nicho com foco em copywriting orientado a conversão.
- Continuidade simultânea dos clusters:
  - afiliados/conversão (conferência de link monetizado);
  - automação/espelhamento/distribuição em grupos WhatsApp.

## O que foi criado agora

1. Nova LP pública indexável: `/bot-ofertas-autopecas-whatsapp`
   - Keyword principal: `bot ofertas autopecas whatsapp`.
   - SEO on-page via `LpTemplate`: title, description, canonical, H1, resposta direta no conteúdo, FAQ visível e CTA.
   - Schema via template: `FAQPage`, `HowTo`, `Product`.
   - Copywriting aplicado:
     - promessa específica de resultado operacional (menos improviso e mais previsibilidade),
     - linguagem de benefício + prova de processo,
     - CTA objetivo com redução de objeção,
     - alerta explícito sobre risco de perder comissão com link de afiliado errado,
     - sem prometer integração não aprovada.

2. Sitemap atualizado
   - Inclusão da nova rota em `dashboard/app/sitemap.js`.

## URLs/rotas novas

- `http://espelhagrupos.com.br/bot-ofertas-autopecas-whatsapp`

## Keywords trabalhadas

- `bot ofertas autopecas whatsapp`
- `como centralizar links de oferta para grupos` (apoio semântico)
- `como automatizar divulgacao em grupos whatsapp` (apoio semântico)

## Links internos adicionados

- Interlinking estrutural do `LpTemplate` para rotas centrais e CTA da Lista VIP.

## Checklist de indexação

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-autopecas-whatsapp` em staging.
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-autopecas-whatsapp` no Google Search Console após aprovação em staging e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Pacote social gerado (incremental)

- LinkedIn: “Autopeças em grupos: primeiro confira link monetizado e condição comercial, depois escale com cadência.”
- Instagram: “Menos copia-e-cola, mais processo: oferta válida + tag de afiliado ativa + CTA claro.”
- URL sugerida com UTM:
  `http://espelhagrupos.com.br/bot-ofertas-autopecas-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-wabot&utm_content=case-operacao`

## Validações locais

- Mudanças limitadas a rota pública, copy/SEO em `LP_CONFIG`, sitemap e docs.
- Sem alterações em API, autenticação, schema de banco, `.env`, portas, Prisma, PM2 ou scripts de deploy.

## Validações esperadas em staging 3006

- Abrir `http://178.105.54.0:3006/bot-ofertas-autopecas-whatsapp` e validar:
  - status 200,
  - H1 e FAQ visíveis,
  - CTA renderizado,
  - copy comercial e claims coerentes.
- Confirmar presença da rota em `http://178.105.54.0:3006/sitemap.xml`.

## Ações executadas automaticamente pela IA

- Criação da nova rota de LP de autopeças.
- Inclusão de configuração de copywriting/SEO no `LP_CONFIG`.
- Atualização do sitemap.
- Criação do relatório do novo dia da sprint.

## AÇÕES HUMANAS pendentes

- [ ] Revisar e aprovar o PR contra `develop`.
- [ ] Validar as páginas novas em `http://178.105.54.0:3006`.
- [ ] Conferir visual, copy, CTAs e claims comerciais.
- [ ] Inspecionar cada URL nova no Google Search Console.
- [ ] Solicitar indexação das URLs aprovadas no Google Search Console.
- [ ] Publicar/agendar posts sociais aprovados.
- [ ] Aprovar ou corrigir claims comerciais sensíveis.
- [ ] Só considerar produção depois de staging aprovado.
