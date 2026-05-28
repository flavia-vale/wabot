'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const modStyles = {
  pageH: { padding:'18px 20px 10px' },
  pageEyebrow: { fontSize: 12, color:'var(--ink-soft)' },
  pageTitle: { fontSize: 22, fontWeight: 600, color:'var(--ink)', letterSpacing:'-0.01em', marginTop: 2 },
  pageSub: { fontSize: 13, color:'var(--ink-soft)', marginTop: 6, lineHeight: 1.5 },

  // Header com voltar
  topnav: {
    padding:'14px 16px 4px',
    display:'flex', alignItems:'center', gap: 10,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 10,
    background:'var(--surface)', border:'1px solid var(--line)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--ink)', cursor:'pointer', fontFamily:'inherit',
  },
  topnavTitle: { fontSize: 14, fontWeight: 600, color:'var(--ink)', flex: 1 },
  topnavAction: {
    fontSize: 13, fontWeight: 600, color:'var(--accent-strong)',
    background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit',
  },

  // Lista de templates
  list: { padding:'10px 16px 0', display:'flex', flexDirection:'column', gap: 10 },
  templateRow: {
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 16, overflow:'hidden',
  },
  templateHead: {
    padding:'14px',
    display:'flex', alignItems:'center', gap: 12,
    cursor:'pointer',
  },
  templateBadge: (color) => ({
    width: 40, height: 40, borderRadius: 12,
    background: color,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize: 20, flexShrink: 0,
  }),
  templateMain: { flex: 1, minWidth: 0 },
  templateName: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  templateMeta: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 3, display:'flex', alignItems:'center', gap: 6 },
  metaPill: {
    fontSize: 10, fontWeight: 600,
    padding:'2px 7px', borderRadius: 999,
    background:'var(--bg-soft)', color:'var(--ink-soft)',
    border:'1px solid var(--line)',
    display:'inline-flex', alignItems:'center', gap: 4,
  },

  templatePreview: {
    margin:'0 14px 14px',
    padding:'10px 12px',
    background:'var(--bg-soft)',
    borderRadius: 10,
    fontSize: 11.5, lineHeight: 1.5,
    color:'var(--ink-soft)',
    whiteSpace:'pre-wrap',
    fontFamily:'inherit',
    maxHeight: 90, overflow:'hidden', position:'relative',
  },
  previewFade: {
    position:'absolute', bottom: 0, left: 0, right: 0, height: 22,
    background:'linear-gradient(to bottom, transparent, var(--bg-soft))',
  },

  addCard: {
    margin:'10px 16px 0',
    padding:'14px',
    background:'var(--surface)', border:'1.5px dashed var(--line-strong)',
    borderRadius: 16,
    display:'flex', alignItems:'center', gap: 12,
    cursor:'pointer', fontFamily:'inherit',
    color:'var(--accent-strong)',
  },
  addIcon: {
    width: 40, height: 40, borderRadius: 12,
    background:'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    border:'1.5px solid color-mix(in oklab, var(--accent) 40%, var(--line))',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--accent-strong)', flexShrink: 0,
  },
  addText: { flex: 1 },
  addTitle: { fontSize: 14, fontWeight: 600, color:'var(--accent-strong)' },
  addSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2, fontWeight: 400 },

  // ─── Modo edição ───
  editH: { padding:'14px 20px 0' },
  editTitle: { fontSize: 22, fontWeight: 600, color:'var(--ink)', letterSpacing:'-0.01em' },

  fieldGroup: { padding:'14px 16px 0' },
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color:'var(--ink-soft)',
    textTransform:'uppercase', letterSpacing:'0.06em', marginBottom: 8,
  },
  nameInput: {
    width:'100%', padding:'12px 14px', fontSize: 15, fontWeight: 600,
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 12,
    fontFamily:'inherit', color:'var(--ink)', outline:'none',
  },

  // Editor de mensagem
  msgEditor: {
    width:'100%', padding:'14px',
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 14,
    fontSize: 13.5, lineHeight: 1.5, color:'var(--ink)',
    fontFamily:'inherit', minHeight: 160, resize:'none', outline:'none',
  },
  varHint: { fontSize: 11, color:'var(--ink-faint)', marginTop: 6, lineHeight: 1.5 },
  varChip: {
    display:'inline-block',
    fontSize: 11, fontFamily:"'JetBrains Mono', monospace",
    padding:'2px 6px', borderRadius: 4,
    background:'var(--bg-soft)', color:'var(--ink-soft)', border:'1px solid var(--line)',
    margin:'0 3px 2px 0',
  },

  // Bônus (reaproveita o padrão da Criar)
  bonusCard: (on) => ({
    margin:'10px 16px 0',
    background: on ? 'var(--surface)' : 'var(--bg-soft)',
    border:'1px solid ' + (on ? 'color-mix(in oklab, var(--accent) 35%, var(--line))' : 'var(--line)'),
    borderRadius: 14,
    overflow:'hidden',
  }),
  bonusHead: { display:'flex', alignItems:'center', gap: 12, padding:'14px', cursor:'pointer' },
  bonusIcon: (on) => ({
    width: 32, height: 32, borderRadius: 9,
    background: on ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))' : 'var(--surface)',
    color: on ? 'var(--accent-strong)' : 'var(--ink-soft)',
    border:'1px solid ' + (on ? 'color-mix(in oklab, var(--accent) 30%, var(--line))' : 'var(--line)'),
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  }),
  bonusMain: { flex: 1, minWidth: 0 },
  bonusTitle: { fontSize: 13.5, fontWeight: 600, color:'var(--ink)' },
  bonusSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },
  bonusToggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? 'var(--accent-strong)' : 'var(--line-strong)',
    position:'relative', flexShrink: 0, cursor:'pointer',
  }),
  bonusKnob: (on) => ({
    width: 16, height: 16, borderRadius:'50%', background:'white',
    position:'absolute', top: 2, left: on ? 18 : 2,
    boxShadow:'0 1px 2px rgba(0,0,0,0.15)',
  }),
  bonusBody: {
    padding:'12px 14px 14px',
    display:'flex', flexDirection:'column', gap: 12,
    borderTop:'1px solid var(--line)',
  },
  miniLabel: { fontSize: 10.5, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600, marginBottom: 6 },
  miniInput: {
    width:'100%', padding:'9px 11px', fontSize: 12.5,
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 9,
    fontFamily:"'JetBrains Mono', monospace",
    color:'var(--ink)', outline:'none',
  },
  miniInputText: {
    width:'100%', padding:'9px 11px', fontSize: 12.5,
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 9,
    fontFamily:'inherit', color:'var(--ink)', outline:'none',
  },
  storeChips: { display:'flex', gap: 6, flexWrap:'wrap' },
  storeChip: (sel) => ({
    padding:'7px 12px', borderRadius: 999,
    border:'1.5px solid ' + (sel ? 'var(--ink)' : 'var(--line)'),
    background: sel ? 'var(--ink)' : 'var(--surface)',
    color: sel ? 'white' : 'var(--ink)',
    fontSize: 12, fontWeight: 500, cursor:'pointer', fontFamily:'inherit',
    display:'inline-flex', alignItems:'center', gap: 5,
  }),
  storeRow: { display:'flex', alignItems:'center', gap: 10, paddingTop: 2 },
  storeBadge: (cor) => ({
    width: 28, height: 28, borderRadius: 7,
    background: cor, color:'white', flexShrink: 0,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight: 700, fontSize: 9.5,
  }),
  storeName: { fontSize: 12, color:'var(--ink-soft)', fontWeight: 500 },

  preview: {
    padding:'10px 12px',
    background:'color-mix(in oklab, var(--success) 8%, var(--bg-soft))',
    border:'1px dashed color-mix(in oklab, var(--success) 30%, var(--line))',
    borderRadius: 9,
    fontSize: 11.5, lineHeight: 1.5,
    whiteSpace:'pre-wrap',
  },

  // Footer save
  footer: {
    margin:'24px 16px',
    display:'flex', gap: 10,
  },
  footerBtn: (primary) => ({
    flex: primary ? 2 : 1,
    padding:'14px',
    background: primary ? 'var(--ink)' : 'var(--surface)',
    color: primary ? 'white' : 'var(--ink)',
    border: primary ? 'none' : '1px solid var(--line)',
    borderRadius: 12,
    fontSize: 13.5, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
    display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
  }),

  // Danger zone
  dangerRow: {
    margin:'0 16px',
    padding:'12px 14px',
    background:'transparent', border:'1px dashed color-mix(in oklab, var(--danger) 30%, var(--line))',
    borderRadius: 12,
    display:'flex', alignItems:'center', gap: 10,
    color:'var(--danger)',
    fontSize: 13, fontWeight: 500,
    cursor:'pointer', fontFamily:'inherit',
    width:'calc(100% - 32px)',
  },
};

