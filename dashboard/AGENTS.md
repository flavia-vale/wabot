<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras obrigatórias para IAs editando o dashboard

Estas regras existem porque cada uma já causou ou quase causou um incidente em produção. Não negocie com elas.

## 1. Uma extensão por componente — NUNCA crie shadow modules

Se um componente já existe como `.jsx`, **não crie** uma versão `.js` (e vice-versa). Webpack/Next resolvem por ordem de extensão e a versão errada sequestra o import silenciosamente.

- ✅ Editar `Footer.jsx` no lugar
- ❌ Criar `Footer.js` ao lado de `Footer.jsx` "para testar"
- ❌ Renomear `.jsx` → `.js` sem deletar o original

Antes de qualquer commit, rode: `node scripts/check_no_shadow_modules.mjs dashboard`. O `npm run build` já dispara isso via `prebuild` — se falhar, **resolva o conflito**, não desabilite o check.

## 2. Imports/exports default vs nomeado — combine os dois lados

Se mudar o tipo de export de um componente, atualize TODOS os imports na mesma mudança. O Next 16 só emite warning na compilação, mas o prerender quebra com `Element type is invalid: ... got: undefined`, derrubando produção inteira.

Convenção do projeto:
- Páginas (`app/**/page.js`, `app/**/layout.js`): **default export** obrigatório (regra do App Router).
- Componentes em `components/`: **named export** por padrão; só use default quando outro arquivo já espera default.

## 3. Nunca deixe arquivos de backup no working tree

Proibido commitar (e melhor não criar nem localmente):
- `*.bak`, `*.bak.*`, `*.backup`, `*.orig`
- `*.db-journal`, `dev.db.before-*`
- `app/admin/page.js.bak.1778195312` ← exemplo real que ficou na VPS

Use git para versionar. Se quiser preservar uma versão antiga, crie um branch.

## 4. Não toque em next.config.mjs sem entender Next 16

- `turbopack: { ... }` afeta `next dev` e `next build --turbopack`. **Não combine com `next build --webpack`** no script de build — escolha um.
- Se adicionar `outputFileTracingRoot`, aponte para a raiz REAL do projeto (`__dirname` dentro de `dashboard/`), não para o monorepo.

## 5. Mexeu no app de produção? Builde local antes do push

```bash
cd dashboard
rm -rf .next
npm run build
# Tem que terminar com "✓ Generating static pages (XX/XX)" e
# .next/prerender-manifest.json deve existir.
```

Se o build local passa mas você suspeita da VPS, problema é deploy/ambiente, não código. Não fique tentando "consertar" o código que já funciona.

## 6. Crash loop em produção tem assinatura específica

Se o usuário reportar 502 contínuo:
1. `pm2 status` — coluna `↺` alta + `errored` = crash loop.
2. `pm2 logs <app> --err --lines 50` — leia o stack real, não invente causa.
3. Sintoma `ENOENT prerender-manifest.json` com `BUILD_ID` presente = build abortou no meio. **Não é runtime**, é build incompleto. Rebuilde.
4. Sintoma `Connection refused 127.0.0.1:3000` = processo morto. Veja por que morreu antes de mexer em nginx.

## 7. Lockfiles parasitas quebram resolução

Se aparecer warning `We detected multiple lockfiles`, **investigue antes de ignorar**. Um `package-lock.json` solto em `/home/deploy/` ou na raiz do monorepo faz o Next escolher um workspace root errado, mudando como `@/*` resolve. Apague o lockfile órfão.

## 8. PM2: sempre com backoff

Ao adicionar um app novo no `ecosystem.config.cjs`:
- `exp_backoff_restart_delay: 100` (obrigatório — sem isso, crash loop satura CPU e gera 502 contínuo)
- `max_restarts: 8` (obrigatório — para o loop antes de explodir)
- `min_uptime: 15000` (obrigatório — só conta como estável após 15s)

## 9. Deploy nunca reinicia PM2 com .next quebrado

O `scripts/deploy_safe_dashboard.sh` valida `.next/BUILD_ID` E `.next/prerender-manifest.json` antes do `pm2 restart`. Se você criar um deploy alternativo, replique esse gate. Reiniciar PM2 com build incompleto = 502 garantido.

## 10. Hierarquia de arquivos sagrada

- `app/**/page.js` — uma página, um default export.
- `app/**/layout.js` — um layout, um default export. NUNCA duplique `metadata`.
- `components/<dominio>/` — agrupar por feature, não por tipo. Não criar `components/utils/` global.
- Aliases: `@/*` resolve a partir de `dashboard/` (ver `jsconfig.json`). Não tente importar do monorepo via `@/`.
