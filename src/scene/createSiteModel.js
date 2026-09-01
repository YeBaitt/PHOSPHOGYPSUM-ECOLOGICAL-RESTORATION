import * as THREE from 'three';
import { createAssetTexture } from './createTexture.js';
import { getStageConfig } from './stageConfig.js';
import {
  SITE_BOUNDARY,
  createHeightFieldGeometry,
  createRingGeometry,
  createSurfaceGeometry,
  scaleRing,
} from './createTerrainGeometry.js';

function makeMaterial(texture, options = {}) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.16,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    ...options,
  });
}

function makeMesh(geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function offsetRing(points, scale, y, xOffset = 0, zOffset = 0) {
  return scaleRing(points, scale, y).map((point) => ({
    ...point,
    x: point.x + xOffset,
    z: point.z + zOffset,
  }));
}

function createRibbonGeometry(points, width) {
  const positions = [];
  const uvs = [];
  const edges = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const sideX = (-dz / length) * width * 0.5;
    const sideZ = (dx / length) * width * 0.5;
    return {
      left: { x: point.x + sideX, y: point.y, z: point.z + sideZ },
      right: { x: point.x - sideX, y: point.y, z: point.z - sideZ },
    };
  });

  for (let index = 0; index < edges.length - 1; index += 1) {
    const a = edges[index].left;
    const b = edges[index].right;
    const c = edges[index + 1].left;
    const d = edges[index + 1].right;
    positions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      b.x, b.y, b.z,
      d.x, d.y, d.z,
      c.x, c.y, c.z,
    );
    const u0 = index / (edges.length - 1);
    const u1 = (index + 1) / (edges.length - 1);
    uvs.push(u0, 0, u0, 1, u1, 0, u0, 1, u1, 1, u1, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function densifyPath(coordinates, stepsPerSegment = 8) {
  const points = [];
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const [x0, z0] = coordinates[index];
    const [x1, z1] = coordinates[index + 1];
    for (let step = 0; step < stepsPerSegment; step += 1) {
      const t = step / stepsPerSegment;
      points.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
    }
  }
  points.push(coordinates.at(-1));
  return points;
}

function createPit(material, rockMaterial) {
  const group = new THREE.Group();
  group.name = 'pit-layer';
  const rim = scaleRing(SITE_BOUNDARY, 1, 0);
  const mid = offsetRing(SITE_BOUNDARY, { x: 0.82, z: 0.8 }, -1.22, 0.18, -0.08);
  const floorRing = offsetRing(SITE_BOUNDARY, { x: 0.66, z: 0.62 }, -2.72, 0.08, 0.04);

  group.add(makeMesh(createSurfaceGeometry(floorRing, -2.7), material, 'pit-floor'));
  group.add(makeMesh(createRingGeometry(rim, mid), material, 'pit-wall'));
  group.add(makeMesh(createRingGeometry(mid, floorRing), material, 'pit-lower-slope'));

  const looseRock = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.22, 0),
    rockMaterial,
    52,
  );
  looseRock.name = 'pit-loose-rock';
  looseRock.castShadow = true;
  const transform = new THREE.Object3D();
  for (let index = 0; index < 52; index += 1) {
    const angle = index * 2.399;
    const radius = 5.2 + (index % 9) * 0.37;
    transform.position.set(
      Math.cos(angle) * radius,
      -2.45 + (index % 5) * 0.43,
      Math.sin(angle) * radius * 0.72,
    );
    transform.rotation.set(angle * 0.17, angle, angle * 0.09);
    transform.scale.set(0.55 + (index % 4) * 0.18, 0.35 + (index % 3) * 0.1, 0.7);
    transform.updateMatrix();
    looseRock.setMatrixAt(index, transform.matrix);
  }
  group.add(looseRock);
  return group;
}

