import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

const title = 'Segurança das credenciais de afiliado no BOTinho'
const description = 'Como o BOTinho protege as credenciais das suas contas de afiliado e sua chave PIX: criptografia em repouso, proteção contra força bruta no login e isolamento entre ambientes.'
const slug = '/seguranca-credenciais-afiliado'
const dates = getEditorialDates(slug)

const layers = [
  ['Apagar quando quiser, sem pedir para ninguém', 'Cada loja tem um botão que apaga seus dados na hora, direto no painel. Sair da sua conta dentro da própria loja também derruba na mesma hora qualquer código já cadastrado.'],
  ['Criptografia em repouso (AES-256-GCM)', 'As credenciais das suas contas de afiliado e sua chave PIX ficam cifradas no banco de dados, não em texto puro. Mesmo em caso de acesso indevido ao banco, os valores não ficam legíveis diretamente.'],
  ['Proteção contra força bruta no login', 'Tentativas de login são limitadas por conta e por IP, com bloqueio temporário após várias tentativas falhas — reduz o risco de alguém tentar adivinhar sua senha.'],
  ['Isolamento entre staging e produção', 'Ambiente de testes e ambiente de produção usam bancos, credenciais e chaves de criptografia completamente separados — uma mudança em teste não expõe dados reais.'],
  ['Migração sem perda de acesso', 'Quando a criptografia foi implementada, os dados já existentes foram migrados sem exigir que nenhum operador recadastrasse suas credenciais.'],
]

const faq = [
  {
    q: 'Para que serve o código de acesso (SSID) que vocês pedem?',
    a: 'Ele serve para uma coisa só: gerar o link curto da loja já com a sua comissão. Não usamos para comprar, alterar sua conta ou ler suas mensagens. Fica guardado criptografado e você pode apagá-lo quando quiser, direto no painel.',
  },
  {
    q: 'Consigo apagar minhas credenciais depois de cadastrar?',
    a: 'Sim, quando quiser, pelo botão "Apagar meus dados" no cartão da loja dentro do painel. Sai do sistema na hora. Para voltar a divulgar aquela loja, é só cadastrar de novo — leva menos de um minuto. Sair da sua conta dentro da loja também derruba qualquer código já cadastrado.',
  },
  {
    q: 'Minhas credenciais de afiliado ficam salvas em texto puro?',
    a: 'Não. Ficam cifradas em repouso com AES-256-GCM. O sistema só decifra o valor no momento em que precisa usá-lo para uma operação autorizada.',
  },
  {
    q: 'E a minha chave PIX de recebimento, também é protegida?',
    a: 'Sim, a chave PIX cadastrada para recebimento de comissões usa o mesmo esquema de criptografia em repouso das demais credenciais.',
  },
  {
    q: 'O que acontece se alguém tentar adivinhar minha senha?',
    a: 'O login tem limite de tentativas por conta e por IP. Depois de várias tentativas falhas, novas tentativas são bloqueadas temporariamente.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const siteUrl = getSiteUrl()
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl, faq, type: 'TechArticle' })

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/conteudos" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para conteúdos</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Engenharia · Segurança</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p>Usar um bot de terceiro para automatizar suas contas de afiliado significa confiar suas credenciais a esse sistema. No BOTinho, essas credenciais — incluindo a chave PIX usada para receber comissões — ficam criptografadas em repouso (AES-256-GCM), não guardadas em texto puro.</p>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h2>Em português claro</h2>
              <ul>
                <li>O que você cola no painel serve para <strong>uma coisa só</strong>: montar seus links de oferta já com a sua comissão.</li>
                <li>Fica guardado <strong>trancado</strong>, e ninguém de fora recebe esses dados.</li>
                <li>O código de acesso da loja serve para o link da oferta sair curtinho, já com a sua comissão.</li>
                <li>Você <strong>apaga tudo quando quiser</strong>, sozinha, por um botão no painel.</li>
              </ul>
            </section>

            <section>
              <h2>Camadas de proteção</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {layers.map(([heading, body]) => (
                  <div key={heading} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <h3 className="font-black text-gray-950">{heading}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-700">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2>O que isso não é</h2>
              <p>Criptografia em repouso e proteção de login reduzem risco técnico de exposição de dados — não eliminam a responsabilidade do operador de usar senha forte, não compartilhar acesso à conta e revisar permissões concedidas a qualquer ferramenta de terceiro, incluindo o BOTinho.</p>
            </section>

            <section>
              <h2>FAQ</h2>
              {faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                  <p className="mt-3 text-gray-700">{item.a}</p>
                </details>
              ))}
            </section>

            <section>
              <h2>Próximos passos</h2>
              <p>Veja também como o BOTinho mantém sua <Link href="/confiabilidade-sessao-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">sessão do WhatsApp estável</Link> e a <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">metodologia de uso responsável</Link> que orienta toda a operação.</p>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
