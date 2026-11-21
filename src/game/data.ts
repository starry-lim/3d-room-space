import type { SkyPhase } from "../scene/StudyScene";

export type DiscoveryId =
  | "timer"
  | "bed"
  | "lamp"
  | "window"
  | "cat"
  | "mug"
  | "plant"
  | "radio"
  | "book"
  | "fairy"
  | "candle"
  | "globe"
  | "glowstars"
  | "mouse"
  | "box"
  | "bloom";

export type AvatarPresetId = "bun" | "hoodie" | "beanie" | "bear" | "cat" | "bunny" | "shiba" | "bot";
export type AvatarAccessory = "headphones" | "glasses" | "scarf" | "none";

export interface AvatarConfig {
  preset: AvatarPresetId;
  hairColor: string;
  topColor: string;
  bottomColor: string;
  accessory: AvatarAccessory;
  accessoryColor: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  preset: "bun",
  hairColor: "#3a2a28",
  topColor: "#7d9b76",
  bottomColor: "#3f4a78",
  accessory: "headphones",
  accessoryColor: "#e9b44c",
};

export type ExerciseKind = "yoga" | "weights" | "bike";

export const EXERCISE_LABELS: Record<ExerciseKind, string> = {
  yoga: "Yoga & Stretch",
  weights: "Dumbbell Training",
  bike: "Spin Bike",
};

export interface ExerciseLogEntry {
  id: string;
  kind: ExerciseKind;
  seconds: number;
  date: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export type RadioTrackKind = "file" | "youtube" | "url";
export type RadioTab = "lofi" | "songs";
export type RadioRepeat = "all" | "one";

export interface RadioTrack {
  id: string;
  title: string;
  kind: RadioTrackKind;
  src?: string;
  duration?: number;
  ephemeral?: boolean;
}

export interface RadioPrefs {
  tab: RadioTab;
  volume: number;
  shuffle: boolean;
  repeat: RadioRepeat;
  cozyFilter: boolean;
  tracks: RadioTrack[];
  activeTrackId: string | null;
}

export const DEFAULT_RADIO: RadioPrefs = {
  tab: "lofi",
  volume: 0.72,
  shuffle: false,
  repeat: "all",
  cozyFilter: false,
  tracks: [],
  activeTrackId: null,
};

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export interface Discovery {
  id: DiscoveryId;
  name: string;
  /** Shown in the journal before the thing has been found. */
  clue: string;
  /** Shown once it has. */
  note: string;
  secret?: boolean;
}

export const DISCOVERIES: Discovery[] = [
  {
    id: "timer",
    name: "Tomato timer",
    clue: "Something red is waiting on the desk.",
    note: "Wind it up. Twenty-five minutes is shorter than it sounds.",
  },
  {
    id: "bed",
    name: "A soft landing",
    clue: "The corner with the striped blanket looks inviting.",
    note: "Resting refills your energy. Miso will keep you company.",
  },
  {
    id: "lamp",
    name: "Desk lamp",
    clue: "A mustard-yellow neck leans over the desk.",
    note: "A small pool of light makes a big desk feel private.",
  },
  {
    id: "window",
    name: "Changing skies",
    clue: "The view outside is not fixed.",
    note: "Golden hour, night, morning. The window moves the day along.",
  },
  {
    id: "cat",
    name: "Miso",
    clue: "Someone ginger is asleep on a pink cushion.",
    note: "Purrs at roughly the frequency of a good idea.",
  },
  {
    id: "mug",
    name: "Warm cup",
    clue: "Steam is rising next to the notebook.",
    note: "Still hot. Every sip gives a little energy back.",
  },
  {
    id: "plant",
    name: "Thirsty monstera",
    clue: "The big leaves by the bed could use a drink.",
    note: "It grows a little each time you water it.",
  },
  {
    id: "radio",
    name: "Lo-fi radio",
    clue: "A cream box with an antenna sits on the cabinet.",
    note: "Slow chords and a bit of crackle.",
  },
  {
    id: "book",
    name: "The book that sticks out",
    clue: "One spine on the shelf is not pushed in.",
    note: "Pull it again for another page.",
  },
  {
    id: "fairy",
    name: "String lights",
    clue: "A wire is draped along the top of the wall.",
    note: "Twenty small bulbs. Best after dark.",
  },
  {
    id: "candle",
    name: "Windowsill candle",
    clue: "Something small and waxy sits on the sill.",
    note: "It flickers, and everything near it flickers too.",
  },
  {
    id: "globe",
    name: "Cabinet globe",
    clue: "The world is on the cabinet, standing still.",
    note: "Give it a spin. It slows down on its own.",
  },
  {
    id: "glowstars",
    name: "Glow-in-the-dark sky",
    clue: "Some things only show up in the dark.",
    note: "The stickers above the bed have been charging all day.",
    secret: true,
  },
  {
    id: "mouse",
    name: "Tiny roommate",
    clue: "Check the baseboard between the desk and the shelf.",
    note: "Pays no rent. Miso pretends not to notice.",
    secret: true,
  },
  {
    id: "box",
    name: "Shoebox of letters",
    clue: "Get low. Look under the bed.",
    note: "Old postcards, a ticket stub, one very good pen.",
    secret: true,
  },
  {
    id: "bloom",
    name: "Full bloom",
    clue: "Kindness, repeated, makes flowers.",
    note: "Three waterings and the monstera blooms pink.",
    secret: true,
  },
];

export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map((d) => [d.id, d])) as Record<
  DiscoveryId,
  Discovery
