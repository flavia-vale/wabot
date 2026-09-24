// De quem a API aceita o cabeçalho X-Forwarded-For (RCA 2026-09-23).
//
// Antes era `trustProxy: true`: o Fastify confiava na cadeia INTEIRA e usava o
// endereço mais à esquerda — que é o que o visitante escreve. Medido em
// produção: mandando `X-Forwarded-For: 203.0.113.x` o contador do limite de
// requisições passou a contar pelo IP inventado, e `X-Forwarded-For: 127.0.0.1`
// abriu o `/metrics`, que só deveria responder para a própria máquina. Ou
// seja, todo limite por IP (login, cadastro, esqueci a senha, analytics) podia
// ser contornado trocando o cabeçalho a cada pedido.
//
// Caminho real de um pedido: visitante → Cloudflare → nginx (nesta máquina) →
// Next (127.0.0.1) → API. A Cloudflare ACRESCENTA o IP do visitante ao fim do
// X-Forwarded-For que recebeu, então a cadeia chega assim:
//   "<o que o visitante inventou>, <IP real>, <IP da borda da Cloudflare>"
// Confiando só na própria máquina e nas faixas publicadas da Cloudflare, o
// Fastify anda da direita para a esquerda, pula os saltos confiáveis e para no
// primeiro que não é — o IP real. O que o visitante inventou fica à esquerda e
// nunca é lido.
//
// Quem fala direto com a origem (sem passar pela Cloudflare) não está nessas
// faixas, então o IP dele é o que vale, com ou sem cabeçalho.
//
// Fonte das faixas: https://www.cloudflare.com/ips-v4 e /ips-v6 (conferido em
// 2026-09-23). A Cloudflare muda essa lista raramente; se mudar, pedidos das
// faixas novas passam a contar pelo IP da borda (limite mais apertado, nunca
// mais frouxo). Atualizar aqui quando acontecer.
export const CLOUDFLARE_IP_RANGES = Object.freeze([
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
])

// 'loopback' = 127.0.0.0/8 e ::1 (nginx e o proxy do Next nesta máquina).
export const TRUSTED_PROXIES = Object.freeze(['loopback', ...CLOUDFLARE_IP_RANGES])
