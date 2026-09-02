import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'

export const metadata = {
  title: 'Quem Somos',
  description: 'Conheça o Espelha Grupos, bot conversor para afiliados no WhatsApp.',
  alternates: { canonical: '/quem-somos' },
}

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="Quem somos"
      title="Espelha Grupos ajuda afiliados a operar com mais consistência no WhatsApp"
      description="Somos um produto criado para reduzir tarefas repetitivas de quem trabalha com ofertas, grupos e links de afiliado."
    >
      <div className="space-y-5 text-sm leading-7 text-gray-600">
        <p>
          O Espelha Grupos nasceu para apoiar afiliados que precisam converter links, organizar grupos de origem e destino e acompanhar envios sem depender de planilhas ou processos manuais repetitivos.
        </p>
        <p>
          Nosso foco no MVP é entregar uma operação simples: conectar o WhatsApp, cadastrar credenciais das plataformas suportadas, escolher grupos e acompanhar logs para validar se o bot está funcionando corretamente.
        </p>
        <p>
          A proposta é ser uma ferramenta prática para operações reais, comunicando limites de forma honesta e sem prometer ganhos financeiros garantidos.
        </p>
        <div className="rounded-2xl bg-green-50 p-5">
          <h2 className="text-lg font-bold text-green-900">Precisa de ajuda para começar?</h2>
          <p className="mt-2 text-green-800">A página de suporte reúne orientações iniciais e o canal oficial de atendimento.</p>
          <Link href="/suporte" className="mt-4 inline-flex rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">
            Abrir suporte
          </Link>
        </div>
      </div>
    </PublicPage>
  )
}
