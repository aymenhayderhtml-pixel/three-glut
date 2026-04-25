// ─────────────────────────────────────────────────────────────
// Pure math utilities — no external dependencies
// ─────────────────────────────────────────────────────────────

// ─── 2D LINE ENDPOINT MATH ──────────────────────────────────

/**
 * Calculate the two endpoints of a 2D line given its center, length, and rotation.
 *
 * The line extends from center by ±(length/2) along the direction defined by
 * rotation angle (in degrees, counter-clockwise from +X axis).
 *
 * endpointA = center - (length/2) * direction
 * endpointB = center + (length/2) * direction
 */
export function getLineEndpoints(
  cx: number,
  cy: number,
  length: number,
  rotationDeg: number
): [{ x: number; y: number }, { x: number; y: number }] {
  const rad = (rotationDeg * Math.PI) / 180;
  const halfLen = length / 2;
  const dx = Math.cos(rad) * halfLen;
  const dy = Math.sin(rad) * halfLen;

  return [
    { x: cx - dx, y: cy - dy },
    { x: cx + dx, y: cy + dy },
  ];
}

/**
 * Given one anchored endpoint and one dragged endpoint, compute the new
 * center, length, and rotation for the line.
 *
 * newCenter = midpoint(anchor, drag)
 * newLength = distance(anchor, drag)
 * newRotation = atan2(drag.y - anchor.y, drag.x - anchor.x) in degrees
 */
export function computeLineFromEndpoints(
  anchorX: number,
  anchorY: number,
  dragX: number,
  dragY: number
): {
  position: [number, number, number];
  length: number;
  rotation: [number, number, number];
} {
  const cx = (anchorX + dragX) / 2;
  const cy = (anchorY + dragY) / 2;
  const dx = dragX - anchorX;
  const dy = dragY - anchorY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const rotationRad = Math.atan2(dy, dx);
  const rotationDeg = (rotationRad * 180) / Math.PI;

  return {
    position: [cx, cy, 0],
    length: Math.max(0.1, length),
    rotation: [0, 0, rotationDeg],
  };
}
