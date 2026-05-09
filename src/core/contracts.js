/**
 * [PROTECTED_CORE]: Não modifique a lógica interna. Se precisar de novos comportamentos, use Decorators ou Extensões na camada externa.
 */
export class SessionManagerContract {
  startBot(_userId) { throw new Error('Not implemented') }
  stopBot(_userId) { throw new Error('Not implemented') }
  onQR(_userId, _listener) { throw new Error('Not implemented') }
  onStatus(_userId, _listener) { throw new Error('Not implemented') }
}

export class LinkProcessorContract {
  detectLinks(_text) { throw new Error('Not implemented') }
  convertLink(_url, _credentials) { throw new Error('Not implemented') }
}
