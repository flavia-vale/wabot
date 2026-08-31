import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'

test('coletor de capacidade é executável, somente leitura e não expõe env do PM2', async () => {
  const url = new URL('../scripts/collect-capacity-audit.sh', import.meta.url)
  const script = await readFile(url, 'utf8')
  await access(url, constants.X_OK)
  assert.doesNotMatch(script, /pm2 prettylist \|/)
  assert.match(script, /pm2 jlist/)
  assert.match(script, /JSON\.stringify\(\{name:p\.name,pid:p\.pid/)
  assert.doesNotMatch(script, /redis-cli[^\n]*(DEL|FLUSH|SET|XADD)/i)
  for (const section of ['CPU, RAM E SWAP', 'DISCO E I/O', 'PROCESSOS DA APLICAÇÃO', 'REDE E SOCKETS', 'REDIS E FILAS BULLMQ', 'BANCO SQLITE', 'KERNEL, OOM E ERROS']) assert.match(script, new RegExp(section))
})

test('runbook traz comando único e alternativa manual por subsistema', async () => {
  const runbook = await readFile(new URL('../docs/architecture-capacity-audit.md', import.meta.url), 'utf8')
  assert.match(runbook, /\.\/scripts\/collect-capacity-audit\.sh \/tmp\/wabot-capacidade\.txt/)
  for (const command of ['free -h', 'vmstat 1 10', 'df -hT', 'pm2 status', 'ss -s', 'redis-cli', 'PRAGMA quick_check', 'journalctl -k']) assert.match(runbook, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(runbook, /Não cole `.env`, `pm2 prettylist`, tokens, cookies ou credenciais/)
})

test('resumo breve limita saída a agregados e não imprime dados sensíveis', async () => {
  const url = new URL('../scripts/collect-capacity-brief.sh', import.meta.url)
  const script = await readFile(url, 'utf8')
  await access(url, constants.X_OK)
  assert.match(script, /WORKERS_PRODUCAO/)
  assert.match(script, /ERROS_24H_CONTAGEM/)
  assert.doesNotMatch(script, /prettylist|--scan|ss -[a-z]*p|pm2_env[^|]*print|pm2 logs[^\n]*tail/i)
  assert.doesNotMatch(script, /grep[^\n]*tail/i)
})
