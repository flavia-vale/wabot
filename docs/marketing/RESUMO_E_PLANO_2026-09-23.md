# Resumo da rodada de 23/09 e plano imediato

Fontes: Search Console (3 meses e série diária), `diag-origem-cadastros`,
`diag-paginas-seo`, `diag-ltv-retencao` (30 dias), 10 consultas no ChatGPT com
busca, Cloudflare AI Crawl Control (30 dias, códigos e endereços), Bing
Webmaster Tools. Números completos em `SERIE_HISTORICA_SEO.md`.

## O que os dados dizem

| # | Achado | Número que sustenta |
|---|---|---|
| 1 | **O Google está crescendo e acelerando.** Os títulos reescritos em 20/08 seguem rendendo | CTR semanal 2,52% → 3,53% → 4,77% → **5,75%**; 489 cliques de 1 a 21/09 = **3,2×** agosto |
| 2 | **Comparação com concorrente é o motor** | ~47% das impressões vêm de buscas com nome de concorrente |
| 3 | **O ChatGPT é o canal que mais traz cadastro** | 54 de 205 cadastros em 30 dias (26%); OpenAI leu o site 1,84 mil vezes, mais que Bing (1,26 mil) e Google (844) |
| 4 | **O ChatGPT recomenda quando a pergunta é sobre espelhar oferta** e nos deixa de fora quando é "bot para afiliados" (lê como robô que acha oferta sozinho) | Trilha A 2/5, Trilha B 3/4 |
| 5 | **A objeção nova é confiança, não recurso.** Sem CNPJ, a IA diz "não diria ainda que é confiável no sentido empresarial" e premia concorrente com razão social e política de reembolso | consulta "é confiável" + pergunta indutora de 23/09 |
| 6 | **"Espelha grupos" ainda é lido como expressão, não como marca** | "o que é": 0 citações em 3 rodadas seguidas |
| 7 | **O gargalo virou retenção, não aquisição** | 17% renovam; **Basic 6%**, Pro 29%; LTV médio R$ 53,77 |
| 8 | Páginas de loja (Tier 1) foram achadas, mas não disputam o termo grande | 123 → 353 impressões; termos principais ainda ausentes |
| 9 | Celular clica menos | 3,52% contra 4,85% no computador |
| 10 | Bing é pequeno, mas cresce e o aviso automático funciona | 265 impressões em 8 semanas, metade nos últimos 8 dias; IndexNow 106 URLs, status 200 |
| 11 | **As "falhas" das IAs de 23/09 eram robôs de ataque disfarçados** procurando `.env`, `/server-status`, `/api/v1/config` na porta 8080 | conferido: todos devolvem 404, sem segredo exposto |

## Plano imediato (7 dias), em ordem de impacto

| # | Ação | Por quê | Quem |
|---|---|---|---|
| 1 | **Perguntar a quem pagou e não renovou "o que faltou"** — e-mail do grupo "Contato e escuta" pela aba E-mails, público: pagou e venceu | Basic renova 6%: cada cadastro novo vaza. Antes de mexer no produto, saber o motivo | Flávia |
| 2 | Rodar o prompt de 23/09 (reembolso, ofertas automáticas da Shopee, 5 comparativos) | Achados 4 e 5 | outra sessão |
| 3 | Colher 3 a 5 **depoimentos com nome e permissão** de quem paga e publicar em `/espelha-grupos-e-confiavel` e `/estudos-de-caso` | Única prova de confiança possível sem CNPJ | Flávia colhe, sessão publica |
| 4 | Frase de definição na primeira linha de `/quem-somos`, home e `llms.txt`: "Espelha Grupos é um robô para afiliadas que…" | Achado 6 | outra sessão (Entrega 4 do prompt) |
| 5 | Regra na Cloudflare bloqueando `/.env*`, `/server-status` e portas fora de 443 | Achado 11: não vaza nada hoje, mas é ruído grátis de tirar e protege contra erro futuro | Flávia (5 min) |
| 6 | Indexação Dia 8 e Dia 9; inspeção no Bing de `/shopee-afiliados-whatsapp` e `/bot-achadinhos-whatsapp` | Rotas renomeadas nunca lidas | Flávia |
| 7 | Rodada de IA no Gemini, Perplexity e AI Overviews (ou automação por API) | Fecha o placar de 23/09 | Flávia / decisão pendente |

**Não fazer agora:** anúncio pago (decisão adiada para as renovações de outubro
da turma de setembro — é ela que diz se o cliente fica), mais páginas por
cidade/nicho (congeladas), mudar títulos que estão subindo.

## Próxima medição (30/09)

- CTR semanal do Google segue acima de 5%?
- Cadastros com origem ChatGPT: meta 60 em 30 dias (hoje 54).
- Respostas do e-mail "o que faltou": os 3 motivos mais citados.
- ChatGPT em "bot para afiliados" depois da página de ofertas automáticas.
