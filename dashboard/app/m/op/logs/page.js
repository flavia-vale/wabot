'use client'

import { useState, useEffect, useMemo } from 'react'
import { api } from '@/lib/api'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

// Backend MessageLog.status -> chip de status da UI mobile.
const STATUS_TO_UI = {
  success: 'ok',
  error: 'falha',
  queued: 'fila',
  sending: 'fila',
  skipped: 'ignorado',
}

const PLATFORM_LABEL = {
  shopee: 'Shopee',
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magalu',
  magalu: 'Magalu',
  aliexpress: 'AliExpress',
}

// Mesmas traduções amigáveis do painel desktop (dashboard/app/dashboard/logs).
function friendlyError(errorMsg) {
  if (!errorMsg) return null
  if (errorMsg.startsWith('warning:amazon_cookies_expired')) return 'Seus cookies da Amazon expiraram. As ofertas continuam saindo, mas para gerar links curtos amzn.to renove em Conta → Credenciais → Amazon.'
  if (errorMsg.startsWith('skip:dedup')) return 'Link já enviado nas últimas 2 horas — bloqueado para não duplicar.'
  if (errorMsg.startsWith('skip:blocked_keyword')) return 'Contém uma palavra que você marcou para bloquear.'
  if (errorMsg.startsWith('skip:title_mismatch')) return 'O texto da oferta não combina com o produto do link. Bloqueado por segurança.'
  if (errorMsg.startsWith('skip:text_too_large')) return 'Mensagem muito grande — ignorada para não atrasar o restante da fila.'
  if (errorMsg.startsWith('skip:no_valid_conversions')) return 'Nenhum link da mensagem pôde ser convertido em link de afiliado.'
  if (errorMsg.startsWith('skip:policy')) return errorMsg.endsWith(':unsupported_store') ? 'Ignorada: ainda não fazemos conversão de afiliado para essa loja.' : 'Mensagem fora das regras de encaminhamento que você configurou para este grupo.'
  if (errorMsg.startsWith('skip:decrypt_failed')) return 'O WhatsApp não conseguiu decifrar essa mensagem na sua ponta. Costuma ser pontual.'
  if (errorMsg.startsWith('skip:incoming_error')) return 'Tivemos um erro ao processar essa mensagem antes de enviar.'
  if (errorMsg.startsWith('timeout:send')) return 'O envio para o grupo/canal de destino demorou demais e foi cancelado.'
  if (errorMsg.startsWith('timeout:incoming')) return 'A leitura e o preparo dessa promoção demoraram demais. Costuma ser site de produto lento.'
  if (errorMsg.startsWith('error:queue_full')) return 'Fila interna de envios cheia neste instante — tente novamente em alguns minutos.'
  if (errorMsg.startsWith('error:worker_restart')) return 'O bot reiniciou enquanto essa mensagem estava esperando para ser enviada.'
  if (errorMsg.startsWith('error:channel_forbidden')) return 'O bot não tem permissão para postar nesse canal. Verifique se ele ainda é admin.'
  if (errorMsg.startsWith('error:channel_throttled')) return 'O WhatsApp limitou temporariamente os envios para esse canal. Tentaremos novamente.'
  if (errorMsg.startsWith('error:baileys')) return 'O WhatsApp recusou o envio. Pode ser instabilidade momentânea.'
  if (errorMsg.startsWith('error:conversion')) return `Não conseguimos converter o link em afiliado: ${errorMsg.slice('error:conversion:'.length)}`
  if (errorMsg.startsWith('error:other')) return errorMsg.slice('error:other:'.length) || 'Falha não classificada.'
  return errorMsg
}

function isRealGroup(jid) {
  return typeof jid === 'string' && jid.includes('@') && jid !== 'skipped' && jid !== 'conversion'
}

function dayBucket(date, now) {
  const d = new Date(date)
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60_000)
  if (d >= startOfToday) return 'hoje'
  if (d >= startOfYesterday) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// MessageLog (backend) -> item esperado pelo render da UI mobile.
function toMobileItem(log, now) {
  const status = STATUS_TO_UI[log.status] || 'ignorado'
  const sentAt = new Date(log.sentAt)
  const firstLine = String(log.messageText || '').split('\n').find(l => l.trim()) || ''
  const produto = (firstLine || log.convertedUrl || log.originalUrl || '(sem texto)').slice(0, 80)
  const source = isRealGroup(log.sourceGroup) ? 'auto' : 'manual'
  return {
    id: log.id,
    status,
    source,
    hora: sentAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    day: dayBucket(log.sentAt, now),
    loja: PLATFORM_LABEL[String(log.platform || '').toLowerCase()] || log.platform || '—',
    produto,
    de: source === 'auto' ? (log.sourceGroupName || log.sourceGroup) : 'Você criou',
    para: isRealGroup(log.destGroup) ? (log.destGroupName || log.destGroup) : null,
    link: log.originalUrl || null,
    conv: status === 'ok' && log.convertedUrl ? log.convertedUrl : null,
    erro: status === 'falha' ? friendlyError(log.errorMsg) : null,
    motivo: status === 'ignorado' ? friendlyError(log.errorMsg) : null,
  }
}

