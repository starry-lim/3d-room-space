import * as THREE from "three";
import { M, PAL, UP, ball, box, clockTexture, cyl, hitProxy, posterTexture, rbox, rng, v } from "../kit";
import { FURNITURE_POS } from "../layout";
import { tag, type RoomRefs } from "./types";

export function buildWallDecor(room: THREE.Group, refs: RoomRefs) {
  /* wall clock — shows the visitor's real local time */
  const clock = new THREE.Group();
  clock.position.set(-2.985, 2.3, 1.8);
  clock.rotation.y = Math.PI / 2;
  const rim = cyl(0.25, 0.25, 0.04, M(PAL.woodDark, 0.7), 0, 0, 0.005, 36);
  rim.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.225, 36),
    new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.8 }),
  );
  face.position.z = 0.027;
  face.receiveShadow = true;
  clock.add(rim, face);
  const hand = (w: number, len: number, col: number, z: number) => {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    const m = box(w, len, 0.004, M(col, 0.6), 0, len / 2 - 0.02, 0);
    m.castShadow = false;
    pivot.add(m);
    clock.add(pivot);
    return pivot;
  };
  refs.clock = {
    h: hand(0.02, 0.13, PAL.ink, 0.031),
    m: hand(0.014, 0.19, PAL.ink, 0.035),
    s: hand(0.006, 0.2, PAL.tomato, 0.039),
  };
  const pin = cyl(0.014, 0.014, 0.012, M(PAL.brass, 0.4, 0.6), 0, 0, 0.04, 10);
  pin.rotation.x = Math.PI / 2;
  clock.add(pin);
  room.add(clock);

  /* poster above the bed */
  const poster = new THREE.Group();
  poster.position.set(-2.2, 2.12, -2.98);
  poster.rotation.z = -0.02;
  poster.add(rbox(0.76, 0.94, 0.035, 0.008, M(PAL.woodDark, 0.7)));
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.86),
    new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.9 }),
  );
  art.position.z = 0.019;
  art.receiveShadow = true;
  poster.add(art);
  room.add(poster);

  /* string lights along the left wall */
  const fairy = tag(new THREE.Group(), "fairy");
  const anchors = [-2.85, -1.55, -0.25, 1.05];
  const pts: THREE.Vector3[] = [];
  for (let s = 0; s < anchors.length - 1; s++) {
    for (let j = s === 0 ? 0 : 1; j <= 8; j++) {
      const u = j / 8;
      pts.push(v(-2.955, 3.08 - 0.3 * 4 * u * (1 - u), anchors[s] + (anchors[s + 1] - anchors[s]) * u));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.006, 5), M(PAL.ink, 0.8));
  fairy.add(wire);
  for (const z of anchors) fairy.add(ball(0.022, M(PAL.brass, 0.4, 0.6), -2.97, 3.08, z, 8, 6));
  const N = 20;
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.036, 10, 8),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    N,
  );
  const tints = [0xffd9a0, 0xffb86b, 0xffc2b0, 0xfff0c9];
  const d = new THREE.Object3D();
  refs.fairyColors = [];
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt((i + 0.5) / N);
    d.position.set(p.x + 0.02, p.y - 0.04, p.z);
    d.updateMatrix();
    bulbs.setMatrixAt(i, d.matrix);
    const c = new THREE.Color(tints[i % tints.length]);
    refs.fairyColors.push(c);
    bulbs.setColorAt(i, c);
  }
  bulbs.frustumCulled = false;
  fairy.add(bulbs);
  const fp = hitProxy(0.2, 0.6, 4.1, -2.93, 2.9, -0.9);
  fairy.add(fp);
  room.add(fairy);
  refs.items.fairy = fairy;
  refs.fairyBulbs = bulbs;

  /* secret: glow-in-the-dark stickers above the bed */
  const glow = tag(new THREE.Group(), "glowstars");
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 ? 0.46 : 1;
    if (i === 0) starShape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else starShape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  starShape.closePath();
  // lit like any sticker by day; the emissive only wakes up once the room is dark
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xc9d8b4,
    emissive: 0xb4ff6a,
    emissiveIntensity: 0,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const COUNT = 17;
  const stars = new THREE.InstancedMesh(new THREE.ShapeGeometry(starShape), glowMat, COUNT);
  const r = rng(77);
  const qy = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);
  const qz = new THREE.Quaternion();
  for (let i = 0; i < COUNT; i++) {
    const p = v(-2.992, 1.4 + r() * 1.2, -2.7 + r() * 2.2);
    refs.glowStarPoints.push(p);
    const s = 0.04 + r() * 0.05;
    qz.setFromAxisAngle(v(0, 0, 1), r() * 6.28);
    d.position.copy(p);
    d.quaternion.copy(qy).multiply(qz);
    d.scale.setScalar(s);
    d.updateMatrix();
    stars.setMatrixAt(i, d.matrix);
  }
  stars.frustumCulled = false;
  const moon = new THREE.Shape();
  moon.absarc(0, 0, 1, -2.0, 2.0, false);
  moon.absarc(0.5, 0, 0.92, 1.72, -1.72, true);
  const crescent = new THREE.Mesh(new THREE.ShapeGeometry(moon, 20), glowMat);
  crescent.position.set(-2.992, 2.42, -1.05);
  crescent.rotation.set(0, Math.PI / 2, 0.5);
  crescent.scale.setScalar(0.15);
  glow.add(stars, crescent, hitProxy(0.03, 1.5, 2.5, -2.985, 1.98, -1.6));
  room.add(glow);
  refs.items.glowstars = glow;
  refs.glowStarMat = glowMat;

  /* secret: a mouse hole in the baseboard, between desk and bookshelf */
  const mh = tag(new THREE.Group(), "mouse");
  mh.position.set(FURNITURE_POS.mouseHole[0], 0, 0);
  const arch = new THREE.Shape();
  arch.moveTo(-0.068, 0);
  arch.lineTo(-0.068, 0.06);
  arch.absarc(0, 0.06, 0.068, Math.PI, 0, true);
  arch.lineTo(0.068, 0);
  arch.closePath();
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(arch, 12), new THREE.MeshBasicMaterial({ color: 0x150d12 }));
  hole.position.z = -2.957;
  mh.add(hole);
  const mouse = new THREE.Group();
  mouse.position.set(0, 0.048, -3.06);
  const grey = M(0xa39aa3, 0.9);
  const pink = M(0xf0a8b0, 0.8);
  const mb = ball(0.045, grey, 0, 0, 0, 12, 10);
  mb.scale.set(1, 0.9, 1.35);
  mouse.add(mb, ball(0.022, pink, 0.032, 0.036, 0.01, 8, 6), ball(0.022, pink, -0.032, 0.036, 0.01, 8, 6));
  mouse.add(ball(0.008, pink, 0, -0.004, 0.061, 6, 4));
  mouse.add(ball(0.0065, M(PAL.ink, 0.3), 0.017, 0.013, 0.05, 6, 4), ball(0.0065, M(PAL.ink, 0.3), -0.017, 0.013, 0.05, 6, 4));
  mouse.traverse((o) => (o.castShadow = false));
  mh.add(mouse, hitProxy(0.3, 0.26, 0.2, 0, 0.13, -2.9));
  room.add(mh);
  refs.items.mouse = mh;
  refs.mouse = mouse;
}

