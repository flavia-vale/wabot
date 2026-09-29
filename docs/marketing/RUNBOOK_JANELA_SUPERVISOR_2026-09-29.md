# Janela do supervisor — D2 (teto 100), D3 e C1(b) (29/09/2026)

Tudo na MESMA janela, porque reiniciar o `bot-supervisor` reconecta TODAS as
sessões. **Anunciar antes** e fazer de madrugada. Ordem: staging validado →
`.env` de produção → merge em `main` (o deploy reinicia o supervisor). Ver item 3.

## 0. O que muda

| Item | O que é | Onde |
|---|---|---|
| D2 | Teto de vagas 80 → 100 | só `.env` de produção (`MAX_SESSIONS_PER_PROCESS=100`) |
| D3 | Robôs passam a rodar o código novo | o próprio deploy de `main` reinicia o supervisor (modo `auto`); comando manual só se o deploy avisar que preservou |
| C1(b) | Mensagem no próprio número, a partir do dia 5 do teste, com o texto de prova do painel | código em `src/core/selfWelcomeMessage.js` + `bot-worker.js`; liga com `TRIAL_DECISION_SELF_MESSAGE_ENABLED=true` |

C1(b) **não precisa de comando novo no supervisor**: usa o mesmo caminho das
mensagens do piloto (o robô manda para o próprio JID). Regras: só plano
`trial`, só a partir do dia 5 (faltam ≤ 2 dias), só com ofertas publicadas > 0,
só quem tem `contactPhoneOptInAt`, no máximo UMA por dia de calendário.
Sem a env, só o e-mail do piloto (`flavia.vale@usp.br`) recebe.

## 1. Estimativa de RAM para 100 vagas (REGRA #1 da política de memória)

- Subir o teto **não usa RAM sozinho**; só usa quando as vagas enchem.
- Pela política (350 MB por robô): 100 robôs = 35 GB + reserva de 6,3 GB = ~41 GB,
  **acima dos 30,6 GB do servidor**. Ou seja: passando de ~71 robôs a política
  amarela (o limite seguro dela é 71).
- Pelo medido (≈ 0,18 GB por robô com jemalloc): 100 robôs ≈ 18 GB + 1 GB da base
  + 20% ≈ 23 GB. Cabe, mas a decisão não usa esse número (ver `docs/rca/memoria-e-capacidade.md`).
- **+20 vagas ≈ +7 GB** (pela política). Hoje 22,6 GB livres e swap zero.
- **Sinal que decide: swap.** Regra de parada: se o swap sair de zero, ou a RAM
  livre cair de 5 GB, **voltar o teto para 80** (item 5) e não aceitar cliente novo.
- Alternativa mais leve: subir em degraus (80 → 90 → 100), olhando o swap por 48 h em cada.

## 2. Antes da janela (só leitura)

```bash
grep -n "MAX_SESSIONS_PER_PROCESS" ~/wabot/.env
free -m | awk '/Mem|Swap/'
pgrep -fc "/home/deploy/wabot/src/bot-worker"
```

## 3. Janela (produção)

**O deploy de `main` JÁ reinicia o `bot-supervisor` sozinho** quando o commit toca
código dos bots (`WORKER_CODE_PATHS_RE`, modo `auto` em `scripts/deploy_safe_dashboard.sh`;
este PR mexe em `src/bot-worker.js` e `src/core/`). Ou seja: **o merge em `main` É a
janela**, e ele reconecta TODAS as sessões. Por isso o `.env` muda ANTES do merge.

1. **Anunciar** aos clientes e escolher a madrugada.
2. **Antes do merge** (só edita, não reinicia nada):

```bash
cd ~/wabot && cp .env .env.bak-$(date +%F)
grep -q '^MAX_SESSIONS_PER_PROCESS=' .env \
  && sed -i 's/^MAX_SESSIONS_PER_PROCESS=.*/MAX_SESSIONS_PER_PROCESS=100/' .env \
  || echo 'MAX_SESSIONS_PER_PROCESS=100' >> .env
grep -q '^TRIAL_DECISION_SELF_MESSAGE_ENABLED=' .env \
  && sed -i 's/^TRIAL_DECISION_SELF_MESSAGE_ENABLED=.*/TRIAL_DECISION_SELF_MESSAGE_ENABLED=true/' .env \
  || echo 'TRIAL_DECISION_SELF_MESSAGE_ENABLED=true' >> .env
```

3. **Mergear `develop` → `main`.** O deploy reinicia a API e o supervisor (o log do
   Actions mostra "bot-supervisor será reiniciado ao final").
4. Conferir (item 4). **Só se** o teto ainda aparecer 80 (PM2 guardou a env antiga —
   pegadinha #1 de `docs/rca/deploy-e-infra.md`), forçar a leitura do `.env`:

```bash
cd ~/wabot && pm2 delete api bot-supervisor && pm2 start ecosystem.config.cjs --only api,bot-supervisor && pm2 save
```

## 4. Conferir (2 min depois)

```bash
grep -h "maxSessionsPerProcess" "$(ls -t ~/.pm2/logs/bot-supervisor-out-*.log | head -1)" | tail -1   # deve mostrar 100
ps -eo pid,etime,cmd | grep "wabot/src/bot-worker" | grep -v staging | grep -v grep | head -3         # etime baixo = código novo
pgrep -fc "/home/deploy/wabot/src/bot-worker"                                                          # voltando ao número de antes
free -m | awk '/Swap/'                                                                                 # deve continuar 0
```

Acompanhar o swap por 48 h. Conferir a mensagem de C1(b): aba "Contato com
cliente" no admin mostra "Decisão do teste (a partir do dia 5)" para cada envio.

## 5. Voltar atrás

- **Só C1(b):** trocar para `TRIAL_DECISION_SELF_MESSAGE_ENABLED=false` (ou apagar a linha) e `pm2 restart bot-supervisor --update-env` (reconecta tudo).
- **Teto:** `sed -i 's/^MAX_SESSIONS_PER_PROCESS=.*/MAX_SESSIONS_PER_PROCESS=80/' ~/wabot/.env` e repetir o `pm2 delete` + `start`.

## 6. Testar C1(b) no staging antes (`~/wabot-staging`, modo `inline`)

Precisa de uma conta de teste em trial: com número conectado, ≥ 1 oferta publicada
com sucesso, `contactPhoneOptInAt` preenchido e o teste acabando em ≤ 2 dias.

```bash
cd ~/wabot-staging
echo 'TRIAL_DECISION_SELF_MESSAGE_ENABLED=true' >> .env
node -e "import('dotenv/config').then(()=>import('./src/db.js')).then(async ({default:db})=>{const u=await db.user.update({where:{email:'SEU_EMAIL_DE_TESTE'},data:{plan:'trial',accessExpiresAt:new Date(Date.now()+864e5),contactPhoneOptInAt:new Date()}});console.log('ok',u.email,u.plan);await db.\$disconnect()})"
pm2 delete api-staging && pm2 start ecosystem.config.cjs --only api-staging && pm2 save
```

Em até ~30 min (a checagem roda a cada 30 min) chega a mensagem no "Você" do
WhatsApp da conta. Uma vez por dia: para repetir no mesmo dia, apagar o evento
`ops_self_trial_decision_sent` daquela conta. **Depois do teste, devolver a conta
ao plano original.**
