import * as THREE from "three";
import type { TodoItem } from "../../game/data";
import { clamp01 } from "../math";

export interface TimerView {
  mode: "focus" | "break";
  remainingMs: number;
  totalMs: number;
  running: boolean;
}

/** Draw the laptop pomodoro screen onto its canvas texture if state changed (or `force` is true). */
export function drawLaptopScreen(
  canvas: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  timer: TimerView,
  prevKey: string,
  force: boolean,
): string {
  const secs = Math.max(0, Math.ceil(timer.remainingMs / 1000));
  const key = `${timer.mode}|${secs}|${timer.running}|${timer.totalMs}`;
  if (!force && key === prevKey) return prevKey;

  const g = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  const focus = timer.mode === "focus";
  const accent = focus ? "#ff7a55" : "#9fd39a";

  g.fillStyle = "#231a2b";
  g.fillRect(0, 0, W, H);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = accent;
  g.font = '800 15px "Nunito", system-ui, sans-serif';
  const status = timer.running
    ? focus
      ? "F O C U S"
      : "B R E A K"
    : secs * 1000 >= timer.totalMs
      ? "R E A D Y"
      : "P A U S E D";
  g.fillText(status, W / 2, 30);

  g.fillStyle = "#fbf1e0";
  g.font = '600 66px "Fraunces", Georgia, serif';
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  g.fillText(`${mm}:${ss}`, W / 2, 84);

  const p = timer.totalMs > 0 ? 1 - clamp01(timer.remainingMs / timer.totalMs) : 0;
  g.fillStyle = "rgba(255,255,255,.14)";
  g.fillRect(38, 128, 180, 7);
  g.fillStyle = accent;
  g.fillRect(38, 128, 180 * p, 7);

  tex.needsUpdate = true;
  return key;
}

/** Render the wall corkboard's paper to-do sheet onto its canvas texture. */
export function drawTodoBoard(canvas: HTMLCanvasElement, tex: THREE.CanvasTexture, todos: TodoItem[]): void {
  const g = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;

  g.fillStyle = "#fbf5ea";
  g.fillRect(0, 0, W, H);

  // faint ruled notebook lines
  g.strokeStyle = "rgba(43,32,48,0.08)";
  g.lineWidth = 1;
  for (let y = 66; y < H - 16; y += 30) {
    g.beginPath();
    g.moveTo(16, y);
    g.lineTo(W - 16, y);
    g.stroke();
  }

  g.fillStyle = "#2b2030";
  g.font = '700 22px "Fraunces", Georgia, serif';
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText("TO-DO", 20, 32);

  const doneCount = todos.filter((x) => x.done).length;
  g.fillStyle = "#655468";
  g.font = '700 12px "Nunito", system-ui, sans-serif';
  g.textAlign = "right";
  g.fillText(todos.length ? `${doneCount}/${todos.length}` : "Empty", W - 20, 32);

  g.strokeStyle = "#2b2030";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(18, 48);
  g.lineTo(W - 18, 48);
  g.stroke();

  if (todos.length === 0) {
    g.textAlign = "left";
    g.fillStyle = "#8a788c";
    g.font = 'italic 15px "Nunito", system-ui, sans-serif';
    g.fillText("No tasks yet.", 22, 92);
    g.fillText("Click board to add…", 22, 118);
  } else {
    g.textAlign = "left";
    const shown = todos.slice(0, 7);
    shown.forEach((item, i) => {
      const y = 78 + i * 30;
      g.strokeStyle = "#2b2030";
      g.lineWidth = 2;
      g.fillStyle = item.done ? "#7d9b76" : "#ffffff";
      g.fillRect(20, y - 8, 16, 16);
      g.strokeRect(20, y - 8, 16, 16);
      if (item.done) {
        g.strokeStyle = "#fbf5ea";
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(23.5, y);
        g.lineTo(27, y + 3.5);
        g.lineTo(32.5, y - 3.5);
        g.stroke();
      }
      g.fillStyle = item.done ? "#8a788c" : "#2b2030";
      g.font = '700 14px "Nunito", system-ui, sans-serif';
      let label = item.text;
      while (label.length > 3 && g.measureText(label).width > W - 64) {
        label = label.slice(0, -2) + "…";
      }
      g.fillText(label, 46, y + 1);
      if (item.done) {
        const tw = g.measureText(label).width;
        g.strokeStyle = "#8a788c";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(45, y + 1);
        g.lineTo(47 + tw, y + 1);
        g.stroke();
      }
    });
    if (todos.length > 7) {
      g.fillStyle = "#655468";
      g.font = '800 12px "Nunito", system-ui, sans-serif';
      g.fillText(`+${todos.length - 7} more…`, 22, 294);
    }
  }

  tex.needsUpdate = true;
}
