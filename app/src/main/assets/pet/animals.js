import * as THREE from 'three';

const mats = {};
const M = c => mats[c] || (mats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0 }));
const SPH = new THREE.SphereGeometry(1, 28, 20);
function ell(rx, ry, rz, c, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(SPH, M(c));
  m.scale.set(rx, ry, rz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const surf = (rx, ry, rz, x, y) => rz * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx) - (y * y) / (ry * ry)));
function newA(kind, sp) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  return { kind, sp, root, body, legs: [], feet: [], arms: [], ears: [], tail: null, head: null, face: null, mouth: null, hh: 1.3 };
}

function addEars(head, A, o) {
  [-1, 1].forEach(s => {
    const g = new THREE.Group();
    g.position.set(s * o.x, o.y, o.z || 0);
    const sz = o.size || 1;
    const tilt = o.tilt === undefined ? 0.2 : o.tilt;
    const droop = o.droop === undefined ? 0.5 : o.droop;
    if (o.type === 'point') {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.14 * sz, 0.3 * sz, 16), M(o.c));
      c.position.y = 0.14 * sz; c.castShadow = true; g.add(c);
      const i = new THREE.Mesh(new THREE.ConeGeometry(0.085 * sz, 0.2 * sz, 16), M(o.inn));
      i.position.set(0, 0.12 * sz, 0.04 * sz); g.add(i);
    } else if (o.type === 'long') {
      g.add(ell(0.1 * sz, 0.4 * sz, 0.065 * sz, o.c, 0, 0.36 * sz, 0));
      g.add(ell(0.058 * sz, 0.3 * sz, 0.03, o.inn, 0, 0.36 * sz, 0.05));
    } else if (o.type === 'round') {
      const r = o.r || 0.14;
      g.add(ell(r, r, r * 0.55, o.c, 0, r * 0.55, 0));
      if (o.inn) g.add(ell(r * 0.62, r * 0.62, r * 0.3, o.inn, 0, r * 0.55, r * 0.35));
    } else if (o.type === 'floppy') {
      g.add(ell(0.1 * sz, 0.22 * sz, 0.07 * sz, o.c, s * 0.03, -0.15 * sz, 0));
    }
    g.rotation.z = -s * tilt;
    head.add(g);
    A.ears.push({ g, s, tilt, droop });
  });
}

