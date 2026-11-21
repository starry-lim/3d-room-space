import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Shared palette for the room. UI colours in index.css echo these. */
export const PAL = {
  wall: 0x93a98f,
  wallLow: 0x7c947c,
  trim: 0xf3e7d0,
  base: 0x6a4a3a,
  wood: 0xc68b59,
  woodLight: 0xdcae7e,
  woodDark: 0x8a5a3c,
  cream: 0xf5ecdb,
  linen: 0xfbf5ea,
  tomato: 0xe4572e,
  mustard: 0xe9b44c,
  blush: 0xe8a391,
  indigo: 0x3f4a78,
  sage: 0x7d9b76,
  leaf: 0x5c9a63,
  leafDark: 0x3f7350,
  terracotta: 0xc9704f,
  metal: 0x3a3038,
  brass: 0xc9a25a,
  ink: 0x2b2030,
  ginger: 0xe59a52,
};

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Cached standard material — most of the room shares a few dozen of these. */
export function M(color: number, roughness = 0.86, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    matCache.set(key, m);
  }
  return m;
}

export function resetKit() {
  matCache.clear();
}

/* ------------------------------------------------------------------ */
/* Mesh helpers                                                        */
/* ------------------------------------------------------------------ */

function finish<T extends THREE.Mesh>(mesh: T, x: number, y: number, z: number): T {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  return finish(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
}

export function rbox(
  w: number,
  h: number,
  d: number,
  r: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  return finish(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat), x, y, z);
}

export function cyl(
  rTop: number,
  rBottom: number,
  h: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  seg = 24,
  open = false,
) {
  return finish(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open), mat), x, y, z);
}

export function ball(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, ws = 20, hs = 14) {
  return finish(new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat), x, y, z);
}

/** Invisible, raycast-only volume that makes small props easy to tap on phones. */
export function hitProxy(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), proxyMat);
  m.position.set(x, y, z);
  m.visible = false;
  m.userData.proxy = true;
  return m;
}
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

/** Deterministic PRNG so the room looks the same on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Canvas textures                                                     */
/* ------------------------------------------------------------------ */

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function asTexture(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function woodFloorTexture() {
  const [c, g] = makeCanvas(512, 512);
  const r = rng(11);
  const rows = 8;
  const rh = 512 / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 220;
    while (x < 512) {
      const w = 150 + r() * 150;
      g.fillStyle = `hsl(${25 + r() * 7} ${40 + r() * 10}% ${57 + r() * 9}%)`;
      g.fillRect(x, row * rh, w, rh);
      g.globalAlpha = 0.08;
      for (let i = 0; i < 9; i++) {
        g.fillStyle = r() > 0.5 ? "#5a3a1e" : "#fff2d8";
        g.fillRect(x, row * rh + r() * rh, w, 1 + r() * 1.6);
      }
      g.globalAlpha = 1;
      g.fillStyle = "rgba(70,40,20,.38)";
      g.fillRect(x + w - 2, row * rh, 2, rh);
      x += w;
    }
    g.fillStyle = "rgba(70,40,20,.42)";
    g.fillRect(0, row * rh, 512, 2);
  }
  const t = asTexture(c, true);
  t.repeat.set(3, 3);
  return t;
}

export function rugTexture() {
  const [c, g] = makeCanvas(512, 512);
  const rings: [number, string][] = [
    [1.0, "#f1e4cc"],
    [0.93, "#cf6f4f"],
    [0.8, "#f1e4cc"],
    [0.75, "#3f4a78"],
    [0.55, "#f1e4cc"],
    [0.5, "#e3ad4a"],
    [0.27, "#f1e4cc"],
    [0.22, "#cf6f4f"],
  ];
  g.fillStyle = "#f1e4cc";
  g.fillRect(0, 0, 512, 512);
  for (const [f, col] of rings) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(256, 256, 256 * f, 0, Math.PI * 2);
    g.fill();
  }
  // stitched details
  g.strokeStyle = "#f1e4cc";
  g.lineWidth = 4;
  g.setLineDash([10, 12]);
  g.beginPath();
  g.arc(256, 256, 256 * 0.865, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "#e3ad4a";
  g.beginPath();
  g.arc(256, 256, 256 * 0.65, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "#3f4a78";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.arc(256 + Math.cos(a) * 256 * 0.385, 256 + Math.sin(a) * 256 * 0.385, 7, 0, Math.PI * 2);
    g.fill();
  }
  // woven noise
  const r = rng(5);
  g.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() > 0.5 ? "#000" : "#fff";
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  g.globalAlpha = 1;
  return asTexture(c);
}

export function blanketTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = "#3f4a78";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#f1e4cc";
  g.fillRect(0, 14, 128, 6);
  g.fillRect(0, 78, 128, 6);
  g.fillStyle = "#e4572e";
  g.fillRect(0, 28, 128, 10);
  g.fillStyle = "#e3ad4a";
  g.fillRect(0, 92, 128, 4);
  g.fillStyle = "rgba(255,255,255,.05)";
  for (let x = 0; x < 128; x += 4) g.fillRect(x, 0, 1, 128);
  const t = asTexture(c, true);
  return t;
}

export function glowTexture() {
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,.55)");
  grad.addColorStop(0.6, "rgba(255,255,255,.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return asTexture(c);
}

export function discTexture() {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.42, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return asTexture(c);
}

