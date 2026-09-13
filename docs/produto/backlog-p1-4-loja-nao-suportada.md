# Backlog · P1-4 — Registrar loja não suportada (e consertar o link que some em silêncio)

Status: **não implementado, no backlog por decisão da dona do produto (11/09/2026).**
As outras nove issues de `docs/produto/issues-priorizadas-2026-09-11.md` foram executadas.

Esta ficou de fora porque é a única que mexe em **código de robô**
(`src/messageProcessor.js` e `src/bot-worker.js`), e em modo `remote` isso exige
reiniciar o `bot-supervisor` — o que **reconecta todas as sessões de WhatsApp de
uma vez**. É decisão humana e precisa ser anunciada antes. As outras nove só
tocaram dashboard e conteúdo, e sobem sem encostar em sessão nenhuma.

---

## 1. São dois problemas, não um

### 1a. Defeito real: o link some e ninguém fica sabendo

`removeNonOfferUrls` (`src/messageProcessor.js:89`, chamada de
`sanitizeInviteLinks` na linha 103) apaga **toda** URL `http(s)` que não case com
as seis lojas de `src/detector.js`:

```js
function removeNonOfferUrls(text) {
  return String(text ?? '').replace(ANY_HTTP_URL_RE, (match) => {
    const trailing = match.match(TRAILING_URL_NOISE_RE)?.[0] ?? ''
    const core = trailing ? match.slice(0, match.length - trailing.length) : match
    return isOfferUrl(core) ? match : trailing
  })
}
```

Consequência medida no código, não suposta: uma oferta cujo **único** link é de
Temu, Kabum, Natura ou qualquer loja fora da lista é **publicada com o link
removido**. Ela não vira `skip:no_valid_conversions`, não gera linha de erro, não
aparece no painel e não emite sinal nenhum.

A cliente vê uma oferta sem link chegar ao grupo e não tem como descobrir por
quê. Do lado dela, o robô simplesmente publicou errado.

⚠️ **O comportamento de apagar está CERTO e não deve mudar.** Encaminhar link de
terceiro é justamente o que dá a comissão dela ao concorrente — é a mesma
invariante de `skip:no_valid_conversions`. O defeito é o **silêncio**, não a
remoção.

### 1b. Cegueira: existe um marcador e ele não responde a pergunta

Existe hoje um marcador parcial em `src/bot-worker.js:3465`:

```js
const unsupportedStoreSuffix = links.length === 0 && hasGenericUrl ? ':unsupported_store' : ''
```

Duas limitações que o tornam inútil para decidir loja nova:

1. **Só dispara no ramo em que a POLÍTICA do grupo já bloqueou** a mensagem
   (`skip:policy:<forwardMode>:<noLinkScope>:<messageKind>`). O caminho de 1a —
   mensagem publicada com o link apagado — não passa por ali.
2. **Não guarda qual domínio era.** Então não responde "que loja as minhas
   clientes estão tentando usar e nós não suportamos".

---

## 2. Por que isso decide dinheiro

O Planejador e o Trends se **contradizem** em Temu, e nenhum dos dois decide:

| Fonte | Termo | Valor |
|---|---|---|
| Planejador (10/09) | `afiliado temu` | 50.000/mês, **+900% em 3 meses** |
| Planejador (10/09) | `programa de afiliados temu brasil` | 500/mês, **−90% em 3 meses** |
| Trends (12 meses) | `afiliado temu` | índice **1,8**, estável, 15% das semanas em zero |

Os dois saltos são **artefato de balde**: o Planejador arredonda para
50 / 500 / 5.000 / 50.000, e um degrau para cima ou para baixo renderiza como
+900% ou −90%. Não é medição de crescimento.

**O que decide é dado nosso:** quantas ofertas de cada loja não suportada as
clientes já estão tentando espelhar hoje. Ninguém precisa adivinhar — é só
medir. É exatamente isso que esta issue entrega.

---

## 3. O que construir

1. **No caminho do strip** (1a), registrar que houve link de loja não suportada.
2. **Guardar apenas três coisas:** o **domínio registrável** (`temu.com`), o
   **dia** e a **contagem**. Nunca a URL, o caminho, a query, o texto da
   mensagem nem qualquer identificador da cliente junto do domínio.
