import * as THREE from "three";
import { DEFAULT_AVATAR } from "../game/data";
import { buildAvatar, type AvatarRig } from "./avatars";
import {
  PAL,
  M,
  box,
  rbox,
  cyl,
  ball,
  hitProxy,
  rng,
  woodFloorTexture,
  rugTexture,
  blanketTexture,
  posterTexture,
  clockTexture,
  globeTexture,
} from "./kit";

export type { AvatarRig } from "./avatars";

export type InteractId =
  | "timer"
  | "bed"
  | "lamp"
  | "window"
  | "cat"
  | "mug"
  | "plant"
  | "radio"
  | "book"
  | "study"
  | "fairy"
  | "candle"
  | "globe"
  | "glowstars"
  | "mouse"
  | "box"
  | "pouf"
  | "poufBook"
  | "mat"
  | "dumbbells"
  | "bike"
  | "todo"
  | "yarn"
  | "wand"
  | "scratcher"
  | "catBox"
  | "laser";

/** Room floor bounds (world X/Z). Expanded +X and +Z for fitness corner & cat toys. */
export const ROOM = { minX: -3, maxX: 5.2, minZ: -3, maxZ: 3.6 };

/** Window opening in the back wall (world units). The sunbeam is derived from this. */
export const WINDOW = { x0: -1.0, x1: 0.8, y0: 1.2, y1: 2.7, z: -3.0 };
export const WALL_H = 3.4;
const T = 0.22; // wall thickness
const UP = new THREE.Vector3(0, 1, 0);

export interface RoomRefs {
  items: Partial<Record<InteractId, THREE.Object3D>>;
  curtains: { mesh: THREE.Mesh; base: Float32Array; phase: number }[];
  screenCanvas: HTMLCanvasElement;
  screenTex: THREE.CanvasTexture;
  lampHead: THREE.Object3D;
  lampBulb: THREE.MeshStandardMaterial;
  tomato: THREE.Group;
  tomatoCap: THREE.Group;
  mug: THREE.Group;
  jar: THREE.Group;
  jarStars: THREE.InstancedMesh;
  bedLump: THREE.Mesh;
  pillow: THREE.Object3D;
  box: THREE.Group;
  boxLid: THREE.Group;
  specialBook: THREE.Object3D;
  radio: THREE.Group;
  globe: THREE.Object3D;
  clock: { h: THREE.Object3D; m: THREE.Object3D; s: THREE.Object3D };
  fairyBulbs: THREE.InstancedMesh;
  fairyColors: THREE.Color[];
  glowStarMat: THREE.MeshStandardMaterial;
  glowStarPoints: THREE.Vector3[];
  mouse: THREE.Group;
  cat: CatRig;
  chair: THREE.Group;
  studyBook: { root: THREE.Group; flipPage: THREE.Group };
  poufBookFloor: THREE.Group;
  poufLapBook: { root: THREE.Group; flipPage: THREE.Group };
  todoCanvas: HTMLCanvasElement;
  todoTex: THREE.CanvasTexture;
  rackDumbbells: THREE.Group;
  bike: { root: THREE.Group; flywheel: THREE.Group; crank: THREE.Group };
  toys: {
    yarn: THREE.Group;
    wand: THREE.Group;
    wandPole: THREE.Group;
    wandFeathers: THREE.Group;
    scratcher: THREE.Group;
    pomPivot: THREE.Group;
    catBox: THREE.Group;
    laserPen: THREE.Group;
    laserDot: THREE.Group;
  };
  avatar: AvatarRig;
  plant: { leaves: THREE.Group; stems: THREE.Object3D[]; flowers: THREE.Group[] };
  flame: THREE.Mesh;
}

export interface CatRig {
  root: THREE.Group;
  visual: THREE.Group;
  body: THREE.Group;
  torso: THREE.Mesh;
  haunch: THREE.Mesh;
  head: THREE.Group;
  ears: [THREE.Group, THREE.Group];
  eyesOpen: THREE.Group;
  eyesClosed: THREE.Group;
  legs: { fl: THREE.Group; fr: THREE.Group; bl: THREE.Group; br: THREE.Group };
  tail: [THREE.Group, THREE.Group, THREE.Group];
}

function tag<T extends THREE.Object3D>(o: T, id: InteractId): T {
  o.userData.interact = id;
  return o;
}

/** Thin cylinder between two points — stems, pencils, antennas, lamp arms. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = cyl(r, r, d.length(), mat, 0, 0, 0, seg);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ */

export function buildRoom(): { room: THREE.Group; refs: RoomRefs } {
  const room = new THREE.Group();
  const refs = { items: {}, curtains: [], glowStarPoints: [], toys: {} } as unknown as RoomRefs;

  shell(room);
  windowAndCurtains(room, refs);
  desk(room, refs);
  chair(room, refs);
  bed(room, refs);
  bookshelf(room, refs);
  consoleTable(room, refs);
  wallDecor(room, refs);
  todoBoard(room, refs);
  cat(room, refs);
  const av = buildAvatar(DEFAULT_AVATAR);
  room.add(av.root);
  refs.avatar = av;
  plant(room, refs);
  floorBits(room, refs);
  exerciseCorner(room, refs);
  catToys(room, refs);

  return { room, refs };
}

