// Liga/desliga dos vários números por conta (docs/rca/multi-numero.md).
// Desligado (padrão) = produto exatamente como antes: nenhuma reserva liga,
// nenhuma troca automática roda, nenhuma rota da reserva responde.
export function multiNumberEnabled(env = process.env) {
  return String(env?.MULTI_NUMBER_ENABLED ?? '').trim().toLowerCase() === 'true'
}
