import * as THREE from "three";
import { M, PAL, ball, box, cyl, hitProxy, rbox, rod, v, woodFloorTexture } from "../kit";
import { FURNITURE_POS, ROOM, WALL_H, WALL_T, WINDOW } from "../layout";
import { tag, type RoomRefs } from "./types";

export function buildShell(room: THREE.Group) {
  const wall = M(PAL.wall, 0.96);
  const low = M(PAL.wallLow, 0.96);
  const trim = M(PAL.trim, 0.8);
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const cx = (ROOM.minX + ROOM.maxX) / 2;
  const cz = (ROOM.minZ + ROOM.maxZ) / 2;
  const T = WALL_T;

  room.add(rbox(W + T + 0.1, 0.5, D + T + 0.1, 0.08, M(PAL.base, 0.95), cx - T / 2, -0.29, cz - T / 2));

  const floorTex = woodFloorTexture();
  floorTex.repeat.set((W / 6) * 3, (D / 6) * 3);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.74 });
  const floor = box(W, 0.04, D, floorMat, cx, -0.02, cz);
  floor.castShadow = false;
  room.add(floor);

  // left wall
  room.add(box(T, WALL_H, D + T, wall, -3 - T / 2, WALL_H / 2, cz - T / 2));
  // back wall, built around the window opening so real light can pour through
  const zc = -3 - T / 2;
  const { x0, x1, y0, y1 } = WINDOW;
  room.add(box(x0 - ROOM.minX, WALL_H, T, wall, (x0 + ROOM.minX) / 2, WALL_H / 2, zc));
  room.add(box(ROOM.maxX - x1, WALL_H, T, wall, (ROOM.maxX + x1) / 2, WALL_H / 2, zc));
  room.add(box(x1 - x0, y0, T, wall, (x0 + x1) / 2, y0 / 2, zc));
  room.add(box(x1 - x0, WALL_H - y1, T, wall, (x0 + x1) / 2, (WALL_H + y1) / 2, zc));

  // caps, wainscot, rail, baseboards
  room.add(box(T + 0.05, 0.06, D + T + 0.05, trim, -3 - T / 2, WALL_H + 0.03, cz - T / 2));
  room.add(box(W, 0.06, T + 0.05, trim, cx, WALL_H + 0.03, zc));
  const w1 = box(0.012, 1.0, D, low, -2.994, 0.5, cz);
  const w2 = box(W, 1.0, 0.012, low, cx, 0.5, -2.994);
  w1.castShadow = w2.castShadow = false;
  room.add(w1, w2);
  room.add(box(0.035, 0.05, D, trim, -2.983, 1.02, cz), box(W, 0.05, 0.035, trim, cx, 1.02, -2.983));
  room.add(box(0.04, 0.14, D, trim, -2.98, 0.07, cz), box(W, 0.14, 0.04, trim, cx, 0.07, -2.98));
}

