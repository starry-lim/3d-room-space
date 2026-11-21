import { useCallback, useEffect, useRef, useState } from "react";

export type Mode = "focus" | "break";
export interface Durations {
  focus: number;
  short: number;
  long: number;
}

export const LIMITS: Record<keyof Durations, [number, number]> = {
  focus: [1, 90],
  short: [1, 30],
  long: [1, 60],
};
const DEFAULTS: Durations = { focus: 25, short: 5, long: 15 };
const KEY = "cozy-study:durations:v1";
const MIN = 60_000;

const clamp = (n: unknown, [lo, hi]: [number, number], fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;

function load(): Durations {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (d && typeof d === "object") {
      return {
        focus: clamp(d.focus, LIMITS.focus, DEFAULTS.focus),
        short: clamp(d.short, LIMITS.short, DEFAULTS.short),
        long: clamp(d.long, LIMITS.long, DEFAULTS.long),
      };
    }
  } catch {
    /* fall through */
  }
  return DEFAULTS;
}
function store(d: Durations) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export interface PomodoroEvents {
  /** A session ran all the way to zero. `long` is true when the break that follows is a long one. */
  onFinish: (finished: Mode, long: boolean) => void;
  /** Called a few times a second while the clock is running. */
  onTick: (dtSeconds: number, mode: Mode, totalMs: number) => void;
}

/**
 * Pomodoro clock. Time is derived from a wall-clock deadline rather than counted
 * tick by tick, so it stays accurate when the tab is throttled in the background.
 */
export function usePomodoro(events: PomodoroEvents) {
  const [durations, setDurations] = useState<Durations>(load);
  const [mode, setModeState] = useState<Mode>("focus");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(() => durations.focus * MIN);
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);

  const ev = useRef(events);
  ev.current = events;
  const st = useRef({ mode, total, remaining, done, durations, running });
  st.current = { mode, total, remaining, done, durations, running };

  const arm = useCallback((m: Mode, ms: number) => {
    setModeState(m);
    setTotal(ms);
    setRemaining(ms);
  }, []);

  const breakMs = (doneCount: number, d: Durations) => (doneCount > 0 && doneCount % 4 === 0 ? d.long : d.short) * MIN;

  useEffect(() => {
    if (!running) return;
    const endAt = Date.now() + st.current.remaining;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const s = st.current;
      ev.current.onTick((now - last) / 1000, s.mode, s.total);
      last = now;
      const left = endAt - now;
      if (left > 0) {
        setRemaining(left);
        return;
      }
      window.clearInterval(id);
      setRunning(false);
      if (s.mode === "focus") {
        const n = s.done + 1;
        setDone(n);
        arm("break", breakMs(n, s.durations));
        ev.current.onFinish("focus", n % 4 === 0);
      } else {
        arm("focus", s.durations.focus * MIN);
        ev.current.onFinish("break", false);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, runId, arm]);

  const start = useCallback(() => {
    if (st.current.remaining <= 0) return;
    setRunning(true);
    setRunId((n) => n + 1);
  }, []);
  const pause = useCallback(() => setRunning(false), []);
  const toggle = useCallback(() => {
    if (st.current.running) pause();
    else start();
  }, [pause, start]);

  const fullLength = (m: Mode, d: Durations, doneCount: number) => (m === "focus" ? d.focus * MIN : breakMs(doneCount, d));

  const reset = useCallback(() => {
    setRunning(false);
    const s = st.current;
    arm(s.mode, fullLength(s.mode, s.durations, s.done));
  }, [arm]);

  const setMode = useCallback(
    (m: Mode) => {
      setRunning(false);
      const s = st.current;
      arm(m, fullLength(m, s.durations, s.done));
    },
    [arm],
  );

  const skip = useCallback(() => setMode(st.current.mode === "focus" ? "break" : "focus"), [setMode]);

  const applyDurations = useCallback(
    (next: Durations) => {
      setDurations(next);
      store(next);
      setRunning(false);
      const s = st.current;
      arm(s.mode, fullLength(s.mode, next, s.done));
    },
    [arm],
  );

  const setDuration = useCallback(
    (key: keyof Durations, minutes: number) => {
      const cur = st.current.durations;
      applyDurations({ ...cur, [key]: clamp(minutes, LIMITS[key], cur[key]) });
    },
    [applyDurations],
  );

  /** A very short focus session, so the reward loop can be tried without waiting. */
  const taste = useCallback(
    (seconds: number) => {
      arm("focus", seconds * 1000);
      setRunning(true);
      setRunId((n) => n + 1);
    },
    [arm],
  );

  return {
    mode,
    running,
    remaining,
    total,
    durations,
    done,
    longBreak: mode === "break" && done > 0 && done % 4 === 0,
    start,
    pause,
    toggle,
    reset,
    skip,
    setMode,
    setDuration,
    applyDurations,
    taste,
  };
}

export type Pomodoro = ReturnType<typeof usePomodoro>;

export function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
