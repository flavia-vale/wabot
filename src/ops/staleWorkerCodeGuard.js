// Guard "código novo não carregado pelos bots" (RCA 2026-08).
//
// Em `BOT_SUPERVISOR_MODE=remote` quem faz `fork()` dos bot-workers é o app PM2
// `bot-supervisor`, NÃO a API. O deploy automático reinicia a `api` mas
// deliberadamente NÃO toca no supervisor — é isso que impede o deploy de
// derrubar as sessões WhatsApp (ver AGENTS.md, "Processos PM2").
//
// O efeito colateral é silencioso e caro: toda correção em `bot-worker.js` ou
// no pipeline de mensagem (`messageProcessor.js`, `core/*`) chega ao disco do
// VPS mas continua SEM VALER, porque os workers em execução seguem com o
// módulo antigo carregado em memória. Foi exatamente o que aconteceu com as
// três rodadas de fix de assinatura de grupo de origem (#1383, #1389, #1391):
// os três estavam em `main`, o deploy tinha ficado verde, e mesmo assim os 11
// bot-workers de produção rodavam código de 4 dias antes — a cliente
// continuava recebendo a assinatura e não havia nenhum aviso em lugar nenhum.
//
// Este módulo NÃO reinicia nada. Reiniciar o supervisor reconecta todas as
// sessões WhatsApp de todos os clientes de uma vez, e isso é decisão humana
// (AGENTS.md manda anunciar/agendar, nunca fazer às cegas). O objetivo aqui é
// só tirar a divergência do silêncio.
//
// Módulo puro/testável: sem I/O, sem db.js, sem analytics.js — o chamador
// decide como emitir o alerta.

// Folga para não alarmar por diferença de relógio ou por escrita de arquivo que
// acontece durante o próprio boot do supervisor (o `git pull` do deploy e o
// start dos processos são quase simultâneos num deploy normal).
export const STALE_CODE_TOLERANCE_MS = 60_000

export function shouldWarnStaleWorkerCode({
  supervisorMode,
  supervisorBootedAtMs,
  codeChangedAtMs,
  toleranceMs = STALE_CODE_TOLERANCE_MS,
} = {}) {
  // Em `inline` a própria API faz `fork()` dos workers, então o restart da API
  // no deploy já recarrega o código. A divergência só existe em `remote`.
  if (supervisorMode !== 'remote') return false

  const bootedAt = Number(supervisorBootedAtMs)
  const changedAt = Number(codeChangedAtMs)
  // Sem um dos dois lados não dá para concluir nada. Fail-safe: NÃO avisa —
  // alarme falso recorrente treina a pessoa a ignorar o alerta, que é
  // justamente o que não pode acontecer com este aviso.
  if (!Number.isFinite(bootedAt) || !Number.isFinite(changedAt)) return false
  if (bootedAt <= 0 || changedAt <= 0) return false

  return changedAt - bootedAt > toleranceMs
}

// Texto único do alerta, para log e painel dizerem a MESMA coisa (mesma regra
// de linguagem das mensagens de credencial: a pessoa lê a mesma frase em
// qualquer lugar). Sem jargão de processo — quem lê precisa saber o que fazer.
export function describeStaleWorkerCode({ supervisorBootedAtMs, codeChangedAtMs } = {}) {
  const bootedAt = Number(supervisorBootedAtMs)
  const changedAt = Number(codeChangedAtMs)
  if (!Number.isFinite(bootedAt) || !Number.isFinite(changedAt)) return ''

  const atrasoMin = Math.max(0, Math.round((changedAt - bootedAt) / 60_000))
  const horas = Math.floor(atrasoMin / 60)
  const minutos = atrasoMin % 60
  const tempo = horas > 0 ? `${horas}h${String(minutos).padStart(2, '0')}` : `${minutos}min`

  return `Os robôs estão rodando uma versão do sistema mais antiga que a instalada no servidor (${tempo} de diferença). `
    + 'Correções feitas nesse período ainda NÃO estão valendo para os clientes. '
    + 'Para aplicar é preciso reiniciar o bot-supervisor — isso reconecta todas as sessões de WhatsApp de uma vez, então escolha um horário fora do pico.'
}
