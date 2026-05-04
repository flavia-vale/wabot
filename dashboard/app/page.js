import Link from 'next/link'

export const metadata = {
  title: 'Bot Conversor para Afiliados | Automação de WhatsApp para Escalar Vendas',
  description:
    'Automatize envios no WhatsApp, converta links de afiliado e escale sua operação com mais velocidade e consistência.',
}

export default function HomePage() {
  return (
    <main className="lp lp-menta lp-compact">
      <section className="wrap lp-section">
        <span className="pill"><span className="dot" />Feito para afiliados que querem escalar</span>
        <h1 className="lp-title serif">Bot Conversor para Afiliados para vender todos os dias no WhatsApp</h1>
        <p className="lp-subtitle">Converta links automaticamente, organize grupos e mantenha consistência operacional sem depender de processos manuais.</p>
        <div className="lp-cta-row">
          <Link href="/login" className="btn btn-primary">Começar agora</Link>
          <Link href="/login" className="btn btn-ghost">Ver demonstração no painel</Link>
        </div>
      </section>

      <section className="wrap lp-section lp-grid-3">
        <article className="card"><p className="mono lp-kicker">PASSO 1</p><h2>Conecte seu WhatsApp</h2><p>Ative seu número em poucos passos para começar a operação.</p></article>
        <article className="card"><p className="mono lp-kicker">PASSO 2</p><h2>Configure grupos e credenciais</h2><p>Defina origem/destino e plataformas de afiliado para conversão automática.</p></article>
        <article className="card"><p className="mono lp-kicker">PASSO 3</p><h2>Escalone seus envios</h2><p>Ganhe produtividade com rotina de disparo mais organizada e contínua.</p></article>
      </section>

      <section className="wrap lp-section">
        <div className="card">
          <h2 className="serif">Por que afiliados escolhem o Pro?</h2>
          <ul className="lp-list">
            <li>✅ Operação sem anúncios para evitar interrupções em campanha</li>
            <li>✅ Conversores de links integrados para fluxo mais rápido</li>
            <li>✅ Melhor previsibilidade para rotina diária de envios</li>
            <li>✅ Upgrade simples conforme seu volume aumenta</li>
          </ul>
          <Link href="/login" className="btn btn-accent">Criar conta e escalar</Link>
        </div>
      </section>

      <section className="wrap lp-section">
        <h2 className="serif">Perguntas frequentes</h2>
        <div className="lp-grid-3">
          <article className="card"><h3>Preciso ser técnico para usar?</h3><p>Não. O fluxo foi pensado para afiliados configurarem rapidamente e começarem a operar sem complexidade.</p></article>
          <article className="card"><h3>Funciona para operação pequena e grande?</h3><p>Sim. Você pode começar no Basic e evoluir para o Pro conforme aumenta volume e necessidade de escala.</p></article>
          <article className="card"><h3>Como começo agora?</h3><p>Crie sua conta, conecte o WhatsApp e configure grupos/credenciais. Em seguida, já pode iniciar seus envios.</p></article>
        </div>
      </section>
    </main>
  )
}
