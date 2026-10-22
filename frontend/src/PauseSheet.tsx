import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/** Bottom sheet as a native modal dialog: focus handling and Escape come for free. */
export function PauseSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="pauses-heading"
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="sheet-body">
        <button type="button" className="icon-button sheet-close" aria-label="Schließen" onClick={onClose}>
          <X aria-hidden size={22} />
        </button>
        {open && children}
      </div>
    </dialog>
  )
}
