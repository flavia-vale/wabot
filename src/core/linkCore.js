/**
 * [PROTECTED_CORE]: Não modifique a lógica interna. Se precisar de novos comportamentos, use Decorators ou Extensões na camada externa.
 */
import { detectLinks } from '../detector.js'
import { convertLink } from '../converters/index.js'

export const extractLinks = (text) => detectLinks(text)
export const processLink = (url, credentials) => convertLink(url, credentials)
