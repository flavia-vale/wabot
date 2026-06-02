'use client'

import { useEffect, useId, useRef } from 'react'
import { mobi } from '@/components/mobile/mobileStyles'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Primitivo de modal mobile acessível: overlay, focus-trap, Escape, autofocus
// no primeiro elemento focável e restauração de foco ao fechar. Usado tanto
// pelos modais de formulário (agendar envio, destinos do grupo) quanto pelo
// MobileConfirmDialog. Mantém o visual com tokens (var(--...)).
export function MobileModal({
  open,
  onClose,
  ariaLabel,
  labelledBy,
  describedBy,
  dismissible = true,
  variant = 'center', // 'center' | 'sheet'
  maxWidth = 420,
  children,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const previouslyFocused = document.activeElement
    // Foca o primeiro elemento focável (ou o próprio diálogo) ao abrir.
    const focusables = dialogRef.current
      ? Array.from(dialogRef.current.querySelectorAll(FOCUSABLE)).filter(
          (el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true',
        )
      : []
    ;(focusables[0] ?? dialogRef.current)?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const items = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE)).filter(
        (el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true',
      )
      if (!items.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [open, dismissible, onClose])

  if (!open) return null

  const isSheet = variant === 'sheet'
  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: isSheet ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: isSheet ? 0 : '0 16px',
  }
  const panelStyle = isSheet
    ? {
        width: '100%',
        maxWidth: 520,
        background: 'var(--surface)',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        padding: '20px 18px calc(24px + env(safe-area-inset-bottom))',
        maxHeight: '80vh',
        overflowY: 'auto',
        outline: 'none',
      }
    : {
        width: '100%',
        maxWidth,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        padding: 22,
        maxHeight: '85vh',
        overflowY: 'auto',
        outline: 'none',
      }

  return (
    <div style={overlayStyle} onClick={() => dismissible && onClose?.()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={panelStyle}
      >
        {children}
      </div>
    </div>
  )
}

// Diálogo de confirmação mobile (tokens + a11y). Substitui window.confirm e
// cliques destrutivos diretos. confirmTone='danger' pinta o botão de vermelho.
export function MobileConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  danger = false,
  busy = false,
}) {
  const titleId = useId()
  const messageId = useId()
  return (
    <MobileModal
      open={open}
      onClose={busy ? undefined : onCancel}
      dismissible={!busy}
      labelledBy={title ? titleId : undefined}
      describedBy={message ? messageId : undefined}
      ariaLabel={title ? undefined : 'Confirmação'}
      maxWidth={380}
    >
      {title && (
        <h3 id={titleId} style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          {title}
        </h3>
      )}
      {message && (
        <p id={messageId} style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 18 }}>
          {message}
        </p>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          style={{
            ...mobi.btn(danger ? 'accent' : 'primary', true),
            background: danger ? 'var(--danger)' : 'var(--ink)',
            opacity: busy ? 0.65 : 1,
          }}
        >
          {busy ? 'Aguarde…' : confirmLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={mobi.btn('ghost', true)}>
          {cancelLabel}
        </button>
      </div>
    </MobileModal>
  )
}
