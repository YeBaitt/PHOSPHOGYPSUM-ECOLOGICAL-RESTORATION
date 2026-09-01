import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnifiedTerrain } from '../../src/scene/createUnifiedTerrain.js';

function rendererStub() {
  return { capabilities: { getMaxAnisotropy: () => 4 } };
}

describe('unified terrain', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect() {},
      set fillStyle(value) {},
      set globalAlpha(value) {},
    });
  });

  it('uses one complete indexed grid with no cut-out', () => {
    const terrain = createUnifiedTerrain(rendererStub(), {
      segmentsX: 16,
      segmentsZ: 12,
      loadImages: false,
    });
    expect(terrain.mesh.name).toBe('unified-terrain');
    expect(terrain.mesh.geometry.index.count).toBe(16 * 12 * 6);
    expect(terrain.mesh.geometry.attributes.position.count).toBe(17 * 13);
    terrain.dispose();
  });

  it('moves the same center vertex from pit to stack', () => {
    const terrain = createUnifiedTerrain(rendererStub(), {
      segmentsX: 16,
      segmentsZ: 12,
      loadImages: false,
    });
    const geometry = terrain.mesh.geometry;
    const positions = geometry.attributes.position;
    const centerIndex = 6 * 17 + 8;
    const pitY = positions.getY(centerIndex);

    terrain.applyStage('stack', { immediate: true });

    expect(positions.getY(centerIndex)).toBeGreaterThan(pitY + 3);
    expect(terrain.mesh.geometry).toBe(geometry);
    terrain.dispose();
  });

  it('advances a non-immediate transition through update', () => {
    const terrain = createUnifiedTerrain(rendererStub(), {
      segmentsX: 16,
      segmentsZ: 12,
      loadImages: false,
    });
    terrain.applyStage('stack');
    const before = terrain.sampleHeight(0, 0);
    terrain.update(0.3);
    const middle = terrain.sampleHeight(0, 0);
    terrain.update(0.3);
    const after = terrain.sampleHeight(0, 0);

    expect(middle).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(middle);
    terrain.dispose();
  });

  it('provides the uniforms required by scene fog', () => {
    const terrain = createUnifiedTerrain(rendererStub(), {
      segmentsX: 16,
      segmentsZ: 12,
      loadImages: false,
    });

    expect(terrain.mesh.material.fog).toBe(true);
    expect(terrain.mesh.material.uniforms.fogColor).toBeTruthy();
    expect(terrain.mesh.material.uniforms.fogNear).toBeTruthy();
    expect(terrain.mesh.material.uniforms.fogFar).toBeTruthy();
    terrain.dispose();
  });
});
