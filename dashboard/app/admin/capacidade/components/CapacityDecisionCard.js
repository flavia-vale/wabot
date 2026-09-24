// Cartão-resumo da capacidade.
//
// O fundo escuro saiu a pedido da dona do produto (2026-09-05): destoava do
// resto do admin, que é claro, e não ajudava a ler nada — o que precisa saltar
// aos olhos é o ESTADO, e isso é trabalho da cor da tarja, não do fundo.
const STATES = {
  healthy: ['✓', 'Saudável', 'bg-emerald-100 text-emerald-900 ring-emerald-200', 'border-emerald-200'],
  attention: ['!', 'Atenção', 'bg-amber-100 text-amber-900 ring-amber-200', 'border-amber-300'],
  plan_now: ['⌁', 'Planejar agora', 'bg-orange-100 text-orange-900 ring-orange-200', 'border-orange-300'],
  critical: ['×', 'Crítico', 'bg-red-100 text-red-900 ring-red-200', 'border-red-300'],
  stale: ['↻', 'Dados desatualizados', 'bg-slate-200 text-slate-900 ring-slate-300', 'border-slate-300'],
  insufficient_data: ['?', 'Dados insuficientes', 'bg-slate-200 text-slate-900 ring-slate-300', 'border-slate-300'],
}
const mb = (number) => number == null ? '—' : `${Math.round(number).toLocaleString('pt-BR')} MB`
const when = (date) => date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(date)) : null
export default function CapacityDecisionCard({ decision, forecast }) {
  const [icon, label, cls, border] = STATES[decision?.state] || STATES.insufficient_data
  return <section className={`rounded-3xl border-2 bg-white p-6 text-slate-900 shadow-sm ${border}`} aria-labelledby="capacity-decision-title"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ${cls}`}><span aria-hidden="true">{icon}</span>{label}</span><h1 id="capacity-decision-title" className="mt-4 text-2xl font-black sm:text-3xl">Capacidade operacional</h1>{decision ? <><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Metric value={decision.sessions} label="sessões consideradas"/><Metric value={decision.headroomSessions == null ? '—' : `+${Math.max(0, decision.headroomSessions)}`} label="ainda cabem com segurança"/><Metric value={decision.safeLimit} label="limite seguro estimado"/><Metric value={decision.estimatedMaximum} label="máximo estimado (não recomendado)"/><Metric value={mb(decision.headroomMemoryMb)} label="margem segura de memória"/></div><div className="mt-6 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200 sm:grid-cols-2"><p><span className="text-slate-500">Próximo gargalo</span><strong className="block capitalize text-slate-900">{decision.bottleneck || 'desconhecido'}</strong></p><p><span className="text-slate-500">Horizonte</span><strong className="block text-slate-900">{forecast?.centralThresholdAt ? `${when(forecast.centralThresholdAt)} · confiança ${forecast.confidence}` : forecast?.explanation || 'Histórico insuficiente'}</strong></p>{forecast?.range && <p className="sm:col-span-2 text-slate-600">Faixa provável: {when(forecast.range.earliestAt)} a {when(forecast.range.latestAt)}.</p>}</div><p className="mt-6 font-semibold text-cyan-800">{decision.recommendation}</p><details className="mt-4 text-sm text-slate-600"><summary className="min-h-11 cursor-pointer py-3 font-bold text-slate-900">Como calculamos</summary><p>Política {decision.policyVersion}: reserva mínima de 20% ou 1.536 MB e custo de {decision.sessionCostMb ?? '—'} MB por sessão (o maior entre o piso de segurança e o consumo medido). Swap não aumenta a capacidade.</p></details></> : <p className="mt-4 text-slate-600">Aguardando a primeira coleta; nenhum zero será interpretado como saudável.</p>}</section>
}
function Metric({ value, label }) { return <p><strong className="block text-3xl tabular-nums text-slate-950">{value ?? '—'}</strong><span className="text-sm text-slate-500">{label}</span></p> }