>;

/** Pages from the book that sticks out. */
export const PAGES = [
  "Start small. Small is still started.",
  "Rest is part of the work, not a reward for it.",
  "You do not need to feel ready. You need to begin.",
  "One page a day is a book by winter.",
  "Close the tabs you are not reading.",
  "Slow is smooth, and smooth gets finished.",
  "Attention is the only thing you actually spend.",
  "A tidy desk is optional. A next step is not.",
];

export const SKY_NAMES: Record<SkyPhase, { title: string; body: string }> = {
  dusk: { title: "Golden hour", body: "Long light across the floor." },
  night: { title: "Night", body: "The stars are out. So is the moon." },
  day: { title: "Morning", body: "Bright and clear." },
};

/* ------------------------------------------------------------------ */
/* Save data                                                           */
/* ------------------------------------------------------------------ */

export interface Save {
  found: DiscoveryId[];
  stars: number;
  energy: number;
  avatar: AvatarConfig;
  todos: TodoItem[];
  todoPinned: boolean;
  exerciseTotalSec: number;
  exerciseLog: ExerciseLogEntry[];
  radio: RadioPrefs;
}

const KEY = "cozy-study:save:v1";
export const FRESH: Save = {
  found: [],
  stars: 0,
  energy: 60,
  avatar: DEFAULT_AVATAR,
  todos: [],
  todoPinned: false,
  exerciseTotalSec: 0,
  exerciseLog: [],
  radio: DEFAULT_RADIO,
};

