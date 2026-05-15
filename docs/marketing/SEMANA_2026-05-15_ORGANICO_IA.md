# Sprint orgânica IA — Semana 2026-05-15

## O que já existia antes

- Sprint de 2026-05-14 com ativos de cluster afiliados/conversão já publicados:
  - `/blog/conferir-converter-link-afiliado-whatsapp`
  - `/blog/bot-para-afiliados-whatsapp-grupos-cupons`
  - `/materiais/checklist-divulgacao-ofertas-grupos-whatsapp`
  - `/bot-ofertas-afiliados-whatsapp`
- Sitemap e checklist de indexação já iniciados para o sprint orgânico.

## O que foi continuado

- Continuidade do plano para o próximo dia com ativo pendente do backlog de nicho: `bot ofertas pet shop whatsapp`.
- Manutenção do eixo automação/espelhamento/distribuição em grupos no conteúdo, sem substituir o cluster de afiliados.

## O que foi criado agora

1. Nova LP pública indexável: `/bot-ofertas-pet-shop-whatsapp`
   - Keyword principal: `bot ofertas pet shop whatsapp`.
   - SEO on-page via `LpTemplate`: title, description, canonical, H1, FAQ visível e CTA.
   - Schema já aplicado no template (`FAQPage`, `HowTo`, `Product`).
   - Copy reforça: conferência de link monetizado/tag/código de afiliado, risco de perda de comissão por link errado, e sem promessa de integração não aprovada.

2. Sitemap atualizado
   - Inclusão da rota nova em `dashboard/app/sitemap.js`.

## URLs/rotas novas

- `http://espelhagrupos.com.br/bot-ofertas-pet-shop-whatsapp`

## Keywords trabalhadas

- `bot ofertas pet shop whatsapp`
- `como automatizar divulgacao em grupos whatsapp` (apoio semântico)
- `como estruturar funil de afiliados em grupos` (apoio semântico)

## Links internos adicionados

- Interlinking herdado do `LpTemplate` para fluxos centrais de navegação e CTA.

## Checklist de indexação

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-pet-shop-whatsapp` em staging.
- [ ] Confirmar presença da URL em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar URL no Google Search Console após aprovação em staging e deploy de produção.
- [ ] Solicitar indexação após inspeção.

## Pacote social gerado (incremental)

- LinkedIn: “No nicho pet, consistência operacional + link monetizado conferido protege comissão e escala distribuição.”
- Instagram: “Antes de escalar oferta pet em grupos: valide estoque, cupom e tag de afiliado. Depois automatize com cadência.”
- URL com UTM sugerida:
  `http://espelhagrupos.com.br/bot-ofertas-pet-shop-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-wabot&utm_content=case-operacao`

## Validações locais

- Adição de rota pública e configuração de conteúdo em arquivo compartilhado de LP.
- Sem alteração em API, auth, schema de banco, portas, Prisma, PM2, `.env` ou scripts de deploy.

## Validações esperadas em staging 3006

- Abrir `http://178.105.54.0:3006/bot-ofertas-pet-shop-whatsapp` e confirmar:
  - status 200,
  - H1 e FAQ visível,
  - CTA renderizado,
  - conteúdo comercial coerente.
- Abrir `http://178.105.54.0:3006/sitemap.xml` e confirmar presença da rota nova.

## Ações executadas automaticamente pela IA

- Criação da rota pública `bot-ofertas-pet-shop-whatsapp`.
- Inclusão da configuração SEO/conteúdo no `LP_CONFIG`.
- Atualização do sitemap.
- Geração do relatório diário de continuidade.

## AÇÕES HUMANAS pendentes

- [ ] Revisar e aprovar o PR contra `develop`.
- [ ] Validar as páginas novas em `http://178.105.54.0:3006`.
- [ ] Conferir visual, copy, CTAs e claims comerciais.
- [ ] Inspecionar cada URL nova no Google Search Console.
- [ ] Solicitar indexação das URLs aprovadas no Google Search Console.
- [ ] Publicar/agendar posts sociais aprovados.
- [ ] Aprovar ou corrigir claims comerciais sensíveis.
- [ ] Só considerar produção depois de staging aprovado.
