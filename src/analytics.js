import { randomUUID } from 'crypto'
import db from './db.js'
import { writeAnalyticsEvent } from './events/store.js'

export const PUBLIC_ANALYTICS_EVENTS = new Set([
  'conversion_prompt_viewed',
  'conversion_prompt_dismissed',
  'conversion_prompt_cta_clicked',
  'lead_magnet_viewed',
  'lead_magnet_form_focused',
  'lead_magnet_submitted',
  'lead_magnet_pdf_clicked',
  'lead_magnet_online_clicked',
  'comparison_page_view',
  'comparison_scroll_50',
  'comparison_cta_click',
  'partner_form_submit',
  'partner_form_validation_blocked',
  // Visita chegando de fora (IA, busca, social). É como medimos se resposta de
  // ChatGPT/Perplexity está trazendo gente — a Cloudflare mostra o robô que
  // rastreou, isto mostra a pessoa que chegou. Só o host do referenciador é
  // gravado, nunca a URL completa (ver dashboard/lib/ai-referral.js).
  'referral_visit',
  // As DUAS PRIMEIRAS etapas do funil canônico de SEO
  // (docs/marketing/event-taxonomy-v1.md). Estavam em ANALYTICS_EVENTS abaixo
  // (gravação autorizada) mas faltavam AQUI e na allowlist do cliente
  // (`PUBLIC_PERSISTED_EVENTS` em dashboard/lib/analytics.js) — e faltar em uma
  // das três faz o dado sumir sem erro. Resultado: visita e clique de CTA de
  // visitante anônimo nunca foram gravados, então o funil só passava a existir
  // no `signup_created` e era impossível separar "ninguém acha a página" de
  // "acham e não clicam". Descoberto em 2026-08-17, quando 529 impressões em
  // /bot-achadinhos-whatsapp renderam 11 cliques e não havia como saber o que
  // aqueles 11 fizeram. Leitura: scripts/diag-paginas-seo.mjs.
  'organic_page_view',
  'organic_cta_click',
])

