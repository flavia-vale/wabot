'use client'

// Como a oferta aparece — os mesmos quatro formatos, com as MESMAS palavras,
// nas telas que precisam da escolha (fila de ofertas e ofertas automáticas).
//
// Um componente só, e não um bloco copiado por tela, porque a pessoa que
// escolhe "card que abre a loja" na fila precisa reconhecer a mesma coisa nas
// ofertas automáticas. Vocabulário: a tela diz o que ACONTECE ("abre a loja",
// "amplia a foto"), nunca o nome técnico do campo.

export const OFFER_APPEARANCE_OPTIONS = [
  { value: 'original', label: 'Foto da oferta', hint: 'A oferta chega como foto. Tocar na foto só amplia a foto.' },
  { value: 'original_watermark', label: 'Foto da oferta com a sua marca', hint: 'A mesma foto, com o seu nome escrito no meio dela.' },
  { value: 'preview', label: 'Card que abre a loja', hint: 'A oferta chega como um card grande. Tocar no card abre a página da oferta.' },
  { value: 'preview_watermark', label: 'Card que abre a loja, com a sua marca', hint: 'O mesmo card, com o seu nome escrito na imagem.' },
]

// Espelha WATERMARK_MAX_CHARS de src/core/destinationWatermark.js.
export const WATERMARK_TEXT_MAX_CHARS = 25

export function usesWatermark(imageMode) {
  return imageMode === 'original_watermark' || imageMode === 'preview_watermark'
}

/**
 * @param {object} props
 * @param {string} props.idPrefix  distingue os campos quando há mais de um bloco na página
 * @param {{imageMode?: string, watermarkText?: string, watermarkColor?: string}} props.value
 * @param {(patch: object) => void} props.onChange  recebe só o que mudou
 * @param {string} [props.nameSuggestion]  vira o texto da marca ao ligá-la pela 1ª vez
 * @param {boolean} [props.disabled]
 */
export function OfferAppearanceFields({ idPrefix, value, onChange, nameSuggestion = '', disabled = false }) {
  const imageMode = OFFER_APPEARANCE_OPTIONS.some((o) => o.value === value?.imageMode) ? value.imageMode : 'original'
  const watermarkText = String(value?.watermarkText ?? '')
  const watermarkColor = value?.watermarkColor === 'black' ? 'black' : 'white'
  const comMarca = usesWatermark(imageMode)
  const hint = OFFER_APPEARANCE_OPTIONS.find((o) => o.value === imageMode)?.hint ?? ''

  function trocarFormato(proximo) {
    // Ao ligar a marca pela 1ª vez sem texto salvo, sugere o nome que a pessoa
    // já deu — sem texto, o formato com marca é recusado ao salvar.
    const sugerir = usesWatermark(proximo) && !watermarkText.trim() && nameSuggestion.trim()
    onChange(sugerir
      ? { imageMode: proximo, watermarkText: [...nameSuggestion.trim()].slice(0, WATERMARK_TEXT_MAX_CHARS).join('') }
      : { imageMode: proximo })
  }

  return (
    <div className="pnl-card" style={{ marginTop: 16, boxShadow: 'none' }}>
      <div className="pnl-field">
        <label className="pnl-label" htmlFor={`${idPrefix}-appearance`}>Como a oferta aparece</label>
        <select
          id={`${idPrefix}-appearance`}
          className="pnl-input"
          value={imageMode}
          disabled={disabled}
          onChange={(e) => trocarFormato(e.target.value)}
        >
          {OFFER_APPEARANCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="pnl-hint" style={{ marginTop: 6 }}>{hint}</p>
      </div>

      {comMarca && (
        <div className="pnl-grid" style={{ marginTop: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="pnl-field">
            <label className="pnl-label" htmlFor={`${idPrefix}-watermark-text`}>O que escrever na imagem</label>
            <input
              id={`${idPrefix}-watermark-text`}
              className="pnl-input"
              value={watermarkText}
              disabled={disabled}
              maxLength={WATERMARK_TEXT_MAX_CHARS}
              placeholder="Ex.: Achadinhos da Maria"
              onChange={(e) => onChange({ watermarkText: [...e.target.value].slice(0, WATERMARK_TEXT_MAX_CHARS).join('') })}
            />
            <p className="pnl-hint" style={{ marginTop: 6 }}>
              {[...watermarkText].length}/{WATERMARK_TEXT_MAX_CHARS} caracteres. Aparece no meio da imagem.
            </p>
          </div>
          <div className="pnl-field">
            <label className="pnl-label" htmlFor={`${idPrefix}-watermark-color`}>Cor</label>
            <select
              id={`${idPrefix}-watermark-color`}
              className="pnl-input"
              value={watermarkColor}
              disabled={disabled}
              onChange={(e) => onChange({ watermarkColor: e.target.value })}
            >
              <option value="white">Branca</option>
              <option value="black">Preta</option>
            </select>
            <p className="pnl-hint" style={{ marginTop: 6 }}>
              Escolha conforme as suas fotos: a branca some em foto clara, a preta some em foto escura.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
