import * as THREE from "three";
import type { AvatarRig } from "../avatars";
import { M, PAL, box, hitProxy } from "../kit";

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
  | "laser"
  | "ladder"
  | "hatch"
  | "telescope"
  | "gameTable"
  | "rhythmBox"
  | "gacha"
  | "rooftopFairy";

export interface RooftopRefs {
  items: Partial<Record<InteractId, THREE.Object3D>>;
  fairyBulbs: THREE.InstancedMesh;
  fairyColors: THREE.Color[];
  lanternGlows: THREE.MeshStandardMaterial[];
  gachaKnob: THREE.Object3D;
  gachaCapsules: THREE.Object3D[];
  gachaDrop: { root: THREE.Group; topHalf: THREE.Mesh; botHalf: THREE.Mesh };
  tableCards: THREE.Mesh[];
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

export function tag<T extends THREE.Object3D>(o: T, id: InteractId): T {
  o.userData.interact = id;
  return o;
}

export interface OpenBookOptions {
  id: InteractId;
  coverColor: number;
  coverRoughness: number;
  coverSize: [number, number, number];
  pageSize: [number, number, number];
  pageOffsetX: number;
  pageTilt: number;
  inkWidth: number;
  inkStartZ: number;
  inkStepZ: number;
  flipSize: [number, number, number];
  flipOffsetX: number;
  hitBox: [number, number, number, number, number, number];
}

/** Shared open book mesh with animated page-flip leaf (used on desk & pouf). */
export function buildOpenBook(opts: OpenBookOptions): { root: THREE.Group; flipPage: THREE.Group } {
  const root = tag(new THREE.Group(), opts.id);
  root.visible = false;
  root.add(box(opts.coverSize[0], opts.coverSize[1], opts.coverSize[2], M(opts.coverColor, opts.coverRoughness), 0, 0.006, 0));

  const linenMat = M(PAL.linen, 0.95);
  const inkLine = M(0x9b8b7f, 0.9);
  const [pw, ph, pd] = opts.pageSize;
  const pageL = box(pw, ph, pd, linenMat, -opts.pageOffsetX, 0.015, 0);
  const pageR = box(pw, ph, pd, linenMat, opts.pageOffsetX, 0.015, 0);
  pageL.rotation.z = -opts.pageTilt;
  pageR.rotation.z = opts.pageTilt;
  root.add(pageL, pageR);

  for (let i = 0; i < 4; i++) {
    const lz = opts.inkStartZ + i * opts.inkStepZ;
    const lineL = box(opts.inkWidth, 0.002, 0.007, inkLine, -opts.pageOffsetX, 0.023, lz);
    const lineR = box(opts.inkWidth, 0.002, 0.007, inkLine, opts.pageOffsetX, 0.023, lz);
    lineL.castShadow = lineR.castShadow = false;
    root.add(lineL, lineR);
  }

  const flipPage = new THREE.Group();
  flipPage.position.set(0, 0.023, 0);
  const flipLeaf = box(opts.flipSize[0], opts.flipSize[1], opts.flipSize[2], linenMat, opts.flipOffsetX, 0, 0);
  flipLeaf.castShadow = false;
  flipPage.add(flipLeaf);
  root.add(flipPage, hitProxy(...opts.hitBox));

  return { root, flipPage };
}
