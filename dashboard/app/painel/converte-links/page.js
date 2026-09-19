'use client'

/* Testar conversão — desenho "Painel v2".
 *
 * A tela responde UMA pergunta, antes de a cliente ligar o espelhamento: "o
 * link está saindo com a minha identificação de afiliada?". Duas colunas: à
 * esquerda o link a testar, à direita o veredito e a comparação do endereço
 * original com o de afiliado.
 *
 * O veredito NÃO é decidido aqui — ele vem de `describeConversionTest`
 * (src/domain/painel/conversionTest.js), porque a leitura honesta desse
 * resultado é regra de produto, não de tela: conversão que falhou nem sempre
 * é credencial, e conversão que deu certo nem sempre é "tudo certo" (ML e
 * Amazon publicam pelo plano B com o código vencido).
 *
 * A detecção da loja usa `detectLinks` do próprio robô, e não uma cópia da
 * lista de endereços: a cópia que vivia aqui já tinha divergido uma vez e
 * fazia a tela dizer "link não suportado" para link que o espelhamento
 * convertia normalmente (T071).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'
import { AFFILIATE_PLATFORMS } from '@/lib/painel/affiliatePlatforms'
import { detectLinks } from '../../../../src/detector.js'
import {
  VEREDITO,
  describeConversionRequestFailure,
  describeConversionTest,
} from '../../../../src/domain/painel/conversionTest.js'

const MAX_CHARS = 1000

const PLATFORM_BY_ID = new Map(AFFILIATE_PLATFORMS.map((p) => [p.id, p]))

/* Cor da tarja por veredito. `ok` é verde; `ressalva` é âmbar (o link saiu —
 * vermelho aqui seria alarme falso); `credencial` é vermelho (há o que fazer);
 * `link` e `temporario` são neutros: não é defeito da conta dela. */
const TOM = {
  [VEREDITO.OK]: 'is-ok',
  [VEREDITO.RESSALVA]: 'is-ressalva',
  [VEREDITO.CREDENCIAL]: 'is-erro',
  [VEREDITO.LINK]: 'is-neutro',
  [VEREDITO.TEMPORARIO]: 'is-neutro',
}

const SELO = {
  [VEREDITO.OK]: 'saiu com a sua identificação',
  [VEREDITO.RESSALVA]: 'saiu com ressalva',
  [VEREDITO.CREDENCIAL]: 'falta cadastro',
  [VEREDITO.LINK]: 'link fora do teste',
  [VEREDITO.TEMPORARIO]: 'não deu para testar',
}

function Icon({ name, size = 20, stroke = 1.8 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (name) {
    case 'check': return <svg {...p}><path d="M5 12.5 10 17 19 7" /></svg>
    case 'alert': return <svg {...p}><path d="M12 8v5" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
    case 'x': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
    case 'link': return <svg {...p}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 1 0 11 21l1.5-1.5" /></svg>
    case 'copy': return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    case 'arrow': return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    default: return null
  }
}

function ICONE_DO_VEREDITO(veredito) {
  if (veredito === VEREDITO.OK) return 'check'
  if (veredito === VEREDITO.CREDENCIAL) return 'x'
  return 'alert'
}

/** Selo da loja, com as cores que a tela de credenciais já usa. */
function StoreMark({ platform, size = 26 }) {
  const loja = PLATFORM_BY_ID.get(platform)
  if (!loja) return null
  return (
    <span
      className="tc-store"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.32),
        background: loja.color,
        color: loja.badgeInk ? 'var(--ink)' : '#fff',
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden="true"
    >
      {loja.initials}
    </span>
  )
}

