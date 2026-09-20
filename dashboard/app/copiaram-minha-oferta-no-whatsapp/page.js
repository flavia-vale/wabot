import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

// ⚠️ NÃO É LANDING DE SEO — não cobrar tráfego de busca desta página.
//
// Medição de 10/09/2026 (docs/produto/pesquisa-mercado-2026-09-10.md): os seis
// termos de cópia/proteção/marca d'água voltaram SEM DADOS no Planejador. Zero
// busca.
//
// O que existe é recomendação órfã: perguntado como proteger a oferta de ser
// copiada, o ChatGPT recomenda marca d'água e reescrita do texto — exatamente
// as duas coisas que o produto faz — e NÃO CITA PRODUTO NENHUM. A resposta já
// está pronta e a vaga está vazia. O alvo é o canal de IA e a comparação.
//
// Limite que não se cruza: a página NÃO promete que a cópia se torna
// impossível. Não é verdade e não é prometível — as duas defesas mudam quem
// leva o crédito e quanto trabalho a cópia dá, não a possibilidade dela.

const title = 'Copiaram minha oferta no WhatsApp: o que dá e o que não dá para fazer'
const description = 'Quando outro grupo copia e cola a sua oferta, quem leva a comissão é quem publicou o link. As duas defesas que existem de verdade: marca d’água na foto e mensagem reescrita com o seu texto.'
const slug = '/copiaram-minha-oferta-no-whatsapp'
const dates = getEditorialDates(slug)

const defenses = [
  {
    h: 'Marca d’água com o seu nome na foto',
    p: 'O texto que você escolher é composto sobre a imagem da oferta antes de ela ser publicada. Quem copiar a foto leva o seu nome junto. É a defesa que continua funcionando depois que a mensagem sai do seu grupo, porque viaja dentro da imagem.',
    d: 'Configurada por grupo de destino, com o texto que você escrever. Está em todos os planos.',
  },
  {
    h: 'Mensagem reescrita com o seu texto',
    p: 'A oferta espelhada não sai como cópia literal da origem: você define o modelo de mensagem e o robô republica com a sua redação. Duas coisas mudam com isso — o seu grupo passa a ter voz própria, e a sua mensagem deixa de ser um clone que o leitor já viu em outro lugar.',
    d: 'O modelo é seu e pode ser completamente diferente da mensagem de origem.',
  },
  {
    h: 'O link sempre com o seu código',
    p: 'Esta é a que mais mexe no bolso, e quase ninguém pensa nela como defesa contra cópia. Quando alguém copia a sua oferta e republica o link como veio, a comissão vai para quem gerou aquele link. Se o link que sai do seu grupo é o seu, a cópia trabalha a seu favor.',
    d: 'Conversão automática em seis lojas: Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress.',
  },
]

