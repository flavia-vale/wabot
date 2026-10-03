# Painel admin — prompts para implementar o que falta (pós-auditoria, 2026-10-03)

Fonte: `docs/admin/auditoria-painel-admin.md` (seções 3 a 6). Conferido contra
`develop` em 2026-10-03: já entraram Q1–Q10, M1, M4, G1, G2. Abaixo, o que falta,
em ordem sugerida, **um prompt por PR**. Cole primeiro o "Prompt base" e depois o
prompt do item. Cada item é independente, salvo onde está escrito "depende de".

---

## Prompt base (colar antes de qualquer item)

```
Você vai trabalhar no repositório flavia-vale/wabot (Espelha Grupos). Leia AGENTS.md
antes de tudo e siga à risca: branch nova a partir de `develop`, PR de rascunho
contra `develop` (nunca `main`), sem push direto em `develop`, sem amend em commit
já mergeado, sem comando destrutivo. Estilo de resposta: 4 pontos (O QUE
ACONTECEU / PORQUE / O QUE DEVE SER FEITO / COMO), ultra-sintético, português.

Contexto: existe uma auditoria do painel admin em
docs/admin/auditoria-painel-admin.md (seções 1–6) e RCAs em docs/rca/admin.md.
Leia a seção da auditoria citada no item antes de codar. Causa raiz sempre com
dado (log, banco, teste); hipótese é dita como hipótese.

Regras técnicas que valem para todo item:
- Zero RAM nova (sem processo PM2, sem cache em memória, sem fila nova). Se um
  item precisar de qualquer memória extra, SUPER SINALIZAR na descrição do PR
  com estimativa e pedir OK antes.
- Regra pura em `src/domain/...` (sem banco), rota fina em `src/api/routes/admin.js`
  com `requireAdmin(req, reply, '<perm>')` e `writeAdminAuditLog` em toda escrita.
- Datas no SQLite são inteiros em ms.
- Pagante = regra canônica de `src/domain/admin/payingLoader.js`
  (`loadEverPaidUserIds`, `currentPayingWhere`); nunca por `plan`.
- Tela nova em `dashboard/app/admin/<nome>/page.js`, cliente ('use client'),
  tokens do design system (`var(--surface|--line|--ink|--ink-soft|--accent-strong|
  --accent-3|--bg-soft|--accent-2|--danger)`), nunca hex solto. Nada de setState
  síncrono dentro de useEffect (lint do dashboard `react-hooks/set-state-in-effect`
  derruba o CI): carregue via `Promise.resolve().then(() => carregar())` e faça o
  primeiro setState depois do await.
- Ação sobre conta de cliente: `window.confirm` antes, texto leigo.
- Toda fatia ganha: teste em `test/<nome>.test.js` (node:test; regra pura testada
  direto, rota/tela por leitura estrutural do fonte como os `test/admin-*.test.js`),
  seção curta no fim de `docs/rca/admin.md` (o que era, onde mora, não regredir),
  e linha nova no "Mapa de sintomas" do AGENTS.md só se criar diagnóstico novo.
- Antes de abrir o PR, rode e cole o resultado: `node --test test/admin-*.test.js`,
  `npx --yes eslint@9.39.4 --no-inline-config src test dashboard/app dashboard/components dashboard/lib`
  e `cd dashboard && npm ci && npx eslint` (0 errors). Corpo do PR segue
  `.github/PULL_REQUEST_TEMPLATE.md`, com cenários de validação em staging (3006).
```

---

## 1. Fechar o corte do Início: tirar abas Online e Sucesso, apagar `/admin/online` e `/admin/sucesso-cliente`

Auditoria: 5.2 (mapa tela antiga → destino) e critério de aceite de G1/G2.
Depende de: nada (G1 "Hoje" e G2 já estão em `develop`).