export function buildWindowAndCurtains(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "window");
  const trim = M(PAL.trim, 0.7);
  const { x0, x1, y0, y1, z } = WINDOW;
  const T = WALL_T;
  const zc = z - T / 2;
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const d = T + 0.06;

  g.add(box(w, 0.07, d, trim, cx, y1 - 0.035, zc), box(w, 0.07, d, trim, cx, y0 + 0.035, zc));
  g.add(box(0.07, h, d, trim, x0 + 0.035, cy, zc), box(0.07, h, d, trim, x1 - 0.035, cy, zc));
  g.add(box(0.045, h, 0.05, trim, cx, cy, zc), box(w, 0.045, 0.05, trim, cx, y0 + h * 0.62, zc));
  g.add(rbox(w + 0.3, 0.05, T + 0.3, 0.015, trim, cx, y0 - 0.02, zc + 0.11));

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      color: 0xd6ecff,
      transparent: true,
      opacity: 0.1,
      roughness: 0.05,
      depthWrite: false,
    }),
  );
  glass.position.set(cx, cy, zc);
  g.add(glass);

  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0xfbf1e0,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.52, 1.62, 12, 8);
    const mesh = new THREE.Mesh(geo, curtainMat);
    mesh.position.set(side < 0 ? x0 - 0.06 : x1 + 0.06, 2.065, z + 0.1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    refs.curtains.push({
      mesh,
      base: Float32Array.from(geo.attributes.position.array as Float32Array),
      phase: side * 1.3,
    });
    g.add(mesh);
  }
  const metal = M(PAL.metal, 0.5, 0.3);
  const pole = cyl(0.016, 0.016, 2.6, metal, cx, 2.9, z + 0.1, 10);
  pole.rotation.z = Math.PI / 2;
  g.add(pole, ball(0.035, metal, cx - 1.3, 2.9, z + 0.1), ball(0.035, metal, cx + 1.3, 2.9, z + 0.1));

  room.add(g);
  refs.items.window = g;

  /* --- things on the sill --- */
  const candle = tag(new THREE.Group(), "candle");
  candle.position.set(0.5, y0 + 0.005, -2.87);
  candle.add(cyl(0.055, 0.06, 0.015, M(PAL.brass, 0.4, 0.6), 0, 0.008, 0));
  candle.add(cyl(0.034, 0.036, 0.11, M(PAL.linen, 0.6), 0, 0.07, 0));
  candle.add(cyl(0.003, 0.003, 0.02, M(PAL.ink), 0, 0.134, 0, 5));
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, toneMapped: false }),
  );
  flame.scale.set(0.75, 1.6, 0.75);
  flame.position.y = 0.165;
  candle.add(flame, hitProxy(0.24, 0.32, 0.24, 0, 0.14, 0));
  room.add(candle);
  refs.items.candle = candle;
  refs.flame = flame;

  const suc = new THREE.Group();
  suc.position.set(-0.72, y0 + 0.005, -2.87);
  suc.add(cyl(0.055, 0.042, 0.08, M(PAL.linen, 0.7), 0, 0.04, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = ball(0.03, M(i % 2 ? PAL.sage : PAL.leaf, 0.7), Math.cos(a) * 0.03, 0.1, Math.sin(a) * 0.03, 8, 6);
    leaf.scale.set(0.8, 1.5, 0.8);
    leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    suc.add(leaf);
  }
  suc.add(ball(0.028, M(PAL.leaf, 0.7), 0, 0.12, 0, 8, 6));
  room.add(suc);
}

/** Wooden loft ladder beside the back bookshelf leading up to the Cozy Rooftop Terrace. */
export function buildRooftopLadder(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "ladder");
  g.position.set(FURNITURE_POS.ladder[0], 0, 0);

  const railMat = M(PAL.woodDark, 0.72);
  const rungMat = M(PAL.wood, 0.68);
  const trimMat = M(PAL.trim, 0.75);

  const bottomZ = -2.68;
  const topZ = -2.93;
  const topY = 3.28;
  const halfW = 0.21;

  // side rails leaning gently against the wall
  for (const sx of [-halfW, halfW]) {
    g.add(rod(v(sx, 0, bottomZ), v(sx, topY, topZ), 0.024, railMat, 10));
    g.add(ball(0.024, railMat, sx, topY, topZ, 8, 6));
  }

  // 9 evenly spaced rungs
  const count = 9;
  for (let i = 0; i < count; i++) {
    const k = (i + 0.6) / count;
    const y = k * (topY - 0.15);
    const z = bottomZ + (topZ - bottomZ) * (y / topY);
    const rung = cyl(0.017, 0.017, halfW * 2, rungMat, 0, y, z, 10);
    rung.rotation.z = Math.PI / 2;
    g.add(rung);
  }

  // small overhead trapdoor frame at top of wall
  g.add(rbox(0.58, 0.07, 0.22, 0.015, trimMat, 0, WALL_H - 0.03, -2.94));
  g.add(box(0.46, 0.02, 0.14, M(PAL.indigo, 0.9), 0, WALL_H - 0.06, -2.92));

  g.add(hitProxy(0.62, WALL_H - 0.1, 0.45, 0, WALL_H * 0.48, -2.78));
  room.add(g);
  refs.items.ladder = g;
}
