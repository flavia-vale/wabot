import Link from 'next/link'

export const metadata = {
  title: 'Promoção Especial Wabot',
  description: 'Página promocional para novos cadastros do Wabot com foco em afiliados de WhatsApp.',
  alternates: { canonical: '/promocao' },
}

export default function PromocaoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-6 py-16 text-gray-900">
      <section className="mx-auto max-w-3xl rounded-3xl border border-emerald-100 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Oferta por tempo limitado</p>
        <h1 className="mt-3 text-4xl font-bold">Comece no Wabot com condições promocionais</h1>
        <p className="mt-4 text-lg text-gray-600">Automatize suas ofertas com mais rigor no cadastro e suporte dedicado desde o primeiro acesso.</p>
        <ul className="mt-8 space-y-3 text-gray-700">
          <li>✅ Configuração inicial guiada para afiliados</li>
          <li>✅ Conversão automática de links nas principais plataformas</li>
          <li>✅ Monitoramento proativo do seu robô</li>
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login" className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">Garantir minha vaga</Link>
          <Link href="/" className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50">Voltar para o site</Link>
        </div>
      </section>
    </main>
  )
}
