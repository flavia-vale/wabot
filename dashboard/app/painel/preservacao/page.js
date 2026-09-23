import { redirect } from 'next/navigation'

// /painel/preservacao virou /painel/anti-banimento
// (specs/018-unificar-protecao-anti-ban): as três telas do antigo grupo
// "Preservação avançada" se juntaram numa tela única. Redirect mantido para
// links antigos (e-mail já enviado, tutorial, favoritos da cliente).
export default function PreservacaoIndex() {
  redirect('/painel/anti-banimento')
}
