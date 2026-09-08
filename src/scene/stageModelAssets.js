import { clone as cloneSkinnedScene } from 'three/addons/utils/SkeletonUtils.js';
import { TERRAIN_STAGE_IDS } from './terrainProfiles.js';

export const STAGE_MODEL_URLS = Object.freeze(Object.fromEntries(
  TERRAIN_STAGE_IDS.map(stageId => [stageId, `/assets/models/${stageId}.glb`]),
));

function disposeMaterial(material, disposedTextures) {
  Object.values(material).forEach((value) => {
    if (!value?.isTexture || disposedTextures.has(value)) return;
    disposedTextures.add(value);
    value.dispose();
  });
  material.dispose();
}

function disposeScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.filter(Boolean).forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => disposeMaterial(material, textures));
}

export function createStageAssetRepository({ load, warn = console.warn }) {
  const entries = new Map();
  const failedStages = new Set();
  let disposed = false;

  function assertStage(stageId) {
    if (!(stageId in STAGE_MODEL_URLS)) {
      throw new Error(`Unknown model stage: ${stageId}`);
    }
  }

  async function getSource(stageId) {
    assertStage(stageId);
    if (disposed || failedStages.has(stageId)) return null;

    if (!entries.has(stageId)) {
      const entry = { handles: 0, gltf: null, promise: null };
      entry.promise = Promise.resolve(load(STAGE_MODEL_URLS[stageId]))
        .then((gltf) => {
          if (!gltf?.scene) throw new Error('GLB has no scene');
          if (disposed) {
            disposeScene(gltf.scene);
            return null;
          }
          entry.gltf = gltf;
          return gltf;
        })
        .catch((error) => {
          failedStages.add(stageId);
          warn(
            `Stage GLB unavailable (${stageId}); using procedural fallback.`,
            error,
          );
          return null;
        });
      entries.set(stageId, entry);
    }
    return entries.get(stageId).promise;
  }

  async function acquire(stageId) {
    const gltf = await getSource(stageId);
    if (!gltf || disposed) return null;
    const entry = entries.get(stageId);
    entry.handles += 1;
    let released = false;
    return {
      scene: cloneSkinnedScene(gltf.scene),
      release() {
        if (released) return;
        released = true;
        entry.handles = Math.max(0, entry.handles - 1);
      },
    };
  }

  function preloadAll() {
    return Promise.all(TERRAIN_STAGE_IDS.map(getSource));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    entries.forEach((entry) => {
      if (entry.gltf?.scene) disposeScene(entry.gltf.scene);
    });
    entries.clear();
    failedStages.clear();
  }

  return { acquire, preloadAll, dispose };
}
