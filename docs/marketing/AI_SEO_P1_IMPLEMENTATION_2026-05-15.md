# Implementação AI SEO P1 — BOTinho — 2026-05-15

## Resultado entregue

Este documento registra a implementação do backlog P1 da auditoria `docs/marketing/AI_SEO_AUDIT_2026-05-15.md`.

| Item P1 | Status | Entrega |
|---|---:|---|
| Adicionar `SoftwareApplication`/`Organization` schema global | Feito | Schema global injetado no layout raiz com dados canônicos de marca, produto, suporte, logo e planos. |
| Criar página de metodologia/compliance de automação em WhatsApp | Feito | Nova rota `/metodologia-uso-responsavel-whatsapp` com resposta direta, limites do produto, princípios, checklist, FAQ e schema `TechArticle` + `HowTo` + `FAQPage`. |
| Padronizar posts com resposta direta, data visível, autor e FAQ | Feito | Conteúdos editoriais públicos agora usam autor editorial, datas publicadas/atualizadas, blocos de resposta direta e FAQ quando aplicável. |
| Melhorar sitemap com datas reais por conteúdo | Feito | Sitemap usa datas por rota editorial em vez de um único `lastModified` fixo para todos os conteúdos. |
| Criar planilha de monitoramento de 20 queries AI SEO | Feito | CSV `docs/marketing/ai_visibility_tracking.csv` criado com 20 linhas para Google AI Overviews, ChatGPT Search e Perplexity. |

## Rotas/arquivos públicos impactados

- `/metodologia-uso-responsavel-whatsapp`
- `/conteudos`
- `/sitemap.xml`
- `/llms.txt`
- Artigos em `/blog/*` do cluster editorial atual
- Materiais em `/materiais/*` do cluster editorial atual

## Como validar em staging

Após merge em `develop`, validar na porta `3006`:

1. Abrir `http://178.105.54.0:3006/metodologia-uso-responsavel-whatsapp` e conferir renderização, FAQ e links internos.
2. Abrir `http://178.105.54.0:3006/conteudos` e conferir a seção “Metodologia e uso responsável”.
3. Abrir `http://178.105.54.0:3006/sitemap.xml` e conferir `lastmod` variando por conteúdo.
4. Inspecionar o HTML da home e confirmar scripts JSON-LD globais para `Organization` e `SoftwareApplication`.
5. Atualizar `docs/marketing/ai_visibility_tracking.csv` após indexação e primeiras consultas em ferramentas de IA.
