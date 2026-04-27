import { usePrismStore } from '../store/prismStore';

export function PrismToolbar() {
    const { faceMode, setFaceMode, undo, redo, selectedFaceId, extrudeFace } = usePrismStore();

    return (
        <div style={{ display: 'flex', gap: 8, padding: 8, background: '#2a2a2a', borderRadius: 4 }}>
            <button onClick={() => setFaceMode(!faceMode)}>
                {faceMode ? 'Exit Face Mode' : 'Face Mode'}
            </button>
            <button onClick={undo}>Undo</button>
            <button onClick={redo}>Redo</button>
            {faceMode && selectedFaceId && (
                <button onClick={() => extrudeFace(selectedFaceId, 0.5)}>Extrude +0.5</button>
            )}
        </div>
    );
}