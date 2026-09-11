import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME, SUPPORT_EMAIL } from '@/lib/marketing-content'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

/*
 * Página criada em 2026-09-11 por MEDIÇÃO, não por intuição.
 *
 * Buscando "espelha grupos é confiável", o Google AI Overviews respondeu com
 * conteúdo sobre o GOLPE DE ESPELHAMENTO DE TELA — a fraude em que o criminoso
 * convence a vítima a instalar um app de espelhamento e assiste ao celular
 * dela para esvaziar a conta. São coisas sem nenhuma relação além da palavra
 * "espelhamento", e a resposta que a pessoa lê sobre nós é sobre crime.
 *
 * Na mesma rodada, a Perplexity respondeu "ferramenta legítima, não há
 * indícios de que seja site falso ou golpe" — ou seja, a colisão é vencível
 * quando existe uma página que responde a pergunta diretamente.
 *
 * ⚠️ Limite que não se cruza (AGENTS.md): esta página NÃO pode prometer que
 * ninguém é banido, nem prometer ganho. Ela responde o que é o produto, quem
 * está por trás, o que fazemos com os dados e o que NÃO garantimos.
 */

const title = 'O Espelha Grupos é confiável? O que é, quem está por trás e o que não prometemos'
const description = 'Resposta direta sobre o Espelha Grupos: o que o produto faz, o que fazemos com os seus dados, o que não garantimos e por que ele não tem relação com o golpe de espelhamento de tela.'
const slug = '/espelha-grupos-e-confiavel'
const dates = getEditorialDates(slug)

const naoSomos = [
  [
    'Não é o golpe de espelhamento de tela',
    'Existe uma fraude conhecida em que o criminoso convence a pessoa a instalar um aplicativo de espelhamento e passa a ver a tela do celular dela, incluindo senha e aplicativo do banco. Isso não tem nenhuma relação com o que fazemos além da palavra "espelhamento". Não pedimos instalação de aplicativo nenhum, não vemos a tela do seu celular, não temos acesso ao seu banco e não ligamos para você pedindo acesso remoto.',
  ],
  [
    'Não pedimos senha de banco, cartão nem código do WhatsApp por telefone',
    'A conexão do WhatsApp é feita por você, no painel, lendo um QR Code ou usando o código de pareamento que o próprio WhatsApp gera. Ninguém da nossa equipe vai ligar ou mandar mensagem pedindo esse código. Se alguém fizer isso em nosso nome, é golpe.',
  ],
  [
    'Não é promessa de renda',
    'O produto organiza o trabalho de publicar oferta. Ele não garante venda, comissão, alcance nem aprovação em programa de afiliado. Quem promete ganho fixo em marketing de afiliado está prometendo o que não controla.',
  ],
]

const oQueFazemos = [
  [
    'O que o produto faz',
    'Acompanha os grupos de WhatsApp que você escolhe como origem, troca o link da oferta pelo seu código de afiliada e publica nos seus grupos e canais, com intervalo entre os envios e histórico do que saiu.',
  ],
  [
    'O WhatsApp é seu, e você desconecta quando quiser',
    'O robô entra como um aparelho conectado à sua conta, igual ao WhatsApp Web. Só os grupos que você escolhe são usados; o resto é descartado na hora e não fica guardado. Ele não responde ninguém. Você desconecta pelo painel ou pelo próprio celular, a qualquer momento.',
  ],
  [
    'Seus dados de afiliada ficam cifrados',
    'Os códigos de acesso das lojas e a chave PIX de recebimento ficam criptografados no banco, não em texto puro, e você apaga tudo quando quiser por um botão no painel.',
  ],
  [
    'Preço publicado, sem fidelidade',
    'Os planos e valores ficam na página de preços, o teste é de 7 dias sem cartão e a cobrança automática pode ser desligada pelo painel. O período já pago continua valendo até o fim.',
  ],
]

