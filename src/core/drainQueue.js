// Contador de jobs em vôo. Usado no shutdown para drenar trabalho ativo
// antes de marcar pendências como interrompidas. `track(work)` incrementa
// na entrada e decrementa em finally{}, então a contagem permanece correta
// mesmo quando work rejeita ou lança.
export function makeInFlightTracker() {
  let count = 0
  const tracker = {
    isDrained: () => count === 0,
    inFlightCount: () => count,
    async track(work) {
      count++
      try {
        return await work()
      } finally {
        count--
      }
    },
  }
  // bind explícito para que isDrained possa ser passado como callback sem perder `this`.
  tracker.isDrained = tracker.isDrained.bind(tracker)
  tracker.inFlightCount = tracker.inFlightCount.bind(tracker)
  return tracker
}

// Espera até isDrained() retornar true ou até esgotar timeoutMs.
// Usado no shutdown do worker para drenar jobs em vôo antes de marcar
// como interrompidos. Mantém o processo gentilmente vivo enquanto há
// trabalho pendente, sem rodar para sempre.
export async function waitUntilDrained({ isDrained, timeoutMs, pollIntervalMs = 50 }) {
  const start = Date.now()
  // Garante ao menos uma checagem mesmo com timeoutMs=0.
  if (isDrained()) {
    return { drained: true, elapsedMs: Date.now() - start, timedOut: false }
  }
  while (Date.now() - start < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    if (isDrained()) {
      return { drained: true, elapsedMs: Date.now() - start, timedOut: false }
    }
  }
  return { drained: false, elapsedMs: Date.now() - start, timedOut: true }
}
