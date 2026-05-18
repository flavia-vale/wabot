# Matriz de eventos e UTMs — Canais + Preservação Avançada

Esta matriz padroniza a medição do P0 da campanha. O objetivo é diferenciar visitantes prontos para cadastro de visitantes em fase de dor/diagnóstico, sem depender apenas do CTA genérico de registro.

## Convenção de campanha

| Campo | Valor padrão | Observação |
|---|---|---|
| `utm_campaign` | `canais-preservacao` | Usado em landing, páginas comerciais, blog e diagnóstico. |
| `utm_source` | `seo`, `blog`, `lead_magnet` | Origem do clique. |
| `utm_medium` | `landing`, `organic`, `diagnostic` | Contexto do funil. |
| `utm_content` | `{pagina}_{posicao}_{destino}` | Deve identificar posição e intenção do CTA. |
| `cluster` | `canais-preservacao` | Contexto do SEO tracker. |
| `intent` | intenção da rota | Ex.: `anti-ban whatsapp`, `bot para canais do whatsapp`. |

## Eventos orgânicos

| Evento | Quando dispara | Dimensões mínimas |
|---|---|---|
| `organic_page_view` | Ao carregar uma página com `OrganicPageTracker`. | `slug`, `path`, `cluster`, `intent`, `template`. |
| `organic_cta_click` | Clique em link com `data-seo-cta`. | `slug`, `path`, `cluster`, `intent`, `template`, `cta`, `cta_position`, `cta_stage`, `cta_destination`, `utm_content`, `href`. |

## Eventos do diagnóstico

| Evento | Quando dispara | Dimensões mínimas |
|---|---|---|
| `diagnostic_answer_changed` | Usuário altera uma resposta. | `origin`, `diagnostic_id`, `question_id`, `answer`. |
| `diagnostic_result_viewed` | Usuário interage com o bloco de resultado. | `origin`, `diagnostic_id`, `score`, `score_band`. |
| `diagnostic_form_submitted` | Usuário envia e-mail/perfil para levar resultado ao cadastro. | `origin`, `diagnostic_id`, `score`, `score_band`, `profile`. |
| `diagnostic_cta_clicked` | Usuário clica em CTA do diagnóstico. | `origin`, `diagnostic_id`, `score`, `score_band`, `cta`. |

## CTAs P0 implementados

| Origem | CTA | `cta_position` | `cta_stage` | `cta_destination` | Destino |
|---|---|---|---|---|---|
| `/bot-canais-whatsapp` hero | `signup_preservar_canais` | `hero_primary` | `conversion` | `signup` | `/login` |
| `/bot-canais-whatsapp` hero | `diagnostico_preservacao` | `hero_secondary` | `diagnostic` | `diagnostic` | `/diagnostico-antiban-whatsapp` |
| `/bot-canais-whatsapp` final | `signup_preservar_canais` | `final_primary` | `conversion` | `signup` | `/login` |
| `/bot-canais-whatsapp` final | `diagnostico_preservacao` | `final_secondary` | `diagnostic` | `diagnostic` | `/diagnostico-antiban-whatsapp` |
| Páginas comerciais hero | `commercial_signup` | `hero_primary` | `conversion` | `signup` | `/login` |
| Páginas comerciais hero | `commercial_diagnostic` | `hero_secondary` | `diagnostic` | `diagnostic` | `/diagnostico-antiban-whatsapp` |
| Páginas comerciais final | `commercial_campaign_landing` | `final_primary` | `consideration` | `landing` | `/bot-canais-whatsapp` |
| Páginas comerciais final | `commercial_diagnostic` | `final_secondary` | `diagnostic` | `diagnostic` | `/diagnostico-antiban-whatsapp` |
| Blog posts da campanha | `blog_diagnostic` | `article_next_step_primary` | `diagnostic` | `diagnostic` | `/diagnostico-antiban-whatsapp` |
| Blog posts da campanha | `blog_campaign_landing` | `article_next_step_secondary` | `consideration` | `landing` | `/bot-canais-whatsapp` |
| Diagnóstico | `diagnostic_direct_signup` | `result_secondary` | `diagnostic` | `signup` | `/login` |

## Funil mínimo de análise

1. **Aquisição:** `organic_page_view` por rota e intenção.
2. **Interesse:** `organic_cta_click` para diagnóstico ou landing.
3. **Diagnóstico:** `diagnostic_result_viewed` por faixa de exposição.
4. **MQL:** `diagnostic_form_submitted` com `score_band` e `profile`.
5. **Trial/cadastro:** parâmetros enviados ao `/login` com `diagnostic_score_band`.

## Regras de qualidade

- Todo CTA novo da campanha deve ter `data-seo-cta`, `data-cta-position`, `data-cta-stage` e `data-cta-destination`.
- Todo link para cadastro deve manter `utm_campaign=canais-preservacao` quando vier desta campanha.
- O diagnóstico nunca deve prometer “anti-ban 100%”; usar sempre “exposição operacional”, “redução de risco” e “preservação avançada”.
- Eventos persistidos devem evitar dados sensíveis: não enviar QR Code, telefone, link de grupo, senha ou conteúdo de mensagem.
