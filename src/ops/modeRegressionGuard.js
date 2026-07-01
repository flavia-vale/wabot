// Guard anti-reversão de modo (RCA docs/rca-sessoes-whatsapp-caindo-2026-07.md
// — Trilho C). Em produção, sessões WhatsApp só sobrevivem a deploy da API
// quando BOT_SUPERVISOR_MODE=remote (workers são filhos do bot-supervisor).
// Se alguém reverter o `.env` para `inline` (ou deixar em branco) num
// ambiente que já tem sessão conectada, a próxima janela de deploy derruba
// todas as sessões silenciosamente — o mesmo incidente que motivou o cutover
// de staging para `remote`. Este módulo só decide se o alerta deve disparar;
// não decide o que fazer com ele (isso é responsabilidade do chamador).
//
// Módulo puro/testável: não importa db.js nem analytics.js, para poder ser
// testado sem banco e para o chamador escolher como emitir o alerta.
export function shouldWarnModeRegression({ appEnv, supervisorMode, hasConnectedSession }) {
  return appEnv === 'production' && supervisorMode !== 'remote' && Boolean(hasConnectedSession)
}
