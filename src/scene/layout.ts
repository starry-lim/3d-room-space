import * as THREE from "three";

export type RegionId = "study" | "rooftop";
export type ActivityMode = "none" | "desk" | "pouf" | "yoga" | "weights" | "bike";

/** Room floor bounds (world X/Z). Expanded +X and +Z for fitness corner & cat toys. */
export const ROOM = { minX: -3, maxX: 5.2, minZ: -3, maxZ: 3.6 } as const;

export const ROOFTOP_ROOM = { minX: -3.4, maxX: 3.4, minZ: -3.2, maxZ: 3.2 } as const;

export const ROOFTOP_PLAYER_BOUNDS = {
  minX: ROOFTOP_ROOM.minX + 0.34,
  maxX: ROOFTOP_ROOM.maxX - 0.34,
  minZ: ROOFTOP_ROOM.minZ + 0.34,
  maxZ: ROOFTOP_ROOM.maxZ - 0.34,
} as const;

/** Window opening in the back wall (world units). The sunbeam is derived from this. */
export const WINDOW = { x0: -1.0, x1: 0.8, y0: 1.2, y1: 2.7, z: -3.0 } as const;
export const WALL_H = 3.4;
export const WALL_T = 0.22;

export const PLAYER_BOUNDS = {
  minX: ROOM.minX + 0.26,
  maxX: ROOM.maxX - 0.26,
  minZ: ROOM.minZ + 0.26,
  maxZ: ROOM.maxZ - 0.26,
} as const;

export const CAT_BOUNDS = {
  minX: ROOM.minX + 0.38,
  maxX: ROOM.maxX - 0.38,
  minZ: ROOM.minZ + 0.38,
  maxZ: ROOM.maxZ - 0.38,
} as const;

/** Player movement & camera constants. */
export const PLAYER_RADIUS = 0.24;
export const EYE_STAND = 1.55;
export const EYE_CROUCH = 0.38;
export const WALK_SPEED = 2.45;
export const RUN_SPEED = 4.6;
export const CROUCH_SPEED = 1.25;
export const JUMP_VEL = 5.0;
export const GRAVITY = 14.0;
export const STEP_UP = 0.14;
export const FOV_WALK = 68;
export const FOV_RUN = 74;
export const FOV_CROUCH = 64;
export const PITCH_LIMIT = 1.44;
export const INTERACT_RANGE = 6.8;

/** Canonical furniture and prop world positions shared across room builders, colliders, and AI. */
export const FURNITURE_POS = {
  desk: [-0.1, 0, -2.5] as const,
  chairHome: [-0.25, 0, -1.55] as const,
  chairFocus: [-0.18, 0, -1.66] as const,
  bed: [-2.25, 0, -1.625] as const,
  bookshelf: [2.2, 0, -2.76] as const,
  consoleTable: [-2.72, 0, 1.8] as const,
  plant: [-2.48, 0, 0.5] as const,
  catCushion: [-2.42, 0.075, 3.05] as const,
  catCushionPerch: [-2.42, 0.155, 3.05] as const,
  pouf: [2.25, 0, 1.75] as const,
  scratcher: [2.65, 0, -1.35] as const,
  spinBike: [4.15, 0, -2.15] as const,
  dumbbellRack: [4.68, 0, -0.35] as const,
  catBox: [3.45, 0, 2.35] as const,
  mouseHole: [1.27, 0.05, -2.95] as const,
  yarn: [0.85, 0.068, 0.72] as const,
  wand: [1.78, 0, -1.85] as const,
  yogaMat: [3.85, 0, 0.15] as const,
  todoBoard: [-2.97, 1.88, 0.72] as const,
  ladder: [3.22, 0, -2.85] as const,
} as const;

export interface Box2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Collider extends Box2D {
  topY: number;
  walkable: boolean;
  catObstacle: boolean;
}

const CUSHION_X = FURNITURE_POS.catCushion[0];
const CUSHION_Z = FURNITURE_POS.catCushion[2];

/** Single source of truth for room obstacle boxes (shared by player physics, cat pathfinding, and yarn bounce). */
export const COLLIDERS: Collider[] = [
  // Desk (-0.1, 0, -2.5), 2.2 x 0.9, top 0.79
  { minX: -1.2, maxX: 1.0, minZ: -2.95, maxZ: -2.05, topY: 0.79, walkable: true, catObstacle: true },
  // Chair (-0.25, 0, -1.55), ~0.52 x 0.52, seat ~0.56
  { minX: -0.52, maxX: 0.02, minZ: -1.82, maxZ: -1.28, topY: 0.56, walkable: true, catObstacle: true },
  // Bed (-2.25, 0, -1.625), 1.4 x 2.65, mattress top ~0.65
  { minX: -2.95, maxX: -1.55, minZ: -2.95, maxZ: -0.3, topY: 0.65, walkable: true, catObstacle: true },
  // Bookshelf (2.2, 0, -2.76), 1.3 x 0.42, height 2.3
  { minX: 1.55, maxX: 2.85, minZ: -2.97, maxZ: -2.55, topY: 2.3, walkable: false, catObstacle: true },
  // Console table (-2.72, 0, 1.8), 0.46 x 1.4, top 0.62
  { minX: -2.95, maxX: -2.49, minZ: 1.1, maxZ: 2.5, topY: 0.62, walkable: true, catObstacle: true },
  // Monstera plant (-2.48, 0, 0.5), pot radius ~0.28
  { minX: -2.78, maxX: -2.18, minZ: 0.2, maxZ: 0.8, topY: 1.4, walkable: false, catObstacle: true },
  // Cat cushion beside the console table, low walkable cushion
  {
    minX: CUSHION_X - 0.37,
    maxX: CUSHION_X + 0.37,
    minZ: CUSHION_Z - 0.37,
    maxZ: CUSHION_Z + 0.37,
    topY: 0.15,
    walkable: true,
    catObstacle: false,
  },
  // Pouf (2.25, 0, 1.75), radius ~0.44, top 0.48
  { minX: 1.82, maxX: 2.68, minZ: 1.32, maxZ: 2.18, topY: 0.48, walkable: true, catObstacle: true },
  // Scratcher post (2.65, 0, -1.35)
  { minX: 2.38, maxX: 2.92, minZ: -1.62, maxZ: -1.08, topY: 0.68, walkable: false, catObstacle: true },
  // Spin bike (4.15, 0, -2.15)
  { minX: 3.65, maxX: 4.65, minZ: -2.62, maxZ: -1.68, topY: 1.05, walkable: false, catObstacle: true },
  // Dumbbell rack (4.68, 0, -0.35)
  { minX: 4.45, maxX: 4.95, minZ: -0.72, maxZ: 0.02, topY: 0.65, walkable: false, catObstacle: true },
  // Cozy cardboard box (3.45, 0, 2.35)
  { minX: 3.16, maxX: 3.74, minZ: 2.08, maxZ: 2.62, topY: 0.28, walkable: false, catObstacle: true },
];

