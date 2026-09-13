import { createReadStream } from 'node:fs'

export function storyAssetRoutes(app, { storage } = {}) {
  if (!storage) return
  app.get('/story-assets/:key', async (req, reply) => {
    try {
      const asset = await storage.openSigned(req.params.key, req.query || {})
      reply.header('Content-Type', 'image/jpeg')
      reply.header('Content-Length', String(asset.byteSize))
      reply.header('Cache-Control', 'public, max-age=300, immutable')
      reply.header('X-Content-Type-Options', 'nosniff')
      return reply.send(createReadStream(asset.file))
    } catch (error) {
      const status = ['ASSET_EXPIRED', 'INVALID_SIGNATURE'].includes(error.code) ? 403 : 404
      return reply.code(status).send({ error: 'Imagem indisponível' })
    }
  })
}
