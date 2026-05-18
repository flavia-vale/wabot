# P3 — Distribuição e autoridade da campanha Canais + Preservação

Este pacote operacional transforma o hub SEO já implementado em campanha recorrente de aquisição. A regra central continua a mesma: usar “anti-ban” apenas como linguagem de busca/mercado e sempre explicar que a entrega real é **Módulo de Preservação Avançada**, sem promessa de banimento zero.

## Objetivos do P3

1. Distribuir os ativos P0/P1/P2 em social e vídeo.
2. Gerar sinais de autoridade com provas permitidas e consistentes.
3. Monitorar Search Console para otimizar títulos, metas e links internos.
4. Manter todos os CTAs rastreáveis com `utm_campaign=canais-preservacao`.

## Ativos entregues nesta etapa

| Ativo | Arquivo | Função |
|---|---|---|
| Calendário social | [`social-posts.md`](./social-posts.md) | 8 posts prontos para LinkedIn/Instagram/X, com CTA e UTM. |
| Roteiros de vídeo | [`roteiros-video.md`](./roteiros-video.md) | 3 roteiros curtos para Reels/Shorts/TikTok. |
| Provas comerciais | [`provas-comerciais.md`](./provas-comerciais.md) | Inventário de prints, depoimentos, microcases e regras de consentimento. |
| Search Console | [`search-console-otimizacao.md`](./search-console-otimizacao.md) | Rotina de 14/28 dias para indexação, CTR, queries e melhorias. |

## Cadência recomendada de 14 dias

| Dia | Canal | Ativo | Destino |
|---|---|---|---|
| 1 | LinkedIn + Instagram | Post 1 — Grupo cair | `/diagnostico-antiban-whatsapp` |
| 2 | Reels/Shorts | Vídeo 1 — Se seu grupo cair hoje | `/bot-canais-whatsapp` |
| 3 | X/LinkedIn | Post 2 — “anti-ban” honesto | `/faq-antiban-whatsapp` |
| 4 | Instagram carrossel | Post 3 — Checklist | `/materiais/checklist-antiban-whatsapp` |
| 5 | LinkedIn | Post 4 — Bot comum vs BOTinho | `/bot-comum-vs-botinho` |
| 7 | Reels/Shorts | Vídeo 2 — Chip dedicado | `/blog/chip-dedicado-bot-whatsapp` |
| 8 | X thread | Post 5 — Sinais de shadowban | `/blog/shadowban-whatsapp-canais` |
| 10 | LinkedIn + Instagram | Post 6 — Calculadora de risco | `/ferramentas/calculadora-risco-whatsapp` |
| 12 | Reels/Shorts | Vídeo 3 — “anti-ban” não existe | `/protecao-antiban-botinho` |
| 14 | LinkedIn | Post 8 — Como funciona em canais | `/como-funciona-botinho-canais` |

## Métricas mínimas

| Etapa | Métrica | Onde olhar |
|---|---|---|
| Distribuição | Cliques por `utm_content` | Analytics/dataLayer/eventos públicos |
| Diagnóstico | `diagnostic_result_viewed`, `diagnostic_form_submitted` | Eventos públicos |
| Lead magnet | Solicitações do checklist | Parâmetros de cadastro/CRM |
| Ferramenta | Cliques `risk_calculator_signup` e `risk_calculator_checklist` | Eventos orgânicos |
| SEO | Impressões, CTR e posição média | Search Console |

## Regra de segurança da copy

- Permitido: “reduzir exposição”, “preservação avançada”, “camadas de defesa”, “monitoramento”, “plano de recuperação”.
- Evitar: “anti-ban 100%”, “nunca mais seja banido”, “invisível para a Meta”, “burle regras”, “disparo sem limite”.
- Quando usar “anti-ban”, escrever como termo de busca/mercado e explicar a limitação no mesmo conteúdo.
