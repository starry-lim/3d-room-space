import * as THREE from "three";
import { discTexture } from "../kit";
import { WINDOW } from "../layout";
import { approach, ease, smooth } from "../math";
import type { RooftopRefs, RoomRefs } from "../room/types";

export type SkyPhase = "day" | "dusk" | "night";

const COLOR_KEYS = ["top", "bottom", "low", "halo", "sun", "hemiSky", "hemiGround", "disc"] as const;
const NUM_KEYS = ["sunI", "hemiI", "bounce", "stars", "beam", "dark", "exposure", "discSize", "haloI"] as const;
type Sky = Record<(typeof COLOR_KEYS)[number], THREE.Color> &
  Record<(typeof NUM_KEYS)[number], number> & { dir: THREE.Vector3 };
type SkySpec = Record<(typeof COLOR_KEYS)[number], number> &
  Record<(typeof NUM_KEYS)[number], number> & { dir: [number, number, number] };

function mkSky(o: SkySpec): Sky {
  const s = { dir: new THREE.Vector3(...o.dir).normalize() } as Sky;
  for (const k of COLOR_KEYS) s[k] = new THREE.Color(o[k]);
  for (const k of NUM_KEYS) s[k] = o[k];
  return s;
}

function lerpSky(dst: Sky, a: Sky, b: Sky, k: number) {
  for (const key of COLOR_KEYS) dst[key].lerpColors(a[key], b[key], k);
  for (const key of NUM_KEYS) dst[key] = a[key] + (b[key] - a[key]) * k;
  dst.dir.lerpVectors(a.dir, b.dir, k).normalize();
}

function cloneSky(a: Sky): Sky {
  const s = { dir: a.dir.clone() } as Sky;
  for (const k of COLOR_KEYS) s[k] = a[k].clone();
  for (const k of NUM_KEYS) s[k] = a[k];
  return s;
}

const SKIES: Record<SkyPhase, Sky> = {
  day: mkSky({
    top: 0x6db8e8, bottom: 0xfbe6c8, low: 0xa3d6f0, halo: 0xfff3d0, sun: 0xfff0d8, disc: 0xfffbe8,
    hemiSky: 0xe6f1ff, hemiGround: 0xd2b190,
    dir: [-0.42, 0.82, -0.6],
    sunI: 3.6, hemiI: 2.5, bounce: 1.2, stars: 0, beam: 0.55, dark: 0, exposure: 1.0, discSize: 12, haloI: 0.5,
  }),
  dusk: mkSky({
    top: 0x4c4a8e, bottom: 0xffb07c, low: 0x8d5d92, halo: 0xff7a3a, sun: 0xffa262, disc: 0xffd29a,
    hemiSky: 0xe6b9c6, hemiGround: 0xa87058,
    dir: [-0.3, 0.46, -0.84],
    sunI: 3.4, hemiI: 1.9, bounce: 0.9, stars: 0.2, beam: 1.0, dark: 0.35, exposure: 1.05, discSize: 16, haloI: 0.75,
  }),
  night: mkSky({
    top: 0x0a0d28, bottom: 0x2e2a5c, low: 0x151230, halo: 0x5a6ac4, sun: 0x8ea6ff, disc: 0xf4f6ff,
    hemiSky: 0x4a59a8, hemiGround: 0x241c33,
    dir: [-0.5, 0.74, -0.52],
    sunI: 1.7, hemiI: 1.45, bounce: 0.12, stars: 1, beam: 0.22, dark: 1, exposure: 1.12, discSize: 9, haloI: 0.4,
  }),
};

const PHASE_ORDER: SkyPhase[] = ["dusk", "night", "day"];
const SUN_TARGET = new THREE.Vector3(0.4, 0.8, -0.6);

/** Manages time-of-day sky dome, stars, drifting clouds, sunbeam, dust motes, and room lights. */
export class SkyLightSystem {
  lampOn = true;
  fairyOn = false;
  candleOn = false;

  private phase: SkyPhase = "dusk";
  private cur = cloneSky(SKIES.dusk);
  private skyFrom = cloneSky(SKIES.dusk);
  private skyTo = SKIES.dusk;
  private skyK = 1;
  private skyDur = 2.6;

