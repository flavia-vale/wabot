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
      kill_timeout: 10000,
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
  ],
}
