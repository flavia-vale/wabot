import './landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import { FinalCTA, Footer } from '@/components/landing/Footer'

export const metadata = {
  title: 'Bot para Afiliados no WhatsApp',
  description: 'Converta links de Shopee, Amazon, Mercado Livre e Magalu e organize ofertas em grupos do WhatsApp com menos trabalho manual.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Bot para Afiliados no WhatsApp',
    description: 'Automatize a conversão de links e o envio de ofertas para grupos do WhatsApp.',
    url: '/',
  },
}

export default function LandingPage() {
  return (
    <div className="landing-root">
      <Hero tone="amigavel" />
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
