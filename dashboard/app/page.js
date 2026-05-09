import Link from 'next/link'
import './landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'

export const metadata = {
  title: 'Espelha Grupos no WhatsApp com BOTinho',
  description: 'Espelhe grupos no WhatsApp, converta links de afiliado e organize ofertas com o BOTinho.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Espelha Grupos no WhatsApp com BOTinho',
    description: 'Espelhe grupos, converta links e publique ofertas com BOTinho.',
    url: '/',
  },
}

export default function LandingPage() {
  return (
    <div className="landing-root">
      <Hero tone="amigavel" />
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px 24px' }}>
        <Link href="/promocao" style={{ background: '#10b981', color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 700 }}>Ver página promocional</Link>
      </div>
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
