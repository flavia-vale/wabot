import Link from 'next/link'

export function PromocaoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-6 py-16 text-gray-900">
      <section className="mx-auto max-w-3xl rounded-3xl border border-emerald-100 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Oferta por tempo limitado</p>
        <h1 className="mt-3 text-4xl font-bold">Condição promocional BOTinho para afiliados no WhatsApp</h1>
        <p className="mt-4 text-lg text-gray-600">Converta links de afiliado, organize seus grupos e acelere seus envios com suporte desde o primeiro acesso.</p>
        <ul className="mt-8 space-y-3 text-gray-700">
          <li>✅ Configuração inicial guiada para afiliados</li>
          <li>✅ Conversão automática de links nas principais plataformas</li>
          <li>✅ Monitoramento proativo do seu robô</li>
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login" className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">Começar meu acesso promocional</Link>
          <Link href="/" className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50">Voltar para o site</Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">Cadastro rápido. Você entra no painel após concluir o acesso.</p>
      </section>
    </main>
  )
}
