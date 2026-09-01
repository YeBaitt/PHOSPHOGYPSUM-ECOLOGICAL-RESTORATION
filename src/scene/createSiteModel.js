import * as THREE from 'three';
import { createTexture } from './createTexture.js';
import { getStageConfig } from './stageConfig.js';

function makeMaterial(texture, options = {}) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.16,
    roughness: 0.92,
    metalness: 0,
    ...options,
  });
}

function roughenRadialGeometry(geometry, amount, seed) {
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radius = Math.hypot(x, z);
    if (radius < 0.05) continue;
    const angle = Math.atan2(z, x);
    const variation =
      Math.sin(angle * 5 + seed) * 0.55
      + Math.sin(angle * 11 + seed * 1.7) * 0.28
      + Math.sin(y * 3.2 + seed) * 0.17;
    const scale = 1 + variation * amount;
    position.setXYZ(index, x * scale, y, z * scale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makeMesh(geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createPit(material) {
  const group = new THREE.Group();
  group.name = 'pit-layer';

  const floor = makeMesh(new THREE.CircleGeometry(6.35, 64), material, 'pit-floor');
  floor.rotation.x = -Math.PI / 2;
  floor.scale.z = 0.7;
  floor.position.y = -2.38;
  group.add(floor);

  const wall = makeMesh(
    new THREE.CylinderGeometry(8.45, 6.35, 2.4, 64, 5, true),
    material,
    'pit-wall',
  );
  wall.scale.z = 0.7;
  wall.position.y = -1.18;
  group.add(wall);
  return group;
}

function createLiner(material) {
  const group = new THREE.Group();
  group.name = 'liner-layer';

  const floor = makeMesh(new THREE.CircleGeometry(6.23, 64), material, 'liner-floor');
  floor.rotation.x = -Math.PI / 2;
  floor.scale.z = 0.7;
  floor.position.y = -2.34;
  group.add(floor);

  const wall = makeMesh(
    new THREE.CylinderGeometry(8.25, 6.23, 2.28, 64, 5, true),
    material,
    'liner-wall',
  );
  wall.scale.z = 0.7;
  wall.position.y = -1.18;
  group.add(wall);
  return group;
}

function createTerracedMound(material, name, radiusOffset = 0, heightOffset = 0) {
  const group = new THREE.Group();
  group.name = name;
  const terraces = [
    { bottom: 6.15, top: 5.62, height: 1.4, y: -1.65 },
    { bottom: 5.45, top: 4.82, height: 1.3, y: -0.38 },
    { bottom: 4.55, top: 3.72, height: 1.25, y: 0.8 },
    { bottom: 3.42, top: 2.48, height: 1.12, y: 1.88 },
  ];

  terraces.forEach((terrace, index) => {
    const geometry = roughenRadialGeometry(
      new THREE.CylinderGeometry(
        terrace.top + radiusOffset,
        terrace.bottom + radiusOffset,
        terrace.height + heightOffset,
        64,
        3,
      ),
      0.035,
      index + name.length,
    );
    const mesh = makeMesh(
      geometry,
      material,
      `${name}-${index + 1}`,
    );
    mesh.position.y = terrace.y + heightOffset * index * 0.5;
    mesh.scale.z = 0.72;
    mesh.rotation.y = index * 0.08;
    group.add(mesh);
  });
  return group;
}

function createShrubs(material) {
  const group = new THREE.Group();
  group.name = 'shrubs-layer';
  for (let index = 0; index < 42; index += 1) {
    const angle = index * 2.399;
    const radius = 0.9 + (index % 7) * 0.58;
    const shrub = makeMesh(
      new THREE.IcosahedronGeometry(0.2 + (index % 3) * 0.055, 1),
      material,
      `shrub-${index + 1}`,
    );
    shrub.position.set(
      Math.cos(angle) * radius,
      3.34 - radius * 0.36,
      Math.sin(angle) * radius * 0.72,
    );
    shrub.scale.y = 0.75 + (index % 4) * 0.08;
    group.add(shrub);
  }
  return group;
}

function createGrassTufts(material) {
  const geometry = new THREE.ConeGeometry(0.075, 0.34, 4);
  const tufts = new THREE.InstancedMesh(geometry, material, 120);
  tufts.name = 'grass-tufts';
  tufts.castShadow = true;
  const transform = new THREE.Object3D();
  for (let index = 0; index < 120; index += 1) {
    const angle = index * 2.399;
    const radius = 0.7 + (index % 15) * 0.28;
    transform.position.set(
      Math.cos(angle) * radius,
      3.5 - radius * 0.45,
      Math.sin(angle) * radius * 0.72,
    );
    transform.rotation.y = angle;
    transform.scale.setScalar(0.8 + (index % 5) * 0.09);
    transform.updateMatrix();
    tufts.setMatrixAt(index, transform.matrix);
  }
  return tufts;
}

function createContextDetails(rockMaterial, grassMaterial) {
  const context = new THREE.Group();
  context.name = 'site-context';
  const rocks = new THREE.Group();
  rocks.name = 'context-rocks';
  for (let index = 0; index < 34; index += 1) {
    const angle = index * 2.17;
    const radius = 9.5 + (index % 6) * 0.68;
    const rock = makeMesh(
      new THREE.DodecahedronGeometry(0.15 + (index % 4) * 0.065, 0),
      rockMaterial,
      `context-rock-${index + 1}`,
    );
    rock.position.set(
      Math.cos(angle) * radius,
      0.15 + (index % 3) * 0.03,
      Math.sin(angle) * radius * 0.72,
    );
    rock.rotation.set(angle * 0.3, angle, angle * 0.16);
    rock.scale.y = 0.58 + (index % 3) * 0.12;
    rocks.add(rock);
  }
  context.add(rocks);

  const fringe = new THREE.Group();
  fringe.name = 'context-vegetation';
  for (let index = 0; index < 26; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (10.5 + (index % 5) * 0.65);
    const z = -8.2 + (index % 13) * 1.32;
    const plant = makeMesh(
      new THREE.IcosahedronGeometry(0.22 + (index % 3) * 0.08, 1),
      grassMaterial,
      `context-plant-${index + 1}`,
    );
    plant.position.set(x, 0.22, z);
    plant.scale.y = 0.72 + (index % 4) * 0.13;
    fringe.add(plant);
  }
  context.add(fringe);
  return context;
}

function createGround(material) {
  const shape = new THREE.Shape();
  shape.moveTo(-15, -11);
  shape.lineTo(15, -11);
  shape.lineTo(15, 11);
  shape.lineTo(-15, 11);
  shape.closePath();

  const opening = new THREE.Path();
  opening.absellipse(0, 0, 8.55, 6, 0, Math.PI * 2, true);
  shape.holes.push(opening);

  const ground = makeMesh(new THREE.ShapeGeometry(shape, 24), material, 'site-ground');
  const position = ground.geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const height = Math.sin(x * 0.42) * 0.07 + Math.cos(y * 0.37) * 0.06;
    position.setZ(index, height);
  }
  position.needsUpdate = true;
  ground.geometry.computeVertexNormals();
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.04;
  return ground;
}

export function createSiteModel(renderer) {
  const textures = {
    soil: createTexture('soil', renderer),
    gypsum: createTexture('gypsum', renderer),
    liner: createTexture('liner', renderer),
    grass: createTexture('grass', renderer),
  };
  const materials = {
    soil: makeMaterial(textures.soil, { color: '#7b5a3b' }),
    gypsum: makeMaterial(textures.gypsum, { color: '#eeece4', roughness: 0.84 }),
    liner: makeMaterial(textures.liner, { color: '#151d20', roughness: 0.56, metalness: 0.08 }),
    cover: makeMaterial(textures.soil, { color: '#805b3b' }),
    grass: makeMaterial(textures.grass, { color: '#527d3b' }),
    fringe: makeMaterial(textures.grass, { color: '#345c2d', roughness: 1 }),
    rock: makeMaterial(textures.soil, { color: '#675a4d', roughness: 1, bumpScale: 0.24 }),
  };

  const root = new THREE.Group();
  root.name = 'site-model';

  const ground = createGround(materials.soil);
  root.add(ground);
  root.add(createContextDetails(materials.rock, materials.fringe));

  const layers = {
    pit: createPit(materials.soil),
    liner: createLiner(materials.liner),
    gypsum: createTerracedMound(materials.gypsum, 'gypsum-layer'),
    cover: createTerracedMound(materials.cover, 'cover-layer', 0.16, 0.08),
    grass: createTerracedMound(materials.grass, 'grass-layer', 0.24, 0.12),
    shrubs: createShrubs(materials.grass),
  };
  layers.grass.add(createGrassTufts(materials.grass));

  Object.values(layers).forEach((layer) => root.add(layer));

  function applyStage(stageId) {
    const config = getStageConfig(stageId);
    Object.entries(layers).forEach(([key, layer]) => {
      layer.visible = config[key];
    });
    return config;
  }

  function dispose() {
    root.traverse((object) => {
      object.geometry?.dispose();
    });
    Object.values(materials).forEach((material) => material.dispose());
    Object.values(textures).forEach((texture) => texture.dispose());
  }

  applyStage('pit');
  return { root, applyStage, dispose };
}
