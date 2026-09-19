import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { ConversionPrompt } from "@/components/marketing/ConversionPrompt";
import { GoogleAdsTag } from "@/components/marketing/GoogleAdsTag";
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_CUPONITO_ABOUT_URL, BRAND_FOUNDER_DESCRIPTION, BRAND_FOUNDER_ID, BRAND_FOUNDER_NAME, BRAND_LEGACY_NAME, BRAND_ORG_NAME, BRAND_PRODUCT_NAME, BRAND_SAME_AS, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION, SUPPORT_EMAIL } from '@/lib/marketing-content'

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
      // Marca e produto passaram a ter o MESMO nome (2026-09-02 — ver o
      // comentário em lib/marketing-content.js). O nome antigo entra como
      // `alternateName` para o Google e as IAs ligarem as citações anteriores a
      // esta mesma entidade em vez de tratá-las como um produto concorrente.
      '@id': `${siteUrl}#organization`,
      name: BRAND_ORG_NAME,
      alternateName: [BRAND_LEGACY_NAME],
      url: siteUrl,
      logo: `${siteUrl}/botinho-logo.svg`,
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: SUPPORT_EMAIL, url: `${siteUrl}/suporte` }],
      sameAs: BRAND_SAME_AS,
      // `founder` fecha a ligação de entidade com o Cuponito (mesma fundadora).
      // Aponta para o nó `Person` abaixo pelo `@id` EXATO que o Cuponito já
      // referencia do lado dele — ver a nota em lib/marketing-content.js.
      founder: { '@id': BRAND_FOUNDER_ID },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      // Este nó existe porque o Cuponito já publica
      // `"founder": { "@id": "https://espelhagrupos.com.br/quem-somos#person" }`
      // — um `@id` que apontava para cá e aqui não existia. É a criação dele
      // que faz os dois lados se confirmarem. Não mudar o `@id`.
      '@id': BRAND_FOUNDER_ID,
      name: BRAND_FOUNDER_NAME,
      description: BRAND_FOUNDER_DESCRIPTION,
      url: `${siteUrl}/quem-somos`,
      sameAs: [`${siteUrl}/quem-somos`, BRAND_CUPONITO_ABOUT_URL],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: BRAND_PRODUCT_NAME,
      alternateName: [BRAND_LEGACY_NAME],
      // `publisher` e `brand` apontam para a MESMA Organization: é o par que
      // impede a IA de ler o produto e a marca como duas empresas diferentes.
      publisher: { '@id': `${siteUrl}#organization` },
      brand: { '@id': `${siteUrl}#organization` },
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
        <GoogleAdsTag />
        <ToastProvider>{children}<ConversionPrompt /></ToastProvider>
      </body>
    </html>
  );
}
