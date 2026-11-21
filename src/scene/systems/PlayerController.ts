import * as THREE from "three";
import {
  ACTIVITIES,
  COLLIDERS,
  CROUCH_SPEED,
  EYE_CROUCH,
  EYE_STAND,
  FOV_CROUCH,
  FOV_RUN,
  FOV_WALK,
  GRAVITY,
  INTERACT_RANGE,
  JUMP_VEL,
  PITCH_LIMIT,
  PLAYER_BOUNDS,
  PLAYER_RADIUS,
  REST_PITCH,
  REST_POS,
  REST_YAW,
  RUN_SPEED,
  SPAWN_PITCH,
  SPAWN_POS,
  SPAWN_YAW,
  STEP_UP,
  WAKE_PITCH,
  WAKE_POS,
  WAKE_YAW,
  WALK_SPEED,
  type ActivityMode,
  type Collider,
} from "../layout";
import { angleDelta, approach, approachAngle, ease, TweenList, type Tween } from "../math";
import type { InteractId } from "../room/types";

export interface MoveSfxDetail {
  running?: boolean;
  crouched?: boolean;
  strength?: number;
}

export type FocusViewMode = "none" | "stargazing" | "gacha" | "memory";

export interface ItemEntry {
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

export interface PlayerControllerDeps {
  domElement: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  tweens: TweenList;
  mobile: boolean;
  calm: boolean;
  getRoom: () => THREE.Group;
  getAvatarRoot: () => THREE.Group;
  getItems: () => Map<InteractId, ItemEntry>;
  getLabelFor: (it: ItemEntry) => string | null;
  onInteractItem: (it: ItemEntry) => void;
  onCallCat: () => void;
  onHoverChange: (label: string | null) => void;
  onLockChange?: (locked: boolean) => void;
  onMoveSfx?: (kind: "step" | "jump" | "land", detail?: MoveSfxDetail) => void;
  onStargazeClick?: (ndcX: number, ndcY: number) => void;
  onMemoryClick?: (ndcX: number, ndcY: number) => void;
}

/** Manages player movement, collision, 1st/3rd-person cameras, keyboard hotkeys, pointer drag/lock, and picking. */
export class PlayerController {
  readonly playerPos = SPAWN_POS.clone();
  yaw = SPAWN_YAW;
  pitch = SPAWN_PITCH;
  avatarYaw = SPAWN_YAW;
  crouched = false;
  grounded = true;
  moveSpeed = 0;
  walkPhase = 0;
  crouchK = 0;
  landDip = 0;

  resting = false;
  activity: ActivityMode = "none";
  poufReading = false;
  exercisePaused = false;
  thirdPerson = false;
  avatarPreview = false;
  uiOpen = false;
  hovered: ItemEntry | null = null;

  private lastStation: Exclude<ActivityMode, "none"> = "desk";
  private velY = 0;
  private crouchDownAt = 0;
  private crouchWasOn = false;
  private eyeHeight = EYE_STAND;
  private fovCur = FOV_WALK;
  private bobPhase = 0;
  private bobAmp = 0;
  private stepAcc = 0;
  private keys = new Set<string>();
  private locked = false;
  private disposed = false;

  private tpTarget = ACTIVITIES.desk.tpTarget.clone();
  private tpYaw = 0.72;
  private tpPitch = 0.3;
  private tpDist = 2.35;
  private camTween: Tween | null = null;
  private preFocus: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
  private focusView: FocusViewMode = "none";

  private dragging = false;
  private dragStart: { x: number; y: number; yaw: number; pitch: number } | null = null;
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private activePointers = new Set<number>();
  private hoverPos: { x: number; y: number } | null = null;
  private hoverDirty = false;
  private hoveredLabel: string | null = null;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private tmpV = new THREE.Vector3();

  private activeRoot: THREE.Group;
  private bounds: { minX: number; maxX: number; minZ: number; maxZ: number } = PLAYER_BOUNDS;
  private colliders: Collider[] = COLLIDERS;

  constructor(private deps: PlayerControllerDeps) {
    this.activeRoot = deps.getRoom();
    this.applyCameraPose();
  }

  attach(): void {
    const el = this.deps.domElement;
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
  }

