import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

// Bug real: mensagens de cupom (Amazon/ML/Shopee) usam a MESMA janela diária
// de dedup (24h, linkDedupWindowMs) das ofertas de produto. Como o link de
// cupom costuma ser uma página FIXA (ex.: landing de campanha) repostada
// várias vezes ao dia com códigos diferentes, a janela diária bloqueava quase
// todo reenvio legítimo — pedido explícito da cliente: cupom precisa de uma
// janela bem mais curta (5min default), produto continua com a janela diária.
const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('couponDedupWindowMs existe com default de 5min e override via COUPON_DEDUP_WINDOW_MS', () => {
  assert.match(
    botWorkerSource,
    /const couponDedupWindowMs = Math\.max\(1_000, Number\(process\.env\.COUPON_DEDUP_WINDOW_MS\) \|\| 5 \* 60_000\)/,
    'janela curta de cupom precisa existir com default 5min e override por env',
  )
})

// A janela CURTA de cupom vale SÓ para cupom de LOJA genuíno (store-wide):
// isCouponLink (linkKind==='coupon') E couponLooksGeneric (texto com cara de
// store-wide). Oferta de PRODUTO classificada como 'coupon' só porque o short
// link /sec/ do ML não resolveu o MLB (muro anti-bot) NÃO é store-wide, então
// usa a janela diária e volta a ser deduplicada — senão a MESMA oferta
// repostada ~20min depois sai duplicada (report real: Tênis New Balance +
// cupom PRAMODA). Se a janela curta voltar a valer para todo isCouponLink,
// produto com /sec/ não resolvido volta a duplicar.
test('janela curta de cupom só vale para cupom store-wide (isCouponLink && couponLooksGeneric)', () => {
  assert.match(
    botWorkerSource,
    /const isCouponLink = primary\.linkKind === 'coupon'/,
  )
  assert.match(
    botWorkerSource,
    /const useShortCouponWindow = isCouponLink && couponLooksGeneric/,
    'a janela curta precisa exigir TAMBÉM que o texto tenha cara de store-wide (couponLooksGeneric)',
  )
  assert.match(
    botWorkerSource,
    /const effectiveDedupWindowMs = useShortCouponWindow \? couponDedupWindowMs : linkDedupWindowMs/,
    'produto (mesmo classificado coupon por /sec/ não resolvido) precisa cair na janela diária',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /const effectiveDedupWindowMs = isCouponLink \? couponDedupWindowMs : linkDedupWindowMs/,
    'regressão: janela curta não pode voltar a valer para TODO cupom (produto com /sec/ volta a duplicar)',
  )
})

// A dedup local (in-memory), via MessageLog (DB) e a chamada ao Redis global
// PRECISAM usar effectiveDedupWindowMs — se alguma voltar a usar
// linkDedupWindowMs direto, cupom volta a ficar preso na janela diária mesmo
// com couponDedupWindowMs definido.
test('checagens de dedup local/DB/Redis no loop de destinos usam effectiveDedupWindowMs, não linkDedupWindowMs', () => {
  assert.match(
    botWorkerSource,
    /\.find\(m => m\.ageMs < effectiveDedupWindowMs\)/,
    'dedup local (in-memory) precisa usar effectiveDedupWindowMs',
  )
  assert.match(
    botWorkerSource,
    /sentAt: \{ gte: new Date\(Date\.now\(\) - effectiveDedupWindowMs\) \}/,
    'dedup via MessageLog (DB) precisa usar effectiveDedupWindowMs',
  )
  assert.match(
    botWorkerSource,
    /const globalDedup = await globalDedupCheckAndSet\(key, effectiveDedupWindowMs\)/,
    'dedup global via Redis precisa usar effectiveDedupWindowMs',
  )
})

// Bug real (2ª rodada): mesmo com couponDedupWindowMs correto, cupom
// continuava bloqueado. Causa: duas camadas guardavam um TTL/expiresAt
// "congelado" na janela ANTIGA no momento em que a chave/linha foi gravada —
// SendDedupKey.expiresAt e o TTL nativo da chave no Redis — e só liberavam o
// slot quando esse TTL antigo expirasse sozinho (até 24h depois), mesmo
// depois do código já estar rodando com a janela curta nova. As duas
// camadas precisam parar de depender de um TTL fixo pra representar a janela
// lógica de dedup.
test('reserva SendDedupKey usa SEND_DEDUP_RESERVATION_TTL_MS fixo, não effectiveDedupWindowMs', () => {
  assert.match(
    botWorkerSource,
    /const SEND_DEDUP_RESERVATION_TTL_MS = Math\.max\(30_000, Number\(process\.env\.SEND_DEDUP_RESERVATION_TTL_MS\) \|\| 5 \* 60_000\)/,
    'SendDedupKey precisa de um TTL fixo e curto, independente da janela lógica do linkKind',
  )
  assert.match(
    botWorkerSource,
    /const reservationExpiresAt = new Date\(Date\.now\(\) \+ SEND_DEDUP_RESERVATION_TTL_MS\)/,
    'reserva atômica (SendDedupKey) precisa expirar em SEND_DEDUP_RESERVATION_TTL_MS, não effectiveDedupWindowMs/linkDedupWindowMs',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /const reservationExpiresAt = new Date\(Date\.now\(\) \+ effectiveDedupWindowMs\)/,
    'regressão: reserva não pode voltar a usar effectiveDedupWindowMs (prende cupom no TTL antigo até 24h)',
  )
})