```
Objetivo: o Início (dashboard/app/admin/page.js, hoje 1.719 linhas) fica só com o
semáforo + Gestão de clientes + Afiliados; as abas "Online" e "Sucesso do Cliente"
saem, porque a caixa /admin/hoje (G1) e a ficha /admin/clientes/:id já respondem
o que elas respondiam. As páginas dashboard/app/admin/online/page.js e
dashboard/app/admin/sucesso-cliente/page.js são apagadas; o que delas ainda não
existe na ficha migra para lá.

Passos:
1. Levante o que só existe nessas duas telas e na aba Online do Início:
   filtros por cenário/waStatus/minErrors, OnlineDetailDrawer (histórico de
   conexão por cliente, "Por que caiu", disconnectReason), botão Reconectar,
   fila de sucesso com "registrar contato" e "ajustar acesso".
2. Mova para a ficha /admin/clientes/[id]/page.js: o drawer de conexão vira uma
   seção "Robô" (histórico + Por que caiu + Reconectar com confirm). Registrar
   contato e ajustar acesso já existem na ficha? Se não, mova também.
3. Na caixa /admin/hoje, os chips do topo passam a ter filtro por motivo
   (robô caído / cega / cobrança / vencendo / sem envio), substituindo os
   filtros de cenário da aba Online.
4. Remova do Início: TABS 'online' e 'sucesso', estados/handlers só deles
   (onlineFilters, reloadOnline, openScenario→ agora abre /admin/hoje?motivo=…,
   openWaStatus, openErrorsDrilldown→ /admin/erros, onlineDetail*, success*,
   successQueue), e as chamadas do boot api.adminOnline / adminSuccessOverview /
   adminSuccessQueue se nenhum card restante usar. Cards de cenário do semáforo
   continuam, mas o clique leva para /admin/hoje com o filtro.
5. Apague as duas páginas e os links para elas (grep por "/admin/online" e
   "/admin/sucesso-cliente" em dashboard/ e docs/). Rotas da API ficam.
6. Adapte os testes que leem esses arquivos: test/admin-visibility (onlinePage),
   test/admin-acoes-com-confirmacao (reconnect do online), test/admin-paying-tag
   (sucesso-cliente), test/admin-acesso-por-permissao (sucesso-cliente),
   test/admin-painel-inicio (tab 'sucesso', openScenario, openWaStatus,
   openErrorsDrilldown), test/admin-cenarios-frota, test/admin-reconexao-parados,
   test/admin-inicio-enxuto (baixe o teto do Início para 1.200 linhas).
   Nunca apague uma garantia: mova a asserção para o arquivo novo.

Aceite: Início ≤ 1.200 linhas e ≤ 7 consultas no boot; nenhuma ação perdida
(reconectar, registrar contato, ajustar acesso, histórico de conexão continuam
acessíveis pela ficha ou pelo Hoje); todos os test/admin-*.test.js verdes.
```

## 2. MRR canônico e selo "Atualização em tempo real"

Auditoria: 2.1 (tabela, linha MRR), 3.4 (Pagante), 1.1 (selo que mente).

```
Objetivo: dois números/textos do painel que a dona olha todo dia e hoje mentem.

a) MRR. Em src/api/routes/admin.js (~linha 2145 em /finance/overview e ~2542 em
/finance/roi) `activeMrr` = contagem por `plan` × preço. Passe a contar só quem é
pagante pela regra canônica (payingLoader.currentPayingWhere / loadEverPaidUserIds)
e multiplicar pelo preço do plano atual de cada um. Antes de mudar, meça em
produção com um SQL read-only (dê o comando à usuária): quantos usuários
`plan in (basic,pro,premium)` com acesso vigente NÃO têm Payment/SubscriptionCharge
aprovada. Se der 0, documente que o número não muda; se der > 0, o PR diz
quanto o MRR vai cair e por quê.

b) Selo. dashboard/app/admin/page.js (~linha 1301) mostra "Atualização em tempo
real", mas não há polling. Troque por "Atualizado às HH:MM" com a hora da última
carga e o botão Atualizar já existente.

Teste: test/admin-mrr-canonico.test.js lê a rota e falha se `activeMrr` voltar a
depender de `activeBasic`/`activePro`/`activePremium` contados por `plan`; e lê o
Início e falha se "tempo real" voltar. RCA em docs/rca/admin.md.
```

