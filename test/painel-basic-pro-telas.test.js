// Divisão Basic/PRO do painel (2026-09-23) — guardas das telas. A autoridade é
// o backend (test/plano-basic-pro-divisao.test.js); aqui trava o que a cliente
// VÊ: cadeado onde o Basic não tem, e nenhuma chamada que a API recusaria.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_LANDING_PLANS } from '../dashboard/lib/marketing-content.js'
import { BASIC_FEATURE_LIST, PRO_FEATURE_LIST, PRO_FEATURES } from '../dashboard/lib/planFeatures.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('as listas de plano são as aprovadas pela dona do produto, numa fonte só', () => {
  assert.deepEqual(BASIC_FEATURE_LIST, ['Espelhamento de grupos', 'Conversão de links de 6 lojas (Shopee, Mercado Livre, Amazon, SHEIN, Magalu e AliExpress)', 'Card de oferta clicável', 'Mensagem reescrita do seu jeito', 'Envio imediato ou agendado', 'Relatórios com histórico completo'])
  assert.deepEqual(PRO_FEATURE_LIST, ['Tudo do plano Basic', 'Espelhamento de grupos e CANAIS do WhatsApp', 'Garimpo automático de ofertas', 'Filas de ofertas', 'Sua marca d’água nas ofertas', 'Horário de descanso, máximo de ofertas por dia, intervalo entre mensagens e variação do texto', 'Painel de vendas e comissão da Shopee'])
  assert.deepEqual(BASIC_FEATURE_LIST, DEFAULT_LANDING_PLANS.find(p => p.id === 'basic').features)
  for (const item of BASIC_FEATURE_LIST) assert.doesNotMatch(item, /marca d|vendas|varia/i, `o Basic não pode prometer "${item}"`)
  assert.match(read('dashboard/app/painel/plano/page.js'), /BASIC_FEATURE_LIST[\s\S]*PRO_FEATURE_LIST/)
})

test('o texto do PRO é leigo', () => {
  for (const { title, desc } of Object.values(PRO_FEATURES)) {
    assert.doesNotMatch(`${title} ${desc}`, /watermark|preset|throttle|endpoint|API|imageMode|dailyCap/i)
  }
})

test('cores do PRO: roxo + verde, sem trocar a fonte', () => {
  const css = read('dashboard/app/painel/painel.css')
  assert.match(css, /--pro: #6F4FE8/)
  assert.match(css, /--pro-gradient: linear-gradient\(135deg, var\(--accent-strong\) 0%, var\(--pro\) 100%\)/)
  assert.doesNotMatch(css, /Plus Jakarta/)
})

test('Vendas: Basic vê a página travada e NÃO consulta a Shopee', () => {
  const page = read('dashboard/app/painel/vendas/SalesDashboard.js')
  const main = page.slice(page.indexOf('export default function SalesDashboard'))
  assert.match(main, /if \(!isPro\)[\s\S]*<LockedPage/)
  assert.doesNotMatch(main, /api\.shopeeSales/, 'a consulta mora em SalesLive, que só monta com o PRO')
  assert.doesNotMatch(page, /cliques que viraram venda|taxa de conversão<\/div>/i, 'a Shopee não informa cliques totais — nada de número inventado')
})

test('Painel: card de comissão Shopee embaçado com cadeado no Basic, sem chamar a API', () => {
  const page = read('dashboard/app/painel/page.js')
  const stat = page.slice(page.indexOf('function CommissionStat'), page.indexOf('export default function PainelPage'))
  assert.match(stat, /if \(!isPro \|\| !state\.loading\) return undefined/)
  assert.match(stat, /pnl-pro-lock-content/)
  assert.match(stat, /<ProTag small \/>/)
  assert.match(page, /<CommissionStat isPro=\{isPro\} onLocked=\{\(\) => openPro\('vendas'\)\} \/>/)
})

test('Filas e Ofertas automáticas usam a página travada com prévia', () => {
  for (const p of ['dashboard/app/painel/filas/page.js', 'dashboard/app/painel/ofertas-automaticas/page.js']) {
    const page = read(p)
    assert.match(page, /<LockedPage/, p)
    assert.doesNotMatch(page, /ProFeaturePaywall/, p)
  }
  const previews = read('dashboard/components/pro/previews.js')
  assert.doesNotMatch(previews, /Priorizar comissão extra/, 'a opção de LIGAR a comissão extra saiu da tela em 2026-09-17')
  assert.doesNotMatch(previews, /Amazon|Mercado Livre/, 'ofertas automáticas são só da Shopee')
})

test('Mensagens: variação do texto com cadeado, e salvar no Basic nunca tenta ligá-la', () => {
  const page = read('dashboard/app/painel/mensagens/page.js')
  assert.match(page, /<ProLock feature="variacao">/)
  assert.match(page, /copyVariationEnabled: isPro \? value\.copyVariationEnabled : false/)
})

test('Espelhamento: marca d\'água e botão "Ver canal" do PRO', () => {
  const page = read('dashboard/app/painel/espelhamento/page.js')
  assert.match(page, /!temPro && \['original_watermark', 'preview_watermark'\]\.includes\(nextMode\)[\s\S]{0,40}openPro\('marca'\)/)
  assert.match(page, /<ProLock feature="vercanal" locked=\{!temPro\}>/)
  assert.match(page, /const canUseChannels = hasProLikeAccess\(planSubject\)/, 'premium não pode ser travado na tela')
})

test('WhatsApp: ritmo dos envios = resumo somente-leitura do preset PADRÃO da Preservação, com cadeado no Basic', () => {
  // 2026-09-24: virou resumo + link para o Anti-banimento (único lugar de
  // edição) — duas telas editando o mesmo preset em paralelo divergiam entre
  // si sem revalidação cruzada.
  const card = read('dashboard/components/pro/RhythmCard.js')
  assert.match(card, /p\.isDefault/)
  assert.doesNotMatch(card, /updatePreservationPreset\(/, 'edição saiu daqui — mora só no Anti-banimento')
  assert.doesNotMatch(card, /createPreservationPreset\(/, 'edição saiu daqui — mora só no Anti-banimento')
  assert.match(card, /<ProLock feature="ritmo">/)
  assert.match(card, /href="\/painel\/anti-banimento\?parte=ritmo"/)
  assert.match(read('dashboard/app/painel/whatsapp/page.js'), /<RhythmCard \/>/)
})

test('página pública de vendas não diz mais que está no Basic', () => {
  const page = read('dashboard/app/vendas-e-comissao-afiliado-whatsapp/page.js')
  assert.doesNotMatch(page, /incluindo o Basic|Está no Basic|todos os planos/)
  assert.doesNotMatch(read('dashboard/public/pricing.md'), /Every plan, including Basic/)
})
