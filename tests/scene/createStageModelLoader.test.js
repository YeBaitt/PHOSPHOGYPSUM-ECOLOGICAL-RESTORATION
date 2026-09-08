import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createStageModelLoader } from '../../src/scene/createStageModelLoader.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('stage model loader', () => {
  it('keeps procedural fallback visible until the selected GLB fades in', async () => {
    const request = deferred();
    const fallback = new THREE.Group();
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const loader = createStageModelLoader({ acquire: () => request.promise }, fallback);

    loader.applyStage('stack');
    expect(fallback.visible).toBe(true);
    request.resolve({ scene, release() {} });
    await flushPromises();

    expect(fallback.visible).toBe(true);
    expect(loader.root.getObjectByName('stage-glb-stack')).toBeTruthy();
    loader.update(0.25);
    expect(fallback.visible).toBe(false);
  });

  it('ignores and releases a late result from an older stage selection', async () => {
    const pit = deferred();
    const stack = deferred();
    const releasePit = vi.fn();
    const fallback = new THREE.Group();
    const loader = createStageModelLoader({
      acquire: stage => (stage === 'pit' ? pit.promise : stack.promise),
    }, fallback);

    loader.applyStage('pit');
    loader.applyStage('stack');
    stack.resolve({ scene: new THREE.Group(), release() {} });
    await flushPromises();
    pit.resolve({ scene: new THREE.Group(), release: releasePit });
    await flushPromises();

    expect(loader.root.getObjectByName('stage-glb-stack')).toBeTruthy();
    expect(loader.root.getObjectByName('stage-glb-pit')).toBeFalsy();
    expect(releasePit).toHaveBeenCalledTimes(1);
  });

  it('keeps fallback visible when acquisition fails', async () => {
    const fallback = new THREE.Group();
    const loader = createStageModelLoader({ acquire: async () => null }, fallback);

    loader.applyStage('liner');
    await flushPromises();

    expect(fallback.visible).toBe(true);
    expect(loader.root.children).toHaveLength(1);
  });

  it('releases the active model during disposal', async () => {
    const release = vi.fn();
    const fallback = new THREE.Group();
    const loader = createStageModelLoader({
      acquire: async () => ({ scene: new THREE.Group(), release }),
    }, fallback);
    loader.applyStage('cover');
    await flushPromises();

    loader.dispose();

    expect(release).toHaveBeenCalledTimes(1);
    expect(loader.root.children).toHaveLength(0);
  });
});
