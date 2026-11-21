import * as THREE from "three";
import { AVATAR_ARM_L1, AVATAR_ARM_L2 } from "../avatars";
import type { ActivityMode } from "../layout";
import { clamp01, ease } from "../math";
import type { RoomRefs } from "../room/types";

const SIP_DUR = 1.68;
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

export interface AvatarActivityUpdate {
  activity: ActivityMode;
  poufReading: boolean;
  exercisePaused: boolean;
  resting: boolean;
  thirdPerson: boolean;
  radioOn: boolean;
  playerPos: THREE.Vector3;
  avatarYaw: number;
  moveSpeed: number;
  walkPhase: number;
  crouchK: number;
  landDip: number;
  grounded: boolean;
  camera: THREE.Camera;
  rand: () => number;
  onMugSfx?: (kind: "sip" | "place") => void;
  onSipDone: () => void;
}

/** Handles 3rd-person avatar IK & procedural animations, exercise phase, book page flips, and mug sipping. */
export class AvatarActivitySystem {
  private exPhase = 0;
  private pageFlip = 0;
  private autoFlipTimer = 11;
  private sipActive = false;
  private sipT = 0;
  private sipSoundPlayed = false;
  private sipPlacePlayed = false;

  private mugHomePos = new THREE.Vector3();
  private mugHomeQuat = new THREE.Quaternion();
  private mugHomeWorld = new THREE.Vector3();

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

  constructor(private refs: RoomRefs) {
    this.mugHomePos.copy(refs.mug.position);
    this.mugHomeQuat.copy(refs.mug.quaternion);
    refs.mug.getWorldPosition(this.mugHomeWorld);
  }

  get exercisePhase(): number {
    return this.exPhase;
  }

  isSipping(): boolean {
    return this.sipActive;
  }

  startSip(): void {
    this.sipActive = true;
    this.sipT = 0;
    this.sipSoundPlayed = false;
    this.sipPlacePlayed = false;
  }

  flipStudyPage(rand: () => number): void {
    this.pageFlip = 0.001;
    this.autoFlipTimer = 11 + rand() * 4;
  }

  resetBooksForActivity(mode: ActivityMode, poufReading: boolean): void {
    this.refs.studyBook.root.visible = mode === "desk";
    this.refs.studyBook.flipPage.rotation.z = 0;
    this.refs.studyBook.flipPage.position.y = 0.023;
    this.refs.poufLapBook.root.visible = poufReading;
    this.refs.poufLapBook.flipPage.rotation.z = 0;
    this.refs.poufLapBook.flipPage.position.y = 0.023;
    this.refs.poufBookFloor.visible = !poufReading;
    this.pageFlip = 0;
    this.autoFlipTimer = 11;
  }

  setPoufReading(on: boolean): void {
    this.refs.poufLapBook.root.visible = on;
    this.refs.poufLapBook.flipPage.rotation.z = 0;
    this.refs.poufLapBook.flipPage.position.y = 0.023;
    this.refs.poufBookFloor.visible = !on;
    this.pageFlip = 0;
    this.autoFlipTimer = 11;
  }