  detach(): void {
    this.disposed = true;
    this.unlockPointer();
    const el = this.deps.domElement;
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
  }

  markHoverDirty(): void {
    this.hoverDirty = true;
  }

  setUiOpen(open: boolean): void {
    this.uiOpen = open;
    if (open) {
      this.unlockPointer();
      this.keys.clear();
    }
  }

  lockPointer(): void {
    if (this.resting || this.activity !== "none" || this.uiOpen || this.disposed) return;
    const el = this.deps.domElement;
    if (document.pointerLockElement === el || !el.requestPointerLock) return;
    try {
      const res = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (res && typeof res.catch === "function") res.catch(() => {});
    } catch {
      /* ignore if browser blocks pointer lock */
    }
  }

  unlockPointer(): void {
    if (document.pointerLockElement === this.deps.domElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        /* ignore */
      }
    }
  }

  setRestingState(on: boolean): void {
    this.resting = on;
    const avRoot = this.deps.getAvatarRoot();
    if (on) {
      this.unlockPointer();
      this.crouched = false;
      this.velY = 0;
      avRoot.visible = false;
      this.glideCameraTo(REST_POS, REST_YAW, REST_PITCH, 1.5);
    } else {
      this.crouched = false;
      this.eyeHeight = EYE_STAND;
      this.velY = 0;
      this.grounded = true;
      this.playerPos.copy(WAKE_POS);
      this.avatarYaw = WAKE_YAW;
      avRoot.visible = this.thirdPerson;
      if (this.thirdPerson) {
        avRoot.position.copy(WAKE_POS);
        avRoot.rotation.y = WAKE_YAW;
        this.glideCameraTo(this.freeRoamTpCameraPos(), WAKE_YAW, -0.25, 1.3);
      } else {
        const eyeTarget = WAKE_POS.clone().add(new THREE.Vector3(0, EYE_STAND, 0));
        this.glideCameraTo(eyeTarget, WAKE_YAW, WAKE_PITCH, 1.3);
      }
    }
  }

