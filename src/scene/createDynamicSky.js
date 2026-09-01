import * as THREE from 'three';

const vertexShader = `
  varying vec3 vDirection;

  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uCloudSpeed;
  uniform vec3 uHorizonColor;
  uniform vec3 uZenithColor;
  varying vec3 vDirection;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), local.x),
      local.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave += 1) {
      value += noise(point) * amplitude;
      point = point * 2.03 + vec2(17.4, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    float horizon = smoothstep(0.18, 0.72, vDirection.y);
    vec3 sky = mix(uHorizonColor, uZenithColor, horizon);
    vec2 cloudUv = vDirection.xz / max(0.18, vDirection.y + 0.42);
    float cloudField = fbm(cloudUv * 1.35 + vec2(uTime * uCloudSpeed, 0.0));
    float clouds = smoothstep(0.44, 0.66, cloudField);
    float cloudAltitude = smoothstep(0.12, 0.42, vDirection.y);
    sky = mix(sky, vec3(0.9, 0.92, 0.93), clouds * cloudAltitude * 0.78);
    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createDynamicSky() {
  const geometry = new THREE.SphereGeometry(75, 48, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCloudSpeed: { value: 0.012 },
      uHorizonColor: { value: new THREE.Color('#a9c2ca') },
      uZenithColor: { value: new THREE.Color('#527995') },
    },
    vertexShader,
    fragmentShader,
  });
  const root = new THREE.Mesh(geometry, material);
  root.name = 'dynamic-sky';
  root.frustumCulled = false;
  root.renderOrder = -100;

  function update(deltaSeconds) {
    material.uniforms.uTime.value += deltaSeconds;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { root, update, dispose };
}
