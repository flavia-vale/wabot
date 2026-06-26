import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminPageSource = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
const apiSource = readFileSync(new URL('../dashboard/lib/api.js', import.meta.url), 'utf8')
const boundarySource = readFileSync(new URL('../dashboard/components/SectionErrorBoundary.js', import.meta.url), 'utf8')

test('api.js expõe os métodos de staging-power que o painel admin consome', () => {
  // Sem estes métodos, o painel quebra com "adminStagingStatus is not a function".
  assert.match(apiSource, /adminStagingStatus:\s*\(\)\s*=>/)
  assert.match(apiSource, /adminStagingPower:\s*\(action/)
})

test('StagingPowerCard contém throw síncrono (método ausente) sem derrubar o painel', () => {
  // O .catch só captura rejeições; uma chamada direta api.x() com x indefinida
  // lança SÍNCRONO antes do .then e escapa para o error boundary da rota.
  // Promise.resolve().then(() => api.x()) converte esse throw em rejeição.
  assert.match(adminPageSource, /Promise\.resolve\(\)\s*\.then\(\(\)\s*=>\s*api\.adminStagingStatus\(\)\)/)

  // Padrão frágil não deve voltar: chamada direta encadeando .then logo após.
  assert.equal(
    adminPageSource.includes('api.adminStagingStatus()\n      .then'),
    false,
    'StagingPowerCard não deve chamar api.adminStagingStatus() diretamente antes do .then',
  )
})

test('StagingPowerCard é isolado por um SectionErrorBoundary', () => {
  assert.match(adminPageSource, /import SectionErrorBoundary from '@\/components\/SectionErrorBoundary'/)
  assert.match(
    adminPageSource,
    /<SectionErrorBoundary[^>]*>\s*<StagingPowerCard admin=\{admin\} \/>\s*<\/SectionErrorBoundary>/,
  )
})

test('SectionErrorBoundary implementa o contrato de error boundary do React', () => {
  assert.match(boundarySource, /static getDerivedStateFromError/)
  assert.match(boundarySource, /componentDidCatch/)
  assert.match(boundarySource, /return this\.props\.children/)
})
