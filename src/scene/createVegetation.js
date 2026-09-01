import * as THREE from 'three';
import { TERRAIN_STAGE_IDS, getFootprintDistance, getTerrainHeight } from './terrainProfiles.js';

function seeded(index) {
  const value = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
  return value - Math.floor(value);
}

function createCrossedPlaneGeometry(width = 1, height = 1) {
  const halfWidth = width / 2;
  const positions = [
    -halfWidth, 0, 0, halfWidth, 0, 0, halfWidth, height, 0, -halfWidth, height, 0,
    0, 0, -halfWidth, 0, 0, halfWidth, 0, height, halfWidth, 0, height, -halfWidth,
  ];
  const uvs = [
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ];
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFallbackTexture(color) {
  const rgb = new THREE.Color(color);
  const data = new Uint8Array([
    Math.round(rgb.r * 255),
    Math.round(rgb.g * 255),
    Math.round(rgb.b * 255),
    255,
  ]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function loadSprite(path, fallbackColor, loadImages) {
  if (!loadImages) return createFallbackTexture(fallbackColor);
  const texture = new THREE.TextureLoader().load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCutoutMaterial(texture, color) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.92,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          float channelMax = max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b));
          float channelMin = min(sampledDiffuseColor.r, min(sampledDiffuseColor.g, sampledDiffuseColor.b));
          float saturation = channelMax - channelMin;
          float generatedBackdrop = smoothstep(0.82, 0.96, channelMin) * (1.0 - smoothstep(0.05, 0.13, saturation));
          sampledDiffuseColor.a *= 1.0 - generatedBackdrop;
          diffuseColor *= sampledDiffuseColor;
        #endif
      `,
    );
  };
  material.customProgramCacheKey = () => 'generated-sprite-background-cutout-v1';
  return material;
}

function createInstancedPlants(name, count, geometry, material, placement) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();

  for (let index = 0; index < count; index += 1) {
    const plant = placement(index);
    position.set(plant.x, plant.y, plant.z);
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), plant.rotation);
    scale.set(plant.scaleX, plant.scaleY, plant.scaleX);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function chooseInsidePoint(index, maximumDistance, corridorWidth = 0) {
  let attempt = index * 13 + 5;
  while (true) {
    const x = -8.3 + seeded(attempt) * 16.6;
    const z = -5.9 + seeded(attempt + 1) * 11.8;
    const awayFromCorridor = Math.abs(z - (-2.4 + x * 0.04)) > corridorWidth;
    if (getFootprintDistance(x, z) < maximumDistance && awayFromCorridor) {
      return { x, z, seed: attempt };
    }
    attempt += 17;
  }
}

function chooseForestPoint(index) {
  let attempt = index * 11 + 101;
  while (true) {
    const x = -26 + seeded(attempt) * 52;
    const z = -19 + seeded(attempt + 3) * 13;
    if (getFootprintDistance(x, z) > 1.25) return { x, z, seed: attempt };
    attempt += 19;
  }
}

export function createVegetation(renderer, options = {}) {
  const loadImages = options.loadImages !== false;
  const treeTexture = loadSprite('/assets/terrain/tree-sprite.png', '#426b32', loadImages);
  const shrubTexture = loadSprite('/assets/terrain/shrub-sprite.png', '#4d7336', loadImages);
  const treeMaterial = createCutoutMaterial(treeTexture, '#5f8150');
  const shrubMaterial = createCutoutMaterial(shrubTexture, '#668b4c');
  const grassMaterial = new THREE.MeshStandardMaterial({
    color: '#668746',
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const treeGeometry = createCrossedPlaneGeometry(1.15, 2.35);
  const shrubGeometry = createCrossedPlaneGeometry(1.25, 0.9);
  const grassGeometry = new THREE.ConeGeometry(0.065, 0.28, 3, 1, false);
  grassGeometry.translate(0, 0.14, 0);

  const root = new THREE.Group();
  root.name = 'vegetation-system';
  const distantForest = createInstancedPlants(
    'distant-forest',
    420,
    treeGeometry,
    treeMaterial,
    (index) => {
      const point = chooseForestPoint(index);
      return {
        ...point,
        y: getTerrainHeight('restoration', point.x, point.z) - 0.02,
        rotation: seeded(point.seed + 4) * Math.PI,
        scaleX: 0.45 + seeded(point.seed + 6) * 0.4,
        scaleY: 0.55 + seeded(point.seed + 8) * 0.55,
      };
    },
  );

  const restoration = new THREE.Group();
  restoration.name = 'restoration-vegetation';
  const restorationTrees = createInstancedPlants(
    'restoration-trees',
    56,
    treeGeometry,
    treeMaterial,
    (index) => {
      const point = chooseInsidePoint(index, 0.86, 0.65);
      return {
        ...point,
        y: getTerrainHeight('restoration', point.x, point.z),
        rotation: seeded(point.seed + 2) * Math.PI,
        scaleX: 0.34 + seeded(point.seed + 6) * 0.34,
        scaleY: 0.55 + seeded(point.seed + 8) * 0.62,
      };
    },
  );
  const restorationShrubs = createInstancedPlants(
    'restoration-shrubs',
    136,
    shrubGeometry,
    shrubMaterial,
    (index) => {
      const point = chooseInsidePoint(index + 200, 0.9, 0.42);
      return {
        ...point,
        y: getTerrainHeight('restoration', point.x, point.z) + 0.01,
        rotation: seeded(point.seed + 5) * Math.PI,
        scaleX: 0.32 + seeded(point.seed + 7) * 0.45,
        scaleY: 0.45 + seeded(point.seed + 9) * 0.46,
      };
    },
  );
  const restorationGrass = createInstancedPlants(
    'restoration-grass',
    720,
    grassGeometry,
    grassMaterial,
    (index) => {
      const point = chooseInsidePoint(index + 700, 0.94, 0.25);
      return {
        ...point,
        y: getTerrainHeight('restoration', point.x, point.z) + 0.015,
        rotation: seeded(point.seed + 2) * Math.PI,
        scaleX: 0.65 + seeded(point.seed + 7) * 0.7,
        scaleY: 0.7 + seeded(point.seed + 11) * 0.8,
      };
    },
  );
  restoration.add(restorationGrass, restorationShrubs, restorationTrees);
  root.add(distantForest, restoration);

  function applyStage(stageId) {
    if (!TERRAIN_STAGE_IDS.includes(stageId)) {
      throw new Error(`Unknown terrain stage: ${stageId}`);
    }
    const visible = stageId === 'restoration';
    restoration.visible = visible;
    restorationGrass.visible = visible;
    restorationShrubs.visible = visible;
    restorationTrees.visible = visible;
  }

  function dispose() {
    treeGeometry.dispose();
    shrubGeometry.dispose();
    grassGeometry.dispose();
    treeMaterial.dispose();
    shrubMaterial.dispose();
    grassMaterial.dispose();
    treeTexture.dispose();
    shrubTexture.dispose();
  }

  applyStage('pit');
  return { root, applyStage, dispose };
}
