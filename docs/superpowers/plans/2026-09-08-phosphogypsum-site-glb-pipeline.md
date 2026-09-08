# 磷石膏堆场 GLB 精细化管线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Blender 4.5 程序化生成五阶段精细化磷石膏堆场 GLB，并在 Three.js 中以可缓存、可回退的方式接入现有页面。

**Architecture:** Blender 端以固定随机种子和共享不规则轮廓生成五个独立阶段资产，材质与细节均为本地程序化内容。浏览器端保留现有程序化场景作为首屏与故障 fallback，通过独立资产仓库异步预载、克隆和切换 GLB，且保持 `createSiteModel` 的既有公开接口。

**Tech Stack:** Blender 4.5 Python API、Python `unittest`、Three.js 0.185、GLTFLoader、Vite 8、Vitest 4、jsdom

**Spec:** `docs/superpowers/specs/2026-09-08-phosphogypsum-site-glb-pipeline-design.md`

## Global Constraints

- 两个场地共用同一套模型，场地切换不得重新下载资产。
- 第三张参考图决定宽阔低矮、平顶、多平台和道路网络的主体形态；第一、二张图仅补充压实、冲刷、防渗膜和坡脚细节。
- 必须保留 pit、liner、stack、cover、restoration 五阶段及现有 UI、旋转、缩放和数据面板。
- 任何 GLB 缺失或解析失败均不得导致白屏，程序化模型必须保持可用。
- 不使用在线纹理、CDN 或新增 npm 依赖。
- 单阶段三角面上限 250k、目标文件大小不超过 12 MB、draw call 目标不超过 40。
- 所有实现与提交均在 `codex/phosphogypsum-site-glb` 分支完成。

---

### Task 1: 阶段资产路径与并发缓存

**Files:**
- Create: `src/scene/stageModelAssets.js`
- Create: `tests/scene/stageModelAssets.test.js`

**Interfaces:**
- Produces: `STAGE_MODEL_URLS: Readonly<Record<string, string>>`
- Produces: `createStageAssetRepository({ load }): { preloadAll(), acquire(stageId), dispose() }`
- `acquire(stageId)` resolves to `{ scene: THREE.Object3D, release(): void }` or `null` after a handled load failure.

- [ ] **Step 1: Write failing tests for URL selection, concurrent deduplication, cloning and failure isolation**

```js
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  STAGE_MODEL_URLS,
  createStageAssetRepository,
} from '../../src/scene/stageModelAssets.js';

describe('stage model asset repository', () => {
  it('maps every supported stage to its local GLB', () => {
    expect(STAGE_MODEL_URLS).toEqual({
      pit: '/assets/models/pit.glb',
      liner: '/assets/models/liner.glb',
      stack: '/assets/models/stack.glb',
      cover: '/assets/models/cover.glb',
      restoration: '/assets/models/restoration.glb',
    });
  });

  it('deduplicates concurrent loads and returns independent scene clones', async () => {
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const load = vi.fn(async () => ({ scene: source }));
    const repository = createStageAssetRepository({ load });

    const [first, second] = await Promise.all([
      repository.acquire('stack'),
      repository.acquire('stack'),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(first.scene).not.toBe(second.scene);
    expect(first.scene.children[0].geometry).toBe(second.scene.children[0].geometry);
    first.release();
    second.release();
    repository.dispose();
  });

  it('returns null for one failed stage without poisoning other stages', async () => {
    const load = vi.fn(async url => {
      if (url.endsWith('/liner.glb')) throw new Error('missing');
      return { scene: new THREE.Group() };
    });
    const repository = createStageAssetRepository({ load, warn: vi.fn() });

    expect(await repository.acquire('liner')).toBeNull();
    expect(await repository.acquire('stack')).not.toBeNull();
    repository.dispose();
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- tests/scene/stageModelAssets.test.js`

Expected: FAIL because `src/scene/stageModelAssets.js` does not exist.

- [ ] **Step 3: Implement the repository with a URL-keyed Promise cache and reference-safe clone handles**

