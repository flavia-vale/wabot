// Checklist de operação — FONTE ÚNICA da página /materiais/checklist-operacao-whatsapp,
// do .md e do PDF em public/materiais/. Antes os três eram escritos à mão e o
// PDF ficou para trás ("lista VIP do BOTinho", 2026-09-24). Mudou aqui? Rode
// `node scripts/build-checklist-operacao.mjs` para regravar .md e .pdf.

export const CHECKLIST_OPERACAO_TITLE = 'Checklist de operação para divulgar ofertas no WhatsApp'

export const CHECKLIST_OPERACAO_INTRO =
  'Use este roteiro antes de escalar campanhas de ofertas, cupons ou links de afiliado em grupos.'

export const CHECKLIST_OPERACAO_BLOCKS = [
  ['1. Oferta', ['Preço e estoque conferidos', 'Cupom ou benefício validado', 'Prazo de validade claro', 'Categoria e público definidos']],
  ['2. Link', ['URL final abre corretamente', 'Código de afiliada presente no link final', 'Link encurtado ou limpo quando necessário', 'Destino testado no celular']],
  ['3. Texto', ['Primeira linha curta, com o benefício', 'Preço ou condição visível', 'Urgência sem promessa falsa', 'Chamada direta para clicar ou salvar']],
  ['4. Grupos', ['Origem e destino identificados', 'Nicho e público de cada grupo registrados', 'Intervalo mínimo entre envios definido', 'Grupos sensíveis fora de envios repetidos']],
  ['5. Acompanhamento', ['UTM ou sub-ID da campanha preenchido', 'Responsável por acompanhar os envios definido', 'Falhas de envio revisadas', 'Aprendizados registrados para o próximo envio']],
]

export const CHECKLIST_OPERACAO_NEXT_STEP =
  'Próximo passo: no Espelha Grupos, a troca do link pelo seu código de afiliada é automática em 6 lojas. Teste 7 dias grátis em espelhagrupos.com.br.'
