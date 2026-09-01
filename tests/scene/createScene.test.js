import { describe, expect, it } from 'vitest';
import { createScene } from '../../src/scene/createScene.js';

describe('createScene', () => {
  it('reports a clear error when WebGL is unavailable', () => {
    const originalWebGL = window.WebGLRenderingContext;
    window.WebGLRenderingContext = undefined;
    const canvas = document.createElement('canvas');

    expect(() => createScene(canvas)).toThrow('WEBGL_UNAVAILABLE');

    window.WebGLRenderingContext = originalWebGL;
  });
});
