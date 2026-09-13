// Quais grupos de destino NÃO estão em nenhuma fila.
//
// RCA 2026-09-11: uma cliente abriu chamado dizendo que "a fila não envia para
// um grupo". O grupo simplesmente não tinha sido marcado na fila — o painel
// mostrava a fila ativa, drenando e enviando, e em lugar nenhum dizia que
// aquele destino estava de fora. A única forma de descobrir era comparar na
// mão a lista de destinos de cada fila com a lista de grupos de postagem.
//
// Decisão de leitura (não regredir):
// - Lista de destinos VAZIA numa fila significa "todos os grupos de postagem"
//   (comportamento legado, ver `Group.targetJids` em prisma/schema.prisma).
//   Uma fila assim cobre todo mundo e zera o aviso.
// - Fila PAUSADA conta como cobertura. O aviso é sobre configuração ("você
//   esqueceu de marcar este grupo"), não sobre estado de envio — pausa já tem
//   indicação própria na tela, e somar as duas coisas geraria alarme duplo.
// - Sem fila nenhuma não há aviso: a tela já diz "Nenhuma fila criada".
// - Cálculo PURO, em cima de dados que a página já carregou. Sem chamada nova
//   à API, sem consulta nova ao banco, zero impacto de memória.
export function findDestinationsWithoutQueue(groups = [], queues = []) {
  const destinations = Array.isArray(groups) ? groups.filter((group) => group?.waJid) : []
  const allQueues = Array.isArray(queues) ? queues : []
  if (!destinations.length || !allQueues.length) return []

  const coversEveryone = allQueues.some((queue) => !(Array.isArray(queue?.targetJids) ? queue.targetJids : []).length)
  if (coversEveryone) return []

  const covered = new Set()
  for (const queue of allQueues) {
    for (const jid of (Array.isArray(queue?.targetJids) ? queue.targetJids : [])) covered.add(jid)
  }
  return destinations.filter((group) => !covered.has(group.waJid))
}
