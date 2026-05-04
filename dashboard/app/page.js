import Link from 'next/link'

export default function HomePage() {
  const t = {
    bg: '#EEF6F2',
    surface: '#FCFEFD',
    ink: '#1F2D2A',
    inkSoft: '#5A6E68',
    accent: '#7CC9A9',
    accentStrong: '#3E9C7A',
    line: 'rgba(31,45,42,0.1)'
  };

  return (
    <main style={{ backgroundColor: t.bg, minHeight: '100vh', color: t.ink, fontFamily: 'Inter, sans-serif' }}>
      {/* CSS para as Fontes Serifadas */}
      <style dangerouslySetInnerHTML={{ __html: `
        .serif { font-family: 'Instrument Serif', serif !important; }
        .btn:hover { opacity: 0.9; transform: translateY(-1px); }
      `}} />

      {/* HEADER / HERO */}
      <section style={{ padding: '80px 20px', textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ 
          display: 'inline-flex', alignItems: 'center', gap: '8px', 
          background: t.surface, border: `1px solid ${t.line}`, 
          padding: '6px 16px', borderRadius: '100px', fontSize: '13px', marginBottom: '20px' 
        }}>
          <div style={{ width: '8px', height: '8px', background: t.accentStrong, borderRadius: '50%' }} />
          <span style={{ color: t.inkSoft }}>Feito para afiliados que querem escalar</span>
        </div>

        <h1 className="serif" style={{ fontSize: '64px', lineHeight: '1', marginBottom: '24px', fontWeight: '400' }}>
          Bot Conversor para Afiliados para vender todos os dias
        </h1>
        
        <p style={{ fontSize: '20px', color: t.inkSoft, maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.5' }}>
          Converta links automaticamente e mantenha sua consistência operacional no WhatsApp.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link href="/login" style={{ 
            background: t.ink, color: 'white', padding: '16px 32px', 
            borderRadius: '100px', textDecoration: 'none', fontWeight: '600' 
          }}>Começar agora</Link>
          <Link href="/login" style={{ 
            border: `1px solid ${t.line}`, color: t.ink, padding: '16px 32px', 
            borderRadius: '100px', textDecoration: 'none', fontWeight: '600' 
          }}>Ver demonstração</Link>
        </div>
      </section>

      {/* GRID DE CARDS */}
      <section style={{ padding: '40px 20px', maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {[
          { step: '01', title: 'Conecte seu WhatsApp', desc: 'Ative seu número em poucos passos para começar.' },
          { step: '02', title: 'Configure grupos', desc: 'Defina origem e destino para conversão automática.' },
          { step: '03', title: 'Escalone vendas', desc: 'Ganhe produtividade com disparos contínuos.' }
        ].map((item, i) => (
          <div key={i} style={{ background: t.surface, border: `1px solid ${t.line}`, padding: '32px', borderRadius: '24px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: t.accentStrong, fontWeight: 'bold' }}>PASSO {item.step}</span>
            <h3 className="serif" style={{ fontSize: '28px', margin: '12px 0' }}>{item.title}</h3>
            <p style={{ color: t.inkSoft, lineHeight: '1.4' }}>{item.desc}</p>
          </div>
        ))}
      </section>

      {/* FOOTER CTA */}
      <section style={{ padding: '80px 20px' }}>
        <div style={{ 
          background: '#F6E8D8', borderRadius: '32px', padding: '60px 20px', 
          textAlign: 'center', maxWidth: '1100px', margin: '0 auto', border: `1px solid ${t.line}` 
        }}>
          <h2 className="serif" style={{ fontSize: '42px', marginBottom: '16px' }}>Pronto para automatizar?</h2>
          <p style={{ marginBottom: '32px', color: t.inkSoft }}>Junte-se aos afiliados que já escalaram sua operação.</p>
          <Link href="/login" style={{ 
            background: t.accentStrong, color: 'white', padding: '16px 40px', 
            borderRadius: '100px', textDecoration: 'none', fontWeight: 'bold' 
          }}>Criar minha conta gratuita</Link>
        </div>
      </section>
    </main>
  );
}
