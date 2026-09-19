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

// Globais de NAVEGADOR, para as telas do dashboard (Next). Mesma filosofia:
// sobra-declarar é inofensivo; faltar vira falso-positivo.
const browserGlobals = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  history: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
  alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  matchMedia: 'readonly', getComputedStyle: 'readonly', scrollTo: 'readonly',
  Image: 'readonly', FileReader: 'readonly', WebSocket: 'readonly', EventSource: 'readonly',
  CustomEvent: 'readonly', MutationObserver: 'readonly', IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly', HTMLElement: 'readonly', Element: 'readonly', Node: 'readonly',
  CSS: 'readonly', DOMParser: 'readonly', XMLHttpRequest: 'readonly', Notification: 'readonly',
  clipboardData: 'readonly', getSelection: 'readonly', open: 'readonly', close: 'readonly',
  self: 'readonly', top: 'readonly', parent: 'readonly', frames: 'readonly', screen: 'readonly',
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
      'dashboard/node_modules/**',
      'dashboard/.next/**',
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
  // As TELAS entram na mesma rede (RCA 2026-09-13). A página de Filas foi para
  // produção chamando `findDestinationsWithoutQueue` sem importar: o merge de
  // duas PRs paralelas pegou o USO de um lado e o bloco de imports do outro,
  // sem conflito textual — pegadinha #10 de novo. O lint do Next não roda
  // `no-undef`, e o gate do dashboard só roda em pull_request, então nada
  // pegou. A tela abria em branco com "is not defined" no console.
  //
  // Rodar com `--no-inline-config`: os arquivos têm `eslint-disable` de regras
  // de plugin (react-hooks, @next/next) que não existem nesta config pura e
  // virariam erro de "rule not found".
  {
    files: ['dashboard/app/**/*.{js,jsx,mjs}', 'dashboard/components/**/*.{js,jsx,mjs}', 'dashboard/lib/**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...esGlobals, ...nodeGlobals, ...browserGlobals },
    },
    rules: {
      'no-undef': 'error',
    },
  },
]
