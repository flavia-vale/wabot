# Sprint orgânica IA — Semana 2026-05-19

> Observação operacional: a data atual do ambiente é 2026-05-15, mas já existiam relatórios sequenciais até `SEMANA_2026-05-18_ORGANICO_IA.md`. Este arquivo continua o próximo dia da sequência sem alterar produção.

## O que já existia antes

- Backlog SEO com 50 keywords em `docs/marketing/seo_backlog_50_keywords.csv`.
- Taxonomia UTM padrão em `docs/marketing/utm_taxonomia_padrao.csv`.
- Relatórios orgânicos existentes para 2026-05-14, 2026-05-15, 2026-05-16, 2026-05-17 e 2026-05-18.
- Checklist de indexação em `docs/marketing/ORGANICO_SPRINT1_INDEXACAO_CHECKLIST.md`.
- LPs públicas já criadas para cidades, dores e nichos como supermercado, farmácia, eletrônicos, moda, beleza, pet shop, turismo, autopeças, cursos, afiliados e infoprodutos.
- Páginas de conteúdo já publicadas em `/conteudos`, `/blog/conferir-converter-link-afiliado-whatsapp`, `/blog/bot-para-afiliados-whatsapp-grupos-cupons` e materiais relacionados.
- Observação: `.agents/product-marketing.md` e `docs/marketing/PLANO_MARKETING_ORGANICO_EXECUTAVEL_IA.md` não existem neste checkout local; a continuação usou os arquivos de marketing disponíveis e os relatórios já versionados.

## O que foi continuado

- Continuação do lote de nichos pendentes do backlog, priorizando:
  - `bot ofertas restaurantes whatsapp`;
  - `bot ofertas marketplace whatsapp`.
- Manutenção do cluster de automação/espelhamento/distribuição em grupos com a página de restaurantes.
- Manutenção do cluster de afiliados/conversão de links monetizados com a página de marketplace.
- Interlinking para conteúdos existentes de afiliados, padronização, automação, calendário e checklists.

## O que foi criado agora

1. Nova LP pública indexável: `/bot-ofertas-restaurantes-whatsapp`
   - Keyword principal: `bot ofertas restaurantes whatsapp`.
   - SEO on-page: title, description, canonical, H1, resposta direta no início e CTA.
   - FAQ visível na página.
   - Schema: `Article`, `FAQPage` e `BreadcrumbList` coerentes com o conteúdo visível.
   - Foco: calendário de ofertas para restaurantes, segmentação por grupos, cadência e automação responsável.

2. Nova LP pública indexável: `/bot-ofertas-marketplace-whatsapp`
   - Keyword principal: `bot ofertas marketplace whatsapp`.
   - SEO on-page: title, description, canonical, H1, resposta direta no início e CTA.
   - FAQ visível na página.
   - Schema: `Article`, `FAQPage` e `BreadcrumbList` coerentes com o conteúdo visível.
   - Foco obrigatório de afiliados:
     - conversão/conferência de link de afiliado antes da distribuição;
     - link monetizado, tag ou código de afiliado preservado após redirecionamentos;
     - risco de perder comissão por link copiado errado, encurtado errado ou sem tag;
     - sem promessa de integração oficial não aprovada com Amazon, Mercado Livre, Shopee ou qualquer marketplace.

3. Hub de conteúdo atualizado
   - `/conteudos` ganhou uma seção de páginas por nicho com links para restaurantes e marketplace.

4. Sitemap atualizado
   - Inclusão de `/bot-ofertas-restaurantes-whatsapp` e `/bot-ofertas-marketplace-whatsapp` em `dashboard/app/sitemap.js`.

5. Checklist de indexação atualizado
   - Inclusão do incremento sequencial 2026-05-19 em `docs/marketing/ORGANICO_SPRINT1_INDEXACAO_CHECKLIST.md`.

## URLs/rotas novas

- `http://espelhagrupos.com.br/bot-ofertas-restaurantes-whatsapp`
- `http://espelhagrupos.com.br/bot-ofertas-marketplace-whatsapp`

## Keywords trabalhadas

- `bot ofertas restaurantes whatsapp`
- `bot ofertas marketplace whatsapp`
- `como automatizar divulgacao em grupos whatsapp` (apoio semântico)
- `como organizar calendario de ofertas no whatsapp` (apoio semântico)
- `como padronizar divulgacao de afiliado no whatsapp` (apoio semântico)
- `converter link de afiliado whatsapp` (apoio semântico)
- `link monetizado afiliado marketplace` (apoio semântico)

