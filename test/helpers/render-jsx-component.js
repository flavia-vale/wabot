import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const dashboardRequire = createRequire(new URL('../../dashboard/package.json', import.meta.url))

export async function renderJsxComponent(file, { modules = {}, globals = {} } = {}) {
  const { loadBindings, transform } = await import('../dashboard/node_modules/next/dist/build/swc/index.js'.replace('../dashboard', '../../dashboard'))
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
