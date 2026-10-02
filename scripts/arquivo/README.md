# scripts/arquivo — scripts que já cumpriram o papel

Movidos para cá em 2026-10-02 (Q9 da auditoria do painel,
`docs/admin/auditoria-painel-admin.md`). Nenhum deles é parte da operação do
dia a dia; ficam guardados porque documentam decisões e migrações passadas e
podem servir de modelo. Rodar qualquer um deles em produção exige ler o
cabeçalho e confirmar com a dona do produto — a maioria GRAVA.

| Script | O que fez | Por que está arquivado |
|---|---|---|
| `migrate-credentials-encrypt.mjs` | criptografou as credenciais de loja | migração única, já aplicada |
| `migrate-affiliate-pixkey-encrypt.mjs` | criptografou a chave PIX dos afiliados | migração única, já aplicada |
| `migrate-group-template-null-to-relay.mjs` | preencheu template nulo dos grupos | migração única, já aplicada |
| `reset-legacy-botconfig-fields.mjs` | zerou campos antigos de `BotConfig` | migração única, já aplicada |
| `seed-copy-variations.mjs` | semeou variações de texto | seed inicial, já aplicada |
| `snapshot-image-mode.mjs` | gravou quem estava em modo preview | o padrão já é `original` |
| `cleanup-test-fixture-users.mjs` | apagou usuários `*@test.local` | `db.js` já protege contra isso |
| `desligar-rastreio-cliques.mjs` | desligou rastreio de cliques em massa | decisão pontual de 29/09 |
| `shopee-linktype-probe.mjs`, `debug-shopee-offers.mjs` | sondas da API Shopee antes da implementação | a loja já está implementada |
| `p2_*.sh`, `p3_*.sh`, `sprint_*.sh` | planos de migração para Postgres e scale-out | só imprimem checklist; plano não seguiu |

Continuam em `scripts/` (ainda têm teste, `package.json` ou linha no
`AGENTS.md`): `backfill-numeros-whatsapp`, `basic-sem-recursos-pro`,
`cleanup-cookieless-flag`, `seed-preservation-presets`, `diag-mirror-duplicates`,
`diag-shein-*`, `instagram-story-poc`, `marketing-funnel-baseline`.
