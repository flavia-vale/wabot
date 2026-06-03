'use client'

export function MobileIcon({ name, size = 20, stroke = 1.6 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }
  switch (name) {
    case 'link':
      return <svg {...props}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 1 0 11 21l1.5-1.5"/></svg>
    case 'bolt':
      return <svg {...props}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
    case 'shield':
      return <svg {...props}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z"/></svg>
    case 'chat':
      return <svg {...props}><path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1.4 3.4A8 8 0 0 1 21 12z"/><path d="M8 11h8M8 14h5"/></svg>
    case 'users':
      return <svg {...props}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2 1-4 3-5"/></svg>
    case 'chart':
      return <svg {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
    case 'sparkles':
      return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>
    case 'check':
      return <svg {...props}><path d="M5 12.5 10 17 19 7"/></svg>
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>
    case 'arrow':
      return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    case 'whatsapp':
      return <svg {...props}><path d="M4.5 19.5l1.3-3.8a8 8 0 1 1 3 2.9l-4.3.9z"/><path d="M9.3 9.2c.3 1.7 1.8 3.2 3.5 3.5l.7-.9a.8.8 0 0 1 .9-.3l1.3.5a.8.8 0 0 1 .5.9 2.2 2.2 0 0 1-2.2 1.7c-2.9-.3-5.2-2.6-5.5-5.5a2.2 2.2 0 0 1 1.7-2.2.8.8 0 0 1 .9.5l.5 1.3a.8.8 0 0 1-.2.9z"/></svg>
    case 'star':
      return <svg {...props}><path d="m12 3 2.6 5.6 6 .9-4.3 4.3 1 6-5.3-2.9L6.7 20l1-6-4.3-4.3 6-.9z"/></svg>
    default:
      return null
  }
}
