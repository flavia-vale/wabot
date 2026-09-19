# Quickstart — validação da arquitetura multicanal

**Feature**: 017 | **Branch**: `017-multicanal-telegram-instagram`

Guia de validação. Não contém implementação — detalhes de contrato em `contracts/`, de dados em `data-model.md`.

---

## Pré-requisitos

- Repo na branch da feature; `npm ci` na raiz e, para os testes que renderizam tela, `npm ci --prefix dashboard` (sem isso os testes de painel saem como `# SKIP` e o verde é falso — a lição de `test/admin-capacity-page.test.js`).
- Nenhuma variável nova é necessária para validar a Fatia 1: o default é o comportamento de hoje.
- Para validar Telegram em homologação: um robô **de homologação, separado do de produção** (ver Q2 no `plan.md` — dois ambientes no mesmo robô brigam e um deles para de ler).

---

## 1. Prova de não-regressão (o gate mais importante)

### 1.1 Automatizada

```bash
npm test
npm run arch:check
npm run quality:gate
```

Espera-se, em particular, verde nestes guardas:

| Teste | Prova |
|---|---|
| `test/delivery-whatsapp-send-inalterado.test.js` | o envio de WhatsApp continua com as quatro rotas, o id estável, o strip de canal e o timeout, na mesma ordem |
| `test/delivery-networks.test.js` | aplicativo ausente/desconhecido lê como WhatsApp, nunca erro |
| `test/delivery-worker-sem-http.test.js` | o processo por conta não fala HTTP com o Telegram |
| `test/delivery-protocolo-intocado.test.js` | `protocol.js` sem comando novo, `PROTOCOL_VERSION` ainda `1` |
| `test/delivery-rollout-fora-do-worker.test.js` | nenhum código de worker lê o interruptor |
| `test/migrations-delivery-network-aditiva.test.js` | a migration só adiciona |

### 1.2 Manual, em homologação (gate nº 1 da spec)

Com uma conta **só de WhatsApp**, comparar antes × depois:

1. lista de destinos e de origens — idêntica, sem nada para reeditar;
2. uma oferta real publicada num grupo — mesmo texto, mesma foto, mesmo card;
3. uma oferta real publicada num **Canal do WhatsApp com botão "Ver canal"** — botão presente e igual;
4. histórico — mesmas linhas, mesmos motivos, mesmos textos;
5. um bloqueio por repetição, um por palavra bloqueada e um por idade na fila — mesmos motivos;
6. sessões — nenhuma desconexão além do reinício anunciado, nenhum pareamento novo.

**Resultado esperado**: zero diferença observável (SC-002).

⚠️ A Fatia 1 toca código de worker. Em modo `remote`, o deploy reinicia o `bot-supervisor` e **reconecta todas as sessões de WhatsApp de uma vez** — anunciar e agendar antes. É o **único** reinício que esta feature exige.

---

## 2. Prova de que uma rede nova não exige reescrita (SC-009)

```bash
node --test test/delivery-rede-ficticia-e2e.test.js
```

A rede fictícia (destino único, imagem obrigatória, sem botão, não lê origem) roda origem → roteamento → conversão → texto → fila → ritmo → repetição → histórico.

**Assertiva estrutural que acompanha**: o teste não importa nenhum arquivo de `src/delivery/whatsapp/` nem de `src/delivery/telegram/`, e o diff da fatia não altera nenhum deles.

---

## 3. Telegram como destino (Fatias 3 e 4)

```bash
# homologação
DELIVERY_NETWORKS_ENABLED=whatsapp,telegram
TELEGRAM_BOT_TOKEN=<segredo do robô de homologação>
```

```bash
pm2 delete api-staging
cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging
```

