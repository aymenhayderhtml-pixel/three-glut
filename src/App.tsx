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
import { Viewport } from './Viewport'
import { ContextMenu, type ContextMenuAction, type ContextMenuState } from './components/ContextMenu'
import {
  CUBE_EDGE_KEYS,
  CUBE_FACE_KEYS,
  CUBE_FACE_LABELS,
  KIND_LABELS,
  SPACE_LABELS,
  SPACE_KINDS,
  cloneSceneObject,
  copySceneObjects,
  createSceneDocument,
  createSceneObject,
  getObjectDimensions,
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
  type TransformMode,
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

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="be-section">
      <button
        type="button"
        className="be-section-header be-section-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={`be-section-chevron${open ? ' open' : ''}`}>›</span>
      </button>
      <div className={`be-section-body${open ? ' open' : ''}`}>
        <div>{children}</div>
      </div>
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
  const [transformMode, setTransformMode] =
    useState<TransformMode | null>(null)
  const [selectedCubeFace, setSelectedCubeFace] =
    useState<CubeFaceKey | null>(null)
  const [selectedCubeEdge, setSelectedCubeEdge] =
    useState<CubeEdgeKey | null>(null)
  const [grabMode, setGrabMode] = useState(false)
  const [axisLock, setAxisLock] = useState<AxisLock>(null)
  const [exportScope, setExportScope] = useState<ExportScope>('scene')
  const [copyStatus, setCopyStatus] = useState('Ready to export')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [lastMeasuredId, setLastMeasuredId] = useState<string | null>(null)
  const [glutImportCode, setGlutImportCode] = useState<string>('')
  const [glutImportTab, setGlutImportTab] = useState<'export' | 'import'>('export')
  const [arrayAxis, setArrayAxis] = useState<'x' | 'y' | 'z'>('x')
  const [arrayCount, setArrayCount] = useState(3)
  const [arrayGap, setArrayGap] = useState(0.5)
  const [moveStep, setMoveStep] = useState(0.5)
  const [armedFavorite, setArmedFavorite] = useState<string | null>(null)
  const [favoriteColors, setFavoriteColors] = useState<(string | null)[]>(() => {
    try {
      const stored = localStorage.getItem('three-glut-fav-colors')
      if (stored) return JSON.parse(stored)
    } catch { }
    return [null, null, null, null, null]
  })
  const [pullDialog, setPullDialog] = useState<{ faceKey: CubeFaceKey; label: string } | null>(null)
  const [projectName, setProjectName] = useState<string>(() => {
    return localStorage.getItem('three-glut-active-project') ?? 'Untitled'
  })
  const [fileMenuOpen, setFileMenuOpen] = useState(false)


  const [multiSelection, setMultiSelection] = useState<Record<Space, string[]>>({ '2d': [], '3d': [] })

  const activeScene = scenes[activeSpace]
  const activeSelectionId = selection[activeSpace]
  const multiSelectedIds = multiSelection[activeSpace]
  const hasMultiSelect = multiSelectedIds.length > 1
  const multiSelectedObjects = activeScene.filter(o => multiSelectedIds.includes(o.id))
  const selectedObject =
    activeScene.find((object) => object.id === activeSelectionId) ?? null
  const canSubEdit =
    activeSpace === '3d' && (selectedObject?.kind === 'cube' || selectedObject?.kind === 'prism')
  const effectiveThreeDEditMode: ThreeDEditMode = canSubEdit
    ? threeDEditMode
    : 'object'
  const effectiveSelectedCubeFace =
    canSubEdit && effectiveThreeDEditMode === 'face'
      ? selectedCubeFace
      : null
  const effectiveSelectedCubeEdge =
    canSubEdit && effectiveThreeDEditMode === 'edge'
      ? selectedCubeEdge
      : null

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
    const timer = setTimeout(() => {
      storeSceneDocument(sceneDocument)
    }, 1000)
    return () => clearTimeout(timer)
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

  const cancelSceneTransaction = useCallback(() => {
    const before = transactionRef.current
    if (!before) {
      return
    }

    transactionRef.current = null
    restoreSnapshot(before)
  }, [restoreSnapshot])

  const undo = useCallback(() => {
    setHistory((current) => {
      if (transactionRef.current) {
        cancelSceneTransaction()
        return current
      }

      if (current.past.length === 0) {
        return current
      }

      const now = makeSnapshot()
      const previous = current.past[current.past.length - 1]

      restoreSnapshot(previous)

      return {
        past: current.past.slice(0, -1),
        future: [now, ...current.future],
      }
    })
  }, [cancelSceneTransaction, makeSnapshot, restoreSnapshot])

  const redo = useCallback(() => {
    setHistory((current) => {
      if (transactionRef.current || current.future.length === 0) {
        return current
      }

      const now = makeSnapshot()
      const next = current.future[0]

      restoreSnapshot(next)

      return {
        past: [...current.past, now],
        future: current.future.slice(1),
      }
    })
  }, [makeSnapshot, restoreSnapshot])

  const updateSceneObjects = (
    space: Space,
    updater: (current: SceneObject[]) => SceneObject[],
  ) => {
    setScenes((current) => ({
      ...current,
      [space]: updater(current[space]),
    }))
  }

  const selectObject = useCallback((id: string | null) => {
    setSelection((current) => ({
      ...current,
      [activeSpace]: id,
    }))
    // Normal click clears multi-selection
    setMultiSelection((cur) => ({ ...cur, [activeSpace]: id ? [id] : [] }))
    setLastMeasuredId(null)
  }, [activeSpace])

  const shiftSelectObject = (id: string) => {
    setMultiSelection((cur) => {
      const ids = cur[activeSpace]
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
      return { ...cur, [activeSpace]: next }
    })
    // Also update primary selection to this object
    setSelection((current) => ({ ...current, [activeSpace]: id }))
    setLastMeasuredId(null)
  }

  const selectSpace = (space: Space) => {
    setActiveSpace(space)
    setGrabMode(false)
    setTransformMode(null)
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
        current.map((object) => {
          if (object.id !== selectedObject.id) return object
          return {
            ...object,
            ...patch,
            faceColors: patch.faceColors
              ? { ...(object.faceColors || {}), ...patch.faceColors }
              : object.faceColors,
            facePulls: patch.facePulls
              ? { ...(object.facePulls || {}), ...patch.facePulls }
              : object.facePulls,
            edgePulls: patch.edgePulls
              ? { ...(object.edgePulls || {}), ...patch.edgePulls }
              : object.edgePulls,
          }
        }),
      )
    }

    if (recordHistory) {
      commitSceneChange(apply)
    } else {
      apply()
    }
  }

  // Bulk update all multi-selected objects with the same patch
  const updateMultiSelected = (patch: Partial<SceneObject>, recordHistory = true) => {
    if (multiSelectedIds.length === 0) return
    const ids = new Set(multiSelectedIds)
    const apply = () => {
      updateSceneObjects(activeSpace, (current) =>
        current.map((obj) => {
          if (!ids.has(obj.id)) return obj
          return {
            ...obj,
            ...patch,
            faceColors: patch.faceColors ? { ...(obj.faceColors || {}), ...patch.faceColors } : obj.faceColors,
          }
        }),
      )
    }
    if (recordHistory) commitSceneChange(apply)
    else apply()
  }

  // Multiply scale or add rotation delta to all selected on one axis
  const applyDeltaToMulti = (key: 'scale' | 'rotation' | 'position', axis: 0 | 1 | 2, delta: number) => {
    const ids = new Set(multiSelectedIds)
    commitSceneChange(() => {
      updateSceneObjects(activeSpace, (current) =>
        current.map((obj) => {
          if (!ids.has(obj.id)) return obj
          const vec = [...obj[key]] as [number, number, number]
          vec[axis] = key === 'scale' ? Math.max(0.05, roundTo(vec[axis] * delta)) : roundTo(vec[axis] + delta)
          return { ...obj, [key]: vec }
        }),
      )
    })
  }

  // Convert all multi-selected to a new kind, keeping position / rotation / scale / color
  const changeTypeForSelected = (newKind: PrimitiveKind) => {
    const ids = new Set(multiSelectedIds)
    commitSceneChange(() => {
      updateSceneObjects(activeSpace, (current) =>
        current.map((obj) => {
          if (!ids.has(obj.id)) return obj
          const base = createSceneObject(newKind, 0)
          return { ...base, id: obj.id, name: obj.name, position: obj.position, rotation: obj.rotation, scale: obj.scale, color: obj.color }
        }),
      )
    })
  }

  // Delete all multi-selected objects in one history step
  const deleteMultiSelected = () => {
    const ids = new Set(multiSelectedIds)
    commitSceneChange(() => {
      updateSceneObjects(activeSpace, (cur) => cur.filter((o) => !ids.has(o.id)))
    })
    setMultiSelection((cur) => ({ ...cur, [activeSpace]: [] }))
    selectObject(null)
  }

  const saveFavorite = (index: number) => {
    if (!selectedObject) return
    const hex = vec3ToHex(selectedObject.color)
    const next = [...favoriteColors]
    next[index] = hex
    setFavoriteColors(next)
    localStorage.setItem('three-glut-fav-colors', JSON.stringify(next))
    setCopyStatus(`Saved to slot ${index + 1}`)
  }

  const createArray = () => {
    if (!selectedObject) return

    const axisIndex = arrayAxis === 'x' ? 0 : arrayAxis === 'y' ? 1 : 2
    const copies: SceneObject[] = []

    // Create (count - 1) copies
    const copiesToCreate = Math.max(0, arrayCount - 1)

    for (let i = 0; i < copiesToCreate; i++) {
      const dim = getObjectDimensions(selectedObject)
      const offset = (dim[axisIndex] + arrayGap) * (i + 1)

      const copy = cloneSceneObject(selectedObject)
      copy.name = `${selectedObject.name} Array ${i + 1}`
      copy.position[axisIndex] += offset
      copies.push(copy)
    }

    if (copies.length > 0) {
      commitSceneChange(() => {
        updateSceneObjects(activeSpace, (current) => [...current, ...copies])
      })
      setCopyStatus(`Created array of ${arrayCount} objects`)
    }
  }

  const moveSelected = useCallback((axis: 'x' | 'y' | 'z', direction: 1 | -1, step = 0.5) => {
    if (!selectedObject) return
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
    const next = [...selectedObject.position] as [number, number, number]
    next[axisIndex] = roundTo(next[axisIndex] + (direction * step))
    updateSelected({ position: next })
  }, [selectedObject, updateSelected])


  const onUpdateCubeFaceColor = (faceKey: string, color: { r: number; g: number; b: number }) => {
    updateSelected({ faceColors: { [faceKey]: [color.r, color.g, color.b] } })
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
    if (mode === 'object') {
      setTransformMode(null)
    }
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
        facePulls: { [faceKey]: roundTo(value) },
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
        edgePulls: { [edgeKey]: roundTo(value) },
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
      const label = CUBE_FACE_LABELS[selectedCubeFace] || selectedCubeFace
      setPullDialog({ faceKey: selectedCubeFace, label })
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
    setTransformMode(null)
    setAxisLock(null)
    setCopyStatus(`Added ${KIND_LABELS[kind].toLowerCase()}`)
  }

  const duplicateObjectById = useCallback((id: string) => {
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
  }, [activeScene, activeSpace, commitSceneChange, updateSceneObjects])

  const deleteObjectById = useCallback((id: string) => {
    const sourceIndex = activeScene.findIndex((object) => object.id === id)
    if (sourceIndex < 0) {
      return
    }

    const nextScene = activeScene.filter((object) => object.id !== id)
    const fallbackSelection = nextScene[sourceIndex]?.id ?? nextScene[sourceIndex - 1]?.id ?? null

    commitSceneChange(() => {
      updateSceneObjects(activeSpace, () => nextScene)
      setSelection((current) => ({
        ...current,
        [activeSpace]: fallbackSelection,
      }))
    })

    if (!fallbackSelection) {
      setGrabMode(false)
      setTransformMode(null)
      setAxisLock(null)
    }

    setCopyStatus(
      `Deleted ${KIND_LABELS[activeScene[sourceIndex].kind].toLowerCase()}`,
    )
  }, [activeScene, activeSpace, commitSceneChange, updateSceneObjects])

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
      selectObject,
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
      selectObject,
    ],
  )

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
        position: [start[0], start[1], 0],
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
      setTransformMode(null)
      setAxisLock(null)
      setSelectedCubeFace(null)
      setSelectedCubeEdge(null)
      const fileName = file.name.replace(/\.json$/i, '')
      setProjectName(fileName)
      localStorage.setItem('three-glut-active-project', fileName)
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
    setTransformMode(null)
    setAxisLock(null)
    setCopyStatus('Reset to starter scene')
  }

  const getAllProjects = (): string[] => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('three-glut-project:')) {
        keys.push(key.replace('three-glut-project:', ''))
      }
    }
    return keys.sort()
  }

  const saveProjectToStorage = (name: string) => {
    const doc = createSceneDocument(activeSpace, scenes)
    localStorage.setItem(`three-glut-project:${name}`, serializeSceneDocument(doc))
    localStorage.setItem('three-glut-active-project', name)
  }

  const loadProjectFromStorage = (name: string) => {
    const raw = localStorage.getItem(`three-glut-project:${name}`)
    if (!raw) return
    try {
      const doc = parseSceneDocument(raw)
      commitSceneChange(() => {
        setActiveSpace(doc.activeSpace)
        setScenes(doc.scenes)
        setSelection(getSelectionFromScenes(doc.scenes))
      })
      setProjectName(name)
      localStorage.setItem('three-glut-active-project', name)
      setActive2DTool('select')
      setThreeDEditMode('object')
      setGrabMode(false)
      setTransformMode(null)
      setAxisLock(null)
      setSelectedCubeFace(null)
      setSelectedCubeEdge(null)
      setCopyStatus(`Opened "${name}"`)
    } catch {
      setCopyStatus(`Failed to load "${name}"`)
    }
  }

  const handleNewProject = () => {
    const name = window.prompt('Project name:', 'Untitled')
    if (!name?.trim()) return
    const trimmed = name.trim()

    // Create and save the new empty project to localStorage first
    const emptyDoc = createSceneDocument('2d', initialScenes)
    localStorage.setItem(`three-glut-project:${trimmed}`, serializeSceneDocument(emptyDoc))
    localStorage.setItem('three-glut-active-project', trimmed)

    // Open in new tab — the new tab will read the active project on boot
    window.open(window.location.href, '_blank')

    setCopyStatus(`Created "${trimmed}" (opened in new tab)`)
    setFileMenuOpen(false)
  }

  const handleSave = () => {
    saveProjectToStorage(projectName)
    setCopyStatus(`Saved "${projectName}"`)
    setFileMenuOpen(false)
  }

  const handleSaveAs = () => {
    const name = window.prompt('Save as:', projectName)
    if (!name?.trim()) return
    const trimmed = name.trim()
    setProjectName(trimmed)
    saveProjectToStorage(trimmed)
    setCopyStatus(`Saved as "${trimmed}"`)
    setFileMenuOpen(false)
  }

  const handleDownload = () => {
    const doc = createSceneDocument(activeSpace, scenes)
    const blob = new Blob([serializeSceneDocument(doc)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}.json`
    a.click()
    URL.revokeObjectURL(url)
    setCopyStatus(`Downloaded "${projectName}.json"`)
    setFileMenuOpen(false)
  }

  const handleOpenRecent = (name: string) => {
    loadProjectFromStorage(name)
    setFileMenuOpen(false)
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
          return
        }

        if (!isEditableTarget(event.target)) {
          setGrabMode(false)
          setTransformMode(null)
          setAxisLock(null)
          shortcuts.selectObject(null)
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
          setTransformMode(null)
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

  // Color dot helper: converts [r,g,b] (0-1) to CSS string
  const objDotColor = (c: [number, number, number]) =>
    `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`

  const TOOL_3D = [
    { id: 'select', icon: '◁', label: 'Select' },
    { id: 'move', icon: '✥', label: 'Move' },
    { id: 'rotate', icon: '↻', label: 'Rotate' },
    { id: 'scale', icon: '⤢', label: 'Scale' },
    { id: 'pull', icon: '↑', label: 'Pull' },
    { id: 'measure', icon: '⟷', label: 'Measure' },
    { id: 'hole', icon: '⊙', label: 'Hole' },
  ] as const

  const TOOL_2D = [
    { id: 'select', icon: '◁', label: 'Select' },
    { id: 'line', icon: '╱', label: 'Line' },
    { id: 'rect', icon: '▭', label: 'Rect' },
    { id: 'circle', icon: '○', label: 'Circle' },
    { id: 'measure', icon: '⟷', label: 'Measure' },
  ] as const

  const PRIM_ICONS: Partial<Record<PrimitiveKind, string>> = {
    cube: '■', sphere: '●', cone: '▲', torus: '◎', teapot: '☕', ground: '▬',
    prism: '△', line: '╱', rect: '▭', circle: '○', polygon: '⬡', cylinder: '⬭',
  }

  const MODES: { id: ThreeDEditMode; label: string }[] = [
    { id: 'object', label: '■ Object' },
    { id: 'face', label: '— Face' },
    { id: 'edge', label: '— Edge' },
    { id: 'measure', label: '/ Line' },
  ]

  return (
    <div className="be-shell" onContextMenu={(e) => {
      if (activeSelectionId) {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, objectId: activeSelectionId })
      }
    }}>
      {/* ── TOPBAR ── */}
      <header className="be-topbar">
        <div className="be-brand" style={{ position: 'relative' }}>
          <span className="be-brand-icon">B</span>
          <span className="be-brand-name">BuildEditor</span>
          <button
            type="button"
            style={{
              marginLeft: 8,
              background: fileMenuOpen ? 'var(--be-surface-3)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              color: 'var(--be-text)',
              padding: '2px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              height: 24,
            }}
            onClick={() => setFileMenuOpen(v => !v)}
          >
            File ▾
          </button>

          {fileMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setFileMenuOpen(false)}
              />
              <div style={{
                position: 'fixed',
                top: 42,
                left: 0,
                zIndex: 100,
                background: 'var(--be-surface)',
                border: '1px solid var(--be-border)',
                borderRadius: 6,
                minWidth: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                padding: '4px 0',
              }}>
                {/* Project name display */}
                <div style={{
                  padding: '6px 14px 8px',
                  borderBottom: '1px solid var(--be-border)',
                  marginBottom: 4,
                }}>
                  <div style={{ fontSize: '0.58rem', color: 'var(--be-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current project</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--be-text-strong)', marginTop: 2 }}>{projectName}</div>
                </div>

                {[
                  { label: '＋ New', action: handleNewProject },
                  { label: '📂 Open', action: () => { fileInputRef.current?.click(); setFileMenuOpen(false) } },
                  { label: '💾 Save', action: handleSave },
                  { label: '📝 Save As', action: handleSaveAs },
                  { label: '⬇ Download JSON', action: handleDownload },
                ].map(({ label, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 14px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--be-text)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--be-surface-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {label}
                  </button>
                ))}

                {/* Recent */}
                <div style={{ borderTop: '1px solid var(--be-border)', marginTop: 4, paddingTop: 4 }}>
                  <div style={{ padding: '4px 14px', fontSize: '0.58rem', color: 'var(--be-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Recent
                  </div>
                  {getAllProjects().length === 0 ? (
                    <div style={{ padding: '4px 14px', fontSize: '0.7rem', color: 'var(--be-text-dim)', fontStyle: 'italic' }}>
                      No saved projects
                    </div>
                  ) : (
                    getAllProjects().map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleOpenRecent(name)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '5px 14px',
                          background: name === projectName ? 'var(--be-accent-muted)' : 'transparent',
                          border: 'none',
                          color: name === projectName ? 'var(--be-accent-text)' : 'var(--be-text-label)',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => { if (name !== projectName) e.currentTarget.style.background = 'var(--be-surface-3)' }}
                        onMouseLeave={e => { if (name !== projectName) e.currentTarget.style.background = 'transparent' }}
                      >
                        {name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tool strip */}
        <div className="be-tool-strip">
          {(['2d', '3d'] as const).map((space) => (
            <button
              key={space}
              type="button"
              className={`be-tool${activeSpace === space ? ' active' : ''}`}
              onClick={() => selectSpace(space)}
            >
              <span className="be-tool-icon">{space === '2d' ? '▦' : '⬡'}</span>
              {SPACE_LABELS[space]}
            </button>
          ))}

          <div className="be-tool-sep" />

          {activeSpace === '3d' && TOOL_3D.map(t => (
            <button
              key={t.id}
              type="button"
              className={`be-tool${t.id === 'select' && effectiveThreeDEditMode === 'object' && !transformMode ? ' active' :
                t.id === 'move' && effectiveThreeDEditMode === 'object' && transformMode === 'translate' ? ' active' :
                  t.id === 'rotate' && effectiveThreeDEditMode === 'object' && transformMode === 'rotate' ? ' active' :
                    t.id === 'scale' && effectiveThreeDEditMode === 'object' && transformMode === 'scale' ? ' active' :
                      t.id === 'measure' && effectiveThreeDEditMode === 'measure' ? ' active' : ''
                }`}
              onClick={() => {
                if (t.id === 'select') { updateThreeDEditMode('object'); setTransformMode(null) }
                if (t.id === 'move') { if (selectedObject) { updateThreeDEditMode('object'); setTransformMode('translate') } }
                if (t.id === 'rotate') { if (selectedObject) { updateThreeDEditMode('object'); setTransformMode('rotate') } }
                if (t.id === 'scale') { if (selectedObject) { updateThreeDEditMode('object'); setTransformMode('scale') } }
                if (t.id === 'pull') handlePullAction()
                if (t.id === 'measure') updateThreeDEditMode('measure')
                if (t.id === 'hole') handleContextMenuAction({ type: 'add-hole' } as any)
              }}
            >
              <span className="be-tool-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}

          {activeSpace === '2d' && TOOL_2D.map(t => (
            <button
              key={t.id}
              type="button"
              className={`be-tool${active2DTool === t.id ? ' active' : ''}`}
              onClick={() => setActive2DTool(t.id as TwoDTool)}
            >
              <span className="be-tool-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="be-topbar-right">
          <button type="button" disabled={!history.past.length} onClick={undo}>↩ Undo</button>
          <button type="button" disabled={!history.future.length} onClick={redo}>↪ Redo</button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>Import</button>
          <button type="button" onClick={resetScenes}>Clear</button>
        </div>
      </header>

      {/* ── MODE BAR ── */}
      {activeSpace === '3d' && (
        <div className="be-modebar">
          <span className="be-mode-label">MODE:</span>
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              className={`be-mode-btn${effectiveThreeDEditMode === m.id ? ' active' : ''}`}
              onClick={() => updateThreeDEditMode(m.id)}
            >
              {m.label}
            </button>
          ))}
          <span className="be-selected-label">{selectedObject ? selectedObject.name : 'Nothing selected'}</span>
          {copyStatus && copyStatus !== 'Ready to export' ? (
            <span className="be-status-pill">{copyStatus}</span>
          ) : null}
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="be-content">

        {/* ── LEFT PANEL ── */}
        <aside className="be-left-panel">
          <CollapsibleSection title="Primitives" defaultOpen={false}>
            <ul className="be-prim-list">
              {SPACE_KINDS[activeSpace].map((kind) => (
                <li
                  key={kind}
                  className="be-prim-item"
                  onClick={() => addObject(kind)}
                >
                  <span className="be-prim-icon">{PRIM_ICONS[kind] ?? '□'}</span>
                  {KIND_LABELS[kind]}
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="Objects" defaultOpen={false}>
            <ul className="be-obj-list">
              {activeScene.map((obj) => (
                <li
                  key={obj.id}
                  className={`be-obj-item${obj.id === activeSelectionId ? ' active' : ''}${multiSelectedIds.includes(obj.id) ? ' multi-active' : ''}`}
                  onClick={(e) => {
                    if (e.shiftKey) shiftSelectObject(obj.id)
                    else selectObject(obj.id)
                  }}
                >
                  <span
                    className="be-obj-dot"
                    style={{ background: objDotColor(obj.color) }}
                  />
                  <span className="be-obj-name">
                    {obj.name}
                  </span>
                  <button
                    type="button"
                    className="be-obj-delete"
                    onClick={() => deleteObjectById(obj.id)}
                  >×</button>
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* ── COLOR PANEL ── */}
          <CollapsibleSection title="Colors" defaultOpen={false}>
            {hasMultiSelect ? (
              <div style={{ padding: '6px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--be-text-dim)', flex: 1 }}>Bulk Color</span>
                  <input
                    type="color"
                    value={vec3ToHex(multiSelectedObjects[0]?.color ?? [1, 1, 1])}
                    style={{ width: 32, height: 22, padding: 1, borderRadius: 4, border: '1px solid var(--be-border-2)', cursor: 'pointer', background: 'var(--be-bg)' }}
                    onChange={(e) => updateMultiSelected({ color: hexToVec3(e.target.value) }, false)}
                    onBlur={(e) => updateMultiSelected({ color: hexToVec3(e.target.value) })}
                  />
                  <div style={{
                    width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                    background: objDotColor(multiSelectedObjects[0]?.color ?? [1, 1, 1]),
                    border: '1px solid var(--be-border-2)'
                  }} />
                </div>
              </div>
            ) : selectedObject ? (
              <div style={{ padding: '6px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Global object color / Selected Face color */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--be-text-dim)', flex: 1 }}>
                    {effectiveSelectedCubeFace ? `Face: ${CUBE_FACE_LABELS[effectiveSelectedCubeFace].replace(' face', '')}` : 'Object'}
                  </span>
                  <input
                    type="color"
                    value={vec3ToHex(effectiveSelectedCubeFace && selectedObject.faceColors?.[effectiveSelectedCubeFace]
                      ? selectedObject.faceColors[effectiveSelectedCubeFace]!
                      : selectedObject.color)}
                    style={{ width: 32, height: 22, padding: 1, borderRadius: 4, border: '1px solid var(--be-border-2)', cursor: 'pointer', background: 'var(--be-bg)' }}
                    onChange={(e) => {
                      const color = hexToVec3(e.target.value);
                      if (effectiveSelectedCubeFace) {
                        updateSelected({ faceColors: { [effectiveSelectedCubeFace]: color } }, false);
                      } else {
                        updateSelected({ color }, false);
                      }
                    }}
                    onBlur={(e) => {
                      const color = hexToVec3(e.target.value);
                      if (effectiveSelectedCubeFace) {
                        updateSelected({ faceColors: { [effectiveSelectedCubeFace]: color } });
                      } else {
                        updateSelected({ color });
                      }
                    }}
                  />
                  <div style={{
                    width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                    background: objDotColor(effectiveSelectedCubeFace && selectedObject.faceColors?.[effectiveSelectedCubeFace]
                      ? selectedObject.faceColors[effectiveSelectedCubeFace]!
                      : selectedObject.color),
                    border: '1px solid var(--be-border-2)'
                  }} />
                </div>

                {/* Per-face colors — cube */}
                {selectedObject.kind === 'cube' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--be-text-dim)' }}>Face Colors</span>
                    {(['yPos', 'yNeg', 'xNeg', 'xPos', 'zPos', 'zNeg'] as const).map((fk) => {
                      const faceHex = selectedObject.faceColors[fk]
                        ? vec3ToHex(selectedObject.faceColors[fk]!)
                        : vec3ToHex(selectedObject.color)
                      const hasOverride = !!selectedObject.faceColors[fk]
                      return (
                        <div key={fk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--be-text-dim)', width: 52, flexShrink: 0 }}>
                            {CUBE_FACE_LABELS[fk].replace(' face', '')}
                          </span>
                          <input
                            type="color"
                            value={faceHex}
                            style={{ width: 28, height: 20, padding: 1, borderRadius: 3, border: `1px solid ${hasOverride ? 'var(--be-accent)' : 'var(--be-border-2)'}`, cursor: 'pointer', background: 'var(--be-bg)' }}
                            onChange={(e) => updateSelected({
                              faceColors: { [fk]: hexToVec3(e.target.value) }
                            }, false)}
                            onBlur={(e) => updateSelected({
                              faceColors: { [fk]: hexToVec3(e.target.value) }
                            })}
                          />
                          {hasOverride && (
                            <button
                              type="button"
                              title="Reset to object color"
                              style={{ padding: '0 4px', fontSize: '0.6rem', border: 'none', background: 'transparent', color: 'var(--be-text-dim)', cursor: 'pointer' }}
                              onClick={() => {
                                const next = { ...selectedObject.faceColors }
                                delete next[fk]
                                updateSelected({ faceColors: next })
                              }}
                            >↺</button>
                          )}
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      style={{ fontSize: '0.6rem', padding: '2px 6px', marginTop: 2, alignSelf: 'flex-start' }}
                      onClick={() => updateSelected({ faceColors: {} })}
                    >Reset all faces</button>
                  </div>
                )}

                {/* Per-face colors — prism */}
                {selectedObject.kind === 'prism' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--be-text-dim)' }}>Face Colors</span>
                    {['top', 'bottom', 'side0', 'side1', 'side2'].map((fk) => {
                      const faceHex = selectedObject.faceColors[fk]
                        ? vec3ToHex(selectedObject.faceColors[fk]!)
                        : vec3ToHex(selectedObject.color)
                      const hasOverride = !!selectedObject.faceColors[fk]
                      const label = fk === 'top' ? 'Top' : fk === 'bottom' ? 'Bottom' : `Side ${parseInt(fk.replace('side', '')) + 1}`
                      return (
                        <div key={fk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--be-text-dim)', width: 52, flexShrink: 0 }}>
                            {label}
                          </span>
                          <input
                            type="color"
                            value={faceHex}
                            style={{ width: 28, height: 20, padding: 1, borderRadius: 3, border: `1px solid ${hasOverride ? 'var(--be-accent)' : 'var(--be-border-2)'}`, cursor: 'pointer', background: 'var(--be-bg)' }}
                            onChange={(e) => updateSelected({
                              faceColors: { [fk]: hexToVec3(e.target.value) }
                            }, false)}
                            onBlur={(e) => updateSelected({
                              faceColors: { [fk]: hexToVec3(e.target.value) }
                            })}
                          />
                          {hasOverride && (
                            <button
                              type="button"
                              title="Reset to object color"
                              style={{ padding: '0 4px', fontSize: '0.6rem', border: 'none', background: 'transparent', color: 'var(--be-text-dim)', cursor: 'pointer' }}
                              onClick={() => {
                                const next = { ...selectedObject.faceColors }
                                delete next[fk]
                                updateSelected({ faceColors: next })
                              }}
                            >↺</button>
                          )}
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      style={{ fontSize: '0.6rem', padding: '2px 6px', marginTop: 2, alignSelf: 'flex-start' }}
                      onClick={() => updateSelected({ faceColors: {} })}
                    >Reset all faces</button>
                  </div>
                )}

                {/* Favorite color slots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--be-text-dim)' }}>
                    Favorites <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(left-click slot to save)</span>
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {favoriteColors.map((hex, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <button
                          type="button"
                          title={hex ? `Slot ${i + 1}: ${hex} — left-click to apply, right-click to save` : `Slot ${i + 1}: empty — left-click to save current color`}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            background: hex ?? 'var(--be-surface-3)',
                            cursor: 'pointer',
                            padding: 0,
                            position: 'relative',
                            transition: 'border-color 100ms, transform 80ms',
                            border: armedFavorite === hex && hex ? '2px solid #fff' : hex ? '2px solid var(--be-border-2)' : '2px dashed var(--be-border-2)',
                            outline: armedFavorite === hex && hex ? '2px solid #f90' : 'none',
                          }}
                          onClick={() => {
                            if (hex) {
                              setArmedFavorite(prev => prev === hex ? null : hex)
                            } else {
                              saveFavorite(i)
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            saveFavorite(i)
                          }}
                        >
                          {!hex && <span style={{ fontSize: '0.55rem', color: 'var(--be-text-dim)' }}>{i + 1}</span>}
                        </button>
                        <button
                          type="button"
                          title="Save current color here"
                          style={{ fontSize: '0.48rem', padding: '1px 2px', border: 'none', background: 'transparent', color: 'var(--be-text-dim)', cursor: 'pointer', lineHeight: 1 }}
                          onClick={() => saveFavorite(i)}
                        >save</button>
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.58rem', color: 'var(--be-text-dim)' }}>
                    Click filled slot → apply · Click empty / "save" → store
                  </span>
                </div>

              </div>
            ) : (
              <div style={{ padding: '10px 12px', fontSize: '0.7rem', color: 'var(--be-text-dim)' }}>
                Select an object to edit colors.
              </div>
            )}
          </CollapsibleSection>
        </aside>

        {/* ── VIEWPORT ── */}
        <section className="be-viewport-wrap">
          <Viewport
            space={activeSpace}
            objects={activeScene}
            selectedId={activeSelectionId}
            multiSelectedIds={multiSelectedIds}
            onShiftSelect={shiftSelectObject}
            active2DTool={active2DTool}
            threeDEditMode={effectiveThreeDEditMode}
            transformMode={transformMode}
            selectedCubeFace={effectiveSelectedCubeFace}
            selectedCubeEdge={effectiveSelectedCubeEdge}
            grabMode={grabMode}
            axisLock={axisLock}
            on2DToolChange={setActive2DTool}
            onThreeDEditModeChange={updateThreeDEditMode}
            onSelectCubeFace={setSelectedCubeFace}
            onFaceColorChange={onUpdateCubeFaceColor}
            armedFavorite={armedFavorite}
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
              if (status.includes('Measuring') && activeSelectionId) setLastMeasuredId(activeSelectionId)
            }}
            onUpdateObject={(id, changes) => {
              const needsHistory = 'prismMesh' in changes
              const apply = () => {
                updateSceneObjects(activeSpace, (current) =>
                  current.map((obj) => {
                    if (obj.id !== id) {
                      return obj
                    }

                    const next = { ...obj, ...changes }
                    if (obj.kind === 'prism' && ('radius' in changes || 'height' in changes || 'sides' in changes)) {
                      next.prismMesh = undefined
                      next.prismParams = {
                        sides: typeof changes.sides === 'number' ? changes.sides : obj.prismParams?.sides ?? obj.sides,
                        radius: typeof changes.radius === 'number' ? changes.radius : obj.prismParams?.radius ?? obj.radius,
                        height: typeof changes.height === 'number' ? changes.height : obj.prismParams?.height ?? obj.height,
                      }
                    }

                    return next
                  }),
                )
              }

              if (needsHistory) {
                commitSceneChange(apply)
              } else {
                apply()
              }
            }}
            lastMeasuredId={lastMeasuredId}
          />
        </section>

        {/* ── RIGHT PANEL ── */}
        <aside className="be-right-panel">
          <div className="be-right-panel-inner">
            {/* INSPECTOR */}
            <CollapsibleSection title={hasMultiSelect ? `Inspector — ${multiSelectedIds.length} Selected` : `Inspector${selectedObject ? ` — ${KIND_LABELS[selectedObject.kind]}` : ''}`}>

              {hasMultiSelect ? (
                <div className="be-inspector-form">
                  <div style={{ padding: '8px', background: 'var(--be-bg)', borderRadius: 4, border: '1px solid var(--be-border-2)', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--be-text)', fontWeight: 600 }}>{multiSelectedIds.length} objects selected</span>
                    <p style={{ fontSize: '0.6rem', color: 'var(--be-text-dim)', marginTop: 4, lineHeight: 1.4 }}>
                      Bulk edit mode. Changes apply to all selected objects.
                    </p>
                  </div>

                  <div className="field">
                    <span>Delta Scale</span>
                    <div className="vector-group">
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('scale', i as 0 | 1 | 2, 1.5)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} ×1.5
                        </button>
                      ))}
                    </div>
                    <div className="vector-group" style={{ marginTop: 4 }}>
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('scale', i as 0 | 1 | 2, 0.5)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} ×0.5
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <span>Delta Rotate</span>
                    <div className="vector-group">
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('rotation', i as 0 | 1 | 2, 90)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} +90°
                        </button>
                      ))}
                    </div>
                    <div className="vector-group" style={{ marginTop: 4 }}>
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('rotation', i as 0 | 1 | 2, -90)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} -90°
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <span>Delta Move</span>
                    <div className="vector-group">
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('position', i as 0 | 1 | 2, 1)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} +1
                        </button>
                      ))}
                    </div>
                    <div className="vector-group" style={{ marginTop: 4 }}>
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('position', i as 0 | 1 | 2, -1)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} -1
                        </button>
                      ))}
                    </div>
                    <div className="vector-group" style={{ marginTop: 4 }}>
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('position', i as 0 | 1 | 2, 0.5)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} +0.5
                        </button>
                      ))}
                    </div>
                    <div className="vector-group" style={{ marginTop: 4 }}>
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('position', i as 0 | 1 | 2, -0.5)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} -0.5
                        </button>
                      ))}
                    </div>
                    <div className="vector-group" style={{ marginTop: 4 }}>
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('position', i as 0 | 1 | 2, 0.1)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} +0.1
                        </button>
                      ))}
                    </div>
                    <div className="vector-group" style={{ marginTop: 4 }}>
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <button key={axis} type="button" onClick={() => applyDeltaToMulti('position', i as 0 | 1 | 2, -0.1)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {axis.toUpperCase()} -0.1
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <span>Change Type</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                      {SPACE_KINDS[activeSpace].map((kind) => (
                        <button key={kind} type="button" onClick={() => changeTypeForSelected(kind)} style={{ fontSize: '0.6rem', padding: 4 }}>
                          {PRIM_ICONS[kind]} {kind}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{ marginTop: 12, width: '100%', padding: '6px', background: '#3a1a1a', color: '#ff8888', border: '1px solid #662222', borderRadius: 4 }}
                    onClick={deleteMultiSelected}
                  >
                    Delete Selected ({multiSelectedIds.length})
                  </button>
                </div>
              ) : selectedObject ? (
                <div className="be-inspector-form">
                  <Field label="Name">
                    <input
                      type="text"
                      value={selectedObject.name}
                      onChange={(e) => updateSelected({ name: e.target.value }, false)}
                      onBlur={(e) => {
                        const t = e.target.value.trim()
                        if (t && t !== selectedObject.name) updateSelected({ name: t })
                        else if (!t) updateSelected({ name: selectedObject.name }, false)
                      }}
                    />
                  </Field>

                  <Field label="Color">
                    <input
                      type="color"
                      value={vec3ToHex(selectedObject.color)}
                      onChange={(e) => updateSelected({ color: hexToVec3(e.target.value) }, false)}
                    />
                  </Field>

                  {renderVectorFieldGroup('Position', 'position', selectedObject.position, 0.1)}

                  {/* Move Gizmo UI */}
                  {selectedObject.space === '3d' && (
                    <div style={{ padding: '0 8px 10px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--be-border-1)', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--be-text-dim)', textTransform: 'uppercase' }}>Quick Move</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.55rem', color: 'var(--be-text-dim)' }}>Step:</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            style={{ width: 35, fontSize: '0.65rem', padding: '1px 2px', background: 'var(--be-bg)', color: 'var(--be-text)', border: '1px solid var(--be-border-2)' }}
                            value={moveStep}
                            onChange={(e) => setMoveStep(parseFloat(e.target.value) || 0.1)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        <button className="gizmo-btn" style={{ color: 'var(--be-accent)' }} onClick={(e) => { e.currentTarget.blur(); moveSelected('x', -1, moveStep) }}>← X-</button>
                        <button className="gizmo-btn" style={{ color: 'var(--be-accent)' }} onClick={(e) => { e.currentTarget.blur(); moveSelected('y', 1, moveStep) }}>↑ Y+</button>
                        <button className="gizmo-btn" style={{ color: 'var(--be-accent)' }} onClick={(e) => { e.currentTarget.blur(); moveSelected('x', 1, moveStep) }}>→ X+</button>

                        <button className="gizmo-btn" style={{ color: '#4488ff' }} onClick={(e) => { e.currentTarget.blur(); moveSelected('z', -1, moveStep) }}>W (Z-)</button>
                        <button className="gizmo-btn" style={{ color: 'var(--be-accent)' }} onClick={(e) => { e.currentTarget.blur(); moveSelected('y', -1, moveStep) }}>↓ Y-</button>
                        <button className="gizmo-btn" style={{ color: '#4488ff' }} onClick={(e) => { e.currentTarget.blur(); moveSelected('z', 1, moveStep) }}>S (Z+)</button>
                      </div>
                    </div>
                  )}

                  {renderVectorFieldGroup('Rotation', 'rotation', selectedObject.rotation, 1)}
                  {renderVectorFieldGroup('Scale', 'scale', selectedObject.scale, 0.1)}

                  {/* Array tool section */}
                  {selectedObject.space === '3d' && (
                    <div className="be-sub-section" style={{ marginTop: 15, paddingTop: 10, borderTop: '1px solid var(--be-border-1)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, marginBottom: 8, color: 'var(--be-text-dim)', textTransform: 'uppercase' }}>Array / Duplicate</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.6rem', display: 'block', marginBottom: 2 }}>Axis</span>
                            <select
                              style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px', background: 'var(--be-bg)', color: 'var(--be-text)', border: '1px solid var(--be-border-2)' }}
                              value={arrayAxis}
                              onChange={(e) => setArrayAxis(e.target.value as any)}
                            >
                              <option value="x">X Axis</option>
                              <option value="y">Y Axis</option>
                              <option value="z">Z Axis</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.6rem', display: 'block', marginBottom: 2 }}>Count</span>
                            <input
                              type="number"
                              style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px', background: 'var(--be-bg)', color: 'var(--be-text)', border: '1px solid var(--be-border-2)' }}
                              min={2}
                              max={50}
                              value={arrayCount}
                              onChange={(e) => setArrayCount(parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.6rem', display: 'block', marginBottom: 2 }}>Gap</span>
                            <input
                              type="number"
                              step={0.1}
                              style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px', background: 'var(--be-bg)', color: 'var(--be-text)', border: '1px solid var(--be-border-2)' }}
                              value={arrayGap}
                              onChange={(e) => setArrayGap(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{ marginTop: 4, padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer', background: 'var(--be-accent)', color: 'white', border: 'none', borderRadius: 4, fontWeight: 700 }}
                          onClick={createArray}
                        >
                          Create Array
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Window-specific fields */}
                  {selectedObject.kind === 'window' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderTop: '1px solid var(--be-border-1)' }}>
                      <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--be-text-dim)', marginBottom: 2 }}>Window</span>
                      <NumberField label="Width" value={selectedObject.width} min={0.3} step={0.1}
                        onChange={(v) => updateSelected({ width: Math.max(0.3, v) })} />
                      <NumberField label="Height" value={selectedObject.height} min={0.3} step={0.1}
                        onChange={(v) => updateSelected({ height: Math.max(0.3, v) })} />
                      <NumberField label="Border" value={selectedObject.borderThickness ?? 0.12} min={0.02} step={0.01}
                        onChange={(v) => updateSelected({ borderThickness: Math.max(0.02, v) })} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--be-text-dim)', flex: 1 }}>Frame Color</span>
                        <input
                          type="color"
                          value={vec3ToHex(selectedObject.frameColor ?? [0.45, 0.32, 0.22])}
                          style={{ width: 32, height: 22, padding: 1, borderRadius: 4, border: '1px solid var(--be-border-2)', cursor: 'pointer' }}
                          onChange={(e) => updateSelected({ frameColor: hexToVec3(e.target.value) }, false)}
                          onBlur={(e) => updateSelected({ frameColor: hexToVec3(e.target.value) })}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--be-text-dim)', flex: 1 }}>Glass Color</span>
                        <input
                          type="color"
                          value={vec3ToHex(selectedObject.color)}
                          style={{ width: 32, height: 22, padding: 1, borderRadius: 4, border: '1px solid var(--be-border-2)', cursor: 'pointer' }}
                          onChange={(e) => updateSelected({ color: hexToVec3(e.target.value) }, false)}
                          onBlur={(e) => updateSelected({ color: hexToVec3(e.target.value) })}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--be-text-dim)', flex: 1 }}>Opacity</span>
                        <input
                          type="range"
                          min={0} max={1} step={0.05}
                          value={selectedObject.glassOpacity ?? 0.35}
                          style={{ flex: 2 }}
                          onChange={(e) => updateSelected({ glassOpacity: parseFloat(e.target.value) }, false)}
                          onMouseUp={(e) => updateSelected({ glassOpacity: parseFloat((e.target as HTMLInputElement).value) })}
                        />
                        <span style={{ fontSize: '0.6rem', color: 'var(--be-text-dim)', width: 28 }}>
                          {((selectedObject.glassOpacity ?? 0.35) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 2D-specific fields */}
                  {selectedObject.space === '2d' && (<>
                    {selectedObject.kind === 'line' && (<>
                      <NumberField label="Length" value={selectedObject.length} min={0.15} step={0.1}
                        onChange={(v) => updateSelected({ length: Math.max(0.15, v) })} />
                      <NumberField label="Thickness" value={selectedObject.thickness} min={1} step={0.1}
                        onChange={(v) => updateSelected({ thickness: Math.max(1, v) })} />
                    </>)}
                    {selectedObject.kind === 'rect' && (<>
                      <NumberField label="Width" value={selectedObject.width} min={0.15} step={0.1}
                        onChange={(v) => updateSelected({ width: Math.max(0.15, v) })} />
                      <NumberField label="Height" value={selectedObject.height} min={0.15} step={0.1}
                        onChange={(v) => updateSelected({ height: Math.max(0.15, v) })} />
                    </>)}
                    {selectedObject.kind === 'circle' && (
                      <NumberField label="Radius" value={selectedObject.radius} min={0.1} step={0.1}
                        onChange={(v) => updateSelected({ radius: Math.max(0.1, v) })} />
                    )}
                    {selectedObject.kind === 'polygon' && (<>
                      <NumberField label="Radius" value={selectedObject.radius} min={0.1} step={0.1}
                        onChange={(v) => updateSelected({ radius: Math.max(0.1, v) })} />
                      <NumberField label="Sides" value={selectedObject.sides} min={3} step={1}
                        onChange={(v) => updateSelected({ sides: Math.max(3, Math.round(v)) })} />
                    </>)}
                  </>)}

                  {/* 3D-specific fields */}
                  {selectedObject.space === '3d' && (<>
                    {selectedObject.kind === 'cube' && (<>
                      {(['xNeg', 'xPos', 'yNeg', 'yPos', 'zNeg', 'zPos'] as const).map((fk) => (
                        <NumberField key={fk} label={CUBE_FACE_LABELS[fk]} value={selectedObject.facePulls[fk] ?? 0}
                          step={0.05} onChange={(v) => updateCubeFacePull(fk, v, true)} />
                      ))}
                    </>)}
                    {(selectedObject.kind === 'sphere' || selectedObject.kind === 'cone') && (<>
                      <NumberField label="Radius" value={selectedObject.radius} min={0.1} step={0.1}
                        onChange={(v) => updateSelected({ radius: Math.max(0.1, v) })} />
                      <NumberField label="Height" value={selectedObject.height} min={0.1} step={0.1}
                        onChange={(v) => updateSelected({ height: Math.max(0.1, v) })} />
                      <NumberField label="Segments" value={selectedObject.segments} min={3} step={1}
                        onChange={(v) => updateSelected({ segments: Math.max(3, Math.round(v)) })} />
                    </>)}
                    {selectedObject.kind === 'torus' && (<>
                      <NumberField label="Outer radius" value={selectedObject.outerRadius} min={0.15} step={0.1}
                        onChange={(v) => updateSelected({ outerRadius: Math.max(0.15, v) })} />
                      <NumberField label="Inner radius" value={selectedObject.innerRadius} min={0.05} step={0.05}
                        onChange={(v) => updateSelected({ innerRadius: Math.max(0.05, v) })} />
                      <NumberField label="Sides" value={selectedObject.sides} min={3} step={1}
                        onChange={(v) => updateSelected({ sides: Math.max(3, Math.round(v)) })} />
                      <NumberField label="Segments" value={selectedObject.segments} min={8} step={1}
                        onChange={(v) => updateSelected({ segments: Math.max(8, Math.round(v)) })} />
                    </>)}
                    {selectedObject.kind === 'ground' && (<>
                      <NumberField label="Width" value={selectedObject.width} min={0.5} step={0.5}
                        onChange={(v) => updateSelected({ width: Math.max(0.5, v) })} />
                      <NumberField label="Height" value={selectedObject.height} min={0.05} step={0.05}
                        onChange={(v) => updateSelected({ height: Math.max(0.05, v) })} />
                      <NumberField label="Depth" value={selectedObject.depth} min={0.5} step={0.5}
                        onChange={(v) => updateSelected({ depth: Math.max(0.5, v) })} />
                    </>)}
                    {selectedObject.kind === 'prism' && (<>
                      <NumberField label="Radius" value={selectedObject.radius} min={0.15} step={0.1}
                        onChange={(v) => updateSelected({ radius: Math.max(0.15, v) })} />
                      <NumberField label="Height" value={selectedObject.height} min={0.15} step={0.1}
                        onChange={(v) => updateSelected({ height: Math.max(0.15, v) })} />
                      <div className="field">
                        <span>Prism editing lives in the viewport gizmo</span>
                      </div>
                    </>)}
                    {selectedObject.kind === 'cylinder' && (<>
                      <NumberField label="Radius" value={selectedObject.radius} min={0.1} step={0.1}
                        onChange={(v) => updateSelected({ radius: Math.max(0.1, v) })} />
                      <NumberField label="Height" value={selectedObject.height} min={0.1} step={0.1}
                        onChange={(v) => updateSelected({ height: Math.max(0.1, v) })} />
                      <NumberField label="Segments" value={selectedObject.segments} min={3} step={1}
                        onChange={(v) => updateSelected({ segments: Math.max(3, Math.round(v)) })} />
                    </>)}

                    {/* Holes */}
                    <div className="field">
                      <span>Holes (Beta)</span>
                      {selectedObject.holes.map((hole, hi) => (
                        <div key={hole.id} className="be-holes-row">
                          <span style={{ fontSize: '0.62rem', color: 'var(--be-text-dim)', minWidth: 18 }}>#{hi + 1}</span>
                          <select value={hole.axis} onChange={(e) => {
                            const nh = [...selectedObject.holes]; nh[hi] = { ...hole, axis: e.target.value as 'x' | 'y' | 'z' }
                            updateSelected({ holes: nh })
                          }}>
                            <option value="x">X</option><option value="y">Y</option><option value="z">Z</option>
                          </select>
                          <input type="number" value={hole.radius} step={0.05} min={0.05} style={{ width: 50 }}
                            onChange={(e) => {
                              const nh = [...selectedObject.holes]; nh[hi] = { ...hole, radius: Math.max(0.05, Number(e.target.value)) }
                              updateSelected({ holes: nh })
                            }} />
                          <button type="button" onClick={() =>
                            updateSelected({ holes: selectedObject.holes.filter((_, i) => i !== hi) })
                          }>✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() =>
                        updateSelected({
                          holes: [...selectedObject.holes, {
                            id: `hole_${Date.now()}`, position: [0, 0, 0] as [number, number, number], radius: 0.3, axis: 'y' as const
                          }]
                        })
                      }>+ Add Hole</button>
                    </div>
                  </>)}
                </div>
              ) : (
                <div className="be-inspector-empty">
                  <div className="be-inspector-empty-icon">⬜</div>
                  <p>Select an object in the viewport<br />or add one from the left panel</p>
                </div>
              )}
            </CollapsibleSection>

            {/* GLUT EXPORT / IMPORT */}
            <div className="be-section be-export-section">
              <div className="be-section-header">
                GLUT CODE
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    style={{
                      fontSize: '0.65rem',
                      padding: '2px 7px',
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: glutImportTab === 'export' ? 'var(--be-accent, #f0a)' : 'var(--be-surface2, #333)',
                      color: '#fff',
                    }}
                    onClick={() => setGlutImportTab('export')}
                  >Export</button>
                  <button
                    type="button"
                    style={{
                      fontSize: '0.65rem',
                      padding: '2px 7px',
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: glutImportTab === 'import' ? 'var(--be-accent, #f0a)' : 'var(--be-surface2, #333)',
                      color: '#fff',
                    }}
                    onClick={() => setGlutImportTab('import')}
                  >Edit GLUT</button>
                </span>
              </div>

              {glutImportTab === 'export' ? (
                <>
                  <div className="be-export-stats">
                    <span className="be-stat">📄 {activeScene.length} objects</span>
                    <span className="be-stat">🟡 Colors preserved</span>
                  </div>
                  <button type="button" className="be-btn-primary" onClick={async () => {
                    await copyCode()
                    setCopyStatus('Copied!')
                    setTimeout(() => setCopyStatus('Ready to export'), 2000)
                  }} disabled={!canExportCode}>
                    ⊕ Generate C Code & Copy
                  </button>
                  <button type="button" className="be-btn-secondary" onClick={downloadCode} disabled={!canExportCode}>
                    ↓ Download .c
                  </button>
                  <button type="button" className="be-btn-secondary" onClick={downloadSceneJson}>
                    📋 Download JSON
                  </button>
                  <div className="be-code-section">
                    <div className="be-code-scope">
                      <button type="button" className={exportScope === 'scene' ? 'toggle-active' : ''} onClick={() => setExportScope('scene')}>Full scene</button>
                      <button type="button" className={exportScope === 'selection' ? 'toggle-active' : ''} onClick={() => setExportScope('selection')}>Selection</button>
                    </div>
                    <pre className="be-code-block">{exportedCode}</pre>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="be-btn-primary"
                      onClick={() => {
                        setGlutImportCode(exportedCode)
                        setCopyStatus('Loaded exported code into editor')
                      }}
                    >
                      ← Load from scene
                    </button>
                    <button
                      type="button"
                      className="be-btn-secondary"
                      onClick={() => {
                        if (!glutImportCode.trim()) return
                        const blob = new Blob([glutImportCode], { type: 'text/x-c++src' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'scene-custom.cpp'
                        a.click()
                        URL.revokeObjectURL(url)
                        setCopyStatus('Downloaded edited GLUT code')
                      }}
                      disabled={!glutImportCode.trim()}
                    >
                      ↓ Download
                    </button>
                    <button
                      type="button"
                      className="be-btn-secondary"
                      onClick={async () => {
                        if (!glutImportCode.trim()) return
                        try {
                          await navigator.clipboard.writeText(glutImportCode)
                          setCopyStatus('Copied edited GLUT code')
                        } catch {
                          setCopyStatus('Clipboard blocked')
                        }
                      }}
                      disabled={!glutImportCode.trim()}
                    >
                      ⊕ Copy
                    </button>
                    <button
                      type="button"
                      className="be-btn-secondary"
                      onClick={() => {
                        if (window.confirm('Clear the editor?')) {
                          setGlutImportCode('')
                          setCopyStatus('Editor cleared')
                        }
                      }}
                      disabled={!glutImportCode.trim()}
                    >
                      ✕ Clear
                    </button>
                  </div>
                  <div style={{ position: 'relative', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 32,
                      bottom: 0,
                      background: 'var(--be-surface2, #222)',
                      borderRight: '1px solid var(--be-border, #444)',
                      pointerEvents: 'none',
                      overflow: 'hidden',
                      userSelect: 'none',
                      paddingTop: 8,
                      boxSizing: 'border-box',
                      color: 'var(--be-text-dim, #666)',
                      textAlign: 'right',
                      paddingRight: 4,
                      lineHeight: '1.5em',
                    }}>
                      {(glutImportCode || ' ').split('\n').map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    <textarea
                      value={glutImportCode}
                      onChange={(e) => setGlutImportCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          e.preventDefault()
                          const el = e.currentTarget
                          const start = el.selectionStart
                          const end = el.selectionEnd
                          const next = glutImportCode.substring(0, start) + '  ' + glutImportCode.substring(end)
                          setGlutImportCode(next)
                          requestAnimationFrame(() => {
                            el.selectionStart = el.selectionEnd = start + 2
                          })
                        }
                      }}
                      placeholder={"// Paste or load GLUT C code here\n// Tab inserts 2 spaces\n// Use 'Load from scene' to start from your current scene"}
                      spellCheck={false}
                      style={{
                        display: 'block',
                        width: '100%',
                        minHeight: 360,
                        resize: 'vertical',
                        background: 'var(--be-surface, #1a1a1a)',
                        color: 'var(--be-text, #ddd)',
                        border: '1px solid var(--be-border, #444)',
                        borderRadius: 6,
                        padding: '8px 8px 8px 40px',
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        lineHeight: '1.5em',
                        boxSizing: 'border-box',
                        outline: 'none',
                        whiteSpace: 'pre',
                        overflowWrap: 'normal',
                        overflowX: 'auto',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--be-text-dim, #888)', marginTop: 4 }}>
                    {glutImportCode
                      ? `${glutImportCode.split('\n').length} lines · ${glutImportCode.length} chars`
                      : 'Empty'}
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </main>

      <input ref={fileInputRef} type="file" accept="application/json,.json"
        className="visually-hidden" onChange={importSceneJson} />

      <ContextMenu state={contextMenu} onAction={handleContextMenuAction} onClose={() => setContextMenu(null)} />

      {pullDialog && (
        <div className="be-inline-dialog-overlay" onClick={() => setPullDialog(null)}>
          <div className="be-inline-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="be-inline-dialog-header">
              <span>Pull {pullDialog.label}</span>
              <button type="button" onClick={() => setPullDialog(null)}>✕</button>
            </div>
            <div className="be-inline-dialog-body">
              <div style={{ fontSize: '0.65rem', color: 'var(--be-text-dim)', marginBottom: 8 }}>
                Enter relative distance (e.g. 0.5 to expand, -0.5 to shrink)
              </div>
              <input
                type="number"
                autoFocus
                defaultValue="0.5"
                step="0.05"
                className="be-inline-dialog-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseFloat((e.target as HTMLInputElement).value)
                    if (!isNaN(val)) {
                      const currentPull = selectedObject?.facePulls[pullDialog.faceKey] ?? 0
                      updateCubeFacePull(pullDialog.faceKey, currentPull + val, true)
                    }
                    setPullDialog(null)
                  } else if (e.key === 'Escape') {
                    setPullDialog(null)
                  }
                }}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="be-btn-primary"
                  style={{ margin: 0, flex: 1 }}
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement
                    const val = parseFloat(input.value)
                    if (!isNaN(val)) {
                      const currentPull = selectedObject?.facePulls[pullDialog.faceKey] ?? 0
                      updateCubeFacePull(pullDialog.faceKey, currentPull + val, true)
                    }
                    setPullDialog(null)
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="be-btn-secondary"
                  style={{ margin: 0, flex: 1 }}
                  onClick={() => setPullDialog(null)}
                >
                  Cancel
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: '0.6rem', color: 'var(--be-text-dim)', textAlign: 'center' }}>
                Press <strong>Enter</strong> to apply · <strong>Esc</strong> to cancel
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
