import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { ConversionPrompt } from "@/components/marketing/ConversionPrompt";
import { GoogleAdsTag } from "@/components/marketing/GoogleAdsTag";
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageDescriptor } from '@/lib/seo-og'
import { BRAND_LEGACY_NAME, BRAND_ORG_NAME, BRAND_PRODUCT_NAME, BRAND_SAME_AS, DEFAULT_LANDING_PLANS, FOUNDER_PERSON_ID_PATH, FOUNDER_SAME_AS, PRODUCT_DEFINITION, SUPPORTED_STORES, SUPPORT_EMAIL } from '@/lib/marketing-content'
import { EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'

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
  // Imagem de prévia padrão para toda página que não declarar a sua (o Next
  // substitui o objeto `openGraph` inteiro quando a página define um — quem
  // define precisa passar `images` também; ver lib/seo-og.js).
  openGraph: {
    siteName: 'Espelha Grupos',
    locale: 'pt_BR',
    type: 'website',
    images: [buildOgImageDescriptor()],
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
      // A fundadora é a MESMA pessoa que o Cuponito e o site de matemática já
      // declaram em Person no JSON-LD deles (2026-09-18). Ligar os três pelo
      // `sameAs` da pessoa é o que junta a entidade sem confundir as empresas.
      //
      // ⚠️ O `@id` é <site>/quem-somos#person e NÃO <site>#founder (como estava
      // até 18/09/2026, algumas horas): o JSON-LD do Cuponito aponta a autoria
      // dos posts e o `founder` de lá para exatamente essa string. Com o `@id`
      // divergente, o Cuponito afirmava a ligação e este site não confirmava —
      // os dois nós viravam duas pessoas diferentes para o Google e para a IA,
      // que é o problema que o `founder` existe para resolver. O caminho mora em
      // FOUNDER_PERSON_ID_PATH; não trocar sem trocar no Cuponito junto.
      founder: {
        '@type': 'Person',
        '@id': `${siteUrl}${FOUNDER_PERSON_ID_PATH}`,
        name: EDITORIAL_PERSON_AUTHOR,
        description: EDITORIAL_PERSON_AUTHOR_DESCRIPTION,
        url: `${siteUrl}/quem-somos`,
        worksFor: { '@id': `${siteUrl}#organization` },
        sameAs: FOUNDER_SAME_AS,
      },
    },
    {
      // O site como entidade própria, amarrado à organização. Sem isto cada
      // página declarava um `isPartOf: WebSite` solto (uma delas com o codinome
      // interno 'WABOT') — RCA 2026-09-18.
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      name: BRAND_ORG_NAME,
      alternateName: [BRAND_LEGACY_NAME],
      url: siteUrl,
      inLanguage: 'pt-BR',
      publisher: { '@id': `${siteUrl}#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}#software`,
      name: BRAND_PRODUCT_NAME,
      alternateName: [BRAND_LEGACY_NAME],
      inLanguage: 'pt-BR',
      // Lista de recursos em texto simples: é o que Gemini/Perplexity extraem
      // ao responder "o que o Espelha Grupos faz" (fonte: SUPPORTED_STORES).
      featureList: [
        'Espelhamento de ofertas de grupos e canais do WhatsApp para os grupos da afiliada',
        `Conversão de links de afiliado em ${SUPPORTED_STORES.length} lojas: ${SUPPORTED_STORES.join(', ')}`,
        'Ofertas automáticas da Shopee por palavra-chave e filtros',
        'Filas de envio com intervalo e limites por hora e por dia',
        'Controle do ritmo dos envios por grupo (Módulo de Preservação Avançada)',
        'Marca d\u2019água na foto da oferta e card de oferta clicável',
        'Painel de vendas e comissão da Shopee',
      ],
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