// A lógica de "timestamp guardado vs. janela do chamador" mora em
// core/globalDedup.js (coberta por testes FUNCIONAIS reais com ioredis-mock
// em test/core/global-dedup.test.js — bot-worker.js é grande demais pra
// importar em teste sem efeitos colaterais, então antes só tinha regex
// checando o texto do source, sem nunca provar que o Redis se comportava
// como esperado). Aqui só garantimos que bot-worker.js está de fato
// chamando essa lógica extraída, com o safety-cap fixo certo — não a janela
// lógica — e não voltou a reimplementar o SET NX inline com ttlMs.
test('globalDedupCheckAndSet delega para checkAndSetGlobalDedup (core/globalDedup.js) com o safety-cap fixo certo', () => {
  assert.match(
    botWorkerSource,
    /import \{ checkAndSetGlobalDedup \} from '\.\/core\/globalDedup\.js'/,
    'bot-worker.js precisa importar a lógica extraída e testada de core/globalDedup.js',
  )
  assert.match(
    botWorkerSource,
    /const GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS = Math\.max\(60_000, Number\(process\.env\.GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS\) \|\| 24 \* 60 \* 60_000\)/,
    'TTL nativo da chave Redis precisa ser um safety-cap fixo, não a janela lógica',
  )
  assert.match(
    botWorkerSource,
    /return await checkAndSetGlobalDedup\(r, `dedup:\$\{userId\}:\$\{key\}`, ttlMs, \{ safetyCapMs: GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS \}\)/,
    'globalDedupCheckAndSet precisa delegar pra checkAndSetGlobalDedup com o safetyCapMs fixo (não ttlMs) como TTL nativo',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /await r\.set\(`dedup:\$\{userId\}:\$\{key\}`, '1', 'PX', ttlMs, 'NX'\)/,
    'regressão: não pode voltar a gravar TTL=ttlMs direto na chave (prende dedup na janela de quando a chave foi criada)',
  )
})

test('registerDedupBlock aceita dedupWindowMs explícito e as 4 chamadas do loop passam effectiveDedupWindowMs', () => {
  assert.match(
    botWorkerSource,
    /async function registerDedupBlock\(\{ reason, platform, destJid, originalUrl: incomingUrl, convertedUrl: outgoingUrl, messageText, dedupWindowMs = linkDedupWindowMs, ageMs = null \}\)/,
    'registerDedupBlock precisa aceitar dedupWindowMs (default linkDedupWindowMs para chamadores fora do loop)',
  )
  const callsWithEffectiveWindow = (botWorkerSource.match(/dedupWindowMs: effectiveDedupWindowMs,/g) || []).length
  assert.equal(callsWithEffectiveWindow, 4, 'as 4 chamadas de registerDedupBlock dentro do loop de destinos precisam passar effectiveDedupWindowMs')
})

// Diagnóstico (RCA de cupom preso em dedup — 3ª rodada de reports): sem
// saber HÁ QUANTO TEMPO o bloqueio anterior aconteceu, cada novo report de
// "cupom ainda bloqueado" virava suposição nova em vez de dado conclusivo.
// registerDedupBlock grava esse tempo direto no errorMsg (sufixo
// :age=Xs:window=Ys, prefixo skip:dedup* preservado pra categorizeErrorMsg
// continuar batendo por startsWith).
test('registerDedupBlock grava o sufixo de idade (:age=Xs:window=Ys) no errorMsg quando ageMs é numérico', () => {
  assert.match(
    botWorkerSource,
    /const ageSuffix = Number\.isFinite\(ageMs\) \? `:age=\$\{Math\.round\(ageMs \/ 1000\)\}s:window=\$\{Math\.round\(dedupWindowMs \/ 1000\)\}s` : ''/,
    'sufixo de diagnóstico precisa ser calculado a partir de ageMs/dedupWindowMs',
  )
  assert.match(
    botWorkerSource,
    /errorMsg: reasonWithAge,/,
    'a linha criada no MessageLog precisa usar reasonWithAge (reason + sufixo), não o reason cru',
  )
})

