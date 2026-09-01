const stageConfigs = {
  pit: {
    pit: true,
    liner: false,
    gypsum: false,
    cover: false,
    grass: false,
    shrubs: false,
    targetY: 0,
  },
  liner: {
    pit: true,
    liner: true,
    gypsum: false,
    cover: false,
    grass: false,
    shrubs: false,
    targetY: 0,
  },
  stack: {
    pit: true,
    liner: true,
    gypsum: true,
    cover: false,
    grass: false,
    shrubs: false,
    targetY: 1.25,
  },
  cover: {
    pit: true,
    liner: true,
    gypsum: true,
    cover: true,
    grass: false,
    shrubs: false,
    targetY: 1.35,
  },
  restoration: {
    pit: true,
    liner: true,
    gypsum: true,
    cover: true,
    grass: true,
    shrubs: true,
    targetY: 1.45,
  },
};

export function getStageConfig(stageId) {
  const config = stageConfigs[stageId];
  if (!config) {
    throw new Error(`Unknown stage: ${stageId}`);
  }
  return config;
}