/* ------------------------------------------------------------------ */

function shell(room: THREE.Group) {
  const wall = M(PAL.wall, 0.96);
  const low = M(PAL.wallLow, 0.96);
  const trim = M(PAL.trim, 0.8);
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const cx = (ROOM.minX + ROOM.maxX) / 2;
  const cz = (ROOM.minZ + ROOM.maxZ) / 2;

  room.add(rbox(W + T + 0.1, 0.5, D + T + 0.1, 0.08, M(PAL.base, 0.95), cx - T / 2, -0.29, cz - T / 2));

  const floorTex = woodFloorTexture();
  floorTex.repeat.set((W / 6) * 3, (D / 6) * 3);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.74 });
  const floor = box(W, 0.04, D, floorMat, cx, -0.02, cz);
  floor.castShadow = false;
  room.add(floor);

  // left wall
  room.add(box(T, WALL_H, D + T, wall, -3 - T / 2, WALL_H / 2, cz - T / 2));
  // back wall, built around the window opening so real light can pour through
  const zc = -3 - T / 2;
  const { x0, x1, y0, y1 } = WINDOW;
  room.add(box(x0 - ROOM.minX, WALL_H, T, wall, (x0 + ROOM.minX) / 2, WALL_H / 2, zc));
  room.add(box(ROOM.maxX - x1, WALL_H, T, wall, (ROOM.maxX + x1) / 2, WALL_H / 2, zc));
  room.add(box(x1 - x0, y0, T, wall, (x0 + x1) / 2, y0 / 2, zc));
  room.add(box(x1 - x0, WALL_H - y1, T, wall, (x0 + x1) / 2, (WALL_H + y1) / 2, zc));

  // caps, wainscot, rail, baseboards
  room.add(box(T + 0.05, 0.06, D + T + 0.05, trim, -3 - T / 2, WALL_H + 0.03, cz - T / 2));
  room.add(box(W, 0.06, T + 0.05, trim, cx, WALL_H + 0.03, zc));
  const w1 = box(0.012, 1.0, D, low, -2.994, 0.5, cz);
  const w2 = box(W, 1.0, 0.012, low, cx, 0.5, -2.994);
  w1.castShadow = w2.castShadow = false;
  room.add(w1, w2);
  room.add(box(0.035, 0.05, D, trim, -2.983, 1.02, cz), box(W, 0.05, 0.035, trim, cx, 1.02, -2.983));
  room.add(box(0.04, 0.14, D, trim, -2.98, 0.07, cz), box(W, 0.14, 0.04, trim, cx, 0.07, -2.98));
}

/* ------------------------------------------------------------------ */

function windowAndCurtains(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "window");
  const trim = M(PAL.trim, 0.7);
  const { x0, x1, y0, y1, z } = WINDOW;
  const zc = z - T / 2;
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const d = T + 0.06;

  g.add(box(w, 0.07, d, trim, cx, y1 - 0.035, zc), box(w, 0.07, d, trim, cx, y0 + 0.035, zc));
  g.add(box(0.07, h, d, trim, x0 + 0.035, cy, zc), box(0.07, h, d, trim, x1 - 0.035, cy, zc));
  g.add(box(0.045, h, 0.05, trim, cx, cy, zc), box(w, 0.045, 0.05, trim, cx, y0 + h * 0.62, zc));
  g.add(rbox(w + 0.3, 0.05, T + 0.3, 0.015, trim, cx, y0 - 0.02, zc + 0.11));

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      color: 0xd6ecff,
      transparent: true,
      opacity: 0.1,
      roughness: 0.05,
      depthWrite: false,
    }),
  );
  glass.position.set(cx, cy, zc);
  g.add(glass);

  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0xfbf1e0,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.52, 1.62, 12, 8);
    const mesh = new THREE.Mesh(geo, curtainMat);
    mesh.position.set(side < 0 ? x0 - 0.06 : x1 + 0.06, 2.065, z + 0.1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    refs.curtains.push({
      mesh,
      base: Float32Array.from(geo.attributes.position.array as Float32Array),
      phase: side * 1.3,
    });
    g.add(mesh);
  }
  const metal = M(PAL.metal, 0.5, 0.3);
  const pole = cyl(0.016, 0.016, 2.6, metal, cx, 2.9, z + 0.1, 10);
  pole.rotation.z = Math.PI / 2;
  g.add(pole, ball(0.035, metal, cx - 1.3, 2.9, z + 0.1), ball(0.035, metal, cx + 1.3, 2.9, z + 0.1));

  room.add(g);
  refs.items.window = g;

  /* --- things on the sill --- */
  const candle = tag(new THREE.Group(), "candle");
  candle.position.set(0.5, y0 + 0.005, -2.87);
  candle.add(cyl(0.055, 0.06, 0.015, M(PAL.brass, 0.4, 0.6), 0, 0.008, 0));
  candle.add(cyl(0.034, 0.036, 0.11, M(PAL.linen, 0.6), 0, 0.07, 0));
  candle.add(cyl(0.003, 0.003, 0.02, M(PAL.ink), 0, 0.134, 0, 5));
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, toneMapped: false }),
  );
  flame.scale.set(0.75, 1.6, 0.75);
  flame.position.y = 0.165;
  candle.add(flame, hitProxy(0.24, 0.32, 0.24, 0, 0.14, 0));
  room.add(candle);
  refs.items.candle = candle;
  refs.flame = flame;

  const suc = new THREE.Group();
  suc.position.set(-0.72, y0 + 0.005, -2.87);
  suc.add(cyl(0.055, 0.042, 0.08, M(PAL.linen, 0.7), 0, 0.04, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = ball(0.03, M(i % 2 ? PAL.sage : PAL.leaf, 0.7), Math.cos(a) * 0.03, 0.1, Math.sin(a) * 0.03, 8, 6);
    leaf.scale.set(0.8, 1.5, 0.8);
    leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    suc.add(leaf);
  }
  suc.add(ball(0.028, M(PAL.leaf, 0.7), 0, 0.12, 0, 8, 6));
  room.add(suc);
}

