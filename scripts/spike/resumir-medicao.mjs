#!/usr/bin/env node
// Fase 0 (feature 021) — resume a medição do telegram-leitor-spike.
// Lê memoria.csv, latencia.csv e eventos.log da pasta da medição e imprime o
// bloco de RESULTADO-MODELO.md. Nunca imprime id de canal, nome nem texto.
//
// Uso (dentro de ~/telegram-spike): node resumir-medicao.mjs [--pasta=<dir>]
// Sem dependências: roda com o Node do servidor, fora do repositório.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const LIMITE_CANAL_GRANDE = 1000;
const HORA_MS = 60 * 60 * 1000;
const AQUECIMENTO_MS = 30 * 60 * 1000;

export function lerCsv(texto) {
  const linhas = String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 0) return [];
  const cabecalho = linhas[0].split(',');
  return linhas.slice(1).map((linha) => {
    const campos = linha.split(',');
    return Object.fromEntries(cabecalho.map((nome, i) => [nome, campos[i] ?? '']));
  });
}

export function lerEventos(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((linha) => {
      try {
        return [JSON.parse(linha)];
      } catch {
        return [];
      }
    });
}

export function percentil(valores, p) {
  const ordenados = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (ordenados.length === 0) return null;
  const posicao = Math.ceil((p / 100) * ordenados.length) - 1;
  return ordenados[Math.min(Math.max(posicao, 0), ordenados.length - 1)];
}

const mediana = (valores) => percentil(valores, 50);
const numero = (v) => (v === '' || v == null ? NaN : Number(v));
const arredondar = (v, casas = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(casas)));

function amostrasMemoria(linhas) {
  return linhas
    .map((l) => ({
      momento: Date.parse(l.iso),
      rotulo: l.rotulo || '',
      contas: numero(l.contas),
      canais: numero(l.canais),
      rss: numero(l.rss_mb),
      swap: numero(l.swap_mb),
    }))
    .filter((a) => Number.isFinite(a.momento) && Number.isFinite(a.rss))
    .sort((a, b) => a.momento - b.momento);
}

function rssMedianoEm(amostras, contas, canais) {
  const doGrupo = amostras.filter((a) => a.contas === contas && a.canais === canais);
  return arredondar(mediana(doGrupo.map((a) => a.rss)));
}

function crescimentoNaEtapaLonga(amostras) {
  const porRotulo = new Map();
  for (const a of amostras) {
    if (!porRotulo.has(a.rotulo)) porRotulo.set(a.rotulo, []);
    porRotulo.get(a.rotulo).push(a);
  }
  const etapas = [...porRotulo.values()]
    .map((lista) => ({ lista, duracao: lista.at(-1).momento - lista[0].momento }))
    .filter((e) => e.duracao >= 20 * HORA_MS)
    .sort((a, b) => b.duracao - a.duracao);
  if (etapas.length === 0) return null;
  const { lista } = etapas[0];
  const inicio = lista[0].momento + AQUECIMENTO_MS;
  const primeiraHora = lista.filter((a) => a.momento >= inicio && a.momento < inicio + HORA_MS);
  const ultimaHora = lista.filter((a) => a.momento > lista.at(-1).momento - HORA_MS);
  const antes = mediana(primeiraHora.map((a) => a.rss));
  const depois = mediana(ultimaHora.map((a) => a.rss));
  if (antes == null || depois == null) return null;
  return { antes: arredondar(antes), depois: arredondar(depois), cresceu: depois > antes * 1.1 };
}

export function resumirMemoria(linhas) {
  const amostras = amostrasMemoria(linhas);
  if (amostras.length === 0) return { vazio: true };
  const maxContas = Math.max(...amostras.map((a) => a.contas).filter(Number.isFinite), 1);
  const repouso = rssMedianoEm(amostras, 1, 0);
  const com5 = rssMedianoEm(amostras, 1, 5);
  const com10 = rssMedianoEm(amostras, 1, 10);
  const comMaisContas = maxContas > 1 ? rssMedianoEm(amostras, maxContas, 0) : null;
  const incrementoPorConta =
    comMaisContas != null && repouso != null ? arredondar((comMaisContas - repouso) / (maxContas - 1), 1) : null;
  const incrementoPorCanal = com10 != null && repouso != null ? arredondar((com10 - repouso) / 10, 1) : null;
  const swaps = amostras.map((a) => a.swap).filter(Number.isFinite);
  return {
    vazio: false,
    repouso,
    com5,
    com10,
    maxContas,
    rssMaximo: arredondar(Math.max(...amostras.map((a) => a.rss))),
    incrementoPorConta,
    incrementoPorCanal,
    crescimento: crescimentoNaEtapaLonga(amostras),
    swapAntes: swaps.length ? arredondar(swaps[0]) : null,
    swapDepois: swaps.length ? arredondar(swaps.at(-1)) : null,
  };
}

