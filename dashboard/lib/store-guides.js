export const STORE_GUIDES = {
  'shopee-afiliados': {
    name: 'Shopee', platformId: 'shopee', joinUrl: 'https://affiliate.shopee.com.br/',
    signup: ['Abra o Programa de Afiliados da Shopee e entre com a conta que receberá as comissões.', 'Conclua o cadastro e aguarde a aprovação do programa antes de procurar as chaves.', 'Depois da aprovação, abra Ferramentas → API de Afiliados e solicite o acesso, se ele ainda não estiver liberado.'],
    identifier: 'Na área de API de Afiliados, copie o App ID e a chave secreta. A chave é sigilosa: não envie por mensagem e não cole fora do painel.',
  },
  'amazon-afiliados': {
    name: 'Amazon', platformId: 'amazon', joinUrl: 'https://associados.amazon.com.br/',
    signup: ['Abra o Portal de Associados Amazon e crie a conta do programa.', 'Informe os canais em que você divulga e conclua os dados de pagamento e tributários pedidos pela Amazon.', 'Espere a conta ficar disponível antes de testar a conversão.'],
    identifier: 'No topo do Portal de Associados aparece seu Store ID, também chamado de etiqueta. Ele costuma terminar em “-20”. O código de acesso é opcional no Espelha Grupos e serve para gerar link curto.',
  },
  'mercado-livre-afiliados': {
    name: 'Mercado Livre', platformId: 'mercadolivre', joinUrl: 'https://www.mercadolivre.com.br/afiliados',
    signup: ['Entre no Programa de Afiliados e Criadores do Mercado Livre com a conta que você usa para divulgar.', 'Conclua o cadastro e aceite os termos do programa.', 'Abra o Gerador de Links depois que a conta estiver habilitada.'],
    identifier: 'No Gerador de Links, copie a “etiqueta em uso”. O SSID é opcional no painel e deixa o link mais curto; trate esse código como senha.',
  },
  'magalu-afiliados': {
    name: 'Magazine Luiza', platformId: 'magazineluiza', joinUrl: 'https://www.magazinevoce.com.br/',
    signup: ['Crie sua loja no Magazine Você e conclua o cadastro solicitado pela plataforma.', 'Espere a loja ficar ativa e abra o painel de administração.', 'Gere um link de produto para conferir a identificação usada pela sua loja.'],
    identifier: 'Copie a etiqueta da sua loja que aparece nos links do Magazine Você. Esse é o único campo obrigatório no Espelha Grupos.',
  },
  'shein-afiliados': {
    name: 'SHEIN', platformId: 'shein', joinUrl: 'https://m.shein.com/br/affiliate/recruit?source=campuslp',
    signup: ['Abra a página oficial do programa de afiliados SHEIN e envie o cadastro.', 'Aguarde a aprovação e acesse o painel de afiliada.', 'Abra Minha conta ou o Gerador de Link.'],
    identifier: 'Copie o ID de afiliada em Minha conta. Se não o localizar, gere o link de um produto no painel e cole esse link no campo: o Espelha Grupos identifica o código.',
  },
  'aliexpress-afiliados': {
    name: 'AliExpress', platformId: 'aliexpress', joinUrl: 'https://portals.aliexpress.com/',
    signup: ['Abra o portal de afiliados AliExpress e entre com a conta da operação.', 'Conclua o cadastro e aguarde a habilitação do portal.', 'Faça login no portal pelo computador antes de copiar o acesso.'],
    identifier: 'O portal não fornece um ID simples para este fluxo. No computador, exporte o JSON da sessão com Cookie-Editor e cole somente no campo protegido do painel.',
  },
}

export const STORE_GUIDE_SLUGS = Object.keys(STORE_GUIDES)
export const STORE_GUIDE_BY_PLATFORM = Object.fromEntries(
  Object.entries(STORE_GUIDES).map(([slug, guide]) => [guide.platformId, slug]),
)
