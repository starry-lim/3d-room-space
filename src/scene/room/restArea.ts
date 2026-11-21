import * as THREE from "three";
import { M, PAL, ball, blanketTexture, box, cyl, globeTexture, hitProxy, rbox, rng, rod, rugTexture, v } from "../kit";
import { FURNITURE_POS } from "../layout";
import { buildOpenBook, tag, type RoomRefs } from "./types";

export function buildBed(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "bed");
  g.position.set(...FURNITURE_POS.bed);
  const wood = M(PAL.wood, 0.7);

  for (const x of [-0.62, 0.62]) for (const z of [-1.24, 1.24]) g.add(box(0.09, 0.22, 0.09, wood, x, 0.11, z));
  g.add(rbox(1.4, 0.2, 2.65, 0.03, wood, 0, 0.31, 0));
  g.add(rbox(1.4, 0.92, 0.09, 0.04, wood, 0, 0.72, -1.28));
  g.add(rbox(1.32, 0.2, 2.5, 0.06, M(PAL.linen, 0.95), 0, 0.5, 0.03));

  const tex = blanketTexture();
  tex.repeat.set(1, 5);
  const blanket = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const texSide = blanketTexture();
  texSide.repeat.set(5, 1);
  texSide.rotation = Math.PI / 2;
  const blanketSide = new THREE.MeshStandardMaterial({ map: texSide, roughness: 1 });
  g.add(rbox(1.37, 0.13, 1.74, 0.06, blanket, 0, 0.585, 0.45));
  g.add(rbox(0.05, 0.36, 1.74, 0.02, blanketSide, 0.685, 0.45, 0.45));
  g.add(rbox(1.37, 0.36, 0.05, 0.02, M(PAL.indigo, 1), 0, 0.45, 1.31));
  g.add(rbox(1.38, 0.145, 0.3, 0.06, M(0xfffaf0, 0.95), 0, 0.59, -0.5));

  const pillow = rbox(0.74, 0.16, 0.44, 0.075, M(0xfffaf0, 0.95), -0.06, 0.67, -0.95);
  pillow.rotation.y = 0.07;
  g.add(pillow);
  const cushion = rbox(0.4, 0.4, 0.13, 0.06, M(PAL.mustard, 0.95), 0.36, 0.8, -1.15);
  cushion.rotation.set(-0.28, 0, 0.12);
  g.add(cushion);

  // the sleeper under the blanket — only swells up while resting
  const lump = ball(1, blanket, -0.06, 0.6, 0.28, 20, 12);
  lump.geometry.rotateX(Math.PI / 2); // poles along the bed, so the stripes run across it like the blanket
  lump.scale.set(0.3, 0.001, 0.62);
  lump.visible = false;
  g.add(lump);

  room.add(g);
  refs.items.bed = g;
  refs.bedLump = lump;
  refs.pillow = pillow;

  /* secret: a shoebox tucked under the bed */
  const sb = tag(new THREE.Group(), "box");
  sb.position.set(-1.84, 0, -1.15);
  sb.rotation.y = 0.2;
  const kraft = M(0xc9a473, 0.9);
  sb.add(box(0.36, 0.12, 0.24, kraft, 0, 0.06, 0));
  const lid = new THREE.Group();
  lid.position.set(0, 0.12, -0.125);
  lid.add(box(0.38, 0.035, 0.26, M(PAL.tomato, 0.8), 0, 0.012, 0.125));
  sb.add(lid, hitProxy(0.44, 0.2, 0.32, 0, 0.1, 0));
  room.add(sb);
  refs.items.box = sb;
  refs.box = sb;
  refs.boxLid = lid;
}

