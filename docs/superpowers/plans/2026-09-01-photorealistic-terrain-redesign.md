# Photorealistic Terrain Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the schematic cylindrical site model with a lightweight, realistic irregular terrain scene matching the approved aerial reference while preserving all dashboard data and controls.

**Architecture:** Keep the public `createSiteModel(renderer)` contract and existing stage state. Add a pure irregular-ring geometry module, assemble named engineering-detail groups in the site model, and use small local texture assets with procedural fallbacks. Reuse meshes through visibility changes so switching stages never recreates the WebGL canvas.

**Tech Stack:** Vite, plain JavaScript ES modules, Three.js, Vitest, jsdom, local PNG textures

**Spec:** `docs/superpowers/specs/2026-09-01-photorealistic-terrain-redesign.md`

## Global Constraints

- Preserve the existing UI, site data, five stage IDs, and `createSiteModel(renderer)` return contract.
- The shared model is illustrative and must not claim surveyed terrain or dimensions.
- Runtime assets must be local; texture failure must leave a readable fallback material.
- Controls remain orbit rotation and wheel zoom only.
- Prefer instancing and reusable geometry for vegetation and repeated rocks.
- Do not add a backend, live data, walkthrough, vehicle animation, or comparison view.

---

### Task 1: Irregular Terrain Geometry Contract

**Files:**
- Create: `src/scene/createTerrainGeometry.js`
- Modify: `tests/scene/stageConfig.test.js`

**Interfaces:**
- Produces `SITE_BOUNDARY`, `scaleRing(points, scale, y)`, `createRingGeometry(outer, inner)`, and `createSurfaceGeometry(points, y)`.
- Ring points are `{ x, z, y }`; returned values are real `THREE.BufferGeometry` instances.

- [ ] **Step 1: Write a failing test for the visible break**

Add a model test that asserts `pit-wall` is `BufferGeometry`, has no cylinder radius parameters, and that at least three outer-rim distances differ by more than `0.5`. This catches regression to a regular round pit.

- [ ] **Step 2: Run the focused test and observe RED**

Run `npm test -- tests/scene/stageConfig.test.js`. Expected: failure because the current pit is `CylinderGeometry` with uniform radial construction.

- [ ] **Step 3: Implement the geometry helpers**

Use one hand-authored 14-point asymmetric site boundary. `scaleRing` scales X and Z independently around the origin and assigns Y. `createRingGeometry` connects matching points with two triangles per segment and computes vertex normals. `createSurfaceGeometry` builds a `THREE.ShapeGeometry`, rotates it into the XZ plane, and assigns the requested elevation.

- [ ] **Step 4: Replace the pit wall and floor with the helpers**

Update `createSiteModel.js` so `pit-wall` connects the outer rim to a smaller, deeper inner ring and `pit-floor` closes the inner ring. Preserve object names, shadows, and stage visibility.

- [ ] **Step 5: Run GREEN and commit**

Run `npm test -- tests/scene/stageConfig.test.js`, then `git add src/scene/createTerrainGeometry.js src/scene/createSiteModel.js tests/scene/stageConfig.test.js` and commit with `feat: add irregular terrain geometry`.

---

### Task 2: Stage-Specific Engineering Details

**Files:**
- Modify: `src/scene/createSiteModel.js`
- Modify: `tests/scene/stageConfig.test.js`

**Interfaces:**
- Existing layer names stay `pit-layer`, `liner-layer`, `gypsum-layer`, `cover-layer`, `grass-layer`, and `shrubs-layer`.
- Adds named descendants `liner-seams`, `drainage-pipe`, `haul-road`, `cover-tracks`, and `restoration-trees`.

- [ ] **Step 1: Write a failing integration test**

Create one model instance and assert every named engineering-detail descendant exists. Assert liner details become visible in `liner`, the haul road in `stack`, cover tracks in `cover`, and restoration trees in `restoration` through their owning layer visibility.

- [ ] **Step 2: Run the focused test and observe RED**

Run `npm test -- tests/scene/stageConfig.test.js`. Expected: failure on the first missing named detail.

- [ ] **Step 3: Implement irregular stage surfaces**

