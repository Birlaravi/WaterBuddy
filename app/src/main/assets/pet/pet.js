import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ANIMALS, build, pose } from './animals.js';

const CFG = {
  walkSpeed: 0.85,
  sadWalkSpeed: 0.5,
  stopFraction: 0.52,
  cameraFov: 28,
  walkYaw: 1.15,
  walkLook: 0.75,
  maxScale: 1.05
};

const params = new URLSearchParams(location.search);
let PET = params.get('pet') || 'random';
if (!ANIMALS.includes(PET)) PET = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
const INTERVAL = parseInt(params.get('interval') || '60', 10);

const A_BRIDGE = window.Android || { askShown() {}, answered() {}, finished() {} };

function label(min) {
  if (min < 60) return min + ' min';
  if (min % 60 === 0) return (min / 60) + (min === 60 ? ' hour' : ' hours');
  return min + ' min';
}

const card = document.getElementById('card');
const tEl = document.getElementById('t');
const sEl = document.getElementById('s');
const bEl = document.getElementById('b');
const cloud = document.getElementById('cloud');

function say(text, sub, buttons, sad) {
  tEl.textContent = text;
  sEl.textContent = sub;
  bEl.style.display = buttons ? 'flex' : 'none';
  card.classList.toggle('sad', !!sad);
  card.classList.add('on');
}
function hideCard() { card.classList.remove('on'); }

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-2.5, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -4; key.shadow.camera.right = 4;
key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
key.shadow.radius = 4;
scene.add(key);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.3 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(CFG.cameraFov, 1, 0.1, 100);
const camDist = 6;
let halfW = 2, startX = 3, stopX = 0.6;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(0, 1.0, camDist);
  camera.lookAt(0, 0.98, 0);
  camera.updateProjectionMatrix();
  halfW = Math.tan(THREE.MathUtils.degToRad(CFG.cameraFov / 2)) * camDist * camera.aspect;
  startX = halfW + 1.4;
  stopX = halfW * CFG.stopFraction;
}
window.addEventListener('resize', resize);
resize();

const rig = new THREE.Group();
scene.add(rig);
const animal = build(PET);
const scale = Math.min(CFG.maxScale, 2.0 / animal.hh);
animal.root.scale.setScalar(scale);
rig.add(animal.root);

const state = { name: 'in', t: 0, sadOut: false };
let x = startX, yaw = -CFG.walkYaw, look = CFG.walkLook, wph = 0, gt = 0;
let finished = false;
const clock = new THREE.Clock();

function headPx(h) {
  const v = new THREE.Vector3(x, h, 0).project(camera);
  return [(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight];
}

function hearts() {
  const [px, py] = headPx(animal.hh * scale * 0.8);
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const h = document.createElement('div');
      h.className = 'heart';
      h.style.left = (px - 40 + Math.random() * 80) + 'px';
      h.style.top = (py - 10) + 'px';
      h.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z" fill="#ef4444"/></svg>';
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1600);
    }, i * 170);
  }
}

function beginAsk() {
  state.name = 'ask';
  state.t = 0;
  say(animal.sp.snd + ' Have you drunk water?', 'Tap Yes or No', true, false);
  A_BRIDGE.askShown();
}

function answer(yes) {
  if (state.name !== 'ask') return;
  A_BRIDGE.answered(yes);
  state.t = 0;
  if (yes) {
    state.name = 'happy';
    say('Yay! Good job! ' + animal.sp.snd, 'See you in ' + label(INTERVAL) + '!', false, false);
    hearts();
  } else {
    state.name = 'sad';
    say('Sniff... you didn’t drink water.', 'I’m sad. I’ll ask again in 10 minutes.', false, true);
    cloud.className = 'on';
  }
}
document.getElementById('yes').onclick = () => answer(true);
document.getElementById('no').onclick = () => answer(false);

function finish() {
  if (finished) return;
  finished = true;
  A_BRIDGE.finished();
}

function update(dt) {
  state.t += dt;
  gt += dt;
  let mode = 'idle', spin = 0;
  switch (state.name) {
    case 'in':
      mode = 'walk'; wph += dt * 9;
      x -= CFG.walkSpeed * dt; yaw = -CFG.walkYaw; look = CFG.walkLook;
      if (x <= stopX) { x = stopX; beginAsk(); }
      break;
    case 'ask': {
      const k = Math.min(1, state.t / 0.5);
      yaw = -CFG.walkYaw * (1 - k); look = CFG.walkLook * (1 - k);
      break;
    }
    case 'happy':
      mode = 'happy'; yaw = 0; look = 0;
      spin = Math.min(1, state.t / 0.9) * Math.PI * 2;
      if (state.t > 3.4) { hideCard(); state.name = 'turn'; state.t = 0; }
      break;
    case 'sad':
      mode = 'sad'; yaw = 0; look = 0;
      if (state.t > 3.6) { hideCard(); cloud.className = ''; state.name = 'turn'; state.t = 0; state.sadOut = true; }
      break;
    case 'turn': {
      const k = Math.min(1, state.t / 0.6);
      mode = state.sadOut ? 'walk' : 'idle';
      wph += dt * (state.sadOut ? 5 : 9);
      yaw = CFG.walkYaw * k; look = -CFG.walkLook * k;
      if (k >= 1) { state.name = 'out'; state.t = 0; }
      break;
    }
    case 'out':
      mode = 'walk';
      wph += dt * (state.sadOut ? 5 : 9);
      yaw = CFG.walkYaw; look = -CFG.walkLook;
      x += (state.sadOut ? CFG.sadWalkSpeed : CFG.walkSpeed) * dt;
      if (x >= startX) finish();
      break;
  }
  pose(animal, mode, state.t, { gt, wph, look, sadLeave: state.sadOut && mode === 'walk' });
  rig.position.x = x;
  rig.rotation.y = yaw + spin;
  if (cloud.className === 'on') {
    const [px, py] = headPx(animal.hh * scale + 0.15);
    cloud.style.left = px + 'px';
    cloud.style.top = py + 'px';
  }
}

function loop() {
  if (finished) return;
  requestAnimationFrame(loop);
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}
loop();
