// Diagnóstico "por que esta cliente não consegue conectar o WhatsApp" (PURO, sem banco).
//
// Fonte única das regras de scripts/diag-nao-conecta.mjs (que importa daqui) e
// de GET /api/admin/users/:id/diagnostico/conexao (aba Robô da ficha).
// Só recebe o que veio do banco/Redis/disco da credencial — NUNCA o bot.log.
//
// Cada elo devolve { id, titulo, ok, frases[], acoes[] }: o que está errado e o
// que fazer, em frase leiga (sem 405/socket/handshake na tela). A primeira
// causa que falha é o veredito. As causas pedem ações OPOSTAS (não misturar):
//   conta   -> renovar acesso        vaga       -> abrir vaga no servidor
//   tela    -> QR não foi lido       whatsapp   -> versão recusada / timeout / sessão encerrada
//   credencial -> pareamento interrompido
import { isHeartbeatFresh } from '../../session/sessionLiveness.js'

export const CONEXAO_ELOS = ['conta', 'vaga', 'tela', 'whatsapp', 'credencial']

const QR_MOSTRADO = new Set(['qr_rendered', 'qr_received', 'qr_received_polling_fallback'])
const QR_PAREOU = new Set(['qr_scanned', 'connected', 'session_connected', 'pairing_code_received'])
const QR_VENCEU = new Set(['qr_timeout_25s', 'connect_abandoned', 'possible_abandon'])

const elo = (id, titulo, itens) => ({
  id,
  titulo,
  ok: itens.length === 0,
  frases: itens.map(i => i.problema),
  acoes: itens.map(i => i.acao),
})

const ms = d => (d ? new Date(d).getTime() : 0)

