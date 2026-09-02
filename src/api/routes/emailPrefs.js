// Rota pública (sem login) de descadastro de e-mails de divulgação (LGPD).
// O token assinado no link é a própria credencial — mesmo esquema da trilha de
// nutrição, sem estado e sem link que vence no meio de uma campanha.

import db from '../../db.js'
import { optOut, verifyUnsubscribeToken, OPT_OUT_CATEGORY } from '../../email/optOut.js'
import { trackAnalyticsEvent } from '../../analytics.js'

const BRAND_NAME = 'Espelha Grupos'

function renderPage({ title, message }) {
  return `<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — ${BRAND_NAME}</title></head>
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:480px;margin:64px auto;padding:32px 24px;text-align:center">
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="font-size:15px;line-height:1.6">${message}</p>
  </div>
</body>
</html>`
}

export async function emailPrefsRoutes(app) {
  app.get('/unsubscribe', async (req, reply) => {
    const token = typeof req.query?.token === 'string' ? req.query.token : ''
    const secret = process.env.JWT_SECRET || ''
    const verified = secret ? verifyUnsubscribeToken(token, secret) : null

    if (!verified) {
      return reply.code(400).type('text/html; charset=utf-8').send(renderPage({
        title: 'Link inválido',
        message: 'Este link de descadastro não é válido. Se você não quer mais receber nossos e-mails, é só responder qualquer um deles que a gente resolve.',
      }))
    }

    try {
      await optOut({ db, userId: verified.userId, category: OPT_OUT_CATEGORY, source: 'link' })
      // Mantém o descadastro antigo em pé: quem sai por aqui também sai da
      // trilha de nutrição, que lê o evento e não a tabela nova.
      await trackAnalyticsEvent({ userId: verified.userId, event: 'nurture_unsubscribed', metadata: { via: 'email_link' } }).catch(() => {})
    } catch (err) {
      req.log?.warn?.({ err: err?.message }, 'e-mail: falha ao gravar descadastro')
    }

    return reply.code(200).type('text/html; charset=utf-8').send(renderPage({
      title: 'Pronto, você foi descadastrada',
      message: 'Não vamos mais te mandar e-mail de divulgação. Avisos importantes da sua conta (cobrança, vencimento e segurança) continuam chegando.',
    }))
  })
}
