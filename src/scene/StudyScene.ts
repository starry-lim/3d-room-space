import * as THREE from "three";
import type { AvatarConfig, TodoItem } from "../game/data";
import { buildAvatar } from "./avatars";
import { CatController, type CatSfx } from "./CatController";
import { ROOM, buildRoom, WINDOW, type InteractId, type RoomRefs } from "./furniture";
import { glowTexture, discTexture, glyphTextures, hintTexture, resetKit, rng, type Glyph } from "./kit";

export type { CatSfx } from "./CatController";
export type { InteractId } from "./furniture";
export type SkyPhase = "day" | "dusk" | "night";
export type ActivityMode = "none" | "desk" | "pouf" | "yoga" | "weights" | "bike";

export interface SceneEvent {
  id: InteractId;
  on?: boolean;
  phase?: SkyPhase;
  stage?: number;
  bloomed?: boolean;
  glowing?: boolean;
}

export interface MoveSfxDetail {
  running?: boolean;
  crouched?: boolean;
  strength?: number;
}

export interface SceneCallbacks {
  onInteract: (e: SceneEvent) => void;
  onHover: (label: string | null) => void;
  onLockChange?: (locked: boolean) => void;
  onMoveSfx?: (kind: "step" | "jump" | "land", detail?: MoveSfxDetail) => void;
  onCatSfx?: (kind: CatSfx) => void;
  onMugSfx?: (kind: "sip" | "place") => void;
  onToySfx?: (kind: "bell" | "scratch" | "yarn" | "laser" | "box") => void;
  onReady?: () => void;
}

export interface TimerView {
  mode: "focus" | "break";
  remainingMs: number;
  totalMs: number;
  running: boolean;
}

/* ------------------------------------------------------------------ */
/* Sky presets — everything the time of day touches, in one place      */
/* ------------------------------------------------------------------ */

const COLOR_KEYS = ["top", "bottom", "low", "halo", "sun", "hemiSky", "hemiGround", "disc"] as const;
const NUM_KEYS = ["sunI", "hemiI", "bounce", "stars", "beam", "dark", "exposure", "discSize", "haloI"] as const;
type Sky = Record<(typeof COLOR_KEYS)[number], THREE.Color> &
  Record<(typeof NUM_KEYS)[number], number> & { dir: THREE.Vector3 };
type SkySpec = Record<(typeof COLOR_KEYS)[number], number> &
  Record<(typeof NUM_KEYS)[number], number> & { dir: [number, number, number] };

function mkSky(o: SkySpec): Sky {
  const s = { dir: new THREE.Vector3(...o.dir).normalize() } as Sky;
  for (const k of COLOR_KEYS) s[k] = new THREE.Color(o[k]);
  for (const k of NUM_KEYS) s[k] = o[k];
  return s;
}
function lerpSky(dst: Sky, a: Sky, b: Sky, k: number) {
  for (const key of COLOR_KEYS) dst[key].lerpColors(a[key], b[key], k);
  for (const key of NUM_KEYS) dst[key] = a[key] + (b[key] - a[key]) * k;
  dst.dir.lerpVectors(a.dir, b.dir, k).normalize();
}
function cloneSky(a: Sky): Sky {
  const s = { dir: a.dir.clone() } as Sky;
  for (const k of COLOR_KEYS) s[k] = a[k].clone();
  for (const k of NUM_KEYS) s[k] = a[k];
  return s;
}

const SKIES: Record<SkyPhase, Sky> = {
  day: mkSky({
    top: 0x6db8e8, bottom: 0xfbe6c8, low: 0xa3d6f0, halo: 0xfff3d0, sun: 0xfff0d8, disc: 0xfffbe8,
    hemiSky: 0xe6f1ff, hemiGround: 0xd2b190,
    dir: [-0.42, 0.82, -0.6],
    sunI: 3.6, hemiI: 2.5, bounce: 1.2, stars: 0, beam: 0.55, dark: 0, exposure: 1.0, discSize: 12, haloI: 0.5,
  }),
  dusk: mkSky({
    top: 0x4c4a8e, bottom: 0xffb07c, low: 0x8d5d92, halo: 0xff7a3a, sun: 0xffa262, disc: 0xffd29a,
    hemiSky: 0xe6b9c6, hemiGround: 0xa87058,
    dir: [-0.3, 0.46, -0.84],
    sunI: 3.4, hemiI: 1.9, bounce: 0.9, stars: 0.2, beam: 1.0, dark: 0.35, exposure: 1.05, discSize: 16, haloI: 0.75,
  }),
  night: mkSky({
    top: 0x0a0d28, bottom: 0x2e2a5c, low: 0x151230, halo: 0x5a6ac4, sun: 0x8ea6ff, disc: 0xf4f6ff,
    hemiSky: 0x4a59a8, hemiGround: 0x241c33,
    dir: [-0.5, 0.74, -0.52],
    sunI: 1.7, hemiI: 1.45, bounce: 0.12, stars: 1, beam: 0.22, dark: 1, exposure: 1.12, discSize: 9, haloI: 0.4,
  }),
};
const PHASE_ORDER: SkyPhase[] = ["dusk", "night", "day"];

/* ------------------------------------------------------------------ */

const ease = {
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  back: (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  linear: (x: number) => x,
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent approach toward a target. */
const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
const approachAngle = (cur: number, target: number, rate: number, dt: number) =>
  cur + angleDelta(cur, target) * (1 - Math.exp(-rate * dt));

interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  ease: (x: number) => number;
  done?: () => void;
}

interface Item {
  id: InteractId;
  root: THREE.Object3D;
  scaleTarget: THREE.Object3D;
  label: string;
  pop: number;
  secret: boolean;
  anchor: THREE.Vector3;
  center: THREE.Vector3;
  hover: number;
  bounce: number;
  hint?: THREE.Sprite;
}

interface Floater {
  s: THREE.Sprite;
  life: number;
  max: number;
  vel: THREE.Vector3;
  grav: number;
  size: number;
  grow: number;
}

const META: Record<InteractId, { label: string; pop: number; secret?: boolean; anchor?: [number, number, number] }> = {
  timer: { label: "Set the timer", pop: 0.1 },
  bed: { label: "Rest a while", pop: 0, anchor: [-2.2, 1.3, -1.3] },
  lamp: { label: "Desk lamp", pop: 0.05 },
  window: { label: "Change the sky", pop: 0, anchor: [-0.1, 2.05, -2.7] },
  cat: { label: "Pet Miso", pop: 0.07 },
  mug: { label: "Take a sip", pop: 0.12 },
  plant: { label: "Water the plant", pop: 0.04 },
  radio: { label: "Radio", pop: 0.07 },
  book: { label: "Pull this book", pop: 0.05 },
  study: { label: "Sit & focus", pop: 0, secret: true },
  fairy: { label: "String lights", pop: 0, anchor: [-2.8, 2.72, -0.9] },
  candle: { label: "Candle", pop: 0.12 },
  globe: { label: "Spin the globe", pop: 0.07 },
  glowstars: { label: "Faded stickers", pop: 0, secret: true },
  mouse: { label: "…?", pop: 0, secret: true },
  box: { label: "A shoebox", pop: 0.06, secret: true },
  pouf: { label: "Sit on the pouf", pop: 0, secret: true },
  poufBook: { label: "Read on the pouf", pop: 0.04, secret: true },
  mat: { label: "Yoga & stretch", pop: 0, secret: true },
  dumbbells: { label: "Dumbbell training", pop: 0.04, secret: true },
  bike: { label: "Ride spin bike", pop: 0, secret: true },
  todo: { label: "To-do board", pop: 0.03, secret: true },
  yarn: { label: "Roll yarn ball", pop: 0.1, secret: true },
  wand: { label: "Wave feather wand", pop: 0.06, secret: true },
  scratcher: { label: "Bat cat toy", pop: 0, secret: true },
  catBox: { label: "Miso's cardboard box", pop: 0.04, secret: true },
  laser: { label: "Laser pointer", pop: 0.08, secret: true },
};

const SUN_TARGET = new THREE.Vector3(0.4, 0.8, -0.6);

interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
  walkable: boolean;
}

const ROOM_MIN_X = ROOM.minX + 0.26;
const ROOM_MAX_X = ROOM.maxX - 0.26;
const ROOM_MIN_Z = ROOM.minZ + 0.26;
const ROOM_MAX_Z = ROOM.maxZ - 0.26;
const PLAYER_RADIUS = 0.24;
const EYE_STAND = 1.55;
const EYE_CROUCH = 0.38;
const WALK_SPEED = 2.45;
const RUN_SPEED = 4.6;
const CROUCH_SPEED = 1.25;
const JUMP_VEL = 5.0;
const GRAVITY = 14.0;
const STEP_UP = 0.14;
const FOV_WALK = 68;
const FOV_RUN = 74;
const FOV_CROUCH = 64;
const PITCH_LIMIT = 1.44;
const INTERACT_RANGE = 6.8;

const SPAWN_POS = new THREE.Vector3(1.15, 0, 1.45);
const SPAWN_YAW = 0.46;
const SPAWN_PITCH = -0.1;
const REST_POS = new THREE.Vector3(-2.28, 0.96, -2.42);
const REST_YAW = -2.85;
const REST_PITCH = -0.16;
const WAKE_POS = new THREE.Vector3(-1.12, 0, -0.72);
const WAKE_YAW = -0.95;
const WAKE_PITCH = -0.06;
const CHAIR_HOME_POS = new THREE.Vector3(-0.25, 0, -1.55);
const CHAIR_HOME_YAW = -0.38;
const CHAIR_FOCUS_POS = new THREE.Vector3(-0.18, 0, -1.66);
const CHAIR_FOCUS_YAW = 0;

interface ActivityPose {
  fpPos: THREE.Vector3;
  fpYaw: number;
  fpPitch: number;
  tpTarget: THREE.Vector3;
  tpYaw: number;
  tpPitch: number;
  tpDist: number;
  avatarPos: THREE.Vector3;
  avatarYaw: number;
  standPos: THREE.Vector3;
  standYaw: number;
  standPitch: number;
}

const ACTIVITIES: Record<Exclude<ActivityMode, "none">, ActivityPose> = {
  desk: {
    fpPos: new THREE.Vector3(-0.18, 1.24, -1.78),
    fpYaw: 0.04,
    fpPitch: -0.36,
    tpTarget: new THREE.Vector3(-0.24, 0.96, -1.96),
    tpYaw: 0.72,
    tpPitch: 0.3,
    tpDist: 2.35,
    avatarPos: new THREE.Vector3(-0.18, 0, -1.66),
    avatarYaw: 0,
    standPos: new THREE.Vector3(0.28, 0, -0.98),
    standYaw: 0.35,
    standPitch: -0.1,
  },
  pouf: {
    fpPos: new THREE.Vector3(2.15, 1.06, 1.65),
    fpYaw: 0.72,
    fpPitch: -0.26,
    tpTarget: new THREE.Vector3(2.14, 0.72, 1.64),
    tpYaw: 0.45,
    tpPitch: 0.34,
    tpDist: 2.25,
    avatarPos: new THREE.Vector3(2.25, 0, 1.75),
    avatarYaw: 0.72,
    standPos: new THREE.Vector3(1.28, 0, 1.15),
    standYaw: 0.5,
    standPitch: -0.1,
  },
  yoga: {
    fpPos: new THREE.Vector3(3.85, 1.48, 0.15),
    fpYaw: Math.PI / 2,
    fpPitch: -0.1,
    tpTarget: new THREE.Vector3(3.85, 0.92, 0.15),
    tpYaw: 0.8,
    tpPitch: 0.28,
    tpDist: 2.4,
    avatarPos: new THREE.Vector3(3.85, 0, 0.15),
    avatarYaw: Math.PI / 2,
    standPos: new THREE.Vector3(3.05, 0, 0.35),
    standYaw: Math.PI / 2,
    standPitch: -0.1,
  },
  weights: {
    fpPos: new THREE.Vector3(3.85, 1.52, 0.15),
    fpYaw: Math.PI / 2,
    fpPitch: -0.08,
    tpTarget: new THREE.Vector3(3.85, 0.96, 0.15),
    tpYaw: 0.8,
    tpPitch: 0.28,
    tpDist: 2.4,
    avatarPos: new THREE.Vector3(3.85, 0, 0.15),
    avatarYaw: Math.PI / 2,
    standPos: new THREE.Vector3(3.05, 0, 0.35),
    standYaw: Math.PI / 2,
    standPitch: -0.1,
  },
  bike: {
    fpPos: new THREE.Vector3(4.12, 1.44, -2.19),
    fpYaw: 2.59,
    fpPitch: -0.18,
    tpTarget: new THREE.Vector3(4.05, 0.98, -2.02),
    tpYaw: 0.95,
    tpPitch: 0.28,
    tpDist: 2.45,
    avatarPos: new THREE.Vector3(4.15, 0, -2.15),
    avatarYaw: 2.59,
    standPos: new THREE.Vector3(3.32, 0, -1.62),
    standYaw: 2.59,
    standPitch: -0.1,
  },
};

const SIP_DUR = 1.68;
const AVATAR_L1 = 0.235;
const AVATAR_L2 = 0.255;
const NEG_Z = new THREE.Vector3(0, 0, -1);
const IK_POLE_L = new THREE.Vector3(-0.55, -0.82, 0.15);
const IK_POLE_R = new THREE.Vector3(0.55, -0.82, 0.15);
const IK_FALLBACK = new THREE.Vector3(0, -1, 0);
const AVATAR_IDLE_HAND = new THREE.Vector3(-0.32, 0.815, -2.07);
const AVATAR_MUG_MOUTH = new THREE.Vector3(-0.2, 1.03, -1.91);
const MUG_GRASP_LOCAL = new THREE.Vector3(0.042, 0.055, 0.024);
const FP_MUG_HOLD = new THREE.Vector3(0.11, -0.18, -0.36);
const FP_MUG_SIP = new THREE.Vector3(0.025, -0.155, -0.26);
const FP_HOLD_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, -0.25, 0.05, "YXZ"));
const FP_SIP_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.56, -0.15, 0.02, "YXZ"));
const TP_MOUTH_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, -0.32, 0, "YXZ"));
const TP_SIP_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.58, -0.28, 0, "YXZ"));
const REST_SIP_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.46, -0.6, 0, "YXZ"));