const envStyles = {
  pageH: {
    padding:'18px 20px 14px',
    display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap: 16,
  },
  pageEyebrow: { fontSize: 12, color:'var(--ink-soft)' },
  pageTitle: { fontSize: 22, fontWeight: 600, color:'var(--ink)', letterSpacing:'-0.01em', marginTop: 2 },

  // Toolbar — busca + ritmo (icon) lado a lado
  toolbar: { padding:'0 16px 0', display:'flex', gap: 8 },
  searchWrap: { flex: 1, position:'relative' },
  searchInput: {
    width:'100%', padding:'11px 14px 11px 38px',
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 12,
    fontSize: 13, color:'var(--ink)', fontFamily:'inherit', outline:'none',
  },
  searchIcon: {
    position:'absolute', left: 14, top:'50%', transform:'translateY(-50%)',
    color:'var(--ink-faint)',
  },
  cadenceBtn: {
    width: 42, height: 42, borderRadius: 12,
    background:'var(--surface)', border:'1px solid var(--line)',
    color:'var(--ink)',
    display:'flex', alignItems:'center', justifyContent:'center',
    cursor:'pointer', fontFamily:'inherit',
    position:'relative',
  },
  cadenceDot: {
    position:'absolute', top: 8, right: 8,
    width: 6, height: 6, borderRadius:'50%', background:'var(--success)',
  },

  // Filter chips — palavras em vez de jargão
  chipRow: {
    display:'flex', gap: 6, overflowX:'auto',
    padding:'14px 16px 4px', scrollbarWidth:'none',
  },
  chip: (active) => ({
    flexShrink: 0,
    padding:'7px 12px', borderRadius: 999,
    border:'1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
    background: active ? 'var(--ink)' : 'var(--surface)',
    color: active ? 'white' : 'var(--ink)',
    fontSize: 12, fontWeight: 500, cursor:'pointer', fontFamily:'inherit',
    display:'inline-flex', alignItems:'center', gap: 6,
  }),
  chipCount: (active) => ({
    fontSize: 10.5,
    opacity: active ? .75 : .55,
    padding:'1px 6px', borderRadius: 999,
    background: active ? 'rgba(255,255,255,0.15)' : 'var(--bg-soft)',
  }),

  // Day separator
  daySep: {
    padding:'18px 20px 8px',
    display:'flex', alignItems:'center', gap: 10,
  },
  dayLabel: { fontSize: 11, fontWeight: 600, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.08em' },
  dayLine: { flex: 1, height: 1, background:'var(--line)' },

  // Lista de items
  item: (expanded) => ({
    margin:'0 16px 8px',
    padding: 14,
    background: expanded ? 'color-mix(in oklab, var(--accent) 6%, var(--surface))' : 'var(--surface)',
    border:'1px solid ' + (expanded ? 'color-mix(in oklab, var(--accent) 30%, var(--line))' : 'var(--line)'),
    borderRadius: 14,
    cursor:'pointer',
  }),
  itemTop: { display:'flex', alignItems:'flex-start', gap: 10 },
  statusDot: (status) => ({
    width: 10, height: 10, borderRadius:'50%',
    marginTop: 5, flexShrink: 0,
    background: status === 'ok' ? 'var(--success)'
              : status === 'falha' ? 'var(--danger)'
              : status === 'fila' ? 'var(--warn)'
              : status === 'ignorado' ? 'var(--ink-faint)'
              : 'var(--ink-faint)',
    boxShadow: status === 'fila' ? '0 0 0 3px color-mix(in oklab, var(--warn) 30%, transparent)' : 'none',
  }),
  itemMain: { flex: 1, minWidth: 0 },
  itemHead: { display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 8, marginBottom: 5 },
  itemTitle: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)', lineHeight: 1.3, flex: 1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  itemTime: { fontSize: 11, color:'var(--ink-faint)', fontFamily:"'JetBrains Mono', monospace", flexShrink: 0 },

  itemMeta: { fontSize: 12, color:'var(--ink-soft)', display:'flex', alignItems:'center', gap: 5, flexWrap:'wrap' },
  storeLabel: { fontSize: 11.5, color:'var(--ink-soft)' },
  destStrong: { color:'var(--ink)', fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth: 130 },
  destFail: { color:'var(--danger)', fontWeight: 500 },

  itemFoot: {
    marginTop: 8,
    display:'flex', alignItems:'center', gap: 6, flexWrap:'wrap',
  },
  statusPill: (status) => ({
    fontSize: 10.5, fontWeight: 600,
    padding:'2px 8px', borderRadius: 999,
    background: status === 'ok' ? 'color-mix(in oklab, var(--success) 16%, var(--surface))'
              : status === 'falha' ? 'color-mix(in oklab, var(--danger) 16%, var(--surface))'
              : status === 'fila' ? 'color-mix(in oklab, var(--warn) 18%, var(--surface))'
              : status === 'ignorado' ? 'var(--bg-soft)'
              : 'var(--bg-soft)',
    color: status === 'ok' ? 'var(--success)'
         : status === 'falha' ? 'var(--danger)'
         : status === 'fila' ? 'var(--warn)'
         : 'var(--ink-soft)',
    border:'1px solid var(--line)',
  }),
  sourceBadge: (kind) => ({
    fontSize: 10.5, fontWeight: 600,
    padding:'2px 8px', borderRadius: 999,
    background: 'var(--bg-soft)',
    color: 'var(--ink-soft)',
    border:'1px solid var(--line)',
    display:'inline-flex', alignItems:'center', gap: 4,
  }),

  // Expanded detail
  expanded: {
    marginTop: 12, paddingTop: 12, borderTop:'1px solid var(--line)',
    display:'flex', flexDirection:'column', gap: 10,
  },
  exField: {},
  exLabel: { fontSize: 10, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600, marginBottom: 4 },
  exLink: { fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--ink)', wordBreak:'break-all' },
  exLinkSuccess: { fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--success)', fontWeight: 500, wordBreak:'break-all' },
  errorBox: {
    padding: 10,
    background:'color-mix(in oklab, var(--danger) 10%, var(--surface))',
    border:'1px solid color-mix(in oklab, var(--danger) 25%, var(--line))',
    borderRadius: 10,
    fontSize: 12, color:'var(--danger)',
    display:'flex', alignItems:'flex-start', gap: 8,
  },
  reasonBox: {
    padding: 10,
    background:'var(--bg-soft)', borderRadius: 10,
    fontSize: 12, color:'var(--ink-soft)',
    lineHeight: 1.45,
  },
  exActions: { display:'flex', gap: 6, flexWrap:'wrap', marginTop: 2 },
  actionBtn: (kind) => ({
    padding:'8px 14px', borderRadius: 999,
    fontSize: 12, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
    background: kind === 'primary' ? 'var(--ink)' : 'transparent',
    color: kind === 'primary' ? 'white' : 'var(--ink)',
    border: kind === 'primary' ? '1px solid var(--ink)' : '1px solid var(--line)',
  }),
};

