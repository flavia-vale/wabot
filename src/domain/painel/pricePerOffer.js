// O preço medido no uso REAL dela.
//
// Item D5 do plano de ativação de 2026-09-08. "R$ 69 por mês" é um número
// solto: a cliente não tem com o que comparar, e comparar com o concorrente é
// comparar duas coisas que ela ainda não usou. "R$ 1,47 por oferta publicada" é
// o mesmo preço na conta que ela consegue fazer sozinha — e o número de ofertas
// é dela, não nosso.
//
// Só aparece para quem JÁ tem ofertas publicadas: sem uso, essa conta viraria
// uma promessa de volume que a gente não fez.
//
// Módulo PURO.

/**
 * @param {{ priceCents?: number, offersPublished?: number }} args
 * @returns {null | { porOferta: string, ofertas: number, texto: string }}
 */
export function buildPricePerOffer({ priceCents, offersPublished } = {}) {
  const centavos = Number(priceCents)
  const ofertas = Math.trunc(Number(offersPublished) || 0)

  // Sem preço confiável ou sem uso, não há conta honesta a mostrar.
  if (!Number.isFinite(centavos) || centavos <= 0) return null
  if (ofertas <= 0) return null

  const porOfertaCents = centavos / ofertas
  const porOferta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(porOfertaCents / 100)
  const plural = ofertas === 1 ? 'oferta' : 'ofertas'

  return {
    ofertas,
    porOferta,
    // O texto diz de onde saiu o número. Conta que a cliente não consegue
    // refazer no papel vira desconfiança, não argumento.
    texto: `No seu ritmo — ${ofertas} ${plural} publicadas — isso dá ${porOferta} por oferta.`,
  }
}

/**
 * Lê o preço que a tela mostra ("R$69", "R$ 69,00") em centavos.
 *
 * A tela de plano só tem o preço formatado — não existe valor em centavos ali.
 * Em vez de duplicar a tabela de preços num segundo lugar (que envelheceria
 * errada no dia em que o preço mudasse), lemos o mesmo número que a cliente
 * está vendo. Não deu para ler → devolve `null`, e a conta simplesmente não
 * aparece: melhor não mostrar do que mostrar errado.
 */
export function parsePriceToCents(text) {
  const bruto = String(text ?? '').replace(/[^0-9.,]/g, '').trim()
  if (!bruto) return null
  // pt-BR: ponto é milhar, vírgula é decimal.
  const normalizado = bruto.replace(/\./g, '').replace(',', '.')
  const valor = Number(normalizado)
  if (!Number.isFinite(valor) || valor <= 0) return null
  return Math.round(valor * 100)
}
