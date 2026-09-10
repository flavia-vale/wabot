# Feature Specification — AliExpress como loja de conversão

**Status:** Implemented, aguardando validação com credenciais reais em staging  
**Created:** 2026-09-10

## Contrato do produto

A cliente cadastra o código de acesso exportado da sessão autenticada em
`portals.aliexpress.com`; ela não precisa procurar ID, App Key nem segredo. Ao
encontrar um endereço `aliexpress.com`/`aliexpress.us`, o robô remove a
atribuição do afiliado de origem e chama o mesmo gerador usado pelo portal,
`generatePromotionLinkV2.htm`, com `shipTos=BR` e `trackId=default`. O endereço
original ou uma conversão parcial **nunca** é publicado como fallback.

## Histórias e critérios de aceite

### US1 — Configurar a loja

1. AliExpress aparece nas credenciais e nos seletores de loja.
2. A tela pede **somente o JSON do Cookie-Editor** em um único campo obrigatório;
   espaços externos são removidos e exportações vazias/malformadas são recusadas
   em linguagem leiga. ID, App Key, App Secret e tracking ID não aparecem.
3. O código aparece mascarado e é armazenado pela criptografia comum de
   credenciais.
4. Salvar/apagar exige autenticação e só altera a conta do JWT.

### US2 — Converter produto

1. Produto direto e short link oficial são detectados.
2. Short links são resolvidos manualmente, com no máximo seis hops e oito
   segundos no total; todo hop deve permanecer em domínio oficial HTTPS.
3. `aff_*`, `utm_*` e demais identificadores conhecidos do afiliado de origem
   são removidos antes da chamada à API.
4. A resposta só é aceita quando contém URL HTTPS em domínio oficial da
   AliExpress. JSON inválido, 4xx/5xx, timeout, domínio externo e loop falham
   fechado.
5. O registro de envio identifica a loja e classifica o endereço como produto.

### US3 — Converter cupom/campanha

1. Campanhas sem item ID passam pelo mesmo gerador oficial e são classificadas
   como `coupon`.
2. Quando habilitado, o card usa o banner AliExpress; nunca usa uma foto de
   produto aleatório como se pertencesse ao cupom.

### US4 — Operação e regressão

1. Configurações existentes ganham AliExpress uma única vez por migration
   idempotente.
2. A migration também normaliza o valor legado `,shein` para `shein`.
3. Nenhum processo, fila ou dependência externa de pacote é adicionado.
4. As cinco lojas anteriores mantêm detector, conversor e configuração.

## Segurança e limites

- Hosts sósia (`aliexpress.com.evil.test`), credenciais embutidas no URL e HTTP
  são recusados.
- O código de acesso segue somente no header `Cookie`; nunca entra na URL,
  resposta, erro ou log.
- O campo aceita Header string ou JSON do Cookie-Editor, com teto de 120.000
  caracteres.
- `targetUrl` é codificado por `URLSearchParams`, nunca concatenado manualmente.

## Gate manual obrigatório

Antes de promover para produção, usar credenciais reais em staging para:

1. converter produto direto, `a.aliexpress.com` e `s.click.aliexpress.com`;
2. abrir o resultado no celular e confirmar o mesmo SKU/variante;
3. confirmar o clique e a atribuição no relatório do portal de afiliados;
4. simular credencial inválida e indisponibilidade sem vazamento do link de
   origem;
5. espelhar produto e cupom em grupo real, validando card e registro.
