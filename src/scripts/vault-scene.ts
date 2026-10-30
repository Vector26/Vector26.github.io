import * as THREE from 'three';

const PITCH = 0.2;
const CUBE = 0.17;
const WIDE = 900;

type Voxel = { home: THREE.Vector3; from: THREE.Vector3; spin: THREE.Euler; delay: number; shackle: boolean; out: THREE.Vector3 };

function buildPadlock(): Voxel[] {
  const cells: { p: THREE.Vector3; shackle: boolean }[] = [];
  const keyhole = new Set(['0,-1', '0,-2', '0,-3']);
  for (let x = -3; x <= 3; x++) {
    for (let y = -5; y <= -1; y++) {
      for (const z of [0, 1]) {
        if (z === 0 && keyhole.has(`${x},${y}`)) continue;
        cells.push({ p: new THREE.Vector3(x, y, -z), shackle: false });
      }
    }
  }
  for (const x of [-2, 2]) {
    for (const y of [0, 1]) cells.push({ p: new THREE.Vector3(x, y, -0.5), shackle: true });
  }
  const arc = 11;
  for (let i = 0; i <= arc; i++) {
    const t = (i / arc) * Math.PI;
    cells.push({ p: new THREE.Vector3(Math.cos(t) * 2, 1.6 + Math.sin(t) * 2, -0.5), shackle: true });
  }
  return cells.map(({ p, shackle }) => {
    const home = p.multiplyScalar(PITCH).add(new THREE.Vector3(0, 0.25, 0));
    const dir = home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)).normalize();
    return {
      home,
      from: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
      spin: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      delay: Math.random() * 0.45,
      shackle,
      out: dir.multiplyScalar(1.5 + Math.random() * 2.5),
    };
  });
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const smooth = (a: number, b: number, t: number) => ease((t - a) / (b - a));

export function initVaultCanvas(canvas: HTMLCanvasElement): void {
  const stage = canvas.parentElement;
  const copy = stage?.querySelector<HTMLElement>('.vault__copy');
  if (!stage || !copy) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x6ee7ff, 18, 12);
  rim.position.set(-2.5, 1, 2.5);
  scene.add(rim);

  const voxels = buildPadlock();
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CUBE, CUBE, CUBE),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.32 }),
    voxels.length,
  );
  const steel = new THREE.Color(0x29313b);
  const glow = new THREE.Color(0x6ee7ff);
  voxels.forEach((v, i) => mesh.setColorAt(i, v.shackle ? new THREE.Color(0x3a4552) : Math.random() < 0.1 ? glow : steel));
  const lock = new THREE.Group();
  lock.add(mesh);
  scene.add(lock);

  const dustCount = reduced ? 300 : 900;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 16;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x6ee7ff, size: 0.018, transparent: true, opacity: 0.45 }));
  scene.add(dust);

  const box = new THREE.Box3();
  voxels.forEach((v) => box.expandByPoint(v.home));
  const modelH = box.max.y - box.min.y + CUBE + 0.6 * PITCH * 3;
  const modelCenterY = (box.max.y + box.min.y) / 2;

  let w = 1;
  let h = 1;
  const layout = () => {
    w = stage.clientWidth;
    h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const viewH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const toWorld = (px: number, py: number) => new THREE.Vector2((px / w - 0.5) * viewH * camera.aspect, -(py / h - 0.5) * viewH);
    let px: number;
    let py: number;
    let sizePx: number;
    if (w >= WIDE) {
      px = w * 0.74;
      py = h * 0.5;
      sizePx = Math.min(h * 0.62, w * 0.3);
    } else {
      const reserve = parseFloat(getComputedStyle(copy).paddingTop) || h * 0.4;
      px = w / 2;
      py = reserve * 0.52;
      sizePx = Math.min(reserve * 0.8, w * 0.62);
    }
    const target = toWorld(px, py);
    const s = ((sizePx / h) * viewH) / modelH;
    lock.scale.setScalar(s);
    lock.position.set(target.x, target.y - modelCenterY * s, 0);
  };

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  const writeVoxels = (assemble: number, unlock: number, scatter: number) => {
    voxels.forEach((v, i) => {
      const a = ease((assemble - v.delay) / (1 - 0.45));
      pos.copy(v.from).lerp(v.home, a);
      if (v.shackle) pos.y += unlock * 0.55;
      pos.addScaledVector(v.out, scatter);
      q.setFromEuler(new THREE.Euler(v.spin.x * (1 - a + scatter), v.spin.y * (1 - a + scatter), v.spin.z * (1 - a)));
      m.compose(pos, q, one.clone().multiplyScalar(1 - scatter * 0.6));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  let pointerX = 0;
  let pointerY = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      pointerX = e.clientX / window.innerWidth - 0.5;
      pointerY = e.clientY / window.innerHeight - 0.5;
    },
    { passive: true },
  );

  const progress = () => {
    const r = stage.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / (r.height * 0.85)));
  };

  let introStart = -1;
  let p = 0;
  let rotY = 0;
  let rotX = 0;
  let visible = true;
  let raf = 0;

  const frame = (now: number) => {
    if (introStart < 0) introStart = now;
    const assemble = reduced ? 1 : Math.min(1, (now - introStart) / 1900);
    p += (progress() - p) * (reduced ? 1 : 0.1);
    const unlock = smooth(0.05, 0.4, p);
    const scatter = reduced ? 0 : smooth(0.45, 1, p);
    writeVoxels(assemble, unlock, scatter);

    const idle = reduced ? 0 : Math.sin(now / 2400) * 0.12;
    rotY += (-0.45 + p * 1.4 + idle + pointerX * 0.5 - rotY) * 0.06;
    rotX += (0.12 + pointerY * 0.3 - rotX) * 0.06;
    lock.rotation.set(rotX, rotY, 0);
    if (!reduced) dust.rotation.y += 0.0004;
    renderer.render(scene, camera);
    raf = visible ? requestAnimationFrame(frame) : 0;
  };

  const start = () => {
    layout();
    new ResizeObserver(layout).observe(stage);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(stage);
    raf = requestAnimationFrame(frame);
  };

  const boot = document.getElementById('boot');
  if (boot && !boot.classList.contains('is-removed') && !boot.classList.contains('is-done')) {
    const mo = new MutationObserver(() => {
      if (boot.classList.contains('is-done') || boot.classList.contains('is-removed')) {
        mo.disconnect();
        start();
      }
    });
    mo.observe(boot, { attributes: true, attributeFilter: ['class'] });
  } else {
    start();
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('.vault__canvas');
if (canvas) initVaultCanvas(canvas);
