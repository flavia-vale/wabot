// Ver o produto funcionar ANTES de entregar o WhatsApp.
//
// Item A2 do plano de ativação de 2026-09-08. O maior balde do funil são as 46
// pessoas que criaram a conta e nunca pediram a conexão — e a razão é a ordem
// do que pedimos: a primeira coisa que o produto exige é "entregue seu WhatsApp
// a um robô", antes de ela ter visto uma única prova de que a coisa funciona.
// Nenhum produto sobrevive a pedir o máximo antes de entregar o mínimo.
//
// O caminho curto já existia e ninguém apontava para ele: o conversor de links
// (`/painel/converte-links`) funciona sem sessão de WhatsApp nenhuma — ela cola
// um link, recebe o link de volta com a identificação dela, e entende o produto
// em menos de um minuto sem entregar nada.
//
// ⚠️ Honestidade que muda a ordem dos passos: converter exige UMA loja
// cadastrada (sem etiqueta não há para quem creditar a comissão). Por isso o
// atalho tem dois passos, não um — e o primeiro é a loja mais rápida, não a
// mais completa.

export const VALUE_FIRST_HEADLINE = 'Quer ver funcionando antes de conectar o WhatsApp?'

// Texto curto de propósito (2026-09-19): quem ainda não conectou está decidindo
// se confia no produto, e parágrafo longo nessa hora é lido na diagonal ou
// pulado. A promessa inteira cabe em duas frases; o detalhe de cada passo mora
// no passo, não aqui.
export const VALUE_FIRST_BODY =
  'Cadastre uma loja e cole um link de produto: ele volta com a sua identificação de afiliada. '
  + 'É o que o robô faz sozinho, a cada oferta.'

export const VALUE_FIRST_STEPS = Object.freeze([
  {
    chave: 'loja',
    titulo: 'Cadastre uma loja',
    texto: 'Tem loja que pede só a sua etiqueta de afiliada.',
    href: '/painel/ids-afiliada',
    cta: 'Cadastrar loja',
  },
  {
    chave: 'converter',
    titulo: 'Teste um link',
    // "Nada é publicado" não é enfeite: é o medo que trava quem ainda não
    // conectou. Some do texto e o atalho perde a razão de existir.
    texto: 'Volta convertido na hora. Nada é publicado.',
    href: '/painel/converte-links',
    // A tela se chama "Testar conversão" desde 2026-09-19 — o convite precisa
    // levar o nome que ela vai ver na sidebar.
    cta: 'Testar um link',
  },
])