function addFace(head, A, o) {
  const es = o.es || 1;
  const F = { eyeN: [], eyeH: [], lids: [], brows: [], blush: [], tears: [] };
  [-1, 1].forEach(s => {
    const z = surf(o.hx, o.hy, o.hz, o.ex, o.ey) + 0.004;
    const g = new THREE.Group();
    g.position.set(s * o.ex, o.ey, z);
    g.add(ell(0.062 * es, 0.075 * es, 0.03, '#ffffff'));
    g.add(ell(0.046 * es, 0.06 * es, 0.024, o.iris || '#5a3b1e', 0, 0, 0.012));
    g.add(ell(0.028 * es, 0.04 * es, 0.02, '#111111', 0, 0, 0.022));
    g.add(ell(0.014 * es, 0.016 * es, 0.01, '#ffffff', 0.014 * es, 0.022 * es, 0.036));
    g.add(ell(0.007 * es, 0.008 * es, 0.008, '#ffffff', -0.012 * es, -0.02 * es, 0.034));
    head.add(g); F.eyeN.push(g);

    const hp = new THREE.Mesh(new THREE.TorusGeometry(0.055 * es, 0.014, 8, 16, Math.PI), M('#222222'));
    hp.position.set(s * o.ex, o.ey - 0.015 * es, z + 0.012);
    hp.visible = false; head.add(hp); F.eyeH.push(hp);

    const lid = ell(0.074 * es, 0.042 * es, 0.036, o.skin, s * o.ex, o.ey + 0.05 * es, z + 0.01);
    lid.rotation.z = -s * 0.38; lid.visible = false; head.add(lid); F.lids.push(lid);

    const br = new THREE.Mesh(new THREE.BoxGeometry(0.11 * es, 0.02, 0.014), M('#3a2a2a'));
    br.position.set(s * o.ex, o.ey + 0.115 * es, z + 0.01);
    br.rotation.z = -s * 0.45; br.visible = false; head.add(br); F.brows.push(br);

    if (o.lashes) {
      [0, 1].forEach(i => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.045 * es, 0.007, 0.007), M('#222222'));
        l.position.set(s * (o.ex + 0.06 * es + i * 0.012), o.ey + (0.05 + i * 0.03) * es, z + 0.02);
        l.rotation.z = -s * (0.5 + i * 0.5);
        head.add(l);
      });
    }

    const cx = o.ex + 0.1, cy = o.ey - 0.1;
    const bz = surf(o.hx, o.hy, o.hz, cx, cy) - 0.005;
    const bl = new THREE.Group();
    bl.position.set(s * cx, cy, bz);
    bl.rotation.y = s * 0.6;
    bl.add(ell(0.07, 0.045, 0.02, '#FF9EB5'));
    head.add(bl); F.blush.push(bl);

    for (let k = 0; k < 3; k++) {
      const d = new THREE.Group();
      d.position.set(s * (o.ex + 0.02), o.ey - 0.05, z + 0.03);
      d.add(ell(0.02, 0.03, 0.02, '#7CC4F5'));
      d.visible = false; head.add(d); F.tears.push({ d, k, s });
    }
  });

  if (!o.noMouth) {
    const mw = o.mw || 1;
    const mg = new THREE.Group();
    mg.position.set(0, o.my, o.mz);
    const arc = (r, rot, y) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.013, 8, 18, Math.PI), M('#4a2a2a'));
      m.rotation.z = rot; m.position.y = y; mg.add(m); return m;
    };
    const open = new THREE.Group();
    open.add(ell(0.055 * mw, 0.042 * mw, 0.02, '#7a1f2b', 0, -0.02, 0));
    open.add(ell(0.03 * mw, 0.016 * mw, 0.014, '#ef6f8a', 0, -0.045 * mw, 0.008));
    open.visible = false; mg.add(open);
    const sad = arc(0.045 * mw, 0, -0.02); sad.visible = false;
    const neu = arc(0.035 * mw, Math.PI, 0.0);
    const teeth = new THREE.Group();
    if (o.teeth) {
      [-1, 1].forEach(s => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.01), M('#ffffff')); t.position.set(s * 0.018, -0.04, 0.005); teeth.add(t); });
      mg.add(teeth);
    }
    head.add(mg);
    A.mouth = { open, sad, neu, teeth };
  }
  A.face = F;
}

function quadBase(sp, o) {
  const A = newA('quad', sp);
  const bl = o.bl || 0.48, by = o.by || 0.58, bw = o.bw || 1;
  A.body.add(ell(0.29 * bw, o.bh || 0.27, bl, sp.body, 0, by, 0));
  A.body.add(ell(0.2 * bw, 0.2, bl * 0.7, sp.belly, 0, by - 0.1, 0.02));
  const py = by - 0.12;
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.15 * bw, py, sz * bl * 0.62);
    g.add(ell(0.065 * (o.lw || 1), py / 2, 0.065 * (o.lw || 1), o.leg || sp.body, 0, -py / 2, 0));
    g.add(ell(0.08, 0.045, 0.1, o.paw || sp.body, 0, -py + 0.04, 0.03));
    A.body.add(g); A.legs.push(g);
  });
  const head = new THREE.Group();
  head.position.set(0, o.hy !== undefined ? o.hy : by + 0.27, o.hz !== undefined ? o.hz : bl * 0.9 + 0.05);
  A.body.add(head); A.head = head;
  const tail = new THREE.Group();
  tail.position.set(0, by + 0.1, -bl * 0.95);
  A.body.add(tail); A.tail = tail;
  return A;
}

