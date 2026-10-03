import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lerCsv,
  percentil,
  resumirEventos,
  resumirLatencia,
  resumirMemoria,
  resumirPasta,
} from '../scripts/spike/resumir-medicao.mjs';

const CANAL_SECRETO = '-1001234567890';
const TEXTO_SECRETO = 'oferta-secreta-da-cliente';

function linhaMemoria(minutos, rotulo, contas, canais, rss, swap = 100) {
  const iso = new Date(Date.UTC(2026, 9, 3, 0, 0) + minutos * 60_000).toISOString();
  return `${iso},${rotulo},${contas},${canais},${rss},40,10,${swap}`;
}

function memoriaCsv() {
  const linhas = ['iso,rotulo,contas,canais,rss_mb,heap_mb,external_mb,swap_mb'];
  for (let m = 0; m < 60; m += 5) linhas.push(linhaMemoria(m, 'repouso', 1, 0, 100));
  for (let m = 60; m < 180; m += 5) linhas.push(linhaMemoria(m, '5canais', 1, 5, 110));
  for (let m = 180; m < 300; m += 5) linhas.push(linhaMemoria(m, '10canais', 1, 10, 120));
  for (let m = 300; m < 300 + 24 * 60; m += 5) {
    const rss = m > 300 + 23 * 60 ? 170 : 140;
    linhas.push(linhaMemoria(m, '3contas-24h', 3, 0, rss, m > 400 ? 120 : 100));
  }
  return linhas.join('\n');
}

function latenciaCsv() {
  const linhas = ['iso,canalId,tamanhoCanal,msg_date,recebido_em,atraso_ms'];
  for (let i = 1; i <= 20; i += 1) linhas.push(`2026-10-03T00:00:00Z,${CANAL_SECRETO},50000,0,0,${i * 1000}`);
  for (let i = 1; i <= 10; i += 1) linhas.push(`2026-10-03T00:00:00Z,-1009,30,0,0,${i * 500}`);
  return linhas.join('\n');
}

function eventosLog() {
  return [
    { tipo: 'mensagem', canalId: CANAL_SECRETO, formato: 'texto', tamanhoTexto: 120 },
    { tipo: 'flood_wait', operacao: 'getDialogs', segundos: 12 },
    { tipo: 'flood_wait', operacao: 'getDialogs', segundos: 30 },
    { tipo: 'autor', canalId: CANAL_SECRETO, forma: 'canal' },
    { tipo: 'autor', canalId: CANAL_SECRETO, forma: 'usuário 123…456 via-robô' },
    { tipo: 'mensagem', texto: TEXTO_SECRETO },
  ]
    .map((e) => JSON.stringify(e))
    .concat('linha quebrada {')
    .join('\n');
}

test('percentil usa posição por ordem (nearest-rank) e ignora vazios', () => {
  assert.equal(percentil([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(percentil([], 50), null);
});

test('memória: repouso, 5 e 10 canais, incrementos, máximo, crescimento e swap', () => {
  const r = resumirMemoria(lerCsv(memoriaCsv()));
  assert.equal(r.repouso, 100);
  assert.equal(r.com5, 110);
  assert.equal(r.com10, 120);
  assert.equal(r.incrementoPorCanal, 2);
  assert.equal(r.maxContas, 3);
  assert.equal(r.incrementoPorConta, 20);
  assert.equal(r.rssMaximo, 170);
  assert.deepEqual(r.crescimento, { antes: 140, depois: 170, cresceu: true });
  assert.equal(r.swapAntes, 100);
  assert.equal(r.swapDepois, 120);
});

test('memória sem segunda conta não inventa incremento por conta', () => {
  const csv = memoriaCsv().split('\n').filter((l) => !l.includes('3contas')).join('\n');
  const r = resumirMemoria(lerCsv(csv));
  assert.equal(r.maxContas, 1);
  assert.equal(r.incrementoPorConta, null);
  assert.equal(r.crescimento, null);
});

test('latência: mediana e p95 por tamanho de canal, em segundos', () => {
  const r = resumirLatencia(lerCsv(latenciaCsv()));
  assert.deepEqual(r.grande, { mensagens: 20, mediana: 10, p95: 19 });
  assert.deepEqual(r.pequeno, { mensagens: 10, mediana: 2.5, p95: 5 });
});

test('eventos: conta FLOOD_WAIT e resume só a forma do autor', () => {
  const lerEventosLinhas = eventosLog().split('\n').flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });
  const r = resumirEventos(lerEventosLinhas);
  assert.equal(r.floodWaits, 2);
  assert.equal(r.floodSegundos, 42);
  assert.equal(r.floodMaior, 30);
  assert.deepEqual(r.formasDeAutor, ['canal', 'usuário']);
});

test('resultado final segue o modelo e nunca mostra id de canal nem texto', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'spike-'));
  writeFileSync(join(pasta, 'memoria.csv'), memoriaCsv());
  writeFileSync(join(pasta, 'latencia.csv'), latenciaCsv());
  writeFileSync(join(pasta, 'eventos.log'), eventosLog());
  const saida = resumirPasta(pasta, '2026-10-03');
  assert.match(saida, /^RESULTADO FASE 0 — 2026-10-03/);
  for (let item = 1; item <= 12; item += 1) assert.match(saida, new RegExp(`\\n${item}\\. `));
  assert.match(saida, /1\. RAM em repouso \(0 canais, 1 conta\):\s+100 MB/);
  assert.match(saida, /9\. .*sim \(2 vezes, 42 s no total, maior 30 s\)/);
  assert.match(saida, /10\. .*canal \/ usuário/);
  assert.ok(!saida.includes(CANAL_SECRETO));
  assert.ok(!saida.includes('-1009'));
  assert.ok(!saida.includes(TEXTO_SECRETO));
  assert.ok(!saida.includes('123'));
});

test('pasta vazia gera o bloco com "não medido", sem quebrar', () => {
  const saida = resumirPasta(mkdtempSync(join(tmpdir(), 'spike-vazio-')), '2026-10-03');
  assert.match(saida, /1\. RAM em repouso .*não medido/);
  assert.match(saida, /9\. .*não$/m);
});
