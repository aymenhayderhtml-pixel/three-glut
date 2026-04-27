import { usePrismStore } from '../store/prismStore';
import { generatePrismMesh } from '../geometry/prismGeometry';

export function PrismProperties() {
    const { mesh, setMesh, selectedFaceId, faceMode } = usePrismStore();

    const handleSidesChange = (sides: number) => {
        const newMesh = generatePrismMesh(sides, mesh.height, mesh.radius);
        setMesh(newMesh);
    };

    const handleHeightChange = (height: number) => {
        const newMesh = generatePrismMesh(mesh.sides, height, mesh.radius);
        setMesh(newMesh);
    };

    const handleRadiusChange = (radius: number) => {
        const newMesh = generatePrismMesh(mesh.sides, mesh.height, radius);
        setMesh(newMesh);
    };

    return (
        <div style={{ padding: 12 }}>
            <h3>Prism Properties</h3>
            <label>
                Sides:
                <input
                    type="range"
                    min={3}
                    max={12}
                    step={1}
                    value={mesh.sides}
                    onChange={(e) => handleSidesChange(parseInt(e.target.value))}
                />
                <span>{mesh.sides}</span>
            </label>
            <label>
                Height:
                <input
                    type="range"
                    min={0.5}
                    max={5}
                    step={0.1}
                    value={mesh.height}
                    onChange={(e) => handleHeightChange(parseFloat(e.target.value))}
                />
                <span>{mesh.height.toFixed(2)}</span>
            </label>
            <label>
                Radius:
                <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={mesh.radius}
                    onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
                />
                <span>{mesh.radius.toFixed(2)}</span>
            </label>
            {faceMode && selectedFaceId && (
                <div>Selected face: {selectedFaceId}</div>
            )}
        </div>
    );
}