  private hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private bounce = new THREE.PointLight(0xffd2a6, 0, 9, 2);
  private lamp = new THREE.SpotLight(0xffc88a, 0, 7, 0.95, 0.85, 1.7);
  private fairy = new THREE.PointLight(0xffb870, 0, 7.5, 2);
  private candle = new THREE.PointLight(0xff9a4a, 0, 4.5, 2);
  private rooftopLight = new THREE.PointLight(0xffbe72, 0, 12, 1.8);
  private rooftopLanternLight = new THREE.PointLight(0xffa852, 0, 5.5, 2);
  private roofSlab!: THREE.Mesh;
  private onRooftop = false;

  private skyMat!: THREE.ShaderMaterial;
  private starMats: THREE.PointsMaterial[] = [];
  private discTex: THREE.CanvasTexture;
  private disc!: THREE.Sprite;
  private clouds: { g: THREE.Group; speed: number }[] = [];
  private beam!: THREE.Mesh;
  private dust!: THREE.Points;
  private dustVel!: Float32Array;
  private lampGlow!: THREE.Sprite;
  private candleGlow!: THREE.Sprite;
  private boxGlow!: THREE.Sprite;
  private fairyGlow!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private rooftopFairyGlow!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private rooftopLanternGlow!: THREE.Sprite;

  private lampLevel = 0;
  private fairyLevel = 0;
  private candleLevel = 0;
  private _restLevel = 0;