export function buildConsoleTable(room: THREE.Group, refs: RoomRefs) {
  const g = new THREE.Group();
  g.position.set(...FURNITURE_POS.consoleTable);
  const wood = M(PAL.wood, 0.7);
  g.add(rbox(0.46, 0.46, 1.4, 0.02, wood, 0, 0.39, 0));
  for (const x of [-0.17, 0.17]) for (const z of [-0.6, 0.6]) g.add(cyl(0.022, 0.015, 0.16, M(PAL.woodDark), x, 0.08, z, 8));
  for (const z of [-0.34, 0.34]) {
    g.add(rbox(0.02, 0.38, 0.64, 0.008, M(PAL.woodLight, 0.7), 0.235, 0.39, z));
    g.add(ball(0.02, M(PAL.brass, 0.4, 0.6), 0.255, 0.42, z > 0 ? z - 0.26 : z + 0.26, 8, 6));
  }
  const TOP = 0.62;

  /* radio — faces +x (into the room) */
  const radio = tag(new THREE.Group(), "radio");
  radio.position.set(0.02, TOP, -0.3);
  radio.rotation.y = Math.PI / 2 - 0.18;
  radio.add(rbox(0.44, 0.26, 0.17, 0.04, M(PAL.cream, 0.6), 0, 0.13, 0));
  const grille = cyl(0.085, 0.085, 0.012, M(0x5b4034, 0.9), -0.1, 0.13, 0.083);
  grille.rotation.x = Math.PI / 2;
  radio.add(grille);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.008, 8, 28), M(PAL.brass, 0.4, 0.6));
  ring.position.set(-0.1, 0.13, 0.088);
  radio.add(ring);
  radio.add(box(0.15, 0.055, 0.012, M(PAL.mustard, 0.5), 0.11, 0.18, 0.083));
  for (const x of [0.07, 0.15]) {
    const knob = cyl(0.02, 0.02, 0.02, M(PAL.tomato, 0.5), x, 0.085, 0.09, 12);
    knob.rotation.x = Math.PI / 2;
    radio.add(knob);
  }
  radio.add(rod(v(0.17, 0.26, -0.04), v(0.29, 0.6, -0.04), 0.004, M(PAL.metal, 0.4, 0.6), 5));
  radio.add(ball(0.01, M(PAL.metal, 0.4, 0.6), 0.29, 0.6, -0.04, 6, 4));
  radio.add(hitProxy(0.5, 0.36, 0.26, 0, 0.16, 0));
  g.add(radio);
  refs.items.radio = radio;
  refs.radio = radio;

  /* globe */
  const globe = tag(new THREE.Group(), "globe");
  globe.position.set(0.02, TOP, 0.38);
  globe.add(cyl(0.075, 0.09, 0.02, M(PAL.woodDark), 0, 0.01, 0));
  globe.add(cyl(0.012, 0.012, 0.06, M(PAL.brass, 0.4, 0.6), 0, 0.04, 0, 8));
  const tilt = new THREE.Group();
  tilt.position.y = 0.21;
  tilt.rotation.z = 0.41;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.007, 6, 28, Math.PI), M(PAL.brass, 0.4, 0.6));
  arc.rotation.z = -Math.PI / 2;
  arc.rotation.y = Math.PI / 2;
  tilt.add(arc);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 28, 20),
    new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.6 }),
  );
  sphere.castShadow = true;
  tilt.add(sphere);
  globe.add(tilt, hitProxy(0.36, 0.44, 0.36, 0, 0.2, 0));
  g.add(globe);
  refs.items.globe = globe;
  refs.globe = sphere;

  room.add(g);
}

