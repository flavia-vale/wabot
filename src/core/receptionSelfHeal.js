// Auto-cura: quando a sessão está conectada e PAROU DE RECEBER, o robô refaz a
// conexão sozinho — em vez de esperar a cliente clicar em "Conectar".
//
// RCA 2026-08-28 (cynthiatceles@gmail.com, terceira vez em quatro dias). Os
// eventos de conexão dela mostram o padrão inteiro:
//
//   17:23 → 18:27  sem enviar nada, ZERO eventos de conexão no meio
//   18:27:14       ela clica em Conectar
//   18:27:15       volta a enviar
//   18:27 → 19:33  para de novo, de novo sem nenhum evento de conexão
//   19:31:41       ela clica em Conectar
//   19:33          volta a enviar
//
// Ou seja: o socket não caiu, o heartbeat não falhou, o painel ficou verde — e
// mesmo assim nada entrava. Só a ação manual dela resolvia. Duas paradas de 64
// e 66 minutos no mesmo fim de tarde.
//
// A conta dela recebe de 4 a 14 mensagens POR MINUTO quando está saudável.
// Uma hora inteira sem NENHUMA é anomalia gritante — e não precisamos saber a
// causa para agir: a ação certa é a mesma que ela faz na mão, refazer a
// conexão. Por isso a decisão usa a linha de base da PRÓPRIA conta, não um
// número fixo: conta que recebe pouco naturalmente nunca dispara.
//
// Guardas (o oposto de sair reconectando à toa — reconexão repetida é o padrão
// que o WhatsApp associa a robô, ver RCA 2026-08-28 do teto de tentativas):
//   - só com a sessão conectada;
//   - só se a conta TEM linha de base (recebeu bastante na janela anterior);
//   - silêncio longo (30min por padrão);
//   - no máximo 1 por hora e 2 por dia.
//
// Puro: sem I/O, sem relógio implícito.

export const DEFAULT_SILENCE_MS = 30 * 60_000
export const DEFAULT_BASELINE_WINDOW_MS = 6 * 60 * 60_000
export const DEFAULT_MIN_BASELINE = 30
export const DEFAULT_COOLDOWN_MS = 60 * 60_000
export const DEFAULT_MAX_PER_DAY = 2

export function shouldSelfHealReception({
  now = Date.now(),
  connected = false,
  connectedSinceMs = null,
  lastAcceptedAtMs = null,
  acceptedInBaselineWindow = 0,
  lastHealAtMs = null,
  healsToday = 0,
  silenceMs = DEFAULT_SILENCE_MS,
  minBaseline = DEFAULT_MIN_BASELINE,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  maxPerDay = DEFAULT_MAX_PER_DAY,
} = {}) {
  const silencio = Math.max(60_000, Number(silenceMs) || 0)
  // `0` em qualquer teto desliga a auto-cura (escape hatch sem redeploy).
  if (!Number.isFinite(Number(minBaseline)) || Number(minBaseline) <= 0) return semCura('desligada')
  if (!Number.isFinite(Number(maxPerDay)) || Number(maxPerDay) <= 0) return semCura('desligada')

  if (!connected) return semCura('não está conectada')
  // Conexão recém-aberta ainda não teve tempo de receber nada.
  const conectadaHaMs = connectedSinceMs == null ? null : now - connectedSinceMs
  if (conectadaHaMs == null || conectadaHaMs < silencio) return semCura('conexão recente')
  // Sem histórico de recepção não dá para dizer que "parou".
  if (lastAcceptedAtMs == null) return semCura('nunca recebeu nada nesta sessão')
  if (Number(acceptedInBaselineWindow) < Number(minBaseline)) return semCura('conta sem volume que justifique alarme')
  if (now - Number(lastAcceptedAtMs) < silencio) return semCura('recebeu algo na janela')
  if (Number(healsToday) >= Number(maxPerDay)) return semCura('teto diário de auto-cura atingido')
  if (lastHealAtMs != null && now - Number(lastHealAtMs) < Math.max(0, Number(cooldownMs) || 0)) {
    return semCura('em cooldown desde a última auto-cura')
  }

  return {
    heal: true,
    reason: 'conectada e sem receber nada, numa conta que costuma receber muito',
    silentForMs: now - Number(lastAcceptedAtMs),
    baseline: Number(acceptedInBaselineWindow),
  }
}

function semCura(reason) {
  return { heal: false, reason, silentForMs: null, baseline: null }
}
