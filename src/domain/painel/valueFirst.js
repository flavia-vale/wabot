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

export const VALUE_FIRST_BODY =
  'Dá para experimentar agora, sem ligar o robô em lugar nenhum: cadastre uma loja e cole um link de produto. '
  + 'Você recebe o mesmo link de volta, já com a sua identificação de afiliada — é exatamente isso que o robô faz sozinho depois, a cada oferta.'

export const VALUE_FIRST_STEPS = Object.freeze([
  {
    chave: 'loja',
    titulo: 'Cadastre uma loja',
    texto: 'Tem loja que pede só a sua etiqueta de afiliada — leva menos de um minuto.',
    href: '/painel/ids-afiliada',
    cta: 'Cadastrar uma loja',
  },
  {
    chave: 'converter',
    titulo: 'Cole um link de produto',
    texto: 'O conversor devolve o link já convertido, na hora. Nada é publicado em grupo nenhum.',
    href: '/painel/converte-links',
    cta: 'Abrir o conversor',
  },
])