export function diagnoseConexao({
  nowMs = Date.now(),
  days = 3,
  user = {},
  session = null,
  eventos = [], // WaConnectionEvent da janela: { type, code, occurredAt }
  tela = [], // telemetria da tela dela: { event, at } (qualquer ordem)
  credencial = null, // { existe, backupPareamento } | null (= não consegui olhar o disco)
  vagas = {}, // { recusasDela, recusasServidor, limite }
  versaoRecusadaServidor = 0, // ops_wa_version_rejected na janela, todas as contas
  workerRunning = null,
} = {}) {
  const conectada = session?.status === 'connected'
  const codigo = String(session?.lastDisconnectCode || '')
  const eventosOrd = [...eventos].sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt))
  const telaOrd = [...tela].sort((a, b) => ms(a.at) - ms(b.at))
  const nuncaConectou = !session && !eventosOrd.length && !telaOrd.length && !credencial?.existe

  // 1. conta
  const conta = []
  if (user.status && user.status !== 'active') {
    conta.push({ problema: `A conta está "${user.status}" (não ativa): o robô não sobe.`, acao: 'Reativar a conta antes de qualquer outra coisa.' })
  }
  if (user.accessExpiresAt && new Date(user.accessExpiresAt).getTime() <= nowMs) {
    conta.push({ problema: 'O acesso desta conta venceu: o robô sobe, vê o vencimento e desliga.', acao: 'É caso de renovação, não de conexão. Conferir a aba Financeiro.' })
  }

  // 2. vaga no servidor
  const vaga = []
  if (!conectada && Number(vagas.recusasDela) > 0) {
    vaga.push({
      problema: `O servidor recusou ligar o robô dela ${vagas.recusasDela} vez(es) na janela: não havia vaga.`,
      acao: 'Abrir vaga (ver capacidade em Operação) e pedir para ela tentar de novo. Parear de novo não adianta.',
    })
  }

  // 3. tela dela (funil de cliques)
  const tel = []
  if (nuncaConectou) {
    tel.push({ problema: 'A cliente nunca conectou o WhatsApp neste ambiente: não há sessão, evento nem tentativa na tela.', acao: 'Pedir para ela abrir "Conectar WhatsApp" e ler o QR. Se disser que tentou, a tela nem chegou a chamar o servidor.' })
  } else if (!conectada && telaOrd.length) {
    const nomes = telaOrd.map(t => t.event)
    const ultQr = nomes.findLastIndex(n => QR_MOSTRADO.has(n))
    const pareouDepois = ultQr >= 0 && nomes.slice(ultQr).some(n => QR_PAREOU.has(n))
    const venceu = nomes.slice(Math.max(ultQr, 0)).some(n => QR_VENCEU.has(n))
    const clicou = nomes.some(n => n === 'connect_click' || n === 'retry_click' || n === 'restart_click')
    const ligou = nomes.includes('service_start_ok')
    if (ultQr >= 0 && !pareouDepois && venceu) {
      tel.push({ problema: 'O QR apareceu na tela, mas venceu sem ser lido (ou ela desistiu).', acao: 'Pedir para clicar em "Tentar de novo", deixar o celular pronto (WhatsApp > Aparelhos conectados) e ler na hora. Pode usar o código de pareamento no lugar do QR.' })
    } else if (ultQr >= 0 && !pareouDepois) {
      tel.push({ problema: 'O QR apareceu, mas não houve leitura depois.', acao: 'Perguntar se ela chegou a ler; se sim, ver o elo WhatsApp.' })
    } else if (clicou && !ligou) {
      tel.push({ problema: 'Ela clicou em conectar, mas a tela não conseguiu ligar o robô.', acao: 'Conferir os elos Conta e Vaga; se estiverem ok, usar "Tentar reconectar".' })
    } else if (clicou && ligou && ultQr < 0) {
      tel.push({ problema: 'O robô ligou, mas o QR nunca chegou na tela.', acao: 'Ver o elo WhatsApp (recusa do WhatsApp) e tentar reconectar.' })
    }
  }

  // 4. WhatsApp (queda, código, trava)
  const zap = []
  if (session?.blockNotice) {
    zap.push({ problema: 'Há um aviso de bloqueio na sessão (ex.: este número já está conectado em outra conta).', acao: 'Ver o aviso na ficha; o número precisa sair da outra conta antes.' })
  }
  if (!conectada && codigo === '405') {
    zap.push({
      problema: Number(versaoRecusadaServidor) > 0
        ? 'O WhatsApp recusou a versão que o robô usa — e isso está acontecendo com várias contas ao mesmo tempo. Não é problema do número dela.'
        : 'O WhatsApp recusou a entrada do robô (versão desatualizada). Confira se outras contas também caíram.',
      acao: 'Não pedir para ela parear de novo. Se for geral, a equipe técnica fixa uma versão nova do WhatsApp no servidor (WA_WEB_VERSION).',
    })
  }
  if (!conectada && codigo === '408') {
    zap.push({ problema: 'O WhatsApp demorou demais para responder e a conexão caiu (tempo esgotado).', acao: 'Deixar o robô tentar sozinho por alguns minutos; se repetir em várias contas, é instabilidade do servidor/WhatsApp, não do número dela.' })
  }
  if (!conectada && ['401', '403'].includes(codigo)) {
    zap.push({ problema: 'O WhatsApp encerrou esta sessão (aparelho desconectado pelo celular, ou número com restrição).', acao: 'Ela precisa conectar de novo lendo o QR. Se for 403 repetido, o número pode estar restrito pelo WhatsApp.' })
  }
  if (eventosOrd.some(e => e.type === 'retry_giveup')) {
    zap.push({ problema: 'O robô esgotou as tentativas de conectar e parou de tentar.', acao: 'Precisa de novo pareamento pela cliente (ou "Tentar reconectar" depois de resolver a causa).' })
  }
  if (session?.lifecycle === 'stopped_by_user') {
    zap.push({ problema: 'O robô foi parado de propósito (pela cliente ou pelo admin).', acao: 'Só volta quando ela conectar de novo ou você usar "Tentar reconectar".' })
  } else if (conectada && !isHeartbeatFresh(session.lastHeartbeatAt, nowMs)) {
    zap.push({ problema: 'Diz que está conectado, mas o robô não dá sinal há mais de 5 minutos: provavelmente travado.', acao: 'Usar "Tentar reconectar".' })
  } else if (!conectada && session && !zap.length) {
    zap.push({
      problema: `O WhatsApp está "${session.status}"${codigo ? ` (último código de queda ${codigo})` : ''}.`,
      acao: workerRunning === false ? 'Não há robô rodando para ela: usar "Tentar reconectar".' : 'Ver a linha do tempo das quedas abaixo.',
    })
  }

  // 5. credencial em disco
  const cred = []
  if (credencial?.backupPareamento) {
    cred.push({ problema: 'Existe um pareamento interrompido (a credencial antiga foi guardada de lado).', acao: 'Pedir para ela parear de novo; se o pareamento falhar, o robô volta sozinho à credencial antiga.' })
  }
  if (credencial && !credencial.existe && conectada) {
    cred.push({ problema: 'Aparece conectada, mas não há credencial guardada no servidor.', acao: 'Pedir para ela conectar de novo; isto não deveria acontecer.' })
  }

  const elos = [
    elo('conta', 'Conta', conta),
    elo('vaga', 'Vaga no servidor', vaga),
    elo('tela', 'O que ela fez na tela', tel),
    elo('whatsapp', 'WhatsApp', zap),
    elo('credencial', 'Credencial', cred),
  ]
  const primeiro = elos.find(e => !e.ok)
  const veredito = primeiro
    ? { eloId: primeiro.id, ok: false, frase: primeiro.frases[0], acao: primeiro.acoes[0] }
    : {
      eloId: null,
      ok: true,
      frase: conectada ? 'Conectada e dando sinal: nada quebrado na conexão.' : 'Nenhum elo quebrado com os dados do banco. Ver a linha do tempo das quedas.',
      acao: null,
    }

  return {
    days,
    elos,
    veredito,
    problemas: elos.flatMap(e => e.frases),
    resumo: {
      status: session?.status ?? null,
      lifecycle: session?.lifecycle ?? null,
      ultimoCodigo: codigo || null,
      eventosNaJanela: eventosOrd.length,
      recusasDeVaga: Number(vagas.recusasDela) || 0,
      recusasDeVagaServidor: Number(vagas.recusasServidor) || 0,
      limiteDeVagas: vagas.limite ?? null,
    },
  }
}
