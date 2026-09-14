/**
 * Rede de segurança para o `auth_info` durante o pareamento por número.
 *
 * RCA 2026-07-28: o handler de `requestPairingCode` (`src/bot-worker.js`) fazia
 * `rm -rf AUTH_DIR` ASSIM QUE o usuário clicava em conectar — antes de saber se
 * o WhatsApp sequer aceitaria o pareamento. Quando o WA recusou a conexão
 * (`failure reason=405`, versão do WA Web expirada), a credencial válida que a
 * sessão ainda tinha já tinha sido destruída: a sessão saiu de "caiu mas tenta
 * reconectar sozinha" para "sem credencial nenhuma e sem reconexão automática"
 * — travada de vez, exigindo re-pareamento que também não funcionava.
 *
 * Aqui o `rm` vira `rename` para um diretório de backup. Se o pareamento falhar
 * ANTES de o código chegar ao usuário, o backup volta ao lugar e a sessão
 * retoma a reconexão normal com a credencial antiga. Só depois que o WhatsApp
 * aceita o pareamento (ou que o usuário recebe o código, ponto em que a
 * credencial antiga já foi substituída de propósito) o backup é descartado.
 *
 * Todo I/O entra por injeção (`fs`), então o teste roda sem tocar em disco real.
 */

export const PAIRING_BACKUP_SUFFIX = '.pairing-backup'

/** Onde mora o backup de uma credencial — fonte única do caminho. */
export function pairingBackupDirFor(authDir) {
  return `${authDir}${PAIRING_BACKUP_SUFFIX}`
}

/**
 * Devolver ao lugar um backup que ficou ÓRFÃO?
 *
 * RCA 2026-09-14: `restore()` só existe na memória do processo que fez o
 * backup. Quando o pareamento derruba o próprio worker (na conta medida, um
 * `stream:error 500` durante o pareamento), o processo morre com o backup
 * ainda no disco: a credencial boa fica num diretório que ninguém mais olha, a
 * sessão perde o que tinha e o próximo pareamento APAGA o backup para liberar
 * o lugar. A rede de segurança do RCA 2026-07-28 existia e, nesse caminho,
 * nunca era acionada.
 *
 * Fail-safe é NÃO MEXER: só devolve quando temos certeza dos dois lados — não
 * há credencial no lugar (senão sobrescreveríamos a boa por uma velha) e há
 * credencial no backup. Dúvida de qualquer lado (`null`) não recupera nada.
 */
export function decideOrphanBackupRecovery({ authHasCreds, backupHasCreds } = {}) {
  if (authHasCreds !== false) return false
  if (backupHasCreds !== true) return false
  return true
}

/**
 * @param {object} deps
 * @param {string} deps.authDir  diretório de credenciais da sessão
 * @param {object} deps.fs       { rename, rm, access } (fs/promises)
 * @param {object} [deps.logger] pino-like (info/warn)
 */
export function createPairingAuthBackup({ authDir, fs, logger = null }) {
  if (!authDir) throw new Error('createPairingAuthBackup: authDir obrigatório')
  if (!fs?.rename || !fs?.rm) throw new Error('createPairingAuthBackup: fs.rename e fs.rm obrigatórios')

  const backupDir = pairingBackupDirFor(authDir)
  let hasBackup = false

  /**
   * Move a credencial atual para o backup, liberando o AUTH_DIR para o
   * pareamento. Devolve `true` quando havia credencial guardada.
   *
   * Um backup anterior órfão (processo morto no meio de um pareamento) é
   * descartado antes: o `rename` falharia com o destino ocupado, e a
   * credencial mais recente é sempre a que vale.
   */
  async function backup() {
    await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {})
    hasBackup = false
    try {
      await fs.rename(authDir, backupDir)
      hasBackup = true
      logger?.info?.({ backupDir }, 'Credencial atual movida para backup antes do pareamento')
    } catch (err) {
      // ENOENT = não havia credencial (primeiro pareamento). Qualquer outro
      // erro: seguimos sem backup, mas garantimos o AUTH_DIR limpo para o
      // pareamento — é o comportamento histórico, nunca pior que ele.
      if (err?.code !== 'ENOENT') {
        logger?.warn?.({ err: err?.message, authDir }, 'Não foi possível fazer backup da credencial antes do pareamento')
      }
      await fs.rm(authDir, { recursive: true, force: true }).catch(() => {})
    }
    return hasBackup
  }

  /**
   * Devolve a credencial antiga ao lugar. Usado quando o pareamento falhou
   * ANTES de o código chegar ao usuário — nesse ponto nada foi trocado no
   * WhatsApp, então a credencial antiga continua sendo a válida.
   */
  async function restore() {
    if (!hasBackup) return false
    await fs.rm(authDir, { recursive: true, force: true }).catch(() => {})
    try {
      await fs.rename(backupDir, authDir)
      hasBackup = false
      logger?.info?.({ authDir }, 'Credencial anterior restaurada após pareamento falho — sessão volta a reconectar sozinha')
      return true
    } catch (err) {
      logger?.warn?.({ err: err?.message, backupDir }, 'Falha ao restaurar credencial após pareamento falho')
      return false
    }
  }

  /** Pareamento concluído: a credencial antiga não serve mais. */
  async function discard() {
    if (!hasBackup) return
    hasBackup = false
    await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {})
    logger?.info?.({ backupDir }, 'Backup da credencial anterior descartado (pareamento concluído)')
  }

  /**
   * Existe `creds.json` nesse diretório? `null` = não deu para saber (sem
   * `fs.access` injetado, ou erro que não é "não existe") — a dúvida NUNCA
   * vira recuperação.
   */
  async function credsPresent(dir) {
    if (!fs.access) return null
    try {
      await fs.access(`${dir}/creds.json`)
      return true
    } catch (err) {
      return err?.code === 'ENOENT' ? false : null
    }
  }

  /**
   * Chamado no boot do robô: devolve ao lugar um backup deixado por um
   * pareamento que derrubou o processo. Sem isso a credencial fica perdida no
   * disco até o próximo pareamento apagá-la.
   */
  async function recoverOrphan() {
    const [authHasCreds, backupHasCreds] = await Promise.all([
      credsPresent(authDir),
      credsPresent(backupDir),
    ])
    if (!decideOrphanBackupRecovery({ authHasCreds, backupHasCreds })) return false
    try {
      await fs.rm(authDir, { recursive: true, force: true }).catch(() => {})
      await fs.rename(backupDir, authDir)
      logger?.info?.({ authDir }, 'Credencial de um pareamento interrompido devolvida ao lugar — sessão volta a conectar sem novo QR')
      return true
    } catch (err) {
      logger?.warn?.({ err: err?.message, backupDir }, 'Falha ao devolver credencial de pareamento interrompido')
      return false
    }
  }

  return { backup, restore, discard, recoverOrphan, hasBackup: () => hasBackup, backupDir }
}
