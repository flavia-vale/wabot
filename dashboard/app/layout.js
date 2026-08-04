import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { ConversionPrompt } from "@/components/marketing/ConversionPrompt";
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_ORG_NAME, BRAND_PRODUCT_NAME, BRAND_SAME_AS, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION, SUPPORT_EMAIL } from '@/lib/marketing-content'

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
  // O sufixo do título é a marca que bate com o domínio (espelhagrupos.com.br).
  // Ver a nota de hierarquia de marca em lib/marketing-content.js.
  title: {
    default: 'Espelha Grupos | Bot para afiliados espelhar ofertas no WhatsApp',
    template: '%s | Espelha Grupos',
  },
  description: 'O Espelha Grupos automatiza grupos e canais de ofertas no WhatsApp: converte o link para o seu código de afiliado e publica sozinho, com intervalo controlado e histórico de envio.',
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
      // A Organization é a MARCA (Espelha Grupos); o produto que ela publica é o
      // BOTinho, declarado abaixo como SoftwareApplication com `publisher`
      // apontando de volta. É esse par que faz Google/IA entenderem os dois
      // nomes como uma entidade só em vez de duas marcas soltas.
      '@id': `${siteUrl}#organization`,
      name: BRAND_ORG_NAME,
      alternateName: [BRAND_PRODUCT_NAME],
      url: siteUrl,
      logo: `${siteUrl}/botinho-logo.svg`,
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: SUPPORT_EMAIL, url: `${siteUrl}/suporte` }],
      sameAs: BRAND_SAME_AS,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: BRAND_PRODUCT_NAME,
      publisher: { '@id': `${siteUrl}#organization` },
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
