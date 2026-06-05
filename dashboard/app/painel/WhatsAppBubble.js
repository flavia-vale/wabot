'use client'

/* Balão de prévia no estilo WhatsApp (mockup App.html). Reusa as classes
 * .pnl-wa* já existentes em painel.css e adiciona linha do remetente com selo
 * BOT. TokenText realça variáveis {{...}}/{...} em lavanda. Puramente visual. */

const SENDER_DEFAULT = 'BOTinho'
const TOKEN_RE = /(\{\{[^}]+\}\}|\{[^}]+\})/g

export function TokenText({ text }) {
  const parts = String(text || '').split(TOKEN_RE)
  return parts.map((part, i) =>
    /^\{\{?[^}]+\}?\}$/.test(part) && /\{/.test(part)
      ? <span key={i} className="pnl-wa-var">{part}</span>
      : <span key={i}>{part}</span>,
  )
}

export function WhatsAppBubble({ text, sender = SENDER_DEFAULT, time = '14:23', highlight = false }) {
  return (
    <div className="pnl-wa">
      <div className="pnl-wa-bubble">
        <div className="pnl-wa-sender">{sender} <span className="pnl-wa-badge">BOT</span></div>
        {highlight ? <TokenText text={text} /> : (text || '—')}
        <div className="pnl-wa-meta">{time} ✓✓</div>
      </div>
    </div>
  )
}
