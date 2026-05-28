// MODELOS — gerenciamento de templates de mensagem.
// Acessado via Conta → Modelos de mensagem
//
// Dois sub-modos (props):
//   view = 'list'  → lista todos os templates com preview, ações criar/editar/duplicar
//   view = 'edit'  → editor completo (nome + mensagem + bônus grupo + bônus cupons)

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

const MobileModelos = ({ view = 'list' }) => {
  if (view === 'new') {
    // ─── NEW MODE — escolha: do zero ou duplicar ───
    const templates = [
      {key:'achadinho', nome:'Achadinho ✨', emoji:'✨', meta:'2 bônus · uso em 84% das ofertas', cor:'color-mix(in oklab, var(--accent-2) 60%, var(--surface))'},
      {key:'relampago', nome:'Relâmpago ⚡', emoji:'⚡', meta:'1 bônus · pra promoções com prazo',    cor:'color-mix(in oklab, var(--warn) 25%, var(--surface))'},
      {key:'tech',      nome:'Tech 🔌',     emoji:'🔌', meta:'1 bônus · eletrônicos',                  cor:'color-mix(in oklab, var(--accent-3) 70%, var(--surface))'},
      {key:'beleza',    nome:'Beleza 💄',   emoji:'💄', meta:'2 bônus · cosméticos',                   cor:'color-mix(in oklab, var(--accent) 25%, var(--surface))'},
    ];
    return (
      <MobileFrame title="Novo modelo" active="conta">
        {/* nav */}
        <div style={modStyles.topnav}>
          <button style={modStyles.backBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div style={modStyles.topnavTitle}>Novo modelo</div>
        </div>

        <div style={modStyles.pageH}>
          <div style={modStyles.pageTitle}>Como começar?</div>
          <div style={modStyles.pageSub}>
            Crie um modelo em branco ou parta de um que você já tem.
          </div>
        </div>

        {/* Opção 1 — do zero */}
        <button style={{
          margin:'14px 16px 0', padding:'16px',
          background:'var(--surface)', border:'1.5px solid var(--ink)', borderRadius: 16,
          display:'flex', alignItems:'center', gap: 14,
          cursor:'pointer', fontFamily:'inherit',
          width:'calc(100% - 32px)',
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background:'var(--ink)', color:'white',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontSize: 14, fontWeight: 600, color:'var(--ink)'}}>Do zero</div>
            <div style={{fontSize: 12, color:'var(--ink-soft)', marginTop: 3, lineHeight: 1.4}}>
              Tela em branco. Você escreve a mensagem e configura os bônus.
            </div>
          </div>
          <Icon name="arrow" size={14}/>
        </button>

        {/* Opção 2 — duplicar */}
        <div style={{padding:'24px 20px 6px'}}>
          <div style={modStyles.fieldLabel}>Ou duplicar um existente</div>
        </div>
        <div style={{...modStyles.list, paddingTop: 0}}>
          {templates.map(t => (
            <button key={t.key} style={{
              background:'var(--surface)', border:'1px solid var(--line)',
              borderRadius: 14, padding:'14px',
              display:'flex', alignItems:'center', gap: 12,
              cursor:'pointer', fontFamily:'inherit', textAlign:'left',
              width:'100%',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: t.cor,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: 20, flexShrink: 0,
              }}>{t.emoji}</div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 13.5, fontWeight: 600, color:'var(--ink)'}}>{t.nome}</div>
                <div style={{fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2}}>{t.meta}</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600,
                padding:'4px 10px', borderRadius: 999,
                background:'var(--bg-soft)', color:'var(--ink-soft)',
                border:'1px solid var(--line)',
                display:'inline-flex', alignItems:'center', gap: 4,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                duplicar
              </div>
            </button>
          ))}
        </div>

        <div style={{height: 24}}/>
      </MobileFrame>
    );
  }

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
      <MobileFrame title="Modelos" active="conta">
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
                <Icon name="arrow" size={14}/>
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
            <Icon name="plus" size={18} stroke={2.2}/>
          </div>
          <div style={modStyles.addText}>
            <div style={modStyles.addTitle}>Criar novo modelo</div>
            <div style={modStyles.addSub}>do zero ou duplicando um existente</div>
          </div>
          <Icon name="arrow" size={14}/>
        </button>

        <div style={{height: 24}}/>
      </MobileFrame>
    );
  }

  // ─── EDIT MODE ───
  const lojas = [
    {key:'shopee', nome:'Shopee',        cor:'#EE4D2D', sel:true,  url:'s.shopee.com.br/cupons-sol'},
    {key:'ml',     nome:'Mercado Livre', cor:'#FFE600', sel:true,  url:'mercadolivre.com/loja-sol/cupons'},
    {key:'amazon', nome:'Amazon',        cor:'#FF9900', sel:false, url:''},
    {key:'magalu', nome:'Magalu',        cor:'#0086FF', sel:false, url:''},
    {key:'ali',    nome:'AliExpress',    cor:'#E62E04', sel:false, url:''},
  ];

  const groupOn = true;
  const couponsOn = true;

  return (
    <MobileFrame title="Editar modelo" active="conta">
      {/* nav */}
      <div style={modStyles.topnav}>
        <button style={modStyles.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div style={modStyles.topnavTitle}>Editar modelo</div>
        <button style={modStyles.topnavAction}>Salvar</button>
      </div>

      {/* Nome */}
      <div style={modStyles.fieldGroup}>
        <div style={modStyles.fieldLabel}>Nome do modelo</div>
        <input style={modStyles.nameInput} defaultValue="Achadinho ✨"/>
      </div>

      {/* Mensagem */}
      <div style={modStyles.fieldGroup}>
        <div style={modStyles.fieldLabel}>Mensagem</div>
        <textarea style={modStyles.msgEditor} defaultValue={`✨ Achadinho do dia\n\n{produto} — só hoje por *{preço}* com frete!\n\nDe ~{preço_de}~ por {preço} 🔥\n\n👉 {link}\n\n#achados #moda`}/>
        <div style={modStyles.varHint}>
          Use:
          <span style={modStyles.varChip}>{`{produto}`}</span>
          <span style={modStyles.varChip}>{`{preço}`}</span>
          <span style={modStyles.varChip}>{`{preço_de}`}</span>
          <span style={modStyles.varChip}>{`{link}`}</span>
          <span style={modStyles.varChip}>{`{loja}`}</span>
        </div>
      </div>

      {/* Bônus 1: link do grupo */}
      <div style={{padding:'18px 20px 4px'}}>
        <div style={modStyles.fieldLabel}>Bônus na mensagem</div>
      </div>

      <div style={modStyles.bonusCard(groupOn)}>
        <div style={modStyles.bonusHead}>
          <div style={modStyles.bonusIcon(groupOn)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={modStyles.bonusMain}>
            <div style={modStyles.bonusTitle}>Link do seu grupo</div>
            <div style={modStyles.bonusSub}>convida pra entrar no seu grupo</div>
          </div>
          <div style={modStyles.bonusToggle(groupOn)}>
            <div style={modStyles.bonusKnob(groupOn)}/>
          </div>
        </div>

        {groupOn && (
          <div style={modStyles.bonusBody}>
            <div>
              <div style={modStyles.miniLabel}>Link de convite</div>
              <input style={modStyles.miniInput} defaultValue="wa.me/achadosdasol"/>
            </div>
            <div>
              <div style={modStyles.miniLabel}>Chamada (CTA)</div>
              <input style={modStyles.miniInputText} defaultValue="💜 Entra no nosso grupo:"/>
            </div>
            <div>
              <div style={modStyles.miniLabel}>Preview</div>
              <div style={modStyles.preview}>💜 Entra no nosso grupo:{'\n'}wa.me/achadosdasol</div>
            </div>
          </div>
        )}
      </div>

      {/* Bônus 2: cupons por loja */}
      <div style={modStyles.bonusCard(couponsOn)}>
        <div style={modStyles.bonusHead}>
          <div style={modStyles.bonusIcon(couponsOn)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V8H4v8h16v-4z"/><path d="M9 8v8M15 8v8"/>
            </svg>
          </div>
          <div style={modStyles.bonusMain}>
            <div style={modStyles.bonusTitle}>Página de cupons da loja</div>
            <div style={modStyles.bonusSub}>aparece quando a oferta for da loja correspondente</div>
          </div>
          <div style={modStyles.bonusToggle(couponsOn)}>
            <div style={modStyles.bonusKnob(couponsOn)}/>
          </div>
        </div>

        {couponsOn && (
          <div style={modStyles.bonusBody}>
            <div>
              <div style={modStyles.miniLabel}>Quais lojas você tem cupom?</div>
              <div style={modStyles.storeChips}>
                {lojas.map(l => (
                  <button key={l.key} style={modStyles.storeChip(l.sel)}>
                    {l.sel && <Icon name="check" size={10} stroke={3}/>}
                    {l.nome}
                  </button>
                ))}
              </div>
            </div>

            {lojas.filter(l => l.sel).map(l => (
              <div key={l.key}>
                <div style={modStyles.storeRow}>
                  <div style={modStyles.storeBadge(l.cor)}>{l.nome.slice(0,2).toUpperCase()}</div>
                  <span style={modStyles.storeName}>Link {l.nome}</span>
                </div>
                <input style={{...modStyles.miniInput, marginTop: 6}} defaultValue={l.url}/>
              </div>
            ))}

            <div>
              <div style={modStyles.miniLabel}>Chamada (CTA) · use {'{loja}'} pro nome</div>
              <input style={modStyles.miniInputText} defaultValue="🎟 Mais cupons da {loja}:"/>
            </div>
            <div>
              <div style={modStyles.miniLabel}>Preview (oferta da Shopee)</div>
              <div style={modStyles.preview}>🎟 Mais cupons da Shopee:{'\n'}s.shopee.com.br/cupons-sol</div>
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div style={{height: 18}}/>
      <button style={modStyles.dangerRow}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
        </svg>
        <span style={{flex:1, textAlign:'left'}}>Apagar este modelo</span>
      </button>

      {/* Footer */}
      <div style={modStyles.footer}>
        <button style={modStyles.footerBtn(false)}>Cancelar</button>
        <button style={modStyles.footerBtn(true)}>
          <Icon name="check" size={14} stroke={2.5}/> Salvar modelo
        </button>
      </div>
    </MobileFrame>
  );
};

window.MobileModelos = MobileModelos;