// As 4 camadas (local, DB, reserva SendDedupKey, Redis) precisam passar
// ageMs pra registerDedupBlock. A reserva inicialmente ficava de fora
// (ageMs: null fixo) por ser "a camada menos provável de disparar" — mas um
// report real mostrou o texto genérico (sem idade) mesmo com dedupHits=0
// (ou seja, veio de um create() novo, não de agregação), o que só acontece
// quando a camada que bloqueou foi exatamente essa. Sem idade nessa camada,
// a lacuna de observabilidade persistia bem onde mais importava.
test('as 4 camadas (local/DB/reserva/Redis) calculam e passam ageMs para registerDedupBlock', () => {
  assert.match(botWorkerSource, /ageMs: localDedupMatch\.ageMs,/, 'camada local precisa passar a idade da chave que bateu')
  assert.match(botWorkerSource, /const dbAgeMs = Date\.now\(\) - new Date\(recentDbDuplicate\.sentAt\)\.getTime\(\)/, 'camada DB precisa calcular a idade a partir de sentAt')
  assert.match(botWorkerSource, /ageMs: dbAgeMs,/, 'camada DB precisa passar a idade calculada')
  assert.match(
    botWorkerSource,
    /const conflictAgeMs = conflicting \? Date\.now\(\) - new Date\(conflicting\.createdAt\)\.getTime\(\) : null/,
    'camada de reserva (SendDedupKey) precisa calcular a idade a partir do createdAt da linha conflitante',
  )
  assert.match(botWorkerSource, /ageMs: reservationAgeMs,/, 'camada de reserva precisa passar a idade calculada')
  assert.match(botWorkerSource, /ageMs: globalDuplicateAgeMs,/, 'camada Redis precisa passar a idade devolvida por checkAndSetGlobalDedup')
})

test('sendDedupKey.updateMany (vínculo com o MessageLog) continua logo após a reserva, sem depender do TTL', () => {
  assert.match(
    botWorkerSource,
    /db\.sendDedupKey\.updateMany\(\{\s*where: \{ id: \{ in: reservedDedupKeys \} \},\s*data: \{ messageLogId: log\.id \},/,
    'a reserva precisa continuar sendo vinculada ao MessageLog logo após criado — SEND_DEDUP_RESERVATION_TTL_MS só cobre esse intervalo curto',
  )
})

// Bug real (4ª rodada, com dado conclusivo do diagnóstico do PR anterior):
// painel mostrou "bloqueado há 393min" com janela de 5min — impossível pela
// lógica das outras 3 camadas (todas só reportam idade < janela, por
// construção). Só a reserva (SendDedupKey) podia produzir isso: uma linha
// gravada ANTES de SEND_DEDUP_RESERVATION_TTL_MS existir tem expiresAt até
// 24h no futuro (herdado de uma versão anterior do código), e o deleteMany
// só remove linha com expiresAt JÁ passado — a linha órfã nunca some
// sozinha. Fix: medir createdAt contra o teto ATUAL, não confiar no
// expiresAt gravado; se mais velha que o teto, deletar e tentar de novo.
test('conflito de reserva mede createdAt contra SEND_DEDUP_RESERVATION_TTL_MS e se autocura (delete+retry) quando órfã', () => {
  assert.match(
    botWorkerSource,
    /const conflicting = await db\.sendDedupKey\.findFirst\(\{\s*where: \{ userId, destGroup: destJid, dedupKey: key \},\s*select: \{ id: true, createdAt: true \},\s*\}\)\.catch\(\(\) => null\)/,
    'conflito precisa buscar a linha conflitante (id + createdAt)',
  )
  assert.match(
    botWorkerSource,
    /const conflictAgeMs = conflicting \? Date\.now\(\) - new Date\(conflicting\.createdAt\)\.getTime\(\) : null/,
    'precisa calcular a idade real da linha conflitante a partir do createdAt',
  )
  assert.match(
    botWorkerSource,
    /if \(conflicting && conflictAgeMs > SEND_DEDUP_RESERVATION_TTL_MS\) \{/,
    'decisão de "é órfã" precisa comparar contra SEND_DEDUP_RESERVATION_TTL_MS (o teto atual), não contra o expiresAt gravado na linha',
  )
  assert.match(
    botWorkerSource,
    /await db\.sendDedupKey\.delete\(\{ where: \{ id: conflicting\.id \} \}\)\.catch\(\(\) => \{\}\)/,
    'linha órfã precisa ser deletada explicitamente (deleteMany por expiresAt não alcança ela)',
  )
  assert.match(
    botWorkerSource,
    /const retried = await db\.sendDedupKey\.create\(\{/,
    'depois de deletar a linha órfã, precisa tentar reservar de novo (não desistir/bloquear à toa)',
  )
})
