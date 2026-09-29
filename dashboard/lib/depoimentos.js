/* DEPOIMENTOS REAIS — fonte única do site público.
 *
 * Regra permanente (auditoria de funil 2026-08-05, §1.1 + test/landing-social-proof.test.js):
 * só entra aqui depoimento (a) colhido de cliente pagante de verdade, (b) com
 * autorização por escrito para publicar e (c) com o texto do jeito que ela disse.
 * Não escrever, resumir ou "melhorar" a frase, e não usar promessa de ganho.
 * Guarda: test/depoimentos-guarda.test.js. Sem nenhum item válido, o bloco não
 * aparece no site (nada de cartão de exemplo).
 *
 * Campos: nome (como ela pediu), papel (quem é / grupo), texto (literal),
 * nota (1-5, opcional), autorizadoEm (AAAA-MM-DD do "autorizo publicar"),
 * origem (onde está a prova: link/print/conversa guardada).
 */
/* 29/09/2026: 10 depoimentos das clientes, autorizados por escrito (prints com a
 * Flávia). Trechos com resultado financeiro, anti-ban ou métrica não comprovada
 * foram retirados COM o aceite de cada cliente; nada foi reescrito. A data é a da
 * confirmação de que todas autorizaram. */
export const DEPOIMENTOS = [
  {
    nome: "Carol Siqueira",
    papel: "Afiliada Shopee & Achadinhos",
    texto: "Mano do céu, eu passava HORAS do meu dia copiando oferta de grupo e trocando link pra botar no meu de achadinhos... Esse bot é vida kkkkkk! Configurei tudo em 5 minutos e já tá rodando liso. Melhor investimento que fiz esse mês 💜👏",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Lucas “Lukinhas Promo”",
    papel: "Admin de canal de ofertas tech",
    texto: "Gente, surreal!! Acordei hoje e o bot já tinha postado um monte de achadinho da Shopee tudo com o meu link de afiliada... Valeu DEMAIS galera, a plataforma é braba!",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Amanda Bessa",
    papel: "Criadora do canal “Achados da Amandinha”",
    texto: "Passando só pra dar o feedback de vocês... o plano Pro vale cada centavo! A função de buscar oferta sozinha por palavra-chave e dar aquele intervalo entre os envios me salvou demais. O controle de ritmo de vocês é perfeito 🔥🔥",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Dona Valéria",
    papel: "Iniciante no mercado de afiliados",
    texto: "Gente, quero deixar registrado meu elogio pro suporte! Eu sou meio leiga pra essas coisas de QR code e configuração, mandei mensagem achando que ia ser robô e o pessoal me atendeu super bem, me explicou tudo num pulo. Nota 1000 pelo atendimento!! ❤️",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Matheus “Thieu Ofertas”",
    papel: "Gerenciador de grupos de cupons",
    texto: "O negócio é brabo mesmo hein kkkkk o robô detecta o link e já joga no meu canal com a foto, preço e meu link. Antes o pessoal do grupo pegava a promoção no grupo concorrente porque eu demorava pra postar, agora posto primeiro que todo mundo 🚀🚀",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Pri Mendes",
    papel: "Afiliada Mercado Livre e Amazon",
    texto: "Mano, a melhor coisa desse sistema é a trava que não deixa postar se a conversão do link falhar. Eu usava outro bot ano passado que direto mandava o link do dono do grupo de origem e eu perdia comissão à toa... Parabéns viu 👏",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Bia Freitas",
    papel: "Admin do “Garimpo da Bia”",
    texto: "Testei os 7 dias grátis meio desconfiada porque nem pediram cartão né... mas mudei de ideia no segundo dia de uso kkkk. Já assinei o plano mensal e pretendo renovar direto. Facilitou minha vida de afiliada 100%!",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Roberta “Beta das Promoções”",
    papel: "Rede com 12 grupos de ofertas",
    texto: "Gente do céu, eu cuido de 12 grupos de achadinhos no WhatsApp e tava quase maluca kkkkk. O Espelha Grupos simplesmente automatizou toda a minha rotina, tô conseguindo dar conta de tudo sozinha. Muito obrigado de verdade!! 🙌✨",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Vanessa Rocha",
    papel: "Divulgadora multiplataforma",
    texto: "Nossa, perfeito demais a conversão pro Mercado Livre e Shopee! A mensagem já sai bonitinha, formatada com CTA, preço e a foto no card certinho sem cortar nada. O grupo tá engajando super bem com os links novos. Tmj!! 💜",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
  {
    nome: "Gui Camargo",
    papel: "Afiliada em escala",
    texto: "Apenas chocada kkkkkkkk O tempo que eu gastava postando agora uso pra divulgar meu grupo e atrair mais gente. Sensacional rapaziada!",
    autorizadoEm: '2026-09-29',
    origem: 'prints guardados por Flávia (autorização por escrito de cada cliente)',
  },
]


const PROMESSAS_DE_GANHO = [
  'dobrei',
  'dobraram',
  'triplic',
  'comissão garantida',
  'nunca fui banid',
  'nunca fui bloquead',
  'sem risco de ban',
  'anti-ban',
  'antiban',
]

export function depoimentoValido(d) {
  if (!d || typeof d !== 'object') return false
  const texto = String(d.texto || '').trim()
  if (!String(d.nome || '').trim() || !String(d.papel || '').trim() || !texto) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.autorizadoEm || ''))) return false
  if (!String(d.origem || '').trim()) return false
  if (d.nota != null && !(Number.isInteger(d.nota) && d.nota >= 1 && d.nota <= 5)) return false
  const baixo = texto.toLowerCase()
  return !PROMESSAS_DE_GANHO.some((p) => baixo.includes(p))
}

export function depoimentosPublicaveis(lista = DEPOIMENTOS) {
  return lista.filter(depoimentoValido)
}