/* ------------------------------------------------------------------ */

function desk(room: THREE.Group, refs: RoomRefs) {
  const g = new THREE.Group();
  g.position.set(-0.1, 0, -2.5);
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
  const studyBook = tag(new THREE.Group(), "study");
  studyBook.position.set(-0.04, TOP + 0.002, 0.31);
  studyBook.visible = false;
  studyBook.add(box(0.34, 0.012, 0.23, M(PAL.tomato, 0.78), 0, 0.006, 0));
  const linenMat = M(PAL.linen, 0.95);
  const inkLine = M(0x9b8b7f, 0.9);
  const sPageL = box(0.155, 0.014, 0.21, linenMat, -0.08, 0.015, 0);
  const sPageR = box(0.155, 0.014, 0.21, linenMat, 0.08, 0.015, 0);
  sPageL.rotation.z = -0.04;
  sPageR.rotation.z = 0.04;
  studyBook.add(sPageL, sPageR);
  for (let i = 0; i < 4; i++) {
    const lz = -0.065 + i * 0.042;
    const lineL = box(0.11, 0.002, 0.007, inkLine, -0.08, 0.023, lz);
    const lineR = box(0.11, 0.002, 0.007, inkLine, 0.08, 0.023, lz);
    lineL.castShadow = lineR.castShadow = false;
    studyBook.add(lineL, lineR);
  }
  const flipPage = new THREE.Group();
  flipPage.position.set(0, 0.023, 0);
  const flipLeaf = box(0.15, 0.003, 0.205, linenMat, 0.075, 0, 0);
  flipLeaf.castShadow = false;
  flipPage.add(flipLeaf);
  studyBook.add(flipPage, hitProxy(0.38, 0.14, 0.28, 0, 0.05, 0));
  g.add(studyBook);
  refs.studyBook = { root: studyBook, flipPage };

  /* tomato timer */
  const tomato = tag(new THREE.Group(), "timer");
  tomato.position.set(0.42, TOP, 0.2);
  const red = new THREE.MeshStandardMaterial({ color: PAL.tomato, roughness: 0.42 });
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

/* ------------------------------------------------------------------ */

function chair(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "study");
  g.position.set(-0.25, 0, -1.55);
  g.rotation.y = -0.38;
  const wood = M(PAL.woodDark, 0.7);
  g.add(rbox(0.5, 0.05, 0.48, 0.02, wood, 0, 0.47, 0));
  g.add(rbox(0.44, 0.07, 0.42, 0.03, M(PAL.mustard, 0.95), 0, 0.525, 0));
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      g.add(rod(v(x * 0.19, 0.46, z * 0.18), v(x * 0.23, 0, z * 0.22), 0.021, wood));
    }
  for (const x of [-0.21, 0.21]) g.add(rod(v(x, 0.47, 0.21), v(x, 1.0, 0.27), 0.02, wood));
  const back = rbox(0.5, 0.24, 0.04, 0.018, wood, 0, 0.88, 0.258);
  back.rotation.x = 0.11;
  g.add(back, hitProxy(0.62, 1.0, 0.62, 0, 0.5, 0));
  room.add(g);
  refs.chair = g;
}

/* ------------------------------------------------------------------ */

