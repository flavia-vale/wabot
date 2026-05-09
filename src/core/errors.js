/**
 * [PROTECTED_CORE]: Não modifique a lógica interna. Se precisar de novos comportamentos, use Decorators ou Extensões na camada externa.
 */
export function withCoreErrorBoundary(context, fn, log = console) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      log.error?.({ context, err: err?.message ?? String(err) }, 'Core error capturado')
      throw err
    }
  }
}

export function safeCoreEvent(context, fn, log = console) {
  try {
    return fn()
  } catch (err) {
    log.error?.({ context, err: err?.message ?? String(err) }, 'Falha em evento do core')
    return null
  }
}
