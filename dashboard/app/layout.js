import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://espelhagrupos.com.br";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Bot para Afiliados no WhatsApp | BOTinho',
    template: '%s | BOTinho',
  },
  description: 'Automatize a conversão de links de afiliado, organize grupos de WhatsApp e envie ofertas com menos trabalho manual.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bot para Afiliados no WhatsApp | BOTinho',
    description: 'Converta links de afiliado e automatize envios de ofertas para seus grupos de WhatsApp.',
    url: '/',
    siteName: 'BOTinho',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body style={{ background: '#EEF6F2' }}><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