function bed(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "bed");
  g.position.set(-2.25, 0, -1.625);
  const wood = M(PAL.wood, 0.7);

  for (const x of [-0.62, 0.62]) for (const z of [-1.24, 1.24]) g.add(box(0.09, 0.22, 0.09, wood, x, 0.11, z));
  g.add(rbox(1.4, 0.2, 2.65, 0.03, wood, 0, 0.31, 0));
  g.add(rbox(1.4, 0.92, 0.09, 0.04, wood, 0, 0.72, -1.28));
  g.add(rbox(1.32, 0.2, 2.5, 0.06, M(PAL.linen, 0.95), 0, 0.5, 0.03));

  const tex = blanketTexture();
  tex.repeat.set(1, 5);
  const blanket = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const texSide = blanketTexture();
  texSide.repeat.set(5, 1);
  texSide.rotation = Math.PI / 2;
  const blanketSide = new THREE.MeshStandardMaterial({ map: texSide, roughness: 1 });
  g.add(rbox(1.37, 0.13, 1.74, 0.06, blanket, 0, 0.585, 0.45));
  g.add(rbox(0.05, 0.36, 1.74, 0.02, blanketSide, 0.685, 0.45, 0.45));
  g.add(rbox(1.37, 0.36, 0.05, 0.02, M(PAL.indigo, 1), 0, 0.45, 1.31));
  g.add(rbox(1.38, 0.145, 0.3, 0.06, M(0xfffaf0, 0.95), 0, 0.59, -0.5));

  const pillow = rbox(0.74, 0.16, 0.44, 0.075, M(0xfffaf0, 0.95), -0.06, 0.67, -0.95);
  pillow.rotation.y = 0.07;
  g.add(pillow);
  const cushion = rbox(0.4, 0.4, 0.13, 0.06, M(PAL.mustard, 0.95), 0.36, 0.8, -1.15);
  cushion.rotation.set(-0.28, 0, 0.12);
  g.add(cushion);

  // the sleeper under the blanket — only swells up while resting
  const lump = ball(1, blanket, -0.06, 0.6, 0.28, 20, 12);
  lump.geometry.rotateX(Math.PI / 2); // poles along the bed, so the stripes run across it like the blanket
  lump.scale.set(0.3, 0.001, 0.62);
  lump.visible = false;
  g.add(lump);

  room.add(g);
  refs.items.bed = g;
  refs.bedLump = lump;
  refs.pillow = pillow;

  /* secret: a shoebox tucked under the bed */
  const sb = tag(new THREE.Group(), "box");
  sb.position.set(-1.84, 0, -1.15);
  sb.rotation.y = 0.2;
  const kraft = M(0xc9a473, 0.9);
  sb.add(box(0.36, 0.12, 0.24, kraft, 0, 0.06, 0));
  const lid = new THREE.Group();
  lid.position.set(0, 0.12, -0.125);
  lid.add(box(0.38, 0.035, 0.26, M(PAL.tomato, 0.8), 0, 0.012, 0.125));
  sb.add(lid, hitProxy(0.44, 0.2, 0.32, 0, 0.1, 0));
  room.add(sb);
  refs.items.box = sb;
  refs.box = sb;
  refs.boxLid = lid;
}

/* ------------------------------------------------------------------ */

function bookshelf(room: THREE.Group, refs: RoomRefs) {
  const g = new THREE.Group();
  g.position.set(2.2, 0, -2.76);
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

/* ------------------------------------------------------------------ */

function consoleTable(room: THREE.Group, refs: RoomRefs) {
  const g = new THREE.Group();
  g.position.set(-2.72, 0, 1.8);
  const wood = M(PAL.wood, 0.7);
  g.add(rbox(0.46, 0.46, 1.4, 0.02, wood, 0, 0.39, 0));
  for (const x of [-0.17, 0.17]) for (const z of [-0.6, 0.6]) g.add(cyl(0.022, 0.015, 0.16, M(PAL.woodDark), x, 0.08, z, 8));
  for (const z of [-0.34, 0.34]) {
    g.add(rbox(0.02, 0.38, 0.64, 0.008, M(PAL.woodLight, 0.7), 0.235, 0.39, z));
    g.add(ball(0.02, M(PAL.brass, 0.4, 0.6), 0.255, 0.42, z > 0 ? z - 0.26 : z + 0.26, 8, 6));
  }
  const TOP = 0.62;

  /* radio — faces +x (into the room) */
  const radio = tag(new THREE.Group(), "radio");
  radio.position.set(0.02, TOP, -0.3);
  radio.rotation.y = Math.PI / 2 - 0.18;
  radio.add(rbox(0.44, 0.26, 0.17, 0.04, M(PAL.cream, 0.6), 0, 0.13, 0));
  const grille = cyl(0.085, 0.085, 0.012, M(0x5b4034, 0.9), -0.1, 0.13, 0.083);
  grille.rotation.x = Math.PI / 2;
  radio.add(grille);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.008, 8, 28), M(PAL.brass, 0.4, 0.6));
  ring.position.set(-0.1, 0.13, 0.088);
  radio.add(ring);
  radio.add(box(0.15, 0.055, 0.012, M(PAL.mustard, 0.5), 0.11, 0.18, 0.083));
  for (const x of [0.07, 0.15]) {
    const knob = cyl(0.02, 0.02, 0.02, M(PAL.tomato, 0.5), x, 0.085, 0.09, 12);
    knob.rotation.x = Math.PI / 2;
    radio.add(knob);
  }
  radio.add(rod(v(0.17, 0.26, -0.04), v(0.29, 0.6, -0.04), 0.004, M(PAL.metal, 0.4, 0.6), 5));
  radio.add(ball(0.01, M(PAL.metal, 0.4, 0.6), 0.29, 0.6, -0.04, 6, 4));
  radio.add(hitProxy(0.5, 0.36, 0.26, 0, 0.16, 0));
  g.add(radio);
  refs.items.radio = radio;
  refs.radio = radio;

  /* globe */
  const globe = tag(new THREE.Group(), "globe");
  globe.position.set(0.02, TOP, 0.38);
  globe.add(cyl(0.075, 0.09, 0.02, M(PAL.woodDark), 0, 0.01, 0));
  globe.add(cyl(0.012, 0.012, 0.06, M(PAL.brass, 0.4, 0.6), 0, 0.04, 0, 8));
  const tilt = new THREE.Group();
  tilt.position.y = 0.21;
  tilt.rotation.z = 0.41;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.007, 6, 28, Math.PI), M(PAL.brass, 0.4, 0.6));
  arc.rotation.z = -Math.PI / 2;
  arc.rotation.y = Math.PI / 2;
  tilt.add(arc);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 28, 20),
    new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.6 }),
  );
  sphere.castShadow = true;
  tilt.add(sphere);
  globe.add(tilt, hitProxy(0.36, 0.44, 0.36, 0, 0.2, 0));
  g.add(globe);
  refs.items.globe = globe;
  refs.globe = sphere;

  room.add(g);
}