function bipedBase(sp, o) {
  const A = newA('biped', sp);
  A.body.add(ell(o.bw || 0.34, o.bh || 0.37, 0.32, sp.body, 0, 0.34, 0));
  A.body.add(ell(0.24, 0.27, 0.14, sp.belly, 0, 0.3, 0.2));
  [-1, 1].forEach(s => {
    const f = ell(o.fw || 0.11, 0.07, o.fl || 0.15, sp.feet, s * 0.15, 0.07, 0.08);
    A.root.add(f); A.feet.push(f);
    const g = new THREE.Group();
    g.position.set(s * 0.34, 0.48, 0);
    g.add(ell(0.07, 0.15, 0.07, sp.arm || sp.body, 0, -0.1, 0));
    A.body.add(g); A.arms.push(g);
  });
  const head = new THREE.Group();
  head.position.set(0, o.hy || 0.8, 0);
  A.body.add(head); A.head = head;
  const tail = new THREE.Group();
  tail.position.set(0, 0.22, -0.28);
  A.body.add(tail); A.tail = tail;
  return A;
}

function curveTail(A, c, pts, r) {
  const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const t = new THREE.Mesh(new THREE.TubeGeometry(cv, 16, r, 8), M(c));
  t.castShadow = true; A.tail.add(t);
}

function bow(head, x, y, z) {
  const b = new THREE.Group();
  b.position.set(x, y, z); b.rotation.z = 0.3;
  b.add(ell(0.1, 0.065, 0.05, '#FF7FB0', -0.09, 0, 0), ell(0.1, 0.065, 0.05, '#FF7FB0', 0.09, 0, 0), ell(0.045, 0.045, 0.045, '#E0457B', 0, 0, 0.01));
  head.add(b);
}

function whiskers(head, y, z) {
  [-1, 1].forEach(s => [-1, 0, 1].forEach(k => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6), M('#8a7a70'));
    w.rotation.z = Math.PI / 2 + s * k * 0.18;
    w.rotation.y = s * 0.5;
    w.position.set(s * 0.26, y + k * 0.025, z);
    head.add(w);
  }));
}

