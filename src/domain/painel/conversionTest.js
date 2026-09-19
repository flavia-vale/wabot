/* O veredito da tela "Testar conversão" — PURO, sem banco, sem rede.
 *
 * A tela existe para responder UMA pergunta: "o link está saindo com a minha
 * identificação de afiliada?". O resultado cru da rota não responde isso
 * sozinho, e ler errado manda a cliente mexer na coisa errada:
 *
 * - conversão que FALHOU nem sempre é credencial. Pode ser link de uma loja
 *   que não atendemos, ou a loja demorando a responder agora. Dizer
 *   "credenciais inválidas" nesses casos faz ela recadastrar um código que
 *   está vivo — é o mesmo defeito do "limite de robôs" servindo de frase para
 *   três causas diferentes (AGENTS.md, RCA 2026-09-07).
 *
 * - conversão que DEU CERTO nem sempre é "tudo certo". ML e Amazon têm plano
 *   B: com o código de acesso vencido o link continua saindo, só que no
 *   formato longo (`warning: ml_ssid_expired` / `amazon_cookies_expired`).
 *   Pintar isso de verde esconderia exatamente o que a tela foi feita para
 *   mostrar. Por isso existe o veredito `ressalva`.
 *
 * ⚠️ E a ressalva NÃO pode dizer que a comissão se perdeu: no plano B do ML e
 * da Amazon a identificação continua no link (AGENTS.md: "não voltar a dizer
 * que o envio está pausado quando o código vence"). A única exceção é
 * `ml_url_not_supported`, onde o ML recusou o endereço no programa de
 * afiliados e a comissão de fato pode não ser creditada.
 */

export const VEREDITO = Object.freeze({
  OK: 'ok',
  RESSALVA: 'ressalva',
  CREDENCIAL: 'credencial',
  LINK: 'link',
  TEMPORARIO: 'temporario',
})

/* Ressalvas de conversão BEM-SUCEDIDA, por código de aviso do conversor.
 * `credenciais: true` liga o botão que leva ao cadastro da loja. */
const RESSALVAS = Object.freeze({
  ml_ssid_expired: {
    titulo: 'Saiu, mas o código de acesso do Mercado Livre venceu',
    texto: 'A oferta continua sendo publicada e a comissão continua sua — só que com o link mais comprido, em vez do curto. Recadastre o código de acesso para o link voltar a sair curto.',
    credenciais: true,
  },
  amazon_cookies_expired: {
    titulo: 'Saiu, mas o código de acesso da Amazon venceu',
    texto: 'A oferta continua sendo publicada e a comissão continua sua — só que com o link mais comprido, em vez do curto. Recadastre o código de acesso para o link voltar a sair curto.',
    credenciais: true,
  },
  ml_affiliate_forbidden: {
    titulo: 'Saiu, mas o Mercado Livre recusou o pedido agora',
    texto: 'O link foi publicado no formato mais comprido, com a sua identificação. A recusa costuma vir de código de acesso vencido — vale conferir o cadastro da loja.',
    credenciais: true,
  },
  ml_affiliate_rate_limited: {
    titulo: 'Saiu, mas o Mercado Livre pediu para esperar',
    texto: 'O link foi publicado no formato mais comprido, com a sua identificação. Isso costuma ser passageiro: teste de novo daqui a pouco. Não é preciso mexer no seu cadastro.',
    credenciais: false,
  },
  ml_affiliate_busy: {
    titulo: 'Saiu, mas o Mercado Livre estava ocupado',
    texto: 'O link foi publicado no formato mais comprido, com a sua identificação. Isso costuma ser passageiro: teste de novo daqui a pouco. Não é preciso mexer no seu cadastro.',
    credenciais: false,
  },
  ml_vitrine_fallback_used: {
    titulo: 'Saiu como vitrine, não como produto',
    texto: 'Esse endereço não aponta para um produto só, então o link saiu para a sua vitrine. Para testar um produto, cole o endereço da página dele.',
    credenciais: false,
  },
  ml_url_not_supported: {
    // ÚNICA ressalva que não promete comissão — RCA 2026-08-15: o Mercado
    // Livre não credita `partner_id` pendurado em endereço que ele recusa.
    titulo: 'O Mercado Livre não aceita esse endereço',
    texto: 'O link saiu, mas o Mercado Livre não aceitou esse endereço no programa de afiliados, então a comissão pode não ser creditada. Teste com o endereço da página do produto.',
    credenciais: false,
  },
})

function texto(valor) {
  return String(valor ?? '').toLowerCase()
}

/** A mensagem de erro fala de credencial? */
function falaDeCredencial(mensagem) {
  return /credencial|credential|token|chave|código de acesso|codigo de acesso|etiqueta/.test(mensagem)
}

/** A mensagem de erro fala de link que não atendemos? */
function falaDeLinkNaoAtendido(mensagem) {
  return /não suport|nao suport|not support|unsupported|nenhum link|link inválido|link invalido|url inválid|url invalid/.test(mensagem)
}

/** A mensagem de erro fala de demora/limite passageiro? */
function falaDeEsperaPassageira(mensagem) {
  return /tempo limite|timeout|excedid|ocupad|aguarde|espere|muitas|limite de uso|tente novamente/.test(mensagem)
}

/**
 * Traduz UM resultado da rota de conversão no veredito da tela.
 *
 * @param {{status?: string, code?: string|null, error?: string|null, warning?: string|null, label?: string|null}} resultado
 * @returns {{veredito: string, titulo: string, texto: string, mostrarCredenciais: boolean, avisoTecnico: string|null}}
 */
