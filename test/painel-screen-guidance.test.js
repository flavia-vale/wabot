import test from 'node:test'
import assert from 'node:assert/strict'
import { guidanceForPath, robotDiagnostic, shouldShowRobotDiagnostic } from '../src/domain/painel/screenGuidance.js'

test('cada tela conhecida recebe orientação específica e próximo passo', () => {
  const guide = guidanceForPath('/painel/envios')
  assert.match(guide.description, /Acompanhe/)
  assert.match(guide.nextStep, /^Próximo passo:/)
})

test('diagnóstico não declara falha enquanto os dados ainda estão carregando', () => {
  assert.equal(robotDiagnostic({ online: null }).state, 'checking')
  assert.equal(robotDiagnostic({ online: true, hasAnyCredential: null }).state, 'checking')
  assert.equal(robotDiagnostic({ online: true, hasAnyCredential: true, destinationCount: null }).state, 'checking')
})

test('diagnóstico progride sem recomendar reconexão para sessão saudável', () => {
  assert.equal(robotDiagnostic({ online: false }).href, '/painel/whatsapp')
  assert.equal(robotDiagnostic({ online: true, hasAnyCredential: false }).href, '/painel/ids-afiliada')
  assert.equal(robotDiagnostic({ online: true, hasAnyCredential: true, destinationCount: 0 }).href, '/painel/espelhamento')
  assert.equal(robotDiagnostic({ online: true, hasAnyCredential: true, destinationCount: 1 }).state, 'ready')
})

test('card do robô só aparece quando existe pendência, com botão para ela', () => {
  const pronto = robotDiagnostic({ online: true, hasAnyCredential: true, destinationCount: 2 })
  assert.equal(shouldShowRobotDiagnostic(pronto), false)
  assert.equal(pronto.href, null)
  assert.equal(shouldShowRobotDiagnostic(robotDiagnostic({ online: null })), false)
  assert.equal(shouldShowRobotDiagnostic(robotDiagnostic({ online: true, hasAnyCredential: true, destinationCount: null })), false)
  const semLoja = robotDiagnostic({ online: true, hasAnyCredential: false })
  assert.equal(shouldShowRobotDiagnostic(semLoja), true)
  assert.equal(semLoja.href, '/painel/ids-afiliada')
})

test('fechar o card vale só para a pendência atual', () => {
  const semLoja = robotDiagnostic({ online: true, hasAnyCredential: false })
  assert.equal(shouldShowRobotDiagnostic(semLoja, '2'), false)
  const desconectado = robotDiagnostic({ online: false })
  assert.equal(shouldShowRobotDiagnostic(desconectado, '2'), true)
})
