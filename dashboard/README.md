# Dashboard - Deploy & operação segura

## Mapa atual de política de segurança

### 1) CSP da homepage estática
A homepage (`dashboard/public/index.html`) usa CSP via `<meta http-equiv="Content-Security-Policy">` com as diretivas:
- `default-src 'self'`
- `script-src 'self' https://unpkg.com`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `font-src 'self' https://fonts.gstatic.com data:`
- `img-src 'self' data: https:`
- `connect-src 'self'`
- `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`

### 2) Dependências externas críticas
A homepage depende de CDN para:
- React 18.3.1
- ReactDOM 18.3.1
- Babel Standalone 7.29.0

Foi implementado fallback local para `/public/vendor/*` quando a CDN falha.

### 3) Firewall / egress na VPS Hetzner
Risco operacional: se firewall local (UFW/iptables/nftables), cloud firewall da Hetzner, proxy corporativo ou ACL de saída bloquear `unpkg.com`, a homepage pode degradar.

## Pré-check obrigatório antes de restart (produção)

Execute **antes** de qualquer `pm2 restart`:

1. Confirmar arquivos fallback locais:
   - `/home/deploy/wabot/public/vendor/react.development.js`
   - `/home/deploy/wabot/public/vendor/react-dom.development.js`
   - `/home/deploy/wabot/public/vendor/babel.min.js`
2. Validar saída HTTPS para CDN (ou confirmar que fallback local está populado e atualizado).
3. Validar CSP efetiva da homepage sem violações no console.
4. Testar homepage em cenário online e com bloqueio parcial de egress.

Se algum check falhar, **não reiniciar** o `dashboard` até corrigir.
