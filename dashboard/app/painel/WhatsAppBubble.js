'use client'

/* Balão de prévia no estilo WhatsApp (mockup App.html). Reusa as classes
 * .pnl-wa* já existentes em painel.css e adiciona linha do remetente com selo
 * BOT. Modos de render do texto:
 *   - highlight: realça variáveis {{...}}/{...} em lavanda/verde (TokenText)
 *   - format: aplica negrito *texto* e tachado ~texto~ do WhatsApp
 *   - (padrão): texto puro
 * Puramente visual. */

const SENDER_DEFAULT = 'BOTinho'
const TOKEN_RE = /(\{\{[^}]+\}\}|\{[^}]+\})/g

export function TokenText({ text }) {
  const parts = String(text || '').split(TOKEN_RE)
  return parts.map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part)
      ? <span key={i} className="pnl-wa-var pnl-wa-var-block">{part}</span>
      : /^\{[^}]+\}$/.test(part)
        ? <span key={i} className="pnl-wa-var">{part}</span>
        : <span key={i}>{part}</span>,
  )
}

const INLINE_FMT_RE = /(\*[^*]+\*|~[^~]+~)/g

function FormattedText({ text }) {
  return String(text || '').split('\n').map((line, li) => (
    <div key={li} style={{ minHeight: line ? undefined : 8 }}>
      {line.split(INLINE_FMT_RE).map((p, i) => {
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <b key={i} style={{ fontWeight: 700 }}>{p.slice(1, -1)}</b>
        if (p.startsWith('~') && p.endsWith('~') && p.length > 2) return <span key={i} style={{ textDecoration: 'line-through', opacity: 0.6 }}>{p.slice(1, -1)}</span>
        return <span key={i}>{p}</span>
      })}
    </div>
  ))
}

export function WhatsAppBubble({ text, sender = SENDER_DEFAULT, time = '14:23', highlight = false, format = false, imageUrl = '' }) {
  return (
    <div className="pnl-wa">
      <div className="pnl-wa-bubble">
        <div className="pnl-wa-sender">{sender} <span className="pnl-wa-badge">BOT</span></div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, margin: '4px 0 8px' }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : null}
        {highlight ? <TokenText text={text} /> : format ? <FormattedText text={text} /> : (text || '—')}
        <div className="pnl-wa-meta">{time} ✓✓</div>
      </div>
    </div>
  )
}