  private tmpV = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private offBulb = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    private fxGroup: THREE.Group,
    private refs: RoomRefs,
    private rooftopRefs: RooftopRefs,
    private glowTex: THREE.CanvasTexture,
    mobile: boolean,
    private pixelRatio: number,
    private rand: () => number,
  ) {
    this.discTex = discTexture();
    this.buildLights(scene, mobile);
    this.buildSky(mobile);
  }

  get dark(): number {
    return this.cur.dark;
  }

  get restLevel(): number {
    return this._restLevel;
  }

  get boxGlowPosition(): THREE.Vector3 {
    return this.boxGlow.position;
  }

  glowAmount(): number {
    return smooth(0.55, 0.95, this.cur.dark);
  }

  setSky(phase: SkyPhase, dur = 2.6): void {
    if (phase === this.phase && this.skyK >= 1) return;
    this.skyFrom = cloneSky(this.cur);
    this.skyTo = SKIES[phase];
    this.skyK = 0;
    this.skyDur = dur;
    this.phase = phase;
  }

  cycleSky(): SkyPhase {
    const next = PHASE_ORDER[(PHASE_ORDER.indexOf(this.phase) + 1) % PHASE_ORDER.length];
    this.setSky(next);
    return next;
  }

  applySky(t: number, renderer: THREE.WebGLRenderer): void {
    const c = this.cur;
    const dir = this.tmpV.copy(c.dir);
    // the sun never quite sits still — shadows drift a little over time
    dir.x += Math.sin(t * 0.06) * 0.03;
    dir.y += Math.sin(t * 0.045 + 1) * 0.018;
    dir.normalize();

    this.sun.position.copy(SUN_TARGET).addScaledVector(dir, 16);
    this.sun.color.copy(c.sun);
    this.sun.intensity = c.sunI;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiI * (1 - 0.25 * this._restLevel);
    this.bounce.color.copy(c.sun).lerp(this.tmpC.setHex(0xffc890), 0.5);
    this.bounce.intensity = c.bounce * 3.6;
    renderer.toneMappingExposure = c.exposure;

    const u = this.skyMat.uniforms;
    u.top.value.copy(c.top);
    u.bottom.value.copy(c.bottom);
    u.low.value.copy(c.low);
    u.halo.value.copy(c.halo);
    u.haloI.value = c.haloI;
    u.sunDir.value.copy(dir);
    this.disc.position.copy(dir).multiplyScalar(170);
    this.disc.scale.setScalar(c.discSize);
    this.disc.material.color.copy(c.disc);

    this.starMats[0].opacity = c.stars * (0.7 + 0.3 * Math.sin(t * 1.3));
    this.starMats[1].opacity = c.stars * (0.7 + 0.3 * Math.sin(t * 0.9 + 2));

    (this.beam.material as THREE.MeshBasicMaterial).color.copy(c.sun).multiplyScalar(c.beam * 0.03);
    (this.dust.material as THREE.PointsMaterial).opacity = 0.15 + c.beam * 0.6;
    this.updateBeam(dir);

    this.refs.glowStarMat.emissiveIntensity = this.glowAmount() * (1.25 + 0.2 * Math.sin(t * 1.7));
    this.offBulb.setHex(0x8a8078).lerp(this.tmpC.setHex(0x2a2530), c.dark);
  }

  update(dt: number, t: number, resting: boolean, boxOpen: boolean, renderer: THREE.WebGLRenderer): void {
    if (this.skyK < 1) {
      this.skyK = Math.min(1, this.skyK + dt / this.skyDur);
      lerpSky(this.cur, this.skyFrom, this.skyTo, ease.inOut(this.skyK));
    }
    this.applySky(t, renderer);
    this.updateLights(dt, t, resting);

    /* shoebox glints so low camera angles are rewarded */
    this.boxGlow.material.opacity = (boxOpen ? 0.5 : 0.16) * (0.75 + 0.25 * Math.sin(t * 2.2));

    /* dust */
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const vel = this.dustVel;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += (vel[i] + Math.sin(t * 0.5 + i) * 0.012) * dt;
      arr[i + 1] += (vel[i + 1] + Math.sin(t * 0.7 + i * 1.3) * 0.01) * dt;
      arr[i + 2] += vel[i + 2] * dt;
      if (arr[i] < -1.2) arr[i] = 4.6;
      else if (arr[i] > 4.6) arr[i] = -1.2;
      if (arr[i + 1] < 0.2) arr[i + 1] = 2.75;
      else if (arr[i + 1] > 2.75) arr[i + 1] = 0.2;
      if (arr[i + 2] < -2.9) arr[i + 2] = -0.1;
      else if (arr[i + 2] > -0.1) arr[i + 2] = -2.9;
    }
    pos.needsUpdate = true;

    /* clouds */
    for (const c of this.clouds) {
      c.g.position.x += c.speed * dt;
      if (c.g.position.x > 17) c.g.position.x = -17;
    }
  }

  setLowShadowQuality(renderer: THREE.WebGLRenderer): void {
    for (const [light, size] of [
      [this.sun, 1024],
      [this.lamp, 512],
    ] as const) {
      light.shadow.mapSize.set(size, size);
      light.shadow.map?.dispose();
      light.shadow.map = null;
    }
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }

  setRoofShadowEnabled(enabled: boolean): void {
    this.onRooftop = !enabled;
    this.roofSlab.visible = enabled;
    // Keep window light beams, shoebox glint & dust strictly for the study interior
    this.beam.visible = enabled;
    this.dust.visible = enabled;
    this.boxGlow.visible = enabled;
    this.rooftopFairyGlow.visible = !enabled;
    this.rooftopLanternGlow.visible = !enabled;
  }

  getOwnedTextures(): THREE.Texture[] {
    return [this.discTex];
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
    this.lamp.shadow.map?.dispose();
    this.discTex.dispose();
  }

  private buildLights(scene: THREE.Scene, mobile: boolean): void {
    const size = mobile ? 1024 : 2048;
    const { sun, lamp } = this;
    sun.castShadow = true;
    sun.shadow.mapSize.set(size, size);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -7.5;
    sc.right = sc.top = 7.5;
    sc.near = 2;
    sc.far = 30;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    sun.target.position.copy(SUN_TARGET);

    this.bounce.position.set(1.0, 1.6, -0.5);

    // desk lamp: a real spotlight sitting inside the shade
    const head = this.refs.lampHead.getWorldPosition(new THREE.Vector3());
    const aim = new THREE.Vector3(-0.22, 0.79, -2.39);
    lamp.position.copy(head).addScaledVector(aim.clone().sub(head).normalize(), 0.08);
    lamp.target.position.copy(aim);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    lamp.shadow.bias = -0.002;
    lamp.shadow.camera.near = 0.12;
    lamp.shadow.camera.far = 7;

    this.fairy.position.set(-1.8, 2.35, -0.9);
    this.candle.position.set(0.5, 1.5, -2.72);
    this.rooftopLight.position.set(0, 2.5, 0);
    if (this.rooftopRefs.items.rhythmBox) {
      this.rooftopRefs.items.rhythmBox.localToWorld(this.rooftopLanternLight.position.set(0.36, 0.72, -0.02));
    } else {
      this.rooftopLanternLight.position.set(2.25, 0.85, -1.72);
    }

    scene.add(
      this.hemi,
      sun,
      sun.target,
      this.bounce,
      lamp,
      lamp.target,
      this.fairy,
      this.candle,
      this.rooftopLight,
      this.rooftopLanternLight,
    );

    // The diorama has no roof, so without this the sun would flood the whole floor.
    // This slab draws nothing on screen but still casts a shadow, which means
    // daylight and moonlight can only get in through the window.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.1, 7.2),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    roof.position.set(0.99, 3.52, 0.19);
    roof.castShadow = true;
    this.roofSlab = roof;
    this.fxGroup.add(roof);
  }

  private buildSky(mobile: boolean): void {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color() },
        bottom: { value: new THREE.Color() },
        low: { value: new THREE.Color() },
        halo: { value: new THREE.Color() },
        haloI: { value: 0.5 },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 low; uniform vec3 halo; uniform vec3 sunDir; uniform float haloI;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          // three stops: haze far below the room, the horizon band, the zenith
          vec3 c = mix(low, bottom, smoothstep(-0.85, -0.1, d.y));
          c = mix(c, top, smoothstep(0.02, 0.75, d.y));
          float s = max(dot(d, sunDir), 0.0);
          c += halo * (pow(s, 5.0) * 0.55 + pow(s, 40.0) * 0.6) * haloI;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 18), this.skyMat);
    dome.frustumCulled = false;
    dome.renderOrder = -2;
    this.fxGroup.add(dome);

    // two star layers twinkling out of phase
    const soft = this.glowTex;
    for (let layer = 0; layer < 2; layer++) {
      const n = 240;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = this.rand() * 2 - 1;
        const a = this.rand() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        pos.set([Math.cos(a) * s * 180, u * 180, Math.sin(a) * s * 180], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: (layer ? 3.2 : 4.6) * this.pixelRatio,
        sizeAttenuation: false,
        map: soft,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: layer ? 0xcfd8ff : 0xfff3d6,
        toneMapped: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = -1;
      this.starMats.push(mat);
      this.fxGroup.add(pts);
    }

    this.disc = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.discTex, depthWrite: false, toneMapped: false, transparent: true }),
    );
    this.disc.renderOrder = -1;
    this.fxGroup.add(this.disc);

    // low-poly clouds drifting behind and below the floating room
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const spots: [number, number, number][] = [
      [-10, 0.6, -7],
      [-3, -3.2, -11],
      [7, 3.6, -12],
      [-12, 3.4, 4],
      [8, -5.4, -4],
    ];
    spots.forEach(([x, y, z], i) => {
      const g = new THREE.Group();
      const n = 3 + Math.floor(this.rand() * 3);
      for (let j = 0; j < n; j++) {
        const s = 0.7 + this.rand() * 0.7;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), cloudMat);
        m.position.set((j - (n - 1) / 2) * 0.95, this.rand() * 0.3, this.rand() * 0.6);
        m.scale.y = 0.68;
        g.add(m);
      }
      g.position.set(x, y, z);
      g.scale.setScalar(0.85 + i * 0.08);
      this.clouds.push({ g, speed: 0.05 + this.rand() * 0.07 });
      this.fxGroup.add(g);
    });

    /* light shaft from the window — additive slices that fade toward the floor */
    const QUADS = 8;
    const geo = new THREE.BufferGeometry();
    const col = new Float32Array(QUADS * 4 * 3);
    const idx: number[] = [];
    for (let q = 0; q < QUADS; q++) {
      col.set([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0], q * 12);
      const o = q * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(QUADS * 4 * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.beam = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.beam.frustumCulled = false;
    this.fxGroup.add(this.beam);

    /* dust motes hanging in the light */
    const N = mobile ? 70 : 120;
    const dPos = new Float32Array(N * 3);
    this.dustVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      dPos.set([-1.2 + this.rand() * 3.4, 0.25 + this.rand() * 2.5, -2.9 + this.rand() * 2.8], i * 3);
      this.dustVel.set([(this.rand() - 0.5) * 0.05, (this.rand() - 0.5) * 0.03, (this.rand() - 0.5) * 0.05], i * 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        size: 0.05,
        map: soft,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffe9c4,
        toneMapped: false,
      }),
    );
    this.dust.frustumCulled = false;
    this.fxGroup.add(this.dust);

    /* glows */
    const mkGlow = (color: number, size: number) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: soft,
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      s.scale.setScalar(size);
      this.fxGroup.add(s);
      return s;
    };
    this.lampGlow = mkGlow(0xffc070, 0.75);
    this.refs.lampHead.getWorldPosition(this.lampGlow.position);
    this.lampGlow.position.y -= 0.05;
    this.candleGlow = mkGlow(0xff9a40, 0.5);
    this.refs.flame.getWorldPosition(this.candleGlow.position);
    this.boxGlow = mkGlow(0xffd27a, 0.7);
    this.refs.box.getWorldPosition(this.boxGlow.position);
    this.boxGlow.position.y += 0.12;

    const bulbs = this.refs.fairyBulbs;
    const fp = new Float32Array(bulbs.count * 3);
    const fc = new Float32Array(bulbs.count * 3);
    const m = new THREE.Matrix4();
    for (let i = 0; i < bulbs.count; i++) {
      bulbs.getMatrixAt(i, m);
      this.tmpV.setFromMatrixPosition(m);
      fp.set([this.tmpV.x + 0.03, this.tmpV.y, this.tmpV.z], i * 3);
      this.refs.fairyColors[i].toArray(fc, i * 3);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    fg.setAttribute("color", new THREE.BufferAttribute(fc, 3));
    this.fairyGlow = new THREE.Points(
      fg,
      new THREE.PointsMaterial({
        size: 0.42,
        map: soft,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.fairyGlow.frustumCulled = false;
    this.fxGroup.add(this.fairyGlow);

    const rtBulbs = this.rooftopRefs.fairyBulbs;
    const rtPos = new Float32Array(rtBulbs.count * 3);
    const rtCol = new Float32Array(rtBulbs.count * 3);
    for (let i = 0; i < rtBulbs.count; i++) {
      rtBulbs.getMatrixAt(i, m);
      this.tmpV.setFromMatrixPosition(m);
      rtPos.set([this.tmpV.x, this.tmpV.y, this.tmpV.z], i * 3);
      this.rooftopRefs.fairyColors[i].toArray(rtCol, i * 3);
    }
    const rtGeo = new THREE.BufferGeometry();
    rtGeo.setAttribute("position", new THREE.BufferAttribute(rtPos, 3));
    rtGeo.setAttribute("color", new THREE.BufferAttribute(rtCol, 3));
    this.rooftopFairyGlow = new THREE.Points(
      rtGeo,
      new THREE.PointsMaterial({
        size: 0.52,
        map: soft,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.rooftopFairyGlow.frustumCulled = false;
    this.rooftopFairyGlow.visible = false;
    this.fxGroup.add(this.rooftopFairyGlow);

    this.rooftopLanternGlow = mkGlow(0xffb45c, 0.85);
    if (this.rooftopRefs.items.rhythmBox) {
      this.rooftopRefs.items.rhythmBox.localToWorld(this.rooftopLanternGlow.position.set(0.36, 0.56, -0.02));
    } else {
      this.rooftopLanternGlow.position.set(2.25, 0.56, -1.72);
    }
    this.rooftopLanternGlow.visible = false;
  }

  private updateBeam(toSun: THREE.Vector3): void {
    const pos = this.beam.geometry.attributes.position as THREE.BufferAttribute;
    const { x0, x1, y0, y1, z } = WINDOW;
    const dx = -toSun.x;
    const dy = Math.min(-0.08, -toSun.y);
    const dz = -toSun.z;
    let i = 0;
    const put = (x: number, y: number, far: boolean) => {
      const t = far ? Math.min(y / -dy, 7.5) : 0;
      pos.setXYZ(i++, x + dx * t, y + dy * t, z + dz * t);
    };
    const quad = (ax: number, ay: number, bx: number, by: number) => {
      put(ax, ay, false);
      put(bx, by, false);
      put(bx, by, true);
      put(ax, ay, true);
    };
    for (let s = 0; s < 5; s++) {
      const x = x0 + ((x1 - x0) * s) / 4;
      quad(x, y0, x, y1);
    }
    for (let s = 0; s < 3; s++) {
      const y = y0 + ((y1 - y0) * s) / 2;
      quad(x0, y, x1, y);
    }
    pos.needsUpdate = true;
  }

  private updateLights(dt: number, t: number, resting: boolean): void {
    const { refs } = this;
    this.lampLevel = approach(this.lampLevel, this.lampOn ? 1 : 0, 9, dt);
    this.fairyLevel = approach(this.fairyLevel, this.fairyOn ? 1 : 0, 5, dt);
    this.candleLevel = approach(this.candleLevel, this.candleOn ? 1 : 0, 7, dt);
    this._restLevel = approach(this._restLevel, resting ? 1 : 0, 2, dt);

    // lamp reads brighter as the room gets darker, like eyes adjusting
    const dark = this.cur.dark;
    const studyFade = this.onRooftop ? 0 : 1;
    this.lamp.intensity = studyFade * this.lampLevel * (4.5 + 10 * dark);
    refs.lampBulb.emissiveIntensity = this.lampLevel * 3.2;
    this.lampGlow.material.opacity = studyFade * this.lampLevel * (0.25 + 0.4 * dark);

    const flick = 0.82 + 0.1 * Math.sin(t * 11.3) + 0.08 * Math.sin(t * 23.7 + 1.3) + 0.05 * Math.sin(t * 5.1);
    this.candle.intensity = studyFade * this.candleLevel * flick * (3 + 4.5 * dark);
    this.candleGlow.material.opacity = studyFade * this.candleLevel * flick * 0.7;
    refs.flame.visible = this.candleLevel > 0.03;
    refs.flame.scale.set(0.75 * this.candleLevel, (1.4 + 0.5 * flick) * this.candleLevel, 0.75 * this.candleLevel);
    refs.flame.position.x = Math.sin(t * 7.1) * 0.003;

    this.fairy.intensity = studyFade * this.fairyLevel * (3.5 + 5.5 * dark) * (0.94 + 0.06 * Math.sin(t * 2.1));
    this.fairyGlow.material.opacity = studyFade * this.fairyLevel * (0.3 + 0.35 * dark);
    this.rooftopLight.intensity = this.onRooftop ? (2.4 + 6.2 * dark) * (0.96 + 0.04 * Math.sin(t * 1.9)) : 0;
    this.rooftopLanternLight.intensity = this.onRooftop ? (1.4 + 3.8 * dark) * (0.93 + 0.07 * Math.sin(t * 3.1)) : 0;
    this.rooftopFairyGlow.material.opacity = this.onRooftop ? (0.34 + 0.46 * dark) * (0.94 + 0.06 * Math.sin(t * 2.1)) : 0;
    this.rooftopLanternGlow.material.opacity = this.onRooftop ? (0.28 + 0.44 * dark) * (0.92 + 0.08 * Math.sin(t * 3.1)) : 0;
    const bulbs = refs.fairyBulbs;
    for (let i = 0; i < bulbs.count; i++) {
      const tw = 0.8 + 0.2 * Math.sin(t * 2.4 + i * 1.9) + 0.12 * Math.sin(t * 5.3 + i * 0.7);
      this.tmpC.copy(refs.fairyColors[i]).multiplyScalar(tw * 1.25);
      this.tmpC.lerpColors(this.offBulb, this.tmpC, this.fairyLevel);
      bulbs.setColorAt(i, this.tmpC);
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
  }
}
