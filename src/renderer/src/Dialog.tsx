import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ModalProps {
  label: string
  onClose: () => void
  /** Blocks Escape and scrim clicks, e.g. while an import runs. */
  busy?: boolean
  className?: string
  children: ReactNode
}

/** Native modal <dialog>: focus trap and Escape come from the browser. */
export function Modal({ label, onClose, busy = false, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // React removes the dialog before close() runs, so the browser cannot restore focus itself.
    const opener = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={label}
      onCancel={(e) => {
        // Closing is React's job: unmounting removes the dialog.
        e.preventDefault()
        if (!busy) onClose()
      }}
      // The dialog fills the window; a click on itself, not the body, is a click on the scrim.
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className={className ? `modal-body ${className}` : 'modal-body'}>{children}</div>
    </dialog>
  )
}

export interface ConfirmRequest {
  title: string
  text?: string
  /** Label of the confirming, destructive button. */
  action: string
  onConfirm: () => void
}

function ConfirmDialog({ title, text, action, onConfirm, onClose }: ConfirmRequest & { onClose: () => void }) {
  return (
    <Modal label={title} onClose={onClose} className="confirm">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      <div className="modal-actions">
        <button onClick={onClose}>Abbrechen</button>
        <button
          className="danger"
          onClick={() => {
            onClose()
            onConfirm()
          }}
        >
          {action}
        </button>
      </div>
    </Modal>
  )
}

/** Returns the dialog to render and a function that opens it. */
export function useConfirm(): [ReactNode, (request: ConfirmRequest) => void] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const dialog = request && <ConfirmDialog {...request} onClose={() => setRequest(null)} />
  return [dialog, setRequest]
}
