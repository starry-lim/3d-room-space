import * as THREE from "three";
import { M, PAL, UP, ball, box, cyl, hitProxy, rbox, rng, rod, v } from "../kit";
import { CHAIR_HOME_POS, CHAIR_HOME_YAW, FURNITURE_POS } from "../layout";
import { buildOpenBook, tag, type RoomRefs } from "./types";

export function buildDesk(room: THREE.Group, refs: RoomRefs) {
  const g = new THREE.Group();
  g.position.set(...FURNITURE_POS.desk);
  const wood = M(PAL.wood, 0.68);
  const light = M(PAL.woodLight, 0.7);
  const TOP = 0.79;

  g.add(rbox(2.2, 0.06, 0.9, 0.02, wood, 0, 0.76, 0));
  for (const z of [-0.37, 0.37]) g.add(box(0.07, 0.73, 0.07, wood, -1.02, 0.365, z));
  g.add(rbox(0.56, 0.56, 0.8, 0.02, wood, 0.78, 0.45, 0));
  for (const x of [0.55, 1.01]) for (const z of [-0.34, 0.34]) g.add(box(0.06, 0.17, 0.06, wood, x, 0.085, z));
  for (const y of [0.59, 0.32]) {
    g.add(rbox(0.48, 0.23, 0.02, 0.008, light, 0.78, y, 0.405));
    g.add(ball(0.022, M(PAL.brass, 0.4, 0.6), 0.78, y, 0.425, 10, 8));
  }

  /* laptop — its screen mirrors the pomodoro timer */
  const laptop = tag(new THREE.Group(), "timer");
  laptop.position.set(0, TOP, 0.02);
  laptop.rotation.y = 0.08;
  const shell = M(0xd9d2c5, 0.5, 0.2);
  laptop.add(rbox(0.52, 0.022, 0.36, 0.01, shell, 0, 0.011, 0));
  const keys = box(0.44, 0.003, 0.19, M(PAL.metal, 0.8), 0, 0.0235, -0.03);
  keys.castShadow = false;
  laptop.add(keys);
  const lid = new THREE.Group();
  lid.position.set(0, 0.022, -0.175);
  lid.rotation.x = -0.3;
  lid.add(rbox(0.52, 0.34, 0.014, 0.006, shell, 0, 0.17, 0));
  const sc = document.createElement("canvas");
  sc.width = 256;
  sc.height = 160;
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.3),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );
  screen.position.set(0, 0.172, 0.0078);
  lid.add(screen);
  laptop.add(lid);
  g.add(laptop);
  refs.screenCanvas = sc;
  refs.screenTex = screenTex;

  /* desk lamp */
  const lamp = tag(new THREE.Group(), "lamp");
  lamp.position.set(-0.92, TOP, -0.24);
  const mustard = M(PAL.mustard, 0.55);
  const metal = M(PAL.metal, 0.5, 0.3);
  lamp.add(cyl(0.12, 0.13, 0.03, mustard, 0, 0.015, 0));
  const joint = v(0, 0.47, 0);
  const headPos = v(0.3, 0.68, 0.04);
  lamp.add(rod(v(0, 0.03, 0), joint, 0.013, metal), ball(0.026, metal, 0, 0.47, 0, 10, 8));
  lamp.add(rod(joint, headPos, 0.011, metal));
  const head = new THREE.Group();
  head.position.copy(headPos);
  const aim = v(0.8, 0, 0.35).sub(headPos).normalize();
  head.quaternion.setFromUnitVectors(v(0, -1, 0), aim);
  const shadeMat = new THREE.MeshStandardMaterial({ color: PAL.mustard, roughness: 0.55, side: THREE.DoubleSide });
  const shade = cyl(0.04, 0.13, 0.17, shadeMat, 0, -0.02, 0, 24, true);
  head.add(shade, ball(0.045, mustard, 0, 0.065, 0, 12, 8));
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3dc,
    emissive: 0xffc98a,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const bulb = ball(0.04, bulbMat, 0, -0.05, 0, 12, 8);
  bulb.castShadow = false;
  head.add(bulb);
  lamp.add(head, hitProxy(0.5, 0.8, 0.3, 0.12, 0.4, 0));
  g.add(lamp);
  refs.items.lamp = lamp;
  refs.lampHead = head;
  refs.lampBulb = bulbMat;

  /* mug */
  const mug = tag(new THREE.Group(), "mug");
  mug.position.set(-0.5, TOP, 0.24);
  const mugMat = M(PAL.indigo, 0.4);
  const outerWall = cyl(0.055, 0.047, 0.11, mugMat, 0, 0.055, 0, 24, true);
  const base = cyl(0.047, 0.047, 0.012, mugMat, 0, 0.006, 0, 24);
  const innerMat = new THREE.MeshStandardMaterial({ color: PAL.cream, roughness: 0.45, side: THREE.BackSide });
  const innerWall = cyl(0.0465, 0.0405, 0.096, innerMat, 0, 0.06, 0, 24, true);
  innerWall.castShadow = false;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.0508, 0.0044, 8, 28), mugMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.108;
  lip.castShadow = true;
  const coffee = cyl(0.0452, 0.0445, 0.004, M(0x4a2c1e, 0.22), 0, 0.09, 0, 24);
  coffee.castShadow = false;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16, Math.PI), mugMat);
  handle.position.set(0.05, 0.056, 0);
  handle.rotation.z = -Math.PI / 2 - 0.073;
  handle.castShadow = true;
  mug.add(outerWall, base, innerWall, lip, coffee, handle, hitProxy(0.26, 0.3, 0.26, 0, 0.12, 0));
  mug.rotation.y = -0.6;
  g.add(mug);
  refs.items.mug = mug;
  refs.mug = mug;

  /* notebook + pen */
  const note = tag(new THREE.Group(), "study");
  note.position.set(-0.84, TOP, 0.2);
  note.rotation.y = 0.25;
  note.add(box(0.27, 0.014, 0.2, M(PAL.tomato, 0.7), 0, 0.007, 0));
  note.add(box(0.25, 0.006, 0.185, M(PAL.linen, 0.9), 0.005, 0.016, 0));
  note.add(rod(v(-0.08, 0.026, 0.05), v(0.07, 0.026, -0.03), 0.006, M(PAL.indigo, 0.4), 6));
  note.add(hitProxy(0.36, 0.14, 0.28, 0, 0.05, 0));
  g.add(note);
  refs.items.study = note;

  /* open study book — appears when the player sits down to focus */
  const studyBook = buildOpenBook({
    id: "study",
    coverColor: PAL.tomato,
    coverRoughness: 0.78,
    coverSize: [0.34, 0.012, 0.23],
    pageSize: [0.155, 0.014, 0.21],
    pageOffsetX: 0.08,
    pageTilt: 0.04,
    inkWidth: 0.11,
    inkStartZ: -0.065,
    inkStepZ: 0.042,
    flipSize: [0.15, 0.003, 0.205],
    flipOffsetX: 0.075,
    hitBox: [0.38, 0.14, 0.28, 0, 0.05, 0],
  });
  studyBook.root.position.set(-0.04, TOP + 0.002, 0.31);
  g.add(studyBook.root);
  refs.studyBook = studyBook;

  /* tomato timer */
  const tomato = tag(new THREE.Group(), "timer");
  tomato.position.set(0.42, TOP, 0.2);
  const red = M(PAL.tomato, 0.42);
  const body = ball(0.11, red, 0, 0.092, 0, 28, 18);
  body.scale.y = 0.84;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.1105, 0.006, 8, 40), M(PAL.cream, 0.6));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.092;
  const cap = new THREE.Group();
  cap.position.y = 0.092;
  const leafMat = M(PAL.leaf, 0.6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.075, 6), leafMat);
    leaf.position.set(Math.cos(a) * 0.035, 0.085, Math.sin(a) * 0.035);
    leaf.quaternion.setFromUnitVectors(UP, v(Math.cos(a), -0.28, Math.sin(a)).normalize());
    leaf.castShadow = true;
    cap.add(leaf);
  }
  cap.add(cyl(0.008, 0.011, 0.04, M(PAL.leafDark, 0.6), 0, 0.105, 0, 6));
  cap.add(ball(0.013, M(PAL.cream, 0.5), 0, 0.03, 0.1, 8, 6));
  tomato.add(body, band, cap, hitProxy(0.36, 0.34, 0.36, 0, 0.14, 0));
  g.add(tomato);
  refs.items.timer = tomato;
  refs.tomato = tomato;
  refs.tomatoCap = cap;

  /* star jar — fills as focus sessions are completed */
  const jar = new THREE.Group();
  jar.position.set(0.84, TOP, 0.22);
  const glass = cyl(
    0.085,
    0.085,
    0.2,
    new THREE.MeshStandardMaterial({
      color: 0xe6f6ff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      depthWrite: false,
    }),
    0,
    0.1,
    0,
  );
  glass.castShadow = false;
  jar.add(glass, cyl(0.07, 0.076, 0.035, M(0xb98a5e, 0.9), 0, 0.216, 0));
  const jarStars = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.021),
    new THREE.MeshBasicMaterial({ color: 0xffd45e, toneMapped: false }),
    36,
  );
  const dummy = new THREE.Object3D();
  const r = rng(9);
  for (let i = 0; i < 36; i++) {
    const layer = Math.floor(i / 6);
    const k = i % 6;
    const a = (k / 5) * Math.PI * 2 + layer * 0.6;
    const rad = k === 0 ? 0 : 0.05;
    dummy.position.set(Math.cos(a) * rad, 0.028 + layer * 0.029, Math.sin(a) * rad);
    dummy.rotation.set(r() * 3, r() * 3, r() * 3);
    dummy.updateMatrix();
    jarStars.setMatrixAt(i, dummy.matrix);
  }
  jarStars.count = 0;
  jarStars.frustumCulled = false;
  jar.add(jarStars);
  g.add(jar);
  refs.jar = jar;
  refs.jarStars = jarStars;

  /* book stack + pencil cup */
  const bookStack = tag(new THREE.Group(), "study");
  const stack: [number, number, number][] = [
    [PAL.indigo, 0, 0.1],
    [PAL.cream, 0.045, -0.2],
    [PAL.sage, 0.09, 0.3],
  ];
  for (const [col, y, rot] of stack) {
    const b = rbox(0.3, 0.045, 0.22, 0.008, M(col, 0.8), 0.8, TOP + 0.0225 + y, -0.22);
    b.rotation.y = rot;
    bookStack.add(b);
  }
  bookStack.add(hitProxy(0.38, 0.22, 0.3, 0.8, TOP + 0.08, -0.22));
  g.add(bookStack);
  g.add(cyl(0.045, 0.04, 0.11, M(PAL.sage, 0.6), 0.42, TOP + 0.055, -0.3));
  const pens: [number, number, number][] = [
    [PAL.tomato, 0.03, 0.02],
    [PAL.mustard, -0.03, 0.01],
    [PAL.indigo, 0.0, -0.035],
  ];
  for (const [col, dx, dz] of pens) {
    g.add(rod(v(0.42, TOP + 0.02, -0.3), v(0.42 + dx, TOP + 0.2, -0.3 + dz), 0.007, M(col, 0.5), 6));
  }

  /* laser pointer pen on the front-right desk */
  const laserPen = tag(new THREE.Group(), "laser");
  laserPen.position.set(0.63, TOP, 0.26);
  laserPen.rotation.y = 0.45;
  const barrel = cyl(0.009, 0.009, 0.125, M(0xd8d3cc, 0.35, 0.45), 0, 0.009, 0, 10);
  barrel.rotation.z = Math.PI / 2;
  const emitter = cyl(0.005, 0.009, 0.016, M(PAL.tomato, 0.4), -0.068, 0.009, 0, 10);
  emitter.rotation.z = Math.PI / 2;
  const btn = box(0.014, 0.005, 0.006, M(PAL.ink, 0.5), 0.015, 0.019, 0);
  btn.castShadow = false;
  laserPen.add(barrel, emitter, btn, hitProxy(0.24, 0.14, 0.24, 0, 0.04, 0));
  g.add(laserPen);
  refs.items.laser = laserPen;
  refs.toys.laserPen = laserPen;

  room.add(g);
}

