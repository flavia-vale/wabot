# Triagem de indexação — P2 (FR-012)

Data da consulta ao código: 2026-08-19. Metodologia definida em `research.md` R9
(revisão da Assumption "critério de triagem" — decisão D2 do `plan.md`), critério
em **duas partes obrigatórias (E, não OU)**:

1. **Parte medível no repositório** (vira guard, checável em qualquer PR): a rota
   é `template: 'programmatic-lp'` (grade gerada por modelo a partir do slug) **e**
   não tem conteúdo exclusivo declarado — nenhum bloco próprio em
   `dashboard/app/_lpShared.js` além do que o modelo gera a partir do slug.
2. **Parte medível fora do repositório**: zero impressão nos últimos 3 meses no
   Search Console, com a data da consulta.

Página com **qualquer** impressão ou intenção própria é sempre **engordada**,
nunca retirada — nunca vira `indexable: false` (edge case da spec).

## Escopo

`template: 'programmatic-lp'` cobre exatamente as **36 rotas** de
`PROGRAMMATIC_SEO_ROUTES` (`dashboard/lib/seo-registry.mjs`): 15 cidades, 11
nichos, 10 dores operacionais. É a única classe de rota que este critério
avalia — hubs (`seo-hub`), páginas comerciais (`commercial-seo`), comparativos
(`alternatives`) e artigos (`article`) ficam fora do escopo de FR-012/R9 por
definição.

## Parte 1 — conteúdo exclusivo declarado (medível no código)

Checagem: para cada uma das 36 chaves de `LP_CONFIG`
(`dashboard/app/_lpShared.js`), a entrada tem `uniqueHeadline`, `uniqueBody`,
`uniqueBullets`, `faq` e `howTo` próprios (não herdados do template genérico)?

**Resultado: as 36 rotas têm os cinco campos preenchidos, sem exceção.**
Nenhuma rota gerada por `buildProgrammaticRoute()` fica só com o esqueleto do
modelo — toda entrada de `LP_CONFIG` declara cabeçalho, corpo, bullets, FAQ e
passo a passo específicos para o slug (cidade, nicho ou dor). Verificado por
leitura direta do arquivo em 2026-08-19 (as 36 chaves, uma a uma — ver comando
de reprodução abaixo).

```bash
cd dashboard && node -e "
const fs = require('fs');
const src = fs.readFileSync('app/_lpShared.js','utf8');
const start = src.indexOf('export const LP_CONFIG');
const end = src.indexOf('\nconst LP_TYPE_THEME');
const block = src.slice(start, end);
const keys = [...block.matchAll(/^\s*'([^']+)':\s*\{/gm)].map(m=>m[1]);
for (const k of keys) {
  const kIdx = block.indexOf(\"'\"+k+\"': {\");
  const next = block.indexOf('\n  \'', kIdx+1);
  const entry = block.slice(kIdx, next === -1 ? block.length : next);
  console.log(k, '| uniqueHeadline:', /uniqueHeadline/.test(entry), '| faq:', /faq:/.test(entry), '| howTo:', /howTo:/.test(entry));
}"
```

## Parte 2 — impressão no Search Console (medível fora do repositório)

Como o critério é uma **conjunção (E)**, a Parte 1 já decide o resultado desta
rodada: nenhuma das 36 rotas passa no primeiro filtro, então nenhuma chega a
precisar da segunda evidência para ser retirada do índice. Registrado por
transparência, não por necessidade de decisão:

- Este agente não tem acesso a uma sessão autenticada do Search Console nesta
  execução — não foi possível consultar impressão por slug individual das 36
  páginas nesta triagem.
- O baseline agregado mais recente do site (`AGENTS.md`, seção "Dados de
  mercado para marketing", atualizado em 2026-08-16) não quebra impressões por
  página programática — reporta consultas distintas (29) e as páginas com mais
  impressão do site inteiro, nenhuma delas entre as 36 rotas de grade.
- **Não bloqueia esta triagem**: como a Parte 1 (E) já não seleciona nenhuma
  rota, uma eventual leitura futura de impressão por slug só poderia
  **confirmar** a permanência (edge case "qualquer impressão → engorda"),
  nunca mudar a decisão desta rodada para retirada.

## Decisão

**Nenhuma das 36 rotas `programmatic-lp` é marcada `indexable: false` nesta
rodada.** Todas têm conteúdo exclusivo declarado por construção (LP_CONFIG),
o que já falha a Parte 1 do critério — condição necessária para sequer cogitar
a retirada. `dashboard/lib/seo-registry.mjs` permanece com as 36 rotas em
`indexable: true` (nenhuma mudança de código nesta task).

| Rota (36) | Conteúdo exclusivo declarado? | Decisão |
|---|---|---|
| 15 rotas `espelhar-grupos-whatsapp-<cidade>` | Sim (uniqueHeadline/faq/howTo por cidade) | Permanece indexável |
| 11 rotas `bot-ofertas-<nicho>-whatsapp` | Sim (idem, por nicho) | Permanece indexável |
| 10 rotas de dor operacional (`automatizar-divulgacao-em-grupos-whatsapp` etc.) | Sim (idem, por dor) | Permanece indexável |

## Reavaliação futura

Se uma rodada futura quiser reabrir esta triagem (fora do escopo desta
feature), o critério de código já está pronto como guard reaproveitável — só
muda a pergunta de "todas passam na Parte 1?" para "quais NÃO passam?". Uma
leitura real de impressão por slug via Search Console, se algum dia disponível
neste ambiente, entraria como segunda coluna da tabela acima sem mudar a
metodologia.

---

## FR-013 — conclusão sobre `/promo-vip-7dias`

Investigação já resolvida na leitura de código (`research.md` R7); esta seção
só registra a conclusão, conforme exige FR-013. **Nenhuma mudança de código
nesta task.**

- **Qual é a página**: `/promo-vip-7dias`.
- **O bloqueio é intencional?** Sim, e em **duas camadas coerentes**:
  1. `dashboard/public/robots.txt` traz `Disallow: /promo-vip-7dias`.
  2. `dashboard/app/promo-vip-7dias/layout.js` declara
     `robots: { index: false, follow: false }` diretamente (não passa por
     `buildSeoRobots()` — é o precedente que `contracts/seo-robots.md` cita
     como o único `noindex` real do site antes desta feature).
  É uma landing promocional temporária de cupom VIP, que não deve ranquear.
  `guard-seo-registry-coverage.mjs` já a lista em `privatePrefixes` (não
  precisa estar no `seo-registry.mjs` para o guard passar), e
  `validate-seo-consistency.mjs` não acusa conflito porque ela não é rota
  indexável nem faz parte do registro.
- **O que fazer**: nada além de registrar — as três pontas (robots.txt,
  layout.js, guards) já concordam entre si.
- **Por que `follow: false` aqui e `follow: true` nas rotas de grade**: são
  casos diferentes. `/promo-vip-7dias` não tem links internos que interesse
  circular (landing de campanha isolada); as 36 rotas de grade avaliadas
  acima têm links internos para o hub e para páginas irmãs, que `buildSeoRobots()`
  preserva com `follow: true` sempre (FR-009). `/promo-vip-7dias` **fica como
  está** — não é rota do `seo-registry.mjs`, então `buildSeoRobots()` nem a
  alcança.
