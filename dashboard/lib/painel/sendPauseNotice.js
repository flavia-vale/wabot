// "Envio pausado agora: fora do horário (8h–22h)" — aviso da tela de
// Espelhamento (RCA 2026-09-24).
//
// Antes, uma oferta que chegava à noite ficava presa na fila e era descartada
// às 8h, e a tela seguia dizendo "Espelhamento ligado" sem nenhuma pista de
// que nada ia sair até de manhã. O aviso é calculado AQUI, em cima do que a
// página já carregou (`GET /groups` devolve `sendWindow` efetivo por destino) —
// nenhuma chamada nova à API, nenhuma consulta nova ao banco.
//
// Regras:
// - Só destinos (role 'post') com horário ligado entram na conta.
// - Só avisa quando TODOS os destinos estão fechados agora. Destino sem
//   horário envia 24h e conta como aberto — parte das ofertas sai, então não
//   avisa.
// - Sem destino nenhum → null.
import { formatSendWindowLabel, sendWindowState } from '../../../src/core/sendWindow.js'

function hourLabel(h) {
  return `${h}h`
}

export function describeSendPause(groups = [], now = Date.now()) {
  const destinations = (Array.isArray(groups) ? groups : []).filter((g) => g?.role === 'post')
  if (!destinations.length) return null

  const closed = []
  for (const g of destinations) {
    const w = g?.sendWindow
    // Destino sem horário envia a qualquer hora: se existe um assim, parte
    // das ofertas sai agora e o aviso mentiria.
    if (!w || !Number.isFinite(w.startHour) || !Number.isFinite(w.endHour)) return null
    const state = sendWindowState(now, w)
    if (state.open) return null
    closed.push({ id: g.id, name: g.name, window: w, waitMs: state.waitMs })
  }
  if (!closed.length) return null

  // O destino que abre PRIMEIRO dita a hora de retorno.
  const soonest = closed.reduce((a, b) => (b.waitMs < a.waitMs ? b : a))
  const windows = new Set(closed.map((c) => formatSendWindowLabel(c.window)))
  const label = windows.size === 1 ? formatSendWindowLabel(soonest.window) : 'horário de cada destino'
  return {
    title: `Envio pausado agora: fora do horário (${label})`,
    detail: `As ofertas voltam a sair às ${hourLabel(soonest.window.startHour)}. Oferta que chegar agora e não conseguir sair antes do limite de espera é descartada na hora, com o motivo na aba Envios.`,
    opensAtHour: soonest.window.startHour,
    destinations: closed.map((c) => ({ id: c.id, name: c.name })),
  }
}
