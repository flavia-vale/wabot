/* A tela de Grupos deixou de existir: origem e destino agora são as duas
 * colunas do Espelhamento, e a configuração de cada grupo virou o painel
 * lateral que abre ao clicar no card (2026-09-19).
 *
 * A rota continua respondendo porque o endereço /painel/grupos está em e-mails
 * já enviados, no tutorial, no checklist de ativação e em links que as clientes
 * guardaram. Redirecionar é mais barato que caçar cada um — e não quebra nada
 * para quem clicar num link antigo.
 */
import { redirect } from 'next/navigation'

export default function GruposPage() {
  redirect('/painel/espelhamento')
}
