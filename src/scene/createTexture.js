import * as THREE from 'three';

const palettes = {
  soil: ['#6a4a2d', '#87613c', '#4d3827'],
  gypsum: ['#d8d6ce', '#f0eee7', '#b9bab5'],
  liner: ['#11171a', '#263137', '#080b0d'],
  grass: ['#345f2b', '#527f38', '#243f20'],
};

const assetTextures = {
  rock: { fallback: 'soil', path: '/assets/terrain/rock-soil.png' },
  liner: { fallback: 'liner', path: '/assets/terrain/geomembrane.png' },
  gypsum: { fallback: 'gypsum', path: '/assets/terrain/phosphogypsum.png' },
  cover: { fallback: 'soil', path: '/assets/terrain/topsoil.png' },
  grass: { fallback: 'grass', path: '/assets/terrain/vegetation.png' },
};

function seeded(index) {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function createTexture(kind, renderer) {
  const colors = palettes[kind];
  if (!colors) {
    throw new Error(`Unknown texture: ${kind}`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  context.fillStyle = colors[0];
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 900; index += 1) {
    const size = 1 + seeded(index + 3) * 5;
    context.globalAlpha = 0.12 + seeded(index + 7) * 0.24;
    context.fillStyle = colors[index % colors.length];
    context.fillRect(
      seeded(index + 11) * canvas.width,
      seeded(index + 17) * canvas.height,
      size,
      size,
    );
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

export function createAssetTexture(kind, renderer, options = {}) {
  const config = assetTextures[kind];
  if (!config) {
    throw new Error(`Unknown asset texture: ${kind}`);
  }

  const texture = createTexture(config.fallback, renderer);
  texture.userData.assetPath = config.path;
  if (options.loadImage === false) return texture;

  new THREE.ImageLoader().load(
    config.path,
    (image) => {
      texture.image = image;
      texture.needsUpdate = true;
    },
    undefined,
    () => {
      // Keep the generated canvas texture as a local, readable fallback.
    },
  );
  return texture;
}

