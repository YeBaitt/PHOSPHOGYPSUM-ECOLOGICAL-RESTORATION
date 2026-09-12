import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteModel } from '../../src/scene/createSiteModel.js';

function rendererStub() {
  return { capabilities: { getMaxAnisotropy: () => 4 } };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('site model GLB integration', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect() {},
      beginPath() {},
      arc() {},
      fill() {},
      set fillStyle(value) {},
      set globalAlpha(value) {},
    });
  });

  it('preserves synchronous stage config while mounting a loaded model', async () => {
    const loadStageGlb = vi.fn(async () => ({ scene: new THREE.Group() }));
    const model = createSiteModel(rendererStub(), {
      loadImages: false,
      segmentsX: 8,
      segmentsZ: 6,
      loadStageGlb,
      preloadStageModels: false,
    });

    const config = model.applyStage('stack');
    await vi.waitFor(() => {
      expect(model.root.getObjectByName('stage-glb-stack')).toBeTruthy();
    });

    expect(config.targetY).toBe(1.25);
    expect(loadStageGlb).toHaveBeenCalledWith('/assets/models/stack.glb');
    expect(model.root.getObjectByName('procedural-site-fallback').visible).toBe(true);
    model.update(0.25);
    expect(model.root.getObjectByName('procedural-site-fallback').visible).toBe(true);
    expect(model.root.getObjectByName('unified-terrain').visible).toBe(true);
    expect(model.root.getObjectByName('distant-forest').visible).toBe(true);
    expect(model.root.getObjectByName('engineering-details').visible).toBe(false);
    expect(
      model.root.getObjectByName('unified-terrain').material.uniforms.uStageModelCutout.value,
    ).toBe(1);
    model.dispose();
  });

  it('keeps the procedural stage visible when its GLB fails', async () => {
    const model = createSiteModel(rendererStub(), {
      loadImages: false,
      segmentsX: 8,
      segmentsZ: 6,
      loadStageGlb: async () => { throw new Error('missing'); },
      preloadStageModels: false,
      warn: vi.fn(),
    });

    model.applyStage('liner');
    await flushPromises();

    expect(model.root.getObjectByName('procedural-site-fallback').visible).toBe(true);
    expect(model.root.getObjectByName('unified-terrain').userData.currentStage).toBe('liner');
    model.dispose();
  });
});