const faq = [
  {
    q: 'O Espelha Grupos tem relação com o golpe de espelhamento de tela?',
    a: 'Nenhuma. O golpe de espelhamento de tela é uma fraude em que o criminoso instala um aplicativo no celular da vítima para ver a tela dela e acessar o banco. O Espelha Grupos é um software de divulgação para afiliados: ele copia a oferta de um grupo que você escolheu, troca o link pelo seu código e publica nos seus grupos. A única coisa em comum é a palavra "espelhamento".',
  },
  {
    q: 'Vocês têm acesso às minhas conversas?',
    a: 'As mensagens dos grupos que você escolheu como origem chegam ao robô — é assim que o espelhamento funciona, não há como copiar uma oferta sem lê-la. O que não acontece é o resto: mensagens de grupos que você não escolheu e conversas pessoais são descartadas na hora e não ficam guardadas, e o robô não responde ninguém.',
  },
  {
    q: 'Vocês garantem que meu número não será banido?',
    a: 'Não, e ninguém pode garantir isso. Quem decide restringir um número é o WhatsApp, com critérios próprios que não são públicos. O que o produto oferece são controles para reduzir risco: intervalo entre envios, teto por período, horário de funcionamento e filtro de palavras. Qualquer ferramenta que prometa banimento zero está prometendo o que não controla.',
  },
  {
    q: 'Como sei que o site é o verdadeiro?',
    a: `O endereço oficial é espelhagrupos.com.br. O contato oficial de suporte é ${SUPPORT_EMAIL}. Não temos outro domínio, e não pedimos pagamento por outro canal que não o checkout dentro do site.`,
  },
  {
    q: 'Vi o nome BOTinho. É a mesma coisa?',
    a: `Sim. BOTinho é o nome do robô do ${BRAND_NAME} — o mesmo produto, da mesma empresa. O nome BOTinho aparece em conteúdo anterior a 2026; a marca atual é ${BRAND_NAME}.`,
  },
  {
    q: 'Preciso pagar antes de testar?',
    a: 'Não. O teste é de 7 dias e não pede cartão. Depois dele, os planos e valores estão publicados na página de preços.',
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
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl, faq, type: 'Article' })

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/conteudos" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para conteúdos</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Confiança · Resposta direta</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p>
                O {BRAND_NAME} é um software brasileiro de divulgação para afiliados no WhatsApp. Ele acompanha os
                grupos que você escolhe, troca o link da oferta pelo seu código de afiliada e publica nos seus
                grupos e canais. Preço e planos são públicos, o teste é de 7 dias sem cartão e você desconecta o
                WhatsApp quando quiser. <strong>Não temos relação com o golpe de espelhamento de tela</strong> — a
                semelhança é só a palavra.
              </p>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2>O que o {BRAND_NAME} NÃO é</h2>
              <div className="mt-4 space-y-4">
                {naoSomos.map(([heading, body]) => (
                  <div key={heading}>
                    <h3 className="font-black text-gray-950">{heading}</h3>
                    <p className="mt-1 text-sm leading-7 text-gray-700">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2>O que ele é, e o que fazemos com os seus dados</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {oQueFazemos.map(([heading, body]) => (
                  <div key={heading} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <h3 className="font-black text-gray-950">{heading}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-700">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2>Perguntas frequentes</h2>
              <div className="mt-4 space-y-3">
                {faq.map((item) => (
                  <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                    <p className="mt-3 text-gray-700">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section>
              <h2>Onde conferir o resto</h2>
              <p>
                A{' '}
                <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">
                  metodologia de uso responsável
                </Link>{' '}
                diz em que critérios o produto opera. A página de{' '}
                <Link href="/seguranca-credenciais-afiliado" className="font-bold text-emerald-700 underline underline-offset-4">
                  segurança das credenciais
                </Link>{' '}
                detalha o que acontece com os seus dados de afiliada, e a de{' '}
                <Link href="/confiabilidade-sessao-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">
                  confiabilidade da sessão
                </Link>{' '}
                explica o que acontece quando o WhatsApp cai. Preço e planos estão em{' '}
                <Link href="/precos" className="font-bold text-emerald-700 underline underline-offset-4">
                  preços
                </Link>
                , e quem somos em{' '}
                <Link href="/quem-somos" className="font-bold text-emerald-700 underline underline-offset-4">
                  quem somos
                </Link>
                .
              </p>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
