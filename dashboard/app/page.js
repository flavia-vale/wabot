import Link from 'next/link'

export const metadata = {
  title: 'Bot Conversor para Afiliados | Automação de WhatsApp para Escalar Vendas',
  description:
    'Automatize envios no WhatsApp, converta links de afiliado e escale sua operação com mais velocidade e consistência.',
}

const steps = [
  {
    title: 'Conecte seu WhatsApp',
    text: 'Ative seu número em poucos passos para começar a operação.',
  },
  {
    title: 'Configure grupos e credenciais',
    text: 'Defina origem/destino e plataformas de afiliado para conversão automática.',
  },
  {
    title: 'Escalone seus envios',
    text: 'Ganhe produtividade com rotina de disparo mais organizada e contínua.',
  },
]

const faqs = [
  {
    q: 'Preciso ser técnico para usar?',
    a: 'Não. O fluxo foi pensado para afiliados configurarem rapidamente e começarem a operar sem complexidade.',
  },
  {
    q: 'Funciona para operação pequena e grande?',
    a: 'Sim. Você pode começar no Basic e evoluir para o Pro conforme aumenta volume e necessidade de escala.',
  },
  {
    q: 'Como começo agora?',
    a: 'Crie sua conta, conecte o WhatsApp e configure grupos/credenciais. Em seguida, já pode iniciar seus envios.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#EEF6F2] text-[#1F2D2A]">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#d3e2da] bg-white px-4 py-2 text-xs font-medium text-[#5A6E68]">
          <span className="h-2 w-2 rounded-full bg-[#3E9C7A]" />
          Feito para afiliados que querem escalar
        </div>

        <h1 className="mt-6 max-w-4xl text-4xl leading-tight font-semibold tracking-tight md:text-6xl">
          Bot Conversor para Afiliados: <span className="text-[#3E9C7A]">automação de WhatsApp</span> para vender todos os dias.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-[#5A6E68] md:text-lg">
          Converta links automaticamente, organize envios em grupos e mantenha consistência operacional sem depender de processos manuais.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="rounded-full bg-[#1F2D2A] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
            Começar agora
          </Link>
          <Link href="/login" className="rounded-full border border-[#cfe0d8] bg-white px-6 py-3 text-sm font-semibold text-[#1F2D2A] transition hover:bg-[#f6fbf8]">
            Ver demonstração no painel
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8 md:pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, idx) => (
            <article key={step.title} className="rounded-3xl border border-[#d7e7df] bg-[#FCFEFD] p-6">
              <p className="mb-3 text-xs font-semibold tracking-wider text-[#3E9C7A]">PASSO {idx + 1}</p>
              <h2 className="text-xl font-semibold">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#5A6E68]">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="rounded-3xl border border-[#d7e7df] bg-white p-8 md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">Por que afiliados escolhem o Pro?</h2>
          <ul className="mt-6 grid gap-3 text-sm text-[#5A6E68] md:grid-cols-2">
            <li>✅ Operação sem anúncios para evitar interrupções em campanha</li>
            <li>✅ Conversores de links integrados para fluxo mais rápido</li>
            <li>✅ Melhor previsibilidade para rotina diária de envios</li>
            <li>✅ Upgrade simples conforme seu volume aumenta</li>
          </ul>
          <div className="mt-8">
            <Link href="/login" className="inline-flex rounded-full bg-[#3E9C7A] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
              Criar conta e escalar
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <h2 className="text-2xl font-semibold md:text-3xl">Perguntas frequentes</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {faqs.map((item) => (
            <article key={item.q} className="rounded-2xl border border-[#d7e7df] bg-[#FCFEFD] p-5">
              <h3 className="text-base font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5A6E68]">{item.a}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
