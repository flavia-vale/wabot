// Cliente da captura de lead das ferramentas gratuitas.
// Contrato e motivo em src/marketing/leadCapture.js.

const LEADS_ENDPOINT = '/api/public/v1/leads'

/**
 * Envia o lead e espera a resposta. Use quando a pessoa CONTINUA na página
 * (calculadoras), porque aí dá para mostrar sucesso ou erro para ela.
 */
export async function submitLead({ email, source, context = {} }) {
  const res = await fetch(LEADS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source, context }),
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(`lead_capture_failed_${res.status}`)
  return true
}

/**
 * Envia o lead SEM esperar resposta, sobrevivendo à navegação que acontece logo
 * em seguida. Use no diagnóstico, onde o submit do formulário já leva a pessoa
 * para o cadastro — um `fetch` comum seria cancelado no meio pela navegação e o
 * lead se perderia justamente de quem demonstrou mais interesse.
 *
 * Best-effort de propósito: falhar aqui não pode atrapalhar o cadastro, que é a
 * conversão mais valiosa.
 */
export function submitLeadBeacon({ email, source, context = {} }) {
  const body = JSON.stringify({ email, source, context })

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(LEADS_ENDPOINT, blob)) return
    }
  } catch {}

  try {
    fetch(LEADS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {})
  } catch {}
}
