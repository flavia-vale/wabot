# Fatos errados que as IAs dizem sobre o Espelha Grupos — registro vivo

Frente F4 de `PLANO_SEO_GEO_2026-09-27.md`. Cada linha: o que a IA disse, onde
ela leu (a fonte que citou), o que corrigimos e quando a correção chegou à
produção. A linha só sai daqui quando uma rodada posterior mostra a IA dizendo
o certo. Meta: lista vazia.

| # | O que a IA disse | IA / consulta / data | De onde veio (fonte citada) | Correção | Em produção desde | Status |
|---|---|---|---|---|---|---|
| 1 | "Basic = operação manual; só o Pro tem o robô que monitora e publica" | Gemini · "espelha grupos preço" · 27/09 | `pricing.md` antigo ("Basic covers manual offer operation") | Ficha técnica canônica: Basic também espelha automaticamente (PR #1926) | aguarda `develop → main` | aberto |
| 2 | "Envia para WhatsApp e Telegram" | Gemini · "é confiável" e "bot para afiliados" · 27/09 | sem fonte nossa (mistura com Pro Afiliados/Afilira) | Ficha: "Só WhatsApp. Não envia para Telegram nem Instagram" (PR #1926) | aguarda `develop → main` | aberto |
| 3 | "4 lojas: Shopee, Mercado Livre, Amazon, Magalu" | Perplexity · "o que faria você citar" · 27/09; ChatGPT · "postar em vários grupos" · 27/09 | páginas antigas indexadas (FAQ/planos com o seed de 05/2026) | 6 lojas nomeadas em FAQ/planos (18/09) e na ficha (PR #1926); reindexar | parcial (18/09) | aberto |
| 4 | "Até 20 grupos/canais de origem" | Perplexity · "o que faria você citar" · 27/09 | texto antigo do site | Confirmar no código o limite real e escrever o número certo na ficha (sem limite ou o limite que existe) | — | aberto: conferir `src/billing/plans.js` |
| 5 | "Copia áudios e figurinhas" | Gemini · "como espelhar mensagens" · 27/09 | sem fonte nossa | Não temos: não afirmar nem negar em página; se a IA repetir na próxima rodada, acrescentar à ficha "espelha texto, imagem e card" | — | observar |
| 6 | "Lojas suportadas: variam" | Perplexity · "bot para afiliados" · 27/09 | tabela sem fonte nossa | Ficha com as 6 lojas byte a byte em llms.txt/pricing.md (PR #1926) | aguarda `develop → main` | aberto |
| 7 | "Metodologia Espelha Grupos = técnica de lançamento digital (grupo matriz/espelhos) e espelhamento do WhatsApp Web (STJ)" | Gemini · "metodologia" · 27/09 | Whapi, WHAMetrics, Migalhas | Topo de `/metodologia-uso-responsavel-whatsapp` dizendo de frente que é a metodologia do Espelha Grupos para afiliadas (Frente B8) | — | aberto |
| 8 | "Marca partida: Afilira × Espelha Grupos × Shozap × BOTinho" (BOTinho como produto separado) | ChatGPT com histórico · 27/09 | histórico da conta | Nome antigo só no `alternateName`; medir em conta neutra | 19/09 | observar |

Como usar: a cada rodada do `ROTEIRO_MEDICAO_IA.md`, para cada resposta,
comparar com a ficha técnica (`dashboard/lib/ficha-tecnica.js`). Fato novo
errado = linha nova. Fato corrigido e confirmado em 2 rodadas seguidas = tirar
a linha e anotar a data em `SERIE_HISTORICA_SEO.md`.
