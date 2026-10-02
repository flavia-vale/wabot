// Situação do último backup a partir do que o backup_prod.sh já deixa no
// disco (sem mexer nele — AGENTS.md: não tocar sem testar restauração).
//   marker  = conteúdo de last_success.txt ("<data> <arquivo>")
//   logTail = fim do backup.log
// cloud/encrypted: true | false | null (null = não dá para saber).
export function parseBackupStatus({ marker = null, logTail = null } = {}) {
  const parts = String(marker ?? '').trim().split(/\s+/)
  const at = Date.parse(parts[0] ?? '')
  const archive = parts[1] ?? ''
  const encrypted = archive ? archive.endsWith('.age') : null
  let cloud = null
  if (logTail) {
    const text = String(logTail)
    const lastRun = text.slice(Math.max(0, text.lastIndexOf('Iniciando backup')))
    if (/Upload concluído/.test(lastRun)) cloud = true
    else if (/upload externo desabilitado/.test(lastRun)) cloud = false
  }
  return { at: Number.isFinite(at) ? at : null, encrypted, cloud }
}
