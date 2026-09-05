// POR QUE o WhatsApp dessa cliente caiu — em português de gente.
//
// A tabela "Clientes com WhatsApp desconectado após uso" mostrava só o código
// cru do WhatsApp ("Código: 401"), que não diz nada para quem vai ligar para a
// cliente e, pior, junta num balde só casos com AÇÕES OPOSTAS: 401 é caso de
// pedir o QR de novo, 403 é chip recusado (não adianta reconectar), acesso
// vencido é renovação, e "ninguém tentando" é um clique nosso.
//
// A dona (o que resolve) já é decidida por `resolveSessionOwner`; aqui só
// traduzimos, somando o código do WhatsApp quando ele muda a conversa.
//
// Puro: sem I/O. Vocabulário leigo obrigatório — nada de "socket", "stream",
// "handshake" ou o número do código no rótulo.

import { SESSION_OWNER } from '../../core/sessionOwnership.js'

// Códigos que mudam a AÇÃO de quem vai atender. Os demais viram "caiu
// sozinha" de propósito: dar nome técnico a cada variação de queda faria a
// operação procurar diferença onde a conduta é a mesma.
const CODE_REASONS = {
  401: {
    label: 'Ela desconectou pelo celular',
    detail: 'O aparelho foi desvinculado no WhatsApp dela. Só volta quando ela ler o QR de novo — reconectar por aqui não resolve.',
    tone: 'amber',
  },
  403: {
    label: 'O WhatsApp recusou o número',
    detail: 'Bloqueio do próprio WhatsApp. Não adianta reconectar: o caminho é conversar com ela sobre usar outro número.',
    tone: 'red',
  },
  405: {
    label: 'O WhatsApp recusou a versão do robô',
    detail: 'Não é problema do número dela. Costuma atingir várias contas ao mesmo tempo e se resolve do nosso lado.',
    tone: 'red',
  },
  440: {
    label: 'A conta foi aberta em outro lugar',
    detail: 'O mesmo WhatsApp foi conectado em outro aparelho ou serviço e derrubou o nosso. Confirmar com ela se ela ligou o número em outra ferramenta.',
    tone: 'amber',
  },
}

const OWNER_REASONS = {
  [SESSION_OWNER.EXPIRED]: {
    label: 'O acesso venceu',
    detail: 'Não é queda: com o plano vencido o robô para sozinho. É conversa de renovação, não de reconexão.',
    tone: 'purple',
  },
  [SESSION_OWNER.CLIENT_STOPPED]: {
    label: 'Ela mesma desligou',
    detail: 'Desligou o robô pelo painel. Foi escolha dela — só volta quando ela ligar de novo, ou se ela pedir ajuda.',
    tone: 'slate',
  },
  [SESSION_OWNER.BLOCKED]: CODE_REASONS[403],
  [SESSION_OWNER.CLIENT]: CODE_REASONS[401],
  [SESSION_OWNER.ROBOT]: {
    label: 'O robô está tentando sozinho',
    detail: 'A conexão caiu e o robô já está reconectando. Costuma voltar sem ninguém fazer nada; se insistir por horas, aí vale falar com ela.',
    tone: 'sky',
  },
  [SESSION_OWNER.NOBODY]: {
    label: 'Parada e ninguém tentando',
    detail: 'A sessão caiu e não há robô no ar para essa conta. É o caso em que o nosso botão de reconectar resolve na hora.',
    tone: 'red',
  },
  [SESSION_OWNER.CONNECTED]: {
    label: 'Conectada',
    detail: 'A sessão está no ar agora.',
    tone: 'emerald',
  },
}

const UNKNOWN = {
  label: 'Caiu e não sabemos por quê',
  detail: 'O WhatsApp não informou o motivo. Vale abrir o histórico dela antes de ligar.',
  tone: 'slate',
}

const NEVER_CONNECTED = {
  label: 'Nunca chegou a conectar',
  detail: 'Essa conta não tem sessão de WhatsApp nenhuma — ela parou antes de ler o QR.',
  tone: 'slate',
}

export function describeDisconnectReason({
  owner = null,
  hasSession = true,
  lastDisconnectCode = null,
} = {}) {
  if (!hasSession) return { ...NEVER_CONNECTED, code: null }

  const code = lastDisconnectCode == null || lastDisconnectCode === '' ? null : String(lastDisconnectCode).trim()

  // Vencido e desligado por ela vêm ANTES do código: nos dois casos o código
  // que ficou gravado é da queda anterior e contaria uma história errada.
  if (owner === SESSION_OWNER.EXPIRED || owner === SESSION_OWNER.CLIENT_STOPPED) {
    return { ...OWNER_REASONS[owner], code }
  }
  if (code && CODE_REASONS[code]) return { ...CODE_REASONS[code], code }
  if (owner && OWNER_REASONS[owner]) return { ...OWNER_REASONS[owner], code }
  if (code) {
    return {
      label: 'Caiu sozinha',
      detail: 'Queda técnica da conexão, sem ação de ninguém. Se estiver se repetindo, o histórico dela mostra a frequência.',
      tone: 'slate',
      code,
    }
  }
  return { ...UNKNOWN, code: null }
}
