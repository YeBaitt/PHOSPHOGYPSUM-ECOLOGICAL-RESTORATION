import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createEngineeringDetails } from './createEngineeringDetails.js';
import { createStageModelLoader } from './createStageModelLoader.js';
import { getStageConfig } from './stageConfig.js';
import { createStageAssetRepository } from './stageModelAssets.js';
import { createUnifiedTerrain } from './createUnifiedTerrain.js';
import { createVegetation } from './createVegetation.js';

export function createSiteModel(renderer, options = {}) {
  const terrain = createUnifiedTerrain(renderer, options);
  const engineering = createEngineeringDetails();
  const vegetation = createVegetation(renderer, options);

  const proceduralRoot = new THREE.Group();
  proceduralRoot.name = 'procedural-site-fallback';
  proceduralRoot.add(terrain.mesh, engineering.root, vegetation.root);

  const gltfLoader = options.loadStageGlb ? null : new GLTFLoader();
  const loadStageGlb = options.loadStageGlb
    ?? (url => gltfLoader.loadAsync(url));
  const repository = createStageAssetRepository({
    load: loadStageGlb,
    warn: options.warn,
  });
  const stageModels = createStageModelLoader(repository, proceduralRoot);

  const root = new THREE.Group();
  root.name = 'site-model';
  root.add(stageModels.root);

  function applyStage(stageId) {
    const config = getStageConfig(stageId);
    terrain.applyStage(stageId);
    engineering.applyStage(stageId);
    vegetation.applyStage(stageId);
    stageModels.applyStage(stageId);
    root.userData.currentStage = stageId;
    return config;
  }

  function update(deltaSeconds) {
    terrain.update(deltaSeconds);
    stageModels.update(deltaSeconds);
  }

  function dispose() {
    stageModels.dispose();
    repository.dispose();
    terrain.dispose();
    engineering.dispose();
    vegetation.dispose();
  }

  if (options.preloadStageModels !== false) stageModels.preload();
  root.userData.currentStage = 'pit';
  return { root, applyStage, update, dispose };
}
