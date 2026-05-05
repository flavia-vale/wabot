# Dashboard - Deploy & operação segura

## Estado atual da rota principal

A rota raiz (`/`) do dashboard não serve mais uma homepage/landing page estática. Ela redireciona imediatamente para `/dashboard` pelo App Router do Next.js.

Os arquivos legados de landing/index foram removidos para permitir recriação futura do zero, sem dependências antigas de CDN, Babel no navegador ou componentes estáticos de marketing.

## Pré-check obrigatório antes de restart (produção)

Execute **antes** de qualquer `pm2 restart`:

1. Validar build do dashboard:
   - `cd /home/deploy/wabot/dashboard && npm run build`
2. Validar sintaxe do backend:
   - `cd /home/deploy/wabot && node --check src/api/server.js`
3. Confirmar que `/` redireciona para `/dashboard` após o restart.
4. Confirmar saúde dos processos PM2 (`api` e `dashboard`).
