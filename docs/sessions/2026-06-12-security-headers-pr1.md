# Documentação da sessão — Security Headers PR1

**Data:** 2026-06-12
**Workflow:** `twin-workflow`
**Qualidade:** pragmatic
**Branch observada:** `work`
**Destino previsto da PR:** `develop`

## Resumo

A PR1 adicionou headers globais de segurança às respostas do dashboard Next.js, mantendo a Content Security Policy exclusivamente em modo de observação (`Content-Security-Policy-Report-Only`). Também foram criados testes de regressão e uma verificação operacional no smoke test de staging.

A mudança não adicionou HSTS ao dashboard. O staging canônico é servido por HTTP (`http://178.105.54.0:3006`), e a decisão aprovada foi manter `Strict-Transport-Security` fora dessa camada e reservá-lo para a borda HTTPS de produção em trabalho posterior.

## Escopo implementado

### Headers globais do dashboard

Foi adicionada uma regra global `/:path*` com:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: SAMEORIGIN`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` conservadora, desabilitando câmera, microfone, geolocalização, browsing topics, Payment Request API, USB, serial e Bluetooth;
- `Content-Security-Policy-Report-Only`.

As regras preexistentes de `X-Robots-Tag: noindex, nofollow` para rotas privadas, de autenticação e de API foram preservadas.

### CSP em Report-Only

A CSP foi introduzida somente no header `Content-Security-Policy-Report-Only`; não foi criado um header `Content-Security-Policy` enforced nesta PR.

A política aprovada e implementada contém:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'self';
form-action 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
connect-src 'self' ws: wss:;
frame-src 'none';
manifest-src 'self';
worker-src 'self' blob:;
upgrade-insecure-requests
```

Decisões e trade-offs:

- `'unsafe-inline'` foi mantido em `script-src` por compatibilidade inicial com scripts inline do Next.js e blocos JSON-LD existentes.
- `'unsafe-inline'` foi mantido em `style-src` por compatibilidade com estilos inline e o runtime atual.
- Google Fonts foi permitido porque o dashboard ainda carrega estilos e fontes desses hosts.
- `img-src` permaneceu amplo para HTTPS, `data:` e `blob:` para evitar quebrar imagens externas já usadas pelo produto.
- `connect-src` inclui `ws:` e `wss:` para cobrir o fluxo de QR por WebSocket em staging e produção.
- `'unsafe-eval'` não foi permitido.
- Nonces, hashes, fontes locais, allowlist estrita de imagens e CSP enforced ficaram fora do escopo desta PR.

### Smoke test de staging

O deploy seguro de staging passou a consultar os headers de `/login`, normalizar CRLF e validar sem sensibilidade a maiúsculas/minúsculas:

- os valores exatos de `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`;
- a presença não vazia de `Permissions-Policy`;
- a presença não vazia de `Content-Security-Policy-Report-Only`.

Após o review, o smoke também passou a falhar se o staging HTTP enviar `Strict-Transport-Security`.

## Arquivos envolvidos

### Modificados durante a implementação

- `dashboard/next.config.mjs` — configuração global dos headers e da CSP Report-Only.
- `scripts/deploy_safe_staging.sh` — smoke operacional dos headers do dashboard e rejeição de HSTS no staging HTTP.
- `test/deploy-safe-staging.test.js` — proteção estática para garantir que o smoke continue validando os headers e rejeitando HSTS.

### Criado durante a implementação

- `test/dashboard-security-headers.test.js` — teste do contrato global de headers, diretivas da CSP, ausência de CSP enforced/HSTS/`unsafe-eval` e preservação do `X-Robots-Tag`.

### Criados na etapa de documentação

- `docs/sessions/2026-06-12-security-headers-pr1.md` — este registro da sessão.
- `twin-plans/2026-06-12-16-13-plan.md` — reconstrução e arquivamento do plano aprovado, pois `twin-plan-current.md` havia sido removido antes da etapa documental.

## Ciclo developer → reviewer → tester

### 1. Developer

O developer implementou a configuração global, os testes e o smoke de staging no commit:

- `1f84c9d security: add dashboard response headers`

A implementação inicial passou nos testes focados, na suíte completa, no build e na inspeção HTTP local.

### 2. Reviewer

O reviewer não encontrou bloqueadores, mas registrou um achado de baixa severidade: o teste unitário garantia que o Next.js não configurava HSTS, porém o smoke real de staging não rejeitava `Strict-Transport-Security` inserido por outra camada, como proxy ou servidor web.

A recomendação foi verificar a resposta observada em `http://178.105.54.0:3006/login` e falhar se ela contivesse HSTS.

### 3. Correção do achado

O developer corrigiu o achado com um novo commit, sem amend ou reset:

