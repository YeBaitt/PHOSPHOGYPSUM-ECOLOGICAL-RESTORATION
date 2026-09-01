import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDynamicSky } from '../../src/scene/createDynamicSky.js';

describe('dynamic sky', () => {
  it('surrounds the scene without an image map and advances cloud time', () => {
    const sky = createDynamicSky();
    expect(sky.root.name).toBe('dynamic-sky');
    expect(sky.root.material.side).toBe(THREE.BackSide);
    expect(sky.root.material.map).toBeUndefined();
    const before = sky.root.material.uniforms.uTime.value;

    sky.update(2.5);

    expect(sky.root.material.uniforms.uTime.value).toBeCloseTo(before + 2.5);
    sky.dispose();
  });
});
