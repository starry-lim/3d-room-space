import * as THREE from "three";
import type { AvatarConfig, TodoItem } from "../game/data";
import { buildAvatar } from "./avatars";
import { CatController, type CatSfx } from "./CatController";
import { disposeObjectTree } from "./dispose";
import { buildRoom, type InteractId, type RooftopRefs, type RoomRefs } from "./furniture";
import { resetKit, rng } from "./kit";
import {
  CHAIR_FOCUS_POS,
  CHAIR_FOCUS_YAW,
  CHAIR_HOME_POS,
  CHAIR_HOME_YAW,
  COLLIDERS,
  FOV_WALK,
  PLAYER_BOUNDS,
  ROOFTOP_COLLIDERS,
  ROOFTOP_PLAYER_BOUNDS,
  ROOFTOP_SPAWN_PITCH,
  ROOFTOP_SPAWN_POS,
  ROOFTOP_SPAWN_YAW,
  STUDY_LADDER_RETURN_PITCH,
  STUDY_LADDER_RETURN_POS,
  STUDY_LADDER_RETURN_YAW,
  type ActivityMode,
  type RegionId,
} from "./layout";
import { approach, ease, TweenList } from "./math";
import { buildRooftop } from "./room/rooftop";
import { drawLaptopScreen, drawTodoBoard, type TimerView } from "./systems/CanvasDisplays";
import { CatToySystem, type ToySfxKind } from "./systems/CatToySystem";
import { FxSystem } from "./systems/FxSystem";
import { AvatarActivitySystem } from "./systems/AvatarActivitySystem";
import { PlayerController, type ItemEntry, type MoveSfxDetail } from "./systems/PlayerController";
import { SkyLightSystem, type SkyPhase } from "./systems/SkyLightSystem";

export type { CatSfx } from "./CatController";
export type { InteractId } from "./furniture";
export type { ActivityMode, RegionId } from "./layout";
export type { TimerView } from "./systems/CanvasDisplays";
export type { MoveSfxDetail } from "./systems/PlayerController";
export type { SkyPhase } from "./systems/SkyLightSystem";

export interface SceneEvent {
  id: InteractId;
  on?: boolean;
  phase?: SkyPhase;
  stage?: number;
  bloomed?: boolean;
  glowing?: boolean;
}

export interface SceneCallbacks {
  onInteract: (e: SceneEvent) => void;
  onHover: (label: string | null) => void;
  onLockChange?: (locked: boolean) => void;
  onMoveSfx?: (kind: "step" | "jump" | "land", detail?: MoveSfxDetail) => void;
  onCatSfx?: (kind: CatSfx) => void;
  onMugSfx?: (kind: "sip" | "place") => void;
  onToySfx?: (kind: ToySfxKind) => void;
  onReady?: () => void;
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
  ladder: { label: "Climb to rooftop", pop: 0.04, secret: true },
  hatch: { label: "Back to study room", pop: 0.04, secret: true },
  telescope: { label: "Stargazing", pop: 0.06, secret: true },
  gameTable: { label: "Memory match", pop: 0.05, secret: true },
  rhythmBox: { label: "Lo-Fi rhythm", pop: 0.05, secret: true },
  gacha: { label: "Capsule machine", pop: 0.06, secret: true },
};

/* ================================================================== */

