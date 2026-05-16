# AI SEO — Checklist de validação em Staging (itens 3, 4 e 5)

Data: 2026-05-16
Branch alvo de merge: `develop`
Ambiente de validação: `~/wabot-staging` (`http://178.105.54.0:3006`)

## Objetivo

Garantir que ajustes de AI SEO entrem em produção somente após validação em staging, com foco em:

1. Last-Modified consistente no sitemap.
2. JSON-LD global renderizado no HTML.
3. Regras de indexação alinhadas com sitemap/robots.

## Passo a passo de validação (staging)

```bash
cd ~/wabot-staging \
  && git pull origin develop \
  && npm install \
  && cd dashboard \
  && npm install \
  && cd .. \
  && npx prisma migrate deploy \
  && pm2 restart api-staging visual-staging
```

## Checks técnicos obrigatórios

1. **Sitemap sem rota bloqueada**
   - Abrir: `http://178.105.54.0:3006/sitemap.xml`
   - Confirmar que `/promo-vip-7dias` não aparece.

2. **JSON-LD global presente na home**
   - Abrir `view-source:http://178.105.54.0:3006/`
   - Confirmar blocos `application/ld+json` com `Organization` e `SoftwareApplication`.

3. **Last-Modified coerente com editorial-content**
   - Conferir no sitemap as rotas de conteúdo principais (`/blog/...`, `/materiais/...`).
   - Verificar se datas refletem `updatedAt` de `dashboard/lib/editorial-content.js`.

4. **Robots x Sitemap sem contradição**
   - `http://178.105.54.0:3006/robots.txt` e `sitemap.xml` devem estar coerentes.

5. **Smoke funcional da aplicação**
   - Home, `/conteudos`, uma página de blog e uma página de materiais carregando sem erro.

## Critério de aprovação para produção

- Se qualquer check acima falhar, corrigir em `develop` e repetir validação.
- Somente após aprovação completa em `3006`, abrir PR `develop -> main`.
