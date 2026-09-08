import * as THREE from 'three';
import { createTerrainTextureSet } from './createTexture.js';
import {
  TERRAIN_STAGE_IDS,
  getSurfaceMask,
  getTerrainHeight,
} from './terrainProfiles.js';

const WIDTH = 108;
const DEPTH = 90;
const TRANSITION_SECONDS = 0.6;

const vertexShader = `
  #include <fog_pars_vertex>
  attribute float surfaceMask;
  varying vec3 vModelPosition;
  varying vec3 vViewNormal;
  varying float vSurfaceMask;

  void main() {
    vModelPosition = position;
    vViewNormal = normalize(normalMatrix * normal);
    vSurfaceMask = surfaceMask;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = `
  #include <fog_pars_fragment>
  uniform sampler2D uOuterMap;
  uniform sampler2D uInnerMap;
  uniform sampler2D uPreviousInnerMap;
  uniform float uMaterialMix;
  uniform float uStageModelCutout;
  uniform vec3 uSunDirection;
  varying vec3 vModelPosition;
  varying vec3 vViewNormal;
  varying float vSurfaceMask;

  vec3 triplanar(sampler2D map, vec3 point, vec3 normalValue) {
    vec3 weights = pow(abs(normalValue), vec3(4.0));
    weights /= max(weights.x + weights.y + weights.z, 0.0001);
    vec3 xSample = texture2D(map, point.zy * 0.12).rgb;
    vec3 ySample = texture2D(map, point.xz * 0.12).rgb;
    vec3 zSample = texture2D(map, point.xy * 0.12).rgb;
    return xSample * weights.x + ySample * weights.y + zSample * weights.z;
  }

  void main() {
    if (uStageModelCutout > 0.5 && vSurfaceMask > 0.04) discard;
    vec3 normalValue = normalize(vViewNormal);
    vec3 outerColor = triplanar(uOuterMap, vModelPosition, normalValue);
    vec3 previousColor = triplanar(uPreviousInnerMap, vModelPosition, normalValue);
    vec3 innerColor = triplanar(uInnerMap, vModelPosition, normalValue);
    vec3 stageColor = mix(previousColor, innerColor, uMaterialMix);
    vec3 color = mix(outerColor, stageColor, vSurfaceMask);
    float diffuse = max(dot(normalValue, normalize(uSunDirection)), 0.0);
    gl_FragColor = vec4(color * (0.58 + diffuse * 0.62), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function innerTextureForStage(textures, stageId) {
  const textureKeys = {
    pit: 'rock',
    liner: 'liner',
    stack: 'gypsum',
    cover: 'cover',
    restoration: 'grass',
  };
  return textures[textureKeys[stageId]];
}

function buildGrid(segmentsX, segmentsZ) {
  const vertexCount = (segmentsX + 1) * (segmentsZ + 1);
  const positions = new Float32Array(vertexCount * 3);
  const surfaceMasks = new Float32Array(vertexCount);
  const indices = [];

  for (let row = 0; row <= segmentsZ; row += 1) {
    const z = -DEPTH / 2 + (row / segmentsZ) * DEPTH;
    for (let column = 0; column <= segmentsX; column += 1) {
      const x = -WIDTH / 2 + (column / segmentsX) * WIDTH;
      const index = row * (segmentsX + 1) + column;
      positions[index * 3] = x;
      positions[index * 3 + 2] = z;
      surfaceMasks[index] = getSurfaceMask(x, z);
    }
  }

  for (let row = 0; row < segmentsZ; row += 1) {
    for (let column = 0; column < segmentsX; column += 1) {
      const topLeft = row * (segmentsX + 1) + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + segmentsX + 1;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  return { positions, surfaceMasks, indices };
}

export function createUnifiedTerrain(renderer, options = {}) {
  const segmentsX = options.segmentsX ?? 216;
  const segmentsZ = options.segmentsZ ?? 180;
  const { positions, surfaceMasks, indices } = buildGrid(segmentsX, segmentsZ);
  const vertexCount = (segmentsX + 1) * (segmentsZ + 1);
  const heights = Object.fromEntries(TERRAIN_STAGE_IDS.map(stageId => [
    stageId,
    new Float32Array(vertexCount),
  ]));

  for (let index = 0; index < vertexCount; index += 1) {
    const x = positions[index * 3];
    const z = positions[index * 3 + 2];
    TERRAIN_STAGE_IDS.forEach((stageId) => {
      heights[stageId][index] = getTerrainHeight(stageId, x, z);
    });
    positions[index * 3 + 1] = heights.pit[index];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('surfaceMask', new THREE.BufferAttribute(surfaceMasks, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const textures = createTerrainTextureSet(renderer, options);
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uOuterMap: { value: textures.rock },
        uInnerMap: { value: textures.rock },
        uPreviousInnerMap: { value: textures.rock },
        uMaterialMix: { value: 1 },
        uStageModelCutout: { value: 0 },
        uSunDirection: {
          value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize(),
        },
      },
    ]),
    vertexShader,
    fragmentShader,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'unified-terrain';
  mesh.receiveShadow = true;
  mesh.userData.currentStage = 'pit';

  let displayedHeights = heights.pit.slice();
  let transitionFrom = displayedHeights.slice();
  let transitionTarget = heights.pit;
  let transitionElapsed = TRANSITION_SECONDS;
  let materialStage = 'pit';

  function writeDisplayedHeights() {
    const positionAttribute = geometry.attributes.position;
    for (let index = 0; index < vertexCount; index += 1) {
      positionAttribute.setY(index, displayedHeights[index]);
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }

  function applyStage(stageId, stageOptions = {}) {
    if (!heights[stageId]) {
      throw new Error(`Unknown terrain stage: ${stageId}`);
    }

    transitionFrom = displayedHeights.slice();
    transitionTarget = heights[stageId];
    transitionElapsed = stageOptions.immediate === true ? TRANSITION_SECONDS : 0;
    material.uniforms.uPreviousInnerMap.value = innerTextureForStage(textures, materialStage);
    material.uniforms.uInnerMap.value = innerTextureForStage(textures, stageId);
    material.uniforms.uMaterialMix.value = stageOptions.immediate === true ? 1 : 0;
    materialStage = stageId;
    mesh.userData.currentStage = stageId;

    if (stageOptions.immediate === true) {
      displayedHeights = transitionTarget.slice();
      writeDisplayedHeights();
    }
  }

  function update(deltaSeconds) {
    if (transitionElapsed >= TRANSITION_SECONDS) return;
    transitionElapsed = Math.min(TRANSITION_SECONDS, transitionElapsed + deltaSeconds);
    const blend = smoothstep01(transitionElapsed / TRANSITION_SECONDS);
    for (let index = 0; index < vertexCount; index += 1) {
      displayedHeights[index] = transitionFrom[index]
        + (transitionTarget[index] - transitionFrom[index]) * blend;
    }
    material.uniforms.uMaterialMix.value = blend;
    writeDisplayedHeights();
  }

  function sampleHeight(x, z, stageId) {
    if (stageId !== undefined) return getTerrainHeight(stageId, x, z);

    const gridX = Math.max(0, Math.min(segmentsX, ((x + WIDTH / 2) / WIDTH) * segmentsX));
    const gridZ = Math.max(0, Math.min(segmentsZ, ((z + DEPTH / 2) / DEPTH) * segmentsZ));
    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(segmentsX, x0 + 1);
    const z1 = Math.min(segmentsZ, z0 + 1);
    const tx = gridX - x0;
    const tz = gridZ - z0;
    const stride = segmentsX + 1;
    const top = displayedHeights[z0 * stride + x0] * (1 - tx)
      + displayedHeights[z0 * stride + x1] * tx;
    const bottom = displayedHeights[z1 * stride + x0] * (1 - tx)
      + displayedHeights[z1 * stride + x1] * tx;
    return top * (1 - tz) + bottom * tz;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    Object.values(textures).forEach(texture => texture.dispose());
  }

  function setStageModelActive(active) {
    material.uniforms.uStageModelCutout.value = active ? 1 : 0;
  }

  return {
    mesh,
    applyStage,
    update,
    sampleHeight,
    setStageModelActive,
    dispose,
  };
}
