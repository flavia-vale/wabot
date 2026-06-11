import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve(process.cwd(), 'app/painel/configuracoes/page.js')
const source = fs.readFileSync(filePath, 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`ERRO: ${message}`)
    process.exit(1)
  }
}

assert(source.includes('Cadência entre envios'), 'O card de cadência deve continuar disponível.')
assert(!source.includes('Marca nas mensagens'), 'O card de marca não deve aparecer em configurações.')
assert(!source.includes('Filtros e boas-vindas'), 'O card de filtros e boas-vindas não deve aparecer em configurações.')

console.log('Guardrail OK: configurações exibe apenas o card de cadência.')