function createLiner(material, seamMaterial, pipeMaterial) {
  const group = new THREE.Group();
  group.name = 'liner-layer';
  const rim = offsetRing(SITE_BOUNDARY, 0.975, -0.05);
  const mid = offsetRing(SITE_BOUNDARY, { x: 0.81, z: 0.78 }, -1.19, 0.18, -0.08);
  const floorRing = offsetRing(SITE_BOUNDARY, { x: 0.65, z: 0.61 }, -2.64, 0.08, 0.04);
  group.add(makeMesh(createRingGeometry(rim, mid), material, 'liner-upper-slope'));
  group.add(makeMesh(createRingGeometry(mid, floorRing), material, 'liner-wall'));
  group.add(makeMesh(createSurfaceGeometry(floorRing, -2.62), material, 'liner-floor'));

  const seams = new THREE.Group();
  seams.name = 'liner-seams';
  [-2.8, -0.9, 1, 2.9].forEach((z, index) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.1, -2.56, z * 0.82),
      new THREE.Vector3(-1.4, -2.52 + index * 0.008, z * 0.94),
      new THREE.Vector3(1.5, -2.55, z),
      new THREE.Vector3(4.2, -2.52, z * 0.76),
    ]);
    seams.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),
      seamMaterial,
    ));
  });
  group.add(seams);

  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.1, -2.42, 2.5),
    new THREE.Vector3(5.1, -1.6, 2.9),
    new THREE.Vector3(7.1, -0.55, 3.3),
    new THREE.Vector3(9.4, 0.12, 3.65),
  ]);
  group.add(makeMesh(
    new THREE.TubeGeometry(pipeCurve, 48, 0.12, 10, false),
    pipeMaterial,
    'drainage-pipe',
  ));
  return group;
}

function moundHeightAt(x, z) {
  const radial = Math.hypot((x + 0.15) / 6.45, (z - 0.08) / 4.72)
    * (1 + Math.sin(Math.atan2(z, x) * 5) * 0.035);
  const noise = Math.sin(x * 2.13 + z * 0.72) * 0.035
    + Math.cos(z * 2.47 - x * 0.36) * 0.025;
  let height;
  if (radial < 0.27) height = 1.92;
  else if (radial < 0.37) height = 1.92 - ((radial - 0.27) / 0.1) * 0.72;
  else if (radial < 0.49) height = 1.2;
  else if (radial < 0.59) height = 1.2 - ((radial - 0.49) / 0.1) * 0.76;
  else if (radial < 0.71) height = 0.44;
  else if (radial < 0.81) height = 0.44 - ((radial - 0.71) / 0.1) * 0.88;
  else if (radial < 0.91) height = -0.44;
  else height = -0.44 - Math.min(1, (radial - 0.91) / 0.13) * 1.82;
  return height + noise;
}

function createTerracedMound(material, name, scalePad = 0, heightPad = 0) {
  const group = new THREE.Group();
  group.name = name;
  const boundary = offsetRing(SITE_BOUNDARY, 0.75 + scalePad, 0)
    .map(({ x, z }) => ({ x, z }));
  group.add(makeMesh(
    createHeightFieldGeometry(boundary, (x, z) => moundHeightAt(x, z) + heightPad),
    material,
    `${name}-terrain`,
  ));
  return group;
}

function createHaulRoad(material) {
  const coordinates = [
    [5.9, -2.8], [4.6, -3.35], [2.5, -3.5], [0.2, -3.28],
    [-2.1, -2.55], [-3.55, -1.35], [-3.45, 0.25], [-2.2, 1.05],
    [-0.45, 1.35], [1.25, 0.9],
  ];
  const road = makeMesh(createRibbonGeometry(densifyPath(coordinates).map(([x, z]) => ({
    x,
    z,
    y: moundHeightAt(x, z) + 0.17,
  })), 0.58), material, 'haul-road');
  road.castShadow = false;
  return road;
}

function createCoverTracks(material) {
  const group = new THREE.Group();
  group.name = 'cover-tracks';
  [-0.12, 0.12].forEach((offset) => {
    const coordinates = [[-4.7, -2.5], [-3.2, -1.9], [-1.7, -1], [-0.35, -0.15], [0.8, 0.65]];
    group.add(makeMesh(createRibbonGeometry(densifyPath(coordinates, 6).map(([x, z]) => ({
      x,
      z: z + offset,
      y: moundHeightAt(x, z + offset) + 0.135,
    })), 0.095), material, `cover-track-${offset < 0 ? 'left' : 'right'}`));
  });
  return group;
}

