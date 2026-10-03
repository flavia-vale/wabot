import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();

test('package.json e package-lock.json do repo não têm a dependência telegram (PR-0 é isolado)', () => {
  const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  for (const campo of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.ok(!pacote[campo]?.telegram, `telegram em ${campo}`);
  }
  const lock = JSON.parse(readFileSync(join(RAIZ, 'package-lock.json'), 'utf8'));
  assert.ok(!lock.packages?.['node_modules/telegram'], 'telegram no package-lock.json');
});

function arquivosJs(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    if (nome === 'node_modules' || nome === '.next') return [];
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosJs(caminho);
    return /\.(c|m)?jsx?$/.test(nome) ? [caminho] : [];
  });
}

test('nada em src/ ou dashboard/ importa scripts/spike/', () => {
  const culpados = ['src', 'dashboard']
    .flatMap((pasta) => arquivosJs(join(RAIZ, pasta)))
    .filter((arquivo) => /scripts\/spike\//.test(readFileSync(arquivo, 'utf8')));
  assert.deepEqual(culpados, []);
});

test('package.spike.json fixa versões exatas e não se chama package.json', () => {
  const spike = JSON.parse(readFileSync(join(RAIZ, 'scripts/spike/package.spike.json'), 'utf8'));
  assert.ok(spike.dependencies.telegram, 'falta a dependência telegram');
  for (const [nome, versao] of Object.entries(spike.dependencies)) {
    assert.match(versao, /^\d+\.\d+\.\d+$/, `${nome} sem versão exata: ${versao}`);
  }
  assert.throws(() => statSync(join(RAIZ, 'scripts/spike/package.json')));
});

test('o leitor da medição não chama nada que escreve no Telegram', () => {
  const codigo = readFileSync(join(RAIZ, 'scripts/spike/telegram-leitor-spike.mjs'), 'utf8');
  const proibidos = [
    'sendMessage', 'sendFile', 'forwardMessages', 'markAsRead', 'readHistory', 'ReadHistory',
    'joinChannel', 'JoinChannel', 'ImportChatInvite', 'leaveChannel', 'LeaveChannel',
    'deleteMessages', 'UpdateStatus', 'GetMessagesViews',
  ];
  assert.deepEqual(proibidos.filter((nome) => codigo.includes(nome)), []);
  assert.match(codigo, /LogLevel\.NONE/);
  assert.match(codigo, /floodSleepThreshold: 0/);
});