const COLLIDERS: Collider[] = [
  // Desk (-0.1, 0, -2.5), 2.2 x 0.9, top 0.79
  { minX: -1.2, maxX: 1.0, minZ: -2.95, maxZ: -2.05, topY: 0.79, walkable: true },
  // Chair (-0.25, 0, -1.55), ~0.52 x 0.52, seat ~0.56
  { minX: -0.52, maxX: 0.02, minZ: -1.82, maxZ: -1.28, topY: 0.56, walkable: true },
  // Bed (-2.25, 0, -1.625), 1.4 x 2.65, mattress top ~0.65
  { minX: -2.95, maxX: -1.55, minZ: -2.95, maxZ: -0.3, topY: 0.65, walkable: true },
  // Bookshelf (2.2, 0, -2.76), 1.3 x 0.42, height 2.3
  { minX: 1.55, maxX: 2.85, minZ: -2.97, maxZ: -2.55, topY: 2.3, walkable: false },
  // Console table (-2.72, 0, 1.8), 0.46 x 1.4, top 0.62
  { minX: -2.95, maxX: -2.49, minZ: 1.1, maxZ: 2.5, topY: 0.62, walkable: true },
  // Monstera plant (-2.48, 0, 0.5), pot radius ~0.28
  { minX: -2.78, maxX: -2.18, minZ: 0.2, maxZ: 0.8, topY: 1.4, walkable: false },
  // Cat cushion (1.25, 0, -1.2), low walkable cushion
  { minX: 0.88, maxX: 1.62, minZ: -1.57, maxZ: -0.83, topY: 0.15, walkable: true },
  // Pouf (2.25, 0, 1.75), radius ~0.44, top 0.48
  { minX: 1.82, maxX: 2.68, minZ: 1.32, maxZ: 2.18, topY: 0.48, walkable: true },
  // Scratcher post (2.65, 0, -1.35)
  { minX: 2.38, maxX: 2.92, minZ: -1.62, maxZ: -1.08, topY: 0.68, walkable: false },
  // Spin bike (4.15, 0, -2.15)
  { minX: 3.65, maxX: 4.65, minZ: -2.62, maxZ: -1.68, topY: 1.05, walkable: false },
  // Dumbbell rack (4.68, 0, -0.35)
  { minX: 4.45, maxX: 4.95, minZ: -0.72, maxZ: 0.02, topY: 0.65, walkable: false },
  // Cozy cardboard box (3.45, 0, 2.35)
  { minX: 3.16, maxX: 3.74, minZ: 2.08, maxZ: 2.62, topY: 0.28, walkable: false },
];

const angleDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/* ================================================================== */

