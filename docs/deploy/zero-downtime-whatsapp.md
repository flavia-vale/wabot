# Plano de continuidade para WhatsApp e deploy sem logout

## Diagnóstico da causa raiz

O bot usa Baileys com `useMultiFileAuthState`, então os tokens de login ficam em arquivos locais. Antes desta mudança, o caminho era sempre `./auth_info/<userId>`, dentro do diretório do projeto. Isso cria risco em deploys que limpam a pasta do repo, fazem checkout limpo, trocam release por symlink, rodam o processo a partir de outro `cwd` ou removem arquivos locais sem querer.

Além disso, o manager mantém a lista de bots em memória. Quando o processo `api` é reiniciado, essa lista é perdida e os workers filhos são encerrados. Sem retomada automática, o usuário precisa iniciar o bot manualmente mesmo que os tokens ainda existam.

## Mudança de arquitetura aplicada

A sessão WhatsApp e os arquivos de deduplicação agora podem ser desacoplados do release por variáveis de ambiente:

- `AUTH_INFO_DIR`: diretório persistente onde cada usuário terá uma subpasta com os tokens Baileys.
- `BOT_LOG_DIR`: diretório persistente para arquivos operacionais do worker, como deduplicação.
- `AUTO_START_WHATSAPP_SESSIONS`: quando diferente de `false`, a API retoma no boot as sessões salvas no banco com status `connected` ou `connecting`.

Em produção na VPS, use diretórios fora do repo, por exemplo:

```bash
mkdir -p /home/deploy/wabot-shared/auth_info /home/deploy/wabot-shared/logs
chmod 700 /home/deploy/wabot-shared/auth_info /home/deploy/wabot-shared/logs
```

Depois, configure o PM2 ou `.env` com:

```bash
AUTH_INFO_DIR=/home/deploy/wabot-shared/auth_info
BOT_LOG_DIR=/home/deploy/wabot-shared/logs
AUTO_START_WHATSAPP_SESSIONS=true
```

## Estratégia PM2 recomendada para o MVP

Para este MVP, mantenha `api` em `fork` com `instances: 1`. Não use cluster para a API enquanto o mesmo processo também supervisiona os sockets WhatsApp, porque múltiplas instâncias podem tentar abrir a mesma sessão.

Use `pm2 reload api --update-env` em vez de `pm2 restart api` sempre que possível. O reload envia sinal de encerramento e dá tempo para a API fechar de forma graciosa. A sessão não é apagada; o novo processo relê `AUTH_INFO_DIR` e retoma os bots a partir do status salvo no banco.

Fluxo seguro de deploy:

```bash
cd /home/deploy/wabot
git fetch origin main
git checkout main
git pull --ff-only origin main
npm ci
npx prisma migrate deploy
mkdir -p /home/deploy/wabot-shared/auth_info /home/deploy/wabot-shared/logs
chmod 700 /home/deploy/wabot-shared/auth_info /home/deploy/wabot-shared/logs
pm2 startOrReload ecosystem.config.cjs --only api --update-env
cd /home/deploy/wabot/dashboard
npm ci
npm run build
cd /home/deploy/wabot
pm2 startOrReload ecosystem.config.cjs --only dashboard --update-env
pm2 save
curl -f http://127.0.0.1:3001/ready
curl -f http://178.105.54.0/health || true
```

## Nginx como reverse proxy

Configure o Nginx para apontar `/api` e WebSocket para `127.0.0.1:3001`, e o dashboard para `127.0.0.1:3000`. Exemplo:

```nginx
upstream wabot_api {
  server 127.0.0.1:3001 max_fails=3 fail_timeout=10s;
  keepalive 32;
}

upstream wabot_dashboard {
  server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
  keepalive 32;
}

server {
  listen 80;
  server_name 178.105.54.0;

  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  location /api/session/qr {
    proxy_pass http://wabot_api;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 75s;
    proxy_send_timeout 75s;
  }

  location /api/ {
    proxy_pass http://wabot_api;
    proxy_connect_timeout 2s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
  }

  location /health {
    proxy_pass http://wabot_api/health;
  }

  location / {
    proxy_pass http://wabot_dashboard;
    proxy_connect_timeout 2s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
  }
}
```

## Staging e production na mesma VPS

Use processos, portas e bancos separados:

- Production: `/home/deploy/wabot`, branch `main`, `API_PORT=3001`, dashboard `PORT=3000`, `AUTH_INFO_DIR=/home/deploy/wabot-shared/auth_info`.
- Staging: `/home/deploy/wabot-staging`, branch de teste, `API_PORT=3101`, dashboard `PORT=3100`, `AUTH_INFO_DIR=/home/deploy/wabot-staging-shared/auth_info`.

Não compartilhe `DATABASE_URL`, `AUTH_INFO_DIR` ou `BOT_LOG_DIR` entre staging e production. Para staging com WhatsApp real, use outro número ou outra conta de teste para evitar conflito com a sessão de produção.

## Possíveis breaking changes

- Se `AUTH_INFO_DIR` for alterado para um diretório novo sem copiar as sessões antigas, os usuários precisarão ler QR novamente. Migre com `cp -a /home/deploy/wabot/auth_info/. /home/deploy/wabot-shared/auth_info/` antes do reload.
- Se a API for rodada em PM2 cluster com mais de uma instância, pode haver tentativa duplicada de retomada de sockets. Mantenha `instances: 1` até separar o supervisor de bots da API.
- `pm2 restart` ainda derruba o processo de forma mais abrupta que `reload`; use `startOrReload`/`reload` no deploy.