```js
import { SkeletonUtils } from 'three/addons/utils/SkeletonUtils.js';
import { TERRAIN_STAGE_IDS } from './terrainProfiles.js';

export const STAGE_MODEL_URLS = Object.freeze(Object.fromEntries(
  TERRAIN_STAGE_IDS.map(stageId => [stageId, `/assets/models/${stageId}.glb`]),
));

export function createStageAssetRepository({ load, warn = console.warn }) {
  const entries = new Map();
  const failed = new Set();
  let disposed = false;

  async function getSource(stageId) {
    if (!(stageId in STAGE_MODEL_URLS)) throw new Error(`Unknown model stage: ${stageId}`);
    if (disposed || failed.has(stageId)) return null;
    if (!entries.has(stageId)) {
      const promise = load(STAGE_MODEL_URLS[stageId]).catch((error) => {
        failed.add(stageId);
        warn(`Stage GLB unavailable (${stageId}); using procedural fallback.`, error);
        return null;
      });
      entries.set(stageId, { promise, handles: 0 });
    }
    return entries.get(stageId).promise;
  }

  async function acquire(stageId) {
    const gltf = await getSource(stageId);
    if (!gltf || disposed) return null;
    const entry = entries.get(stageId);
    entry.handles += 1;
    let released = false;
    return {
      scene: SkeletonUtils.clone(gltf.scene),
      release() {
        if (released) return;
        released = true;
        entry.handles -= 1;
      },
    };
  }

  return {
    acquire,
    preloadAll: () => Promise.all(TERRAIN_STAGE_IDS.map(getSource)),
    dispose() { disposed = true; entries.clear(); failed.clear(); },
  };
}
```

- [ ] **Step 4: Run the focused test and full suite**

Run: `npm test -- tests/scene/stageModelAssets.test.js`

Expected: 3 tests PASS.

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/scene/stageModelAssets.js tests/scene/stageModelAssets.test.js
git commit -m "feat: add cached stage GLB repository"
```

---

### Task 2: GLB 实例规范化与阶段切换控制器

**Files:**
- Create: `src/scene/createStageModelLoader.js`
- Create: `tests/scene/createStageModelLoader.test.js`

**Interfaces:**
- Consumes: `repository.acquire(stageId)` from Task 1.
- Produces: `createStageModelLoader(repository): { root, applyStage(stageId), preload(), update(deltaSeconds), dispose() }`
- `applyStage(stageId)` is synchronous to preserve callers and starts an internal asynchronous request.

- [ ] **Step 1: Write failing behavior tests for fallback visibility, stale-request protection and stage material fallback**

```js
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createStageModelLoader } from '../../src/scene/createStageModelLoader.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

