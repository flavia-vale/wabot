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
      <div className="flex justify-center px-4 pb-6">
        <Link href="/promocao" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600">
          Ver página promocional
        </Link>
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
