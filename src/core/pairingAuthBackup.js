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

/**
 * @param {object} deps
 * @param {string} deps.authDir  diretório de credenciais da sessão
 * @param {object} deps.fs       { rename, rm, access } (fs/promises)
 * @param {object} [deps.logger] pino-like (info/warn)
 */
export function createPairingAuthBackup({ authDir, fs, logger = null }) {
  if (!authDir) throw new Error('createPairingAuthBackup: authDir obrigatório')
  if (!fs?.rename || !fs?.rm) throw new Error('createPairingAuthBackup: fs.rename e fs.rm obrigatórios')

  const backupDir = `${authDir}${PAIRING_BACKUP_SUFFIX}`
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

  return { backup, restore, discard, hasBackup: () => hasBackup, backupDir }
}
