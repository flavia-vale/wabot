import Link from 'next/link'
import '../landing.css'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { SUPPORT_WHATSAPP_URL } from '@/lib/marketing-content'
import { buildSeoRobots } from '@/lib/seo-registry.mjs'

/* PÁGINA DE DIVULGAÇÃO DO LINK INTELIGENTE (30/09/2026).
 *
 * Serve para mandar no WhatsApp/e-mail de quem já é cliente e para divulgar o
 * recurso. Linguagem de gente, sem jargão, e só promete o que o sistema faz
 * (regras em docs/rca/grupos-membros.md).
 *
 * `noindex` DE PROPÓSITO por enquanto (ver o comentário da rota em
 * lib/seo-registry.mjs): indexar mexe em páginas que já estão no Google e pede
 * reindexação — decisão da dona. Até lá a página é compartilhável por link.
 */

export const metadata = {
  title: 'Link Inteligente: um link só para vários grupos de WhatsApp',
  description:
    'Divulgue um único link e o robô manda cada pessoa para o grupo com mais espaço, antes que ele lote. Avisos quando os grupos estão enchendo.',
  alternates: { canonical: '/link-inteligente' },
  // noindex vem do registro de SEO (`indexable: false` em lib/seo-registry.mjs).
  robots: buildSeoRobots('/link-inteligente'),
  openGraph: {
    title: 'Link Inteligente | Um link só, sempre no grupo com mais vaga',
    description: 'O robô manda cada pessoa para o grupo com mais espaço e avisa você quando os grupos estão enchendo.',
    url: '/link-inteligente',
  },
}

const PASSOS = [
  {
    titulo: 'Crie seu link',
    texto: 'Escolha o nome do endereço, como promo-tech. Ele fica no seu nome: espelhagrupos.com.br/g/promo-tech.',
  },
  {
    titulo: 'Adicione seus grupos',
    texto: 'Escolha os grupos que você já tem. O robô precisa ser administrador deles: é assim que ele pega o convite sozinho, sem você copiar e colar nada.',
  },
  {
    titulo: 'Divulgue em qualquer lugar',
    texto: 'Bio do Instagram, anúncios, site, mensagens, cartão de visita. Você nunca mais troca o link quando um grupo enche.',
  },
  {
    titulo: 'O robô cuida do resto',
    texto: 'Cada pessoa que clica vai para o grupo que tem mais espaço naquele momento.',
  },
]

const REGRAS = [
  ['Sempre o grupo mais vazio', 'Quem clica é enviado para o grupo com menos gente. Seus grupos enchem juntos, sem um lotar enquanto o outro está vazio.'],
  ['Antes de lotar, ele troca', 'Você define o limite de cada grupo. Quando um grupo chega perto dele (95%), o link passa a mandar as pessoas para os outros.'],
  ['Quase cheio ainda funciona', 'Se todos os grupos estiverem perto do limite, o link continua levando as pessoas para o menos cheio, enquanto houver vaga.'],
  ['Lotou tudo? Ninguém cai num grupo cheio', 'Só quando todos os grupos chegam ao limite aparece um aviso de "Grupos lotados". E você é avisada na hora.'],
]

const ACOMPANHAR = [
  ['Quantas pessoas tem em cada grupo', 'Número atual, com barra mostrando o quanto já encheu.'],
  ['Quanto cada grupo cresceu', 'Nas últimas 24 horas, 7 dias ou 30 dias: você escolhe.'],
  ['Quantos cliques o link recebeu', 'Hoje e nos últimos 7 dias, por link e por grupo.'],
  ['O quanto seus grupos estão cheios', 'Um cartão no painel principal mostra a ocupação e fica com a borda vermelha quando todos passam de 90%.'],
]

const BOM_SABER = [
  'A contagem de pessoas é atualizada de hora em hora. Quando um grupo está enchendo, ela passa a ser feita a cada 10 minutos.',
  'Clique não é o mesmo que entrar: nem todo mundo que clica entra no grupo. Por isso o painel mostra os dois números separados.',
  'Para o robô pegar o convite, ele precisa ser administrador do grupo.',
  'Se o plano vencer, o link para de funcionar até você renovar. Renovou, volta em segundos, com o mesmo endereço.',
]

