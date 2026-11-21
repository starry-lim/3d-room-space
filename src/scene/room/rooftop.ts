import * as THREE from "three";
import { M, PAL, ball, box, cyl, hitProxy, rbox, rng, rod, rugTexture, v, woodFloorTexture } from "../kit";
import { ROOFTOP_ROOM } from "../layout";
import { tag, type RooftopRefs } from "./types";

/** Build the Cozy Rooftop Terrace minigame lounge and its interactive 3D props. */
export function buildRooftop(): { rooftop: THREE.Group; refs: RooftopRefs } {
  const rooftop = new THREE.Group();
  const refs: RooftopRefs = {
    items: {},
    fairyBulbs: null as unknown as THREE.InstancedMesh,
    fairyColors: [],
    lanternGlows: [],
    gachaKnob: new THREE.Group(),
    gachaCapsules: [],
    gachaDrop: null as unknown as RooftopRefs["gachaDrop"],
    tableCards: [],
  };

  const W = ROOFTOP_ROOM.maxX - ROOFTOP_ROOM.minX;
  const D = ROOFTOP_ROOM.maxZ - ROOFTOP_ROOM.minZ;
  const cx = (ROOFTOP_ROOM.minX + ROOFTOP_ROOM.maxX) / 2;
  const cz = (ROOFTOP_ROOM.minZ + ROOFTOP_ROOM.maxZ) / 2;

  /* ---------------- Timber Deck & Perimeter Railings ---------------- */
  rooftop.add(rbox(W + 0.24, 0.42, D + 0.24, 0.08, M(PAL.base, 0.95), cx, -0.25, cz));

  const floorTex = woodFloorTexture();
  floorTex.repeat.set((W / 6) * 3, (D / 6) * 3);
  const deckMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.78 });
  const deck = box(W, 0.04, D, deckMat, cx, -0.02, cz);
  deck.castShadow = false;
  rooftop.add(deck);

  const railWood = M(PAL.woodDark, 0.76);
  const postWood = M(PAL.wood, 0.72);
  const RH = 0.84;

  // Perimeter top & mid rails along 4 sides
  for (const sz of [ROOFTOP_ROOM.minZ + 0.08, ROOFTOP_ROOM.maxZ - 0.08]) {
    rooftop.add(rbox(W - 0.1, 0.06, 0.07, 0.015, railWood, 0, RH, sz));
    rooftop.add(box(W - 0.14, 0.035, 0.04, postWood, 0, RH * 0.48, sz));
  }
  for (const sx of [ROOFTOP_ROOM.minX + 0.08, ROOFTOP_ROOM.maxX - 0.08]) {
    rooftop.add(rbox(0.07, 0.06, D - 0.1, 0.015, railWood, sx, RH, 0));
    rooftop.add(box(0.04, 0.035, D - 0.14, postWood, sx, RH * 0.48, 0));
  }

  // Intermediate vertical balusters
  for (let x = ROOFTOP_ROOM.minX + 0.7; x <= ROOFTOP_ROOM.maxX - 0.7; x += 0.9) {
    for (const sz of [ROOFTOP_ROOM.minZ + 0.08, ROOFTOP_ROOM.maxZ - 0.08]) {
      rooftop.add(box(0.05, RH, 0.05, postWood, x, RH / 2, sz));
    }
  }
  for (let z = ROOFTOP_ROOM.minZ + 0.7; z <= ROOFTOP_ROOM.maxZ - 0.7; z += 0.9) {
    for (const sx of [ROOFTOP_ROOM.minX + 0.08, ROOFTOP_ROOM.maxX - 0.08]) {
      rooftop.add(box(0.05, RH, 0.05, postWood, sx, RH / 2, z));
    }
  }

  /* ---------------- 4 Tall Timber Corner Posts + Draped Fairy Lights ---------------- */
  const POLE_H = 2.65;
  const corners: [number, number][] = [
    [ROOFTOP_ROOM.minX + 0.12, ROOFTOP_ROOM.minZ + 0.12],
    [ROOFTOP_ROOM.maxX - 0.12, ROOFTOP_ROOM.minZ + 0.12],
    [ROOFTOP_ROOM.maxX - 0.12, ROOFTOP_ROOM.maxZ - 0.12],
    [ROOFTOP_ROOM.minX + 0.12, ROOFTOP_ROOM.maxZ - 0.12],
  ];
  for (const [px, pz] of corners) {
    rooftop.add(box(0.11, POLE_H, 0.11, railWood, px, POLE_H / 2, pz));
    rooftop.add(ball(0.06, M(PAL.brass, 0.4, 0.6), px, POLE_H + 0.04, pz, 10, 8));
  }

  // Span clickable string-lights around perimeter and across diagonal
  const fairyG = tag(new THREE.Group(), "rooftopFairy");
  const spans: [[number, number], [number, number]][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
    [corners[0], corners[2]],
  ];
  const bulbPts: THREE.Vector3[] = [];
  const wireMat = M(PAL.ink, 0.85);
  for (const [[x0, z0], [x1, z1]] of spans) {
    const pts: THREE.Vector3[] = [];
    const segs = 10;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const sag = 0.36 * 4 * u * (1 - u);
      const p = v(x0 + (x1 - x0) * u, POLE_H - sag, z0 + (z1 - z0) * u);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    fairyG.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.006, 5), wireMat));
    for (let i = 1; i <= 7; i++) {
      bulbPts.push(curve.getPointAt(i / 8));
    }
  }

  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.036, 10, 8),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    bulbPts.length,
  );
  const tints = [0xffd9a0, 0xffb86b, 0xffc2b0, 0xfff0c9];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bulbPts.length; i++) {
    const p = bulbPts[i];
    dummy.position.set(p.x, p.y - 0.035, p.z);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
    const c = new THREE.Color(tints[i % tints.length]);
    refs.fairyColors.push(c);
    bulbs.setColorAt(i, c);
  }
  bulbs.frustumCulled = false;
  fairyG.add(bulbs);
  for (const sz of [ROOFTOP_ROOM.minZ + 0.12, ROOFTOP_ROOM.maxZ - 0.12]) {
    fairyG.add(hitProxy(W, 0.42, 0.44, 0, POLE_H - 0.18, sz));
  }
  for (const sx of [ROOFTOP_ROOM.minX + 0.12, ROOFTOP_ROOM.maxX - 0.12]) {
    fairyG.add(hitProxy(0.44, 0.42, D, sx, POLE_H - 0.18, 0));
  }
  const diagHit = hitProxy(Math.hypot(W, D) - 0.4, 0.42, 0.5, 0, POLE_H - 0.24, 0);
  diagHit.rotation.y = Math.atan2(-(corners[2][1] - corners[0][1]), corners[2][0] - corners[0][0]);
  fairyG.add(diagHit);
  rooftop.add(fairyG);
  refs.items.rooftopFairy = fairyG;
  refs.fairyBulbs = bulbs;

  /* ---------------- Cozy Deck Rug & Corner Planter Boxes ---------------- */
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.18, 48),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, 0.05);
  rug.receiveShadow = true;
  rooftop.add(rug);

  const planterPos: [number, number][] = [
    [-2.8, -2.7],
    [2.8, -2.7],
    [-2.8, 2.7],
    [2.8, 2.7],
  ];
  const pr = rng(91);
  const bushMats = [M(PAL.leaf, 0.72), M(PAL.leafDark, 0.74), M(PAL.sage, 0.76)];
  for (const [px, pz] of planterPos) {
    const boxG = new THREE.Group();
    boxG.position.set(px, 0, pz);
    boxG.add(rbox(0.68, 0.34, 0.52, 0.03, M(PAL.terracotta, 0.9), 0, 0.17, 0));
    boxG.add(box(0.58, 0.04, 0.42, M(0x4b3328, 1), 0, 0.33, 0));
    for (let i = 0; i < 6; i++) {
      const bush = ball(
        0.13 + pr() * 0.06,
        bushMats[i % bushMats.length],
        (pr() - 0.5) * 0.34,
        0.38 + pr() * 0.14,
        (pr() - 0.5) * 0.22,
        12,
        10,
      );
      boxG.add(bush);
    }
    rooftop.add(boxG);
  }

  /* ---------------- 1. Rooftop Hatch (Return to Study) ---------------- */
  const hatch = tag(new THREE.Group(), "hatch");
  hatch.position.set(0, 0, 2.38);
  hatch.add(rbox(0.86, 0.09, 0.76, 0.02, railWood, 0, 0.045, 0));
  hatch.add(rbox(0.72, 0.05, 0.62, 0.015, M(PAL.woodLight, 0.72), 0, 0.1, 0));
  hatch.add(box(0.18, 0.02, 0.03, M(PAL.brass, 0.35, 0.65), 0, 0.132, -0.22));
  hatch.add(hitProxy(0.95, 0.42, 0.85, 0, 0.18, 0));
  rooftop.add(hatch);
  refs.items.hatch = hatch;

  /* ---------------- 2. Brass Stargazing Telescope (`telescope`) ---------------- */
  const scope = tag(new THREE.Group(), "telescope");
  scope.position.set(-2.15, 0, -2.15);
  scope.rotation.y = -0.65;
  const legMat = M(PAL.woodDark, 0.7);
  const brass = M(PAL.brass, 0.35, 0.65);
  const apex = v(0, 1.06, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    scope.add(rod(v(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32), apex, 0.02, legMat, 8));
  }
  scope.add(cyl(0.05, 0.06, 0.09, brass, 0, 1.09, 0, 12));
  const tubeG = new THREE.Group();
  tubeG.position.set(0, 1.18, 0);
  tubeG.rotation.x = 0.48;
  const barrel = cyl(0.075, 0.052, 0.76, M(PAL.cream, 0.55), 0, 0, 0, 20);
  barrel.rotation.x = Math.PI / 2;
  const hood = cyl(0.088, 0.076, 0.14, brass, 0, 0, -0.4, 20);
  hood.rotation.x = Math.PI / 2;
  const eyePiece = cyl(0.024, 0.032, 0.12, brass, 0, 0, 0.41, 14);
  eyePiece.rotation.x = Math.PI / 2;
  tubeG.add(barrel, hood, eyePiece);
  scope.add(tubeG, hitProxy(0.75, 1.45, 0.85, 0, 0.72, 0));
  rooftop.add(scope);
  refs.items.telescope = scope;

  /* ---------------- 3. Patio Game Table (`gameTable`) ---------------- */
  const table = tag(new THREE.Group(), "gameTable");
  table.position.set(-1.75, 0, 0.75);
  const tWood = M(PAL.wood, 0.68);
  table.add(cyl(0.48, 0.48, 0.045, tWood, 0, 0.64, 0, 28));
  table.add(cyl(0.05, 0.06, 0.62, railWood, 0, 0.31, 0, 14));
  table.add(cyl(0.24, 0.28, 0.04, railWood, 0, 0.02, 0, 18));

  // Two cute matching patio stools
  for (const [sx, sz] of [
    [-0.56, -0.25],
    [0.54, 0.32],
  ] as const) {
    table.add(cyl(0.17, 0.17, 0.05, M(PAL.blush, 0.9), sx, 0.41, sz, 16));
    table.add(cyl(0.035, 0.04, 0.38, railWood, sx, 0.19, sz, 10));
  }

  // Scattered memory cards on the tabletop
  const cardColors = [PAL.tomato, PAL.indigo, PAL.mustard, PAL.sage, PAL.cream];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const rad = i < 2 ? 0.1 : 0.26;
    const card = box(0.11, 0.008, 0.15, M(cardColors[i % cardColors.length], 0.82), Math.cos(a) * rad, 0.668, Math.sin(a) * rad);
    card.rotation.y = a + i * 0.4;
    table.add(card);
    refs.tableCards.push(card);
  }
  table.add(hitProxy(1.05, 0.85, 1.05, 0, 0.42, 0));
  rooftop.add(table);
  refs.items.gameTable = table;

  /* ---------------- 4. Lo-Fi Lantern Boombox Bench (`rhythmBox`) ---------------- */
  const rhythm = tag(new THREE.Group(), "rhythmBox");
  rhythm.position.set(2.1, 0, -1.75);
  rhythm.rotation.y = -0.55;
  rhythm.add(rbox(1.15, 0.06, 0.56, 0.02, tWood, 0, 0.39, 0));
  for (const sx of [-0.46, 0.46]) {
    for (const sz of [-0.2, 0.2]) {
      rhythm.add(cyl(0.025, 0.018, 0.38, railWood, sx, 0.19, sz, 8));
    }
  }
  // Retro rhythm boombox
  const boxG = new THREE.Group();
  boxG.position.set(-0.18, 0.42, 0);
  boxG.add(rbox(0.46, 0.24, 0.18, 0.035, M(PAL.indigo, 0.58), 0, 0.12, 0));
  for (const sx of [-0.14, 0.14]) {
    const spk = cyl(0.072, 0.072, 0.015, M(0x282132, 0.85), sx, 0.12, 0.088, 16);
    spk.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.008, 6, 20), M(PAL.mustard, 0.45));
    rim.position.set(sx, 0.12, 0.095);
    boxG.add(spk, rim);
  }
  boxG.add(box(0.28, 0.02, 0.025, M(PAL.cream, 0.7), 0, 0.26, 0));
  rhythm.add(boxG);

  // Warm paper lanterns on the right side of the bench
  for (const [lx, lz, h] of [
    [0.28, 0.05, 0.22],
    [0.44, -0.09, 0.16],
  ] as const) {
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xffe4bd,
      emissive: 0xffa64d,
      emissiveIntensity: 0.75,
      roughness: 0.7,
    });
    refs.lanternGlows.push(shadeMat);
    const lShade = cyl(0.075, 0.075, h, shadeMat, lx, 0.42 + h / 2 + 0.02, lz, 14);
    lShade.castShadow = false;
    rhythm.add(
      cyl(0.082, 0.082, 0.02, railWood, lx, 0.43, lz, 14),
      lShade,
      cyl(0.082, 0.082, 0.02, railWood, lx, 0.42 + h + 0.04, lz, 14),
    );
  }
  rhythm.add(hitProxy(1.22, 0.8, 0.68, 0, 0.38, 0));
  rooftop.add(rhythm);
  refs.items.rhythmBox = rhythm;

  /* ---------------- 5. Retro Capsule Machine (`gacha`) ---------------- */
  const gacha = tag(new THREE.Group(), "gacha");
  gacha.position.set(2.15, 0, 0.95);
  gacha.rotation.y = -0.82;
  // Base stand & dispenser body
  gacha.add(rbox(0.54, 0.62, 0.5, 0.04, M(PAL.tomato, 0.65), 0, 0.31, 0));
  gacha.add(rbox(0.46, 0.08, 0.42, 0.02, M(PAL.cream, 0.7), 0, 0.65, 0));
  gacha.add(box(0.24, 0.16, 0.04, M(PAL.ink, 0.5), 0, 0.2, 0.24));
  // Transparent glass globe
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0xeaf7ff,
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      depthWrite: false,
    }),
  );
  globe.position.set(0, 0.93, 0);
  globe.castShadow = false;
  gacha.add(globe);
  gacha.add(cyl(0.15, 0.18, 0.05, M(PAL.tomato, 0.6), 0, 1.2, 0, 18));
  gacha.add(ball(0.035, brass, 0, 1.25, 0, 10, 8));

  // Colorful capsules inside the globe
  const capPalette = [PAL.tomato, PAL.mustard, PAL.sage, PAL.blush, PAL.indigo, 0x8ad6cc];
  const gr = rng(55);
  for (let i = 0; i < 14; i++) {
    const a = gr() * Math.PI * 2;
    const rad = gr() * 0.15;
    const cy = 0.78 + gr() * 0.24;
    const cap = ball(0.046, M(capPalette[i % capPalette.length], 0.55), Math.cos(a) * rad, cy, Math.sin(a) * rad, 10, 8);
    cap.castShadow = false;
    cap.userData.baseY = cy;
    gacha.add(cap);
    refs.gachaCapsules.push(cap);
  }

  // Hidden splittable two-tone capsule for pull & crack-open reveal animation
  const dropRoot = new THREE.Group();
  dropRoot.position.set(0, 0.19, 0.26);
  dropRoot.visible = false;
  const topHalf = new THREE.Mesh(
    new THREE.SphereGeometry(0.064, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: PAL.tomato, roughness: 0.35 }),
  );
  const botHalf = new THREE.Mesh(
    new THREE.SphereGeometry(0.064, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    M(PAL.cream, 0.45),
  );
  topHalf.castShadow = botHalf.castShadow = false;
  dropRoot.add(topHalf, botHalf);
  gacha.add(dropRoot);
  refs.gachaDrop = { root: dropRoot, topHalf, botHalf };

  // Turnable crank knob on the front
  const knob = new THREE.Group();
  knob.position.set(0, 0.46, 0.255);
  const disc = cyl(0.062, 0.062, 0.025, brass, 0, 0, 0, 16);
  disc.rotation.x = Math.PI / 2;
  knob.add(disc, box(0.095, 0.022, 0.024, M(PAL.cream, 0.6), 0, 0, 0.02));
  gacha.add(knob);
  refs.gachaKnob = knob;

  gacha.add(hitProxy(0.68, 1.38, 0.64, 0, 0.65, 0));
  rooftop.add(gacha);
  refs.items.gacha = gacha;

  return { rooftop, refs };
}
