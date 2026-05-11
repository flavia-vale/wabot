import '../app/landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'

export const LP_CONFIG = {
  'espelhar-grupos-whatsapp-sao-paulo': { title: 'Espelhar grupos WhatsApp em São Paulo | wabot', description: 'Automatize sua rotina de ofertas em grupos de São Paulo com o wabot e reduza trabalho manual.' },
  'espelhar-grupos-whatsapp-rio-de-janeiro': { title: 'Espelhar grupos WhatsApp no Rio de Janeiro | wabot', description: 'Ganhe escala de publicação em grupos do Rio de Janeiro com operação previsível usando o wabot.' },
  'espelhar-grupos-whatsapp-belo-horizonte': { title: 'Espelhar grupos WhatsApp em Belo Horizonte | wabot', description: 'Padronize e acelere campanhas em grupos de Belo Horizonte com espelhamento automatizado.' },
  'espelhar-grupos-whatsapp-curitiba': { title: 'Espelhar grupos WhatsApp em Curitiba | wabot', description: 'Reduza esforço operacional e aumente consistência de postagens em grupos de Curitiba.' },
  'espelhar-grupos-whatsapp-porto-alegre': { title: 'Espelhar grupos WhatsApp em Porto Alegre | wabot', description: 'Automatize a distribuição de ofertas em Porto Alegre e mantenha uma rotina estável de divulgação.' },
  'bot-ofertas-supermercado-whatsapp': { title: 'Bot de ofertas para supermercado no WhatsApp | wabot', description: 'Organize e acelere campanhas de supermercado em grupos com automação inteligente.' },
  'bot-ofertas-farmacia-whatsapp': { title: 'Bot de ofertas para farmácia no WhatsApp | wabot', description: 'Padronize publicação de ofertas de farmácia no WhatsApp com o wabot.' },
  'bot-ofertas-eletronicos-whatsapp': { title: 'Bot de ofertas para eletrônicos no WhatsApp | wabot', description: 'Mantenha constância e velocidade na divulgação de eletrônicos com automação para grupos.' },
  'bot-ofertas-moda-whatsapp': { title: 'Bot de ofertas para moda no WhatsApp | wabot', description: 'Aumente previsibilidade das campanhas de moda com uma rotina automatizada.' },
  'bot-ofertas-beleza-whatsapp': { title: 'Bot de ofertas para beleza no WhatsApp | wabot', description: 'Acelere campanhas de beleza no WhatsApp com processos de distribuição em escala.' },
}

export function getLpMetadata(slug) {
  const cfg = LP_CONFIG[slug]
  if (!cfg) return {}
  return { title: cfg.title, description: cfg.description, alternates: { canonical: `/${slug}` } }
}

export function LpTemplate({ slug }) {
  const cfg = LP_CONFIG[slug]
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Como começar com o wabot?', acceptedAnswer: { '@type': 'Answer', text: 'Cadastre-se na Lista VIP e siga o onboarding guiado para ativar seu primeiro espelhamento.' } }] }
  const howToJsonLd = { '@context': 'https://schema.org', '@type': 'HowTo', name: 'Como espelhar grupos com o wabot', step: [{ '@type': 'HowToStep', name: 'Criar conta', text: 'Cadastre-se e acesse o painel do wabot.' }, { '@type': 'HowToStep', name: 'Conectar grupos', text: 'Conecte seus grupos e valide permissões.' }, { '@type': 'HowToStep', name: 'Ativar espelhamento', text: 'Configure as regras e publique automaticamente.' }] }
  const productJsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: 'wabot', description: cfg.description, brand: { '@type': 'Brand', name: 'wabot' } }

  return (
    <div className="landing-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <Hero tone="amigavel" primaryCtaLabel="Entrar na Lista VIP" />
      <How />
      <Features />
      <Social />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