const BUILD = {
  puppy() {
    const sp = { n: 'Puppy', snd: 'Woof!', body: '#E8BE86', belly: '#FFF1DC' };
    const A = quadBase(sp, { paw: '#FFF1DC' });
    const h = A.head, H = { hx: 0.4, hy: 0.37, hz: 0.38 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    h.add(ell(0.12, 0.1, 0.05, '#B9824A', 0.17, 0.08, 0.31));
    h.add(ell(0.17, 0.12, 0.15, '#FFF1DC', 0, -0.1, 0.28));
    h.add(ell(0.05, 0.038, 0.035, '#3b2a1d', 0, -0.045, 0.405));
    addEars(h, A, { type: 'floppy', c: '#B9824A', x: 0.38, y: 0.12, tilt: 0.15, droop: 0.35, size: 1.2 });
    addFace(h, A, { ...H, ex: 0.15, ey: 0.08, es: 1, iris: '#5a3b1e', skin: sp.body, my: -0.125, mz: 0.405, mw: 1 });
    curveTail(A, sp.body, [[0, 0, 0], [0, 0.05, -0.14], [0, 0.2, -0.2], [0, 0.34, -0.14]], 0.045);
    bow(h, -0.3, 0.3, 0.12);
    A.hh = 1.35; return A;
  },
  kitten() {
    const sp = { n: 'Kitten', snd: 'Meow~', body: '#F2B27A', belly: '#FFF1E6' };
    const A = quadBase(sp, { bw: 0.88, lw: 0.9, paw: '#FFF1E6' });
    const h = A.head, H = { hx: 0.43, hy: 0.35, hz: 0.34 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    h.add(ell(0.1, 0.07, 0.07, '#FFF1E6', 0, -0.1, 0.28));
    h.add(ell(0.032, 0.022, 0.02, '#E58A9A', 0, -0.06, 0.335));
    [-0.08, 0, 0.08].forEach((x, i) => { const s = ell(0.02, 0.07, 0.02, '#D98A4E', x, 0.26, 0.2); s.rotation.z = (i - 1) * -0.35; h.add(s); });
    addEars(h, A, { type: 'point', c: sp.body, inn: '#F4A6B6', x: 0.27, y: 0.26, tilt: 0.3, droop: 0.6 });
    addFace(h, A, { ...H, ex: 0.16, ey: 0.06, es: 1.12, iris: '#6fbf4a', skin: sp.body, my: -0.115, mz: 0.325, mw: 0.8, lashes: true });
    whiskers(h, -0.08, 0.28);
    curveTail(A, sp.body, [[0, 0, 0], [0, 0.04, -0.2], [0, 0.22, -0.3], [0, 0.46, -0.2]], 0.04);
    bow(h, 0.3, 0.3, 0.1);
    A.hh = 1.3; return A;
  },
  bunny() {
    const sp = { n: 'Bunny', snd: 'Hop hop!', body: '#F6F1F8', belly: '#FFFFFF' };
    const A = quadBase(sp, { bw: 1.05, bl: 0.42, paw: '#EDE6F0' });
    const h = A.head, H = { hx: 0.35, hy: 0.34, hz: 0.33 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    [-1, 1].forEach(s => h.add(ell(0.11, 0.09, 0.09, '#FBF8FC', s * 0.2, -0.1, 0.2)));
    h.add(ell(0.032, 0.022, 0.02, '#F08CA8', 0, -0.045, 0.325));
    addEars(h, A, { type: 'long', c: sp.body, inn: '#F8B6C8', x: 0.15, y: 0.3, tilt: 0.1, droop: 1.15, size: 1.05 });
    addFace(h, A, { ...H, ex: 0.13, ey: 0.06, es: 1.1, iris: '#8b4a5a', skin: sp.body, my: -0.1, mz: 0.325, mw: 0.8, teeth: true, lashes: true });
    A.tail.add(ell(0.11, 0.11, 0.11, '#FFFFFF', 0, 0.02, -0.06));
    A.hh = 1.55; return A;
  },
  unicorn() {
    const sp = { n: 'Unicorn', snd: 'Sparkle~', body: '#FBF7FF', belly: '#FFFFFF' };
    const A = quadBase(sp, { bl: 0.5, by: 0.78, lw: 0.75, paw: '#F6C945', hy: 1.12, hz: 0.78 });
    A.body.add(ell(0.15, 0.3, 0.15, sp.body, 0, 0.98, 0.55));
    const h = A.head, H = { hx: 0.27, hy: 0.3, hz: 0.4 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    h.add(ell(0.17, 0.14, 0.18, '#FFE3EE', 0, -0.13, 0.28));
    [-1, 1].forEach(s => h.add(ell(0.016, 0.022, 0.012, '#C77A98', s * 0.06, -0.12, 0.45)));
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 16), M('#F6C945'));
    horn.position.set(0, 0.42, 0.12); horn.rotation.x = 0.35; horn.castShadow = true; h.add(horn);
    addEars(h, A, { type: 'point', c: sp.body, inn: '#F7C4DD', x: 0.16, y: 0.26, tilt: 0.15, droop: 0.5, size: 0.7 });
    ['#C9A8F0', '#F8A8CF', '#9ED6F5', '#F8A8CF'].forEach((c, i) => h.add(ell(0.09, 0.11, 0.09, c, 0, 0.3 - i * 0.02, 0.2 - i * 0.12)));
    ['#F8A8CF', '#C9A8F0', '#9ED6F5', '#F8A8CF'].forEach((c, i) => A.body.add(ell(0.08, 0.1, 0.08, c, 0, 1.2 - i * 0.15, 0.52 - i * 0.09)));
    addFace(h, A, { ...H, ex: 0.15, ey: 0.07, es: 1.3, iris: '#8a5cc8', skin: sp.body, my: -0.17, mz: 0.43, mw: 0.9, lashes: true });
    ['#F8A8CF', '#C9A8F0', '#9ED6F5'].forEach((c, i) => A.tail.add(ell(0.08, 0.14, 0.08, c, 0, -0.08 - i * 0.1, -0.08 - i * 0.04)));
    A.hh = 1.75; return A;
  },
  fox() {
    const sp = { n: 'Fox', snd: 'Yip yip!', body: '#E8812F', belly: '#FFFFFF' };
    const A = quadBase(sp, { leg: '#2b2b2b', paw: '#2b2b2b', bw: 0.95 });
    const h = A.head, H = { hx: 0.38, hy: 0.33, hz: 0.34 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    [-1, 1].forEach(s => { const c = ell(0.17, 0.13, 0.13, '#FFFFFF', s * 0.2, -0.1, 0.2); c.rotation.z = s * 0.4; h.add(c); });
    const sn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 18), M('#F0A060'));
    sn.rotation.x = Math.PI / 2; sn.position.set(0, -0.07, 0.36); sn.castShadow = true; h.add(sn);
    h.add(ell(0.045, 0.038, 0.04, '#1a1a1a', 0, -0.05, 0.51));
    addEars(h, A, { type: 'point', c: sp.body, inn: '#2b2b2b', x: 0.24, y: 0.25, tilt: 0.25, droop: 0.6, size: 1.2 });
    addFace(h, A, { ...H, ex: 0.14, ey: 0.07, es: 0.95, iris: '#d98a1a', skin: sp.body, my: -0.13, mz: 0.37, mw: 0.7 });
    A.tail.add(ell(0.13, 0.13, 0.34, sp.body, 0, 0.05, -0.3));
    A.tail.add(ell(0.11, 0.11, 0.13, '#FFFFFF', 0, 0.05, -0.62));
    A.tail.rotation.x = -0.3;
    A.hh = 1.3; return A;
  },
  piglet() {
    const sp = { n: 'Piglet', snd: 'Oink oink!', body: '#F8B8C8', belly: '#FBD0DA' };
    const A = quadBase(sp, { bw: 1.1, bl: 0.44, bh: 0.3, paw: '#EE98AE', lw: 1.1 });
    const h = A.head, H = { hx: 0.38, hy: 0.35, hz: 0.35 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    h.add(ell(0.14, 0.11, 0.07, '#F28FA8', 0, -0.07, 0.33));
    [-1, 1].forEach(s => h.add(ell(0.02, 0.03, 0.015, '#a64d63', s * 0.045, -0.07, 0.395)));
    addEars(h, A, { type: 'point', c: '#F4A3B8', inn: '#F28FA8', x: 0.25, y: 0.27, tilt: 0.7, droop: 0.4, size: 0.8 });
    addFace(h, A, { ...H, ex: 0.15, ey: 0.09, es: 1.05, iris: '#3b2a1d', skin: sp.body, my: -0.19, mz: 0.3, mw: 0.9, lashes: true });
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 16, Math.PI * 1.6), M('#F28FA8'));
    curl.position.set(0, 0.06, -0.04); A.tail.add(curl);
    A.hh = 1.25; return A;
  },
  panda() {
    const sp = { n: 'Panda', snd: 'Hi hi!', body: '#F7F7F7', belly: '#FFFFFF', feet: '#2A2A2A', arm: '#2A2A2A' };
    const A = bipedBase(sp, { bw: 0.36, bh: 0.38 });
    const h = A.head, H = { hx: 0.46, hy: 0.42, hz: 0.42 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    [-1, 1].forEach(s => { const p = ell(0.11, 0.14, 0.06, '#2A2A2A', s * 0.18, 0.04, 0.36); p.rotation.z = s * 0.45; h.add(p); });
    h.add(ell(0.06, 0.042, 0.035, '#222222', 0, -0.06, 0.4));
    addEars(h, A, { type: 'round', c: '#2A2A2A', x: 0.34, y: 0.3, r: 0.14, tilt: 0, droop: 0.25 });
    addFace(h, A, { ...H, ex: 0.18, ey: 0.05, es: 0.85, iris: '#3a2a2a', skin: '#2A2A2A', my: -0.14, mz: 0.385, mw: 1 });
    A.tail.add(ell(0.09, 0.09, 0.09, '#FFFFFF', 0, 0, -0.05));
    A.hh = 1.4; return A;
  },
  penguin() {
    const sp = { n: 'Penguin', snd: 'Noot noot!', body: '#2E3E5C', belly: '#FFFFFF', feet: '#FF9F2E', arm: '#2E3E5C' };
    const A = bipedBase(sp, { bh: 0.4, fw: 0.14, fl: 0.18, hy: 0.84 });
    const h = A.head, H = { hx: 0.4, hy: 0.36, hz: 0.36 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    h.add(ell(0.3, 0.26, 0.1, '#FFFFFF', 0, -0.03, 0.27));
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.17, 14), M('#FF9F2E'));
    b.rotation.x = Math.PI / 2; b.position.set(0, -0.07, 0.4); b.castShadow = true; h.add(b);
    addFace(h, A, { ...H, ex: 0.13, ey: 0.06, es: 0.95, iris: '#2a2a2a', skin: '#FFFFFF', noMouth: true });
    A.hh = 1.4; return A;
  },
  duckling() {
    const sp = { n: 'Duckling', snd: 'Quack!', body: '#FFD84D', belly: '#FFE88A', feet: '#FF9F2E', arm: '#FFD04D' };
    const A = bipedBase(sp, { fw: 0.13, fl: 0.16 });
    const h = A.head, H = { hx: 0.42, hy: 0.38, hz: 0.38 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    h.add(ell(0.18, 0.05, 0.12, '#FF9F2E', 0, -0.1, 0.38));
    [-1, 0, 1].forEach(k => h.add(ell(0.035, 0.1, 0.035, sp.body, k * 0.06, 0.4, 0.08)));
    addFace(h, A, { ...H, ex: 0.16, ey: 0.07, es: 1.05, iris: '#3b2a1d', skin: sp.body, noMouth: true, lashes: true });
    A.hh = 1.4; return A;
  },
  teddy() {
    const sp = { n: 'Teddy', snd: 'Hug me!', body: '#B98456', belly: '#E7C9A3', feet: '#A5703F', arm: '#B98456' };
    const A = bipedBase(sp, {});
    const h = A.head, H = { hx: 0.42, hy: 0.38, hz: 0.38 };
    h.add(ell(H.hx, H.hy, H.hz, sp.body));
    h.add(ell(0.16, 0.12, 0.1, '#E7C9A3', 0, -0.1, 0.31));
    h.add(ell(0.055, 0.04, 0.03, '#3A2418', 0, -0.055, 0.405));
    addEars(h, A, { type: 'round', c: sp.body, inn: '#E7C9A3', x: 0.33, y: 0.28, r: 0.13, tilt: 0, droop: 0.25 });
    addFace(h, A, { ...H, ex: 0.16, ey: 0.07, es: 0.85, iris: '#2a1a10', skin: sp.body, my: -0.14, mz: 0.38, mw: 1 });
    bow(h, -0.3, 0.3, 0.14);
    A.tail.add(ell(0.08, 0.08, 0.08, sp.body, 0, 0, -0.04));
    A.hh = 1.4; return A;
  }
};

export const ANIMALS = Object.keys(BUILD);
export function build(key) { return BUILD[key](); }

export function pose(A, mode, k, c) {
  const F = A.face, happy = mode === 'happy', sad = mode === 'sad';
  const blink = (mode === 'walk' || mode === 'idle') && (c.gt % 3.4) < 0.12;
  F.eyeN.forEach(e => { e.visible = !happy; const sc = sad ? 1.1 : 1; e.scale.set(sc, blink ? 0.1 : sc, 1); });
  F.eyeH.forEach(e => (e.visible = happy));
  F.lids.forEach(e => (e.visible = sad && !blink));
  F.brows.forEach(e => (e.visible = sad));
  F.blush.forEach(b => b.scale.setScalar(happy ? 1.35 : 1));
  F.tears.forEach(({ d, k: i, s }) => {
    d.visible = sad;
    if (sad) { const p = (c.gt * 1.1 + i * 0.31 + (s > 0 ? 0.5 : 0)) % 1; d.position.y = -0.02 - p * 0.3; d.scale.setScalar(Math.max(0.1, 1 - p * 0.7)); }
  });
  if (A.mouth) {
    A.mouth.open.visible = happy;
    A.mouth.sad.visible = sad;
    A.mouth.neu.visible = !happy && !sad;
    A.mouth.teeth.visible = !sad;
  }

  let bob = 0, sy = 1, hx = 0, hz = 0, jump = 0, tailW = 0, tailX = 0, droop = 0;
  let armZ = [-0.3, 0.3], armX = [0, 0];
  const legs = A.legs, feet = A.feet;
  const ph = [0, Math.PI, Math.PI, 0];

  if (A.kind === 'quad') legs.forEach(l => (l.rotation.x = 0));
  else feet.forEach(f => { f.position.z = 0.08; f.position.y = 0.07; });

  if (mode === 'walk') {
    const s = Math.sin(c.wph);
    bob = Math.abs(s) * 0.035; hz = s * 0.04; tailW = Math.sin(c.gt * 8) * 0.35;
    if (A.kind === 'quad') legs.forEach((l, i) => (l.rotation.x = Math.sin(c.wph + ph[i]) * 0.6));
    else {
      feet[0].position.z = 0.08 + s * 0.1; feet[1].position.z = 0.08 - s * 0.1;
      feet[0].position.y = 0.07 + Math.max(0, Math.cos(c.wph)) * 0.05; feet[1].position.y = 0.07 + Math.max(0, -Math.cos(c.wph)) * 0.05;
      armX = [s * 0.6, -s * 0.6];
    }
    if (c.sadLeave) { hx = 0.4; droop = 0.9; tailW = 0; tailX = -0.9; armZ = [-0.1, 0.1]; }
  } else if (mode === 'idle') {
    sy = 1 + Math.sin(c.gt * 2) * 0.015; hz = Math.sin(c.gt * 1.5) * 0.07; tailW = Math.sin(c.gt * 6) * 0.3;
    if (A.kind === 'biped') armZ[1] = 2.3 + Math.sin(c.gt * 7) * 0.3;
  } else if (happy) {
    jump = Math.abs(Math.sin(k * 8)) * 0.34; tailW = Math.sin(c.gt * 20) * 0.6; hz = Math.sin(c.gt * 10) * 0.1;
    if (A.kind === 'quad') {
      legs[0].rotation.x = -1.0 + Math.sin(c.gt * 14) * 0.4; legs[1].rotation.x = -1.0 + Math.cos(c.gt * 14) * 0.4;
      legs[2].rotation.x = 0.3; legs[3].rotation.x = 0.3;
    } else armZ = [-(2.4 + Math.sin(c.gt * 14) * 0.3), 2.4 + Math.sin(c.gt * 14) * 0.3];
  } else if (sad) {
    sy = 0.95; hx = 0.5; hz = Math.sin(c.gt * 3) * 0.05; droop = 1; tailX = -0.9;
    jump = Math.sin(c.gt * 24) * 0.009;
    if (A.kind === 'quad') { legs[2].rotation.x = 0.2; legs[3].rotation.x = 0.2; }
    else { armZ = [-0.1, 0.1]; armX = [Math.sin(c.gt * 24) * 0.15, Math.sin(c.gt * 24) * 0.15]; }
  }
  A.body.position.y = bob; A.body.scale.y = sy;
  A.head.rotation.x = hx; A.head.rotation.z = hz; A.head.rotation.y = c.look || 0;
  A.arms.forEach((g, i) => { g.rotation.z = armZ[i]; g.rotation.x = armX[i]; });
  A.tail.rotation.y = tailW; A.tail.rotation.x = tailX;
  A.ears.forEach(e => { e.g.rotation.z = -e.s * (e.tilt + droop * e.droop); e.g.rotation.x = happy ? Math.sin(c.gt * 14) * 0.25 : 0; });
  A.root.position.y = jump;
}
