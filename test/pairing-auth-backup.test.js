import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { createPairingAuthBackup, PAIRING_BACKUP_SUFFIX, decideOrphanBackupRecovery } from '../src/core/pairingAuthBackup.js'

const AUTH_DIR = '/auth/user-1'
const BACKUP_DIR = `${AUTH_DIR}${PAIRING_BACKUP_SUFFIX}`

/** fs de mentira: um Set de diretórios existentes + registro das chamadas. */
function fakeFs({ existing = [AUTH_DIR], renameError = null } = {}) {
  const dirs = new Set(existing)
  const calls = []
  return {
    dirs,
    calls,
    async rename(from, to) {
      calls.push(['rename', from, to])
      if (renameError) throw renameError
      if (!dirs.has(from)) {
        const err = new Error('ENOENT')
        err.code = 'ENOENT'
        throw err
      }
      dirs.delete(from)
      dirs.add(to)
    },
    async rm(target) {
      calls.push(['rm', target])
      dirs.delete(target)
    },
  }
}

test('backup move a credencial em vez de apagar — nada é destruído no clique', async () => {
  const fs = fakeFs()
  const b = createPairingAuthBackup({ authDir: AUTH_DIR, fs })

  assert.equal(await b.backup(), true)
  assert.equal(fs.dirs.has(AUTH_DIR), false, 'AUTH_DIR fica livre para o pareamento')
  assert.equal(fs.dirs.has(BACKUP_DIR), true, 'a credencial continua existindo, só que no backup')
  assert.equal(
    fs.calls.some(([op, target]) => op === 'rm' && target === AUTH_DIR),
    false,
    'a credencial NUNCA pode ser apagada no início do pareamento (RCA 2026-07-28)'
  )
})

test('restore devolve a credencial e a sessão pode voltar a reconectar', async () => {
  const fs = fakeFs()
  const b = createPairingAuthBackup({ authDir: AUTH_DIR, fs })

  await b.backup()
  assert.equal(await b.restore(), true)
  assert.equal(fs.dirs.has(AUTH_DIR), true)
  assert.equal(fs.dirs.has(BACKUP_DIR), false)
  assert.equal(b.hasBackup(), false)
})

test('restore é idempotente — vários caminhos de falha podem chamá-lo', async () => {
  // O pareamento falha por até quatro caminhos distintos (erro no socket,
  // expiração da janela, startBot, close pré-código) e mais de um pode
  // disparar no mesmo episódio.
  const fs = fakeFs()
  const b = createPairingAuthBackup({ authDir: AUTH_DIR, fs })

  await b.backup()
  assert.equal(await b.restore(), true)
  assert.equal(await b.restore(), false, 'segunda chamada não faz nada')
  assert.equal(fs.dirs.has(AUTH_DIR), true, 'e não pode destruir a credencial já restaurada')
})

test('primeiro pareamento (sem credencial anterior) não inventa backup', async () => {
  const fs = fakeFs({ existing: [] })
  const b = createPairingAuthBackup({ authDir: AUTH_DIR, fs })

  assert.equal(await b.backup(), false)
  assert.equal(b.hasBackup(), false)
  assert.equal(await b.restore(), false, 'sem backup não há o que restaurar')
})

test('discard só apaga a credencial antiga depois do pareamento aceito', async () => {
  const fs = fakeFs()
  const b = createPairingAuthBackup({ authDir: AUTH_DIR, fs })

  await b.backup()
  await b.discard()
  assert.equal(fs.dirs.has(BACKUP_DIR), false)
  assert.equal(b.hasBackup(), false)
  assert.equal(await b.restore(), false, 'depois de descartado não volta atrás')
})

test('backup órfão de um pareamento anterior não bloqueia o novo', async () => {
  // Worker morto no meio de um pareamento deixa o diretório de backup para
  // trás; o rename falharia com destino ocupado e a credencial atual ficaria
  // presa no AUTH_DIR junto do socket de pareamento.
  const fs = fakeFs({ existing: [AUTH_DIR, BACKUP_DIR] })
  const b = createPairingAuthBackup({ authDir: AUTH_DIR, fs })

  assert.equal(await b.backup(), true)
  assert.equal(fs.dirs.has(BACKUP_DIR), true)
  assert.equal(fs.dirs.has(AUTH_DIR), false)
})