⚠️ `pm2 delete` + `start`, **não** `restart --update-env` (pegadinha #1). **Não** reiniciar o `bot-supervisor` — o interruptor é lido na API e chega ao worker por `reloadConfig`.

Roteiro (gates nº 2, 3, 5 e 6 da spec):

1. Abrir a tela "Aplicativos" com o robô **fora** do grupo → lista vazia **com explicação**, nunca erro.
2. Adicionar o robô ao grupo **sem** permissão de publicar → aviso dizendo qual permissão falta, em linguagem simples.
3. Dar a permissão → o destino aparece pronto, com o nome do grupo como a cliente o conhece.
4. Ligar uma origem de WhatsApp a um destino de WhatsApp **e** a um de Telegram; publicar uma oferta → chega nos dois, com o link de afiliada dela nos dois, com uma linha de histórico por destino.
5. Apontar uma fila e uma oferta automática para o destino de Telegram → entregam, respeitam o ritmo, aparecem no histórico.
6. Remover o robô do grupo no meio de uma fila → motivo próprio no histórico, aviso à cliente, **nenhum** efeito nos destinos de WhatsApp.

---

## 4. Telegram como origem (Fatia 5 — gate nº 4)

1. Cadastrar um grupo real de Telegram como origem; publicar uma oferta lá → chega convertida no destino de WhatsApp, **uma vez só**.
2. Forçar **entrega repetida** da mesma mensagem → continua um espelhamento só (SC-016).
3. Forçar **mensagem antiga** → não reentra, e o descarte aparece registrado com motivo e idade.
4. Publicar várias mensagens seguidas → chegam nos destinos na ordem em que saíram da origem.
5. Travar o processamento de uma mensagem → as seguintes daquela origem continuam saindo (SC-017).
6. Remover o robô do grupo de origem → a origem consta com problema; as demais origens, de qualquer aplicativo, seguem funcionando.

---

## 5. Direito de plano (Fatia 2/3 — gate nº 7)

1. Conta **sem** direito: tentar cadastrar destino e origem de Telegram → recusado **na tela e no envio/leitura**, sempre com explicação leiga e caminho para mudar de plano.
2. Rebaixar uma conta que tinha Telegram ativo → publicação e leitura param, **nada é apagado**, ela é avisada.
3. Reassinar → tudo volta sozinho, sem reconfigurar (SC-015).
4. Conta sem direito usando WhatsApp → nada bloqueado, nada atrasado, nenhum aviso novo (FR-051).

---

## 6. Robô único: justiça e visibilidade (Fatia 6 — gates nº 6 e 8)

1. **Disputa**: uma conta em volume alto e outras em volume normal → as normais continuam entregando no ritmo esperado (SC-013).
2. **Robô indisponível**: estado aparece no painel de operação **sem entrar no servidor**, um aviso interno é gerado, as ofertas **esperam** na caixa de saída e o WhatsApp de **todas** as contas segue normal (SC-018).
3. **Robô volta**: a fila drena respeitando ritmo e idade; nada foi perdido.
4. **Contingência**: trocar o segredo do robô + `pm2 delete`/`start` da API → nenhuma configuração de cliente é tocada; o único passo manual é a cliente adicionar o robô novo aos grupos.

---

## 7. Observação de 24 h antes de produção (gate nº 9)

```bash
free -m | awk 'NR==2{print "livre_mb="$7} NR==3{print "swap_usada_mb="$3}'
pgrep -fc "/home/deploy/wabot/src/bot-worker"
pm2 describe api | grep -iE "memory|restart"
```

Confirmar:
- **sem aumento de quedas de sessão** de WhatsApp (`WaConnectionEvent` na janela);
- **crescimento de memória do processo `api` dentro do estimado (< 30 MB)** — este é o número que a sinalização de memória do plano prometeu e que só a medição confirma;
- **swap parado** (`si`/`so` = 0);
- **nenhum aviso duplicado** para a mesma conta.

---

## Rollback

```bash
# volta ao comportamento de hoje, sem redeploy e sem tocar no supervisor
DELIVERY_NETWORKS_ENABLED=whatsapp
pm2 delete api && cd ~/wabot && pm2 start ecosystem.config.cjs --only api && pm2 save
```

Com o interruptor no default, nenhum destino não-WhatsApp entra na configuração; o caminho novo do worker fica inalcançável e o produto volta a ser byte a byte o de antes. **Nada é apagado** — a configuração de Telegram das clientes fica guardada e volta quando o interruptor voltar.
