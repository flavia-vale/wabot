"use client";
import Link from 'next/link';

export default function LandingPage() {
  // Definições exatas da paleta Menta do seu ficheiro original
  const menta = {
    bg: '#EEF6F2',
    surface: '#FCFEFD',
    ink: '#1F2D2A',
    inkSoft: '#5A6E68',
    accent: '#7CC9A9',
    accentStrong: '#3E9C7A',
    line: 'rgba(31,45,42,0.10)',
    shadow: '0 30px 60px -30px rgba(62,156,122,0.30)'
  };

  return (
    <main style={{ 
      backgroundColor: menta.bg, 
      color: menta.ink, 
      minHeight: '100vh', 
      fontFamily: '"Inter", sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Importação das fontes exatas */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600&display=swap');
        .serif { font-family: 'Instrument Serif', serif; font-style: italic; }
        .hero-title { font-size: clamp(3rem, 8vw, 5rem); line-height: 0.9; letter-spacing: -0.04em; }
        .wa-card { background: white; border-radius: 12px; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 10px; max-width: 280px; }
      `}} />

      {/* Navegação Superior */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 5%', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '24px', height: '24px', background: menta.accent, borderRadius: '6px' }} />
          bot conversor <span style={{ opacity: 0.5, fontWeight: 'normal' }}>.afiliados</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link href="/login" style={{ textDecoration: 'none', color: menta.ink }}>Entrar</Link>
          <Link href="/login" style={{ 
            background: menta.ink, color: 'white', padding: '10px 20px', 
            borderRadius: '999px', textDecoration: 'none', fontWeight: '600' 
          }}>Começar grátis</Link>
        </div>
      </nav>

      {/* Hero Section Reconstruída conforme a Imagem */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '60px 5%', gap: '40px', alignItems: 'center' }}>
        
        {/* Lado Esquerdo: Texto */}
        <div>
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px', 
            background: 'white', padding: '6px 12px', borderRadius: '999px', 
            fontSize: '12px', marginBottom: '24px', border: `1px solid ${menta.line}` 
          }}>
            <div style={{ width: '6px', height: '6px', background: menta.accentStrong, borderRadius: '50%' }} />
            Experimente grátis!
          </div>
          
          <h1 className="hero-title">
            Promoções de outros grupos viram <span className="serif" style={{ color: menta.accentStrong }}>vendas no seu.</span>
          </h1>
          
          <p style={{ fontSize: '18px', color: menta.inkSoft, margin: '32px 0', maxWidth: '480px', lineHeight: '1.5' }}>
            O bot detecta cada link da Shopee, ML ou Amazon, converte para o seu código de afiliado e reposta no seu próprio grupo de clientes.
          </p>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/login" style={{ 
              background: menta.accentStrong, color: 'white', padding: '16px 32px', 
              borderRadius: '999px', textDecoration: 'none', fontWeight: 'bold' 
            }}>Conectar meu WhatsApp →</Link>
            <Link href="#how" style={{ 
              padding: '16px 32px', borderRadius: '999px', textDecoration: 'none', 
              color: menta.ink, border: `1px solid ${menta.line}` 
            }}>Ver como funciona</Link>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '40px', fontSize: '13px', color: menta.inkSoft }}>
            <span>✓ Sem cartão para testar</span>
            <span>✓ Configura em 4 minutos</span>
          </div>
        </div>

        {/* Lado Direito: Simulação do WhatsApp (O diferencial visual) */}
        <div style={{ position: 'relative', background: 'rgba(255,255,255,0.4)', borderRadius: '40px', padding: '30px', border: `1px solid ${menta.line}` }}>
          {/* Balão de Notificação */}
          <div style={{ position: 'absolute', top: '-20px', left: '-20px', background: 'white', padding: '12px', borderRadius: '12px', boxShadow: menta.shadow, fontSize: '12px', zIndex: 10 }}>
            <b>Link interceptado</b> <br/> <span style={{opacity: 0.6}}>de "Promoções Brasil"</span>
          </div>

          {/* Grupo de Origem */}
          <div className="wa-card" style={{ opacity: 0.7, transform: 'scale(0.9)' }}>
            <small style={{ color: menta.accentStrong }}>Promo relâmpago! Sandália linda...</small>
            <div style={{ background: '#f0f0f0', height: '8px', width: '80%', marginTop: '8px', borderRadius: '4px' }} />
          </div>

          {/* Seta de Conversão */}
          <div style={{ textAlign: 'center', margin: '20px 0', color: menta.accentStrong, fontWeight: 'bold' }}>
            ↓ converte e reposta no seu grupo
          </div>

          {/* Grupo de Destino (O seu) */}
          <div className="wa-card" style={{ borderLeft: `4px solid ${menta.accentStrong}`, maxWidth: '320px', marginLeft: '20px' }}>
            <small style={{ fontWeight: 'bold' }}>Seu Bot Afiliado</small>
            <p style={{ fontSize: '14px', marginTop: '5px' }}>✨ Achadinho do dia! Sandália Bege por <b>R$ 39,90</b></p>
            <div style={{ color: menta.accentStrong, fontSize: '12px', marginTop: '4px' }}>s.shopee.com.br/seu-link-afiliado</div>
          </div>

          {/* Card de Comissão */}
          <div style={{ position: 'absolute', bottom: '20px', right: '-30px', background: 'white', padding: '15px', borderRadius: '16px', boxShadow: menta.shadow, textAlign: 'right' }}>
            <small style={{ opacity: 0.6 }}>Comissão hoje</small>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }} className="serif">R$ 184,50</div>
            <div style={{ color: '#4CAF50', fontSize: '12px' }}>+ R$ 4,79 de comissão</div>
          </div>
        </div>

      </section>
    </main>
  );
}
