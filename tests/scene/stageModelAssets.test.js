import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  STAGE_MODEL_URLS,
  createStageAssetRepository,
} from '../../src/scene/stageModelAssets.js';

describe('stage model asset repository', () => {
  it('maps every supported stage to its local GLB', () => {
    expect(STAGE_MODEL_URLS).toEqual({
      pit: '/assets/models/pit.glb',
      liner: '/assets/models/liner.glb',
      stack: '/assets/models/stack.glb',
      cover: '/assets/models/cover.glb',
      restoration: '/assets/models/restoration.glb',
    });
  });

  it('deduplicates concurrent loads and returns independent scene clones', async () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const source = new THREE.Group();
    source.add(new THREE.Mesh(geometry, material));
    const load = vi.fn(async () => ({ scene: source }));
    const repository = createStageAssetRepository({ load });

    const [first, second] = await Promise.all([
      repository.acquire('stack'),
      repository.acquire('stack'),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(first.scene).not.toBe(second.scene);
    expect(first.scene.children[0].geometry).toBe(second.scene.children[0].geometry);
    first.release();
    second.release();
    repository.dispose();
  });

  it('returns null for one failed stage without poisoning other stages', async () => {
    const warn = vi.fn();
    const load = vi.fn(async (url) => {
      if (url.endsWith('/liner.glb')) throw new Error('missing');
      return { scene: new THREE.Group() };
    });
    const repository = createStageAssetRepository({ load, warn });

    expect(await repository.acquire('liner')).toBeNull();
    expect(await repository.acquire('stack')).not.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    repository.dispose();
  });

  it('rejects unsupported stages without invoking the loader', async () => {
    const load = vi.fn();
    const repository = createStageAssetRepository({ load });

    await expect(repository.acquire('unknown')).rejects.toThrow(
      'Unknown model stage: unknown',
    );
    expect(load).not.toHaveBeenCalled();
    repository.dispose();
  });
});
