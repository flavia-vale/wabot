// Qual aviso global cabe AGORA, segundo a jornada da cliente.
//
// Achado em teste com conta nova (2026-09-08): a primeira coisa que ela via ao
// entrar era a faixa VERMELHA "Falta cadastrar suas lojas — sem isso o robô não
// publica nenhuma oferta". Para quem acabou de criar a conta e ainda não
// conectou o WhatsApp, isso é errado por dois motivos:
//
//  1. É o passo ERRADO da jornada. O primeiro passo é conectar o WhatsApp; a
//     loja vem depois. Cobrar a loja antes manda a pessoa para o lugar errado.
//  2. É um alarme sobre um problema que ela ainda não tem. O robô não está
//     deixando de publicar por falta de etiqueta — ele nem foi ligado. Alarme
//     que não corresponde a nada treina a pessoa a ignorar os que importam.
//
// A regra abaixo é a MESMA que governa o C1 na tela de conexão: a loja só é
// cobrada depois de conectar. Sem isso as duas superfícies discordavam entre si.
//
// Módulo PURO.

/**
 * @param {object} args
 * @param {boolean|null} args.hasAnyCredential  `null` = ainda não sabemos
 * @param {boolean|null} args.online            conectada agora
 * @param {string|null} args.phone              número salvo = já conectou alguma vez
 * @returns {boolean}
 */
export function shouldShowNoCredentialBanner({ hasAnyCredential, online, phone } = {}) {
  // `null` é "não sei ainda" (carregando ou consulta que falhou). Acusar falta
  // de cadastro por dúvida manda refazer o que já existe.
  if (hasAnyCredential !== false) return false

  // Já conectou alguma vez? O número salvo sobrevive à desconexão, então cobre
  // quem conectou e caiu — essa pessoa PRECISA do aviso, o robô dela está de
  // fato sem publicar.
  const jaConectou = online === true || Boolean(phone)
  return jaConectou
}
