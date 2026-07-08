# Handoff para revisão por IA — reconexão WA com prioridade de alta disponibilidade

Data: 2026-07-08
Escopo: mudanças de reconexão/cooldown do worker WhatsApp para reduzir janelas reais sem socket ativo.

## 1. Contexto do problema investigado

A investigação partiu do usuário `julianepumuceno16@gmail.com`, que relatou que o robô ficava configurado, mas parava de espelhar e as mensagens nem apareciam na aba **Envios** durante janelas específicas.

Os sinais operacionais levantados na VPS/banco foram:

- `WaSession` aparecia `connected/ready`, mas com timestamps interpretados inicialmente de forma errada porque campos como `sentAt`, `lastHeartbeatAt` e `updatedAt` estão armazenados como inteiros em milissegundos.
- Ao converter corretamente com `datetime(sentAt / 1000, 'unixepoch', 'localtime')`, havia mensagens hoje, filas `queued` e gaps de envio.
- Havia eventos repetidos de:
  - `ops_wa_stable_close_cooldown` com `code=500`/`428`.
  - `ops_wa_stuck_message_retry` para o mesmo `msgId`.
- Os logs também mostravam a mensagem: `Quedas periódicas de sessão WA estável detectadas — cooldown maior para reduzir re-sync/push notification sem limpar auth.`

Conclusão: parte do comportamento vinha de uma proteção implementada anteriormente para reduzir notificações repetidas de WhatsApp reconectando. Essa proteção reduzia spam de push no celular, mas causava downtime real: durante cooldown sem socket ativo, o robô não recebia mensagens e, por isso, elas nem chegavam a virar `MessageLog`.

## 2. Decisão de produto/técnica

O pedido explícito foi não criar modo de alta disponibilidade por cliente: **todos os clientes devem ter alta disponibilidade por padrão**.

Trade-off assumido:

- Antes: priorizava reduzir notificações de `A sincronização foi concluída`.
- Agora: prioriza robô 24h/alta disponibilidade, aceitando que alguns chips instáveis possam gerar mais notificações.

A proteção não foi removida por completo. Ela foi flexibilizada para reduzir downtime sem abandonar totalmente as defesas contra loops perigosos.

## 3. Arquivos alterados e o papel de cada um

### 3.1 `src/bot-worker.js`

Este é o ponto principal de execução. É onde o worker Baileys detecta closes, decide se tenta reconectar, aplica backoff/cooldown e agenda o próximo start.

Mudanças feitas:

1. **Defaults de flapping genérico**
   - `RECONNECT_FLAP_THRESHOLD`: `5` → `8`.
   - `RECONNECT_FLAP_COOLDOWN_MS`: `120_000` → `30_000`.

   Por quê:
   - Evitar cooldown prematuro em instabilidade moderada.
   - Se houver flap real, ainda existe uma pausa, mas curta: 30s em vez de 2min.

2. **Defaults de queda periódica de sessão estável**
   - `RECONNECT_STABLE_CLOSE_THRESHOLD`: `3` → `4`.
   - `RECONNECT_STABLE_CLOSE_COOLDOWN_MS`: `300_000` → `60_000`.

   Por quê:
   - A investigação mostrou quedas periódicas de sessão estável gerando cooldowns longos.
   - O cooldown antigo de 5min deixava o socket fora do ar por tempo demais.
   - O novo default preserva uma proteção residual, mas limita a indisponibilidade padrão a 1min nesse caso.

3. **Uso de `shouldConsiderStableCloseCooldown(...)`**
   - Antes, o branch de stable-close era uma condição inline baseada em `wasStable` e código elegível.
   - Agora a decisão passa pelo helper puro em `src/core/reconnectPolicy.js`.

   Por quê:
   - Centralizar a regra.
   - Testar a regra sem Baileys/timers/PM2.
   - Permitir a exceção para `stuckMsgId`.

4. **Exceção para `stuckMsgId`**
   - Quando o close contém uma mensagem travada (`stuckMsgId`), o worker não entra no cooldown de stable-close.
   - Ele segue pelo backoff/reconnect normal.

   Por quê:
   - `stuckMsgId` indica uma causa específica: retry/ack de mensagem travada.
   - Esperar em stable-close cooldown não resolve a mensagem; só aumenta downtime.
   - A observabilidade continua vindo de `ops_wa_stuck_message_retry`.

5. **Logs/comentários alinhados**
   - Mensagens que falavam em `cooldown maior/longo` foram ajustadas para `cooldown curto`, porque o comportamento agora é deliberadamente curto.
   - O log genérico de close passou a incluir `stuckMsgId` quando existir.

Pontos que uma IA revisora deve conferir:

- Se a ordem dos branches ainda preserva `connectionReplaced` como caso conservador.
- Se o branch de `flap` ainda vem antes do `stable-close`, como desejado.
- Se `stuckMsgId` só pula `stable-close` e não pula outras proteções importantes.
- Se os env overrides continuam respeitados e documentados.

### 3.2 `src/core/reconnectPolicy.js`

Este módulo contém regras puras de política de reconexão.

