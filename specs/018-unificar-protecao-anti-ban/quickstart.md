# Quickstart — validar o Anti-banimento

## 0. GATE HUMANO antes do deploy de `main` — medir no VPS (read-only)

⚠️ **Só a dona do produto pode fechar este passo.** A sessão de desenvolvimento
não acessa o banco. Rodar no VPS, no diretório de cada ambiente, **antes** do
merge `develop → main`, e colar a saída na PR:

```bash
cd ~/wabot-staging && node scripts/diag-antiban-valores.mjs
cd ~/wabot && node scripts/diag-antiban-valores.mjs
cd ~/wabot && node scripts/diag-antiban-valores.mjs --detalhes   # contas afetadas (e-mail)
```

**Parte A (piso)** — esperado: por campo fixo (3), contagem de
menos conservadoras / mais conservadoras / iguais / herdando; destinos com
limites desligados e os valores gravados que passam a ser ignorados (recomeçam
do padrão); comparação destino a destino "antes × depois" **sem nenhuma linha em
que o depois seja menos conservador** (SC-005).

**Parte B (vazão do "Intervalo entre destinos")** — esperado: destinos por conta
(p50/p90/máx, top 10); atraso projetado `(N−1) × intervalo` com o valor gravado
e com 20 s; vazão teórica × pico observado por hora; classificação contra o
menor `queueMaxAgeMin` (ok / atenção ≥ 50% / descartaria ≥ 100%).

**Decisão da dona com esse número**: confirmar 20 s como padrão final ou
escolher outro (PR própria com migration DML guardada); e decidir se algum teto
de descarte precisa ser revisto. **Até lá, 20 s é provisório.**

## 1. Testes locais

```bash
node --test test/anti-ban-floor.test.js \
            test/destination-spacing.test.js \
            test/bot-worker-destination-spacing-wiring.test.js \
            test/anti-banimento-gate-fonte-unica.test.js \
            test/anti-banimento-linguagem.test.js \
            test/anti-banimento-rotas-antigas.test.js \
            test/anti-banimento-rotas-compat.test.js \
            test/diag-antiban-valores.test.js
npm test
npx eslint@9 --no-inline-config src test dashboard/app dashboard/components dashboard/lib
npm ci --prefix dashboard   # componentes renderizados pulam sem isso
```

## 2. Staging (`http://178.105.54.0:3006`) — tela

Contas de teste: Basic, Trial ativo, Trial vencido, PRO, Premium.

| Passo | Esperado |
|---|---|
| Menu com conta PRO | 1 item "Anti-banimento" com selo PRO, no grupo Configuração; grupo "Preservação avançada" sumiu |
| 4 endereços antigos | caem na parte certa da tela nova |
| Conta Premium | tela liberada, sem upsell (SC-005a) |
| Basic / Trial vencido | tela visível e bloqueada; `PUT /api/preservation/destinations/:id` → 402 com "O Anti-banimento é um recurso do plano PRO." |
| Espelhamento → destino → atalho | abre a tela com o destino selecionado |
| Destino com `burstCap=3` gravado (limites ligados) | etiqueta "Ritmo mais cuidadoso"; `GET /destinations` → `ritmoMaisCuidadoso: true` |
| Destino com `throttleEnabled=false`, `minIntervalSec=300`, `dailyCap=3` | `GET /destinations` → `recomecouDoPadrao: true`, `effective` = 30 s / sem limite / 6 / 600; sem etiqueta |
| "Ajustes da conta" | campo "Intervalo entre destinos" em segundos, editável; variação de imagem igual a antes |
| `PUT /config` com `channelStaggerJitterMs: 0` | 200; `GET /config` → `effective.destinationIntervalSec = 0` (sem piso) |
| Ctrl+F na tela | nada da lista proibida, nem "atraso entre canais" |

## 3. Staging — robô (depois do `bot-supervisor-staging` reiniciar)

⚠️ Só vale nos robôs após o supervisor reiniciar (o deploy faz sozinho:
`src/core/` e `src/bot-worker.js` estão em `WORKER_CODE_PATHS_RE`) — **isso
reconecta todas as sessões**. Em produção: anunciar às clientes antes (decisão E).

Com intervalo em 20 s, publicar uma oferta de teste que vá para 2 grupos e 2
canais:

```bash
grep -E '"reason":"destination_spacing"|Defer longo' $BOT_LOG_DIR/bot.log | tail -20
grep '"msg":"Smart delay antes do envio"' $BOT_LOG_DIR/bot.log | tail -20
```

Esperado: saídas espaçadas ≥ 20 s entre destinos diferentes, **grupos incluídos**
(SC-005c); adiamentos com `deferUntil` e motivo `destination_spacing`; nenhum
"Smart delay" com `baseDelayMs` vindo do antigo sorteio (SC-005b); destino com
rajada 10 gravada respeitando 6 por janela.

Rollback sem redeploy: `ANTI_BAN_FLOOR=off` e/ou `DESTINATION_SPACING=off` no
`.env` + `pm2 delete`/`start` (pegadinha #1) + restart do supervisor.
