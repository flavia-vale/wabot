import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, statSync, rmSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const REPO = process.cwd()
const BACKUP_SCRIPT = join(REPO, 'scripts', 'backup_prod.sh')
const VERIFY_SCRIPT = join(REPO, 'scripts', 'verify_backup.sh')
const RESTORE_SCRIPT = join(REPO, 'scripts', 'restore_from_backup.sh')

// Skip se sqlite3 CLI não estiver instalado neste runtime.
function hasSqlite3() {
  try { execSync('sqlite3 --version', { stdio: 'ignore' }); return true } catch { return false }
}

function hasAge() {
  try { execSync('age --version', { stdio: 'ignore' }); return true } catch { return false }
}

/**
 * Constrói um "ambiente prod" fake num tmp dir:
 *   <root>/wabot/prisma/prod.db        (SQLite com User, WaSession, AdminAuditLog)
 *   <root>/wabot/.env                  (com JWT_SECRET)
 *   <root>/wabot/dashboard/.env.local
 *   <root>/BOTinho-shared/auth_info/   (com 2 arquivos fake)
 *   <root>/wabot-backups/              (vazio, destino dos backups)
 */
function setupFakeProd() {
  const root = mkdtempSync(join(tmpdir(), 'wabot-backup-test-'))
  const prodDir = join(root, 'wabot')
  const prismaDir = join(prodDir, 'prisma')
  const dashboardDir = join(prodDir, 'dashboard')
  const authInfoDir = join(root, 'BOTinho-shared', 'auth_info')
  const backupDir = join(root, 'wabot-backups')
  mkdirSync(prismaDir, { recursive: true })
  mkdirSync(dashboardDir, { recursive: true })
  mkdirSync(authInfoDir, { recursive: true })
  mkdirSync(backupDir, { recursive: true })

  const dbFile = join(prismaDir, 'prod.db')
  // Cria DB com schema mínimo + 3 users
  execSync(`sqlite3 "${dbFile}" "
    CREATE TABLE User (id TEXT PRIMARY KEY, email TEXT, createdAt INTEGER);
    CREATE TABLE WaSession (userId TEXT PRIMARY KEY, status TEXT);
    CREATE TABLE AdminAuditLog (id INTEGER PRIMARY KEY, action TEXT);
    INSERT INTO User VALUES ('u1','a@x.com',1);
    INSERT INTO User VALUES ('u2','b@x.com',2);
    INSERT INTO User VALUES ('u3','c@x.com',3);
  "`)

  writeFileSync(join(prodDir, '.env'), 'JWT_SECRET=test-secret-xyz\nDATABASE_URL=file:./prisma/prod.db\nREDIS_URL=redis://127.0.0.1:6379/0\n')
  writeFileSync(join(dashboardDir, '.env.local'), 'PORT=3000\n')
  writeFileSync(join(authInfoDir, 'creds.json'), '{"fake":"creds"}')
  writeFileSync(join(authInfoDir, 'session-1.json'), '{"fake":"session"}')

  return {
    root, prodDir, prismaDir, dashboardDir, authInfoDir, backupDir, dbFile,
    cleanup: () => { try { rmSync(root, { recursive: true, force: true }) } catch {} },
  }
}

function runScript(script, args = [], env = {}, { ignoreFail = false } = {}) {
  try {
    return execSync(`bash "${script}" ${args.map(a => `"${a}"`).join(' ')}`, {
      env: { ...process.env, ...env, PATH: process.env.PATH },
      stdio: 'pipe',
    }).toString()
  } catch (err) {
    if (ignoreFail) return { failed: true, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '', code: err.status }
    throw new Error(`script falhou (exit ${err.status}): ${err.stderr?.toString() || err.message}`)
  }
}

if (!hasSqlite3()) {
  test('backup scripts: sqlite3 não instalado — testes skipados', () => {
    // Em CI/staging sqlite3 está instalado (pré-requisito do backup_prod.sh).
    // Aqui só registra a ausência para o reporter.
    assert.ok(true)
  })
} else {

// ---------- backup_prod.sh ----------

test('backup_prod.sh gera tar.gz com prod.db, auth_info, env/, manifest.json', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir,
    PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir,
    BACKUP_DIR: env.backupDir,
    ROOT_ENV_FILE: join(env.prodDir, '.env'),
    DASHBOARD_ENV_FILE: join(env.dashboardDir, '.env.local'),
  })

  const archives = readdirSync(env.backupDir).filter(f => f.startsWith('wabot-prod-') && f.endsWith('.tar.gz'))
  assert.equal(archives.length, 1, 'um arquivo de backup gerado')
  const archive = join(env.backupDir, archives[0])
  assert.equal((statSync(archive).mode & 0o777), 0o600, 'archive deve estar com mode 600')

  // Inspeciona conteúdo do tar
  const listing = execSync(`tar -tzf "${archive}"`).toString()
  assert.match(listing, /prod\.db/, 'prod.db presente')
  assert.match(listing, /auth_info\//, 'auth_info/ presente')
  assert.match(listing, /env\/root\.env/, 'env/root.env presente')
  assert.match(listing, /env\/dashboard\.env\.local/, 'env/dashboard.env.local presente')
  assert.match(listing, /manifest\.json/, 'manifest.json presente')
})

