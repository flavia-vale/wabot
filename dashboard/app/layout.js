import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { ConversionPrompt } from "@/components/marketing/ConversionPrompt";
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME, BRAND_SHORT_NAME, BRAND_SAME_AS, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION, SUPPORT_EMAIL } from '@/lib/marketing-content'

// Não use `next/font/google` aqui. Ele baixa CSS/arquivos do Google em tempo
// de build; quando o VPS/GitHub Actions fica sem acesso ao Google Fonts, o build
// falha depois de `rm -rf .next` e o Next passa a servir HTML apontando para
// chunks/CSS inexistentes (`/_next/static/...` 404), quebrando rotas como /admin.
// Mantemos as mesmas CSS vars com pilhas locais/sistema para o build ser
// determinístico e independente de rede externa.
const fontVariables = {
  '--font-inter': 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  '--font-instrument-serif': '"Instrument Serif", Georgia, "Times New Roman", serif',
  '--font-jetbrains-mono': '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
}

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
    <html lang="pt-br" style={fontVariables}>
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
