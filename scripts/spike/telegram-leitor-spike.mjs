#!/usr/bin/env node
// ⚠️ SÓ LEITURA. Fase 0 (feature 021) — medição isolada do leitor do Telegram.
// Roda em ~/telegram-spike no VPS de staging, FORA do repositório, com
// package.json próprio (copiado de package.spike.json). Nunca envia mensagem,
// nunca marca como lida, nunca entra nem sai de grupo/canal.
//
// Modos:
//   --login --conta=<apelido>     login por QR; grava sessions/<apelido>.session (chmod 600)
//   --listar --conta=<apelido>    lista só grupos/canais e grava a escolha em canais.txt
//   --ler [--rotulo=<etapa>] [--autor-do-robo]   ouve só os chats de canais.txt (modo do PM2)
//   --custo-prisma                mede o RSS antes/depois de carregar @prisma/client
//
// Saídas (na pasta da medição): memoria.csv, latencia.csv, eventos.log.
// Nenhuma saída guarda texto de mensagem, telefone, sessão ou chave.

import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const PASTA = process.env.SPIKE_DIR || join(homedir(), 'telegram-spike');
const PASTA_SESSOES = join(PASTA, 'sessions');
const ARQ_CANAIS = join(PASTA, 'canais.txt');
const ARQ_ROTULO = join(PASTA, 'ROTULO');
const ARQ_MEMORIA = join(PASTA, 'memoria.csv');
const ARQ_LATENCIA = join(PASTA, 'latencia.csv');
const ARQ_EVENTOS = join(PASTA, 'eventos.log');
const INTERVALO_MEMORIA_MS = 5 * 60 * 1000;

const args = process.argv.slice(2);
const temFlag = (nome) => args.includes(`--${nome}`);
const valorDe = (nome) => {
  const achado = args.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : null;
};

const exigir = createRequire(join(PASTA, 'package.json'));
const carregarTelegram = () => {
  const tg = exigir('telegram');
  const { StringSession } = exigir('telegram/sessions/index.js');
  const { NewMessage } = exigir('telegram/events/index.js');
  const { Logger, LogLevel } = exigir('telegram/extensions/Logger.js');
  return { tg, StringSession, NewMessage, Logger, LogLevel };
};

