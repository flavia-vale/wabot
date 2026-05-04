const TWEAK_DEFAULTS = JSON.parse(document.getElementById('tweak-defaults').textContent.match(/\{[\s\S]*\}/)[0]);

const App = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-palette', tweaks.palette);
    document.documentElement.setAttribute('data-density', tweaks.density);
  }, [tweaks.palette, tweaks.density]);

  return (
    <>
      <Hero tone={tweaks.tone}/>
      <How />
      <Features />
      {tweaks.showSocialProof && <Social />}
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Paleta">
          <TweakRadio
            label="Direção visual"
            value={tweaks.palette}
            onChange={v => setTweak('palette', v)}
            options={[
              { value: 'lavanda', label: 'Lavanda' },
              { value: 'pessego', label: 'Pêssego' },
              { value: 'menta', label: 'Menta' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Densidade">
          <TweakRadio
            label="Espaçamento"
            value={tweaks.density}
            onChange={v => setTweak('density', v)}
            options={[
              { value: 'compact', label: 'Compacto' },
              { value: 'cozy', label: 'Cozy' },
              { value: 'airy', label: 'Espaçoso' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Tom de copy">
          <TweakRadio
            label="Voz da marca"
            value={tweaks.tone}
            onChange={v => setTweak('tone', v)}
            options={[
              { value: 'amigavel', label: 'Amigável' },
              { value: 'direto', label: 'Direto' },
              { value: 'animado', label: 'Animado' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Seções">
          <TweakToggle
            label="Mostrar prova social"
            value={tweaks.showSocialProof}
            onChange={v => setTweak('showSocialProof', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App/>);
