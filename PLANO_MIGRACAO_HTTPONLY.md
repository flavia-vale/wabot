# Plano de migração: localStorage -> cookie HttpOnly (INFRA-AUTH-STORAGE-005)

## Objetivo
Eliminar armazenamento de JWT de autenticação em `localStorage` e adotar sessão via cookie `HttpOnly` + `Secure` + `SameSite`.

## Status aplicado
- Backend autentica sessões do dashboard exclusivamente pelo cookie `wb_auth`.
- Login e registro emitem cookie `HttpOnly` e não retornam mais o JWT no corpo da resposta.
- Frontend envia cookies com `credentials: 'include'` em todas as chamadas da API.
- Guarda de rota do dashboard valida sessão via `/api/auth/me`, sem consultar token em `localStorage`.
- Logout chama `/api/auth/logout`, que limpa o cookie de sessão.
- WebSocket de QR usa ticket efêmero (`/api/session/qr-ticket`) com expiração curta, sem reutilizar o JWT de sessão.

## Configuração operacional
- Em produção HTTPS, manter `COOKIE_SECURE=true` (padrão).
- Em ambiente temporário sem HTTPS, usar `COOKIE_SECURE=false` apenas como exceção controlada, pois isso reduz a proteção do cookie.
- Manter `CORS_ORIGINS` restrito às origens reais do dashboard/API.

## Validação pós-deploy
- Realizar login e confirmar que não há token de autenticação em `localStorage`.
- Confirmar que a resposta de login contém `Set-Cookie: wb_auth=...; HttpOnly`.
- Abrir o dashboard e validar que `/api/auth/me` retorna 200 usando cookie.
- Iniciar QR e confirmar que o WebSocket usa `/api/session/qr` sem token na URL.
- Executar logout e confirmar que `/api/auth/me` passa a retornar 401.

## Rollback
- Restaurar temporariamente emissão/uso de Bearer token no frontend e no middleware se o proxy bloquear cookies.
- Manter `COOKIE_SECURE=false` somente em ambiente sem TLS enquanto HTTPS não estiver disponível.
