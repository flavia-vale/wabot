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
3. **Cada público recebe a dose certa de verdade.** Nós enxergamos toda
   piscada; a cliente só vê o que exige ação dela. Reconexão rápida que o robô
   resolve sozinho não vira aviso. E nunca empurramos QR: precedente de 2026-06
   — o banner de "conexão instável" foi removido porque a ação que sugeria
   (re-parear) PIORA, já que logo após reconectar há rajada esperada de Bad MAC.
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

### Fase 1 — Status honesto, na dose certa para cada público

Princípio novo desta fase (pedido da dona do produto, 26/08):

> **A cliente só vê o que exige ação dela.** O robô cai e volta sozinho dezenas
> de vezes por dia; expor cada piscada gera aflição, chamado no suporte e — pior
> — re-pareamento desnecessário, que é justamente a ação que PIORA o estado.
> **Nós vemos tudo. Ela vê o que precisa decidir.**

#### 1A. Painel da cliente — janela de carência antes de assustar

Hoje qualquer close não-terminal grava `status='connecting'` e o painel pisca
"Conectando…" por alguns segundos, várias vezes ao dia, sem que nada tenha
acontecido de fato para ela.

Regra nova, decidida por `resolveClientVisibleState`
(`src/core/clientVisibleSessionState.js`, **puro/testado**):

| Situação real | O que a cliente vê |
|---|---|
| Conectado e recebendo | **Tudo certo** |
| Caiu e o robô está reconectando há menos de `WA_CLIENT_GRACE_MS` (default **3 min**) | **Tudo certo** (nada muda na tela) |
| Reconectando há mais que a carência | "Reconectando — o robô está resolvendo sozinho, você não precisa fazer nada" |
| `blind` (conectado e sem receber, Fase 0) | "Conectado, mas sem receber mensagens há X" |
| Precisa de ação dela: deslogado (401), credencial apagada, bloqueio do WhatsApp (403), parada pedida por ela | **Desconectado** + o que fazer |

Limites que essa carência **não** pode cruzar (senão vira mentira):
1. Ação necessária **nunca** espera carência — 401/403/auth apagado aparecem na
   hora, sem carência nenhuma.
2. A carência tem teto absoluto: `WA_HEARTBEAT_MAX_RECONNECTING_MS` (2 min de
   reconexão presa) continua valendo e **vence** a carência. Nunca escondemos
   indefinidamente.
3. O banco continua guardando a verdade crua (`status`, `lifecycle`,
   `WaConnectionEvent`). A carência é **camada de apresentação**, não de dado —
   admin e diagnóstico enxergam cada queda.

Isso revisa (com motivo declarado) a decisão de 2026-07 registrada no
`AGENTS.md` item 3 ("`status==='disconnected'` sempre renderiza Desconectado").
O que a decisão antiga protegia — não esconder loop de reconexão da cliente —
continua protegido pelos limites 1 e 2. O que muda é só a piscada de segundos.

Testes: `test/client-visible-session-state.test.js` (puro) + guarda de que
nenhum estado de ação necessária passa pela carência.

#### 1B. Painel admin — primeira tela, primeiros cards

A visão de frota tem que estar **na home do admin, nos primeiros cards** — não
escondida numa aba. Cards novos (`dashboard/app/admin/page.js`, junto dos
`CommandCard` que já existem):

| Card | O que conta | Tom |
|---|---|---|
| **Sem receber** | contas `blind` agora (conectadas e sem mensagem chegando) | vermelho se ≥ 1 |
| **Caindo demais** | contas com quedas 24h acima de `ADMIN_DROPS_ALERT_24H` (default 20) | vermelho |
| **Cliente teve que agir** | contas com re-pareamento/reconexão manual nas últimas 24h | vermelho — é o número que mede a promessa do produto |
| **Fonte dessincronizada** | contas com `ops_wa_group_desync_unresolved` em 7d | âmbar |
| **Offline acumulado 24h** | soma do tempo fora do ar da frota | âmbar |

Cada card é clicável e leva para a aba online **já filtrada** por aquele
cenário (`/admin/online?cenario=blind|quedas|manual|desync`).

