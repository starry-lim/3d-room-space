import * as THREE from "three";
import type { MemoryCardDef } from "../game/rooftopData";

const CARD_W = 128;
const CARD_H = 160;

let backTex: THREE.CanvasTexture | null = null;
const frontTexCache = new Map<string, THREE.CanvasTexture>();

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Shared cream card-back CanvasTexture with a warm ink border and central star motif. */
export function getCardBackTexture(): THREE.CanvasTexture {
  if (backTex) return backTex;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#faf3e3";
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Outer ink frame
    ctx.strokeStyle = "#2b2030";
    ctx.lineWidth = 5;
    roundedRectPath(ctx, 4, 4, CARD_W - 8, CARD_H - 8, 14);
    ctx.stroke();

    // Inner dashed gold frame
    ctx.save();
    ctx.strokeStyle = "#d8a33a";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    roundedRectPath(ctx, 13, 13, CARD_W - 26, CARD_H - 26, 9);
    ctx.stroke();
    ctx.restore();

    // Corner sparkles
    ctx.fillStyle = "rgba(216, 163, 58, 0.72)";
    for (const [cx, cy] of [
      [22, 22],
      [CARD_W - 22, 22],
      [22, CARD_H - 22],
      [CARD_W - 22, CARD_H - 22],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center motif
    ctx.fillStyle = "rgba(43, 32, 48, 0.56)";
    ctx.font = "600 42px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦", CARD_W / 2, CARD_H / 2 + 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  backTex = tex;
  return tex;
}

/** Cached 128x160 front-face CanvasTexture showing the card symbol and label. */
export function getCardFrontTexture(def: MemoryCardDef): THREE.CanvasTexture {
  const cached = frontTexCache.get(def.id);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = def.bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Subtle soft highlight band
    ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
    roundedRectPath(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 10);
    ctx.fill();

    // Accent border
    ctx.strokeStyle = def.accent;
    ctx.lineWidth = 6;
    roundedRectPath(ctx, 4, 4, CARD_W - 8, CARD_H - 8, 14);
    ctx.stroke();

    // Crisp symbol emoji
    ctx.font = "54px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#2b2030";
    ctx.fillText(def.symbol, CARD_W / 2, 66);

    // Card label
    ctx.font = "800 18px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#2b2030";
    ctx.fillText(def.label, CARD_W / 2, 126);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  frontTexCache.set(def.id, tex);
  return tex;
}

/** Disposes cached card CanvasTextures on scene teardown. */
export function disposeMemoryCardTextures(): void {
  if (backTex) {
    backTex.dispose();
    backTex = null;
  }
  for (const tex of frontTexCache.values()) {
    tex.dispose();
  }
  frontTexCache.clear();
}
