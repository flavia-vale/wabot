'use client'

// Aba E-mails do admin: ver/editar os textos, mandar teste, montar o público,
// disparar em massa e acompanhar o que saiu.
//
// Nenhum envio acontece aqui — a tela só chama a API, que passa tudo pelo
// motor de e-mails (catálogo + travas + fila lenta).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const ABAS = [
  ['modelos', 'Modelos'],
  ['enviar', 'Enviar agora'],
  ['historico', 'Histórico'],
]

const CATEGORIA_LABEL = {
  transactional: 'Aviso da conta',
  marketing: 'Divulgação',
}

const STATUS_LABEL = {
  sent: 'Enviado',
  queued: 'Na fila',
  skipped: 'Não enviado',
  error: 'Erro',
}

const MOTIVO_LABEL = {
  undeliverable_user: 'endereço inválido ou conta bloqueada',
  opted_out: 'pessoa descadastrada',
  already_sent: 'já recebeu este e-mail há pouco',
  template_disabled: 'e-mail desligado',
  daily_cap: 'teto do dia atingido (continua às 8h)',
  smtp_disabled: 'envio de e-mail desligado',
  batch_canceled: 'campanha cancelada',
  user_removed: 'cliente não existe mais',
  account_idle: 'conta parada — não está usando o robô',
  weekly_cap: 'já recebeu e-mails demais esta semana',
}