Construct gypsum as four asymmetric bench rings rather than cylinders, cover and grass as slightly offset ring surfaces, and add a curved ribbon transport road. Add thin membrane seam curves, one drainage pipe, dark cover track ribbons, patchy grass instances, shrubs, and instanced trunk/canopy trees.

- [ ] **Step 4: Add realistic peripheral context**

Replace the ellipse ground opening with the shared irregular boundary. Add a pale construction road, stone-lined drainage channel, scattered rocks, and an instanced forest band behind the site. Keep these details outside the stage layers so the context remains stable during switching.

- [ ] **Step 5: Run GREEN and commit**

Run `npm test -- tests/scene/stageConfig.test.js`, then commit the model and test changes with `feat: add realistic stage details`.

---

### Task 3: Local Realistic Material Assets

**Files:**
- Create: `public/assets/terrain/rock-soil.png`
- Create: `public/assets/terrain/geomembrane.png`
- Create: `public/assets/terrain/phosphogypsum.png`
- Create: `public/assets/terrain/topsoil.png`
- Create: `public/assets/terrain/vegetation.png`
- Modify: `src/scene/createTexture.js`
- Modify: `src/scene/createSiteModel.js`
- Modify: `tests/scene/stageConfig.test.js`

**Interfaces:**
- Produces `createAssetTexture(kind, renderer)` for kinds `rock`, `liner`, `gypsum`, `cover`, and `grass`.
- The returned texture initially contains the existing generated canvas fallback and swaps to its local PNG when loaded.

- [ ] **Step 1: Write a failing texture-contract test**

Assert each approved kind returns a configured Three.js texture with repeat wrapping, sRGB color space, and a local asset path recorded in `userData.assetPath`. Assert an unknown kind throws `Unknown asset texture: other`.

- [ ] **Step 2: Run the focused test and observe RED**

Run `npm test -- tests/scene/stageConfig.test.js`. Expected: failure because `createAssetTexture` does not exist.

- [ ] **Step 3: Generate and inspect five local texture images**

Generate separate top-down, seamless-looking, text-free material images guided by the approved reference: weathered rock soil, black HDPE membrane, pale granular phosphogypsum, compacted brown topsoil, and patchy grass. Inspect every image and copy the accepted files into `public/assets/terrain/`.

- [ ] **Step 4: Implement resilient local texture loading**

Create each canvas fallback with the existing `createTexture`, record the local URL in `userData.assetPath`, and load the PNG with `THREE.ImageLoader`. On success, replace the fallback image and mark the texture for upload; on failure, retain the fallback without throwing.

- [ ] **Step 5: Apply the asset textures and run GREEN**

Use asset textures for rock, liner, gypsum, cover, and vegetation materials. Run the focused test and `npm test`, then commit assets and code with `feat: apply local terrain materials`.

---

### Task 4: Browser Composition and Final Verification

**Files:**
- Modify when evidence requires it: `src/scene/createScene.js`
- Modify when evidence requires it: `src/scene/createSiteModel.js`

**Interfaces:**
- `createScene(canvas)` and all UI contracts remain unchanged.

- [ ] **Step 1: Build and start the current branch**

Run `npm test` and `npm run build`, then serve the Vite page on the existing local development URL.

- [ ] **Step 2: Inspect all five stages at 1920×1080**

For each stage, capture the central scene and compare against the approved reference: irregular excavation, membrane and drainage, white bench stack and road, soil tracks, then patchy vegetation and trees. Check both site buttons retain the same model behavior and their own data.

- [ ] **Step 3: Tune only evidenced visual problems**

Adjust camera target, sunlight, fog, material roughness, or model scale only when the browser image shows a specific mismatch. Do not change dashboard layout or report values.

- [ ] **Step 4: Verify interaction and lifecycle**

Confirm drag rotates, wheel zooms within limits, right-drag does not pan, repeated stage/site switches keep one canvas, resizing remains correct, and the console has no fresh errors.

- [ ] **Step 5: Run final verification and commit**

Run `npm test` and `npm run build`; inspect `git diff --check` and `git status --short`. Commit verified adjustments with `test: verify photorealistic terrain stages`.

