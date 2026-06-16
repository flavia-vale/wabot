import "./globals.css";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ToastProvider";
import { ConversionPrompt } from "@/components/marketing/ConversionPrompt";
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME, BRAND_SHORT_NAME, BRAND_SAME_AS, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION, SUPPORT_EMAIL } from '@/lib/marketing-content'

// Fontes auto-hospedadas via next/font: elimina o @import render-blocking do
// Google Fonts (round-trip encadeado CSS->CSS->arquivo) que atrasava o primeiro
// paint para visitantes com cache frio. Os arquivos são servidos do próprio
// domínio (zero requisição à Google) e expostos via CSS vars consumidas pelo CSS.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument-serif",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata = {
  metadataBase: new URL('https://espelhagrupos.com.br'),
  title: {
    default: 'BOTinho | Espelhe grupos e espalhe ofertas no WhatsApp',
    template: '%s | BOTinho',
  },
  description: 'Com o BOTinho, você espelha grupos de WhatsApp e espalha ofertas com controle de cadência, revisão humana e menos operação manual.',
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

function buildGlobalJsonLd() {
  const siteUrl = getSiteUrl();
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: BRAND_NAME,
      alternateName: [BRAND_SHORT_NAME],
      url: siteUrl,
      logo: `${siteUrl}/botinho-logo.svg`,
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: SUPPORT_EMAIL, url: `${siteUrl}/suporte` }],
      sameAs: BRAND_SAME_AS,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: BRAND_NAME,
      alternateName: [BRAND_SHORT_NAME],
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: siteUrl,
      description: PRODUCT_DEFINITION,
      offers: DEFAULT_LANDING_PLANS.map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        priceCurrency: 'BRL',
        price: String(plan.priceValue),
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/login?mode=register`,
        description: `${plan.desc} Período: ${plan.period}.`,
      })),
    },
  ];
}

export default function RootLayout({ children }) {
  const jsonLd = buildGlobalJsonLd();
  return (
    <html lang="pt-br" className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body style={{ background: '#EEF6F2' }}>
        {jsonLd.map((schema) => (
          <script
            key={`global-schema-${schema['@type']}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
        <ToastProvider>{children}<ConversionPrompt /></ToastProvider>
      </body>
    </html>
  );
}