describe('stage model loader', () => {
  it('keeps procedural fallback visible until the selected GLB is ready', async () => {
    const request = deferred();
    const fallback = new THREE.Group();
    const loader = createStageModelLoader({ acquire: () => request.promise }, fallback);
    loader.applyStage('stack');
    expect(fallback.visible).toBe(true);
    request.resolve({ scene: new THREE.Group(), release() {} });
    await Promise.resolve();
    await Promise.resolve();
    expect(fallback.visible).toBe(false);
    expect(loader.root.getObjectByName('stage-glb-stack')).toBeTruthy();
  });

  it('ignores a late result from an older stage selection', async () => {
    const pit = deferred();
    const stack = deferred();
    const fallback = new THREE.Group();
    const loader = createStageModelLoader({
      acquire: stage => (stage === 'pit' ? pit.promise : stack.promise),
    }, fallback);
    loader.applyStage('pit');
    loader.applyStage('stack');
    stack.resolve({ scene: new THREE.Group(), release() {} });
    await Promise.resolve(); await Promise.resolve();
    pit.resolve({ scene: new THREE.Group(), release() {} });
    await Promise.resolve(); await Promise.resolve();
    expect(loader.root.getObjectByName('stage-glb-stack')).toBeTruthy();
    expect(loader.root.getObjectByName('stage-glb-pit')).toBeFalsy();
  });

  it('keeps fallback visible when acquisition fails', async () => {
    const fallback = new THREE.Group();
    const loader = createStageModelLoader({ acquire: async () => null }, fallback);
    loader.applyStage('liner');
    await Promise.resolve(); await Promise.resolve();
    expect(fallback.visible).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/scene/createStageModelLoader.test.js`

Expected: FAIL because the loader module does not exist.

- [ ] **Step 3: Implement stage normalization and latest-request-wins switching**

Implementation requirements:

```js
const STAGE_FALLBACK_COLORS = {
  pit: '#655f55', liner: '#22292c', stack: '#c9c8c1',
  cover: '#756957', restoration: '#647653',
};

function normalizeScene(scene, stageId) {
  scene.name = `stage-glb-${stageId}`;
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (!object.material) {
      object.material = new THREE.MeshStandardMaterial({
        color: STAGE_FALLBACK_COLORS[stageId], roughness: 0.94,
      });
    }
  });
  return scene;
}
```

`applyStage` increments a request token, makes fallback visible immediately, releases/removes the previous GLB, and only mounts the resolved handle when its token and stage still match. A null result leaves fallback visible. `dispose` invalidates outstanding requests and releases the active handle. `update` fades newly mounted materials from opacity 0 to 1 over 0.25 seconds while the fallback remains visible, then hides fallback.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- tests/scene/createStageModelLoader.test.js`

Expected: 3 tests PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/scene/createStageModelLoader.js tests/scene/createStageModelLoader.test.js
git commit -m "feat: add resilient stage model switching"
```

---

### Task 3: 接入现有 createSiteModel 公共接口

**Files:**
- Modify: `src/scene/createSiteModel.js`
- Create: `tests/scene/createSiteModel.test.js`

**Interfaces:**
- Consumes: `createStageAssetRepository`, `createStageModelLoader`.
- Preserves: `createSiteModel(renderer, options): { root, applyStage, update, dispose }`.
- Adds option: `options.loadStageGlb?: (url: string) => Promise<GLTF>` for deterministic tests.
- Adds option: `options.preloadStageModels?: boolean`, default `true`.

- [ ] **Step 1: Write a failing integration test proving existing stage calls drive fallback and GLB together**

```js
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteModel } from '../../src/scene/createSiteModel.js';

describe('site model GLB integration', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect() {}, set fillStyle(value) {}, set globalAlpha(value) {},
    });
  });

  it('preserves the synchronous stage config while mounting a loaded model', async () => {
    const loadStageGlb = vi.fn(async () => ({ scene: new THREE.Group() }));
    const model = createSiteModel(
      { capabilities: { getMaxAnisotropy: () => 4 } },
      { loadImages: false, segmentsX: 8, segmentsZ: 6, loadStageGlb, preloadStageModels: false },
    );
    const config = model.applyStage('stack');
    await Promise.resolve(); await Promise.resolve();
    expect(config.targetY).toBe(1.25);
    expect(model.root.getObjectByName('stage-glb-stack')).toBeTruthy();
    model.dispose();
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/scene/createSiteModel.test.js`

Expected: FAIL because `createSiteModel` does not yet mount a GLB loader.

- [ ] **Step 3: Wire the default GLTFLoader and retain the procedural group as fallback**

Create the procedural terrain, engineering and vegetation under a named `procedural-site-fallback` group. Instantiate `GLTFLoader` only when no injected loader is provided:

```js
const gltfLoader = new GLTFLoader();
const loadStageGlb = options.loadStageGlb
  ?? (url => gltfLoader.loadAsync(url));
const repository = createStageAssetRepository({ load: loadStageGlb });
const stageModels = createStageModelLoader(repository, proceduralRoot);
root.add(stageModels.root);
```

`applyStage` must first apply the procedural stage and then call `stageModels.applyStage(stageId)`. `update` updates both transition systems. `dispose` disposes GLB controller/repository before procedural assets. Trigger `stageModels.preload()` only when `preloadStageModels !== false`, and ensure rejected preload promises are internally handled.

- [ ] **Step 4: Run focused test, existing scene tests and full suite**

Run: `npm test -- tests/scene/createSiteModel.test.js tests/scene/createUnifiedTerrain.test.js tests/scene/createScene.test.js`

Expected: all selected tests PASS.

Run: `npm test`

Expected: all tests PASS with no unhandled promise rejection.

- [ ] **Step 5: Commit**

```powershell
git add src/scene/createSiteModel.js tests/scene/createSiteModel.test.js
git commit -m "feat: integrate GLB stages with procedural fallback"
```

---

### Task 4: Blender 主体几何生成器

**Files:**
- Create: `scripts/blender/terrain_generator.py`
- Create: `scripts/blender/generate_phosphogypsum_site.py`
- Create: `tests/blender/test_generation.py`

**Interfaces:**
- Produces: `create_site_terrain(stage_id: str, seed: int = 7639) -> bpy.types.Collection`
- Produces CLI: `generate_phosphogypsum_site.py --stage <all|stage> --output <directory>` after Blender's `--` separator.

- [ ] **Step 1: Write a Blender integration test for the four terraces, broad top and irregular boundary**

```python
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'blender'))
from terrain_generator import create_site_terrain

