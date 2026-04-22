import type { CubeCoord } from '../engine/types.js';
import { cubeToOffset } from '../engine/hex.js';

// Flat-top hex layout constants
const HEX_SIZE = 20; // radius (center to vertex)
const SQRT3 = Math.sqrt(3);

/** Pixel position of a hex center, given offset (col, row) coordinates.
 *  Uses odd-r offset layout (odd rows shifted right). */
export function hexToPixel(coord: CubeCoord): { x: number; y: number } {
  const { col, row } = cubeToOffset(coord);
  const x = SQRT3 * HEX_SIZE * (col + 0.5 * (row & 1));
  const y = 1.5 * HEX_SIZE * row;
  return { x, y };
}

/** SVG points string for a flat-top hexagon centered at (0, 0). */
export function hexPoints(): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + 30);
    const px = HEX_SIZE * Math.cos(angle);
    const py = HEX_SIZE * Math.sin(angle);
    points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  return points.join(' ');
}

/** Get the SVG viewBox dimensions for a board of given col/row count. */
export function getBoardViewBox(
  width: number,
  height: number,
): { minX: number; minY: number; vbWidth: number; vbHeight: number } {
  const padding = HEX_SIZE * 1.5;
  const totalWidth = SQRT3 * HEX_SIZE * (width + 0.5) + padding * 2;
  const totalHeight = 1.5 * HEX_SIZE * (height - 1) + 2 * HEX_SIZE + padding * 2;
  return {
    minX: -padding,
    minY: -HEX_SIZE - padding + HEX_SIZE,
    vbWidth: totalWidth,
    vbHeight: totalHeight,
  };
}

export { HEX_SIZE };