const ACESSO_OPCOES = [
  ['', 'Tanto faz'],
  ['ativo', 'Com acesso ativo'],
  ['vence_em', 'Vence nos próximos N dias'],
  ['vencido_ha', 'Venceu nos últimos N dias'],
  ['sem_acesso', 'Sem acesso ativo'],
]

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function Chip({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  }
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone] ?? tones.gray}`}>{children}</span>
}

function Resumo({ summary }) {
  if (!summary) return null
  const enviados = summary.enviadosNoDia ?? summary.enviados24h ?? 0
  const teto = summary.tetoDiario ?? 0
  const erros = summary.errosNoDia ?? summary.erros24h ?? 0
  const cards = [
    ['Enviados hoje', teto > 0 ? `${enviados} de ${teto}` : enviados],
    ['Esperando na fila', summary.naFila ?? 0],
    ['Erros hoje', erros],
    ['Descadastros', summary.descadastros ?? 0],
  ]
  const tetoBatido = teto > 0 && enviados >= teto
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, valor]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="text-xs font-bold text-gray-500">{label}</div>
            <div className="mt-1 text-2xl font-black text-gray-900">{valor}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        O dia de envio começa às 8h da manhã.{' '}
        {tetoBatido
          ? `O teto de hoje já foi atingido — o resto da fila sai a partir das ${summary.proximaViradaLabel ?? '8h'}.`
          : `O que sobrar na fila continua amanhã, a partir das ${summary.proximaViradaLabel ?? '8h'}.`}
      </p>
    </div>
  )
}

function Editor({ slug, onClose, onSaved }) {
  const [detalhe, setDetalhe] = useState(null)
  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [preview, setPreview] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    api.adminEmailTemplate(slug)
      .then((data) => {
        if (!ativo) return
        setDetalhe(data)
        setSubject(data.subject)
        setTitle(data.title ?? '')
        setBody(data.body)
        setEnabled(data.enabled !== false)
        setPreview(data.preview)
      })
      .catch((err) => setErro(err.message))
    return () => { ativo = false }
  }, [slug])

  const atualizarPreview = useCallback(async () => {
    try {
      setPreview(await api.adminEmailTemplatePreview(slug, { subject, title, body }))
      setErro('')
    } catch (err) {
      setErro(err.message)
    }
  }, [slug, subject, title, body])

  // Espera a admin parar de digitar antes de redesenhar a prévia.
  useEffect(() => {
    if (!detalhe) return
    const timer = setTimeout(() => { atualizarPreview() }, 600)
    return () => clearTimeout(timer)
  }, [detalhe, subject, title, body, atualizarPreview])

  async function salvar() {
    setSalvando(true)
    setErro('')
    setAviso('')
    try {
      const salvo = await api.adminEmailTemplateSave(slug, { subject, title, body, enabled })
      setDetalhe(salvo)
      setAviso('Texto salvo. Os próximos envios já usam esta versão.')
      onSaved?.()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function voltarAoPadrao() {
    if (!window.confirm('Voltar ao texto padrão do sistema? Sua edição será apagada.')) return
    setSalvando(true)
    try {
      const restaurado = await api.adminEmailTemplateReset(slug)
      setDetalhe(restaurado)
      setSubject(restaurado.subject)
      setTitle(restaurado.title ?? '')
      setBody(restaurado.body)
      setAviso('Voltamos ao texto padrão.')
      onSaved?.()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function mandarTeste() {
    setErro('')
    setAviso('')
    try {
      const resultado = await api.adminEmailTemplateTest(slug, {})
      setAviso(resultado.sent ? `Teste enviado para ${resultado.to}.` : `Não deu para enviar: ${MOTIVO_LABEL[resultado.reason] ?? resultado.reason}`)
    } catch (err) {
      setErro(err.message)
    }
  }

  if (!detalhe) return <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"><LoadingState /></div>

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-gray-900">{detalhe.name}</h3>
          <p className="text-sm text-gray-600">{detalhe.description}</p>
        </div>
        <button onClick={onClose} className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">Fechar</button>
      </div>

      {erro && <Alert type="error" message={erro} />}
      {aviso && <Alert type="success" message={aviso} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-600">Assunto</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-xs font-bold text-gray-600">Título dentro do e-mail</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="deixe em branco para não mostrar título"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <p className="mb-3 mt-1 text-xs text-gray-500">
            Aparece em letra grande acima do texto. Apague tudo para o e-mail começar direto no texto.
          </p>

          <label className="mb-1 block text-xs font-bold text-gray-600">Texto do e-mail</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs"
          />

          <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-bold text-gray-700">Como escrever</p>
            <p>Linha em branco separa parágrafos. Comece a linha com <code>- </code> para lista, ou <code>1. </code> para lista numerada.</p>
            <p>Botão verde: <code>[[botao:Texto do botão|{'{{link_painel}}'}]]</code>. Negrito: <code>**assim**</code>. Link no meio da frase: <code>[texto](https://...)</code>.</p>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs font-bold text-gray-600">Variáveis que você pode usar</p>
            <div className="flex flex-wrap gap-1">
              {detalhe.variables.map((variable) => (
                <button
                  key={variable.name}
                  type="button"
                  title={`${variable.description} (ex.: ${variable.example})`}
                  onClick={() => setBody((atual) => `${atual}{{${variable.name}}}`)}
                  className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-200"
                >
                  {`{{${variable.name}}}`}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Este e-mail está ligado
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={salvar} disabled={salvando} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar</button>
            <button onClick={mandarTeste} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 ring-1 ring-gray-200">Mandar teste para mim</button>
            {detalhe.customized && (
              <button onClick={voltarAoPadrao} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-500 ring-1 ring-gray-200">Voltar ao texto padrão</button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-bold text-gray-600">Prévia (com dados de exemplo)</p>
          <div className="rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <span className="font-bold text-gray-700">Assunto:</span> {preview?.subject}
            </div>
            <iframe
              title="Prévia do e-mail"
              srcDoc={preview?.html ?? ''}
              className="h-[520px] w-full rounded-b-xl bg-white"
            />
          </div>
          {preview?.missing?.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">Sem valor de exemplo para: {preview.missing.join(', ')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Enviar({ templates, onEnviado }) {
  const [slug, setSlug] = useState('')
  const [filtros, setFiltros] = useState({ acesso: '', dias: 7, excluirRecebidosDias: 7 })
  const [previa, setPrevia] = useState(null)
  const [busca, setBusca] = useState('')
  const [encontrados, setEncontrados] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const filtrosEfetivos = useMemo(
    () => (selecionados.length ? { userIds: selecionados.map((u) => u.id), excluirRecebidosDias: filtros.excluirRecebidosDias } : filtros),
    [filtros, selecionados],
  )

  async function conferir() {
    setErro('')
    setAviso('')
    try {
      setPrevia(await api.adminEmailAudiencePreview({ slug, filters: filtrosEfetivos }))
    } catch (err) {
      setErro(err.message)
    }
  }

  async function procurar() {
    try {
      const { users } = await api.adminEmailAudienceSearch(busca)
      setEncontrados(users)
    } catch (err) {
      setErro(err.message)
    }
  }

  async function disparar() {
    if (!slug || !previa) return
    if (!window.confirm(`Enviar "${templates.find((t) => t.slug === slug)?.name}" para ${previa.total} cliente(s)?`)) return
    setOcupado(true)
    setErro('')
    try {
      const resultado = await api.adminEmailSend({ slug, filters: filtrosEfetivos, confirmTotal: previa.total })
      setAviso(`Campanha criada: ${resultado.queued} na fila, ${resultado.skipped} fora (endereço inválido ou conta bloqueada). Sai a ${resultado.ritmo}.`)
      setPrevia(null)
      onEnviado?.()
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      {erro && <Alert type="error" message={erro} />}
      {aviso && <Alert type="success" message={aviso} />}

      <label className="mb-1 block text-xs font-bold text-gray-600">Qual e-mail enviar</label>
      <select value={slug} onChange={(e) => { setSlug(e.target.value); setPrevia(null) }} className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
        <option value="">Escolha um e-mail…</option>
        {templates.map((template) => (
          <option key={template.slug} value={template.slug}>{template.groupLabel} — {template.name}</option>
        ))}
      </select>

      <p className="mb-2 text-xs font-bold text-gray-600">Para quem</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-500">Plano</label>
          <select value={filtros.plano ?? ''} onChange={(e) => setFiltros({ ...filtros, plano: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">Tanto faz</option>
            <option value="trial">Teste grátis</option>
            <option value="basic">Básico</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-500">Situação do acesso</label>
          <select value={filtros.acesso ?? ''} onChange={(e) => setFiltros({ ...filtros, acesso: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
            {ACESSO_OPCOES.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-500">Quantos dias</label>
          <input type="number" min="1" value={filtros.dias ?? 7} onChange={(e) => setFiltros({ ...filtros, dias: Number(e.target.value) })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-500">WhatsApp</label>
          <select value={filtros.whatsapp ?? ''} onChange={(e) => setFiltros({ ...filtros, whatsapp: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">Tanto faz</option>
            <option value="conectado">Conectado</option>
            <option value="desconectado">Desconectado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-500">É afiliada</label>
          <select value={filtros.afiliado ?? ''} onChange={(e) => setFiltros({ ...filtros, afiliado: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">Tanto faz</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-500">Sem enviar oferta há (dias)</label>
          <input type="number" min="0" value={filtros.semEnvioHaDias ?? ''} onChange={(e) => setFiltros({ ...filtros, semEnvioHaDias: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-gray-500">Não repetir para quem recebeu nos últimos (dias)</label>
          <input type="number" min="0" value={filtros.excluirRecebidosDias ?? 7} onChange={(e) => setFiltros({ ...filtros, excluirRecebidosDias: Number(e.target.value) })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <p className="mb-2 text-[11px] font-bold text-gray-600">Ou escolha na mão (quando há alguém marcado, só eles recebem)</p>
        <div className="flex gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <button onClick={procurar} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-700 ring-1 ring-gray-200">Buscar</button>
        </div>
        {encontrados.length > 0 && (
          <div className="mt-2 max-h-40 overflow-auto rounded-xl bg-white p-2 ring-1 ring-gray-100">
            {encontrados.map((user) => {
              const marcado = selecionados.some((s) => s.id === user.id)
              return (
                <label key={user.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => setSelecionados((atual) => (marcado ? atual.filter((s) => s.id !== user.id) : [...atual, user]))}
                  />
                  <span className="font-medium text-gray-800">{user.name}</span>
                  <span className="text-xs text-gray-500">{user.email}</span>
                </label>
              )
            })}
          </div>
        )}
        {selecionados.length > 0 && (
          <p className="mt-2 text-xs text-gray-700">
            {selecionados.length} escolhido(s).{' '}
            <button onClick={() => setSelecionados([])} className="font-bold text-emerald-700 underline">limpar</button>
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={conferir} disabled={!slug} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 ring-1 ring-gray-200 disabled:opacity-50">Conferir para quem vai</button>
        <button onClick={disparar} disabled={!previa || ocupado || !previa.total} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {previa ? `Enviar para ${previa.total}` : 'Enviar'}
        </button>
      </div>

      {previa && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">
          <p className="font-bold text-emerald-900">{previa.total} cliente(s) — {previa.description}</p>
          <ul className="mt-2 space-y-1 text-xs text-emerald-900">
            {previa.sample.map((user) => <li key={user.id}>{user.name} · {user.email}</li>)}
          </ul>
          {previa.truncated && <p className="mt-1 text-xs text-emerald-800">…e mais {previa.total - previa.sample.length}.</p>}
        </div>
      )}
    </div>
  )
}

function Historico({ batches, sends, onCancelar }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="mb-3 text-sm font-black text-gray-900">Campanhas</h3>
        {batches.length === 0 && <p className="text-sm text-gray-500">Nenhuma campanha enviada ainda.</p>}
        <div className="space-y-2">
          {batches.map((batch) => (
            <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3">
              <div>
                <p className="text-sm font-bold text-gray-800">{batch.name}</p>
                <p className="text-xs text-gray-600">{batch.descricao || '—'} · criada em {formatDate(batch.createdAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="green">{batch.enviados} enviados</Chip>
                {batch.naFila > 0 && <Chip tone="blue">{batch.naFila} na fila</Chip>}
                {batch.descartados > 0 && <Chip tone="amber">{batch.descartados} fora</Chip>}
                {batch.erros > 0 && <Chip tone="red">{batch.erros} com erro</Chip>}
                {batch.status === 'running' && (
                  <button onClick={() => onCancelar(batch.id)} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-gray-700 ring-1 ring-gray-200">Cancelar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="mb-3 text-sm font-black text-gray-900">Últimos e-mails</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">Quando</th>
                <th className="py-1 pr-3">E-mail</th>
                <th className="py-1 pr-3">Para</th>
                <th className="py-1 pr-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((send) => (
                <tr key={send.id} className="border-t border-gray-100">
                  <td className="py-1 pr-3 text-gray-600">{formatDate(send.sentAt || send.createdAt)}</td>
                  <td className="py-1 pr-3 font-medium text-gray-800">{send.name}</td>
                  <td className="py-1 pr-3 text-gray-600">{send.email}</td>
                  <td className="py-1 pr-3">
                    <Chip tone={send.status === 'sent' ? 'green' : send.status === 'error' ? 'red' : send.status === 'queued' ? 'blue' : 'amber'}>
                      {STATUS_LABEL[send.status] ?? send.status}
                    </Chip>
                    {send.skipReason && <span className="ml-1 text-[11px] text-gray-500">{MOTIVO_LABEL[send.skipReason] ?? send.skipReason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sends.length === 0 && <p className="py-3 text-sm text-gray-500">Nada enviado ainda.</p>}
        </div>
      </div>
    </div>
  )
}

export default function AdminEmailsPage() {
  const [aba, setAba] = useState('modelos')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [summary, setSummary] = useState(null)
  const [templates, setTemplates] = useState([])
  const [slugAberto, setSlugAberto] = useState(null)
  const [batches, setBatches] = useState([])
  const [sends, setSends] = useState([])

  // Busca (sem tocar em estado) e aplicação do resultado ficam separadas: assim
  // o carregamento inicial atualiza a tela DENTRO do callback da promessa, que
  // é o formato que o lint do React exige dentro de um efeito.
  const buscarTudo = useCallback(() => Promise.all([
    api.adminEmailSummary(),
    api.adminEmailTemplates(),
    api.adminEmailBatches().catch(() => ({ batches: [] })),
    api.adminEmailSends({ limit: 100 }).catch(() => ({ sends: [] })),
  ]), [])

  const aplicar = useCallback(([resumo, lista, historicoBatches, historicoSends]) => {
    setSummary(resumo)
    setTemplates(lista.templates ?? [])
    setBatches(historicoBatches.batches ?? [])
    setSends(historicoSends.sends ?? [])
    setErro('')
  }, [])

  const recarregar = useCallback(() => buscarTudo()
    .then(aplicar)
    .catch((err) => setErro(err.message))
    .finally(() => setCarregando(false)), [buscarTudo, aplicar])

  useEffect(() => {
    let ativo = true
    buscarTudo()
      .then((dados) => { if (ativo) aplicar(dados) })
      .catch((err) => { if (ativo) setErro(err.message) })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [buscarTudo, aplicar])

  const porGrupo = useMemo(() => {
    const grupos = new Map()
    for (const template of templates) {
      const lista = grupos.get(template.groupLabel) ?? []
      lista.push(template)
      grupos.set(template.groupLabel, lista)
    }
    return [...grupos.entries()]
  }, [templates])

  async function cancelarCampanha(id) {
    if (!window.confirm('Cancelar o que ainda não saiu desta campanha?')) return
    await api.adminEmailBatchCancel(id).catch((err) => setErro(err.message))
    recarregar()
  }

  if (carregando) return <main className="min-h-screen bg-gray-50 p-6"><LoadingState /></main>

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-gray-900">E-mails</h1>
            <p className="text-sm text-gray-600">Edite os textos, mande teste e dispare campanhas.</p>
          </div>
          <Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-gray-200">Voltar ao admin</Link>
        </div>

        {erro && <Alert type="error" message={erro} />}
        {summary && !summary.smtpConfigured && (
          <Alert
            type="warning"
            title="O envio de e-mail ainda não está ligado"
            message="Dá para editar os textos e ver as prévias, mas nada é enviado até o servidor de e-mail ser configurado neste ambiente."
          />
        )}

        <Resumo summary={summary} />

        <div className="mb-4 flex gap-2">
          {ABAS.map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setAba(valor)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${aba === valor ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === 'modelos' && (
          slugAberto
            ? <Editor slug={slugAberto} onClose={() => setSlugAberto(null)} onSaved={recarregar} />
            : (
              <div className="space-y-4">
                {porGrupo.map(([grupo, lista]) => (
                  <div key={grupo} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                    <h2 className="mb-2 text-sm font-black text-gray-900">{grupo}</h2>
                    <div className="space-y-1">
                      {lista.map((template) => (
                        <button
                          key={template.slug}
                          onClick={() => setSlugAberto(template.slug)}
                          className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <div>
                            <p className="text-sm font-bold text-gray-800">{template.name}</p>
                            <p className="text-xs text-gray-500">{template.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Chip tone={template.category === 'marketing' ? 'amber' : 'gray'}>{CATEGORIA_LABEL[template.category]}</Chip>
                            {template.trigger === 'manual' && <Chip tone="blue">Manual</Chip>}
                            {template.customized && <Chip tone="green">Editado</Chip>}
                            {!template.enabled && <Chip tone="red">Desligado</Chip>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
        )}

        {aba === 'enviar' && <Enviar templates={templates} onEnviado={recarregar} />}
        {aba === 'historico' && <Historico batches={batches} sends={sends} onCancelar={cancelarCampanha} />}
      </div>
    </main>
  )
}
