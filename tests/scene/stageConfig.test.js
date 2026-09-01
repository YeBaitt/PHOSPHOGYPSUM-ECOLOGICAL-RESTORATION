import { describe, expect, it, vi } from 'vitest';
import { getStageConfig } from '../../src/scene/stageConfig.js';
import { createSiteModel } from '../../src/scene/createSiteModel.js';

describe('stage configuration', () => {
  it('progresses from an exposed pit to restored vegetation', () => {
    expect(getStageConfig('pit')).toMatchObject({
      liner: false,
      gypsum: false,
      cover: false,
      grass: false,
    });
    expect(getStageConfig('liner')).toMatchObject({ liner: true, gypsum: false });
    expect(getStageConfig('stack')).toMatchObject({ gypsum: true, cover: false });
    expect(getStageConfig('cover')).toMatchObject({ cover: true, grass: false });
    expect(getStageConfig('restoration')).toMatchObject({
      cover: true,
      grass: true,
      shrubs: true,
    });
  });

  it('rejects an unknown stage', () => {
    expect(() => getStageConfig('other')).toThrow('Unknown stage: other');
  });
});

describe('site model', () => {
  it('applies stage visibility to the real model layers', () => {
    const context = {
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      set fillStyle(value) {},
      set globalAlpha(value) {},
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 4 },
    };
    const model = createSiteModel(renderer);

    model.applyStage('restoration');

    expect(model.root.getObjectByName('liner-layer').visible).toBe(true);
    expect(model.root.getObjectByName('grass-layer').visible).toBe(true);
    expect(model.root.getObjectByName('shrubs-layer').visible).toBe(true);
    model.dispose();
  });

  it('uses a wider pit rim than floor and a shaped ground opening', () => {
    const context = {
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      set fillStyle(value) {},
      set globalAlpha(value) {},
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const model = createSiteModel({
      capabilities: { getMaxAnisotropy: () => 4 },
    });
    const pitWall = model.root.getObjectByName('pit-wall');
    const ground = model.root.getObjectByName('site-ground');

    expect(pitWall.geometry.parameters.radiusTop).toBeGreaterThan(
      pitWall.geometry.parameters.radiusBottom,
    );
    expect(ground.geometry.type).toBe('ShapeGeometry');
    model.dispose();
  });
});
