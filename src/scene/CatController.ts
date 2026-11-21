import * as THREE from "three";
import { ROOM, type CatRig } from "./furniture";

export type CatSfx = "meow" | "trill" | "purr" | "hop" | "call";

export interface CatContext {
  playerPos: THREE.Vector3;
  playerEye: THREE.Vector3;
  playerCrouched: boolean;
  resting: boolean;
  seated: boolean;
  poufOccupied: boolean;
  mouseOut: number;
  dark: number;
  yarnPos: THREE.Vector3;
  yarnSpeed: number;
  wandActive: boolean;
  wandTipWorld: THREE.Vector3;
  laserActive: boolean;
  laserPos: THREE.Vector3;
}

export interface CatCallbacks {
  onSfx: (kind: CatSfx) => void;
  onEmit: (glyph: "heart" | "z" | "spark", pos: THREE.Vector3, count: number) => void;
  onBatYarn?: (dirX: number, dirZ: number, power: number) => void;
  onBatPom?: (impulse: number) => void;
  onScratchSfx?: () => void;
}

type SurfaceId = "floor" | "cushion" | "bed" | "pouf" | "chair" | "box";

type CatState =
  | "sleep_cushion"
  | "sleep_bed"
  | "sleep_perch"
  | "walk"
  | "approach"
  | "rub"
  | "jump"
  | "knead"
  | "stretch"
  | "groom"
  | "sit"
  | "stalk"
  | "play_hop"
  | "chase_yarn"
  | "play_wand"
  | "scratch"
  | "chase_laser";

interface Box2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface SurfaceSpot {
  perch: THREE.Vector3;
  takeoff: THREE.Vector3;
  yaw: number;
}

const CAT_MIN_X = ROOM.minX + 0.38;
const CAT_MAX_X = ROOM.maxX - 0.38;
const CAT_MIN_Z = ROOM.minZ + 0.38;
const CAT_MAX_Z = ROOM.maxZ - 0.38;
const CAT_MARGIN = 0.2;

const OBSTACLES: Box2D[] = [
  // Desk
  { minX: -1.2, maxX: 1.0, minZ: -2.95, maxZ: -2.05 },
  // Desk chair
  { minX: -0.52, maxX: 0.02, minZ: -1.82, maxZ: -1.28 },
  // Bed
  { minX: -2.95, maxX: -1.55, minZ: -2.95, maxZ: -0.3 },
  // Bookshelf
  { minX: 1.55, maxX: 2.85, minZ: -2.97, maxZ: -2.55 },
  // Console table
  { minX: -2.95, maxX: -2.49, minZ: 1.1, maxZ: 2.5 },
  // Monstera plant
  { minX: -2.78, maxX: -2.18, minZ: 0.2, maxZ: 0.8 },
  // Pouf
  { minX: 1.82, maxX: 2.68, minZ: 1.32, maxZ: 2.18 },
  // Scratching post
  { minX: 2.38, maxX: 2.92, minZ: -1.62, maxZ: -1.08 },
  // Spin bike
  { minX: 3.65, maxX: 4.65, minZ: -2.62, maxZ: -1.68 },
  // Dumbbell rack
  { minX: 4.45, maxX: 4.95, minZ: -0.72, maxZ: 0.02 },
  // Cozy cardboard box
  { minX: 3.16, maxX: 3.74, minZ: 2.08, maxZ: 2.62 },
];

const HUBS: [number, number][] = [
  [0.25, 0.15],
  [-0.75, 0.35],
  [0.75, -0.45],
  [0.85, 1.05],
  [2.05, -0.25],
  [3.15, 0.35],
  [3.15, -1.1],
  [2.6, 0.85],
];

const SPOTS: Record<Exclude<SurfaceId, "floor">, SurfaceSpot> = {
  cushion: {
    perch: new THREE.Vector3(1.25, 0.155, -1.2),
    takeoff: new THREE.Vector3(0.95, 0, -0.72),
    yaw: -0.55,
  },
  bed: {
    perch: new THREE.Vector3(-2.12, 0.65, -1.18),
    takeoff: new THREE.Vector3(-1.24, 0, -0.95),
    yaw: 1.0,
  },
  pouf: {
    perch: new THREE.Vector3(2.25, 0.47, 1.75),
    takeoff: new THREE.Vector3(1.62, 0, 1.45),
    yaw: -2.2,
  },
  chair: {
    perch: new THREE.Vector3(-0.25, 0.56, -1.55),
    takeoff: new THREE.Vector3(-0.76, 0, -1.32),
    yaw: 0.35,
  },
  box: {
    perch: new THREE.Vector3(3.45, 0.055, 2.35),
    takeoff: new THREE.Vector3(2.92, 0, 2.15),
    yaw: -2.2,
  },
};

const REST_BED_PERCH = new THREE.Vector3(-1.82, 0.65, -0.68);
const REST_BED_TAKEOFF = new THREE.Vector3(-1.24, 0, -0.5);
const MOUSE_SPOT = new THREE.Vector3(1.18, 0, -2.25);
const MOUSE_HOLE = new THREE.Vector3(1.27, 0.05, -2.95);
const SCRATCH_POST = new THREE.Vector3(2.65, 0, -1.35);

const FLOOR_WANDER_SPOTS: [number, number][] = [
  [0.4, 0.4],
  [-0.85, 0.65],
  [0.85, 1.3],
  [-1.1, -0.35],
  [1.45, 0.3],
  [0.2, -1.15],
  [-1.6, 1.55],
  [3.15, 0.3],
  [2.8, 1.4],
  [3.7, -0.2],
  [2.1, -0.4],
];

const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function angleDelta(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function approachAngle(cur: number, target: number, rate: number, dt: number) {
  return cur + angleDelta(cur, target) * (1 - Math.exp(-rate * dt));
}

function segmentHitsBox(ax: number, az: number, bx: number, bz: number, b: Box2D, pad: number): boolean {
  const minX = b.minX - pad;
  const maxX = b.maxX + pad;
  const minZ = b.minZ - pad;
  const maxZ = b.maxZ + pad;
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-6) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, ax - minX) &&
    clip(dx, maxX - ax) &&
    clip(-dz, az - minZ) &&
    clip(dz, maxZ - az) &&
    t0 <= t1
  );
}

function pathBlocked(ax: number, az: number, bx: number, bz: number, pad = 0.16): boolean {
  for (const b of OBSTACLES) {
    if (segmentHitsBox(ax, az, bx, bz, b, pad)) return true;
  }
  return false;
}

function insideBlocked(x: number, z: number): boolean {
  if (x < CAT_MIN_X || x > CAT_MAX_X || z < CAT_MIN_Z || z > CAT_MAX_Z) return true;
  for (const b of OBSTACLES) {
    if (x > b.minX - CAT_MARGIN && x < b.maxX + CAT_MARGIN && z > b.minZ - CAT_MARGIN && z < b.maxZ + CAT_MARGIN) {
      return true;
    }
  }
  return false;
}

export class CatController {
  private state: CatState = "sit";
  private surface: SurfaceId = "cushion";
  private stateTime = 0;
  private stateDur = 2.2;
  private yaw = -0.55;