/** Subset of room colliders that Miso avoids when routing on the floor. */
export const CAT_OBSTACLES: Box2D[] = COLLIDERS.filter((c) => c.catObstacle);

/* ---------------- Key player/chair poses ---------------- */

export const SPAWN_POS = new THREE.Vector3(1.15, 0, 1.45);
export const SPAWN_YAW = 0.46;
export const SPAWN_PITCH = -0.1;

export const REST_POS = new THREE.Vector3(-2.28, 0.96, -2.42);
export const REST_YAW = -2.85;
export const REST_PITCH = -0.16;

export const WAKE_POS = new THREE.Vector3(-1.12, 0, -0.72);
export const WAKE_YAW = -0.95;
export const WAKE_PITCH = -0.06;

export const CHAIR_HOME_POS = new THREE.Vector3(...FURNITURE_POS.chairHome);
export const CHAIR_HOME_YAW = -0.38;
export const CHAIR_FOCUS_POS = new THREE.Vector3(...FURNITURE_POS.chairFocus);
export const CHAIR_FOCUS_YAW = 0;

export const STUDY_LADDER_RETURN_POS = new THREE.Vector3(3.15, 0, -2.05);
export const STUDY_LADDER_RETURN_YAW = Math.PI - 0.15;
export const STUDY_LADDER_RETURN_PITCH = -0.08;

export const ROOFTOP_SPAWN_POS = new THREE.Vector3(0, 0, 1.55);
export const ROOFTOP_SPAWN_YAW = 0;
export const ROOFTOP_SPAWN_PITCH = -0.1;

export const ROOFTOP_COLLIDERS: Collider[] = [
  // Telescope (-2.15, 0, -2.15)
  { minX: -2.55, maxX: -1.75, minZ: -2.55, maxZ: -1.75, topY: 1.35, walkable: false, catObstacle: false },
  // Patio game table (-1.75, 0, 0.75)
  { minX: -2.28, maxX: -1.22, minZ: 0.22, maxZ: 1.28, topY: 0.68, walkable: true, catObstacle: false },
  // Lantern boombox bench (2.1, 0, -1.75)
  { minX: 1.48, maxX: 2.72, minZ: -2.15, maxZ: -1.35, topY: 0.44, walkable: true, catObstacle: false },
  // Retro capsule machine (2.15, 0, 0.95)
  { minX: 1.78, maxX: 2.52, minZ: 0.58, maxZ: 1.32, topY: 1.35, walkable: false, catObstacle: false },
  // Rooftop hatch rim (0, 0, 2.38), low walkable frame
  { minX: -0.45, maxX: 0.45, minZ: 1.98, maxZ: 2.78, topY: 0.14, walkable: true, catObstacle: false },
  // 4 corner planter boxes
  { minX: -3.22, maxX: -2.38, minZ: -3.05, maxZ: -2.35, topY: 0.45, walkable: false, catObstacle: false },
  { minX: 2.38, maxX: 3.22, minZ: -3.05, maxZ: -2.35, topY: 0.45, walkable: false, catObstacle: false },
  { minX: -3.22, maxX: -2.38, minZ: 2.35, maxZ: 3.05, topY: 0.45, walkable: false, catObstacle: false },
  { minX: 2.38, maxX: 3.22, minZ: 2.35, maxZ: 3.05, topY: 0.45, walkable: false, catObstacle: false },
];

export interface ActivityPose {
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

export const ACTIVITIES: Record<Exclude<ActivityMode, "none">, ActivityPose> = {
  desk: {
    fpPos: new THREE.Vector3(-0.18, 1.24, -1.78),
    fpYaw: 0.04,
    fpPitch: -0.36,
    tpTarget: new THREE.Vector3(-0.24, 0.96, -1.96),
    tpYaw: 0.72,
    tpPitch: 0.3,
    tpDist: 2.35,
    avatarPos: new THREE.Vector3(...FURNITURE_POS.chairFocus),
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
    avatarPos: new THREE.Vector3(...FURNITURE_POS.pouf),
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
    avatarPos: new THREE.Vector3(...FURNITURE_POS.yogaMat),
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
    avatarPos: new THREE.Vector3(...FURNITURE_POS.yogaMat),
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
    avatarPos: new THREE.Vector3(...FURNITURE_POS.spinBike),
    avatarYaw: 2.59,
    standPos: new THREE.Vector3(3.32, 0, -1.62),
    standYaw: 2.59,
    standPitch: -0.1,
  },
};
