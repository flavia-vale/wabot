# Plano — "o robô parou de espelhar com o painel verde" (2026-08-26)

Origem: incidente da conta `cynthiatceles@gmail.com` (25/08) + relato da
`julianepumuceno16@gmail.com` (2× na mesma semana). Medição de produção feita
em 26/08 mostrou que **não é caso isolado**.

## 1. O que a medição de produção mostrou (base do plano, não suposição)

Modo efetivo em prod: `remote`. Workers reiniciados em 26/08 16:37 UTC (foi
quando o código da quarentena durável passou a valer nos bots — o arquivo
estava no disco desde 25/08 21:07).

Quedas de sessão, 7 dias, por conta (top):

| Conta | Quedas | Com mensagem travada |
|---|---:|---:|
| julianepumuceno16 | 212 | 174 (82%) |
| gislaineryzik | 208 | 178 (86%) |
| flavia.vale | 208 | 179 (86%) |
| vanessascar12 | 192 | 169 (88%) |
| cynthiatceles | 130 | 112 (86%) |

Frota inteira: **~20 quedas/hora, estáveis 24h por dia** (madrugada igual ao
pico) — logo não é volume de oferta, é reentrega de mensagem rodando sozinha.

Origem das falhas de decrypt (`ops_wa_group_desync_autoheal`, 7 dias):

| Origem | Eventos | Contas | Coberto pela regra atual (`WA_IGNORE_UNMONITORED_GROUPS`)? |
|---|---:|---:|---|
| Conversa direta `@lid` (DM pessoal da cliente) | **538** | 15 | ❌ regra só pega `@g.us` |
| Grupo `@g.us` **não**-monitorado | 352 | 9 | ✅ (chave está OFF) |
| Grupo `@g.us` **monitorado** | 176 | 9 | ❌ é conteúdo que usamos |
| Outros (inclui canal `@newsletter` — caso Cynthia) | 16 | 7 | ❌ |

Prova de que o `@lid` é conversa pessoal (log real, conta da Juliane):

```
msgAttrs: { from: 3595575529613@lid, recipient: 207009538424894@lid,
            notify: "Julia Nepumuceno",
            peer_recipient_pn: "556792286325@s.whatsapp.net" }
msg: "sent retry receipt"
...
jid: "207009538424894@lid", monitorGroups: [], msg: "mensagem recebida"
```

O robô briga para decifrar a conversa privada da cliente e **descarta a
mensagem na linha seguinte**. É essa briga que derruba a sessão.

Sinais colaterais achados na mesma varredura (fora do escopo deste plano, mas
não podem se perder):
- `telaspl995@gmail.com`: 75 `ops_wa_forbidden` — chip possivelmente
  restringido/banido pelo WhatsApp.
- `miguelferreirasilva678` (125 quedas), `carolinyassumpcap437` (37),
  `victoriaiq9` (34), `matheuschaves308` (32) caem com **zero** mensagem
  travada — outra causa, ainda não investigada.

## 2. Princípios (valem para todas as fases)

1. **Nada pode travar o uso.** Toda regra nova falha para o lado de DEIXAR
   PASSAR. Dúvida, config não carregada, lista vazia, erro inesperado ⇒ não
   filtra nada.
2. **O que for filtrado tem que ser contado.** Hoje a forense veio de uma
   linha de log (`mensagem recebida`). Filtrar dentro da biblioteca apaga essa
   linha; sem contador, trocamos problema visível por invisível.
3. **Status honesto para a cliente, sem empurrar QR.** Precedente de 2026-06:
   o banner de "conexão instável" foi removido porque a ação que sugeria
   (re-parear) PIORA — logo após reconectar há rajada esperada de Bad MAC.
   Mostramos o fato, não mandamos re-parear.
