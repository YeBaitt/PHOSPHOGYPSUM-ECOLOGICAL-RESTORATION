import { describe, expect, it } from 'vitest';
import {
  createDashboardState,
  selectSite,
  selectStage,
} from '../../src/state/dashboardState.js';

describe('dashboard state', () => {
  it('starts at 三板湖 and 原始基坑', () => {
    expect(createDashboardState()).toEqual({
      currentSite: 'sanbanhu',
      currentStage: 'pit',
      activeGroup: 0,
      activeSample: 0,
    });
  });

  it('keeps the current stage when the site changes', () => {
    const state = {
      currentSite: 'sanbanhu',
      currentStage: 'cover',
      activeGroup: 1,
      activeSample: 1,
    };

    expect(selectSite(state, 'dongxiquan')).toEqual({
      currentSite: 'dongxiquan',
      currentStage: 'cover',
      activeGroup: 0,
      activeSample: 0,
    });
  });

  it('resets sample selection when the stage changes', () => {
    const state = {
      currentSite: 'sanbanhu',
      currentStage: 'stack',
      activeGroup: 1,
      activeSample: 1,
    };

    expect(selectStage(state, 'restoration')).toEqual({
      currentSite: 'sanbanhu',
      currentStage: 'restoration',
      activeGroup: 0,
      activeSample: 0,
    });
  });

  it('rejects unknown site and stage identifiers', () => {
    const state = createDashboardState();
    expect(() => selectSite(state, 'other')).toThrow('Unknown site: other');
    expect(() => selectStage(state, 'other')).toThrow('Unknown stage: other');
  });
});
