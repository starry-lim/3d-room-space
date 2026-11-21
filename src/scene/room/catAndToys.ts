import * as THREE from "three";
import { M, PAL, ball, box, cyl, hitProxy, rbox, rod, v } from "../kit";
import { FURNITURE_POS } from "../layout";
import { tag, type RoomRefs } from "./types";

export function buildCat(room: THREE.Group, refs: RoomRefs) {
  /* pink cushion stays fixed on the floor beside the radio cabinet so the cat can walk freely around the room */
  const cushion = ball(0.44, M(PAL.blush, 0.95), ...FURNITURE_POS.catCushion, 28, 14);
  cushion.scale.y = 0.2;
  room.add(cushion);

  const root = tag(new THREE.Group(), "cat");
  root.position.set(...FURNITURE_POS.catCushionPerch);
  root.add(hitProxy(0.46, 0.4, 0.58, 0, 0.2, 0));

  const visual = new THREE.Group();
  const body = new THREE.Group();
  visual.add(body);
  root.add(visual);

  const fur = M(PAL.ginger, 0.9);
  const stripe = M(0xc26e37, 0.9);
  const cream = M(0xfbead2, 0.9);
  const pink = M(0xf0a8b0, 0.8);
  const darkEye = M(PAL.ink, 0.25);
  const eyeShine = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

  const torso = ball(1, fur, 0, 0.19, 0, 20, 14);
  torso.scale.set(0.115, 0.105, 0.185);
  const haunch = ball(1, fur, 0, 0.185, -0.095, 16, 12);
  haunch.scale.set(0.125, 0.11, 0.12);
  const chest = ball(0.068, cream, 0, 0.165, 0.145, 14, 10);
  chest.scale.set(1.0, 0.9, 0.72);
  body.add(torso, haunch, chest);

  for (const z of [0.055, -0.015, -0.085]) {
    const band = ball(1, stripe, 0, 0.228, z, 12, 8);
    band.scale.set(0.092, 0.068, 0.016);
    band.castShadow = false;
    body.add(band);
  }

  const mkLeg = (x: number, z: number) => {
    const piv = new THREE.Group();
    piv.position.set(x, 0.14, z);
    piv.add(cyl(0.028, 0.023, 0.125, fur, 0, -0.062, 0, 10));
    const paw = ball(0.026, cream, 0, -0.118, 0.014, 10, 8);
    paw.scale.set(1, 0.85, 1.25);
    piv.add(paw);
    body.add(piv);
    return piv;
  };
  const legs = {
    fl: mkLeg(0.068, 0.11),
    fr: mkLeg(-0.068, 0.11),
    bl: mkLeg(0.068, -0.11),
    br: mkLeg(-0.068, -0.11),
  };

  const head = new THREE.Group();
  head.position.set(0, 0.255, 0.185);
  const skull = ball(0.098, fur, 0, 0, 0, 18, 14);
  skull.scale.set(1, 0.88, 0.96);
  head.add(skull);

  for (const x of [-0.02, 0, 0.02]) {
    const mark = box(0.008, 0.004, 0.026, stripe, x, 0.075, 0.036);
    mark.rotation.x = 0.35;
    mark.castShadow = false;
    head.add(mark);
  }

  const ears: THREE.Group[] = [];
  const eyesOpen = new THREE.Group();
  const eyesClosed = new THREE.Group();
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.058, 0.072, -0.008);
    ear.rotation.z = -s * 0.26;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.08, 10), fur);
    outer.castShadow = true;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.052, 8), pink);
    inner.position.set(0, -0.006, 0.018);
    ear.add(outer, inner);
    head.add(ear);
    ears.push(ear);

    const pupil = ball(0.014, darkEye, s * 0.038, 0.015, 0.084, 10, 8);
    pupil.castShadow = false;
    const gleam = ball(0.0045, eyeShine, s * 0.042, 0.021, 0.095, 6, 4);
    gleam.castShadow = false;
    eyesOpen.add(pupil, gleam);

    const closed = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0042, 6, 12, Math.PI), M(PAL.ink, 0.5));
    closed.position.set(s * 0.038, 0.013, 0.085);
    closed.rotation.z = Math.PI;
    eyesClosed.add(closed);

    for (const dy of [-0.018, -0.028]) {
      const w = rod(v(s * 0.042, dy, 0.078), v(s * 0.115, dy - 0.006, 0.068), 0.0018, M(PAL.cream, 0.9), 4);
      w.castShadow = false;
      head.add(w);
    }
  }
  eyesClosed.visible = false;
  head.add(eyesOpen, eyesClosed);

  const muzzle = ball(0.038, cream, 0, -0.026, 0.072, 12, 10);
  muzzle.scale.set(1.25, 0.8, 1);
  head.add(muzzle, ball(0.011, pink, 0, -0.012, 0.107, 8, 6));
  body.add(head);

  const t0 = new THREE.Group();
  t0.position.set(0, 0.22, -0.175);
  t0.add(rod(v(0, 0, 0), v(0, 0.105, -0.03), 0.025, fur, 8), ball(0.025, fur, 0, 0.105, -0.03, 8, 6));
  const t1 = new THREE.Group();
  t1.position.set(0, 0.105, -0.03);
  t1.add(rod(v(0, 0, 0), v(0, 0.105, 0), 0.023, fur, 8), ball(0.023, fur, 0, 0.105, 0, 8, 6));
  const t2 = new THREE.Group();
  t2.position.set(0, 0.105, 0);
  t2.add(rod(v(0, 0, 0), v(0, 0.095, 0), 0.02, fur, 8), ball(0.026, cream, 0, 0.095, 0, 10, 8));
  t1.add(t2);
  t0.add(t1);
  body.add(t0);

  room.add(root);
  refs.items.cat = root;
  refs.cat = {
    root,
    visual,
    body,
    torso,
    haunch,
    head,
    ears: [ears[0], ears[1]],
    eyesOpen,
    eyesClosed,
    legs,
    tail: [t0, t1, t2],
  };
}