const VALID_PRESETS = new Set<AvatarPresetId>(["bun", "hoodie", "beanie", "bear", "cat", "bunny", "shiba", "bot"]);
const VALID_ACC = new Set<AvatarAccessory>(["headphones", "glasses", "scarf", "none"]);
const VALID_EX = new Set<ExerciseKind>(["yoga", "weights", "bike"]);
const VALID_RADIO_KIND = new Set<RadioTrackKind>(["file", "youtube", "url"]);
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return FRESH;
    const s = JSON.parse(raw) as Partial<Save>;
    const known = new Set(DISCOVERIES.map((d) => d.id));
    const av = s.avatar as Partial<AvatarConfig> | undefined;
    const avatar: AvatarConfig = av && VALID_PRESETS.has(av.preset as AvatarPresetId)
      ? {
          preset: av.preset as AvatarPresetId,
          hairColor: isHex(av.hairColor) ? av.hairColor : DEFAULT_AVATAR.hairColor,
          topColor: isHex(av.topColor) ? av.topColor : DEFAULT_AVATAR.topColor,
          bottomColor: isHex(av.bottomColor) ? av.bottomColor : DEFAULT_AVATAR.bottomColor,
          accessory: VALID_ACC.has(av.accessory as AvatarAccessory) ? (av.accessory as AvatarAccessory) : DEFAULT_AVATAR.accessory,
          accessoryColor: isHex(av.accessoryColor) ? av.accessoryColor : DEFAULT_AVATAR.accessoryColor,
        }
      : DEFAULT_AVATAR;
    const todos: TodoItem[] = Array.isArray(s.todos)
      ? s.todos
          .filter((t): t is TodoItem => !!t && typeof t.id === "string" && typeof t.text === "string" && typeof t.done === "boolean")
          .slice(0, 50)
      : [];
    const exerciseLog: ExerciseLogEntry[] = Array.isArray(s.exerciseLog)
      ? s.exerciseLog
          .filter(
            (e): e is ExerciseLogEntry =>
              !!e &&
              typeof e.id === "string" &&
              VALID_EX.has(e.kind as ExerciseKind) &&
              typeof e.seconds === "number" &&
              Number.isFinite(e.seconds) &&
              typeof e.date === "string",
          )
          .slice(0, 40)
      : [];
    const r = s.radio as Partial<RadioPrefs> | undefined;
    const tracks: RadioTrack[] = r && Array.isArray(r.tracks)
      ? r.tracks
          .filter(
            (t): t is RadioTrack =>
              !!t &&
              typeof t.id === "string" &&
              typeof t.title === "string" &&
              VALID_RADIO_KIND.has(t.kind as RadioTrackKind) &&
              (t.kind === "file" || (typeof t.src === "string" && t.src.length > 0)) &&
              (t.src === undefined || typeof t.src === "string") &&
              (t.duration === undefined || (typeof t.duration === "number" && Number.isFinite(t.duration) && t.duration > 0)),
          )
          .slice(0, 100)
          .map((t) => ({
            id: t.id,
            title: t.title,
            kind: t.kind,
            ...(t.src !== undefined ? { src: t.src } : {}),
            ...(t.duration !== undefined ? { duration: t.duration } : {}),
            ephemeral: false,
          }))
      : [];
    const activeTrackId =
      r && typeof r.activeTrackId === "string" && tracks.some((t) => t.id === r.activeTrackId)
        ? r.activeTrackId
        : null;
    const radio: RadioPrefs = r
      ? {
          tab: r.tab === "songs" ? "songs" : "lofi",
          volume:
            typeof r.volume === "number" && Number.isFinite(r.volume)
              ? Math.min(1, Math.max(0, r.volume))
              : DEFAULT_RADIO.volume,
          shuffle: typeof r.shuffle === "boolean" ? r.shuffle : DEFAULT_RADIO.shuffle,
          repeat: r.repeat === "one" ? "one" : "all",
          cozyFilter: typeof r.cozyFilter === "boolean" ? r.cozyFilter : DEFAULT_RADIO.cozyFilter,
          tracks,
          activeTrackId,
        }
      : DEFAULT_RADIO;
    return {
      found: Array.isArray(s.found) ? s.found.filter((id) => known.has(id)) : [],
      stars: Number.isFinite(s.stars) ? Math.max(0, Math.floor(s.stars as number)) : 0,
      energy: Number.isFinite(s.energy) ? Math.min(100, Math.max(0, s.energy as number)) : 60,
      avatar,
      todos,
      todoPinned: typeof s.todoPinned === "boolean" ? s.todoPinned : false,
      exerciseTotalSec: Number.isFinite(s.exerciseTotalSec) ? Math.max(0, Math.floor(s.exerciseTotalSec as number)) : 0,
      exerciseLog,
      radio,
    };
  } catch {
    return FRESH;
  }
}

export function storeSave(s: Save) {
  try {
    const persistedTracks = s.radio.tracks
      .filter((t) => !t.ephemeral)
      .map((t) => ({
        id: t.id,
        title: t.title,
        kind: t.kind,
        ...(t.src !== undefined ? { src: t.src } : {}),
        ...(t.duration !== undefined ? { duration: t.duration } : {}),
      }));
    const activeValid =
      s.radio.activeTrackId && persistedTracks.some((t) => t.id === s.radio.activeTrackId)
        ? s.radio.activeTrackId
        : null;
    const payload: Save = {
      ...s,
      radio: {
        ...s.radio,
        tracks: persistedTracks,
        activeTrackId: activeValid,
      },
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* private mode or full storage: the room still works, it just forgets */
  }
}