Mudança feita:

- Adicionado `shouldConsiderStableCloseCooldown({ hadStableOpen, code, stuckMsgId, eligibleCodes })`.

Comportamento:

- Retorna `false` se a sessão não estava estável.
- Retorna `false` se existe `stuckMsgId`.
- Retorna `false` se o código não está em `eligibleCodes`.
- Retorna `true` apenas quando a sessão estava estável, o código é elegível e não há mensagem travada.

Por quê:

- A regra deixou de ficar escondida dentro do worker.
- Facilita revisão e teste unitário.
- Evita acoplar a decisão pura a Baileys, Prisma, Redis, PM2 ou timers.

Pontos que uma IA revisora deve conferir:

- Se a assinatura aceita defaults seguros.
- Se `eligibleCodes.includes(code)` funciona com o tipo real de `code` no worker.
- Se a exceção por `stuckMsgId` deveria considerar qualquer valor truthy ou só string não vazia.

### 3.3 `src/core/sessionPersistencePolicy.js`

Este módulo decide como persistir/interpretar estado de sessão para o painel/admin.

Mudança feita:

- `DEFAULT_MAX_RECONNECTING_MS`: `5 * 60_000` → `2 * 60_000`.

Por quê:

- Alta disponibilidade exige perceber reconexão presa cedo.
- Antes, o painel podia continuar mostrando `connecting` por até 5min mesmo sem socket funcional.
- Agora, após 2min sem conexão funcional, o heartbeat pode expor `idle`, sinalizando que suporte/cliente precisam agir ou observar.

Pontos que uma IA revisora deve conferir:

- Se `connectionReplaced` ou outros cooldowns planejados podem ficar visualmente mais alarmistas.
- Se o painel/admin trata bem a transição mais cedo para `idle`.
- Se existe algum fluxo que interpreta `idle` como autorização para limpar auth ou fazer ação destrutiva. A intenção aqui é visibilidade, não reset automático.

### 3.4 `test/reconnect-policy.test.js`

Mudanças feitas:

- Importado `shouldConsiderStableCloseCooldown`.
- Adicionado teste cobrindo que stable-close só considera cooldown quando:
  - havia sessão estável;
  - o código é elegível;
  - não existe `stuckMsgId`.

Por quê:

- Garante que a exceção de mensagem travada não regrida.
- Mantém a regra de negócio testável sem rodar worker real.

Pontos que uma IA revisora deve conferir:

- Se faltam casos para `stuckMsgId=''`, `null`, `undefined` e código string vs número.
- Se convém separar esse teste em vários testes menores para diagnóstico mais claro.

### 3.5 `test/session-persistence-policy.test.js`

Mudanças feitas:

- Importado `DEFAULT_MAX_RECONNECTING_MS`.
- Adicionado teste garantindo que o default agora é 2min e que `computeHeartbeatState` retorna `idle` depois desse teto quando há reconnect agendado mas sem socket ativo.

Por quê:

- Evita que o default volte silenciosamente para 5min.
- Formaliza a decisão de alta disponibilidade no teste.

Pontos que uma IA revisora deve conferir:

- Se deveria haver teste complementar mostrando que antes de 2min ainda retorna `connecting`.
- Se o teste deveria cobrir também `hasPendingSock=true`.

### 3.6 `docs/sessions/2026-07-07-20-36-cooldown-ha.md`

Documento de sessão criado para registrar a decisão e auditoria técnica.

Conteúdo principal:

- Contexto operacional do incidente.
- Objetivo da mudança.
- O que foi alterado em cada arquivo.
- Por que foi alterado.
- Revisão crítica de riscos.
- Rollback operacional via `.env`.
- Validação realizada.
- Recomendações pós-deploy.

Por quê:

- O comportamento de reconexão é sensível para produto e operação.
- A próxima IA/humano precisa entender o trade-off: menos downtime em troca de possível aumento de notificações/reconnects.
- Facilita rollback sem novo deploy se a mudança piorar em campo.

## 4. Como a lógica nova funciona em alto nível

Fluxo simplificado quando o socket fecha:

1. O worker identifica o código de desconexão e, se existir, extrai `stuckMsgId` do node de `stream:error`.
2. Se for `connectionReplaced`, mantém a política conservadora já existente.
3. Se for badSession recorrente sem estabilidade, mantém a política de eventual reset de auth.
4. Registra closes genéricos para detectar flap.
5. Se atingir flap threshold, aplica cooldown curto.
6. Caso contrário, avalia stable-close por `shouldConsiderStableCloseCooldown(...)`.
7. Se `stuckMsgId` existe, stable-close cooldown é ignorado e o worker agenda reconnect pelo backoff normal.
8. Se for stable-close elegível e recorrente, aplica cooldown curto de 1min.
9. Agenda o reconnect.

## 5. Por que não removi totalmente cooldowns

Remover todos os cooldowns resolveria parte do downtime, mas abriria riscos:

