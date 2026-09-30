/**
 * Carregador do funil da campanha Canais + Preservação — só LEITURA.
 *
 * Duas consultas agregadas no SQLite (GROUP BY + LIMIT), na janela limitada a
 * 90 dias por `boundedRange`, usando o índice (event, createdAt) do
 * AnalyticsEvent. Nada é trazido linha a linha para o Node: o que atravessa é
 * no máximo ROW_LIMIT linhas já somadas. Zero processo novo, zero cache em
 * memória. A montagem fica em `campaignFunnel.js` (puro).
 */

import { ROW_LIMIT, buildCampaignFunnel } from './campaignFunnel.js'

const toRows = (rows) => (Array.isArray(rows) ? rows : []).map((row) => ({ ...row, total: Number(row.total || 0) }))

export async function loadCampaignFunnel(db, { from, to }) {
  const [eventRows, signupRows] = await Promise.all([
    db.$queryRaw`
      SELECT
        event,
        COALESCE(json_extract(metadata, '$.path'), json_extract(metadata, '$.page_path'), json_extract(metadata, '$.pathname'), '') AS page,
        COALESCE(json_extract(metadata, '$.origin'), '') AS origin,
        COALESCE(json_extract(metadata, '$.cta'), '') AS cta,
        COALESCE(json_extract(metadata, '$.cta_destination'), '') AS cta_destination,
        COALESCE(json_extract(metadata, '$.score_band'), '') AS band,
        COALESCE(json_extract(metadata, '$.entry_utm_source'), '') AS entry_utm_source,
        COALESCE(json_extract(metadata, '$.entry_utm_campaign'), '') AS entry_utm_campaign,
        COALESCE(json_extract(metadata, '$.entry_utm_content'), '') AS entry_utm_content,
        COUNT(*) AS total
      FROM AnalyticsEvent
      WHERE event IN ('organic_page_view', 'organic_cta_click', 'diagnostic_result_viewed', 'diagnostic_form_submitted', 'diagnostic_cta_clicked')
        AND createdAt >= ${from}
        AND createdAt <= ${to}
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
      ORDER BY total DESC
      LIMIT ${ROW_LIMIT}
    `,
    db.$queryRaw`
      SELECT
        COALESCE(json_extract(metadata, '$.landing_page'), '') AS landing_page,
        COALESCE(json_extract(metadata, '$.source'), '') AS source,
        COALESCE(json_extract(metadata, '$.utm_source'), '') AS utm_source,
        COALESCE(json_extract(metadata, '$.utm_campaign'), '') AS utm_campaign,
        COALESCE(json_extract(metadata, '$.utm_content'), '') AS utm_content,
        COALESCE(json_extract(metadata, '$.entry_utm_source'), '') AS entry_utm_source,
        COALESCE(json_extract(metadata, '$.entry_utm_campaign'), '') AS entry_utm_campaign,
        COALESCE(json_extract(metadata, '$.entry_utm_content'), '') AS entry_utm_content,
        COALESCE(json_extract(metadata, '$.diagnostic_score_band'), '') AS diagnostic_score_band,
        COALESCE(json_extract(metadata, '$.risk_score_band'), '') AS risk_score_band,
        COALESCE(json_extract(metadata, '$.segmento'), '') AS segmento,
        COUNT(*) AS total
      FROM AnalyticsEvent
      WHERE event = 'signup_created'
        AND createdAt >= ${from}
        AND createdAt <= ${to}
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
      ORDER BY total DESC
      LIMIT ${ROW_LIMIT}
    `,
  ])

  return buildCampaignFunnel({ eventRows: toRows(eventRows), signupRows: toRows(signupRows), from, to })
}
