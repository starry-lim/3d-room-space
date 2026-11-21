import * as THREE from "three";
import type { AvatarAccessory, AvatarConfig, AvatarPresetId } from "../game/data";
import { PAL, box, rbox, cyl, ball } from "./kit";

export const HAIR_SWATCHES = [
  "#3a2a28",
  "#2b2030",
  "#6e4736",
  "#e59a52",
  "#d98d4a",
  "#a6744c",
  "#efe5d8",
  "#e8a391",
];

export const TOP_SWATCHES = [
  "#7d9b76",
  "#c9704f",
  "#3f4a78",
  "#e9b44c",
  "#e8a391",
  "#f5ecdb",
  "#5a7d9a",
  "#3a3038",
];

export const BOTTOM_SWATCHES = [
  "#3f4a78",
  "#3a3038",
  "#5c4a3e",
  "#52638a",
  "#6f7e69",
  "#2b2030",
];

export const ACC_SWATCHES = [
  "#e9b44c",
  "#e4572e",
  "#e8a391",
  "#7d9b76",
  "#c9a25a",
  "#f5ecdb",
  "#2b2030",
];

export interface AvatarPresetMeta {
  id: AvatarPresetId;
  name: string;
  subtitle: string;
  defaults: Omit<AvatarConfig, "preset">;
}

export const AVATAR_PRESETS: AvatarPresetMeta[] = [
  {
    id: "bun",
    name: "Cozy Bun",
    subtitle: "Sweater & bun",
    defaults: {
      hairColor: "#3a2a28",
      topColor: "#7d9b76",
      bottomColor: "#3f4a78",
      accessory: "headphones",
      accessoryColor: "#e9b44c",
    },
  },
  {
    id: "hoodie",
    name: "Warm Hoodie",
    subtitle: "Hoodie & short hair",
    defaults: {
      hairColor: "#2b2030",
      topColor: "#c9704f",
      bottomColor: "#3a3038",
      accessory: "glasses",
      accessoryColor: "#c9a25a",
    },
  },
  {
    id: "beanie",
    name: "Knit Beanie",
    subtitle: "Long hair & beanie",
    defaults: {
      hairColor: "#6e4736",
      topColor: "#f5ecdb",
      bottomColor: "#3f4a78",
      accessory: "scarf",
      accessoryColor: "#e8a391",
    },
  },
  {
    id: "bear",
    name: "Study Bear",
    subtitle: "Plush bear buddy",
    defaults: {
      hairColor: "#a6744c",
      topColor: "#3f4a78",
      bottomColor: "#5c4a3e",
      accessory: "glasses",
      accessoryColor: "#c9a25a",
    },
  },
  {
    id: "cat",
    name: "Study Cat",
    subtitle: "Whiskers & ears",
    defaults: {
      hairColor: "#e59a52",
      topColor: "#7d9b76",
      bottomColor: "#3f4a78",
      accessory: "headphones",
      accessoryColor: "#e9b44c",
    },
  },
  {
    id: "bunny",
    name: "Cozy Bunny",
    subtitle: "Tall floppy ears",
    defaults: {
      hairColor: "#efe5d8",
      topColor: "#e8a391",
      bottomColor: "#52638a",
      accessory: "scarf",
      accessoryColor: "#e9b44c",
    },
  },
  {
    id: "shiba",
    name: "Shiba Pup",
    subtitle: "Curled tail pup",
    defaults: {
      hairColor: "#d98d4a",
      topColor: "#c9704f",
      bottomColor: "#3a3038",
      accessory: "scarf",
      accessoryColor: "#7d9b76",
    },
  },
  {
    id: "bot",
    name: "Desk Bot",
    subtitle: "Retro study robot",
    defaults: {
      hairColor: "#f5ecdb",
      topColor: "#e9b44c",
      bottomColor: "#3f4a78",
      accessory: "none",
      accessoryColor: "#7d9b76",
    },
  },
];

export const ACCESSORY_OPTIONS: { id: AvatarAccessory; label: string }[] = [
  { id: "headphones", label: "Headphones" },
  { id: "glasses", label: "Glasses" },
  { id: "scarf", label: "Scarf" },
  { id: "none", label: "None" },
];