export class StudyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private room: THREE.Group;
  private refs: RoomRefs;
  private fx = new THREE.Group();
  private ro: ResizeObserver;
  private raf = 0;
  private last = 0;
  private time = 0;
  private frame = 0;
  private w = 1;
  private h = 1;
  private disposed = false;
  private calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private ready = false;

  // first-person player state
  private playerPos = SPAWN_POS.clone();
  private velY = 0;
  private grounded = true;
  private yaw = SPAWN_YAW;
  private pitch = SPAWN_PITCH;
  private crouched = false;
  private crouchDownAt = 0;
  private crouchWasOn = false;
  private eyeHeight = EYE_STAND;
  private fovCur = FOV_WALK;
  private bobPhase = 0;
  private bobAmp = 0;
  private stepAcc = 0;
  private landDip = 0;
  private keys = new Set<string>();
  private locked = false;
  private uiOpen = false;
  private dragging = false;
  private dragStart: { x: number; y: number; yaw: number; pitch: number } | null = null;

  // quality
  private pixelRatio: number;
  private perfAcc = 0;
  private perfFrames = 0;
  private lowStreak = 0;
  private shadowsLow = false;

  // lights
  private hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private bounce = new THREE.PointLight(0xffd2a6, 0, 9, 2);
  private lamp = new THREE.SpotLight(0xffc88a, 0, 7, 0.95, 0.85, 1.7);
  private fairy = new THREE.PointLight(0xffb870, 0, 7.5, 2);
  private candle = new THREE.PointLight(0xff9a4a, 0, 4.5, 2);

  // sky
  private phase: SkyPhase = "dusk";
  private cur = cloneSky(SKIES.dusk);
  private skyFrom = cloneSky(SKIES.dusk);
  private skyTo = SKIES.dusk;
  private skyK = 1;
  private skyDur = 2.6;
  private skyMat!: THREE.ShaderMaterial;
  private starMats: THREE.PointsMaterial[] = [];
  private disc!: THREE.Sprite;
  private clouds: { g: THREE.Group; speed: number }[] = [];
  private beam!: THREE.Mesh;
  private dust!: THREE.Points;
  private dustVel!: Float32Array;

  // state
  private lampOn = true;
  private fairyOn = false;
  private candleOn = false;
  private radioOn = false;
  private radioLabel: string | null = null;
  private resting = false;
  private activity: ActivityMode = "none";
  private lastStation: Exclude<ActivityMode, "none"> = "desk";
  private poufReading = false;
  private exercisePaused = false;
  private exPhase = 0;
  private thirdPerson = false;
  private avatarPreview = false;
  private catName = "Miso";
  private avatarYaw = SPAWN_YAW;
  private moveSpeed = 0;
  private walkPhase = 0;
  private crouchK = 0;
  private tpTarget = ACTIVITIES.desk.tpTarget.clone();
  private tpYaw = 0.72;
  private tpPitch = 0.3;
  private tpDist = 2.35;
  private pageFlip = 0;
  private autoFlipTimer = 11;
  private yarnVel = new THREE.Vector2();
  private wandTimer = 0;
  private wandTipWorld = new THREE.Vector3(1.96, 0.46, -1.73);
  private pomAngle = 0;
  private pomVel = 0;
  private boxRustle = 0;
  private laserTimer = 0;
  private laserPos = new THREE.Vector3(0.8, 0.012, 0.4);
  private lampLevel = 0;
  private fairyLevel = 0;
  private candleLevel = 0;
  private restLevel = 0;
  private plantStage = 0;
  private bloomed = false;
  private boxOpen = false;
  private wobble = 0;
  private catCtrl!: CatController;
  private globeVel = 0.2;
  private ring = 0;
  private capAngle = 0;
  private mouseOut = 0;
  private mouseTarget = 0;
  private mouseTimer = 7;
  private emitTimer = 0;
  private sipActive = false;
  private sipT = 0;
  private sipSoundPlayed = false;
  private sipPlacePlayed = false;
  private mugHomePos = new THREE.Vector3();
  private mugHomeQuat = new THREE.Quaternion();
  private mugHomeWorld = new THREE.Vector3();
  private stars = 0;
  private timer: TimerView = { mode: "focus", remainingMs: 25 * 60000, totalMs: 25 * 60000, running: false };
  private screenKey = "";

  // interaction
  private items = new Map<InteractId, Item>();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private activePointers = new Set<number>();
  private hoverPos: { x: number; y: number } | null = null;
  private hoverDirty = false;
  private hovered: Item | null = null;
  private hoveredLabel: string | null = null;
  private hintsOn = false;
  private discovered = new Set<string>();

  // fx
  private tweens: Tween[] = [];
  private camTween: Tween | null = null;
  private floaters: Floater[] = [];
  private glyphs!: Record<Glyph, THREE.CanvasTexture>;
  private steam: THREE.Sprite[] = [];
  private lampGlow!: THREE.Sprite;
  private candleGlow!: THREE.Sprite;
  private boxGlow!: THREE.Sprite;
  private fairyGlow!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private mugTop = new THREE.Vector3();
  private rand = rng(1234);
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpV3 = new THREE.Vector3();
  private tmpV4 = new THREE.Vector3();
  private tmpV5 = new THREE.Vector3();
  private tmpV6 = new THREE.Vector3();
  private tmpV7 = new THREE.Vector3();
  private ikTarget = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpQ3 = new THREE.Quaternion();
  private tmpC = new THREE.Color();
  private offBulb = new THREE.Color();

  constructor(
    private container: HTMLElement,
    private cb: SceneCallbacks,
    private mobile: boolean,
  ) {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(this.pixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "crosshair";
    renderer.domElement.setAttribute("aria-label", "A cozy study corner you can walk around and explore in first person");
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(FOV_WALK, 1, 0.06, 500);
    this.camera.rotation.order = "YXZ";

    const { room, refs } = buildRoom();
    this.room = room;
    this.refs = refs;
    this.scene.add(room, this.fx);
    room.updateMatrixWorld(true);
    this.mugHomePos.copy(this.refs.mug.position);
    this.mugHomeQuat.copy(this.refs.mug.quaternion);
    this.refs.mug.getWorldPosition(this.mugHomeWorld);

    this.buildLights();
    this.buildSky();
    this.buildFx();
    this.catCtrl = new CatController(this.refs.cat, {
      onSfx: (kind) => this.cb.onCatSfx?.(kind),
      onEmit: (glyph, pos, count) => {
        if (glyph === "heart") {
          this.emit("heart", pos, count, {
            colors: [0xff7a8a, 0xffa3b0],
            spread: 0.35,
            up: 0.68,
            grav: -0.2,
            size: 0.125,
            life: 1.55,
          });
        } else if (glyph === "z") {
          this.emit("z", pos, count, {
            colors: [0xdfe6ff, 0xb9c6ff],
            spread: 0.12,
            up: 0.38,
            grav: -0.05,
            size: 0.09,
            life: 2.3,
            grow: 0.08,
          });
        } else {
          this.emit("spark", pos, count, {
            colors: [0xffd45e, 0xfff3c0],
            spread: 0.4,
            up: 0.7,
            grav: 0.8,
            size: 0.1,
            life: 1.2,
          });
        }
      },
      onBatYarn: (dx, dz, power) => this.impulseYarn(dx, dz, power),
      onBatPom: (imp) => {
        this.pomVel += imp;
        this.cb.onToySfx?.("bell");
      },
      onScratchSfx: () => this.cb.onToySfx?.("scratch"),
    });
    this.registerItems();

    this.resize();
    this.applyCameraPose(0);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    const el = renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onCancel);
    el.addEventListener("pointerleave", this.onLeave);
    el.addEventListener("mousedown", this.onMouseDown);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("mousemove", this.onDocMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    this.applySky(0);
    this.drawScreen(true);
    this.setTodos([]);
    document.fonts?.ready.then(() => !this.disposed && this.drawScreen(true));
    renderer.compile(this.scene, this.camera);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------------------------------------------------------------- */
  /* Construction                                                      */
  /* ---------------------------------------------------------------- */

  private buildLights() {
    const size = this.mobile ? 1024 : 2048;
    const { sun, lamp, scene } = this;
    sun.castShadow = true;
    sun.shadow.mapSize.set(size, size);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -7.5;
    sc.right = sc.top = 7.5;
    sc.near = 2;
    sc.far = 30;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    sun.target.position.copy(SUN_TARGET);

    this.bounce.position.set(1.0, 1.6, -0.5);

    // desk lamp: a real spotlight sitting inside the shade
    const head = this.refs.lampHead.getWorldPosition(new THREE.Vector3());
    const aim = new THREE.Vector3(-0.22, 0.79, -2.39);
    lamp.position.copy(head).addScaledVector(aim.clone().sub(head).normalize(), 0.08);
    lamp.target.position.copy(aim);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(this.mobile ? 512 : 1024, this.mobile ? 512 : 1024);
    lamp.shadow.bias = -0.002;
    lamp.shadow.camera.near = 0.12;
    lamp.shadow.camera.far = 7;

    this.fairy.position.set(-1.8, 2.35, -0.9);
    this.candle.position.set(0.5, 1.5, -2.72);

    scene.add(this.hemi, sun, sun.target, this.bounce, lamp, lamp.target, this.fairy, this.candle);

    // The diorama has no roof, so without this the sun would flood the whole floor.
    // This slab draws nothing on screen but still casts a shadow, which means
    // daylight and moonlight can only get in through the window.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.1, 7.2),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    roof.position.set(0.99, 3.52, 0.19);
    roof.castShadow = true;
    this.fx.add(roof);
  }

  private buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color() },
        bottom: { value: new THREE.Color() },
        low: { value: new THREE.Color() },
        halo: { value: new THREE.Color() },
        haloI: { value: 0.5 },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 low; uniform vec3 halo; uniform vec3 sunDir; uniform float haloI;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          // three stops: haze far below the room, the horizon band, the zenith
          vec3 c = mix(low, bottom, smoothstep(-0.85, -0.1, d.y));
          c = mix(c, top, smoothstep(0.02, 0.75, d.y));
          float s = max(dot(d, sunDir), 0.0);
          c += halo * (pow(s, 5.0) * 0.55 + pow(s, 40.0) * 0.6) * haloI;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 18), this.skyMat);
    dome.frustumCulled = false;
    dome.renderOrder = -2;
    this.fx.add(dome);

    // two star layers twinkling out of phase
    const soft = glowTexture();
    for (let layer = 0; layer < 2; layer++) {
      const n = 240;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = this.rand() * 2 - 1;
        const a = this.rand() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        pos.set([Math.cos(a) * s * 180, u * 180, Math.sin(a) * s * 180], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: (layer ? 3.2 : 4.6) * this.pixelRatio,
        sizeAttenuation: false,
        map: soft,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: layer ? 0xcfd8ff : 0xfff3d6,
        toneMapped: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = -1;
      this.starMats.push(mat);
      this.fx.add(pts);
    }

    this.disc = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: discTexture(), depthWrite: false, toneMapped: false, transparent: true }),
    );
    this.disc.renderOrder = -1;
    this.fx.add(this.disc);

    // low-poly clouds drifting behind and below the floating room
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const spots: [number, number, number][] = [
      [-10, 0.6, -7],
      [-3, -3.2, -11],
      [7, 3.6, -12],
      [-12, 3.4, 4],
      [8, -5.4, -4],
    ];
    spots.forEach(([x, y, z], i) => {
      const g = new THREE.Group();
      const n = 3 + Math.floor(this.rand() * 3);
      for (let j = 0; j < n; j++) {
        const s = 0.7 + this.rand() * 0.7;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), cloudMat);
        m.position.set((j - (n - 1) / 2) * 0.95, this.rand() * 0.3, this.rand() * 0.6);
        m.scale.y = 0.68;
        g.add(m);
      }
      g.position.set(x, y, z);
      g.scale.setScalar(0.85 + i * 0.08);
      this.clouds.push({ g, speed: 0.05 + this.rand() * 0.07 });
      this.fx.add(g);
    });
  }

  private buildFx() {
    const glow = glowTexture();
    this.glyphs = glyphTextures();

    /* light shaft from the window — additive slices that fade toward the floor */
    const QUADS = 8;
    const geo = new THREE.BufferGeometry();
    const col = new Float32Array(QUADS * 4 * 3);
    const idx: number[] = [];
    for (let q = 0; q < QUADS; q++) {
      col.set([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0], q * 12);
      const o = q * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(QUADS * 4 * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.beam = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.beam.frustumCulled = false;
    this.fx.add(this.beam);

    /* dust motes hanging in the light */
    const N = this.mobile ? 70 : 120;
    const pos = new Float32Array(N * 3);
    this.dustVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos.set([-1.2 + this.rand() * 3.4, 0.25 + this.rand() * 2.5, -2.9 + this.rand() * 2.8], i * 3);
      this.dustVel.set([(this.rand() - 0.5) * 0.05, (this.rand() - 0.5) * 0.03, (this.rand() - 0.5) * 0.05], i * 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        size: 0.05,
        map: glow,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffe9c4,
        toneMapped: false,
      }),
    );
    this.dust.frustumCulled = false;
    this.fx.add(this.dust);

    /* glows */
    const mkGlow = (color: number, size: number) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      s.scale.setScalar(size);
      this.fx.add(s);
      return s;
    };
    this.lampGlow = mkGlow(0xffc070, 0.75);
    this.refs.lampHead.getWorldPosition(this.lampGlow.position);
    this.lampGlow.position.y -= 0.05;
    this.candleGlow = mkGlow(0xff9a40, 0.5);
    this.refs.flame.getWorldPosition(this.candleGlow.position);
    this.boxGlow = mkGlow(0xffd27a, 0.7);
    this.refs.box.getWorldPosition(this.boxGlow.position);
    this.boxGlow.position.y += 0.12;

    const bulbs = this.refs.fairyBulbs;
    const fp = new Float32Array(bulbs.count * 3);
    const fc = new Float32Array(bulbs.count * 3);
    const m = new THREE.Matrix4();
    for (let i = 0; i < bulbs.count; i++) {
      bulbs.getMatrixAt(i, m);
      this.tmpV.setFromMatrixPosition(m);
      fp.set([this.tmpV.x + 0.03, this.tmpV.y, this.tmpV.z], i * 3);
      this.refs.fairyColors[i].toArray(fc, i * 3);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    fg.setAttribute("color", new THREE.BufferAttribute(fc, 3));
    this.fairyGlow = new THREE.Points(
      fg,
      new THREE.PointsMaterial({
        size: 0.42,
        map: glow,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.fairyGlow.frustumCulled = false;
    this.fx.add(this.fairyGlow);

    /* steam over the mug */
    this.refs.mug.getWorldPosition(this.mugTop);
    this.mugTop.y += 0.13;
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
      );
      this.steam.push(s);
      this.fx.add(s);
    }

    /* pooled glyph sprites: hearts, Zs, notes, sparkles, drops */
    for (let i = 0; i < 56; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glyphs.spark, transparent: true, depthWrite: false, toneMapped: false }),
      );
      s.visible = false;
      this.fx.add(s);
      this.floaters.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), grav: 0, size: 0.1, grow: 0 });
    }
  }

  private registerItems() {
    const box3 = new THREE.Box3();
    const hintTex = hintTexture();
    (Object.keys(META) as InteractId[]).forEach((id) => {
      const root = this.refs.items[id];
      if (!root) return;
      const meta = META[id];
      const anchor = new THREE.Vector3();
      const center = box3.setFromObject(root).getCenter(new THREE.Vector3());
      if (meta.anchor) anchor.set(...meta.anchor);
      else anchor.set(center.x, box3.max.y + 0.1, center.z);
      const item: Item = {
        id,
        root,
        scaleTarget: id === "cat" ? this.refs.cat.visual : root,
        label: meta.label,
        pop: meta.pop,
        secret: !!meta.secret,
        anchor,
        center,
        hover: 0,
        bounce: 0,
      };
      if (!item.secret) {
        const s = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: hintTex,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        s.renderOrder = 20;
        s.visible = false;
        s.position.copy(anchor);
        this.fx.add(s);
        item.hint = s;
      }
      this.items.set(id, item);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                        */
  /* ---------------------------------------------------------------- */

  setTimer(view: TimerView) {
    this.timer = view;
    this.drawScreen(false);
  }

  setStars(n: number, celebrate = false) {
    const mesh = this.refs.jarStars;
    const shown = Math.min(n, mesh.instanceMatrix.count);
    if (celebrate && n > this.stars) {
      const p = this.refs.jar.getWorldPosition(this.tmpV2).clone();
      p.y += 0.25;
      this.emit("spark", p, 10, { colors: [0xffd45e, 0xfff3c0, 0xe4572e], spread: 0.9, up: 1.4, grav: 1.6, size: 0.13, life: 1.3 });
    }
    this.stars = n;
    mesh.count = shown;
  }

  /** Timer finished: the tomato rings and throws confetti. */
  celebrate() {
    this.ring = 1.8;
    const p = this.refs.tomato.getWorldPosition(new THREE.Vector3());
    p.y += 0.2;
    this.emit("spark", p, 22, {
      colors: [0xffd45e, 0xe4572e, 0xfff3c0, 0x9fd39a],
      spread: 1.5,
      up: 2.2,
      grav: 2.2,
      size: 0.15,
      life: 1.8,
    });
    this.bump("timer");
  }

  setResting(on: boolean) {
    if (on === this.resting) return;
    this.resting = on;
    this.catCtrl.setOwnerResting(on);
    if (on) {
      this.unlockPointer();
      this.crouched = false;
      this.velY = 0;
      this.lampOn = false;
      this.refs.avatar.root.visible = false;
      this.setSky("night", 3.2);
      this.refs.bedLump.visible = true;
      this.glideCameraTo(REST_POS, REST_YAW, REST_PITCH, 1.5);
    } else {
      this.setSky("day", 3.2);
      this.crouched = false;
      this.eyeHeight = EYE_STAND;
      this.velY = 0;
      this.grounded = true;
      this.playerPos.copy(WAKE_POS);
      this.avatarYaw = WAKE_YAW;
      this.refs.avatar.root.visible = this.thirdPerson;
      if (this.thirdPerson) {
        this.refs.avatar.root.position.copy(WAKE_POS);
        this.refs.avatar.root.rotation.y = WAKE_YAW;
        this.glideCameraTo(this.freeRoamTpCameraPos(), WAKE_YAW, -0.25, 1.3);
      } else {
        const eyeTarget = WAKE_POS.clone().add(new THREE.Vector3(0, EYE_STAND, 0));
        this.glideCameraTo(eyeTarget, WAKE_YAW, WAKE_PITCH, 1.3);
      }
    }
  }

  callCat() {
    this.catCtrl.callToPlayer(this.playerPos, this.resting, this.activity);
  }

  setActivity(mode: ActivityMode, opts?: { reading?: boolean }) {
    const prev = this.activity;
    const prevChair = prev === "desk";
    const nextChair = mode === "desk";
    if (mode !== "none") this.lastStation = mode;
    this.activity = mode;
    this.poufReading = mode === "pouf" && !!opts?.reading;
    this.exercisePaused = false;
    this.hoverDirty = true;
    this.resetPointers();

    this.refs.studyBook.root.visible = mode === "desk";
    this.refs.studyBook.flipPage.rotation.z = 0;
    this.refs.studyBook.flipPage.position.y = 0.023;
    this.refs.poufLapBook.root.visible = this.poufReading;
    this.refs.poufLapBook.flipPage.rotation.z = 0;
    this.refs.poufLapBook.flipPage.position.y = 0.023;
    this.refs.poufBookFloor.visible = !this.poufReading;
    this.refs.rackDumbbells.visible = mode !== "weights";
    this.pageFlip = 0;
    this.autoFlipTimer = 11;

    if (prevChair !== nextChair) {
      const chair = this.refs.chair;
      const cPos0 = chair.position.clone();
      const cPos1 = nextChair ? CHAIR_FOCUS_POS : CHAIR_HOME_POS;
      const cYaw0 = chair.rotation.y;
      const cYaw1 = nextChair ? CHAIR_FOCUS_YAW : CHAIR_HOME_YAW;
      this.tween(0.55, (k) => {
        chair.position.lerpVectors(cPos0, cPos1, k);
        chair.rotation.y = cYaw0 + (cYaw1 - cYaw0) * k;
      });
    }

    if (mode !== "none") {
      const spec = ACTIVITIES[mode];
      this.refs.avatar.root.position.copy(spec.avatarPos);
      this.refs.avatar.root.rotation.y = spec.avatarYaw;
      this.refs.avatar.root.visible = this.thirdPerson;
      this.tpTarget.copy(spec.tpTarget);
      this.unlockPointer();
      this.keys.clear();
      this.crouched = false;
      this.velY = 0;
      if (mode === "desk" && this.cur.dark > 0.25) this.lampOn = true;

      if (this.thirdPerson) {
        this.tpYaw = spec.tpYaw;
        this.tpPitch = spec.tpPitch;
        this.tpDist = spec.tpDist;
        const tpPos = this.tpCameraPos();
        const o = this.tpOrientation(tpPos);
        this.glideCameraTo(tpPos, o.yaw, o.pitch, 0.75);
      } else {
        this.glideCameraTo(spec.fpPos, spec.fpYaw, spec.fpPitch, 0.9);
      }
    } else {
      this.crouched = false;
      this.eyeHeight = EYE_STAND;
      this.velY = 0;
      this.grounded = true;
      const back = ACTIVITIES[this.lastStation];
      this.playerPos.copy(back.standPos);
      this.avatarYaw = back.standYaw;
      this.refs.avatar.root.visible = this.thirdPerson;
      if (this.thirdPerson) {
        this.refs.avatar.root.position.copy(back.standPos);
        this.refs.avatar.root.rotation.y = back.standYaw;
        const lookY = back.standPos.y + 1.18;
        this.yaw = back.standYaw;
        this.pitch = -0.22;
        const tpPos = this.freeRoamTpCameraPos();
        const dx = back.standPos.x - tpPos.x;
        const dy = lookY - tpPos.y;
        const dz = back.standPos.z - tpPos.z;
        const horiz = Math.max(0.001, Math.hypot(dx, dz));
        this.glideCameraTo(tpPos, Math.atan2(-dx, -dz), Math.atan2(dy, horiz), 0.85);
      } else {
        const eyeTarget = back.standPos.clone().add(new THREE.Vector3(0, EYE_STAND, 0));
        this.glideCameraTo(eyeTarget, back.standYaw, back.standPitch, 0.85);
      }
    }
  }

  setPoufReading(on: boolean) {
    if (this.activity !== "pouf" || on === this.poufReading) return;
    this.poufReading = on;
    this.refs.poufLapBook.root.visible = on;
    this.refs.poufLapBook.flipPage.rotation.z = 0;
    this.refs.poufLapBook.flipPage.position.y = 0.023;
    this.refs.poufBookFloor.visible = !on;
    this.pageFlip = 0;
    this.autoFlipTimer = 11;
    this.hoverDirty = true;
  }

  setExercisePaused(paused: boolean) {
    this.exercisePaused = paused;
  }

  setThirdPerson(on: boolean) {
    if (this.resting || on === this.thirdPerson) return;
    this.thirdPerson = on;
    this.refs.avatar.root.visible = on;
    this.hoverDirty = true;
    if (this.activity === "none") {
      if (on) {
        this.avatarYaw = this.yaw;
        this.refs.avatar.root.position.copy(this.playerPos);
        this.refs.avatar.root.rotation.y = this.avatarYaw;
      }
      this.applyCameraPose(0);
      return;
    }
    const spec = ACTIVITIES[this.activity];
    if (on) {
      this.tpTarget.copy(spec.tpTarget);
      this.tpYaw = spec.tpYaw;
      this.tpPitch = spec.tpPitch;
      this.tpDist = spec.tpDist;
      const tpPos = this.tpCameraPos();
      const o = this.tpOrientation(tpPos);
      this.glideCameraTo(tpPos, o.yaw, o.pitch, 0.75);
    } else {
      this.glideCameraTo(spec.fpPos, spec.fpYaw, spec.fpPitch, 0.65);
    }
  }

  setCatName(name: string) {
    this.catName = name.trim().slice(0, 20) || "Miso";
    this.catCtrl.setName(this.catName);
    this.hoverDirty = true;
  }

  setAvatarPreview(on: boolean) {
    if (on === this.avatarPreview) return;
    this.avatarPreview = on;
    if (this.activity !== "none" || this.resting) return;
    if (on) {
      this.unlockPointer();
      this.keys.clear();
      this.crouched = false;
      this.refs.avatar.root.visible = true;
      this.refs.avatar.root.position.copy(this.playerPos);
      this.refs.avatar.root.rotation.y = this.avatarYaw;
      this.tpTarget.set(this.playerPos.x, this.playerPos.y + 0.96, this.playerPos.z);
      this.tpYaw = this.avatarYaw + Math.PI + 0.28;
      this.tpPitch = 0.16;
      this.tpDist = 2.05;
      const tpPos = this.tpCameraPos();
      const o = this.tpOrientation(tpPos);
      this.glideCameraTo(tpPos, o.yaw, o.pitch, 0.55);
    } else {
      this.refs.avatar.root.visible = this.thirdPerson;
      this.applyCameraPose(0);
    }
  }

  setAvatarConfig(cfg: AvatarConfig) {
    const old = this.refs.avatar;
    const next = buildAvatar(cfg);
    next.root.position.copy(old.root.position);
    next.root.rotation.copy(old.root.rotation);
    next.root.visible = !this.resting && (this.thirdPerson || this.avatarPreview);
    this.room.remove(old.root);
    this.room.add(next.root);
    this.refs.avatar = next;
    old.dispose();
  }

  setRadioPlaying(on: boolean, label?: string | null) {
    if (on && !this.radioOn) this.emitTimer = 0;
    this.radioOn = on;
    this.radioLabel = on && label ? label : null;
    this.hoverDirty = true;
  }

  setTodos(todos: TodoItem[]) {
    const c = this.refs.todoCanvas;
    const g = c.getContext("2d")!;
    const W = c.width;
    const H = c.height;

    g.fillStyle = "#fbf5ea";
    g.fillRect(0, 0, W, H);
    // faint ruled notebook lines
    g.strokeStyle = "rgba(43,32,48,0.08)";
    g.lineWidth = 1;
    for (let y = 66; y < H - 16; y += 30) {
      g.beginPath();
      g.moveTo(16, y);
      g.lineTo(W - 16, y);
      g.stroke();
    }

    g.fillStyle = "#2b2030";
    g.font = '700 22px "Fraunces", Georgia, serif';
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText("TO-DO", 20, 32);

    const doneCount = todos.filter((x) => x.done).length;
    g.fillStyle = "#655468";
    g.font = '700 12px "Nunito", system-ui, sans-serif';
    g.textAlign = "right";
    g.fillText(todos.length ? `${doneCount}/${todos.length}` : "Empty", W - 20, 32);

    g.strokeStyle = "#2b2030";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(18, 48);
    g.lineTo(W - 18, 48);
    g.stroke();

    if (todos.length === 0) {
      g.textAlign = "left";
      g.fillStyle = "#8a788c";
      g.font = 'italic 15px "Nunito", system-ui, sans-serif';
      g.fillText("No tasks yet.", 22, 92);
      g.fillText("Click board to add…", 22, 118);
    } else {
      g.textAlign = "left";
      const shown = todos.slice(0, 7);
      shown.forEach((item, i) => {
        const y = 78 + i * 30;
        g.strokeStyle = "#2b2030";
        g.lineWidth = 2;
        g.fillStyle = item.done ? "#7d9b76" : "#ffffff";
        g.fillRect(20, y - 8, 16, 16);
        g.strokeRect(20, y - 8, 16, 16);
        if (item.done) {
          g.strokeStyle = "#fbf5ea";
          g.lineWidth = 2.4;
          g.beginPath();
          g.moveTo(23.5, y);
          g.lineTo(27, y + 3.5);
          g.lineTo(32.5, y - 3.5);
          g.stroke();
        }
        g.fillStyle = item.done ? "#8a788c" : "#2b2030";
        g.font = '700 14px "Nunito", system-ui, sans-serif';
        let label = item.text;
        while (label.length > 3 && g.measureText(label).width > W - 64) {
          label = label.slice(0, -2) + "…";
        }
        g.fillText(label, 46, y + 1);
        if (item.done) {
          const tw = g.measureText(label).width;
          g.strokeStyle = "#8a788c";
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(45, y + 1);
          g.lineTo(47 + tw, y + 1);
          g.stroke();
        }
      });
      if (todos.length > 7) {
        g.fillStyle = "#655468";
        g.font = '800 12px "Nunito", system-ui, sans-serif';
        g.fillText(`+${todos.length - 7} more…`, 22, 294);
      }
    }

    this.refs.todoTex.needsUpdate = true;
  }

  flipStudyPage() {
    this.pageFlip = 0.001;
    this.autoFlipTimer = 11 + this.rand() * 4;
  }

  setHints(on: boolean, discovered: Iterable<string>) {
    this.hintsOn = on;
    this.discovered = new Set(discovered);
  }

  setUiOpen(open: boolean) {
    this.uiOpen = open;
    if (open) {
      this.unlockPointer();
      this.keys.clear();
    }
  }

  lockPointer() {
    if (this.resting || this.activity !== "none" || this.uiOpen || this.disposed) return;
    const el = this.renderer.domElement;
    if (document.pointerLockElement === el || !el.requestPointerLock) return;
    try {
      const res = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (res && typeof res.catch === "function") res.catch(() => {});
    } catch {
      /* ignore if browser blocks pointer lock */
    }
  }

  unlockPointer() {
    if (document.pointerLockElement === this.renderer.domElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        /* ignore */
      }
    }
  }

  /** Restore persistent world state after a reload. */
  restore(state: { bloomed?: boolean }) {
    if (state.bloomed && !this.bloomed) {
      this.plantStage = 3;
      this.bloomed = true;
      this.refs.plant.leaves.scale.setScalar(1.21);
      for (const f of this.refs.plant.flowers) {
        f.visible = true;
        f.scale.setScalar(1);
      }
    }
  }

  resetView() {
    if (this.resting) return;
    if (this.activity !== "none") {
      const spec = ACTIVITIES[this.activity];
      if (this.thirdPerson) {
        this.tpTarget.copy(spec.tpTarget);
        this.tpYaw = spec.tpYaw;
        this.tpPitch = spec.tpPitch;
        this.tpDist = spec.tpDist;
        const tpPos = this.tpCameraPos();
        const o = this.tpOrientation(tpPos);
        this.glideCameraTo(tpPos, o.yaw, o.pitch, 0.65);
      } else {
        this.glideCameraTo(spec.fpPos, spec.fpYaw, spec.fpPitch, 0.65);
      }
      return;
    }
    this.crouched = false;
    this.velY = 0;
    this.grounded = true;
    this.playerPos.copy(SPAWN_POS);
    const eyeTarget = SPAWN_POS.clone().add(new THREE.Vector3(0, EYE_STAND, 0));
    this.glideCameraTo(eyeTarget, SPAWN_YAW, SPAWN_PITCH, 0.9);
  }

  /** Projected screen position of an interactable — handy for tests and tooling. */
  screenPosition(id: InteractId) {
    const it = this.items.get(id);
    if (!it) return null;
    const p = it.center.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** Programmatic interaction (keyboard / debugging). */
  trigger(id: InteractId) {
    const it = this.items.get(id);
    if (it) this.interact(it);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.unlockPointer();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onCancel);
    el.removeEventListener("pointerleave", this.onLeave);
    el.removeEventListener("mousedown", this.onMouseDown);
    el.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("mousemove", this.onDocMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.refs.avatar.dispose();
    const seen = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        const map = (m as THREE.MeshStandardMaterial).map;
        map?.dispose();
        m.dispose();
      }
    });
    this.sun.shadow.map?.dispose();
    this.lamp.shadow.map?.dispose();
    this.renderer.dispose();
    el.remove();
    resetKit();
  }

  /* ---------------------------------------------------------------- */
  /* First-person camera, movement & collision                         */
  /* ---------------------------------------------------------------- */

  private tpCameraPos(out = new THREE.Vector3()): THREE.Vector3 {
    const c = Math.cos(this.tpPitch);
    out.set(
      this.tpTarget.x + Math.sin(this.tpYaw) * c * this.tpDist,
      this.tpTarget.y + Math.sin(this.tpPitch) * this.tpDist,
      this.tpTarget.z + Math.cos(this.tpYaw) * c * this.tpDist,
    );
    out.x = Math.max(ROOM_MIN_X, Math.min(ROOM_MAX_X, out.x));
    out.y = Math.max(0.45, Math.min(3.15, out.y));
    out.z = Math.max(ROOM_MIN_Z, Math.min(ROOM_MAX_Z, out.z));
    return out;
  }

  private freeRoamTpCameraPos(out = new THREE.Vector3()): THREE.Vector3 {
    const tpPitch = Math.max(-0.75, Math.min(0.72, -this.pitch));
    const pivotY = this.playerPos.y + (this.crouched ? 0.82 : 1.18) - this.landDip * 0.6;
    const dist = 2.05;
    const c = Math.cos(tpPitch);
    out.set(
      this.playerPos.x + Math.sin(this.yaw) * c * dist,
      pivotY + Math.sin(tpPitch) * dist,
      this.playerPos.z + Math.cos(this.yaw) * c * dist,
    );
    out.x = Math.max(ROOM.minX + 0.16, Math.min(ROOM.maxX - 0.16, out.x));
    out.y = Math.max(0.25, Math.min(3.25, out.y));
    out.z = Math.max(ROOM.minZ + 0.16, Math.min(ROOM.maxZ - 0.16, out.z));
    return out;
  }

  private tpOrientation(pos: THREE.Vector3) {
    const dx = this.tpTarget.x - pos.x;
    const dy = this.tpTarget.y - pos.y;
    const dz = this.tpTarget.z - pos.z;
    const horiz = Math.max(0.001, Math.hypot(dx, dz));
    return {
      yaw: Math.atan2(-dx, -dz),
      pitch: Math.atan2(dy, horiz),
    };
  }

  private glideCameraTo(pos: THREE.Vector3, targetYaw: number, targetPitch: number, dur: number) {
    const p0 = this.camera.position.clone();
    const y0 = this.yaw;
    const dy = angleDelta(y0, targetYaw);
    const pt0 = this.pitch;
    this.steer(dur, (k) => {
      this.camera.position.lerpVectors(p0, pos, k);
      this.yaw = y0 + dy * k;
      this.pitch = pt0 + (targetPitch - pt0) * k;
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    });
  }

  private cancelCamTween() {
    if (!this.camTween) return;
    const i = this.tweens.indexOf(this.camTween);
    if (i >= 0) this.tweens.splice(i, 1);
    this.camTween = null;
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private isBlocked(x: number, z: number, footY: number): boolean {
    if (x < ROOM_MIN_X || x > ROOM_MAX_X || z < ROOM_MIN_Z || z > ROOM_MAX_Z) return true;
    for (const c of COLLIDERS) {
      if (footY + STEP_UP >= c.topY && c.walkable) continue;
      if (
        x + PLAYER_RADIUS > c.minX &&
        x - PLAYER_RADIUS < c.maxX &&
        z + PLAYER_RADIUS > c.minZ &&
        z - PLAYER_RADIUS < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  private supportHeight(x: number, z: number, footY: number): number {
    let h = 0;
    const r = PLAYER_RADIUS * 0.7;
    for (const c of COLLIDERS) {
      if (!c.walkable) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        if (footY >= c.topY - 0.16) {
          h = Math.max(h, c.topY);
        }
      }
    }
    return h;
  }

  private updatePlayer(dt: number) {
    // FOV & eye height smooth transitions
    const movingFwd = this.keys.has("KeyW") || this.keys.has("ArrowUp");
    const movingBack = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const movingLeft = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const movingRight = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const hasMove = (movingFwd !== movingBack) || (movingLeft !== movingRight);
    const shiftHeld = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const running = !this.resting && this.activity === "none" && !this.uiOpen && !this.crouched && shiftHeld && hasMove;

    const targetFov = this.resting || this.activity !== "none" ? FOV_WALK : running ? FOV_RUN : this.crouched ? FOV_CROUCH : FOV_WALK;
    this.fovCur = approach(this.fovCur, targetFov, 9, dt);
    if (Math.abs(this.camera.fov - this.fovCur) > 0.02) {
      this.camera.fov = this.fovCur;
      this.camera.updateProjectionMatrix();
    }

    if (this.camTween) return;

    if (this.activity !== "none") {
      const spec = ACTIVITIES[this.activity];
      if (this.thirdPerson) {
        this.camera.position.copy(this.tpCameraPos(this.tmpV));
        this.camera.lookAt(this.tpTarget);
      } else {
        let bx = 0;
        let by = this.calm ? 0 : Math.sin(this.time * 1.45) * 0.008;
        if (!this.calm && !this.exercisePaused) {
          if (this.activity === "yoga") {
            const squat = 0.5 - 0.5 * Math.cos(this.exPhase);
            by = -squat * 0.2;
          } else if (this.activity === "weights") {
            by = Math.sin(this.exPhase * 2) * 0.015;
          } else if (this.activity === "bike") {
            by = Math.sin(this.exPhase * 2) * 0.012;
            bx = Math.cos(this.exPhase) * 0.008;
          }
        }
        this.camera.position.set(spec.fpPos.x + bx, spec.fpPos.y + by, spec.fpPos.z);
        this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      }
      return;
    }

    if (this.resting) {
      const breathe = this.calm ? 0 : Math.sin(this.time * 1.25) * 0.012;
      this.camera.position.set(REST_POS.x, REST_POS.y + breathe, REST_POS.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      return;
    }

    if (this.avatarPreview) {
      this.camera.position.copy(this.tpCameraPos(this.tmpV));
      this.camera.lookAt(this.tpTarget);
      return;
    }

    // Movement vector in XZ from yaw
    let moveX = 0;
    let moveZ = 0;
    if (!this.uiOpen) {
      const forward = (movingFwd ? 1 : 0) - (movingBack ? 1 : 0);
      const strafe = (movingRight ? 1 : 0) - (movingLeft ? 1 : 0);
      if (forward !== 0 || strafe !== 0) {
        const len = Math.hypot(forward, strafe);
        const f = forward / len;
        const s = strafe / len;
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);
        // forward dir = (-sinY, -cosY), right dir = (cosY, -sinY)
        const speed = this.crouched ? CROUCH_SPEED : running ? RUN_SPEED : WALK_SPEED;
        moveX = (-sinY * f + cosY * s) * speed * dt;
        moveZ = (-cosY * f - sinY * s) * speed * dt;
      }
    }

    // Slide cleanly along X then Z
    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;
    const tryX = Math.max(ROOM_MIN_X, Math.min(ROOM_MAX_X, prevX + moveX));
    if (!this.isBlocked(tryX, prevZ, this.playerPos.y)) {
      this.playerPos.x = tryX;
    }
    const tryZ = Math.max(ROOM_MIN_Z, Math.min(ROOM_MAX_Z, prevZ + moveZ));
    if (!this.isBlocked(this.playerPos.x, tryZ, this.playerPos.y)) {
      this.playerPos.z = tryZ;
    }

    const movedDist = Math.hypot(this.playerPos.x - prevX, this.playerPos.z - prevZ);

    // Vertical physics (gravity, jumping, landing on floor/furniture)
    const prevY = this.playerPos.y;
    const support = this.supportHeight(this.playerPos.x, this.playerPos.z, prevY);
    if (!this.grounded || prevY > support + 0.001 || this.velY > 0) {
      this.velY -= GRAVITY * dt;
      this.playerPos.y += this.velY * dt;
      // Gentle ceiling cap
      const maxFootY = 3.2 - this.eyeHeight;
      if (this.playerPos.y > maxFootY) {
        this.playerPos.y = maxFootY;
        if (this.velY > 0) this.velY = 0;
      }
      const nextSupport = this.supportHeight(this.playerPos.x, this.playerPos.z, Math.max(prevY, this.playerPos.y));
      if (this.playerPos.y <= nextSupport) {
        const impact = Math.abs(this.velY);
        this.playerPos.y = nextSupport;
        this.velY = 0;
        if (!this.grounded && impact > 2.2) {
          this.landDip = Math.min(0.11, impact * 0.014);
          this.cb.onMoveSfx?.("land", { strength: impact / 5.5 });
        }
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      this.playerPos.y = support;
      this.velY = 0;
      this.grounded = true;
    }

    // Smooth crouch / squat transition & landing dip recovery
    const targetEye = this.crouched ? EYE_CROUCH : EYE_STAND;
    this.eyeHeight = approach(this.eyeHeight, targetEye, 13, dt);
    this.landDip = approach(this.landDip, 0, 12, dt);

    // Head bob, footstep cadence & free-roam avatar locomotion
    const speedActual = dt > 0 ? movedDist / dt : 0;
    this.moveSpeed = approach(this.moveSpeed, speedActual, 12, dt);
    this.crouchK = approach(this.crouchK, this.crouched ? 1 : 0, 12, dt);
    if (movedDist > 0.001) {
      this.walkPhase += movedDist * 4.2;
      const moveYaw = Math.atan2(-(this.playerPos.x - prevX), -(this.playerPos.z - prevZ));
      this.avatarYaw = approachAngle(this.avatarYaw, moveYaw, 14, dt);
    } else {
      this.avatarYaw = approachAngle(this.avatarYaw, this.yaw, 8, dt);
    }

    const targetBob = this.grounded && speedActual > 0.2 && !this.calm ? (running ? 0.045 : this.crouched ? 0.016 : 0.028) : 0;
    this.bobAmp = approach(this.bobAmp, targetBob, 11, dt);
    if (this.grounded && movedDist > 0.0005) {
      const freq = running ? 3.5 : this.crouched ? 3.8 : 3.2;
      this.bobPhase += movedDist * freq;
      this.stepAcc += movedDist;
      const stride = running ? 1.15 : this.crouched ? 0.72 : 0.92;
      if (this.stepAcc >= stride) {
        this.stepAcc -= stride;
        this.cb.onMoveSfx?.("step", { running, crouched: this.crouched });
      }
    } else if (!this.grounded) {
      this.stepAcc = 0;
    }

    this.applyCameraPose(dt);
  }

  private applyCameraPose(_dt: number) {
    if (this.thirdPerson) {
      const pivotY = this.playerPos.y + (this.crouched ? 0.82 : 1.18) - this.landDip * 0.6;
      this.camera.position.copy(this.freeRoamTpCameraPos(this.tmpV));
      this.camera.lookAt(this.playerPos.x, pivotY, this.playerPos.z);
      return;
    }
    const bobY = Math.sin(this.bobPhase * 2) * this.bobAmp;
    const bobX = Math.cos(this.bobPhase) * this.bobAmp * 0.55;
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    this.camera.position.set(
      this.playerPos.x + rightX * bobX,
      this.playerPos.y + this.eyeHeight + bobY - this.landDip,
      this.playerPos.z + rightZ * bobX,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  /* ---------------------------------------------------------------- */
  /* Keyboard & pointer handling                                       */
  /* ---------------------------------------------------------------- */

  private onPointerLockChange = () => {
    const next = document.pointerLockElement === this.renderer.domElement;
    if (next !== this.locked) {
      this.locked = next;
      this.hoverDirty = true;
      this.resetPointers();
      this.renderer.domElement.style.cursor = next ? "none" : "crosshair";
      if (next) {
        (document.activeElement as HTMLElement | null)?.blur?.();
      } else {
        this.keys.clear();
      }
      this.cb.onLockChange?.(next);
    }
  };

  private resetPointers() {
    this.activePointers.clear();
    this.dragging = false;
    this.dragStart = null;
    this.down = null;
    if (!this.locked) {
      this.renderer.domElement.style.cursor = this.hoveredLabel ? "pointer" : "crosshair";
    }
  }

  private onBlur = () => {
    this.keys.clear();
    this.resetPointers();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const typing = !!target?.closest?.("input, textarea, select");
    if (typing) return;

    const code = e.code;
    if (
      code === "KeyW" ||
      code === "KeyA" ||
      code === "KeyS" ||
      code === "KeyD" ||
      code === "ArrowUp" ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight" ||
      code === "ShiftLeft" ||
      code === "ShiftRight"
    ) {
      if (!this.resting && this.activity === "none" && !this.uiOpen) {
        this.cancelCamTween();
        this.keys.add(code);
        if (!this.locked) this.lockPointer();
        if (code.startsWith("Arrow")) e.preventDefault();
      }
      return;
    }

    if (code === "Space") {
      if (this.uiOpen || this.resting || this.activity !== "none") return;
      const onButton = !this.locked && !!target?.closest?.("button, [role=tab]");
      if (onButton) return;
      e.preventDefault();
      this.cancelCamTween();
      if (!this.locked) this.lockPointer();
      if (this.grounded) {
        this.crouched = false;
        this.velY = JUMP_VEL;
        this.grounded = false;
        this.cb.onMoveSfx?.("jump");
      }
      return;
    }

    if (code === "KeyC" && !e.repeat) {
      if (this.uiOpen || this.resting || this.activity !== "none") return;
      this.cancelCamTween();
      if (!this.locked) this.lockPointer();
      this.crouchDownAt = performance.now();
      this.crouchWasOn = this.crouched;
      this.crouched = true;
      return;
    }

    if (code === "KeyE" && !e.repeat) {
      if (this.uiOpen) return;
      const item = this.locked ? this.pickCenter() : this.hovered;
      if (item) this.interact(item);
      return;
    }

    if (code === "KeyF" && !e.repeat) {
      if (this.uiOpen) return;
      this.callCat();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "KeyC") {
      const heldMs = performance.now() - this.crouchDownAt;
      if (heldMs >= 220) {
        // Hold to squat: stand back up on release
        this.crouched = false;
      } else {
        // Quick tap: toggle squat on/off
        this.crouched = !this.crouchWasOn;
      }
    }
  };

  private onDocMouseMove = (e: MouseEvent) => {
    if (!this.locked || this.disposed) return;
    if (this.camTween && !this.resting) this.cancelCamTween();
    const dx = Math.max(-180, Math.min(180, e.movementX));
    const dy = Math.max(-180, Math.min(180, e.movementY));
    const sens = 0.0022;
    this.yaw -= dx * sens;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - dy * sens));
    this.hoverDirty = true;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked || e.button !== 0) return;
    const item = this.pickCenter();
    if (item) this.interact(item);
  };

  private onDown = (e: PointerEvent) => {
    if (this.locked) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (e.pointerType === "mouse" && e.button === 0 && !this.resting && this.activity === "none" && !this.uiOpen && !this.avatarPreview) {
      this.lockPointer();
      return;
    }
    if (e.pointerType === "mouse") this.activePointers.clear();
    this.activePointers.add(e.pointerId);
    if (this.activePointers.size === 1) {
      const orbiting = (this.activity !== "none" && this.thirdPerson) || (this.activity === "none" && this.avatarPreview);
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      this.dragStart = {
        x: e.clientX,
        y: e.clientY,
        yaw: orbiting ? this.tpYaw : this.yaw,
        pitch: orbiting ? this.tpPitch : this.pitch,
      };
      this.dragging = false;
      try {
        this.renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already released pointer */
      }
    } else {
      this.down = null;
      this.dragStart = null;
      this.dragging = false;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.locked) return;
    if (e.pointerType === "mouse" && (e.buttons & 1) === 0 && this.dragStart) {
      this.resetPointers();
    }
    if (this.dragStart && this.down && e.pointerId === this.down.id) {
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      if (!this.dragging && Math.hypot(dx, dy) > 4) {
        this.dragging = true;
        if (this.camTween && !this.resting) this.cancelCamTween();
        this.renderer.domElement.style.cursor = "grabbing";
      }
      if (this.dragging) {
        const orbiting = (this.activity !== "none" && this.thirdPerson) || (this.activity === "none" && this.avatarPreview);
        if (orbiting) {
          const sens = this.mobile ? 0.006 : 0.0048;
          this.tpYaw = this.dragStart.yaw - dx * sens;
          this.tpPitch = Math.max(0.06, Math.min(0.95, this.dragStart.pitch + dy * sens));
          return;
        }
        const sens = this.mobile ? 0.0052 : 0.0038;
        this.yaw = this.dragStart.yaw - dx * sens;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.dragStart.pitch - dy * sens));
        if (this.activity !== "none") {
          const baseYaw = ACTIVITIES[this.activity].fpYaw;
          this.yaw = baseYaw + Math.max(-1.65, Math.min(1.65, angleDelta(baseYaw, this.yaw)));
          this.pitch = Math.max(-1.05, Math.min(0.85, this.pitch));
        }
        return;
      }
    }
    if (e.pointerType !== "mouse") return;
    this.hoverPos = { x: e.clientX, y: e.clientY };
    this.hoverDirty = true;
  };

  private onUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    try {
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignored */
    }
    if (this.locked) return;
    const d = this.down;
    const wasDrag = this.dragging;
    this.down = null;
    this.dragStart = null;
    this.dragging = false;
    this.renderer.domElement.style.cursor = this.hoveredLabel ? "pointer" : "crosshair";
    if (!d || d.id !== e.pointerId || wasDrag) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    const slop = e.pointerType === "mouse" ? 6 : 14;
    if (moved > slop || performance.now() - d.t > 650) return;
    const item = this.pick(e.clientX, e.clientY);
    if (item) {
      this.interact(item);
    } else if (e.pointerType === "mouse" && !this.resting && this.activity === "none" && !this.uiOpen && !this.avatarPreview) {
      this.lockPointer();
    }
  };

  private onWheel = (e: WheelEvent) => {
    const orbiting = (this.activity !== "none" && this.thirdPerson) || (this.activity === "none" && this.avatarPreview);
    if (!orbiting) return;
    e.preventDefault();
    this.tpDist = Math.max(1.35, Math.min(3.6, this.tpDist + e.deltaY * 0.0022));
  };

  private onCancel = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    try {
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignored */
    }
    this.down = null;
    this.dragStart = null;
    this.dragging = false;
    if (!this.locked) {
      this.renderer.domElement.style.cursor = this.hoveredLabel ? "pointer" : "crosshair";
    }
  };

  private onLeave = () => {
    this.hoverPos = null;
    this.hoverDirty = true;
  };

  private pickFromNdc(nx: number, ny: number, maxDist = INTERACT_RANGE): Item | null {
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObject(this.room, true);
    const avRoot = this.refs.avatar.root;
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      let vis = true;
      let selfAvatar = false;
      for (let p: THREE.Object3D | null = o.userData.proxy ? o.parent : o; p; p = p.parent) {
        if (!p.visible) vis = false;
        if (p === avRoot) selfAvatar = true;
      }
      if (!vis || selfAvatar) continue;
      // first visible surface decides: walls and furniture block what is behind them
      while (o) {
        const id = o.userData.interact as InteractId | undefined;
        if (id) return this.items.get(id) ?? null;
        o = o.parent;
      }
      return null;
    }
    return null;
  }

  private pick(x: number, y: number): Item | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    return this.pickFromNdc(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  private pickCenter(): Item | null {
    return this.pickFromNdc(0, 0);
  }

  private updateHover() {
    if (this.locked) {
      if (this.frame % 2) return;
      const item = this.camTween ? null : this.pickCenter();
      const label = item ? this.labelFor(item) : null;
      if (item !== this.hovered || label !== this.hoveredLabel) {
        this.hovered = item;
        this.hoveredLabel = label;
        this.cb.onHover(label);
      }
      return;
    }
    if (this.hoverPos && this.frame % 8 === 0) this.hoverDirty = true;
    if (!this.hoverDirty || this.frame % 2) return;
    this.hoverDirty = false;
    const busy = this.activePointers.size > 0 || !!this.camTween;
    const item = this.hoverPos && !busy ? this.pick(this.hoverPos.x, this.hoverPos.y) : null;
    const label = item ? this.labelFor(item) : null;
    if (item !== this.hovered || label !== this.hoveredLabel) {
      this.hovered = item;
      this.hoveredLabel = label;
      this.renderer.domElement.style.cursor = label ? "pointer" : "crosshair";
      this.cb.onHover(label);
    }
  }

  private labelFor(it: Item): string | null {
    if (it.id === "glowstars" && this.glowAmount() > 0.5) return "Glowing stars";
    if (it.id === "bed" && this.resting) return "Sleeping…";
    if (it.id === "cat") return this.catCtrl.hoverLabel();
    if (it.id === "mug" && this.sipActive) return null;
    if (it.id === "study") return this.activity === "desk" ? "Flip a page" : "Sit & focus";
    if (it.id === "pouf") return this.activity === "pouf" ? "Relaxing…" : "Sit on the pouf";
    if (it.id === "poufBook") return this.activity === "pouf" && this.poufReading ? "Flip a page" : "Read on the pouf";
    if (it.id === "laser") return this.laserTimer > 0 ? "Turn off laser" : "Laser pointer";
    if (it.id === "catBox") return `${this.catName}'s cardboard box`;
    if (it.id === "radio") {
      return this.radioLabel ? `Radio · ${this.radioLabel.length > 26 ? this.radioLabel.slice(0, 25) + "…" : this.radioLabel}` : "Radio";
    }
    return it.label;
  }

  private glowAmount() {
    return smooth(0.55, 0.95, this.cur.dark);
  }

  /* ---------------------------------------------------------------- */
  /* Interactions                                                      */
  /* ---------------------------------------------------------------- */

  private bump(id: InteractId) {
    const it = this.items.get(id);
    if (it) it.bounce = 1;
  }

  private interact(it: Item) {
    if (it.id === "mug" && this.sipActive) return;
    it.bounce = 1;
    const { refs } = this;
    const e: SceneEvent = { id: it.id };
    const at = it.anchor;

    switch (it.id) {
      case "lamp":
        this.lampOn = !this.lampOn;
        e.on = this.lampOn;
        break;
      case "fairy":
        this.fairyOn = !this.fairyOn;
        e.on = this.fairyOn;
        break;
      case "candle":
        this.candleOn = !this.candleOn;
        e.on = this.candleOn;
        break;
      case "radio":
        break;
      case "window": {
        const next = PHASE_ORDER[(PHASE_ORDER.indexOf(this.phase) + 1) % PHASE_ORDER.length];
        this.setSky(next);
        e.phase = next;
        break;
      }
      case "cat":
        this.catCtrl.pet();
        break;
      case "mug":
        this.sipActive = true;
        this.sipT = 0;
        this.sipSoundPlayed = false;
        this.sipPlacePlayed = false;
        it.bounce = 0;
        this.hoverDirty = true;
        break;
      case "plant": {
        this.wobble = 1;
        this.emit("drop", this.tmpV.copy(at).setY(at.y + 0.35), 9, { colors: [0x8fd0ff, 0xc4e8ff], spread: 0.55, up: -0.2, grav: 2.4, size: 0.09, life: 0.9 });
        if (this.plantStage < 3) {
          this.plantStage++;
          const leaves = refs.plant.leaves;
          const s0 = leaves.scale.x;
          this.tween(0.9, (k) => leaves.scale.setScalar(s0 + 0.07 * k), ease.back);
          if (this.plantStage === 3 && !this.bloomed) {
            this.bloomed = true;
            e.bloomed = true;
            refs.plant.flowers.forEach((f, i) => {
              f.visible = true;
              this.tween(0.7 + i * 0.25, (k) => f.scale.setScalar(Math.max(0.001, k)), ease.back);
            });
            this.emit("spark", at, 12, { colors: [0xf5a9c0, 0xfff3c0], spread: 1.0, up: 1.2, grav: 1, size: 0.13, life: 1.5 });
          }
        }
        e.stage = this.plantStage;
        break;
      }
      case "book": {
        const b = refs.specialBook;
        const z0 = 0.125;
        this.tween(1.5, (k) => {
          const s = Math.sin(Math.PI * k);
          b.position.z = z0 + s * 0.17;
          b.rotation.x = s * 0.22;
        }, ease.inOut);
        break;
      }
      case "globe":
        this.globeVel = Math.min(26, this.globeVel + 11);
        break;
      case "glowstars":
        e.glowing = this.glowAmount() > 0.5;
        if (e.glowing) {
          for (let i = 0; i < 7; i++) {
            const p = refs.glowStarPoints[Math.floor(this.rand() * refs.glowStarPoints.length)];
            this.emit("spark", this.tmpV.copy(p).setX(p.x + 0.08), 1, { colors: [0xc9ff7a, 0xf4ffd0], spread: 0.2, up: 0.25, grav: -0.1, size: 0.12, life: 1.4 });
          }
        }
        break;
      case "mouse":
        this.mouseTarget = 1;
        this.mouseTimer = 2.6;
        break;
      case "box": {
        this.boxOpen = !this.boxOpen;
        e.on = this.boxOpen;
        const lid = refs.boxLid;
        const a0 = lid.rotation.x;
        const a1 = this.boxOpen ? -1.9 : 0;
        this.tween(0.6, (k) => (lid.rotation.x = a0 + (a1 - a0) * k), ease.back);
        if (this.boxOpen) this.emit("spark", this.boxGlow.position, 10, { colors: [0xffd27a, 0xfff3c0], spread: 0.7, up: 0.9, grav: 0.6, size: 0.1, life: 1.4 });
        break;
      }
      case "yarn": {
        const yPos = refs.toys.yarn.position;
        let dx = yPos.x - this.playerPos.x;
        let dz = yPos.z - this.playerPos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          dx /= d;
          dz /= d;
        } else {
          dx = -Math.sin(this.yaw);
          dz = -Math.cos(this.yaw);
        }
        this.impulseYarn(dx, dz, 3.1);
        this.catCtrl.notifyYarnRolled();
        break;
      }
      case "wand":
        this.wandTimer = 7.5;
        this.cb.onToySfx?.("bell");
        this.catCtrl.notifyWandWaved();
        break;
      case "scratcher":
        this.pomVel += 8.2;
        this.cb.onToySfx?.("bell");
        this.catCtrl.notifyPomBatted();
        break;
      case "catBox":
        this.boxRustle = 1;
        this.cb.onToySfx?.("box");
        this.catCtrl.notifyCatBox();
        break;
      case "laser":
        if (this.laserTimer > 0) {
          this.laserTimer = 0;
          refs.toys.laserDot.visible = false;
          this.catCtrl.notifyLaserActive(false);
        } else {
          this.laserTimer = 12;
          refs.toys.laserDot.visible = true;
          this.catCtrl.notifyLaserActive(true);
        }
        this.cb.onToySfx?.("laser");
        this.hoverDirty = true;
        break;
      case "timer":
      case "bed":
      case "study":
      case "pouf":
      case "poufBook":
      case "mat":
      case "dumbbells":
      case "bike":
      case "todo":
        break;
    }
    this.cb.onInteract(e);
  }

  private setSky(phase: SkyPhase, dur = 2.6) {
    if (phase === this.phase && this.skyK >= 1) return;
    this.skyFrom = cloneSky(this.cur);
    this.skyTo = SKIES[phase];
    this.skyK = 0;
    this.skyDur = dur;
    this.phase = phase;
  }

  /* ---------------------------------------------------------------- */
  /* Small systems                                                     */
  /* ---------------------------------------------------------------- */

  private tween(dur: number, fn: (k: number) => void, e = ease.inOut, done?: () => void) {
    const tw: Tween = { t: 0, dur, fn, ease: e, done };
    this.tweens.push(tw);
    return tw;
  }

  /** Only one thing may steer the camera at a time; a new move replaces the old one. */
  private steer(dur: number, fn: (k: number) => void, e = ease.inOut) {
    if (this.calm) dur = 0.001; // prefers-reduced-motion: cut straight to the destination
    this.cancelCamTween();
    const tw = this.tween(dur, fn, e, () => {
      if (this.camTween === tw) {
        this.camTween = null;
      }
    });
    this.camTween = tw;
  }

  private emit(
    glyph: Glyph,
    pos: THREE.Vector3,
    n: number,
    o: { colors: number[]; spread: number; up: number; grav: number; size: number; life: number; grow?: number },
  ) {
    for (const f of this.floaters) {
      if (n <= 0) break;
      if (f.life > 0) continue;
      n--;
      const mat = f.s.material;
      mat.map = this.glyphs[glyph];
      mat.color.setHex(o.colors[Math.floor(this.rand() * o.colors.length)]);
      mat.rotation = glyph === "spark" || glyph === "note" ? (this.rand() - 0.5) * 0.8 : 0;
      f.s.position.copy(pos);
      f.s.position.x += (this.rand() - 0.5) * 0.12;
      f.s.position.z += (this.rand() - 0.5) * 0.12;
      f.vel.set((this.rand() - 0.5) * o.spread, o.up * (0.6 + this.rand() * 0.6), (this.rand() - 0.5) * o.spread);
      f.grav = o.grav;
      f.size = o.size * (0.75 + this.rand() * 0.5);
      f.grow = o.grow ?? 0;
      f.life = f.max = o.life * (0.8 + this.rand() * 0.4);
      f.s.visible = true;
    }
  }

  private drawScreen(force: boolean) {
    const t = this.timer;
    const secs = Math.max(0, Math.ceil(t.remainingMs / 1000));
    const key = `${t.mode}|${secs}|${t.running}|${t.totalMs}`;
    if (!force && key === this.screenKey) return;
    this.screenKey = key;
    const c = this.refs.screenCanvas;
    const g = c.getContext("2d")!;
    const W = c.width;
    const H = c.height;
    const focus = t.mode === "focus";
    const accent = focus ? "#ff7a55" : "#9fd39a";
    g.fillStyle = "#231a2b";
    g.fillRect(0, 0, W, H);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = accent;
    g.font = '800 15px "Nunito", system-ui, sans-serif';
    const status = t.running ? (focus ? "F O C U S" : "B R E A K") : secs * 1000 >= t.totalMs ? "R E A D Y" : "P A U S E D";
    g.fillText(status, W / 2, 30);
    g.fillStyle = "#fbf1e0";
    g.font = '600 66px "Fraunces", Georgia, serif';
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    g.fillText(`${mm}:${ss}`, W / 2, 84);
    const p = t.totalMs > 0 ? 1 - clamp01(t.remainingMs / t.totalMs) : 0;
    g.fillStyle = "rgba(255,255,255,.14)";
    g.fillRect(38, 128, 180, 7);
    g.fillStyle = accent;
    g.fillRect(38, 128, 180 * p, 7);
    this.refs.screenTex.needsUpdate = true;
  }

  private updateBeam(toSun: THREE.Vector3) {
    const pos = this.beam.geometry.attributes.position as THREE.BufferAttribute;
    const { x0, x1, y0, y1, z } = WINDOW;
    const dx = -toSun.x;
    const dy = Math.min(-0.08, -toSun.y);
    const dz = -toSun.z;
    let i = 0;
    const put = (x: number, y: number, far: boolean) => {
      const t = far ? Math.min(y / -dy, 7.5) : 0;
      pos.setXYZ(i++, x + dx * t, y + dy * t, z + dz * t);
    };
    const quad = (ax: number, ay: number, bx: number, by: number) => {
      put(ax, ay, false);
      put(bx, by, false);
      put(bx, by, true);
      put(ax, ay, true);
    };
    for (let s = 0; s < 5; s++) {
      const x = x0 + ((x1 - x0) * s) / 4;
      quad(x, y0, x, y1);
    }
    for (let s = 0; s < 3; s++) {
      const y = y0 + ((y1 - y0) * s) / 2;
      quad(x0, y, x1, y);
    }
    pos.needsUpdate = true;
  }

  private applySky(t: number) {
    const c = this.cur;
    const dir = this.tmpV.copy(c.dir);
    // the sun never quite sits still — shadows drift a little over time
    dir.x += Math.sin(t * 0.06) * 0.03;
    dir.y += Math.sin(t * 0.045 + 1) * 0.018;
    dir.normalize();

    this.sun.position.copy(SUN_TARGET).addScaledVector(dir, 16);
    this.sun.color.copy(c.sun);
    this.sun.intensity = c.sunI;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiI * (1 - 0.25 * this.restLevel);
    this.bounce.color.copy(c.sun).lerp(this.tmpC.setHex(0xffc890), 0.5);
    this.bounce.intensity = c.bounce * 3.6;
    this.renderer.toneMappingExposure = c.exposure;

    const u = this.skyMat.uniforms;
    u.top.value.copy(c.top);
    u.bottom.value.copy(c.bottom);
    u.low.value.copy(c.low);
    u.halo.value.copy(c.halo);
    u.haloI.value = c.haloI;
    u.sunDir.value.copy(dir);
    this.disc.position.copy(dir).multiplyScalar(170);
    this.disc.scale.setScalar(c.discSize);
    this.disc.material.color.copy(c.disc);

    this.starMats[0].opacity = c.stars * (0.7 + 0.3 * Math.sin(t * 1.3));
    this.starMats[1].opacity = c.stars * (0.7 + 0.3 * Math.sin(t * 0.9 + 2));

    (this.beam.material as THREE.MeshBasicMaterial).color.copy(c.sun).multiplyScalar(c.beam * 0.03);
    (this.dust.material as THREE.PointsMaterial).opacity = 0.15 + c.beam * 0.6;
    this.updateBeam(dir);

    this.refs.glowStarMat.emissiveIntensity = this.glowAmount() * (1.25 + 0.2 * Math.sin(t * 1.7));
    this.offBulb.setHex(0x8a8078).lerp(this.tmpC.setHex(0x2a2530), c.dark);
  }

  /* ---------------------------------------------------------------- */
  /* Frame loop                                                        */
  /* ---------------------------------------------------------------- */

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, 0.05);
    this.time += dt;
    this.frame++;
    const t = this.time;

    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.done?.();
      }
    }

    if (this.skyK < 1) {
      this.skyK = Math.min(1, this.skyK + dt / this.skyDur);
      lerpSky(this.cur, this.skyFrom, this.skyTo, ease.inOut(this.skyK));
    }
    this.applySky(t);
    this.updatePlayer(dt);
    this.updateLights(dt, t);
    this.updateAmbient(dt, t);
    this.updateFloaters(dt);
    this.updateItems(dt, t);
    this.updateHover();

    if (this.shadowsLow) this.renderer.shadowMap.needsUpdate = this.frame % 2 === 0;
    this.renderer.render(this.scene, this.camera);

    if (!this.ready) {
      this.ready = true;
      this.cb.onReady?.();
    }
    this.watchPerformance(raw);
  };

  private updateLights(dt: number, t: number) {
    const { refs } = this;
    this.lampLevel = approach(this.lampLevel, this.lampOn ? 1 : 0, 9, dt);
    this.fairyLevel = approach(this.fairyLevel, this.fairyOn ? 1 : 0, 5, dt);
    this.candleLevel = approach(this.candleLevel, this.candleOn ? 1 : 0, 7, dt);
    this.restLevel = approach(this.restLevel, this.resting ? 1 : 0, 2, dt);

    // lamp reads brighter as the room gets darker, like eyes adjusting
    const dark = this.cur.dark;
    this.lamp.intensity = this.lampLevel * (4.5 + 10 * dark);
    refs.lampBulb.emissiveIntensity = this.lampLevel * 3.2;
    this.lampGlow.material.opacity = this.lampLevel * (0.25 + 0.4 * dark);

    const flick = 0.82 + 0.1 * Math.sin(t * 11.3) + 0.08 * Math.sin(t * 23.7 + 1.3) + 0.05 * Math.sin(t * 5.1);
    this.candle.intensity = this.candleLevel * flick * (3 + 4.5 * dark);
    this.candleGlow.material.opacity = this.candleLevel * flick * 0.7;
    refs.flame.visible = this.candleLevel > 0.03;
    refs.flame.scale.set(0.75 * this.candleLevel, (1.4 + 0.5 * flick) * this.candleLevel, 0.75 * this.candleLevel);
    refs.flame.position.x = Math.sin(t * 7.1) * 0.003;

    this.fairy.intensity = this.fairyLevel * (3.5 + 5.5 * dark) * (0.94 + 0.06 * Math.sin(t * 2.1));
    this.fairyGlow.material.opacity = this.fairyLevel * (0.3 + 0.35 * dark);
    const bulbs = refs.fairyBulbs;
    for (let i = 0; i < bulbs.count; i++) {
      const tw = 0.8 + 0.2 * Math.sin(t * 2.4 + i * 1.9) + 0.12 * Math.sin(t * 5.3 + i * 0.7);
      this.tmpC.copy(refs.fairyColors[i]).multiplyScalar(tw * 1.25);
      this.tmpC.lerpColors(this.offBulb, this.tmpC, this.fairyLevel);
      bulbs.setColorAt(i, this.tmpC);
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
  }

  private solveArmIK(arm: THREE.Group, forearm: THREE.Group, targetWorld: THREE.Vector3, side: -1 | 1) {
    const av = this.refs.avatar;
    const tLocal = this.tmpV.copy(targetWorld);
    av.torso.worldToLocal(tLocal);

    const shoulder = arm.position;
    const D = this.tmpV2.copy(tLocal).sub(shoulder);
    const rawLen = D.length();
    const d = Math.max(0.06, Math.min(AVATAR_L1 + AVATAR_L2 - 0.004, rawLen));
    const dir = rawLen > 1e-5 ? D.divideScalar(rawLen) : D.set(0, 0, -1);

    const cosA = Math.max(-1, Math.min(1, (AVATAR_L1 * AVATAR_L1 + d * d - AVATAR_L2 * AVATAR_L2) / (2 * AVATAR_L1 * d)));
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

    const pole = side < 0 ? IK_POLE_L : IK_POLE_R;
    const bend = this.tmpV3.copy(pole).addScaledVector(dir, -pole.dot(dir));
    if (bend.lengthSq() < 1e-6) {
      bend.copy(IK_FALLBACK).addScaledVector(dir, -IK_FALLBACK.dot(dir));
      if (bend.lengthSq() < 1e-6) bend.set(side, 0, 0);
    }
    bend.normalize();

    const elbowRel = this.tmpV4.copy(dir).multiplyScalar(AVATAR_L1 * cosA).addScaledVector(bend, AVATAR_L1 * sinA);
    const u1 = this.tmpV5.copy(elbowRel).normalize();
    arm.quaternion.setFromUnitVectors(NEG_Z, u1);

    const u2Torso = elbowRel.negate().addScaledVector(dir, d).normalize();
    u2Torso.applyQuaternion(this.tmpQ.copy(arm.quaternion).invert());
    forearm.quaternion.setFromUnitVectors(NEG_Z, u2Torso);
  }

  private solveBikeLeg(thigh: THREE.Group, shin: THREE.Group, pedalZ: number, pedalY: number) {
    const L1 = 0.3;
    const L2 = 0.49;
    const dz = pedalZ - 0.18;
    const dy = pedalY + 0.035 - 0.87;
    const d = Math.max(0.21, Math.min(L1 + L2 - 0.005, Math.hypot(dz, dy)));
    const phi = Math.atan2(-dz, -dy);
    const alpha = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const thighX = phi + alpha;
    const kz = -L1 * Math.sin(thighX);
    const ky = -L1 * Math.cos(thighX);
    const shinWorld = Math.atan2(-(dz - kz), -(dy - ky));
    thigh.rotation.set(thighX, 0, 0);
    shin.rotation.set(shinWorld - thighX, 0, 0);
  }

  private impulseYarn(dx: number, dz: number, power: number) {
    const len = Math.hypot(dx, dz) || 1;
    this.yarnVel.set((dx / len) * power, (dz / len) * power);
    this.cb.onToySfx?.("yarn");
  }

  private updateCatToys(dt: number, t: number) {
    const { toys } = this.refs;

    /* Rolling yarn ball with wall & furniture bounces */
    const yPos = toys.yarn.position;
    const r = 0.068;
    const speed = this.yarnVel.length();
    if (speed > 0.01) {
      const nextX = yPos.x + this.yarnVel.x * dt;
      if (nextX < ROOM.minX + r || nextX > ROOM.maxX - r) {
        this.yarnVel.x *= -0.65;
      } else {
        yPos.x = nextX;
      }
      const nextZ = yPos.z + this.yarnVel.y * dt;
      if (nextZ < ROOM.minZ + r || nextZ > ROOM.maxZ - r) {
        this.yarnVel.y *= -0.65;
      } else {
        yPos.z = nextZ;
      }
      for (const c of COLLIDERS) {
        const pad = 0.075;
        if (yPos.x > c.minX - pad && yPos.x < c.maxX + pad && yPos.z > c.minZ - pad && yPos.z < c.maxZ + pad) {
          const dLeft = Math.abs(yPos.x - (c.minX - pad));
          const dRight = Math.abs(c.maxX + pad - yPos.x);
          const dBack = Math.abs(yPos.z - (c.minZ - pad));
          const dFront = Math.abs(c.maxZ + pad - yPos.z);
          const m = Math.min(dLeft, dRight, dBack, dFront);
          if (m === dLeft) {
            yPos.x = c.minX - pad;
            this.yarnVel.x = -Math.abs(this.yarnVel.x) * 0.6;
          } else if (m === dRight) {
            yPos.x = c.maxX + pad;
            this.yarnVel.x = Math.abs(this.yarnVel.x) * 0.6;
          } else if (m === dBack) {
            yPos.z = c.minZ - pad;
            this.yarnVel.y = -Math.abs(this.yarnVel.y) * 0.6;
          } else {
            yPos.z = c.maxZ + pad;
            this.yarnVel.y = Math.abs(this.yarnVel.y) * 0.6;
          }
        }
      }
      const dist = speed * dt;
      const axis = this.tmpV.set(this.yarnVel.y / speed, 0, -this.yarnVel.x / speed);
      toys.yarn.rotateOnWorldAxis(axis, dist / 0.066);
      this.yarnVel.multiplyScalar(Math.exp(-2.1 * dt));
    } else {
      this.yarnVel.set(0, 0);
    }

    /* Feather wand animation */
    if (this.wandTimer > 0) {
      this.wandTimer = Math.max(0, this.wandTimer - dt);
      toys.wandPole.rotation.set(
        0.52 + Math.sin(t * 7.2) * 0.24,
        0.3 + Math.sin(t * 4.5) * 0.65,
        -0.18 + Math.cos(t * 5.8) * 0.22,
      );
      toys.wandFeathers.rotation.set(Math.sin(t * 11) * 0.35, t * 2.5, Math.cos(t * 9.5) * 0.35);
    } else {
      toys.wandPole.rotation.x = approach(toys.wandPole.rotation.x, 0.26, 7, dt);
      toys.wandPole.rotation.y = approach(toys.wandPole.rotation.y, 0.3, 7, dt);
      toys.wandPole.rotation.z = approach(toys.wandPole.rotation.z, -0.18, 7, dt);
      toys.wandFeathers.rotation.x = Math.sin(t * 1.4) * 0.06;
      toys.wandFeathers.rotation.z = Math.cos(t * 1.1) * 0.05;
    }
    toys.wandFeathers.getWorldPosition(this.wandTipWorld);

    /* Hanging pom-pom pendulum on scratching post */
    const acc = -26 * Math.sin(this.pomAngle) - 2.4 * this.pomVel;
    this.pomVel += acc * dt;
    this.pomAngle += this.pomVel * dt;
    toys.pomPivot.rotation.set(
      Math.sin(t * 2.4) * Math.min(0.24, Math.abs(this.pomAngle) * 0.35),
      0,
      this.pomAngle,
    );

    /* Cardboard box rustle */
    if (this.boxRustle > 0) {
      this.boxRustle = Math.max(0, this.boxRustle - dt * 2.4);
      toys.catBox.rotation.z = Math.sin(t * 36) * 0.045 * this.boxRustle;
    } else {
      toys.catBox.rotation.z = 0;
    }

    /* Laser dot */
    if (this.laserTimer > 0) {
      this.laserTimer = Math.max(0, this.laserTimer - dt);
      if (this.laserTimer <= 0) {
        toys.laserDot.visible = false;
        this.catCtrl.notifyLaserActive(false);
      } else {
        toys.laserDot.visible = true;
        let tx = 1.05 + Math.sin(t * 2.2) * 1.15 + Math.sin(t * 5.1) * 0.25;
        let tz = 0.45 + Math.cos(t * 2.7) * 0.95;
        if (!this.resting && this.activity === "none") {
          const dir = this.tmpV.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
          if (dir.y < -0.06) {
            const k = (0.012 - this.camera.position.y) / dir.y;
            if (k > 0.2 && k < 8.5) {
              tx = this.camera.position.x + dir.x * k;
              tz = this.camera.position.z + dir.z * k;
            }
          }
        }
        tx = Math.max(ROOM.minX + 0.2, Math.min(ROOM.maxX - 0.2, tx));
        tz = Math.max(ROOM.minZ + 0.2, Math.min(ROOM.maxZ - 0.2, tz));
        this.laserPos.x = approach(this.laserPos.x, tx, 15, dt);
        this.laserPos.z = approach(this.laserPos.z, tz, 15, dt);
        toys.laserDot.position.set(this.laserPos.x, 0, this.laserPos.z);
      }
    }
  }

  private updateActivityAndAvatar(dt: number, t: number) {
    const { refs } = this;
    const av = refs.avatar;
    const musicBob = this.radioOn ? Math.sin(t * 3.7) * 0.035 : 0;

    if (!this.exercisePaused && (this.activity === "yoga" || this.activity === "weights" || this.activity === "bike")) {
      const speed = this.activity === "bike" ? 6.8 : this.activity === "weights" ? 2.4 : 1.75;
      this.exPhase += dt * speed;
    }

    if (this.sipActive) {
      this.sipT += dt / SIP_DUR;
      if (this.sipT >= 1) {
        this.sipActive = false;
        this.sipT = 0;
        this.hoverDirty = true;
      }
    }

    /* Update 3rd-person Avatar pose (free-roam or activity) */
    const deskSip3rd = this.sipActive && this.activity === "desk" && this.thirdPerson && av.root.visible;

    if (av.root.visible && this.activity === "none" && !this.resting) {
      av.root.position.copy(this.playerPos);
      av.root.rotation.y = this.avatarYaw;
      av.pen.visible = false;
      av.dumbbellL.visible = av.dumbbellR.visible = false;
      av.torso.scale.y = 1 + Math.sin(t * 1.5) * 0.012;

      const stride = Math.min(1, this.moveSpeed / 2.6);
      const sw = Math.sin(this.walkPhase) * stride;
      const cr = this.crouchK;
      const hop = this.grounded ? 0 : 0.25;

      av.hips.position.set(0, 0.83 - cr * 0.24 - this.landDip * 0.4, 0);
      av.thighL.rotation.set(sw * 0.55 + cr * 0.88 + hop, 0, 0);
      av.thighR.rotation.set(-sw * 0.55 + cr * 0.88 + hop, 0, 0);
      av.shinL.rotation.set(-Math.max(0, -sw) * 0.45 - cr * 1.38 - hop * 1.4, 0, 0);
      av.shinR.rotation.set(-Math.max(0, sw) * 0.45 - cr * 1.38 - hop * 1.4, 0, 0);

      av.torso.position.set(0, 0.03, 0.01);
      av.torso.rotation.set(-0.04 - stride * 0.08 - cr * 0.22, 0, 0);
      av.head.rotation.set(0.04 + musicBob + cr * 0.14, Math.sin(t * 0.5) * 0.04, 0);
      av.hips.updateMatrixWorld(true);

      const armSwing = sw * 0.18;
      const handY = 0.72 - cr * 0.16;
      av.root.localToWorld(this.ikTarget.set(-0.22, handY, -0.04 - armSwing));
      this.solveArmIK(av.leftArm, av.leftForearm, this.ikTarget, -1);
      av.root.localToWorld(this.ikTarget.set(0.22, handY, -0.04 + armSwing));
      this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
    } else if (av.root.visible && this.activity !== "none") {
      av.pen.visible = this.activity === "desk";
      av.dumbbellL.visible = av.dumbbellR.visible = this.activity === "weights";
      av.torso.scale.y = 1 + Math.sin(t * 1.5) * 0.014;

      if (this.activity === "desk") {
        av.hips.position.set(0, 0.59, 0.01);
        av.thighL.rotation.set(1.5, 0, 0);
        av.thighR.rotation.set(1.5, 0, 0);
        av.shinL.rotation.set(-1.5, 0, 0);
        av.shinR.rotation.set(-1.5, 0, 0);
        if (!deskSip3rd) {
          av.torso.position.set(0, 0.03, 0.01);
          av.torso.rotation.set(-0.14, 0, 0);
          av.head.rotation.set(0.28 + Math.sin(t * 0.65) * 0.04 + musicBob, Math.sin(t * 0.35) * 0.08, 0);
          av.hips.updateMatrixWorld(true);
          this.solveArmIK(av.leftArm, av.leftForearm, this.ikTarget.set(AVATAR_IDLE_HAND.x, AVATAR_IDLE_HAND.y + Math.sin(t * 0.8) * 0.005, AVATAR_IDLE_HAND.z), -1);
          av.root.localToWorld(this.ikTarget.set(0.1 + Math.sin(t * 3.4) * 0.015, 0.818, -0.44 + Math.cos(t * 5.2) * 0.018));
          this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
        }
      } else if (this.activity === "pouf") {
        av.hips.position.set(0, 0.5, 0.01);
        av.thighL.rotation.set(1.72, -0.1, 0);
        av.thighR.rotation.set(1.72, 0.1, 0);
        av.shinL.rotation.set(-1.55, 0, 0);
        av.shinR.rotation.set(-1.55, 0, 0);
        av.torso.position.set(0, 0.03, 0.01);
        av.torso.rotation.set(this.poufReading ? -0.18 : -0.08, 0, 0);
        av.head.rotation.set((this.poufReading ? 0.3 : 0.1) + Math.sin(t * 0.7) * 0.03 + musicBob, Math.sin(t * 0.4) * 0.07, 0);
        av.hips.updateMatrixWorld(true);
        if (this.poufReading) {
          av.root.localToWorld(this.ikTarget.set(-0.155, 0.675, -0.395));
          this.solveArmIK(av.leftArm, av.leftForearm, this.ikTarget, -1);
          av.root.localToWorld(this.ikTarget.set(0.155, 0.675, -0.395));
          this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
        } else {
          av.root.localToWorld(this.ikTarget.set(-0.14, 0.57, -0.24));
          this.solveArmIK(av.leftArm, av.leftForearm, this.ikTarget, -1);
          av.root.localToWorld(this.ikTarget.set(0.14, 0.57, -0.24));
          this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
        }
      } else if (this.activity === "yoga") {
        const squat = 0.5 - 0.5 * Math.cos(this.exPhase);
        const reachUp = Math.max(0, Math.sin(this.exPhase * 0.5));
        av.hips.position.set(0, 0.83 - squat * 0.16, 0);
        av.thighL.rotation.set(squat * 0.92, 0, 0);
        av.thighR.rotation.set(squat * 0.92, 0, 0);
        av.shinL.rotation.set(-squat * 1.42, 0, 0);
        av.shinR.rotation.set(-squat * 1.42, 0, 0);
        av.torso.position.set(0, 0.03, 0.01);
        av.torso.rotation.set(-0.08 - squat * 0.22, 0, 0);
        av.head.rotation.set(0.05 - reachUp * 0.12 + musicBob, Math.sin(t * 0.5) * 0.05, 0);
        av.hips.updateMatrixWorld(true);
        const handY = 0.88 + reachUp * 0.66 - squat * 0.12;
        const handZ = -0.14 - Math.sin(reachUp * Math.PI) * 0.14;
        const handX = 0.21 - reachUp * 0.05;
        av.root.localToWorld(this.ikTarget.set(-handX, handY, handZ));
        this.solveArmIK(av.leftArm, av.leftForearm, this.ikTarget, -1);
        av.root.localToWorld(this.ikTarget.set(handX, handY, handZ));
        this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
      } else if (this.activity === "weights") {
        av.hips.position.set(0, 0.83, 0);
        av.thighL.rotation.set(0.15, 0, 0);
        av.thighR.rotation.set(0.15, 0, 0);
        av.shinL.rotation.set(-0.25, 0, 0);
        av.shinR.rotation.set(-0.25, 0, 0);
        av.torso.position.set(0, 0.03, 0.01);
        av.torso.rotation.set(-0.05, Math.sin(this.exPhase) * 0.05, 0);
        av.head.rotation.set(0.06 + musicBob, Math.sin(this.exPhase * 0.5) * 0.04, 0);
        av.hips.updateMatrixWorld(true);
        const cL = 0.5 - 0.5 * Math.cos(this.exPhase);
        const cR = 0.5 - 0.5 * Math.cos(this.exPhase + Math.PI);
        av.root.localToWorld(this.ikTarget.set(-0.22, 0.84 + cL * 0.48, -0.12 - Math.sin(cL * Math.PI) * 0.14));
        this.solveArmIK(av.leftArm, av.leftForearm, this.ikTarget, -1);
        av.root.localToWorld(this.ikTarget.set(0.22, 0.84 + cR * 0.48, -0.12 - Math.sin(cR * Math.PI) * 0.14));
        this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
      } else if (this.activity === "bike") {
        av.hips.position.set(0, 0.87, 0.2);
        const crankAng = -this.exPhase;
        const pLy = 0.34 + 0.14 * Math.cos(crankAng);
        const pLz = 0.08 + 0.14 * Math.sin(crankAng);
        const pRy = 0.34 - 0.14 * Math.cos(crankAng);
        const pRz = 0.08 - 0.14 * Math.sin(crankAng);
        this.solveBikeLeg(av.thighL, av.shinL, pLz, pLy);
        this.solveBikeLeg(av.thighR, av.shinR, pRz, pRy);
        av.torso.position.set(0, 0.03, 0.01);
        av.torso.rotation.set(-0.36, 0, Math.sin(this.exPhase) * 0.03);
        av.head.rotation.set(0.28 + musicBob, Math.sin(t * 0.5) * 0.04, 0);
        av.hips.updateMatrixWorld(true);
        av.root.localToWorld(this.ikTarget.set(-0.19, 0.97, -0.25));
        this.solveArmIK(av.leftArm, av.leftForearm, this.ikTarget, -1);
        av.root.localToWorld(this.ikTarget.set(0.19, 0.97, -0.25));
        this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
      }
    }

    /* Spin bike flywheel & crank motion */
    if (this.activity === "bike") {
      refs.bike.crank.rotation.x = -this.exPhase;
      refs.bike.flywheel.rotation.x = -this.exPhase * 2.4;
    }

    /* Mug resting / sipping */
    if (!this.sipActive) {
      refs.mug.position.copy(this.mugHomePos);
      refs.mug.quaternion.copy(this.mugHomeQuat);
      return;
    }

    const p = this.sipT;
    const mugWorldPos = this.tmpV6;
    const mugWorldQuat = this.tmpQ3;

    if (deskSip3rd) {
      let reach = 0;
      if (p < 0.22) reach = ease.inOut(p / 0.22);
      else if (p < 0.48) reach = 1 - ease.inOut((p - 0.22) / 0.26);
      else if (p < 0.66) reach = 0;
      else if (p < 0.88) reach = ease.inOut((p - 0.66) / 0.22);
      else reach = 1 - ease.inOut((p - 0.88) / 0.12);

      const sipLift = p >= 0.44 && p < 0.7 ? Math.sin(Math.PI * clamp01((p - 0.44) / 0.26)) : 0;
      av.torso.position.set(-0.07 * reach, 0.04, 0.01 - 0.04 * reach);
      av.torso.rotation.set(-0.14 - 0.18 * reach, -0.16 * reach, 0);
      av.head.rotation.set(0.28 + Math.sin(t * 0.65) * 0.04 + musicBob + sipLift * 0.16, Math.sin(t * 0.35) * 0.08 + reach * 0.24, 0);
      av.hips.updateMatrixWorld(true);
      av.root.localToWorld(this.ikTarget.set(0.1 + Math.sin(t * 3.4) * 0.015, 0.818, -0.44 + Math.cos(t * 5.2) * 0.018));
      this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);

      const handTarget = this.tmpV7;
      const graspHome = this.tmpV2.copy(MUG_GRASP_LOCAL).applyQuaternion(this.mugHomeQuat).add(this.mugHomeWorld);

      if (p < 0.22) {
        const u = ease.inOut(p / 0.22);
        mugWorldPos.copy(this.mugHomeWorld);
        mugWorldQuat.copy(this.mugHomeQuat);
        handTarget.lerpVectors(AVATAR_IDLE_HAND, graspHome, u);
        handTarget.y += Math.sin(Math.PI * u) * 0.04;
      } else if (p < 0.48) {
        const u = ease.inOut((p - 0.22) / 0.26);
        mugWorldPos.lerpVectors(this.mugHomeWorld, AVATAR_MUG_MOUTH, u);
        mugWorldPos.y += Math.sin(Math.PI * u) * 0.06;
        mugWorldQuat.slerpQuaternions(this.mugHomeQuat, TP_MOUTH_Q, u);
        handTarget.copy(MUG_GRASP_LOCAL).applyQuaternion(mugWorldQuat).add(mugWorldPos);
      } else if (p < 0.66) {
        const u = (p - 0.48) / 0.18;
        const tilt = Math.min(1, Math.sin(Math.PI * u) * 1.35);
        mugWorldPos.copy(AVATAR_MUG_MOUTH);
        mugWorldPos.y += Math.sin(Math.PI * u) * 0.008;
        mugWorldQuat.slerpQuaternions(TP_MOUTH_Q, TP_SIP_Q, tilt);
        handTarget.copy(MUG_GRASP_LOCAL).applyQuaternion(mugWorldQuat).add(mugWorldPos);
        if (!this.sipSoundPlayed && p >= 0.49) {
          this.sipSoundPlayed = true;
          this.cb.onMugSfx?.("sip");
        }
      } else if (p < 0.88) {
        const u = ease.inOut((p - 0.66) / 0.22);
        mugWorldPos.lerpVectors(AVATAR_MUG_MOUTH, this.mugHomeWorld, u);
        mugWorldPos.y += Math.sin(Math.PI * u) * 0.05;
        mugWorldQuat.slerpQuaternions(TP_MOUTH_Q, this.mugHomeQuat, u);
        handTarget.copy(MUG_GRASP_LOCAL).applyQuaternion(mugWorldQuat).add(mugWorldPos);
        if (!this.sipPlacePlayed && p >= 0.87) {
          this.sipPlacePlayed = true;
          this.cb.onMugSfx?.("place");
        }
      } else {
        const u = ease.inOut((p - 0.88) / 0.12);
        mugWorldPos.copy(this.mugHomeWorld);
        mugWorldQuat.copy(this.mugHomeQuat);
        handTarget.lerpVectors(graspHome, AVATAR_IDLE_HAND, u);
        handTarget.y += Math.sin(Math.PI * u) * 0.035;
      }

      if (refs.mug.parent) {
        refs.mug.parent.updateMatrixWorld();
        refs.mug.parent.worldToLocal(mugWorldPos);
      }
      refs.mug.position.copy(mugWorldPos);
      refs.mug.quaternion.copy(mugWorldQuat);
      this.solveArmIK(av.leftArm, av.leftForearm, handTarget, -1);
      return;
    }

    if (!this.resting) {
      const holdPos = this.tmpV3.copy(FP_MUG_HOLD).applyQuaternion(this.camera.quaternion).add(this.camera.position);
      const holdQuat = this.tmpQ.copy(this.camera.quaternion).multiply(FP_HOLD_Q);
      const sipPos = this.tmpV4.copy(FP_MUG_SIP).applyQuaternion(this.camera.quaternion).add(this.camera.position);
      const sipQuat = this.tmpQ2.copy(this.camera.quaternion).multiply(FP_SIP_Q);

      if (p < 0.34) {
        const u = ease.inOut(p / 0.34);
        mugWorldPos.lerpVectors(this.mugHomeWorld, holdPos, u);
        mugWorldPos.y += Math.sin(Math.PI * u) * 0.08;
        mugWorldQuat.slerpQuaternions(this.mugHomeQuat, holdQuat, u);
      } else if (p < 0.5) {
        const u = ease.inOut((p - 0.34) / 0.16);
        mugWorldPos.lerpVectors(holdPos, sipPos, u);
        mugWorldQuat.slerpQuaternions(holdQuat, sipQuat, u);
        if (!this.sipSoundPlayed && p >= 0.46) {
          this.sipSoundPlayed = true;
          this.cb.onMugSfx?.("sip");
        }
      } else if (p < 0.66) {
        const u = (p - 0.5) / 0.16;
        const extra = Math.sin(Math.PI * u) * 0.04;
        mugWorldPos.copy(sipPos);
        mugWorldPos.y += Math.sin(Math.PI * u) * 0.008;
        this.tmpQ.set(Math.sin(extra * 0.5), 0, 0, Math.cos(extra * 0.5));
        mugWorldQuat.copy(sipQuat).multiply(this.tmpQ);
        if (!this.sipSoundPlayed) {
          this.sipSoundPlayed = true;
          this.cb.onMugSfx?.("sip");
        }
      } else if (p < 0.78) {
        const u = ease.inOut((p - 0.66) / 0.12);
        mugWorldPos.lerpVectors(sipPos, holdPos, u);
        mugWorldQuat.slerpQuaternions(sipQuat, holdQuat, u);
      } else {
        const u = ease.inOut((p - 0.78) / 0.22);
        mugWorldPos.lerpVectors(holdPos, this.mugHomeWorld, u);
        mugWorldPos.y += Math.sin(Math.PI * u) * 0.06;
        mugWorldQuat.slerpQuaternions(holdQuat, this.mugHomeQuat, u);
        if (!this.sipPlacePlayed && p >= 0.97) {
          this.sipPlacePlayed = true;
          this.cb.onMugSfx?.("place");
        }
      }

      if (refs.mug.parent) {
        refs.mug.parent.updateMatrixWorld();
        refs.mug.parent.worldToLocal(mugWorldPos);
      }
      refs.mug.position.copy(mugWorldPos);
      refs.mug.quaternion.copy(mugWorldQuat);
      return;
    }

    // Resting in bed: gentle sip bob on the desk tilted toward the room
    const lift = Math.sin(Math.PI * p);
    refs.mug.position.set(this.mugHomePos.x, this.mugHomePos.y + lift * 0.1, this.mugHomePos.z);
    refs.mug.quaternion.slerpQuaternions(this.mugHomeQuat, REST_SIP_Q, Math.sin(Math.PI * p));
    if (!this.sipSoundPlayed && p >= 0.45) {
      this.sipSoundPlayed = true;
      this.cb.onMugSfx?.("sip");
    }
    if (!this.sipPlacePlayed && p >= 0.97) {
      this.sipPlacePlayed = true;
      this.cb.onMugSfx?.("place");
    }
  }

  private updateAmbient(dt: number, t: number) {
    const { refs } = this;

    /* curtains breathe in the draught */
    for (const c of refs.curtains) {
      const pos = c.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const b = c.base;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3];
        const y = b[i * 3 + 1];
        const u = x / 0.52 + 0.5;
        const hang = 1 - (y / 1.62 + 0.5); // 0 at the rod, 1 at the hem
        const fold = Math.sin(u * Math.PI * 5) * 0.035;
        const sway = Math.sin(t * 0.9 + u * 2.2 + c.phase) * 0.05 + Math.sin(t * 0.37 + c.phase * 2) * 0.035;
        pos.setXYZ(i, x + Math.sin(t * 0.6 + c.phase) * 0.018 * hang, y, fold + (sway + 0.04) * hang * hang);
      }
      pos.needsUpdate = true;
      if (this.frame % 3 === 0) c.mesh.geometry.computeVertexNormals();
    }

    /* cat toys physics & laser dot */
    this.updateCatToys(dt, t);

    /* cat */
    this.catCtrl.update(dt, t, {
      playerPos: this.playerPos,
      playerEye: this.camera.position,
      playerCrouched: this.crouched,
      resting: this.resting,
      seated: this.activity === "desk",
      poufOccupied: this.activity === "pouf",
      mouseOut: this.mouseOut,
      dark: this.cur.dark,
      yarnPos: refs.toys.yarn.position,
      yarnSpeed: this.yarnVel.length(),
      wandActive: this.wandTimer > 0,
      wandTipWorld: this.wandTipWorld,
      laserActive: this.laserTimer > 0,
      laserPos: this.laserPos,
    });

    /* activity avatar + mug sip */
    this.updateActivityAndAvatar(dt, t);

    /* steam follows the mug rim in world space */
    refs.mug.updateMatrixWorld();
    this.mugTop.set(0, 0.115, 0);
    refs.mug.localToWorld(this.mugTop);
    const firstPersonSip = this.sipActive && !this.resting && !(this.activity === "desk" && this.thirdPerson);
    const steamOpacity = firstPersonSip ? 0.07 : 0.3;
    this.steam.forEach((s, i) => {
      const k = (t * 0.3 + i / this.steam.length) % 1;
      s.position.set(
        this.mugTop.x + Math.sin(k * 6 + i * 1.7) * 0.025,
        this.mugTop.y + k * 0.36,
        this.mugTop.z + Math.cos(k * 5 + i * 2.3) * 0.025,
      );
      s.scale.setScalar(0.07 + k * 0.15);
      s.material.opacity = Math.sin(Math.PI * k) * steamOpacity;
    });

    if (this.activity === "desk" || (this.activity === "pouf" && this.poufReading)) {
      const book = this.activity === "desk" ? refs.studyBook.flipPage : refs.poufLapBook.flipPage;
      if (this.pageFlip === 0) {
        this.autoFlipTimer -= dt;
        if (this.autoFlipTimer <= 0) {
          this.flipStudyPage();
        }
      }
      if (this.pageFlip > 0) {
        this.pageFlip += dt / 0.65;
        if (this.pageFlip >= 1) {
          this.pageFlip = 0;
          book.rotation.z = 0;
          book.position.y = 0.023;
        } else {
          const k = ease.inOut(this.pageFlip);
          book.rotation.z = Math.PI * k;
          book.position.y = 0.023 + Math.sin(Math.PI * k) * 0.012;
        }
      }
    }

    /* plant */
    this.wobble = Math.max(0, this.wobble - dt * 0.9);
    for (const s of refs.plant.stems) {
      const ph = s.userData.phase as number;
      s.rotation.z = (s.userData.base as number) + Math.sin(t * 0.8 + ph) * 0.028 + Math.sin(t * 9 + ph) * 0.06 * this.wobble;
    }

    /* clock shows real local time */
    const d = new Date();
    const sec = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + sec / 60;
    const hr = (d.getHours() % 12) + min / 60;
    refs.clock.s.rotation.z = (-sec / 60) * Math.PI * 2;
    refs.clock.m.rotation.z = (-min / 60) * Math.PI * 2;
    refs.clock.h.rotation.z = (-hr / 12) * Math.PI * 2;

    /* globe */
    this.globeVel = approach(this.globeVel, 0.2, 1.1, dt);
    refs.globe.rotation.y += this.globeVel * dt;

    /* tomato timer: the cap winds with progress, and it rattles when it rings */
    const tm = this.timer;
    const prog = tm.totalMs > 0 ? 1 - clamp01(tm.remainingMs / tm.totalMs) : 0;
    this.capAngle = approach(this.capAngle, -prog * Math.PI * 2, 6, dt);
    refs.tomatoCap.rotation.y = this.capAngle + (tm.running ? Math.sin(t * Math.PI * 2) * 0.03 : 0);
    this.ring = Math.max(0, this.ring - dt);
    refs.tomato.rotation.z = Math.sin(t * 48) * 0.1 * Math.min(1, this.ring);
    refs.tomato.position.y = 0.79 + Math.abs(Math.sin(t * 24)) * 0.03 * Math.min(1, this.ring);

    /* radio bops along */
    refs.radio.rotation.z = this.radioOn ? Math.sin(t * 7.4) * 0.035 : 0;
    this.emitTimer -= dt;
    if (this.emitTimer <= 0) {
      this.emitTimer = 0.75;
      if (this.radioOn) {
        const p = refs.radio.getWorldPosition(this.tmpV2);
        p.y += 0.35;
        p.x += 0.1;
        this.emit("note", p, 1, { colors: [0xffd76a, 0xff8a65, 0xfff3d6], spread: 0.35, up: 0.55, grav: -0.1, size: 0.13, life: 2.0 });
      }
      if (this.resting) {
        const p = refs.pillow.getWorldPosition(this.tmpV2);
        p.y += 0.25;
        this.emit("z", p, 1, { colors: [0xdfe6ff, 0xb9c6ff], spread: 0.12, up: 0.42, grav: -0.05, size: 0.1, life: 2.6, grow: 0.09 });
      }
    }

    /* the sleeper under the blanket */
    const lump = refs.bedLump;
    const swell = this.restLevel;
    lump.scale.y = Math.max(0.001, 0.17 * swell * (1 + Math.sin(t * 1.25) * 0.07));
    if (!this.resting && swell < 0.02) lump.visible = false;

    /* tiny roommate */
    this.mouseTimer -= dt;
    if (this.mouseTimer <= 0) {
      this.mouseTarget = this.mouseTarget ? 0 : 1;
      this.mouseTimer = this.mouseTarget ? 2.4 : 9 + this.rand() * 9;
    }
    this.mouseOut = approach(this.mouseOut, this.mouseTarget, 7, dt);
    refs.mouse.position.z = -3.06 + this.mouseOut * 0.14;
    refs.mouse.rotation.y = Math.sin(t * 3.1) * 0.25 * this.mouseOut;

    /* shoebox glints so low camera angles are rewarded */
    this.boxGlow.material.opacity = (this.boxOpen ? 0.5 : 0.16) * (0.75 + 0.25 * Math.sin(t * 2.2));

    /* dust */
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const vel = this.dustVel;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += (vel[i] + Math.sin(t * 0.5 + i) * 0.012) * dt;
      arr[i + 1] += (vel[i + 1] + Math.sin(t * 0.7 + i * 1.3) * 0.01) * dt;
      arr[i + 2] += vel[i + 2] * dt;
      if (arr[i] < -1.2) arr[i] = 4.6;
      else if (arr[i] > 4.6) arr[i] = -1.2;
      if (arr[i + 1] < 0.2) arr[i + 1] = 2.75;
      else if (arr[i + 1] > 2.75) arr[i + 1] = 0.2;
      if (arr[i + 2] < -2.9) arr[i + 2] = -0.1;
      else if (arr[i + 2] > -0.1) arr[i + 2] = -2.9;
    }
    pos.needsUpdate = true;

    /* clouds */
    for (const c of this.clouds) {
      c.g.position.x += c.speed * dt;
      if (c.g.position.x > 17) c.g.position.x = -17;
    }
  }

  private updateFloaters(dt: number) {
    for (const f of this.floaters) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.s.visible = false;
        continue;
      }
      const k = 1 - f.life / f.max;
      f.vel.y -= f.grav * dt;
      f.vel.multiplyScalar(1 - 0.9 * dt);
      f.s.position.addScaledVector(f.vel, dt);
      const size = (f.size + f.grow * k) * Math.min(1, k * 7);
      f.s.scale.setScalar(size);
      f.s.material.opacity = Math.min(1, (1 - k) * 2.5);
    }
  }

  private updateItems(dt: number, t: number) {
    for (const it of this.items.values()) {
      if (it.id === "mug" && this.sipActive) {
        it.hover = approach(it.hover, 0, 14, dt);
        it.bounce = 0;
      } else {
        it.hover = approach(it.hover, this.hovered === it ? 1 : 0, 12, dt);
        it.bounce = Math.max(0, it.bounce - dt * 2.1);
      }
      if (it.pop > 0) {
        const b = it.bounce;
        it.scaleTarget.scale.setScalar(1 + it.pop * it.hover + Math.sin(b * Math.PI * 3) * b * 0.13);
      }
      if (it.hint) {
        if (it.id === "cat") {
          const p = this.refs.cat.root.position;
          it.anchor.set(p.x, p.y + 0.46, p.z);
        }
        const show = this.hintsOn && !this.discovered.has(it.id);
        const m = it.hint.material;
        m.opacity = approach(m.opacity, show ? 0.75 + 0.25 * Math.sin(t * 3 + it.anchor.x * 3) : 0, 6, dt);
        it.hint.visible = m.opacity > 0.02;
        if (it.hint.visible) {
          it.hint.position.set(
            it.anchor.x,
            it.anchor.y + 0.08 + Math.sin(t * 2 + it.anchor.z * 2) * 0.04,
            it.anchor.z,
          );
          it.hint.scale.setScalar(0.3 + 0.04 * Math.sin(t * 3 + it.anchor.x));
          m.rotation = Math.sin(t * 1.2 + it.anchor.x) * 0.3;
        }
      }
    }
  }

  /**
   * Keeps things smooth: if the frame rate sags for a few seconds we first lower the
   * render resolution, then make shadows cheaper. It never climbs back up, so there
   * is no visible oscillation.
   */
  private watchPerformance(raw: number) {
    if (raw > 0.25) return; // tab was hidden
    this.perfAcc += raw;
    this.perfFrames++;
    if (this.perfAcc < 1.5) return;
    const fps = this.perfFrames / this.perfAcc;
    this.perfAcc = 0;
    this.perfFrames = 0;
    if (this.time < 5) return; // ignore warm-up and the intro glide
    this.lowStreak = fps < 50 ? this.lowStreak + 1 : 0;
    if (this.lowStreak < 2) return;
    this.lowStreak = 0;
    if (this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(this.w, this.h);
    } else if (!this.shadowsLow) {
      this.shadowsLow = true;
      for (const [light, size] of [[this.sun, 1024], [this.lamp, 512]] as const) {
        light.shadow.mapSize.set(size, size);
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }
}
