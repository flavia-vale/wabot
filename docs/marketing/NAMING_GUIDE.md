# Naming do projeto — decisão canônica (revista em 2026-09-02)

> Substitui as decisões de **2026-05-17** ("marca oficial: BOTinho") e de
> **2026-08-04** ("dois nomes amarrados por schema"). As duas estão medidas e
> reprovadas — a seção "Histórico" no fim guarda o que foi tentado e por quê,
> para ninguém refazer o mesmo caminho.

## Decisão

## **Um nome só na superfície pública: Espelha Grupos**

Marca, produto e domínio são a mesma coisa. Não existe segundo nome público.

| Onde | O que escrever |
|---|---|
| Site, blog, LPs, título, descrição, schema | **Espelha Grupos** |
| E-mails transacionais e de divulgação | **Espelha Grupos** ("Equipe Espelha Grupos") |
| Termos de uso e política de privacidade | **Espelha Grupos** |
| Fatura do cartão (`statement_descriptor`) | **Espelha Grupos** |
| Nome dos planos na cobrança | **Espelha Grupos Basic / Pro** |
| Painel logado (voz do robô falando com a cliente) | **BOTinho** é tolerado |
| Schema.org `alternateName` | **BOTinho**, só como apelido |
| Repositório, PM2, diretórios, logs, variáveis | **wabot** (nome técnico, nunca público) |

## Por que Espelha Grupos e não BOTinho

Quatro motivos, todos medidos — nenhum é gosto:

1. **É o domínio que temos.** `espelhagrupos.com.br` está registrado;
   `botinho.com.br` não está disponível. Marca com nome diferente do endereço
   é atrito de confiança na hora de pagar.
2. **"BOTinho" sozinho é lido como CALÇADO INFANTIL** por três das quatro IAs
   medidas em 01/09. Gemini, Perplexity e Google AI Overviews devolvem botinha
   de bebê e preço de loja de sapato para a consulta "BOTinho preço" — o
   último com links de loja. Disputar a palavra crua contra o varejo de calçado
   é caro e não tem fim.
3. **Não há patrimônio a perder.** `botinho` teve **1 impressão em 3 meses** no
   Search Console. As consultas que funcionam são qualificadas
   ("achadinho pro", "espelhar grupos whatsapp"), não a marca crua.
4. **Dois nomes viraram dois produtos na cabeça da IA.** O ChatGPT ofereceu
   "uma comparação objetiva BOTinho × Espelha Grupos" e listou os dois lado a
   lado com o Promium, como três empresas diferentes. A IA lia exatamente o que
   o site mostrava.

## Regras de escrita (obrigatórias)

- **Nunca escrever "BOTinho" sozinho em texto público.** Se precisar aparecer,
  é sempre "BOTinho, o robô do Espelha Grupos" ou "BOTinho WhatsApp".
- **Título de página não leva sufixo de marca próprio.** O
  `title.template` do layout já anexa ` | Espelha Grupos`. Guarda em
  `test/inbound-titulos-clique.test.js`.
- **"Bot Conversor" está aposentado.** Era sobra de uma nomeação ainda mais
  antiga e vivia no rodapé de todas as páginas. Não voltar.
- **O nome técnico não é nome público.** `wabot`, `api-staging`,
  `bot-supervisor`, `BOTinho-shared` (diretório no VPS) são infraestrutura e
  não devem aparecer para a cliente.
- **Nome de marca não entra em identificador.** Subprotocolo de WebSocket,
  cabeçalho, chave de env, slug e id são contratos técnicos: renomear marca
  por varredura de texto neles quebra o produto. Foi o que aconteceu em
  02/09 com o subprotocolo do QR (`'Espelha Grupos-auth'` — inválido pelo
  RFC 6455 e divergente da API). Guarda em
  `test/qr-websocket-subprotocol.test.js`.

## Onde a decisão está codificada

| Peça | Onde |
|---|---|
| Constantes de marca | `dashboard/lib/marketing-content.js` (`BRAND_LEGACY_NAME = 'BOTinho'` só como `alternateName`) |
| Nome nos e-mails | `BRAND_NAME` em `src/email/layout.js` |
| Termos e privacidade | `src/legalTerms.js` |
| Cobrança | `src/domain/payments/service.js`, `statement_descriptor` em `src/api/routes/payments.js` |

## Como medir se está funcionando

Repetir a coleta de citação por IA (7 consultas × 4 superfícies,
`docs/marketing/ai_visibility_tracking.csv`) e conferir dois sinais:

- **"BOTinho preço" deixa de devolver calçado** em Gemini, Perplexity e AI
  Overviews;
- **nenhuma IA oferece "comparação BOTinho × Espelha Grupos"** — entidade única
  é o objetivo inteiro desta decisão.

No Search Console, acompanhar as consultas de marca. Elas eram ~zero, então
qualquer volume novo é ganho; a métrica que não pode piorar é a das consultas
qualificadas, que já funcionam.

---

## Histórico (o que foi tentado e por que não serve)

### 2026-05-17 — "marca oficial: BOTinho"
Decidido por contagem de ocorrências no código (`BOTinho` 1.015× contra
`espelha grupos` 258×) e por soar mais "brandável" que `Wabot`. O critério era
frequência interna, não comportamento de busca — nada foi medido fora do
repositório. Reprovado quando o dado externo apareceu: o nome não tinha
domínio, não tinha impressão e colidia com varejo de calçado.

### 2026-08-04 — dois nomes amarrados por schema
"Espelha Grupos" como marca e "BOTinho" como nome do produto, ligados por
`alternateName` no schema. A hipótese era que o schema ensinaria a relação às
IAs. A medição de 01/09 mostrou que não ensinou: as IAs leram dois produtos
concorrentes. Restou disso o `alternateName`, que continua útil como apelido —
mas não como segunda marca.

### 2026-09-02 — um nome só
Esta decisão. Migração aplicada no site, nos e-mails, nos termos e na
cobrança. O painel logado mantém "BOTinho" como voz do robô: ali a pessoa já
sabe onde está, e o apelido do robô é o que dá personalidade sem custar
entidade lá fora.
