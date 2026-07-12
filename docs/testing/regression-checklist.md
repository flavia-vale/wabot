# Checklist de regressão — Etapa 0.5 (smoke + ritual manual de staging)

Este documento tem duas camadas complementares, não substituíveis uma pela
outra:

- **Nível 1** — automatizado, rápido, roda local/CI antes de abrir um PR
  (`npm run smoke`).
- **Nível 2** — manual, roda em staging antes de promover `develop → main`,
  cobre o que nenhum teste unitário alcança (WhatsApp real, cliques reais,
  pagamento sandbox real).

Ver também `specs/003-smoke-list/` (spec, plan, data-model) para o raciocínio
completo por trás da curadoria.

---

## Nível 1 — `npm run smoke` (subconjunto crítico rápido)

### Como rodar

```bash
npm run smoke
```

O `presmoke` roda automaticamente antes (convenção `npm run pre<script>`) e
espelha exatamente o `pretest` já usado por `npm test`: apaga
`/tmp/wabot-test.db*` e recria o schema via `prisma db push --force-reset`
contra `DATABASE_URL="file:/tmp/wabot-test.db"`, `NODE_ENV=test`. Isso garante
que os testes que tocam banco (ver tabela abaixo) rodam contra um schema
limpo, do mesmo jeito que `npm test` já faz — não é um mecanismo novo.

`smoke` primeiro confirma que os 26 arquivos curados existem (`ls <lista> >
/dev/null`) e só então roda `node --test --test-concurrency=1 <mesma lista,
enumerada explicitamente>`. A checagem de existência existe porque o
`node --test` com uma lista explícita de arquivos **ignora silenciosamente**
um caminho inexistente quando pelo menos um arquivo da lista existe (exit
code 0, menos testes rodados, nenhum aviso) — sem essa checagem, um arquivo
renomeado/apagado do subconjunto passaria despercebido, violando o requisito
de falha visível (ver seção "Como isso foi validado" abaixo).

`npm run smoke` roda em ~30s (26 arquivos), cerca de 2× mais rápido que
`npm test`, que roda a suíte completa (176 arquivos, ~60s) — use `smoke`
como sinal rápido local/pré-PR,
não como substituto do gate completo (ver nota no fim deste documento).

### O que o smoke cobre — 11 eixos críticos, 26 arquivos

"Eixo crítico" = uma categoria de comportamento onde uma regressão derruba
sessão, vaza comissão, gera ban ou quebra pagamento/login. A coluna "Toca
DB?" indica se o arquivo lê/escreve o SQLite de teste (por isso o
`presmoke` reseta o schema antes de qualquer coisa rodar).

| Eixo crítico | Arquivo(s) | Toca DB? |
|---|---|---|
| Reconexão honesta / badSession | `test/reconnect-policy.test.js`, `test/session-persistence-policy.test.js` | não |
| Dupla-posse / modo inline↔remote | `test/supervisor-env-guard.test.js`, `test/ops-mode-regression-guard.test.js`, `test/env-modes.test.js` | parcial |
| Dedup (ban/spam e oferta perdida) | `test/message-dedup.test.js`, `test/core/global-dedup.test.js`, `test/core/mirror-dedup-key.test.js`, `test/coupon-dedup-window.test.js`, `test/offer-automation.test.js` | parcial |
| Conversão + comissão nunca vaza | `test/converters-amazon.test.js`, `test/shopee-affiliate-info.test.js`, `test/shopee-shortlink-resolve.test.js`, `test/mercadolivre-resolve.test.js`, `test/mobile-converter.test.js` | não |
| Envio com FOTO (serialização BullMQ) | `test/send-queue-backend.test.js`, `test/send-queue-backend-dlq.test.js` | não |
| Cripto de credencial | `test/credential-crypto.test.js` | não |
| Login / brute-force | `test/auth.test.js`, `test/auth-rate-limit.test.js` | **sim** |
| Pagamento | `test/payments-webhook.test.js`, `test/payments-service.test.js` | **sim** |
| `imageMode` sempre `'preview'` | `test/group-entitlements.test.js`, `test/groups-route-image-mode.test.js` | parcial |
| Fiação do retry-cache (RCA loop de retry-receipt) | `test/bot-worker-retry-cache-wiring.test.js` | não |
| Teto de memória do worker | `test/core/worker-spawn-options.test.js` | não |

**Total: 26 arquivos / 11 eixos.** Arquivos com "sim" ou "parcial" na coluna
"Toca DB?" são exatamente por que o `presmoke` (reset de schema) precisa
rodar antes — sem isso esses arquivos poderiam sair falso-vermelho por
resíduo de uma execução anterior.

### Como isso foi validado (evidência do PR)

- `npm run smoke` no `develop`-equivalente: exit code `0`, `# fail 0`,
  cobrindo os 26 arquivos (307 sub-testes).
- Comparação de tempo: `npm run smoke` ≈ 30s vs. `npm test` ≈ 63s — smoke é
  significativamente mais rápido (26 de 176 arquivos).
- Falha visível por regressão real: uma asserção foi temporariamente
  quebrada em `test/reconnect-policy.test.js` → `npm run smoke` saiu com
  exit code `1`, apontando o teste que falhou; revertida a edição, voltou a
  sair `0`.
- Falha visível por arquivo ausente: um dos 26 arquivos foi temporariamente
  renomeado → `npm run smoke` saiu com exit code `2` e mensagem explícita
  (`ls: cannot access '<arquivo>': No such file or directory`) **antes** de
  rodar qualquer teste; arquivo restaurado, voltou a sair `0` e verde.

---

## Nível 2 — Ritual manual de staging (antes de promover `develop → main`)