  setActivityState(mode: ActivityMode, reading: boolean): void {
    if (mode !== "none") this.lastStation = mode;
    this.activity = mode;
    this.poufReading = mode === "pouf" && reading;
    this.exercisePaused = false;
    this.hoverDirty = true;
    this.resetPointers();

    const avRoot = this.deps.getAvatarRoot();
    if (mode !== "none") {
      const spec = ACTIVITIES[mode];
      avRoot.position.copy(spec.avatarPos);
      avRoot.rotation.y = spec.avatarYaw;
      avRoot.visible = this.thirdPerson;
      this.tpTarget.copy(spec.tpTarget);
      this.unlockPointer();
      this.keys.clear();
      this.crouched = false;
      this.velY = 0;

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
      avRoot.visible = this.thirdPerson;
      if (this.thirdPerson) {
        avRoot.position.copy(back.standPos);
        avRoot.rotation.y = back.standYaw;
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

  setThirdPerson(on: boolean): void {
    if (this.resting || on === this.thirdPerson) return;
    this.thirdPerson = on;
    const avRoot = this.deps.getAvatarRoot();
    avRoot.visible = on;
    this.hoverDirty = true;
    if (this.activity === "none") {
      if (on) {
        this.avatarYaw = this.yaw;
        avRoot.position.copy(this.playerPos);
        avRoot.rotation.y = this.avatarYaw;
      }
      this.applyCameraPose();
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

  setAvatarPreview(on: boolean): void {
    if (on === this.avatarPreview) return;
    this.avatarPreview = on;
    if (this.activity !== "none" || this.resting) return;
    const avRoot = this.deps.getAvatarRoot();
    if (on) {
      this.unlockPointer();
      this.keys.clear();
      this.crouched = false;
      avRoot.visible = true;
      avRoot.position.copy(this.playerPos);
      avRoot.rotation.y = this.avatarYaw;
      this.tpTarget.set(this.playerPos.x, this.playerPos.y + 0.96, this.playerPos.z);
      this.tpYaw = this.avatarYaw + Math.PI + 0.28;
      this.tpPitch = 0.16;
      this.tpDist = 2.05;
      const tpPos = this.tpCameraPos();
      const o = this.tpOrientation(tpPos);
      this.glideCameraTo(tpPos, o.yaw, o.pitch, 0.55);
    } else {
      avRoot.visible = this.thirdPerson;
      this.applyCameraPose();
    }
  }

  setFocusView(mode: FocusViewMode): void {
    if (this.activity !== "none" || this.resting) return;
    if (mode === this.focusView) return;
    this.focusView = mode;
    if (mode !== "none") {
      if (!this.preFocus) {
        this.preFocus = {
          pos: this.deps.camera.position.clone(),
          yaw: this.yaw,
          pitch: this.pitch,
        };
      }
      this.unlockPointer();
      this.keys.clear();
      if (mode === "stargazing") {
        this.glideCameraTo(new THREE.Vector3(-1.85, 1.55, -1.85), -0.65, 0.68, 0.65);
      } else if (mode === "gacha") {
        // Frame full Capsule Machine as left-center hero opposite the right-hand panel
        this.glideCameraTo(new THREE.Vector3(1.12, 0.88, 1.98), -1.02, -0.14, 0.65);
      } else if (mode === "memory") {
        // Overhead view centered on the round patio game table at (-1.75, 0.65, 0.75)
        this.glideCameraTo(new THREE.Vector3(-1.75, 1.58, 0.86), 0, -1.46, 0.65);
      }
    } else if (this.preFocus) {
      const prev = this.preFocus;
      this.preFocus = null;
      this.glideCameraTo(prev.pos, prev.yaw, prev.pitch, 0.5);
    }
  }

  aimTelescope(targetYaw: number, targetPitch: number): void {
    if (this.focusView !== "stargazing") return;
    this.glideCameraTo(new THREE.Vector3(-1.85, 1.55, -1.85), targetYaw, targetPitch, 0.65);
  }

  setRegion(
    root: THREE.Group,
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    colliders: Collider[],
    spawnPos: THREE.Vector3,
    spawnYaw: number,
    spawnPitch: number,
  ): void {
    this.focusView = "none";
    this.preFocus = null;
    this.cancelCamTween();
    this.unlockPointer();
    this.keys.clear();
    this.resetPointers();
    this.crouched = false;
    this.eyeHeight = EYE_STAND;
    this.velY = 0;
    this.grounded = true;
    this.activeRoot = root;
    this.bounds = bounds;
    this.colliders = colliders;
    this.playerPos.copy(spawnPos);
    this.yaw = spawnYaw;
    this.pitch = spawnPitch;
    this.avatarYaw = spawnYaw;
    const avRoot = this.deps.getAvatarRoot();
    avRoot.position.copy(spawnPos);
    avRoot.rotation.y = spawnYaw;
    avRoot.visible = !this.resting && (this.thirdPerson || this.avatarPreview);
    this.hoverDirty = true;
    this.applyCameraPose();
  }

  resetView(spawnPos = SPAWN_POS, spawnYaw = SPAWN_YAW, spawnPitch = SPAWN_PITCH): void {
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
    this.playerPos.copy(spawnPos);
    this.avatarYaw = spawnYaw;
    if (this.thirdPerson) {
      const avRoot = this.deps.getAvatarRoot();
      avRoot.position.copy(spawnPos);
      avRoot.rotation.y = spawnYaw;
      this.yaw = spawnYaw;
      this.pitch = -0.22;
      this.glideCameraTo(this.freeRoamTpCameraPos(), spawnYaw, -0.22, 0.9);
    } else {
      const eyeTarget = spawnPos.clone().add(new THREE.Vector3(0, EYE_STAND, 0));
      this.glideCameraTo(eyeTarget, spawnYaw, spawnPitch, 0.9);
    }
  }

  pick(x: number, y: number): ItemEntry | null {
    const r = this.deps.domElement.getBoundingClientRect();
    return this.pickFromNdc(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  pickCenter(): ItemEntry | null {
    return this.pickFromNdc(0, 0);
  }

  update(dt: number, t: number, exPhase: number): void {
    const movingFwd = this.keys.has("KeyW") || this.keys.has("ArrowUp");
    const movingBack = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const movingLeft = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const movingRight = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const hasMove = movingFwd !== movingBack || movingLeft !== movingRight;
    const shiftHeld = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const running = !this.resting && this.activity === "none" && !this.uiOpen && !this.crouched && shiftHeld && hasMove;

    const targetFov =
      this.focusView === "stargazing"
        ? 46
        : this.resting || this.activity !== "none"
          ? FOV_WALK
          : running
            ? FOV_RUN
            : this.crouched
              ? FOV_CROUCH
              : FOV_WALK;
    this.fovCur = approach(this.fovCur, targetFov, 9, dt);
    const { camera } = this.deps;
    if (Math.abs(camera.fov - this.fovCur) > 0.02) {
      camera.fov = this.fovCur;
      camera.updateProjectionMatrix();
    }

    if (this.camTween) return;

    if (this.activity !== "none") {
      const spec = ACTIVITIES[this.activity];
      if (this.thirdPerson) {
        camera.position.copy(this.tpCameraPos(this.tmpV));
        camera.lookAt(this.tpTarget);
      } else {
        let bx = 0;
        let by = this.deps.calm ? 0 : Math.sin(t * 1.45) * 0.008;
        if (!this.deps.calm && !this.exercisePaused) {
          if (this.activity === "yoga") {
            const squat = 0.5 - 0.5 * Math.cos(exPhase);
            by = -squat * 0.2;
          } else if (this.activity === "weights") {
            by = Math.sin(exPhase * 2) * 0.015;
          } else if (this.activity === "bike") {
            by = Math.sin(exPhase * 2) * 0.012;
            bx = Math.cos(exPhase) * 0.008;
          }
        }
        camera.position.set(spec.fpPos.x + bx, spec.fpPos.y + by, spec.fpPos.z);
        camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      }
      return;
    }

    if (this.resting) {
      const breathe = this.deps.calm ? 0 : Math.sin(t * 1.25) * 0.012;
      camera.position.set(REST_POS.x, REST_POS.y + breathe, REST_POS.z);
      camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      return;
    }

    if (this.avatarPreview) {
      camera.position.copy(this.tpCameraPos(this.tmpV));
      camera.lookAt(this.tpTarget);
      return;
    }

    if (this.focusView !== "none") {
      if (this.focusView === "stargazing" || this.focusView === "gacha") {
        camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      }
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
    const tryX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, prevX + moveX));
    if (!this.isBlocked(tryX, prevZ, this.playerPos.y)) {
      this.playerPos.x = tryX;
    }
    const tryZ = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, prevZ + moveZ));
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
          this.deps.onMoveSfx?.("land", { strength: impact / 5.5 });
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

    const targetBob =
      this.grounded && speedActual > 0.2 && !this.deps.calm ? (running ? 0.045 : this.crouched ? 0.016 : 0.028) : 0;
    this.bobAmp = approach(this.bobAmp, targetBob, 11, dt);
    if (this.grounded && movedDist > 0.0005) {
      const freq = running ? 3.5 : this.crouched ? 3.8 : 3.2;
      this.bobPhase += movedDist * freq;
      this.stepAcc += movedDist;
      const stride = running ? 1.15 : this.crouched ? 0.72 : 0.92;
      if (this.stepAcc >= stride) {
        this.stepAcc -= stride;
        this.deps.onMoveSfx?.("step", { running, crouched: this.crouched });
      }
    } else if (!this.grounded) {
      this.stepAcc = 0;
    }

    this.applyCameraPose();
  }

  updateHover(frame: number): void {
    if (this.locked) {
      if (frame % 2) return;
      const item = this.camTween ? null : this.pickCenter();
      const label = item ? this.deps.getLabelFor(item) : null;
      if (item !== this.hovered || label !== this.hoveredLabel) {
        this.hovered = item;
        this.hoveredLabel = label;
        this.deps.onHoverChange(label);
      }
      return;
    }
    if (this.hoverPos && frame % 8 === 0) this.hoverDirty = true;
    if (!this.hoverDirty || frame % 2) return;
    this.hoverDirty = false;
    const busy = this.activePointers.size > 0 || !!this.camTween;
    const item = this.hoverPos && !busy ? this.pick(this.hoverPos.x, this.hoverPos.y) : null;
    const label = item ? this.deps.getLabelFor(item) : null;
    if (item !== this.hovered || label !== this.hoveredLabel) {
      this.hovered = item;
      this.hoveredLabel = label;
      this.deps.domElement.style.cursor = label ? "pointer" : "crosshair";
      this.deps.onHoverChange(label);
    }
  }

  private tpCameraPos(out = new THREE.Vector3()): THREE.Vector3 {
    const c = Math.cos(this.tpPitch);
    out.set(
      this.tpTarget.x + Math.sin(this.tpYaw) * c * this.tpDist,
      this.tpTarget.y + Math.sin(this.tpPitch) * this.tpDist,
      this.tpTarget.z + Math.cos(this.tpYaw) * c * this.tpDist,
    );
    out.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, out.x));
    out.y = Math.max(0.45, Math.min(3.15, out.y));
    out.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, out.z));
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
    out.x = Math.max(this.bounds.minX - 0.1, Math.min(this.bounds.maxX + 0.1, out.x));
    out.y = Math.max(0.25, Math.min(3.25, out.y));
    out.z = Math.max(this.bounds.minZ - 0.1, Math.min(this.bounds.maxZ + 0.1, out.z));
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

  private glideCameraTo(pos: THREE.Vector3, targetYaw: number, targetPitch: number, dur: number): void {
    const { camera } = this.deps;
    const p0 = camera.position.clone();
    const y0 = this.yaw;
    const dy = angleDelta(y0, targetYaw);
    const pt0 = this.pitch;
    this.steer(dur, (k) => {
      camera.position.lerpVectors(p0, pos, k);
      this.yaw = y0 + dy * k;
      this.pitch = pt0 + (targetPitch - pt0) * k;
      camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    });
  }

  private steer(dur: number, fn: (k: number) => void, e = ease.inOut): void {
    const d = this.deps.calm ? 0.001 : dur; // prefers-reduced-motion: cut straight to the destination
    this.cancelCamTween();
    const tw = this.deps.tweens.add(d, fn, e, () => {
      if (this.camTween === tw) {
        this.camTween = null;
      }
    });
    this.camTween = tw;
  }

  private cancelCamTween(): void {
    if (!this.camTween) return;
    this.deps.tweens.remove(this.camTween);
    this.camTween = null;
  }

  private applyCameraPose(): void {
    const { camera } = this.deps;
    if (this.thirdPerson) {
      const pivotY = this.playerPos.y + (this.crouched ? 0.82 : 1.18) - this.landDip * 0.6;
      camera.position.copy(this.freeRoamTpCameraPos(this.tmpV));
      camera.lookAt(this.playerPos.x, pivotY, this.playerPos.z);
      return;
    }
    const bobY = Math.sin(this.bobPhase * 2) * this.bobAmp;
    const bobX = Math.cos(this.bobPhase) * this.bobAmp * 0.55;
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    camera.position.set(
      this.playerPos.x + rightX * bobX,
      this.playerPos.y + this.eyeHeight + bobY - this.landDip,
      this.playerPos.z + rightZ * bobX,
    );
    camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private isBlocked(x: number, z: number, footY: number): boolean {
    if (x < this.bounds.minX || x > this.bounds.maxX || z < this.bounds.minZ || z > this.bounds.maxZ) {
      return true;
    }
    for (const c of this.colliders) {
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
    for (const c of this.colliders) {
      if (!c.walkable) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        if (footY >= c.topY - 0.16) {
          h = Math.max(h, c.topY);
        }
      }
    }
    return h;
  }

  private pickFromNdc(nx: number, ny: number, maxDist = INTERACT_RANGE): ItemEntry | null {
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, this.deps.camera);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObject(this.activeRoot, true);
    const avRoot = this.deps.getAvatarRoot();
    const items = this.deps.getItems();
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
        if (id) return items.get(id) ?? null;
        o = o.parent;
      }
      return null;
    }
    return null;
  }

  private resetPointers(): void {
    this.activePointers.clear();
    this.dragging = false;
    this.dragStart = null;
    this.down = null;
    if (!this.locked) {
      this.deps.domElement.style.cursor = this.hoveredLabel ? "pointer" : "crosshair";
    }
  }

  private onPointerLockChange = () => {
    const next = document.pointerLockElement === this.deps.domElement;
    if (next !== this.locked) {
      this.locked = next;
      this.hoverDirty = true;
      this.resetPointers();
      this.deps.domElement.style.cursor = next ? "none" : "crosshair";
      if (next) {
        (document.activeElement as HTMLElement | null)?.blur?.();
      } else {
        this.keys.clear();
      }
      this.deps.onLockChange?.(next);
    }
  };

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
        this.deps.onMoveSfx?.("jump");
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
      if (item) this.deps.onInteractItem(item);
      return;
    }

    if (code === "KeyF" && !e.repeat) {
      if (this.uiOpen) return;
      this.deps.onCallCat();
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
    if (!this.locked || this.disposed || this.focusView !== "none") return;
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
    if (item) this.deps.onInteractItem(item);
  };

  private onDown = (e: PointerEvent) => {
    if (this.locked) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (
      e.pointerType === "mouse" &&
      e.button === 0 &&
      !this.resting &&
      this.activity === "none" &&
      !this.uiOpen &&
      !this.avatarPreview
    ) {
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
        this.deps.domElement.setPointerCapture(e.pointerId);
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
        if (this.camTween && !this.resting && this.focusView !== "memory") this.cancelCamTween();
        this.deps.domElement.style.cursor = "grabbing";
      }
      if (this.dragging) {
        const orbiting =
          (this.activity !== "none" && this.thirdPerson) || (this.activity === "none" && this.avatarPreview);
        if (orbiting) {
          const sens = this.deps.mobile ? 0.006 : 0.0048;
          this.tpYaw = this.dragStart.yaw - dx * sens;
          this.tpPitch = Math.max(0.06, Math.min(0.95, this.dragStart.pitch + dy * sens));
          return;
        }
        if (this.focusView === "memory") return;
        const sens = this.deps.mobile ? 0.0052 : 0.0038;
        this.yaw = this.dragStart.yaw - dx * sens;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.dragStart.pitch - dy * sens));
        if (this.activity !== "none") {
          const baseYaw = ACTIVITIES[this.activity].fpYaw;
          this.yaw = baseYaw + Math.max(-1.65, Math.min(1.65, angleDelta(baseYaw, this.yaw)));
          this.pitch = Math.max(-1.05, Math.min(0.85, this.pitch));
        } else if (this.focusView === "stargazing") {
          this.pitch = Math.max(0.22, Math.min(1.38, this.pitch));
        } else if (this.focusView === "gacha") {
          this.yaw = Math.max(-1.16, Math.min(-0.88, this.yaw));
          this.pitch = Math.max(-0.24, Math.min(-0.04, this.pitch));
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
      if (this.deps.domElement.hasPointerCapture(e.pointerId)) {
        this.deps.domElement.releasePointerCapture(e.pointerId);
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
    this.deps.domElement.style.cursor = this.hoveredLabel ? "pointer" : "crosshair";
    if (!d || d.id !== e.pointerId || wasDrag) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    const slop = e.pointerType === "mouse" ? 6 : 14;
    if (moved > slop || performance.now() - d.t > 650) return;
    if (this.focusView === "stargazing" || this.focusView === "memory") {
      const r = this.deps.domElement.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (this.focusView === "stargazing") {
        this.deps.onStargazeClick?.(nx, ny);
      } else {
        this.deps.onMemoryClick?.(nx, ny);
      }
      return;
    }
    const item = this.pick(e.clientX, e.clientY);
    if (item) {
      this.deps.onInteractItem(item);
    } else if (
      e.pointerType === "mouse" &&
      !this.resting &&
      this.activity === "none" &&
      !this.uiOpen &&
      !this.avatarPreview
    ) {
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
      if (this.deps.domElement.hasPointerCapture(e.pointerId)) {
        this.deps.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignored */
    }
    this.down = null;
    this.dragStart = null;
    this.dragging = false;
    if (!this.locked) {
      this.deps.domElement.style.cursor = this.hoveredLabel ? "pointer" : "crosshair";
    }
  };

  private onLeave = () => {
    this.hoverPos = null;
    this.hoverDirty = true;
  };
}
