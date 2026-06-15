# Remoção definitiva das rotas `/dashboard` e `/m`

## Decisão

As antigas árvores de aplicação `/dashboard` e `/m` foram aposentadas definitivamente. Elas não devem renderizar páginas nem redirecionar usuários para `/painel`; a única árvore de produto suportada é `/painel`.

## Alterações

- removido o middleware que convertia URLs legadas para `/painel`;
- removidos o mapa e o detector de variantes de UI;
- removidos scripts de teste/smoke exclusivos da árvore `/m`;
- removido o redirect explícito de `/dashboard/` no Next.js;
- removidas regras de headers e robots específicas das páginas `/dashboard`;
- atualizado o smoke de produção para validar `/painel` em vez de `/dashboard`;
- atualizado o handoff do conversor para `/painel/criar-oferta`;
- removidas referências de navegação e comentários que indicavam compatibilidade com as árvores aposentadas;
- adicionado teste de regressão que impede a restauração das árvores, middleware ou redirects.

## Escopo preservado

Endpoints sob `/api/dashboard/*` continuam válidos: eles pertencem à API e não à antiga árvore de páginas `/dashboard`.
