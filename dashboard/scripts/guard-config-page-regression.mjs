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

// 2026-07: "Preferências gerais" (platforms/blockedKeywords/welcomeMsg/
// postToStatus/branding) saiu da página — os campos de branding já viviam
// duplicados em mensagens/page.js, e postToStatus nunca funcionou de verdade
// (nunca passava `statusJidList` pro Baileys). A página agora só expõe
// acesso da conta (e-mail/senha). Ver docs/deploy do fluxo Mercado Pago 502.
assert(source.includes('E-mail de acesso'), 'O card de e-mail de acesso deve continuar disponível.')
assert(source.includes('Alterar senha'), 'O card de troca de senha deve continuar disponível.')
assert(!source.includes('Preferências gerais'), 'O card de preferências gerais antigo não deve voltar para configurações.')
assert(!source.includes('Cadência entre envios'), 'O card de cadência global não deve voltar para configurações.')
assert(!source.includes('Espelhamento com template (padrão global)'), 'O card de template global não deve voltar para configurações.')
assert(!source.includes('Marca nas mensagens'), 'O card de marca não deve aparecer em configurações.')
assert(!source.includes('Filtros e boas-vindas'), 'O card de filtros e boas-vindas não deve aparecer em configurações.')
assert(!source.includes('Plataformas ativas'), 'O campo de plataformas globais não deve voltar para configurações.')
assert(!source.includes('Palavras bloqueadas'), 'O campo de palavras bloqueadas globais não deve voltar para configurações.')
assert(!source.includes('Também postar nos Status'), 'O toggle postToStatus ficou oculto (nunca chegou a funcionar de verdade — falta statusJidList) e não deve reaparecer sem correção.')

console.log('Guardrail OK: configurações expõe só acesso da conta (e-mail/senha) e não reintroduz as preferências globais antigas.')
