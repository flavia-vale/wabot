# Feature Specification — AliExpress como loja de conversão

**Status:** Implemented, aguardando validação com credenciais reais em staging  
**Created:** 2026-09-10

## Contrato do produto

A cliente cadastra os três dados do aplicativo no portal de afiliados da
AliExpress: chave do aplicativo, segredo do aplicativo e identificação de
rastreamento. Ao encontrar um endereço `aliexpress.com`/`aliexpress.us`, o robô
remove a atribuição do afiliado de origem e solicita à API oficial
`aliexpress.affiliate.link.generate` um novo link. O endereço original ou uma
conversão parcial **nunca** é publicado como fallback.

## Histórias e critérios de aceite

### US1 — Configurar a loja

1. AliExpress aparece nas credenciais e nos seletores de loja.
2. Os três campos são obrigatórios, espaços externos são removidos e valores
   vazios/malformados são recusados em linguagem leiga.
3. O segredo aparece mascarado e é armazenado pela criptografia comum de
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
- O `appSecret` participa apenas da assinatura HMAC-SHA256 e nunca é incluído no
  corpo da requisição, URL, erro ou log.
- `appKey` tem no máximo 32 dígitos, `appSecret` 16–256 caracteres sem espaços e
  `trackingId` no máximo 128 caracteres sem caracteres de controle.
- A API recebe `application/x-www-form-urlencoded`; valores são codificados por
  `URLSearchParams`, não concatenados manualmente.

## Gate manual obrigatório

Antes de promover para produção, usar credenciais reais em staging para:

1. converter produto direto, `a.aliexpress.com` e `s.click.aliexpress.com`;
2. abrir o resultado no celular e confirmar o mesmo SKU/variante;
3. confirmar o clique e a atribuição no relatório do portal de afiliados;
4. simular credencial inválida e indisponibilidade sem vazamento do link de
   origem;
5. espelhar produto e cupom em grupo real, validando card e registro.

