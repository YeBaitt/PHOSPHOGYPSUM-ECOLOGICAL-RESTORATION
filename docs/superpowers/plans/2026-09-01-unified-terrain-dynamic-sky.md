# Unified Terrain and Dynamic Sky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the layered, gap-prone site model with one continuous five-stage terrain mesh and replace the static CSS horizon with a real Three.js sky dome containing slowly moving procedural clouds.

**Architecture:** Pure terrain profile functions define the shared irregular footprint and five height states. One indexed terrain mesh owns every ground, pit, and stack vertex; its height buffer and triplanar stage material update without creating another canvas. Separate lightweight modules attach height-sampled engineering details and instanced vegetation, while a shader sky dome updates from the existing render loop.

**Tech Stack:** Vite, plain JavaScript ES modules, Three.js, GLSL shader strings, Vitest, jsdom, local PNG textures

**Spec:** `docs/superpowers/specs/2026-09-01-unified-terrain-dynamic-sky-design.md`

## Global Constraints

- Preserve the existing UI layout, report data, site IDs, stage IDs, and missing-value behavior.
- Both sites continue to share one illustrative model labeled “示意模型，非真实地形复原”.
- Keep orbit rotation and wheel zoom; keep pan and walkthrough disabled.
- Runtime assets remain local and texture failures retain a readable fallback.
- The terrain is one indexed mesh with no ground hole and no independent pit-wall mesh.
- The sky is a Three.js object with time-based clouds; remove the CSS `site-horizon.png` background reference.
- Optimize for a 1920×1080 desktop browser and target at least 30 FPS on a recent integrated GPU.
- Use instancing for repeated vegetation and rocks; do not add volumetric clouds, weather, rain, or a day/night system.
- Follow strict red-green-refactor TDD for every production-code task.

## File Map

```text
src/scene/terrainProfiles.js             Pure footprint, distance, surface-zone, and five-stage height functions
src/scene/createUnifiedTerrain.js        Indexed grid, cached height states, triplanar terrain material, transitions
src/scene/createDynamicSky.js             Shader sky dome and animated cloud uniforms
src/scene/createEngineeringDetails.js     Terrain-following road, seams, drainage pipe, channel, and tracks
src/scene/createVegetation.js             Instanced grass, shrubs, young trees, and distant forest sprites
src/scene/createSiteModel.js              Composition, stage routing, update, and disposal
src/scene/createScene.js                  Renderer loop, camera, lighting, sky/model updates
src/scene/createTexture.js                Existing local albedo and fallback texture loader
src/styles.css                            Remove static horizon image, retain neutral fallback color
public/assets/terrain/tree-sprite.png     Transparent realistic conifer/mixed-tree sprite
public/assets/terrain/shrub-sprite.png    Transparent irregular shrub sprite
tests/scene/terrainProfiles.test.js       Pure profile and continuity behavior
tests/scene/createUnifiedTerrain.test.js  Single-mesh topology and transition behavior
tests/scene/dynamicSky.test.js            Time-driven sky behavior
tests/scene/stageConfig.test.js           Integrated model stages and engineering cues
tests/scene/createScene.test.js            Existing WebGL boundary regression
```

---

### Task 1: Continuous Five-Stage Terrain Profiles

**Files:**
- Create: `src/scene/terrainProfiles.js`
- Create: `tests/scene/terrainProfiles.test.js`

**Interfaces:**
- Produces `TERRAIN_STAGE_IDS` as `['pit', 'liner', 'stack', 'cover', 'restoration']`.
- Produces `getFootprintDistance(x, z): number`, where values below `1` are inside the irregular site footprint.
- Produces `getTerrainHeight(stageId, x, z): number`.
- Produces `getSurfaceMask(x, z): number`, clamped to `0..1`, for outside/inside material blending.
- Unknown stage IDs throw `Unknown terrain stage: <id>`.

- [ ] **Step 1: Write failing profile tests**

Create literal, hand-checked expectations:

