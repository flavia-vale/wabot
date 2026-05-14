# Dia 9 — Produção IA de LPs (Lote 2) — wabot

Data: 2026-05-13
Owner: Growth/SEO

## Plano recuperado antes da produção
- **Oferta principal:** trial guiado de 7 dias do wabot.
- **CTA padrão das LPs programáticas:** Entrar na Lista VIP.
- **Mensagem central:** espelhar grupos com consistência, escalar operação e reduzir trabalho manual.
- **Template usado:** Template A — LP por Cidade, conforme arquitetura de SEO programático.
- **Schema obrigatório mantido:** `FAQPage`, `HowTo` e `Product`.
- **Critério de priorização:** sequência do backlog `seo_backlog_50_keywords.csv`, continuando as prioridades 6 a 15.

## Análise de risco (STRICT)
- **Erros fatais:** baixo risco; páginas estáticas reutilizam o template compartilhado das LPs existentes e são validadas por build/lint.
- **Breaking changes:** inexistentes; sem alteração de API, schema de banco, contratos externos ou props públicas dos componentes.
- **Efeito cascata:** controlado; a mudança adiciona novas entradas em `LP_CONFIG`, rotas estáticas e sitemap sem alterar fluxo de autenticação ou dashboard.
- **Isolamento de ambiente:** nenhuma alteração em `.env`, banco, portas, PM2 ou produção; validação prevista via branch → `develop` → staging `http://178.105.54.0:3006`.
- **Bloqueio:** não aplicável; não há risco fatal identificado.

---

## Objetivo
Continuar a estratégia de SEO programático com mais 10 páginas de cidade, mantendo o padrão do lote 1: headline por keyword, bloco de dor/benefícios/fluxo, CTA de Lista VIP e JSON-LD completo.

## LPs priorizadas do lote 2
1. Recife (cidade)
2. Salvador (cidade)
3. Fortaleza (cidade)
4. Brasília (cidade)
5. Goiânia (cidade)
6. Campinas (cidade)
7. Manaus (cidade)
8. Belém (cidade)
9. Florianópolis (cidade)
10. Vitória (cidade)

## Padrão aplicado em todas as 10 LPs
- Headline e metadata com keyword alvo de cidade.
- Seção única contextualizada por cidade com dor, benefício e bullets operacionais.
- Bloco de FAQ específico por cidade.
- CTA principal: **Entrar na Lista VIP**.
- JSON-LD embutido com `FAQPage`, `HowTo` e `Product` pelo template compartilhado.
- Inclusão no sitemap runtime e no script de validação de schema.

## Solicitação de indexação (Search Console)
Checklist operacional pós-publicação:
- [x] URLs geradas e validadas no código
- [x] sitemap de lote preparado (`docs/marketing/lps_lote2/sitemap_lote2.xml`)
- [x] lista para inspeção de URL preparada (`docs/marketing/lps_lote2/indexacao_search_console_checklist.md`)
- [x] status documentado como "pronto para envio"

> Observação: a submissão efetiva no Search Console depende de acesso da conta proprietária do domínio.
