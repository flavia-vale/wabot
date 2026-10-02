import test from 'node:test'
import assert from 'node:assert/strict'
import { decidePm2Save, missingApps, parseDumpNames, parsePm2List, resolveExpectedApps } from '../src/ops/pm2Guard.js'
import { parseNeedrestartMode } from '../src/ops/vigia/needrestart.js'
import { parseBackupStatus } from '../src/ops/vigia/backupStatus.js'
import { decideBotsReadiness } from '../src/ops/botsReadiness.js'

const app = (name, status = 'online') => ({ name, pm2_env: { status } })
const DUMP_01_10 = ['api', 'dashboard', 'bot-supervisor', 'api-staging', 'visual-staging', 'snapshot-cron']

test('cenário exato de 01/10: pm2 só com staging + dump com produção → RECUSA', () => {
  const current = parsePm2List(JSON.stringify([app('api-staging'), app('visual-staging')]))
  const d = decidePm2Save({ current, dumpNames: DUMP_01_10 })
  assert.equal(d.ok, false)
  assert.ok(d.reasons.some(r => r.includes('"bot-supervisor"')))
  assert.ok(d.reasons.some(r => r.includes('"dashboard"')))
})

test('pm2 vazio nunca é salvo, mesmo sem dump', () => {
  assert.equal(decidePm2Save({ current: [], dumpNames: null }).ok, false)
})

test('tudo presente e online → salva', () => {
  const current = parsePm2List(DUMP_01_10.map(n => app(n)))
  assert.deepEqual(decidePm2Save({ current, dumpNames: DUMP_01_10 }), { ok: true, reasons: [], removed: [] })
})

test('app de produção parado/errored bloqueia; snapshot-cron parado não', () => {
  const current = parsePm2List([...DUMP_01_10.filter(n => n !== 'snapshot-cron').map(n => app(n)), app('snapshot-cron', 'stopped')])
  assert.equal(decidePm2Save({ current, dumpNames: DUMP_01_10 }).ok, true)
  current.find(p => p.name === 'bot-supervisor').status = 'errored'
  assert.equal(decidePm2Save({ current, dumpNames: DUMP_01_10 }).ok, false)
})

test('remover app de propósito só com PM2_SAVE_ALLOW_REMOVE', () => {
  const current = parsePm2List(DUMP_01_10.filter(n => n !== 'snapshot-cron').map(n => app(n)))
  const d1 = decidePm2Save({ current, dumpNames: DUMP_01_10 })
  assert.equal(d1.ok, true, 'app que não é de produção pode sair')
  assert.deepEqual(d1.removed, ['snapshot-cron'])
  const semSupervisor = current.filter(p => p.name !== 'bot-supervisor')
  assert.equal(decidePm2Save({ current: semSupervisor, dumpNames: DUMP_01_10 }).ok, false)
  assert.equal(decidePm2Save({ current: semSupervisor, dumpNames: DUMP_01_10, allowRemove: 'bot-supervisor' }).ok, true)
})

test('host só de staging (sem produção no dump nem no pm2) salva normalmente', () => {
  const current = parsePm2List([app('api-staging'), app('visual-staging')])
  assert.equal(decidePm2Save({ current, dumpNames: ['api-staging', 'visual-staging'] }).ok, true)
})

test('lixo na entrada não quebra', () => {
  assert.deepEqual(parsePm2List('não é json'), [])
  assert.equal(parseDumpNames('{quebrado'), null)
  assert.equal(parseDumpNames(null), null)
})

test('apps esperados: remote exige supervisor; inline não; staging e override', () => {
  assert.deepEqual(resolveExpectedApps({ BOT_SUPERVISOR_MODE: 'remote' }), ['api', 'dashboard', 'bot-supervisor'])
  assert.deepEqual(resolveExpectedApps({ BOT_SUPERVISOR_MODE: 'inline' }), ['api', 'dashboard'])
  assert.deepEqual(resolveExpectedApps({ APP_ENV: 'staging' }), ['api-staging', 'visual-staging'])
  assert.deepEqual(resolveExpectedApps({ VIGIA_EXPECTED_APPS: 'a, b' }), ['a', 'b'])
  assert.deepEqual(missingApps([{ name: 'api' }], ['api', 'bot-supervisor']), ['bot-supervisor'])
})

test('needrestart: último arquivo vence; sem definição = padrão i; sem arquivo = null', () => {
  assert.equal(parseNeedrestartMode([]), null)
  assert.equal(parseNeedrestartMode(['#$nrconf{restart} = \'a\';\n$nrconf{blacklist} = [];']), 'i')
  assert.equal(parseNeedrestartMode(['$nrconf{restart} = \'a\';', '$nrconf{restart} = \'l\';']), 'l')
  assert.equal(parseNeedrestartMode(['$nrconf{restart} = \'l\';', '  $nrconf{restart} = "a";']), 'a')
})

test('backup: lê cifra pelo nome e nuvem pela última execução do log', () => {
  const marker = '2026-10-01T22:37:35Z /home/deploy/wabot-backups/wabot-prod-20261001-223544.tar.gz'
  const log = 'Iniciando backup\nUpload concluído: b2\nIniciando backup\nATENÇÃO: upload externo desabilitado (BACKUP_RCLONE_REMOTE vazio)'
  assert.deepEqual(parseBackupStatus({ marker, logTail: log }), { at: Date.parse('2026-10-01T22:37:35Z'), encrypted: false, cloud: false })
  assert.equal(parseBackupStatus({ marker: marker + '.age', logTail: 'Iniciando backup\nUpload concluído: b2' }).cloud, true)
  assert.equal(parseBackupStatus({ marker: marker + '.age' }).encrypted, true)
  assert.equal(parseBackupStatus({}).cloud, null)
})

test('/ready/bots: supervisor sem sinal ou metade das sessões sem sinal = não pronto', () => {
  assert.equal(decideBotsReadiness({ mode: 'remote', supervisorAlive: false, live: 70, stale: 0 }).ok, false)
  assert.equal(decideBotsReadiness({ mode: 'remote', supervisorAlive: true, live: 71, stale: 71 }).ok, false)
  assert.equal(decideBotsReadiness({ mode: 'remote', supervisorAlive: true, live: 70, stale: 2 }).ok, true)
  assert.equal(decideBotsReadiness({ mode: 'inline', supervisorAlive: false, live: 0, stale: 0 }).ok, true, 'inline não depende do supervisor')
  const semMedida = decideBotsReadiness({ mode: 'remote', supervisorAlive: null, live: null, stale: null })
  assert.equal(semMedida.ok, true)
  assert.equal(semMedida.reason, 'unknown')
})
