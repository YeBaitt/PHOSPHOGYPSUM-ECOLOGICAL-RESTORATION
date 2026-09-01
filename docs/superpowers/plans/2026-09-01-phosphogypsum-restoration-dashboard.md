# Phosphogypsum Restoration Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fullscreen browser dashboard for 三板湖 and 东西泉 with five synchronized, lightweight realistic Three.js restoration stages and report-backed data.

**Architecture:** A Vite single-page application keeps the selected site, stage, data group, and sample as state. Plain JavaScript renders the dashboard from one report-data module; a separate Three.js scene owns a reusable layered model and updates it without recreating the WebGL canvas. Vitest covers data, state, DOM rendering, and stage configuration; the final 3D result is verified at 1920×1080.

**Tech Stack:** Vite, plain JavaScript ES modules, Three.js, Vitest, jsdom, CSS

**Spec:** `docs/superpowers/specs/2026-09-01-phosphogypsum-restoration-dashboard-design.md`

## Global Constraints

- Frontend-only; no login, backend, database, upload, or live monitoring.
- Optimize for a 16:9 desktop browser at 1920×1080.
- Site IDs are exactly `sanbanhu` and `dongxiquan`; never compare them side by side.
- Stage IDs, in order, are `pit`, `liner`, `stack`, `cover`, `restoration`.
- Both sites share one model labeled “示意模型，非真实地形复原”.
- Allow orbit rotation and wheel zoom only; disable pan and walking.
- Only report-backed values may be displayed. Missing values are `null` and render as “暂无数据”.
- Site basics use the database final edition; demonstration facts use the conclusion report.
- Display 东西泉 capacity as 335万 m³; do not use 云天化 case values as target-site data.
- Keep files focused and UI wording understandable to a frontend beginner.

## File Map

```text
index.html                         Stable page shell
package.json                       Commands and dependencies
vitest.config.js                   jsdom test configuration
src/main.js                        State ownership and event wiring
src/styles.css                     Fullscreen dashboard styling
src/data/siteData.js               Report-backed site/stage data
src/state/dashboardState.js        Validated state transitions
src/ui/renderDashboard.js          DOM rendering and sample tabs
src/scene/stageConfig.js           Pure layer configuration
src/scene/createTexture.js         Procedural local textures
src/scene/createSiteModel.js       Shared layered geometry
src/scene/createScene.js           Renderer, lighting, camera, controls
tests/data/siteData.test.js        Data contract tests
tests/state/dashboardState.test.js State transition tests
tests/ui/renderDashboard.test.js   DOM and event tests
tests/scene/stageConfig.test.js    Stage configuration tests
tests/setup.js                     DOM cleanup
```

---

### Task 1: Project Foundation and Report Data

**Files:**
- Create: `.gitignore`, `package.json`, `vitest.config.js`, `tests/setup.js`
- Create: `src/data/siteData.js`
- Test: `tests/data/siteData.test.js`

**Interfaces:**
- Produces `SITE_IDS`, `STAGE_IDS`, `sites`, `getSite(siteId)`, and `getStageData(siteId, stageId)`.
- A group is `{ id, label, source, units, labels, samples }`; a sample is `{ name, values }`.

- [ ] **Step 1: Initialize and install the minimal toolchain**

```powershell
git init
npm init -y
npm install three
npm install --save-dev vite vitest jsdom
```

Expected: Git metadata, `package-lock.json`, and dependencies are created without errors.

- [ ] **Step 2: Configure commands and tests**

Set `package.json` to `"type": "module"` with scripts `dev: vite`, `build: vite build`, `preview: vite preview`, `test: vitest run`, and `test:watch: vitest`. Create:

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'] } });