## Links internos adicionados

### Em `/bot-ofertas-restaurantes-whatsapp`

- `/automatizar-divulgacao-em-grupos-whatsapp`
- `/organizar-calendario-de-ofertas-no-whatsapp`
- `/melhorar-alcance-em-grupos-de-promocoes`
- `/conteudos`

### Em `/bot-ofertas-marketplace-whatsapp`

- `/bot-ofertas-afiliados-whatsapp`
- `/blog/conferir-converter-link-afiliado-whatsapp`
- `/padronizar-divulgacao-afiliado-whatsapp`
- `/materiais/checklist-divulgacao-ofertas-grupos-whatsapp`

### Em `/conteudos`

- `/bot-ofertas-restaurantes-whatsapp`
- `/bot-ofertas-marketplace-whatsapp`

## Checklist de indexação

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-restaurantes-whatsapp` em staging.
- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-marketplace-whatsapp` em staging.
- [ ] Confirmar presença das duas rotas em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-restaurantes-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-marketplace-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação das URLs aprovadas no Google Search Console.

## Pacote social gerado

### LinkedIn — Restaurantes

Restaurante não precisa depender de lembrete manual para divulgar combo, cupom e promoção de horário fraco. Primeiro valide oferta, preço, região e regra do pedido. Depois automatize a distribuição em grupos com cadência.

URL sugerida:
`http://espelhagrupos.com.br/bot-ofertas-restaurantes-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-wabot&utm_content=nicho-restaurantes`

### Instagram — Restaurantes

Promo de restaurante sem processo vira esquecimento. Oferta validada + grupo certo + cadência = rotina de divulgação melhor.

### LinkedIn — Marketplace/afiliados

Marketplace exige velocidade, mas afiliado não pode pular conferência. Link monetizado, tag, preço e estoque vêm antes da automação em grupos. O risco de um link errado é simples: tráfego sem comissão.

URL sugerida:
`http://espelhagrupos.com.br/bot-ofertas-marketplace-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-wabot&utm_content=nicho-marketplace`

### Instagram — Marketplace/afiliados

Link sem tag = risco de comissão perdida. Confere primeiro. Automatiza depois.

## Validações locais

- Alterações limitadas a páginas públicas, hub de conteúdo, sitemap e docs de marketing.
- Sem mudanças em API, banco, autenticação, `.env`, portas, Prisma, PM2, scripts de deploy ou produção.
- Checks locais aplicáveis foram executados na branch de trabalho e devem ser complementados por validação visual em staging.

## Validações esperadas em staging 3006

- Abrir `http://178.105.54.0:3006/bot-ofertas-restaurantes-whatsapp` e validar status 200, H1, resposta direta, CTA, FAQ visível e links internos.
- Abrir `http://178.105.54.0:3006/bot-ofertas-marketplace-whatsapp` e validar status 200, H1, resposta direta, CTA, FAQ visível, bloco de risco de afiliado e links internos.
- Abrir `http://178.105.54.0:3006/conteudos` e confirmar a seção “Páginas por nicho”.
- Abrir `http://178.105.54.0:3006/sitemap.xml` e confirmar as duas rotas novas.
- Conferir visual mobile e desktop.
- Conferir claims comerciais sensíveis antes de publicar posts sociais.

## Ações executadas automaticamente pela IA

- Leitura dos insumos disponíveis de marketing, sitemap e páginas públicas.
- Identificação dos próximos ativos pendentes do backlog sem duplicar URLs já existentes.
- Criação das duas rotas públicas indexáveis.
- Criação de componente compartilhado apenas para estas LPs orgânicas novas.
- Atualização do hub `/conteudos` para reforçar interlinking.
- Atualização do sitemap.
- Atualização do checklist de indexação.
- Criação deste relatório de continuidade.

## AÇÕES HUMANAS pendentes

- [ ] Revisar e aprovar o PR contra `develop`.
- [ ] Validar as páginas novas em `http://178.105.54.0:3006`.
- [ ] Conferir visual, copy, CTAs e claims comerciais.
- [ ] Inspecionar cada URL nova no Google Search Console.
- [ ] Solicitar indexação das URLs aprovadas no Google Search Console.
- [ ] Publicar/agendar posts sociais aprovados.
- [ ] Aprovar ou corrigir claims comerciais sensíveis.
- [ ] Só considerar produção depois de staging aprovado.
