import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSiteModel } from './createSiteModel.js';

export function createScene(canvas) {
  if (!window.WebGLRenderingContext) {
    throw new Error('WEBGL_UNAVAILABLE');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#8fa9a8', 0.017);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
  camera.position.set(16, 12, 19);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 12;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.42;
  controls.target.set(0, 1.4, 0);

  const ambientLight = new THREE.HemisphereLight('#e1f2ff', '#58442e', 1.7);
  scene.add(ambientLight);

  const sun = new THREE.DirectionalLight('#fff0d2', 3.35);
  sun.position.set(-11, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.00025;
  scene.add(sun);

  const fillLight = new THREE.DirectionalLight('#70b8dd', 0.65);
  fillLight.position.set(12, 7, -10);
  scene.add(fillLight);

  const model = createSiteModel(renderer);
  model.root.rotation.y = -0.18;
  model.root.scale.setScalar(0.94);
  scene.add(model.root);

  let frameId = 0;

  function render() {
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(render);
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setStage(stageId) {
    const config = model.applyStage(stageId);
    controls.target.y = config.targetY;
    controls.update();
  }

  function dispose() {
    cancelAnimationFrame(frameId);
    controls.dispose();
    model.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  resize();
  render();
  return { setStage, resize, dispose };
}

