# Por que páginas caem do índice — investigação de 02/09/2026

Ação 8 do `PLANO_ACAO_SEO_IA_2026-09-01.md`. Quatro páginas **caíram** do índice
do Google depois de já terem ranqueado:

| Página | Impressões que tinha |
|---|---:|
| `/padronizar-divulgacao-afiliado-whatsapp` | 31 (3 cliques, **CTR 9,68% — o melhor do site**) |
| `/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo` | 28 |
| `/reduzir-tempo-operacional-em-grupos-whatsapp` | 9 |
| `/rastrear-resultados-de-divulgacao-em-grupos` | 2 |

---

## O que foi descartado

As quatro pertencem à mesma família: as **dez LPs de "dor"** (`painSlugs` em
`dashboard/lib/seo-registry.mjs`), todas geradas pelo mesmo template
(`programmatic-lp`, montado em `dashboard/app/_lpShared.js`).

| Hipótese | Verificação | Resultado |
|---|---|---|
| Marcadas como não-indexáveis | `indexable` no registry | ❌ as quatro estão `true` |
| Fora do sitemap | `getIndexableSeoRoutes()` | ❌ as quatro entram |
| Prioridade baixa | `priority` no registry | ❌ `0.9`, a mais alta da família |
| Conteúdo mais fino que o das irmãs | tamanho do bloco de configuração | ❌ 1.116–1.168 chars, mesma faixa das seis que continuam indexadas |
| Título ou descrição duplicados | guarda de `inbound-titulos-clique` | ❌ passa |

**Nada no código separa as quatro que caíram das seis que ficaram.**

---

## O que a investigação achou (e é maior que o problema original)

Contando as referências a cada rota em todo o `dashboard/`, incluindo links
montados dinamicamente:

**Seis das dez LPs de dor não são citadas em ponto NENHUM do site.** Existiam só
no `sitemap.xml`. Três das quatro que caíram estão nesse grupo.

E não é só essa família. `/bot-ofertas-afiliados-whatsapp` — **21 visitas, 6
cliques em CTA e 6 cadastros em 30 dias**, uma das páginas que mais convertem —
também estava órfã.

Página que só existe no sitemap é a causa clássica de **"rastreada, mas não
indexada"**, que é exatamente o estado de **26 páginas** no relatório de
Cobertura de 27/08. O Google rastreia, não encontra nenhum caminho interno até
ela, e conclui que a página não acrescenta nada ao índice.

⚠️ **Ressalva de medição:** a varredura de links tem margem de erro. Links
montados dinamicamente (`href={item.href}`) são detectados pela citação da rota
como string, mas uma rota montada por concatenação escaparia. O número confiável
é o das LPs de dor, conferido caso a caso.

---

## O que foi feito

As dez LPs de dor entraram numa seção nova do hub `/conteudos` ("Rotina de
divulgação em grupos"), e `/bot-ofertas-afiliados-whatsapp` entrou na seção de
nichos. Todas passam a ter um caminho a partir de uma página que o Google já
conhece e indexa.

Guarda: `test/paginas-orfas.test.js`. Ele falha se qualquer LP de dor voltar a
ficar sem link, e também se alguém marcar uma das quatro como não-indexável para
"resolver" o problema — isso faria a página sumir de vez em vez de voltar.

---

## O que NÃO foi resolvido, e por quê

**Por que aquelas quatro especificamente caíram, continua sem resposta.** Isso
não é determinável a partir do código: exige a **Inspeção de URL** no Search
Console, página por página, que mostra a data do último rastreamento e o motivo
declarado pelo Google. É ação humana, como o item 7 do plano.

O que fazer, na ordem, depois do deploy desta mudança:

1. Search Console → Inspeção de URL → colar cada uma das quatro. Anotar o motivo
   que aparece em "Cobertura da página".
2. "Solicitar indexação" nas quatro.
3. Esperar **duas semanas** antes de concluir qualquer coisa. Link interno novo
   demora a ser rastreado.
4. Se voltarem: a causa era orfandade, e o conserto vale para as outras 26.
   Se não voltarem: a causa é qualidade de conteúdo do template, e aí a decisão
   é outra — reescrever as dez com conteúdo de verdade, ou aceitar que essa
   família não sustenta dez páginas e reduzi-la.

**A segunda hipótese é plausível e precisa ser dita:** dez páginas com ~1.100
caracteres de conteúdo próprio cada, sobre variações do mesmo assunto, é
exatamente o perfil que o Google recusa. Se for isso, adicionar link interno
ajuda pouco — o conserto seria juntar as dez em duas ou três páginas boas.
Não dá para saber sem o passo 1.


---

## Correção de 02/09 (mesmo dia): a causa mais provável é bem mais simples

A dona do produto apontou o que faltava conferir: **pedido de indexação**.

Cruzando com `PENDENCIAS_INDEXACAO.md`:

- as **15 URLs pedidas em 04/08** estão **todas** indexadas hoje;
- as **10 páginas** deste documento (as 6 que nunca entraram e as 4 que caíram)
  **nunca foram pedidas** — nenhuma delas.

A correlação é limpa nas duas direções. Isso enfraquece bastante a hipótese
alternativa levantada acima (conteúdo fino sendo recusado por qualidade) e
aponta para a explicação mais simples: o Google não indexa sozinho páginas de
site pequeno em tempo hábil, e o IndexNow — que roda a cada deploy — **não é
usado pelo Google**.

Ordem revista: **pedir indexação primeiro**, esperar duas semanas, e só então
tratar qualidade de conteúdo como hipótese. A lista dividida em lotes está em
`PENDENCIAS_INDEXACAO.md`.

O conserto de orfandade continua valendo — página sem link interno é frágil
mesmo depois de indexada.
