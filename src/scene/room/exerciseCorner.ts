import * as THREE from "three";
import { M, PAL, box, cyl, hitProxy, rbox, rod, v } from "../kit";
import { FURNITURE_POS } from "../layout";
import { tag, type RoomRefs } from "./types";

export function buildExerciseCorner(room: THREE.Group, refs: RoomRefs) {
  /* yoga & stretching mat */
  const matG = tag(new THREE.Group(), "mat");
  matG.position.set(...FURNITURE_POS.yogaMat);
  const sage = M(PAL.sage, 0.96);
  const terra = M(PAL.terracotta, 0.92);
  matG.add(rbox(0.78, 0.016, 1.72, 0.006, sage, 0, 0.008, 0));
  for (const sz of [-0.74, 0.74]) {
    const stripe = box(0.74, 0.002, 0.035, terra, 0, 0.0165, sz);
    stripe.castShadow = false;
    matG.add(stripe);
  }
  const bolster = cyl(0.052, 0.052, 0.44, M(PAL.cream, 0.92), 0, 0.055, -0.78, 14);
  bolster.rotation.z = Math.PI / 2;
  matG.add(bolster, hitProxy(0.9, 0.24, 1.85, 0, 0.1, 0));
  room.add(matG);
  refs.items.mat = matG;

  /* wooden dumbbell rack */
  const rack = tag(new THREE.Group(), "dumbbells");
  rack.position.set(...FURNITURE_POS.dumbbellRack);
  const wood = M(PAL.wood, 0.72);
  const dark = M(PAL.woodDark, 0.72);
  const brass = M(PAL.brass, 0.4, 0.55);
  const mustard = M(PAL.mustard, 0.75);
  const tomato = M(PAL.tomato, 0.72);

  for (const z of [-0.28, 0.28]) {
    rack.add(rod(v(-0.15, 0.02, z), v(-0.08, 0.54, z), 0.024, wood, 8));
    rack.add(rod(v(0.15, 0.02, z), v(0.08, 0.54, z), 0.024, wood, 8));
    rack.add(rbox(0.36, 0.035, 0.06, 0.01, dark, 0, 0.0175, z));
  }
  rack.add(rbox(0.18, 0.03, 0.66, 0.01, dark, 0, 0.28, 0));
  rack.add(rbox(0.16, 0.03, 0.66, 0.01, dark, 0, 0.52, 0));

  const mkDumbbell = (weightMat: THREE.Material) => {
    const db = new THREE.Group();
    const grip = cyl(0.013, 0.013, 0.16, brass, 0, 0, 0, 8);
    grip.rotation.z = Math.PI / 2;
    db.add(grip);
    for (const sx of [-0.065, 0.065]) {
      const w = cyl(0.044, 0.044, 0.032, weightMat, sx, 0, 0, 14);
      w.rotation.z = Math.PI / 2;
      db.add(w);
    }
    return db;
  };
  for (const z of [-0.15, 0.15]) {
    const lowDb = mkDumbbell(mustard);
    lowDb.position.set(0, 0.335, z);
    lowDb.rotation.y = Math.PI / 2;
    rack.add(lowDb);
  }
  const rackDumbbells = new THREE.Group();
  for (const z of [-0.15, 0.15]) {
    const topDb = mkDumbbell(tomato);
    topDb.position.set(0, 0.575, z);
    topDb.rotation.y = Math.PI / 2;
    rackDumbbells.add(topDb);
  }
  rack.add(rackDumbbells, hitProxy(0.56, 0.68, 0.78, 0, 0.34, 0));
  room.add(rack);
  refs.items.dumbbells = rack;
  refs.rackDumbbells = rackDumbbells;

  /* stationary spin bike facing into the open room (-X, +Z) */
  const bike = tag(new THREE.Group(), "bike");
  bike.position.set(...FURNITURE_POS.spinBike);
  bike.rotation.y = 2.59;
  const frameMat = M(PAL.metal, 0.45, 0.4);
  const wheelMat = M(PAL.ink, 0.6, 0.25);

  for (const z of [-0.46, 0.36]) {
    const foot = cyl(0.022, 0.022, 0.46, frameMat, 0, 0.022, z, 10);
    foot.rotation.z = Math.PI / 2;
    bike.add(foot);
  }
  bike.add(rod(v(0, 0.03, -0.44), v(0, 0.34, -0.34), 0.024, frameMat, 10));
  bike.add(rod(v(0, 0.03, 0.34), v(0, 0.34, 0.08), 0.024, frameMat, 10));
  bike.add(rod(v(0, 0.34, 0.08), v(0, 0.34, -0.34), 0.022, frameMat, 10));
  bike.add(rod(v(0, 0.34, 0.08), v(0, 0.81, 0.2), 0.02, frameMat, 10));
  bike.add(rod(v(0, 0.34, -0.34), v(0, 0.94, -0.34), 0.022, frameMat, 10));
  bike.add(rod(v(0, 0.56, -0.34), v(0, 0.62, 0.14), 0.02, frameMat, 10));

  const flywheel = new THREE.Group();
  flywheel.position.set(0, 0.34, -0.34);
  const disc = cyl(0.22, 0.22, 0.045, wheelMat, 0, 0, 0, 24);
  disc.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 24), mustard);
  rim.rotation.y = Math.PI / 2;
  flywheel.add(disc, rim);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const spoke = box(0.052, 0.36, 0.018, brass, 0, 0, 0);
    spoke.rotation.x = a;
    flywheel.add(spoke);
  }
  bike.add(flywheel);

  const crank = new THREE.Group();
  crank.position.set(0, 0.34, 0.08);
  const axle = cyl(0.022, 0.022, 0.22, frameMat, 0, 0, 0, 10);
  axle.rotation.z = Math.PI / 2;
  crank.add(axle);
  for (const s of [-1, 1]) {
    crank.add(box(0.014, 0.15, 0.022, brass, s * 0.105, -s * 0.065, 0));
    const pedal = box(0.085, 0.02, 0.06, tomato, s * 0.13, -s * 0.14, 0);
    crank.add(pedal);
  }
  bike.add(crank);

  const saddle = rbox(0.15, 0.055, 0.22, 0.024, tomato, 0, 0.84, 0.2);
  const hbar = cyl(0.014, 0.014, 0.42, frameMat, 0, 0.96, -0.34, 10);
  hbar.rotation.z = Math.PI / 2;
  bike.add(
    saddle,
    hbar,
    rod(v(-0.2, 0.96, -0.34), v(-0.2, 0.96, -0.22), 0.014, tomato, 8),
    rod(v(0.2, 0.96, -0.34), v(0.2, 0.96, -0.22), 0.014, tomato, 8),
    rbox(0.11, 0.06, 0.02, 0.008, M(PAL.ink, 0.4), 0, 1.0, -0.36),
    hitProxy(0.76, 1.16, 1.16, 0, 0.56, -0.05),
  );
  room.add(bike);
  refs.items.bike = bike;
  refs.bike = { root: bike, flywheel, crank };

  /* decorative print on the extended back wall above the spin bike */
  const artFrame = new THREE.Group();
  artFrame.position.set(4.15, 2.05, -2.98);
  artFrame.add(rbox(0.86, 0.62, 0.032, 0.008, M(PAL.woodDark, 0.72), 0, 0, 0));
  artFrame.add(box(0.78, 0.54, 0.005, M(PAL.cream, 0.92), 0, 0, 0.017));
  artFrame.add(box(0.32, 0.36, 0.004, M(PAL.sage, 0.9), -0.18, 0.03, 0.02));
  artFrame.add(cyl(0.13, 0.13, 0.004, M(PAL.mustard, 0.9), 0.18, -0.02, 0.02, 20));
  room.add(artFrame);
}
