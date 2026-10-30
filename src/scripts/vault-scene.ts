import * as THREE from 'three';

export function initVaultCanvas(canvas: HTMLCanvasElement): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 4;

  const count = reduced ? 400 : 1200;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x6ee7ff,
    size: 0.02,
    transparent: true,
    opacity: 0.65,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  const animate = () => {
    if (!reduced) {
      points.rotation.y += 0.0008;
      points.rotation.x += 0.0003;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };
  animate();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    geo.dispose();
    mat.dispose();
    renderer.dispose();
  };
}

const canvas = document.querySelector<HTMLCanvasElement>('.vault__canvas');
if (canvas) initVaultCanvas(canvas);