- `28d29cb test: reject HSTS on HTTP staging`

A correção adicionou:

- rejeição case-insensitive de `Strict-Transport-Security` no smoke HTTP de staging;
- asserção estática correspondente em `test/deploy-safe-staging.test.js`.

### 4. Tester / QA final

O tester aprovou a PR1 sem falhas bloqueantes. Foram validadas páginas públicas, login, área privada, 404, fallback do proxy de API e redirects da aplicação. Como Playwright MCP não estava disponível, o QA usou um build de produção real do Next.js e inspeções com `curl`.

Não houve alteração visual, portanto não foi necessária captura de screenshot.

## Resultados de testes e validações

- Testes relacionados à PR1: **3/3 aprovados**.
- Suíte completa: **927/927 testes aprovados**.
- Lint do dashboard: concluído sem erros e com **1 warning preexistente** de `@next/next/no-img-element` em `dashboard/app/painel/WhatsAppBubble.js`.
- Build do dashboard: concluído com sucesso no Next.js 16.2.4, com **122 páginas** geradas.
- Sintaxe do shell: `scripts/deploy_safe_staging.sh` aprovado por `bash -n`.
- Inspeções HTTP com `curl`: confirmaram os cinco headers na home, login, área privada, 404, proxy e redirects tratados pela aplicação.
- As inspeções também confirmaram:
  - ausência de CSP enforced;
  - ausência de HSTS nas respostas HTTP locais;
  - preservação de `X-Robots-Tag` onde configurado;
  - CSP sem `'unsafe-eval'`.

## Achado de QA não bloqueante

### Redirects automáticos 308 de normalização de barra final sem headers

O QA observou que redirects automáticos do Next.js, como:

- `/dashboard/` → `/dashboard`;
- `/m/` → `/m`;

respondem com `308 Permanent Redirect`, mas não carregam os cinco headers globais desta PR.

Classificação: **baixa severidade / não bloqueante**.

Justificativa:

- são respostas curtas de redirect, sem documento executável relevante;
- os destinos normalizados recebem os headers normalmente;
- páginas HTML, respostas 404, proxy e redirects produzidos pela aplicação foram protegidos;
- a cobertura total desses redirects pode ser feita futuramente na borda HTTP/Nginx ou por outra estratégia de canonicalização.

Nenhuma correção foi aplicada neste escopo.

## Desvios do fluxo

### Commits antes da etapa final do twin-workflow

O workflow orienta que a implementação, review, QA, documentação e arquivamento sejam concluídos antes da etapa final de commit/PR. Nesta sessão, o developer criou dois commits antes da documentação final:

- `1f84c9d security: add dashboard response headers`;
- `28d29cb test: reject HSTS on HTTP staging`.

O segundo commit foi criado para corrigir o achado do reviewer. Em conformidade com a regra do repositório de não reescrever commits já criados, não houve `amend`, `reset` ou squash local para ocultar o histórico.

### Plano corrente removido

O arquivo `twin-plan-current.md` foi removido indevidamente antes da atuação do twin-documenter. O plano aprovado foi reconstruído a partir das decisões e registros disponíveis no histórico e arquivado diretamente em `twin-plans/2026-06-12-16-13-plan.md`. O arquivo arquivado identifica explicitamente que se trata de uma reconstrução documental.

### Branch e destino da PR

A implementação está na branch local `work`. O checkout não possui remote configurado e só expõe essa branch, então não foi possível comprovar localmente a origem exata a partir de `develop` nem publicar uma PR real pelo Git deste ambiente.

A PR foi registrada no fluxo como destinada a `develop`, respeitando a política do projeto de passar por staging antes de qualquer promoção para `main`.

## Estado final documentado

A PR1 ficou pronta para validação em staging, com:

- headers globais configurados;
- CSP somente em Report-Only;
- HSTS ausente e explicitamente rejeitado no staging HTTP;
- testes automatizados e smoke de deploy;
- review corrigido;
- QA aprovado, com apenas o achado baixo conhecido dos redirects automáticos 308.

## Follow-up: remoção definitiva das rotas legadas

Após a revisão da PR, foi decidido que `/dashboard` e `/m` não devem mais redirecionar para `/painel`: ambas as árvores legadas devem permanecer inexistentes e responder como rotas não encontradas.

O follow-up removeu o middleware de compatibilidade, o mapa de variantes, os testes e smokes exclusivos das árvores aposentadas, além do redirect explícito de `/dashboard/`. Referências operacionais passaram a usar somente `/painel`. O achado anterior sobre redirects `308` dessas rotas deixou de ser tratado como compatibilidade desejada; as rotas agora são deliberadamente inválidas.
