import { describe, expect, it } from 'vitest';
import {
  TERRAIN_STAGE_IDS,
  getFootprintDistance,
  getSurfaceMask,
  getTerrainHeight,
} from '../../src/scene/terrainProfiles.js';

describe('terrain profiles', () => {
  it('keeps the outer landscape unchanged between stages', () => {
    const heights = TERRAIN_STAGE_IDS.map(stageId => getTerrainHeight(stageId, 18, 0));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.001);
  });

  it('forms a pit first and a raised stack later', () => {
    expect(getTerrainHeight('pit', 0, 0)).toBeLessThan(-2);
    expect(getTerrainHeight('liner', 0, 0)).toBeLessThan(-2);
    expect(getTerrainHeight('stack', 0, 0)).toBeGreaterThan(1.4);
    expect(getTerrainHeight('cover', 0, 0)).toBeGreaterThan(
      getTerrainHeight('stack', 0, 0),
    );
  });

  it('changes continuously across the pit rim', () => {
    const justInside = getTerrainHeight('pit', 8.55, 0);
    const justOutside = getTerrainHeight('pit', 8.7, 0);
    expect(Math.abs(justInside - justOutside)).toBeLessThan(0.25);
  });

  it('returns an irregular footprint and bounded material mask', () => {
    expect(getFootprintDistance(7.5, 0)).not.toBeCloseTo(
      getFootprintDistance(0, 7.5),
      2,
    );
    expect(getSurfaceMask(0, 0)).toBe(1);
    expect(getSurfaceMask(20, 0)).toBe(0);
  });

  it('rejects an unknown terrain stage', () => {
    expect(() => getTerrainHeight('other', 0, 0)).toThrow(
      'Unknown terrain stage: other',
    );
  });
});
