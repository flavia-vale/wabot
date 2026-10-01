// STAGING com DOIS supervisores (n1 e n2) no MESMO VPS — para testar o roteamento
// por servidor (fila por nó, placement, fan-out, nó fora do ar) ANTES de existir
// um segundo servidor de verdade. TEMPLATE: NÃO usado por nenhum deploy.
//
// ⚠️ REGRA #1 (memória): sobe 1 processo a mais (o segundo supervisor). Estimativa
// ~100–150 MB (HIPÓTESE, não medido: meça com `pm2 list`/`ps -o rss` depois) mais
// as sessões de teste. Precisa do OK explícito da dona do produto antes de subir.
//
// Como usar (só com OK, em ~/wabot-staging):
//   1. no .env de staging (API e supervisores): SUPERVISOR_NODE_ROUTING=true,
//      SUPERVISOR_NODE_IDS=n1,n2  (a API lê as duas); BOT_SUPERVISOR_MODE=remote.
//   2. pm2 delete bot-supervisor-staging          # o supervisor único atual sai
//   3. pm2 start ecosystem.staging-multinode.config.cjs
//   4. node scripts/preflight-multi-supervisor.mjs --passo=api   # heartbeat e teto dos dois
//   Para voltar: pm2 delete bot-supervisor-staging-n1 bot-supervisor-staging-n2 e
//   `pm2 start ecosystem.config.cjs --only bot-supervisor-staging` (+ flag off no .env).
//
// SUPERVISOR_NODE_ID e AUTH_INFO_DIR vêm DAQUI (o PM2 injeta antes do dotenv, e o
// dotenv não sobrescreve), então os dois processos leem o mesmo .env e diferem só
// no que está abaixo. O n1 mantém a pasta de logins que o staging já usa.
const base = {
  script: 'src/supervisor/index.js',
  exec_mode: 'fork',
  instances: 1,
  max_memory_restart: '400M',
  kill_timeout: 30000,
  wait_ready: false,
  listen_timeout: 10000,
}
const envBase = {
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  APP_ROLE: 'supervisor',
  AUTO_START_WHATSAPP_SESSIONS: 'true',
  SUPERVISOR_NODE_ROUTING: 'true',
  BOT_SUPERVISOR_MODE: 'remote',
  // Tetos pequenos de propósito: staging é para testar lotação sem gastar memória.
  MAX_SESSIONS_PER_PROCESS: '5',
}

module.exports = {
  apps: [
    {
      ...base,
      name: 'bot-supervisor-staging-n1',
      env: {
        ...envBase,
        SUPERVISOR_NODE_ID: 'n1',
        AUTH_INFO_DIR: '/home/deploy/wabot-staging-shared/auth_info',
        BOT_LOG_DIR: '/home/deploy/wabot-staging-shared/logs',
      },
    },
    {
      ...base,
      name: 'bot-supervisor-staging-n2',
      env: {
        ...envBase,
        SUPERVISOR_NODE_ID: 'n2',
        AUTH_INFO_DIR: '/home/deploy/wabot-staging-shared/auth_info-n2',
        BOT_LOG_DIR: '/home/deploy/wabot-staging-shared/logs-n2',
      },
    },
  ],
}
