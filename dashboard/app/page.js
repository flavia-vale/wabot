import Link from 'next/link'

export default function HomePage() {
  const mentaStyles = {
    '--bg': '#EEF6F2',
    '--surface': '#FCFEFD',
    '--ink': '#1F2D2A',
    '--ink-soft': '#5A6E68',
    '--accent': '#7CC9A9',
    '--accent-strong': '#3E9C7A',
    '--line': 'rgba(31,45,42,0.1)',
  };

  return (
    <main style={{ 
      ...mentaStyles, 
      backgroundColor: 'var(--bg)', 
      color: 'var(--ink)', 
      minHeight: '100vh',
      fontFamily: '"Inter", sans-serif' 
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .serif { font-family: "Instrument Serif", serif; font-weight: 400; }
        .btn-primary { background: var(--ink); color: white; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: 600; display: inline-block; transition: 0.2s; }
        .btn-ghost { border: 1px solid var(--line); color: var(--ink); padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: 600; display: inline-block; }
        .card { background: var(--surface); border: 1px solid var(--line); border-radius: 24px; padding: 32px; }
        .pill { background: var(--surface); border: 1px solid var(--line); padding: 6px 16px; border-radius: 100px; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; }
        .dot { width: 8px; height: 8px; background: var(--accent-strong); border-radius: 50%; }
      `}} />

      {/* HERO */}
      <section style={{ padding: '100px 24px', textAlign: 'center', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="pill"><div className="dot" /> <span>Feito para afiliados que querem escalar</span></div>
        <h1 className="serif" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', lineHeight: '1.1', marginBottom: '24px' }}>
          Bot Conversor para Afiliados para vender todos os dias no WhatsApp
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--ink-soft)', maxWidth: '650px', margin: '0 auto 40px' }}>
          Converta links automaticamente, organize grupos e mantenha consistência operacional sem processos manuais.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" className="btn-primary">Começar agora</Link>
          <Link href="/login" className="btn-ghost">Ver demonstração</Link>
        </div>
      </section>

      {/* GRID DE PASSOS */}
      <section style={{ padding: '40px 24px', maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <article className="card">
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-strong)' }}>PASSO 01</span>
          <h2 className="serif" style={{ fontSize: '1.8rem', margin: '12px 0' }}>Conecte seu WhatsApp</h2>
          <p style={{ color: 'var(--ink-soft)' }}>Ative seu número em poucos passos para começar a operação.</p>
        </article>
        <article className="card">
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-strong)' }}>PASSO 02</span>
          <h2 className="serif" style={{ fontSize: '1.8rem', margin: '12px 0' }}>Configure grupos</h2>
          <p style={{ color: 'var(--ink-soft)' }}>Defina origem/destino e plataformas para conversão automática.</p>
        </article>
        <article className="card">
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-strong)' }}>PASSO 03</span>
          <h2 className="serif" style={{ fontSize: '1.8rem', margin: '12px 0' }}>Escalone vendas</h2>
          <p style={{ color: 'var(--ink-soft)' }}>Ganhe produtividade com rotina de disparo contínua.</p>
        </article>
      </section>

      {/* FOOTER CTA */}
      <section style={{ padding: '80px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="card" style={{ background: '#F6E8D8', textAlign: 'center', padding: '60px 20px' }}>
          <h2 className="serif" style={{ fontSize: '2.5rem' }}>Pronto para escalar sua operação?</h2>
          <p style={{ margin: '20px 0 32px' }}>Junte-se a centenas de afiliados que já automatizaram seus fluxos.</p>
          <Link href="/login" className="btn-primary" style={{ background: 'var(--accent-strong)' }}>Criar minha conta agora</Link>
        </div>
      </section>
    </main>
  );
}
