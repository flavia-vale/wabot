import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata = {
  metadataBase: new URL('https://espelhagrupos.com.br'),
  title: {
    default: 'Bot para Afiliados no WhatsApp | BOTinho',
    template: '%s | BOTinho',
  },
  description: 'Automatize a conversão de links de afiliado, organize grupos de WhatsApp e envie ofertas com menos trabalho manual.',
  alternates: {
    canonical: '/',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#EEF6F2',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body style={{ background: '#EEF6F2' }}><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
