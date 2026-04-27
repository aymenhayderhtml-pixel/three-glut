import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import './App.css'
import { exportGlutProgram } from './exportGlut'
import { PrismProperties } from './ui/PrismProperties'
import { PrismToolbar } from './ui/PrismToolbar'
import { Viewport } from './Viewport'
import { ContextMenu, type ContextMenuAction, type ContextMenuState } from './components/ContextMenu'
import {
  CUBE_EDGE_KEYS,
  CUBE_EDGE_LABELS,
  CUBE_FACE_KEYS,
  CUBE_FACE_LABELS,
  KIND_LABELS,
  SPACE_LABELS,
  SPACE_KINDS,
  cloneSceneObject,
  copySceneObjects,
  createSceneDocument,
  createSceneObject,
  formatColor,
  hexToVec3,
  loadStoredSceneDocument,
  parseSceneDocument,
  serializeSceneDocument,
  storeSceneDocument,
  vec3ToHex,
  type AxisLock,
  type CubeEdgeKey,
  type CubeFaceKey,
  type PrimitiveKind,
  type SceneDocument,
  type SceneObject,
  type Space,
  type ThreeDEditMode,
  type TwoDTool,
} from './scene'

type ExportScope = 'scene' | 'selection'

type SceneSnapshot = {
  activeSpace: Space
  scenes: Record<Space, SceneObject[]>
  selection: Record<Space, string | null>
}

type HistoryState = {
  past: SceneSnapshot[]
  future: SceneSnapshot[]
}

const THREE_D_EDIT_MODE_LABELS: Record<ThreeDEditMode, string> = {
  object: 'Object',
  edge: 'Edge',
  face: 'Face',
  measure: 'Measure',
}

const initialScenes: Record<Space, SceneObject[]> = {
  '2d': [
    createSceneObject('line', 0),
    createSceneObject('rect', 1),
    createSceneObject('circle', 2),
  ],
  '3d': [
    createSceneObject('cube', 0),
    createSceneObject('sphere', 1),
    createSceneObject('cone', 2),
  ],
}

const initialSelection: Record<Space, string | null> = {
  '2d': initialScenes['2d'][0]?.id ?? null,
  '3d': initialScenes['3d'][0]?.id ?? null,
}

function getSelectionFromScenes(
  scenes: Record<Space, SceneObject[]>,
): Record<Space, string | null> {
  return {
    '2d': scenes['2d'][0]?.id ?? null,
    '3d': scenes['3d'][0]?.id ?? null,
  }
}

function getInitialState(): {
  activeSpace: Space
  scenes: Record<Space, SceneObject[]>
  selection: Record<Space, string | null>
} {
  const stored = loadStoredSceneDocument()

  if (!stored) {
    return {
      activeSpace: '2d',
      scenes: initialScenes,
      selection: initialSelection,
    }
  }

  return {
    activeSpace: stored.activeSpace,
    scenes: stored.scenes,
    selection: getSelectionFromScenes(stored.scenes),
  }
}

function snapshotState(
  activeSpace: Space,
  scenes: Record<Space, SceneObject[]>,
  selection: Record<Space, string | null>,
): SceneSnapshot {
  return {
    activeSpace,
    scenes: {
      '2d': copySceneObjects(scenes['2d']),
      '3d': copySceneObjects(scenes['3d']),
    },
    selection: { ...selection },
  }
}

function sameSnapshot(a: SceneSnapshot, b: SceneSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

function getFallbackSelection(objects: SceneObject[], removedId: string) {
  const removedIndex = objects.findIndex((object) => object.id === removedId)
  if (removedIndex < 0) {
    return objects[0]?.id ?? null
  }

  return objects[removedIndex + 1]?.id ?? objects[removedIndex - 1]?.id ?? null
}

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field field-number">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ExplorerRow({
  object,
  index,
  selected,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: {
  object: SceneObject
  index: number
  selected: boolean
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [draftName, setDraftName] = useState(object.name)

  const commitRename = () => {
    const trimmed = draftName.trim()
    if (!trimmed) {
      setDraftName(object.name)
      return
    }

    if (trimmed !== object.name) {
      onRename(object.id, trimmed)
    }

    setDraftName(trimmed)
  }

  return (
    <div className={selected ? 'scene-row active' : 'scene-row'}>
      <button
        type="button"
        className="scene-icon-button scene-delete"
        aria-label={`Delete ${object.name}`}
        onClick={() => onDelete(object.id)}
      >
        Delete
      </button>

      <div className="scene-row-main" onClick={() => onSelect(object.id)}>
        <span className="scene-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="scene-meta">
          <input
            type="text"
            value={draftName}
            onFocus={() => onSelect(object.id)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitRename()
                ;(event.currentTarget as HTMLInputElement).blur()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                setDraftName(object.name)
                ;(event.currentTarget as HTMLInputElement).blur()
              }
            }}
          />
          <small>
            {KIND_LABELS[object.kind]} - {formatColor(object.color)}
          </small>
        </span>
      </div>

      <button
        type="button"
        className="scene-icon-button scene-duplicate"
        aria-label={`Duplicate ${object.name}`}
        onClick={() => onDuplicate(object.id)}
      >
        Duplicate
      </button>
    </div>
  )
}

