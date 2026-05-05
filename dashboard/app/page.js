import Image from 'next/image'
import Link from 'next/link'

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

const faqs = [
  {
    question: 'Quais marketplaces são suportados?',
    answer: 'O Wabot foi pensado para operações com Shopee, Amazon, Mercado Livre e Magazine Luiza.',
  },
  {
    question: 'O que acontece depois que eu crio a conta?',
    answer: 'Você acessa o painel para conectar o WhatsApp, cadastrar suas credenciais de afiliado e escolher os grupos de origem e destino.',
  },
  {
    question: 'Posso organizar grupos diferentes?',
    answer: 'Sim. O painel separa grupos para monitorar links de origem e grupos para postar as ofertas convertidas.',
  },
  {
    question: 'Preciso configurar tudo manualmente todos os dias?',
    answer: 'Não. A ideia é reduzir tarefas repetitivas com conversão de links, organização de grupos e envio ou agendamento de mensagens.',
  },
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
    <main className="min-h-screen bg-[#EEF6F2] text-gray-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-3 font-bold text-green-800" aria-label="Wabot - Página inicial">
          <Image
            src="/wabot-logo.svg"
            alt="Logo do Wabot, bot conversor para afiliados no WhatsApp"
            width={40}
            height={40}
            priority
          />
          <span>Wabot</span>
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-bold text-green-700 transition hover:border-green-300 hover:bg-green-50"
        >
          Entrar
        </Link>
      </header>

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
              href="/login"
              className="rounded-xl border border-green-200 bg-white px-6 py-3 text-center text-base font-bold text-green-700 transition hover:border-green-300 hover:bg-green-50"
            >
              Entrar na minha conta
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

      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-green-700">Dúvidas frequentes</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-950">Respostas rápidas antes de começar</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-green-100">
              <h3 className="text-lg font-bold text-gray-900">{faq.question}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">{faq.answer}</p>
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
  )
}