export class StudyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private room: THREE.Group;
  private refs: RoomRefs;
  private rooftop: THREE.Group;
  private rooftopRefs: RooftopRefs;
  private region: RegionId = "study";
  private gachaSpin = 0;
  private fxGroup = new THREE.Group();
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

  // quality
  private pixelRatio: number;
  private perfAcc = 0;
  private perfFrames = 0;
  private lowStreak = 0;
  private shadowsLow = false;

  // subsystems
  private rand = rng(1234);
  private tweens = new TweenList();
  private fxSys: FxSystem;
  private skyLight: SkyLightSystem;
  private toys: CatToySystem;
  private avatarAct: AvatarActivitySystem;
  private player: PlayerController;
  private catCtrl: CatController;

  // interactive item state & ambient prop accumulators
  private items = new Map<InteractId, ItemEntry>();
  private hintsOn = false;
  private discovered = new Set<string>();
  private catName = "Miso";
  private radioOn = false;
  private radioLabel: string | null = null;
  private plantStage = 0;
  private bloomed = false;
  private boxOpen = false;
  private wobble = 0;
  private globeVel = 0.2;
  private ring = 0;
  private capAngle = 0;
  private mouseOut = 0;
  private mouseTarget = 0;
  private mouseTimer = 7;
  private emitTimer = 0;
  private stars = 0;
  private timer: TimerView = { mode: "focus", remainingMs: 25 * 60000, totalMs: 25 * 60000, running: false };
  private screenKey = "";
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpC = new THREE.Color();

  constructor(
    private container: HTMLElement,
    private cb: SceneCallbacks,
    mobile: boolean,
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
    const { rooftop, refs: rtRefs } = buildRooftop();
    rooftop.visible = false;
    this.rooftop = rooftop;
    this.rooftopRefs = rtRefs;
    this.scene.add(room, rooftop, this.fxGroup);
    room.updateMatrixWorld(true);
    rooftop.updateMatrixWorld(true);

    this.fxSys = new FxSystem(this.fxGroup, refs.mug, this.rand);
    this.skyLight = new SkyLightSystem(
      this.scene,
      this.fxGroup,
      refs,
      this.fxSys.glowTex,
      mobile,
      this.pixelRatio,
      this.rand,
    );
    this.toys = new CatToySystem(refs, (kind) => this.cb.onToySfx?.(kind));
    this.avatarAct = new AvatarActivitySystem(refs);

    this.catCtrl = new CatController(refs.cat, {
      onSfx: (kind) => this.cb.onCatSfx?.(kind),
      onEmit: (glyph, pos, count) => {
        if (glyph === "heart") {
          this.fxSys.emit("heart", pos, count, {
            colors: [0xff7a8a, 0xffa3b0],
            spread: 0.35,
            up: 0.68,
            grav: -0.2,
            size: 0.125,
            life: 1.55,
          });
        } else if (glyph === "z") {
          this.fxSys.emit("z", pos, count, {
            colors: [0xdfe6ff, 0xb9c6ff],
            spread: 0.12,
            up: 0.38,
            grav: -0.05,
            size: 0.09,
            life: 2.3,
            grow: 0.08,
          });
        } else {
          this.fxSys.emit("spark", pos, count, {
            colors: [0xffd45e, 0xfff3c0],
            spread: 0.4,
            up: 0.7,
            grav: 0.8,
            size: 0.1,
            life: 1.2,
          });
        }
      },
      onBatYarn: (dx, dz, power) => this.toys.impulseYarn(dx, dz, power),
      onBatPom: (imp) => this.toys.batPom(imp),
      onScratchSfx: () => this.cb.onToySfx?.("scratch"),
    });

    this.player = new PlayerController({
      domElement: renderer.domElement,
      camera: this.camera,
      tweens: this.tweens,
      mobile,
      calm: this.calm,
      getRoom: () => this.room,
      getAvatarRoot: () => this.refs.avatar.root,
      getItems: () => this.items,
      getLabelFor: (it) => this.labelFor(it),
      onInteractItem: (it) => this.interact(it),
      onCallCat: () => this.callCat(),
      onHoverChange: (label) => this.cb.onHover(label),
      onLockChange: (locked) => this.cb.onLockChange?.(locked),
      onMoveSfx: (kind, detail) => this.cb.onMoveSfx?.(kind, detail),
    });

    this.registerItems();
    this.resize();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.player.attach();

    this.skyLight.applySky(0, this.renderer);
    this.screenKey = drawLaptopScreen(this.refs.screenCanvas, this.refs.screenTex, this.timer, this.screenKey, true);
    this.setTodos([]);
    document.fonts?.ready.then(() => {
      if (!this.disposed) {
        this.screenKey = drawLaptopScreen(this.refs.screenCanvas, this.refs.screenTex, this.timer, this.screenKey, true);
      }
    });
    renderer.compile(this.scene, this.camera);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                        */
  /* ---------------------------------------------------------------- */

  setTimer(view: TimerView): void {
    this.timer = view;
    this.screenKey = drawLaptopScreen(this.refs.screenCanvas, this.refs.screenTex, view, this.screenKey, false);
  }

  setStars(n: number, celebrate = false): void {
    const mesh = this.refs.jarStars;
    const shown = Math.min(n, mesh.instanceMatrix.count);
    if (celebrate && n > this.stars) {
      const p = this.refs.jar.getWorldPosition(this.tmpV2).clone();
      p.y += 0.25;
      this.fxSys.emit("spark", p, 10, {
        colors: [0xffd45e, 0xfff3c0, 0xe4572e],
        spread: 0.9,
        up: 1.4,
        grav: 1.6,
        size: 0.13,
        life: 1.3,
      });
    }
    this.stars = n;
    mesh.count = shown;
  }

  /** Timer finished: the tomato rings and throws confetti. */
  celebrate(): void {
    this.ring = 1.8;
    const p = this.refs.tomato.getWorldPosition(new THREE.Vector3());
    p.y += 0.2;
    this.fxSys.emit("spark", p, 22, {
      colors: [0xffd45e, 0xe4572e, 0xfff3c0, 0x9fd39a],
      spread: 1.5,
      up: 2.2,
      grav: 2.2,
      size: 0.15,
      life: 1.8,
    });
    this.bump("timer");
  }

  setResting(on: boolean): void {
    if (on === this.player.resting) return;
    this.catCtrl.setOwnerResting(on);
    if (on) {
      this.skyLight.lampOn = false;
      this.skyLight.setSky("night", 3.2);
      this.refs.bedLump.visible = true;
    } else {
      this.skyLight.setSky("day", 3.2);
    }
    this.player.setRestingState(on);
  }

  callCat(): void {
    if (this.region !== "study") return;
    this.catCtrl.callToPlayer(this.player.playerPos, this.player.resting, this.player.activity);
  }

  setActivity(mode: ActivityMode, opts?: { reading?: boolean }): void {
    const prevChair = this.player.activity === "desk";
    const nextChair = mode === "desk";
    const reading = mode === "pouf" && !!opts?.reading;

    this.avatarAct.resetBooksForActivity(mode, reading);
    this.refs.rackDumbbells.visible = mode !== "weights";

    if (prevChair !== nextChair) {
      const chair = this.refs.chair;
      const cPos0 = chair.position.clone();
      const cPos1 = nextChair ? CHAIR_FOCUS_POS : CHAIR_HOME_POS;
      const cYaw0 = chair.rotation.y;
      const cYaw1 = nextChair ? CHAIR_FOCUS_YAW : CHAIR_HOME_YAW;
      this.tweens.add(0.55, (k) => {
        chair.position.lerpVectors(cPos0, cPos1, k);
        chair.rotation.y = cYaw0 + (cYaw1 - cYaw0) * k;
      });
    }

    if (mode === "desk" && this.skyLight.dark > 0.25) {
      this.skyLight.lampOn = true;
    }

    this.player.setActivityState(mode, reading);
  }

  setPoufReading(on: boolean): void {
    if (this.player.activity !== "pouf" || on === this.player.poufReading) return;
    this.player.poufReading = on;
    this.avatarAct.setPoufReading(on);
    this.player.markHoverDirty();
  }

  setExercisePaused(paused: boolean): void {
    this.player.exercisePaused = paused;
  }

  setThirdPerson(on: boolean): void {
    this.player.setThirdPerson(on);
  }

  setCatName(name: string): void {
    this.catName = name.trim().slice(0, 20) || "Miso";
    this.catCtrl.setName(this.catName);
    this.player.markHoverDirty();
  }

  setAvatarPreview(on: boolean): void {
    this.player.setAvatarPreview(on);
  }

  setRegion(next: RegionId): void {
    if (next === this.region) return;
    if (this.player.resting) this.setResting(false);
    if (this.player.activity !== "none") this.setActivity("none");
    this.region = next;

    const dest = next === "rooftop" ? this.rooftop : this.room;
    dest.add(this.refs.avatar.root);
    this.room.visible = next === "study";
    this.rooftop.visible = next === "rooftop";
    this.skyLight.setRoofShadowEnabled(next === "study");
    this.fxSys.setSteamVisible(next === "study");

    if (next === "rooftop") {
      this.player.setRegion(
        this.rooftop,
        ROOFTOP_PLAYER_BOUNDS,
        ROOFTOP_COLLIDERS,
        ROOFTOP_SPAWN_POS,
        ROOFTOP_SPAWN_YAW,
        ROOFTOP_SPAWN_PITCH,
      );
    } else {
      this.player.setRegion(
        this.room,
        PLAYER_BOUNDS,
        COLLIDERS,
        STUDY_LADDER_RETURN_POS,
        STUDY_LADDER_RETURN_YAW,
        STUDY_LADDER_RETURN_PITCH,
      );
    }
  }

  setAvatarConfig(cfg: AvatarConfig): void {
    const old = this.refs.avatar;
    const next = buildAvatar(cfg);
    next.root.position.copy(old.root.position);
    next.root.rotation.copy(old.root.rotation);
    next.root.visible = !this.player.resting && (this.player.thirdPerson || this.player.avatarPreview);
    old.root.parent?.remove(old.root);
    const activeParent = this.region === "rooftop" ? this.rooftop : this.room;
    activeParent.add(next.root);
    this.refs.avatar = next;
    old.dispose();
  }

  setRadioPlaying(on: boolean, label?: string | null): void {
    if (on && !this.radioOn) this.emitTimer = 0;
    this.radioOn = on;
    this.radioLabel = on && label ? label : null;
    this.player.markHoverDirty();
  }

  setTodos(todos: TodoItem[]): void {
    drawTodoBoard(this.refs.todoCanvas, this.refs.todoTex, todos);
  }

  flipStudyPage(): void {
    this.avatarAct.flipStudyPage(this.rand);
  }

  setHints(on: boolean, discovered: Iterable<string>): void {
    this.hintsOn = on;
    this.discovered = new Set(discovered);
  }

  setUiOpen(open: boolean): void {
    this.player.setUiOpen(open);
  }

  lockPointer(): void {
    this.player.lockPointer();
  }

  unlockPointer(): void {
    this.player.unlockPointer();
  }

  /** Restore persistent world state after a reload. */
  restore(state: { bloomed?: boolean }): void {
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

  resetView(): void {
    if (this.region === "rooftop") {
      this.player.resetView(ROOFTOP_SPAWN_POS, ROOFTOP_SPAWN_YAW, ROOFTOP_SPAWN_PITCH);
    } else {
      this.player.resetView();
    }
  }

  /** Projected screen position of an interactable — handy for tests and tooling. */
  screenPosition(id: InteractId): { x: number; y: number } | null {
    const it = this.items.get(id);
    if (!it) return null;
    const p = it.center.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** Programmatic interaction (keyboard / debugging). */
  trigger(id: InteractId): void {
    const it = this.items.get(id);
    if (it) this.interact(it);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.player.detach();
    this.tweens.clear();
    this.refs.avatar.dispose();
    disposeObjectTree(this.scene, [...this.fxSys.getOwnedTextures(), ...this.skyLight.getOwnedTextures()]);
    this.skyLight.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    resetKit();
  }

  /* ---------------------------------------------------------------- */
  /* Private helpers & frame loop                                      */
  /* ---------------------------------------------------------------- */

  private registerItems(): void {
    const box3 = new THREE.Box3();
    const hintTex = this.fxSys.hintTex;
    (Object.keys(META) as InteractId[]).forEach((id) => {
      const root = this.refs.items[id] ?? this.rooftopRefs.items[id];
      if (!root) return;
      const meta = META[id];
      const anchor = new THREE.Vector3();
      const center = box3.setFromObject(root).getCenter(new THREE.Vector3());
      if (meta.anchor) anchor.set(...meta.anchor);
      else anchor.set(center.x, box3.max.y + 0.1, center.z);
      const item: ItemEntry = {
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
        this.fxGroup.add(s);
        item.hint = s;
      }
      this.items.set(id, item);
    });
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private labelFor(it: ItemEntry): string | null {
    if (it.id === "glowstars" && this.skyLight.glowAmount() > 0.5) return "Glowing stars";
    if (it.id === "bed" && this.player.resting) return "Sleeping…";
    if (it.id === "cat") return this.catCtrl.hoverLabel();
    if (it.id === "mug" && this.avatarAct.isSipping()) return null;
    if (it.id === "study") return this.player.activity === "desk" ? "Flip a page" : "Sit & focus";
    if (it.id === "pouf") return this.player.activity === "pouf" ? "Relaxing…" : "Sit on the pouf";
    if (it.id === "poufBook") return this.player.activity === "pouf" && this.player.poufReading ? "Flip a page" : "Read on the pouf";
    if (it.id === "laser") return this.toys.laserActive ? "Turn off laser" : "Laser pointer";
    if (it.id === "catBox") return `${this.catName}'s cardboard box`;
    if (it.id === "radio") {
      return this.radioLabel ? `Radio · ${this.radioLabel.length > 26 ? this.radioLabel.slice(0, 25) + "…" : this.radioLabel}` : "Radio";
    }
    return it.label;
  }

  private bump(id: InteractId): void {
    const it = this.items.get(id);
    if (it) it.bounce = 1;
  }

  private interact(it: ItemEntry): void {
    if (it.id === "mug" && this.avatarAct.isSipping()) return;
    it.bounce = 1;
    const { refs } = this;
    const e: SceneEvent = { id: it.id };
    const at = it.anchor;

    switch (it.id) {
      case "lamp":
        this.skyLight.lampOn = !this.skyLight.lampOn;
        e.on = this.skyLight.lampOn;
        break;
      case "fairy":
        this.skyLight.fairyOn = !this.skyLight.fairyOn;
        e.on = this.skyLight.fairyOn;
        break;
      case "candle":
        this.skyLight.candleOn = !this.skyLight.candleOn;
        e.on = this.skyLight.candleOn;
        break;
      case "radio":
        break;
      case "window":
        e.phase = this.skyLight.cycleSky();
        break;
      case "cat":
        this.catCtrl.pet();
        break;
      case "mug":
        this.avatarAct.startSip();
        it.bounce = 0;
        this.player.markHoverDirty();
        break;
      case "plant": {
        this.wobble = 1;
        this.fxSys.emit("drop", this.tmpV.copy(at).setY(at.y + 0.35), 9, {
          colors: [0x8fd0ff, 0xc4e8ff],
          spread: 0.55,
          up: -0.2,
          grav: 2.4,
          size: 0.09,
          life: 0.9,
        });
        if (this.plantStage < 3) {
          this.plantStage++;
          const leaves = refs.plant.leaves;
          const s0 = leaves.scale.x;
          this.tweens.add(0.9, (k) => leaves.scale.setScalar(s0 + 0.07 * k), ease.back);
          if (this.plantStage === 3 && !this.bloomed) {
            this.bloomed = true;
            e.bloomed = true;
            refs.plant.flowers.forEach((f, i) => {
              f.visible = true;
              this.tweens.add(0.7 + i * 0.25, (k) => f.scale.setScalar(Math.max(0.001, k)), ease.back);
            });
            this.fxSys.emit("spark", at, 12, {
              colors: [0xf5a9c0, 0xfff3c0],
              spread: 1.0,
              up: 1.2,
              grav: 1,
              size: 0.13,
              life: 1.5,
            });
          }
        }
        e.stage = this.plantStage;
        break;
      }
      case "book": {
        const b = refs.specialBook;
        const z0 = 0.125;
        this.tweens.add(
          1.5,
          (k) => {
            const s = Math.sin(Math.PI * k);
            b.position.z = z0 + s * 0.17;
            b.rotation.x = s * 0.22;
          },
          ease.inOut,
        );
        break;
      }
      case "globe":
        this.globeVel = Math.min(26, this.globeVel + 11);
        break;
      case "glowstars":
        e.glowing = this.skyLight.glowAmount() > 0.5;
        if (e.glowing) {
          for (let i = 0; i < 7; i++) {
            const p = refs.glowStarPoints[Math.floor(this.rand() * refs.glowStarPoints.length)];
            this.fxSys.emit("spark", this.tmpV.copy(p).setX(p.x + 0.08), 1, {
              colors: [0xc9ff7a, 0xf4ffd0],
              spread: 0.2,
              up: 0.25,
              grav: -0.1,
              size: 0.12,
              life: 1.4,
            });
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
        this.tweens.add(0.6, (k) => (lid.rotation.x = a0 + (a1 - a0) * k), ease.back);
        if (this.boxOpen) {
          this.fxSys.emit("spark", this.skyLight.boxGlowPosition, 10, {
            colors: [0xffd27a, 0xfff3c0],
            spread: 0.7,
            up: 0.9,
            grav: 0.6,
            size: 0.1,
            life: 1.4,
          });
        }
        break;
      }
      case "yarn":
        this.toys.kickYarnFrom(this.player.playerPos.x, this.player.playerPos.z, this.player.yaw);
        this.catCtrl.notifyYarnRolled();
        break;
      case "wand":
        this.toys.waveWand();
        this.catCtrl.notifyWandWaved();
        break;
      case "scratcher":
        this.toys.batPom(8.2);
        this.catCtrl.notifyPomBatted();
        break;
      case "catBox":
        this.toys.rustleBox();
        this.catCtrl.notifyCatBox();
        break;
      case "laser": {
        const active = this.toys.toggleLaser();
        this.catCtrl.notifyLaserActive(active);
        this.player.markHoverDirty();
        break;
      }
      case "gacha":
        this.gachaSpin = 1;
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
      case "ladder":
      case "hatch":
      case "telescope":
      case "gameTable":
      case "rhythmBox":
        break;
    }
    this.cb.onInteract(e);
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, 0.05);
    this.time += dt;
    this.frame++;
    const t = this.time;

    this.tweens.update(dt);
    this.player.update(dt, t, this.avatarAct.exercisePhase);
    this.skyLight.update(dt, t, this.player.resting, this.boxOpen, this.renderer);
    this.updateAmbient(dt, t);
    this.fxSys.updateFloaters(dt);
    this.updateItems(dt, t);
    this.player.updateHover(this.frame);

    if (this.shadowsLow) this.renderer.shadowMap.needsUpdate = this.frame % 2 === 0;
    this.renderer.render(this.scene, this.camera);

    if (!this.ready) {
      this.ready = true;
      this.cb.onReady?.();
    }
    this.watchPerformance(raw);
  };

  private updateAmbient(dt: number, t: number): void {
    /* activity avatar + mug sip */
    this.avatarAct.update(dt, t, {
      activity: this.player.activity,
      poufReading: this.player.poufReading,
      exercisePaused: this.player.exercisePaused,
      resting: this.player.resting,
      thirdPerson: this.player.thirdPerson,
      radioOn: this.radioOn,
      playerPos: this.player.playerPos,
      avatarYaw: this.player.avatarYaw,
      moveSpeed: this.player.moveSpeed,
      walkPhase: this.player.walkPhase,
      crouchK: this.player.crouchK,
      landDip: this.player.landDip,
      grounded: this.player.grounded,
      camera: this.camera,
      rand: this.rand,
      onMugSfx: (kind) => this.cb.onMugSfx?.(kind),
      onSipDone: () => this.player.markHoverDirty(),
    });

    if (this.region === "rooftop") {
      const bulbs = this.rooftopRefs.fairyBulbs;
      const darkBoost = 0.65 + 0.55 * this.skyLight.dark;
      for (let i = 0; i < bulbs.count; i++) {
        const tw = 0.78 + 0.22 * Math.sin(t * 2.2 + i * 1.4);
        this.tmpC.copy(this.rooftopRefs.fairyColors[i]).multiplyScalar(tw * darkBoost);
        bulbs.setColorAt(i, this.tmpC);
      }
      if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
      for (const m of this.rooftopRefs.lanternGlows) {
        m.emissiveIntensity = (0.45 + 0.7 * this.skyLight.dark) * (0.92 + 0.08 * Math.sin(t * 3.1));
      }
      if (this.gachaSpin > 0) {
        this.gachaSpin = Math.max(0, this.gachaSpin - dt * 1.6);
        this.rooftopRefs.gachaKnob.rotation.z = Math.sin(this.gachaSpin * Math.PI) * Math.PI * 2;
      }
      return;
    }

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
    this.toys.update(dt, t, this.camera, this.player.resting, this.player.activity, () =>
      this.catCtrl.notifyLaserActive(false),
    );

    /* cat */
    this.catCtrl.update(dt, t, {
      playerPos: this.player.playerPos,
      playerEye: this.camera.position,
      playerCrouched: this.player.crouched,
      resting: this.player.resting,
      seated: this.player.activity === "desk",
      poufOccupied: this.player.activity === "pouf",
      mouseOut: this.mouseOut,
      dark: this.skyLight.dark,
      yarnPos: refs.toys.yarn.position,
      yarnSpeed: this.toys.yarnSpeed,
      wandActive: this.toys.wandActive,
      wandTipWorld: this.toys.wandTipWorld,
      laserActive: this.toys.laserActive,
      laserPos: this.toys.laserPos,
    });

    this.avatarAct.updateBooks(dt, this.player.activity, this.player.poufReading, this.rand);

    /* steam follows the mug rim in world space */
    const firstPersonSip =
      this.avatarAct.isSipping() && !this.player.resting && !(this.player.activity === "desk" && this.player.thirdPerson);
    this.fxSys.updateSteam(t, refs.mug, firstPersonSip);

    /* plant */
    this.wobble = Math.max(0, this.wobble - dt * 0.9);
    for (const s of refs.plant.stems) {
      const ph = s.userData.phase as number;
      s.rotation.z =
        (s.userData.base as number) + Math.sin(t * 0.8 + ph) * 0.028 + Math.sin(t * 9 + ph) * 0.06 * this.wobble;
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
    const prog = tm.totalMs > 0 ? 1 - Math.min(1, Math.max(0, tm.remainingMs / tm.totalMs)) : 0;
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
        this.fxSys.emit("note", p, 1, {
          colors: [0xffd76a, 0xff8a65, 0xfff3d6],
          spread: 0.35,
          up: 0.55,
          grav: -0.1,
          size: 0.13,
          life: 2.0,
        });
      }
      if (this.player.resting) {
        const p = refs.pillow.getWorldPosition(this.tmpV2);
        p.y += 0.25;
        this.fxSys.emit("z", p, 1, {
          colors: [0xdfe6ff, 0xb9c6ff],
          spread: 0.12,
          up: 0.42,
          grav: -0.05,
          size: 0.1,
          life: 2.6,
          grow: 0.09,
        });
      }
    }

    /* the sleeper under the blanket */
    const lump = refs.bedLump;
    const swell = this.skyLight.restLevel;
    lump.scale.y = Math.max(0.001, 0.17 * swell * (1 + Math.sin(t * 1.25) * 0.07));
    if (!this.player.resting && swell < 0.02) lump.visible = false;

    /* tiny roommate */
    this.mouseTimer -= dt;
    if (this.mouseTimer <= 0) {
      this.mouseTarget = this.mouseTarget ? 0 : 1;
      this.mouseTimer = this.mouseTarget ? 2.4 : 9 + this.rand() * 9;
    }
    this.mouseOut = approach(this.mouseOut, this.mouseTarget, 7, dt);
    refs.mouse.position.z = -3.06 + this.mouseOut * 0.14;
    refs.mouse.rotation.y = Math.sin(t * 3.1) * 0.25 * this.mouseOut;
  }

  private updateItems(dt: number, t: number): void {
    const sipActive = this.avatarAct.isSipping();
    const hovered = this.player.hovered;
    for (const it of this.items.values()) {
      if (it.id === "mug" && sipActive) {
        it.hover = approach(it.hover, 0, 14, dt);
        it.bounce = 0;
      } else {
        it.hover = approach(it.hover, hovered === it ? 1 : 0, 12, dt);
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
        const show = this.region === "study" && this.hintsOn && !this.discovered.has(it.id);
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
  private watchPerformance(raw: number): void {
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
      this.skyLight.setLowShadowQuality(this.renderer);
    }
  }
}
