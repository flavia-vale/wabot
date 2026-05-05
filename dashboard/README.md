# Dashboard - Deploy & operação segura

## Arquitetura atual

O dashboard é uma aplicação Next.js localizada em `dashboard/app` e executada pelos scripts de `dashboard/package.json`.

- Desenvolvimento local: `npm run dev`
- Build de produção: `npm run build`
- Execução de produção: `npm run start`
- Lint: `npm run lint`

## Arquivos estáticos

A antiga homepage estática em `dashboard/public/` foi removida porque não é usada em produção. Com isso, a aplicação deixa de servir rotas legadas como `/Landing.html`, `/src/*.jsx` e `/tweaks-panel.jsx` pelo Next.js.

Para novos assets públicos do dashboard, recrie `dashboard/public/` somente com arquivos realmente referenciados pela aplicação Next, como imagens, `robots.txt` ou outros assets estáticos necessários.

## Pré-check obrigatório antes de restart em produção

Execute antes de reiniciar o processo `dashboard` no PM2:

1. Validar dependências do dashboard com `npm install` ou `npm ci`, conforme o fluxo de deploy usado.
2. Rodar `npm run lint` dentro de `dashboard/`.
3. Rodar `npm run build` dentro de `dashboard/`.
4. Reiniciar o processo PM2 somente após lint e build passarem.
5. Validar login e navegação principal do dashboard após o restart.