export function resumirLatencia(linhas) {
  const porTamanho = { grande: [], pequeno: [] };
  for (const l of linhas) {
    const atraso = numero(l.atraso_ms);
    const tamanho = numero(l.tamanhoCanal);
    if (!Number.isFinite(atraso) || !Number.isFinite(tamanho)) continue;
    porTamanho[tamanho >= LIMITE_CANAL_GRANDE ? 'grande' : 'pequeno'].push(atraso / 1000);
  }
  const resumo = (lista) => ({
    mensagens: lista.length,
    mediana: arredondar(mediana(lista), 1),
    p95: arredondar(percentil(lista, 95), 1),
  });
  return { grande: resumo(porTamanho.grande), pequeno: resumo(porTamanho.pequeno) };
}

export function resumirEventos(eventos) {
  const esperas = eventos.filter((e) => e.tipo === 'flood_wait');
  const formas = [...new Set(eventos.filter((e) => e.tipo === 'autor').map((e) => String(e.forma || '').split(' ')[0]))]
    .filter(Boolean)
    .sort();
  return {
    floodWaits: esperas.length,
    floodSegundos: esperas.reduce((total, e) => total + (Number(e.segundos) || 0), 0),
    floodMaior: esperas.reduce((maior, e) => Math.max(maior, Number(e.segundos) || 0), 0),
    formasDeAutor: formas,
  };
}

const ou = (valor, sufixo = '') => (valor == null ? '___ (não medido)' : `${valor}${sufixo}`);

export function montarResultado({ memoria, latencia, eventos, data }) {
  const m = memoria.vazio ? {} : memoria;
  const item4 =
    m.maxContas > 1
      ? `${ou(m.rssMaximo, ' MB')} (${m.maxContas} contas)`
      : `${ou(m.rssMaximo, ' MB')} (1 conta — incremento por conta extrapolado, HIPÓTESE)`;
  const cresceu = m.crescimento
    ? `${m.crescimento.cresceu ? 'sim' : 'não'} (${m.crescimento.antes} → ${m.crescimento.depois} MB)`
    : '___ (sem etapa de 24 h)';
  const swapMudou =
    m.swapAntes == null ? '___ (não medido)' : `${m.swapAntes === m.swapDepois ? 'não' : 'sim'} (${m.swapAntes} → ${m.swapDepois} MB)`;
  const lat = (r) => (r.mensagens === 0 ? '___ s / ___ s (sem mensagens)' : `${r.mediana} s / ${r.p95} s (${r.mensagens} msgs)`);
  const flood = eventos.floodWaits === 0
    ? 'não'
    : `sim (${eventos.floodWaits} vezes, ${eventos.floodSegundos} s no total, maior ${eventos.floodMaior} s)`;
  const autor = eventos.formasDeAutor.length ? eventos.formasDeAutor.join(' / ') : '___ (não medido)';
  return [
    `RESULTADO FASE 0 — ${data}`,
    `1. RAM em repouso (0 canais, 1 conta):      ${ou(m.repouso, ' MB')}`,
    `2. RAM com 5 canais (1 conta):              ${ou(m.com5, ' MB')}`,
    `3. RAM com 10 canais (1 conta):             ${ou(m.com10, ' MB')}`,
    `4. RAM máxima em 24 h:                      ${item4}   | cresceu ao longo do dia? ${cresceu}`,
    `   (por canal: ${ou(m.incrementoPorCanal, ' MB')} · por conta: ${ou(m.incrementoPorConta, ' MB')})`,
    `5. Swap do servidor mudou? ${swapMudou}`,
    `6. Atraso da mensagem (mediana / p95): canal grande ${lat(latencia.grande)} · grupo pequeno ${lat(latencia.pequeno)}`,
    '7. A conta de teste apareceu "online" para outras pessoas? ___ (preencher)',
    '8. As mensagens do canal ficaram "vistas" (visualizações subiram)? ___ (preencher)',
    `9. Apareceu pedido de espera do Telegram (FLOOD_WAIT)? ${flood}`,
    `10. Publicação do robô no canal de teste: autor aparece como ${autor}`,
    '11. Regras de uso da API do Telegram: li core.telegram.org/api/terms e o uso (só leitura, conta da própria cliente) está ok? ___ (preencher)',
    '12. Algum aviso do Telegram na conta de teste (e-mail/SMS/aviso de login)? ___ (preencher)',
  ].join('\n');
}

const lerSeExiste = (caminho) => (existsSync(caminho) ? readFileSync(caminho, 'utf8') : '');

export function resumirPasta(pasta, data = new Date().toISOString().slice(0, 10)) {
  return montarResultado({
    memoria: resumirMemoria(lerCsv(lerSeExiste(join(pasta, 'memoria.csv')))),
    latencia: resumirLatencia(lerCsv(lerSeExiste(join(pasta, 'latencia.csv')))),
    eventos: resumirEventos(lerEventos(lerSeExiste(join(pasta, 'eventos.log')))),
    data,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argPasta = process.argv.find((a) => a.startsWith('--pasta='));
  const pasta = argPasta ? argPasta.slice('--pasta='.length) : process.env.SPIKE_DIR || join(homedir(), 'telegram-spike');
  console.log(resumirPasta(pasta));
}
