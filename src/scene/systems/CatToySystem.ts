import * as THREE from "three";
import { COLLIDERS, ROOM, type ActivityMode } from "../layout";
import { approach } from "../math";
import type { RoomRefs } from "../room/types";

export type ToySfxKind = "bell" | "scratch" | "yarn" | "laser" | "box";

/** Manages cat toy interactions & physics (yarn ball, feather wand, pom-pom pendulum, cardboard box rustle, laser dot). */
export class CatToySystem {
  private yarnVel = new THREE.Vector2();
  private wandTimer = 0;
  readonly wandTipWorld = new THREE.Vector3(1.96, 0.46, -1.73);
  private pomAngle = 0;
  private pomVel = 0;
  private boxRustle = 0;
  private laserTimer = 0;
  readonly laserPos = new THREE.Vector3(0.8, 0.012, 0.4);
  private tmpV = new THREE.Vector3();

  constructor(
    private refs: RoomRefs,
    private onToySfx?: (kind: ToySfxKind) => void,
  ) {}

  get yarnSpeed(): number {
    return this.yarnVel.length();
  }

  get wandActive(): boolean {
    return this.wandTimer > 0;
  }

  get laserActive(): boolean {
    return this.laserTimer > 0;
  }

  impulseYarn(dx: number, dz: number, power: number): void {
    const len = Math.hypot(dx, dz) || 1;
    this.yarnVel.set((dx / len) * power, (dz / len) * power);
    this.onToySfx?.("yarn");
  }

  kickYarnFrom(originX: number, originZ: number, fallbackYaw: number): void {
    const yPos = this.refs.toys.yarn.position;
    let dx = yPos.x - originX;
    let dz = yPos.z - originZ;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      dx /= d;
      dz /= d;
    } else {
      dx = -Math.sin(fallbackYaw);
      dz = -Math.cos(fallbackYaw);
    }
    this.impulseYarn(dx, dz, 3.1);
  }

  waveWand(): void {
    this.wandTimer = 7.5;
    this.onToySfx?.("bell");
  }

  batPom(impulse = 8.2): void {
    this.pomVel += impulse;
    this.onToySfx?.("bell");
  }

  rustleBox(): void {
    this.boxRustle = 1;
    this.onToySfx?.("box");
  }

  toggleLaser(): boolean {
    if (this.laserTimer > 0) {
      this.laserTimer = 0;
      this.refs.toys.laserDot.visible = false;
    } else {
      this.laserTimer = 12;
      this.refs.toys.laserDot.visible = true;
    }
    this.onToySfx?.("laser");
    return this.laserTimer > 0;
  }

  update(
    dt: number,
    t: number,
    camera: THREE.Camera,
    resting: boolean,
    activity: ActivityMode,
    onLaserExpire: () => void,
  ): void {
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
        onLaserExpire();
      } else {
        toys.laserDot.visible = true;
        let tx = 1.05 + Math.sin(t * 2.2) * 1.15 + Math.sin(t * 5.1) * 0.25;
        let tz = 0.45 + Math.cos(t * 2.7) * 0.95;
        if (!resting && activity === "none") {
          const dir = this.tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion);
          if (dir.y < -0.06) {
            const k = (0.012 - camera.position.y) / dir.y;
            if (k > 0.2 && k < 8.5) {
              tx = camera.position.x + dir.x * k;
              tz = camera.position.z + dir.z * k;
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
}
