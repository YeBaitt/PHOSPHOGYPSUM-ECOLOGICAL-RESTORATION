import { SITE_IDS, STAGE_IDS } from '../data/siteData.js';

export function createDashboardState() {
  return {
    currentSite: 'sanbanhu',
    currentStage: 'pit',
    activeGroup: 0,
    activeSample: 0,
  };
}

export function selectSite(state, siteId) {
  if (!SITE_IDS.includes(siteId)) {
    throw new Error(`Unknown site: ${siteId}`);
  }

  return {
    ...state,
    currentSite: siteId,
    activeGroup: 0,
    activeSample: 0,
  };
}

export function selectStage(state, stageId) {
  if (!STAGE_IDS.includes(stageId)) {
    throw new Error(`Unknown stage: ${stageId}`);
  }

  return {
    ...state,
    currentStage: stageId,
    activeGroup: 0,
    activeSample: 0,
  };
}
