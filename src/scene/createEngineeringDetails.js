import * as THREE from 'three';
import { TERRAIN_STAGE_IDS, getTerrainHeight } from './terrainProfiles.js';

function densifyPath(points, maximumSpacing = 0.3) {
  const dense = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const distance = Math.hypot(end.x - start.x, end.z - start.z);
    const steps = Math.max(1, Math.ceil(distance / maximumSpacing));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      dense.push({
        x: start.x + (end.x - start.x) * t,
        z: start.z + (end.z - start.z) * t,
      });
    }
  }
  dense.push({ ...points.at(-1) });
  return dense;
}

export function createTerrainRibbon(points, width, stageId, clearance = 0.035) {
  const densePoints = densifyPath(points);
  const positions = [];
  const indices = [];

  densePoints.forEach((point, index) => {
    const previous = densePoints[Math.max(0, index - 1)];
    const next = densePoints[Math.min(densePoints.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const normalX = -tangentZ / tangentLength;
    const normalZ = tangentX / tangentLength;

    [-0.5, 0.5].forEach((side) => {
      const x = point.x + normalX * width * side;
      const z = point.z + normalZ * width * side;
      positions.push(x, getTerrainHeight(stageId, x, z) + clearance, z);
    });

    if (index < densePoints.length - 1) {
      const left = index * 2;
      indices.push(left, left + 2, left + 1, left + 1, left + 2, left + 3);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ribbonMesh(name, points, width, stageId, material, clearance) {
  const mesh = new THREE.Mesh(
    createTerrainRibbon(points, width, stageId, clearance),
    material,
  );
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

function createPipe(material) {
  const points = [
    { x: -1.4, z: 0.8 },
    { x: -4.8, z: 2.8 },
    { x: -8.4, z: 4.8 },
    { x: -11.2, z: 6.2 },
  ].map(({ x, z }) => new THREE.Vector3(
    x,
    getTerrainHeight('liner', x, z) + 0.16,
    z,
  ));
  const curve = new THREE.CatmullRomCurve3(points);
  const pipe = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 42, 0.12, 8, false),
    material,
  );
  pipe.name = 'drainage-pipe';
  return pipe;
}

export function createEngineeringDetails(customMaterials = {}) {
  const materials = {
    road: customMaterials.road ?? new THREE.MeshStandardMaterial({ color: '#746b5d', roughness: 0.96 }),
    stone: customMaterials.stone ?? new THREE.MeshStandardMaterial({ color: '#5f6561', roughness: 1 }),
    seam: customMaterials.seam ?? new THREE.MeshStandardMaterial({ color: '#59646b', roughness: 0.76 }),
    pipe: customMaterials.pipe ?? new THREE.MeshStandardMaterial({ color: '#2c3b40', roughness: 0.7 }),
    track: customMaterials.track ?? new THREE.MeshStandardMaterial({ color: '#594634', roughness: 1 }),
  };
  const root = new THREE.Group();
  root.name = 'engineering-details';

  const infrastructure = new THREE.Group();
  infrastructure.name = 'site-infrastructure';
  infrastructure.add(ribbonMesh('construction-road', [
    { x: -24, z: 9 }, { x: -16, z: 8 }, { x: -11, z: 6.3 }, { x: -8.8, z: 4.5 },
  ], 2.2, 'pit', materials.road));
  infrastructure.add(ribbonMesh('stone-drainage-channel', [
    { x: -11.4, z: 6.8 }, { x: -5.8, z: 7.9 }, { x: 1.5, z: 8.4 }, { x: 9.8, z: 6.4 },
  ], 0.48, 'pit', materials.stone));

  const linerDetails = new THREE.Group();
  linerDetails.name = 'liner-details';
  const linerSeams = new THREE.Group();
  linerSeams.name = 'liner-seams';
  [-3.2, 0, 3.2].forEach((z, index) => {
    linerSeams.add(ribbonMesh(`liner-seam-${index + 1}`, [
      { x: -6.7, z }, { x: 0, z: z + 0.25 }, { x: 6.8, z: z - 0.15 },
    ], 0.065, 'liner', materials.seam));
  });
  linerDetails.add(linerSeams, createPipe(materials.pipe));

  const stackDetails = new THREE.Group();
  stackDetails.name = 'stack-details';
  stackDetails.add(ribbonMesh('haul-road', [
    { x: -9.5, z: 4.8 }, { x: -6.2, z: 2.8 }, { x: -2.8, z: 1.5 },
    { x: 0.8, z: 0.4 }, { x: 3.4, z: -0.8 },
  ], 1.05, 'stack', materials.road, 0.145));

  const coverDetails = new THREE.Group();
  coverDetails.name = 'cover-details';
  const coverTracks = new THREE.Group();
  coverTracks.name = 'cover-tracks';
  [-1.6, 0, 1.6].forEach((offset, index) => {
    coverTracks.add(ribbonMesh(`cover-track-${index + 1}`, [
      { x: -6.2, z: -2.7 + offset },
      { x: 0, z: -2.3 + offset },
      { x: 6.1, z: -2.8 + offset },
    ], 0.18, 'cover', materials.track));
  });
  coverDetails.add(coverTracks);

  root.add(infrastructure, linerDetails, stackDetails, coverDetails);

  function applyStage(stageId) {
    if (!TERRAIN_STAGE_IDS.includes(stageId)) {
      throw new Error(`Unknown terrain stage: ${stageId}`);
    }
    linerDetails.visible = stageId === 'liner';
    stackDetails.visible = stageId === 'stack';
    coverDetails.visible = stageId === 'cover';
  }

  function dispose() {
    const geometries = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
    });
    geometries.forEach(geometry => geometry.dispose());
    new Set(Object.values(materials)).forEach(material => material.dispose());
  }

  applyStage('pit');
  return { root, applyStage, dispose };
}