4. **Zero migration de schema.** Tudo por métrica em memória + IPC + sinais
   `AnalyticsEvent`. Migration DDL exige lock e derruba supervisor
   (pegadinha #8).
5. **Zero processo PM2 novo.** Política de memória.
6. **Toda fase tem chave liga/desliga por env e rollback sem redeploy.**

## 3. Fases

### Fase 0 — Medir recepção funcional (não muda comportamento nenhum)

Problema que resolve: hoje o heartbeat prova que o processo está vivo, não que
mensagem está chegando. Foi assim que a Cynthia ficou verde e parada.

Entrega:
- Contadores em memória no worker (janela deslizante, poda barata, mesmo
  padrão de `cryptoErrorTimestamps`):
  `lastUpsertAt`, `lastAcceptedAt`, `lastMirroredAt`,
  `retryReceiptsInWindow`, `decryptFailuresInWindow`,
  `ignoredByRuleInWindow` (por tipo).
- Módulo **puro** `src/core/receptionHealth.js` →
  `computeReceptionState({ now, connectedSince, lastUpsertAt, lastAcceptedAt,
  retryReceiptsInWindow, decryptFailuresInWindow, hasMonitoredSources })`
  devolvendo `{ state, reason, silentForMs }` com quatro estados:
  - `ok` — chegou mensagem aceita na janela;
  - `quiet` — nada chegou e nada falhou (fonte parada / madrugada) → **não é
    alarme**;
  - `blind` — está chegando e falhando (retry/decrypt > 0) e **nada** foi
    aceito na janela → é o quadro da Cynthia;
  - `starved` — conta com fonte monitorada ativa e zero upsert por muito
    tempo, sem falha nenhuma → suspeita de filtro/entrega, alarme fraco.
- Exposto pelo IPC de métricas que já existe (`type: 'metricsResult'` →
  `sessionHealth`), consumido por `GET /api/session/status`.
- Sinal durável `ops_wa_reception_blind` (allowlist em `src/analytics.js` +
  `src/observability/operationalSignals.js`), com throttle de 1 por hora por
  conta para não inundar.

O que pode dar errado e como prevenimos:
- **Falso positivo em conta sem tráfego** (madrugada, grupo fonte parado):
  `quiet` nunca alarma. `blind` exige EVIDÊNCIA de tráfego chegando e falhando.
- **Falso positivo em conta recém-conectada**: exige `connectedSince` maior que
  a janela antes de classificar.
- **Custo de memória**: janelas com teto de itens (igual ao bound defensivo de
  `MAX_TIMESTAMPS_PER_SIGNAL`).
- **Conta sem fonte monitorada**: `starved` não se aplica (é config
  incompleta, já coberta por outro e-mail).

Envs: `WA_RECEPTION_WINDOW_MS` (default 20min),
`WA_RECEPTION_BLIND_MIN_FAILURES` (default 3).

Testes: `test/reception-health.test.js` (puro, sem DB/Redis).

### Fase 1 — Status honesto na tela + visibilidade para nós

Entrega:
- **Painel da cliente** (`dashboard/app/painel/whatsapp/page.js`): sub-linha
  ABAIXO do status, sem trocar a linha principal (mesmo padrão do
  `lifecycle='reconnecting'` já existente):
  - `blind` → "Conectado, mas sem receber mensagens há X minutos. O robô está
    tentando resolver sozinho." **Sem botão de re-parear, sem sugerir QR.**
  - `ok` → nada (não poluir).
- **Painel admin** (`dashboard/app/admin/online/page.js` +
  `buildAdminOnlineUserDetail`): estado de recepção por conta, para a gente
  ver a frota inteira numa tela em vez de grepar 1,4 GB de log.
- **E-mail para a cliente: NÃO nesta fase.** Já existe
  `Seu plano está ativo, mas o robô não envia há 2 dias` (grupo `saude`,
  dedup 7 dias) e há teto de 2 e-mails automáticos por semana. E-mail de
  20 minutos queimaria o canal. Se depois quisermos encurtar, ajusta-se o
  gatilho existente, não se cria e-mail novo.

O que pode dar errado:
- **Assustar a cliente à toa** → só `blind` aparece, e com texto que diz que o
  robô está resolvendo sozinho.
- **Contradizer a linha de status** → a sub-linha nunca troca "Conectado" por
  outra coisa; ela acrescenta.

Testes: `test/reception-health.test.js` (estados) + guarda de linguagem no
padrão de `test/painel-linguagem-leiga.test.js` (nenhum jargão: `jid`, `lid`,
`decrypt`, `retry` não podem chegar à tela).

### Fase 2 — "Olhar só o que foi escolhido" (o coração do plano)

Inverte a política: em vez de listar o que ignorar (lista que envelheceu mal —
grupo, depois canal, depois `@lid`), passa a listar o que olhar.

Entrega:
- `src/core/ignoredJidPolicy.js` ganha `shouldWatchChatJid` (puro), com modo
  em **degraus** via `WA_CHAT_SCOPE_MODE`:
  - `off` (default) — comportamento atual;
  - `dm` — ignora conversa direta (`@lid` e `@s.whatsapp.net`) fora da lista;
  - `dm+group` — soma grupo `@g.us` fora da lista (equivale a ligar a chave
    antiga, com contagem);
  - `strict` — soma canal `@newsletter` fora da lista (**só depois da Fase 3**).
- **Sempre permitido, em qualquer modo:** o próprio número/identidade da conta,
  `status@broadcast`, e tudo que está na lista de escolhidos (fontes monitoradas,
  destinos e canal do botão — `updateAllowedChatJids` já monta isso).
- **Fail-open obrigatório** (princípio 1):
  - config ainda não carregada (`ready=false`) ⇒ não filtra;
  - lista de escolhidos **vazia** ⇒ não filtra (lista vazia é sinal de config
    incompleta, não autorização para ignorar tudo);
  - qualquer exceção dentro da regra ⇒ não filtra.
- **Contagem do que foi ignorado**: contador por tipo (`dm`, `group`,
  `newsletter`, `outro`) + amostra de log limitada (primeiros N jids distintos
  por tipo por hora, nunca por mensagem) + agregado no sinal
  `ops_wa_chat_scope_filtered` a cada janela.

**Freio de emergência automático (o que garante "nada trava o uso"):**
se o modo estiver ligado E a conta tinha mensagens aceitas antes E passa a
ter **zero** aceita por `WA_CHAT_SCOPE_PANIC_MS` (default 30min) **enquanto o
contador de ignoradas sobe**, a regra se **auto-desliga em runtime** para
aquele worker, loga `error`, emite `ops_wa_chat_scope_auto_disabled` e volta a
deixar tudo passar até o próximo restart. Falha para o lado de deixar passar.

O que pode dar errado e como prevenimos:

| Risco | Prevenção |
|---|---|
| Grupo monitorado passa a ser endereçado por `@lid` (migração do WhatsApp) e some do espelhamento **em silêncio** | (a) degraus: `dm` primeiro, `dm+group` só depois; (b) freio de emergência automático; (c) alerta da Fase 1 (`blind`/`starved`); (d) a regra de DM exige marca de conversa direta (o `peer_recipient_pn` do log), não corta tudo que termina em `@lid` |
| Cliente adiciona fonte nova no painel e a mensagem é ignorada antes do cache expirar | `reloadConfig` já zera o cache e repopula a lista; TTL é 60s; freio de emergência cobre o pior caso |
| Config falha ao carregar no boot | `ready`-guard existente ⇒ não filtra |
| Biblioteca usa o mesmo gancho para histórico/lista de conversas/entrada em grupo | **Gate de implementação** — conferir na fonte instalada ANTES de codar (item da Fase 3); enquanto não conferido, `strict` fica fora |
| Perdemos a forense do que foi filtrado | contador + amostra (acima) |
| Alguém liga a env e "não pegou" | documentar: exige `pm2 delete` + `start` (pegadinha #1) **e** restart do `bot-supervisor` para os workers (que reconecta todas as sessões — avisar antes) |

Testes: `test/chat-scope-policy.test.js` (puro: degraus, fail-open, lista
vazia, próprio número, freio de emergência).

### Fase 3 — Canal (`@newsletter`) fora do escopo

O caso da Cynthia. Só entra depois de **provar na fonte da biblioteca
instalada** que ignorar canal não quebra:
1. a descoberta da tela "Canais que sigo" (hoje vem de `messaging-history.set`
   e `chats.upsert`, **não** de `messages.upsert` — precisa ser confirmado);
2. a confirmação de entrega das nossas próprias mensagens;
3. o aviso de entrada em grupo (mensagem de boas-vindas).

Validação em staging: seguir um canal novo e ver se ele aparece no picker;
entrar num grupo de destino e ver se a boas-vindas dispara.

### Fase 4 — Fonte monitorada dessincronizada (176 eventos, 9 contas)

Esse a gente **precisa** continuar tentando ler — não entra em nenhuma regra
de ignorar. Continua com auto-refresh + quarentena durável. Melhoria:
contar as tentativas pelo **contador que já é nosso**
(`msgRetryCounterCache`, que a biblioteca consulta por mensagem) em vez de
parsear linha de log — mais robusto e sem risco de quarentenar por engano uma
mensagem legítima que só demorou a decifrar.

## 4. Ordem de execução

1. Fase 0 + Fase 1 juntas (a rede de segurança vem antes de tudo).
2. Validar em staging: forçar o quadro `blind` e conferir painel + sinal.
3. Fase 2 em modo `dm`, **uma conta primeiro** (a da própria dona), 24h.
4. Medir: quedas/hora da conta antes × depois.
5. Fase 2 em modo `dm` na frota; depois `dm+group`.
6. Fase 3 só após o gate da biblioteca.

Cada passo em branch a partir de `develop`, PR contra `develop`, staging,
depois `develop → main`.

⚠️ Em modo `remote`, deploy da API **não** recarrega os bot-workers. Nada
deste plano vale nos bots até `pm2 restart bot-supervisor --update-env`, e
isso **reconecta todas as sessões de uma vez** — anunciar/agendar antes.

## 5. Critérios de sucesso (medidos, não impressão)

Baseline de 26/08:

| Métrica | Hoje | Meta |
|---|---:|---:|
| Quedas/hora na frota | ~20 | < 5 |
| `ops_wa_group_desync_unresolved` / 7d | 145 (10 contas) | ~0 |
| Contas com `ops_wa_stuck_message_retry` / 7d | 14 | < 5 |
| Conta "conectada e sem receber" sem sinal emitido | não medido | 0 |
| Cliente precisando re-parear | 3 relatos/semana | 0 |

Consulta de acompanhamento (read-only, roda no diretório do ambiente):

```bash
cd ~/wabot && sqlite3 -readonly prisma/prod.db "
SELECT strftime('%Y-%m-%d %H:00', datetime(occurredAt/1000,'unixepoch')) AS hora,
       COUNT(*) AS quedas,
       SUM(CASE WHEN metadata LIKE '%\"stuckMsg\":true%' THEN 1 ELSE 0 END) AS com_msg_travada
FROM WaConnectionEvent WHERE type='disconnect'
  AND occurredAt >= strftime('%s','now','-24 hours')*1000
GROUP BY hora ORDER BY hora;"
```

## 6. Rollback

| Fase | Rollback | Precisa redeploy? |
|---|---|---|
| 0 | `WA_RECEPTION_WINDOW_MS=0` desliga a classificação | não |
| 1 | idem (sem estado, a sub-linha some) | não |
| 2 | `WA_CHAT_SCOPE_MODE=off` | não |
| 3 | não sobe sem o gate | — |

Lembrar em todos: aplicar env exige `pm2 delete` + `start` e, para os bots,
restart do supervisor.