## 3. M7 — Retenção de `AnalyticsEvent ops_*` (90 dias)

Auditoria: 3.1 (tabela, linha 37 ops_*) e 3.5 (última linha).

```
Objetivo: AnalyticsEvent é a maior tabela sem limpeza; os eventos `ops_*`
(src/observability/operationalSignals.js) crescem para sempre.

1. ANTES de codar, peça à usuária estes dois comandos em produção (um por
   pergunta, saída filtrada) e espere a resposta:
   sqlite3 ~/wabot/prisma/prod.db "SELECT COUNT(*) FROM AnalyticsEvent WHERE event LIKE 'ops_%'"
   sqlite3 ~/wabot/prisma/prod.db "SELECT event, COUNT(*) c FROM AnalyticsEvent WHERE event LIKE 'ops_%' GROUP BY event ORDER BY c DESC LIMIT 10"
   (o caminho do banco sai de DATABASE_URL no .env; confirme antes).
2. Em src/api/server.js, no mesmo sweep diário onde já existe
   SESSION_TELEMETRY_RETENTION_DAYS, acrescente OPS_EVENT_RETENTION_DAYS (default
   90) apagando `event LIKE 'ops_%'` com `createdAt < cutoff`, EM LOTES (por
   exemplo 5.000 por vez em loop, com pausa curta) para não travar o SQLite nem
   segurar o event loop da API. Nunca apagar `credential_expiry_alert_sent`,
   `session_telemetry` nem eventos de funil/UTM.
3. Lista explícita dos eventos que a retenção cobre vem de operationalSignals.js
   (não de LIKE solto) para não apagar coisa nova por engano; teste puro garante
   que a lista exclui os eventos de negócio.

Teste: test/analytics-retencao-ops.test.js. RCA em docs/rca/admin.md e nota na
política de memória se mudar algo lá (não deve). Zero RAM.
```

## 4. M5 — Operação → Filas: envios presos em `sending` por cliente; DLQ só com BullMQ

Auditoria: 3.1 (linha BullMQ), 3.2, item M5 da seção 6, e o dado medido em
Apêndice C: em produção `QUEUE_BACKEND` não está no .env (fila em memória).

```
Objetivo: hoje o card "Trabalhos parados" do Início e as rotas /send-dlq/* medem
uma DLQ do Redis que em produção não existe (fila em memória). O que existe de
verdade é MessageLog com status='sending' preso (src/jobs/stuckSendLogs.js,
STUCK_SENDING_MS em src/ops/adminOpsAlertPolicy.js).

1. Rota nova GET /api/admin/filas (tech:read, auditada): por cliente, quantos
   MessageLog em 'sending' acima de STUCK_SENDING_MS, há quanto tempo o mais
   antigo, último envio com sucesso; tudo em groupBy/in, teto de 500 linhas.
   Inclui `backend: 'memoria' | 'bullmq'` lido do env do processo da API.
2. POST /api/admin/filas/:userId/reprocessar (tech:write, auditada, com motivo):
   reaproveita o que src/jobs/stuckSendLogs.js já faz para destravar (não
   duplicar lógica; extrair função se preciso).
3. Página dashboard/app/admin/operacao/page.js ganha a seção "Filas" com essa
   tabela e botão Reprocessar (confirm). O card de DLQ do Início e as rotas
   /send-dlq/* ficam atrás de `QUEUE_BACKEND === 'bullmq'` (rota responde 409
   "fila em memória neste ambiente" quando não for).
4. O chip "envios presos" da caixa /admin/hoje passa a linkar para essa seção.

Teste: test/admin-filas.test.js (regra pura de "preso", rota só em lote, guarda
do backend). RCA em docs/rca/envio-e-filas.md (é o tema certo) + 1 linha no
mapa de sintomas do AGENTS.md apontando para a tela.
```

