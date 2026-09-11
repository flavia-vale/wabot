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
//
// Cinto e suspensório contra surrogate solto: a chave vai para a coluna
// `SendDedupKey.dedupKey`, e meio par surrogate (emoji cortado ao meio por uma
// truncagem a montante) faz o motor do Prisma recusar a gravação inteira com
// `unexpected end of hex escape` — a reserva atômica cross-worker deixa de ser
// gravada e a proteção contra envio duplicado cai para as camadas locais. Como
// aqui é a fonte ÚNICA da construção da chave, a limpeza mora aqui e vale para
// qualquer chamador, presente ou futuro.
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

function stripLoneSurrogates(value) {
  return String(value).replace(LONE_SURROGATE_RE, '')
}

export function buildMirrorDedupKeys({ destJid, primaryUrl, primaryConverted, fallbackSubject } = {}) {
  const dedupSubjects = [...new Set([primaryUrl, primaryConverted, fallbackSubject].filter(Boolean))]
    .map(stripLoneSurrogates)
    .filter(Boolean)
  const dedupKeys = dedupSubjects.map(subject => `${stripLoneSurrogates(destJid)}:${subject}`)
  return { dedupSubjects, dedupKeys }
}
