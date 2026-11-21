import * as THREE from "three";
import { glowTexture, glyphTextures, hintTexture, type Glyph } from "../kit";

interface Floater {
  s: THREE.Sprite;
  life: number;
  max: number;
  vel: THREE.Vector3;
  grav: number;
  size: number;
  grow: number;
}

export interface EmitOptions {
  colors: number[];
  spread: number;
  up: number;
  grav: number;
  size: number;
  life: number;
  grow?: number;
}

/** Manages pooled glyph particles, mug steam sprites, and shared HUD/FX textures. */
export class FxSystem {
  readonly glowTex: THREE.CanvasTexture;
  readonly hintTex: THREE.CanvasTexture;
  private readonly glyphs: Record<Glyph, THREE.CanvasTexture>;
  private readonly floaters: Floater[] = [];
  private readonly steam: THREE.Sprite[] = [];
  private readonly mugTop = new THREE.Vector3();

  constructor(
    fxGroup: THREE.Group,
    mug: THREE.Group,
    private rand: () => number,
  ) {
    this.glowTex = glowTexture();
    this.hintTex = hintTexture();
    this.glyphs = glyphTextures();

    /* steam over the mug */
    mug.getWorldPosition(this.mugTop);
    this.mugTop.y += 0.13;
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      this.steam.push(s);
      fxGroup.add(s);
    }

    /* pooled glyph sprites: hearts, Zs, notes, sparkles, drops */
    for (let i = 0; i < 56; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glyphs.spark,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      s.visible = false;
      fxGroup.add(s);
      this.floaters.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), grav: 0, size: 0.1, grow: 0 });
    }
  }

  emit(glyph: Glyph, pos: THREE.Vector3, n: number, o: EmitOptions): void {
    for (const f of this.floaters) {
      if (n <= 0) break;
      if (f.life > 0) continue;
      n--;
      const mat = f.s.material;
      mat.map = this.glyphs[glyph];
      mat.color.setHex(o.colors[Math.floor(this.rand() * o.colors.length)]);
      mat.rotation = glyph === "spark" || glyph === "note" ? (this.rand() - 0.5) * 0.8 : 0;
      f.s.position.copy(pos);
      f.s.position.x += (this.rand() - 0.5) * 0.12;
      f.s.position.z += (this.rand() - 0.5) * 0.12;
      f.vel.set((this.rand() - 0.5) * o.spread, o.up * (0.6 + this.rand() * 0.6), (this.rand() - 0.5) * o.spread);
      f.grav = o.grav;
      f.size = o.size * (0.75 + this.rand() * 0.5);
      f.grow = o.grow ?? 0;
      f.life = f.max = o.life * (0.8 + this.rand() * 0.4);
      f.s.visible = true;
    }
  }

  updateFloaters(dt: number): void {
    for (const f of this.floaters) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.s.visible = false;
        continue;
      }
      const k = 1 - f.life / f.max;
      f.vel.y -= f.grav * dt;
      f.vel.multiplyScalar(1 - 0.9 * dt);
      f.s.position.addScaledVector(f.vel, dt);
      const size = (f.size + f.grow * k) * Math.min(1, k * 7);
      f.s.scale.setScalar(size);
      f.s.material.opacity = Math.min(1, (1 - k) * 2.5);
    }
  }

  updateSteam(t: number, mug: THREE.Group, firstPersonSip: boolean): void {
    mug.updateMatrixWorld();
    this.mugTop.set(0, 0.115, 0);
    mug.localToWorld(this.mugTop);
    const steamOpacity = firstPersonSip ? 0.07 : 0.3;
    this.steam.forEach((s, i) => {
      const k = (t * 0.3 + i / this.steam.length) % 1;
      s.position.set(
        this.mugTop.x + Math.sin(k * 6 + i * 1.7) * 0.025,
        this.mugTop.y + k * 0.36,
        this.mugTop.z + Math.cos(k * 5 + i * 2.3) * 0.025,
      );
      s.scale.setScalar(0.07 + k * 0.15);
      s.material.opacity = Math.sin(Math.PI * k) * steamOpacity;
    });
  }

  /** All textures allocated by FxSystem (so unused glyph textures are also disposed cleanly). */
  getOwnedTextures(): THREE.Texture[] {
    return [this.glowTex, this.hintTex, ...Object.values(this.glyphs)];
  }
}
