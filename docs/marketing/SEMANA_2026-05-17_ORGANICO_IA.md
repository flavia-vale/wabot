# Sprint orgânica IA — Semana 2026-05-17

## O que já existia antes

- LPs de nicho já criadas: afiliados, pet shop, turismo e autopeças.
- Checklist incremental de indexação ativo com tarefas para staging 3006 e Search Console.

## O que foi continuado

- Continuação do plano com o próximo ativo pendente do backlog de nicho: `bot ofertas cursos whatsapp`.
- Manutenção dos dois pilares estratégicos:
  - afiliados/conversão (conferência de link monetizado);
  - automação/espelhamento/distribuição em grupos WhatsApp.

## O que foi criado agora

1. Nova LP pública indexável: `/bot-ofertas-cursos-whatsapp`
   - Keyword principal: `bot ofertas cursos whatsapp`.
   - SEO on-page via `LpTemplate`: title, description, canonical, H1, FAQ visível e CTA.
   - Schema via template: `FAQPage`, `HowTo`, `Product`.
   - Copywriting aplicado:
     - resposta direta no início,
     - foco em benefício e transformação,
     - risco explícito de perder comissão por link de afiliado incorreto,
     - sem prometer integração não aprovada.

2. Sitemap atualizado
   - Inclusão da nova rota em `dashboard/app/sitemap.js`.

## URLs/rotas novas

- `http://espelhagrupos.com.br/bot-ofertas-cursos-whatsapp`

## Keywords trabalhadas

- `bot ofertas cursos whatsapp`
- `como estruturar funil de afiliados em grupos` (apoio semântico)
- `como automatizar divulgacao em grupos whatsapp` (apoio semântico)

## Links internos adicionados

- Interlinking estrutural herdado do `LpTemplate` para rotas centrais e CTA da Lista VIP.

## Checklist de indexação

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-cursos-whatsapp` em staging.
- [ ] Confirmar presença em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar `http://espelhagrupos.com.br/bot-ofertas-cursos-whatsapp` no Google Search Console após aprovação em staging e deploy de produção.
- [ ] Solicitar indexação da URL nova após inspeção.

## Pacote social gerado (incremental)

- LinkedIn: “Curso bom converte mais quando o link monetizado está certo e a copy fala de transformação real.”
- Instagram: “Antes de escalar em grupos: promessa clara, prazo real e tag de afiliado ativa.”
- URL sugerida com UTM:
  `http://espelhagrupos.com.br/bot-ofertas-cursos-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-botinho&utm_content=case-operacao`

## Validações locais

- Alterações limitadas a rota pública, conteúdo SEO/copy em `LP_CONFIG`, sitemap e docs.
- Sem alterações em API, auth, schema DB, `.env`, portas, Prisma, PM2 ou deploy scripts.

## Validações esperadas em staging 3006

- Abrir `http://178.105.54.0:3006/bot-ofertas-cursos-whatsapp` e validar status 200, H1, FAQ e CTA.
- Confirmar presença da rota no `sitemap.xml`.

## Ações executadas automaticamente pela IA

- Criação da rota pública de cursos.
- Inclusão da configuração de copywriting/SEO no `LP_CONFIG`.
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
