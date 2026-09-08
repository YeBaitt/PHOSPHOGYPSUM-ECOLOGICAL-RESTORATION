import * as THREE from 'three';

const FADE_SECONDS = 0.25;
const STAGE_FALLBACK_COLORS = Object.freeze({
  pit: '#655f55',
  liner: '#22292c',
  stack: '#c9c8c1',
  cover: '#756957',
  restoration: '#647653',
});

function forEachMaterial(scene, callback) {
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach(callback);
  });
}

function normalizeScene(scene, stageId) {
  scene.name = `stage-glb-${stageId}`;
  scene.scale.setScalar(0.185);
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (!object.material) {
      object.material = new THREE.MeshStandardMaterial({
        color: STAGE_FALLBACK_COLORS[stageId],
        roughness: 0.94,
      });
    } else if (Array.isArray(object.material)) {
      object.material = object.material.map(material => material.clone());
    } else {
      object.material = object.material.clone();
    }
  });
  return scene;
}

function prepareFade(scene) {
  forEachMaterial(scene, (material) => {
    material.userData.stageOriginalOpacity = material.opacity;
    material.userData.stageOriginalTransparent = material.transparent;
    material.transparent = true;
    material.opacity = 0;
    material.needsUpdate = true;
  });
}

function applyFade(scene, progress) {
  forEachMaterial(scene, (material) => {
    const target = material.userData.stageOriginalOpacity ?? 1;
    material.opacity = target * progress;
    if (progress >= 1) {
      material.transparent = material.userData.stageOriginalTransparent ?? false;
      delete material.userData.stageOriginalOpacity;
      delete material.userData.stageOriginalTransparent;
      material.needsUpdate = true;
    }
  });
}

function disposeInstanceMaterials(scene) {
  const materials = new Set();
  forEachMaterial(scene, material => materials.add(material));
  materials.forEach(material => material.dispose());
}

export function createStageModelLoader(repository, proceduralFallback) {
  const root = new THREE.Group();
  root.name = 'stage-model-loader';
  root.add(proceduralFallback);

  let currentStage = 'pit';
  let requestToken = 0;
  let active = null;
  let fadeElapsed = FADE_SECONDS;
  let disposed = false;

  function removeActive() {
    if (!active) return;
    root.remove(active.scene);
    disposeInstanceMaterials(active.scene);
    active.release();
    active = null;
  }

  function applyStage(stageId) {
    currentStage = stageId;
    requestToken += 1;
    const token = requestToken;
    removeActive();
    proceduralFallback.visible = true;

    repository.acquire(stageId).then((handle) => {
      if (!handle) return;
      if (disposed || token !== requestToken || stageId !== currentStage) {
        handle.release();
        return;
      }
      const scene = normalizeScene(handle.scene, stageId);
      prepareFade(scene);
      active = { ...handle, scene };
      fadeElapsed = 0;
      root.add(scene);
    });
  }

  function update(deltaSeconds) {
    if (!active || fadeElapsed >= FADE_SECONDS) return;
    fadeElapsed = Math.min(FADE_SECONDS, fadeElapsed + deltaSeconds);
    const progress = fadeElapsed / FADE_SECONDS;
    applyFade(active.scene, progress);
    if (progress >= 1) proceduralFallback.visible = false;
  }

  function preload() {
    return repository.preloadAll();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    requestToken += 1;
    removeActive();
    root.remove(proceduralFallback);
  }

  return { root, applyStage, preload, update, dispose };
}
