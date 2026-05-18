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
  ],
}
