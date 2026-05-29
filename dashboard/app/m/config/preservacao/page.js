'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { cfgStyles, mobi } from '@/components/mobile/mobileStyles'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'
import { canAccessAdvancedPreservation } from '@/lib/plan'

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

  const [me, setMe] = useState(null)
  const [meLoading, setMeLoading] = useState(true)

  const [config, setConfig] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState('')

  const [draft, setDraft] = useState(null)
  const [quietHours, setQuietHours] = useState({ startHour: 0, endHour: 8, tz: 'America/Sao_Paulo' })

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
      api.preservationConfig()
        .then((data) => {
          if (!active) return
          setConfig(data.config ?? {})
          const cfg = data.config ?? {}
          setDraft({ ...cfg })
          setQuietHours(parseQuietHours(cfg.channelQuietHoursJson))
        })
        .catch((e) => { if (active) setConfigError(e.message || 'Erro ao carregar configurações.') })
        .finally(() => { if (active) setConfigLoading(false) })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [])

  const loadMonitoring = useCallback(() => {
    setHealthLoading(true)
    api.preservationHealth()
      .then((data) => setHealth(data.items ?? []))
      .catch((e) => setHealthError(e.message || 'Erro ao carregar saúde.'))
      .finally(() => setHealthLoading(false))

    setRiskLoading(true)
    api.preservationRiskScore()
      .then((data) => setRiskScore(data))
      .catch((e) => setRiskError(e.message || 'Erro ao carregar score.'))
      .finally(() => setRiskLoading(false))

    setFollowsLoading(true)
    api.preservationFollows(10)
      .then((data) => setFollows(data.items ?? []))
      .catch((e) => setFollowsError(e.message || 'Erro ao carregar follows.'))
      .finally(() => setFollowsLoading(false))

    setSnapshotsLoading(true)
    api.preservationSnapshots()
      .then((data) => setSnapshots(data.items ?? []))
      .catch((e) => setSnapshotsError(e.message || 'Erro ao carregar snapshots.'))
      .finally(() => setSnapshotsLoading(false))

    setClicksLoading(true)
    api.preservationClicks()
      .then((data) => setClicks(data))
      .catch((e) => setClicksError(e.message || 'Erro ao carregar cliques.'))
      .finally(() => setClicksLoading(false))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadMonitoring() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMonitoring])

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
      </div>

      <div style={cfgStyles.sectionLabel}>Configurações</div>

      {configLoading && (
        <div style={{ padding: '0 16px' }}>
          <MobileLoadingCard label="Carregando configurações..." />
        </div>
      )}

      {!configLoading && configError && (
        <div style={{ padding: '0 16px' }}>
          <MobileErrorCard message={configError} />
        </div>
      )}

      {!configLoading && !configError && draft && (
        <div style={{ padding: '0 16px', display: 'grid', gap: 12 }}>

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
                  onChange={(e) => setQuietHours((q) => ({ ...q, startHour: parseInt(e.target.value, 10) || 0 }))}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={cfgStyles.label}>Fim (hora, 0–23)</span>
                <input
                  type="number"
                  min={0} max={23}
                  style={cfgStyles.field}
                  value={quietHours.endHour}
                  onChange={(e) => setQuietHours((q) => ({ ...q, endHour: parseInt(e.target.value, 10) || 0 }))}
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