test('backup_prod.sh omite env/ quando INCLUDE_ENV_FILES=0', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir,
    PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir,
    BACKUP_DIR: env.backupDir,
    INCLUDE_ENV_FILES: '0',
  })

  const archive = join(env.backupDir, readdirSync(env.backupDir).find(f => f.endsWith('.tar.gz')))
  const listing = execSync(`tar -tzf "${archive}"`).toString()
  assert.ok(!/env\/root\.env/.test(listing), 'env/root.env NÃO deve estar presente')
})

// ---------- verify_backup.sh ----------

test('verify_backup.sh aprova archive válido com User > 0 e JWT_SECRET', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
    ROOT_ENV_FILE: join(env.prodDir, '.env'),
    DASHBOARD_ENV_FILE: join(env.dashboardDir, '.env.local'),
  })

  const out = runScript(VERIFY_SCRIPT, [], {
    BACKUP_DIR: env.backupDir,
    MIN_USER_COUNT: '1',
    MAX_AGE_HOURS: '0', // skip age check
  })
  assert.match(out, /integrity_check OK/)
  assert.match(out, /User\.count=3 OK/)
  assert.match(out, /env\/root\.env OK/)
  assert.match(out, /backup íntegro/)
})

test('verify_backup.sh REJEITA archive sem JWT_SECRET no .env', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  // Sobrescreve .env sem JWT_SECRET
  writeFileSync(join(env.prodDir, '.env'), 'DATABASE_URL=file:./x.db\n')
  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
    ROOT_ENV_FILE: join(env.prodDir, '.env'),
  })

  const result = runScript(VERIFY_SCRIPT, [], {
    BACKUP_DIR: env.backupDir, MAX_AGE_HOURS: '0',
  }, { ignoreFail: true })
  assert.equal(result.failed, true)
  assert.match(result.stdout + result.stderr, /JWT_SECRET ausente/)
})

test('verify_backup.sh REJEITA archive com integrity_check quebrado', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
  })

  // Corrompe o tar.gz reescrevendo bytes no meio
  const archive = join(env.backupDir, readdirSync(env.backupDir).find(f => f.startsWith("wabot-prod-")))
  const buf = Buffer.from(readFileSync(archive))
  // Corrompe um trecho perto do meio (evita stomp em header gzip nos primeiros 10 bytes)
  for (let i = 256; i < 320 && i < buf.length; i++) buf[i] = 0xFF
  writeFileSync(archive, buf)

  const result = runScript(VERIFY_SCRIPT, [], { BACKUP_DIR: env.backupDir, MAX_AGE_HOURS: '0' }, { ignoreFail: true })
  assert.equal(result.failed, true)
})

test('verify_backup.sh respeita MAX_AGE_HOURS', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
  })
  // Envelhece o arquivo artificialmente (48h atrás)
  const archive = join(env.backupDir, readdirSync(env.backupDir).find(f => f.startsWith("wabot-prod-")))
  const oldTime = (Date.now() - 48 * 3600 * 1000) / 1000
  execSync(`touch -d "@${Math.floor(oldTime)}" "${archive}"`)

  const result = runScript(VERIFY_SCRIPT, [], { BACKUP_DIR: env.backupDir, MAX_AGE_HOURS: '24' }, { ignoreFail: true })
  assert.equal(result.failed, true)
  assert.match(result.stdout + result.stderr, /cron não está rodando/)
})

// ---------- restore_from_backup.sh ----------

test('restore_from_backup.sh sem --confirm falha com exit 2', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
  })
  const archive = join(env.backupDir, readdirSync(env.backupDir).find(f => f.startsWith("wabot-prod-")))

  const result = runScript(RESTORE_SCRIPT, [archive], {}, { ignoreFail: true })
  assert.equal(result.failed, true)
  assert.equal(result.code, 2)
  assert.match(result.stdout + result.stderr, /--confirm/)
})

