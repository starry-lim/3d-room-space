/** Easing curves used for camera glides, prop animations, and transitions. */
export const ease = {
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  back: (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  linear: (x: number) => x,
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential approach toward a target. */
export const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function approachAngle(cur: number, target: number, rate: number, dt: number): number {
  return cur + angleDelta(cur, target) * (1 - Math.exp(-rate * dt));
}

export interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  ease: (x: number) => number;
  done?: () => void;
}

/** Lightweight manager for active scalar/camera tweens. */
export class TweenList {
  private items: Tween[] = [];

  add(dur: number, fn: (k: number) => void, e = ease.inOut, done?: () => void): Tween {
    const tw: Tween = { t: 0, dur, fn, ease: e, done };
    this.items.push(tw);
    return tw;
  }

  remove(tw: Tween | null): void {
    if (!tw) return;
    const i = this.items.indexOf(tw);
    if (i >= 0) this.items.splice(i, 1);
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const tw = this.items[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) {
        this.items.splice(i, 1);
        tw.done?.();
      }
    }
  }

  clear(): void {
    this.items.length = 0;
  }
}