- loop rápido de reconexão em chip muito instável;
- mais notificações no celular;
- mais carga em worker/Baileys;
- maior chance de bater em limites ou comportamento defensivo do WhatsApp;
- piora em cenário de dupla posse real da credencial.

Por isso a mudança foi uma flexibilização:

- cooldowns menores;
- thresholds um pouco maiores;
- exceção específica para `stuckMsgId`;
- `connectionReplaced` preservado como caso conservador.

## 6. Riscos que podem ter sido criados

### 6.1 Mais notificações de WhatsApp reconectando

Risco esperado. A mudança prioriza disponibilidade sobre silêncio no celular.

Como revisar/monitorar:

- Contar `whatsapp_connected` por usuário.
- Observar reclamações de push `A sincronização foi concluída`.
- Observar `ops_wa_flap_cooldown`.

### 6.2 Mais churn/carga no Baileys

Reconectar mais rápido pode aumentar ciclos em chips instáveis.

Como revisar/monitorar:

- CPU/memória dos workers.
- PM2 restarts.
- `error:baileys:*`.
- `ops_wa_forbidden`/`wa_forbidden`.

### 6.3 Loop visível de `stuckMsgId`

Se a mesma mensagem continuar travando, pular stable-close cooldown torna o problema mais visível e menos mascarado por downtime.

Como revisar/monitorar:

- Repetição do mesmo `msgId` em `ops_wa_stuck_message_retry`.
- Gaps no `MessageLog` após deploy.
- Se necessário, investigar tratamento do retry cache em vez de recolocar cooldown longo.

### 6.4 Heartbeat mais cedo pode parecer falso negativo

Com 2min, o painel pode mostrar `idle` antes em cenários de reconnect planejado.

Como revisar/monitorar:

- Tickets de “apareceu desconectado mas voltou sozinho”.
- Fluxos que disparam ação manual quando status vira `idle`.

### 6.5 Overrides antigos podem anular o patch

Se produção tiver `RECONNECT_*` ou `WA_HEARTBEAT_MAX_RECONNECTING_MS` em `.env`/PM2, os novos defaults podem não ter efeito.

Como revisar/monitorar:

- Verificar `.env` do ambiente.
- Verificar `pm2 env bot-supervisor`/processo que gerencia workers.
- Confirmar que PM2 carregou env atualizada após restart correto.

## 7. Rollback operacional sem novo deploy

Se a mudança aumentar instabilidade ou notificações demais, voltar aos defaults conservadores via `.env`:

```bash
RECONNECT_FLAP_THRESHOLD=5
RECONNECT_FLAP_COOLDOWN_MS=120000
RECONNECT_STABLE_CLOSE_THRESHOLD=3
RECONNECT_STABLE_CLOSE_COOLDOWN_MS=300000
WA_HEARTBEAT_MAX_RECONNECTING_MS=300000
```

Depois reiniciar corretamente o processo responsável pelos workers no ambiente afetado, lembrando que PM2 pode cachear env.

## 8. Comandos de teste executados nesta linha de trabalho

Passaram:

```bash
git diff --check
node --test test/reconnect-policy.test.js
node --test test/session-persistence-policy.test.js test/worker-crash-guard.test.js test/reconnect-policy.test.js
```

Executado mas não conclusivo para este escopo:

```bash
npm test -- --test-name-pattern='reconnect|heartbeat|worker crash|session'
```

Esse comando acabou exercitando parte ampla da suíte, encontrou falhas pré-existentes/não relacionadas em testes de contrato textual e foi interrompido. Essas falhas não foram corrigidas aqui porque não pertenciam ao escopo reconnect/cooldown.

## 9. Checklist recomendado para outra IA revisar

1. Ler este arquivo e `docs/sessions/2026-07-07-20-36-cooldown-ha.md`.
2. Revisar o diff em:
   - `src/bot-worker.js`
   - `src/core/reconnectPolicy.js`
   - `src/core/sessionPersistencePolicy.js`
   - `test/reconnect-policy.test.js`
   - `test/session-persistence-policy.test.js`
3. Confirmar que `connectionReplaced` continua conservador.
4. Confirmar que `stuckMsgId` não pula proteções além do stable-close cooldown.
5. Confirmar que os defaults são coerentes com alta disponibilidade global.
6. Rodar os testes focados.
7. Validar staging com sessão real antes de promover para produção.
8. Após deploy, monitorar eventos operacionais e gaps de `MessageLog` por pelo menos algumas horas.

## 10. Perguntas abertas para revisão

- O threshold `RECONNECT_STABLE_CLOSE_THRESHOLD=4` é o melhor equilíbrio, ou deveria ser ainda maior para reduzir cooldown residual?
- `RECONNECT_STABLE_CLOSE_COOLDOWN_MS=60_000` ainda causa downtime demais para a promessa de 24h?
- O helper `shouldConsiderStableCloseCooldown` deveria tratar `stuckMsgId` vazio de forma explícita?
- O heartbeat de 2min deve ser exposto de modo diferente no painel, distinguindo “idle por reconnect preso” de “desconectado real”?
- Devemos criar uma métrica específica para tempo total sem socket por usuário/dia?
