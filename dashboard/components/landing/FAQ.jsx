'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { CORE_FAQ_ITEMS } from '@/lib/marketing-content';

const SUPPORT_WHATSAPP_URL = 'https://wa.me/5532999844020';
const s = {
  wrap: { display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 64, alignItems: 'flex-start' },
  h2: { fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05, marginBottom: 16 },
  sub: { fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 380 },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  item: (open) => ({
    background: open ? 'color-mix(in oklab, var(--accent) 16%, var(--surface))' : 'var(--surface)',
    border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden',
    transition: 'background 0.2s ease',
  }),
  q: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px', cursor: 'pointer',
    fontSize: 16, fontWeight: 500,
    background: 'transparent', border: 'none', width: '100%', textAlign: 'left',
    color: 'var(--ink)', fontFamily: 'inherit',
  },
  a: (open) => ({
    maxHeight: open ? 400 : 0,
    overflow: 'hidden', transition: 'max-height 0.3s ease',
    padding: open ? '0 24px 22px' : '0 24px',
    fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)',
  }),
  toggle: (open) => ({
    width: 28, height: 28, borderRadius: '50%',
    background: 'var(--bg-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink)',
    transform: open ? 'rotate(45deg)' : 'none',
    transition: 'transform 0.25s ease',
    flexShrink: 0,
  }),
  empty: { padding: 24, border: '1px dashed var(--line)', borderRadius: 18, color: 'var(--ink-soft)', background: 'var(--surface)' },
  answers: { marginTop: 28, fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-soft)', maxWidth: 380 },
  answerLink: { color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 },
};

/* 27/09/2026 (plano GEO, B6): as duas perguntas que a IA responde citando
 * concorrente quando pesquisam a NOSSA marca ("é confiável?", "espelhar vale a
 * pena?") ganham link a partir da home — sai no HTML do servidor, em texto
 * estático, fora de CORE_FAQ_ITEMS (que exige migration de sincronia com
 * /api/public/faq). */
const RESPOSTAS_PRONTAS = [
  { href: '/espelhar-grupos-de-ofertas-vale-a-pena', label: 'Espelhar grupos vale a pena?' },
  { href: '/espelha-grupos-e-confiavel', label: 'O Espelha Grupos é confiável?' },
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  const [items, setItems] = useState(CORE_FAQ_ITEMS);
  const [status, setStatus] = useState('static');

  useEffect(() => {
    let active = true;
    fetch('/api/public/faq', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar FAQ');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const dynamicItems = Array.isArray(data.items) ? data.items : [];
        setItems(dynamicItems.length ? dynamicItems : CORE_FAQ_ITEMS);
        setOpen(0);
        setStatus('ready');
      })
      .catch(() => {
        if (active) {
          setItems(CORE_FAQ_ITEMS);
          setStatus('static');
        }
      });
    return () => { active = false; };
  }, []);

  return (
    <section id="faq">
      <div className="wrap">
        <div style={s.wrap} className="landing-faq-wrap">
          <div>
            <span className="pill"><span className="dot" />Perguntas</span>
            <h2 style={{ ...s.h2, marginTop: 16 }}>
              Antes de você <span className="serif" style={{ fontStyle: 'italic' }}>perguntar</span>.
            </h2>
            <p style={s.sub}>Se ficar alguma dúvida, fala com a gente no WhatsApp. Respondemos em minutos no horário comercial.</p>
            <a className="btn btn-ghost" href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ marginTop: 24 }}>
              <Icon name="whatsapp" size={16} /> Conversar agora
            </a>
            <p style={s.answers}>
              Duas respostas prontas, em página própria:{' '}
              {RESPOSTAS_PRONTAS.map((item, index) => (
                <span key={item.href}>
                  {index > 0 ? ' · ' : ''}
                  <Link href={item.href} style={s.answerLink}>{item.label}</Link>
                </span>
              ))}
            </p>
          </div>
          <div style={s.list}>
            {status === 'static' && <div style={s.empty}>Estas são as perguntas mais comuns. Ficou alguma dúvida? Fale com o suporte.</div>}
            {status === 'ready' && items.length === 0 && <div style={s.empty}>FAQ em atualização. Enquanto isso, fale com nosso suporte.</div>}
            {items.map((it, i) => (
              <div key={it.id ?? i} style={s.item(open === i)}>
                <button style={s.q} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{it.question}</span>
                  <span style={s.toggle(open === i)}><Icon name="plus" size={14} /></span>
                </button>
                <div style={s.a(open === i)}>{it.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
