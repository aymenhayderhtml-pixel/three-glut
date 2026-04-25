export type PrimitiveKind =
  | 'cube'
  | 'sphere'
  | 'cone'
  | 'torus'
  | 'teapot'
  | 'ground'
  | 'prism'
  | 'line'
  | 'rect'
  | 'circle'
  | 'polygon';

export interface SceneObject {
  id: string;
  kind: PrimitiveKind;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in degrees
  scale: [number, number, number];
  radius: number;
  height: number;
  length: number;
  facePulls: Partial<Record<string, number>>;
  edgePulls: Partial<Record<string, number>>;
}

export type ViewMode = '3d' | '2d';

export interface DragState {
  objectId: string;
  faceKey: string;
  startPoint: [number, number, number];
  normal: [number, number, number];
  initialValue: number;
  type: 'face' | 'edge';
}
