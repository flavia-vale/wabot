import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSmaps, findGlibcArenas, summarizeSmaps, REGION_KINDS, GLIBC_ARENA_SIZE_BYTES } from '../src/ops/memory/smapsBreakdown.js'

// Trechos reais de /proc/<pid>/smaps (Linux 6.x, glibc). O bloco de arena vem
// quebrado em duas linhas — a parte comprometida e o resto reservado — que é
// exatamente como o glibc mapeia HEAP_MAX_SIZE.
const SMAPS = [
  '55a1c0000000-55a1c6400000 rw-p 00000000 00:00 0                          [heap]',
  'Size:             102400 kB',
  'Rss:               53900 kB',
  'Pss:               53900 kB',
  '7f2000000000-7f2000200000 rw-p 00000000 00:00 0 ',
  'Size:               2048 kB',
  'Rss:                1024 kB',
  'Pss:                1024 kB',
  '7f2000200000-7f2004000000 ---p 00000000 00:00 0 ',
  'Size:              63488 kB',
  'Rss:                   0 kB',
  'Pss:                   0 kB',
  '7f2004000000-7f2004100000 rw-p 00000000 00:00 0 ',
  'Size:               1024 kB',
  'Rss:                 512 kB',
  'Pss:                 512 kB',
  '7f2004100000-7f2008000000 ---p 00000000 00:00 0 ',
  'Size:              64512 kB',
  'Rss:                   0 kB',
  'Pss:                   0 kB',
  '7f3000000000-7f3010000000 rw-p 00000000 00:00 0 ',
  'Size:             262144 kB',
  'Rss:              120000 kB',
  'Pss:              120000 kB',
  '7f4000000000-7f4000a00000 r-xp 00000000 fd:01 1234               /usr/lib/x86_64-linux-gnu/libvips.so.42',
  'Size:              10240 kB',
  'Rss:               10240 kB',
  'Pss:                 240 kB',
  '7ffd00000000-7ffd00021000 rw-p 00000000 00:00 0                          [stack]',
  'Size:                132 kB',
  'Rss:                 132 kB',
  'Pss:                 132 kB',
  '',
].join('\n')

test('parseSmaps lê cabeçalho, permissões, caminho e os três tamanhos', () => {
  const regions = parseSmaps(SMAPS)
  assert.equal(regions.length, 8)
  assert.equal(regions[0].path, '[heap]')
  assert.equal(regions[0].rss, 53900 * 1024)
  assert.equal(regions[0].perms, 'rw-p')
  assert.equal(regions[7].path, "[stack]")
})

test('parseSmaps ignora campo desconhecido em vez de quebrar', () => {
  // O formato ganha campos novos a cada versão de kernel. Quebrar por causa
  // disso deixaria o instrumento inútil justamente num servidor atualizado.
  const comCampoNovo = SMAPS.replace('Rss:               53900 kB', 'CampoNovoDoKernel: 999 kB\nRss:               53900 kB')
  const regions = parseSmaps(comCampoNovo)
  assert.equal(regions[0].rss, 53900 * 1024)
})

test('findGlibcArenas reconhece o bloco de 64 MiB alinhado e soma as duas partes', () => {
  const arenas = findGlibcArenas(parseSmaps(SMAPS))
  assert.equal(arenas.length, 2)
  for (const arena of arenas) assert.equal(arena.size, GLIBC_ARENA_SIZE_BYTES)
  assert.equal(arenas[0].pss, 1024 * 1024)
  assert.equal(arenas[1].pss, 512 * 1024)
})

test('bloco anônimo grande que não soma 64 MiB NÃO é contado como arena', () => {
  // Sem isso, o heap do V8 caindo num endereço alinhado viraria "fragmentação
  // do alocador" e mandaria a investigação para o lado errado.
  const arenas = findGlibcArenas(parseSmaps(SMAPS))
  const bases = arenas.map((a) => a.base)
  assert.ok(!bases.includes(0x7f3000000000), 'região de 256 MiB não pode virar arena')
})

test('summarizeSmaps separa arena, heap principal, anônimo e biblioteca', () => {
  const resumo = summarizeSmaps(SMAPS)
  const kinds = Object.fromEntries(resumo.byKind.map((k) => [k.kind, k]))
  assert.equal(kinds[REGION_KINDS.MAIN_HEAP].pss, 53900 * 1024)
  assert.equal(kinds[REGION_KINDS.ANON].pss, 120000 * 1024)
  assert.equal(kinds[REGION_KINDS.GLIBC_ARENA].pss, (1024 + 512) * 1024)
  assert.equal(kinds[REGION_KINDS.SHARED_LIB].pss, 240 * 1024)
  assert.equal(kinds[REGION_KINDS.STACK].pss, 132 * 1024)
  assert.equal(resumo.arenas.count, 2)
  assert.equal(resumo.arenas.reserved, 2 * GLIBC_ARENA_SIZE_BYTES)
})

test('PSS e RSS são somados separados — RSS não serve para somar processos', () => {
  // Armadilha registrada na revisão da POC de shard: RSS conta a mesma página
  // compartilhada uma vez por processo e superestima a economia de consolidar.
  const resumo = summarizeSmaps(SMAPS)
  assert.ok(resumo.totalRss > resumo.totalPss)
  const lib = resumo.topLibs[0]
  assert.equal(lib.name, 'libvips.so.42')
  assert.ok(lib.rss > lib.pss)
})

test('entrada vazia ou inválida devolve resumo zerado, nunca lança', () => {
  for (const entrada of ['', null, undefined, 'lixo\nsem formato']) {
    const resumo = summarizeSmaps(entrada)
    assert.equal(resumo.totalPss, 0)
    assert.equal(resumo.arenas.count, 0)
  }
})