export default function TestarConversaoPage() {
  usePainelHeader({
    title: 'Testar conversão',
    subtitle: 'Antes de espelhar, confira se os links estão saindo com a sua identificação de afiliada',
  })

  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [falha, setFalha] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const copiaTimer = useRef(null)

  useEffect(() => () => { if (copiaTimer.current) window.clearTimeout(copiaTimer.current) }, [])

  const links = useMemo(() => {
    try { return detectLinks(texto) } catch { return [] }
  }, [texto])
  const lojaDetectada = links[0]?.platform ?? null
  const rotuloLoja = PLATFORM_BY_ID.get(lojaDetectada)?.label ?? null
  const linksDemais = links.length > 1
  const passouDoLimite = texto.length > MAX_CHARS

  const veredito = useMemo(() => {
    if (falha) return describeConversionRequestFailure(falha)
    if (resultado) return describeConversionTest(resultado)
    return null
  }, [falha, resultado])

  const podeTestar = texto.trim().length > 0 && !linksDemais && !passouDoLimite && !enviando

  async function testar(event) {
    event.preventDefault()
    setResultado(null)
    setFalha(null)
    setCopiado(false)
    if (!podeTestar) return
    setEnviando(true)
    try {
      const data = await api.convertLinks(texto)
      const primeiro = Array.isArray(data?.results) ? data.results[0] : null
      if (primeiro) setResultado(primeiro)
      else setFalha({ code: 'LINK_CONVERSION_NO_LINKS', message: '' })
    } catch (err) {
      setFalha({ code: err?.code ?? null, message: err?.message ?? '' })
    } finally {
      setEnviando(false)
    }
  }

  async function copiar(valor) {
    if (!valor) return
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      copiaTimer.current = window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  function limpar() {
    setTexto('')
    setResultado(null)
    setFalha(null)
    setCopiado(false)
  }

  return (
    <div className="pv-page tc-page">
      <div className="tc-cols">
        {/* Esquerda — o link a testar */}
        <form className="pnl-card tc-form" onSubmit={testar}>
          <div>
            <h2 className="pv-section-title">Link para testar</h2>
            <p className="pv-section-note">Cole o endereço de um produto. O resultado aparece ao lado.</p>
          </div>

          <textarea
            className="tc-textarea"
            value={texto}
            maxLength={MAX_CHARS}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="https://www.mercadolivre.com.br/..."
            aria-label="Link do produto para testar"
          />

          <div className="tc-form-foot">
            {lojaDetectada ? (
              <span className="tc-detect">
                <StoreMark platform={lojaDetectada} size={22} />
                {rotuloLoja} detectado
              </span>
            ) : (
              <span className="tc-detect is-vazio">
                {texto.trim() ? 'nenhuma loja reconhecida neste link' : 'Shopee, Amazon, Mercado Livre, Magalu, SHEIN ou AliExpress'}
              </span>
            )}
            <span className="tc-count">{texto.length}/{MAX_CHARS}</span>
          </div>

          {linksDemais && (
            <p className="tc-aviso" role="alert">
              Cole um link por vez. Encontramos {links.length} — o teste é de um produto por vez para a resposta ficar clara.
            </p>
          )}

          <div className="tc-acoes">
            <button type="submit" className="pnl-btn is-primary" disabled={!podeTestar}>
              {enviando ? 'Testando…' : 'Converter'}
            </button>
            {(texto || resultado || falha) && (
              <button type="button" className="pnl-btn" onClick={limpar}>Limpar</button>
            )}
          </div>
        </form>

        {/* Direita — o veredito */}
        <div className="tc-resultado" aria-live="polite">
          {!veredito && !enviando && (
            <div className="pnl-card tc-vazio">
              <span className="pv-stat-ico"><Icon name="link" size={22} /></span>
              <h2 className="pv-section-title">Resultado</h2>
              <p className="pv-section-note">Cole um link e clique em Converter.</p>
            </div>
          )}

          {enviando && (
            <div className="pnl-card tc-vazio">
              <span className="pv-skel" style={{ width: 42, height: 42, borderRadius: 13 }} />
              <span className="pv-skel" style={{ width: 200, height: 16, marginTop: 12 }} />
              <span className="pv-skel" style={{ width: 260, height: 13, marginTop: 8 }} />
            </div>
          )}

          {veredito && !enviando && (
            <>
              <div className={`tc-banner ${TOM[veredito.veredito] || 'is-neutro'}`}>
                <span className="tc-banner-ico"><Icon name={ICONE_DO_VEREDITO(veredito.veredito)} size={20} stroke={2.6} /></span>
                <div className="tc-banner-corpo">
                  <div className="tc-banner-titulo">{veredito.titulo}</div>
                  <p className="tc-banner-texto">{veredito.texto}</p>
                  {veredito.mostrarCredenciais && (
                    <Link href="/painel/ids-afiliada" className="pnl-btn tc-banner-btn">
                      Cadastrar minhas lojas <Icon name="arrow" size={14} />
                    </Link>
                  )}
                </div>
              </div>

              {resultado && (
                <div className={`pnl-card tc-detalhe ${TOM[veredito.veredito] || 'is-neutro'}`}>
                  <div className="tc-detalhe-head">
                    <span className="tc-detalhe-loja">
                      <StoreMark platform={resultado.platform} size={26} />
                      {resultado.label || rotuloLoja || 'Loja'}
                    </span>
                    <span className={`tc-pill ${TOM[veredito.veredito] || 'is-neutro'}`}>
                      {SELO[veredito.veredito] || '—'}
                    </span>
                  </div>

                  <div className="tc-detalhe-corpo">
                    <div>
                      <div className="tc-rotulo">Endereço original</div>
                      <div className="tc-url">{resultado.originalUrl}</div>
                    </div>

                    {resultado.convertedUrl ? (
                      <div>
                        <div className="tc-rotulo is-destaque">Link de afiliado</div>
                        <div className="tc-url is-destaque">{resultado.convertedUrl}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="tc-rotulo">Link de afiliado</div>
                        <div className="tc-url is-vazio">não foi gerado neste teste</div>
                      </div>
                    )}

                    <div className="tc-acoes">
                      {resultado.convertedUrl && (
                        <button type="button" className="pnl-btn" onClick={() => copiar(resultado.convertedUrl)}>
                          <Icon name="copy" size={14} /> {copiado ? 'Copiado' : 'Copiar link'}
                        </button>
                      )}
                      {veredito.veredito === VEREDITO.OK && (
                        <Link href="/painel/espelhamento" className="pnl-btn">
                          Ir para Espelhamento <Icon name="arrow" size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
