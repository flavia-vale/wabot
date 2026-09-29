/* DEPOIMENTOS REAIS — fonte única do site público.
 *
 * Regra permanente (auditoria de funil 2026-08-05, §1.1 + test/landing-social-proof.test.js):
 * só entra aqui depoimento (a) colhido de cliente pagante de verdade, (b) com
 * autorização por escrito para publicar e (c) com o texto do jeito que ela disse.
 * Não escrever, resumir ou "melhorar" a frase, e não usar promessa de ganho.
 * Guarda: test/depoimentos-guarda.test.js. Sem nenhum item válido, o bloco não
 * aparece no site (nada de cartão de exemplo).
 *
 * Campos: nome (como ela pediu), papel (quem é / grupo), texto (literal),
 * nota (1-5, opcional), autorizadoEm (AAAA-MM-DD do "autorizo publicar"),
 * origem (onde está a prova: link/print/conversa guardada).
 */
export const DEPOIMENTOS = []

export const ROTULO_DEPOIMENTOS =
  'Depoimentos de clientes pagantes, que receberam 5 dias de PRO como agradecimento por contar sua experiência.'

const PROMESSAS_DE_GANHO = [
  'dobrei',
  'dobraram',
  'triplic',
  'comissão garantida',
  'nunca fui banid',
  'nunca fui bloquead',
  'sem risco de ban',
  'anti-ban',
  'antiban',
]

export function depoimentoValido(d) {
  if (!d || typeof d !== 'object') return false
  const texto = String(d.texto || '').trim()
  if (!String(d.nome || '').trim() || !String(d.papel || '').trim() || !texto) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.autorizadoEm || ''))) return false
  if (!String(d.origem || '').trim()) return false
  if (d.nota != null && !(Number.isInteger(d.nota) && d.nota >= 1 && d.nota <= 5)) return false
  const baixo = texto.toLowerCase()
  return !PROMESSAS_DE_GANHO.some((p) => baixo.includes(p))
}

export function depoimentosPublicaveis(lista = DEPOIMENTOS) {
  return lista.filter(depoimentoValido)
}
