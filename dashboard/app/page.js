import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* RESET E VARIÁVEIS ORIGINAIS */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
          --bg: #EEF6F2;
          --surface: #FCFEFD;
          --ink: #1F2D2A;
          --ink-soft: #5A6E68;
          --accent: #7CC9A9;
          --accent-strong: #3E9C7A;
          --line: rgba(31,45,42,0.1);
          --font-main: 'Inter', sans-serif;
          --font-serif: 'Instrument Serif', serif;
        }

        main { 
          background-color: var(--bg); 
          color: var(--ink); 
          min-height: 100vh;
          font-family: var(--font-main);
          overflow-x: hidden;
        }

        .serif { font-family: var(--font-serif); font-weight: 400; }
        .wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
        
        /* HERO */
        .hero { padding: 100px 0 60px; text-align: center; }
        .pill { 
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--surface); border: 1px solid var(--line);
          padding: 6px 16px; border-radius: 100px; font-size: 13px; margin-bottom: 24px;
        }
        .dot { width: 8px; height: 8px; background: var(--accent-strong); border-radius: 50%; }
        h1 { font-size: clamp(2.5rem, 8vw, 4.5rem); line-height: 1.1; margin-bottom: 20px; }
        .subtitle { font-size: 1.25rem; color: var(--ink-soft); max-width: 600px; margin: 0 auto 32px; }

        /* GRID */
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; padding: 40px 0; }
        .card { 
          background: var(--surface); border: 1px solid var(--line); 
          padding: 32px; border-radius: 24px; transition: 0.2s;
        }
        .card:hover { border-color: var(--accent); }
        .kicker { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.1em; color: var(--accent-strong); margin-bottom: 12px; display: block; }

        /* BOTÕES */
        .btn-row { display: flex; gap: 12px; justifyContent: center; flex-wrap: wrap; justify-content: center; }
        .btn { 
          padding: 16px 32px; border-radius: 100px; font-weight: 600; 
          text-decoration: none; transition: 0.2s; font-size: 16px;
        }
        .btn-primary { background: var(--ink); color: white; }
        .btn-ghost { border: 1px solid var(--line); color: var(--ink); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }

        /* LISTA */
        .check-list { list-style: none; text-align: left; margin: 24px 0; }
        .check-list li { margin-bottom: 12px; display: flex; gap: 10px; align-items: center; }
      `}} />

      <main>
        <section className="hero wrap">
          <div className="pill"><div className="dot" /> Feito para afiliados que querem escalar</div>
          <h1 className="serif">Bot Conversor para Afiliados para vender todos os dias</h1>
          <p className="subtitle">Converta links automaticamente e mantenha consistência operacional sem processos manuais.</p>
          <div className="btn-row">
            <Link href="/login" className="btn btn-primary">Começar agora</Link>
            <Link href="/login" className="btn btn-ghost">Ver demonstração</Link>
          </div>
        </section>

        <section className="wrap">
          <div className="grid">
            <article className="card">
              <span className="kicker">PASSO 01</span>
              <h2 className="serif" style={{fontSize: '1.8rem', marginBottom: '12px'}}>Conecte seu WhatsApp</h2>
              <p style={{color: 'var(--ink-soft)'}}>Ative seu número em poucos passos para começar a operação.</p>
            </article>
            <article className="card">
              <span className="kicker">PASSO 02</span>
              <h2 className="serif" style={{fontSize: '1.8rem', marginBottom: '12px'}}>Configure grupos</h2>
              <p style={{color: 'var(--ink-soft)'}}>Defina origem/destino e plataformas para conversão automática.</p>
            </article>
            <article className="card">
              <span className="kicker">PASSO 03</span>
              <h2 className="serif" style={{fontSize: '1.8rem', marginBottom: '12px'}}>Escalone vendas</h2>
              <p style={{color: 'var(--ink-soft)'}}>Ganhe produtividade com rotina de disparo contínua e organizada.</p>
            </article>
          </div>
        </section>

        <section className="wrap" style={{paddingBottom: '100px'}}>
          <div className="card" style={{background: '#F6E8D8', textAlign: 'center', padding: '60px'}}>
            <h2 className="serif" style={{fontSize: '2.5rem'}}>Por que afiliados escolhem o Pro?</h2>
            <div style={{display: 'inline-block'}}>
              <ul className="check-list">
                <li>✅ Operação sem anúncios</li>
                <li>✅ Conversores de links integrados</li>
                <li>✅ Melhor previsibilidade de envios</li>
              </ul>
            </div>
            <div className="btn-row" style={{marginTop: '20px'}}>
              <Link href="/login" className="btn btn-primary" style={{background: 'var(--accent-strong)'}}>Assinar Plano Pro</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