## 5. Bloquear/banir com papel alto e dupla confirmação; `/health` que checa o supervisor

Auditoria: 3.6 (tabela de ações), 3.3 (linha "Supervisor morto com API viva").

```
Objetivo:
a) POST /users/:id/block (src/api/routes/admin.js ~2909) exige só support:write,
mesmo nível de "registrar contato". Suba para admin:write, exija `reason` com ≥ 10
caracteres, e na ficha /admin/clientes/[id] a ação pede confirmação dupla (confirm
+ digitar o e-mail da conta). Mesma coisa para desbloquear/banir. Auditoria já
existe; confira que grava o motivo.
b) GET /health em src/api/server.js responde {ok:true} sem olhar nada. Em
BOT_SUPERVISOR_MODE=remote, passe a incluir `supervisor: { alive, lastHeartbeatAt }`
lido do heartbeat no Redis que o supervisor já grava (src/supervisor/index.js),
sem mudar o status HTTP (200 continua, para não derrubar o smoke test do deploy);
/ready/bots é quem decide 503. Documente em docs/rca/deploy-e-infra.md.

Teste: test/admin-bloqueio-seguro.test.js (permissão, motivo, dupla confirmação
lendo a ficha) e test/health-supervisor.test.js. Zero RAM.
```

## 6. M2 — Ficha 360° → aba Robô com ações (parar, reconectar, DLQ)

Auditoria: 4 (tabela de ações), 5.4 (wireframe da ficha), item M2.
Depende de: item 1 (o drawer de conexão já na ficha) é recomendado, não obrigatório.

```
Objetivo: na ficha /admin/clientes/[id] a admin vê o robô mas não age.
1. Rota nova POST /users/:id/session/stop (tech:write, auditada, motivo
   obrigatório): faz o mesmo que scripts/parar-sessao.mjs (marca
   stopped_by_user via `manager`, mesmo caminho do painel da cliente). Extraia a
   função para src/domain/session/ ou reuse a existente; o script passa a
   importar, nunca duplicar.
2. Na aba Robô da ficha: estado atual (sessionLiveness.js), Por que caiu, botões
   Reconectar (rota /online/:id/reconnect já existe) e Parar, ambos com confirm
   + motivo; lista dos últimos WaConnectionEvent.
3. Diagnóstico "por que não envia", elo por elo, em frases leigas: extraia as
   regras de scripts/diag-envios-vazios.mjs para src/domain/admin/diagnostics/
   envios.js (puro) e exponha em GET /users/:id/diagnostico/envios. Só banco e
   Redis, nunca bot.log. O script passa a importar o módulo.

Teste: test/admin-ficha-robo.test.js. RCA em docs/rca/admin.md.
```

## 7. M3 — Ficha 360° → aba Financeiro com Sincronizar MP e Testar renovação

Auditoria: 2.1 (inadimplência), 4, item M3.

```
Objetivo: hoje só por SSH (scripts/sincronizar-assinatura.mjs,
scripts/testar-recorrencia.mjs, scripts/diag-assinatura-recusada.mjs).
1. Extraia de sincronizar-assinatura.mjs a função pura/IO para
   src/domain/payments/subscriptionSync.js com duas etapas: `planSync()` (lê o
   MP e devolve o diff sem gravar) e `applySync(diff)` (grava). O script importa.
2. Rotas: GET /users/:id/assinatura/diff (billing:read) e POST
   /users/:id/assinatura/sincronizar (billing:write, auditada, recebe o diff
   mostrado e confirma); GET /users/:id/assinatura/testar-renovacao (billing:read,
   só leitura, chama o MP).
3. Aba Financeiro da ficha: KPIs do cliente, tabela de cobranças (reaproveite
   SubscriptionChargesPanel de dashboard/app/admin/receita/page.js filtrado por
   cliente), botão "Sincronizar com o Mercado Pago" que mostra o diff ANTES e
   pede confirm, botão "Testar renovação" com os 6 elos.

Teste: test/admin-ficha-financeiro.test.js (diff puro, rota em duas etapas,
confirm na tela). RCA em docs/rca/cobranca.md.
```

