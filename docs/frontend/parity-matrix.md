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

Telas a portar para `/painel`, por impacto:

| Prioridade | Tela faltante no `/painel` | Origem a portar | Por que trava |
|---|---|---|---|
| 🔴 Alta | **Preservação/anti-ban** (config + monitoramento) | `/dashboard/preservacao/*` | Feature Pro inteira sem equivalente web |
| 🔴 Alta | **Envio manual + agendamento** | `/dashboard/envio` | Operação central sem equivalente web (mobile tem) |
| 🔴 Alta | **Retorno de pagamento** | `/dashboard/pagamento/sucesso` | É a *return URL* do checkout MP — não pode 404 |
| 🟡 Média | **Conversor de links avulso** | `/dashboard/converte-links` | Mobile tem; web só tem o montador completo |
| 🟡 Média | **Tutorial** | `/dashboard/tutorial` | `nav.js` ainda aponta pro legado |

### Gap inverso (paridade no mobile)

- 🟡 **Config de keywords bloqueadas / branding / welcome message**: `/m/config/preferences`
  só salva delays. Existe em `/painel/configuracoes` e `/dashboard/configuracoes`.

### Referências ao legado a eliminar no `/painel` (acionáveis)

Apenas duas (o resto são comentários de documentação):

- `app/painel/nav.js:85` → Tutorial aponta `/dashboard/tutorial`
- `app/painel/page.js:318` → "Ver tudo →" aponta `/dashboard/logs` (deve ir para `/painel/envios`)

---

## Conclusão da Fase 0

O `/painel` está mais maduro do que o comentário do `nav.js` sugeria: **10 telas
completas, sem stubs**. Para fechar paridade web faltam **5 telas** (3 críticas),
**1 ajuste** de paridade no mobile e **2 links** legados a repontar.
Esse é o escopo concreto da Fase 2.
