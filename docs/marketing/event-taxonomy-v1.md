# Event Taxonomy v1 — WABOT (Onda 1 CRO)

Data: 2026-05-16
Escopo: padronização de naming e payload para funil público + autenticado.

## Objetivo
Congelar um contrato único de eventos para reduzir ambiguidades entre frontend, API pública e dashboard admin.

## Regras
- `snake_case` para nome dos eventos e chaves.
- payload sem dados sensíveis (`email`, `phone`, `token`, `password`, `url completa`).
- toda propriedade textual com limite <= 80 chars no backend.
- sempre incluir `page_path` quando o evento vier da camada pública.

## Funil canônico v1
1. `organic_page_view`
2. `organic_cta_click`
3. `signup_started_from_seo` (quando aplicável)
4. `signup_created`
5. `first_send_success`
6. `payment_approved`

## Eventos públicos persistidos
- `conversion_prompt_viewed`
- `conversion_prompt_dismissed`
- `conversion_prompt_cta_clicked`
- `lead_magnet_viewed`
- `lead_magnet_form_focused`
- `lead_magnet_submitted`
- `lead_magnet_pdf_clicked`
- `lead_magnet_online_clicked`

## Payload mínimo por categoria
### Page & CTA
- `source`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `page_path`

### Signup
- acima +
- `ref`
- `conversion_prompt_id`
- `conversion_prompt_variant`
- `promo`

## Compatibilidade
- `source` e `utm_source` devem coexistir (fallback cruzado).
- `campaign` legado continua aceito no consumo de relatórios, mas v1 prioriza `utm_campaign`.

## Checklist de rollout (staging)
1. Verificar cobertura de `source` >= 80%.
2. Verificar cobertura de `utm_campaign` >= 70%.
3. Confirmar não rejeição de eventos públicos por validação (`400`).
4. Validar funil de 7 dias sem regressão de consistência.