function createGrassTufts(material) {
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.28, 4), material, 260);
  tufts.name = 'grass-tufts';
  tufts.castShadow = true;
  const transform = new THREE.Object3D();
  for (let index = 0; index < 260; index += 1) {
    const angle = index * 2.399;
    const radius = 0.7 + (index % 22) * 0.22;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.72;
    transform.position.set(x, moundHeightAt(x, z) + 0.36, z);
    transform.rotation.y = angle;
    transform.scale.setScalar(index % 7 === 0 ? 0.35 : 0.75 + (index % 5) * 0.08);
    transform.updateMatrix();
    tufts.setMatrixAt(index, transform.matrix);
  }
  return tufts;
}

function createRestorationPlants(shrubMaterial, trunkMaterial, canopyMaterial) {
  const group = new THREE.Group();
  group.name = 'shrubs-layer';
  const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.24, 1), shrubMaterial, 54);
  shrubs.name = 'restoration-shrubs';
  shrubs.castShadow = true;
  const transform = new THREE.Object3D();
  for (let index = 0; index < 54; index += 1) {
    const angle = index * 2.399;
    const radius = 1.1 + (index % 9) * 0.48;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.72;
    transform.position.set(x, moundHeightAt(x, z) + 0.31, z);
    transform.scale.set(0.75 + (index % 3) * 0.16, 0.55, 0.8);
    transform.updateMatrix();
    shrubs.setMatrixAt(index, transform.matrix);
  }
  group.add(shrubs);

  const trees = new THREE.Group();
  trees.name = 'restoration-trees';
  const count = 18;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.075, 0.72, 6), trunkMaterial, count);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 1), canopyMaterial, count * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.15 + 0.7;
    const radius = 1.3 + (index % 6) * 0.61;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.7;
    const baseY = moundHeightAt(x, z) + 0.2;
    transform.position.set(x, baseY + 0.36, z);
    transform.scale.setScalar(0.8 + (index % 4) * 0.08);
    transform.updateMatrix();
    trunks.setMatrixAt(index, transform.matrix);
    for (let lobe = 0; lobe < 3; lobe += 1) {
      const lobeAngle = angle + lobe * 2.094;
      transform.position.set(
        x + Math.cos(lobeAngle) * 0.17,
        baseY + 0.76 + (lobe === 0 ? 0.13 : 0),
        z + Math.sin(lobeAngle) * 0.17,
      );
      transform.scale.set(0.92, 1.08 + (lobe === 0 ? 0.12 : 0), 0.92);
      transform.updateMatrix();
      crowns.setMatrixAt(index * 3 + lobe, transform.matrix);
    }
  }
  trunks.castShadow = true;
  crowns.castShadow = true;
  trees.add(trunks, crowns);
  group.add(trees);
  return group;
}

function createGround(material) {
  const shape = new THREE.Shape();
  shape.moveTo(-28, -20);
  shape.lineTo(28, -20);
  shape.lineTo(28, 20);
  shape.lineTo(-28, 20);
  shape.closePath();
  const holePoints = scaleRing(SITE_BOUNDARY, 0.98, 0).reverse();
  const opening = new THREE.Path();
  opening.moveTo(holePoints[0].x, holePoints[0].z);
  holePoints.slice(1).forEach((point) => opening.lineTo(point.x, point.z));
  opening.closePath();
  shape.holes.push(opening);
  const ground = makeMesh(new THREE.ShapeGeometry(shape), material, 'site-ground');
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.035;
  return ground;
}

function createContextDetails(materials) {
  const context = new THREE.Group();
  context.name = 'site-context';
  const road = makeMesh(createRibbonGeometry([
    { x: -16.5, y: 0.1, z: -8.4 },
    { x: -11.8, y: 0.12, z: -7.4 },
    { x: -8.8, y: 0.14, z: -5.9 },
    { x: -7.7, y: 0.16, z: -3.8 },
    { x: -9.1, y: 0.13, z: -1.4 },
    { x: -12.8, y: 0.1, z: 0.2 },
  ], 1.45), materials.road, 'construction-road');
  road.receiveShadow = true;
  context.add(road);
  context.add(makeMesh(createRibbonGeometry([
    { x: 9.2, y: 0.09, z: -8.8 },
    { x: 10, y: 0.07, z: -4.5 },
    { x: 10.2, y: 0.05, z: 0.4 },
    { x: 9.5, y: 0.04, z: 5.5 },
    { x: 8.3, y: 0.04, z: 10.5 },
  ], 0.65), materials.drainage, 'stone-drainage-channel'));

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.2, 0), materials.rock, 72);
  rocks.name = 'context-rocks';
  rocks.castShadow = true;
  const transform = new THREE.Object3D();
  for (let index = 0; index < 72; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    transform.position.set(side * (9.8 + (index % 8) * 0.42), 0.17, -9.6 + (index % 18) * 1.12);
    transform.rotation.set(index * 0.21, index * 0.63, index * 0.11);
    transform.scale.set(0.65 + (index % 4) * 0.15, 0.38, 0.75);
    transform.updateMatrix();
    rocks.setMatrixAt(index, transform.matrix);
  }
  context.add(rocks);

  return context;
}

