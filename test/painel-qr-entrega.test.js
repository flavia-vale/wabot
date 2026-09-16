// O QR tem que CHEGAR à tela da cliente.
//
// RCA 2026-09-14 (conta taaianeribeiro@hotmail.com): 25 minutos sem conectar,
// robô reiniciado 15 vezes, e o log de produção mostrando `qr_generated` menos
// de um segundo depois de CADA start. O robô nunca falhou — o QR não tinha por
// onde chegar até a tela.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import {
  shouldPollQrCode,
  nextQrFromPoll,
  shouldOfferInactivityReset,
  INACTIVITY_RESET_SECONDS,
} from '../dashboard/lib/painel/qrDelivery.js'

const PAGE = readFileSync(new URL('../dashboard/app/painel/whatsapp/page.js', import.meta.url), 'utf8')

test('consulta o QR enquanto o robô está autenticando', () => {
  assert.equal(shouldPollQrCode({ running: true, status: 'connecting' }), true)
})

test('a consulta NÃO depende da aba escolhida na tela', () => {
  // Era isto que quebrava: o polling exigia `connectMethod === 'qr'`, e o botão
  // "Reiniciar conexão"/"Resetar instância" nunca liga esse valor. A tela nasce
  // em pareamento, então cada clique em reiniciar deixava o QR sem caminho.
  for (const connectMethod of ['pairing', 'qr', undefined, null]) {
    assert.equal(
      shouldPollQrCode({ running: true, status: 'connecting', connectMethod }),
      true,
      `método ${connectMethod} não pode calar a consulta`,
    )
  }
})

test('a consulta CONTINUA com QR na tela — o WhatsApp rotaciona o código', () => {
  assert.equal(shouldPollQrCode({ running: true, status: 'connecting', qr: 'QR-ANTIGO' }), true)
})

test('não consulta com robô parado, conectado ou em pareamento por número', () => {
  assert.equal(shouldPollQrCode({ running: false, status: 'connecting' }), false)
  assert.equal(shouldPollQrCode({ running: true, status: 'connected' }), false)
  assert.equal(shouldPollQrCode({ running: true, status: 'disconnected' }), false)
  assert.equal(shouldPollQrCode({ running: true, status: 'connecting', pairingCode: 'ABCD1234' }), false)
})

test('QR igual não reinicia o contador de validade; QR novo sim', () => {
  assert.deepEqual(nextQrFromPoll({ current: 'A', incoming: 'A' }), { qr: 'A', changed: false })
  assert.deepEqual(nextQrFromPoll({ current: 'A', incoming: 'B' }), { qr: 'B', changed: true })
  assert.deepEqual(nextQrFromPoll({ current: 'A', incoming: null }), { qr: 'A', changed: false })
  assert.deepEqual(nextQrFromPoll({ current: null, incoming: 'B' }), { qr: 'B', changed: true })
})

test('"Conexão sem progresso" só aparece quando não há NADA para escanear', () => {
  const base = { running: true, status: 'connecting', connected: false, elapsedSec: 120 }
  assert.equal(shouldOfferInactivityReset(base), true)
  // Com QR válido na tela, oferecer "Resetar instância" é sabotagem: o botão
  // para o robô e apaga a credencial. Foi ele, oferecido aos 45s, que virou
  // quinze reinícios na conta medida.
  assert.equal(shouldOfferInactivityReset({ ...base, qr: 'QR-VALIDO' }), false)
  assert.equal(shouldOfferInactivityReset({ ...base, pairingCode: 'ABCD1234' }), false)
  assert.equal(shouldOfferInactivityReset({ ...base, elapsedSec: INACTIVITY_RESET_SECONDS - 1 }), false)
  assert.equal(shouldOfferInactivityReset({ ...base, connected: true }), false)
})

test('a tela usa a regra pura em vez de reescrevê-la', () => {
  assert.match(PAGE, /shouldPollQrCode\(/, 'a consulta do QR precisa vir de qrDelivery.js')
  assert.match(PAGE, /shouldOfferInactivityReset\(/, 'o aviso de inatividade precisa vir de qrDelivery.js')
  assert.match(PAGE, /nextQrFromPoll\(/, 'a troca de QR precisa vir de qrDelivery.js')
  assert.doesNotMatch(
    PAGE,
    /const shouldPoll = connectMethod === 'qr'/,
    'não voltar a prender a consulta do QR à aba escolhida na tela',
  )
  assert.doesNotMatch(
    PAGE,
    /qrWaitElapsed >= INACTIVITY_RESET_SECONDS/,
    'não voltar a oferecer reset só por tempo, ignorando o QR na tela',
  )
})