```js
import { describe, expect, it } from 'vitest';
import {
  TERRAIN_STAGE_IDS,
  getFootprintDistance,
  getSurfaceMask,
  getTerrainHeight,
} from '../../src/scene/terrainProfiles.js';

describe('terrain profiles', () => {
  it('keeps the outer landscape unchanged between stages', () => {
    const heights = TERRAIN_STAGE_IDS.map((stageId) => getTerrainHeight(stageId, 18, 0));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.001);
  });

  it('forms a pit first and a raised stack later', () => {
    expect(getTerrainHeight('pit', 0, 0)).toBeLessThan(-2);
    expect(getTerrainHeight('liner', 0, 0)).toBeLessThan(-2);
    expect(getTerrainHeight('stack', 0, 0)).toBeGreaterThan(1.4);
    expect(getTerrainHeight('cover', 0, 0)).toBeGreaterThan(getTerrainHeight('stack', 0, 0));
  });

  it('changes continuously across the pit rim', () => {
    const justInside = getTerrainHeight('pit', 8.55, 0);
    const justOutside = getTerrainHeight('pit', 8.7, 0);
    expect(Math.abs(justInside - justOutside)).toBeLessThan(0.25);
  });

  it('returns an irregular footprint and bounded material mask', () => {
    expect(getFootprintDistance(7.5, 0)).not.toBeCloseTo(getFootprintDistance(0, 7.5), 2);
    expect(getSurfaceMask(0, 0)).toBe(1);
    expect(getSurfaceMask(20, 0)).toBe(0);
  });

  it('rejects an unknown terrain stage', () => {
    expect(() => getTerrainHeight('other', 0, 0)).toThrow('Unknown terrain stage: other');
  });
});
```

- [ ] **Step 2: Run RED**

Run `npm test -- tests/scene/terrainProfiles.test.js`.

Expected: FAIL because `src/scene/terrainProfiles.js` does not exist.

- [ ] **Step 3: Implement deterministic continuous profiles**

Create `terrainProfiles.js` with:

```js
const clamp01 = value => Math.max(0, Math.min(1, value));
const smoothstep = (from, to, value) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

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
```

Use the same `distance = getFootprintDistance(x, z)` for every stage. Build the outer height from `terrainNoise`. For `pit` and `liner`, blend from outer height at distance `1.08` to a floor below `-2` at distance `0.62`. For stack stages, use four continuous bands with plateaus at normalized distances `0.28`, `0.48`, `0.68`, and `0.86`; use `smoothstep` on each connecting slope. Add `0.12` to cover and `0.18` to restoration only inside the footprint. Keep noise amplitude below `0.1`.

- [ ] **Step 4: Run GREEN and full regression**

Run `npm test -- tests/scene/terrainProfiles.test.js` and then `npm test`.

Expected: the new tests pass and the existing 21 tests remain green.

- [ ] **Step 5: Commit**

```powershell
git add src/scene/terrainProfiles.js tests/scene/terrainProfiles.test.js
git commit -m "feat: define continuous terrain stage profiles"
```

---

### Task 2: One Indexed Terrain Mesh and Stage Transitions

**Files:**
- Create: `src/scene/createUnifiedTerrain.js`
- Create: `tests/scene/createUnifiedTerrain.test.js`
- Modify: `src/scene/createTexture.js`

**Interfaces:**
- `createUnifiedTerrain(renderer, options?)` returns `{ mesh, applyStage(stageId, options?), update(deltaSeconds), sampleHeight(x, z, stageId?), dispose() }`.
- `mesh.name` is `unified-terrain`; it uses one indexed `THREE.BufferGeometry` covering `56×42` model units.
- Default grid is `160×120`; tests may pass `{ segmentsX: 16, segmentsZ: 12, loadImages: false }`.
- `applyStage(stageId, { immediate: true })` updates every vertex immediately; omission starts a 0.6-second interpolation.

- [ ] **Step 1: Write failing topology and transition tests**

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnifiedTerrain } from '../../src/scene/createUnifiedTerrain.js';

function rendererStub() {
  return { capabilities: { getMaxAnisotropy: () => 4 } };
}

