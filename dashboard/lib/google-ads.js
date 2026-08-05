// Rastreamento de conversão do Google Ads.
//
// DESLIGADO POR PADRÃO: sem `NEXT_PUBLIC_GADS_ID` nada é carregado e nada é
// disparado — mesmo padrão do SMTP e do canal do YouTube neste repo. Assim o
// site continua idêntico enquanto não houver campanha, e ligar não exige
// redeploy de código, só a env.
//
// Por que existe: sem marcação de conversão o Google otimiza pelo clique mais
// barato, não pelo cliente — é o primeiro erro da lista de "common mistakes" do
// playbook de Google Search. Ver docs/marketing/PLANO_GOOGLE_ADS_2026-08-04.md.

export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GADS_ID || ''

// Ação de conversão "Cadastro". Sem ela o script até carrega, mas nenhuma
// conversão é reportada.
const RAW_SIGNUP_LABEL = process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL || ''

/**
 * O Google exige o formato `AW-1234567890/AbC-D_efG` no `send_to`. O painel
 * mostra isso dentro do snippet, e é fácil copiar só o pedaço depois da barra.
 *
 * Se vier só o rótulo, montamos o valor completo com o ID em vez de falhar: o
 * modo de falha aqui é SILENCIOSO — o Google descarta o disparo sem erro, a
 * campanha fica sem conversão e ninguém descobre até estranhar o relatório.
 */
export function resolveConversionSendTo(label = RAW_SIGNUP_LABEL, id = GOOGLE_ADS_ID) {
  const raw = String(label ?? '').trim()
  if (!raw) return ''
  if (raw.includes('/')) return raw
  if (!id) return ''
  return `${id}/${raw}`
}

export const GOOGLE_ADS_SIGNUP_LABEL = resolveConversionSendTo()

export function isGoogleAdsEnabled() {
  return /^AW-[A-Za-z0-9]+$/.test(GOOGLE_ADS_ID)
}

export function gtagScriptSrc(id = GOOGLE_ADS_ID) {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
}

// O `gclid` é o identificador que o Google cola na URL de destino do anúncio.
// Guardá-lo é o que permite, mais tarde, importar a conversão OFFLINE de
// PAGAMENTO — o playbook chama isso de a mudança de maior impacto numa conta,
// porque o trial de 7 dias faz o pagamento acontecer fora da janela que o
// Google enxerga sozinho.
//
// Sanitização própria (não reusa `sanitizeAttributionValue`): aquela troca `_`
// por `-`, e `_` é caractere válido dentro de um gclid — usá-la corromperia o
// valor em silêncio.
const GCLID_RE = /^[A-Za-z0-9_-]{1,200}$/

export function sanitizeGclid(value) {
  const raw = String(value ?? '').trim()
  return GCLID_RE.test(raw) ? raw : ''
}

/**
 * Extrai o identificador de clique de uma query string.
 * Aceita `gclid` (Google Ads) e `gbraid`/`wbraid` (equivalentes para iOS, em
 * que o Google não consegue entregar o gclid clássico).
 */
export function extractClickId(search) {
  try {
    const params = new URLSearchParams(String(search ?? '').replace(/^\?/, ''))
    for (const key of ['gclid', 'gbraid', 'wbraid']) {
      const value = sanitizeGclid(params.get(key))
      if (value) return { key, value }
    }
    return null
  } catch {
    return null
  }
}