export function buildCatToys(room: THREE.Group, refs: RoomRefs) {
  /* 1. Rolling yarn ball on the rug */
  const yarn = tag(new THREE.Group(), "yarn");
  yarn.position.set(...FURNITURE_POS.yarn);
  const yarnMain = M(PAL.mustard, 0.94);
  const yarnRib = M(0xd49630, 0.94);
  const yarnAccent = M(PAL.blush, 0.94);
  yarn.add(ball(0.066, yarnMain, 0, 0, 0, 18, 14));
  const wraps: [number, number, number, THREE.Material][] = [
    [0.2, 0.6, 0.4, yarnRib],
    [1.1, -0.5, 0.9, yarnRib],
    [-0.7, 0.9, 1.4, yarnAccent],
    [0.6, 1.3, -0.3, yarnRib],
  ];
  for (const [rx, ry, rz, mat] of wraps) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.0085, 6, 20), mat);
    ring.rotation.set(rx, ry, rz);
    ring.castShadow = true;
    yarn.add(ring);
  }
  yarn.add(hitProxy(0.28, 0.24, 0.28, 0, 0, 0));
  room.add(yarn);
  refs.items.yarn = yarn;

  /* 2. Feather wand in ceramic cup */
  const wand = tag(new THREE.Group(), "wand");
  wand.position.set(...FURNITURE_POS.wand);
  wand.add(cyl(0.07, 0.055, 0.15, M(PAL.cream, 0.65), 0, 0.075, 0, 14));

  const wandPole = new THREE.Group();
  wandPole.position.set(0, 0.12, 0);
  wandPole.rotation.set(0.26, 0.3, -0.18);
  wandPole.add(rod(v(0, 0, 0), v(0.08, 0.56, 0.05), 0.008, M(PAL.wood, 0.65), 8));
  wandPole.add(rod(v(0.08, 0.56, 0.05), v(0.18, 0.34, 0.12), 0.003, M(PAL.linen, 0.8), 6));

  const wandFeathers = new THREE.Group();
  wandFeathers.position.set(0.18, 0.34, 0.12);
  wandFeathers.add(ball(0.015, M(PAL.brass, 0.3, 0.7), 0, 0, 0, 10, 8));
  for (const [col, rx, rz] of [
    [PAL.tomato, 0.25, -0.3],
    [PAL.mustard, -0.2, 0.35],
    [PAL.sage, 0.1, 0.05],
  ] as const) {
    const f = ball(0.03, M(col, 0.78), 0, -0.055, 0, 10, 8);
    f.scale.set(0.45, 1.8, 0.28);
    f.rotation.set(rx, 0, rz);
    wandFeathers.add(f);
  }
  wandPole.add(wandFeathers);
  wand.add(wandPole, hitProxy(0.38, 0.74, 0.38, 0.08, 0.35, 0.06));
  room.add(wand);
  refs.items.wand = wand;

  /* 3. Sisal scratching post with hanging pom-pom */
  const scratcher = tag(new THREE.Group(), "scratcher");
  scratcher.position.set(...FURNITURE_POS.scratcher);
  scratcher.add(cyl(0.23, 0.24, 0.045, M(PAL.blush, 0.96), 0, 0.0225, 0, 22));
  const sisal = M(0xc8ab7b, 0.96);
  scratcher.add(cyl(0.062, 0.062, 0.54, sisal, 0, 0.31, 0, 18));
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.063, 0.006, 6, 18), M(0xb69666, 0.96));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.11 + i * 0.082;
    scratcher.add(ring);
  }
  const woodCap = M(PAL.wood, 0.72);
  scratcher.add(cyl(0.095, 0.095, 0.03, woodCap, 0, 0.59, 0, 16));
  scratcher.add(rod(v(0, 0.59, 0), v(0.18, 0.65, 0.16), 0.016, woodCap, 8));

  const pomPivot = new THREE.Group();
  pomPivot.position.set(0.18, 0.65, 0.16);
  pomPivot.add(rod(v(0, 0, 0), v(0, -0.22, 0), 0.0035, M(PAL.cream, 0.9), 6));
  pomPivot.add(ball(0.042, M(PAL.mustard, 0.96), 0, -0.22, 0, 12, 10));
  scratcher.add(pomPivot, hitProxy(0.56, 0.74, 0.56, 0.04, 0.36, 0.05));
  room.add(scratcher);
  refs.items.scratcher = scratcher;

  /* 4. Cozy cardboard box in the expanded corner */
  const catBox = tag(new THREE.Group(), "catBox");
  catBox.position.set(...FURNITURE_POS.catBox);
  catBox.rotation.y = -0.32;
  const kraft = M(0xc89e6d, 0.92);
  const bw = 0.48;
  const bh = 0.24;
  const bd = 0.4;
  const bt = 0.016;
  catBox.add(box(bw, 0.016, bd, kraft, 0, 0.008, 0));
  catBox.add(box(bw, bh, bt, kraft, 0, bh / 2, bd / 2 - bt / 2));
  catBox.add(box(bw, bh, bt, kraft, 0, bh / 2, -bd / 2 + bt / 2));
  catBox.add(box(bt, bh, bd - bt * 2, kraft, bw / 2 - bt / 2, bh / 2, 0));
  catBox.add(box(bt, bh, bd - bt * 2, kraft, -bw / 2 + bt / 2, bh / 2, 0));
  catBox.add(rbox(0.41, 0.04, 0.33, 0.018, M(PAL.linen, 0.98), 0, 0.032, 0));

  for (const sz of [-1, 1]) {
    const flap = new THREE.Group();
    flap.position.set(0, bh, sz * (bd / 2));
    flap.rotation.x = sz * 1.18;
    flap.add(box(bw - 0.02, 0.012, 0.11, kraft, 0, 0, sz * 0.055));
    catBox.add(flap);
  }
  for (const sx of [-1, 1]) {
    const flap = new THREE.Group();
    flap.position.set(sx * (bw / 2), bh, 0);
    flap.rotation.z = -sx * 1.05;
    flap.add(box(0.095, 0.012, bd - 0.03, kraft, sx * 0.048, 0, 0));
    catBox.add(flap);
  }
  catBox.add(hitProxy(0.56, 0.34, 0.48, 0, 0.15, 0));
  room.add(catBox);
  refs.items.catBox = catBox;

  /* 5. Red laser dot projected onto the floor */
  const laserDot = new THREE.Group();
  laserDot.visible = false;
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.022, 16),
    new THREE.MeshBasicMaterial({ color: 0xff2b2b, toneMapped: false }),
  );
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.012;
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.068, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff3b3b,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.011;
  laserDot.add(core, halo);
  room.add(laserDot);

  refs.toys.yarn = yarn;
  refs.toys.wand = wand;
  refs.toys.wandPole = wandPole;
  refs.toys.wandFeathers = wandFeathers;
  refs.toys.scratcher = scratcher;
  refs.toys.pomPivot = pomPivot;
  refs.toys.catBox = catBox;
  refs.toys.laserDot = laserDot;
}
