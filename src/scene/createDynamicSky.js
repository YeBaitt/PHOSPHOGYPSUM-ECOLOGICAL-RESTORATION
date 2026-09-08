import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  const domeGeometry = new THREE.SphereGeometry(75, 48, 24);
  const domeMaterial = new THREE.ShaderMaterial({
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
  const dome = new THREE.Mesh(domeGeometry, domeMaterial);
  dome.name = 'sky-dome';
  dome.frustumCulled = false;
  dome.renderOrder = -100;

  const cloudLobes = [
    new THREE.IcosahedronGeometry(1, 1).scale(3.2, 1.05, 1.65),
    new THREE.IcosahedronGeometry(1, 1).scale(2.25, 1.35, 1.45).translate(-2.5, 0.2, 0),
    new THREE.IcosahedronGeometry(1, 1).scale(2.5, 1.5, 1.55).translate(2.2, 0.35, 0.1),
    new THREE.IcosahedronGeometry(1, 1).scale(1.9, 1.45, 1.35).translate(0.1, 0.75, -0.25),
  ];
  const cloudGeometry = mergeGeometries(cloudLobes, false);
  cloudLobes.forEach(geometry => geometry.dispose());
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: '#eef1f1', transparent: true, opacity: 0.72,
    depthWrite: false, fog: false,
  });
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 26);
  clouds.name = 'volumetric-clouds';
  clouds.frustumCulled = false;
  clouds.renderOrder = -90;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < clouds.count; index += 1) {
    const angle = index * 2.399;
    const radius = 47 + (index % 5) * 3.2;
    if (index < 7) {
      position.set(-27 + index * 9, 8 + (index % 3) * 1.8, -38 - (index % 2) * 4);
    } else {
      position.set(Math.cos(angle) * radius, 18 + (index % 4) * 2.8, Math.sin(angle) * radius);
    }
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle + index * 0.37);
    scale.set(0.65 + (index % 3) * 0.18, 0.7 + (index % 2) * 0.16, 0.7 + (index % 4) * 0.1);
    matrix.compose(position, rotation, scale);
    clouds.setMatrixAt(index, matrix);
  }
  clouds.instanceMatrix.needsUpdate = true;

  const sunGeometry = new THREE.CircleGeometry(3.2, 40);
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: '#ffe4aa', transparent: true, opacity: 0.82,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.name = 'sun-disc';
  sun.position.set(22, 12, -48);
  sun.lookAt(0, 5, 0);
  sun.renderOrder = -80;

  const hazeGeometry = new THREE.CylinderGeometry(67, 67, 12, 64, 1, true);
  const hazeMaterial = new THREE.MeshBasicMaterial({
    color: '#c4d0cf', transparent: true, opacity: 0.18,
    depthWrite: false, fog: false, side: THREE.BackSide,
  });
  const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
  haze.name = 'horizon-haze';
  haze.position.y = 3;
  haze.renderOrder = -85;

  const root = new THREE.Group();
  root.name = 'dynamic-sky';
  root.add(dome, clouds, haze, sun);

  function update(deltaSeconds) {
    domeMaterial.uniforms.uTime.value += deltaSeconds;
    clouds.rotation.y += deltaSeconds * 0.0025;
  }

  function dispose() {
    domeGeometry.dispose();
    cloudGeometry.dispose();
    sunGeometry.dispose();
    hazeGeometry.dispose();
    domeMaterial.dispose();
    cloudMaterial.dispose();
    sunMaterial.dispose();
    hazeMaterial.dispose();
  }

  return { root, update, dispose };
}
