# Isolar staging da caixa de produção (combate à saturação de CPU)

## Problema observado (2026-06)

Usuários relataram lentidão intermitente para carregar **landing, login e
cadastro**. Investigação no VPS de prod (`wabot-prod`) mostrou:

```
nproc          → 2          # só 2 cores
top → %Cpu(s): 95.2 us, 0.0 id     # 0% idle: ambos os cores saturados
       PID 2303626 node  136.4 %CPU  # um processo node passando de 1 core
```

Quando a CPU satura, **todo HTTP** (SSR da landing pelo Next, `/api/auth/login`,
`/api/auth/register`) fica esperando o event loop ganhar CPU → lentidão de
segundos. É **intermitente**: só aparece durante picos (envio de oferta com
processamento de imagem via `sharp`, descriptografia libsignal do Baileys,
reconexão de sessão). Por isso é difícil de reproduzir sob demanda.

A mesma caixa de 2 cores roda **prod E staging juntas**:

| Prod                                   | Staging (na MESMA máquina)             |
|----------------------------------------|----------------------------------------|
| `api` (+ bot-workers inline)           | `api-staging` (+ bot-workers)          |
| `dashboard`                            | `visual-staging`                       |
| `bot-supervisor`                       | `bot-supervisor-staging`               |
| `telegram-offer-bot`                   | (`telegram-offer-bot-staging`)         |
| `snapshot-cron`                        |                                        |

Staging dobra a quantidade de processos Node disputando os 2 cores. Pior: foi
observado o `offer-cron` de staging em **loop de falha** (`[offer-cron]
automation ... failed: Bot não está rodando`) a cada tick, desperdiçando
CPU/IO/log. (O bug do loop foi corrigido em código — ver "Correções de código
relacionadas" no fim — mas a contenção estrutural de rodar staging junto
permanece.)

> **O cutover `inline → remote` NÃO resolve isto.** Ele desacopla *restart*
> (reiniciar a API deixa de derrubar sessões), mas supervisor e API rodam na
> mesma máquina — não adiciona CPU. Ver `docs/deploy/supervisor-cutover.md`.

## Opções (da mais barata à mais robusta)

### Opção A — Pausar staging quando não estiver testando (quick win, 0 custo)

Staging só precisa estar de pé durante validação manual de uma PR em `develop`.
Fora disso, mantê-la parada devolve os cores à prod.

```bash
# Parar staging (libera CPU/RAM imediatamente)
pm2 stop api-staging visual-staging bot-supervisor-staging telegram-offer-bot-staging
pm2 save

# Religar só quando for validar algo em http://178.105.54.0:3006
pm2 start ecosystem.config.cjs --only api-staging
pm2 start ecosystem.config.cjs --only visual-staging
pm2 start ecosystem.config.cjs --only bot-supervisor-staging   # só se for testar modo remote
pm2 save
```

Cuidado: o **deploy automático de staging** (`scripts/deploy_safe_staging.sh`,
disparado por merge em `develop`) faz `pm2 restart api-staging` /
`visual-staging`. Se staging estiver parada, o deploy vai religá-la. Para manter
parada de propósito entre validações, pause o autodeploy ou simplesmente
`pm2 stop` de novo após o deploy. Não é "isolamento" de verdade — é mitigação.

> Pegadinha #1 (AGENTS.md): mudar `.env` exige `pm2 delete && start`, não
> `restart --update-env`. Para só ligar/desligar (sem trocar env), `stop`/`start`
> bastam.

### Opção B — Mover staging para um VPS separado (recomendado)

Isolamento real: prod nunca mais compete com staging por CPU. Staging é barata
(pode ser o menor droplet). Passos macro:

1. **Provisionar** uma VM nova (1–2 vCPU, 2 GB já servem para staging) com Node
   na mesma major, PM2, `redis-server` local e Nginx (se for expor por domínio;
   hoje staging é HTTP puro em `http://178.105.54.0:3006`, então pode seguir sem
   TLS).
