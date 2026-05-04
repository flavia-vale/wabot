# Dashboard (Home estática via `public/index.html`)

Este projeto contém o dashboard em Next.js, mas **a edição da home pública deve seguir o fluxo oficial via `public/index.html`**.

## Fluxo oficial para editar a Home

> **Não usar `app/page.js` para a home pública.**

1. Edite `public/index.html`.
2. Revise referências de assets (`/public/...`) e links absolutos/relativos.
3. Valide localmente com build de produção.
4. Publique e execute smoke test mínimo pós-deploy.

## Dependências externas (CDNs)

Se `public/index.html` usar bibliotecas externas (CSS/JS/fontes) por CDN:

- Documente cada dependência (nome, versão e URL).
- Prefira versões fixas (evitar `latest`).
- Garanta fallback ou plano de contingência para indisponibilidade da CDN.
- Avalie impacto de CSP, SRI (`integrity`) e `crossorigin` quando aplicável.

## Checklist de publicação (Home)

Antes de publicar:

- [ ] Alterações da home feitas em `public/index.html`.
- [ ] Assets referenciados existem e carregam sem erro.
- [ ] Dependências CDN revisadas (versão fixa e disponibilidade).
- [ ] Build de produção concluído com sucesso.
- [ ] Sem erros críticos no console do navegador.

## Smoke test mínimo pós-deploy (Home)

Após deploy, validar no domínio publicado:

1. `GET /` retorna `200`.
2. HTML final contém as seções esperadas da home.
3. CSS principal carrega sem `404`.
4. JS principal carrega sem `404`.
5. Abrir em aba anônima e confirmar renderização inicial sem erro crítico no console.

Exemplo rápido com `curl`:

```bash
curl -I https://SEU_DOMINIO/
curl -s https://SEU_DOMINIO/ | head -n 40
```
