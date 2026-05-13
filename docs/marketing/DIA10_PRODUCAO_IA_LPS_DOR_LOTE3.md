# Dia 10 — Produção IA de LPs de Dor (Lote 3) — wabot

Data: 2026-05-13
Owner: Growth/SEO

## Plano recuperado antes da produção
- **Oferta principal:** trial guiado de 7 dias do wabot.
- **CTA padrão:** Entrar na Lista VIP.
- **Mensagem central:** espelhar grupos com consistência, escalar operação e reduzir trabalho manual.
- **Template usado:** Template C — LP por Dor, conforme arquitetura de SEO programático.
- **Seções obrigatórias do template:** diagnóstico da dor, solução com wabot, métricas esperadas, FAQ e CTA de onboarding.
- **Schema recomendado do template:** `FAQPage` + `BreadcrumbList`; mantido também `HowTo` e `Product` para compatibilidade com o validador e o padrão dos lotes anteriores.
- **Critério de priorização:** sequência do backlog `seo_backlog_50_keywords.csv`, usando as prioridades de dor 31 a 40.

## Análise de risco (STRICT)
- **Erros fatais:** baixo risco; páginas estáticas reutilizam o template compartilhado já validado por build/lint.
- **Breaking changes:** inexistentes; sem mudança em API, banco, autenticação, contratos externos ou props obrigatórias dos componentes.
- **Efeito cascata:** controlado; impacto limitado a novas entradas de LP, sitemap, validação de schema e documentação de marketing.
- **Isolamento de ambiente:** nenhuma alteração em `.env`, banco, PM2, portas ou produção; validação final deve ocorrer em staging `http://178.105.54.0:3006` antes de produção.
- **Bloqueio:** não aplicável; não há risco fatal identificado.

---

## Objetivo
Criar 10 LPs de dor para capturar buscas informacionais-comerciais de alta intenção, conectando cada problema operacional ao uso do wabot como solução de automação em grupos.

## LPs priorizadas do lote 3
1. Automatizar divulgação em grupos WhatsApp
2. Escalar grupos de ofertas sem equipe
3. Postar em vários grupos WhatsApp ao mesmo tempo
4. Padronizar divulgação de afiliado no WhatsApp
5. Aumentar conversão em grupos de cupons
6. Manter consistência de postagens em grupos
7. Reduzir tempo operacional em grupos WhatsApp
8. Organizar calendário de ofertas no WhatsApp
9. Melhorar alcance em grupos de promoções
10. Rastrear resultados de divulgação em grupos

## Padrão aplicado em todas as 10 LPs
- Diagnóstico específico da dor.
- Solução prática com wabot.
- Bullets de benefício e métrica esperada.
- FAQ específico da dor.
- Passo a passo operacional (`HowTo`) para ativação.
- CTA principal: **Entrar na Lista VIP**.
- JSON-LD embutido com `FAQPage`, `HowTo`, `Product` e `BreadcrumbList`.

## Solicitação de indexação (Search Console)
Checklist operacional pós-publicação:
- [x] URLs geradas e validadas no código
- [x] sitemap de lote preparado (`docs/marketing/lps_lote3/sitemap_lote3.xml`)
- [x] lista para inspeção de URL preparada (`docs/marketing/lps_lote3/indexacao_search_console_checklist.md`)
- [x] status documentado como "pronto para envio"

> Observação: a submissão efetiva no Search Console depende de acesso da conta proprietária do domínio.
