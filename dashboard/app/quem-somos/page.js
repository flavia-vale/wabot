import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'
import { BRAND_LINKEDIN_URL, BRAND_YOUTUBE_URL, DEFAULT_LANDING_PLANS, SISTER_SITES, STORES_FACT_PT } from '@/lib/marketing-content'
import { FICHA_DEFINICAO } from '@/lib/ficha-tecnica'
import { EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'
import { EditorialFreshness } from '@/components/marketing/EditorialFreshness'

// Página-resposta de marca (Frente 1, item 2 da análise SEO+GEO de
// 02/10/2026, G2): em janela anônima o ChatGPT não reconhecia o nome ("pode
// ser uma ferramenta ou a descrição de uma função"). Em vez de criar
// /o-que-e-espelha-grupos (página nova nasce sem força e precisa de 3 links),
// /quem-somos — já indexada — passa a responder "o que é" no título e no H1,
// com o quadro "o que é / o que faz / o que não faz / preço / garantia".
export const metadata = {
  title: { absolute: 'O que é o Espelha Grupos: bot de afiliados no WhatsApp' },
  description: 'O que é o Espelha Grupos, para quem é, o que faz e o que não faz (Telegram, API oficial), preço, garantia de 7 dias e quem está por trás.',
  alternates: { canonical: '/quem-somos' },
}

const planoPorId = (id) => DEFAULT_LANDING_PLANS.find((plan) => plan.id === id)
const basic = planoPorId('basic')
const pro = planoPorId('pro')

// "O que é" em fatos curtos, cada um verificável no código (ficha técnica,
// src/billing/plans.js, src/core/mirrorLinkGuard.js). Sem "não bane", sem
// Telegram prometido, sem preço de concorrente.
const RESPOSTA_DE_MARCA = [
  { rotulo: 'O que é', valor: 'Um bot de afiliados para WhatsApp: um robô na nuvem que publica ofertas com o seu código de afiliada nos seus grupos e canais, sem copiar e colar.' },
  { rotulo: 'Para quem', valor: 'Afiliadas e afiliados que divulgam ofertas (achadinhos) em grupos e canais próprios do WhatsApp.' },
  { rotulo: 'O que faz', valor: `Espelha as ofertas dos grupos que você já segue, troca o link pelo seu código em ${STORES_FACT_PT}, monta a oferta a partir de um link e, no Pro, busca ofertas da Shopee sozinho.` },
  { rotulo: 'Trava de link', valor: 'Se a troca do link falhar, a oferta não é publicada: o link de outra pessoa nunca sai no seu grupo.' },
  { rotulo: 'O que não faz', valor: 'Não envia para Telegram nem para Instagram. Não usa a API oficial do WhatsApp Business: conecta como o WhatsApp Web, pelo QR Code. Não promete ganho nem que o número não será bloqueado.' },
  { rotulo: 'Preço e garantia', valor: `7 dias grátis com o Pro completo, sem cartão. Depois, Basic ${basic.price} ou Pro ${pro.price} a cada ${basic.period}. Reembolso integral em até 7 dias corridos depois do pagamento.` },
]

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="Quem somos"
      title="O que é o Espelha Grupos"
      description={FICHA_DEFINICAO}
    >
      {/*
        23/09/2026: a primeira frase de corpo (a `description` acima) define a
        marca de forma auto-contida — em três medições o ChatGPT leu "Espelha
        Grupos" como expressão genérica. 27/09/2026: passou a ser a MESMA
        constante da ficha técnica (FICHA_DEFINICAO, lib/ficha-tecnica.js), a
        que sai na home, em /precos, no llms.txt, no pricing.md e em
        /espelha-grupos-e-confiavel — byte a byte, com os três modelos.
        Guarda: test/ficha-tecnica-canonica.test.js.
      */}
      <div className="space-y-5 text-sm leading-7 text-gray-600">
        <dl className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-5 md:grid-cols-2">
          {RESPOSTA_DE_MARCA.map((item) => (
            <div key={item.rotulo}>
              <dt className="font-bold text-gray-950">{item.rotulo}</dt>
              <dd className="mt-1">{item.valor}</dd>
            </div>
          ))}
        </dl>
        <p>
          Na prática são três modos na mesma conta. No espelhamento, o robô acompanha os grupos e canais que você escolhe
          e republica cada oferta com o seu código de afiliada, em {STORES_FACT_PT}.
          Em &ldquo;Criar oferta&rdquo;, você cola o seu link e o robô busca nome, preço e foto e monta a oferta para os seus grupos.
          Nas{' '}
          <Link href="/bot-que-busca-ofertas-shopee-whatsapp" className="font-bold text-green-700 underline underline-offset-4">
            ofertas automáticas
          </Link>
          , recurso do plano Pro, ele procura sozinho na Shopee pelo tema e pelo desconto mínimo que você definir — a busca
          automática existe só na Shopee; nas outras lojas o robô converte o link que chega dos grupos acompanhados.
          Se a dúvida é se{' '}
          <Link href="/espelhar-grupos-de-ofertas-vale-a-pena" className="font-bold text-green-700 underline underline-offset-4">
            espelhar grupos vale a pena
          </Link>
          , respondemos de frente, com o que é verdade na crítica.
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
        <p>
          Perfis oficiais:{' '}
          <a href={BRAND_YOUTUBE_URL} className="font-bold text-green-700 underline underline-offset-4">YouTube</a>
          {' e '}
          <a href={BRAND_LINKEDIN_URL} className="font-bold text-green-700 underline underline-offset-4">LinkedIn</a>.
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
   <EditorialFreshness pathname="/quem-somos" />
    </PublicPage>
  )
}