export function buildChair(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "study");
  g.position.copy(CHAIR_HOME_POS);
  g.rotation.y = CHAIR_HOME_YAW;
  const wood = M(PAL.woodDark, 0.7);
  g.add(rbox(0.5, 0.05, 0.48, 0.02, wood, 0, 0.47, 0));
  g.add(rbox(0.44, 0.07, 0.42, 0.03, M(PAL.mustard, 0.95), 0, 0.525, 0));
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      g.add(rod(v(x * 0.19, 0.46, z * 0.18), v(x * 0.23, 0, z * 0.22), 0.021, wood));
    }
  }
  for (const x of [-0.21, 0.21]) g.add(rod(v(x, 0.47, 0.21), v(x, 1.0, 0.27), 0.02, wood));
  const back = rbox(0.5, 0.24, 0.04, 0.018, wood, 0, 0.88, 0.258);
  back.rotation.x = 0.11;
  g.add(back, hitProxy(0.62, 1.0, 0.62, 0, 0.5, 0));
  room.add(g);
  refs.chair = g;
}

export function buildBookshelf(room: THREE.Group, refs: RoomRefs) {
  const g = new THREE.Group();
  g.position.set(...FURNITURE_POS.bookshelf);
  const wood = M(PAL.woodDark, 0.72);
  const H = 2.3;
  g.add(box(0.05, H, 0.42, wood, -0.625, H / 2, 0), box(0.05, H, 0.42, wood, 0.625, H / 2, 0));
  g.add(box(1.3, 0.05, 0.42, wood, 0, H - 0.025, 0), box(1.3, 0.08, 0.42, wood, 0, 0.04, 0));
  g.add(box(1.2, H, 0.02, M(0x6f4630, 0.9), 0, H / 2, -0.2));
  const levels = [0.08, 0.62, 1.16, 1.7];
  for (const y of levels.slice(1)) g.add(box(1.2, 0.04, 0.4, wood, 0, y - 0.02, 0));

  const colors = [0xcf6f4f, 0x3f4a78, 0xe3ad4a, 0x7d9b76, 0xf1e4cc, 0x9a6a41, 0x5a7d9a, 0xb5536b, 0x2f5d50].map(
    (c) => new THREE.Color(c),
  );
  const books = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.82 }),
    110,
  );
  books.castShadow = books.receiveShadow = true;
  const d = new THREE.Object3D();
  const r = rng(21);
  let n = 0;
  const put = (x: number, y: number, z: number, w: number, h: number, dp: number, rz = 0) => {
    if (n >= 110) return;
    d.position.set(x, y, z);
    d.rotation.set(0, 0, rz);
    d.scale.set(w, h, dp);
    d.updateMatrix();
    books.setMatrixAt(n, d.matrix);
    books.setColorAt(n, colors[Math.floor(r() * colors.length)]);
    n++;
  };
  const fill = (y: number, xa: number, xb: number, lean = false) => {
    let x = xa;
    for (;;) {
      const w = 0.036 + r() * 0.045;
      if (x + w > xb) break;
      const h = 0.27 + r() * 0.15;
      const dp = 0.23 + r() * 0.06;
      put(x + w / 2, y + h / 2, 0.185 - dp / 2 - r() * 0.02, w, h, dp);
      x += w + 0.002;
    }
    if (lean) put(x + 0.062, y + 0.158, 0.04, 0.05, 0.31, 0.26, 0.27);
  };
  const flat = (y: number, x: number, count: number) => {
    for (let i = 0; i < count; i++) put(x + (r() - 0.5) * 0.03, y + 0.024 + i * 0.048, 0.03, 0.3, 0.046, 0.22);
  };
  fill(levels[0], -0.58, 0.14, true);
  flat(levels[0], 0.4, 3);
  fill(levels[1], -0.58, -0.2);
  fill(levels[1], -0.09, 0.12, true);
  fill(levels[2], -0.2, 0.58);
  fill(levels[3], -0.58, 0.04, true);
  flat(H, -0.3, 2);
  books.count = n;
  books.instanceMatrix.needsUpdate = true;
  if (books.instanceColor) books.instanceColor.needsUpdate = true;
  g.add(books);

  /* the one book that sticks out */
  const special = tag(new THREE.Group(), "book");
  special.position.set(-0.145, levels[1] + 0.185, 0.125);
  special.add(rbox(0.062, 0.37, 0.27, 0.008, M(PAL.tomato, 0.6)));
  special.add(box(0.064, 0.03, 0.272, M(PAL.brass, 0.35, 0.7), 0, 0.11, 0));
  special.add(box(0.064, 0.012, 0.272, M(PAL.brass, 0.35, 0.7), 0, -0.12, 0));
  special.add(hitProxy(0.15, 0.44, 0.36, 0, 0, 0.02));
  g.add(special);
  refs.items.book = special;
  refs.specialBook = special;

  /* shelf decor */
  const pot = new THREE.Group();
  pot.position.set(0.4, levels[1], 0.02);
  pot.add(cyl(0.07, 0.055, 0.1, M(PAL.terracotta, 0.9), 0, 0.05, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = ball(0.05, M(i % 2 ? PAL.leaf : PAL.leafDark, 0.7), Math.cos(a) * 0.05, 0.17, Math.sin(a) * 0.05, 8, 6);
    leaf.scale.set(0.7, 1.5, 0.7);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    pot.add(leaf);
  }
  g.add(pot);

  const frame = new THREE.Group();
  frame.position.set(-0.42, levels[2], 0.03);
  frame.rotation.set(-0.16, 0.2, 0);
  frame.add(rbox(0.2, 0.26, 0.02, 0.006, M(PAL.wood, 0.7), 0, 0.13, 0));
  frame.add(box(0.15, 0.21, 0.004, M(PAL.blush, 0.9), 0, 0.13, 0.011));
  g.add(frame);

  const duck = new THREE.Group();
  duck.position.set(0.38, levels[3], 0.04);
  duck.rotation.y = -0.5;
  const yellow = M(0xf7cf4a, 0.5);
  const db = ball(0.055, yellow, 0, 0.045, 0, 14, 10);
  db.scale.set(1, 0.82, 1.25);
  duck.add(db, ball(0.036, yellow, 0, 0.105, 0.035, 12, 8));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 8), M(PAL.tomato, 0.5));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.1, 0.075);
  duck.add(beak, ball(0.005, M(PAL.ink), 0.016, 0.115, 0.062, 6, 4), ball(0.005, M(PAL.ink), -0.016, 0.115, 0.062, 6, 4));
  g.add(duck);

  /* trailing plant on top */
  const vine = new THREE.Group();
  vine.position.set(0.36, H, 0.02);
  vine.add(cyl(0.09, 0.07, 0.13, M(PAL.cream, 0.8), 0, 0.065, 0));
  const lm = [M(PAL.leaf, 0.7), M(PAL.leafDark, 0.7)];
  for (let s = 0; s < 5; s++) {
    const a = -0.5 + s * 0.72;
    const len = 5 + Math.floor(r() * 4);
    for (let i = 0; i < len; i++) {
      const out = 0.09 + Math.min(i, 2) * 0.05;
      const leaf = ball(0.036, lm[(i + s) % 2], Math.sin(a) * out + (r() - 0.5) * 0.03, 0.14 - i * 0.085, Math.cos(a) * out, 8, 6);
      leaf.scale.set(1, 0.45, 0.8);
      leaf.rotation.set(r() - 0.5, r() * 3, r() - 0.5);
      vine.add(leaf);
    }
  }
  g.add(vine);

  room.add(g);
}
