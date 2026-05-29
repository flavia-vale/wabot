module.exports = {
  apps: [
    {
      name: 'api',
      script: 'src/api/server.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        API_PORT: '3001',
        AUTH_INFO_DIR: '/home/deploy/BOTinho-shared/auth_info',
        BOT_LOG_DIR: '/home/deploy/BOTinho-shared/logs',
        AUTO_START_WHATSAPP_SESSIONS: 'true',
        DASHBOARD_URL: 'https://espelhagrupos.com.br',
        API_URL: 'https://espelhagrupos.com.br',
        // BOT_SUPERVISOR_MODE e REDIS_URL ficam APENAS no .env do VPS.
        // Antes estavam hardcoded aqui, mas isso bloqueava o cutover:
        // PM2 seta env antes do dotenv rodar, e dotenv default não
        // sobrescreve process.env existente — então 'remote' no .env
        // ficava ignorado em favor do 'inline' daqui. Detalhes da
        // pegadinha #1 em AGENTS.md.
      },
      max_memory_restart: '500M',
      // kill_timeout precisa cobrir SHUTDOWN_DRAIN_TIMEOUT_MS (default 15s) +
      // cleanup do dedup/backend (~3s). Se for menor, PM2 manda SIGKILL no
      // meio do drain e mensagens em vôo voltam a ser marcadas como
      // 'Envio interrompido por reinício do worker'.
      kill_timeout: 20000,
      wait_ready: false,
      listen_timeout: 10000,
    },
    {
      name: 'dashboard',
      cwd: './dashboard',
      script: 'npm',
      args: 'start',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      max_memory_restart: '768M',
      kill_timeout: 10000,
      // Exponential backoff: evita crash loop que causa 502 contínuo quando .next está quebrado
      exp_backoff_restart_delay: 100,
      max_restarts: 8,
      min_uptime: 15000,
    },
    {
      // PR-5.F follow-up: cron diário de snapshot de canais.
      // PM2 reinicia 1x/dia às 03:00 BRT (06:00 UTC); processo roda 1x e sai.
      // autorestart:false impede reinicialização imediata após exit 0.
      name: 'snapshot-cron',
      script: 'scripts/run_channel_snapshots.mjs',
      exec_mode: 'fork',
      instances: 1,
      autorestart: false,
      cron_restart: '0 6 * * *',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
    },
    {
      // Staging mirror de 'api'. deploy_safe_staging.sh roda este config a
      // partir de ~/wabot-staging com `--only api-staging`; PM2 usa o cwd
      // de invocação para localizar o .env (que carrega DATABASE_URL,
      // JWT_SECRET, CLICK_HASH_SALT etc.). Variáveis abaixo SÃO sobrescritas
      // pelo dotenv só quando ele encontra primeiro — então mantém apenas
      // o que define ambiente, não segredos.
      name: 'api-staging',
      script: 'src/api/server.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        API_PORT: '3004',
        AUTH_INFO_DIR: '/home/deploy/wabot-staging-shared/auth_info',
        BOT_LOG_DIR: '/home/deploy/wabot-staging-shared/logs',
        AUTO_START_WHATSAPP_SESSIONS: 'true',
        DASHBOARD_URL: 'http://178.105.54.0:3006',
        API_URL: 'http://178.105.54.0:3006',
        // BOT_SUPERVISOR_MODE e REDIS_URL ficam APENAS no .env de staging
        // (~/wabot-staging/.env). Ver pegadinha #1 em AGENTS.md e comentário
        // no bloco 'api' acima.
      },
      max_memory_restart: '500M',
      kill_timeout: 20000,
      wait_ready: false,
      listen_timeout: 10000,
    },
    {
      // bot-supervisor: gerencia o ciclo de vida das sessões WhatsApp de
      // forma independente da API. Quando BOT_SUPERVISOR_MODE='remote'
      // na API, este processo é quem faz fork() dos bot-workers — então
      // pm2 restart api deixa de derrubar as sessões.
      //
      // Pré-requisito: Redis local rodando (`redis-server` em 127.0.0.1).
      // kill_timeout alto: precisa drenar comandos + parar todos os
      // workers gracefully (cada worker tem seu próprio drain de ~15s).
      name: 'bot-supervisor',
      script: 'src/supervisor/index.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        APP_ROLE: 'supervisor',
        AUTH_INFO_DIR: '/home/deploy/BOTinho-shared/auth_info',
        BOT_LOG_DIR: '/home/deploy/BOTinho-shared/logs',
        AUTO_START_WHATSAPP_SESSIONS: 'true',
        // REDIS_URL vem do .env de produção (mesma pegadinha #1).
      },
      max_memory_restart: '400M',
      kill_timeout: 30000,
      wait_ready: false,
      listen_timeout: 10000,
    },
    {
      // Espelho staging do bot-supervisor.
      name: 'bot-supervisor-staging',
      script: 'src/supervisor/index.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        APP_ROLE: 'supervisor',
        AUTH_INFO_DIR: '/home/deploy/wabot-staging-shared/auth_info',
        BOT_LOG_DIR: '/home/deploy/wabot-staging-shared/logs',
        AUTO_START_WHATSAPP_SESSIONS: 'true',
        // REDIS_URL vem do .env de staging (mesma pegadinha #1).
      },
      max_memory_restart: '400M',
      kill_timeout: 30000,
      wait_ready: false,
      listen_timeout: 10000,
    },
    {
      // telegram-offer-bot: bot do Telegram que gera uma oferta pronta a
      // partir de um link colado (src/telegram/offerBot.js). Faz long-polling
      // em getUpdates, então precisa de UM ÚNICO processo por token — rodar
      // duas instâncias com o mesmo TELEGRAM_OFFER_BOT_TOKEN causa 409
      // Conflict e o bot para de receber/responder. Token e
      // TELEGRAM_OFFER_BOT_ALLOWED_CHAT_IDS vêm do .env (pegadinha #1).
      // autorestart garante que ele volte após crash/OOM/reboot — antes
      // disso o bot só subia via `npm run telegram:offer-bot` e morria sem
      // ninguém reiniciar.
      name: 'telegram-offer-bot',
      script: 'src/telegram/offerBot.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      exp_backoff_restart_delay: 200,
      min_uptime: 10000,
    },
    {
      // Espelho staging do telegram-offer-bot. PRECISA de um token de bot
      // SEPARADO do de produção no .env de staging — senão os dois pollers
      // colidem em 409 Conflict e ambos param.
      name: 'telegram-offer-bot-staging',
      script: 'src/telegram/offerBot.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'staging',
      },
      max_memory_restart: '300M',
      exp_backoff_restart_delay: 200,
      min_uptime: 10000,
    },
    {
      // Staging mirror de 'dashboard'. cwd ./dashboard é relativo a
      // ROOT_DIR (~/wabot-staging) onde o pm2 start foi invocado.
      name: 'visual-staging',
      cwd: './dashboard',
      script: 'npm',
      args: 'start',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: '3006',
      },
      max_memory_restart: '768M',
      kill_timeout: 10000,
      exp_backoff_restart_delay: 100,
      max_restarts: 8,
      min_uptime: 15000,
    },
  ],
}
