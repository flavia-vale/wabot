// Quem PEDIU a conexão do WhatsApp e não conseguiu — o balde que é obstáculo
// NOSSO, não decisão dela.
//
// Item B2 do plano de ativação de 2026-09-08. Na medição de 60 dias, 11 das 114
// pessoas que não pagaram tentaram conectar e não conseguiram; três delas caem
// em 22 e 23/08, o que tem cara de incidente e não de acaso. O funil separa
// esse caso de "nem chegou a pedir" justamente para defeito de produto não se
// esconder atrás de "ela não quis" — mas hoje esse número só aparece se alguém
// abrir o `/admin/funil` e for procurar. Aviso que ninguém lê não é aviso.
//
// Módulo PURO: recebe as linhas já carregadas e devolve quem contatar.
//
// ⚠️ Limite conhecido do sinal: `WaSession` não tem coluna de criação, então a
// idade vem de `updatedAt` — que é a ÚLTIMA tentativa, não a primeira. Mesma
// limitação já documentada em `waDisconnectedSince` (lifecycleSweep.js). Para
// esta pergunta ("tentou e continua sem conectar") a última tentativa é
// justamente o que interessa, mas não confundir com "quando ela começou".

const MS_PER_HOUR = 60 * 60 * 1000

/** Só avisa depois de um dia: reconexão normal se resolve em minutos. */
export const PAIRING_STALLED_MIN_HOURS = Number(process.env.PAIRING_STALLED_MIN_HOURS || 24)

/**
 * Depois de uma semana para de insistir. Quem tentou há 20 dias e não voltou é
 * assunto de recuperação, não de incidente — e um alerta que repete para
 * sempre treina a pessoa a ignorar justamente este.
 */
export const PAIRING_STALLED_MAX_HOURS = Number(process.env.PAIRING_STALLED_MAX_HOURS || 7 * 24)

/** Quantas contas cabem no aviso. O resto vira contagem. */
export const PAIRING_STALLED_MAX_LISTED = 10

/**
 * @param {object} args
 * @param {Array<{userId:string, email?:string, name?:string, status?:string, phone?:string|null,
 *                lastHeartbeatAt?:Date|null, updatedAt?:Date|null, everConnected?:boolean}>} args.sessions
 * @param {Date} [args.now]
 * @returns {Array<{userId:string, email:string|null, name:string|null, horas:number}>}
 */
export function selectStalledPairings({
  sessions = [],
  now = new Date(),
  minHours = PAIRING_STALLED_MIN_HOURS,
  maxHours = PAIRING_STALLED_MAX_HOURS,
} = {}) {
  const agora = (now instanceof Date ? now : new Date(now)).getTime()
  const achados = []

  for (const s of sessions) {
    if (!s?.userId) continue
    // Conectada agora, ou que já conectou alguma vez, não é este caso: quem já
    // conectou e caiu tem o aviso de "robô fora do ar", que é outra conversa.
    if (s.status === 'connected') continue
    if (s.everConnected) continue
    if (s.phone || s.lastHeartbeatAt) continue

    const quando = s.updatedAt ? new Date(s.updatedAt).getTime() : NaN
    if (!Number.isFinite(quando)) continue

    const horas = (agora - quando) / MS_PER_HOUR
    if (horas < minHours || horas > maxHours) continue

    achados.push({
      userId: s.userId,
      email: s.email ?? null,
      name: s.name ?? null,
      horas: Math.round(horas),
    })
  }

  // Mais antigas primeiro: são as que estão esperando há mais tempo.
  return achados.sort((a, b) => b.horas - a.horas)
}

/** Monta o corpo do aviso interno. Puro. */
export function describeStalledPairings(achados = [], maxListed = PAIRING_STALLED_MAX_LISTED) {
  const total = achados.length
  const listadas = achados.slice(0, maxListed)
  const linhas = listadas.map((a) => {
    const quem = a.name ? `${a.name} (${a.email || 'sem e-mail'})` : (a.email || a.userId)
    return `- ${quem} — pediu a conexão há ${a.horas}h e não conectou`
  })
  const resto = total - listadas.length
  return {
    total,
    resumo: total === 1
      ? '1 pessoa pediu a conexão do WhatsApp e não conseguiu'
      : `${total} pessoas pediram a conexão do WhatsApp e não conseguiram`,
    lista: linhas.join('\n') + (resto > 0 ? `\n- e mais ${resto}` : ''),
  }
}