/* ------------------------------------------------------------------ */

function wallDecor(room: THREE.Group, refs: RoomRefs) {
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
  mh.position.set(1.27, 0, 0);
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

/* ------------------------------------------------------------------ */

function cat(room: THREE.Group, refs: RoomRefs) {
  /* pink cushion stays fixed on the floor beside the radio cabinet so Miso can walk freely around the room */
  const cushion = ball(0.44, M(PAL.blush, 0.95), -2.42, 0.075, 3.05, 28, 14);
  cushion.scale.y = 0.2;
  room.add(cushion);

  const root = tag(new THREE.Group(), "cat");
  root.position.set(-2.42, 0.155, 3.05);
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

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

function plant(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "plant");
  g.position.set(-2.48, 0, 0.5);
  const terra = M(PAL.terracotta, 0.9);
  g.add(cyl(0.26, 0.19, 0.4, terra, 0, 0.2, 0), cyl(0.285, 0.285, 0.07, terra, 0, 0.4, 0));
  g.add(cyl(0.25, 0.25, 0.02, M(0x4b3328, 1), 0, 0.432, 0));

  const leaves = new THREE.Group();
  leaves.position.y = 0.43;
  const stems: THREE.Object3D[] = [];
  const flowers: THREE.Group[] = [];
  const r = rng(3);
  const stemMat = M(PAL.leafDark, 0.8);
  const leafMats = [M(PAL.leaf, 0.65), M(PAL.leafDark, 0.65), M(0x6fae6a, 0.65)];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const turn = new THREE.Group();
    turn.rotation.y = (i / N) * Math.PI * 2 + r() * 0.5;
    const tilt = new THREE.Group();
    const lean = 0.18 + r() * 0.55;
    tilt.rotation.z = -lean;
    tilt.userData.base = -lean;
    tilt.userData.phase = r() * 6;
    const len = 0.55 + r() * 0.65;
    tilt.add(cyl(0.011, 0.017, len, stemMat, 0, len / 2, 0, 6));
    const s = 0.8 + r() * 0.5;
    const leaf = ball(1, leafMats[i % 3], 0.13 * s, len - 0.03, 0, 12, 8);
    leaf.scale.set(0.21 * s, 0.014, 0.15 * s);
    leaf.rotation.z = -0.55;
    tilt.add(leaf);
    if (i % 3 === 0) {
      const f = new THREE.Group();
      f.position.set(0.02, len + 0.06, 0);
      const petal = M(0xf5a9c0, 0.7);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        f.add(ball(0.04, petal, Math.cos(a) * 0.048, 0, Math.sin(a) * 0.048, 8, 6));
      }
      f.add(ball(0.034, M(PAL.mustard, 0.6), 0, 0.012, 0, 8, 6));
      f.visible = false;
      f.scale.setScalar(0.001);
      tilt.add(f);
      flowers.push(f);
    }
    turn.add(tilt);
    leaves.add(turn);
    stems.push(tilt);
  }
  g.add(leaves);
  room.add(g);
  refs.items.plant = g;
  refs.plant = { leaves, stems, flowers };
}

/* ------------------------------------------------------------------ */

