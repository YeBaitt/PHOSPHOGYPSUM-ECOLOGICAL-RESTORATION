export const TERRAIN_STAGE_IDS = [
  'pit',
  'liner',
  'stack',
  'cover',
  'restoration',
];

const clamp01 = value => Math.max(0, Math.min(1, value));

function smoothstep(from, to, value) {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function terrainNoise(x, z) {
  return Math.sin(x * 0.31 + z * 0.17) * 0.08
    + Math.cos(z * 0.43 - x * 0.11) * 0.05;
}

export function getFootprintDistance(x, z) {
  const angle = Math.atan2(z, x);
  const boundary = 1
    + Math.sin(angle * 3 + 0.6) * 0.055
    + Math.sin(angle * 7 - 0.4) * 0.035;
  return Math.hypot((x + 0.25) / 8.6, (z - 0.1) / 6.35) / boundary;
}

export function getSurfaceMask(x, z) {
  return 1 - smoothstep(0.86, 1.08, getFootprintDistance(x, z));
}

function getPitHeight(distance, outerHeight) {
  const floorHeight = -3.25 + outerHeight * 0.35;
  return floorHeight + (outerHeight - floorHeight) * smoothstep(0.62, 1.08, distance);
}

function getStackHeight(distance, outerHeight) {
  return outerHeight
    + 1.3 * (1 - smoothstep(0.28, 0.34, distance))
    + 1.1 * (1 - smoothstep(0.48, 0.54, distance))
    + 1.0 * (1 - smoothstep(0.68, 0.74, distance))
    + 1.3 * (1 - smoothstep(0.86, 1.08, distance));
}

export function getTerrainHeight(stageId, x, z) {
  if (!TERRAIN_STAGE_IDS.includes(stageId)) {
    throw new Error(`Unknown terrain stage: ${stageId}`);
  }

  const distance = getFootprintDistance(x, z);
  const outerHeight = terrainNoise(x, z);

  if (stageId === 'pit' || stageId === 'liner') {
    return getPitHeight(distance, outerHeight);
  }

  const stackHeight = getStackHeight(distance, outerHeight);
  if (stageId === 'stack') return stackHeight;

  const coverLift = getSurfaceMask(x, z) * 0.12;
  if (stageId === 'cover') return stackHeight + coverLift;

  return stackHeight + coverLift + getSurfaceMask(x, z) * 0.18;
}
