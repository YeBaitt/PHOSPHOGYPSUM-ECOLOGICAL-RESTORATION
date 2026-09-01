import * as THREE from 'three';

export const SITE_BOUNDARY = Object.freeze([
  { x: -8.7, z: -3.9 },
  { x: -7.1, z: -6.1 },
  { x: -3.5, z: -6.8 },
  { x: 0.2, z: -6.3 },
  { x: 4.6, z: -6.7 },
  { x: 7.8, z: -4.8 },
  { x: 8.9, z: -1.5 },
  { x: 8.1, z: 2.4 },
  { x: 6.2, z: 5.7 },
  { x: 2.5, z: 6.8 },
  { x: -1.2, z: 6.3 },
  { x: -5.0, z: 6.7 },
  { x: -8.2, z: 4.5 },
  { x: -9.2, z: 0.7 },
]);

export function scaleRing(points, scale, y) {
  const scaleX = typeof scale === 'number' ? scale : scale.x;
  const scaleZ = typeof scale === 'number' ? scale : scale.z;
  return points.map((point) => ({
    x: point.x * scaleX,
    y,
    z: point.z * scaleZ,
  }));
}

export function createRingGeometry(outer, inner) {
  if (outer.length !== inner.length || outer.length < 3) {
    throw new Error('Terrain rings must contain the same number of points');
  }

  const positions = [];
  for (let index = 0; index < outer.length; index += 1) {
    const next = (index + 1) % outer.length;
    const a = outer[index];
    const b = outer[next];
    const c = inner[index];
    const d = inner[next];
    positions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      b.x, b.y, b.z,
      d.x, d.y, d.z,
      c.x, c.y, c.z,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createSurfaceGeometry(points, y) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].z);
  points.slice(1).forEach((point) => shape.lineTo(point.x, point.z));
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  geometry.computeVertexNormals();
  return geometry;
}