function lerEnv() {
  const caminho = join(PASTA, '.env');
  if (!existsSync(caminho)) throw new Error(`Falta o arquivo ${caminho} (TELEGRAM_API_ID e TELEGRAM_API_HASH).`);
  const valores = Object.fromEntries(
    readFileSync(caminho, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
  );
  const apiId = Number(valores.TELEGRAM_API_ID);
  const apiHash = valores.TELEGRAM_API_HASH;
  if (!Number.isInteger(apiId) || !apiHash) throw new Error('TELEGRAM_API_ID ou TELEGRAM_API_HASH ausente/ inválido no .env.');
  return { apiId, apiHash };
}

const registrarEvento = (evento) => appendFileSync(ARQ_EVENTOS, `${JSON.stringify({ hora: new Date().toISOString(), ...evento })}\n`);

function anexarCsv(caminho, cabecalho, valores) {
  if (!existsSync(caminho)) writeFileSync(caminho, `${cabecalho}\n`);
  appendFileSync(caminho, `${valores.join(',')}\n`);
}

function novoCliente(sessao = '') {
  const { tg, StringSession, Logger, LogLevel } = carregarTelegram();
  const { apiId, apiHash } = lerEnv();
  return new tg.TelegramClient(new StringSession(sessao), apiId, apiHash, {
    baseLogger: new Logger(LogLevel.NONE),
    floodSleepThreshold: 0,
    connectionRetries: 5,
  });
}

function segundosDeEspera(erro) {
  const { tg } = carregarTelegram();
  if (erro instanceof tg.errors.FloodWaitError) return erro.seconds;
  const achado = /FLOOD_WAIT_(\d+)/.exec(String(erro?.errorMessage || erro?.message || ''));
  return achado ? Number(achado[1]) : null;
}

async function chamar(operacao, fn) {
  try {
    return await fn();
  } catch (erro) {
    const segundos = segundosDeEspera(erro);
    if (segundos == null) throw erro;
    registrarEvento({ tipo: 'flood_wait', operacao, segundos });
    console.log(`O Telegram pediu para esperar ${segundos} s em "${operacao}". Não repita antes disso.`);
    return null;
  }
}

function perguntar(texto, { oculto = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (oculto) rl._writeToOutput = (s) => rl.output.write(s.includes(texto) ? s : '');
  return new Promise((resolve) =>
    rl.question(texto, (resposta) => {
      rl.close();
      if (oculto) process.stdout.write('\n');
      resolve(resposta);
    }),
  );
}

function apelidoObrigatorio() {
  const apelido = valorDe('conta');
  if (!apelido || !/^[a-z0-9_-]{1,30}$/i.test(apelido)) throw new Error('Informe --conta=<apelido> (letras, números, - ou _).');
  return apelido;
}

const caminhoSessao = (apelido) => join(PASTA_SESSOES, `${apelido}.session`);

async function conectarSessao(apelido) {
  const caminho = caminhoSessao(apelido);
  if (!existsSync(caminho)) throw new Error(`Sessão "${apelido}" não existe. Rode --login --conta=${apelido} antes.`);
  const cliente = novoCliente(readFileSync(caminho, 'utf8').trim());
  await cliente.connect();
  if (!(await cliente.checkAuthorization())) throw new Error(`Sessão "${apelido}" foi encerrada no Telegram. Faça o login de novo.`);
  return cliente;
}

async function modoLogin() {
  const apelido = apelidoObrigatorio();
  mkdirSync(PASTA_SESSOES, { recursive: true, mode: 0o700 });
  const qrcode = exigir('qrcode-terminal');
  const cliente = novoCliente();
  await cliente.connect();
  const usuario = await cliente.signInUserWithQrCode(
    { apiId: cliente.apiId, apiHash: cliente.apiHash },
    {
      qrCode: async ({ token }) => {
        console.log('\nNo celular: Telegram → Configurações → Dispositivos → Conectar dispositivo → leia o QR abaixo.');
        qrcode.generate(`tg://login?token=${token.toString('base64url')}`, { small: true });
      },
      password: async () => perguntar('Senha de duas etapas da conta (não aparece na tela): ', { oculto: true }),
      onError: async (erro) => {
        console.log(`Erro no login: ${erro?.errorMessage || erro?.message || 'desconhecido'}`);
        return true;
      },
    },
  );
  writeFileSync(caminhoSessao(apelido), cliente.session.save(), { mode: 0o600 });
  chmodSync(caminhoSessao(apelido), 0o600);
  console.log(`conectada como ${usuario?.firstName || 'conta sem nome'}`);
  await cliente.disconnect();
}

async function modoListar() {
  const apelido = apelidoObrigatorio();
  const cliente = await conectarSessao(apelido);
  const conversas = (await chamar('getDialogs', () => cliente.getDialogs({}))) || [];
  const grupos = conversas.filter((d) => (d.isGroup || d.isChannel) && !d.isUser);
  if (grupos.length === 0) {
    console.log('Nenhum grupo ou canal encontrado. Entre em algum pelo aplicativo do Telegram e rode de novo.');
    await cliente.disconnect();
    return;
  }
  grupos.forEach((d, i) => {
    const tipo = d.isChannel && !d.isGroup ? 'canal' : 'grupo';
    const membros = d.entity?.participantsCount ?? '?';
    console.log(`${String(i + 1).padStart(3)}. [${tipo}] ${d.title || d.name || 'sem nome'} — membros: ${membros}`);
  });
  const resposta = await perguntar('\nNúmeros para medir, separados por vírgula (vazio = nenhum, mede repouso): ');
  const escolhidos = resposta
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= grupos.length)
    .map((n) => String(grupos[n - 1].id));
  writeFileSync(ARQ_CANAIS, escolhidos.length ? `${[...new Set(escolhidos)].join('\n')}\n` : '');
  console.log(`canais.txt gravado com ${new Set(escolhidos).size} chat(s).`);
  await cliente.disconnect();
}

const lerCanais = () =>
  existsSync(ARQ_CANAIS)
    ? new Set(readFileSync(ARQ_CANAIS, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
    : new Set();

function swapUsadoMb() {
  try {
    const info = readFileSync('/proc/meminfo', 'utf8');
    const kb = (nome) => Number(new RegExp(`^${nome}:\\s+(\\d+)`, 'm').exec(info)?.[1] || 0);
    return Math.round((kb('SwapTotal') - kb('SwapFree')) / 1024);
  } catch {
    return '';
  }
}

function rotuloAtual() {
  if (existsSync(ARQ_ROTULO)) {
    const doArquivo = readFileSync(ARQ_ROTULO, 'utf8').trim().replace(/[^\w.-]/g, '_');
    if (doArquivo) return doArquivo;
  }
  return (valorDe('rotulo') || 'sem-rotulo').replace(/[^\w.-]/g, '_');
}

function amostrarMemoria(contas, canais) {
  const mb = (bytes) => Math.round(bytes / 1024 / 1024);
  const uso = process.memoryUsage();
  anexarCsv(ARQ_MEMORIA, 'iso,rotulo,contas,canais,rss_mb,heap_mb,external_mb,swap_mb', [
    new Date().toISOString(),
    rotuloAtual(),
    contas,
    canais,
    mb(uso.rss),
    mb(uso.heapUsed),
    mb(uso.external),
    swapUsadoMb(),
  ]);
}

function formaDoAutor(mensagem) {
  const truncar = (id) => {
    const s = String(id);
    return s.length > 6 ? `${s.slice(0, 3)}…${s.slice(-3)}` : '…';
  };
  const de = mensagem.fromId;
  if (!de) return mensagem.post ? 'canal (post sem remetente)' : 'desconhecido';
  if (de.className === 'PeerChannel') return 'canal';
  if (de.className === 'PeerUser') return `usuário ${truncar(de.userId)}${mensagem.viaBotId ? ' via-robô' : ''}`;
  if (de.className === 'PeerChat') return 'grupo';
  return 'outro';
}

async function tamanhosDosCanais(cliente, canais) {
  const { tg } = carregarTelegram();
  const tamanhos = new Map();
  const conversas = (await chamar('getDialogs', () => cliente.getDialogs({}))) || [];
  for (const d of conversas) {
    const id = String(d.id);
    if (!canais.has(id)) continue;
    let membros = d.entity?.participantsCount ?? null;
    if (membros == null && d.isChannel) {
      const completo = await chamar('GetFullChannel', () => cliente.invoke(new tg.Api.channels.GetFullChannel({ channel: d.entity })));
      membros = completo?.fullChat?.participantsCount ?? null;
    }
    tamanhos.set(id, membros);
  }
  return tamanhos;
}

async function modoLer() {
  const { NewMessage } = carregarTelegram();
  const canais = lerCanais();
  const apelidos = existsSync(PASTA_SESSOES)
    ? readdirSync(PASTA_SESSOES).filter((f) => f.endsWith('.session')).map((f) => f.slice(0, -'.session'.length))
    : [];
  if (apelidos.length === 0) throw new Error('Nenhuma sessão em sessions/. Rode --login primeiro.');
  const registrarAutor = temFlag('autor-do-robo');
  const clientes = [];
  for (const apelido of apelidos) {
    const cliente = await conectarSessao(apelido);
    const tamanhos = await tamanhosDosCanais(cliente, canais);
    cliente.addEventHandler((evento) => {
      const mensagem = evento.message;
      const canalId = String(mensagem?.chatId ?? '');
      if (!canais.has(canalId)) return;
      const recebidoEm = Date.now();
      const enviadoEm = Number(mensagem.date) * 1000;
      const tipo = mensagem.media ? mensagem.media.className : 'texto';
      registrarEvento({ tipo: 'mensagem', canalId, formato: tipo, tamanhoTexto: (mensagem.message || '').length });
      anexarCsv(ARQ_LATENCIA, 'iso,canalId,tamanhoCanal,msg_date,recebido_em,atraso_ms', [
        new Date(recebidoEm).toISOString(),
        canalId,
        tamanhos.get(canalId) ?? '',
        enviadoEm,
        recebidoEm,
        recebidoEm - enviadoEm,
      ]);
      if (registrarAutor) registrarEvento({ tipo: 'autor', canalId, forma: formaDoAutor(mensagem) });
    }, new NewMessage({}));
    clientes.push(cliente);
  }
  const amostrar = () => amostrarMemoria(clientes.length, canais.size);
  console.log(`Lendo ${canais.size} chat(s) com ${clientes.length} conta(s). Rótulo: ${rotuloAtual()}. Só leitura.`);
  amostrar();
  const relogio = setInterval(amostrar, INTERVALO_MEMORIA_MS);
  process.on('SIGUSR2', amostrar);
  const encerrar = async () => {
    clearInterval(relogio);
    await Promise.allSettled(clientes.map((c) => c.disconnect()));
    process.exit(0);
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

async function modoCustoPrisma() {
  const antes = process.memoryUsage().rss;
  let PrismaClient;
  try {
    ({ PrismaClient } = exigir('@prisma/client'));
  } catch {
    console.log('custo do Prisma: não medido (@prisma/client não instalado em ~/telegram-spike)');
    return;
  }
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
  } catch {
    // sem banco configurado: mede só o carregamento do cliente
  }
  const depois = process.memoryUsage().rss;
  console.log(`custo do Prisma: +${Math.round((depois - antes) / 1024 / 1024)} MB de RSS`);
  await prisma.$disconnect().catch(() => {});
}

async function principal() {
  mkdirSync(PASTA, { recursive: true });
  if (temFlag('login')) return modoLogin();
  if (temFlag('listar')) return modoListar();
  if (temFlag('custo-prisma')) return modoCustoPrisma();
  if (temFlag('ler')) return modoLer();
  console.log('Use --login, --listar, --ler ou --custo-prisma. Veja PASSO-A-PASSO-DONA.md.');
}

principal().catch((erro) => {
  console.error(`Parou: ${erro?.errorMessage || erro?.message || 'erro desconhecido'}`);
  process.exit(1);
});
