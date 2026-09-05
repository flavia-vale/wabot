// "Contratado versus utilizado" — agora com o lado UTILIZADO na tela.
//
// RCA 2026-09-05: o bloco tinha esse título mas mostrava só o inventário da
// Hetzner (servidores, volumes, IPs, custo). Sem token de leitura configurado o
// inventário vem vazio, e a dona do produto via "sem medição" permanente num
// bloco que deveria responder "do que eu paguei, quanto estou usando?".
//
// A comparação agora vem das MEDIÇÕES do próprio servidor (`resources`), que
// sempre existem quando há coleta. O inventário externo virou detalhe
// secundário: quando falta, o que falta é ele — não a comparação.
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null
const gb = (mb) => { const value = finite(mb); return value == null ? '—' : `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} GB` }
const pct = (value) => value == null ? '—' : `${Math.round(value)}%`
const share = (part, total) => { const a = finite(part); const b = finite(total); return a == null || !b ? null : Math.max(0, Math.min(100, a / b * 100)) }

// Mesma escala de leitura dos cartões de recurso: verde até 75%, âmbar até 90%.
const tone = (usedPercent) => usedPercent == null
  ? { bar: 'bg-slate-400', text: 'text-slate-600', label: 'sem medição' }
  : usedPercent >= 90 ? { bar: 'bg-red-500', text: 'text-red-700', label: 'no limite' }
  : usedPercent >= 75 ? { bar: 'bg-amber-500', text: 'text-amber-700', label: 'apertado' }
  : { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'folgado' }

function Linha({ titulo, contratado, utilizado, livre, usedPercent }) {
  const t = tone(usedPercent)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-black text-slate-900">{titulo}</p>
        <p className={`text-sm font-black ${t.text}`}>{pct(usedPercent)} em uso · {t.label}</p>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, Math.min(100, usedPercent ?? 0))}%` }} />
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-slate-500">Contratado</dt><dd className="font-bold tabular-nums text-slate-900">{contratado}</dd></div>
        <div><dt className="text-slate-500">Utilizado</dt><dd className="font-bold tabular-nums text-slate-900">{utilizado}</dd></div>
        <div><dt className="text-slate-500">Livre</dt><dd className="font-bold tabular-nums text-slate-900">{livre}</dd></div>
      </dl>
    </div>
  )
}

export default function CapacityInventory({ host, resources = {}, counts = {}, decision = null }) {
  if (!host) return null
  const inventory = host.inventory || {}
  const servers = inventory.servers || []
  const totals = inventory.totals || {}
  const checked = host.checkedAt ? new Date(host.checkedAt).toLocaleString('pt-BR') : 'não conferido'
  const cost = inventory.cost
  const temInventario = Boolean(servers.length || totals.servers || cost)

  const ramTotal = finite(resources.memory?.totalMb) ?? finite(host.memoryTotalMb)
  const ramLivre = finite(resources.memory?.availableMb)
  const ramUsada = ramTotal != null && ramLivre != null ? Math.max(0, ramTotal - ramLivre) : null
  const discoTotal = finite(resources.disk?.totalMb) ?? finite(host.diskTotalMb)
  const discoUsado = finite(resources.disk?.usedMb)
  const discoLivre = finite(resources.disk?.availableMb)
  const cpuPercent = finite(resources.cpu?.percent)
  const vcpu = finite(host.vcpu)
  const sessoes = finite(counts.connectedSessions) ?? finite(counts.productionWorkers)
  const limiteSeguro = finite(decision?.safeLimit)

  return (
    <section aria-labelledby="capacity-inventory" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="capacity-inventory" className="font-black text-slate-950">Contratado versus utilizado</h2>
          <p className="mt-1 text-sm text-slate-600">{host.serverType} · {host.vcpu} vCPU · {gb(host.memoryTotalMb)} RAM · {gb(host.diskTotalMb)} disco</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Medido em {checked}</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Linha titulo="Memória RAM" contratado={gb(ramTotal)} utilizado={gb(ramUsada)} livre={gb(ramLivre)} usedPercent={share(ramUsada, ramTotal)} />
        <Linha titulo="Disco" contratado={gb(discoTotal)} utilizado={gb(discoUsado)} livre={gb(discoLivre)} usedPercent={finite(resources.disk?.usedPercent) ?? share(discoUsado, discoTotal)} />
        <Linha titulo="CPU" contratado={vcpu == null ? '—' : `${vcpu} vCPU`} utilizado={pct(cpuPercent)} livre={cpuPercent == null ? '—' : pct(100 - cpuPercent)} usedPercent={cpuPercent} />
        <Linha
          titulo="Robôs conectados"
          contratado={limiteSeguro == null ? '—' : `${limiteSeguro} com segurança`}
          utilizado={sessoes == null ? '—' : String(sessoes)}
          livre={limiteSeguro == null || sessoes == null ? '—' : String(Math.max(0, limiteSeguro - sessoes))}
          usedPercent={share(sessoes, limiteSeguro)}
        />
      </div>

      {/* Inventário externo (Hetzner) é opcional e só de leitura. Sem token ele
          não existe — e isso não pode mais fazer o bloco inteiro parecer vazio. */}
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-cyan-800">Detalhe da conta no provedor {temInventario ? '' : '(não conectada)'}</summary>
        {temInventario ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="font-bold text-slate-500">Recursos</dt><dd className="tabular-nums text-slate-900">{totals.servers ?? servers.length} servidores · {totals.volumes ?? inventory.volumes?.length ?? '—'} volumes · {totals.primaryIps ?? inventory.primaryIps?.length ?? '—'} IPs</dd></div>
            <div><dt className="font-bold text-slate-500">Backup e rede</dt><dd className="text-slate-900">{servers.filter((server) => server.backups).length} com backup · {totals.loadBalancers ?? inventory.loadBalancers?.length ?? '—'} balanceadores</dd></div>
            <div><dt className="font-bold text-slate-500">Custo</dt><dd className="text-slate-900">{cost == null ? 'não informado' : `€ ${cost.monthlyEur}/mês`}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-slate-600">A leitura da conta do provedor não está conectada (é opcional). Os números acima vêm da medição do próprio servidor e não dependem dela; o que falta aqui é só a lista de recursos contratados e o custo.</p>
        )}
      </details>
    </section>
  )
}
