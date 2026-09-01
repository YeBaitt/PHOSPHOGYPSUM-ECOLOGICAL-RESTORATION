import * as THREE from 'three';
import { createEngineeringDetails } from './createEngineeringDetails.js';
import { getStageConfig } from './stageConfig.js';
import { createUnifiedTerrain } from './createUnifiedTerrain.js';
import { createVegetation } from './createVegetation.js';

export function createSiteModel(renderer, options = {}) {
  const terrain = createUnifiedTerrain(renderer, options);
  const engineering = createEngineeringDetails();
  const vegetation = createVegetation(renderer, options);

  const root = new THREE.Group();
  root.name = 'site-model';
  root.add(terrain.mesh, engineering.root, vegetation.root);

  function applyStage(stageId) {
    const config = getStageConfig(stageId);
    terrain.applyStage(stageId);
    engineering.applyStage(stageId);
    vegetation.applyStage(stageId);
    root.userData.currentStage = stageId;
    return config;
  }

  function update(deltaSeconds) {
    terrain.update(deltaSeconds);
  }

  function dispose() {
    terrain.dispose();
    engineering.dispose();
    vegetation.dispose();
  }

  root.userData.currentStage = 'pit';
  return { root, applyStage, update, dispose };
}
