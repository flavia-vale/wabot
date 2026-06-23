import db from './db.js'
import { encryptCredential } from './credentialCrypto.js'
import { parseCredentialData } from './credentialHealth.js'

export async function persistCredentialPatch({ userId, platform, patch }) {
  if (!userId || !platform || !patch || typeof patch !== 'object') return null
  const current = await db.credential.findUnique({
    where: { userId_platform: { userId, platform } },
  })
  if (!current) return null
  const data = { ...parseCredentialData(current.data), ...patch }
  const encryptedData = encryptCredential(JSON.stringify(data))
  await db.credential.update({
    where: { userId_platform: { userId, platform } },
    data: { data: encryptedData },
  })
  return data
}