export function describeConversionTest(resultado = {}) {
  const loja = String(resultado.label || '').trim() || 'a loja'

  if (resultado.status === 'converted') {
    const aviso = String(resultado.warning || '').trim()
    const ressalva = RESSALVAS[aviso]
    if (ressalva) {
      return {
        veredito: VEREDITO.RESSALVA,
        titulo: ressalva.titulo,
        texto: ressalva.texto,
        mostrarCredenciais: ressalva.credenciais,
        avisoTecnico: aviso,
      }
    }
    // Aviso que ainda não mapeamos: a conversão deu certo, então não vira
    // alarme — mas também não vira "tudo certo" em silêncio.
    if (aviso) {
      return {
        veredito: VEREDITO.RESSALVA,
        titulo: 'O link saiu, com uma observação da loja',
        texto: `O link foi convertido com a sua identificação, mas ${loja} devolveu uma observação que ainda não sabemos traduzir. Se as ofertas estiverem saindo normalmente, pode seguir.`,
        mostrarCredenciais: false,
        avisoTecnico: aviso,
      }
    }
    return {
      veredito: VEREDITO.OK,
      titulo: 'Tudo certo — o link saiu com a sua identificação',
      texto: `Seus links ${loja === 'a loja' ? 'dessa loja' : `da ${loja}`} estão saindo com a sua identificação de afiliada. Pode espelhar.`,
      mostrarCredenciais: false,
      avisoTecnico: null,
    }
  }

  const mensagem = texto(resultado.error)

  if (resultado.code === 'MISSING_CREDENTIALS' || (resultado.code === 'CONVERSION_FAILED' && falaDeCredencial(mensagem))) {
    return {
      veredito: VEREDITO.CREDENCIAL,
      titulo: `Falta o seu cadastro ${loja === 'a loja' ? 'dessa loja' : `da ${loja}`}`,
      texto: 'Sem os seus dados dessa loja o robô não consegue montar o link com a sua identificação — e ele prefere não publicar a mandar o link de outra pessoa. Cadastre e teste de novo.',
      mostrarCredenciais: true,
      avisoTecnico: resultado.code || null,
    }
  }

  if (falaDeLinkNaoAtendido(mensagem)) {
    return {
      veredito: VEREDITO.LINK,
      titulo: 'Esse link não serve para o teste',
      texto: 'Cole o endereço da página de um produto de uma das lojas que o robô atende: Shopee, Amazon, Mercado Livre, Magalu, SHEIN ou AliExpress.',
      mostrarCredenciais: false,
      avisoTecnico: resultado.code || null,
    }
  }

  if (falaDeEsperaPassageira(mensagem)) {
    return {
      veredito: VEREDITO.TEMPORARIO,
      titulo: 'A loja demorou a responder',
      texto: 'Não deu para concluir o teste agora. Isso costuma ser passageiro — tente de novo em instantes. Seu cadastro não precisa ser mexido.',
      mostrarCredenciais: false,
      avisoTecnico: resultado.code || null,
    }
  }

  return {
    veredito: VEREDITO.TEMPORARIO,
    titulo: 'Não foi possível concluir o teste',
    texto: 'O link não pôde ser convertido agora. Tente de novo em instantes; se continuar, confira o cadastro dessa loja.',
    mostrarCredenciais: false,
    avisoTecnico: resultado.code || null,
  }
}

/**
 * Mesma tradução para a falha que vem da própria chamada (nenhum resultado
 * chegou). `code` vem de `err.code`, preservado pelo apiFetch do painel.
 */
export function describeConversionRequestFailure({ code = null, message = '' } = {}) {
  const mensagem = texto(message)

  if (code === 'LINK_CONVERSION_NO_LINKS' || falaDeLinkNaoAtendido(mensagem)) {
    return {
      veredito: VEREDITO.LINK,
      titulo: 'Esse link não serve para o teste',
      texto: 'Cole o endereço da página de um produto de uma das lojas que o robô atende: Shopee, Amazon, Mercado Livre, Magalu, SHEIN ou AliExpress.',
      mostrarCredenciais: false,
      avisoTecnico: code,
    }
  }

  if (code === 'LINK_CONVERSION_LIMIT_EXCEEDED') {
    return {
      veredito: VEREDITO.LINK,
      titulo: 'Cole um link por vez',
      texto: 'O teste é de um produto por vez, para a resposta ficar clara. Deixe só um endereço no campo e teste de novo.',
      mostrarCredenciais: false,
      avisoTecnico: code,
    }
  }

  if (code === 'LINK_CONVERSION_TEXT_TOO_LARGE') {
    return {
      veredito: VEREDITO.LINK,
      titulo: 'O texto ficou grande demais',
      texto: 'Cole só o endereço do produto, sem o texto da oferta em volta.',
      mostrarCredenciais: false,
      avisoTecnico: code,
    }
  }

  if (
    code === 'LINK_CONVERSION_RATE_LIMITED'
    || code === 'LINK_CONVERSION_ALREADY_RUNNING'
    || code === 'LINK_CONVERSION_GLOBAL_BUSY'
    || falaDeEsperaPassageira(mensagem)
  ) {
    return {
      veredito: VEREDITO.TEMPORARIO,
      titulo: 'Espere um instante para testar de novo',
      texto: 'Já existe um teste em andamento ou você testou várias vezes seguidas. Aguarde alguns segundos e tente outra vez.',
      mostrarCredenciais: false,
      avisoTecnico: code,
    }
  }

  return {
    veredito: VEREDITO.TEMPORARIO,
    titulo: 'Não foi possível concluir o teste',
    texto: 'Tente de novo em instantes. Se continuar, confira sua conexão.',
    mostrarCredenciais: false,
    avisoTecnico: code,
  }
}
