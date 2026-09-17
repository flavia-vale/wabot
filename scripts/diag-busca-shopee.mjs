#!/usr/bin/env node
/**
 * Diagnóstico: o que CADA lista da Shopee devolve para a mesma palavra-chave.
 *
 * Por que existe: a busca das ofertas automáticas tem DOIS eixos independentes
 * na API de afiliado (`productOfferV2`) — de qual lista tirar os candidatos
 * (`listType`) e em que ordem devolvê-los (`sortType`). A ordem está
 * documentada e bate com o código; a LISTA não. O comentário em
 * `src/api/routes/offerAutomation.js` diz "0=Recomendados 1=Maior comissão
 * 2=Melhor desempenho", mas a documentação pública da Shopee não descreve
 * `listType: 1` — que é justamente o nosso padrão em produção desde sempre.
 *
 * Trocar esse padrão mudaria a busca de TODA automação que já existe, então a
 * decisão não pode sair de palpite. Este script roda a MESMA busca do robô,
 * com a chave real da cliente, nas três listas, e mostra lado a lado o que
 * cada uma devolve: quantos produtos, quais, por qual preço e pagando quanto
 * de comissão. É com isso que se confere (ou derruba) a hipótese de que a
 * lista de maior comissão é o que deixa o produto caro de fora.
 *
 * NÃO envia nada, NÃO grava nada, NÃO mexe em automação nenhuma — só consulta
 * a Shopee e imprime. A busca é feita por `fetchOffers`, o MESMO código do
 * robô: script que reimplementa a consulta passa a discordar do produto em
 * silêncio.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-busca-shopee.mjs <email|nome> "<palavra-chave>"
 *
 * Opções:
 *   --ordem=2        sortType fixo nas três listas (1 parecidos, 2 mais vendidos,
 *                    3 mais caros, 4 mais baratos, 5 maior comissão). Padrão: 2.
 *   --lista=1        compara as CINCO ordens dentro de UMA lista só.
 *   --desconto=0     desconto mínimo, igual ao campo da automação. Padrão: 0
 *                    (sem filtro — para ver a lista crua).
 *   --quantos=5      quantos produtos imprimir por combinação. Padrão: 5.
 */

import 'dotenv/config'
import db from '../src/db.js'
import { decryptCredential } from '../src/credentialCrypto.js'
import { fetchOffers, resolveShopeeOfferPrice } from '../src/offerAutomation/shopeeOffers.js'

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const livres = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const who = livres[0]
const keyword = livres.slice(1).join(' ').trim()

const ordemFixa = Number(arg('ordem') ?? 2)
const listaFixa = arg('lista') === null ? null : Number(arg('lista'))
const minDiscountPct = Number(arg('desconto') ?? 0)
const quantos = Number(arg('quantos') ?? 5)

if (!who || !keyword) {
  console.error('Uso: node scripts/diag-busca-shopee.mjs <email|nome> "<palavra-chave>"')
  console.error('     [--ordem=2] [--lista=1] [--desconto=0] [--quantos=5]')
  process.exit(1)
}

const LISTAS = [
  { value: 0, nome: 'listType 0' },
  { value: 1, nome: 'listType 1 (nosso padrão hoje)' },
  { value: 2, nome: 'listType 2' },
]
const ORDENS = [
  { value: 1, nome: 'sortType 1 — mais parecidos' },
  { value: 2, nome: 'sortType 2 — mais vendidos' },
  { value: 3, nome: 'sortType 3 — mais caros' },
  { value: 4, nome: 'sortType 4 — mais baratos' },
  { value: 5, nome: 'sortType 5 — maior comissão' },
]

const user = await db.user.findFirst({
  where: { OR: [{ email: { contains: who } }, { name: { contains: who } }] },
  select: { id: true, name: true, email: true },
})
if (!user) {
  console.error(`Nenhuma conta encontrada para "${who}".`)
  process.exit(1)
}