Fonte de dados: `getOperationalOverview` + `buildAdminOnlineOverview`, que já
varrem `WaConnectionEvent` e `AnalyticsEvent`. **Sem consulta nova pesada** —
os agregados saem da mesma varredura, com cache curto (o admin já recarrega
periodicamente).

#### 1C. Aba online — consertar o que já existe (não é feature nova, é bug)

Os números de tempo offline e de recuperação **já são calculados**
(`summarizeOfflineEpisodes`, `src/api/routes/admin.js`) e já aparecem em cards.
A auditoria de hoje achou **dois defeitos** que fazem eles mentirem justamente
no caso que interessa:

**Defeito 1 — o pior episódio é apagado da conta.** Quando chega
`manual_reconnect_requested` / `manual_pairing_requested`, o código faz
`startedByUser.delete(userId)` e **descarta o episódio aberto**. Ou seja: o
tempo que a cliente ficou parada ANTES de ir lá re-parear **nunca é somado**.
O caso que mais dói é o único que soma zero. Correção: fechar o episódio com
`endedBy: 'cliente'` e acumular em `manualOfflineMs` (métrica separada de
`automaticOfflineMs` — não misturar "voltou sozinho" com "só voltou porque ela
agiu").

**Defeito 2 — episódio que começa fora da janela some.** A métrica de 24h
filtra os eventos por data antes de casar queda com volta; uma queda de
23h50 que só voltou dentro da janela perde o par e não conta recuperação nem
tempo. Correção: casar os episódios sobre a série de 7 dias e só depois
recortar a janela (o recorte por `sinceMs` já existe para o tempo; falta para o
pareamento).

**Falta o drill-down que a dona pediu.** Hoje o detalhe mostra contadores e uma
lista crua de eventos. Passa a mostrar uma **linha do tempo de episódios**,
que é como se lê a história da conta:

```
14:02 → 14:06   4 min fora    voltou sozinho
16:31 → 16:33   2 min fora    voltou sozinho
20:14 → 23:40   3h26 fora     você re-pareou   ← ação da cliente
26/08 09:10 →   em aberto     tentando sozinho há 12 min
```

Campos por episódio: início, fim, duração, como terminou (`sozinho`,
`cliente`, `terminal`, `em aberto`), código da queda e se tinha mensagem
travada. Vem de `buildAdminOnlineUserDetail` como `offlineEpisodes` (limite de
50, mais recentes primeiro).

Testes: `test/admin-offline-episodes.test.js` (puro, sem DB — alimenta a função
com uma série de eventos e confere os dois defeitos acima e a montagem da linha
do tempo).

#### 1D. E-mail para a cliente — não nesta fase

Já existe `Seu plano está ativo, mas o robô não envia há 2 dias` (grupo
`saude`, dedup 7 dias) e há teto de 2 e-mails automáticos por semana. E-mail
de 20 minutos queimaria o canal e contraria o princípio desta fase (só falar
quando ela precisa agir). Se depois quisermos encurtar o prazo, ajusta-se o
gatilho existente — não se cria e-mail novo.

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

1. **Fase 1C primeiro** (conserto dos dois defeitos do tempo offline + linha
   do tempo de episódios). É barato, não muda comportamento nenhum e é o que
   nos dá o retrato verdadeiro para medir todo o resto.
2. Fase 0 + Fase 1A/1B juntas (a rede de segurança vem antes de tudo).
3. Validar em staging: forçar o quadro `blind` e conferir painel + sinal.
4. Fase 2 em modo `dm`, **uma conta primeiro** (a da própria dona), 24h.
5. Medir: quedas/hora da conta antes × depois.
6. Fase 2 em modo `dm` na frota; depois `dm+group`.
7. Fase 3 só após o gate da biblioteca.

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
| Card "Cliente teve que agir" (24h) | não medido | 0 |
| Piscada de "Conectando" na tela da cliente por reconexão automática | várias/dia | 0 |

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
| 1A | `WA_CLIENT_GRACE_MS=0` volta a expor toda queda na hora | não |
| 1B/1C | sem chave: são leitura e conserto de conta errada; rollback é reverter o código | sim |
| 2 | `WA_CHAT_SCOPE_MODE=off` | não |
| 3 | não sobe sem o gate | — |

Lembrar em todos: aplicar env exige `pm2 delete` + `start` e, para os bots,
restart do supervisor.
