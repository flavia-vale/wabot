/**
 * Como os links de UMA mensagem são convertidos (RCA 2026-09-17).
 *
 * O espelhamento convertia todos os links da mensagem com `Promise.all` puro.
 * O comentário original justificava: "conversores fazem 4-5 chamadas HTTP
 * sequenciais cada; processar N links em série estoura o teto da fila". Está
 * certo entre LOJAS DIFERENTES — e errado dentro da MESMA loja, porque ali os
 * conversores não são independentes: eles dividem UMA sessão de afiliado.
 *
 * O que foi medido, loja por loja:
 *
 *  - **Mercado Livre** — o `createLink` roda dentro de
 *    `withMercadoLivreCredentialLock` (trava por credencial, timeout de 12s),
 *    justamente porque a sessão não aceita chamada concorrente. Com 4 links de
 *    ML disparados juntos e ~4s por chamada, um já estoura a trava
 *    (`ML_AFFILIATE_LOCK_TIMEOUT`) e o conjunto ainda come 12s dos 25s de
 *    preparo da mensagem (`MSG_QUEUE_TIMEOUT_MS`). Ou seja: o paralelismo não
 *    acelerava nada — a trava já serializava — e ainda transformava espera em
 *    falha.
 *  - **Amazon** — cada `getShortUrl` ROTACIONA o cookie do SiteStripe
 *    (`buildAmazonCredentialPatchFromSetCookie` + `persistRotatedAmazonCookies`)
 *    e não tem trava nenhuma. Em paralelo, todas as chamadas saem com o cookie
 *    VELHO e disputam a persistência do novo: a última escrita vence e as
 *    demais rotações se perdem. O sintoma é a parede "Acessar Amazon" no meio
 *    de uma sessão viva, e a oferta sai com o link longo `?tag=` em vez do
 *    `amzn.to`.
 *  - **SHEIN / AliExpress** — mesma família: sessão única (token por etiqueta,
 *    cookie do portal de afiliado) sem serialização.
 *
 * A regra: **links da MESMA loja convertem um de cada vez; lojas diferentes
 * seguem em paralelo.** A mensagem típica tem poucos links por loja, então o
 * tempo de parede muda pouco; o que sai é a disputa pela sessão.
 *
 * Não regredir: não voltar a `Promise.all(links.map(...))` sobre a lista
 * inteira. E não serializar TUDO numa fila só — aí sim uma loja lenta
 * atrasaria as outras, que é o problema que o paralelismo original resolvia.
 */

/**
 * Roda `run` para cada item preservando a ORDEM do array de saída.
 *
 * Itens com a mesma `platform` rodam em série, na ordem em que aparecem;
 * plataformas diferentes rodam em paralelo. `run` nunca deve lançar — quem
 * chama trata o próprio erro e devolve um resultado (é assim que o worker já
 * funciona); se lançar, o erro sobe como em `Promise.all`.
 */
export async function convertPerPlatformSerially(items, run) {
  const list = Array.isArray(items) ? items : []
  const results = new Array(list.length)

  const indexesByPlatform = new Map()
  list.forEach((item, index) => {
    const key = String(item?.platform ?? '')
    const bucket = indexesByPlatform.get(key)
    if (bucket) bucket.push(index)
    else indexesByPlatform.set(key, [index])
  })

  await Promise.all([...indexesByPlatform.values()].map(async (indexes) => {
    for (const index of indexes) {
      results[index] = await run(list[index], index)
    }
  }))

  return results
}
