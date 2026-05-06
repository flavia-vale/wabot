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
        AUTH_INFO_DIR: '/home/deploy/wabot-shared/auth_info',
        BOT_LOG_DIR: '/home/deploy/wabot-shared/logs',
        AUTO_START_WHATSAPP_SESSIONS: 'true',
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
      max_memory_restart: '500M',
      kill_timeout: 10000,
    },
  ],
}
