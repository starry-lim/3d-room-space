import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DISCOVERIES,
  EXERCISE_LABELS,
  formatDuration,
  localDateKey,
  type AvatarConfig,
  type DiscoveryId,
  type ExerciseLogEntry,
  type RadioPrefs,
  type TodoItem,
} from "../game/data";
import { formatTime, LIMITS, type Durations, type Pomodoro } from "../game/usePomodoro";
import type { RadioController } from "../game/useRadio";
import {
  ACCESSORY_OPTIONS,
  ACC_SWATCHES,
  AVATAR_PRESETS,
  BOTTOM_SWATCHES,
  HAIR_SWATCHES,
  TOP_SWATCHES,
} from "../scene/avatars";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName =
  | "book"
  | "spark"
  | "sound"
  | "mute"
  | "home"
  | "play"
  | "pause"
  | "reset"
  | "skip"
  | "x"
  | "moon"
  | "minus"
  | "plus"
  | "up"
  | "help"
  | "check"
  | "star"
  | "eye"
  | "user"
  | "list"
  | "pin"
  | "dumbbell"
  | "trash"
  | "prev"
  | "shuffle"
  | "repeat"
  | "upload"
  | "music"
  | "radio"
  | "gift";

const PATHS: Record<IconName, ReactNode> = {
  book: (
    <>
      <path d="M4 19.5V5a2 2 0 0 1 2-2h14v14H6.5A2.5 2.5 0 0 0 4 19.5Zm0 0A2.5 2.5 0 0 0 6.5 22H20" />
      <path d="M9 7.5h6" />
    </>
  ),
  spark: <path d="M12 3c.6 4.6 3.4 7.4 9 9-5.6 1.6-8.4 4.4-9 9-.6-4.6-3.4-7.4-9-9 5.6-1.6 8.4-4.4 9-9Z" />,
  sound: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  mute: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      <path d="m16 9.5 5 5m0-5-5 5" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-7 9 7" />
      <path d="M5.5 9.5V20h13V9.5" />
    </>
  ),
  play: <path d="M8 5v14l11-7Z" fill="currentColor" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={3.2} />,
  reset: (
    <>
      <path d="M4 4v6h6" />
      <path d="M4.6 14.5A8 8 0 1 0 6.3 6.2L4 10" />
    </>
  ),
  skip: (
    <>
      <path d="M6 5v14l10-7Z" />
      <path d="M19 5v14" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  up: <path d="m6 15 6-6 6 6" />,
  help: (
    <>
      <path d="M9.2 9.2a2.9 2.9 0 1 1 4.5 2.4c-.9.6-1.7 1.3-1.7 2.4" />
      <path d="M12 17.6v.01" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  star: (
    <path
      d="m12 2.8 2.8 5.9 6.4.9-4.7 4.5 1.2 6.4L12 17.4l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.9Z"
      fill="currentColor"
    />
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01" />,
  pin: <path d="m15 4 5 5-3 3v4l-2 2-4-4-5 5-1-1 5-5-4-4 2-2h4l3-3Z" />,
  dumbbell: <path d="M6.5 6.5 17.5 17.5M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />,
  prev: (
    <>
      <path d="M18 5v14L8 12Z" />
      <path d="M5 5v14" />
    </>
  ),
  shuffle: (
    <>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  radio: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <path d="m7 8 10-5" />
      <circle cx="8.5" cy="14" r="2.2" />
      <path d="M14 12.5h4M14 15.5h4" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5" />
      <path d="M12 8.5V21" />
      <path d="M12 8.5H8.8a2.2 2.2 0 1 1 0-4.4C11 4.1 12 8.5 12 8.5Z" />
      <path d="M12 8.5h3.2a2.2 2.2 0 1 0 0-4.4C13 4.1 12 8.5 12 8.5Z" />
    </>
  ),
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  pressed,
  badge,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="paper press relative grid h-11 w-11 place-items-center rounded-2xl"
    >
      <Icon name={icon} />
      {badge != null && (
        <span className="absolute -bottom-1.5 -right-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full border-[1.5px] border-ink bg-tomato px-1 text-[10px] font-extrabold leading-none text-paper">
          {badge}
        </span>
      )}
    </button>
  );
}

/** Fixed-width digits so the clock does not jitter as numbers change. */
function Digits({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      {value.split("").map((ch, i) => (
        <span key={i} className="inline-block text-center" style={{ width: ch === ":" ? "0.32em" : "0.6em" }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Brand + stats                                                       */
/* ------------------------------------------------------------------ */

export function Brand({ stars, energy }: { stars: number; energy: number }) {
  const sleepy = energy < 25;
  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      <div className="paper flex items-center rounded-2xl px-3.5 py-2">
        <div>
          <h1 className="font-display text-[19px] font-semibold italic leading-none">Cozy Study</h1>
          <p className="mt-1 text-[9.5px] font-extrabold uppercase leading-none tracking-[0.2em] text-ink-soft">
            a corner to focus in
          </p>
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        <div
          className="paper flex items-center gap-1.5 rounded-xl px-2.5 py-1"
          title="Stars in the jar. Finish a focus session to earn one."
        >
          <Icon name="star" size={15} className="text-mustard [&>path]:stroke-ink [&>path]:stroke-[1.6]" />
          <span className="font-display text-[17px] font-semibold tabular-nums leading-none">{stars}</span>
          <span className="sr-only">stars earned</span>
        </div>
        <div
          className="paper flex items-center gap-2 rounded-xl px-2.5 py-1"
          role="meter"
          aria-label="Energy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(energy)}
          title="Focus uses energy. Resting in the bed restores it."
        >
          <span className={cn("text-[10px] font-extrabold uppercase tracking-[0.14em]", sleepy && "text-tomato-deep")}>
            {sleepy ? "Sleepy" : "Energy"}
          </span>
          <span className="relative block h-2.5 w-16 overflow-hidden rounded-full border-[1.5px] border-ink bg-white/60">
            <span
              className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", sleepy ? "bg-tomato" : "bg-sage")}
              style={{ width: `${energy}%` }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timer                                                               */
/* ------------------------------------------------------------------ */

export function TimerDock({ p, onOpen }: { p: Pomodoro; onOpen: () => void }) {
  const focus = p.mode === "focus";
  return (
    <div className="paper pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
      <button
        type="button"
        onClick={p.toggle}
        aria-label={p.running ? "Pause timer" : "Start timer"}
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-full border-[1.5px] border-ink text-paper transition-transform active:scale-90",
          focus ? "bg-tomato" : "bg-sage-deep",
        )}
      >
        <Icon name={p.running ? "pause" : "play"} size={22} />
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${focus ? "Focus" : "Break"} timer, ${formatTime(p.remaining)} left. Open timer settings`}
        className="flex items-center gap-2 rounded-full py-1 pl-2.5 pr-3 transition-colors hover:bg-paper-deep"
      >
        <span className="flex flex-col items-start">
          <span
            className={cn(
              "text-[10px] font-extrabold uppercase leading-none tracking-[0.18em]",
              focus ? "text-tomato-deep" : "text-sage-deep",
            )}
          >
            {focus ? "Focus" : p.longBreak ? "Long break" : "Break"}
          </span>
          <Digits value={formatTime(p.remaining)} className="font-display text-[28px] font-semibold leading-[1.08]" />
        </span>
        <Icon name="up" size={18} />
      </button>
    </div>
  );
}

const PRESETS: { name: string; d: Durations }[] = [
  { name: "Classic", d: { focus: 25, short: 5, long: 15 } },
  { name: "Deep", d: { focus: 50, short: 10, long: 20 } },
  { name: "Sprint", d: { focus: 15, short: 3, long: 10 } },
];

function Stepper({
  label,
  value,
  range,
  onChange,
}: {
  label: string;
  value: number;
  range: [number, number];
  onChange: (v: number) => void;
}) {
  // single minutes below ten, then jumps of five
  const down = value > 10 ? Math.ceil(value / 5) * 5 - 5 : value - 1;
  const up = value >= 10 ? Math.floor(value / 5) * 5 + 5 : value + 1;
  const btn =
    "grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-ink bg-white/60 transition-colors hover:bg-mustard disabled:opacity-30 disabled:hover:bg-white/60";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-bold">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} aria-label={`Shorter ${label.toLowerCase()}`} disabled={value <= range[0]} onClick={() => onChange(down)}>
          <Icon name="minus" size={15} />
        </button>
        <span className="w-[68px] text-center font-display text-[19px] font-semibold tabular-nums leading-none" aria-live="polite">
          {value}
          <span className="ml-1 font-body text-[11px] font-bold text-ink-soft">min</span>
        </span>
        <button type="button" className={btn} aria-label={`Longer ${label.toLowerCase()}`} disabled={value >= range[1]} onClick={() => onChange(up)}>
          <Icon name="plus" size={15} />
        </button>
      </div>
    </div>
  );
}

export function TimerPanel({
  p,
  resting,
  onClose,
  onRest,
}: {
  p: Pomodoro;
  resting: boolean;
  onClose: () => void;
  onRest: () => void;
}) {
  const focus = p.mode === "focus";
  const left = p.total > 0 ? Math.min(1, Math.max(0, p.remaining / p.total)) : 0;
  const R = 66;
  const C = 2 * Math.PI * R;
  const fresh = p.remaining >= p.total;
  const status = p.running
    ? focus
      ? "Deep in it"
      : "Take it easy"
    : fresh
      ? focus
        ? "Ready when you are"
        : "Break is waiting"
      : "Paused";
  const round = (p.done % 4) + (focus ? 1 : 0);
  const action =
    "press grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-ink bg-white/60 shadow-[2px_2px_0_var(--color-ink)]";

  return (
    <section
      role="dialog"
      aria-label="Pomodoro timer"
      className="paper anim-rise scroll-soft pointer-events-auto max-h-[calc(100dvh-150px)] w-[min(400px,calc(100vw-24px))] overflow-y-auto rounded-[26px] p-4 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <div role="tablist" aria-label="Session type" className="flex rounded-full border-[1.5px] border-ink bg-white/50 p-0.5">
          {(["focus", "break"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={p.mode === m}
              onClick={() => p.setMode(m)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.14em] transition-colors",
                p.mode === m
                  ? m === "focus"
                    ? "bg-tomato text-paper"
                    : "bg-sage-deep text-paper"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Close timer" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-paper-deep">
          <Icon name="x" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {/* the dial is a tomato: a ring that empties, with a calyx on top */}
        <div className="relative h-[136px] w-[136px] shrink-0" role="timer" aria-label={`${formatTime(p.remaining)} remaining`}>
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="80" cy="80" r={R} fill="#fffaf0" stroke="rgb(43 32 48 / 0.14)" strokeWidth="11" />
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={focus ? "var(--color-tomato)" : "var(--color-sage)"}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - left)}
              style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }}
            />
            <circle cx="80" cy="80" r={R + 6.5} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
          </svg>
          <svg viewBox="0 0 40 24" className="absolute -top-2.5 left-1/2 h-6 w-10 -translate-x-1/2" aria-hidden>
            <path
              d="M20 21c-2-6-7-9-14-8 4 0 7 2 9 5-4-2-9-1-12 3 5-2 10-1 14 2 1-1 2-1 3-2 1 1 2 1 3 2 4-3 9-4 14-2-3-4-8-5-12-3 2-3 5-5 9-5-7-1-12 2-14 8Z"
              fill="var(--color-sage-deep)"
              stroke="var(--color-ink)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M20 14V4" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <Digits value={formatTime(p.remaining)} className="font-display text-[34px] font-semibold leading-none" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] font-semibold italic leading-tight">{status}</p>
          <p className="mt-1 text-[12px] font-semibold leading-snug text-ink-soft">
            {focus ? `Round ${round} of 4` : p.longBreak ? "Long break, well earned" : "Short break"}
          </p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-[1.5px] border-ink",
                  i < p.done % 4 || (p.done > 0 && p.done % 4 === 0 && !focus) ? "bg-tomato" : "bg-white/60",
                )}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={p.toggle}
              className={cn(
                "press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-ink text-[14px] font-extrabold text-paper shadow-[2px_2px_0_var(--color-ink)]",
                focus ? "bg-tomato" : "bg-sage-deep",
              )}
            >
              <Icon name={p.running ? "pause" : "play"} size={17} />
              {p.running ? "Pause" : fresh ? "Start" : "Resume"}
            </button>
            <button type="button" aria-label="Reset this session" title="Reset" onClick={p.reset} className={action}>
              <Icon name="reset" size={18} />
            </button>
            <button type="button" aria-label={focus ? "Skip to break" : "Skip to focus"} title="Skip" onClick={p.skip} className={action}>
              <Icon name="skip" size={18} />
            </button>
          </div>
        </div>
      </div>

      {!focus && !resting && (
        <button
          type="button"
          onClick={onRest}
          className="press mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-ink bg-mustard text-[13.5px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]"
        >
          <Icon name="moon" size={17} />
          Spend this break in bed
        </button>
      )}

      <div className="mt-4 space-y-1.5 border-t-[1.5px] border-dashed border-ink/30 pt-3">
        <Stepper label="Focus" value={p.durations.focus} range={LIMITS.focus} onChange={(v) => p.setDuration("focus", v)} />
        <Stepper label="Short break" value={p.durations.short} range={LIMITS.short} onChange={(v) => p.setDuration("short", v)} />
        <Stepper label="Long break" value={p.durations.long} range={LIMITS.long} onChange={(v) => p.setDuration("long", v)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {PRESETS.map(({ name, d }) => {
          const active = d.focus === p.durations.focus && d.short === p.durations.short && d.long === p.durations.long;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => p.applyDurations(d)}
              className={cn(
                "rounded-full border-[1.5px] border-ink px-3 py-1.5 text-[12px] font-extrabold transition-colors",
                active ? "bg-ink text-paper" : "bg-white/60 hover:bg-mustard",
              )}
            >
              {name} <span className="font-semibold opacity-70">{d.focus}·{d.short}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => p.taste(10)}
        className="mt-3 text-left text-[12px] font-bold text-ink-soft underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        Just curious? Run a 10-second session to see what happens.
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export function Journal({
  found,
  stars,
  catName,
  onClose,
  onReset,
}: {
  found: DiscoveryId[];
  stars: number;
  catName: string;
  onClose: () => void;
  onReset: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const got = new Set(found);
  const n = DISCOVERIES.filter((d) => got.has(d.id)).length;
  const all = n === DISCOVERIES.length;

  return (
    <aside
      role="dialog"
      aria-label="Field notes"
      className="paper anim-slide pointer-events-auto flex max-h-full w-full flex-col rounded-[26px] sm:w-[380px]"
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="font-display text-[27px] font-semibold italic leading-none">Field notes</h2>
          <p className="mt-2 text-[12.5px] font-semibold text-ink-soft">
            {n} of {DISCOVERIES.length} things found · {stars} {stars === 1 ? "star" : "stars"} in the jar
          </p>
        </div>
        <button type="button" aria-label="Close field notes" onClick={onClose} className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep">
          <Icon name="x" />
        </button>
      </header>
      <div className="mx-4 mt-3 h-2.5 overflow-hidden rounded-full border-[1.5px] border-ink bg-white/60 sm:mx-5">
        <div className="h-full bg-mustard transition-[width] duration-500" style={{ width: `${(n / DISCOVERIES.length) * 100}%` }} />
      </div>

      <ol className="scroll-soft mt-2 min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
        {DISCOVERIES.map((d, i) => {
          const has = got.has(d.id);
          return (
            <li key={d.id} className="flex gap-3 border-t border-dashed border-ink/25 py-2.5 first:border-t-0">
              <span
                className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px]",
                  has ? "-rotate-6 border-tomato-deep bg-tomato text-paper" : "border-dashed border-ink/45 text-ink/50",
                )}
              >
                {has ? (
                  <Icon name="check" size={15} />
                ) : d.secret ? (
                  <Icon name="spark" size={13} />
                ) : (
                  <span className="text-[11px] font-extrabold leading-none">{i + 1}</span>
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("font-display text-[16.5px] font-semibold leading-tight", !has && "text-ink/60")}>
                  {has ? (d.id === "cat" ? catName.trim() || "Miso" : d.name) : d.secret ? "A secret" : "Not found yet"}
                </p>
                <p className={cn("mt-0.5 text-[12.5px] leading-snug", has ? "text-ink-soft" : "italic text-ink/70")}>
                  {has ? d.note : d.clue}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="flex items-center justify-between gap-3 border-t-[1.5px] border-ink px-4 py-2.5 text-[12px] sm:px-5">
        <span className="font-semibold text-ink-soft">{all ? "Every corner explored." : "Clues are written in italics."}</span>
        <button
          type="button"
          onClick={() => (confirm ? onReset() : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          className={cn(
            "shrink-0 rounded-full px-2 py-1 font-extrabold underline decoration-dotted underline-offset-4",
            confirm ? "bg-tomato text-paper no-underline" : "text-ink-soft hover:text-ink",
          )}
        >
          {confirm ? "Erase everything?" : "Start over"}
        </button>
      </footer>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: number;
  tone: "find" | "secret" | "reward" | "page" | "note";
  tag: string;
  title: string;
  body?: string;
  leaving?: boolean;
}

const TAG_TONE: Record<Toast["tone"], string> = {
  find: "text-tomato-deep",
  secret: "text-sage-deep",
  reward: "text-tomato-deep",
  page: "text-ink-soft",
  note: "text-ink-soft",
};

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="flex w-full flex-col items-start gap-2 sm:items-center" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "paper relative w-full max-w-[340px] rounded-2xl px-3.5 py-2.5",
            t.leaving ? "anim-leave" : "anim-drop",
            (t.tone === "find" || t.tone === "secret") && "pr-12",
          )}
        >
          <p className={cn("text-[10px] font-extrabold uppercase tracking-[0.18em]", TAG_TONE[t.tone])}>{t.tag}</p>
          <p className={cn("mt-0.5 font-display text-[17px] font-semibold leading-tight", t.tone === "page" && "italic")}>
            {t.title}
          </p>
          {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{t.body}</p>}
          {(t.tone === "find" || t.tone === "secret") && (
            <span
              className={cn(
                "anim-stamp absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border-[1.5px] text-paper",
                t.tone === "secret" ? "border-sage-deep bg-sage-deep" : "border-tomato-deep bg-tomato",
              )}
              aria-hidden
            >
              <Icon name={t.tone === "secret" ? "spark" : "check"} size={16} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

export function ControlsHint({ touch, locked, catName }: { touch: boolean; locked?: boolean; catName: string }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button
        type="button"
        aria-label="Show controls"
        title="Show controls"
        onClick={() => setOpen(true)}
        className="paper press pointer-events-auto grid h-11 w-11 place-items-center rounded-full"
      >
        <Icon name="help" />
      </button>
    );
  }
  if (touch) {
    const touchRows = [
      ["Drag", "look around"],
      ["Tap", "try things"],
    ];
    return (
      <div className="paper anim-rise pointer-events-auto relative rounded-2xl py-2 pl-2.5 pr-9 text-[12px] font-bold">
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Controls">
          {touchRows.map(([k, v]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="kbd whitespace-nowrap">{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-label="Hide controls"
          onClick={() => setOpen(false)}
          className="absolute right-0.5 top-0.5 grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-paper-deep"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    );
  }
  const movementRows: [string, string][] = [
    ["WASD / Arrows", "Walk"],
    ["Shift", "Run"],
    ["Space", "Jump"],
    ["C", "Squat (hold / tap)"],
    ["Mouse", locked ? "Look (locked)" : "Click room to look"],
    ["V", "1st / 3rd view"],
    ["Esc", "Unlock mouse / close"],
    ["R", "Reset position"],
  ];
  const interactRows: [string, string][] = [
    ["Click / E", "Interact"],
    ["F", `Call ${catName.trim() || "Miso"}`],
    ["K", "Customize model"],
    ["L", "To-do list"],
    ["P", "Start / pause timer"],
    ["T", "Timer panel"],
    ["J", "Field notes"],
    ["H", "Toggle hints"],
    ["M", "Mute / unmute"],
  ];
  return (
    <div className="paper anim-rise pointer-events-auto relative rounded-2xl py-2 pl-3 pr-9 text-[11.5px] font-bold">
      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">Controls</p>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2" aria-label="Controls">
        <ul className="space-y-1" aria-label="Movement and camera">
          {movementRows.map(([k, v]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="kbd whitespace-nowrap">{k}</span>
              <span className="whitespace-nowrap">{v}</span>
            </li>
          ))}
        </ul>
        <ul className="space-y-1" aria-label="Interact and shortcuts">
          {interactRows.map(([k, v]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="kbd whitespace-nowrap">{k}</span>
              <span className="whitespace-nowrap">{v}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        aria-label="Hide controls"
        onClick={() => setOpen(false)}
        className="absolute right-0.5 top-0.5 grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-paper-deep"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

/** Prompt shown when desktop mouse lock is unlocked. */
export function MouseLockPrompt({ onLock }: { onLock: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center">
      <button
        type="button"
        onClick={onLock}
        className="paper press pointer-events-auto rounded-2xl px-4 py-2.5 text-center"
      >
        <span className="block font-display text-[17px] font-semibold italic leading-tight">Click to lock mouse</span>
        <span className="mt-0.5 block text-[11px] font-bold text-ink-soft">
          First-person look · Press Esc anytime for cursor
        </span>
      </button>
    </div>
  );
}

/** Center reticle shown while in first-person mouse-look mode. */
export function Crosshair({ label }: { label: string | null }) {
  const active = !!label;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center" aria-hidden>
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            "block rounded-full border-[1.5px] border-ink transition-all duration-150",
            active ? "h-4 w-4 bg-mustard/85 shadow-[0_0_0_2px_rgb(247_238_220/0.8)]" : "h-2 w-2 bg-paper/90 shadow-[0_0_0_1px_rgb(43_32_48/0.35)]",
          )}
        />
        <span
          className={cn(
            "paper absolute top-6 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-extrabold transition-opacity duration-150",
            active ? "opacity-100" : "opacity-0",
          )}
        >
          {label ?? ""}
        </span>
      </div>
    </div>
  );
}

/** Label that trails the mouse when it is over something that responds. */
export function CursorLabel({ text }: { text: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (text) setShown(text);
  }, [text]);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate3d(${e.clientX + 16}px, ${e.clientY + 20}px, 0)`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none fixed left-0 top-0 z-50 transition-opacity duration-150",
        text ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="paper block whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-extrabold">{shown}</span>
    </div>
  );
}

export function FocusCard({
  mode,
  reading,
  thirdPerson,
  modelOpen,
  onToggleModel,
  onToggleReading,
  onFlipPage,
  onStand,
}: {
  mode: "desk" | "pouf";
  reading: boolean;
  thirdPerson: boolean;
  modelOpen: boolean;
  onToggleModel: () => void;
  onToggleReading?: () => void;
  onFlipPage: () => void;
  onStand: () => void;
}) {
  const title = mode === "desk" ? "Focusing" : reading ? "Reading" : "Lounging";
  return (
    <div className="paper anim-rise pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2">
      <div className="flex items-center gap-2 pr-1">
        <span className="text-sage-deep">
          <Icon name="book" size={20} />
        </span>
        <div>
          <p className="font-display text-[15.5px] font-semibold italic leading-none">{title}</p>
          <p className="mt-0.5 text-[10.5px] font-bold leading-none text-ink-soft">
            {thirdPerson ? "3rd person · drag to orbit · V" : "1st person · drag to look · V"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleModel}
        aria-pressed={modelOpen}
        className={cn(
          "press flex items-center gap-1.5 rounded-xl border-[1.5px] border-ink px-3 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]",
          modelOpen ? "bg-mustard" : "bg-paper-deep",
        )}
      >
        <Icon name="user" size={15} />
        <span>Model</span>
      </button>
      {mode === "pouf" && !reading ? (
        <button
          type="button"
          onClick={onToggleReading}
          className="press rounded-xl border-[1.5px] border-ink bg-paper-deep px-3 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]"
        >
          Pick up book
        </button>
      ) : (
        <button
          type="button"
          onClick={onFlipPage}
          className="press rounded-xl border-[1.5px] border-ink bg-paper-deep px-3 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]"
        >
          Flip page
        </button>
      )}
      <button
        type="button"
        onClick={onStand}
        className="press rounded-xl border-[1.5px] border-ink bg-mustard px-3 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]"
      >
        Stand up
      </button>
    </div>
  );
}

export function ExerciseCard({
  label,
  seconds,
  running,
  modelOpen,
  historyOpen,
  onToggleRun,
  onToggleModel,
  onToggleHistory,
  onFinish,
}: {
  label: string;
  seconds: number;
  running: boolean;
  thirdPerson: boolean;
  modelOpen: boolean;
  historyOpen: boolean;
  onToggleRun: () => void;
  onToggleModel: () => void;
  onToggleHistory: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="paper anim-rise pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2">
      <div className="flex items-center gap-2 pr-1">
        <span className="text-tomato-deep">
          <Icon name="dumbbell" size={20} />
        </span>
        <div>
          <p className="text-[10px] font-extrabold uppercase leading-none tracking-[0.16em] text-ink-soft">{label}</p>
          <Digits value={formatDuration(seconds)} className="mt-0.5 font-display text-[20px] font-semibold leading-none" />
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleRun}
        className={cn(
          "press flex items-center gap-1 rounded-xl border-[1.5px] border-ink px-2.5 py-1.5 text-[12px] font-extrabold text-paper shadow-[2px_2px_0_var(--color-ink)]",
          running ? "bg-tomato" : "bg-sage-deep",
        )}
      >
        <Icon name={running ? "pause" : "play"} size={14} />
        <span>{running ? "Pause" : "Resume"}</span>
      </button>
      <button
        type="button"
        onClick={onToggleModel}
        aria-pressed={modelOpen}
        className={cn(
          "press flex items-center gap-1 rounded-xl border-[1.5px] border-ink px-2.5 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]",
          modelOpen ? "bg-mustard" : "bg-paper-deep",
        )}
      >
        <Icon name="user" size={14} />
        <span>Model</span>
      </button>
      <button
        type="button"
        onClick={onToggleHistory}
        aria-pressed={historyOpen}
        className={cn(
          "press rounded-xl border-[1.5px] border-ink px-2.5 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]",
          historyOpen ? "bg-mustard" : "bg-paper-deep",
        )}
      >
        Log
      </button>
      <button
        type="button"
        onClick={onFinish}
        className="press rounded-xl border-[1.5px] border-ink bg-mustard px-3 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]"
      >
        Finish
      </button>
    </div>
  );
}

function SwatchRow({
  label,
  swatches,
  value,
  onPick,
}: {
  label: string;
  swatches: string[];
  value: string;
  onPick: (c: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="w-[66px] shrink-0 text-[11px] font-extrabold text-ink-soft">{label}</span>
      <div className="flex flex-wrap justify-end gap-1">
        {swatches.map((hex) => {
          const active = value.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              aria-label={`${label} color ${hex}`}
              aria-pressed={active}
              onClick={() => onPick(hex)}
              className={cn(
                "h-6 w-6 rounded-full border-[1.5px] transition-transform",
                active ? "scale-110 border-ink ring-2 ring-mustard" : "border-ink/40 hover:scale-105",
              )}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function AvatarPanel({
  config,
  catName,
  firstTime,
  onChange,
  onCatNameChange,
  onDone,
  onClose,
}: {
  config: AvatarConfig;
  catName: string;
  firstTime?: boolean;
  onChange: (next: AvatarConfig) => void;
  onCatNameChange: (name: string) => void;
  onDone?: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      role="dialog"
      aria-label="Third-person character model"
      className="paper anim-slide pointer-events-auto flex max-h-full w-full flex-col rounded-[26px] sm:w-[324px]"
    >
      <header className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <h2 className="font-display text-[22px] font-semibold italic leading-none">
            {firstTime ? "Welcome to Cozy Study" : "Your 3rd-person model"}
          </h2>
          <p className="mt-1.5 text-[11.5px] font-semibold text-ink-soft">
            {firstTime ? "Customize your character & name your cat" : "Drag room to rotate · Scroll to zoom"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close model picker"
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
        >
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        <div className="grid grid-cols-2 gap-1.5">
          {AVATAR_PRESETS.map((p) => {
            const active = config.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ preset: p.id, ...p.defaults })}
                className={cn(
                  "press flex items-center gap-2 rounded-xl border-[1.5px] border-ink px-2.5 py-2 text-left transition-colors",
                  active ? "bg-mustard" : "bg-white/60 hover:bg-paper-deep",
                )}
              >
                <span className="flex shrink-0 -space-x-1" aria-hidden>
                  <span className="h-3.5 w-3.5 rounded-full border border-ink" style={{ backgroundColor: p.defaults.topColor }} />
                  <span className="h-3.5 w-3.5 rounded-full border border-ink" style={{ backgroundColor: p.defaults.hairColor }} />
                </span>
                <span className="truncate text-[12px] font-extrabold leading-tight">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-2 border-t-[1.5px] border-dashed border-ink/25 pt-3">
          <SwatchRow label="Hair / Fur" swatches={HAIR_SWATCHES} value={config.hairColor} onPick={(hairColor) => onChange({ ...config, hairColor })} />
          <SwatchRow label="Top" swatches={TOP_SWATCHES} value={config.topColor} onPick={(topColor) => onChange({ ...config, topColor })} />
          <SwatchRow label="Bottoms" swatches={BOTTOM_SWATCHES} value={config.bottomColor} onPick={(bottomColor) => onChange({ ...config, bottomColor })} />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="w-[66px] shrink-0 text-[11px] font-extrabold text-ink-soft">Accessory</span>
            <div className="flex flex-wrap justify-end gap-1">
              {ACCESSORY_OPTIONS.map((a) => {
                const active = config.accessory === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ ...config, accessory: a.id })}
                    className={cn(
                      "rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-[11px] font-extrabold transition-colors",
                      active ? "bg-ink text-paper" : "bg-white/65 hover:bg-mustard",
                    )}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {config.accessory !== "none" && (
            <SwatchRow
              label="Acc. color"
              swatches={ACC_SWATCHES}
              value={config.accessoryColor}
              onPick={(accessoryColor) => onChange({ ...config, accessoryColor })}
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t-[1.5px] border-dashed border-ink/25 pt-3">
          <label htmlFor="cat-name-input" className="w-[66px] shrink-0 text-[11px] font-extrabold text-ink-soft">
            Cat's name
          </label>
          <input
            id="cat-name-input"
            type="text"
            value={catName}
            maxLength={20}
            onChange={(e) => onCatNameChange(e.target.value)}
            onBlur={() => {
              if (!catName.trim()) onCatNameChange("Miso");
            }}
            placeholder="Miso"
            className="min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-white/80 px-2.5 py-1 text-[12.5px] font-bold placeholder:text-ink-soft/60"
          />
        </div>
      </div>

      {firstTime && (
        <footer className="border-t-[1.5px] border-ink px-4 py-3">
          <button
            type="button"
            onClick={onDone ?? onClose}
            className="press flex h-10 w-full items-center justify-center rounded-full border-[1.5px] border-ink bg-tomato text-[13.5px] font-extrabold text-paper shadow-[2px_2px_0_var(--color-ink)]"
          >
            Start studying
          </button>
        </footer>
      )}
    </aside>
  );
}

export function ExercisePanel({
  totalSec,
  log,
  onClose,
}: {
  totalSec: number;
  log: ExerciseLogEntry[];
  onClose: () => void;
}) {
  const today = localDateKey();
  const todaySec = log.reduce((acc, e) => (e.date === today ? acc + e.seconds : acc), 0);

  return (
    <aside
      role="dialog"
      aria-label="Exercise log"
      className="paper anim-slide pointer-events-auto flex max-h-full w-full flex-col rounded-[26px] sm:w-[360px]"
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="font-display text-[26px] font-semibold italic leading-none">Exercise log</h2>
          <p className="mt-2 text-[12.5px] font-semibold text-ink-soft">
            Track yoga, weights, and cycling in your corner
          </p>
        </div>
        <button
          type="button"
          aria-label="Close exercise log"
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
        >
          <Icon name="x" />
        </button>
      </header>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2 sm:mx-5">
        <div className="rounded-2xl border-[1.5px] border-ink bg-white/60 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-soft">Today</p>
          <Digits value={formatDuration(todaySec)} className="mt-1 font-display text-[24px] font-semibold leading-none text-sage-deep" />
        </div>
        <div className="rounded-2xl border-[1.5px] border-ink bg-white/60 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-soft">All-time</p>
          <Digits value={formatDuration(totalSec)} className="mt-1 font-display text-[24px] font-semibold leading-none text-tomato-deep" />
        </div>
      </div>

      <div className="scroll-soft mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
        {log.length === 0 ? (
          <p className="py-8 text-center text-[13px] font-semibold italic text-ink-soft">
            No workouts recorded yet. Try the mat, dumbbells, or spin bike!
          </p>
        ) : (
          <ul>
            {log.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 border-t border-dashed border-ink/25 py-2.5 first:border-t-0">
                <div>
                  <p className="text-[13.5px] font-extrabold leading-tight">{EXERCISE_LABELS[e.kind]}</p>
                  <p className="text-[11px] font-semibold text-ink-soft">{e.date === today ? "Today" : e.date}</p>
                </div>
                <span className="rounded-full border-[1.5px] border-ink bg-paper-deep px-2.5 py-0.5 font-display text-[14px] font-semibold">
                  {formatDuration(e.seconds)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function TodoPanel({
  todos,
  pinned,
  onAdd,
  onToggle,
  onDelete,
  onClearDone,
  onTogglePin,
  onClose,
}: {
  todos: TodoItem[];
  pinned: boolean;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onClearDone: () => void;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const doneCount = todos.filter((t) => t.done).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
  };

  return (
    <aside
      role="dialog"
      aria-label="To-do list"
      className="paper anim-slide pointer-events-auto flex max-h-full w-full flex-col rounded-[26px] sm:w-[370px]"
    >
      <header className="flex items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="font-display text-[26px] font-semibold italic leading-none">To-do list</h2>
          <p className="mt-1.5 text-[12px] font-semibold text-ink-soft">
            {todos.length ? `${doneCount} of ${todos.length} completed · synced to wall board` : "Synced live to the corkboard on your wall"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            title={pinned ? "Unpin from screen" : "Pin to screen"}
            className={cn(
              "press flex h-9 items-center gap-1 rounded-full border-[1.5px] border-ink px-2.5 text-[11.5px] font-extrabold transition-colors",
              pinned ? "bg-mustard" : "bg-white/65 hover:bg-paper-deep",
            )}
          >
            <Icon name="pin" size={14} />
            <span>{pinned ? "Pinned" : "Pin"}</span>
          </button>
          <button
            type="button"
            aria-label="Close to-do list"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-paper-deep"
          >
            <Icon name="x" />
          </button>
        </div>
      </header>

      <form onSubmit={submit} className="mx-4 mt-3 flex gap-2 sm:mx-5">
        <input
          type="text"
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a study task…"
          className="min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-white/80 px-3 py-2 text-[13px] font-bold placeholder:text-ink-soft/60"
        />
        <button
          type="submit"
          className="press shrink-0 rounded-xl border-[1.5px] border-ink bg-tomato px-3.5 py-2 text-[12.5px] font-extrabold text-paper shadow-[2px_2px_0_var(--color-ink)]"
        >
          Add
        </button>
      </form>

      <ul className="scroll-soft mt-2 min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
        {todos.length === 0 ? (
          <li className="py-8 text-center text-[13px] font-semibold italic text-ink-soft">
            Nothing here yet. Add a task above or pin the list to your screen!
          </li>
        ) : (
          todos.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 border-t border-dashed border-ink/25 py-2.5 first:border-t-0">
              <button
                type="button"
                aria-label={item.done ? `Mark "${item.text}" not done` : `Mark "${item.text}" done`}
                aria-pressed={item.done}
                onClick={() => onToggle(item.id)}
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-md border-[1.5px] border-ink transition-colors",
                  item.done ? "bg-sage text-paper" : "bg-white/80 hover:bg-mustard/50",
                )}
              >
                {item.done && <Icon name="check" size={14} />}
              </button>
              <span className={cn("min-w-0 flex-1 break-words text-[13.5px] font-bold leading-snug", item.done && "line-through opacity-55")}>
                {item.text}
              </span>
              <button
                type="button"
                aria-label={`Delete "${item.text}"`}
                onClick={() => onDelete(item.id)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-tomato-deep"
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))
        )}
      </ul>

      <footer className="flex items-center justify-between gap-2 border-t-[1.5px] border-ink px-4 py-2.5 text-[12px] sm:px-5">
        <span className="font-semibold text-ink-soft">
          {pinned ? "Pinned on screen" : "Tip: Pin to keep visible while studying"}
        </span>
        {doneCount > 0 && (
          <button
            type="button"
            onClick={onClearDone}
            className="font-extrabold text-tomato-deep underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            Clear done
          </button>
        )}
      </footer>
    </aside>
  );
}

export function PinnedTodo({
  todos,
  onToggle,
  onOpenPanel,
  onUnpin,
}: {
  todos: TodoItem[];
  onToggle: (id: string) => void;
  onOpenPanel: () => void;
  onUnpin: () => void;
}) {
  const doneCount = todos.filter((t) => t.done).length;
  return (
    <div className="paper anim-rise pointer-events-auto mt-1.5 w-[min(232px,calc(100vw-110px))] rounded-2xl p-2.5">
      <div className="flex items-center justify-between gap-1.5 border-b border-dashed border-ink/25 pb-1.5">
        <button
          type="button"
          onClick={onOpenPanel}
          className="flex items-center gap-1.5 text-left hover:underline"
          title="Edit to-do list (L)"
        >
          <Icon name="pin" size={13} className="text-tomato-deep" />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em]">To-Do</span>
          {todos.length > 0 && (
            <span className="rounded-full bg-paper-deep px-1.5 text-[10px] font-extrabold text-ink-soft">
              {doneCount}/{todos.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Edit to-do list"
            onClick={onOpenPanel}
            className="grid h-6 w-6 place-items-center rounded-full hover:bg-paper-deep"
          >
            <Icon name="plus" size={13} />
          </button>
          <button
            type="button"
            aria-label="Unpin to-do list"
            onClick={onUnpin}
            className="grid h-6 w-6 place-items-center rounded-full hover:bg-paper-deep"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>

      {todos.length === 0 ? (
        <button
          type="button"
          onClick={onOpenPanel}
          className="mt-1.5 w-full rounded-lg py-1 text-left text-[11.5px] font-semibold italic text-ink-soft hover:text-ink"
        >
          + Add tasks…
        </button>
      ) : (
        <ul className="scroll-soft mt-1.5 max-h-[168px] space-y-1 overflow-y-auto pr-0.5">
          {todos.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="flex w-full items-start gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-paper-deep/70"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border-[1.5px] border-ink",
                    item.done ? "bg-sage text-paper" : "bg-white/80",
                  )}
                >
                  {item.done && <Icon name="check" size={11} />}
                </span>
                <span className={cn("min-w-0 flex-1 break-words text-[12px] font-bold leading-snug", item.done && "line-through opacity-50")}>
                  {item.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const KIND_BADGE: Record<"file" | "youtube" | "url", string> = {
  file: "LOCAL",
  youtube: "YT",
  url: "URL",
};

export function RadioPanel({
  open,
  prefs,
  radio,
  muted,
  onUnmute,
  onClose,
}: {
  open: boolean;
  prefs: RadioPrefs;
  radio: RadioController;
  muted: boolean;
  onUnmute: () => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [urlErr, setUrlErr] = useState<string | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);

  const lofiPlaying = radio.source === "lofi" && radio.playing;
  const songsPlaying = radio.source === "songs" && radio.playing;
  const activeTrack = radio.activeTrack;
  const hasSeekable = radio.source === "songs" && radio.duration > 0 && Number.isFinite(radio.duration);
  const maxDur = hasSeekable ? radio.duration : 0;
  const curPos = hasSeekable ? Math.min(radio.currentTime, maxDur) : 0;
  const showYtSlot = prefs.tab === "songs" && activeTrack?.kind === "youtube";

  const onAddUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = radio.addUrl(urlInput, titleInput);
    if (!res.ok) {
      setUrlErr(res.error ?? "Invalid URL.");
      return;
    }
    setUrlErr(null);
    setUrlInput("");
    setTitleInput("");
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await radio.addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      if (!draggingFiles) setDraggingFiles(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDraggingFiles(false);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingFiles(false);
    if (e.dataTransfer.files.length > 0) {
      await radio.addFiles(e.dataTransfer.files);
    }
  };

  return (
    <aside
      role="dialog"
      aria-label="Cozy radio"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "paper relative pointer-events-auto flex max-h-full w-full flex-col rounded-[26px] sm:w-[384px]",
        open && "anim-slide",
      )}
    >
      {draggingFiles && (
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-[20px] border-2 border-dashed border-ink bg-mustard/90 p-5 text-center">
          <div>
            <Icon name="upload" size={28} className="mx-auto" />
            <p className="mt-2 font-display text-[20px] font-semibold italic leading-tight">Drop audio files here</p>
            <p className="mt-1 text-[12px] font-bold text-ink-soft">MP3, WAV, M4A, OGG, FLAC, or WebM</p>
          </div>
        </div>
      )}

      <header className="flex items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 className="font-display text-[26px] font-semibold italic leading-none">Radio</h2>
          <p className="mt-1.5 truncate text-[12px] font-semibold text-ink-soft">
            {radio.nowPlayingLabel ? `Playing · ${radio.nowPlayingLabel}` : "Built-in lo-fi & your own songs"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close radio"
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-paper-deep"
        >
          <Icon name="x" />
        </button>
      </header>

      <div className="mx-4 mt-3 sm:mx-5">
        <div role="tablist" aria-label="Radio mode" className="grid grid-cols-2 rounded-full border-[1.5px] border-ink bg-white/55 p-0.5">
          {(
            [
              { id: "lofi", label: "Lo-Fi Radio" },
              { id: "songs", label: `My Songs${prefs.tracks.length ? ` (${prefs.tracks.length})` : ""}` },
            ] as const
          ).map((t) => {
            const selected = prefs.tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => radio.setTab(t.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-colors",
                  selected ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Built-in Lo-Fi Radio */}
      {prefs.tab === "lofi" && (
        <div className="scroll-soft mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
          <div className="rounded-2xl border-[1.5px] border-ink bg-white/65 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-mustard px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em]">
                  <Icon name="radio" size={12} />
                  <span>{lofiPlaying ? "On air" : "Station"}</span>
                </span>
                <h3 className="mt-2 font-display text-[22px] font-semibold italic leading-tight">Rhodes Drift</h3>
                <p className="mt-1 text-[12.5px] font-semibold text-ink-soft">
                  72 BPM warm electric piano chords, soft vinyl crackle & endless generative lo-fi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={radio.toggleLofi}
              className={cn(
                "press mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-ink text-[14px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]",
                lofiPlaying ? "bg-mustard text-ink" : "bg-tomato text-paper",
              )}
            >
              <Icon name={lofiPlaying ? "pause" : "play"} size={18} />
              <span>{lofiPlaying ? "Pause Lo-Fi Radio" : "Play Lo-Fi Radio"}</span>
            </button>

            <div className="mt-4 border-t border-dashed border-ink/25 pt-3">
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">
                <span>Radio Volume</span>
                <span>{Math.round(prefs.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={prefs.volume}
                aria-label="Radio volume"
                onChange={(e) => radio.setVolume(Number(e.target.value))}
                className="radio-range mt-1.5 w-full"
              />
            </div>

            {songsPlaying && activeTrack && (
              <p className="mt-3 rounded-xl border border-ink/25 bg-paper-deep/75 px-3 py-2 text-[11.5px] font-bold text-ink-soft">
                Currently playing from My Songs: <span className="text-ink">{activeTrack.title}</span>. Pressing Play here switches back to Lo-Fi.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: My Songs (always kept mounted offscreen while on Lo-Fi tab so background YouTube/HTML5 audio keeps playing seamlessly) */}
      <div
        aria-hidden={!open || prefs.tab !== "songs"}
        inert={!open || prefs.tab !== "songs"}
        className={
          prefs.tab === "songs"
            ? "scroll-soft mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 sm:px-5"
            : "pointer-events-none fixed -left-[9999px] top-0 h-[220px] w-[360px] opacity-0"
        }
      >
        {/* Now Playing & Transport */}
        <div className="rounded-2xl border-[1.5px] border-ink bg-white/65 p-3">
          {/* Persistent YouTube player host (never unmounted) */}
          <div
            ref={radio.ytSlotRef}
            className={
              showYtSlot
                ? "mb-2.5 aspect-video w-full overflow-hidden rounded-xl border-[1.5px] border-ink bg-night"
                : "pointer-events-none fixed -left-[9999px] top-0 h-[112px] w-[200px] opacity-0"
            }
          />

          {radio.isFileProtocol && activeTrack?.kind === "youtube" && (
            <p className="mb-2 rounded-xl border-[1.5px] border-ink bg-mustard/45 px-2.5 py-1.5 text-[11px] font-bold leading-snug text-ink">
              YouTube embeds often fail from a local <code className="font-extrabold">file://</code> page, and work automatically once hosted on GitHub Pages (<code className="font-extrabold">https://</code>) or localhost.
            </p>
          )}

          {radio.error && (
            <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border-[1.5px] border-ink bg-tomato/15 px-2.5 py-2 text-[11.5px] font-bold text-tomato-deep">
              <span>{radio.error}</span>
              <button type="button" aria-label="Dismiss error" onClick={radio.clearError} className="shrink-0 hover:text-ink">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border-[1.5px] border-ink bg-paper-deep px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-[0.08em]">
                  {activeTrack ? KIND_BADGE[activeTrack.kind] : "EMPTY"}
                </span>
                <p className="truncate text-[13.5px] font-extrabold leading-tight">
                  {activeTrack ? activeTrack.title : "Add a song below"}
                </p>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-ink-soft">
                <span>{radio.source === "songs" ? (radio.playing ? "Playing" : "Paused") : "Standby"}</span>
                <span>
                  {activeTrack
                    ? `${formatDuration(curPos)} / ${hasSeekable ? formatDuration(maxDur) : radio.source === "songs" && radio.playing ? "LIVE" : "--:--"}`
                    : "00:00 / --:--"}
                </span>
              </div>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={maxDur || 1}
            step={1}
            disabled={!hasSeekable}
            value={hasSeekable ? curPos : 0}
            aria-label="Seek track position"
            onChange={(e) => radio.seek(Number(e.target.value))}
            className="radio-range mt-2 w-full"
          />

          <div className="mt-2.5 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={radio.toggleShuffle}
              aria-pressed={prefs.shuffle}
              aria-label="Toggle shuffle"
              title="Shuffle"
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-ink transition-colors",
                prefs.shuffle ? "bg-mustard text-ink" : "bg-white/75 text-ink-soft hover:bg-paper-deep",
              )}
            >
              <Icon name="shuffle" size={15} />
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={radio.prevTrack}
                disabled={prefs.tracks.length === 0}
                aria-label="Previous song"
                title="Previous"
                className="press grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-ink bg-white/80 disabled:opacity-40"
              >
                <Icon name="prev" size={16} />
              </button>
              <button
                type="button"
                onClick={radio.togglePlaySong}
                disabled={prefs.tracks.length === 0}
                aria-label={songsPlaying ? "Pause song" : "Play song"}
                className={cn(
                  "press grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-ink shadow-[2px_2px_0_var(--color-ink)] disabled:opacity-40",
                  songsPlaying ? "bg-mustard text-ink" : "bg-tomato text-paper",
                )}
              >
                <Icon name={songsPlaying ? "pause" : "play"} size={18} />
              </button>
              <button
                type="button"
                onClick={() => radio.nextTrack(false)}
                disabled={prefs.tracks.length === 0}
                aria-label="Next song"
                title="Next"
                className="press grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-ink bg-white/80 disabled:opacity-40"
              >
                <Icon name="skip" size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={radio.cycleRepeat}
              aria-pressed={prefs.repeat === "one"}
              aria-label={prefs.repeat === "one" ? "Repeat one song" : "Repeat playlist"}
              title={prefs.repeat === "one" ? "Repeat: One song" : "Repeat: All"}
              className={cn(
                "relative grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-ink transition-colors",
                prefs.repeat === "one" ? "bg-mustard text-ink" : "bg-white/75 text-ink-soft hover:bg-paper-deep",
              )}
            >
              <Icon name="repeat" size={15} />
              {prefs.repeat === "one" && (
                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-ink bg-tomato text-[9px] font-extrabold text-paper">
                  1
                </span>
              )}
            </button>
          </div>

          {/* Volume + Optional Cozy Vintage EQ */}
          <div className="mt-3 space-y-2 border-t border-dashed border-ink/25 pt-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={prefs.volume}
                aria-label="Radio volume"
                onChange={(e) => radio.setVolume(Number(e.target.value))}
                className="radio-range min-w-0 flex-1"
              />
              <span className="w-8 text-right text-[11px] font-extrabold text-ink-soft">{Math.round(prefs.volume * 100)}%</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-ink-soft">Vintage speaker EQ (local files)</span>
              <button
                type="button"
                aria-pressed={prefs.cozyFilter}
                onClick={radio.toggleCozyFilter}
                className={cn(
                  "rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-[11px] font-extrabold transition-colors",
                  prefs.cozyFilter ? "bg-mustard text-ink" : "bg-white/75 text-ink-soft hover:bg-paper-deep",
                )}
              >
                {prefs.cozyFilter ? "Cozy Radio ON" : "Clean Audio"}
              </button>
            </div>
          </div>
        </div>

        {/* Add songs: Upload files + URL form */}
        <div className="rounded-2xl border-[1.5px] border-ink bg-white/55 p-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.opus,.webm"
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="press flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-paper-deep px-3 py-2 text-[12.5px] font-extrabold shadow-[2px_2px_0_var(--color-ink)] hover:bg-mustard"
          >
            <Icon name="upload" size={16} />
            <span>Upload audio files (or drag &amp; drop)</span>
          </button>

          <form onSubmit={onAddUrlSubmit} className="mt-2.5 space-y-1.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (urlErr) setUrlErr(null);
                }}
                placeholder="YouTube or audio stream URL…"
                aria-label="YouTube or audio URL"
                className="min-w-0 flex-1 rounded-xl border-[1.5px] border-ink bg-white/85 px-2.5 py-1.5 text-[12.5px] font-bold placeholder:text-ink-soft/60"
              />
              <button
                type="submit"
                className="press shrink-0 rounded-xl border-[1.5px] border-ink bg-tomato px-3 py-1.5 text-[12px] font-extrabold text-paper shadow-[2px_2px_0_var(--color-ink)]"
              >
                Add
              </button>
            </div>
            <input
              type="text"
              value={titleInput}
              maxLength={80}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Song title (optional)"
              aria-label="Optional song title"
              className="w-full rounded-xl border-[1.5px] border-ink/70 bg-white/75 px-2.5 py-1 text-[12px] font-bold placeholder:text-ink-soft/55"
            />
            {urlErr && <p className="text-[11px] font-bold text-tomato-deep">{urlErr}</p>}
          </form>
        </div>

        {/* Playlist */}
        <ul className="space-y-1.5">
          {prefs.tracks.length === 0 ? (
            <li className="py-4 text-center text-[12.5px] font-semibold italic text-ink-soft">
              No custom songs yet. Upload MP3/WAV/FLAC files or paste a YouTube / audio link above!
            </li>
          ) : (
            prefs.tracks.map((tr) => {
              const isCurrent = activeTrack?.id === tr.id;
              const isNowPlaying = isCurrent && songsPlaying;
              return (
                <li
                  key={tr.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 transition-colors",
                    isCurrent ? "border-ink bg-mustard/35" : "border-ink/25 bg-white/55 hover:border-ink/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => radio.playTrack(tr.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] border-ink",
                        isNowPlaying ? "bg-tomato text-paper" : "bg-white/80 text-ink",
                      )}
                    >
                      <Icon name={isNowPlaying ? "music" : "play"} size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-extrabold leading-tight">{tr.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-ink-soft">
                        <span className="rounded bg-paper-deep px-1 py-px text-[9px] font-extrabold text-ink">
                          {KIND_BADGE[tr.kind]}
                        </span>
                        {tr.duration ? <span>{formatDuration(tr.duration)}</span> : null}
                        {tr.ephemeral ? <span>Session only</span> : null}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove "${tr.title}"`}
                    onClick={() => radio.removeTrack(tr.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-tomato-deep"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t-[1.5px] border-ink px-4 py-2.5 text-[11.5px] sm:px-5">
        <span className="font-semibold text-ink-soft">
          {radio.storageMode === "saved"
            ? "Saved locally in this browser"
            : "Local files kept for this session"}
        </span>
        {muted && (
          <button
            type="button"
            onClick={onUnmute}
            className="font-extrabold text-tomato-deep underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            Sound muted (M) — Unmute
          </button>
        )}
      </footer>
    </aside>
  );
}

export function RestCard({ energy, onWake }: { energy: number; onWake: () => void }) {
  return (
    <div className="paper anim-rise pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pl-3 pr-2">
      <span className="anim-breathe text-[#3f4a78]">
        <Icon name="moon" size={22} />
      </span>
      <div className="w-[128px]">
        <p className="font-display text-[16px] font-semibold italic leading-none">
          {energy >= 100 ? "Fully rested" : "Resting…"}
        </p>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border-[1.5px] border-ink bg-white/60">
          <div className="h-full bg-sage transition-[width] duration-300" style={{ width: `${energy}%` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={onWake}
        className="press rounded-xl border-[1.5px] border-ink bg-mustard px-3.5 py-2 text-[13px] font-extrabold shadow-[2px_2px_0_var(--color-ink)]"
      >
        Wake up
      </button>
    </div>
  );
}

export function Veil({ gone }: { gone: boolean }) {
  return (
    <div
      aria-hidden={gone}
      className={cn(
        "pointer-events-none absolute inset-0 z-40 grid place-items-center bg-night transition-opacity duration-700",
        gone && "opacity-0",
      )}
    >
      <div className="flex flex-col items-center gap-3 text-paper">
        <p className="font-display text-[28px] italic leading-none">Cozy Study</p>
        <p className="anim-breathe text-[10.5px] font-extrabold uppercase tracking-[0.26em] text-paper/70">
          warming up the lamp
        </p>
      </div>
    </div>
  );
}
