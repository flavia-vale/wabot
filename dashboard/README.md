# Dashboard - Deploy & operação segura

## Estado atual da rota raiz

A rota raiz `/` foi removida do App Router do dashboard.
Atualmente, o acesso principal ocorre pelas rotas existentes como `/login` e `/dashboard`.

## Impacto operacional

- Não existe mais homepage estática em `dashboard/public/index.html`.
- Não existe mais cadeia de scripts JSX em `dashboard/public/src/*`.
- Não existe mais dependência de React/ReactDOM/Babel via CDN para a antiga homepage.

## Pré-check obrigatório antes de restart (produção)

Execute **antes** de qualquer `pm2 restart`:

1. Validar build do dashboard (`npm run build`) sem erros.
2. Validar abertura das rotas principais:
   - `/login`
   - `/dashboard`
3. Validar autenticação e redirecionamentos internos após login.
4. Revisar logs do PM2 para erros 404/500 nas rotas do App Router.
