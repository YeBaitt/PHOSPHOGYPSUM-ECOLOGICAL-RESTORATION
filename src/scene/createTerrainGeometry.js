import * as THREE from 'three';

const SITE_ANCHORS = [
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
];

export const SITE_BOUNDARY = Object.freeze(SITE_ANCHORS.flatMap((point, index) => {
  const next = SITE_ANCHORS[(index + 1) % SITE_ANCHORS.length];
  return Array.from({ length: 4 }, (_, step) => {
    const t = step / 4;
    const wobble = step === 0 ? 0 : Math.sin((index * 4 + step) * 2.17) * 0.1;
    const x = point.x + (next.x - point.x) * t;
    const z = point.z + (next.z - point.z) * t;
    const radius = Math.hypot(x, z) || 1;
    return { x: x + (x / radius) * wobble, z: z + (z / radius) * wobble };
  });
}));

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
  const uvs = [];
  const indices = [];
  for (let index = 0; index < outer.length; index += 1) {
    const a = outer[index];
    const c = inner[index];
    positions.push(a.x, a.y, a.z, c.x, c.y, c.z);
    uvs.push(index / outer.length, 1, index / outer.length, 0);
    const next = (index + 1) % outer.length;
    indices.push(index * 2, next * 2, index * 2 + 1, next * 2, next * 2 + 1, index * 2 + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function pointInPolygon(x, z, boundary) {
  let inside = false;
  for (let index = 0, previous = boundary.length - 1; index < boundary.length; previous = index, index += 1) {
    const a = boundary[index];
    const b = boundary[previous];
    if (((a.z > z) !== (b.z > z)) && (x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x)) {
      inside = !inside;
    }
  }
  return inside;
}

export function createHeightFieldGeometry(boundary, heightAt, options = {}) {
  const segmentsX = options.segmentsX ?? 54;
  const segmentsZ = options.segmentsZ ?? 42;
  const minX = Math.min(...boundary.map((point) => point.x));
  const maxX = Math.max(...boundary.map((point) => point.x));
  const minZ = Math.min(...boundary.map((point) => point.z));
  const maxZ = Math.max(...boundary.map((point) => point.z));
  const positions = [];
  const uvs = [];
  const indices = [];
  const rowLength = segmentsX + 1;
  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const z = minZ + ((maxZ - minZ) * zIndex) / segmentsZ;
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const x = minX + ((maxX - minX) * xIndex) / segmentsX;
      positions.push(x, heightAt(x, z), z);
      uvs.push(((x - minX) / (maxX - minX)) * 5, ((z - minZ) / (maxZ - minZ)) * 5);
    }
  }
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    const z0 = minZ + ((maxZ - minZ) * zIndex) / segmentsZ;
    const z1 = minZ + ((maxZ - minZ) * (zIndex + 1)) / segmentsZ;
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const x0 = minX + ((maxX - minX) * xIndex) / segmentsX;
      const x1 = minX + ((maxX - minX) * (xIndex + 1)) / segmentsX;
      const topLeft = zIndex * rowLength + xIndex;
      const topRight = topLeft + 1;
      const bottomLeft = (zIndex + 1) * rowLength + xIndex;
      const bottomRight = bottomLeft + 1;
      if (pointInPolygon((x0 + x1 + x0) / 3, (z0 + z0 + z1) / 3, boundary)) {
        indices.push(topLeft, topRight, bottomLeft);
      }
      if (pointInPolygon((x1 + x1 + x0) / 3, (z0 + z1 + z1) / 3, boundary)) {
        indices.push(topRight, bottomRight, bottomLeft);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
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