3. **Poda automática em 30 dias.**
4. **Sinal durável agregado** por janela, na allowlist de `src/analytics.js` —
   nunca um evento por mensagem.
5. **Sem processo PM2 novo e sem timer novo.**

### Instrução literal da dona do produto

> *"instrumente sem guardar informações irrelevantes, apague logo em seguida o
> que não precisar."*

Domínio + dia + contagem é o mínimo que responde à pergunta. Qualquer coisa além
disso sai do escopo.

### Precedente de privacidade já estabelecido no repo

`referral_visit` grava **só o host** do referenciador, nunca a URL completa,
porque URL de buscador carrega o termo pesquisado. Guarda em
`test/ai-referral.test.js`. **A mesma regra vale aqui** — e pelo mesmo motivo:
o caminho e a query de um link de produto identificam o produto e, com ele, a
operação da cliente.

⚠️ Não existe helper de domínio registrável no repo hoje
(`grep -rn "registrableDomain\|publicSuffix" src/` volta vazio). Ou se escreve um
puro e pequeno, ou se usa `URL.hostname` com `replace(/^www\./, '')` — o segundo
é suficiente para a pergunta e não traz dependência nova. **Dependência nova é
memória nova** e cai na REGRA #1 da política de memória.

---

## 4. Custo

**Desprezível.** Um contador agregado por domínio por dia, podado em 30 dias.
Nenhum processo novo, nenhum timer novo, nenhuma dependência nova.

Se a implementação precisar de tabela nova, ela é de ordem de grandeza
"algumas dezenas de linhas por dia" (um domínio distinto por dia, não uma linha
por mensagem). Se a contagem virar linha por mensagem, a issue está errada.

---

## 5. Deploy — o motivo de isto estar no backlog

Mexe em `src/messageProcessor.js` e `src/bot-worker.js`. Os dois estão em
`WORKER_CODE_PATHS_RE`, então:

- o deploy **reinicia o `bot-supervisor` sozinho** (comportamento desde
  2026-08-26, corrigido de fato em 2026-08-31);
- isso **reconecta TODAS as sessões de WhatsApp de uma vez**;
- **anunciar antes.** Nunca às cegas.

Em modo `remote`, sem esse restart o código novo fica no disco e **não vale** —
os workers seguem com o módulo antigo em memória. Ver "código novo não carregado
pelos bots" no AGENTS.md.

---

## 6. Guardas (obrigatórias)

- **Teste de privacidade:** falha se URL, caminho, query ou texto de mensagem
  chegarem ao que é persistido. É a guarda mais importante desta issue.
- **Teste do defeito 1a:** uma mensagem cujo único link é de loja não suportada
  precisa produzir registro. Hoje ela não produz nada — o teste deve falhar
  contra o código atual antes de passar.
- **Teste de agregação:** N mensagens do mesmo domínio no mesmo dia não podem
  virar N eventos.
- **Teste de poda:** registro com mais de 30 dias some.

---

## 7. Não regredir

- **Não voltar a encaminhar o link de terceiro.** A remoção continua; o que muda
  é ela deixar rastro.
- **Nada além de domínio + dia + contagem** pode ser persistido.
- **Sinal agregado, nunca por mensagem.**
- **Sem processo PM2 novo, sem timer novo, sem dependência nova.**

---

## 8. Critério de aceite

1. Rodando em produção por 7 dias, é possível responder, sem entrar no VPS:
   **"quais lojas não suportadas as clientes tentaram usar, e quantas vezes cada
   uma?"**
2. Nenhuma URL, caminho, query ou texto de mensagem aparece no que foi gravado.
3. A decisão sobre Temu passa a ter dado próprio, em vez dos dois números
   contraditórios do Planejador.
4. Uma oferta com link de loja não suportada deixa de sumir em silêncio.

---

## 9. Carona: dois comentários desatualizados no mesmo arquivo

Não valem uma PR própria — reiniciar o supervisor por causa de comentário
custaria a reconexão de todas as sessões. **Corrigir junto quando esta issue for
implementada**, já que ela toca o mesmo arquivo:

- `src/messageProcessor.js:82` — o comentário de `removeNonOfferUrls` diz
  "(Amazon, Shopee, Mercado Livre, Magalu)". São **seis** lojas desde que SHEIN e
  AliExpress entraram: a lista real está em `PATTERNS`, em `src/detector.js`.
