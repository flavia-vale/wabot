// PM2 de um servidor SECUNDÁRIO (nó) — só o bot-supervisor. Template, NÃO usado
// por nenhum deploy atual (o ecosystem.config.cjs de sempre segue sendo o do
// servidor principal). Num nó extra NÃO sobem api, dashboard nem snapshot-cron:
// duplicariam as tarefas diárias (ver docs/ops/multi-supervisor-ativacao.md, K11).
//
// O nome do servidor e o resto da configuração vêm do .env DESTE servidor:
//   SUPERVISOR_NODE_ROUTING=true
//   SUPERVISOR_NODE_ID=n2            (nome único, [a-z0-9-])
//   BOT_SUPERVISOR_MODE=remote
//   REDIS_URL=<o MESMO Redis do servidor principal>   DATABASE_URL=<o MESMO banco>
//   MAX_SESSIONS_PER_PROCESS=<vagas DESTE servidor>
// Mudar env exige `pm2 delete` + `pm2 start` (restart --update-env não basta).
//
//   pm2 start ecosystem.node.config.cjs
module.exports = {
  apps: [
    {
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
      },
      max_memory_restart: '400M',
      kill_timeout: 30000,
      wait_ready: false,
      listen_timeout: 10000,
    },
  ],
}
