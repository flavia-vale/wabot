// O que a cliente lê ANTES de conectar o WhatsApp — texto único, usado na tela
// de conexão e no e-mail de "cadastrou e não conectou".
//
// Por que existe: a medição do funil de 2026-09 mostrou que 55 das 113 pessoas
// que não pagaram (48,7%) NUNCA chegaram a pedir a conexão — é o maior balde
// do funil inteiro, e nenhuma delas viu o produto funcionar. A tela de conexão
// não dizia uma palavra sobre o que o robô faz com o WhatsApp dela.
//
// REGRA DE HONESTIDADE (não afrouxar): é PROIBIDO escrever que "não temos
// acesso às suas mensagens". As mensagens dos grupos chegam ao robô — é assim
// que o espelhamento funciona; o que é verdade é que só os grupos escolhidos
// são usados e o resto é descartado na hora, sem ficar guardado. Prometer o
// que não se cumpre é pior do que o medo que se quer resolver.
// Guarda: test/painel-whatsapp-seguranca.test.js.

export const WHATSAPP_SAFETY_HEADLINE = 'O robô entra como mais um aparelho do seu WhatsApp'

export const WHATSAPP_SAFETY_POINTS = Object.freeze([
  {
    chave: 'grupos_escolhidos',
    titulo: 'Só nos grupos que você escolher',
    texto: 'O robô trabalha apenas nos grupos que você marcar no painel. O que chega de qualquer outro lugar é descartado na hora e não fica guardado.',
  },
  {
    chave: 'nao_fala_por_voce',
    titulo: 'Ele não fala com ninguém por você',
    texto: 'O robô não responde mensagem, não conversa com os seus contatos e não manda nada para quem você não escolheu.',
  },
  {
    chave: 'desconecta_quando_quiser',
    titulo: 'Você desconecta quando quiser',
    texto: 'É a mesma conexão do WhatsApp Web: um toque no painel, ou no seu celular, e o robô sai na hora.',
  },
  {
    chave: 'outro_numero',
    titulo: 'Pode usar outro número',
    texto: 'Se preferir não usar o seu número pessoal, conecte um chip separado só para o robô. Funciona igual.',
  },
])

/** As mesmas quatro garantias em lista, para o corpo do e-mail. */
export function whatsappSafetyEmailBlock() {
  return WHATSAPP_SAFETY_POINTS.map((p) => `- **${p.titulo}:** ${p.texto}`).join('\n')
}
