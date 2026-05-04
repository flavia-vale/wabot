import Link from 'next/link'

export const metadata = {
  title: 'Bot Conversor para Afiliados | Automação de WhatsApp para Escalar Vendas',
  description: 'Automatize envios no WhatsApp, converta links de afiliado e escale sua operação.',
}

export default function HomePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg: #EEF6F2;
          --bg-soft: #DDEDE5;
          --surface: #FCFEFD;
          --ink: #1F2D2A;
          --ink-soft: #5A6E68;
          --accent: #7CC9A9;
          --accent-strong: #3E9C7A;
          --accent-2: #D9CFEA;
          --accent-3: #F6E8D8;
          --line: rgba(31,45,42,0.10);
          --shadow: 0 30px 60px -30px rgba(62,156,122,0.30), 0 8px 24px -8px rgba(31,45,42,0.08);
          --shadow-soft: 0 12px 30px -12px rgba(62,156,122,0.20);
          --pad-section: 72px;
          --pad-card: 20px;
          --gap: 16px;
        }

        main { 
          background: var(--bg); 
          color: var(--ink); 
          min-height: 100vh;
          font-family: 'Inter', sans-serif;
          position: relative;
        }

        /* Efeito de granulado do seu HTML */
        main::before {
          content:""; position: absolute; inset:0; pointer-events:none; z-index: 0;
          background-image: radial-gradient(rgba(0,0,0,0.025) 1px, transparent 1px);
          background-size: 4px 4px; opacity: .5;
        }

        .serif { font-family: 'Instrument Serif', serif; font-weight: 400; }
        .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; opacity: 0.7; }
        .wrap { max-width: 1240px; margin: 0 auto; padding: 0 28px; position: relative; z-index: 1; }
        section { padding: var(--pad-section) 0; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--gap); }
        
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: var(--pad-card);
          transition: transform 0.2s ease;
        }

        .btn {
          display: inline-flex; align-items:center; gap:10px;
          padding: 14px 22px; border-radius: 999px;
          font-weight: 600; font-size: 15px; text-decoration: none;
          transition: all .2s ease;
        }
        .btn-primary { background: var(--ink); color: var(--surface); }
        .btn-ghost { border: 1px solid var(--line); color: var(--ink); }
        .btn-accent { background: var(--accent-strong); color: white; }

        .pill {
          display:inline-flex; align-items:center; gap:8px;
          padding: 6px 12px; border-radius: 999px;
          font-size: 12.5px; background: var(--surface);
          border: 1px solid var(--line); color: var(--ink-soft);
          margin-bottom: 16px;
        }
        .dot { width:6px; height:6px; border-radius:50%; background: var(--accent-strong); }
        
        h1 { font-size: 4rem; line-height: 1; margin-bottom: 24px; }
        p { font-size: 1.2rem; line-height: 1.5; color: var(--ink-soft); margin-bottom: 32px; }
        h2 { font-size: 2.5rem; margin-bottom: 16px; }
      `}} />

      <main>
        {/* HERO SECTION */}
        <section className="wrap" style={{ textAlign: 'center', paddingTop: '100px' }}>
          <div className="pill">
            <div className="dot" />
            <span>Feito para afiliados que querem escalar</span>
          </div>
          <h1 className="serif">Bot Conversor para Afiliados para vender todos os dias no WhatsApp</h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 32px' }}>
            Converta links automaticamente, organize grupos e mantenha consistência operacional sem depender de processos manuais.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/login" className="btn btn-primary">Começar agora</Link>
            <Link href="/login" className="btn btn-ghost">Ver demonstração</Link>
          </div>
        </section>

        {/* STEPS SECTION */}
        <section className="wrap">
          <div className="grid">
            <article className="card">
              <p className="mono">PASSO 1</p>
              <h3 className="serif" style={{ fontSize: '1.5rem', margin: '8px 0' }}>Conecte seu WhatsApp</h3>
              <p style={{ fontSize: '1rem' }}>Ative seu número em poucos passos para começar a operação.</p>
            </article>
            <article className="card">
              <p className="mono">PASSO 2</p>
              <h3 className="serif" style={{ fontSize: '1.5rem', margin: '8px 0' }}>Configure grupos</h3>
              <p style={{ fontSize: '1rem' }}>Defina origem/destino e plataformas para conversão automática.</p>
            </article>
            <article className="card">
              <p className="mono">PASSO 3</p>
              <h3 className="serif" style={{ fontSize: '1.5rem', margin: '8px 0' }}>Escalone seus envios</h3>
              <p style={{ fontSize: '1rem' }}>Ganhe produtividade com rotina de disparo contínua.</p>
            </article>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="wrap">
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--accent-3)' }}>
            <h2 className="serif">Por que afiliados escolhem o Pro?</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0', textAlign: 'left', display: 'inline-block' }}>
              <li>✅ Operação sem anúncios</li>
              <li>✅ Conversores de links integrados</li>
              <li>✅ Melhor previsibilidade de envios</li>
              <li>✅ Upgrade simples conforme escala</li>
            </ul>
            <div style={{ marginTop: '20px' }}>
              <Link href="/login" className="btn btn-accent">Criar conta e escalar</Link>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="wrap">
          <h2 className="serif" style={{ textAlign: 'center' }}>Perguntas frequentes</h2>
          <div className="grid" style={{ marginTop: '40px' }}>
            <article className="card">
              <h4 className="serif" style={{ fontSize: '1.3rem' }}>Preciso ser técnico?</h4>
              <p style={{ fontSize: '1rem' }}>Não. O fluxo foi pensado para afiliados configurarem rapidamente.</p>
            </article>
            <article className="card">
              <h4 className="serif" style={{ fontSize: '1.3rem' }}>Funciona para qualquer volume?</h4>
              <p style={{ fontSize: '1rem' }}>Sim. Do iniciante ao avançado, o bot se adapta à sua escala.</p>
            </article>
          </div>
        </section>
      </main>
    </>
  )
}