2. **Clonar** o repo em `~/wabot-staging` e checar `develop`.
3. **Recriar os `.env`** de staging (NÃO copiar de prod — segredos são
   exclusivos por ambiente; ver AGENTS.md):
   - `~/wabot-staging/.env`: `APP_ENV=staging`, `API_PORT=3004`,
     `DATABASE_URL=file:./staging.db` (atenção à pegadinha #2 do AGENTS.md sobre
     caminho relativo ao schema), `JWT_SECRET` próprio,
     `CREDENTIAL_ENCRYPTION_KEY` própria (64 hex), `AUTH_INFO_DIR` próprio,
     `REDIS_URL=redis://127.0.0.1:6379/1`, `BOT_SUPERVISOR_MODE` (inline/remote),
     e **`TELEGRAM_OFFER_BOT_TOKEN` DIFERENTE do de prod** (token duplicado =
     409 Conflict, ver `docs/telegram/offer-bot.md`).
   - `~/wabot-staging/dashboard/.env.local`: `PORT=3006`,
     `NEXT_PUBLIC_FORCE_SAME_ORIGIN_API=true`.
4. **Migrar o banco de staging** para a nova VM (é um arquivo SQLite; use
   `sqlite3 .backup` — WAL-safe — e copie `*.db`/`-wal`/`-shm`, ver AGENTS.md).
   NUNCA copiar o banco de prod por cima.
5. **Apontar o GitHub Actions de staging** (`SSH` host/user dos secrets) para o
   novo VPS, OU rodar o deploy de staging só nessa VM. O workflow
   (`.github/workflows/deploy.yml`) usa `REMOTE_HOST`/`REMOTE_USER` — se prod e
   staging passam a ter hosts diferentes, separar os jobs/segredos por ambiente.
6. **Remover os apps de staging do PM2 de prod**:
   ```bash
   pm2 delete api-staging visual-staging bot-supervisor-staging telegram-offer-bot-staging
   pm2 save
   ```
7. Validar staging na nova VM (`http://<novo-ip>:3006`) e prod intocada.

Impacto esperado: prod deixa de ter ~4 processos Node concorrentes; picos de
CPU param de afetar landing/login/cadastro.

### Opção C — Escalar a prod para ≥4 cores (complementar)

Mesmo com staging isolada, prod tem `api` + N bot-workers (inline) +
`dashboard` + `telegram-offer-bot` + `snapshot-cron` em 2 cores. Um único envio
de oferta com `sharp` já estoura >1 core (visto: 136%). Subir para 4 vCPU dá
folga para o pico de imagem/cripto não travar o HTTP. Vertical scaling no painel
do provedor + `pm2 resurrect` após o resize. Combina bem com a Opção B.

## Como confirmar o ganho

Antes e depois, durante horário de pico de envios:

```bash
pm2 monit                              # CPU por app ao vivo
top -b -n1 | head -15                  # %idle deve deixar de zerar
# tempo de resposta da landing e do login (de fora da caixa):
curl -o /dev/null -s -w "landing: %{time_total}s\n"  http://espelhagrupos.com.br/
curl -o /dev/null -s -w "login:   %{time_total}s\n"  -X POST \
  -H 'content-type: application/json' -d '{"email":"x@x.com","password":"zzzzzzzz"}' \
  http://espelhagrupos.com.br/api/auth/login
```

Meta: `%Cpu idle` não chegar a 0 durante picos; `time_total` da landida/login
estável na casa de centenas de ms, sem outliers de segundos.

## Correções de código relacionadas (já mergeáveis nesta branch)

Estas reduzem o desperdício de CPU/IO independentemente da decisão de infra:

- **Backoff exponencial no poller do Telegram** (`src/telegram/offerBot.js`):
  para de re-tentar a cada 1s quando o egress para `api.telegram.org` falha.
- **`await` no guard `isRunning` do dispatcher** + **curto-circuito por
  `listRunningBots` no offer-cron** (`src/offerAutomation/`): elimina o loop de
  `sendBroadcast` falho ("Bot não está rodando") a cada tick — principal fonte
  do flood de log de staging.
- **Fontes auto-hospedadas via `next/font`** (`dashboard/`): remove o `@import`
  render-blocking do Google Fonts, melhorando o tempo de carregamento percebido
  da landing para visitantes com cache frio.

## Não fazer

- Não copiar `.env` nem banco de prod para staging (ou vice-versa).
- Não reusar o mesmo `TELEGRAM_OFFER_BOT_TOKEN` entre ambientes (409 Conflict).
- Não tratar o cutover `remote` como solução de CPU — é solução de *restart*.
- Não trocar portas sem atualizar os 3 lugares canônicos (AGENTS.md).
