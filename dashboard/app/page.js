"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0);

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
    <main style={{ backgroundColor: menta.bg, color: menta.ink, minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700&display=swap');
        .serif { font-family: 'Instrument Serif', serif; font-style: italic; }
        .wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        section { padding: 100px 0; }
        .card { background: white; border: 1px solid ${menta.line}; border-radius: 24px; padding: 32px; transition: transform 0.2s; }
        .pill { display: inline-flex; align-items: center; gap: 8px; background: white; padding: 6px 12px; border-radius: 999px; font-size: 12px; border: 1px solid ${menta.line}; margin-bottom: 20px; }
        .btn-primary { background: ${menta.ink}; color: white; padding: 14px 28px; borderRadius: 999px; textDecoration: none; fontWeight: 600; display: inline-flex; align-items: center; }
      `}} />

      {/* 1. HERO SECTION (image_3c2afc.jpg) */}
      <section className="wrap" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '60px', alignItems: 'center' }}>
        <div>
          <div className="pill"><div style={{ width: 6, height: 6, background: menta.accentStrong, borderRadius: '50%' }} /> Experimente grátis!</div>
          <h1 style={{ fontSize: '72px', lineHeight: '0.9', marginBottom: '24px' }}>
            Promoções de outros grupos viram <span className="serif" style={{ color: menta.accentStrong }}>vendas no seu.</span>
          </h1>
          <p style={{ fontSize: '18px', color: menta.inkSoft, marginBottom: '40px', maxWidth: '500px' }}>
            O bot detecta cada link da Shopee, ML ou Amazon, converte para o seu código de afiliado e reposta no seu grupo automaticamente.
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/login" className="btn-primary" style={{ background: menta.accentStrong, borderRadius: 999, padding: '16px 32px', color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>Conectar meu WhatsApp →</Link>
            <Link href="#how" style={{ padding: '16px 32px', border: `1px solid ${menta.line}`, borderRadius: 999, textDecoration: 'none', color: menta.ink }}>Ver como funciona</Link>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.5)', padding: '40px', borderRadius: '40px', border: `1px solid ${menta.line}` }}>
           {/* Representação visual do WhatsApp da imagem */}
           <div style={{ background: 'white', padding: '12px', borderRadius: '12px', boxShadow: menta.shadow, marginBottom: '20px' }}>
              <small style={{ color: menta.accentStrong }}>Link interceptado!</small>
              <div style={{ fontSize: '14px' }}>shopee.com.br/produto-promo...</div>
           </div>
           <div style={{ textAlign: 'center', margin: '20px 0', color: menta.accentStrong }}>↓</div>
           <div style={{ background: 'white', padding: '12px', borderRadius: '12px', borderLeft: `4px solid ${menta.accentStrong}` }}>
              <small style={{ fontWeight: 'bold' }}>Seu Grupo Afiliado</small>
              <div style={{ fontSize: '14px' }}>s.shopee.com.br/seu-link-afiliado</div>
           </div>
        </div>
      </section>

      {/* 2. TRÊS PASSOS (image_3c26bc.png) */}
      <section style={{ background: 'rgba(255,255,255,0.3)' }} id="how">
        <div className="wrap">
          <div className="pill">Como funciona</div>
          <h2 style={{ fontSize: '48px', marginBottom: '60px' }}>Três passos. <br/><span className="serif">Zero esforço diário.</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              { id: '01', title: 'Aponte os grupos para monitorar', desc: 'Conecte seu WhatsApp e marque quais grupos o bot vai escutar.' },
              { id: '02', title: 'O bot detecta e converte o link', desc: 'Toda mensagem é interceptada e o link original trocado pelo seu.' },
              { id: '03', title: 'Posta no SEU grupo de clientes', desc: 'O link convertido vai direto para seu grupo com a sua voz.' }
            ].map(step => (
              <div key={step.id} className="card">
                <span style={{ fontSize: '40px', color: menta.accentStrong }} className="serif">{step.id}</span>
                <h3 style={{ margin: '16px 0' }}>{step.title}</h3>
                <p style={{ color: menta.inkSoft }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. RECURSOS (image_3c2660.jpg) */}
      <section className="wrap">
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
           <div className="pill">Recursos</div>
           <h2 style={{ fontSize: '48px' }}>Pensado para afiliada que <br/><span className="serif">quer escalar</span> sem copiar link.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <h3>Detecção em menos de 1 segundo</h3>
            <div style={{ fontSize: '48px', marginTop: '20px' }}>0,8s <span style={{ fontSize: '16px', color: menta.inkSoft }}>tempo médio</span></div>
          </div>
          <div className="card">
            <h3>5 lojas, mais chegando</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }}>
              {['Shopee', 'Amazon', 'Magalu', 'ML'].map(l => <span key={l} style={{ background: menta.bg, padding: '4px 12px', borderRadius: '8px', fontSize: '12px' }}>{l}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* 4. PLANOS (image_3c239c.jpg) */}
      <section style={{ background: menta.ink, color: 'white' }}>
        <div className="wrap">
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '48px' }}>Preço <span className="serif" style={{ color: menta.accent }}>menor que uma comissão</span> por mês.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
             <div className="card" style={{ color: menta.ink }}>
                <small>INÍCIO</small>
                <div style={{ fontSize: '42px', margin: '20px 0' }}>R$ 29<span style={{ fontSize: '16px' }}>/mês</span></div>
                <ul style={{ padding: 0, listStyle: 'none', fontSize: '14px' }}>
                  <li>✓ Até 2 grupos</li>
                  <li>✓ Shopee + ML</li>
                </ul>
             </div>
             <div className="card" style={{ background: '#2D3A37', color: 'white', border: `1px solid ${menta.accentStrong}` }}>
                <small style={{ color: menta.accent }}>MAIS ESCOLHIDO</small>
                <div style={{ fontSize: '42px', margin: '20px 0' }}>R$ 59<span style={{ fontSize: '16px' }}>/mês</span></div>
                <ul style={{ padding: 0, listStyle: 'none', fontSize: '14px' }}>
                  <li>✓ Grupos Ilimitados</li>
                  <li>✓ Todas as lojas</li>
                </ul>
             </div>
             <div className="card" style={{ color: menta.ink }}>
                <small>AGÊNCIA</small>
                <div style={{ fontSize: '42px', margin: '20px 0' }}>R$ 149<span style={{ fontSize: '16px' }}>/mês</span></div>
                <ul style={{ padding: 0, listStyle: 'none', fontSize: '14px' }}>
                  <li>✓ 5 contas WhatsApp</li>
                </ul>
             </div>
          </div>
        </div>
      </section>

      {/* 5. FAQ (image_3c2376.jpg) */}
      <section className="wrap">
        <h2 className="serif" style={{ fontSize: '48px', marginBottom: '40px' }}>Antes de você perguntar.</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { q: 'Vou ser banida do WhatsApp?', a: 'Não. O bot usa o protocolo oficial e respeita os limites de envio.' },
            { q: 'Preciso deixar meu celular ligado?', a: 'Não, o bot roda 24h na nuvem independentemente do seu aparelho.' },
            { q: 'Funciona com quais programas?', a: 'Shopee, Amazon, Mercado Livre, Magalu e AliExpress.' }
          ].map((item, idx) => (
            <div key={idx} className="card" style={{ cursor: 'pointer' }} onClick={() => setOpenFaq(idx)}>
              <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                {item.q} <span>{openFaq === idx ? '−' : '+'}</span>
              </div>
              {openFaq === idx && <p style={{ marginTop: '16px', color: menta.inkSoft }}>{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* 6. FOOTER CTA (image_3c2300.jpg) */}
      <section className="wrap" style={{ paddingBottom: '100px' }}>
        <div style={{ background: menta.accentStrong, borderRadius: '40px', padding: '80px 40px', textAlign: 'center', color: 'white' }}>
          <h2 style={{ fontSize: '56px', marginBottom: '24px' }}>Sua próxima venda <br/><span className="serif">já está no grupo.</span></h2>
          <Link href="/login" style={{ background: 'white', color: menta.ink, padding: '16px 40px', borderRadius: '999px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block' }}>Conectar meu WhatsApp →</Link>
        </div>
      </section>
    </main>
  );
}
