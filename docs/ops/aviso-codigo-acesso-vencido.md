# Aviso por e-mail: "o código de acesso da loja venceu"

## Por que existe

Caso real (ago/2026): uma cliente ficou **uma semana** com o código de acesso do
Mercado Livre e o da Amazon mortos — 0 link curto em 7 dias, 100% plano B — e
ninguém percebeu. O aviso existia **só dentro do painel**, e quem não abre o
painel não vê. As ofertas continuavam saindo (por isso nada gritou), mas o link
saía mais comprido e o cupom do ML sem produto deixava de ser convertido.

## Como funciona

| Peça | Arquivo |
|---|---|
| Decisão pura (janela de silêncio, `alive:null`, e-mail real) | `src/credentialExpiry/policy.js` |
| Passada (sonda + envia + grava) | `src/credentialExpiry/sweep.js` |
| Texto do e-mail (builder puro) | `src/email/credentialExpiryEmail.js` |
| Agendamento | `startCredentialExpirySweep()` em `src/api/server.js` |
| Testes db-free | `test/credential-expiry-alert.test.js` |

**Onde roda (memória):** `setInterval` + `unref()` dentro da própria API, mesmo
padrão de `startLeadNurtureSweep` / `startLogRetentionJob`. **Nenhum processo
PM2 novo, nenhum worker, nenhuma dependência nova** — o custo de RAM é uma
consulta por ciclo, sem estado acumulado (a alternativa "cron dedicado" custaria
um processo Node inteiro, ~60-80 MB, para rodar 1× por dia; foi descartada por
isso, conforme a política de memória do `AGENTS.md`).

Sequência de cada passada:

1. Carrega as credenciais de `mercadolivre` e `amazon` (as duas únicas lojas com
   código que vence e sondagem ativa).
2. Descarta quem não pode receber e-mail: endereço fabricado
   `user_*@sistema.com`, conta banida/suspensa, credencial incompleta (isso é
   outro problema — o painel já diz "falta preencher").
3. Descarta quem está na **janela de silêncio** — e faz isso **antes de sondar**,
   então quem já foi avisado e ainda não recadastrou não gera nem uma chamada a
   mais para a loja.
4. Sonda o que sobrou (`checkMercadoLivreSession` / `checkAmazonSession`),
   reaproveitando o cache curto de sondagem do painel e **persistindo a rotação
   de código** que a loja devolve (sem isso, a nossa própria checagem encurtaria
   a vida da credencial).
5. Só `alive === false` vira aviso. `alive === null` (rede fora, 403, 429,
   sondagem ocupada) **nunca** dispara — um blip da loja mandaria a cliente
   recadastrar um código vivo.
6. Manda **um** e-mail, mesmo quando as duas lojas venceram, e grava um
   `AnalyticsEvent('credential_expiry_alert_sent')` por loja.

**Anti-spam:** a data do último evento por loja é a persistência da janela de
silêncio (default **7 dias**). Sem SMTP configurado, `sendMail` é no-op e o
evento **não** é gravado — a janela não queima sem a cliente ter recebido nada.

## Envs

Todas opcionais e aditivas — sem elas, o comportamento é o default abaixo.

| Env | Default | O que faz |
|---|---|---|
| `CREDENTIAL_EXPIRY_ALERT_ENABLED` | ligado | `false` desliga a passada inteira. |
| `CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS` | `86400000` (24h) | Intervalo entre passadas (mínimo 60s). |
| `CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS` | `7` | Silêncio por loja e por cliente. |

Enquanto não houver SMTP, a passada **nem começa** (o envio seria no-op e a
sondagem gastaria chamada e rotação de código à toa).

## Ligar o envio de e-mail (SMTP)

O transporte (`src/email/mailer.js`) já existe e é provider-agnóstico; hoje
está **desligado** porque as envs `SMTP_*` não estão preenchidas — por isso o
e-mail de boas-vindas e a trilha de nutrição também não saem.

Envs necessárias (as mesmas já documentadas no `AGENTS.md`):

```
SMTP_HOST=smtp.provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contato@espelhagrupos.com.br
SMTP_PASS=<senha de aplicativo>
SMTP_FROM=BOTinho <contato@espelhagrupos.com.br>
```

Passo a passo no VPS — **staging primeiro**:

```bash
# 1) staging
nano ~/wabot-staging/.env          # adicionar as SMTP_* acima
pm2 delete api-staging             # pegadinha #1: restart --update-env NÃO troca env cacheada
cd ~/wabot-staging && pm2 start ecosystem.config.cjs --only api-staging
pm2 save
pm2 logs api-staging --lines 100 | grep credential-expiry
```

Validação em staging (sem esperar 24h): baixar a janela e o intervalo só para o
teste, com uma credencial propositalmente vencida numa conta de teste:

```bash
# no .env de staging, durante a janela de teste:
#   CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS=60000
#   CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS=1
# (reverter para os defaults ao terminar)
```

Conferir: chegou **um** e-mail; o texto fala em "código de acesso" e diz que as
ofertas continuam saindo; uma segunda passada no minuto seguinte **não** manda
outro e-mail (janela de silêncio).

```bash
# 2) produção — SÓ com OK explícito da cliente
nano ~/wabot/.env
pm2 delete api
cd ~/wabot && pm2 start ecosystem.config.cjs --only api
pm2 save
```

⚠️ Ligar SMTP em produção também **libera o e-mail de boas-vindas e a trilha de
nutrição** (que hoje são no-op). Isso é esperado, mas é bom saber antes: os
próximos cadastros passam a receber e-mail, e a trilha de nutrição dispara para
leads dos últimos 8 dias. Se não for desejado agora, ligue a trilha depois
(`LEAD_NURTURE_GO_LIVE_AT`).

## Diagnóstico

```bash
# quem já foi avisado, quando e de qual loja
sqlite3 ~/wabot/prisma/prod.db \
  "SELECT userId, metadata, createdAt FROM AnalyticsEvent
   WHERE event='credential_expiry_alert_sent' ORDER BY createdAt DESC LIMIT 20;"

# resumo da passada no log da API
pm2 logs api --lines 500 | grep credential-expiry
```

## Proposta ainda NÃO implementada: freio de tentativas na loja

Hoje uma conta com o código morto continua batendo na API do Mercado Livre a
cada oferta (~300 chamadas/dia, todas recusadas, do nosso IP). É desperdício e
risco de bloqueio por IP — que respinga em **todas** as clientes, não só na que
está com o código vencido.

Proposta (aguardando OK): um freio por conta+loja no worker — depois de **N
recusas de autenticação seguidas** (só 401/expired; nunca 403/429/rede, que são
indeterminados), parar de chamar a loja por uma janela curta (ex.: 30-60 min) e
ir direto para o plano B. Qualquer save de credencial nova no painel zera o
freio na hora (o painel já invalida o cache de sondagem — mesmo gancho).

Trade-off honesto: **parar cedo demais faz a cliente perder link curto quando a
credencial volta sozinha**. Por isso a proposta usa janela curta com meia-abertura
(deixa passar 1 chamada de teste ao fim da janela, em vez de esperar a próxima
passada diária), e só conta recusa de autenticação confirmada. Alternativa mais
conservadora: não frear nada e só instrumentar um contador
(`ops_affiliate_auth_refused`) para medir o volume real antes de decidir.
