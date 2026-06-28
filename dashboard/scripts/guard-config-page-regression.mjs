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

assert(source.includes('Preferências gerais'), 'O card de preferências gerais deve continuar disponível.')
assert(!source.includes('Cadência entre envios'), 'O card de cadência global não deve voltar para configurações.')
assert(!source.includes('Espelhamento com template (padrão global)'), 'O card de template global não deve voltar para configurações.')
assert(!source.includes('Marca nas mensagens'), 'O card de marca não deve aparecer em configurações.')
assert(!source.includes('Filtros e boas-vindas'), 'O card de filtros e boas-vindas não deve aparecer em configurações.')

console.log('Guardrail OK: configurações não expõe cadência global nem template global.')
