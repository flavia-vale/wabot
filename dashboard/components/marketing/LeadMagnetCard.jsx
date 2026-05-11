import Link from 'next/link'

export function LeadMagnetCard({ origin = 'conteudo_dor_cluster1', compact = false }) {
  return (
    <aside className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Isca digital</p>
      <h2 className={`${compact ? 'mt-2 text-2xl' : 'mt-3 text-3xl'} font-black tracking-tight text-gray-950`}>
        Checklist de operação para divulgar ofertas no WhatsApp
      </h2>
      <p className="mt-3 text-sm leading-6 text-gray-700">
        Baixe o roteiro de 1 página para padronizar copy, links, horários, grupos de destino e métricas antes de ligar uma automação.
      </p>
      <form action="/login" method="get" className="mt-5 grid gap-3" data-crm-stage="Lead" data-crm-source={origin}>
        <input type="hidden" name="mode" value="register" />
        <input type="hidden" name="source" value={origin} />
        <input type="hidden" name="utm_campaign" value="dia4_conteudo_dor_cluster1" />
        <label className="text-sm font-bold text-gray-800" htmlFor={`lead-email-${origin}`}>E-mail para receber o checklist</label>
        <input
          id={`lead-email-${origin}`}
          name="email"
          type="email"
          required
          placeholder="voce@empresa.com"
          className="min-h-12 rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2"
        />
        <label className="text-sm font-bold text-gray-800" htmlFor={`lead-segment-${origin}`}>Perfil da operação</label>
        <select
          id={`lead-segment-${origin}`}
          name="segmento"
          defaultValue=""
          className="min-h-12 rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2"
        >
          <option value="" disabled>Selecione uma opção</option>
          <option value="admin-grupos-ofertas">Admin de grupos de ofertas</option>
          <option value="afiliado-infoprodutor">Afiliado/infoprodutor</option>
          <option value="ecommerce-local">E-commerce local</option>
          <option value="agencia-growth">Agência de performance/growth</option>
        </select>
        <button className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700" type="submit">
          Receber checklist e entrar na lista VIP
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-emerald-800">
        <Link href="/materiais/checklist-operacao-whatsapp" className="underline underline-offset-4">Ver checklist online</Link>
        <a href="/materiais/checklist-operacao-whatsapp.pdf" className="underline underline-offset-4">Baixar PDF</a>
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-500">
        Mapeamento CRM: Lead → MQL quando o perfil de operação é preenchido; Trial quando o cadastro é concluído.
      </p>
    </aside>
  )
}
