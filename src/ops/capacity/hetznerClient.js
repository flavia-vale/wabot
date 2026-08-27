const CACHE_MS = 6 * 60 * 60 * 1000
const ALLOWED_PATHS = new Set(['/servers', '/volumes', '/primary_ips', '/floating_ips', '/load_balancers'])
const SERVER_BY_ID_PATH = /^\/servers\/[1-9]\d*$/

const safeError = (code) => Object.assign(new Error('Inventário Hetzner temporariamente indisponível.'), { code })
const text = (value) => value == null ? null : String(value).slice(0, 200)
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null
const sanitizeServer = (server = {}) => ({
  id: text(server.id), name: text(server.name), status: text(server.status) || 'unknown',
  serverType: text(server.server_type?.name), architecture: text(server.server_type?.architecture),
  vcpu: number(server.server_type?.cores), memoryMb: number(server.server_type?.memory) == null ? null : Math.round(number(server.server_type.memory) * 1024),
  diskGb: number(server.server_type?.disk), region: text(server.datacenter?.location?.network_zone ?? server.datacenter?.name),
  ipv4: text(server.public_net?.ipv4?.ip), backups: Boolean(server.backup_window),
})
const sanitizeNamed = (item = {}) => ({ id: text(item.id), name: text(item.name), status: text(item.status), sizeGb: number(item.size), location: text(item.location?.name), ip: text(item.ip), type: text(item.type) })
const total = (payload, key) => number(payload?.meta?.pagination?.total_entries) ?? (Array.isArray(payload?.[key]) ? payload[key].length : 0)
const completeness = (payload, key) => {
  const returned = Array.isArray(payload?.[key]) ? payload[key].length : 0
  const count = total(payload, key)
  return { returned, total: count, truncated: count > returned }
}

export function manualCapacityContractFromEnv(env = process.env) {
  const checkedAt = text(env.CAPACITY_CONTRACT_CHECKED_AT)
  let quota = null
  try { quota = env.CAPACITY_HETZNER_QUOTA_JSON ? JSON.parse(env.CAPACITY_HETZNER_QUOTA_JSON) : null } catch {}
  const monthlyCostEur = number(env.CAPACITY_MONTHLY_COST_EUR)
  return quota || monthlyCostEur != null ? { quota, monthlyCostEur, checkedAt } : null
}

const applyManualProvenance = (inventory, manual) => ({ ...inventory,
  quota: manual?.quota == null ? null : { value: manual.quota, source: 'manual', checkedAt: text(manual.checkedAt) },
  cost: number(manual?.monthlyCostEur) == null ? null : { monthlyEur: number(manual.monthlyCostEur), source: 'manual', checkedAt: text(manual.checkedAt) },
  monthlyCostEur: number(manual?.monthlyCostEur), costCheckedAt: text(manual?.checkedAt),
})

export function createHetznerClient({ token = process.env.HCLOUD_READ_TOKEN, serverId = process.env.HCLOUD_SERVER_ID || '128727108', fetchImpl = globalThis.fetch, loadCache, saveCache, now = () => new Date(), timeoutMs = 5000, cacheMs = CACHE_MS, baseline = null, manual = null } = {}) {
  const ttlMs = Math.max(CACHE_MS, Number(cacheMs) || 0)
  async function request(path) {
    if (!ALLOWED_PATHS.has(path) && !SERVER_BY_ID_PATH.test(path)) throw safeError('HCLOUD_ENDPOINT_NOT_ALLOWED')
    if (!token) throw safeError('HCLOUD_TOKEN_MISSING')
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); timer.unref?.()
    try {
      const response = await fetchImpl(`https://api.hetzner.cloud/v1${path}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      if (!response.ok) throw safeError(response.status === 404 && SERVER_BY_ID_PATH.test(path) ? 'HCLOUD_SERVER_NOT_FOUND' : 'HCLOUD_UPSTREAM_ERROR')
      return response.json()
    } catch (error) { throw safeError(error?.name === 'AbortError' ? 'HCLOUD_TIMEOUT' : (error?.code || 'HCLOUD_UNAVAILABLE')) }
    finally { clearTimeout(timer) }
  }
  async function inventory({ force = false } = {}) {
    const cached = await loadCache?.(); const lastSuccessAt = cached?.lastSuccessAt || cached?.checkedAt; const successDate = lastSuccessAt ? new Date(lastSuccessAt) : null
    if (!force && token && cached?.inventory && successDate && now() - successDate < ttlMs) return { inventory: applyManualProvenance(cached.inventory, manual), profile: cached.profile || null, source: cached.source || 'provider', checkedAt: successDate.toISOString(), lastSuccessAt: successDate.toISOString(), stale: false }
    try {
      const exactServerPath = `/servers/${String(serverId)}`
      if (!SERVER_BY_ID_PATH.test(exactServerPath)) throw safeError('HCLOUD_SERVER_ID_INVALID')
      const [servers, volumes, primaryIps, floatingIps, loadBalancers, exactServer] = await Promise.all([...ALLOWED_PATHS].map(request).concat(request(exactServerPath)))
      const cleanServers = (servers.servers || []).map(sanitizeServer)
      const value = applyManualProvenance({
        servers: cleanServers, volumes: (volumes.volumes || []).map(sanitizeNamed), primaryIps: (primaryIps.primary_ips || []).map(sanitizeNamed),
        floatingIps: (floatingIps.floating_ips || []).map(sanitizeNamed), loadBalancers: (loadBalancers.load_balancers || []).map(sanitizeNamed),
        totals: { servers: total(servers, 'servers'), volumes: total(volumes, 'volumes'), primaryIps: total(primaryIps, 'primary_ips'), floatingIps: total(floatingIps, 'floating_ips'), loadBalancers: total(loadBalancers, 'load_balancers') },
        listCompleteness: { servers: completeness(servers, 'servers'), volumes: completeness(volumes, 'volumes'), primaryIps: completeness(primaryIps, 'primary_ips'), floatingIps: completeness(floatingIps, 'floating_ips'), loadBalancers: completeness(loadBalancers, 'load_balancers') },
      }, manual)
      const selected = exactServer?.server ? sanitizeServer(exactServer.server) : null
      if (!selected || selected.id !== String(serverId)) throw safeError('HCLOUD_SERVER_NOT_FOUND')
      const profile = selected ? { hostname: selected.name, providerServerId: selected.id, serverType: selected.serverType, architecture: selected.architecture, vcpu: selected.vcpu, memoryTotalMb: selected.memoryMb, diskTotalMb: selected.diskGb == null ? null : selected.diskGb * 1024, region: selected.region, ipv4: selected.ipv4 } : null
      const stamp = now().toISOString(); await saveCache?.({ inventory: value, profile, source: 'provider', checkedAt: stamp, lastSuccessAt: stamp, errorCode: null })
      return { inventory: value, profile, source: 'provider', checkedAt: stamp, lastSuccessAt: stamp, stale: false }
    } catch (error) {
      if (token && cached?.inventory) return { inventory: applyManualProvenance(cached.inventory, manual), profile: cached.profile || null, source: cached.source || 'provider', checkedAt: cached.checkedAt ? new Date(cached.checkedAt).toISOString() : null, lastSuccessAt: successDate?.toISOString() || null, stale: true, errorCode: error.code }
      const fallback = applyManualProvenance(baseline || { servers: [], totals: { servers: null } }, manual)
      return { inventory: fallback, profile: null, source: manual ? 'manual' : 'baseline', checkedAt: manual?.checkedAt || null, lastSuccessAt: null, stale: true, errorCode: error.code }
    }
  }
  return { inventory, request }
}
