import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'
import { BRAND_DEFINITION_PT, SISTER_SITES, SUPPORTED_STORES } from '@/lib/marketing-content'
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
      description={BRAND_DEFINITION_PT}
    >
      {/*
        23/09/2026: a primeira frase de corpo (a `description` acima) define a
        marca de forma auto-contida — em três medições o ChatGPT leu "Espelha
        Grupos" como expressão genérica. Frase única em marketing-content.js
        (BRAND_DEFINITION_PT), a mesma da home e do llms.txt.
      */}
      <div className="space-y-5 text-sm leading-7 text-gray-600">
        <p>
          Na prática são dois modos na mesma conta. No espelhamento, o robô acompanha os grupos e canais que você escolhe
          e republica cada oferta com o seu código de afiliada, em {SUPPORTED_STORES.length} lojas ({SUPPORTED_STORES.join(', ')}).
          Nas{' '}
          <Link href="/bot-que-busca-ofertas-shopee-whatsapp" className="font-bold text-green-700 underline underline-offset-4">
            ofertas automáticas
          </Link>
          , recurso do plano Pro, ele procura sozinho na Shopee pelo tema e pelo desconto mínimo que você definir — a busca
          automática existe só na Shopee; nas outras lojas o robô converte o link que chega dos grupos acompanhados.
        </p>
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
          Entre 11/09 e 19/09/2026 esta página emparelhava o nome antigo do
          produto com o atual, numa frase, porque o ChatGPT tratou os dois como
          produtos CONCORRENTES (RCA 2026-09-11). Em 19/09 a dona do produto
          decidiu a regra de escrita: em texto público, só "Espelha Grupos" —
          nem o nome antigo sozinho (três das quatro IAs leem o nome solto
          como calçado infantil), nem emparelhado. A ligação com as citações
          antigas fica no schema (`alternateName`, com `publisher` e `brand`
          apontando para a mesma Organization) e na linha de "nome anterior"
          do llms.txt. Guarda: test/nome-antigo-fora-do-texto-publico.test.js.
        */}
        <p>
          <strong>Espelha Grupos</strong> é o nome do produto e da empresa — um produto só, e é assim que ele aparece
          em tudo o que publicamos hoje: site, painel, canal do YouTube e Instagram.
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
          . {EDITORIAL_PERSON_AUTHOR} é fundadora dos dois. Os sites são independentes: um é para quem procura cupom; este é para quem publica oferta.
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
