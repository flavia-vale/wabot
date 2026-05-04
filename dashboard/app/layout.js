import './globals.css'

export const metadata = {
  title: 'Bot Conversor para Afiliados — Painel de Controle',
  description: 'Bot Conversor para Afiliados no WhatsApp',
}


export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;600&family=JetBrains+Mono&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