Nenhum destes itens é coberto por teste automatizado — dependem de WhatsApp
real, cliques reais em celular e um provedor de pagamento sandbox real.
Rodar em `http://178.105.54.0:3006` (staging) **antes** de abrir o PR
`develop → main`.

1. **QR ponta-a-ponta**: conectar uma sessão via QR no painel de staging e
   verificar que o status exibido é honesto (conectando → conectado; se
   cair, o painel mostra "Desconectado" ou a sub-linha "tentando
   reconectar sozinho", nunca um "conectando" mascarando um estado real).
2. **Teste de aceitação do modo remote** (se staging estiver com
   `BOT_SUPERVISOR_MODE=remote` para essa janela de validação): com uma
   sessão conectada, rodar `pm2 restart api-staging` — a sessão **deve
   continuar conectada** (não pode cair junto com a API). Se staging
   estiver no modo canônico `inline`, pular este item (não aplicável).
3. **Espelhamento real com foto/cupom**: postar uma oferta com link de
   produto (Amazon/ML/Shopee) e, se aplicável, cupom, em um grupo
   monitorado de staging → a oferta chega ao grupo de destino **com
   foto** (card de preview clicável), com o link convertido para o
   afiliado nosso (não o do afiliado de origem) e o cupom preservado (não
   removido/descartado).
4. **Clique no celular que credita comissão**: no celular, clicar o link
   convertido recebido no passo anterior e confirmar que abre o app da
   loja (não a parede `unsupported.html`/"Oops! Seu navegador não é mais
   aceito!") e que o clique é atribuído ao nosso afiliado. **Nota especial
   ML com cupom**: o crédito de cupom no Mercado Livre está em avaliação
   (ver AGENTS.md, seção "Conversão de link de cupom") — só a validação
   real no celular confirma se creditou.
5. **Dashboard**: `/login` renderiza a página de login (não um 404 do
   Next), "Criar oferta" consegue raspar título/preço de um link colado, e
   a página de grupos (`/painel/grupos`) abre normalmente.
6. **Pagamento sandbox**: rodar um checkout do Mercado Pago em modo
   sandbox → o webhook chega em `/api/payments/webhook` → o plano do
   usuário ativa.

### Referência aos 3 smoke de deploy automatizado (não repetir manualmente)

`scripts/deploy_safe_staging.sh` já roda, automaticamente, a cada deploy em
`develop`, os seguintes 3 smoke tests como parte do próprio pipeline de
CI/CD:

- `GET http://178.105.54.0:3006/login` (espera 200, página de login real)
- `GET http://127.0.0.1:3004/health` (health check da API)
- `POST http://178.105.54.0:3006/api/auth/login` (espera resposta JSON —
  não o 404 do Next, sinal clássico de `.env`/porta desalinhados)

Esses 3 já rodam automaticamente no deploy — **não precisam ser repetidos
manualmente** neste ritual. Se algum deles falhar, o próprio deploy já
aborta antes de chegar à validação manual.

---

## Lição aprendida: comportamento > regex de source

Ao curar o subconjunto de 26 arquivos para esta feature, um dos candidatos —
`test/bot-worker-retry-cache-wiring.test.js` — é um **teste estrutural**: ele
lê o texto-fonte de `src/bot-worker.js` e confirma que
`msgRetryCounterCache`/`placeholderResendCache` estão declarados em escopo de
módulo (fora de `startBotInner`) e citados na config do `makeWASocket()`, em
vez de testar o comportamento observável (a fila realmente sobrevive a uma
reconexão dentro do mesmo processo).

**O risco desse tipo de teste**: ele quebra em falso-positivo quando alguém
faz uma refatoração legítima que preserva o comportamento correto — por
exemplo, renomear `msgRetryCounterCache` para outro nome, ou mover a
declaração para dentro do mesmo escopo de módulo mas em outro arquivo
importado. O teste vai acusar regressão mesmo que o comportamento (o cache
sobrevive a reconexões, o loop de retry-receipt não volta) continue
perfeitamente correto. Isso é ruído: força quem está refatorando a "consertar
o teste" em vez de indicar um bug real.

Esse teste específico foi **mantido como está** no subconjunto (FR-012 desta
feature proíbe alterar testes existentes, e ele documenta uma blindagem real
contra uma regressão que já causou incidente — ver AGENTS.md, seção "Loop de
retry-receipt travado"). Mas a lição para **qualquer teste novo** que entrar
no smoke daqui em diante é: preferir sempre testar **comportamento
observável** (efeito/output — ex.: "a fila sobrevive a uma reconexão
simulada, o segundo `makeWASocket()` recebe o mesmo cache com a mesma
entrada") em vez de testar a **forma textual do código-fonte** (nome de
variável, posição de declaração, presença de uma chave num objeto de config).
Teste de comportamento sobrevive a refatoração; teste de regex de source não.

---

## Nota final: smoke verde ≠ suíte completa verde

`npm run smoke` (Nível 1) é uma checagem **rápida, local, pré-PR** — cobre 26
dos 176 arquivos de teste do projeto, escolhidos por tocarem os eixos onde uma
regressão custa caro (queda de sessão, comissão vazada, ban, pagamento/login
quebrado). Ele **não substitui** o merge gate da suíte completa (`npm test`,
Etapa 0), que continua sendo a validação obrigatória antes de qualquer merge.
Um `npm run smoke` verde é sinal de "provavelmente seguro para abrir o PR e
deixar o CI confirmar" — não é licença para pular a suíte completa. Se o
smoke sair verde mas a suíte completa (`npm test`) sair vermelha, a suíte
completa é a fonte de verdade: o merge fica bloqueado até ela ficar verde.
