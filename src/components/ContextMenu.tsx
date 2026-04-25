import { useEffect, useRef } from 'react'

export type ContextMenuAction =
  | { type: 'grab' }
  | { type: 'delete' }
  | { type: 'copy' }
  | { type: 'rotate'; axis: 'x' | 'y' | 'z' }
  | { type: 'add-hole' }
  | { type: 'measure' }
  | { type: 'pull' }

export type ContextMenuState = {
  x: number
  y: number
  objectId: string
} | null

export function ContextMenu({
  state,
  onAction,
  onClose,
}: {
  state: ContextMenuState
  onAction: (action: ContextMenuAction) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!state) return undefined

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [state, onClose])

  if (!state) return null

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: state.x, top: state.y }}
    >
      <button type="button" onClick={() => onAction({ type: 'grab' })}>
        <span className="ctx-icon">✥</span> Grab
        <span className="ctx-shortcut">G</span>
      </button>
      <button type="button" onClick={() => onAction({ type: 'copy' })}>
        <span className="ctx-icon">⧉</span> Duplicate
        <span className="ctx-shortcut">Ctrl+D</span>
      </button>
      <div className="ctx-separator" />
      <button type="button" onClick={() => onAction({ type: 'rotate', axis: 'x' })}>
        <span className="ctx-icon">↻</span> Rotate X +15°
        <span className="ctx-shortcut">X</span>
      </button>
      <button type="button" onClick={() => onAction({ type: 'rotate', axis: 'y' })}>
        <span className="ctx-icon">↻</span> Rotate Y +15°
        <span className="ctx-shortcut">Y</span>
      </button>
      <button type="button" onClick={() => onAction({ type: 'rotate', axis: 'z' })}>
        <span className="ctx-icon">↻</span> Rotate Z +15°
        <span className="ctx-shortcut">Z</span>
      </button>
      <div className="ctx-separator" />
      <button type="button" onClick={() => onAction({ type: 'add-hole' })}>
        <span className="ctx-icon">◎</span> Add Hole
        <span className="ctx-shortcut">Beta</span>
      </button>
      <button type="button" onClick={() => onAction({ type: 'measure' })}>
        <span className="ctx-icon">📏</span> Measure
        <span className="ctx-shortcut">M</span>
      </button>
      <button type="button" onClick={() => onAction({ type: 'pull' })}>
        <span className="ctx-icon">↕️</span> Pull
        <span className="ctx-shortcut">Ctrl+P</span>
      </button>
      <div className="ctx-separator" />
      <button type="button" className="ctx-danger" onClick={() => onAction({ type: 'delete' })}>
        <span className="ctx-icon">✕</span> Delete
        <span className="ctx-shortcut">Del</span>
      </button>
    </div>
  )
}