test('restore_from_backup.sh round-trip: backup → mexe no estado → restore restaura', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  // 1) Backup do estado original (3 users)
  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
    ROOT_ENV_FILE: join(env.prodDir, '.env'),
    DASHBOARD_ENV_FILE: join(env.dashboardDir, '.env.local'),
  })
  const archive = join(env.backupDir, readdirSync(env.backupDir).find(f => f.endsWith('.tar.gz')))

  // 2) Mexe no estado: adiciona um 4o usuário, modifica .env, apaga auth_info
  execSync(`sqlite3 "${env.dbFile}" "INSERT INTO User VALUES ('u4','d@x.com',4);"`)
  writeFileSync(join(env.prodDir, '.env'), 'JWT_SECRET=NEW-DIFFERENT-SECRET\n')
  rmSync(env.authInfoDir, { recursive: true, force: true })

  // 3) Restore
  runScript(RESTORE_SCRIPT, [archive, '--confirm'], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir,
    ROOT_ENV_FILE: join(env.prodDir, '.env'),
    DASHBOARD_ENV_FILE: join(env.dashboardDir, '.env.local'),
    SKIP_PM2: '1',
  })

  // 4) Estado deve ter voltado ao original
  const userCount = execSync(`sqlite3 "${env.dbFile}" "SELECT COUNT(*) FROM User;"`).toString().trim()
  assert.equal(userCount, '3', 'voltou para 3 users do backup')

  const envContent = readFileSync(join(env.prodDir, '.env'), 'utf8')
  assert.match(envContent, /JWT_SECRET=test-secret-xyz/, '.env restaurado para o original')

  assert.ok(existsSync(env.authInfoDir), 'auth_info restaurado')
  assert.ok(existsSync(join(env.authInfoDir, 'creds.json')), 'arquivos de auth_info presentes')
})

// ---------- criptografia (age) ----------

test('backup_prod.sh com BACKUP_REQUIRE_ENCRYPTION=1 e sem chave falha sem deixar plaintext', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  const result = runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
    BACKUP_REQUIRE_ENCRYPTION: '1',
  }, { ignoreFail: true })
  assert.equal(result.failed, true)
  assert.match(result.stdout + result.stderr, /BACKUP_REQUIRE_ENCRYPTION/)
  const leftovers = readdirSync(env.backupDir).filter(f => f.startsWith('wabot-prod-'))
  assert.equal(leftovers.length, 0, 'nenhum tarball em texto puro deve sobrar')
})

test('backup_prod.sh com BACKUP_REQUIRE_CLOUD=1 e sem remote falha', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  const result = runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
    BACKUP_REQUIRE_CLOUD: '1',
  }, { ignoreFail: true })
  assert.equal(result.failed, true)
  assert.match(result.stdout + result.stderr, /BACKUP_REQUIRE_CLOUD/)
})

test('backup_prod.sh sobe para múltiplos remotes quando BACKUP_RCLONE_REMOTE tem vírgula', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  // rclone real não está instalado neste runtime — substitui por um fake
  // no PATH que só registra os argumentos recebidos.
  const fakeBinDir = mkdtempSync(join(tmpdir(), 'wabot-fake-rclone-'))
  t.after(() => rmSync(fakeBinDir, { recursive: true, force: true }))
  const callLog = join(fakeBinDir, 'calls.log')
  writeFileSync(join(fakeBinDir, 'rclone'), '#!/usr/bin/env bash\necho "$@" >> "' + callLog + '"\nexit 0\n')
  execSync(`chmod +x "${join(fakeBinDir, 'rclone')}"`)

  const originalPath = process.env.PATH
  process.env.PATH = `${fakeBinDir}:${originalPath}`
  t.after(() => { process.env.PATH = originalPath })

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
    BACKUP_RCLONE_REMOTE: 'b2-wabot:wabot-backups, gdrive-wabot:wabot-backups',
  })

  const calls = readFileSync(callLog, 'utf8')
  assert.match(calls, /copy .*b2-wabot:wabot-backups/, 'chamou rclone copy para o remote B2')
  assert.match(calls, /copy .*gdrive-wabot:wabot-backups/, 'chamou rclone copy para o remote Drive')
  assert.match(calls, /delete b2-wabot:wabot-backups/, 'chamou rclone delete (rotação) para o remote B2')
  assert.match(calls, /delete gdrive-wabot:wabot-backups/, 'chamou rclone delete (rotação) para o remote Drive')
})

test('backup_prod.sh grava last_success.txt ao final', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
  })
  const marker = join(env.backupDir, 'last_success.txt')
  assert.ok(existsSync(marker), 'marcador de sucesso deve existir')
  assert.match(readFileSync(marker, 'utf8'), /wabot-prod-/)
})

