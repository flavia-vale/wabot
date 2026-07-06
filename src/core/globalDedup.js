// Dedup cross-processo via Redis, usada pelo bot-worker (envio espelhado e
// automático) pra evitar duplicar a mesma oferta entre workers/reconexões.
// Extraído pra cá pra poder ser testado com um client Redis de verdade
// (ioredis-mock) — bot-worker.js é grande demais pra importar em teste sem
// efeitos colaterais (fork de socket, process.exit em BOT_USER_ID ausente
// etc.), então a lógica dessa função nunca tinha sido testada de ponta a
// ponta, só por regex no código-fonte. Dois incidentes reais de cupom preso
// em dedup (RCA: TTL nativo da chave desalinhado da janela lógica) vieram
// dessa lacuna.
//
// Contrato: `windowMs` é a janela LÓGICA de dedup (pode mudar por chamada —
// ex.: 5min pra cupom, 24h pra produto). O TTL NATIVO da chave no Redis
// (safetyCapMs) é fixo e sempre o maior possível — só existe pra limitar
// memória, nunca representa a janela de verdade. A decisão de "é duplicata?"
// é sempre feita comparando o TIMESTAMP guardado contra windowMs em tempo de
// LEITURA, nunca contra o TTL nativo da chave — assim, se o código mudar a
// janela de um linkKind de uma chamada pra outra, o efeito é IMEDIATO (não
// espera a chave antiga expirar sozinha).
export async function checkAndSetGlobalDedup(redisClient, key, windowMs, { safetyCapMs = 24 * 60 * 60_000 } = {}) {
  const now = Date.now()
  // Caminho comum (chave nova): SET NX é atômico, sem round-trip extra.
  const ok = await redisClient.set(key, String(now), 'PX', safetyCapMs, 'NX')
  if (ok === 'OK') return { duplicate: false }

  // Chave já existe. Lê o timestamp guardado e compara contra a janela ATUAL
  // do chamador — não contra o TTL nativo da chave (que pode ter sido
  // gravado sob uma janela antiga/maior). Passou da janela → não é
  // duplicata de verdade: sobrescreve com o timestamp novo e libera.
  const existing = await redisClient.get(key)
  const existingTs = Number(existing) || 0
  if (existingTs && now - existingTs < windowMs) return { duplicate: true, ageMs: now - existingTs }
  await redisClient.set(key, String(now), 'PX', safetyCapMs)
  return { duplicate: false }
}