## 8. M6 — Credencial de loja no painel

Auditoria: 2.3, 3.1 (linha sondagem de vencimento), item M6.

```
Objetivo: a sondagem diária src/credentialExpiry/sweep.js já descobre chave de
loja vencida/recusada e avisa só a cliente (AnalyticsEvent
credential_expiry_alert_sent). A admin não vê.
1. Sem sondagem nova: regra pura src/domain/admin/credentialStatus.js que, a
   partir do último evento por (userId, loja), diz "ok / vencida / recusada /
   sem medição" e há quanto tempo.
2. Exponha na ficha (aba Lojas) e como motivo novo "chave-de-loja" na caixa
   /admin/hoje (src/domain/admin/inboxPriority.js: acrescente a GRAVIDADE, senão
   o teste trava de propósito).
3. Botão "Testar chave" na ficha reaproveita a função de sondagem do sweep para
   UMA conta (billing:read, rede Shopee/ML; sem gravar).

Teste: test/admin-credencial-loja.test.js. RCA em docs/rca/credenciais-e-seguranca.md.
```

## 9. M8 — Tela Auditoria (quem fez o quê)

Auditoria: 3.1 (linha AdminAuditLog), 4 (última linha), item M8.

```
Objetivo: AdminAuditLog é gravado e nunca lido.
1. GET /api/admin/audit?days=30&action=&actor=&target= (só owner/admin:read),
   paginado (take ≤ 200), filtra por ação/ator/alvo, redige payload com
   src/adminRedaction.js. A própria leitura NÃO é auditada (senão vira ruído).
2. Seção "Auditoria" em dashboard/app/admin/operacao/page.js: tabela com
   quando / quem / ação / alvo / resumo, filtros simples, link para a ficha.
3. Dicionário de ações em linguagem leiga (ex.: admin.user.block → "bloqueou a
   conta") em src/domain/admin/auditLabels.js; teste falha se existir ação
   gravada no código (grep por `action: 'admin.`) sem rótulo.

