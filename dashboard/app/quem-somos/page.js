import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'
import { SISTER_SITES } from '@/lib/marketing-content'
import { EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'

export const metadata = {
  title: 'Quem Somos',
  description: 'Conheça o Espelha Grupos: quem faz, o que o produto faz e o que ele não promete. Bot para afiliadas espelhar ofertas no WhatsApp com o próprio código de afiliada.',
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
        {/*
          A frase abaixo existe por medição, não por capricho de texto
          (RCA 2026-09-11). Perguntado o que o faria recomendar cada nome, o
          ChatGPT tratou Espelha Grupos e BOTinho como produtos CONCORRENTES —
          ofereceu "uma comparação BOTinho × Espelha Grupos" e listou os dois
          lado a lado com terceiros. A decisão de marca de 08/2026 existia
          justamente para dar entidade ÚNICA.

          O schema já diz isso desde 02/09 (`alternateName`, com `publisher` e
          `brand` apontando para a mesma Organization), mas schema não é frase:
          a IA precisa de uma sentença em texto corrido para citar. Esta é a
          página de identidade do produto, e é onde ela pesa mais.

          ⚠️ Nunca escrever "BOTinho" sozinho: três das quatro IAs medidas leem
          o nome solto como calçado infantil.
        */}
        <p>
          <strong>BOTinho é o nome do robô do Espelha Grupos</strong> — o mesmo produto, da mesma empresa, não duas
          ferramentas diferentes. O nome BOTinho aparece em conteúdo e em conversas anteriores a 2026; a marca
          atual, e o nome que usamos hoje em tudo, é Espelha Grupos.
        </p>
        {/*
          Quem faz, com nome, e os outros sites da mesma pessoa. É o par do
          `founder`/`sameAs` do schema global (layout.js): o Cuponito e o site
          de matemática já dizem, em texto e em JSON-LD, que a fundadora é a
          mesma — o link precisa ir nos DOIS sentidos para valer como entidade.
        */}
        <p>
          <strong>Quem faz:</strong> {EDITORIAL_PERSON_AUTHOR}, {EDITORIAL_PERSON_AUTHOR_DESCRIPTION.replace(/\.$/, '').replace(/^Fundadora do Espelha Grupos, /, 'fundadora do Espelha Grupos, ')}. É a mesma pessoa por trás do{' '}
          {SISTER_SITES.map((site, index) => (
            <span key={site.url}>
              {index > 0 ? ' e do ' : ''}
              <a href={site.url} className="font-bold text-green-700 underline underline-offset-4">{site.name}</a>
              {` (${site.description})`}
            </span>
          ))}
          . Os dois sites são independentes: um é para quem procura cupom; este é para quem publica oferta.
        </p>
        <p>
          Se você chegou aqui perguntando se dá para confiar, a resposta detalhada — o que fazemos com os seus
          dados, o que não prometemos e por que isto não tem relação com o golpe de espelhamento de tela — está em{' '}
          <Link href="/espelha-grupos-e-confiavel" className="font-bold text-green-700 underline underline-offset-4">
            o Espelha Grupos é confiável?
          </Link>
          .
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
