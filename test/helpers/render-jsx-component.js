import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Este helper renderiza componentes do painel de verdade, e para isso usa o
// compilador do Next — que vive em `dashboard/node_modules`, instalado à parte
// da raiz. Quem roda `npm test` sem ter instalado o dashboard via bem um
// "Cannot find module .../next/dist/build/swc" que não diz nada sobre a causa.
// Mesma filosofia do `hasSqlite3()` dos testes de migration: o teste se pula
// com motivo em vez de falhar por falta de ambiente. Na CI as dependências são
// instaladas (ver .github/workflows/quality-gate.yml), então o pulo não
// acontece lá e a cobertura continua sendo exercida de verdade.
const SWC_PATH = fileURLToPath(new URL('../../dashboard/node_modules/next/dist/build/swc/index.js', import.meta.url))

export function hasDashboardDeps() {
  return existsSync(SWC_PATH)
}

export const DASHBOARD_DEPS_SKIP = 'requer as dependências do painel: rode `npm ci --prefix dashboard`'

const dashboardRequire = createRequire(new URL('../../dashboard/package.json', import.meta.url))

export async function renderJsxComponent(file, { modules = {}, globals = {} } = {}) {
  if (!hasDashboardDeps()) throw new Error(`renderJsxComponent: ${DASHBOARD_DEPS_SKIP}`)
  const { loadBindings, transform } = await import(SWC_PATH)
  await loadBindings()
  const source = await readFile(file, 'utf8')
  const transformed = await transform(source, {
    filename: file.pathname,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'classic' } } },
    module: { type: 'commonjs' }
  })
  const states = []
  const dependencies = []
  let cursor = 0
  const effects = []
  const React = {
    createElement(type, props, ...children) {
      const normalized = { ...(props || {}), children: children.length <= 1 ? children[0] : children }
      return typeof type === 'function' ? type(normalized) : { type, props: normalized }
    },
    useState(initial) {
      const slot = cursor++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], (next) => { states[slot] = typeof next === 'function' ? next(states[slot]) : next }]
    },
    useEffect(effect, deps) {
      const slot = cursor++
      const previous = dependencies[slot]
      dependencies[slot] = deps
      if (!previous || !deps || deps.some((value, index) => value !== previous[index])) effects.push(effect)
    },
    useCallback(fn, deps) { cursor++; return fn }
  }
  const require = (id) => id === 'react' ? React : modules[id] || dashboardRequire(id)
  const module = { exports: {} }
  vm.runInNewContext(`(function(require,module,exports){${transformed.code}\n})(require,module,module.exports)`, { require, module, React, ...globals })
  const Component = module.exports.default
  return {
    render(props = {}) { cursor = 0; effects.length = 0; return Component(props) },
    async runEffects() { for (const effect of [...effects]) await effect() },
    state: states
  }
}

export function textContent(node) {
  if (node == null || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  const children = node.props?.children
  return (Array.isArray(children) ? children : [children]).map(textContent).join(' ')
}

export function findAll(node, predicate, found = []) {
  if (Array.isArray(node)) { for (const child of node) findAll(child, predicate, found); return found }
  if (!node || typeof node !== 'object') return found
  if (predicate(node)) found.push(node)
  const children = node.props?.children
  for (const child of Array.isArray(children) ? children : [children]) findAll(child, predicate, found)
  return found
}
