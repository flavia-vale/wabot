// Rota pública (sem autenticação) de descadastro da trilha de nutrição de
// leads (LGPD opt-out). O token assinado (HMAC) é a própria credencial —
// contracts/unsubscribe-endpoint.md.

import db from '../../db.js'
import { verifyUnsubscribeToken } from '../../leadNurture/unsubscribeToken.js'
import { trackAnalyticsEvent } from '../../analytics.js'
import { isUnsubscribed } from '../../leadNurture/sweep.js'

const BRAND_NAME = 'BOTinho'

function renderPage({ title, message }) {
  return `<!doctype html>
<html lang="pt-br">
<head><meta charset="utf-8"><title>${title} — ${BRAND_NAME}</title></head>
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:480px;margin:64px auto;padding:32px 24px;text-align:center">
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="font-size:15px;line-height:1.6">${message}</p>
  </div>
</body>
</html>`
}

export async function leadNurtureRoutes(app) {
  app.get('/unsubscribe', async (req, reply) => {
    const token = typeof req.query?.token === 'string' ? req.query.token : ''
    const secret = process.env.JWT_SECRET || ''
    const verified = secret ? verifyUnsubscribeToken(token, secret) : null

    if (!verified) {
      return reply.code(400).type('text/html; charset=utf-8').send(renderPage({
        title: 'Link inválido',
        message: 'Este link de descadastro é inválido ou expirou. Se você não quer mais receber e-mails, entre em contato com o suporte.',
      }))
    }

    try {
      // Idempotente: só grava se ainda não houver o evento — reexecução
      // (ex.: clique duplo, retry do cliente de e-mail) não duplica a linha.
      const alreadyUnsubscribed = await isUnsubscribed({ db, userId: verified.userId })
      if (!alreadyUnsubscribed) {
        await trackAnalyticsEvent({ userId: verified.userId, event: 'nurture_unsubscribed', metadata: { via: 'link' } })
      }
    } catch (err) {
      req.log?.warn?.({ err: err?.message }, 'lead-nurture: falha ao gravar opt-out')
    }

    return reply.code(200).type('text/html; charset=utf-8').send(renderPage({
      title: 'Você foi descadastrada',
      message: 'Não enviaremos mais e-mails desta sequência.',
    }))
  })
}
