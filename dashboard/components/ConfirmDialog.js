'use client'

import { useEffect, useId, useRef } from 'react'

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  danger = false,
  closeOnEscape = true,
}) {
  const titleId = useId()
  const messageId = useId()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const previousActiveElement = document.activeElement
    const focusTarget = cancelRef.current ?? dialogRef.current
    focusTarget?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        onCancel?.()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll(focusableSelector))
        .filter((element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true')

      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

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
      previousActiveElement?.focus?.()
    }
  }, [closeOnEscape, onCancel, open])

  if (!open) return null

  return (
    <div className="ui-dialog-layer fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl outline-none"
      >
        <h3 id={titleId} className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        {message && <p id={messageId} className="text-sm text-gray-600 mb-5">{message}</p>}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${danger ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600' : 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