class TerrainGenerationTest(unittest.TestCase):
    def test_stack_has_four_terraces_and_broad_top(self):
        collection = create_site_terrain('stack', seed=7639)
        names = {obj.name for obj in collection.objects}
        self.assertTrue({'StackSlope01', 'StackSlope02', 'StackSlope03', 'StackSlope04', 'StackTop'} <= names)
        top = collection.objects['StackTop']
        self.assertGreater(top.dimensions.x, 34.0)
        self.assertGreater(top.dimensions.y, 25.0)
        self.assertLess(top.dimensions.z, 1.2)

    def test_pit_floor_is_below_the_rim(self):
        collection = create_site_terrain('pit', seed=7639)
        self.assertLess(collection.objects['PitFloor'].location.z, collection.objects['PitRim'].location.z - 2.0)

if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run and verify RED inside Blender**

Run:

```powershell
& 'D:\Softwares\Blender\blender.exe' --background --factory-startup --python tests/blender/test_generation.py
```

Expected: non-zero exit because `terrain_generator` is missing.

- [ ] **Step 3: Implement deterministic irregular rings and stage geometry**

Use 192 angular samples. For angle `a` and normalized inset `s`, compute the boundary radius with fixed harmonics rather than per-run randomness:

```python
radius_noise = 1.0 + 0.045 * math.sin(3*a + 0.6) + 0.028 * math.sin(7*a - 0.4) + 0.014 * math.sin(11*a + 1.1)
x = center_x + (54.0 * s) * radius_noise * math.cos(a)
y = center_y + (44.0 * s) * (1.0 + 0.02 * math.sin(5*a)) * math.sin(a)
```

Build watertight quads between these stack rings `(scale, z)`: `(1.00,0.2)`, `(0.88,2.2)`, `(0.82,2.2)`, `(0.70,4.3)`, `(0.64,4.3)`, `(0.53,6.4)`, `(0.47,6.4)`, `(0.37,8.4)`, `(0.31,8.4)`. Offset alternating ring centers by at most 1.3 units. Triangulate for export, shade smooth only on slopes, and preserve flat platform normals.

For pit/liner, reverse the elevation profile from rim `0.1` to floor `-4.1`, retaining a wide irregular floor. For cover/restoration, reuse stack vertices with lifts of `0.18` and `0.28` respectively. Add restrained seeded displacement: maximum `0.08` on platforms and `0.16` on slopes.

The CLI clears the default scene, validates `stage_id`, invokes the generator, and exits non-zero on errors.

- [ ] **Step 4: Run Blender tests**

Run the command from Step 2.

Expected: Blender exits 0 and unittest reports 2 tests OK.

- [ ] **Step 5: Commit**

```powershell
git add scripts/blender/terrain_generator.py scripts/blender/generate_phosphogypsum_site.py tests/blender/test_generation.py
git commit -m "feat: generate staged engineering terrain in Blender"
```

---

### Task 5: Blender 材质、道路、排水和植被细节

**Files:**
- Create: `scripts/blender/materials.py`
- Create: `scripts/blender/roads.py`
- Create: `scripts/blender/drainage.py`
- Modify: `scripts/blender/terrain_generator.py`
- Modify: `scripts/blender/generate_phosphogypsum_site.py`
- Modify: `tests/blender/test_generation.py`

**Interfaces:**
- Produces: `create_stage_materials(stage_id) -> dict[str, bpy.types.Material]`
- Produces: `create_haul_roads(stage_id, height_sampler, collection) -> list[bpy.types.Object]`
- Produces: `create_drainage(stage_id, height_sampler, collection) -> list[bpy.types.Object]`
- Produces: `create_restoration_plants(height_sampler, collection, seed) -> list[bpy.types.Object]`

- [ ] **Step 1: Extend Blender tests to describe visible stage-specific details**

```python
def test_stage_details_are_distinct(self):
    expectations = {
        'pit': {'PitAccessRoad'},
        'liner': {'Geomembrane', 'LinerSeams', 'DrainagePipe'},
        'stack': {'HaulRoad', 'BenchRoad', 'CompactionBands'},
        'cover': {'CoverSoil', 'CoverTracks'},
        'restoration': {'VegetationPatches', 'Shrubs', 'YoungTrees'},
    }
    for stage, required in expectations.items():
        collection = create_site_terrain(stage, seed=7639)
        self.assertTrue(required <= {obj.name for obj in collection.objects})

def test_stack_material_is_gray_white_and_rough(self):
    collection = create_site_terrain('stack', seed=7639)
    material = collection.objects['StackTop'].data.materials[0]
    principled = material.node_tree.nodes.get('Principled BSDF')
    color = principled.inputs['Base Color'].default_value
    self.assertGreater(min(color[:3]), 0.56)
    self.assertGreater(principled.inputs['Roughness'].default_value, 0.75)
```