  // Navigation & actions
  private waypoints: THREE.Vector2[] = [];
  private walkSpeed = 1.05;
  private walkOnArrive: (() => void) | null = null;
  private stuckTime = 0;
  private approachTargetSurface: SurfaceId = "floor";
  private approachStopDist = 0.5;
  private approachThen: "rub" | "sit" | "join_bed" = "rub";

  // Jump parameters
  private jumpFrom = new THREE.Vector3();
  private jumpTo = new THREE.Vector3();
  private jumpTargetYaw = 0;
  private jumpArc = 0.35;
  private jumpAirDur = 0.48;
  private jumpHopped = false;
  private jumpAfter: (() => void) | null = null;
  private targetSurfaceAfterJump: SurfaceId = "floor";

  // Rubbing state
  private rubAngle = 0;
  private rubDir = 1;
  private rubCenter = new THREE.Vector3();

  // Cooldowns & reactions
  private ownerResting = false;
  private pendingRestJoin = false;
  private lastPlayerPos = new THREE.Vector3(1.15, 0, 1.45);
  private petTimer = 0;
  private heartTimer = 0;
  private zTimer = 0;
  private sfxCooldown = 0;
  private crouchCooldown = 0;
  private stalkCooldown = 0;
  private blinkTimer = 3.2;
  private blinking = 0;
  private earTimer = 2.5;
  private earTwitch = 0;
  private callTrillTimer = -1;
  private hasGreetedStart = false;
  private greetDelay = 2.1;

  // Toy play accumulators
  private yarnBatsLeft = 0;
  private yarnBatCooldown = 0;
  private scratchSfxTimer = 0;
  private pomBattedThisScratch = false;
  private wandLeapIndex = -1;
  private toyRepathTimer = 0;

  // Animation accumulators
  private walkPhase = 0;
  private kneadPhase = 0;
  private groomPhase = 0;
  private scratchPhase = 0;
  private bodyY = 0;
  private bodyPitch = 0;
  private bodyRoll = 0;
  private headPitch = 0;
  private headYaw = 0;
  private headRoll = 0;
  private legAngles = { flX: 0, frX: 0, blX: 0, brX: 0, flZ: 0, frZ: 0 };
  private tailAngles = { p0: 0.45, p1: 0.25, p2: 0.1, y0: 0, y1: 0, y2: 0 };

  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();

  constructor(
    private rig: CatRig,
    private cb: CatCallbacks,
  ) {
    this.rig.tail[0].rotation.order = "YXZ";
    this.rig.root.position.copy(SPOTS.cushion.perch);
    this.rig.root.rotation.y = this.yaw;
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                        */
  /* ---------------------------------------------------------------- */

  pet() {
    this.petTimer = 2.6;
    this.emitHearts(4);
    this.playSfx("purr", true);
    if (this.state === "sit" || this.state === "walk" || this.state === "groom" || this.state === "stretch") {
      if (this.surface === "floor") {
        if (Math.random() < 0.28) {
          this.enterPlayHop();
        } else {
          this.beginApproach(this.lastPlayerPos, "floor", "rub");
        }
      } else {
        this.enterState("knead", 2.4);
      }
    }
  }

  callToPlayer(playerPos: THREE.Vector3, resting: boolean, activity = "none") {
    this.cb.onSfx("call");
    this.callTrillTimer = 0.24;

    if (resting) {
      this.pendingRestJoin = true;
      if (this.surface === "bed" && this.state === "sleep_bed") {
        this.emitHearts(3);
        this.enterState("knead", 2.2);
      } else if (this.state !== "jump") {
        this.routeToRestBed();
      }
      return;
    }

    if (activity !== "none") {
      if (this.state === "jump") return;
      const spot: [number, number] =
        activity === "desk"
          ? [0.36, -1.25]
          : activity === "pouf"
            ? [1.45, 1.25]
            : [2.95, 0.35];
      const goSide = () => {
        this.walkToFloor(spot[0], spot[1], 1.32, () => {
          this.playSfx("trill", true);
          this.emitHearts(3);
          this.enterState("sit", 5.5);
        });
      };
      if (this.surface !== "floor") {
        this.jumpOffCurrentSurface(goSide);
      } else {
        goSide();
      }
      return;
    }

    const pSurf = this.detectPlayerSurface(playerPos);
    if (this.state === "jump") return;

    if (pSurf !== "floor" && pSurf === this.surface) {
      this.playSfx("trill", true);
      this.emitHearts(2);
      this.enterState("knead", 2.2);
      return;
    }

    const goApproach = () => {
      this.beginApproach(playerPos, pSurf, "rub");
    };

    if (this.surface !== "floor") {
      this.jumpOffCurrentSurface(goApproach);
    } else {
      goApproach();
    }
  }

  setOwnerResting(resting: boolean) {
    if (resting === this.ownerResting) return;
    this.ownerResting = resting;
    if (resting) {
      this.pendingRestJoin = true;
      if (this.state !== "jump") {
        this.routeToRestBed();
      }
    } else {
      this.pendingRestJoin = false;
      if (this.surface === "bed") {
        this.enterState("stretch", 2.1);
        this.playSfx("meow", true);
      }
    }
  }

  notifyYarnRolled() {
    if (this.ownerResting || this.state === "jump") return;
    this.yarnBatsLeft = 2 + Math.floor(Math.random() * 2);
    this.yarnBatCooldown = 0;
    this.toyRepathTimer = 0;
    const go = () => {
      this.playSfx("trill");
      this.enterState("chase_yarn", 9.5);
    };
    if (this.surface !== "floor") this.jumpOffCurrentSurface(go);
    else go();
  }

  notifyWandWaved() {
    if (this.ownerResting || this.state === "jump") return;
    this.wandLeapIndex = -1;
    const go = () => {
      this.playSfx("trill");
      this.walkToFloor(1.62, -1.28, 1.45, () => {
        this.wandLeapIndex = -1;
        this.enterState("play_wand", 7.2);
      });
    };
    if (this.surface !== "floor") this.jumpOffCurrentSurface(go);
    else go();
  }

  notifyPomBatted() {
    if (this.ownerResting || this.state === "jump") return;
    const go = () => {
      this.walkToFloor(2.18, -1.12, 1.35, () => {
        this.scratchSfxTimer = 0.15;
        this.pomBattedThisScratch = false;
        this.enterState("scratch", 3.6);
      });
    };
    if (this.surface !== "floor") this.jumpOffCurrentSurface(go);
    else go();
  }

  notifyCatBox() {
    if (this.ownerResting || this.state === "jump") return;
    if (this.surface === "box") {
      this.playSfx("trill", true);
      this.emitHearts(2);
      this.enterState("knead", 2.0);
      return;
    }
    const go = () => {
      this.walkToFloor(SPOTS.box.takeoff.x, SPOTS.box.takeoff.z, 1.25, () => {
        this.jumpToSurface("box", () => {
          this.playSfx("trill");
          this.emitHearts(2);
          this.enterState("knead", 2.2);
        });
      });
    };
    if (this.surface !== "floor") this.jumpOffCurrentSurface(go);
    else go();
  }

  notifyLaserActive(on: boolean) {
    if (on) {
      if (this.ownerResting || this.state === "jump") return;
      this.toyRepathTimer = 0;
      const go = () => {
        this.playSfx("trill");
        this.enterState("chase_laser", 13);
      };
      if (this.surface !== "floor") this.jumpOffCurrentSurface(go);
      else go();
    } else if (this.state === "chase_laser") {
      this.rig.root.position.y = 0;
      this.enterState("sit", 2.0);
    }
  }

  hoverLabel(): string {
    if (this.surface === "box" && this.state === "sleep_perch") return "Pet Miso · cozy in the box";
    switch (this.state) {
      case "sleep_cushion":
      case "sleep_bed":
      case "sleep_perch":
        return "Pet Miso · sleeping";
      case "rub":
        return "Pet Miso · rubbing your leg";
      case "knead":
        return "Pet Miso · making biscuits";
      case "stretch":
        return "Pet Miso · stretching";
      case "groom":
        return "Pet Miso · grooming";
      case "stalk":
        return "Pet Miso · stalking…";
      case "chase_yarn":
        return "Pet Miso · chasing yarn";
      case "play_wand":
        return "Pet Miso · batting feathers";
      case "scratch":
        return "Pet Miso · scratching post";
      case "chase_laser":
        return "Pet Miso · chasing laser!";
      case "jump":
      case "play_hop":
        return "Pet Miso · jumping";
      case "approach":
        return "Pet Miso · coming over";
      default:
        return "Pet Miso";
    }
  }

  headWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return this.rig.head.getWorldPosition(out).add(this.tmpV2.set(0, 0.14, 0));
  }