export interface AvatarRig {
  root: THREE.Group;
  hips: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  pen: THREE.Object3D;
  dumbbellL: THREE.Object3D;
  dumbbellR: THREE.Object3D;
  dispose: () => void;
}

const UP = new THREE.Vector3(0, 1, 0);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = cyl(r, r, d.length(), mat, 0, 0, 0, seg);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

function makeMiniDumbbell(trackMat: <T extends THREE.Material>(m: T) => T) {
  const g = new THREE.Group();
  const grip = trackMat(new THREE.MeshStandardMaterial({ color: PAL.brass, roughness: 0.4, metalness: 0.5 }));
  const weight = trackMat(new THREE.MeshStandardMaterial({ color: PAL.tomato, roughness: 0.65 }));
  const bar = cyl(0.012, 0.012, 0.14, grip, 0, 0, 0, 8);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const s of [-1, 1]) {
    const cap = cyl(0.038, 0.038, 0.026, weight, s * 0.058, 0, 0, 12);
    cap.rotation.z = Math.PI / 2;
    g.add(cap);
  }
  g.visible = false;
  return g;
}

export function buildAvatar(cfg: AvatarConfig): AvatarRig {
  const root = new THREE.Group();
  const ownedMats: THREE.Material[] = [];
  const mat = (color: string | number, roughness = 0.88, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    ownedMats.push(m);
    return m;
  };
  const track = <T extends THREE.Material>(m: T) => {
    ownedMats.push(m);
    return m;
  };

  const hairMat = mat(cfg.hairColor, 0.86);
  const topMat = mat(cfg.topColor, 0.9);
  const bottomMat = mat(cfg.bottomColor, 0.88);
  const accMat = mat(cfg.accessoryColor, 0.58, cfg.accessory === "glasses" ? 0.55 : 0);

  const skinMat = mat(0xf4d3b8, 0.8);
  const creamMat = mat(PAL.cream, 0.9);
  const snoutMat = mat(0xf6e6d0, 0.9);
  const pinkMat = mat(0xf0a8b0, 0.82);
  const sockMat = mat(PAL.tomato, 0.9);
  const inkMat = mat(PAL.ink, 0.3);
  const bandMat = mat(PAL.ink, 0.72);
  const penMat = mat(PAL.indigo, 0.4);
  const shineMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));

  const isAnimal = cfg.preset === "bear" || cfg.preset === "cat" || cfg.preset === "bunny" || cfg.preset === "shiba";
  const isBot = cfg.preset === "bot";
  const handMat = isBot ? hairMat : isAnimal ? hairMat : skinMat;
  const neckMat = isBot ? bottomMat : isAnimal ? hairMat : skinMat;

  /* ---------------- Hips & Articulated Legs ---------------- */
  const hips = new THREE.Group();
  hips.position.set(0, 0.59, 0.01);
  hips.add(rbox(0.28, 0.11, 0.22, 0.04, bottomMat, 0, 0, 0));

  // Cute tails for animal presets
  if (cfg.preset === "bear" || cfg.preset === "bunny") {
    hips.add(ball(0.05, cfg.preset === "bunny" ? creamMat : hairMat, 0, 0.015, 0.125, 10, 8));
  } else if (cfg.preset === "cat") {
    const t0 = new THREE.Group();
    t0.position.set(0, 0.02, 0.11);
    t0.add(
      rod(v(0, 0, 0), v(0, 0.06, 0.13), 0.024, hairMat, 8),
      rod(v(0, 0.06, 0.13), v(0.05, 0.16, 0.17), 0.021, hairMat, 8),
      ball(0.024, creamMat, 0.05, 0.16, 0.17, 8, 6),
    );
    hips.add(t0);
  } else if (cfg.preset === "shiba") {
    const shibaTail = ball(0.052, hairMat, 0, 0.06, 0.14, 10, 8);
    shibaTail.scale.set(0.85, 1.15, 0.9);
    hips.add(shibaTail, ball(0.036, snoutMat, 0, 0.095, 0.145, 8, 6));
  }

  const mkLeg = (x: number) => {
    const thigh = new THREE.Group();
    thigh.position.set(x, 0, -0.02);
    thigh.add(
      ball(0.052, bottomMat, 0, 0, 0, 10, 8),
      cyl(0.052, 0.046, 0.3, bottomMat, 0, -0.15, 0, 12),
      ball(0.046, bottomMat, 0, -0.3, 0, 10, 8),
    );
    const shin = new THREE.Group();
    shin.position.set(0, -0.3, 0);
    shin.add(cyl(0.046, 0.038, 0.48, bottomMat, 0, -0.24, 0, 12));
    const foot = ball(0.052, isBot ? topMat : sockMat, 0, -0.49, -0.035, 10, 8);
    foot.scale.set(0.95, 0.72, 1.45);
    shin.add(foot);
    thigh.add(shin);
    hips.add(thigh);
    return { thigh, shin };
  };

  const legL = mkLeg(-0.085);
  const legR = mkLeg(0.085);

  /* ---------------- Torso ---------------- */
  const torso = new THREE.Group();
  torso.position.set(0, 0.03, 0.01);
  torso.rotation.order = "YXZ";
  torso.rotation.x = -0.14;

  const torsoBody = isBot
    ? rbox(0.32, 0.37, 0.21, 0.05, hairMat, 0, 0.2, 0)
    : rbox(0.32, 0.38, 0.2, 0.07, topMat, 0, 0.2, 0);
  torso.add(torsoBody);
  torso.add(cyl(0.065, 0.08, 0.06, isBot ? bottomMat : creamMat, 0, 0.4, 0, 12));
  torso.add(cyl(0.046, 0.052, 0.08, neckMat, 0, 0.43, -0.01, 10));

  if (cfg.preset === "hoodie") {
    const hood = rbox(0.24, 0.11, 0.14, 0.04, topMat, 0, 0.38, 0.11);
    hood.rotation.x = 0.25;
    torso.add(
      hood,
      rod(v(-0.035, 0.36, -0.105), v(-0.035, 0.24, -0.108), 0.006, creamMat, 6),
      rod(v(0.035, 0.36, -0.105), v(0.035, 0.24, -0.108), 0.006, creamMat, 6),
    );
  } else if (cfg.preset === "bear") {
    torso.add(box(0.08, 0.25, 0.015, creamMat, 0, 0.24, -0.098));
  } else if (cfg.preset === "bot") {
    torso.add(rbox(0.2, 0.16, 0.025, 0.012, topMat, 0, 0.22, -0.102));
    const ledMat = track(new THREE.MeshBasicMaterial({ color: 0x9fd39a, toneMapped: false }));
    const led = ball(0.018, ledMat, 0.055, 0.25, -0.114, 8, 6);
    led.castShadow = false;
    torso.add(led);
  }

  /* ---------------- Head ---------------- */
  const head = new THREE.Group();
  head.position.set(0, 0.45, -0.02);

  if (isBot) {
    head.add(rbox(0.25, 0.22, 0.22, 0.05, hairMat, 0, 0.125, 0));
    const visor = rbox(0.19, 0.11, 0.025, 0.012, inkMat, 0, 0.125, -0.103);
    visor.castShadow = false;
    const eyeGlow = track(new THREE.MeshBasicMaterial({ color: 0xffd45e, toneMapped: false }));
    for (const sx of [-0.048, 0.048]) {
      const eye = cyl(0.02, 0.02, 0.01, eyeGlow, sx, 0.125, -0.114, 12);
      eye.rotation.x = Math.PI / 2;
      eye.castShadow = false;
      head.add(eye);
    }
    const brass = mat(PAL.brass, 0.4, 0.6);
    head.add(
      visor,
      rod(v(0, 0.235, 0), v(0, 0.32, 0), 0.008, brass, 6),
      ball(0.02, topMat, 0, 0.33, 0, 8, 6),
    );
  } else if (isAnimal) {
    const skull = ball(0.124, hairMat, 0, 0.11, 0, 18, 14);
    skull.scale.set(1.04, 0.98, 1.0);
    head.add(skull);

    // Eyes
    for (const sx of [-0.044, 0.044]) {
      const e = ball(0.014, inkMat, sx, 0.128, -0.112, 10, 8);
      e.castShadow = false;
      const g = ball(0.0045, shineMat, sx - 0.004, 0.133, -0.123, 6, 4);
      g.castShadow = false;
      head.add(e, g);
    }

    // Muzzle & nose
    const muzzle = ball(0.048, snoutMat, 0, 0.082, -0.104, 12, 10);
    muzzle.scale.set(1.22, 0.85, 0.88);
    head.add(muzzle);
    head.add(ball(0.015, cfg.preset === "cat" || cfg.preset === "bunny" ? pinkMat : inkMat, 0, 0.098, -0.145, 8, 6));

    if (cfg.preset === "bear") {
      for (const s of [-1, 1]) {
        head.add(ball(0.042, hairMat, s * 0.09, 0.205, 0.01, 10, 8));
        head.add(ball(0.022, snoutMat, s * 0.09, 0.205, -0.012, 8, 6));
      }
    } else if (cfg.preset === "cat" || cfg.preset === "shiba") {
      const innerCol = cfg.preset === "cat" ? pinkMat : snoutMat;
      for (const s of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(s * 0.078, 0.205, 0);
        ear.rotation.z = -s * 0.32;
        const outer = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.095, 10), hairMat);
        outer.castShadow = true;
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.06, 8), innerCol);
        inner.position.set(0, -0.008, -0.02);
        ear.add(outer, inner);
        head.add(ear);
      }
      if (cfg.preset === "cat") {
        for (const s of [-1, 1]) {
          for (const dy of [0.09, 0.075]) {
            const w = rod(v(s * 0.05, dy, -0.11), v(s * 0.13, dy - 0.008, -0.1), 0.0022, creamMat, 4);
            w.castShadow = false;
            head.add(w);
          }
        }
      } else {
        // Shiba cream cheeks + eyebrow spots
        for (const s of [-1, 1]) {
          const cheek = ball(0.042, snoutMat, s * 0.048, 0.076, -0.092, 10, 8);
          head.add(cheek, ball(0.011, snoutMat, s * 0.04, 0.155, -0.11, 6, 4));
        }
      }
    } else if (cfg.preset === "bunny") {
      for (const s of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(s * 0.06, 0.215, 0.005);
        ear.rotation.set(s > 0 ? 0.18 : 0.05, 0, -s * (s > 0 ? 0.22 : 0.1));
        const outer = ball(0.036, hairMat, 0, 0.1, 0, 10, 8);
        outer.scale.set(0.92, 2.75, 0.58);
        const inner = ball(0.022, pinkMat, 0, 0.1, -0.015, 8, 6);
        inner.scale.set(0.85, 2.25, 0.35);
        inner.castShadow = false;
        ear.add(outer, inner);
        head.add(ear);
      }
    }
  } else {
    // Humanoid head (bun / hoodie / beanie)
    const skull = ball(0.12, skinMat, 0, 0.11, 0, 18, 14);
    skull.scale.set(0.98, 1.02, 0.96);
    head.add(skull);
    for (const s of [-1, 1]) head.add(ball(0.022, skinMat, s * 0.118, 0.1, 0.01, 8, 6));

    // Tiny cute eyes on -Z face
    for (const sx of [-0.04, 0.04]) {
      const eye = ball(0.011, inkMat, sx, 0.115, -0.112, 8, 6);
      eye.castShadow = false;
      head.add(eye);
    }

    const cap = ball(0.126, hairMat, 0, 0.13, 0.018, 18, 14);
    cap.scale.set(1.02, 1.0, 1.04);
    head.add(cap);

    if (cfg.preset === "bun") {
      head.add(ball(0.064, hairMat, 0, 0.225, 0.085, 12, 10));
    } else if (cfg.preset === "hoodie") {
      // Short tousled bangs & side tufts
      for (const sx of [-0.055, 0, 0.055]) {
        const tuft = ball(0.042, hairMat, sx, 0.195, -0.072, 10, 8);
        tuft.scale.set(1.1, 0.72, 0.9);
        head.add(tuft);
      }
    } else if (cfg.preset === "beanie") {
      // Flowing back hair + knit beanie
      const backHair = rbox(0.22, 0.2, 0.11, 0.045, hairMat, 0, 0.05, 0.078);
      head.add(backHair);
      const knitMat = mat(PAL.mustard, 0.95);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.132, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
        knitMat,
      );
      dome.position.set(0, 0.135, 0.01);
      dome.castShadow = true;
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.022, 8, 22), knitMat);
      brim.rotation.x = Math.PI / 2 - 0.1;
      brim.position.set(0, 0.15, 0.01);
      brim.castShadow = true;
      head.add(dome, brim, ball(0.042, creamMat, 0, 0.28, 0.02, 10, 8));
    }
  }

  /* ---------------- Accessories ---------------- */
  if (cfg.accessory === "headphones") {
    for (const s of [-1, 1]) {
      const cup = cyl(0.044, 0.044, 0.028, accMat, s * 0.132, 0.112, 0, 14);
      cup.rotation.z = Math.PI / 2;
      head.add(cup);
    }
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.134, 0.012, 8, 22, Math.PI), bandMat);
    arc.position.set(0, 0.118, 0);
    head.add(arc);
  } else if (cfg.accessory === "glasses") {
    const gz = isAnimal ? -0.124 : isBot ? -0.118 : -0.12;
    const gy = isAnimal ? 0.125 : 0.115;
    for (const sx of [-0.044, 0.044]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0045, 6, 16), accMat);
      rim.position.set(sx, gy, gz);
      head.add(rim);
    }
    head.add(box(0.032, 0.005, 0.005, accMat, 0, gy + 0.005, gz));
  } else if (cfg.accessory === "scarf") {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.026, 8, 18), accMat);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.set(0, 0.41, 0);
    wrap.castShadow = true;
    const tail = rbox(0.064, 0.16, 0.024, 0.01, accMat, 0.042, 0.32, -0.105);
    tail.rotation.z = 0.08;
    torso.add(wrap, tail);
  }

  torso.add(head);

  /* ---------------- Articulated 2-Bone Arms ---------------- */
  const L1 = 0.235;
  const L2 = 0.255;
  const armSleeveMat = isBot ? bottomMat : topMat;

  const mkArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.165, 0.35, -0.01);
    shoulder.add(
      rod(v(0, 0, 0), v(0, 0, -L1), 0.044, armSleeveMat, 10),
      ball(0.042, armSleeveMat, 0, 0, -L1, 10, 8),
    );
    const forearm = new THREE.Group();
    forearm.position.set(0, 0, -L1);
    forearm.add(
      rod(v(0, 0, 0), v(0, 0, -L2), 0.036, armSleeveMat, 10),
      ball(0.035, handMat, 0, 0, -L2, 10, 8),
    );
    shoulder.add(forearm);
    torso.add(shoulder);
    return { shoulder, forearm };
  };

  const armL = mkArm(-1);
  const armR = mkArm(1);

  const pen = rod(v(0, -0.005, -L2 + 0.01), v(-0.035, 0.025, -L2 - 0.06), 0.006, penMat, 6);
  armR.forearm.add(pen);

  const dumbbellL = makeMiniDumbbell(track);
  dumbbellL.position.set(0, -0.01, -L2);
  armL.forearm.add(dumbbellL);

  const dumbbellR = makeMiniDumbbell(track);
  dumbbellR.position.set(0, -0.01, -L2);
  armR.forearm.add(dumbbellR);

  hips.add(torso);
  root.add(hips);
  root.visible = false;

  return {
    root,
    hips,
    thighL: legL.thigh,
    thighR: legR.thigh,
    shinL: legL.shin,
    shinR: legR.shin,
    torso,
    head,
    leftArm: armL.shoulder,
    leftForearm: armL.forearm,
    rightArm: armR.shoulder,
    rightForearm: armR.forearm,
    pen,
    dumbbellL,
    dumbbellR,
    dispose: () => {
      root.traverse((o) => {
        (o as THREE.Mesh).geometry?.dispose();
      });
      for (const m of ownedMats) m.dispose();
    },
  };
}