const row = await db.credential.findFirst({ where: { userId: user.id, platform: 'shopee' } })
let creds = null
if (row) {
  // Falha de leitura da credencial é IMPRESSA, nunca engolida: script de
  // diagnóstico que transforma erro em "não achei" vira conclusão errada
  // (lição do diag-assinatura-recusada.mjs).
  try {
    creds = JSON.parse(decryptCredential(row.data))
  } catch (err) {
    console.error(`[credencial] não consegui ler a credencial da Shopee: ${err.message}`)
    process.exit(1)
  }
}
if (!creds?.appId || !creds?.secretKey) {
  console.error('[credencial] esta conta não tem App ID + chave secreta da Shopee cadastrados.')
  console.error('             Sem eles a API de afiliado não responde nada.')
  process.exit(1)
}

console.log(`\n=== Busca da Shopee — ${user.name} <${user.email}> ===`)
console.log(`Palavra-chave: "${keyword}"`)
console.log(`Desconto mínimo aplicado: ${minDiscountPct}%  ·  imprimindo até ${quantos} por combinação\n`)

const brl = (n) => (n === null ? '     sem preço' : `R$ ${n.toFixed(2).padStart(9)}`)

async function rodar({ listType, sortType, titulo }) {
  console.log(`\n────────────────────────────────────────────────────────────`)
  console.log(titulo)
  try {
    const { offers, rawCount, dropped } = await fetchOffers({
      keyword,
      minDiscountPct,
      limit: Math.max(quantos, 5),
      excludeItemIds: [],
      creds,
      sortType,
      listType,
      page: 1,
    })
    const descartes = Object.entries(dropped)
      .map(([motivo, n]) => `${motivo}=${n}`)
      .join(' ')
    console.log(`  a Shopee devolveu ${rawCount} · sobraram ${offers.length} depois do filtro${descartes ? ` (${descartes})` : ''}`)
    if (!offers.length) {
      console.log('  (nenhum produto)')
      return
    }
    for (const o of offers.slice(0, quantos)) {
      const preco = brl(resolveShopeeOfferPrice(o))
      // `commissionRate` sai CRU: a escala que a Shopee usa aqui (0,15 ou 15)
      // não está verificada em lugar nenhum do repositório, e converter por
      // palpite imprimiria "1500%". Quem decide a escala é esta medição.
      const comissao = String(o.commissionRate ?? '—').padStart(8)
      const desconto = `${Number(o.priceDiscountRate) || 0}%`.padStart(4)
      const nome = String(o.productName ?? '').replace(/\s+/g, ' ').slice(0, 68)
      console.log(`  ${preco}  comissão ${comissao}  desc ${desconto}  ${nome}`)
    }
  } catch (err) {
    // A API responde 200 mesmo em erro e sinaliza em `errors`; fetchOffers
    // converte isso em exceção. Imprimir o motivo é o ponto do script.
    console.log(`  ERRO: ${err.message}`)
  }
}

if (listaFixa === null) {
  const ordem = ORDENS.find((o) => o.value === ordemFixa)
  console.log(`Comparando as três listas, todas com ${ordem ? ordem.nome : `sortType ${ordemFixa}`}.`)
  for (const lista of LISTAS) {
    await rodar({ listType: lista.value, sortType: ordemFixa, titulo: `${lista.nome}` })
  }
} else {
  console.log(`Comparando as cinco ordens dentro de listType ${listaFixa}.`)
  for (const ordem of ORDENS) {
    await rodar({ listType: listaFixa, sortType: ordem.value, titulo: `${ordem.nome}` })
  }
}

console.log('\n────────────────────────────────────────────────────────────')
console.log('Como ler: se o produto que a cliente procura aparecer numa lista e')
console.log('não nas outras, é a LISTA que está filtrando — não a ordenação.')
console.log('Se ele não aparecer em nenhuma, o assunto é outro (palavra-chave,')
console.log('catálogo de afiliado ou filtro de categoria, que hoje não usamos).\n')

await db.$disconnect()