export default function TemplatesPage() {
  useMobileRoutePerf('m/account/templates')
  const view = 'list'

  if (view === 'list') {
    const templates = [
      {
        key:'achadinho', nome:'Achadinho ✨', emoji:'✨', cor:'color-mix(in oklab, var(--accent-2) 60%, var(--surface))',
        meta:'modelo padrão · usado em 84% das ofertas hoje',
        bonusGroup: true, bonusCoupons: true,
        preview:'✨ Achadinho do dia\n\n{produto} — só hoje por *{preço}* com frete!\n\nDe ~{preço_de}~ por {preço} 🔥\n\n👉 {link}\n\n🎟 Mais cupons da {loja}:\n{link_cupons}\n\n💜 Entra no nosso grupo:\nwa.me/achadosdasol',
      },
      {
        key:'relampago', nome:'Relâmpago ⚡', emoji:'⚡', cor:'color-mix(in oklab, var(--warn) 25%, var(--surface))',
        meta:'urgência · pra promoções com prazo',
        bonusGroup: true, bonusCoupons: false,
        preview:'⚡ ÚLTIMAS HORAS ⚡\n\n{produto}\nDe {preço_de} por *{preço}*!\n\n⏰ acaba às 23h\n\n👉 {link}',
      },
      {
        key:'tech', nome:'Tech 🔌', emoji:'🔌', cor:'color-mix(in oklab, var(--accent-3) 70%, var(--surface))',
        meta:'eletrônicos e casa',
        bonusGroup: false, bonusCoupons: true,
        preview:'🔌 Achado tech do dia\n\n{produto}\n\n💰 {preço} (de {preço_de})\n📦 frete grátis\n\n👉 {link}',
      },
      {
        key:'beleza', nome:'Beleza 💄', emoji:'💄', cor:'color-mix(in oklab, var(--accent) 25%, var(--surface))',
        meta:'cosméticos e cuidados',
        bonusGroup: true, bonusCoupons: true,
        preview:'💄 Pra você se mimar\n\n{produto}\n\nPreço cheio: {preço_de}\nHoje: *{preço}*\n\n👉 {link}',
      },
    ];

    return (
      <MobileShell title="Conversor" active="conta">
        {/* nav */}
        <div style={modStyles.topnav}>
          <button style={modStyles.backBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div style={modStyles.topnavTitle}>Modelos de mensagem</div>
        </div>

        <div style={modStyles.pageH}>
          <div style={modStyles.pageTitle}>Seus modelos</div>
          <div style={modStyles.pageSub}>
            Cada modelo tem mensagem, link do grupo e cupons configurados. Você escolhe um na hora de criar a oferta.
          </div>
        </div>

        <div style={modStyles.list}>
          {templates.map(t => (
            <div key={t.key} style={modStyles.templateRow}>
              <div style={modStyles.templateHead}>
                <div style={modStyles.templateBadge(t.cor)}>{t.emoji}</div>
                <div style={modStyles.templateMain}>
                  <div style={modStyles.templateName}>{t.nome}</div>
                  <div style={modStyles.templateMeta}>
                    {t.bonusGroup && (
                      <span style={modStyles.metaPill}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        </svg>
                        grupo
                      </span>
                    )}
                    {t.bonusCoupons && (
                      <span style={modStyles.metaPill}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 12V8H4v8h16v-4z"/><path d="M9 8v8M15 8v8"/>
                        </svg>
                        cupons
                      </span>
                    )}
                    {!t.bonusGroup && !t.bonusCoupons && (
                      <span style={{fontSize: 11, color:'var(--ink-faint)'}}>sem bônus</span>
                    )}
                  </div>
                </div>
                <MobileIcon name="arrow" size={14}/>
              </div>
              <div style={modStyles.templatePreview}>
                {t.preview}
                <div style={modStyles.previewFade}/>
              </div>
            </div>
          ))}
        </div>

        <button style={modStyles.addCard}>
          <div style={modStyles.addIcon}>
            <MobileIcon name="plus" size={18} stroke={2.2}/>
          </div>
          <div style={modStyles.addText}>
            <div style={modStyles.addTitle}>Criar novo modelo</div>
            <div style={modStyles.addSub}>do zero ou duplicando um existente</div>
          </div>
          <MobileIcon name="arrow" size={14}/>
        </button>

        <div style={{height: 24}}/>
      </MobileShell>
    );
  }
}
