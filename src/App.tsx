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
  const [favoriteColors, setFavoriteColors] = useState<(string | null)[]>(() => {
    try {
      const stored = localStorage.getItem('three-glut-fav-colors')
      if (stored) return JSON.parse(stored)
    } catch {}
    return [null, null, null, null, null]
  })

  const saveFavorite = (index: number) => {
    if (!selectedObject) return
    const hex = vec3ToHex(selectedObject.color)
    const next = [...favoriteColors]
    next[index] = hex
    setFavoriteColors(next)
    localStorage.setItem('three-glut-fav-colors', JSON.stringify(next))
    setCopyStatus(`Saved to slot ${index + 1}`)
  }

  const applyFavorite = (hex: string) => {
    if (!selectedObject) return
    updateSelected({ color: hexToVec3(hex) })
  }

  const activeScene = scenes[activeSpace]
  const activeSelectionId = selection[activeSpace]
  const selectedObject =
    activeScene.find((object) => object.id === activeSelectionId) ?? null
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
  }, [activeSpace, selectedObject, selectedCubeFace, updateCubeFacePull])

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
      setTransformMode(null)
      setAxisLock(null)
      setSelectedCubeFace(null)
      setSelectedCubeEdge(null)
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
          setTransformMode(null)
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
  const objDotColor = (c: [number,number,number]) =>
    `rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`

  const TOOL_3D = [
    { id:'select',  icon:'◁', label:'Select'  },
    { id:'move',    icon:'✥', label:'Move'    },
    { id:'rotate',  icon:'↻', label:'Rotate'  },
    { id:'scale',   icon:'⤢', label:'Scale'   },
    { id:'pull',    icon:'↑', label:'Pull'    },
    { id:'measure', icon:'⟷', label:'Measure' },
    { id:'hole',    icon:'⊙', label:'Hole'    },
  ] as const

  const TOOL_2D = [
    { id:'select', icon:'◁', label:'Select' },
    { id:'line',   icon:'╱', label:'Line'   },
    { id:'rect',   icon:'▭', label:'Rect'   },
    { id:'circle', icon:'○', label:'Circle' },
    { id:'measure',icon:'⟷', label:'Measure'},
  ] as const

  const PRIM_ICONS: Partial<Record<PrimitiveKind,string>> = {
    cube:'■', sphere:'●', cone:'▲', torus:'◎', teapot:'☕', ground:'▬',
    prism:'△', line:'╱', rect:'▭', circle:'○', polygon:'⬡',
  }

  const MODES: { id: ThreeDEditMode; label: string }[] = [
    { id:'object',  label:'■ Object' },
    { id:'face',    label:'— Face'   },
    { id:'edge',    label:'— Edge'   },
    { id:'measure', label:'/ Line'   },
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
        <div className="be-brand">
          <span className="be-brand-icon">B</span>
          <span className="be-brand-name">BuildEditor</span>
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
              className={`be-tool${
                t.id === 'select' && effectiveThreeDEditMode === 'object' && !transformMode ? ' active' :
                t.id === 'move'   && effectiveThreeDEditMode === 'object' && transformMode === 'translate' ? ' active' :
                t.id === 'rotate' && effectiveThreeDEditMode === 'object' && transformMode === 'rotate' ? ' active' :
                t.id === 'scale'  && effectiveThreeDEditMode === 'object' && transformMode === 'scale' ? ' active' :
                t.id === 'measure' && effectiveThreeDEditMode === 'measure' ? ' active' : ''
              }`}
              onClick={() => {
                if (t.id === 'select')  { updateThreeDEditMode('object'); setTransformMode(null) }
                if (t.id === 'move')    { if (selectedObject) { updateThreeDEditMode('object'); setTransformMode('translate') } }
                if (t.id === 'rotate')  { if (selectedObject) { updateThreeDEditMode('object'); setTransformMode('rotate') } }
                if (t.id === 'scale')   { if (selectedObject) { updateThreeDEditMode('object'); setTransformMode('scale') } }
                if (t.id === 'pull')    handlePullAction()
                if (t.id === 'measure') updateThreeDEditMode('measure')
                if (t.id === 'hole')    handleContextMenuAction({ type: 'add-hole' } as any)
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
          <div className="be-section">
            <div className="be-section-header">Primitives</div>
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
          </div>

          <div className="be-section">
            <div className="be-section-header">Objects</div>
            <ul className="be-obj-list">
              {activeScene.map((obj) => (
                <li
                  key={obj.id}
                  className={`be-obj-item${obj.id === activeSelectionId ? ' active' : ''}`}
                >
                  <span
                    className="be-obj-dot"
                    style={{ background: objDotColor(obj.color) }}
                  />
                  <span className="be-obj-name" onClick={() => selectObject(obj.id)}>
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
          </div>

          {/* ── COLOR PANEL ── */}
          <div className="be-section">
            <div className="be-section-header">Colors</div>
            {selectedObject ? (
              <div style={{ padding: '6px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Global object color / Selected Face color */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--be-text-dim)', flex: 1 }}>
                    {effectiveSelectedCubeFace ? `Face: ${CUBE_FACE_LABELS[effectiveSelectedCubeFace].replace(' face','')}` : 'Object'}
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
                    {(['yPos','yNeg','xNeg','xPos','zPos','zNeg'] as const).map((fk) => {
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
                      const label = fk === 'top' ? 'Top' : fk === 'bottom' ? 'Bottom' : `Side ${parseInt(fk.replace('side','')) + 1}`
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
                          title={hex ? `Slot ${i+1}: ${hex} — left-click to apply, right-click to save` : `Slot ${i+1}: empty — left-click to save current color`}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            border: hex ? '2px solid var(--be-border-2)' : '2px dashed var(--be-border-2)',
                            background: hex ?? 'var(--be-surface-3)',
                            cursor: 'pointer',
                            padding: 0,
                            position: 'relative',
                            transition: 'border-color 100ms, transform 80ms',
                          }}
                          onClick={() => {
                            if (hex) {
                              applyFavorite(hex)
                              setCopyStatus(`Applied slot ${i + 1}`)
                            } else {
                              saveFavorite(i)
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            saveFavorite(i)
                          }}
                        >
                          {!hex && <span style={{ fontSize: '0.55rem', color: 'var(--be-text-dim)' }}>{i+1}</span>}
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
          </div>
        </aside>

        {/* ── VIEWPORT ── */}
        <section className="be-viewport-wrap">
          <Viewport
            space={activeSpace}
            objects={activeScene}
            selectedId={activeSelectionId}
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
            <div className="be-section be-inspector-section">
            <div className="be-section-header">
              INSPECTOR
              <span className="be-nothing-label">
                {selectedObject
                  ? `${KIND_LABELS[selectedObject.kind]}`
                  : 'Nothing selected'}
              </span>
            </div>

            {selectedObject ? (
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
                {renderVectorFieldGroup('Rotation', 'rotation', selectedObject.rotation, 1)}
                {renderVectorFieldGroup('Scale',    'scale',    selectedObject.scale,    0.1)}

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
                    {(['xNeg','xPos','yNeg','yPos','zNeg','zPos'] as const).map((fk) => (
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

                  {/* Holes */}
                  <div className="field">
                    <span>Holes (Beta)</span>
                    {selectedObject.holes.map((hole, hi) => (
                      <div key={hole.id} className="be-holes-row">
                        <span style={{ fontSize:'0.62rem', color:'var(--be-text-dim)', minWidth:18 }}>#{hi+1}</span>
                        <select value={hole.axis} onChange={(e) => {
                          const nh = [...selectedObject.holes]; nh[hi]={...hole,axis:e.target.value as 'x'|'y'|'z'}
                          updateSelected({ holes: nh })
                        }}>
                          <option value="x">X</option><option value="y">Y</option><option value="z">Z</option>
                        </select>
                        <input type="number" value={hole.radius} step={0.05} min={0.05} style={{width:50}}
                          onChange={(e) => {
                            const nh=[...selectedObject.holes]; nh[hi]={...hole,radius:Math.max(0.05,Number(e.target.value))}
                            updateSelected({ holes: nh })
                          }} />
                        <button type="button" onClick={() =>
                          updateSelected({ holes: selectedObject.holes.filter((_,i)=>i!==hi) })
                        }>✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={() =>
                      updateSelected({ holes: [...selectedObject.holes, {
                        id:`hole_${Date.now()}`,position:[0,0,0] as [number,number,number],radius:0.3,axis:'y' as const
                      }]})
                    }>+ Add Hole</button>
                  </div>
                </>)}
              </div>
            ) : (
              <div className="be-inspector-empty">
                <div className="be-inspector-empty-icon">⬜</div>
                <p>Select an object in the viewport<br/>or add one from the left panel</p>
              </div>
            )}
            </div>

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
                  <button type="button" className="be-btn-primary" onClick={copyCode} disabled={!canExportCode}>
                    ⊕ Generate C Code
                  </button>
                  <button type="button" className="be-btn-secondary" onClick={downloadCode} disabled={!canExportCode}>
                    ↓ Download .c
                  </button>
                  <button type="button" className="be-btn-secondary" onClick={downloadSceneJson}>
                    📋 Download JSON
                  </button>
                  <div className="be-code-section">
                    <div className="be-code-scope">
                      <button type="button" className={exportScope==='scene' ? 'toggle-active':''} onClick={() => setExportScope('scene')}>Full scene</button>
                      <button type="button" className={exportScope==='selection' ? 'toggle-active':''} onClick={() => setExportScope('selection')}>Selection</button>
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
    </div>
  )
}

export default App
