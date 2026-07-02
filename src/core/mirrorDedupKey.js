// Fonte ÚNICA da construção das chaves de deduplicação por destino de um envio
// espelhado. Essa lógica vivia inline em bot-worker.js e foi reimplementada de
// formas divergentes em sessões paralelas (uma com chave única `dedupSubject`,
// outra com múltiplas `dedupKeys`). O merge das duas colidiu e deixou
// `dedupKeys` indefinido -> `ReferenceError` em TODO envio espelhado, sem que
// syntax-check/lint do backend pegasse. Centralizar aqui elimina a divergência
// (todo mundo chama a mesma função) e dá cobertura de teste.
//
// Guardamos DUAS chaves + fallback:
// - primaryUrl: link upstream estável. Bloqueia a mesma mensagem da fonte
//   repostada logo depois, mesmo que o conversor gere outro shortlink.
// - primaryConverted: link final do afiliado. Bloqueia fontes diferentes que
//   caiam no mesmo link convertido.
// - fallbackSubject: msgId:texto, para mensagens sem link.
export function buildMirrorDedupKeys({ destJid, primaryUrl, primaryConverted, fallbackSubject } = {}) {
  const dedupSubjects = [...new Set([primaryUrl, primaryConverted, fallbackSubject].filter(Boolean))]
  const dedupKeys = dedupSubjects.map(subject => `${destJid}:${subject}`)
  return { dedupSubjects, dedupKeys }
}