  /* ---------------------------------------------------------------- */
  /* Frame update                                                      */
  /* ---------------------------------------------------------------- */

  update(dt: number, t: number, ctx: CatContext) {
    this.lastPlayerPos.copy(ctx.playerPos);
    this.stateTime += dt;
    this.petTimer = Math.max(0, this.petTimer - dt);
    this.sfxCooldown = Math.max(0, this.sfxCooldown - dt);
    this.crouchCooldown = Math.max(0, this.crouchCooldown - dt);
    this.stalkCooldown = Math.max(0, this.stalkCooldown - dt);

    if (this.callTrillTimer > 0) {
      this.callTrillTimer -= dt;
      if (this.callTrillTimer <= 0) {
        this.callTrillTimer = -1;
        this.playSfx("trill", true);
      }
    }

    if (ctx.seated && this.surface === "chair" && this.state !== "jump") {
      this.jumpOffCurrentSurface(() => this.chooseNextFloorAction(ctx));
    }
    if (ctx.poufOccupied && this.surface === "pouf" && this.state !== "jump") {
      this.jumpOffCurrentSurface(() => this.chooseNextFloorAction(ctx));
    }

    // Initial friendly greeting shortly after entering the room
    if (!this.hasGreetedStart && !ctx.resting && !ctx.seated) {
      this.greetDelay -= dt;
      if (this.greetDelay <= 0) {
        this.hasGreetedStart = true;
        if (this.surface === "cushion" && this.state === "sit") {
          this.jumpOffCurrentSurface(() => this.beginApproach(ctx.playerPos, "floor", "rub"));
        }
      }
    }

    // Keep rub center gently updated
    if (this.state === "approach" && this.approachThen === "rub") {
      const pSurf = this.detectPlayerSurface(ctx.playerPos);
      this.approachTargetSurface = pSurf;
      const targetSpot = pSurf === "floor" ? ctx.playerPos : SPOTS[pSurf].takeoff;
      const last = this.waypoints[this.waypoints.length - 1];
      if (!last || Math.hypot(last.x - targetSpot.x, last.y - targetSpot.z) > 0.35) {
        this.planFloorPath(targetSpot.x, targetSpot.z);
      }
    }

    // Notice player crouching nearby
    if (
      ctx.playerCrouched &&
      !ctx.resting &&
      this.crouchCooldown <= 0 &&
      this.surface === "floor" &&
      (this.state === "sit" || this.state === "walk" || this.state === "groom")
    ) {
      const dist = Math.hypot(
        ctx.playerPos.x - this.rig.root.position.x,
        ctx.playerPos.z - this.rig.root.position.z,
      );
      if (dist < 2.1 && dist > 0.55) {
        this.crouchCooldown = 9;
        this.playSfx("trill");
        this.beginApproach(ctx.playerPos, "floor", "rub");
      }
    }

    // Notice the mouse peeking out
    if (
      ctx.mouseOut > 0.4 &&
      !ctx.resting &&
      this.stalkCooldown <= 0 &&
      this.surface === "floor" &&
      (this.state === "sit" || this.state === "walk")
    ) {
      this.stalkCooldown = 18;
      this.walkToFloor(MOUSE_SPOT.x, MOUSE_SPOT.z, 1.15, () => {
        this.enterState("stalk", 3.2);
      });
    }

    // Pet hearts
    if (this.petTimer > 0) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = 0.55;
        this.emitHearts(1);
      }
    }

    // State machine tick
    this.tickState(dt, t, ctx);

    // Procedural rig pose & breathing
    this.animateRig(dt, t, ctx);
  }

  /* ---------------------------------------------------------------- */
  /* State Transitions & Behavior                                      */
  /* ---------------------------------------------------------------- */

  private enterState(next: CatState, dur = 3) {
    this.state = next;
    this.stateTime = 0;
    this.stateDur = dur;
    this.stuckTime = 0;
  }

  private tickState(dt: number, _t: number, ctx: CatContext) {
    const pos = this.rig.root.position;

    switch (this.state) {
      case "walk": {
        this.walkPhase += dt * this.walkSpeed * 7.5;
        if (this.advanceAlongWaypoints(dt, this.walkSpeed)) {
          const cb = this.walkOnArrive;
          this.walkOnArrive = null;
          if (cb) cb();
          else this.enterState("sit", 2.2 + Math.random() * 2.5);
        }
        break;
      }

      case "approach": {
        this.walkPhase += dt * 1.28 * 7.5;
        const pSurf = this.approachTargetSurface;
        const goal = pSurf === "floor" ? ctx.playerPos : SPOTS[pSurf].takeoff;
        const dist = Math.hypot(goal.x - pos.x, goal.z - pos.z);
        const stop = pSurf === "floor" ? this.approachStopDist : 0.22;

        if (dist <= stop) {
          this.waypoints = [];
          if (this.approachThen === "join_bed") {
            this.jumpToBedForOwner();
          } else if (pSurf !== "floor") {
            this.jumpToSurface(pSurf, () => {
              this.playSfx("trill");
              this.emitHearts(2);
              this.enterState("knead", 2.4);
            });
          } else {
            this.startRub(ctx.playerPos);
          }
          break;
        }

        if (this.advanceAlongWaypoints(dt, 1.28)) {
          // Reached last waypoint; if still slightly far, re-plan
          this.planFloorPath(goal.x, goal.z);
        }
        break;
      }

      case "rub": {
        this.walkPhase += dt * 5.2;
        this.rubCenter.x = approach(this.rubCenter.x, ctx.playerPos.x, 4, dt);
        this.rubCenter.z = approach(this.rubCenter.z, ctx.playerPos.z, 4, dt);
        const playerDist = Math.hypot(ctx.playerPos.x - pos.x, ctx.playerPos.z - pos.z);
        if (playerDist > 1.25 && !this.ownerResting) {
          this.beginApproach(ctx.playerPos, "floor", "rub");
          break;
        }

        this.rubAngle += this.rubDir * dt * 1.65;
        const r = 0.37;
        const tx = clamp(this.rubCenter.x + Math.cos(this.rubAngle) * r, CAT_MIN_X, CAT_MAX_X);
        const tz = clamp(this.rubCenter.z + Math.sin(this.rubAngle) * r, CAT_MIN_Z, CAT_MAX_Z);
        if (!insideBlocked(tx, tz)) {
          pos.x = approach(pos.x, tx, 8, dt);
          pos.z = approach(pos.z, tz, 8, dt);
        }
        const tangentYaw = -this.rubAngle + (this.rubDir > 0 ? 0 : Math.PI);
        this.yaw = approachAngle(this.yaw, tangentYaw, 10, dt);

        this.heartTimer -= dt;
        if (this.heartTimer <= 0) {
          this.heartTimer = 0.9;
          this.emitHearts(1);
        }

        if (this.stateTime >= this.stateDur) {
          this.chooseNextFloorAction(ctx);
        }
        break;
      }

      case "jump": {
        const wind = 0.24;
        const air = this.jumpAirDur;
        const land = 0.16;
        const total = wind + air + land;

        if (this.stateTime < wind) {
          this.yaw = approachAngle(this.yaw, this.jumpTargetYaw, 14, dt);
        } else if (this.stateTime < wind + air) {
          if (!this.jumpHopped) {
            this.jumpHopped = true;
            this.cb.onSfx("hop");
          }
          const k = clamp((this.stateTime - wind) / air, 0, 1);
          pos.lerpVectors(this.jumpFrom, this.jumpTo, k);
          pos.y += Math.sin(Math.PI * k) * this.jumpArc;
          this.yaw = approachAngle(this.yaw, this.jumpTargetYaw, 12, dt);
        } else if (this.stateTime < total) {
          pos.copy(this.jumpTo);
          this.yaw = this.jumpTargetYaw;
        } else {
          pos.copy(this.jumpTo);
          this.surface = this.targetSurfaceAfterJump;
          const after = this.jumpAfter;
          this.jumpAfter = null;
          if (this.pendingRestJoin && this.surface === "floor") {
            this.routeToRestBed();
          } else if (after) {
            after();
          } else {
            this.enterState("sit", 2.5);
          }
        }
        break;
      }

      case "knead": {
        this.kneadPhase += dt * 5.6;
        if (this.stateTime >= this.stateDur) {
          if (this.surface === "bed") {
            this.enterState("sleep_bed", this.ownerResting ? 9999 : 8 + Math.random() * 8);
          } else if (this.surface === "cushion") {
            this.enterState("sleep_cushion", 7 + Math.random() * 7);
          } else if (this.surface === "pouf" || this.surface === "chair" || this.surface === "box") {
            this.enterState("sleep_perch", 7 + Math.random() * 6);
          } else {
            this.chooseNextFloorAction(ctx);
          }
        }
        break;
      }

      case "sleep_cushion":
      case "sleep_bed":
      case "sleep_perch": {
        this.zTimer -= dt;
        if (this.zTimer <= 0) {
          this.zTimer = 2.6 + Math.random() * 1.6;
          this.cb.onEmit("z", this.headWorldPosition(this.tmpV), 1);
        }
        if (this.ownerResting && this.state === "sleep_bed") {
          break; // stay snuggled on your bed while you rest
        }
        if (this.stateTime >= this.stateDur) {
          this.enterState("stretch", 2.1);
        }
        break;
      }

      case "stretch": {
        if (this.stateTime >= this.stateDur) {
          if (this.surface === "floor") {
            this.chooseNextFloorAction(ctx);
          } else {
            this.jumpOffCurrentSurface(() => this.chooseNextFloorAction(ctx));
          }
        }
        break;
      }

      case "groom": {
        this.groomPhase += dt * 7.2;
        if (this.stateTime >= this.stateDur) {
          if (this.surface === "floor") {
            this.chooseNextFloorAction(ctx);
          } else {
            this.enterState("sleep_perch", 6);
          }
        }
        break;
      }

      case "stalk": {
        const toHoleYaw = Math.atan2(MOUSE_HOLE.x - pos.x, MOUSE_HOLE.z - pos.z);
        this.yaw = approachAngle(this.yaw, toHoleYaw, 9, dt);
        if (this.stateTime >= this.stateDur) {
          this.enterState("sit", 1.8);
        }
        break;
      }

      case "play_hop": {
        const k = clamp(this.stateTime / this.stateDur, 0, 1);
        pos.y = Math.sin(Math.PI * k) * 0.28;
        this.yaw += dt * 7.5;
        if (this.stateTime >= this.stateDur) {
          pos.y = 0;
          this.playSfx("trill");
          this.enterState("sit", 2.0);
        }
        break;
      }

      case "chase_yarn": {
        this.walkPhase += dt * 1.65 * 7.5;
        this.yarnBatCooldown = Math.max(0, this.yarnBatCooldown - dt);
        this.toyRepathTimer -= dt;
        const dx = ctx.yarnPos.x - pos.x;
        const dz = ctx.yarnPos.z - pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.34) {
          this.waypoints = [];
          this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), 14, dt);
          if (this.yarnBatCooldown <= 0) {
            if (this.yarnBatsLeft > 0) {
              this.yarnBatsLeft--;
              this.yarnBatCooldown = 0.65;
              const toCenterX = 1.1 - ctx.yarnPos.x;
              const toCenterZ = 0.3 - ctx.yarnPos.z;
              const baseAngle =
                Math.hypot(toCenterX, toCenterZ) > 1.8
                  ? Math.atan2(toCenterZ, toCenterX)
                  : Math.atan2(dz, dx);
              const ang = baseAngle + (Math.random() - 0.5) * 1.25;
              this.cb.onBatYarn?.(Math.cos(ang), Math.sin(ang), 2.3 + Math.random() * 0.9);
              this.playSfx("meow");
            } else {
              this.enterState("sit", 2.0);
              break;
            }
          }
        } else {
          if (this.waypoints.length === 0 || this.toyRepathTimer <= 0) {
            this.toyRepathTimer = 0.32;
            this.planFloorPath(ctx.yarnPos.x, ctx.yarnPos.z);
          }
          this.advanceAlongWaypoints(dt, 1.58);
        }

        if (this.stateTime >= this.stateDur) {
          this.chooseNextFloorAction(ctx);
        }
        break;
      }

      case "play_wand": {
        const dx = ctx.wandTipWorld.x - pos.x;
        const dz = ctx.wandTipWorld.z - pos.z;
        this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), 12, dt);

        const cycle = this.stateTime % 1.25;
        const leapIdx = Math.floor(this.stateTime / 1.25);
        if (cycle > 0.72 && cycle < 1.12) {
          if (this.wandLeapIndex !== leapIdx) {
            this.wandLeapIndex = leapIdx;
            this.cb.onSfx("hop");
          }
          pos.y = Math.sin(((cycle - 0.72) / 0.4) * Math.PI) * 0.24;
        } else {
          pos.y = 0;
        }

        if ((!ctx.wandActive && this.stateTime > 1.8) || this.stateTime >= this.stateDur) {
          pos.y = 0;
          this.chooseNextFloorAction(ctx);
        }
        break;
      }

      case "scratch": {
        this.scratchPhase += dt * 11.5;
        const toPostYaw = Math.atan2(SCRATCH_POST.x - pos.x, SCRATCH_POST.z - pos.z);
        this.yaw = approachAngle(this.yaw, toPostYaw, 11, dt);
        this.scratchSfxTimer -= dt;
        if (this.scratchSfxTimer <= 0 && this.stateTime < this.stateDur - 0.6) {
          this.scratchSfxTimer = 0.42;
          this.cb.onScratchSfx?.();
        }
        if (!this.pomBattedThisScratch && this.stateTime >= this.stateDur - 0.55) {
          this.pomBattedThisScratch = true;
          this.cb.onBatPom?.(7.2);
          this.playSfx("trill");
        }
        if (this.stateTime >= this.stateDur) {
          this.chooseNextFloorAction(ctx);
        }
        break;
      }

      case "chase_laser": {
        if (!ctx.laserActive) {
          pos.y = 0;
          this.enterState("sit", 2.0);
          break;
        }
        this.walkPhase += dt * 1.95 * 7.5;
        this.toyRepathTimer -= dt;
        const dx = ctx.laserPos.x - pos.x;
        const dz = ctx.laserPos.z - pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.28) {
          this.waypoints = [];
          this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), 15, dt);
          const hop = (this.stateTime * 2.5) % 1;
          pos.y = hop < 0.5 ? Math.sin(hop * 2 * Math.PI) * 0.14 : 0;
        } else {
          pos.y = 0;
          if (this.waypoints.length === 0 || this.toyRepathTimer <= 0) {
            this.toyRepathTimer = 0.22;
            this.planFloorPath(ctx.laserPos.x, ctx.laserPos.z);
          }
          this.advanceAlongWaypoints(dt, 1.88);
        }

        if (this.stateTime >= this.stateDur) {
          pos.y = 0;
          this.enterState("sit", 2.0);
        }
        break;
      }

      case "sit": {
        // Turn gently to watch the player when sitting
        const lookAt = this.surface === "bed" && this.ownerResting ? ctx.playerEye : ctx.playerPos;
        const targetYaw = Math.atan2(lookAt.x - pos.x, lookAt.z - pos.z);
        this.yaw = approachAngle(this.yaw, targetYaw, 3.2, dt);

        if (this.stateTime >= this.stateDur) {
          if (this.pendingRestJoin) {
            this.routeToRestBed();
          } else if (this.surface === "floor") {
            this.chooseNextFloorAction(ctx);
          } else {
            this.jumpOffCurrentSurface(() => this.chooseNextFloorAction(ctx));
          }
        }
        break;
      }
    }

    this.rig.root.rotation.y = this.yaw;
  }

  private chooseNextFloorAction(ctx: CatContext) {
    if (this.pendingRestJoin || this.ownerResting) {
      this.routeToRestBed();
      return;
    }

    const r = Math.random();
    const playerDist = Math.hypot(
      ctx.playerPos.x - this.rig.root.position.x,
      ctx.playerPos.z - this.rig.root.position.z,
    );

    // Nighttime or sleepy: slightly more likely to hop onto a cozy bed/cushion
    const napBias = ctx.dark > 0.5 ? 0.16 : 0;

    if (r < 0.2 && playerDist < 4.5 && !ctx.resting && !ctx.seated) {
      this.playSfx("trill");
      this.beginApproach(ctx.playerPos, "floor", "rub");
    } else if (r < 0.34) {
      const [wx, wz] = FLOOR_WANDER_SPOTS[Math.floor(Math.random() * FLOOR_WANDER_SPOTS.length)];
      this.walkToFloor(wx, wz, 0.95, () => {
        const after = Math.random();
        if (after < 0.4) this.enterState("groom", 3.4);
        else if (after < 0.7) this.enterState("stretch", 2.2);
        else {
          if (Math.random() < 0.4) this.playSfx("meow");
          this.enterState("sit", 2.8 + Math.random() * 2.5);
        }
      });
    } else if (r < 0.48 + napBias * 0.5) {
      // Jump onto cat cushion
      const sp = SPOTS.cushion;
      this.walkToFloor(sp.takeoff.x, sp.takeoff.z, 1.05, () => {
        this.jumpToSurface("cushion", () => this.enterState("knead", 2.4));
      });
    } else if (r < 0.6 + napBias) {
      // Jump onto player's bed
      const sp = SPOTS.bed;
      this.walkToFloor(sp.takeoff.x, sp.takeoff.z, 1.15, () => {
        this.jumpToSurface("bed", () => this.enterState("knead", 2.6));
      });
    } else if (r < 0.69 + napBias) {
      // Hop into cozy cardboard box
      const sp = SPOTS.box;
      this.walkToFloor(sp.takeoff.x, sp.takeoff.z, 1.15, () => {
        this.jumpToSurface("box", () => this.enterState("knead", 2.1));
      });
    } else if (r < 0.78 && !(ctx.seated && ctx.poufOccupied)) {
      // Jump onto pouf or chair (avoid occupied seats)
      const perch: "pouf" | "chair" =
        ctx.seated ? "pouf" : ctx.poufOccupied ? "chair" : Math.random() < 0.55 ? "pouf" : "chair";
      const sp = SPOTS[perch];
      this.walkToFloor(sp.takeoff.x, sp.takeoff.z, 1.1, () => {
        this.jumpToSurface(perch, () => this.enterState("sleep_perch", 7 + Math.random() * 6));
      });
    } else if (r < 0.87) {
      this.yarnBatsLeft = 2;
      this.yarnBatCooldown = 0;
      this.toyRepathTimer = 0;
      this.enterState("chase_yarn", 7.5);
    } else if (r < 0.94) {
      this.walkToFloor(2.18, -1.12, 1.2, () => {
        this.scratchSfxTimer = 0.2;
        this.pomBattedThisScratch = false;
        this.enterState("scratch", 3.4);
      });
    } else if (r < 0.97) {
      this.enterState("groom", 3.6);
    } else {
      this.enterState("stretch", 2.2);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Routing, Jumping & Surface Helpers                                */
  /* ---------------------------------------------------------------- */

  private routeToRestBed() {
    this.pendingRestJoin = false;
    if (this.surface === "bed") {
      this.jumpToBedForOwner();
      return;
    }
    const goToBed = () => {
      this.walkToFloor(REST_BED_TAKEOFF.x, REST_BED_TAKEOFF.z, 1.5, () => {
        this.jumpToBedForOwner();
      });
    };
    if (this.surface !== "floor") {
      this.jumpOffCurrentSurface(goToBed);
    } else {
      goToBed();
    }
  }

  private jumpToBedForOwner() {
    this.beginJump(REST_BED_PERCH, "bed", -0.35, 0.44, 0.52, () => {
      this.playSfx("trill", true);
      this.emitHearts(3);
      this.enterState("knead", 2.2);
    });
  }

  private jumpToSurface(surf: Exclude<SurfaceId, "floor">, after: () => void) {
    const sp = SPOTS[surf];
    const arc = surf === "cushion" ? 0.2 : surf === "box" ? 0.46 : 0.42;
    const dur = surf === "cushion" ? 0.36 : 0.5;
    this.beginJump(sp.perch, surf, sp.yaw, arc, dur, after);
  }

  private jumpOffCurrentSurface(after: () => void) {
    if (this.surface === "floor") {
      after();
      return;
    }
    const takeoff =
      this.surface === "bed" && this.ownerResting ? REST_BED_TAKEOFF : SPOTS[this.surface].takeoff;
    const yaw = Math.atan2(
      takeoff.x - this.rig.root.position.x,
      takeoff.z - this.rig.root.position.z,
    );
    const arc = this.surface === "cushion" ? 0.18 : this.surface === "box" ? 0.44 : 0.36;
    const dur = this.surface === "cushion" ? 0.34 : 0.46;
    this.beginJump(takeoff, "floor", yaw, arc, dur, after);
  }

  private beginJump(
    to: THREE.Vector3,
    targetSurf: SurfaceId,
    targetYaw: number,
    arc: number,
    airDur: number,
    after: () => void,
  ) {
    this.jumpFrom.copy(this.rig.root.position);
    this.jumpTo.copy(to);
    this.jumpTargetYaw = Math.atan2(to.x - this.jumpFrom.x, to.z - this.jumpFrom.z);
    this.jumpArc = arc;
    this.jumpAirDur = airDur;
    this.jumpHopped = false;
    this.targetSurfaceAfterJump = targetSurf;
    this.jumpAfter = () => {
      this.yaw = targetYaw;
      after();
    };
    this.enterState("jump", 0.24 + airDur + 0.16);
  }

  private walkToFloor(x: number, z: number, speed: number, onArrive: () => void) {
    this.walkSpeed = speed;
    this.walkOnArrive = onArrive;
    this.planFloorPath(x, z);
    this.enterState("walk", 20);
  }

  private beginApproach(targetPos: THREE.Vector3, targetSurface: SurfaceId, then: "rub" | "sit" | "join_bed") {
    this.approachTargetSurface = targetSurface;
    this.approachThen = then;
    const goal = targetSurface === "floor" ? targetPos : SPOTS[targetSurface].takeoff;
    this.planFloorPath(goal.x, goal.z);
    this.enterState("approach", 16);
  }

  private startRub(playerPos: THREE.Vector3) {
    this.rubCenter.copy(playerPos);
    const pos = this.rig.root.position;
    this.rubAngle = Math.atan2(pos.z - playerPos.z, pos.x - playerPos.x);
    this.rubDir = Math.random() < 0.5 ? 1 : -1;
    this.playSfx("purr", true);
    this.emitHearts(2);
    this.enterState("rub", 3.4 + Math.random() * 1.4);
  }

  private planFloorPath(tx: number, tz: number) {
    const gx = clamp(tx, CAT_MIN_X, CAT_MAX_X);
    const gz = clamp(tz, CAT_MIN_Z, CAT_MAX_Z);
    const cx = this.rig.root.position.x;
    const cz = this.rig.root.position.z;

    if (!pathBlocked(cx, cz, gx, gz)) {
      this.waypoints = [new THREE.Vector2(gx, gz)];
      return;
    }

    let bestHub: [number, number] | null = null;
    let bestCost = Infinity;
    for (const [hx, hz] of HUBS) {
      if (!pathBlocked(cx, cz, hx, hz) && !pathBlocked(hx, hz, gx, gz)) {
        const cost = Math.hypot(hx - cx, hz - cz) + Math.hypot(gx - hx, gz - hz);
        if (cost < bestCost) {
          bestCost = cost;
          bestHub = [hx, hz];
        }
      }
    }

    if (bestHub) {
      this.waypoints = [new THREE.Vector2(bestHub[0], bestHub[1]), new THREE.Vector2(gx, gz)];
    } else {
      this.waypoints = [new THREE.Vector2(0.25, 0.15), new THREE.Vector2(gx, gz)];
    }
  }

  private advanceAlongWaypoints(dt: number, speed: number): boolean {
    if (this.waypoints.length === 0) return true;
    const pos = this.rig.root.position;
    const wp = this.waypoints[0];
    const dx = wp.x - pos.x;
    const dz = wp.y - pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.12) {
      this.waypoints.shift();
      this.stuckTime = 0;
      return this.waypoints.length === 0;
    }

    const step = Math.min(dist, speed * dt);
    const nx = dx / dist;
    const nz = dz / dist;
    const prevX = pos.x;
    const prevZ = pos.z;

    const tryX = clamp(prevX + nx * step, CAT_MIN_X, CAT_MAX_X);
    if (!insideBlocked(tryX, prevZ)) pos.x = tryX;
    const tryZ = clamp(prevZ + nz * step, CAT_MIN_Z, CAT_MAX_Z);
    if (!insideBlocked(pos.x, tryZ)) pos.z = tryZ;

    const moved = Math.hypot(pos.x - prevX, pos.z - prevZ);
    if (moved > 0.0005) {
      const moveYaw = Math.atan2(pos.x - prevX, pos.z - prevZ);
      this.yaw = approachAngle(this.yaw, moveYaw, 11, dt);
      this.stuckTime = 0;
    } else {
      this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), 9, dt);
      this.stuckTime += dt;
      if (this.stuckTime > 1.2) {
        // Recover cleanly by jumping to the next waypoint or clearing route
        this.stuckTime = 0;
        if (this.waypoints.length > 1) {
          this.waypoints.shift();
        } else {
          this.waypoints = [];
          return true;
        }
      }
    }
    return false;
  }

  private detectPlayerSurface(p: THREE.Vector3): SurfaceId {
    if (p.y > 0.45 && p.x >= -2.95 && p.x <= -1.55 && p.z >= -2.95 && p.z <= -0.3) return "bed";
    if (p.y > 0.35 && p.x >= 1.82 && p.x <= 2.68 && p.z >= 1.32 && p.z <= 2.18) return "pouf";
    if (p.y > 0.38 && p.x >= -0.52 && p.x <= 0.02 && p.z >= -1.82 && p.z <= -1.28) return "chair";
    return "floor";
  }

  private enterPlayHop() {
    this.cb.onSfx("hop");
    this.emitHearts(3);
    this.enterState("play_hop", 0.52);
  }

  /* ---------------------------------------------------------------- */
  /* Procedural Rig Pose & Animation                                   */
  /* ---------------------------------------------------------------- */

  private animateRig(dt: number, t: number, ctx: CatContext) {
    const rig = this.rig;

    // Periodic blinks & ear twitches
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 4.2;
      this.blinking = 0.16;
    }
    this.blinking = Math.max(0, this.blinking - dt);

    this.earTimer -= dt;
    if (this.earTimer <= 0) {
      this.earTimer = 3.0 + Math.random() * 5.0;
      this.earTwitch = 0.28;
    }
    this.earTwitch = Math.max(0, this.earTwitch - dt);

    // Target pose defaults (standing neutral)
    let tBodyY = 0;
    let tBodyPitch = 0;
    let tBodyRoll = 0;
    let tHeadPitch = 0;
    let tHeadYaw = 0;
    let tHeadRoll = 0;
    let tFlX = 0;
    let tFrX = 0;
    let tBlX = 0;
    let tBrX = 0;
    let tFlZ = 0;
    let tFrZ = 0;
    let tp0 = 0.45;
    let tp1 = 0.25;
    let tp2 = 0.1;
    let ty0 = Math.sin(t * 1.4) * 0.1;
    let ty1 = Math.sin(t * 1.4 - 0.6) * 0.12;
    let ty2 = Math.sin(t * 1.4 - 1.2) * 0.14;
    let closedEyes = this.blinking > 0 || this.petTimer > 0;

    // Gentle head look-at toward player when not sleeping/grooming/stalking
    const lookTarget = ctx.playerEye;
    const dx = lookTarget.x - rig.root.position.x;
    const dz = lookTarget.z - rig.root.position.z;
    const worldAngle = Math.atan2(dx, dz);
    const relYaw = clamp(angleDelta(this.yaw, worldAngle), -0.85, 0.85);
    const dy = lookTarget.y - (rig.root.position.y + 0.25);
    const distXZ = Math.max(0.4, Math.hypot(dx, dz));
    const relPitch = clamp(-Math.atan2(dy, distXZ), -0.65, 0.35);

    switch (this.state) {
      case "walk":
      case "approach": {
        const s = Math.sin(this.walkPhase);
        tBodyY = Math.abs(Math.cos(this.walkPhase)) * 0.015;
        tBodyPitch = Math.sin(this.walkPhase * 2) * 0.03;
        tFlX = s * 0.48;
        tBrX = s * 0.48;
        tFrX = -s * 0.48;
        tBlX = -s * 0.48;
        tHeadYaw = relYaw * 0.55;
        tHeadPitch = relPitch * 0.45;
        tp0 = 0.28 + Math.sin(t * 3) * 0.06;
        tp1 = 0.22;
        tp2 = 0.25;
        break;
      }

      case "rub": {
        const s = Math.sin(this.walkPhase);
        tBodyY = -0.015 + Math.abs(Math.cos(this.walkPhase)) * 0.01;
        tBodyRoll = this.rubDir * 0.24; // lean shoulder/flank into your leg
        tFlX = s * 0.36;
        tBrX = s * 0.36;
        tFrX = -s * 0.36;
        tBlX = -s * 0.36;
        tHeadYaw = -this.rubDir * 0.45;
        tHeadPitch = -0.35;
        tHeadRoll = this.rubDir * 0.22;
        // High affectionate question-mark tail
        tp0 = 0.05;
        tp1 = -0.18;
        tp2 = -0.38;
        ty0 = Math.sin(t * 2.8) * 0.08;
        ty1 = Math.sin(t * 2.8 - 0.5) * 0.1;
        ty2 = Math.sin(t * 2.8 - 1.0) * 0.12;
        closedEyes = true;
        break;
      }

      case "jump": {
        const wind = 0.24;
        const air = this.jumpAirDur;
        if (this.stateTime < wind) {
          const w = this.stateTime / wind;
          tBodyY = -0.055;
          tBodyPitch = 0.18;
          tHeadPitch = -0.22;
          tBodyRoll = Math.sin(w * Math.PI * 6) * 0.06; // pre-jump butt wiggle!
          tFlX = -0.2;
          tFrX = -0.2;
          tBlX = 0.35;
          tBrX = 0.35;
          tp0 = 0.7;
          tp1 = 0.35;
          tp2 = 0.2;
        } else if (this.stateTime < wind + air) {
          const k = (this.stateTime - wind) / air;
          tBodyPitch = -0.45 + k * 0.85;
          tFlX = -0.58;
          tFrX = -0.58;
          tBlX = 0.65;
          tBrX = 0.65;
          tp0 = 0.65;
          tp1 = 0.35;
          tp2 = 0.2;
        } else {
          tBodyY = -0.04;
          tBodyPitch = 0.08;
        }
        break;
      }

      case "knead": {
        const k = Math.sin(this.kneadPhase);
        tBodyY = -0.045 + Math.abs(k) * 0.01;
        tBodyPitch = 0.1;
        tFlX = Math.max(0, k) * -0.42;
        tFrX = Math.max(0, -k) * -0.42;
        tBlX = 0.7;
        tBrX = 0.7;
        tHeadPitch = 0.22;
        tHeadRoll = Math.sin(this.kneadPhase * 0.5) * 0.08;
        tp0 = 0.4;
        tp1 = 0.25;
        tp2 = 0.2;
        closedEyes = true;
        break;
      }

      case "sleep_cushion":
      case "sleep_bed":
      case "sleep_perch": {
        tBodyY = -0.09;
        tBodyPitch = 0.04;
        tBodyRoll = 0.08;
        tFlX = -1.25;
        tFrX = -1.25;
        tBlX = 1.25;
        tBrX = 1.25;
        tHeadPitch = 0.32;
        tHeadYaw = 0.75;
        tHeadRoll = 0.18;
        tp0 = 1.35;
        tp1 = 0.3;
        tp2 = 0.25;
        ty0 = 1.15;
        ty1 = 0.72 + Math.sin(t * 0.7) * 0.04;
        ty2 = 0.55;
        closedEyes = true;
        break;
      }

      case "stretch": {
        const k = Math.sin(clamp(this.stateTime / this.stateDur, 0, 1) * Math.PI);
        tBodyY = -0.065 * k;
        tBodyPitch = 0.42 * k; // chest dips down, rear lifts up!
        tFlX = -0.78 * k;
        tFrX = -0.78 * k;
        tBlX = 0.15 * k;
        tBrX = 0.15 * k;
        tHeadPitch = -0.35 * k;
        tp0 = 0.05;
        tp1 = 0.1;
        tp2 = 0.35;
        closedEyes = k > 0.35;
        break;
      }

      case "groom": {
        tBodyY = -0.048;
        tBodyPitch = -0.26; // sit back on haunches
        tBlX = 1.1;
        tBrX = 1.1;
        tFlX = 0.24;
        // Lift right paw repeatedly to wash cheek/face
        const lick = Math.max(0, Math.sin(this.groomPhase));
        tFrX = -0.95 - lick * 0.35;
        tFrZ = 0.24;
        tHeadPitch = 0.28 + lick * 0.14;
        tHeadYaw = -0.28;
        tHeadRoll = 0.18 * lick;
        tp0 = 1.15;
        tp1 = 0.2;
        ty0 = 0.7;
        ty1 = 0.45;
        closedEyes = true;
        break;
      }

      case "stalk": {
        tBodyY = -0.062; // low crouch
        tBodyPitch = 0.08;
        tBodyRoll = Math.sin(t * 11) * 0.035; // tense stalk wiggle
        tFlX = -0.55;
        tFrX = -0.55;
        tBlX = 0.65;
        tBrX = 0.65;
        tHeadPitch = 0.15;
        tp0 = 1.38;
        tp1 = 0.1;
        tp2 = 0.2;
        ty0 = Math.sin(t * 4) * 0.1;
        ty1 = Math.sin(t * 6) * 0.16;
        ty2 = Math.sin(t * 8) * 0.28;
        break;
      }

      case "play_hop": {
        tBodyPitch = -0.15;
        tFlX = -0.35;
        tFrX = -0.35;
        tBlX = 0.4;
        tBrX = 0.4;
        tp0 = 0.15;
        tp1 = 0.2;
        tp2 = 0.3;
        break;
      }

      case "chase_yarn":
      case "chase_laser": {
        const s = Math.sin(this.walkPhase);
        tBodyY = Math.abs(Math.cos(this.walkPhase)) * 0.022;
        tBodyPitch = 0.06;
        tFlX = s * 0.65;
        tBrX = s * 0.65;
        tFrX = -s * 0.65;
        tBlX = -s * 0.65;
        tHeadPitch = 0.14;
        tp0 = 0.2;
        tp1 = 0.25;
        tp2 = 0.3;
        ty0 = Math.sin(t * 7) * 0.22;
        ty1 = Math.sin(t * 7 - 0.5) * 0.25;
        ty2 = Math.sin(t * 7 - 1.0) * 0.3;
        break;
      }

      case "play_wand": {
        const cycle = this.stateTime % 1.25;
        const leaping = cycle > 0.72 && cycle < 1.12;
        if (leaping) {
          tBodyPitch = -0.58;
          tFlX = -0.95 + Math.sin(t * 16) * 0.25;
          tFrX = -0.95 - Math.sin(t * 16) * 0.25;
          tBlX = 0.65;
          tBrX = 0.65;
        } else {
          tBodyY = -0.055;
          tBodyRoll = Math.sin(t * 12) * 0.05;
          tFlX = -0.45;
          tFrX = -0.45;
          tBlX = 0.55;
          tBrX = 0.55;
        }
        const tipAngle = Math.atan2(
          ctx.wandTipWorld.x - rig.root.position.x,
          ctx.wandTipWorld.z - rig.root.position.z,
        );
        tHeadYaw = clamp(angleDelta(this.yaw, tipAngle), -0.8, 0.8);
        tHeadPitch = -0.42;
        tp0 = 0.25;
        ty0 = Math.sin(t * 6) * 0.22;
        ty1 = Math.sin(t * 6 - 0.5) * 0.24;
        break;
      }

      case "scratch": {
        const swipe = Math.sin(this.scratchPhase);
        tBodyY = -0.025;
        tBodyPitch = -0.68; // rear upright against the scratching post!
        tBlX = 0.72;
        tBrX = 0.72;
        tFlX = -0.85 - Math.max(0, swipe) * 0.42;
        tFrX = -0.85 - Math.max(0, -swipe) * 0.42;
        tHeadPitch = 0.25;
        tp0 = 0.9;
        tp1 = 0.25;
        ty0 = Math.sin(t * 3.5) * 0.16;
        break;
      }

      case "sit": {
        tBodyY = -0.045;
        tBodyPitch = -0.26; // sit upright
        tBlX = 1.1;
        tBrX = 1.1;
        tFlX = 0.26;
        tFrX = 0.26;
        tHeadPitch = 0.22 + relPitch * 0.75;
        tHeadYaw = relYaw * 0.85;
        tp0 = 1.15;
        tp1 = 0.15;
        tp2 = 0.1;
        ty0 = 0.55 + Math.sin(t * 1.4) * 0.18;
        ty1 = 0.35 + Math.sin(t * 1.4 - 0.5) * 0.22;
        ty2 = 0.25 + Math.sin(t * 1.4 - 1.0) * 0.25;
        break;
      }
    }

    // Petting response layers lovingly on top of any pose
    const pet = clamp(this.petTimer / 0.5, 0, 1);
    if (pet > 0) {
      tHeadPitch -= 0.25 * pet;
      tHeadRoll += Math.sin(t * 2.5) * 0.14 * pet;
      closedEyes = true;
    }

    // Smooth joint interpolation
    const rate = this.state === "jump" ? 18 : 10;
    this.bodyY = approach(this.bodyY, tBodyY, rate, dt);
    this.bodyPitch = approach(this.bodyPitch, tBodyPitch, rate, dt);
    this.bodyRoll = approach(this.bodyRoll, tBodyRoll, rate, dt);
    this.headPitch = approach(this.headPitch, tHeadPitch, rate, dt);
    this.headYaw = approach(this.headYaw, tHeadYaw, rate, dt);
    this.headRoll = approach(this.headRoll, tHeadRoll, rate, dt);

    const l = this.legAngles;
    l.flX = approach(l.flX, tFlX, 14, dt);
    l.frX = approach(l.frX, tFrX, 14, dt);
    l.blX = approach(l.blX, tBlX, 14, dt);
    l.brX = approach(l.brX, tBrX, 14, dt);
    l.flZ = approach(l.flZ, tFlZ, 12, dt);
    l.frZ = approach(l.frZ, tFrZ, 12, dt);

    const ta = this.tailAngles;
    ta.p0 = approach(ta.p0, tp0, 10, dt);
    ta.p1 = approach(ta.p1, tp1, 10, dt);
    ta.p2 = approach(ta.p2, tp2, 10, dt);
    ta.y0 = approach(ta.y0, ty0, 10, dt);
    ta.y1 = approach(ta.y1, ty1, 10, dt);
    ta.y2 = approach(ta.y2, ty2, 10, dt);

    // Apply transforms to CatRig
    rig.body.position.y = this.bodyY;
    rig.body.rotation.set(this.bodyPitch, 0, this.bodyRoll);

    const breath =
      this.state === "sleep_cushion" || this.state === "sleep_bed" || this.state === "sleep_perch" ? 1.4 : 2.1;
    rig.torso.scale.y = 0.105 * (1 + Math.sin(t * breath) * 0.045);

    rig.legs.fl.rotation.set(l.flX, 0, l.flZ);
    rig.legs.fr.rotation.set(l.frX, 0, l.frZ);
    rig.legs.bl.rotation.set(l.blX, 0, 0);
    rig.legs.br.rotation.set(l.brX, 0, 0);

    rig.head.position.y = 0.255 + (pet > 0 ? Math.sin(t * 46) * 0.0015 : 0);
    rig.head.rotation.set(this.headPitch, this.headYaw, this.headRoll);

    rig.ears[0].rotation.x = this.earTwitch > 0 ? Math.sin(this.earTwitch * 45) * 0.3 : 0;
    rig.ears[1].rotation.x = this.earTwitch > 0 ? Math.sin(this.earTwitch * 45 + 0.4) * 0.15 : 0;

    rig.eyesOpen.visible = !closedEyes;
    rig.eyesClosed.visible = closedEyes;

    rig.tail[0].rotation.set(-ta.p0, ta.y0, 0);
    rig.tail[1].rotation.set(-ta.p1, 0, ta.y1);
    rig.tail[2].rotation.set(-ta.p2, 0, ta.y2);
  }

  private playSfx(kind: CatSfx, bypassCooldown = false) {
    if (!bypassCooldown && this.sfxCooldown > 0) return;
    if (!bypassCooldown) this.sfxCooldown = 4.5;
    this.cb.onSfx(kind);
  }

  private emitHearts(count: number) {
    this.cb.onEmit("heart", this.headWorldPosition(this.tmpV), count);
  }
}
