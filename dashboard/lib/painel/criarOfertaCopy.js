// Copy do "Criar oferta" que precisa de teste (fica fora do page.js porque o
// App Router do Next só aceita exports conhecidos em page.js).
//
// SHEIN (2026-09-30, conta promosdaella): a SHEIN responde captcha a qualquer
// leitura de página/API de produto feita pelo servidor — medido da VPS e de
// fora, com e sem o cookie da cliente. Então o PREÇO nunca vem por leitura
// automática; o NOME vem da página do oneLink (og:title, sem captcha). O aviso
// diz isso com todas as letras para a cliente não ficar conferindo link e
// cadastro que estão certos. Ver docs/rca/lojas-conversao.md.
export const SHEIN_SEM_PRECO_TITULO = 'A SHEIN não deixa ler o preço automaticamente.'
export const SHEIN_SEM_PRECO_TEXTO = 'Isso é da SHEIN, não do seu link nem do seu cadastro. Escreva o preço na mensagem abaixo antes de enviar — o link já sai com o seu ID de afiliada.'
export const SHEIN_SEM_NOME = 'A SHEIN bloqueou a leitura do nome do produto desta vez. Escreva o nome na mensagem antes de enviar — o link já sai com o seu ID.'
export const SHEIN_SEM_NOME_E_PRECO = 'A SHEIN não deixa ler nome e preço automaticamente. Escreva os dois na mensagem antes de enviar — o link já sai com o seu ID de afiliada.'
