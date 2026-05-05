import "./globals.css";

export const metadata = {
  metadataBase: new URL('http://178.105.54.0'),
  title: {
    default: 'Bot para Afiliados no WhatsApp | Wabot',
    template: '%s | Wabot',
  },
  description: 'Automatize a conversão de links de afiliado, organize grupos de WhatsApp e envie ofertas com menos trabalho manual.',
  openGraph: {
    title: 'Bot para Afiliados no WhatsApp | Wabot',
    description: 'Converta links de afiliado e automatize envios de ofertas para seus grupos de WhatsApp.',
    url: '/',
    siteName: 'Wabot',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body style={{ background: '#EEF6F2' }}>{children}</body>
    </html>
  );
}
