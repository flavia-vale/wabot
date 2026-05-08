import Link from 'next/link'

const PLATFORM_GUIDES = [
  {
    name: 'Shopee',
    steps: [
      'Acesse affiliate.shopee.com.br e faça login na conta de afiliado.',
      'Abra Ferramentas → API de Afiliados.',
      'Clique para gerar/redefinir credenciais e copie App ID e Secret Key.',
      'Cole no painel em Dashboard → Credenciais → Shopee e salve.',
    ],
    notes: [
      'O Secret Key é sensível: não compartilhe fora do dashboard.',
      'Se a Shopee não liberar a API imediatamente, aguarde a aprovação e tente novamente mais tarde.',
    ],
  },
  {
    name: 'Amazon',
    steps: [
      'Entre em associados.amazon.com.br e confirme sua Tag de afiliado.',
      'Abra amazon.com.br logado na mesma conta.',
      'No navegador, abra DevTools → Application → Cookies → amazon.com.br.',
      'Copie os valores de ubid-acbbr, at-acbbr e x-acbbr e salve no dashboard.',
    ],
    notes: [
      'Cookies podem expirar: se a conversão falhar, renove os cookies.',
      'Não envie cookies por WhatsApp, e-mail ou suporte externo.',
    ],
  },
  {
    name: 'Mercado Livre',
    steps: [
      'Acesse afiliados.mercadolivre.com.br com sua conta de afiliado.',
      'Copie a Tag numérica exibida no painel.',
      'Com sessão ativa, obtenha o valor do cookie ssid no navegador.',
      'Cole Tag e SSID no dashboard e clique em Salvar.',
    ],
    notes: [
      'SSID é dado sensível de sessão.',
      'Se o login do Mercado Livre expirar, gere um novo SSID.',
    ],
  },
  {
    name: 'Magazine Luiza',
    steps: [
      'Acesse o painel de afiliados do Magazine Luiza.',
      'Copie sua tag/parceiro usada nos links.',
      'Cole no campo de credenciais e salve.',
    ],
  },
]

export default function CredenciaisTutorialPage() {
  return (
    <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <h1 className="text-2xl font-black text-gray-900">Tutorial: como pegar credenciais das lojas</h1>
        <p className="text-sm text-gray-700">Siga este guia antes de preencher a tela de credenciais. O objetivo é evitar dados incompletos e reduzir falhas de conversão.</p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Checklist de segurança</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Copie os dados com sessão logada e ativa em cada loja.</li>
          <li>Não compartilhe cookies/chaves fora do dashboard.</li>
          <li>Sempre clique em <strong>Salvar</strong> após preencher cada plataforma.</li>
        </ul>
      </div>

      <div className="space-y-4">
        {PLATFORM_GUIDES.map((platform) => (
          <article key={platform.name} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-base font-black text-gray-900">{platform.name}</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
              {platform.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            {platform.notes?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600">
                {platform.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      <footer className="flex flex-wrap gap-3">
        <Link href="/dashboard/credenciais" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
          Voltar para Credenciais
        </Link>
        <Link href="/dashboard/tutorial" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Abrir tutorial geral
        </Link>
      </footer>
    </section>
  )
}