export function buildPlant(room: THREE.Group, refs: RoomRefs) {
  const g = tag(new THREE.Group(), "plant");
  g.position.set(...FURNITURE_POS.plant);
  const terra = M(PAL.terracotta, 0.9);
  g.add(cyl(0.26, 0.19, 0.4, terra, 0, 0.2, 0), cyl(0.285, 0.285, 0.07, terra, 0, 0.4, 0));
  g.add(cyl(0.25, 0.25, 0.02, M(0x4b3328, 1), 0, 0.432, 0));

  const leaves = new THREE.Group();
  leaves.position.y = 0.43;
  const stems: THREE.Object3D[] = [];
  const flowers: THREE.Group[] = [];
  const r = rng(3);
  const stemMat = M(PAL.leafDark, 0.8);
  const leafMats = [M(PAL.leaf, 0.65), M(PAL.leafDark, 0.65), M(0x6fae6a, 0.65)];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const turn = new THREE.Group();
    turn.rotation.y = (i / N) * Math.PI * 2 + r() * 0.5;
    const tilt = new THREE.Group();
    const lean = 0.18 + r() * 0.55;
    tilt.rotation.z = -lean;
    tilt.userData.base = -lean;
    tilt.userData.phase = r() * 6;
    const len = 0.55 + r() * 0.65;
    tilt.add(cyl(0.011, 0.017, len, stemMat, 0, len / 2, 0, 6));
    const s = 0.8 + r() * 0.5;
    const leaf = ball(1, leafMats[i % 3], 0.13 * s, len - 0.03, 0, 12, 8);
    leaf.scale.set(0.21 * s, 0.014, 0.15 * s);
    leaf.rotation.z = -0.55;
    tilt.add(leaf);
    if (i % 3 === 0) {
      const f = new THREE.Group();
      f.position.set(0.02, len + 0.06, 0);
      const petal = M(0xf5a9c0, 0.7);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        f.add(ball(0.04, petal, Math.cos(a) * 0.048, 0, Math.sin(a) * 0.048, 8, 6));
      }
      f.add(ball(0.034, M(PAL.mustard, 0.6), 0, 0.012, 0, 8, 6));
      f.visible = false;
      f.scale.setScalar(0.001);
      tilt.add(f);
      flowers.push(f);
    }
    turn.add(tilt);
    leaves.add(turn);
    stems.push(tilt);
  }
  g.add(leaves);
  room.add(g);
  refs.items.plant = g;
  refs.plant = { leaves, stems, flowers };
}

