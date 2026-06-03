'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { cfgStyles, mobi } from '@/components/mobile/mobileStyles'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'
import { canAccessAdvancedPreservation } from '@/lib/plan'
import { parsePool, writePool, countPool } from '@/lib/mobileCopyVariationPool'

const THROTTLE_PRESETS = [
  {
    id: 'conservative',
    label: 'Conservador',
    values: { channelMinIntervalSec: 120, channelBurstCap: 3, channelBurstWindowSec: 3600, channelDailyCap: 80, channelStaggerJitterMs: 120000 },
  },
  {
    id: 'medium',
    label: 'Médio',
    values: { channelMinIntervalSec: 60, channelBurstCap: 6, channelBurstWindowSec: 3600, channelDailyCap: 150, channelStaggerJitterMs: 90000 },
  },
  {
    id: 'light',
    label: 'Leve',
    values: { channelMinIntervalSec: 30, channelBurstCap: 10, channelBurstWindowSec: 3600, channelDailyCap: 300, channelStaggerJitterMs: 45000 },
  },
]

const QUIET_TZ_OPTIONS = ['America/Sao_Paulo', 'UTC']

const HEALTH_STATUS_LABEL = { green: 'Saudável', yellow: 'Atenção', red: 'Pausado', gray: 'Sem dados' }
const HEALTH_STATUS_TONE = { green: 'success', yellow: 'warn', red: 'danger', gray: 'neutro' }
const FOLLOW_STATUS_LABEL = { ok: 'Seguido', failed: 'Falhou', rate_limited: 'Limite', pending: 'Em fila' }

function parseQuietHours(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr || '{}')
    return {
      startHour: parsed.startHour ?? 0,
      endHour: parsed.endHour ?? 8,
      tz: parsed.tz ?? 'America/Sao_Paulo',
    }
  } catch {
    return { startHour: 0, endHour: 8, tz: 'America/Sao_Paulo' }
  }
}

function buildDifferentialPatch(original, updated) {
  return Object.fromEntries(
    Object.entries(updated).filter(([key, value]) => original[key] !== value)
  )
}