export function buildTodoBoard(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "todo");
  g.position.set(...FURNITURE_POS.todoBoard);
  g.rotation.y = Math.PI / 2;

  g.add(rbox(0.72, 0.84, 0.036, 0.012, M(PAL.wood, 0.72), 0, 0, 0));
  const cork = box(0.64, 0.76, 0.008, M(0xb98d62, 0.95), 0, 0, 0.016);
  cork.castShadow = false;
  g.add(cork);

  const tc = document.createElement("canvas");
  tc.width = 256;
  tc.height = 312;
  const todoTex = new THREE.CanvasTexture(tc);
  todoTex.colorSpace = THREE.SRGBColorSpace;
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.68),
    new THREE.MeshStandardMaterial({ map: todoTex, roughness: 0.92 }),
  );
  sheet.position.set(0, 0.01, 0.022);
  sheet.receiveShadow = true;
  g.add(sheet);

  const brass = M(PAL.brass, 0.4, 0.6);
  for (const px of [-0.22, 0.22]) {
    const pin = cyl(0.011, 0.011, 0.012, brass, px, 0.32, 0.026, 10);
    pin.rotation.x = Math.PI / 2;
    pin.castShadow = false;
    g.add(pin);
  }
  const n1 = box(0.11, 0.11, 0.003, M(PAL.mustard, 0.85), 0.2, -0.25, 0.0255);
  n1.rotation.z = -0.09;
  n1.castShadow = false;
  const n2 = box(0.1, 0.1, 0.003, M(PAL.blush, 0.85), 0.11, -0.27, 0.0242);
  n2.rotation.z = 0.07;
  n2.castShadow = false;
  g.add(n1, n2, hitProxy(0.78, 0.88, 0.16, 0, 0, 0.04));

  room.add(g);
  refs.items.todo = g;
  refs.todoCanvas = tc;
  refs.todoTex = todoTex;
}
