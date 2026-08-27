import test from 'node:test'
import assert from 'node:assert/strict'
import { createHetznerClient, manualCapacityContractFromEnv } from '../src/ops/capacity/hetznerClient.js'

test('Hetzner usa apenas GET, sanitiza inventário e cacheia por seis horas', async () => {
  const calls=[]; let cache
  const server={id:128727108,name:'wabot-prod',status:'running',server_type:{name:'CX33',architecture:'x86',cores:4,memory:8,disk:40},secret:'no'}
  const client=createHetznerClient({token:'super-secret', now:()=>new Date('2026-08-27T12:00:00Z'), loadCache:()=>cache, saveCache:(v)=>{cache=v}, fetchImpl:async(url,init)=>{calls.push({url,init}); return {ok:true,json:async()=>url.endsWith('/servers/128727108')?{server}:{servers:[server],meta:{pagination:{total_entries:1}}}}}})
  const first=await client.inventory(); const second=await client.inventory()
  assert.equal(calls.length,6); assert.ok(calls.every((call)=>call.init.method==='GET')); assert.equal(first.inventory.servers[0].secret,undefined); assert.equal(first.source,'provider'); assert.equal(second.source,'provider'); assert.equal(first.profile.serverType,'CX33'); assert.doesNotMatch(JSON.stringify(first),/super-secret/)
  await assert.rejects(()=>client.request('/servers/1/actions/poweroff'),{code:'HCLOUD_ENDPOINT_NOT_ALLOWED'})
})

test('falha externa preserva baseline sem vazar token', async()=>{ const result=await createHetznerClient({token:'secret',baseline:{servers:[{name:'baseline'}]},fetchImpl:async()=>({ok:false})}).inventory(); assert.equal(result.source,'baseline'); assert.equal(result.stale,true); assert.doesNotMatch(JSON.stringify(result),/secret/) })

test('falha preserva último sucesso persistido e TTL nunca fica abaixo de seis horas', async()=>{ let calls=0; const cached={inventory:{servers:[{name:'ok'}]},profile:{serverType:'CX33'},source:'provider',checkedAt:'2026-08-27T00:00:00Z',lastSuccessAt:'2026-08-27T00:00:00Z'}; const client=createHetznerClient({token:'hidden',cacheMs:1,now:()=>new Date('2026-08-27T05:59:00Z'),loadCache:()=>cached,fetchImpl:async()=>{calls++;throw new Error('no')}}); const result=await client.inventory(); assert.equal(calls,0); assert.equal(result.stale,false); assert.equal(new Date(result.lastSuccessAt).getTime(),new Date(cached.lastSuccessAt).getTime()) })

test('quota e custo manuais mantêm fonte e data próprias com inventário provider', async()=>{ const manual=manualCapacityContractFromEnv({CAPACITY_HETZNER_QUOTA_JSON:'{"servers":{"used":1,"limit":10}}',CAPACITY_MONTHLY_COST_EUR:'6.49',CAPACITY_CONTRACT_CHECKED_AT:'2026-08-27'}); const client=createHetznerClient({token:'read',manual,fetchImpl:async(url)=>({ok:true,json:async()=>url.endsWith('/servers/128727108')?{server:{id:128727108,name:'wabot-prod'}}:{meta:{pagination:{total_entries:0}}}})}); const result=await client.inventory(); assert.equal(result.source,'provider'); assert.equal(result.inventory.quota.source,'manual'); assert.equal(result.inventory.quota.checkedAt,'2026-08-27'); assert.equal(result.inventory.cost.monthlyEur,6.49); assert.equal(result.inventory.cost.source,'manual') })

test('sem token, cache baseline vazio não encobre proveniência manual',async()=>{ const manual=manualCapacityContractFromEnv({CAPACITY_HETZNER_QUOTA_JSON:'{"servers":{"used":1,"limit":5}}',CAPACITY_MONTHLY_COST_EUR:'9.99',CAPACITY_CONTRACT_CHECKED_AT:'2026-08-26'}); const result=await createHetznerClient({token:'',manual,baseline:{},loadCache:()=>({inventory:{},source:'baseline',checkedAt:'2026-08-27T00:00:00Z'})}).inventory(); assert.equal(result.source,'manual'); assert.equal(result.checkedAt,'2026-08-26'); assert.deepEqual(result.inventory.quota.value.servers,{used:1,limit:5}); assert.equal(result.inventory.cost.monthlyEur,9.99) })

test('seleciona contrato pelo serverId injetado sem depender do ambiente global', async () => {
  const payload = { servers: [{ id: 1, name: 'wrong', server_type: { name: 'CX11', memory: 2 } }, { id: 9, name: 'selected', server_type: { name: 'CX33', memory: 8 } }] }
  const client = createHetznerClient({ token: 'read', serverId: '9', fetchImpl: async (url) => ({ ok: true, json: async () => url.endsWith('/servers/9') ? { server: payload.servers[1] } : url.endsWith('/servers') ? payload : {} }) })
  const result = await client.inventory()
  assert.equal(result.profile.providerServerId, '9')
  assert.equal(result.profile.hostname, 'selected')
})

test('busca o host monitorado por ID exato mesmo fora da primeira pagina e declara listas truncadas', async () => {
  const firstPage = { servers: [{ id: 1, name: 'outra-vps', server_type: { name: 'CX11', memory: 2 } }], meta: { pagination: { total_entries: 81 } } }
  const selected = { id: 128727108, name: 'wabot-prod', server_type: { name: 'CX33', architecture: 'x86', cores: 4, memory: 8, disk: 40 } }
  const client = createHetznerClient({ token: 'read', serverId: '128727108', fetchImpl: async (url) => ({ ok: true, json: async () => url.endsWith('/servers/128727108') ? { server: selected } : url.endsWith('/servers') ? firstPage : { meta: { pagination: { total_entries: 0 } } } }) })
  const result = await client.inventory()
  assert.equal(result.profile.hostname, 'wabot-prod')
  assert.equal(result.inventory.servers[0].name, 'outra-vps')
  assert.deepEqual(result.inventory.listCompleteness.servers, { returned: 1, total: 81, truncated: true })
})

test('ID ausente nunca associa o perfil ao primeiro servidor da lista', async () => {
  const cached = { inventory: { servers: [{ id: '9', name: 'cached' }] }, profile: { providerServerId: '9', hostname: 'cached' }, source: 'provider', checkedAt: '2026-08-27T00:00:00Z', lastSuccessAt: '2026-08-27T00:00:00Z' }
  const result = await createHetznerClient({ token: 'read', serverId: '404', now: () => new Date('2026-08-28T00:00:00Z'), loadCache: () => cached, fetchImpl: async (url) => url.endsWith('/servers/404') ? ({ ok: false, status: 404 }) : ({ ok: true, json: async () => ({ servers: [{ id: 1, name: 'wrong' }] }) }) }).inventory({ force: true })
  assert.equal(result.stale, true)
  assert.equal(result.profile.hostname, 'cached')
  assert.equal(result.errorCode, 'HCLOUD_SERVER_NOT_FOUND')
})
