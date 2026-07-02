// Guard de LINT do backend (src/ + test/). Objetivo único e cirúrgico: pegar
// `no-undef` (variável usada e não declarada) ANTES do merge/deploy. Foi
// exatamente essa classe de bug — `dedupKeys is not defined` num merge mal
// resolvido — que quebrou o envio espelhado sem syntax-check pegar. A CI do
// repo só lintava o dashboard (Next) e não rodava lint no backend.
//
// Config "flat" (ESLint 9) SEM imports de propósito: assim a CI roda com
// `npx eslint` puro, sem instalar deps do repo (nada de prisma postinstall) e
// sem tocar package.json/lock. Só a regra no-undef é ligada — não é um linter
// de estilo, é uma rede de segurança contra bug real.
//
// Globais declarados de forma EXAUSTIVA (ES + Node/Web). Sobra-declarar é
// inofensivo para no-undef; faltar um global viraria falso-positivo.

const esGlobals = {
  globalThis: 'readonly', undefined: 'readonly', NaN: 'readonly', Infinity: 'readonly',
  Object: 'readonly', Array: 'readonly', Function: 'readonly', Boolean: 'readonly',
  Number: 'readonly', String: 'readonly', Symbol: 'readonly', BigInt: 'readonly',
  Math: 'readonly', Date: 'readonly', RegExp: 'readonly', JSON: 'readonly',
  Promise: 'readonly', Map: 'readonly', Set: 'readonly', WeakMap: 'readonly',
  WeakSet: 'readonly', WeakRef: 'readonly', FinalizationRegistry: 'readonly',
  Proxy: 'readonly', Reflect: 'readonly', Intl: 'readonly',
  ArrayBuffer: 'readonly', SharedArrayBuffer: 'readonly', DataView: 'readonly', Atomics: 'readonly',
  Int8Array: 'readonly', Uint8Array: 'readonly', Uint8ClampedArray: 'readonly',
  Int16Array: 'readonly', Uint16Array: 'readonly', Int32Array: 'readonly', Uint32Array: 'readonly',
  Float32Array: 'readonly', Float64Array: 'readonly', BigInt64Array: 'readonly', BigUint64Array: 'readonly',
  Error: 'readonly', EvalError: 'readonly', RangeError: 'readonly', ReferenceError: 'readonly',
  SyntaxError: 'readonly', TypeError: 'readonly', URIError: 'readonly', AggregateError: 'readonly',
  parseInt: 'readonly', parseFloat: 'readonly', isNaN: 'readonly', isFinite: 'readonly',
  decodeURI: 'readonly', encodeURI: 'readonly', decodeURIComponent: 'readonly', encodeURIComponent: 'readonly',
  eval: 'readonly', escape: 'readonly', unescape: 'readonly',
}

const nodeGlobals = {
  process: 'readonly', Buffer: 'readonly', console: 'readonly', global: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  setImmediate: 'readonly', clearImmediate: 'readonly', queueMicrotask: 'readonly',
  __dirname: 'readonly', __filename: 'readonly', module: 'writable', require: 'readonly', exports: 'writable',
  URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
  fetch: 'readonly', Headers: 'readonly', Request: 'readonly', Response: 'readonly', FormData: 'readonly',
  Blob: 'readonly', File: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly',
  Event: 'readonly', EventTarget: 'readonly', MessageChannel: 'readonly', MessagePort: 'readonly',
  structuredClone: 'readonly', crypto: 'readonly', performance: 'readonly', WebAssembly: 'readonly',
  ReadableStream: 'readonly', WritableStream: 'readonly', TransformStream: 'readonly',
  btoa: 'readonly', atob: 'readonly', DOMException: 'readonly', reportError: 'readonly',
}

export default [
  {
    ignores: [
      'node_modules/**',
      'dashboard/**',
      'prisma/migrations/**',
      'scripts/**',
      '**/*.min.js',
      '**/.next/**',
    ],
  },
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...esGlobals, ...nodeGlobals },
    },
    rules: {
      'no-undef': 'error',
    },
  },
]