  updateBooks(dt: number, activity: ActivityMode, poufReading: boolean, rand: () => number): void {
    if (activity === "desk" || (activity === "pouf" && poufReading)) {
      const book = activity === "desk" ? this.refs.studyBook.flipPage : this.refs.poufLapBook.flipPage;
      if (this.pageFlip === 0) {
        this.autoFlipTimer -= dt;
        if (this.autoFlipTimer <= 0) {
          this.flipStudyPage(rand);
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
  }

  update(dt: number, t: number, p: AvatarActivityUpdate): void {
    const { refs } = this;
    const av = refs.avatar;
    const musicBob = p.radioOn ? Math.sin(t * 3.7) * 0.035 : 0;

    if (!p.exercisePaused && (p.activity === "yoga" || p.activity === "weights" || p.activity === "bike")) {
      const speed = p.activity === "bike" ? 6.8 : p.activity === "weights" ? 2.4 : 1.75;
      this.exPhase += dt * speed;
    }

    if (this.sipActive) {
      this.sipT += dt / SIP_DUR;
      if (this.sipT >= 1) {
        this.sipActive = false;
        this.sipT = 0;
        p.onSipDone();
      }
    }

    /* Update 3rd-person Avatar pose (free-roam or activity) */
    const deskSip3rd = this.sipActive && p.activity === "desk" && p.thirdPerson && av.root.visible;

    if (av.root.visible && p.activity === "none" && !p.resting) {
      av.root.position.copy(p.playerPos);
      av.root.rotation.y = p.avatarYaw;
      av.pen.visible = false;
      av.dumbbellL.visible = av.dumbbellR.visible = false;
      av.torso.scale.y = 1 + Math.sin(t * 1.5) * 0.012;

      const stride = Math.min(1, p.moveSpeed / 2.6);
      const sw = Math.sin(p.walkPhase) * stride;
      const cr = p.crouchK;
      const hop = p.grounded ? 0 : 0.25;

      av.hips.position.set(0, 0.83 - cr * 0.24 - p.landDip * 0.4, 0);
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
    } else if (av.root.visible && p.activity !== "none") {
      av.pen.visible = p.activity === "desk";
      av.dumbbellL.visible = av.dumbbellR.visible = p.activity === "weights";
      av.torso.scale.y = 1 + Math.sin(t * 1.5) * 0.014;

      if (p.activity === "desk") {
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
          this.solveArmIK(
            av.leftArm,
            av.leftForearm,
            this.ikTarget.set(AVATAR_IDLE_HAND.x, AVATAR_IDLE_HAND.y + Math.sin(t * 0.8) * 0.005, AVATAR_IDLE_HAND.z),
            -1,
          );
          av.root.localToWorld(this.ikTarget.set(0.1 + Math.sin(t * 3.4) * 0.015, 0.818, -0.44 + Math.cos(t * 5.2) * 0.018));
          this.solveArmIK(av.rightArm, av.rightForearm, this.ikTarget, 1);
        }
      } else if (p.activity === "pouf") {
        av.hips.position.set(0, 0.5, 0.01);
        av.thighL.rotation.set(1.72, -0.1, 0);
        av.thighR.rotation.set(1.72, 0.1, 0);
        av.shinL.rotation.set(-1.55, 0, 0);
        av.shinR.rotation.set(-1.55, 0, 0);
        av.torso.position.set(0, 0.03, 0.01);
        av.torso.rotation.set(p.poufReading ? -0.18 : -0.08, 0, 0);
        av.head.rotation.set((p.poufReading ? 0.3 : 0.1) + Math.sin(t * 0.7) * 0.03 + musicBob, Math.sin(t * 0.4) * 0.07, 0);
        av.hips.updateMatrixWorld(true);
        if (p.poufReading) {
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
      } else if (p.activity === "yoga") {
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
      } else if (p.activity === "weights") {
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
      } else if (p.activity === "bike") {
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
    if (p.activity === "bike") {
      refs.bike.crank.rotation.x = -this.exPhase;
      refs.bike.flywheel.rotation.x = -this.exPhase * 2.4;
    }

    this.updateMugSip(t, p, deskSip3rd, musicBob);
  }

  private updateMugSip(t: number, params: AvatarActivityUpdate, deskSip3rd: boolean, musicBob: number): void {
    const { refs } = this;
    const av = refs.avatar;

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
      av.head.rotation.set(
        0.28 + Math.sin(t * 0.65) * 0.04 + musicBob + sipLift * 0.16,
        Math.sin(t * 0.35) * 0.08 + reach * 0.24,
        0,
      );
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
          params.onMugSfx?.("sip");
        }
      } else if (p < 0.88) {
        const u = ease.inOut((p - 0.66) / 0.22);
        mugWorldPos.lerpVectors(AVATAR_MUG_MOUTH, this.mugHomeWorld, u);
        mugWorldPos.y += Math.sin(Math.PI * u) * 0.05;
        mugWorldQuat.slerpQuaternions(TP_MOUTH_Q, this.mugHomeQuat, u);
        handTarget.copy(MUG_GRASP_LOCAL).applyQuaternion(mugWorldQuat).add(mugWorldPos);
        if (!this.sipPlacePlayed && p >= 0.87) {
          this.sipPlacePlayed = true;
          params.onMugSfx?.("place");
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

    if (!params.resting) {
      const holdPos = this.tmpV3.copy(FP_MUG_HOLD).applyQuaternion(params.camera.quaternion).add(params.camera.position);
      const holdQuat = this.tmpQ.copy(params.camera.quaternion).multiply(FP_HOLD_Q);
      const sipPos = this.tmpV4.copy(FP_MUG_SIP).applyQuaternion(params.camera.quaternion).add(params.camera.position);
      const sipQuat = this.tmpQ2.copy(params.camera.quaternion).multiply(FP_SIP_Q);

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
          params.onMugSfx?.("sip");
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
          params.onMugSfx?.("sip");
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
          params.onMugSfx?.("place");
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
      params.onMugSfx?.("sip");
    }
    if (!this.sipPlacePlayed && p >= 0.97) {
      this.sipPlacePlayed = true;
      params.onMugSfx?.("place");
    }
  }

  private solveArmIK(arm: THREE.Group, forearm: THREE.Group, targetWorld: THREE.Vector3, side: -1 | 1): void {
    const av = this.refs.avatar;
    const tLocal = this.tmpV.copy(targetWorld);
    av.torso.worldToLocal(tLocal);

    const shoulder = arm.position;
    const D = this.tmpV2.copy(tLocal).sub(shoulder);
    const rawLen = D.length();
    const d = Math.max(0.06, Math.min(AVATAR_ARM_L1 + AVATAR_ARM_L2 - 0.004, rawLen));
    const dir = rawLen > 1e-5 ? D.divideScalar(rawLen) : D.set(0, 0, -1);

    const cosA = Math.max(
      -1,
      Math.min(1, (AVATAR_ARM_L1 * AVATAR_ARM_L1 + d * d - AVATAR_ARM_L2 * AVATAR_ARM_L2) / (2 * AVATAR_ARM_L1 * d)),
    );
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

    const pole = side < 0 ? IK_POLE_L : IK_POLE_R;
    const bend = this.tmpV3.copy(pole).addScaledVector(dir, -pole.dot(dir));
    if (bend.lengthSq() < 1e-6) {
      bend.copy(IK_FALLBACK).addScaledVector(dir, -IK_FALLBACK.dot(dir));
      if (bend.lengthSq() < 1e-6) bend.set(side, 0, 0);
    }
    bend.normalize();

    const elbowRel = this.tmpV4.copy(dir).multiplyScalar(AVATAR_ARM_L1 * cosA).addScaledVector(bend, AVATAR_ARM_L1 * sinA);
    const u1 = this.tmpV5.copy(elbowRel).normalize();
    arm.quaternion.setFromUnitVectors(NEG_Z, u1);

    const u2Torso = elbowRel.negate().addScaledVector(dir, d).normalize();
    u2Torso.applyQuaternion(this.tmpQ.copy(arm.quaternion).invert());
    forearm.quaternion.setFromUnitVectors(NEG_Z, u2Torso);
  }

  private solveBikeLeg(thigh: THREE.Group, shin: THREE.Group, pedalZ: number, pedalY: number): void {
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
}
