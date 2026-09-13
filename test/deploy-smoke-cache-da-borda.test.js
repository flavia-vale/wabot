import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(raiz, 'scripts', 'smoke_mobile_dashboard.sh')

const PAGINA_OK =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>' +
  '</head><body>' + 'x'.repeat(500) + '</body></html>'

// Servidor que imita a borda: sem parametro descartavel devolve a copia velha
// (404 marcada como HIT), com parametro busca do servidor e devolve a pagina boa.
function subirBordaComCopiaVelha() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const temParametro = req.url.includes('smoke_cache_bust=')
      if (temParametro) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(PAGINA_OK)
        return
      }
      res.writeHead(404, {
        'content-type': 'text/html; charset=utf-8',
        'cf-cache-status': 'HIT',
      })
      res.end('<!doctype html><html id="__next_error__"><head></head><body>404</body></html>')
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function rodarSmoke(baseUrl) {
  return new Promise(resolve => {
    execFile(
      'bash',
      [script, baseUrl, '/'],
      { env: { ...process.env, MOBILE_SMOKE_ATTEMPTS: '1', MOBILE_SMOKE_SLEEP_SECONDS: '0' } },
      (erro, stdout, stderr) => resolve({ falhou: Boolean(erro), saida: `${stdout}${stderr}` })
    )
  })
}

test('copia velha na borda: reprova, mas diz que o servidor esta bom', async () => {
  const server = await subirBordaComCopiaVelha()
  const { port } = server.address()
  try {
    const { falhou, saida } = await rodarSmoke(`http://127.0.0.1:${port}`)

    // O veredito nao muda: copia velha na borda e problema real para quem visita.
    assert.equal(falhou, true, 'o smoke precisa continuar reprovando')

    assert.match(saida, /O SERVIDOR ESTÁ BOM/, 'precisa separar cache velho de site quebrado')
    assert.match(saida, /Purge Everything/, 'precisa dizer o que fazer')
    assert.doesNotMatch(saida, /A falha NÃO é da borda/)
  } finally {
    server.close()
  }
})

test('servidor realmente fora do ar: nao culpa a borda', async () => {
  const server = await new Promise(resolve => {
    const s = createServer((_req, res) => {
      res.writeHead(500, { 'content-type': 'text/html', 'cf-cache-status': 'HIT' })
      res.end('erro')
    })
    s.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address()
  try {
    const { falhou, saida } = await rodarSmoke(`http://127.0.0.1:${port}`)
    assert.equal(falhou, true)
    assert.match(saida, /A falha NÃO é da borda/)
    assert.doesNotMatch(saida, /O SERVIDOR ESTÁ BOM/)
  } finally {
    server.close()
  }
})

test('a limpeza do cache roda mesmo com o deploy vermelho', () => {
  const yaml = readFileSync(join(raiz, '.github', 'workflows', 'deploy.yml'), 'utf-8')
  const passo = yaml.split('- name: Purgar cache da Cloudflare')[1]
  assert.ok(passo, 'o passo de limpar o cache precisa existir')

  const condicao = passo.split('\n').find(linha => linha.trim().startsWith('if:'))
  assert.ok(condicao, 'o passo precisa ter condicao')

  // Sem isto o ciclo se fecha: copia velha reprova o deploy, e o deploy
  // reprovado nunca limpa a copia velha. Ver RCA 2026-09-10 no AGENTS.md.
  assert.match(condicao, /always\(\)/, 'a limpeza nao pode depender do deploy ter passado')
  assert.match(condicao, /refs\/heads\/main/, 'continua so em producao')
})