export function buildFloorLounge(room: THREE.Group, refs: RoomRefs) {
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 56),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.7, 0.006, 0.55);
  rug.receiveShadow = true;
  room.add(rug);

  const pouf = tag(new THREE.Group(), "pouf");
  pouf.position.set(...FURNITURE_POS.pouf);
  const p = ball(0.44, M(0x7f93cf, 1), 0, 0.23, 0, 24, 14);
  p.scale.y = 0.56;
  pouf.add(p, ball(0.04, M(PAL.cream, 0.8), 0, 0.47, 0, 8, 6), hitProxy(0.95, 0.62, 0.95, 0, 0.28, 0));
  room.add(pouf);
  refs.items.pouf = pouf;

  /* green open book resting next to the pouf */
  const openBook = tag(new THREE.Group(), "poufBook");
  openBook.position.set(1.63, 0, 2.0);
  openBook.rotation.y = 0.5;
  openBook.add(box(0.32, 0.016, 0.22, M(PAL.sage, 0.8), 0, 0.012, 0));
  const linenMat = M(PAL.linen, 0.95);
  const pageL = box(0.15, 0.012, 0.2, linenMat, -0.077, 0.026, 0);
  const pageR = box(0.15, 0.012, 0.2, linenMat, 0.077, 0.026, 0);
  pageL.rotation.z = -0.06;
  pageR.rotation.z = 0.06;
  openBook.add(pageL, pageR, hitProxy(0.42, 0.16, 0.34, 0, 0.05, 0));
  room.add(openBook);
  refs.items.poufBook = openBook;
  refs.poufBookFloor = openBook;

  /* open lap book held while reading on the pouf */
  const poufLapBook = buildOpenBook({
    id: "poufBook",
    coverColor: PAL.sage,
    coverRoughness: 0.82,
    coverSize: [0.32, 0.012, 0.22],
    pageSize: [0.148, 0.014, 0.2],
    pageOffsetX: 0.076,
    pageTilt: 0.05,
    inkWidth: 0.1,
    inkStartZ: -0.06,
    inkStepZ: 0.04,
    flipSize: [0.145, 0.003, 0.195],
    flipOffsetX: 0.073,
    hitBox: [0.38, 0.18, 0.28, 0, 0.04, 0],
  });
  poufLapBook.root.position.set(1.99, 0.66, 1.45);
  poufLapBook.root.rotation.set(0.42, 0.72, 0, "YXZ");
  room.add(poufLapBook.root);
  refs.poufLapBook = poufLapBook;

  const soleMat = M(PAL.woodDark, 0.92);
  const insoleMat = M(PAL.cream, 0.96);
  const upperMat = M(PAL.terracotta, 0.95);
  const ribMat = M(0xb45e40, 0.95);
  const cuffMat = M(PAL.cream, 1);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xb8a391, roughness: 1, side: THREE.BackSide });
  const cavityMat = M(0x8e796a, 1);

  for (const [side, x, z, rot] of [
    [-1, -1.32, -0.86, 1.48],
    [1, -1.29, -0.69, 1.66],
  ] as const) {
    const s = new THREE.Group();
    s.position.set(x, 0, z);
    s.rotation.y = rot;

    const soleShape = new THREE.Shape();
    const arch = side * 0.005;
    soleShape.moveTo(0, 0.115);
    soleShape.bezierCurveTo(0.038, 0.115, 0.042, 0.075, 0.041 - arch, 0.02);
    soleShape.bezierCurveTo(0.047, -0.025, 0.052, -0.08, 0.032, -0.112);
    soleShape.bezierCurveTo(0.015, -0.124, -0.015, -0.124, -0.032, -0.112);
    soleShape.bezierCurveTo(-0.052, -0.08, -0.047, -0.025, -0.041 - arch, 0.02);
    soleShape.bezierCurveTo(-0.042, 0.075, -0.038, 0.115, 0, 0.115);

    const outsoleGeo = new THREE.ExtrudeGeometry(soleShape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
      curveSegments: 16,
    });
    outsoleGeo.rotateX(-Math.PI / 2);
    const outsole = new THREE.Mesh(outsoleGeo, soleMat);
    outsole.position.y = 0.002;
    outsole.castShadow = outsole.receiveShadow = true;

    const insoleGeo = new THREE.ExtrudeGeometry(soleShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.0015,
      bevelSegments: 2,
      curveSegments: 16,
    });
    insoleGeo.rotateX(-Math.PI / 2);
    const insole = new THREE.Mesh(insoleGeo, insoleMat);
    insole.scale.set(0.92, 1, 0.94);
    insole.position.y = 0.013;
    insole.castShadow = insole.receiveShadow = true;

    const heelTag = box(0.034, 0.002, 0.018, upperMat, 0, 0.0235, -0.072);
    heelTag.castShadow = false;

    const upper = new THREE.Group();
    upper.position.set(0, 0.019, 0);
    upper.scale.set(1, 0.78, 1);

    const archGeo = new THREE.CylinderGeometry(0.046, 0.043, 0.078, 18, 1, true, -Math.PI / 2, Math.PI);
    archGeo.rotateX(-Math.PI / 2);
    const archMesh = new THREE.Mesh(archGeo, upperMat);
    archMesh.position.set(0, 0, 0.029);
    archMesh.castShadow = archMesh.receiveShadow = true;

    const toeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.043, 16, 10, 0, Math.PI, 0, Math.PI / 2),
      upperMat,
    );
    toeCap.position.set(0, 0, 0.068);
    toeCap.scale.z = 1.12;
    toeCap.castShadow = toeCap.receiveShadow = true;

    const innerArchGeo = new THREE.CylinderGeometry(0.042, 0.039, 0.078, 16, 1, true, -Math.PI / 2, Math.PI);
    innerArchGeo.rotateX(-Math.PI / 2);
    const innerArch = new THREE.Mesh(innerArchGeo, innerMat);
    innerArch.position.set(0, 0, 0.029);

    const innerCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.039, 14, 8, 0, Math.PI, 0, Math.PI / 2),
      innerMat,
    );
    innerCap.position.set(0, 0, 0.068);
    innerCap.scale.z = 1.12;

    const pad = cyl(0.034, 0.034, 0.002, cavityMat, 0, 0.0055, 0.046, 14);
    pad.scale.z = 1.45;
    pad.castShadow = false;

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0095, 10, 20, Math.PI), cuffMat);
    cuff.position.set(0, 0, -0.01);
    cuff.castShadow = cuff.receiveShadow = true;

    const ribGeo = new THREE.TorusGeometry(0.045, 0.0022, 6, 18, Math.PI);
    for (const rz of [0.016, 0.042]) {
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(0, 0, rz);
      upper.add(rib);
    }

    upper.add(archMesh, toeCap, innerArch, innerCap, pad, cuff);
    s.add(outsole, insole, heelTag, upper);
    room.add(s);
  }
}
