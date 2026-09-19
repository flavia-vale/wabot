# Quickstart — validação da feature 017 (cupons da cliente)

Roteiro de verificação. Não contém implementação — o passo a passo de código
está em `tasks.md`.

---

## 1. Verificação local (sem banco, sem rede)

```bash
cd /home/user/wabot
node --test test/client-coupon-policy.test.js     # regra pura (FR-013, FR-018f/g)
node --test test/mirror-template.test.js          # {linhaDeCupom} fora, {preçoDoTexto} intacto
node --test test/mobile-offer-composer.test.js    # token novo, sem sobra de formatação
node --test test/offer-automation.test.js         # opt-in + falha não aborta o lote
node --test test/migrations-no-duplicate-column.test.js
node --test test/painel-linguagem-leiga.test.js
npm test
npm run arch:check     # src/core/clientCouponPolicy.js não pode importar dashboard/
```

**Esperado**: tudo verde. `arch:check` sem violação nova — a barreira
`no-src-to-dashboard` só isenta `mirrorTemplate.js` e
`offerAutomation/dispatcher.js`, e a regra nova não entra nessa lista.

⚠️ `npm ci --prefix dashboard` antes de concluir que está verde, se tiver mexido
em componentes do dashboard — sem isso há teste que sai como `# SKIP`.

---

## 2. Validação em staging (`http://178.105.54.0:3006`)

Staging é `inline` (canônico), então a `api-staging` faz o fork dos workers e o
deploy já recarrega o código dos robôs. **Não** reproduz o modo `remote` de
produção — o cenário 6 abaixo existe para cobrir isso.

### Cenário 1 — cadastro (US1)
1. Painel → Cupons → cadastrar três cupons de lojas diferentes.
2. Desligar um, apagar outro, recarregar a página.
3. Cadastrar um com validade de ontem.

**Esperado**: a lista reflete exatamente o que foi feito; o de ontem aparece
marcado como vencido e continua na lista (não é apagado nem desligado sozinho).
Tentar salvar sem código, com 0% ou com 150% recusa com frase em português
simples, sem nome de campo técnico.

### Cenário 2 — a oferta sai com o melhor cupom (US2)
1. Dois cupons ativos da mesma loja: um de **10%** e um de **R$ 20**.
2. Template de espelhamento com `{cupom}`; publicar no grupo de origem uma
   oferta de **R$ 300**, depois uma de **R$ 100**.

**Esperado**: R$ 300 sai com o de 10% (`de R$ 300,00 por R$ 270,00 com o
cupom`); R$ 100 sai com o de R$ 20 (`por R$ 80,00`). A expressão **"com o
cupom"** aparece nas duas.

### Cenário 3 — sem cupom aplicável (SC-003)
Oferta de uma loja **sem** cupom ativo, mesmo template.

**Esperado**: mensagem sem linha vazia extra, sem emoji solto, sem asterisco
órfão e sem `{cupom}` cru.

### Cenário 4 — o desligamento vale no momento do envio (FR-014)
1. Enfileirar um envio que vá esperar (destino com intervalo mínimo alto ou
   fora do horário de funcionamento).
2. **Com o envio ainda parado na fila**, desligar o cupom no painel.
3. Liberar o destino.

**Esperado**: a mensagem sai **sem** o cupom. O que já tinha saído antes não
muda. No log da API: `couponReloaded: true`.

### Cenário 5 — automação (US3)
Duas automações idênticas, a opção marcada em **uma**.

**Esperado**: só as ofertas da marcada saem com cupom. Desmarcar → os próximos
envios voltam a sair sem cupom. Automação criada **antes** da atualização
continua enviando o texto de antes (SC-005).

### Cenário 6 — a notificação se perdeu (rede de segurança do D1)
1. Parar o `bot-supervisor-staging` ou o Redis por um instante.
2. Desligar um cupom no painel (o reload vai falhar — `couponReloadError`
   preenchido, e a requisição **não** pode falhar por isso).
3. Restabelecer e aguardar **até 60s** (`CONFIG_CACHE_TTL_MS`).

**Esperado**: passados os 60s, as ofertas saem sem o cupom desligado, sem
ninguém fazer nada. É esta a prova de que FR-028a e FR-014 convivem.

### Cenário 7 — saída do `{linhaDeCupom}` (US4)
Com um template salvo contendo `{linhaDeCupom}`:

**Esperado**: a tela de templates não mostra o texto cru em lugar nenhum;
`{linhaDeCupom}` não aparece na lista de variáveis; a mensagem publicada sai sem
ele e sem lacuna. `{preçoDoTexto}` **continua funcionando** (FR-021) — conferir
numa oferta cuja origem traga "De R$ X por R$ Y".

### Cenário 8 — nada quebra a fila (FR-028b/SC-010)
Coberto por teste que força a falha; em staging, conferir só que não há envio
perdido nem fila parada depois dos cenários acima.

---

## 3. Antes de promover para produção

- [ ] Todos os cenários acima validados em staging.
- [ ] `npm test` + `npm run arch:check` verdes na PR (PR contra `develop`,
      **nunca** direto para `main`).
- [ ] Nenhum processo PM2 novo; `free -m` sem mudança relevante (SC-008).
- [ ] Conferido que a chave de repetição continua saindo dos **links** e não do
      texto com cupom (nota de verificação da spec).

---

## 4. Nota de operação na entrega (obrigatória)

Em produção no modo `remote`, **o deploy da API não recarrega os bot-workers**.
Portanto, logo após o deploy:

- a tela de cupons, o cadastro e a opção da automação **já valem**;
- o cupom no **espelhamento** e na **fila de ofertas** só passa a valer depois de
  `pm2 restart bot-supervisor --update-env`, **que reconecta todas as sessões de
  WhatsApp de uma vez**.

Esse reinício é decisão humana, anunciada antes, nunca às cegas. Até lá, o
comportamento esperado é: cupons cadastrados normalmente e ofertas espelhadas
ainda saindo sem cupom. **Isso é o esperado, não defeito.**

Conferir se os robôs já pegaram o código novo:

```bash
ps -eo pid,etime,cmd | grep "wabot/src/bot-worker" | grep -v grep | head
```
