import test from 'node:test'
import assert from 'node:assert/strict'

import { isBareSignatureLine, isSocialOnlyLine, stripTrailingSourceSignature } from '../src/core/sourceSignature.js'
import { sanitizeInviteLinks } from '../src/messageProcessor.js'

// As mensagens deste arquivo foram copiadas do MessageLog de PRODUÇÃO da conta
// vitoriadasilvavasconcelos2@gmail.com (RCA 2026-08). Os casos "preserva" são
// tão importantes quanto os "remove": foi o conteúdo real que ela entrega e
// que a heurística não pode comer.

test('remove assinatura de palavra solta depois da linha do link (caso sharabarros)', () => {
  const original = [
    '*🥳 HORAS DE DIVERSÃO* E DESCANSO PRAS MAMÃES 🥰',
    '',
    '🔥Cercadinho Para Bebê Grande cercado Infantil 180 x150cm | Cercadinho Bebê Chiqueirinho Proteção Bebê Cinza Qualidade',
    '',
    '❌ ~De: _R$ 406,25~_',
    '✅ *Por R$ 175,00* c/cupom🆘',
    '',
    'Compre aqui:https://s.shopee.com.br/50Y0e82AE9',
    '',
    'sharabarros',
  ].join('\n')

  const result = stripTrailingSourceSignature(original)

  assert.equal(result.includes('sharabarros'), false)
  assert.equal(result.includes('https://s.shopee.com.br/50Y0e82AE9'), true)
  assert.equal(result.includes('Cinza Qualidade'), true)
  assert.equal(result.includes('R$ 175,00'), true)
})

// O caractere que precede a assinatura não pôde ser lido do banco (MessageLog
// corta em 240 chars) e no print admitia três leituras. As três precisam cair.
test('remove a assinatura nas três formas possíveis do marcador do print', () => {
  for (const assinatura of ['sharabarros', '> sharabarros', '| sharabarros', '📸 sharabarros', '@5511987654321']) {
    const original = `Oferta top\n\nCompre aqui: https://s.shopee.com.br/50Y0e82AE9\n\n${assinatura}`
    const result = stripTrailingSourceSignature(original)
    assert.equal(result.includes('sharabarros'), false, `falhou para: ${assinatura}`)
    assert.equal(result.includes('5511987654321'), false, `falhou para: ${assinatura}`)
    assert.equal(result.includes('https://s.shopee.com.br/50Y0e82AE9'), true, `falhou para: ${assinatura}`)
  }
})

test('remove linha de perfil mesmo cercada de emoji (caso ocasaljovemoficial)', () => {
  const original = [
    '*UM LAVABO CLEAN* ✨',
    '🛍 Kit Lavabo Granilite Branco - 2 Peças Em Cerâmica TOP Útil',
    '❌ De: ~R$ 54,90~',
    '✅😱 POOr: *R$ 49,90*',
    '➡️ Compre aqui: https://s.shopee.com.br/4LIJqrEqow',
    '⚠ *😱😱😱.* *@ocasaljovemoficial_*',
  ].join('\n')

  const result = stripTrailingSourceSignature(original)

  assert.equal(result.includes('ocasaljovemoficial'), false)
  assert.equal(result.includes('https://s.shopee.com.br/4LIJqrEqow'), true)
  assert.equal(result.includes('R$ 49,90'), true)
})

test('remove domínio social escrito sem protocolo', () => {
  const original = 'Oferta\n\nCompre aqui: https://meli.la/1j6G8ag\n\ninstagram.com/sharabarros'
  const result = stripTrailingSourceSignature(original)

  assert.equal(result.includes('sharabarros'), false)
  assert.equal(result.includes('https://meli.la/1j6G8ag'), true)
})

test('PRESERVA a linha de cupom que vem depois do link', () => {
  const original = [
    '*O CUPOM TÁ ACABANDO*🤯🤯',
    '🧡 *Tábua De Corte Antibacteriana Para Carnes Legumes*',
    'De: _~R$ 39,58~_ ✅ *POOr:* *R$ 14,25*',
    'compre aqui: https://meli.la/2h33A5w',
    '🎟️Use o cupom:*CASAPROMO*',
  ].join('\n')

  assert.equal(stripTrailingSourceSignature(original), original)
})

