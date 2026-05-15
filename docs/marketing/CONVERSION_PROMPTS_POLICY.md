# Política P0 de prompts de conversão — BOTinho

Data: 2026-05-15
Escopo: banners, slide-ins, modais click-triggered, bottom sheets e prompts in-app usados para conversão ou ativação.

## Guardrails obrigatórios

1. **Nada automático em fluxos críticos:** não exibir prompts em `/login`, `/dashboard/*`, `/admin/*`, `/dashboard/pagamento/*`, `/termos` ou `/privacidade`.
2. **Mobile conservador:** não usar interstitial full-screen automático; preferir banner inline, bottom sheet pequeno após engajamento ou modal aberto por clique.
3. **Frequência limitada:** no máximo um prompt automático por sessão; dismiss deve respeitar cooldown mínimo de 7 dias para banner e 14–30 dias para slide-in/modal.
4. **Sem PII em analytics client-side:** eventos podem conter `prompt_id`, `variant`, `page_path`, `trigger`, `utm_*` e `source`; não registrar email, telefone, tokens, cookies, mensagens, URLs finais de afiliado ou credenciais.
5. **Acessibilidade como requisito:** qualquer modal futuro precisa ter botão fechar visível, Escape para fechar, retorno de foco, navegação por teclado e labels claros.
6. **Feature flag antes de rollout:** qualquer prompt automático novo deve nascer desligado ou restrito a staging até validar UX e métricas.

## Eventos client-side padronizados no P0

Estes eventos são não persistidos por padrão: entram em `window.dataLayer` quando existir e disparam `CustomEvent('wabot:track')` para depuração/integração futura.

- `conversion_prompt_viewed`
- `conversion_prompt_dismissed`
- `conversion_prompt_cta_clicked`
- `lead_magnet_viewed`
- `lead_magnet_form_focused`
- `lead_magnet_submitted`
- `lead_magnet_pdf_clicked`
- `lead_magnet_online_clicked`

## UTMs mínimas para CTAs públicos

Todo CTA público para cadastro deve levar o visitante para `/login?mode=register` com, no mínimo:

- `source`
- `utm_source`
- `utm_medium=organic` quando for tráfego orgânico próprio
- `utm_campaign`
- `utm_content`

O helper `buildRegisterHref` deve ser usado para novos CTAs públicos sempre que possível, evitando variações manuais e perda de atribuição.

## Critérios para avançar ao P1

Só avançar para endpoint público persistido, componente `ConversionPrompt` automático ou painel de performance de prompts depois de validar em staging que:

1. login/cadastro continuam funcionando;
2. eventos client-side não carregam PII;
3. CTAs preservam atribuição até a tela de login;
4. não há prompt em páginas excluídas;
5. dashboard build/lint passam sem regressão.

## Implementação P1 adicionada

1. **Endpoint público anônimo:** `POST /api/public/analytics` aceita apenas eventos públicos de prompts/isca digital, aplica rate limit em memória por IP e reutiliza sanitização do backend antes de gravar em `AnalyticsEvent`.
2. **Componente central:** `ConversionPrompt` fica montado no layout, mas só aparece quando `NEXT_PUBLIC_CONVERSION_PROMPTS_ENABLED=true`; respeita páginas excluídas, cooldown de dismiss e uma impressão por sessão.
3. **Atribuição no cadastro:** UTMs e `conversion_prompt_id`/`conversion_prompt_variant` passam a chegar opcionalmente no evento `signup_created`, sem mudar campos obrigatórios do cadastro.
4. **Admin:** a aba de marketing passa a consultar `/api/admin/marketing/prompts` para ver views, cliques, dismiss, foco em formulário e cadastros atribuídos por prompt/variante.

### Validação esperada em staging P1

- Com a flag desligada, não deve aparecer nenhum prompt visual.
- Com `NEXT_PUBLIC_CONVERSION_PROMPTS_ENABLED=true` em staging, validar em `http://178.105.54.0:3006` que o prompt não aparece em `/login`, `/dashboard/*`, `/admin/*`, `/termos` e `/privacidade`.
- Simular scroll de 50% ou aguardar 45s em uma página pública; confirmar evento em `/api/public/analytics` e leitura posterior no admin marketing.
- Fechar o prompt; confirmar que ele não volta na mesma sessão e respeita cooldown em `localStorage`.
