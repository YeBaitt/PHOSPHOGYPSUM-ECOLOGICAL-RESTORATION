import * as THREE from 'three';
import { createTexture } from './createTexture.js';
import { getStageConfig } from './stageConfig.js';

function makeMaterial(texture, options = {}) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.92,
    metalness: 0,
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

function createPit(material) {
  const group = new THREE.Group();
  group.name = 'pit-layer';

  const floor = makeMesh(new THREE.CircleGeometry(7.4, 64), material, 'pit-floor');
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  group.add(floor);

  const wall = makeMesh(
    new THREE.CylinderGeometry(7.4, 9.8, 2.4, 64, 5, true),
    material,
    'pit-wall',
  );
  wall.position.y = 0;
  group.add(wall);
  return group;
}

function createLiner(material) {
  const group = new THREE.Group();
  group.name = 'liner-layer';

  const floor = makeMesh(new THREE.CircleGeometry(7.3, 64), material, 'liner-floor');
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.16;
  group.add(floor);

  const wall = makeMesh(
    new THREE.CylinderGeometry(7.32, 9.45, 2.28, 64, 5, true),
    material,
    'liner-wall',
  );
  wall.position.y = 0;
  group.add(wall);
  return group;
}

function createTerracedMound(material, name, radiusOffset = 0, heightOffset = 0) {
  const group = new THREE.Group();
  group.name = name;
  const terraces = [
    { bottom: 7.2, top: 6.5, height: 1.55, y: -0.38 },
    { bottom: 6.25, top: 5.35, height: 1.55, y: 1.02 },
    { bottom: 5.05, top: 3.95, height: 1.45, y: 2.37 },
    { bottom: 3.65, top: 2.45, height: 1.2, y: 3.56 },
  ];

  terraces.forEach((terrace, index) => {
    const mesh = makeMesh(
      new THREE.CylinderGeometry(
        terrace.top + radiusOffset,
        terrace.bottom + radiusOffset,
        terrace.height + heightOffset,
        64,
        3,
      ),
      material,
      `${name}-${index + 1}`,
    );
    mesh.position.y = terrace.y + heightOffset * index * 0.5;
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
    const radius = 1.15 + (index % 7) * 0.7;
    const shrub = makeMesh(
      new THREE.IcosahedronGeometry(0.2 + (index % 3) * 0.055, 1),
      material,
      `shrub-${index + 1}`,
    );
    shrub.position.set(
      Math.cos(angle) * radius,
      4.7 - radius * 0.34,
      Math.sin(angle) * radius,
    );
    shrub.scale.y = 0.75 + (index % 4) * 0.08;
    group.add(shrub);
  }
  return group;
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
  };

  const root = new THREE.Group();
  root.name = 'site-model';

  const ground = makeMesh(new THREE.RingGeometry(9.65, 15, 72), materials.soil, 'site-ground');
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 1.18;
  root.add(ground);

  const layers = {
    pit: createPit(materials.soil),
    liner: createLiner(materials.liner),
    gypsum: createTerracedMound(materials.gypsum, 'gypsum-layer'),
    cover: createTerracedMound(materials.cover, 'cover-layer', 0.16, 0.08),
    grass: createTerracedMound(materials.grass, 'grass-layer', 0.24, 0.12),
    shrubs: createShrubs(materials.grass),
  };

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
