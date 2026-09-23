# Quickstart — validar o Anti-banimento

## 0. Antes de tudo: medir o impacto (read-only)

No VPS, no diretório de cada ambiente, **antes** do merge em `main`:

```bash
cd ~/wabot-staging && node scripts/diag-antiban-valores.mjs
cd ~/wabot && node scripts/diag-antiban-valores.mjs
cd ~/wabot && node scripts/diag-antiban-valores.mjs --detalhes   # lista contas afetadas (e-mail)
```

Esperado: por campo fixo, contagem de linhas/contas **menos conservadoras**
(mudam para o fixo), **mais conservadoras** (mantêm + etiqueta), iguais e
herdando; e a comparação destino a destino "antes × depois" **sem nenhuma linha
em que o depois seja menos conservador** (SC-005). Colar a saída na PR.

## 1. Testes locais

```bash
node --test test/anti-ban-floor.test.js \
            test/anti-banimento-gate-fonte-unica.test.js \
            test/anti-banimento-linguagem.test.js \
            test/anti-banimento-rotas-antigas.test.js \
            test/anti-banimento-rotas-compat.test.js \
            test/diag-antiban-valores.test.js
npm test
npx eslint@9 --no-inline-config src test dashboard/app dashboard/components dashboard/lib
npm ci --prefix dashboard   # componentes renderizados pulam sem isso
```

## 2. Staging (`http://178.105.54.0:3006`)

Contas de teste: Basic, Trial ativo, Trial vencido, PRO, Premium.

| Passo | Esperado |
|---|---|
| Menu com conta PRO | 1 item "Anti-banimento" com selo PRO, no grupo Configuração; grupo "Preservação avançada" sumiu |
| Abrir os 4 endereços antigos | caem na parte certa da tela nova |
| Conta Premium | tela liberada, sem upsell (SC-005a) |
| Basic / Trial vencido | tela visível e bloqueada; `PUT /api/preservation/destinations/:id` → 402 com "O Anti-banimento é um recurso do plano PRO." |
| Espelhamento → destino → atalho | abre a tela com o destino selecionado |
| Destino com `burstCap=3` gravado | etiqueta "Ritmo mais cuidadoso"; `GET /destinations` traz `ritmoMaisCuidadoso: true` |
| `PUT /config` com `channelStaggerJitterMs: 0` | 200; `GET /config` → `effective.channelStaggerJitterMs = 20000` |
| Busca por jargão na tela (Ctrl+F) | nada da lista proibida |

## 3. Robô (só depois do supervisor reiniciado)

⚠️ O piso só vale nos robôs após `bot-supervisor(-staging)` reiniciar — o deploy
faz isso sozinho porque `src/core/` e `src/bot-worker.js` estão em
`WORKER_CODE_PATHS_RE`, e **isso reconecta todas as sessões**. Em produção,
anunciar antes (ou `RESTART_SUPERVISOR=0` + restart agendado).

Conferir no `bot.log` que um destino com rajada 10 gravada respeita 6 por janela
e que o "Smart delay"/espera entre canais não cai abaixo de 20 s.

Rollback sem redeploy: `ANTI_BAN_FLOOR=off` no `.env` + `pm2 delete`/`start`
(pegadinha #1) + restart do supervisor.