function floorBits(room: THREE.Group, refs: RoomRefs) {
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 56),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.7, 0.006, 0.55);
  rug.receiveShadow = true;
  room.add(rug);

  const pouf = tag(new THREE.Group(), "pouf");
  pouf.position.set(2.25, 0, 1.75);
  const p = ball(0.44, M(0x7f93cf, 1), 0, 0.23, 0, 24, 14);
  p.scale.y = 0.56;
  pouf.add(p, ball(0.04, M(PAL.cream, 0.8), 0, 0.47, 0, 8, 6), hitProxy(0.95, 0.62, 0.95, 0, 0.28, 0));
  room.add(pouf);
  refs.items.pouf = pouf;

  /* green open book resting next to the pouf */
  const openBook = tag(new THREE.Group(), "poufBook");
  openBook.position.set(1.63, 0, 2.0);
  openBook.rotation.y = 0.5;
  openBook.add(box(0.32, 0.016, 0.22, M(PAL.sage, 0.8), 0, 0.012, 0));
  const linenMat = M(PAL.linen, 0.95);
  const pageL = box(0.15, 0.012, 0.2, linenMat, -0.077, 0.026, 0);
  const pageR = box(0.15, 0.012, 0.2, linenMat, 0.077, 0.026, 0);
  pageL.rotation.z = -0.06;
  pageR.rotation.z = 0.06;
  openBook.add(pageL, pageR, hitProxy(0.42, 0.16, 0.34, 0, 0.05, 0));
  room.add(openBook);
  refs.items.poufBook = openBook;
  refs.poufBookFloor = openBook;

  /* open lap book held while reading on the pouf */
  const poufLapBook = tag(new THREE.Group(), "poufBook");
  poufLapBook.position.set(1.99, 0.66, 1.45);
  poufLapBook.rotation.set(0.42, 0.72, 0, "YXZ");
  poufLapBook.visible = false;
  poufLapBook.add(box(0.32, 0.012, 0.22, M(PAL.sage, 0.82), 0, 0.006, 0));
  const lpL = box(0.148, 0.014, 0.2, linenMat, -0.076, 0.015, 0);
  const lpR = box(0.148, 0.014, 0.2, linenMat, 0.076, 0.015, 0);
  lpL.rotation.z = -0.05;
  lpR.rotation.z = 0.05;
  poufLapBook.add(lpL, lpR);
  const inkLine = M(0x9b8b7f, 0.9);
  for (let i = 0; i < 4; i++) {
    const lz = -0.06 + i * 0.04;
    const l1 = box(0.1, 0.002, 0.007, inkLine, -0.076, 0.023, lz);
    const l2 = box(0.1, 0.002, 0.007, inkLine, 0.076, 0.023, lz);
    l1.castShadow = l2.castShadow = false;
    poufLapBook.add(l1, l2);
  }
  const lapFlip = new THREE.Group();
  lapFlip.position.set(0, 0.023, 0);
  const lapLeaf = box(0.145, 0.003, 0.195, linenMat, 0.073, 0, 0);
  lapLeaf.castShadow = false;
  lapFlip.add(lapLeaf);
  poufLapBook.add(lapFlip, hitProxy(0.38, 0.18, 0.28, 0, 0.04, 0));
  room.add(poufLapBook);
  refs.poufLapBook = { root: poufLapBook, flipPage: lapFlip };

  const soleMat = M(PAL.woodDark, 0.92);
  const insoleMat = M(PAL.cream, 0.96);
  const upperMat = M(PAL.terracotta, 0.95);
  const ribMat = M(0xb45e40, 0.95);
  const cuffMat = M(PAL.cream, 1);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xb8a391, roughness: 1, side: THREE.BackSide });
  const cavityMat = M(0x8e796a, 1);

  for (const [side, x, z, rot] of [
    [-1, -1.32, -0.86, 1.48],
    [1, -1.29, -0.69, 1.66],
  ] as const) {
    const s = new THREE.Group();
    s.position.set(x, 0, z);
    s.rotation.y = rot;

    const soleShape = new THREE.Shape();
    const arch = side * 0.005;
    soleShape.moveTo(0, 0.115);
    soleShape.bezierCurveTo(0.038, 0.115, 0.042, 0.075, 0.041 - arch, 0.02);
    soleShape.bezierCurveTo(0.047, -0.025, 0.052, -0.08, 0.032, -0.112);
    soleShape.bezierCurveTo(0.015, -0.124, -0.015, -0.124, -0.032, -0.112);
    soleShape.bezierCurveTo(-0.052, -0.08, -0.047, -0.025, -0.041 - arch, 0.02);
    soleShape.bezierCurveTo(-0.042, 0.075, -0.038, 0.115, 0, 0.115);

    const outsoleGeo = new THREE.ExtrudeGeometry(soleShape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
      curveSegments: 16,
    });
    outsoleGeo.rotateX(-Math.PI / 2);
    const outsole = new THREE.Mesh(outsoleGeo, soleMat);
    outsole.position.y = 0.002;
    outsole.castShadow = outsole.receiveShadow = true;

    const insoleGeo = new THREE.ExtrudeGeometry(soleShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.0015,
      bevelSegments: 2,
      curveSegments: 16,
    });
    insoleGeo.rotateX(-Math.PI / 2);
    const insole = new THREE.Mesh(insoleGeo, insoleMat);
    insole.scale.set(0.92, 1, 0.94);
    insole.position.y = 0.013;
    insole.castShadow = insole.receiveShadow = true;

    const heelTag = box(0.034, 0.002, 0.018, upperMat, 0, 0.0235, -0.072);
    heelTag.castShadow = false;

    const upper = new THREE.Group();
    upper.position.set(0, 0.019, 0);
    upper.scale.set(1, 0.78, 1);

    const archGeo = new THREE.CylinderGeometry(0.046, 0.043, 0.078, 18, 1, true, -Math.PI / 2, Math.PI);
    archGeo.rotateX(-Math.PI / 2);
    const archMesh = new THREE.Mesh(archGeo, upperMat);
    archMesh.position.set(0, 0, 0.029);
    archMesh.castShadow = archMesh.receiveShadow = true;

    const toeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.043, 16, 10, 0, Math.PI, 0, Math.PI / 2),
      upperMat,
    );
    toeCap.position.set(0, 0, 0.068);
    toeCap.scale.z = 1.12;
    toeCap.castShadow = toeCap.receiveShadow = true;

    const innerArchGeo = new THREE.CylinderGeometry(0.042, 0.039, 0.078, 16, 1, true, -Math.PI / 2, Math.PI);
    innerArchGeo.rotateX(-Math.PI / 2);
    const innerArch = new THREE.Mesh(innerArchGeo, innerMat);
    innerArch.position.set(0, 0, 0.029);

    const innerCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.039, 14, 8, 0, Math.PI, 0, Math.PI / 2),
      innerMat,
    );
    innerCap.position.set(0, 0, 0.068);
    innerCap.scale.z = 1.12;

    const pad = cyl(0.034, 0.034, 0.002, cavityMat, 0, 0.0055, 0.046, 14);
    pad.scale.z = 1.45;
    pad.castShadow = false;

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0095, 10, 20, Math.PI), cuffMat);
    cuff.position.set(0, 0, -0.01);
    cuff.castShadow = cuff.receiveShadow = true;

    const ribGeo = new THREE.TorusGeometry(0.045, 0.0022, 6, 18, Math.PI);
    for (const rz of [0.016, 0.042]) {
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(0, 0, rz);
      upper.add(rib);
    }

    upper.add(archMesh, toeCap, innerArch, innerCap, pad, cuff);
    s.add(outsole, insole, heelTag, upper);
    room.add(s);
  }
}

