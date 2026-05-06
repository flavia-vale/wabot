import Image from 'next/image'
import Link from 'next/link'
import { PublicFooter, PublicHeader } from '@/components/PublicShell'

const benefits = [
  'Converta links de Shopee, Amazon, Mercado Livre e Magalu',
  'Organize grupos de origem e destino do WhatsApp',
  'Envie ou agende ofertas sem repetir trabalho manual',
]

const painBenefits = [
  'Pare de copiar, colar e converter links manualmente durante suas campanhas.',
  'Tenha mais controle sobre quais grupos monitorar e onde postar cada oferta.',
  'Mantenha consistência nos envios mesmo quando houver várias ofertas no dia.',
]

const steps = [
  {
    title: 'Conecte seu WhatsApp',
    description: 'Pareie seu número pelo painel e deixe o bot pronto para operar nos seus grupos.',
  },
  {
    title: 'Configure suas credenciais',
    description: 'Cadastre suas tags e chaves de Shopee, Amazon, Mercado Livre e Magalu para transformar links comuns em links monetizados.',
  },
  {
    title: 'Automatize seus envios',
    description: 'Escolha grupos, mensagens e horários para divulgar ofertas com mais consistência.',
  },
]

const platforms = ['Shopee', 'Amazon', 'Mercado Livre', 'Magalu']

const plans = [
  { name: 'Basic', price: 'R$50', description: 'Acesso por 30 dias para começar e validar sua operação.', features: ['Bot ilimitado', 'Todos os conversores', 'Anúncio a cada 50 envios'] },
  { name: 'Pro', price: 'R$100', description: 'Acesso por 30 dias para operar com mais volume e sem anúncios.', features: ['Bot ilimitado', 'Todos os conversores', 'Sem anúncios'] },
]

export const metadata = {
  title: 'Bot para Afiliados no WhatsApp',
  description: 'Converta links de afiliado automaticamente, organize grupos de WhatsApp e envie ofertas com menos trabalho manual.',
  alternates: {
    canonical: '/',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#EEF6F2] text-gray-900">
      <PublicHeader />
      <main>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-8 md:px-8 lg:flex-row lg:items-center lg:py-16">
        <div className="flex-1">
          <p className="mb-4 inline-flex rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-800">
            🤖 Bot Conversor para Afiliados no WhatsApp
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-gray-950 md:text-6xl">
            Automatize seus links de afiliado no WhatsApp e ganhe tempo para vender mais
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Pare de converter links manualmente. Com o Wabot, você organiza seus grupos de WhatsApp, transforma links em links de afiliado e envia ofertas pelo painel.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-xl bg-green-600 px-6 py-3 text-center text-base font-bold text-white shadow-lg shadow-green-700/20 transition hover:bg-green-700"
            >
              Criar conta e acessar painel
            </Link>
            <Link
              href="/#planos"
              className="rounded-xl border border-green-200 bg-white px-6 py-3 text-center text-base font-bold text-green-700 transition hover:border-green-300 hover:bg-green-50"
            >
              Ver planos
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Em poucos passos, você conecta o WhatsApp, cadastra suas credenciais e começa a organizar seus envios.
          </p>
        </div>

        <div className="flex-1 rounded-3xl border border-green-100 bg-white p-5 shadow-xl shadow-green-900/10">
          <div className="rounded-2xl bg-gray-950 p-5 text-white">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-green-300">Painel Wabot</p>
                <h2 className="text-2xl font-bold">Operação de afiliados</h2>
              </div>
              <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-200">Online</span>
            </div>
            <div className="space-y-3">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex gap-3 rounded-xl bg-white/5 p-3 text-sm text-gray-100">
                  <span className="text-green-300">✅</span>
                  <span>{benefit}</span>
                </div>
              ))}
              <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-3 text-sm text-green-50">
                Menos tarefas manuais para quem divulga ofertas todos os dias.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-8 md:px-8">
        <div className="mb-5 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-green-700">Marketplaces</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">Compatível com os principais marketplaces</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {platforms.map((platform) => (
            <div key={platform} className="rounded-2xl border border-green-100 bg-white p-5 text-center font-bold text-gray-700 shadow-sm">
              {platform}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        <div className="grid gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-green-100 md:grid-cols-[1.1fr_1fr] md:p-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">Por que usar o Wabot?</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-950">Feito para afiliados que divulgam ofertas todos os dias</h2>
            <p className="mt-4 text-gray-600">
              O Wabot ajuda a reduzir etapas repetitivas para você focar em escolher boas ofertas e manter sua comunidade ativa.
            </p>
          </div>
          <div className="space-y-3">
            {painBenefits.map((benefit) => (
              <div key={benefit} className="flex gap-3 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
                <span aria-hidden="true">✅</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-green-700">Como funciona</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-950">Da configuração ao envio em poucos passos</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-green-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-bold text-green-700">{index + 1}</span>
              <h3 className="mt-5 text-xl font-bold text-gray-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planos" className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-green-700">Planos</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-950">Escolha o acesso ideal para testar e operar por 30 dias</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">O modelo MVP é de acesso por 30 dias renovável pelo checkout. A ativação acontece após confirmação do pagamento.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-green-100">
              <h3 className="text-2xl font-black text-gray-900">{plan.name}</h3>
              <p className="mt-2 text-4xl font-black text-green-700">{plan.price}<span className="text-base font-semibold text-gray-500"> / 30 dias</span></p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{plan.description}</p>
              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                {plan.features.map(feature => <li key={feature}>✅ {feature}</li>)}
              </ul>
              <Link href="/login" className="mt-6 inline-flex rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700">Começar com {plan.name}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14 md:px-8">
        <div className="rounded-3xl bg-green-700 p-8 text-center text-white md:p-10">
          <h2 className="text-3xl font-bold">Pronto para automatizar sua rotina de afiliado?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-green-50">
            Crie sua conta, conecte o WhatsApp e comece a organizar seus envios de ofertas pelo painel do Wabot.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-white px-6 py-3 font-bold text-green-700 transition hover:bg-green-50"
          >
            Criar conta e configurar o Wabot
          </Link>
        </div>
      </section>
      </main>
      <PublicFooter />
    </div>
  )
}
