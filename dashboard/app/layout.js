import './globals.css'

export const metadata = {
  title: 'Bot Conversor para Afiliados — Painel de Controle',
  description: 'Bot Conversor para Afiliados no WhatsApp',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
