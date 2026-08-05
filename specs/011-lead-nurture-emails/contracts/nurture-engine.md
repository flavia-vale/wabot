# Contract — Nurture engine (módulos puros + passada)

Superfície interna consumida pelo `setInterval` em `src/api/server.js` e pela rota de unsubscribe.
Lógica pura separada da passada para testes db-free (espelha `sessionPersistencePolicy.js`).

## `src/email/nurtureEmails.js` (puro)

```
NURTURE_STEPS: ReadonlyArray<{ step: 0|2|5|7, milestoneDays: number, theme: string }>

buildNurtureEmail(step, { name, unsubscribeUrl, dashboardUrl }): { subject, text, html }
```

- Função **pura** (sem env/rede), como `buildWelcomeEmail`. Conteúdo pt-BR, marca **BOTinho**.
- **Contrato de conteúdo (garantido por teste)**: `text` **e** `html` de todo passo contêm
  `unsubscribeUrl`. Nenhum passo omite o link (FR-004, SC-004).
- `dashboardUrl` resolve como em `welcomeEmail.js` (`DASHBOARD_URL`/`API_URL`/default).

## `src/leadNurture/policy.js` (puro)

```
isRealEmail(email): boolean
  // false p/ vazio, formato inválido, ou terminando em '@sistema.com'

isWithinActiveWindow(createdAt, now, { maxDays=8 }): boolean

elapsedDays(createdAt, now): number   // dias inteiros decorridos (floor)

computeDueSteps({ createdAt, now, sentSteps, isUnsubscribed }): number[]
  // retorna passos a enviar AGORA:
  //   [] se isUnsubscribed
  //   senão { s ∈ steps(2,5,7) : elapsedDays(createdAt,now) >= s AND s ∉ sentSteps }
  //   (o passo 0 é coberto pelo welcome; não é responsabilidade da passada)
```

- **Puras/determinísticas** — sem `Date.now()` interno (recebem `now`), sem I/O.
- `computeDueSteps` é o coração da idempotência (FR-006) e da recuperação de passada perdida
  (FR-011): baseia-se em tempo decorrido, não em "hoje é o dia N".

## `src/leadNurture/unsubscribeToken.js` (puro)

```
signUnsubscribeToken(userId, secret): string
verifyUnsubscribeToken(token, secret): { userId } | null   // compare em tempo constante
```

## `src/leadNurture/sweep.js` (efeitos, injetável)

```
runNurtureSweep({ db, sendMail, now = new Date(), logger, secret, baseUrl }): 
  Promise<{ scanned, sent, skipped, failed, failures: Array<{userId, step, error}> }>
```

Algoritmo:
1. `leads = db.user.findMany` na janela ativa (`createdAt` entre `now-8d` e `now`), filtrando
   e-mail real; aplica `LEAD_NURTURE_GO_LIVE_AT` se setada.
2. Para cada lead (**isolamento por item — try/catch, `continue` no erro; FR-009**):
   - Carrega `nurture_email_sent` (→ `sentSteps`) e existência de `nurture_unsubscribed` do `userId`.
   - `due = computeDueSteps({ createdAt, now, sentSteps, isUnsubscribed })`.
   - Para cada `step ∈ due` (em ordem crescente):
     - `unsubscribeUrl = baseUrl + '/api/lead-nurture/unsubscribe?token=' + signUnsubscribeToken(userId, secret)`.
     - `{subject,text,html} = buildNurtureEmail(step, {...})`.
     - `res = await sendMail({ to: email, subject, text, html })`.
     - **Se `res.skipped` → NÃO grava evento** (não queima o passo; SC-006). `skipped++`.
     - Senão → grava `AnalyticsEvent nurture_email_sent{step}` e `sent++`.
3. Retorna o sumário (para log/observabilidade; sem lançar).

Contrato de robustez:
- **Nunca lança** para o chamador (o `setInterval` não pode morrer). Erros de item são coletados.
- `sendMail` e `db` injetáveis → testes sem SMTP/DB real.
- Sem SMTP: `sendMail` devolve `{skipped:true}` em tudo → sweep termina `sent=0`, sem gravar eventos.

## `src/api/server.js` (wiring)

```
function startLeadNurtureSweep() {
  const run = () => runNurtureSweep({ db, sendMail, secret: process.env.JWT_SECRET, ... })
                      .catch(err => app.log.error(...))
  run()                                  // best-effort no boot
  const timer = setInterval(run, LEAD_NURTURE_SWEEP_INTERVAL_MS)  // default 24h
  timer.unref?.()
}
```
Chamado uma vez no boot, junto dos demais `start*Job()`. Espelha `startLogRetentionJob`.

## `src/api/routes/auth.js` (semeadura do dia 0 — D4)

Após o `sendWelcomeEmail(...)` fire-and-forget no `/register`, e **somente se** o e-mail é real e o
lead não está descadastrado, gravar `AnalyticsEvent nurture_email_sent{step:0}` para o `userId` —
marcando o dia 0 como coberto pelo welcome (evita duplicação; a passada só cuida de 2/5/7).
