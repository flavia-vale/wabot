"use client"; // Necessário para usar estilos dinâmicos no Next.js

export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

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

        .lp-body {
          background: var(--bg);
          color: var(--ink);
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .serif { font-family: 'Instrument Serif', serif; font-weight: 400; }
        .wrap { max-width: 1240px; margin: 0 auto; padding: 0 28px; }
        .section { padding: var(--pad-section) 0; }
        
        .btn {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 14px 22px; border-radius: 999px;
          font-weight: 600; text-decoration: none;
          transition: all .2s ease;
        }
        .btn-primary { background: var(--ink); color: var(--surface); }
        .btn-accent { background: var(--accent-strong); color: white; }

        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: var(--pad-card);
        }

        .pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px; border-radius: 999px;
          font-size: 12.5px; background: var(--surface);
          border: 1px solid var(--line); color: var(--ink-soft);
        }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-strong); }
      `}} />

      <div className="lp-body">
        <section className="section wrap" style={{ textAlign: 'center' }}>
          <div className="pill"><div className="dot" /> Feito para afiliados que querem escalar</div>
          <h1 className="serif" style={{ fontSize: '4rem', margin: '24px 0' }}>Bot Conversor para Afiliados</h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '32px', color: 'var(--ink-soft)' }}>
            Converta links e automatize seu WhatsApp com a paleta menta original.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a href="/login" className="btn btn-primary">Começar agora</a>
          </div>
        </section>

        <section className="section wrap">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--gap)' }}>
            <div className="card">
              <h3 className="serif">Conecte seu WhatsApp</h3>
              <p>Ative seu número em poucos passos.</p>
            </div>
            <div className="card">
              <h3 className="serif">Configure grupos</h3>
              <p>Automação completa de links.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
