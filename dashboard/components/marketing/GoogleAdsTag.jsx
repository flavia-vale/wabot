'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { GOOGLE_ADS_ID, extractClickId, gtagScriptSrc, isGoogleAdsEnabled } from '@/lib/google-ads'
import { captureFirstTouchClickId } from '@/lib/marketing-attribution'

/**
 * Monta no layout raiz. Faz duas coisas independentes:
 *
 * 1. Guarda o identificador de clique do anúncio (gclid) — SEMPRE, mesmo sem a
 *    env configurada. É barato, é o que permite dar crédito à campanha depois,
 *    e se dependesse da env perderíamos o dado das visitas anteriores à
 *    configuração da tag.
 * 2. Carrega o gtag do Google Ads — SÓ quando `NEXT_PUBLIC_GADS_ID` está
 *    configurada. Sem ela nenhum script de terceiro é baixado.
 *
 * O `window.dataLayer` é inicializado pelo próprio snippet do gtag. Isso é
 * proposital: `trackEvent` (lib/analytics.js) só empurra para o dataLayer
 * quando ele já é um array, então sem campanha nada se acumula na memória da
 * aba à toa.
 */
export function GoogleAdsTag() {
  useEffect(() => {
    try {
      const clickId = extractClickId(window.location.search)
      if (clickId) captureFirstTouchClickId(clickId.value)
    } catch {
      // Nunca deixar rastreamento derrubar a página.
    }
  }, [])

  if (!isGoogleAdsEnabled()) return null

  return (
    <>
      <Script src={gtagScriptSrc()} strategy="afterInteractive" />
      <Script id="google-ads-bootstrap" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(GOOGLE_ADS_ID)});
        `}
      </Script>
    </>
  )
}
