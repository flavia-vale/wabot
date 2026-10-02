// Feature 017 (multicanal) — lista de aplicativos para a tela "Aplicativos".
// Todo aplicativo conhecido aparece; o plano só decide se ele pode ser usado
// (US9: a cliente sempre vê que o recurso existe). O Instagram Stories
// aparece como "tela própria" — decisão T001 (2026-10-02): continua no
// caminho dele, em src/instagram/.
import dbDefault from '../../db.js'
import { getPlanAccess } from '../../billing/plans.js'
import { listDeliveryNetworksForAccount } from '../../core/delivery/networks.js'

export async function deliveryNetworksRoutes(app, { db = dbDefault, env = process.env } = {}) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const { entitlements } = await getPlanAccess(req.user.sub, { db })
    return {
      aplicativos: listDeliveryNetworksForAccount({
        allowMultiNetwork: Boolean(entitlements.canUseMultiNetwork),
        env,
      }),
    }
  })
}
