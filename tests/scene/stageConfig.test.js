import { describe, expect, it, vi } from 'vitest';
import { getStageConfig } from '../../src/scene/stageConfig.js';
import { createSiteModel } from '../../src/scene/createSiteModel.js';
import { createAssetTexture } from '../../src/scene/createTexture.js';

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
  it('configures resilient local textures for every terrain material', () => {
    const context = {
      fillRect: vi.fn(),
      set fillStyle(value) {},
      set globalAlpha(value) {},
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const renderer = { capabilities: { getMaxAnisotropy: () => 16 } };

    const expectedPaths = {
      rock: '/assets/terrain/rock-soil.png',
      liner: '/assets/terrain/geomembrane.png',
      gypsum: '/assets/terrain/phosphogypsum.png',
      cover: '/assets/terrain/topsoil.png',
      grass: '/assets/terrain/vegetation.png',
    };

    Object.entries(expectedPaths).forEach(([kind, assetPath]) => {
      const texture = createAssetTexture(kind, renderer, { loadImage: false });
      expect(texture.userData.assetPath).toBe(assetPath);
      expect(texture.wrapS).toBe(texture.wrapT);
      expect(texture.colorSpace).toBe('srgb');
      texture.dispose();
    });
    expect(() => createAssetTexture('other', renderer, { loadImage: false }))
      .toThrow('Unknown asset texture: other');
  });

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

  it('uses an asymmetric terrain wall instead of a regular cylinder', () => {
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
    const positions = pitWall.geometry.attributes.position;
    const rimRadii = [];

    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) > -0.1) {
        rimRadii.push(Math.hypot(positions.getX(index), positions.getZ(index)));
      }
    }

    expect(pitWall.geometry.type).toBe('BufferGeometry');
    expect(pitWall.geometry.parameters?.radiusTop).toBeUndefined();
    expect(Math.max(...rimRadii) - Math.min(...rimRadii)).toBeGreaterThan(0.5);
    expect(ground.geometry.type).toBe('ShapeGeometry');
    model.dispose();
  });

  it('includes the engineering cues that distinguish all five stages', () => {
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

    const expectedDetails = {
      'liner-seams': 'liner-layer',
      'drainage-pipe': 'liner-layer',
      'haul-road': 'gypsum-layer',
      'cover-tracks': 'cover-layer',
      'restoration-trees': 'shrubs-layer',
    };

    Object.entries(expectedDetails).forEach(([detailName, layerName]) => {
      const detail = model.root.getObjectByName(detailName);
      expect(detail, `${detailName} should exist`).toBeTruthy();
      expect(detail.parent?.name).toBe(layerName);
    });
    model.dispose();
  });
});