test('PRESERVA frase de urgência legítima no fim', () => {
  const original = [
    'Kit 2 Cestos Organizadores De Geladeira',
    'Compre aqui: https://meli.la/1MRwh7a',
    '🏃🏻‍♀️‍➡️ Corre porque o valor pode mudar em minutos!',
  ].join('\n')

  assert.equal(stripTrailingSourceSignature(original), original)
})

test('PRESERVA instrução de cupom com código no fim', () => {
  const original = [
    'Oferta',
    'https://meli.la/2YbXZMA',
    '🎟️ Use o cupom *FASHIONML* para 18% OFF! - Adicione em “Inserir Código”',
  ].join('\n')

  assert.equal(stripTrailingSourceSignature(original), original)
})

test('PRESERVA fim de título de produto quando o link NÃO é a linha anterior', () => {
  // Invariante 3: sem a exigência de "linha anterior é a do link", esta
  // heurística comeria "Cinza Qualidade" (2 palavras, sem dígito).
  const original = [
    'Compre aqui: https://s.shopee.com.br/50Y0e82AE9',
    'Cercadinho Bebê Chiqueirinho Proteção Bebê',
    'Cinza Qualidade',
  ].join('\n')

  assert.equal(stripTrailingSourceSignature(original), original)
})

test('nunca remove linha que contém link', () => {
  const original = 'Produto\n\nhttps://s.shopee.com.br/50Y0e82AE9'
  assert.equal(stripTrailingSourceSignature(original), original)
})

test('no-op em mensagem sem link de oferta (invariante 1)', () => {
  const original = 'Bom dia pessoal\n\nsharabarros'
  assert.equal(stripTrailingSourceSignature(original), original)
})

test('teto de 2 linhas de assinatura', () => {
  const original = [
    'Compre aqui: https://meli.la/2h33A5w',
    'sharabarros',
    '@perfilzinho',
    '@outroperfil',
  ].join('\n')

  const result = stripTrailingSourceSignature(original)

  assert.equal(result.includes('@perfilzinho'), false)
  assert.equal(result.includes('@outroperfil'), false)
  // A terceira linha (sharabarros) sobrevive ao teto — degradação previsível,
  // nunca remoção em cascata.
  assert.equal(result.includes('sharabarros'), true)
})

test('predicados isolados', () => {
  assert.equal(isSocialOnlyLine('⚠ *😱😱😱.* *@ocasaljovemoficial_*'), true)
  assert.equal(isSocialOnlyLine('Siga @fulano para mais ofertas'), false)
  assert.equal(isSocialOnlyLine('nenhum handle aqui'), false)

  assert.equal(isBareSignatureLine('sharabarros'), true)
  assert.equal(isBareSignatureLine('> sharabarros'), true)
  assert.equal(isBareSignatureLine('| sharabarros'), true)
  assert.equal(isBareSignatureLine('🎟️Use o cupom:*CASAPROMO*'), false)
  assert.equal(isBareSignatureLine('R$ 49,90'), false)
  assert.equal(isBareSignatureLine('Corre porque o valor pode mudar em minutos!'), false)
  assert.equal(isBareSignatureLine('https://meli.la/2h33A5w'), false)
})

test('integração: sanitizeInviteLinks remove a assinatura junto com o resto', () => {
  const original = [
    '🔥 Cercadinho Para Bebê',
    'Compre aqui: https://s.shopee.com.br/50Y0e82AE9',
    'Entre no grupo: https://chat.whatsapp.com/AbCdEf12345',
    '',
    'sharabarros',
  ].join('\n')

  const result = sanitizeInviteLinks(original)

  assert.equal(result.includes('sharabarros'), false)
  assert.equal(result.includes('chat.whatsapp.com'), false)
  assert.equal(result.includes('https://s.shopee.com.br/50Y0e82AE9'), true)
})