test('falha inesperada de rename ainda libera o AUTH_DIR para o pareamento', async () => {
  // Pior caso: não conseguimos preservar a credencial. O comportamento tem que
  // degradar para o histórico (AUTH_DIR limpo), nunca para "pareamento
  // impossível porque sobrou credencial no diretório".
  const fs = fakeFs({ renameError: Object.assign(new Error('EXDEV'), { code: 'EXDEV' }) })
  const warns = []
  const b = createPairingAuthBackup({ authDir: AUTH_DIR, fs, logger: { warn: (_c, m) => warns.push(m) } })

  assert.equal(await b.backup(), false)
  assert.equal(fs.dirs.has(AUTH_DIR), false, 'AUTH_DIR precisa ficar livre mesmo sem backup')
  assert.equal(warns.length, 1)
})

test('exige authDir e fs — configuração errada falha cedo', () => {
  assert.throws(() => createPairingAuthBackup({ fs: { rename() {}, rm() {} } }), /authDir obrigatório/)
  assert.throws(() => createPairingAuthBackup({ authDir: AUTH_DIR, fs: {} }), /fs.rename e fs.rm obrigatórios/)
})

// --- Backup órfão: pareamento que derruba o processo (RCA 2026-09-14) ---
//
// `restore()` só existe na memória do processo que fez o backup. Na conta
// medida, um `stream:error 500` durante o pareamento matou o worker e deixou a
// credencial boa num `.pairing-backup` que ninguém mais olhava — e o próximo
// pareamento a apagaria para liberar o lugar.

test('decideOrphanBackupRecovery: devolve só com certeza dos dois lados', () => {
  assert.equal(decideOrphanBackupRecovery({ authHasCreds: false, backupHasCreds: true }), true)
  // Já existe credencial no lugar: devolver sobrescreveria a boa pela velha.
  assert.equal(decideOrphanBackupRecovery({ authHasCreds: true, backupHasCreds: true }), false)
  // Sem nada no backup não há o que devolver.
  assert.equal(decideOrphanBackupRecovery({ authHasCreds: false, backupHasCreds: false }), false)
  // Dúvida de qualquer lado NUNCA recupera (fail-safe é não mexer).
  assert.equal(decideOrphanBackupRecovery({ authHasCreds: null, backupHasCreds: true }), false)
  assert.equal(decideOrphanBackupRecovery({ authHasCreds: false, backupHasCreds: null }), false)
  assert.equal(decideOrphanBackupRecovery({}), false)
})

test('recoverOrphan devolve a credencial deixada por pareamento interrompido', async () => {
  const calls = []
  const backup = createPairingAuthBackup({
    authDir: '/auth/u1',
    fs: {
      rename: async (from, to) => calls.push(['rename', from, to]),
      rm: async (dir) => calls.push(['rm', dir]),
      // Sem creds no lugar; creds no backup.
      access: async (path) => {
        if (path === '/auth/u1/creds.json') throw Object.assign(new Error('nope'), { code: 'ENOENT' })
        return true
      },
    },
  })
  assert.equal(await backup.recoverOrphan(), true)
  assert.deepEqual(calls.at(-1), ['rename', '/auth/u1.pairing-backup', '/auth/u1'])
})

test('recoverOrphan não toca em credencial que já está no lugar', async () => {
  const calls = []
  const backup = createPairingAuthBackup({
    authDir: '/auth/u1',
    fs: {
      rename: async (from, to) => calls.push(['rename', from, to]),
      rm: async (dir) => calls.push(['rm', dir]),
      access: async () => true,
    },
  })
  assert.equal(await backup.recoverOrphan(), false)
  assert.deepEqual(calls, [])
})

test('sem fs.access a dúvida não vira recuperação', async () => {
  const calls = []
  const backup = createPairingAuthBackup({
    authDir: '/auth/u1',
    fs: {
      rename: async (from, to) => calls.push(['rename', from, to]),
      rm: async (dir) => calls.push(['rm', dir]),
    },
  })
  assert.equal(await backup.recoverOrphan(), false)
  assert.deepEqual(calls, [])
})

test('esquecer o número apaga também o backup — credencial removida não volta', () => {
  const rota = readFileSync(new URL('../src/api/routes/session.js', import.meta.url), 'utf8')
  assert.match(rota, /pairingBackupDirFor\(authDir\)/)
  const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  // Logout e reset por badSession também levam o backup: credencial revogada ou
  // corrompida não pode ser devolvida ao lugar no boot seguinte.
  assert.ok(
    worker.split('pairingAuthBackup.backupDir').length - 1 >= 2,
    'logout e badSession precisam apagar o backup junto do auth_info',
  )
  assert.match(
    worker,
    /if \(!pairingAuthBackup\.hasBackup\(\)\) \{\s*\n\s*await pairingAuthBackup\.recoverOrphan\(\)/,
    'o boot precisa tentar devolver backup órfão, e nunca durante um pareamento em andamento',
  )
})