const FAQ = [
  {
    q: 'Preciso trocar o link toda vez que um grupo enche?',
    a: 'Não. Você divulga um link só. Quando um grupo fica cheio, o link passa a mandar as pessoas para os outros. Você só precisa criar um grupo novo e adicionar ao link quando os avisos disserem que está acabando o espaço.',
  },
  {
    q: 'Como eu sei que os grupos estão acabando?',
    a: 'O robô avisa por e-mail e pelo WhatsApp quando todos os seus grupos passam de 90% do limite, e de novo se eles lotarem. O aviso não se repete toda hora: você recebe um por vez, e lembretes espaçados enquanto o problema continua. Você escolhe por qual canal quer ser avisada.',
  },
  {
    q: 'O que acontece se todos os grupos lotarem?',
    a: 'Quem clicar vê uma página avisando que os grupos estão lotados, em vez de cair num convite que não funciona. Adicione um grupo novo ao link e ele volta a receber gente.',
  },
  {
    q: 'Funciona com quantos grupos?',
    a: 'Você pode colocar vários grupos no mesmo link e criar mais de um link, por exemplo um para cada assunto ou cada campanha.',
  },
  {
    q: 'Em qual plano está incluído?',
    a: 'O Link Inteligente faz parte do plano Pro, e também está liberado nos 7 dias de teste grátis, sem cartão.',
  },
]

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 18,
  padding: '20px 22px',
}

export default function Page() {
  return (
    <div className="landing-root">
      <section style={{ paddingTop: 56, paddingBottom: 8 }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <span className="pill"><span className="dot" />Novo · Link Inteligente</span>
          <h1 style={{ fontSize: 'clamp(36px, 4.5vw, 60px)', lineHeight: 1.05, marginTop: 16 }}>
            Um link só.{' '}
            <span className="serif" style={{ color: 'var(--accent-strong)' }}>
              Cada pessoa no grupo certo.
            </span>
          </h1>
          <p style={{ fontSize: 17.5, color: 'var(--ink-soft)', maxWidth: 660, margin: '18px auto 0', lineHeight: 1.6 }}>
            Divulgue um único endereço e o robô manda cada pessoa para o grupo que tem mais espaço, antes que ele lote.
            E avisa você quando seus grupos estão enchendo.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
            <Link href="/cadastro" className="btn">Testar 7 dias grátis</Link>
            <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Tirar dúvidas no WhatsApp</a>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1, marginBottom: 14 }}>
            O problema que ele resolve
          </h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
            O grupo de WhatsApp enche. Você cria outro e troca o link na bio, nos anúncios, no site, nas mensagens.
            Mas o link antigo continua espalhado por aí: quem clica cai num grupo cheio e você perde essa pessoa.
            Com o Link Inteligente, o endereço que você divulga nunca muda, e quem decide para onde cada pessoa vai é o robô.
          </p>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="wrap" style={{ maxWidth: 980 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1, marginBottom: 22 }}>Como funciona</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} style={card}>
                <span style={{ fontWeight: 900, fontSize: 28, color: 'var(--accent-strong)' }}>{i + 1}</span>
                <h3 style={{ fontSize: 18, margin: '6px 0 8px' }}>{passo.titulo}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0 }}>{passo.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="wrap" style={{ maxWidth: 980 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1, marginBottom: 22 }}>
            Como o robô escolhe o grupo
          </h2>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))' }}>
            {REGRAS.map(([titulo, texto]) => (
              <div key={titulo} style={card}>
                <h3 style={{ fontSize: 17, margin: '0 0 8px' }}>{titulo}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0 }}>{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="wrap" style={{ maxWidth: 980 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1, marginBottom: 22 }}>O que você acompanha no painel</h2>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))' }}>
            {ACOMPANHAR.map(([titulo, texto]) => (
              <div key={titulo} style={card}>
                <h3 style={{ fontSize: 17, margin: '0 0 8px' }}>{titulo}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0 }}>{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div style={{ ...card, borderColor: 'var(--accent)', background: 'var(--bg-soft)' }}>
            <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', lineHeight: 1.15, margin: '0 0 12px' }}>
              Avisos antes do problema aparecer
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ink)', margin: 0 }}>
              Quando <strong>todos</strong> os seus grupos passam de 90% do limite, o robô avisa você por e-mail e pelo WhatsApp,
              para dar tempo de criar um grupo novo. Se eles lotarem, avisa de novo, na hora. Sem encher sua caixa de
              mensagens: um aviso por vez, sem repetir toda hora, e sem incomodar de madrugada (a não ser que tenha lotado).
            </p>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1, marginBottom: 18 }}>O que é bom saber</h2>
          <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 10, fontSize: 16, lineHeight: 1.65, color: 'var(--ink-soft)' }}>
            {BOM_SABER.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1, marginBottom: 22 }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ.map((item) => (
              <details key={item.q} style={{ ...card, padding: '18px 22px' }}>
                <summary style={{ cursor: 'pointer', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{item.q}</summary>
                <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{item.a}</p>
              </details>
            ))}
          </div>
          <p style={{ marginTop: 28, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
            Ficou com dúvida? <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Chame no WhatsApp</a>.
            Veja também{' '}
            <Link href="/precos" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>os planos e preços</Link>.
          </p>
        </div>
      </section>

      <FinalCTA />
      <Footer />
    </div>
  )
}
