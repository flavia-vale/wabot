import { useEffect } from 'react';
import { Hero } from './components/Hero';
import { How } from './components/How';
import { Features } from './components/Features';
import { Social } from './components/Social';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { FinalCTA, Footer } from './components/Footer';

const DEFAULTS = {
  palette: 'menta',
  density: 'compact',
  tone: 'amigavel',
  showSocialProof: true,
};

export default function App() {
  const tweaks = DEFAULTS;

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', tweaks.palette);
    document.documentElement.setAttribute('data-density', tweaks.density);
  }, [tweaks.palette, tweaks.density]);

  return (
    <>
      <Hero tone={tweaks.tone} />
      <How />
      <Features />
      {tweaks.showSocialProof && <Social />}
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </>
  );
}