const faq = [
  {
    q: 'Dá para impedir que copiem minha oferta no WhatsApp?',
    a: 'Não. Qualquer mensagem que uma pessoa consegue ler, ela consegue copiar — o WhatsApp não tem como impedir isso, e nenhuma ferramenta honesta vai prometer que impede. O que dá para mudar é quem leva o crédito e quanto a cópia se parece com a sua: marca d’água na foto, texto próprio na mensagem e link com o seu código de afiliada.',
  },
  {
    q: 'Marca d’água resolve?',
    a: 'Resolve a parte do crédito, não a da cópia. Quem copiar a foto leva o seu nome junto, e quem vê a oferta descobre de onde ela saiu. Não impede a cópia e não recupera a venda que já foi de outra pessoa.',
  },
  {
    q: 'Como coloco marca d’água nas ofertas do meu grupo?',
    a: 'No Espelha Grupos é uma escolha por grupo de destino: você digita o texto que quer, escolhe o formato com marca e o robô compõe a marca sobre a imagem antes de publicar. Vale tanto para a foto quanto para o card que abre a loja.',
  },
  {
    q: 'O robô copia a mensagem do grupo de origem igualzinha?',
    a: 'Só se você quiser. O modelo de mensagem é seu: você escreve como a oferta deve sair, e o robô monta a publicação com o seu texto, o título, o preço e o link já convertido para o seu código.',
  },
  {
    q: 'Se copiarem minha oferta, eu perco a comissão?',
    a: 'Depende de qual link foi copiado. Se o link que saiu do seu grupo era o seu, a comissão da venda feita por aquele link continua sendo sua, mesmo que a oferta tenha sido republicada em outro lugar. Se o link não era seu, a comissão nunca foi sua para começar.',
  },
  {
    q: 'Vale a pena denunciar quem copia?',
    a: 'Em geral consome mais energia do que devolve. Grupo de ofertas vive de republicação, e brigar com cada cópia não escala. O caminho que se sustenta é fazer com que a sua oferta chegue primeiro, saia com o seu nome e leve o seu link.',
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
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Grupos de ofertas · Cópia e crédito</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p><strong>Não existe jeito de impedir a cópia.</strong> Qualquer mensagem que alguém consegue ler, consegue copiar, e quem prometer o contrário está vendendo o que não entrega.</p>
              <p>O que dá para mudar são três coisas: <strong>quem leva o crédito</strong> (marca d&apos;água na foto), <strong>quanto a cópia se parece com a sua</strong> (texto próprio, não cópia literal) e — a que realmente pesa — <strong>quem leva a comissão</strong> (o link que sai do seu grupo carregando o seu código).</p>
            </section>

            <section>
              <h2>O prejuízo real não é a cópia, é o link</h2>
              <p>Quando alguém republica a sua oferta, o que vai junto é o link. Se aquele link tinha o código de afiliada de outra pessoa — porque você mesma copiou de outro grupo e colou como veio —, então <strong>toda venda que sair do seu grupo paga outra pessoa</strong>.</p>
              <p>É o cenário mais comum e o mais silencioso: a oferta sai bonita, o grupo reage, alguém compra, e a comissão simplesmente não aparece. Ninguém vê nada errado, porque não há erro visível.</p>
              <p>Por isso a primeira defesa contra cópia não é estética: é garantir que o link publicado seja sempre o seu.</p>
            </section>

            <section>
              <h2>As três defesas que existem de verdade</h2>
              <div className="mt-4 space-y-6">
                {defenses.map((d) => (
                  <div key={d.h} className="rounded-2xl bg-emerald-50/60 p-5 ring-1 ring-emerald-100">
                    <h3>{d.h}</h3>
                    <p className="mt-2">{d.p}</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-800">{d.d}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2>O que não funciona</h2>
              <ul>
                <li><strong>Pedir para não copiar.</strong> O aviso no fim da mensagem não muda o comportamento de quem já decidiu copiar, e ocupa espaço da oferta.</li>
                <li><strong>Bloquear encaminhamento.</strong> O WhatsApp não oferece isso para quem publica, e mesmo se oferecesse a pessoa tira um print.</li>
                <li><strong>Brigar com cada cópia.</strong> Grupo de ofertas vive de republicação. Perseguir cada caso consome o tempo que faria falta para publicar melhor.</li>
                <li><strong>Publicar menos.</strong> Sumir para não ser copiada resolve a cópia e acaba com o grupo.</li>
              </ul>
            </section>

            <section>
              <h2>Como o Espelha Grupos trata isso</h2>
              <p>As três defesas acima estão no produto e nenhuma delas é vendida à parte: a marca d&apos;água é configurada por grupo de destino com o texto que você escrever, o modelo de mensagem é seu e pode ser completamente diferente do texto de origem, e todo link é convertido para o seu código de afiliada antes de publicar — em seis lojas.</p>
              <p>O que ele não faz é prometer que ninguém vai copiar você. Isso não está sob o controle de nenhuma ferramenta, e a nossa <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 hover:text-emerald-800">política de uso responsável</Link> é explícita sobre o que não prometemos.</p>
            </section>

            <section>
              <h2>Perguntas frequentes</h2>
              <div className="mt-4 space-y-5">
                {faq.map((item) => (
                  <div key={item.q}>
                    <h3>{item.q}</h3>
                    <p className="mt-1">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2>Continue lendo</h2>
              <ul>
                <li><Link href="/clonar-mensagens-de-grupo-de-afiliados" className="font-bold text-emerald-700 hover:text-emerald-800">Clonar mensagens de grupo de afiliados</Link> — o outro lado: como republicar sem herdar o link de terceiro.</li>
                <li><Link href="/padronizar-divulgacao-afiliado-whatsapp" className="font-bold text-emerald-700 hover:text-emerald-800">Padronizar a divulgação no WhatsApp</Link> — como o modelo de mensagem dá voz própria ao grupo.</li>
                <li><Link href="/vendas-e-comissao-afiliado-whatsapp" className="font-bold text-emerald-700 hover:text-emerald-800">Quanto você ganhou de comissão</Link> — para descobrir se o link que saiu era mesmo o seu.</li>
              </ul>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