/* ------------------------------------------------------------------ */

function todoBoard(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "todo");
  g.position.set(-2.97, 1.88, 0.72);
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

/* ------------------------------------------------------------------ */

function exerciseCorner(room: THREE.Group, refs: RoomRefs) {
  /* yoga & stretching mat */
  const matG = tag(new THREE.Group(), "mat");
  matG.position.set(3.85, 0, 0.15);
  const sage = M(PAL.sage, 0.96);
  const terra = M(PAL.terracotta, 0.92);
  matG.add(rbox(0.78, 0.016, 1.72, 0.006, sage, 0, 0.008, 0));
  for (const sz of [-0.74, 0.74]) {
    const stripe = box(0.74, 0.002, 0.035, terra, 0, 0.0165, sz);
    stripe.castShadow = false;
    matG.add(stripe);
  }
  const bolster = cyl(0.052, 0.052, 0.44, M(PAL.cream, 0.92), 0, 0.055, -0.78, 14);
  bolster.rotation.z = Math.PI / 2;
  matG.add(bolster, hitProxy(0.9, 0.24, 1.85, 0, 0.1, 0));
  room.add(matG);
  refs.items.mat = matG;

  /* wooden dumbbell rack */
  const rack = tag(new THREE.Group(), "dumbbells");
  rack.position.set(4.68, 0, -0.35);
  const wood = M(PAL.wood, 0.72);
  const dark = M(PAL.woodDark, 0.72);
  const brass = M(PAL.brass, 0.4, 0.55);
  const mustard = M(PAL.mustard, 0.75);
  const tomato = M(PAL.tomato, 0.72);

  for (const z of [-0.28, 0.28]) {
    rack.add(rod(v(-0.15, 0.02, z), v(-0.08, 0.54, z), 0.024, wood, 8));
    rack.add(rod(v(0.15, 0.02, z), v(0.08, 0.54, z), 0.024, wood, 8));
    rack.add(rbox(0.36, 0.035, 0.06, 0.01, dark, 0, 0.0175, z));
  }
  rack.add(rbox(0.18, 0.03, 0.66, 0.01, dark, 0, 0.28, 0));
  rack.add(rbox(0.16, 0.03, 0.66, 0.01, dark, 0, 0.52, 0));

  const mkDumbbell = (weightMat: THREE.Material) => {
    const db = new THREE.Group();
    const grip = cyl(0.013, 0.013, 0.16, brass, 0, 0, 0, 8);
    grip.rotation.z = Math.PI / 2;
    db.add(grip);
    for (const sx of [-0.065, 0.065]) {
      const w = cyl(0.044, 0.044, 0.032, weightMat, sx, 0, 0, 14);
      w.rotation.z = Math.PI / 2;
      db.add(w);
    }
    return db;
  };
  for (const z of [-0.15, 0.15]) {
    const lowDb = mkDumbbell(mustard);
    lowDb.position.set(0, 0.335, z);
    lowDb.rotation.y = Math.PI / 2;
    rack.add(lowDb);
  }
  const rackDumbbells = new THREE.Group();
  for (const z of [-0.15, 0.15]) {
    const topDb = mkDumbbell(tomato);
    topDb.position.set(0, 0.575, z);
    topDb.rotation.y = Math.PI / 2;
    rackDumbbells.add(topDb);
  }
  rack.add(rackDumbbells, hitProxy(0.56, 0.68, 0.78, 0, 0.34, 0));
  room.add(rack);
  refs.items.dumbbells = rack;
  refs.rackDumbbells = rackDumbbells;

  /* stationary spin bike facing into the open room (-X, +Z) */
  const bike = tag(new THREE.Group(), "bike");
  bike.position.set(4.15, 0, -2.15);
  bike.rotation.y = 2.59;
  const frameMat = M(PAL.metal, 0.45, 0.4);
  const wheelMat = M(PAL.ink, 0.6, 0.25);

  for (const z of [-0.46, 0.36]) {
    const foot = cyl(0.022, 0.022, 0.46, frameMat, 0, 0.022, z, 10);
    foot.rotation.z = Math.PI / 2;
    bike.add(foot);
  }
  bike.add(rod(v(0, 0.03, -0.44), v(0, 0.34, -0.34), 0.024, frameMat, 10));
  bike.add(rod(v(0, 0.03, 0.34), v(0, 0.34, 0.08), 0.024, frameMat, 10));
  bike.add(rod(v(0, 0.34, 0.08), v(0, 0.34, -0.34), 0.022, frameMat, 10));
  bike.add(rod(v(0, 0.34, 0.08), v(0, 0.81, 0.2), 0.02, frameMat, 10));
  bike.add(rod(v(0, 0.34, -0.34), v(0, 0.94, -0.34), 0.022, frameMat, 10));
  bike.add(rod(v(0, 0.56, -0.34), v(0, 0.62, 0.14), 0.02, frameMat, 10));

  const flywheel = new THREE.Group();
  flywheel.position.set(0, 0.34, -0.34);
  const disc = cyl(0.22, 0.22, 0.045, wheelMat, 0, 0, 0, 24);
  disc.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 24), mustard);
  rim.rotation.y = Math.PI / 2;
  flywheel.add(disc, rim);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const spoke = box(0.052, 0.36, 0.018, brass, 0, 0, 0);
    spoke.rotation.x = a;
    flywheel.add(spoke);
  }
  bike.add(flywheel);

  const crank = new THREE.Group();
  crank.position.set(0, 0.34, 0.08);
  const axle = cyl(0.022, 0.022, 0.22, frameMat, 0, 0, 0, 10);
  axle.rotation.z = Math.PI / 2;
  crank.add(axle);
  for (const s of [-1, 1]) {
    crank.add(box(0.014, 0.15, 0.022, brass, s * 0.105, -s * 0.065, 0));
    const pedal = box(0.085, 0.02, 0.06, tomato, s * 0.13, -s * 0.14, 0);
    crank.add(pedal);
  }
  bike.add(crank);

  const saddle = rbox(0.15, 0.055, 0.22, 0.024, tomato, 0, 0.84, 0.2);
  const hbar = cyl(0.014, 0.014, 0.42, frameMat, 0, 0.96, -0.34, 10);
  hbar.rotation.z = Math.PI / 2;
  bike.add(
    saddle,
    hbar,
    rod(v(-0.2, 0.96, -0.34), v(-0.2, 0.96, -0.22), 0.014, tomato, 8),
    rod(v(0.2, 0.96, -0.34), v(0.2, 0.96, -0.22), 0.014, tomato, 8),
    rbox(0.11, 0.06, 0.02, 0.008, M(PAL.ink, 0.4), 0, 1.0, -0.36),
    hitProxy(0.76, 1.16, 1.16, 0, 0.56, -0.05),
  );
  room.add(bike);
  refs.items.bike = bike;
  refs.bike = { root: bike, flywheel, crank };

  /* decorative print on the extended back wall above the spin bike */
  const artFrame = new THREE.Group();
  artFrame.position.set(4.15, 2.05, -2.98);
  artFrame.add(rbox(0.86, 0.62, 0.032, 0.008, M(PAL.woodDark, 0.72), 0, 0, 0));
  artFrame.add(box(0.78, 0.54, 0.005, M(PAL.cream, 0.92), 0, 0, 0.017));
  artFrame.add(box(0.32, 0.36, 0.004, M(PAL.sage, 0.9), -0.18, 0.03, 0.02));
  artFrame.add(cyl(0.13, 0.13, 0.004, M(PAL.mustard, 0.9), 0.18, -0.02, 0.02, 20));
  room.add(artFrame);
}

