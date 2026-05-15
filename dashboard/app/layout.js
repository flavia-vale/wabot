import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { BRAND_NAME, BRAND_SHORT_NAME, PRODUCT_DEFINITION, DEFAULT_LANDING_PLANS } from "@/lib/marketing-content";
import { getSiteUrl } from "@/lib/site-url";

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
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', url: `${siteUrl}/suporte` }],
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
    <html lang="pt-br">
      <body style={{ background: '#EEF6F2' }}>
        {jsonLd.map((schema) => (
          <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