export type Glyph = "heart" | "z" | "note" | "spark" | "drop";

/** Small white glyphs used by the floating particle pool (tinted per sprite). */
export function glyphTextures(): Record<Glyph, THREE.CanvasTexture> {
  const make = (draw: (g: CanvasRenderingContext2D) => void) => {
    const [c, g] = makeCanvas(64, 64);
    g.fillStyle = "#fff";
    g.strokeStyle = "#fff";
    g.lineCap = "round";
    g.lineJoin = "round";
    draw(g);
    return asTexture(c);
  };
  return {
    heart: make((g) => {
      g.beginPath();
      g.moveTo(32, 54);
      g.bezierCurveTo(4, 34, 8, 10, 22, 10);
      g.bezierCurveTo(28, 10, 32, 15, 32, 20);
      g.bezierCurveTo(32, 15, 36, 10, 42, 10);
      g.bezierCurveTo(56, 10, 60, 34, 32, 54);
      g.fill();
    }),
    z: make((g) => {
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(16, 16);
      g.lineTo(48, 16);
      g.lineTo(16, 48);
      g.lineTo(48, 48);
      g.stroke();
    }),
    note: make((g) => {
      g.beginPath();
      g.ellipse(24, 46, 11, 8, -0.4, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(33, 44);
      g.lineTo(33, 10);
      g.quadraticCurveTo(46, 14, 48, 28);
      g.stroke();
    }),
    spark: make((g) => {
      g.beginPath();
      g.moveTo(32, 2);
      g.quadraticCurveTo(34, 30, 62, 32);
      g.quadraticCurveTo(34, 34, 32, 62);
      g.quadraticCurveTo(30, 34, 2, 32);
      g.quadraticCurveTo(30, 30, 32, 2);
      g.fill();
    }),
    drop: make((g) => {
      g.beginPath();
      g.moveTo(32, 6);
      g.bezierCurveTo(32, 6, 50, 30, 50, 42);
      g.arc(32, 42, 18, 0, Math.PI);
      g.bezierCurveTo(14, 30, 32, 6, 32, 6);
      g.fill();
    }),
  };
}

/** Outlined sparkle used for the optional hint markers — readable on any background. */
export function hintTexture() {
  const [c, g] = makeCanvas(64, 64);
  g.lineJoin = "round";
  const path = () => {
    g.beginPath();
    g.moveTo(32, 6);
    g.quadraticCurveTo(35, 29, 58, 32);
    g.quadraticCurveTo(35, 35, 32, 58);
    g.quadraticCurveTo(29, 35, 6, 32);
    g.quadraticCurveTo(29, 29, 32, 6);
    g.closePath();
  };
  path();
  g.strokeStyle = "#2b2030";
  g.lineWidth = 8;
  g.stroke();
  path();
  g.fillStyle = "#ffd76a";
  g.fill();
  return asTexture(c);
}

export function posterTexture() {
  const [c, g] = makeCanvas(256, 320);
  g.fillStyle = "#f5ecdb";
  g.fillRect(0, 0, 256, 320);
  const sky = g.createLinearGradient(0, 18, 0, 300);
  sky.addColorStop(0, "#f3b27a");
  sky.addColorStop(0.55, "#f6d5a4");
  sky.addColorStop(1, "#f5ecdb");
  g.fillStyle = sky;
  g.fillRect(18, 18, 220, 284);
  g.fillStyle = "#e4572e";
  g.beginPath();
  g.arc(150, 120, 38, 0, Math.PI * 2);
  g.fill();
  const hills: [string, number, number][] = [
    ["#7d9b76", 190, 34],
    ["#5a7d64", 222, 26],
    ["#3f4a78", 256, 20],
  ];
  hills.forEach(([col, y, amp], i) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(18, 302);
    for (let x = 18; x <= 238; x += 4) {
      g.lineTo(x, y - Math.sin(x * 0.03 + i * 2.1) * amp - Math.sin(x * 0.09 + i) * amp * 0.25);
    }
    g.lineTo(238, 302);
    g.fill();
  });
  return asTexture(c);
}

export function clockTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = "#f8f0df";
  g.beginPath();
  g.arc(128, 128, 128, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2b2030";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const big = i % 5 === 0;
    g.save();
    g.translate(128, 128);
    g.rotate(a);
    g.fillRect(big ? -3 : -1, -118, big ? 6 : 2, big ? 18 : 8);
    g.restore();
  }
  g.font = "600 30px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  [
    ["12", 128, 46],
    ["3", 210, 130],
    ["6", 128, 212],
    ["9", 46, 130],
  ].forEach(([s, x, y]) => g.fillText(s as string, x as number, y as number));
  return asTexture(c);
}

export function globeTexture() {
  const [c, g] = makeCanvas(256, 128);
  g.fillStyle = "#5f93b8";
  g.fillRect(0, 0, 256, 128);
  const r = rng(42);
  g.fillStyle = "#8fb277";
  for (let i = 0; i < 9; i++) {
    const x = r() * 256;
    const y = 22 + r() * 84;
    for (let j = 0; j < 7; j++) {
      g.beginPath();
      g.ellipse(x + (r() - 0.5) * 46, y + (r() - 0.5) * 30, 8 + r() * 16, 6 + r() * 10, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = "#f5ecdb";
  g.fillRect(0, 0, 256, 9);
  g.fillRect(0, 119, 256, 9);
  return asTexture(c);
}