export function createSiteModel(renderer) {
  const textures = {
    rock: createAssetTexture('rock', renderer),
    gypsum: createAssetTexture('gypsum', renderer),
    liner: createAssetTexture('liner', renderer),
    cover: createAssetTexture('cover', renderer),
    grass: createAssetTexture('grass', renderer),
  };
  const materials = {
    soil: makeMaterial(textures.rock, { color: '#b7aa9a', bumpScale: 0.28 }),
    gypsum: makeMaterial(textures.gypsum, { color: '#ffffff', roughness: 0.9, bumpScale: 0.24 }),
    gypsumRoad: makeMaterial(textures.gypsum, { color: '#9d927c', roughness: 1, bumpScale: 0.3 }),
    liner: makeMaterial(textures.liner, { color: '#73787a', roughness: 0.76, metalness: 0.02, bumpScale: 0.06 }),
    cover: makeMaterial(textures.cover, { color: '#c4a080', bumpScale: 0.22 }),
    track: makeMaterial(textures.cover, { color: '#5f4735', roughness: 1 }),
    grass: makeMaterial(textures.grass, { color: '#b6c6a3', roughness: 1 }),
    shrub: makeMaterial(textures.grass, { color: '#739064', roughness: 1 }),
    rock: makeMaterial(textures.rock, { color: '#9c9389', roughness: 1, bumpScale: 0.34, flatShading: true }),
    road: makeMaterial(textures.cover, { color: '#b4936d', roughness: 1, bumpScale: 0.25 }),
    drainage: makeMaterial(textures.rock, { color: '#697378', roughness: 0.94 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#54402c', roughness: 1 }),
    canopy: makeMaterial(textures.grass, { color: '#789d69', roughness: 1 }),
    seam: new THREE.LineBasicMaterial({ color: '#667b82', transparent: true, opacity: 0.82 }),
    pipe: new THREE.MeshStandardMaterial({ color: '#313b3f', roughness: 0.48, metalness: 0.22 }),
  };

  const root = new THREE.Group();
  root.name = 'site-model';
  root.add(createGround(materials.soil));
  root.add(createContextDetails(materials));
  const layers = {
    pit: createPit(materials.soil, materials.rock),
    liner: createLiner(materials.liner, materials.seam, materials.pipe),
    gypsum: createTerracedMound(materials.gypsum, 'gypsum-layer'),
    cover: createTerracedMound(materials.cover, 'cover-layer', 0.055, 0.16),
    grass: createTerracedMound(materials.grass, 'grass-layer', 0.082, 0.27),
    shrubs: createRestorationPlants(materials.shrub, materials.trunk, materials.canopy),
  };
  layers.gypsum.add(createHaulRoad(materials.gypsumRoad));
  layers.cover.add(createCoverTracks(materials.track));
  layers.grass.add(createGrassTufts(materials.grass));
  Object.values(layers).forEach((layer) => root.add(layer));

  function applyStage(stageId) {
    const config = getStageConfig(stageId);
    Object.entries(layers).forEach(([key, layer]) => {
      layer.visible = config[key];
    });
    const looseRock = layers.pit.getObjectByName('pit-loose-rock');
    looseRock.visible = stageId === 'pit';
    return config;
  }

  function dispose() {
    const geometries = new Set();
    const disposableMaterials = new Set(Object.values(materials));
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach((material) => disposableMaterials.add(material));
      else if (object.material) disposableMaterials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    disposableMaterials.forEach((material) => material.dispose());
    Object.values(textures).forEach((texture) => texture.dispose());
  }

  applyStage('pit');
  return { root, applyStage, dispose };
}