// tests/setup.js
import { afterEach } from 'vitest';
afterEach(() => { document.body.innerHTML = ''; });
```

Create `.gitignore` with `node_modules/`, `dist/`, `.vite/`, and `*.log`.

- [ ] **Step 3: Write the failing data tests**

```js
import { describe, expect, it } from 'vitest';
import { SITE_IDS, STAGE_IDS, getSite, getStageData } from '../../src/data/siteData.js';
describe('site data', () => {
  it('contains approved sites and stages', () => {
    expect(SITE_IDS).toEqual(['sanbanhu', 'dongxiquan']);
    expect(STAGE_IDS).toEqual(['pit', 'liner', 'stack', 'cover', 'restoration']);
  });
  it('uses approved basic-data values', () => {
    expect(getSite('sanbanhu').basics.capacity).toBe('约1700万 m³');
    expect(getSite('dongxiquan').basics.capacity).toBe('335万 m³');
    expect(getSite('dongxiquan').basics.riverDistance).toBe('17～17.35 km');
  });
  it('preserves samples and missing data', () => {
    expect(getStageData('sanbanhu', 'stack').groups[0].samples).toHaveLength(3);
    expect(getStageData('sanbanhu', 'stack').groups[0].samples[0].values).toMatchObject({ pH: 2.93, totalF: 4290, totalP: 4430 });
    expect(getStageData('dongxiquan', 'pit').groups).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the test and confirm it fails because the data module is absent**

```powershell
npm test -- tests/data/siteData.test.js
```

- [ ] **Step 5: Implement the complete approved dataset**

Start `src/data/siteData.js` with this public contract:

```js
export const SITE_IDS = ['sanbanhu', 'dongxiquan'];
export const STAGE_IDS = ['pit', 'liner', 'stack', 'cover', 'restoration'];
const DATABASE_SOURCE = '磷石膏资源环境数据库最终版0612';
const REPORT_SOURCE = '课题结题报告-0614';
const noMeasurements = description => ({ description, groups: [] });
export const sites = { sanbanhu: {}, dongxiquan: {} };
export function getSite(siteId) {
  const site = sites[siteId];
  if (!site) throw new Error(`Unknown site: ${siteId}`);
  return site;
}
export function getStageData(siteId, stageId) {
  const stage = getSite(siteId).stages[stageId];
  if (!stage) throw new Error(`Unknown stage: ${stageId}`);
  return stage;
}
```

Fill the two site objects with every value in approved spec sections 7.1–7.8. Copy sample names and numbers exactly. Store solid units as `mg/kg`; reopen the database report and copy the liquid table units exactly. Use `groups: []` for missing stages. Do not calculate averages or add thresholds.

- [ ] **Step 6: Verify and commit**

```powershell
npm test -- tests/data/siteData.test.js
git add .gitignore package.json package-lock.json vitest.config.js tests/setup.js tests/data src/data/siteData.js
git commit -m "feat: add report-backed site data"
```

Expected: all data tests pass.

---

### Task 2: Predictable Dashboard State

**Files:**
- Create: `src/state/dashboardState.js`
- Test: `tests/state/dashboardState.test.js`

**Interfaces:**
- Produces `createDashboardState()`, `selectSite(state, siteId)`, and `selectStage(state, stageId)`.
- State is `{ currentSite, currentStage, activeGroup, activeSample }`.

- [ ] **Step 1: Write the failing transition tests**

```js
import { describe, expect, it } from 'vitest';
import { createDashboardState, selectSite, selectStage } from '../../src/state/dashboardState.js';
describe('dashboard state', () => {
  it('starts at 三板湖 and 原始基坑', () => {
    expect(createDashboardState()).toEqual({ currentSite: 'sanbanhu', currentStage: 'pit', activeGroup: 0, activeSample: 0 });
  });
  it('keeps stage when site changes', () => {
    const state = { currentSite: 'sanbanhu', currentStage: 'cover', activeGroup: 1, activeSample: 1 };
    expect(selectSite(state, 'dongxiquan')).toEqual({ currentSite: 'dongxiquan', currentStage: 'cover', activeGroup: 0, activeSample: 0 });
  });
  it('resets sample when stage changes', () => {
    const state = { currentSite: 'sanbanhu', currentStage: 'stack', activeGroup: 1, activeSample: 1 };
    expect(selectStage(state, 'restoration').activeSample).toBe(0);
  });
});
```

- [ ] **Step 2: Confirm failure, then implement immutable transitions**

```js
import { SITE_IDS, STAGE_IDS } from '../data/siteData.js';
export const createDashboardState = () => ({ currentSite: 'sanbanhu', currentStage: 'pit', activeGroup: 0, activeSample: 0 });
export function selectSite(state, siteId) {
  if (!SITE_IDS.includes(siteId)) throw new Error(`Unknown site: ${siteId}`);
  return { ...state, currentSite: siteId, activeGroup: 0, activeSample: 0 };
}
export function selectStage(state, stageId) {
  if (!STAGE_IDS.includes(stageId)) throw new Error(`Unknown stage: ${stageId}`);
  return { ...state, currentStage: stageId, activeGroup: 0, activeSample: 0 };
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm test -- tests/state/dashboardState.test.js
git add src/state tests/state
git commit -m "feat: add dashboard state transitions"
```

Expected: all state tests pass.

---

### Task 3: Dashboard DOM and Data Interaction

**Files:**
- Create: `index.html`
- Create: `src/ui/renderDashboard.js`
- Test: `tests/ui/renderDashboard.test.js`

**Interfaces:**
- `renderDashboard(root, state)` updates panels while preserving the existing `#scene-canvas` node.
- `bindDashboardEvents(root, handlers)` routes clicks to `{ onSite, onStage, onGroup, onSample }`.

- [ ] **Step 1: Write failing DOM tests**

```js
import { describe, expect, it, vi } from 'vitest';
import { renderDashboard, bindDashboardEvents } from '../../src/ui/renderDashboard.js';
const state = { currentSite: 'sanbanhu', currentStage: 'pit', activeGroup: 0, activeSample: 0 };
function makeRoot() {
  document.body.innerHTML = '<main id="app"><canvas id="scene-canvas"></canvas></main>';
  return document.querySelector('#app');
}
describe('dashboard rendering', () => {
  it('renders five stages and preserves the canvas', () => {
    const root = makeRoot(); const canvas = root.querySelector('canvas');
    renderDashboard(root, state);
    expect(root.querySelectorAll('[data-stage]')).toHaveLength(5);
    expect(root.textContent).toContain('三板湖磷石膏库');
    expect(root.textContent).toContain('暂无数据');
    expect(root.querySelector('canvas')).toBe(canvas);
  });
  it('routes a stage click', () => {
    const root = makeRoot(); renderDashboard(root, state); const onStage = vi.fn();
    bindDashboardEvents(root, { onSite: vi.fn(), onStage, onGroup: vi.fn(), onSample: vi.fn() });
    root.querySelector('[data-stage="cover"]').click();
    expect(onStage).toHaveBeenCalledWith('cover');
  });
});
```

- [ ] **Step 2: Run the test and confirm the renderer is missing**

```powershell
npm test -- tests/ui/renderDashboard.test.js
```

- [ ] **Step 3: Create the stable page shell**

```html
<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>磷石膏堆场生态修复三维可视化平台</title></head>
<body><main id="app"><canvas id="scene-canvas" aria-label="堆场五阶段三维示意模型"></canvas></main><script type="module" src="/src/main.js"></script></body>
</html>
```

- [ ] **Step 4: Implement rendering and event delegation**

Use these fixed labels and missing-value behavior:

```js
const stageLabels = { pit: '原始基坑', liner: '基坑整理与防渗', stack: '磷石膏堆填', cover: '封场覆土', restoration: '植物修复' };
export function formatValue(value, unit = '') {
  if (value === null || value === undefined || value === '') return '暂无数据';
  return unit ? `${value} ${unit}` : String(value);
}
export function bindDashboardEvents(root, handlers) {
  root.onclick = event => {
    const site = event.target.closest('[data-site]');
    const stage = event.target.closest('[data-stage]');
    const group = event.target.closest('[data-group]');
    const sample = event.target.closest('[data-sample]');
    if (site) handlers.onSite(site.dataset.site);
    if (stage) handlers.onStage(stage.dataset.stage);
    if (group) handlers.onGroup(Number(group.dataset.group));
    if (sample) handlers.onSample(Number(sample.dataset.sample));
  };
}
```

`renderDashboard` must create the approved header/site switch, left basics, central scene host and notes, right data panel, and bottom stage buttons. Move the pre-existing canvas into `.scene-host`; never clone or replace it. Render group/sample tabs only when groups exist and show the source below every group.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- tests/ui/renderDashboard.test.js
git add index.html src/ui tests/ui
git commit -m "feat: render dashboard data and controls"
```

Expected: all UI tests pass.

---

### Task 4: Five-Stage Three.js Model

**Files:**
- Create: `src/scene/stageConfig.js`
- Create: `src/scene/createTexture.js`
- Create: `src/scene/createSiteModel.js`
- Test: `tests/scene/stageConfig.test.js`

**Interfaces:**
- `getStageConfig(stageId)` returns visibility for `pit`, `liner`, `gypsum`, `cover`, `grass`, and `shrubs` plus `targetY`.
- `createTexture(kind, renderer)` returns a configured `THREE.CanvasTexture`.
- `createSiteModel(renderer)` returns `{ root, applyStage(stageId), dispose() }`.

- [ ] **Step 1: Write failing stage tests**

```js
import { describe, expect, it } from 'vitest';
import { getStageConfig } from '../../src/scene/stageConfig.js';
describe('stage configuration', () => {
  it('progresses from pit to vegetation', () => {
    expect(getStageConfig('pit')).toMatchObject({ liner: false, gypsum: false, cover: false, grass: false });
    expect(getStageConfig('liner')).toMatchObject({ liner: true, gypsum: false });
    expect(getStageConfig('stack')).toMatchObject({ gypsum: true, cover: false });
    expect(getStageConfig('cover')).toMatchObject({ cover: true, grass: false });
    expect(getStageConfig('restoration')).toMatchObject({ cover: true, grass: true, shrubs: true });
  });
  it('rejects an unknown stage', () => expect(() => getStageConfig('other')).toThrow('Unknown stage: other'));
});
```

- [ ] **Step 2: Confirm failure, then implement explicit configurations**

```js
const configs = {
  pit: { pit: true, liner: false, gypsum: false, cover: false, grass: false, shrubs: false, targetY: 0 },
  liner: { pit: true, liner: true, gypsum: false, cover: false, grass: false, shrubs: false, targetY: 0 },
  stack: { pit: true, liner: true, gypsum: true, cover: false, grass: false, shrubs: false, targetY: 2.3 },
  cover: { pit: true, liner: true, gypsum: true, cover: true, grass: false, shrubs: false, targetY: 2.5 },
  restoration: { pit: true, liner: true, gypsum: true, cover: true, grass: true, shrubs: true, targetY: 2.6 },
};
export function getStageConfig(stageId) {
  if (!configs[stageId]) throw new Error(`Unknown stage: ${stageId}`);
  return configs[stageId];
}
```

Run `npm test -- tests/scene/stageConfig.test.js`; expected: all stage tests pass.

- [ ] **Step 3: Create deterministic local textures**

Create a 256×256 seeded-noise canvas texture with `RepeatWrapping`, sRGB color space, repeat `(5,5)`, and anisotropy capped at 8. Use:

```js
const palettes = {
  soil: ['#6a4a2d', '#87613c', '#4d3827'],
  gypsum: ['#d8d6ce', '#f0eee7', '#b9bab5'],
  liner: ['#11171a', '#263137', '#080b0d'],
  grass: ['#345f2b', '#527f38', '#243f20'],
};
```

The signature is `createTexture(kind, renderer)`. Unknown kinds throw `Unknown texture: <kind>`. A deterministic sine-based pseudo-random function prevents reload flicker.

- [ ] **Step 4: Build the reusable layered site model**

Use Three.js primitives to build one group containing:

```text
15-unit circular soil ground
8.6-unit excavated basin wall
black 0.18-unit liner layer
white 5.2-unit terraced gypsum mound
brown 5.38-unit cover mound
green 5.46-unit grass mound
42 small shrub meshes distributed by a golden-angle spiral
```

Use `MeshStandardMaterial`, enable cast/receive shadows, and implement `applyStage` by assigning layer visibility from `getStageConfig`. `dispose` releases all geometry, materials, and textures. Keep the same footprint and viewing direction across stages.

- [ ] **Step 5: Run tests and commit**

```powershell
npm test
git add src/scene tests/scene
git commit -m "feat: add five-stage realistic site model"
```

Expected: all tests pass.

---

### Task 5: Scene Integration and Fullscreen Styling

**Files:**
- Create: `src/scene/createScene.js`
- Create: `src/styles.css`
- Create: `src/main.js`

**Interfaces:**
- `createScene(canvas)` returns `{ setStage(stageId), resize(), dispose() }`.
- `main.js` owns exactly one state object and one scene instance.

- [ ] **Step 1: Implement the Three.js scene wrapper**

Create a `WebGLRenderer({ canvas, antialias: true, alpha: true })`; cap pixel ratio at 1.75, enable soft shadows, sRGB output, ACES filmic tone mapping, and light fog. Use a hemisphere light and shadow-casting directional light. Position the camera at `(16,12,19)` and configure:

```js
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 12;
controls.maxDistance = 34;
controls.minPolarAngle = 0.42;
controls.maxPolarAngle = 1.42;
```

`resize()` reads canvas client dimensions. `setStage()` calls the site model and updates the control target Y. `dispose()` cancels animation, disposes controls/model/renderer, and releases the WebGL context.

- [ ] **Step 2: Implement the 16:9 CSS layout**

Use this grid foundation:

```css
:root { font-family: "Microsoft YaHei", "Segoe UI", sans-serif; color: #eaf8ff; background: #06111c; }
* { box-sizing: border-box; }
html, body, #app { width: 100%; height: 100%; margin: 0; overflow: hidden; }
#app {
  display: grid;
  grid-template-columns: minmax(270px,20vw) minmax(520px,1fr) minmax(300px,22vw);
  grid-template-rows: 92px minmax(0,1fr) 96px;
  grid-template-areas: "header header header" "basics scene data" "stages stages stages";
  gap: 12px; padding: 14px 18px 16px;
  background: radial-gradient(circle at 50% 35%,#15354a 0%,#081725 47%,#040b12 100%);
}
```

Use dark translucent blue panels with cyan borders. Set the title to 25–36px, panel headings to 21px, values to at least 16px, and stage buttons to 16px. Make the central scene the largest region and use a natural gray-blue/green scene background. At widths below 1280px, use columns `240px minmax(430px,1fr) 280px` and one-column metric cards.

- [ ] **Step 3: Wire state, UI, and one persistent scene**

In `main.js`, import CSS, state transitions, dashboard functions, and `createScene`. Render the dashboard, create the scene once from the preserved canvas, then call `setStage(currentStage)` after each update. Site changes keep the current stage; group/sample changes update only state and text. Register resize and unload handlers.

If WebGL is unavailable, render exactly:

```text
当前浏览器无法显示三维模型，请更新浏览器或启用硬件加速。
```

- [ ] **Step 4: Run automated checks and build**

```powershell
npm test
npm run build
```

Expected: all tests pass and Vite creates `dist` without errors.

- [ ] **Step 5: Commit the integrated page**

```powershell
git add src/main.js src/styles.css src/scene/createScene.js
git commit -m "feat: integrate interactive restoration dashboard"
```

---

### Task 6: Browser Verification and Final Refinement

**Files:**
- Modify if a visual check fails: `src/styles.css`, `src/scene/createSiteModel.js`, or `src/scene/createScene.js`
- Modify only for source-confirmed unit corrections: `src/data/siteData.js`

**Interfaces:**
- Produces the verified final page without changing interfaces from Tasks 1–5.

- [ ] **Step 1: Start the page**

```powershell
npm run dev -- --host 127.0.0.1
```

Open the printed URL in Chrome or Edge at 1920×1080.

- [ ] **Step 2: Check all ten site-stage combinations**

For both sites and all five stages, verify the selected labels, model stage, current-site data, source text, and missing-value text. Confirm no `undefined`, `NaN`, fabricated threshold, comparison panel, or 云天化 value appears.

- [ ] **Step 3: Check controls and WebGL lifecycle**

```text
Horizontal drag rotates the model.
Vertical drag stops above the ground.
Wheel zoom stops at both limits.
Right-button drag does not pan.
Five repeated site switches keep exactly one visible canvas.
Window resize preserves the model aspect ratio.
```

- [ ] **Step 4: Check visual acceptance**

Capture a 1920×1080 screenshot. Verify that the title and key values are readable, the model is the largest region, panels do not cover it, and there is no page scrollbar. Confirm five distinct states: exposed pit, black liner, white gypsum, brown cover, and green restoration. Make only targeted adjustments in the file that owns a failed detail, then repeat that check.

- [ ] **Step 5: Recheck units and production output**

Compare liquid-sample unit labels with the database report table, correcting only labels supported by the source. Then run:

```powershell
npm test
npm run build
```

Expected: all tests pass, production build succeeds, and the browser console contains no errors.

- [ ] **Step 6: Commit the verified result**

```powershell
git add src tests index.html package.json package-lock.json
git commit -m "test: verify fullscreen restoration visualization"
git status --short
```

Expected: the application commit succeeds. Reference reports and brainstorming artifacts remain outside application commits unless the user asks to version them.