describe('unified terrain', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect() {}, set fillStyle(value) {}, set globalAlpha(value) {},
    });
  });

  it('uses one complete indexed grid with no cut-out', () => {
    const terrain = createUnifiedTerrain(rendererStub(), {
      segmentsX: 16, segmentsZ: 12, loadImages: false,
    });
    expect(terrain.mesh.name).toBe('unified-terrain');
    expect(terrain.mesh.geometry.index.count).toBe(16 * 12 * 6);
    expect(terrain.mesh.geometry.attributes.position.count).toBe(17 * 13);
    terrain.dispose();
  });

  it('moves the same center vertex from pit to stack', () => {
    const terrain = createUnifiedTerrain(rendererStub(), {
      segmentsX: 16, segmentsZ: 12, loadImages: false,
    });
    const geometry = terrain.mesh.geometry;
    const positionObject = geometry.attributes.position;
    const centerIndex = 6 * 17 + 8;
    const pitY = positionObject.getY(centerIndex);
    terrain.applyStage('stack', { immediate: true });
    expect(positionObject.getY(centerIndex)).toBeGreaterThan(pitY + 3);
    expect(terrain.mesh.geometry).toBe(geometry);
    terrain.dispose();
  });

  it('advances a non-immediate transition through update', () => {
    const terrain = createUnifiedTerrain(rendererStub(), {
      segmentsX: 16, segmentsZ: 12, loadImages: false,
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
});
```

- [ ] **Step 2: Run RED**

Run `npm test -- tests/scene/createUnifiedTerrain.test.js`.

Expected: FAIL because the unified terrain module is missing.

- [ ] **Step 3: Build the complete indexed grid**

Create vertices in row-major order from `x=-28..28` and `z=-21..21`. Add exactly two triangles per cell:

```js
indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
```

Precompute five `Float32Array` height buffers using `getTerrainHeight`. The initial `pit` buffer populates the Y component. `applyStage` records the current displayed heights as transition origins and selects the cached target. `update` uses `smoothstep(0, 1, elapsed / 0.6)` and recomputes normals while transitioning. `sampleHeight` uses the analytic profile for an explicit stage and bilinear interpolation of displayed mesh heights otherwise.

Every successful `applyStage` also writes the requested stage ID to `mesh.userData.currentStage`, including while a visual interpolation is in progress.

- [ ] **Step 4: Implement triplanar stage material**

Extend `createTexture.js` with `createTerrainTextureSet(renderer, { loadImages })`, returning `rock`, `liner`, `gypsum`, `cover`, and `grass` textures. In `createUnifiedTerrain.js`, create a `THREE.ShaderMaterial` with uniforms:

```js
{
  uOuterMap: { value: textures.rock },
  uInnerMap: { value: textures.rock },
  uPreviousInnerMap: { value: textures.rock },
  uMaterialMix: { value: 1 },
  uSunDirection: { value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize() },
}
```

The vertex shader passes model position, normalized transformed normal, and `getSurfaceMask` as a `surfaceMask` vertex attribute. The fragment shader samples each texture on XY, XZ, and YZ planes at scale `0.12`, weights samples by `pow(abs(normal), 4.0)`, blends previous/current inner maps by `uMaterialMix`, then blends outer/inner surfaces by the mask. Apply ambient `0.58` plus diffuse `max(dot(normal, sunDirection), 0.0) * 0.62`. Include Three.js tone-mapping and color-space fragments.

- [ ] **Step 5: Run GREEN and commit**

Run `npm test -- tests/scene/createUnifiedTerrain.test.js` and `npm test`.

```powershell
git add src/scene/createUnifiedTerrain.js src/scene/createTexture.js tests/scene/createUnifiedTerrain.test.js
git commit -m "feat: add unified transitioning terrain mesh"
```

---

### Task 3: Dynamic Three.js Sky and Moving Clouds

**Files:**
- Create: `src/scene/createDynamicSky.js`
- Create: `tests/scene/dynamicSky.test.js`
- Modify: `src/styles.css`

**Interfaces:**
- `createDynamicSky()` returns `{ root, update(deltaSeconds), dispose() }`.
- `root.name` is `dynamic-sky`; its material has `uniforms.uTime`, `uHorizonColor`, `uZenithColor`, and `uCloudSpeed`.
- `update` advances `uTime` by elapsed seconds; `dispose` releases geometry and material.

- [ ] **Step 1: Write the failing sky behavior test**

```js
import { describe, expect, it } from 'vitest';
import { createDynamicSky } from '../../src/scene/createDynamicSky.js';

describe('dynamic sky', () => {
  it('surrounds the scene and advances cloud time', () => {
    const sky = createDynamicSky();
    expect(sky.root.name).toBe('dynamic-sky');
    expect(sky.root.material.side).toBe(1);
    expect(sky.root.material.map).toBeUndefined();
    const before = sky.root.material.uniforms.uTime.value;
    sky.update(2.5);
    expect(sky.root.material.uniforms.uTime.value).toBeCloseTo(before + 2.5);
    sky.dispose();
  });
});
```

- [ ] **Step 2: Run RED**

Run `npm test -- tests/scene/dynamicSky.test.js`.

Expected: FAIL because `createDynamicSky.js` does not exist.

- [ ] **Step 3: Implement the procedural sky dome**

Use `THREE.SphereGeometry(75, 48, 24)`, `THREE.BackSide`, `depthWrite: false`, and `fog: false`. The vertex shader passes normalized object-space direction. The fragment shader implements deterministic value noise and four-octave FBM. Compute:

```glsl
float horizon = smoothstep(-0.12, 0.72, vDirection.y);
vec3 sky = mix(uHorizonColor, uZenithColor, horizon);
vec2 cloudUv = vDirection.xz / max(0.18, vDirection.y + 0.42);
float clouds = smoothstep(0.5, 0.72, fbm(cloudUv * 1.35 + vec2(uTime * uCloudSpeed, 0.0)));
sky = mix(sky, vec3(0.84, 0.87, 0.89), clouds * smoothstep(0.05, 0.5, vDirection.y));
```

Set `uCloudSpeed` to `0.006`, which creates visible but subtle motion over 10 seconds.

- [ ] **Step 4: Remove the static CSS horizon**

Change `.scene-panel` to a neutral fallback only:

```css
background: linear-gradient(180deg, #9eb8c2 0%, #718c8b 58%, #3d5543 100%);
```

Remove every `/assets/terrain/site-horizon.png` reference. Keep the file in Git until browser verification confirms no other consumer; deletion, if desired, is a separate explicit cleanup decision.

- [ ] **Step 5: Run GREEN and commit**

Run `npm test -- tests/scene/dynamicSky.test.js` and `npm test`.

```powershell
git add src/scene/createDynamicSky.js src/styles.css tests/scene/dynamicSky.test.js
git commit -m "feat: add animated procedural sky"
```

---

### Task 4: Terrain-Following Engineering Details

**Files:**
- Create: `src/scene/createEngineeringDetails.js`
- Modify: `tests/scene/stageConfig.test.js`

**Interfaces:**
- `createEngineeringDetails(materials)` returns `{ root, applyStage(stageId), dispose() }`.
- `root` contains direct stage groups named `liner-details`, `stack-details`, `cover-details`, and shared `site-infrastructure`.
- `createTerrainRibbon(points, width, stageId)` samples `getTerrainHeight(stageId, x, z)` for every left/right ribbon vertex.

- [ ] **Step 1: Replace obsolete layer assertions with failing detail tests**

The production break caught is “a road, seam, or track floats because it uses a fixed Y value.” Test real vertex positions against independently sampled literal points:

```js
import { getTerrainHeight } from '../../src/scene/terrainProfiles.js';
import { createTerrainRibbon } from '../../src/scene/createEngineeringDetails.js';

it('places every ribbon vertex immediately above its stage terrain', () => {
  const ribbon = createTerrainRibbon([
    { x: -4, z: -2 }, { x: 0, z: 0 }, { x: 4, z: 2 },
  ], 0.5, 'stack');
  const positions = ribbon.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    expect(y - getTerrainHeight('stack', x, z)).toBeGreaterThanOrEqual(0.025);
    expect(y - getTerrainHeight('stack', x, z)).toBeLessThan(0.06);
  }
  ribbon.dispose();
});
```

Keep the existing semantic cue test, but change expected parents to `liner-details`, `stack-details`, and `cover-details`.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/scene/stageConfig.test.js`.

Expected: FAIL because the engineering module and new group contracts are missing.

- [ ] **Step 3: Implement terrain-following details**

Move ribbon construction out of `createSiteModel.js`. Densify each path to at most `0.3` model-unit spacing before creating left/right vertices. Compute every Y as `getTerrainHeight(stageId, x, z) + 0.035`. Create:

- `construction-road` and `stone-drainage-channel` in `site-infrastructure`.
- `liner-seams` and `drainage-pipe` in `liner-details`.
- `haul-road` in `stack-details`.
- `cover-tracks` in `cover-details`.

Use `TubeGeometry` only for the short outlet pipe. Build its control-point Y values from `getTerrainHeight('liner', x, z)`.

- [ ] **Step 4: Run GREEN and commit**

Run `npm test -- tests/scene/stageConfig.test.js` and `npm test`.

```powershell
git add src/scene/createEngineeringDetails.js tests/scene/stageConfig.test.js
git commit -m "feat: add terrain-following engineering details"
```

---

### Task 5: Natural Instanced Vegetation

**Files:**
- Create: `public/assets/terrain/tree-sprite.png`
- Create: `public/assets/terrain/shrub-sprite.png`
- Create: `src/scene/createVegetation.js`
- Modify: `tests/scene/stageConfig.test.js`

**Interfaces:**
- `createVegetation(renderer, options?)` returns `{ root, applyStage(stageId), dispose() }`; tests may pass `{ loadImages: false }`.
- `root.name` is `vegetation-system`.
- Descendants are `distant-forest`, `restoration-grass`, `restoration-shrubs`, and `restoration-trees`.
- All root positions use `getTerrainHeight(stageId, x, z)` and deterministic seeded placement.

- [ ] **Step 1: Write failing vegetation structure tests**

```js
import { createVegetation } from '../../src/scene/createVegetation.js';

function rendererStub() {
  return { capabilities: { getMaxAnisotropy: () => 4 } };
}

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
```

- [ ] **Step 2: Run RED**

Run `npm test -- tests/scene/stageConfig.test.js`.

Expected: FAIL because `createVegetation` is missing.

- [ ] **Step 3: Generate and inspect two transparent sprites**

Generate separate square, text-free, transparent-background assets:

- A natural young mixed conifer/deciduous tree viewed at a slight downward angle, full plant visible, soft overcast lighting.
- An irregular temperate shrub cluster viewed at a slight downward angle, full plant visible, soft overcast lighting.

Inspect both images, then copy accepted PNGs to the exact paths listed above. Keep generated originals in the image-generation output directory.

- [ ] **Step 4: Implement crossed-plane instancing**

Build one crossed-plane geometry from two vertical quads at 90 degrees. Use `MeshStandardMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide })`. Populate:

- More than 300 distant forest instances outside footprint distance `1.25`, concentrated on the far half of the site.
- 40–70 restoration tree instances inside distance `0.88` where deterministic density noise exceeds `0.58`.
- 100–180 shrub instances where density noise is `0.43..0.68`.
- 500–900 small grass instances with irregular omissions for road and drainage corridors.

Set each instance Y from `getTerrainHeight('restoration', x, z)`. Vary rotation and scale using the existing sine-based deterministic seed pattern.

- [ ] **Step 5: Run GREEN and commit**

Run `npm test -- tests/scene/stageConfig.test.js` and `npm test`.

```powershell
git add public/assets/terrain/tree-sprite.png public/assets/terrain/shrub-sprite.png src/scene/createVegetation.js tests/scene/stageConfig.test.js
git commit -m "feat: add natural instanced vegetation"
```

---

### Task 6: Compose the New Site Model and Scene Loop

**Files:**
- Rewrite: `src/scene/createSiteModel.js`
- Modify: `src/scene/createScene.js`
- Modify: `tests/scene/stageConfig.test.js`
- Modify: `tests/scene/createScene.test.js`
- Remove after callers migrate: `src/scene/createTerrainGeometry.js`

**Interfaces:**
- `createSiteModel(renderer, options?)` returns `{ root, applyStage(stageId), update(deltaSeconds), dispose() }`; tests may pass `{ loadImages: false }`.
- `root` contains exactly one `unified-terrain` mesh plus engineering and vegetation systems.
- `createScene(canvas)` keeps its existing public `{ setStage, resize, dispose }` return value.

- [ ] **Step 1: Write failing integrated model tests**

Replace tests tied to obsolete `site-ground`, `pit-wall`, and layer visibility with:

```js
it('composes one terrain without independent ground or pit meshes', () => {
  const model = createSiteModel(rendererStub(), { loadImages: false });
  expect(model.root.getObjectByName('unified-terrain')).toBeTruthy();
  expect(model.root.getObjectByName('site-ground')).toBeUndefined();
  expect(model.root.getObjectByName('pit-wall')).toBeUndefined();
  expect(model.root.children.filter(child => child.name === 'unified-terrain')).toHaveLength(1);
  model.dispose();
});

it('routes stage and time updates to the composed scene systems', () => {
  const model = createSiteModel(rendererStub(), { loadImages: false });
  model.applyStage('restoration');
  model.update(0.6);
  expect(model.root.getObjectByName('restoration-trees').visible).toBe(true);
  expect(model.root.getObjectByName('unified-terrain').userData.currentStage).toBe('restoration');
  model.dispose();
});
```

- [ ] **Step 2: Run RED**

Run `npm test -- tests/scene/stageConfig.test.js tests/scene/createScene.test.js`.

Expected: FAIL because the existing model still exposes independent layers and no `update` method.

- [ ] **Step 3: Rewrite the composition root**

`createSiteModel` creates one unified terrain, one engineering system, and one vegetation system. `applyStage` validates through `getStageConfig`, calls all three systems, and records the selected stage. `update` advances terrain transitions. `dispose` delegates once to each owned system; do not traverse and double-dispose shared textures.

Delete old local geometry helpers, terraced mound code, low-poly tree code, and context forest code from `createSiteModel.js`. Remove `createTerrainGeometry.js` only after `rg "createTerrainGeometry" src tests` returns no callers.

- [ ] **Step 4: Integrate dynamic sky and delta time**

In `createScene.js`, create `const clock = new THREE.Clock()` and `const sky = createDynamicSky()`. Add the sky to the scene. In `render`:

```js
const deltaSeconds = Math.min(clock.getDelta(), 0.05);
model.update(deltaSeconds);
sky.update(deltaSeconds);
controls.update();
renderer.render(scene, camera);
```

Use `scene.fog = new THREE.Fog('#81969b', 26, 68)`, camera far plane `160`, and a default camera near `(15.5, 13.5, 20.5)`. Reduce directional-light intensity until the black liner remains dark instead of silver. Dispose the sky before forcing context loss.

- [ ] **Step 5: Run GREEN, build, and commit**

Run `npm test` and `npm run build`.

```powershell
git add src/scene tests/scene
git commit -m "feat: integrate unified restoration scene"
```

---

### Task 7: Browser Visual Verification and Targeted Refinement

**Files:**
- Modify only when evidence identifies a failed criterion: `src/scene/terrainProfiles.js`, `src/scene/createUnifiedTerrain.js`, `src/scene/createDynamicSky.js`, `src/scene/createEngineeringDetails.js`, `src/scene/createVegetation.js`, `src/scene/createScene.js`, or `src/styles.css`

**Interfaces:**
- No public interface changes; produces the verified final visual result.

- [ ] **Step 1: Start or reuse the Vite development server**

Run `npm run dev -- --host 127.0.0.1` if the existing server is not active. Open the reported local URL with a 1920×1080 viewport.

- [ ] **Step 2: Reproduce the former gap views**

Open `原始基坑`, zoom to the minimum permitted camera distance, and inspect front, back, left, and right oblique views. Repeat for `基坑整理与防渗`. Acceptance: no cyan, black-background, or sky-colored pixel line appears between ground, rim, wall, or floor.

- [ ] **Step 3: Compare all five stages with the approved reference**

Capture one screenshot per stage from the same default view. Verify:

- Pit: stratified irregular walls, natural floor, ring road, front drainage outlet.
- Liner: complete black coverage, visible seams, dark non-metallic response.
- Stack: broad white terraces, continuous haul ramp, compacted surface variation.
- Cover: brown surface fully hides gypsum, terrain-following tracks.
- Restoration: irregular grass/soil mix, shrubs and trees without rows or round-ball crowns.

Make one targeted change per failed observation and repeat only the affected screenshot.

- [ ] **Step 4: Verify dynamic sky and interaction**

Take screenshots at time zero and after 10 seconds from the same camera; cloud shapes must change slightly while the terrain remains fixed. Drag horizontally and vertically, then zoom both directions. Confirm the sky surrounds every view and no terrain edge becomes visible.

- [ ] **Step 5: Verify ten site-stage states and lifecycle**

For both sites and all five stages, assert the selected site/stage text, exactly one `#scene-canvas`, no `undefined` or `NaN`, and site-appropriate data. Repeatedly switch sites and stages and confirm the console contains no fresh errors or warnings.

- [ ] **Step 6: Run final verification and commit**

Run:

```powershell
npm test
npm run build
git diff --check
git status --short
```

Expected: all tests pass, production build succeeds, diff check is silent, and only the intentionally untracked report-reference directory remains.

Commit verified visual adjustments:

```powershell
git add src tests public/assets/terrain
git commit -m "test: verify unified terrain visual quality"
```
