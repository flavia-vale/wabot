# Front mobile (`/m`) × Front web (`/painel`) — plano e matriz de paridade

> **Objetivo:** consolidar duas fronts de UI especializadas por device sobre uma
> única autenticação e uma única API:
> - `/m/*` → acessos **mobile** (MobileShell, bottom-nav, layout 480px)
> - `/painel/*` → acessos **web/desktop** (PainelShell, sidebar, visual "Menta")
>
> O `/dashboard/*` legado deixa de ser destino e vira redirect durante a
> transição, até ser removido. Documento gerado na **Fase 0 (auditoria)**.

## Decisões já tomadas

| Tema | Decisão |
|------|---------|
| Roteamento | **Redirect por device no middleware** (server-side, sem flash, reusa cookie `ui_variant`). |
| Legado `/dashboard` | **Migrar telas faltantes e aposentar** (redirect 308 → `/painel/*`, depois remover). |
| Override manual | **Sim, persistente** via `?view=mobile|web` + link "ver versão web/celular" no rodapé. |

## Infra que já existe (não reconstruir)

- `dashboard/middleware.js` — já detecta device por user-agent e grava cookie
  `ui_variant` (`mobile`/`web`), com override por `?view=`. **Ainda não redireciona.**
- `dashboard/lib/ui-variant/device.js` — `resolveVariant({queryValue, cookieValue, userAgent})`.
- Login único (`/login`), token em `localStorage` (`wb_auth_token`), auth validada na API (401 → `/login`).
- API proxy `dashboard/app/api/[...path]/route.js` mapeia portas 3006→3004 / 3000→3001.

## Plano em fases

- **Fase 0 — Auditoria de paridade** ← *este documento*.
- **Fase 1 — Middleware com redirect** por variant nas rotas de app + `routeMap` canônico.
- **Fase 2 — Migrar telas faltantes** para `/painel` e aposentar `/dashboard`.
- **Fase 3 — Unificar entrada/sessão** (login → entrada neutra resolvida por variant; override visível).
- **Fase 4 — Testes + deploy** (unit do `resolveVariant`/`routeMap`, validação em staging, `develop → main`).

---

## Matriz de paridade

**Legenda:** ✅ tela completa · ⚠️ parcial/embutida em outra · ❌ ausente · 📄 estática

| # | Funcionalidade | `/dashboard` (legado) | `/painel` (web — alvo) | `/m` (mobile) |
|---|---|---|---|---|
| 1 | Home / visão geral | `inicio` (checklist) ✅ | `/painel` (KPIs/funil) ✅ | `/m` ✅ |
| 2 | Conexão WhatsApp (QR/pairing) | `/dashboard` ✅ | `whatsapp` ✅ | `config/whatsapp` ✅ |
| 3 | Grupos / canais | `grupos` ✅ | `grupos` ✅ | `config/groups` ✅ |
| 4 | Credenciais de afiliada | `credenciais` ✅ | `ids-afiliada` ✅ | `config/credentials` ✅ |
| 5 | Config (delays, **keywords, branding, welcome**) | `configuracoes` ✅ | `configuracoes` ✅ | `config/preferences` ⚠️ **só delays** |
| 6 | Logs / envios | `logs` ✅ | `envios` ✅ | `op/logs` ✅ |
| 7 | **Envio manual (broadcast)** | `envio` ✅ | ❌ **ausente** | `op/broadcast` ✅ |
| 8 | **Agendamento de envios** | `envio` (embutido) ✅ | ❌ **ausente** | `op/scheduled` ✅ |
| 9 | **Conversor de links avulso** | `converte-links` ✅ | ❌ **ausente** | `op/converter` ✅ |
| 10 | Criar oferta (montador) | `gerar-oferta` ✅ | `criar-oferta` ✅ | `op/offer` ✅ |
| 11 | Ofertas automáticas | `ofertas-automaticas` ✅ | `ofertas-automaticas` ✅ | `op/automations` ✅ |
| 12 | Mensagens / variações / templates | `variacoes-de-texto` ✅ | `mensagens` ✅ | `account/templates` + `account/variations` ✅ |
| 13 | Plano / cobrança | `assinaturas` (+`planos`↪) ✅ | `plano` ✅ | `account/subscription` ✅ |
| 14 | **Preservação / anti-ban (Pro)** | `preservacao` config+monit ✅ | ❌ **ausente** | `config/preservacao` ✅ |
| 15 | **Tutorial** | `tutorial` + `credenciais/tutorial` 📄 | ❌ **ausente** (nav → legado) | `tutorial` + `help/tutorial` ✅ |
| 16 | **Retorno de pagamento (checkout MP)** | `pagamento/sucesso` ✅ | ❌ **ausente** | ⚠️ via `recover` na subscription |
| 17 | Controle de espelhamento dedicado | ⚠️ via inicio/grupos | ⚠️ via grupos | `op/espelhar` ✅ |
| 18 | Checklist de ativação/onboarding | `inicio` ✅ | ⚠️ parte da home | `checklistespelhamento` ✅ |
| 19 | Perfil / conta | ⚠️ espalhado | ⚠️ em configuracoes | `account` ✅ |

---

## Backlog para aposentar o `/dashboard` (entra na Fase 2)

### ✅ Telas portadas para `/painel` (concluído)

As lacunas de paridade web da Fase 0 já foram preenchidas:

| Tela | Rota `/painel` | Status |
|---|---|---|
| Preservação/anti-ban | `preservacao/configuracoes` + `preservacao/monitoramento` | ✅ |
| Envio manual (broadcast) | `envio` | ✅ |
| **Agendamento de envios** | `agendados` | ✅ (criada na Fase 2) |
| Retorno de pagamento | `pagamento/sucesso` | ✅ |
| Conversor de links avulso | `converte-links` | ✅ |
| Tutorial | `tutorial` | ✅ |
| Checklist / primeiros passos | `checklist` | ✅ |
| Espelhamento (painel dedicado) | `espelhamento` | ✅ |

O `nav.js` e o `page.js` não têm mais referências a `/dashboard/*`. O `routeMap.js`
foi atualizado para apontar essas telas (antes mandava o usuário web para o legado).

### Pendências restantes

- ✅ **Gap inverso no mobile resolvido**: `/m/config/preferences` e
  `/painel/configuracoes` agora têm **branding (CTA+link), palavras bloqueadas e
  mensagem de boas-vindas**, além do delay.
- ✅ **Legado aposentado**: `app/dashboard/*` foi **removido**. O `routeMap`
  encaminha qualquer URL `/dashboard/*` remanescente (bookmark/return de
  pagamento) para o `/painel/*` equivalente (web) ou `/m/*` (mobile). Redirects
  de pagamento (`payments.js`) e links internos repontados para `/painel`.

---

## Conclusão

Consolidação completa: **mobile → `/m`**, **web → `/painel`**, login e API únicos,
override manual por `?view=`, e o `/dashboard` legado removido com encaminhamento
automático. Paridade de features fechada nas duas fronts.
