// Vídeo-aula de cadastro das etiquetas de afiliada (Shopee, Mercado Livre,
// Amazon e Magalu) — FONTE ÚNICA para e-mail E painel.
//
// Módulo leaf de propósito (sem import nenhum): o dashboard consome estas
// constantes direto, e antes disso o endereço do vídeo estava colado na mão em
// `dashboard/app/painel/tutorial/page.js` e em
// `dashboard/app/painel/checklist/page.js`, separado da constante usada pelos
// e-mails (`src/email/layout.js`). Três cópias do mesmo link é como um vídeo
// regravado passa a existir só em parte do produto.
//
// `src/email/layout.js` re-exporta tudo daqui para não quebrar quem já
// importava de lá.

export const VIDEO_CADASTRO_ETIQUETAS_URL =
  process.env.VIDEO_CREDENCIAIS_URL || 'https://youtu.be/6F2AUM88FKk'

// Vídeo-aula de ativação: conectar o WhatsApp e escolher os grupos. É o outro
// vídeo do canal, linkado no checklist do painel — e agora também na tela de
// conexão, que é onde metade das pessoas para (medição do funil, 2026-09).
export const VIDEO_ATIVACAO_ROBO_URL =
  process.env.VIDEO_ATIVACAO_URL || 'https://youtu.be/IKsjAYolwLM'

// Capítulos do vídeo, em SEGUNDOS. Mandar a pessoa para "o vídeo" e deixá-la
// procurar o trecho da loja dela é onde ela desiste — cada loja tem endereço
// próprio aqui.
//
// Tabela única de propósito: o minuto e a URL saem do mesmo lugar, então não
// existe o caso de alguém corrigir um e esquecer o outro. Se o vídeo for
// regravado, mexe-se AQUI e todos os links se ajustam sozinhos.
//
// Os rótulos ficam em linguagem de gente por obrigação (`JARGAO_PROIBIDO` em
// `test/email-engine.test.js`): o capítulo 3:15 é a instalação de uma extensão
// cujo nome contém uma palavra que não pode chegar à tela da cliente — quem
// nomeia a ferramenta é o vídeo, não o e-mail.
export const VIDEO_ETIQUETAS_CAPITULOS = Object.freeze([
  { chave: 'shopee_pedir', segundos: 15, rotulo: 'Pedir seu acesso de afiliada na Shopee' },
  { chave: 'shopee', segundos: 103, rotulo: 'Copiar a chave da Shopee' },
  { chave: 'extensao', segundos: 195, rotulo: 'Instalar o programinha que o vídeo indica' },
  { chave: 'amazon', segundos: 250, rotulo: 'Pegar o código de acesso da Amazon' },
  { chave: 'mercadolivre', segundos: 371, rotulo: 'Pegar o código de acesso do Mercado Livre' },
  { chave: 'vitrine_ml', segundos: 500, rotulo: 'Cadastrar o link da sua vitrine do Mercado Livre' },
  { chave: 'magalu', segundos: 562, rotulo: 'Pegar a etiqueta de afiliada da Magalu' },
])

/**
 * Link do vídeo já posicionado no segundo indicado. Usa `URL` de propósito:
 * assim funciona tanto no formato curto (`youtu.be/ID?t=15`) quanto no longo
 * (`watch?v=ID&t=15`), e o override por env não quebra o separador.
 */
export function videoEtiquetasEm(segundos, base = VIDEO_CADASTRO_ETIQUETAS_URL) {
  try {
    const url = new URL(base)
    url.searchParams.set('t', String(Math.max(0, Math.floor(Number(segundos) || 0))))
    return url.toString()
  } catch {
    return base
  }
}

/** `{ video_shopee: 'https://...?t=103', ... }` — pronto para as variáveis. */
export function videoEtiquetasVars() {
  return Object.fromEntries(
    VIDEO_ETIQUETAS_CAPITULOS.map((c) => [`video_${c.chave}`, videoEtiquetasEm(c.segundos)])
  )
}

// Plataforma (como gravada em `Credential.platform`) -> capítulo do vídeo.
// Loja sem capítulo próprio cai no começo do vídeo — nunca em `undefined`.
const CAPITULO_POR_PLATAFORMA = {
  shopee: 'shopee',
  mercadolivre: 'mercadolivre',
  amazon: 'amazon',
  magazineluiza: 'magalu',
}

/** Endereço do vídeo no trecho da loja pedida (ou no início, se não houver). */
export function videoEtiquetasParaLoja(platform) {
  const chave = CAPITULO_POR_PLATAFORMA[platform]
  const capitulo = VIDEO_ETIQUETAS_CAPITULOS.find((c) => c.chave === chave)
  return capitulo ? videoEtiquetasEm(capitulo.segundos) : VIDEO_CADASTRO_ETIQUETAS_URL
}