Teste: test/admin-auditoria-tela.test.js. RCA em docs/rca/admin.md.
```

## 10. Q1b — Polling do Online (vale para o que sobrar dele)

Auditoria: 3.5, item Q1b. Depende de: item 1 (se /admin/online for apagado, o
que resta é a caixa Hoje e a ficha).

```
Objetivo: nenhuma tela do admin faz polling < 60 s, e nenhuma faz polling com
a aba escondida. Onde houver setInterval em dashboard/app/admin/**, use 60 s e
pare quando document.visibilityState !== 'visible'. A leitura periódica não
grava AdminAuditLog (hoje GET /online audita a cada chamada: mude para auditar
só a primeira abertura por sessão ou não auditar leitura).
Teste: test/admin-polling.test.js varre dashboard/app/admin e falha com
setInterval < 60_000 ou sem visibilityState.
```

## 11. Performance miúda: `buildFleetScenarios`, `GET /batches`, funil com teto

Auditoria: 3.5 (linhas buildFleetScenarios, /batches, funil).

```
Objetivo: três consultas que carregam demais sem necessidade. Zero mudança de
números na tela.
a) src/api/routes/admin.js ~909 e ~922: `distinct: ['userId']` do Prisma é feito
em memória. Troque por groupBy userId (+ _max createdAt) e, onde o metadata é
necessário, busque só as linhas do _max. Guarde o comentário que explica por que
uma delas não usa distinct.
b) src/api/routes/adminEmails.js ~336: 4 consultas por lote (N+1). Um groupBy por
(batchId, status) e distribuição em memória.
c) src/domain/admin/service.js ~151 e ~289 (funil): `user.findMany` sem take. Teto
por coorte (ex.: 5.000) e `select` mínimo; a tela avisa quando truncou.
Teste: test/admin-consultas-em-lote.test.js (estrutural: nada de distinct nessas
rotas, nada de await dentro de for em /batches, take presente no funil).
```

## 12. `/admin/observabilidade` e `/admin/emails`: encaixar no menu novo

Auditoria: 5.1, 5.2.

```
Objetivo: fechar o menu de 5 entradas (Hoje, Clientes, Receita, Crescimento,
Operação).
a) /admin/observabilidade (450 l.): o que ainda é útil (GO/NO-GO, DLQ de
pagamento com reprocessar + confirm) vira seção "Saúde" em
dashboard/app/admin/operacao/page.js; a página é apagada. Mantenha a asserção de
test/admin-acoes-com-confirmacao sobre runReprocess apontando para o arquivo novo.
b) /admin/emails: dividir em Clientes → "Contato em massa" (segmentos, envio
e-mail/WhatsApp com confirmTotal) e Operação → "Modelos" (edição de templates).
Pode ser a mesma página com duas rotas, sem duplicar componente.
c) Menu do Início vira só essas 5 entradas + Capacidade/Erros dentro de Operação.
Teste: test/admin-menu-cinco-entradas.test.js. Atualize o mapa de sintomas do
AGENTS.md onde citar as páginas apagadas.
```

## 13. G3 — Receita: churn com motivo e LTV por coorte

Auditoria: 2.1, 5.5, item G3.

```
Objetivo: src/domain/admin/ltvRetention.js e churnReason.js existem e só os
scripts diag-ltv-retencao.mjs / diag-motivo-nao-renovou.mjs os usam.
Rotas GET /finance/ltv (coortes por mês de primeiro pagamento) e GET
/finance/churn?months=6 (voluntário × involuntário, com motivo), billing:read,
chamando os módulos puros sem reescrever regra. Na página
dashboard/app/admin/receita/page.js: sub-aba "Retenção" com duas tabelas e um
texto leigo por coorte. Aceite: números iguais aos dos scripts na mesma janela
(teste compara saída do módulo com fixture usada pelos testes dos scripts).
```

## 14. G4 — Diagnóstico de 1 cliente no painel (conexão)

Auditoria: 3.2, 4, item G4. Depende de: item 6 (padrão `src/domain/admin/diagnostics/`).

```
Objetivo: scripts/diag-nao-conecta.mjs só por SSH. Extraia as regras para
src/domain/admin/diagnostics/conexao.js (puro: recebe sessão, eventos,
credencial, vagas; devolve lista de "elo → ok/problema → o que fazer" em frases
leigas). Rota GET /users/:id/diagnostico/conexao (support:read). O script passa
a importar o módulo. Só banco/Redis, nunca bot.log. Mostre na aba Robô da ficha.
Teste puro com 4 cenários (nunca conectou, QR vencido, sem vaga, 405/408).
```

## 15. G5 — Design system no admin

Auditoria: item G5. Depende de: decisão da dona (seção "Admin" entra no DS v2
antes de mudar tela).

```
Objetivo: telas do admin usam Tailwind cinza solto; o DS v2
(docs/design-system/design-system-v2.html) não tem seção "Admin".
Passo 1 (decisão): proponha à usuária, em um PR só de docs, a seção "Admin" do
DS (tabela densa, chips de estado, barra de ações da ficha, cores de gravidade),
como nova versão do arquivo do DS. Só depois do OK:
Passo 2: migre as telas novas (hoje, receita, operacao, clientes/[id]) para os
tokens; Início e páginas legadas ficam para o fim. Aceite:
test/painel-escala-de-fontes passa no admin e nenhum hex solto em
dashboard/app/admin/{hoje,receita,operacao,clientes}.
```

---

### Ordem sugerida e por quê

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15.
Os cinco primeiros são os que mudam número que a dona olha todo dia (1, 2), dado
que cresce sem parar (3), tela que mente (4) e ação perigosa com permissão baixa
(5). Do 6 em diante é a ficha 360° ganhando ações; 12 fecha o menu; 13–15 são
análise e acabamento.
