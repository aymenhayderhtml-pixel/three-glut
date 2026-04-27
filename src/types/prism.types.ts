export interface Vertex { x: number; y: number; z: number; }
export interface Face {
  id: string;
  vertices: Vertex[];
  normal: Vertex;
  center: Vertex;
  indices: number[];
}
export interface Edge {
  id: string;
  vertexIndices: [number, number];
  faceIds: string[];
}
export interface PrismMesh {
  vertices: Vertex[];
  faces: Face[];
  edges: Edge[];
  sides: number;
  height: number;
  radius: number;
}