export default function LogsPage() {
  useMobileRoutePerf('m/op/logs')

  const [filter, setFilter] = useState('todos');
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');

  const [rawLogs, setRawLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.logs('all', 1, 50);
        if (!active) return;
        setRawLogs(Array.isArray(data?.logs) ? data.logs : []);
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar os envios.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false };
  }, []);

  const items = useMemo(() => {
    const now = new Date();
    return rawLogs.map(log => toMobileItem(log, now));
  }, [rawLogs]);

  // Contadores dos chips a partir dos itens carregados (mantém chip e lista consistentes).
  const filters = useMemo(() => {
    const count = (s) => items.filter(it => it.status === s).length;
    return [
      {key:'todos',     label:'Tudo',         n: items.length},
      {key:'fila',      label:'Aguardando',   n: count('fila')},
      {key:'ok',        label:'Postados',     n: count('ok')},
      {key:'falha',     label:'Erros',        n: count('falha')},
      {key:'ignorado',  label:'Não postados', n: count('ignorado')},
    ];
  }, [items]);

  const filtered = items.filter(it => {
    if (filter !== 'todos' && it.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [it.produto, it.loja, it.de, it.para].some(v => String(v || '').toLowerCase().includes(q));
  });

  const grouped = [];
  let currentDay = null;
  filtered.forEach(it => {
    if (it.day !== currentDay) {
      grouped.push({sep: true, day: it.day});
      currentDay = it.day;
    }
    grouped.push(it);
  });

  const statusLabel = (s) => ({
    ok: 'postado',
    falha: 'erro',
    fila: 'aguardando',
    ignorado: 'não postado',
  })[s];

  return (
    <MobileShell title="Conversor" active="envios">
      <div style={envStyles.pageH}>
        <div>
          <div style={envStyles.pageEyebrow}>Tudo que sai do bot</div>
          <div style={envStyles.pageTitle}>Envios</div>
        </div>
      </div>

      {/* Toolbar: busca + ritmo (icon button discreto) */}
      <div style={envStyles.toolbar}>
        <div style={envStyles.searchWrap}>
          <input
            placeholder="Buscar produto, grupo ou loja"
            style={envStyles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={envStyles.searchIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
        <button style={envStyles.cadenceBtn} title="Ajustar ritmo · 1 a cada 12 min">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div style={envStyles.cadenceDot}/>
        </button>
      </div>

      {/* Filtros em palavras claras */}
      <div style={envStyles.chipRow}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={envStyles.chip(filter === f.key)}>
            {f.label}
            <span style={envStyles.chipCount(filter === f.key)}>{f.n}</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{padding:'4px 0 0'}}>
        {loading && <div style={{padding:'0 16px'}}><MobileLoadingCard label="Carregando envios..." /></div>}
        {!loading && error && <div style={{padding:'0 16px'}}><MobileErrorCard message={error} /></div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{padding:'40px 24px', textAlign:'center', color:'var(--ink-soft)', fontSize: 13}}>
            {items.length === 0 ? 'Nenhum envio ainda. Quando o bot postar ou você criar uma oferta, aparece aqui.' : 'Nenhum envio bate com esse filtro.'}
          </div>
        )}
        {!loading && !error && grouped.map((row, gIdx) => {
          if (row.sep) {
            return (
              <div key={`sep-${row.day}-${gIdx}`} style={envStyles.daySep}>
                <span style={envStyles.dayLabel}>{row.day}</span>
                <div style={envStyles.dayLine}/>
              </div>
            );
          }
          const it = row;
          const isExp = expanded === it.id;
          return (
            <div key={it.id} style={envStyles.item(isExp)} onClick={() => setExpanded(isExp ? null : it.id)}>
              <div style={envStyles.itemTop}>
                <div style={envStyles.statusDot(it.status)}/>
                <div style={envStyles.itemMain}>
                  <div style={envStyles.itemHead}>
                    <div style={envStyles.itemTitle}>{it.produto}</div>
                    <span style={envStyles.itemTime}>{it.hora}</span>
                  </div>

                  <div style={envStyles.itemMeta}>
                    <span style={envStyles.storeLabel}>{it.loja}</span>
                    <span style={{color:'var(--ink-faint)'}}>·</span>
                    {it.de && <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth: 110}}>{it.de}</span>}
                    {it.de && <span style={{color:'var(--accent-strong)'}}>→</span>}
                    {it.para
                      ? <span style={envStyles.destStrong}>{it.para}</span>
                      : it.destinos ? <span style={envStyles.destStrong}>{it.destinos.join(', ')}</span>
                      : <span style={envStyles.destFail}>—</span>
                    }
                  </div>

                  <div style={envStyles.itemFoot}>
                    <span style={envStyles.statusPill(it.status)}>
                      {statusLabel(it.status)}
                    </span>
                    <span style={envStyles.sourceBadge(it.source)}>
                      {it.source === 'auto' ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/><path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
                          </svg>
                          espelhado
                        </>
                      ) : (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                          feito por você
                        </>
                      )}
                    </span>
                  </div>

                  {isExp && (
                    <div style={envStyles.expanded}>
                      {it.link && (
                        <div style={envStyles.exField}>
                          <div style={envStyles.exLabel}>Link original</div>
                          <div style={envStyles.exLink}>{it.link}</div>
                        </div>
                      )}
                      {it.conv && (
                        <div style={envStyles.exField}>
                          <div style={envStyles.exLabel}>Link convertido</div>
                          <div style={envStyles.exLinkSuccess}>{it.conv}</div>
                        </div>
                      )}
                      {it.erro && (
                        <div style={envStyles.errorBox}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{flexShrink:0, marginTop: 1}}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r=".5"/>
                          </svg>
                          {it.erro}
                        </div>
                      )}
                      {it.motivo && (
                        <div style={envStyles.reasonBox}>
                          <strong style={{color:'var(--ink)'}}>Por que não foi postado:</strong> {it.motivo}
                        </div>
                      )}
                      <div style={envStyles.exActions}>
                        {it.status === 'falha' && <button style={envStyles.actionBtn('primary')}>Tentar de novo</button>}
                        {it.status === 'fila' && <button style={envStyles.actionBtn('primary')}>Enviar agora</button>}
                        {it.status === 'fila' && <button style={envStyles.actionBtn('ghost')}>Reagendar</button>}
                        {it.status === 'fila' && <button style={envStyles.actionBtn('ghost')}>Cancelar</button>}
                        {it.status === 'ignorado' && <button style={envStyles.actionBtn('ghost')}>Postar mesmo assim</button>}
                        {it.status === 'ignorado' && <button style={envStyles.actionBtn('ghost')}>Mudar regra</button>}
                        {it.status === 'ok' && <button style={envStyles.actionBtn('ghost')}>Repostar</button>}
                        {it.status === 'ok' && <button style={envStyles.actionBtn('ghost')}>Ver no WhatsApp</button>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{height: 20}}/>
    </MobileShell>
  );
}
