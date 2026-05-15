# Sprint orgânica IA — Semana 2026-05-18

## O que já existia antes

- LPs de nicho criadas no ciclo anterior: afiliados, pet shop, turismo, autopeças e cursos.
- Checklists de indexação em andamento para validação em staging (3006) e inspeção no Search Console.

## O que foi continuado

- Próximo ativo pendente do backlog de nicho: `bot ofertas infoprodutos whatsapp`.
- Continuidade dos clusters estratégicos:
  - afiliados/conversão de link monetizado;
  - automação/espelhamento/distribuição em grupos.

## O que foi criado agora

1. Nova LP pública indexável: `/bot-ofertas-infoprodutos-whatsapp`
   - Keyword principal: `bot ofertas infoprodutos whatsapp`.
   - SEO on-page via `LpTemplate`: title, description, canonical, H1, FAQ visível e CTA.
   - Schema via template: `FAQPage`, `HowTo`, `Product`.
   - Copywriting aplicado com:
     - resposta direta de operação,
     - benefício comercial + transformação,
     - risco explícito de comissão por link de afiliado errado,
     - sem prometer integração não aprovada.

2. Sitemap atualizado
   - Inclusão da nova rota em `dashboard/app/sitemap.js`.

## URLs/rotas novas

- `http://espelhagrupos.com.br/bot-ofertas-infoprodutos-whatsapp`

## Keywords trabalhadas

- `bot ofertas infoprodutos whatsapp`
- `como estruturar funil de afiliados em grupos` (apoio semântico)
- `como automatizar divulgacao em grupos whatsapp` (apoio semântico)

## Links internos adicionados

- Interlinking estrutural herdado do `LpTemplate` para páginas centrais e CTA da Lista VIP.

## Checklist de indexação

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-infoprodutos-whatsapp` em staging.
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-infoprodutos-whatsapp` no Google Search Console após staging aprovado e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Pacote social gerado (incremental)

- LinkedIn: “Infoproduto converte melhor quando promessa, prova e link monetizado estão alinhados antes da escala.”
- Instagram: “Sem link certo, não tem comissão. Sem copy clara, não tem clique.”
- URL sugerida com UTM:
  `http://espelhagrupos.com.br/bot-ofertas-infoprodutos-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-botinho&utm_content=case-operacao`

## Validações locais

- Alterações limitadas a rota pública, copy/SEO no `LP_CONFIG`, sitemap e docs.
- Sem mudanças em API, banco, auth, `.env`, portas, Prisma, PM2 ou scripts de deploy.

## Validações esperadas em staging 3006

- Abrir `http://178.105.54.0:3006/bot-ofertas-infoprodutos-whatsapp` e validar status 200, H1, FAQ e CTA.
- Confirmar presença da rota no `sitemap.xml`.

## Ações executadas automaticamente pela IA

- Criação da nova rota pública de infoprodutos.
- Inclusão de configuração de SEO/copy no `LP_CONFIG`.
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
