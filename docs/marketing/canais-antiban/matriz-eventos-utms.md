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

## CTAs P1 implementados

| Origem | CTA | `cta_position` | `cta_stage` | `cta_destination` | Destino |
|---|---|---|---|---|---|
| Landing P1 assets | `landing_checklist` | `p1_assets_primary` | `lead_magnet` | `checklist` | `/materiais/checklist-antiban-whatsapp` |
| Landing P1 assets | `landing_risk_calculator` | `p1_assets_secondary` | `tool` | `calculator` | `/ferramentas/calculadora-risco-whatsapp` |
| Páginas comerciais P1 assets | `commercial_checklist` | `p1_assets_primary` | `lead_magnet` | `checklist` | `/materiais/checklist-antiban-whatsapp` |
| Páginas comerciais P1 assets | `commercial_risk_calculator` | `p1_assets_secondary` | `tool` | `calculator` | `/ferramentas/calculadora-risco-whatsapp` |
| Blog posts da campanha | `blog_checklist` | `article_next_step_secondary` | `lead_magnet` | `checklist` | `/materiais/checklist-antiban-whatsapp` |
| Blog posts da campanha | `blog_risk_calculator` | `article_next_step_tool` | `tool` | `calculator` | `/ferramentas/calculadora-risco-whatsapp` |
| Checklist de preservação | `checklist_diagnostic` | `body_primary` | `diagnostic` | `diagnostic` | `/diagnostico-antiban-whatsapp` |
| Checklist de preservação | `checklist_risk_calculator` | `body_secondary` | `tool` | `calculator` | `/ferramentas/calculadora-risco-whatsapp` |
| Calculadora de risco | `risk_calculator_checklist` | `result_primary` | `lead_magnet` | `checklist` | `/materiais/checklist-antiban-whatsapp` |
| Calculadora de risco | `risk_calculator_signup` | `result_secondary` | `conversion` | `signup` | `/login` |

## CTAs P2 implementados

| Origem | CTA | `cta_position` | `cta_stage` | `cta_destination` | Destino |
|---|---|---|---|---|---|
| Landing P2 assets | `landing_p2_decision` | `p2_assets` | `decision` | `decision_page` | páginas P2 |
| Páginas P2 hero | `p2_diagnostic` | `decision_cta` | `diagnostic` | `diagnostic` | `/diagnostico-antiban-whatsapp` |
| Páginas P2 hero | `p2_checklist` | `decision_cta` | `lead_magnet` | `checklist` | `/materiais/checklist-antiban-whatsapp` |
| Páginas P2 hero | `p2_calculator` | `decision_cta` | `tool` | `calculator` | `/ferramentas/calculadora-risco-whatsapp` |
| Páginas P2 hero | `p2_signup` | `decision_cta` | `conversion` | `signup` | `/login` |
| Páginas P2 relacionadas | `p2_related_page` | `related` | `consideration` | `decision_page` | outra página P2 |

## Funil mínimo de análise

1. **Aquisição:** `organic_page_view` por rota e intenção.
2. **Interesse:** `organic_cta_click` para diagnóstico ou landing.
3. **Diagnóstico:** `diagnostic_result_viewed` por faixa de exposição.
4. **MQL:** `diagnostic_form_submitted` com `score_band` e `profile`.
5. **Lead magnet/tool:** checklist e calculadora capturam intenção intermediária com `lead_magnet` e `tool`.
6. **Decisão:** páginas P2 capturam objeções com `decision` e roteiam para diagnóstico, checklist, calculadora ou cadastro.
7. **Trial/cadastro:** parâmetros enviados ao `/login` com `diagnostic_score_band`, `risk_score_band` ou origem P2.

## Regras de qualidade

- Todo CTA novo da campanha deve ter `data-seo-cta`, `data-cta-position`, `data-cta-stage` e `data-cta-destination`.
- Todo link para cadastro deve manter `utm_campaign=canais-preservacao` quando vier desta campanha.
- O diagnóstico nunca deve prometer “anti-ban 100%”; usar sempre “exposição operacional”, “redução de risco” e “preservação avançada”.
- Eventos persistidos devem evitar dados sensíveis: não enviar QR Code, telefone, link de grupo, senha ou conteúdo de mensagem.
