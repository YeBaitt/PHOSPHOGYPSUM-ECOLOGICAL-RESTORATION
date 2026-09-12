import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDynamicSky } from '../../src/scene/createDynamicSky.js';

describe('dynamic sky', () => {
  it('surrounds the scene without an image map and advances cloud time', () => {
    const sky = createDynamicSky();
    expect(sky.root.name).toBe('dynamic-sky');
    const dome = sky.root.getObjectByName('sky-dome');
    expect(dome.material.side).toBe(THREE.BackSide);
    expect(dome.material.map).toBeUndefined();
    const clouds = sky.root.getObjectByName('volumetric-clouds');
    expect(clouds.isInstancedMesh).toBe(true);
    expect(clouds.frustumCulled).toBe(false);
    expect(sky.root.getObjectByName('sun-disc').isMesh).toBe(true);
    expect(sky.root.getObjectByName('horizon-haze').isMesh).toBe(true);
    const before = dome.material.uniforms.uTime.value;

    sky.update(2.5);

    expect(dome.material.uniforms.uTime.value).toBeCloseTo(before + 2.5);
    sky.dispose();
  });
});