function App() {
  const [bootstrap] = useState(getInitialState)
  const [activeSpace, setActiveSpace] = useState<Space>(bootstrap.activeSpace)
  const [scenes, setScenes] = useState<Record<Space, SceneObject[]>>(
    bootstrap.scenes,
  )
  const [selection, setSelection] = useState<Record<Space, string | null>>(
    bootstrap.selection,
  )
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
  })
  const transactionRef = useRef<SceneSnapshot | null>(null)
  const [active2DTool, setActive2DTool] = useState<TwoDTool>('select')
  const [threeDEditMode, setThreeDEditMode] =
    useState<ThreeDEditMode>('object')
  const [selectedCubeFace, setSelectedCubeFace] =
    useState<CubeFaceKey | null>(null)
  const [selectedCubeEdge, setSelectedCubeEdge] =
    useState<CubeEdgeKey | null>(null)
  const [grabMode, setGrabMode] = useState(false)
  const [axisLock, setAxisLock] = useState<AxisLock>(null)
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(true)
  const isExplorerOpen = true
  const isInspectorOpen = true
  const [exportScope, setExportScope] = useState<ExportScope>('scene')
  const [searchQuery, setSearchQuery] = useState('')
  const [copyStatus, setCopyStatus] = useState('Ready to export')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [lastMeasuredId, setLastMeasuredId] = useState<string | null>(null)

  const activeScene = scenes[activeSpace]
  const activeSelectionId = selection[activeSpace]
  const selectedObject =
    activeScene.find((object) => object.id === activeSelectionId) ?? null
  const filteredObjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return activeScene.map((object, index) => ({ object, index }))
    }

    return activeScene
      .map((object, index) => ({ object, index }))
      .filter(({ object }) => {
        const kindLabel = KIND_LABELS[object.kind].toLowerCase()
        return (
          object.name.toLowerCase().includes(query) ||
          kindLabel.includes(query)
        )
      })
  }, [activeScene, searchQuery])

  const canSubEditCube =
    activeSpace === '3d' && selectedObject?.kind === 'cube'
  const effectiveThreeDEditMode: ThreeDEditMode = canSubEditCube
    ? threeDEditMode
    : 'object'
  const effectiveSelectedCubeFace =
    canSubEditCube && effectiveThreeDEditMode === 'face'
      ? (selectedCubeFace ?? CUBE_FACE_KEYS[0])
      : null
  const effectiveSelectedCubeEdge =
    canSubEditCube && effectiveThreeDEditMode === 'edge'
      ? (selectedCubeEdge ?? CUBE_EDGE_KEYS[0])
      : null
  const activeFacePull =
    canSubEditCube && effectiveSelectedCubeFace
      ? selectedObject.facePulls[effectiveSelectedCubeFace] ?? 0
      : 0
  const activeEdgePull =
    canSubEditCube && effectiveSelectedCubeEdge
      ? selectedObject.edgePulls[effectiveSelectedCubeEdge] ?? 0
      : 0

  const sceneDocument: SceneDocument = useMemo(
    () => createSceneDocument(activeSpace, scenes),
    [activeSpace, scenes],
  )
  const exportedObjects = useMemo(() => {
    if (exportScope === 'selection') {
      return selectedObject ? [selectedObject] : []
    }

    return activeScene
  }, [activeScene, exportScope, selectedObject])
  const exportedCode = useMemo(() => {
    if (exportScope === 'selection' && !selectedObject) {
      return '// Select an object to export only that primitive.'
    }

    return exportGlutProgram(activeSpace, exportedObjects)
  }, [activeSpace, exportScope, exportedObjects, selectedObject])
  const canExportCode = exportedObjects.length > 0

  useEffect(() => {
    storeSceneDocument(sceneDocument)
  }, [sceneDocument])

  const makeSnapshot = () =>
    snapshotState(activeSpace, scenes, selection)

  const restoreSnapshot = (snapshot: SceneSnapshot) => {
    setActiveSpace(snapshot.activeSpace)
    setScenes(snapshot.scenes)
    setSelection(snapshot.selection)
  }

  const commitSceneChange = (mutate: () => void) => {
    const before = makeSnapshot()
    setHistory((current) => ({
      past: [...current.past, before],
      future: [],
    }))
    mutate()
  }

  const beginSceneTransaction = () => {
    if (!transactionRef.current) {
      transactionRef.current = makeSnapshot()
    }
  }

  const commitSceneTransaction = () => {
    const before = transactionRef.current
    if (!before) {
      return
    }

    transactionRef.current = null
    const after = makeSnapshot()
    if (!sameSnapshot(before, after)) {
      setHistory((current) => ({
        past: [...current.past, before],
        future: [],
      }))
    }
  }

  const cancelSceneTransaction = () => {
    const before = transactionRef.current
    if (!before) {
      return
    }

    transactionRef.current = null
    restoreSnapshot(before)
  }

  const undo = () => {
    if (transactionRef.current) {
      cancelSceneTransaction()
      return
    }

    if (history.past.length === 0) {
      return
    }

    const current = makeSnapshot()
    const previous = history.past[history.past.length - 1]
    setHistory({
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    })
    restoreSnapshot(previous)
  }

  const redo = () => {
    if (transactionRef.current) {
      return
    }

    if (history.future.length === 0) {
      return
    }

    const current = makeSnapshot()
    const next = history.future[0]
    setHistory({
      past: [...history.past, current],
      future: history.future.slice(1),
    })
    restoreSnapshot(next)
  }

  const updateSceneObjects = (
    space: Space,
    updater: (current: SceneObject[]) => SceneObject[],
  ) => {
    setScenes((current) => ({
      ...current,
      [space]: updater(current[space]),
    }))
  }

  const selectObject = (id: string | null) => {
    setSelection((current) => ({
      ...current,
      [activeSpace]: id,
    }))
    setLastMeasuredId(null)
  }

  const selectSpace = (space: Space) => {
    setActiveSpace(space)
    setGrabMode(false)
    setAxisLock(null)
  }

  const updateSelected = (
    patch: Partial<SceneObject>,
    recordHistory = true,
  ) => {
    if (!selectedObject) {
      return
    }

    const apply = () => {
      updateSceneObjects(activeSpace, (current) =>
        current.map((object) =>
          object.id === selectedObject.id ? { ...object, ...patch } : object,
        ),
      )
    }

    if (recordHistory) {
      commitSceneChange(apply)
    } else {
      apply()
    }
  }

  const updateSelectedVector = (
    key: 'position' | 'rotation' | 'scale',
    index: number,
    value: number,
    recordHistory = true,
  ) => {
    if (!selectedObject) {
      return
    }

    const nextVector = [...selectedObject[key]] as [number, number, number]
    nextVector[index] =
      key === 'scale' ? Math.max(0.1, roundTo(value)) : roundTo(value)
    updateSelected({ [key]: nextVector } as Partial<SceneObject>, recordHistory)
  }

  const updateThreeDEditMode = (mode: ThreeDEditMode) => {
    setThreeDEditMode(mode)
    if (mode === 'face' && !selectedCubeFace) {
      setSelectedCubeFace(CUBE_FACE_KEYS[0])
    }

    if (mode === 'edge' && !selectedCubeEdge) {
      setSelectedCubeEdge(CUBE_EDGE_KEYS[0])
    }
  }

  const updateCubeFacePull = (
    faceKey: CubeFaceKey,
    value: number,
    recordHistory = true,
  ) => {
    if (!selectedObject) {
      return
    }

    updateSelected(
      {
        facePulls: {
          ...selectedObject.facePulls,
          [faceKey]: roundTo(value),
        },
      },
      recordHistory,
    )
  }

  const updateCubeEdgePull = (
    edgeKey: CubeEdgeKey,
    value: number,
    recordHistory = true,
  ) => {
    if (!selectedObject) {
      return
    }

    updateSelected(
      {
        edgePulls: {
          ...selectedObject.edgePulls,
          [edgeKey]: roundTo(value),
        },
      },
      recordHistory,
    )
  }

  const moveObject = (
    id: string,
    position: [number, number, number],
    recordHistory = false,
  ) => {
    const apply = () => {
      updateSceneObjects(activeSpace, (current) =>
        current.map((object) =>
          object.id === id ? { ...object, position } : object,
        ),
      )
    }

    if (recordHistory) {
      commitSceneChange(apply)
    } else {
      apply()
    }
  }

  const handlePullAction = useCallback(() => {
    if (activeSpace === '3d' && selectedCubeFace && selectedObject) {
      const currentPull = selectedObject.facePulls[selectedCubeFace] || 0
      const label = CUBE_FACE_LABELS[selectedCubeFace] || selectedCubeFace
      const val = window.prompt(`Enter pull distance for ${label}:`, '0.5')
      if (val !== null) {
        const num = parseFloat(val)
        if (!isNaN(num)) {
          updateCubeFacePull(selectedCubeFace, currentPull + num, true)
        }
      }
    }
  }, [activeSpace, selectedObject, selectedCubeFace])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        handlePullAction()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePullAction])

  const addObject = (kind: PrimitiveKind) => {
    const nextObject = createSceneObject(kind, activeScene.length)

    commitSceneChange(() => {
      updateSceneObjects(activeSpace, (current) => [...current, nextObject])
      setSelection((current) => ({
        ...current,
        [activeSpace]: nextObject.id,
      }))
    })

    if (activeSpace === '2d') {
      setActive2DTool('select')
    }

    setGrabMode(false)
    setAxisLock(null)
    setCopyStatus(`Added ${KIND_LABELS[kind].toLowerCase()}`)
  }

  const duplicateObjectById = (id: string) => {
    const sourceIndex = activeScene.findIndex((object) => object.id === id)
    if (sourceIndex < 0) {
      return
    }

    const source = activeScene[sourceIndex]
    const copy = cloneSceneObject(source)

    commitSceneChange(() => {
      updateSceneObjects(activeSpace, (current) => {
        const next = [...current]
        next.splice(sourceIndex + 1, 0, copy)
        return next
      })
      setSelection((current) => ({
        ...current,
        [activeSpace]: copy.id,
      }))
    })

    setCopyStatus(`Duplicated ${source.name}`)
  }

  const deleteObjectById = (id: string) => {
    const sourceIndex = activeScene.findIndex((object) => object.id === id)
    if (sourceIndex < 0) {
      return
    }

    const nextScene = activeScene.filter((object) => object.id !== id)
    const fallbackSelection = getFallbackSelection(nextScene, id)

    commitSceneChange(() => {
      updateSceneObjects(activeSpace, () => nextScene)
      setSelection((current) => ({
        ...current,
        [activeSpace]: fallbackSelection,
      }))
    })

    if (!fallbackSelection) {
      setGrabMode(false)
      setAxisLock(null)
    }

    setCopyStatus(
      `Deleted ${KIND_LABELS[activeScene[sourceIndex].kind].toLowerCase()}`,
    )
  }

  const shortcuts = useMemo(
    () => ({
      activeSpace,
      grabMode,
      selectedObject,
      cancelSceneTransaction,
      undo,
      redo,
      duplicateObjectById,
      deleteObjectById,
    }),
    [
      activeSpace,
      cancelSceneTransaction,
      deleteObjectById,
      duplicateObjectById,
      grabMode,
      redo,
      selectedObject,
      undo,
    ],
  )

  const renameObjectById = (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }

    const current = activeScene.find((object) => object.id === id)
    if (!current || current.name === trimmed) {
      return
    }

    commitSceneChange(() => {
      updateSceneObjects(activeSpace, (objects) =>
        objects.map((object) =>
          object.id === id ? { ...object, name: trimmed } : object,
        ),
      )
    })
  }

  const create2DObjectFromGesture = (
    kind: Extract<PrimitiveKind, 'line' | 'rect' | 'circle'>,
    start: [number, number, number],
    end: [number, number, number],
  ) => {
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const distance = Math.max(0.15, Math.hypot(dx, dy))
    const midpoint: [number, number, number] = [
      roundTo((start[0] + end[0]) / 2),
      roundTo((start[1] + end[1]) / 2),
      0,
    ]
    const nextObject = createSceneObject(kind, scenes['2d'].length)

    let configuredObject: SceneObject = nextObject

    if (kind === 'line') {
      configuredObject = {
        ...nextObject,
        position: midpoint,
        length: roundTo(distance),
        rotation: [
          0,
          0,
          roundTo((Math.atan2(dy, dx) * 180) / Math.PI),
        ],
      }
    }

    if (kind === 'rect') {
      configuredObject = {
        ...nextObject,
        position: midpoint,
        width: roundTo(Math.max(0.15, Math.abs(dx))),
        height: roundTo(Math.max(0.15, Math.abs(dy))),
      }
    }

    if (kind === 'circle') {
      configuredObject = {
        ...nextObject,
        position: [roundTo(start[0]), roundTo(start[1]), 0],
        radius: roundTo(distance),
      }
    }

    commitSceneChange(() => {
      updateSceneObjects('2d', (current) => [...current, configuredObject])
      setSelection((current) => ({
        ...current,
        '2d': configuredObject.id,
      }))
    })

    setCopyStatus(`Drew ${KIND_LABELS[kind].toLowerCase()}`)
  }

  const copyCode = async () => {
    if (!canExportCode) {
      setCopyStatus('Select an object to export only that primitive.')
      return
    }

    try {
      await navigator.clipboard.writeText(exportedCode)
      setCopyStatus('Copied export code to clipboard')
    } catch {
      setCopyStatus('Clipboard access is blocked in this browser')
    }
  }

  const downloadCode = () => {
    if (!canExportCode) {
      setCopyStatus('Select an object before exporting the selection scope.')
      return
    }

    const blob = new Blob([exportedCode], { type: 'text/x-c++src' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `scene-${activeSpace}-${exportScope}.cpp`
    anchor.click()
    URL.revokeObjectURL(url)
    setCopyStatus('Downloaded scene code')
  }

  const downloadSceneJson = () => {
    const blob = new Blob([serializeSceneDocument(sceneDocument)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'scene-document.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setCopyStatus('Downloaded scene JSON')
  }

  const importSceneJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const nextDocument = parseSceneDocument(text)
      commitSceneChange(() => {
        setActiveSpace(nextDocument.activeSpace)
        setScenes(nextDocument.scenes)
        setSelection(getSelectionFromScenes(nextDocument.scenes))
      })
      setActive2DTool('select')
      setThreeDEditMode('object')
      setGrabMode(false)
      setAxisLock(null)
      setSelectedCubeFace(null)
      setSelectedCubeEdge(null)
      setSearchQuery('')
      setCopyStatus('Imported scene JSON')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not import that file.'
      setCopyStatus(message)
    } finally {
      event.target.value = ''
    }
  }

  const resetScenes = () => {
    commitSceneChange(() => {
      setActiveSpace('2d')
      setScenes(initialScenes)
      setSelection(initialSelection)
    })
    setActive2DTool('select')
    setThreeDEditMode('object')
    setSelectedCubeFace(null)
    setSelectedCubeEdge(null)
    setGrabMode(false)
    setAxisLock(null)
    setSearchQuery('')
    setCopyStatus('Reset to starter scene')
  }

  const handleContextMenuAction = (action: ContextMenuAction) => {
    setContextMenu(null)
    const objId = contextMenu?.objectId
    if (!objId) return

    switch (action.type) {
      case 'grab':
        selectObject(objId)
        setGrabMode(true)
        setAxisLock(null)
        break
      case 'delete':
        deleteObjectById(objId)
        break
      case 'copy':
        duplicateObjectById(objId)
        break
      case 'rotate': {
        const scene = scenes[activeSpace]
        const obj = scene.find((o) => o.id === objId)
        if (!obj) break
        const delta: [number, number, number] = [0, 0, 0]
        if (action.axis === 'x') delta[0] = 15
        if (action.axis === 'y') delta[1] = 15
        if (action.axis === 'z') delta[2] = 15
        const newRotation: [number, number, number] = [
          obj.rotation[0] + delta[0],
          obj.rotation[1] + delta[1],
          obj.rotation[2] + delta[2],
        ]
        commitSceneChange(() => {
          updateSceneObjects(activeSpace, (current) =>
            current.map((o) =>
              o.id === objId ? { ...o, rotation: newRotation } : o,
            ),
          )
        })
        break
      }
      case 'add-hole': {
        const scene2 = scenes[activeSpace]
        const obj2 = scene2.find((o) => o.id === objId)
        if (!obj2 || obj2.space !== '3d') break
        const newHole = {
          id: `hole_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          position: [0, 0, 0] as [number, number, number],
          radius: 0.3,
          axis: 'y' as const,
        }
        commitSceneChange(() => {
          updateSceneObjects(activeSpace, (current) =>
            current.map((o) =>
              o.id === objId ? { ...o, holes: [...o.holes, newHole] } : o,
            ),
          )
        })
        break
      }
      case 'measure': {
        const scene = scenes[activeSpace]
        const obj = scene.find((o) => o.id === objId)
        if (!obj) break
        setCopyStatus(`Measuring ${obj.name}`)
        setLastMeasuredId(objId)
        break
      }
      case 'pull': {
        handlePullAction()
        break
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (transactionRef.current) {
          event.preventDefault()
          shortcuts.cancelSceneTransaction()
        }

        if (!isEditableTarget(event.target)) {
          setGrabMode(false)
          setAxisLock(null)
        }
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()

      if (event.ctrlKey || event.metaKey) {
        if (key === 'z' && event.shiftKey) {
          event.preventDefault()
          shortcuts.redo()
          return
        }

        if (key === 'z') {
          event.preventDefault()
          shortcuts.undo()
          return
        }

        if (key === 'y') {
          event.preventDefault()
          shortcuts.redo()
          return
        }

        if (key === 'd' && shortcuts.selectedObject) {
          event.preventDefault()
          shortcuts.duplicateObjectById(shortcuts.selectedObject.id)
          return
        }
      }

      if (key === 'g') {
        event.preventDefault()
        if (shortcuts.selectedObject) {
          setGrabMode((current) => !current)
          setAxisLock(null)
        }
        return
      }

      if ((key === 'delete' || key === 'backspace') && shortcuts.selectedObject) {
        event.preventDefault()
        shortcuts.deleteObjectById(shortcuts.selectedObject.id)
        return
      }

      if (shortcuts.grabMode && (key === 'x' || key === 'y' || key === 'z')) {
        if (shortcuts.activeSpace === '2d' && key === 'z') {
          return
        }

        event.preventDefault()
        setAxisLock(key as AxisLock)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])

  const renderVectorFieldGroup = (
    label: string,
    key: 'position' | 'rotation' | 'scale',
    values: [number, number, number],
    step = 0.1,
  ) => (
    <div className="field">
      <span>{label}</span>
      <div className="vector-group">
        {(['x', 'y', 'z'] as const).map((axis, index) => (
          <NumberField
            key={axis}
            label={axis.toUpperCase()}
            value={values[index]}
            min={key === 'scale' ? 0.1 : undefined}
            step={step}
            onChange={(value) => updateSelectedVector(key, index, value)}
          />
        ))}
      </div>
    </div>
  )

  return (
    <div className="app-shell" onContextMenu={(e) => {
      if (activeSelectionId) {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, objectId: activeSelectionId })
      }
    }}>
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">TG</p>
          <div>
            <h1>Three GLUT</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="segmented">
            {(['2d', '3d'] as const).map((space) => (
              <button
                key={space}
                type="button"
                className={activeSpace === space ? 'toggle-active' : ''}
                onClick={() => selectSpace(space)}
              >
                {SPACE_LABELS[space]}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={grabMode ? 'toggle-active' : ''}
            disabled={!selectedObject}
            onClick={() => {
              if (!selectedObject) {
                return
              }

              setGrabMode((current) => !current)
              setAxisLock(null)
            }}
          >
            Grab
          </button>
          <button type="button" disabled={!history.past.length} onClick={undo}>
            Undo
          </button>
          <button type="button" disabled={!history.future.length} onClick={redo}>
            Redo
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Import
          </button>
          <button type="button" onClick={downloadSceneJson}>
            Export JSON
          </button>
          <button type="button" onClick={resetScenes}>
            Reset
          </button>
          <button
            type="button"
            className={isCodePanelOpen ? 'toggle-active' : ''}
            onClick={() => setIsCodePanelOpen((current) => !current)}
          >
            Code
          </button>
        </div>

        <div className="status-cluster">
          <span className="status-pill">{SPACE_LABELS[activeSpace]}</span>
          <span className="status-pill">{grabMode ? 'Grab' : 'Select'}</span>
          <span className="status-pill">
            {axisLock ? axisLock.toUpperCase() : 'Free'}
          </span>
          <span className="status-pill">{copyStatus}</span>
        </div>
      </header>

      <main className="editor-layout">
        <aside className="sidebar">
          {isExplorerOpen && (
          <section className="panel sidebar-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Explorer</p>
                <h2>Scene objects</h2>
              </div>
              <div className="segmented">
                {( ['2d', '3d'] as const ).map((space) => (
                  <button
                    key={space}
                    type="button"
                    className={activeSpace === space ? 'toggle-active' : ''}
                    onClick={() => selectSpace(space)}
                  >
                    {SPACE_LABELS[space]}
                  </button>
                ))}
              </div>
            </div>

            <label className="field search-field">
              <span>Search</span>
              <input
                type="search"
                placeholder="Filter by name or kind"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="tool-grid">
              {SPACE_KINDS[activeSpace].map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="tool-card"
                  onClick={() => addObject(kind)}
                >
                  <strong>+ {KIND_LABELS[kind]}</strong>
                  <small>{SPACE_LABELS[activeSpace]} primitive</small>
                </button>
              ))}
            </div>

            <div className="scene-list">
              {filteredObjects.map(({ object, index }) => (
                <ExplorerRow
                  key={`${object.id}:${object.name}`}
                  object={object}
                  index={index}
                  selected={object.id === activeSelectionId}
                  onSelect={selectObject}
                  onRename={renameObjectById}
                  onDuplicate={duplicateObjectById}
                  onDelete={deleteObjectById}
                />
              ))}

              {filteredObjects.length === 0 ? (
                <div className="empty-state">
                  <strong>No matches found.</strong>
                  <span>Try a different search or add a new primitive.</span>
                </div>
              ) : null}
            </div>
          </section>
          )}
        </aside>

        <section className="viewport-panel">
          <Viewport
            space={activeSpace}
            objects={activeScene}
            selectedId={activeSelectionId}
            active2DTool={active2DTool}
            threeDEditMode={effectiveThreeDEditMode}
            selectedCubeFace={effectiveSelectedCubeFace}
            selectedCubeEdge={effectiveSelectedCubeEdge}
            grabMode={grabMode}
            axisLock={axisLock}
            on2DToolChange={setActive2DTool}
            onThreeDEditModeChange={updateThreeDEditMode}
            onSelectCubeFace={setSelectedCubeFace}
            onSelectCubeEdge={setSelectedCubeEdge}
            onSelect={selectObject}
            onBeginSceneTransaction={beginSceneTransaction}
            onCommitSceneTransaction={commitSceneTransaction}
            onCancelSceneTransaction={cancelSceneTransaction}
            onMoveObject={moveObject}
            onUpdateCubeFacePull={updateCubeFacePull}
            onUpdateCubeEdgePull={updateCubeEdgePull}
            onCreate2DObject={create2DObjectFromGesture}
            onStatusChange={(status) => {
              setCopyStatus(status)
              if (status.includes('Measuring')) {
                if (activeSelectionId) setLastMeasuredId(activeSelectionId)
              }
            }}
            onUpdateObject={(id, changes) => {
              commitSceneChange(() => {
                updateSceneObjects(activeSpace, (current) =>
                  current.map((obj) => (obj.id === id ? { ...obj, ...changes } : obj)),
                )
              })
            }}
            lastMeasuredId={lastMeasuredId}
          />
        </section>

        <aside className="right-panel">
          {isInspectorOpen && (
          <section className="panel sidebar-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Inspector</p>
                <h2>Selection</h2>
              </div>
              <span className="status-line">
                {selectedObject
                  ? `${KIND_LABELS[selectedObject.kind]} in ${SPACE_LABELS[selectedObject.space]}`
                  : 'Nothing selected'}
              </span>
            </div>

            {selectedObject ? (
              <div className="inspector-form">
                <Field label="Name">
                  <input
                    type="text"
                    value={selectedObject.name}
                    onChange={(event) =>
                      updateSelected({ name: event.target.value })
                    }
                  />
                </Field>

                <Field label="Color">
                  <input
                    type="color"
                    value={vec3ToHex(selectedObject.color)}
                    onChange={(event) =>
                      updateSelected({
                        color: hexToVec3(event.target.value),
                      })
                    }
                  />
                </Field>

                {renderVectorFieldGroup(
                  'Position',
                  'position',
                  selectedObject.position,
                  0.1,
                )}
                {renderVectorFieldGroup(
                  'Rotation',
                  'rotation',
                  selectedObject.rotation,
                  1,
                )}
                {renderVectorFieldGroup('Scale', 'scale', selectedObject.scale, 0.1)}

                {selectedObject.space === '2d' ? (
                  <>
                    {selectedObject.kind === 'line' ? (
                      <>
                        <NumberField
                          label="Length"
                          value={selectedObject.length}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ length: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Thickness"
                          value={selectedObject.thickness}
                          min={1}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ thickness: Math.max(1, value) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'rect' ? (
                      <>
                        <NumberField
                          label="Width"
                          value={selectedObject.width}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ width: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Height"
                          value={selectedObject.height}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ height: Math.max(0.15, value) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'circle' ? (
                      <>
                        <NumberField
                          label="Radius"
                          value={selectedObject.radius}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ radius: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Segments"
                          value={selectedObject.segments}
                          min={4}
                          step={1}
                          onChange={(value) =>
                            updateSelected({ segments: Math.max(4, Math.round(value)) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'polygon' ? (
                      <>
                        <NumberField
                          label="Radius"
                          value={selectedObject.radius}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ radius: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Sides"
                          value={selectedObject.sides}
                          min={3}
                          step={1}
                          onChange={(value) =>
                            updateSelected({ sides: Math.max(3, Math.round(value)) })
                          }
                        />
                      </>
                    ) : null}
                  </>
                ) : null}

                {selectedObject.space === '3d' ? (
                  <>
                    {selectedObject.kind === 'cube' ? (
                      <>
                        <div className="field">
                          <span>Cube edit</span>
                          <div className="segmented">
                            {(['object', 'face', 'edge'] as const).map((mode) => {
                              const disabled = mode !== 'object' && selectedObject.kind !== 'cube'
                              return (
                                <button
                                  key={mode}
                                  type="button"
                                  className={
                                    effectiveThreeDEditMode === mode
                                      ? 'toggle-active'
                                      : ''
                                  }
                                  disabled={disabled}
                                  onClick={() => updateThreeDEditMode(mode)}
                                >
                                  {THREE_D_EDIT_MODE_LABELS[mode]}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {effectiveThreeDEditMode === 'face' ? (
                          <>
                            <div className="component-list">
                              {CUBE_FACE_KEYS.map((faceKey) => (
                                <button
                                  key={faceKey}
                                  type="button"
                                  className={
                                    effectiveSelectedCubeFace === faceKey
                                      ? 'toggle-active'
                                      : ''
                                  }
                                  onClick={() => setSelectedCubeFace(faceKey)}
                                >
                                  {CUBE_FACE_LABELS[faceKey]}
                                </button>
                              ))}
                            </div>
                            {effectiveSelectedCubeFace ? (
                              <NumberField
                                label="Face pull"
                                value={activeFacePull}
                                step={0.1}
                                onChange={(value) =>
                                  updateCubeFacePull(
                                    effectiveSelectedCubeFace,
                                    value,
                                  )
                                }
                              />
                            ) : null}
                          </>
                        ) : null}

                        {effectiveThreeDEditMode === 'edge' ? (
                          <>
                            <div className="component-list">
                              {CUBE_EDGE_KEYS.map((edgeKey) => (
                                <button
                                  key={edgeKey}
                                  type="button"
                                  className={
                                    effectiveSelectedCubeEdge === edgeKey
                                      ? 'toggle-active'
                                      : ''
                                  }
                                  onClick={() => setSelectedCubeEdge(edgeKey)}
                                >
                                  {CUBE_EDGE_LABELS[edgeKey]}
                                </button>
                              ))}
                            </div>
                            {effectiveSelectedCubeEdge ? (
                              <NumberField
                                label="Edge pull"
                                value={activeEdgePull}
                                step={0.1}
                                onChange={(value) =>
                                  updateCubeEdgePull(
                                    effectiveSelectedCubeEdge,
                                    value,
                                  )
                                }
                              />
                            ) : null}
                          </>
                        ) : null}

                        <NumberField
                          label="Size"
                          value={selectedObject.size}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ size: Math.max(0.15, value) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'sphere' ? (
                      <>
                        <NumberField
                          label="Radius"
                          value={selectedObject.radius}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ radius: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Segments"
                          value={selectedObject.segments}
                          min={8}
                          step={1}
                          onChange={(value) =>
                            updateSelected({ segments: Math.max(8, Math.round(value)) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'cone' ? (
                      <>
                        <NumberField
                          label="Radius"
                          value={selectedObject.radius}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ radius: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Height"
                          value={selectedObject.height}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ height: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Segments"
                          value={selectedObject.segments}
                          min={8}
                          step={1}
                          onChange={(value) =>
                            updateSelected({ segments: Math.max(8, Math.round(value)) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'torus' ? (
                      <>
                        <NumberField
                          label="Outer radius"
                          value={selectedObject.outerRadius}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ outerRadius: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Inner radius"
                          value={selectedObject.innerRadius}
                          min={0.05}
                          step={0.05}
                          onChange={(value) =>
                            updateSelected({ innerRadius: Math.max(0.05, value) })
                          }
                        />
                        <NumberField
                          label="Sides"
                          value={selectedObject.sides}
                          min={3}
                          step={1}
                          onChange={(value) =>
                            updateSelected({ sides: Math.max(3, Math.round(value)) })
                          }
                        />
                        <NumberField
                          label="Segments"
                          value={selectedObject.segments}
                          min={8}
                          step={1}
                          onChange={(value) =>
                            updateSelected({ segments: Math.max(8, Math.round(value)) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'ground' ? (
                      <>
                        <NumberField
                          label="Width"
                          value={selectedObject.width}
                          min={0.5}
                          step={0.5}
                          onChange={(value) =>
                            updateSelected({ width: Math.max(0.5, value) })
                          }
                        />
                        <NumberField
                          label="Height"
                          value={selectedObject.height}
                          min={0.05}
                          step={0.05}
                          onChange={(value) =>
                            updateSelected({ height: Math.max(0.05, value) })
                          }
                        />
                        <NumberField
                          label="Depth"
                          value={selectedObject.depth}
                          min={0.5}
                          step={0.5}
                          onChange={(value) =>
                            updateSelected({ depth: Math.max(0.5, value) })
                          }
                        />
                      </>
                    ) : null}

                    {selectedObject.kind === 'prism' ? (
                      <>
                        <NumberField
                          label="Radius"
                          value={selectedObject.radius}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ radius: Math.max(0.15, value) })
                          }
                        />
                        <NumberField
                          label="Height"
                          value={selectedObject.height}
                          min={0.15}
                          step={0.1}
                          onChange={(value) =>
                            updateSelected({ height: Math.max(0.15, value) })
                          }
                        />
                      </>
                    ) : null}
                  </>
                ) : null}

                {selectedObject && selectedObject.kind === 'prism' && (
                  <>
                    <PrismProperties />
                    <PrismToolbar />
                  </>
                )}

                {/* Holes (Beta) */}
                {selectedObject.space === '3d' && (
                  <div className="field">
                    <span>Holes (Beta)</span>
                    {selectedObject.holes.map((hole, hIdx) => (
                      <div key={hole.id} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', minWidth: 20 }}>#{hIdx + 1}</span>
                        <select
                          value={hole.axis}
                          style={{ flex: 1, fontSize: '0.68rem', padding: '2px 4px', background: 'var(--bg-darkest)', border: '1px solid var(--border-light)', color: 'var(--text)', borderRadius: 2 }}
                          onChange={(e) => {
                            const newHoles = [...selectedObject.holes]
                            newHoles[hIdx] = { ...hole, axis: e.target.value as 'x' | 'y' | 'z' }
                            updateSelected({ holes: newHoles })
                          }}
                        >
                          <option value="x">X</option>
                          <option value="y">Y</option>
                          <option value="z">Z</option>
                        </select>
                        <input
                          type="number"
                          value={hole.radius}
                          step={0.05}
                          min={0.05}
                          style={{ width: 50, fontSize: '0.68rem', padding: '2px 4px', background: 'var(--bg-darkest)', border: '1px solid var(--border-light)', color: 'var(--text)', borderRadius: 2 }}
                          onChange={(e) => {
                            const newHoles = [...selectedObject.holes]
                            newHoles[hIdx] = { ...hole, radius: Math.max(0.05, Number(e.target.value)) }
                            updateSelected({ holes: newHoles })
                          }}
                        />
                        <button
                          type="button"
                          style={{ padding: '2px 6px', fontSize: '0.6rem', color: '#e06060' }}
                          onClick={() => {
                            updateSelected({ holes: selectedObject.holes.filter((_, i) => i !== hIdx) })
                          }}
                        >✕</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newHole = {
                          id: `hole_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                          position: [0, 0, 0] as [number, number, number],
                          radius: 0.3,
                          axis: 'y' as const,
                        }
                        updateSelected({ holes: [...selectedObject.holes, newHole] })
                      }}
                    >
                      + Add Hole
                    </button>
                  </div>
                )}

                <div className="shortcut-grid">
                  <div>
                    <span>Grab</span>
                    <strong>G</strong>
                  </div>
                  <div>
                    <span>Lock X/Y/Z</span>
                    <strong>X Y Z</strong>
                  </div>
                  <div>
                    <span>Duplicate</span>
                    <strong>Ctrl+D</strong>
                  </div>
                  <div>
                    <span>Undo / Redo</span>
                    <strong>Ctrl+Z / Ctrl+Y</strong>
                  </div>
                  <div>
                    <span>Delete</span>
                    <strong>Del</strong>
                  </div>
                  <div>
                    <span>Exit grab</span>
                    <strong>Esc</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>No selection yet.</strong>
                <span>Pick an object from the explorer or click one in the viewport.</span>
              </div>
            )}
          </section>
          )}

          <section
            className={
              isCodePanelOpen
                ? 'panel sidebar-panel code-panel open'
                : 'panel sidebar-panel code-panel closed'
            }
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Code</p>
                <h2>Export</h2>
              </div>
              <span className="status-line">
                {exportScope === 'selection'
                  ? selectedObject
                    ? 'Selected object'
                    : 'Nothing selected'
                  : 'Full scene'}
              </span>
            </div>

            <div className="segmented">
              <button
                type="button"
                className={exportScope === 'scene' ? 'toggle-active' : ''}
                onClick={() => setExportScope('scene')}
              >
                Full scene
              </button>
              <button
                type="button"
                className={exportScope === 'selection' ? 'toggle-active' : ''}
                onClick={() => setExportScope('selection')}
              >
                Selected object
              </button>
            </div>

            <div className="button-row">
              <button type="button" onClick={copyCode} disabled={!canExportCode}>
                Copy code
              </button>
              <button type="button" onClick={downloadCode} disabled={!canExportCode}>
                Download code
              </button>
              <button type="button" onClick={downloadSceneJson}>
                Download JSON
              </button>
            </div>

            <pre className="code-block">{exportedCode}</pre>
          </section>
        </aside>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={importSceneJson}
      />

      <ContextMenu
        state={contextMenu}
        onAction={handleContextMenuAction}
        onClose={() => setContextMenu(null)}
      />
    </div>
  )
}

export default App