/* ------------------------------------------------------------------ */

function catToys(room: THREE.Group, refs: RoomRefs) {
  /* 1. Rolling yarn ball on the rug */
  const yarn = tag(new THREE.Group(), "yarn");
  yarn.position.set(0.85, 0.068, 0.72);
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
  wand.position.set(1.78, 0, -1.85);
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
  scratcher.position.set(2.65, 0, -1.35);
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
  scratcher.add(rod(v(0, 0.59, 0), v(-0.2, 0.65, 0.14), 0.016, woodCap, 8));

  const pomPivot = new THREE.Group();
  pomPivot.position.set(-0.2, 0.65, 0.14);
  pomPivot.add(rod(v(0, 0, 0), v(0, -0.22, 0), 0.0035, M(PAL.cream, 0.9), 6));
  pomPivot.add(ball(0.042, M(PAL.mustard, 0.96), 0, -0.22, 0, 12, 10));
  scratcher.add(pomPivot, hitProxy(0.56, 0.74, 0.56, -0.04, 0.36, 0.04));
  room.add(scratcher);
  refs.items.scratcher = scratcher;

  /* 4. Cozy cardboard box in the expanded corner */
  const catBox = tag(new THREE.Group(), "catBox");
  catBox.position.set(3.45, 0, 2.35);
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