export const ANALYTICS_EVENTS = new Set([
  'signup_created',
  'login_completed',
  'whatsapp_connected',
  'credential_saved',
  'credential_deleted',
  'monitor_group_created',
  'post_group_created',
  'checkout_started',
  'payment_pending',
  'payment_approved',
  'payment_failed',
  'first_send_success',
  'send_error',
  'organic_page_view',
  'organic_cta_click',
  // Origem da visita (IA / busca / social) — ver PUBLIC_ANALYTICS_EVENTS acima.
  'referral_visit',
  'lead_magnet_started',
  'lead_magnet_submitted',
  'signup_started_from_seo',
  'comparison_page_view',
  'comparison_scroll_50',
  'comparison_cta_click',
  'partner_form_submit',
  'partner_form_validation_blocked',
  'public_analytics_accepted',
  'public_analytics_invalid_event',
  'public_analytics_blocked_429',
  'cs_risk_detected',
  'cs_contact_attempted',
  'cs_contact_connected',
  'cs_offer_shown',
  'cs_offer_accepted',
  'cs_retained_7d',
  'cs_retained_30d',
  'login_failed',
  'login_blocked',
  // Sinais operacionais (auditoria/WABOT-010): gatilhos de escala observáveis.
  'ops_sqlite_busy',
  'ops_dedup_fail_open',
  // Sessão WA substituída por outro socket na mesma credencial (worker
  // duplicado / double-possession) — fonte raiz do spam de notificação de
  // "sincronização concluída". Durável p/ diagnóstico cross-processo em prod.
  'ops_wa_connection_replaced',
  // Desconexão 403/forbidden do WhatsApp — sinal de chip restringido/banido,
  // vigiado por chip para agir antes do ban definitivo.
  'ops_wa_forbidden',
  // Flapping de socket (closes 500/428/408 repetidos) que disparou o cooldown
  // longo — fonte raiz do spam de "A sincronização foi concluída".
  'ops_wa_flap_cooldown',
  // badSession (500) repetido sem conexão estável → auth limpo p/ re-pareamento.
  'ops_wa_bad_session_reset',
  // Quedas periódicas de sessão estável (ex.: 500/428/408 a cada ~50min) que
  // disparam cooldown maior para reduzir push notification de re-sync.
  'ops_wa_stable_close_cooldown',
  // Guard anti-reversão de modo (RCA sessões WA caindo, Trilho C): produção
  // com BOT_SUPERVISOR_MODE != remote e sessão conectada — deploy da API vai
  // derrubar a sessão na próxima janela.
  'ops_mode_regression',
  'ops_stale_worker_code',
  // Mesma mensagem repetindo no ack de um stream:error N+ vezes — sinal de
  // loop de retry-receipt travado derrubando a sessão em cadência (RCA
  // 2026-07, ver AGENTS.md "Loop de retry-receipt travado").
  'ops_wa_stuck_message_retry',
  // Camada 3 (issue #1216): grupo com falhas de decrypt repetidas (sender-key
  // dessincronizada) disparou auto-refresh de sender-keys (não-destrutivo, não
  // derruba a sessão) sem intervenção humana.
  'ops_wa_group_desync_autoheal',
  // O mesmo grupo continuou gerando falhas de decrypt mesmo após múltiplos
  // auto-refresh — precisa de ação manual (ex.: cliente sair/reentrar no
  // grupo). Nunca automático: só visibilidade para decisão humana.
  'ops_wa_group_desync_unresolved',
  'ops_wa_reception_blind',
  // `failure reason=405` do WhatsApp: recusa de login/registro por versão do WA
  // Web cortada pelo servidor. Atinge todas as sessões ao mesmo tempo (RCA
  // 2026-07-28) — é o sinal que separa incidente global de problema de chip.
  'ops_wa_version_rejected',
  // Card de preview saiu SEM imagem (oferta espelhada vira texto puro no
  // grupo). `stage` diz onde a foto se perdeu: 'scrape_sem_imagem' (a loja não
  // devolveu imagem), 'download_falhou'/'download_sem_bytes', 'normalize_falhou',
  // 'anchor_missing' (o link não aparece literal no texto) ou 'sem_plataforma'.
  // Antes desse sinal o caminho era 100% silencioso — ver comentário em
  // reportPreviewCardNoImage (src/bot-worker.js).
  'ops_preview_card_no_image',
  // O Mercado Livre passou a servir o muro anti-robô para o IP do servidor: a
  // página do produto responde 200, sem foto. Sinal separado do
  // `ops_preview_card_no_image` porque a ação é outra — não é defeito nosso,
  // é bloqueio da loja, e a foto tem que vir por outra fonte (a vitrine).
  'ops_ml_anti_bot_wall',
  // A foto da loja falhou, mas o card de preview SAIU MESMO ASSIM — com a foto
  // da mensagem de origem (plano B em cascata, core/previewImageFallbackPolicy.js).
  // Sinal separado de propósito: aqui a oferta saiu completa (foto + clique que
  // abre a loja). Somado com `ops_preview_card_no_image` por loja, diz quanto o
  // bloqueio da loja ainda custa depois do plano B.
  'ops_preview_card_origin_fallback',
  // A única imagem disponível era uma miniatura pequena demais para publicar
  // (borrão). A oferta saiu sem imagem, com o card de link do WhatsApp — ver
  // core/thumbnailQualityPolicy.js e o RCA 2026-08-26.
  'ops_monitored_thumbnail_dropped',
  // Origem monitorada SEM destino explícito espelhando para TODOS os destinos
  // da conta (comportamento histórico de quem nunca escolheu destinos). Sinal
  // para achar quem está nesse estado sem querer — ver core/destinationRouting.js.
  'ops_mirror_fallback_all_destinations',
  // Envio descartado no dequeue porque o destino deixou de estar vinculado à
  // origem enquanto o job esperava na fila (RCA 2026-08-26: entrega 1,5s DEPOIS
  // de a cliente apagar o destino no painel).
  'ops_send_dest_unlinked',
  // US6 (009-affiliate-improvements-r1): a promoção pending→eligible parou de
  // avançar (comissões com eligibleAt vencido há mais que o limiar) — sinal
  // operacional de que o cron de reconciliação de pagamentos parou ou está
  // travado, antes que o afiliado precise reclamar.
  'ops_affiliate_promotion_stuck',
  // Trilha de nutrição de leads (011-lead-nurture-emails): passo enviado (idempotência).
  'nurture_email_sent',
  // Opt-out durável da trilha de nutrição (LGPD) — prevalece sobre novos downloads.
  'nurture_unsubscribed',
  // Aviso por e-mail de "código de acesso da loja venceu" (src/credentialExpiry).
  // É TAMBÉM a persistência do anti-spam: a data do último evento por loja é o
  // que segura o próximo aviso dentro da janela de silêncio. Não remover sem
  // trocar a persistência antes — sem ele, o cliente que ignora o aviso passa a
  // receber e-mail todo dia.
  'credential_expiry_alert_sent',
  // Recuperação de senha por e-mail (pedido e conclusão) — sem PII, só o
  // userId, para dar para ver se o fluxo está sendo usado e se trava no meio.
  'password_reset_requested',
  'password_reset_completed',
])

const SENSITIVE_KEY_PATTERN = /(token|secret|password|cookie|credential|csrf|ssid|key|message|text|url|phone|email)/i

export function analyticsEnabled() {
  return process.env.ANALYTICS_ENABLED !== 'false'
}

export function sanitizeAnalyticsMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => value !== undefined && value !== null && !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 80) : value])
  )
}

export async function trackAnalyticsEvent({ userId = null, event, metadata = {} }) {
  if (!analyticsEnabled() || !ANALYTICS_EVENTS.has(event)) return { skipped: true }

  const safeMetadata = JSON.stringify(sanitizeAnalyticsMetadata(metadata))
  await writeAnalyticsEvent({
    id: randomUUID(),
    userId,
    event,
    metadata: safeMetadata,
    createdAt: new Date(),
  }, { db })
  return { ok: true }
}

export function trackAnalyticsEventSafe(payload) {
  trackAnalyticsEvent(payload).catch((err) => {
    console.error('Analytics event error:', err.message)
  })
}
