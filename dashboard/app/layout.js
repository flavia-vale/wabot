import "./globals.css";

export const metadata = {
  metadataBase: new URL('https://178.105.54.0'),
  title: {
    default: 'BOTinho | Bot para afiliados no WhatsApp',
    template: '%s | BOTinho',
  },
  description: 'Converta links de afiliado, organize grupos de WhatsApp e automatize envios de ofertas com o BOTinho.',
  openGraph: {
    title: 'BOTinho | Bot para afiliados no WhatsApp',
    description: 'Converta links de afiliado e automatize envios de ofertas para seus grupos de WhatsApp com BOTinho.',
    url: '/',
    siteName: 'BOTinho',
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
