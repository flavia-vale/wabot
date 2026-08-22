# Fase 0 — Provar a comissão do AliExpress ANTES de escrever o conversor

**Data das medições**: 2026-08-22, feitas deste servidor, read-only (só GET).
**Modelo seguido**: `specs/012-shein-store-support/` (SHEIN, 5ª loja) e
`scripts/diag-shein-affiliate-link.mjs`.

Esta fase existe por causa do RCA da Amazon (jul/2026): a oferta saía bonita e a comissão ia para o
vazio por 8 dias, em silêncio. **"Saiu bonita" não é "foi creditada".** Nada de código de loja antes
do gate humano do item 5.

---

## M-001 — Existe API oficial de afiliados, e ela está no ar

`https://api-sg.aliexpress.com/sync` responde **HTTP 200** e cobra assinatura:

```
GET /sync (sem sign)   → {"error_response":{"code":"MissingParameter",
                          "msg":"The input parameter “sign” … is not supplied"}}
```

Método relevante: `aliexpress.affiliate.link.generate`, com `app_key`, `app_secret` (assinatura
HMAC-SHA256), `tracking_id`, `source_values` (a URL do produto), `promotion_link_type`, `v=2.0`,
`sign_method=sha256`.

**Consequência**: o AliExpress se parece com a **Shopee** (link assinado emitido pela API, credencial
= chave + segredo + identificador de rastreio), **não** com a SHEIN/Magalu (parâmetro pendurado na
URL). Isso muda decisões de produto — ver M-005.

## M-002 — Chave inválida é recusada ANTES da assinatura

Com `sign` presente e `app_key` falso:

```
→ {"error_response":{"code":"InvalidAppKey","msg":"The specified App Key is invalid"}}
```

**Consequência**: dá para separar "credencial errada" de "assinatura errada" — é o que permite uma
mensagem honesta na tela da cliente (o equivalente ao `10020` da Shopee).

## M-003 — Link curto morto NÃO dá erro: cai numa vitrine genérica

```
GET https://s.click.aliexpress.com/e/_oInvalidCode123  → 302 → https://best.aliexpress.com
GET https://a.aliexpress.com/_mtestcode                → 302 → https://best.aliexpress.com
```

É o análogo exato da armadilha `/ark/default` da SHEIN e do `unsupported.html` da Shopee: a cadeia
"termina bem" (200/302 normais) sem produto nenhum. **Cair aqui é falha de resolução, nunca cupom.**
Publicar isso mandaria a cliente para uma vitrine sem produto — e sem comissão.

## M-004 — Os parâmetros sobrevivem ao redirecionamento por país

```
GET www.aliexpress.com/item/<id>.html?aff_fcid=…&aff_platform=…&sk=…&aff_trace_key=…&terminal_id=…
  → 302 → www.aliexpress.us/item/<outro id>.html?aff_fcid=…&aff_platform=…&sk=…&aff_trace_key=…
          &terminal_id=…&gatewayAdapt=glo2usa4itemAdapt
```

Dois achados: (a) os parâmetros de afiliado são preservados no salto de país; (b) o **código do
produto é reescrito** entre os espaços de numeração (`1005…` ↔ `32568…`). Qualquer guarda que
compare "o produto que entrou" com "o produto que saiu" precisa saber disso, senão recusa oferta
legítima (o erro inverso da SHEIN, em que a checagem por "koc" recusava a marca "Kocotree").

## M-005 — O que ainda NÃO está provado (e por isso bloqueia)

1. **Que o link assinado da API credita a cliente.** Só um clique real no celular dela, conferido no
   painel de afiliada, decide (item 5 abaixo).
2. **Qual convenção de assinatura o gateway aceita** (base com ou sem `/sync` na frente). O script
   tenta as duas e informa qual passou — medição, não suposição. Só é observável com credencial real.
3. **Se a cliente tem acesso à API liberado.** O acesso à API de afiliados do AliExpress é aprovado
   caso a caso no painel dela. Sem isso, não há caminho oficial de conversão — e o caminho de
   parâmetro pendurado é justamente o que o RCA do `partner_id` do ML mostrou não creditar.

## D-001 — A cliente tem conta de afiliada, mas **não** tem acesso à API (2026-08-22)

Confirmado com ela. Consequências:

- **Caminho A (API oficial)** — o forte, do mesmo formato da Shopee — fica **bloqueado** até o
  AliExpress aprovar o pedido de acesso à API (portals.aliexpress.com → Ferramentas → API → Apply
  Now). Sem aprovação não há link assinado.
- **Caminho B (transplante de identidade)** — pegar o que identifica a cliente no link dela e aplicar
  no endereço do produto que veio do grupo, como já é feito na SHEIN e no Magalu — **pode ser
  provado hoje**, sem API, com um clique real no celular.

O script mede os dois. O caminho B é explicitamente marcado como **hipótese não provada**: é
exatamente o formato de erro do `partner_id` do Mercado Livre (pendurar parâmetro em página que não
credita) e do RCA da Amazon. Nada de conversor enquanto o clique não aparecer no painel dela.

## Ferramenta

`scripts/diag-aliexpress-affiliate-link.mjs` — read-only (não toca banco, não envia nada). Resolve a
cadeia com saltos manuais, cookie jar, teto de 512KB por corpo e orçamento **total** de tempo (não
por salto — a lição do `MSG_QUEUE_TIMEOUT_MS`); mostra quem ganha a comissão hoje; chama a API oficial
com as duas convenções de assinatura; e confere que nenhum identificador de terceiro sobrou no link
gerado.

```bash
# sem API (o que dá para fazer agora):
node scripts/diag-aliexpress-affiliate-link.mjs '<SEU link de afiliada>' '<link de outro afiliado>'

# com API, quando o acesso for liberado:
node scripts/diag-aliexpress-affiliate-link.mjs '<SEU link>' '<link do outro>' \
  --app-key=… --app-secret=… --tracking-id=…
```

As chaves nunca precisam sair do VPS: a cliente roda o script lá e manda só a saída.

## O que falta para liberar a Fase 1

- [ ] Um link de afiliada real da cliente (AliExpress).
- [ ] Um link de **outro** afiliado, do tipo que chega nos grupos monitorados.
- [ ] **Gate humano (caminho B)**: ela abre no celular o link montado por transplante e confirma o
      clique no painel de afiliada. Um caminho por vez, senão não dá para saber qual creditou.
- [ ] (Em paralelo, sem bloquear) pedido de acesso à API no painel de afiliada; quando aprovado,
      chave, segredo e Tracking ID liberam o caminho A, que é o preferido.

**Se o caminho B não creditar e a API não for aprovada, a feature não tem como existir** — e essa é
uma resposta legítima da Fase 0, muito mais barata que descobrir depois de implementada.