if (hasAge()) {
  test('round-trip cifrado: backup .age → verify com identity → restore decifra e restaura', async (t) => {
    const env = setupFakeProd()
    t.after(env.cleanup)

    // Gera par de chaves age efêmero
    const keyFile = join(env.root, 'backup-key.txt')
    execSync(`age-keygen -o "${keyFile}" 2>/dev/null`)
    const recipient = readFileSync(keyFile, 'utf8').match(/public key: (age1\S+)/)[1]

    // 1) Backup cifrado
    runScript(BACKUP_SCRIPT, [], {
      PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
      AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
      ROOT_ENV_FILE: join(env.prodDir, '.env'),
      DASHBOARD_ENV_FILE: join(env.dashboardDir, '.env.local'),
      BACKUP_AGE_RECIPIENT: recipient,
      BACKUP_REQUIRE_ENCRYPTION: '1',
    })
    const files = readdirSync(env.backupDir).filter(f => f.startsWith('wabot-prod-'))
    assert.equal(files.length, 1)
    assert.ok(files[0].endsWith('.tar.gz.age'), 'arquivo deve ser .tar.gz.age')
    assert.ok(!files.some(f => f.endsWith('.tar.gz')), 'plaintext não deve sobrar no disco')
    const archive = join(env.backupDir, files[0])
    assert.equal((statSync(archive).mode & 0o777), 0o600)

    // 2) verify sem identity: aprova só presença/header
    const outNoKey = runScript(VERIFY_SCRIPT, [], { BACKUP_DIR: env.backupDir, MAX_AGE_HOURS: '0' })
    assert.match(outNoKey, /cifrado/)

    // 3) verify com identity: inspeciona conteúdo completo
    const outWithKey = runScript(VERIFY_SCRIPT, [], {
      BACKUP_DIR: env.backupDir, MAX_AGE_HOURS: '0',
      MIN_USER_COUNT: '1', AGE_IDENTITY_FILE: keyFile,
    })
    assert.match(outWithKey, /integrity_check OK/)
    assert.match(outWithKey, /backup íntegro/)

    // 4) restore: mexe no estado e restaura a partir do .age
    execSync(`sqlite3 "${env.dbFile}" "INSERT INTO User VALUES ('u4','d@x.com',4);"`)
    runScript(RESTORE_SCRIPT, [archive, '--confirm'], {
      PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
      AUTH_INFO_DIR: env.authInfoDir,
      ROOT_ENV_FILE: join(env.prodDir, '.env'),
      SKIP_PM2: '1', AGE_IDENTITY_FILE: keyFile,
    })
    const userCount = execSync(`sqlite3 "${env.dbFile}" "SELECT COUNT(*) FROM User;"`).toString().trim()
    assert.equal(userCount, '3', 'restore do .age volta ao estado do backup')
  })

  test('restore de .age sem AGE_IDENTITY_FILE falha com mensagem clara', async (t) => {
    const env = setupFakeProd()
    t.after(env.cleanup)

    const keyFile = join(env.root, 'backup-key.txt')
    execSync(`age-keygen -o "${keyFile}" 2>/dev/null`)
    const recipient = readFileSync(keyFile, 'utf8').match(/public key: (age1\S+)/)[1]
    runScript(BACKUP_SCRIPT, [], {
      PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
      AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
      BACKUP_AGE_RECIPIENT: recipient,
    })
    const archive = join(env.backupDir, readdirSync(env.backupDir).find(f => f.endsWith('.age')))

    const result = runScript(RESTORE_SCRIPT, [archive, '--confirm'], { SKIP_PM2: '1' }, { ignoreFail: true })
    assert.equal(result.failed, true)
    assert.match(result.stdout + result.stderr, /AGE_IDENTITY_FILE/)
  })
}

test('restore preserva pre-backup do estado anterior em /tmp', async (t) => {
  const env = setupFakeProd()
  t.after(env.cleanup)

  runScript(BACKUP_SCRIPT, [], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir, BACKUP_DIR: env.backupDir,
  })
  const archive = join(env.backupDir, readdirSync(env.backupDir).find(f => f.endsWith('.tar.gz')))

  const out = runScript(RESTORE_SCRIPT, [archive, '--confirm'], {
    PROD_DIR: env.prodDir, PROD_DB: env.dbFile,
    AUTH_INFO_DIR: env.authInfoDir,
    ROOT_ENV_FILE: join(env.prodDir, '.env'),
    SKIP_PM2: '1',
  })

  const match = out.match(/Pre-backup do estado anterior \(preservar até validar\): (\S+)/)
  assert.ok(match, 'restore deve anunciar o caminho do pre-backup')
  const preBackupDir = match[1]
  assert.ok(existsSync(join(preBackupDir, 'prod.db.before-restore')), 'pre-backup do DB salvo')
  // Limpeza explícita já que está em /tmp e fora do tmp_dir do teste
  try { rmSync(preBackupDir, { recursive: true, force: true }) } catch {}
})

}