- [ ] **Step 2: Run Blender tests and verify RED**

Run: `& 'D:\Softwares\Blender\blender.exe' --background --factory-startup --python tests/blender/test_generation.py`

Expected: FAIL because the named details and assigned material do not yet exist.

- [ ] **Step 3: Implement local procedural PBR materials**

Use Principled BSDF base colors and roughness: gypsum `#c7c5bd / 0.92`, gypsum-light `#d8d7d0 / 0.88`, liner `#252b2e / 0.78`, rock-soil `#655f55 / 0.96`, cover `#776b58 / 0.94`, road `#77736a / 0.98`, vegetation `#65774f / 0.97`. Connect low-scale Noise Texture through Bump with strength at most `0.18`; do not reference image paths or network resources.

- [ ] **Step 4: Implement roads and engineering details**

Build the main road as an 8 m wide beveled curve following control points `(-48,-20)`, `(-31,-13)`, `(-16,-20)`, `(1,-13)`, `(18,-4)`, `(9,10)`, `(-2,7)`, sampling the terrain height plus `0.06`. Add a 5 m wide partial bench road on the third platform. Use closely spaced narrow ribbons for compaction bands, seam strips for liner, a shallow trapezoid drainage channel at the slope toe, and a 0.45 m pipe.

For restoration, create three shared low-poly meshes and link duplicates: grass patches, 90 shrubs and 24 young trees. Reject candidate positions inside road corridors and leave at least 22% of the cover visually bare.

- [ ] **Step 5: Run Blender tests and inspect generated object statistics**

Run: `& 'D:\Softwares\Blender\blender.exe' --background --factory-startup --python tests/blender/test_generation.py`

Expected: all Blender unittest cases PASS. The script prints per-stage object and triangle counts; every reported stage remains below 250k triangles.

- [ ] **Step 6: Commit**

```powershell
git add scripts/blender/materials.py scripts/blender/roads.py scripts/blender/drainage.py scripts/blender/terrain_generator.py scripts/blender/generate_phosphogypsum_site.py tests/blender/test_generation.py
git commit -m "feat: add staged materials and engineering details"
```

---

### Task 6: GLB 导出、资产校验与五阶段生成

**Files:**
- Create: `scripts/blender/export_glb.py`
- Create: `scripts/blender/validate_exports.py`
- Modify: `scripts/blender/generate_phosphogypsum_site.py`
- Create: `public/assets/models/pit.glb`
- Create: `public/assets/models/liner.glb`
- Create: `public/assets/models/stack.glb`
- Create: `public/assets/models/cover.glb`
- Create: `public/assets/models/restoration.glb`

**Interfaces:**
- Produces: `export_stage(collection, stage_id, output_dir) -> pathlib.Path`
- Produces CLI validator returning non-zero unless all five files are valid binary glTF and within budgets.

- [ ] **Step 1: Write the validator before generating assets**

The validator must independently parse each GLB header and JSON chunk using `struct` and `json`. It asserts magic bytes `b'glTF'`, version `2`, declared file length equals actual length, required scene/node/mesh arrays are non-empty, file size is at most `12 * 1024 * 1024`, and named scene includes the stage ID. It prints one row per stage with bytes, meshes, materials and primitives.

- [ ] **Step 2: Run validator and verify RED**

Run:

```powershell
& 'D:\Softwares\Blender\4.5\python\bin\python.exe' scripts/blender/validate_exports.py public/assets/models
```

Expected: non-zero exit listing all five missing GLB files.

- [ ] **Step 3: Implement deterministic export**

`export_glb.py` selects only the requested stage collection, applies transforms, recalculates outside normals, removes orphaned data and calls:

```python
bpy.ops.export_scene.gltf(
    filepath=str(output_path),
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_materials='EXPORT',
    export_yup=True,
)
```

Set the scene name to `Phosphogypsum_<stage>` and use stable object names required by tests.

- [ ] **Step 4: Generate all five assets**

Run:

```powershell
& 'D:\Softwares\Blender\blender.exe' --background --factory-startup --python scripts/blender/generate_phosphogypsum_site.py -- --stage all --output public/assets/models
```

Expected: exit 0 and five GLB files created.

- [ ] **Step 5: Validate generated files and budgets**

Run: `& 'D:\Softwares\Blender\4.5\python\bin\python.exe' scripts/blender/validate_exports.py public/assets/models`

Expected: exit 0; five PASS rows; every file at most 12 MB.

- [ ] **Step 6: Run web tests and production build against real assets**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: exit 0; Vite emits `dist` with copied `/assets/models/*.glb` files.

- [ ] **Step 7: Commit**

```powershell
git add scripts/blender/export_glb.py scripts/blender/validate_exports.py scripts/blender/generate_phosphogypsum_site.py public/assets/models
git commit -m "feat: export five phosphogypsum GLB stages"
```

---

### Task 7: 生成流程与 fallback 文档

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents the exact Blender 4.5 commands, paths, web commands and recoverable fallback check.

- [ ] **Step 1: Add a focused README section**

Document:

```powershell
# 生成全部阶段
& 'D:\Softwares\Blender\blender.exe' --background --factory-startup --python scripts/blender/generate_phosphogypsum_site.py -- --stage all --output public/assets/models

# 仅重新生成堆填阶段
& 'D:\Softwares\Blender\blender.exe' --background --factory-startup --python scripts/blender/generate_phosphogypsum_site.py -- --stage stack --output public/assets/models

# 校验 GLB
& 'D:\Softwares\Blender\4.5\python\bin\python.exe' scripts/blender/validate_exports.py public/assets/models

# 启动与检查
npm test
npm run build
npm run dev
```

Explain that `public/assets/models/` is served as `/assets/models/`, the page initially displays the procedural model, and a missing/corrupt GLB causes only that stage to stay on fallback. For a reversible manual fallback check, instruct the reader to rename one file to `.glb.disabled`, refresh and restore its exact original name afterward; do not suggest deleting assets.

- [ ] **Step 2: Verify README commands and links**

Run the validator, `npm test`, and `npm run build` exactly as documented.

Expected: all three commands exit 0.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: document Blender model generation and fallback"
```

---

### Task 8: 浏览器视觉验收与最终回归

**Files:**
- Modify only files implicated by a reproduced defect; every defect fix begins with a failing automated test where feasible.

**Interfaces:**
- Verifies the complete user-facing behavior at 1920×1080.

- [ ] **Step 1: Start the production preview**

Run: `npm run build` then `npm run preview -- --host 127.0.0.1`

Expected: build exits 0 and preview reports a local URL.

- [ ] **Step 2: Inspect all five stages in the browser**

At a 1920×1080 viewport, verify:

- pit: irregular excavation, rough floor, exposed slopes and access road.
- liner: dark membrane, seams, restrained wrinkles and drainage details.
- stack: unmistakably gray-white phosphogypsum, four terraces, broad top and connected haul road.
- cover: same engineering silhouette with warmer thin soil and compaction tracks.
- restoration: patchy grass, shrubs, young trees, bare soil and retained road structure.
- Drag rotation and wheel zoom remain responsive.
- Both site buttons retain the same loaded model and update their data panels.
- Browser console contains no error and no repeated warning for successful assets.

- [ ] **Step 3: Perform a reversible fallback check**

Stop preview, rename `public/assets/models/stack.glb` to `stack.glb.disabled`, restart preview, select stack, and verify the gray-white programmatic stack remains visible with one warning and no white screen. Restore the original filename immediately and verify GLB loading returns.

- [ ] **Step 4: Run final verification from a clean process**

Run:

```powershell
& 'D:\Softwares\Blender\blender.exe' --background --factory-startup --python tests/blender/test_generation.py
& 'D:\Softwares\Blender\4.5\python\bin\python.exe' scripts/blender/validate_exports.py public/assets/models
npm test
npm run build
git diff --check
git status --short
```

Expected: Blender tests PASS; five exports validate; Vitest has zero failures; Vite build exits 0; diff check is empty; status contains no unintended paths. The pre-existing untracked `报告撰写参考资料/` directory may remain and must not be committed.

If visual inspection finds a defect, stop this task, add a focused failing regression test to the task that owns the affected component, implement the correction through RED/GREEN, and commit only those explicitly reviewed files before repeating Steps 1–4.