function MonitoringCard({ title, children, loading, error }) {
  return (
    <div style={{ ...cfgStyles.cardP, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{title}</div>
      {loading && <MobileLoadingCard label="Carregando..." />}
      {!loading && error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      {!loading && !error && children}
    </div>
  )
}

export default function PreservacaoPage() {
  useMobileRoutePerf('m/config/preservacao')
  const router = useRouter()
  // Guarda contra setState após desmontar: loadMonitoring dispara ~6 fetches
  // paralelos; sair da página antes deles resolverem causaria updates órfãos.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const [me, setMe] = useState(null)
  const [meLoading, setMeLoading] = useState(true)

  const [config, setConfig] = useState(null)
  const [configReloadKey, setConfigReloadKey] = useState(0)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState('')

  const [draft, setDraft] = useState(null)
  const [quietHours, setQuietHours] = useState({ startHour: 0, endHour: 8, tz: 'America/Sao_Paulo' })
  const [poolDraft, setPoolDraft] = useState({ greetings: [], ctas: [], trailers: [] })

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [saveError, setSaveError] = useState('')

  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState('')

  const [riskScore, setRiskScore] = useState(null)
  const [riskLoading, setRiskLoading] = useState(true)
  const [riskError, setRiskError] = useState('')

  const [follows, setFollows] = useState(null)
  const [followsLoading, setFollowsLoading] = useState(true)
  const [followsError, setFollowsError] = useState('')

  const [snapshots, setSnapshots] = useState(null)
  const [snapshotsLoading, setSnapshotsLoading] = useState(true)
  const [snapshotsError, setSnapshotsError] = useState('')

  const [clicks, setClicks] = useState(null)
  const [clicksLoading, setClicksLoading] = useState(true)
  const [clicksError, setClicksError] = useState('')

  const [probe, setProbe] = useState(null)
  const [probeSession, setProbeSession] = useState(null)
  const [probeLoading, setProbeLoading] = useState(true)
  const [probeError, setProbeError] = useState('')
  const [probeAction, setProbeAction] = useState('')
  const [probeAccountSessionId, setProbeAccountSessionId] = useState('')

  useEffect(() => {
    let active = true
    api.me()
      .then((data) => { if (active) setMe(data) })
      .catch(() => { if (active) setMe(null) })
      .finally(() => { if (active) setMeLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (!active) return
      setConfigLoading(true)
      setConfigError('')
      api.preservationConfig()
        .then((data) => {
          if (!active) return
          setConfig(data.config ?? {})
          const cfg = data.config ?? {}
          setDraft({ ...cfg })
          setQuietHours(parseQuietHours(cfg.channelQuietHoursJson))
          setPoolDraft(parsePool(cfg.copyVariationPoolJson))
        })
        .catch((e) => { if (active) setConfigError(e.message || 'Erro ao carregar configurações.') })
        .finally(() => { if (active) setConfigLoading(false) })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [configReloadKey])

  const loadMonitoring = useCallback(() => {
    // `guard` ignora o resultado se o componente já desmontou.
    const guard = (fn) => (arg) => { if (mountedRef.current) fn(arg) }

    setHealthLoading(true)
    api.preservationHealth()
      .then(guard((data) => setHealth(data.items ?? [])))
      .catch(guard((e) => setHealthError(e.message || 'Erro ao carregar saúde.')))
      .finally(guard(() => setHealthLoading(false)))

    setRiskLoading(true)
    api.preservationRiskScore()
      .then(guard((data) => setRiskScore(data)))
      .catch(guard((e) => setRiskError(e.message || 'Erro ao carregar score.')))
      .finally(guard(() => setRiskLoading(false)))

    setFollowsLoading(true)
    api.preservationFollows(10)
      .then(guard((data) => setFollows(data.items ?? [])))
      .catch(guard((e) => setFollowsError(e.message || 'Erro ao carregar follows.')))
      .finally(guard(() => setFollowsLoading(false)))

    setSnapshotsLoading(true)
    api.preservationSnapshots()
      .then(guard((data) => setSnapshots(data.items ?? [])))
      .catch(guard((e) => setSnapshotsError(e.message || 'Erro ao carregar snapshots.')))
      .finally(guard(() => setSnapshotsLoading(false)))

    setClicksLoading(true)
    api.preservationClicks()
      .then(guard((data) => setClicks(data)))
      .catch(guard((e) => setClicksError(e.message || 'Erro ao carregar cliques.')))
      .finally(guard(() => setClicksLoading(false)))

    setProbeLoading(true)
    setProbeError('')
    Promise.all([api.preservationProbe(), api.preservationProbeSessionStatus()])
      .then(guard(([probeData, sessionData]) => {
        setProbe(probeData)
        setProbeSession(sessionData?.session ?? sessionData)
        if (probeData?.probeAccountSessionId) setProbeAccountSessionId(probeData.probeAccountSessionId)
      }))
      .catch(guard((e) => setProbeError(e.message || 'Erro ao carregar probe.')))
      .finally(guard(() => setProbeLoading(false)))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadMonitoring() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMonitoring])



  async function runProbeAction(action, handler) {
    setProbeAction(action)
    setProbeError('')
    try {
      const result = await handler()
      setProbeSession(result?.session ?? result)
      const [probeData, sessionData] = await Promise.all([api.preservationProbe(), api.preservationProbeSessionStatus()])
      setProbe(probeData)
      setProbeSession(sessionData?.session ?? sessionData)
    } catch (e) {
      setProbeError(e.message || 'Não foi possível executar ação do probe.')
    } finally {
      setProbeAction('')
    }
  }

  function startProbeSession() {
    runProbeAction('start', () => api.preservationProbeSessionStart())
  }

  function stopProbeSession() {
    runProbeAction('stop', () => api.preservationProbeSessionStop())
  }

  function selectProbeSession() {
    const value = probeAccountSessionId.trim()
    if (!value) {
      setProbeError('Informe o ID da sessão probe.')
      return
    }
    runProbeAction('select', () => api.preservationProbeSessionSelect(value))
  }

  function updateDraft(patch) {
    setDraft((current) => ({ ...(current ?? {}), ...patch }))
  }

  function applyThrottlePreset(preset) {
    updateDraft(preset.values)
  }

  async function saveConfig() {
    if (!draft || !config) return
    setSaving(true)
    setSaveSuccess('')
    setSaveError('')
    try {
      const builtDraft = {
        ...draft,
        channelQuietHoursJson: JSON.stringify(quietHours),
        copyVariationPoolJson: writePool(poolDraft),
      }
      const patch = buildDifferentialPatch(config, builtDraft)
      if (Object.keys(patch).length === 0) {
        setSaveSuccess('Sem alterações para salvar.')
        return
      }
      const result = await api.updatePreservationConfig(patch)
      const updatedConfig = result?.config ?? builtDraft
      setConfig(updatedConfig)
      setDraft({ ...updatedConfig })
      setQuietHours(parseQuietHours(updatedConfig.channelQuietHoursJson))
      setPoolDraft(parsePool(updatedConfig.copyVariationPoolJson))
      setSaveSuccess('Configurações salvas.')
    } catch (e) {
      setSaveError(e.message || 'Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }

  if (meLoading) {
    return (
      <MobileShell title="Anti-banimento" active="conta" showBack onBack={() => router.back()}>
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Verificando acesso..." /></div>
      </MobileShell>
    )
  }

  if (!canAccessAdvancedPreservation(me)) {
    return (
      <MobileShell title="Anti-banimento" active="conta" showBack onBack={() => router.back()}>
        <div style={{ padding: '18px 16px 24px' }}>
          <div style={cfgStyles.cardP}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              Anti-banimento (Pro)
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
              Proteja sua conta com controles avançados:
            </div>
            <ul style={{ margin: '0 0 20px', padding: '0 0 0 18px', display: 'grid', gap: 6 }}>
              {[
                'Limite de envios por canal',
                'Espaçamento humano entre mensagens',
                'Variação de texto automática',
                'Mutação de imagem para evitar bloqueios',
                'Monitoramento de saúde dos canais',
                'Score de risco de denúncia',
              ].map((benefit) => (
                <li key={benefit} style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{benefit}</li>
              ))}
            </ul>
            <button
              type="button"
              style={mobi.btn('primary', true)}
              onClick={() => router.push(mobileRoutes.accountSubscription)}
            >
              Ver planos
            </button>
          </div>
        </div>
      </MobileShell>
    )
  }

  const staggerJitterSec = typeof draft?.channelStaggerJitterMs === 'number'
    ? draft.channelStaggerJitterMs / 1000
    : (parseFloat(draft?.channelStaggerJitterMs) || 0) / 1000

  return (
    <MobileShell title="Anti-banimento" active="conta" showBack onBack={() => router.back()}>
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Anti-banimento</div>
      </div>

      <div style={cfgStyles.sectionLabel}>Monitoramento</div>

      <div style={{ padding: '0 16px' }}>
        <MonitoringCard title="Saúde dos canais" loading={healthLoading} error={healthError}>
          {health && health.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Sem canais de destino configurados.</div>
          )}
          {health && health.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {health.map((item) => (
                <div key={item.groupId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name || item.waJid}
                  </div>
                  <span style={cfgStyles.pill(HEALTH_STATUS_TONE[item.health?.status ?? 'gray'])}>
                    {HEALTH_STATUS_LABEL[item.health?.status ?? 'gray']}
                  </span>
                </div>
              ))}
            </div>
          )}
        </MonitoringCard>

        <MonitoringCard title="Score de risco" loading={riskLoading} error={riskError}>
          {riskScore && (
            <>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                {riskScore.avgScore ?? '—'}<span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>/100</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
                Média entre {riskScore.items?.length ?? 0} canais. Quanto menor, melhor.
              </div>
              {riskScore.items && riskScore.items.length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {riskScore.items.map((item) => (
                    <div key={item.groupId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.waJid}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', fontFamily: 'monospace' }}>{item.score ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </MonitoringCard>

        <MonitoringCard title="Últimos follows" loading={followsLoading} error={followsError}>
          {follows && follows.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Sem follows registrados ainda.</div>
          )}
          {follows && follows.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {follows.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.channelJid}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{FOLLOW_STATUS_LABEL[item.status] ?? item.status}</span>
                </div>
              ))}
            </div>
          )}
        </MonitoringCard>

        <MonitoringCard title="Snapshots dos canais" loading={snapshotsLoading} error={snapshotsError}>
          {snapshots && snapshots.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Sem canais de destino.</div>
          )}
          {snapshots && snapshots.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {snapshots.map((item) => (
                <div key={item.groupId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.waJid}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{item.total} snapshots</span>
                </div>
              ))}
            </div>
          )}
        </MonitoringCard>

        <MonitoringCard title="Cliques nos links" loading={clicksLoading} error={clicksError}>
          {clicks && (
            <div style={{ fontSize: 13, color: 'var(--ink)' }}>
              <strong>{clicks.total ?? 0}</strong> cliques nos últimos <strong>{clicks.days ?? 7}</strong> dias.
            </div>
          )}
        </MonitoringCard>

        <MonitoringCard title="Probe externo" loading={probeLoading} error={probeError}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ ...cfgStyles.field, background: 'var(--bg-soft)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 800 }}>Monitor</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 3 }}>{probe?.enabled ? `ativo · ${probe.probeMode ?? 'manual'}` : 'desligado'}</div>
              </div>
              <div style={{ ...cfgStyles.field, background: 'var(--bg-soft)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 800 }}>Sessão</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 3 }}>{probeSession?.state ?? probeSession?.status ?? (probeSession?.running ? 'rodando' : 'parada')}</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
              Use uma sessão probe separada para observar canais sem depender da sessão principal. Iniciar/parar/selecionar usa os mesmos endpoints do desktop.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" onClick={startProbeSession} disabled={probeAction === 'start'} style={mobi.btn('ghost', true)}>{probeAction === 'start' ? 'Iniciando...' : 'Iniciar probe'}</button>
              <button type="button" onClick={stopProbeSession} disabled={probeAction === 'stop'} style={mobi.btn('ghost', true)}>{probeAction === 'stop' ? 'Parando...' : 'Parar probe'}</button>
            </div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={cfgStyles.label}>ID da sessão probe</span>
              <input style={cfgStyles.field} value={probeAccountSessionId} onChange={(event) => setProbeAccountSessionId(event.target.value)} placeholder="probe-account-session-id" />
            </label>
            <button type="button" onClick={selectProbeSession} disabled={probeAction === 'select'} style={mobi.btn('ghost', true)}>{probeAction === 'select' ? 'Selecionando...' : 'Selecionar sessão probe'}</button>
          </div>
        </MonitoringCard>

      </div>

      <div style={cfgStyles.sectionLabel}>Configurações</div>

      {configLoading && (
        <div style={{ padding: '0 16px' }}>
          <MobileLoadingCard label="Carregando configurações..." />
        </div>
      )}

      {!configLoading && configError && (
        <div style={{ padding: '0 16px' }}>
          <MobileErrorCard message={configError} onRetry={() => setConfigReloadKey((k) => k + 1)} />
        </div>
      )}

      {!configLoading && !configError && draft && (
        <div style={{ padding: '0 16px', display: 'grid', gap: 12 }}>

          <div style={cfgStyles.cardP}>
            <div style={cfgStyles.row(false)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>Módulo de Preservação Avançada</div>
                <div style={cfgStyles.rowSub}>Interruptor mestre das defesas. Desligado, nenhum dos controles abaixo roda.</div>
              </div>
              <button
                type="button"
                style={cfgStyles.toggle(!!draft.preservationEnabled)}
                onClick={() => updateDraft({ preservationEnabled: !draft.preservationEnabled })}
                aria-label="Alternar módulo de preservação avançada"
                aria-checked={!!draft.preservationEnabled}
                role="switch"
              >
                <div style={cfgStyles.toggleKnob(!!draft.preservationEnabled)} />
              </button>
            </div>
            {!draft.preservationEnabled && (
              <div style={{ fontSize: 11.5, color: 'var(--warn, #b45309)', marginTop: 8 }}>
                Os ajustes abaixo só passam a valer depois de ligar o módulo.
              </div>
            )}
          </div>

          <div style={cfgStyles.cardP}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Throttle (espaçamento entre canais)</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {THROTTLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyThrottlePreset(preset)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 10,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Intervalo mínimo entre envios (s)</span>
                <input
                  type="number"
                  min={1} max={86400}
                  style={cfgStyles.field}
                  value={draft.channelMinIntervalSec ?? ''}
                  onChange={(e) => updateDraft({ channelMinIntervalSec: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Máx. envios por hora (burst cap)</span>
                <input
                  type="number"
                  min={1} max={1000}
                  style={cfgStyles.field}
                  value={draft.channelBurstCap ?? ''}
                  onChange={(e) => updateDraft({ channelBurstCap: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Limite diário (vazio = sem limite)</span>
                <input
                  type="number"
                  min={1} max={10000}
                  style={cfgStyles.field}
                  value={draft.channelDailyCap ?? ''}
                  onChange={(e) => updateDraft({ channelDailyCap: e.target.value === '' ? null : parseInt(e.target.value, 10) || null })}
                  placeholder="Sem limite"
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Atraso aleatório entre canais (s)</span>
                <input
                  type="number"
                  min={0} max={600}
                  style={cfgStyles.field}
                  value={staggerJitterSec}
                  onChange={(e) => updateDraft({ channelStaggerJitterMs: Math.round((parseFloat(e.target.value) || 0) * 1000) })}
                />
              </label>
            </div>
          </div>

          <div style={cfgStyles.cardP}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Horário silencioso</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Início (hora, 0–23)</span>
                <input
                  type="number"
                  min={0} max={23}
                  style={cfgStyles.field}
                  value={quietHours.startHour}
                  onChange={(e) => setQuietHours((q) => ({ ...q, startHour: Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)) }))}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Fim (hora, 0–23)</span>
                <input
                  type="number"
                  min={0} max={23}
                  style={cfgStyles.field}
                  value={quietHours.endHour}
                  onChange={(e) => setQuietHours((q) => ({ ...q, endHour: Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)) }))}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Fuso horário</span>
                <select
                  style={cfgStyles.field}
                  value={quietHours.tz}
                  onChange={(e) => setQuietHours((q) => ({ ...q, tz: e.target.value }))}
                >
                  {QUIET_TZ_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </label>
              {quietHours.startHour === quietHours.endHour && (
                <div style={{ fontSize: 11.5, color: 'var(--warn)' }}>
                  Início e fim iguais: nenhum horário fica em silêncio. Use horas diferentes (pode cruzar a meia-noite, ex.: 22 → 6).
                </div>
              )}
            </div>
          </div>

          <div style={cfgStyles.cardP}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>Follow guard</div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={cfgStyles.label}>Máx. follows por dia</span>
              <input
                type="number"
                min={1} max={50}
                style={cfgStyles.field}
                value={draft.maxDailyFollows ?? ''}
                onChange={(e) => updateDraft({ maxDailyFollows: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </label>
          </div>

          <div style={cfgStyles.cardP}>
            <div style={{ ...cfgStyles.row(false), padding: '0 0 12px', borderBottom: '1px solid var(--line)' }}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>Mutação de imagem</div>
                <div style={cfgStyles.rowSub}>Altera pixels sutilmente para evitar bloqueios por hash de imagem</div>
              </div>
              <button
                type="button"
                style={cfgStyles.toggle(!!draft.imageMutationEnabled)}
                onClick={() => updateDraft({ imageMutationEnabled: !draft.imageMutationEnabled })}
                aria-label="Alternar mutação de imagem"
                aria-checked={!!draft.imageMutationEnabled}
                role="switch"
              >
                <div style={cfgStyles.toggleKnob(!!draft.imageMutationEnabled)} />
              </button>
            </div>

            <div style={{ ...cfgStyles.row(true), padding: '12px 0 0', borderBottom: 'none' }}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>Probe externo</div>
                <div style={cfgStyles.rowSub}>Observação externa do status dos canais</div>
              </div>
              <button
                type="button"
                style={cfgStyles.toggle(!!draft.probeEnabled)}
                onClick={() => updateDraft({ probeEnabled: !draft.probeEnabled })}
                aria-label="Alternar probe externo"
                aria-checked={!!draft.probeEnabled}
                role="switch"
              >
                <div style={cfgStyles.toggleKnob(!!draft.probeEnabled)} />
              </button>
            </div>
          </div>

          <div style={cfgStyles.cardP}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
              Variações de texto
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.5 }}>
              O bot alterna entre essas variações para parecer mais humano. {countPool(poolDraft).total} variações no total.
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { key: 'greetings', label: 'Saudações' },
                { key: 'ctas', label: 'Chamadas (CTA)' },
                { key: 'trailers', label: 'Encerramentos' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'grid', gap: 6 }}>
                  <span style={cfgStyles.label}>{label}</span>
                  <textarea
                    style={{ ...cfgStyles.field, minHeight: 68, resize: 'vertical' }}
                    placeholder="Uma variação por linha"
                    value={poolDraft[key].join('\n')}
                    onChange={(e) => setPoolDraft((current) => ({ ...current, [key]: e.target.value.split('\n') }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            style={{ ...mobi.btn('primary', true), opacity: saving ? 0.65 : 1 }}
          >
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>

          {saveSuccess && <div style={{ fontSize: 12, color: 'var(--success)' }}>{saveSuccess}</div>}
          {saveError && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{saveError}</div>}
        </div>
      )}

      <div style={{ height: 28 }} />
    </MobileShell>
  )
}
