import { describe, expect, it, vi } from 'vitest';
import { getStageConfig } from '../../src/scene/stageConfig.js';
import { createSiteModel } from '../../src/scene/createSiteModel.js';
import { createAssetTexture } from '../../src/scene/createTexture.js';
import {
  createEngineeringDetails,
  createTerrainRibbon,
} from '../../src/scene/createEngineeringDetails.js';
import { getTerrainHeight } from '../../src/scene/terrainProfiles.js';
import { createVegetation } from '../../src/scene/createVegetation.js';

function rendererStub() {
  return { capabilities: { getMaxAnisotropy: () => 4 } };
}

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

  it('composes one terrain without independent ground or pit meshes', () => {
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
    const model = createSiteModel(renderer, { loadImages: false });

    expect(model.root.getObjectByName('unified-terrain')).toBeTruthy();
    expect(model.root.getObjectByName('site-ground')).toBeUndefined();
    expect(model.root.getObjectByName('pit-wall')).toBeUndefined();
    expect(
      model.root.children.filter(child => child.name === 'unified-terrain'),
    ).toHaveLength(1);
    model.dispose();
  });

  it('routes stage and time updates to the composed scene systems', () => {
    const context = {
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      set fillStyle(value) {},
      set globalAlpha(value) {},
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const model = createSiteModel(rendererStub(), { loadImages: false });
    model.applyStage('restoration');
    model.update(0.6);

    expect(model.root.getObjectByName('restoration-trees').visible).toBe(true);
    expect(model.root.getObjectByName('unified-terrain').userData.currentStage)
      .toBe('restoration');
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
    const model = createSiteModel(rendererStub(), { loadImages: false });

    const expectedDetails = {
      'liner-seams': 'liner-details',
      'drainage-pipe': 'liner-details',
      'haul-road': 'stack-details',
      'cover-tracks': 'cover-details',
      'restoration-trees': 'restoration-vegetation',
    };

    Object.entries(expectedDetails).forEach(([detailName, layerName]) => {
      const detail = model.root.getObjectByName(detailName);
      expect(detail, `${detailName} should exist`).toBeTruthy();
      expect(detail.parent?.name).toBe(layerName);
    });
    model.dispose();
  });
});

describe('terrain-following engineering details', () => {
  it('places every ribbon vertex immediately above its stage terrain', () => {
    const ribbon = createTerrainRibbon([
      { x: -4, z: -2 },
      { x: 0, z: 0 },
      { x: 4, z: 2 },
    ], 0.5, 'stack');
    const positions = ribbon.attributes.position;

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const clearance = y - getTerrainHeight('stack', x, z);
      expect(clearance).toBeGreaterThanOrEqual(0.025);
      expect(clearance).toBeLessThan(0.06);
    }
    ribbon.dispose();
  });

  it('organizes visible details by restoration stage', () => {
    const details = createEngineeringDetails();
    expect(details.root.getObjectByName('site-infrastructure')).toBeTruthy();
    expect(details.root.getObjectByName('liner-seams').parent.name).toBe('liner-details');
    expect(details.root.getObjectByName('haul-road').parent.name).toBe('stack-details');
    expect(details.root.getObjectByName('cover-tracks').parent.name).toBe('cover-details');

    details.applyStage('stack');
    expect(details.root.getObjectByName('liner-details').visible).toBe(false);
    expect(details.root.getObjectByName('stack-details').visible).toBe(true);
    details.dispose();
  });
});

describe('natural vegetation', () => {
  it('uses instanced, irregular restoration vegetation', () => {
    const vegetation = createVegetation(rendererStub(), { loadImages: false });
    const trees = vegetation.root.getObjectByName('restoration-trees');
    const forest = vegetation.root.getObjectByName('distant-forest');

    expect(trees.isInstancedMesh).toBe(true);
    expect(forest.isInstancedMesh).toBe(true);
    expect(trees.count).toBeGreaterThan(40);
    expect(forest.count).toBeGreaterThan(300);

    vegetation.applyStage('pit');
    expect(trees.visible).toBe(false);
    vegetation.applyStage('restoration');
    expect(trees.visible).toBe(true);
    vegetation.dispose();
  });
});
