import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudyScene, type ActivityMode, type SceneEvent } from "./scene/StudyScene";
import { sound } from "./game/audio";
import {
  DISCOVERIES,
  DISCOVERY_BY_ID,
  EXERCISE_LABELS,
  FRESH,
  PAGES,
  SKY_NAMES,
  formatDuration,
  loadSave,
  localDateKey,
  storeSave,
  type AvatarConfig,
  type DiscoveryId,
  type ExerciseKind,
  type Save,
} from "./game/data";
import { clearAllTrackBlobs } from "./game/radioStore";
import { formatTime, usePomodoro } from "./game/usePomodoro";
import { useRadio } from "./game/useRadio";
import {
  AvatarPanel,
  Brand,
  ControlsHint,
  Crosshair,
  CursorLabel,
  ExerciseCard,
  ExercisePanel,
  FocusCard,
  IconButton,
  Journal,
  MouseLockPrompt,
  PinnedTodo,
  RadioPanel,
  RestCard,
  TimerDock,
  TimerPanel,
  Toasts,
  TodoPanel,
  Veil,
  type Toast,
} from "./ui/Hud";
import { cn } from "./utils/cn";

const TITLE = "Cozy Study · a corner to focus in";
const clampEnergy = (n: number) => Math.min(100, Math.max(0, n));
const isExercise = (m: ActivityMode): m is ExerciseKind => m === "yoga" || m === "weights" || m === "bike";

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StudyScene | null>(null);
  const touch = useMemo(
    () =>
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      window.matchMedia("(pointer: coarse)").matches &&
      !window.matchMedia("(any-pointer: fine)").matches,
    [],
  );

  const [ready, setReady] = useState(false);
  const [glError, setGlError] = useState(false);
  const [save, setSave] = useState<Save>(loadSave);
  const [panel, setPanel] = useState<"timer" | "journal" | "todo" | "avatar" | "exercise" | "radio" | null>(null);
  const [resting, setResting] = useState(false);
  const [activity, setActivity] = useState<ActivityMode>("none");
  const [poufReading, setPoufReading] = useState(false);
  const [thirdPerson, setThirdPerson] = useState(false);
  const [exSec, setExSec] = useState(0);
  const [exRunning, setExRunning] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hints, setHints] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const radio = useRadio({
    prefs: save.radio,
    onChangePrefs: (updater) =>
      setSave((s) => ({
        ...s,
        radio: typeof updater === "function" ? updater(s.radio) : updater,
      })),
    muted,
  });

  const saveRef = useRef(save);
  saveRef.current = save;
  const restingRef = useRef(resting);
  restingRef.current = resting;
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const poufReadingRef = useRef(poufReading);
  poufReadingRef.current = poufReading;
  const thirdPersonRef = useRef(thirdPerson);
  thirdPersonRef.current = thirdPerson;
  const exSecRef = useRef(exSec);
  exSecRef.current = exSec;
  const toastId = useRef(0);
  const page = useRef(0);
  const lastSip = useRef(0);

  /* ---------------------------------------------------------------- */
  /* Toasts, discoveries, energy                                       */
  /* ---------------------------------------------------------------- */

  const pushToast = useCallback((t: Omit<Toast, "id">, ttl = 4200) => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((l) => l.map((x) => (x.id === id ? { ...x, leaving: true } : x))), ttl);
    window.setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), ttl + 360);
  }, []);

  const addEnergy = useCallback((d: number) => {
    setSave((s) => ({ ...s, energy: clampEnergy(s.energy + d) }));
  }, []);

  const discover = useCallback(
    (id: DiscoveryId) => {
      const cur = saveRef.current;
      if (cur.found.includes(id)) return false;
      const found = [...cur.found, id];
      saveRef.current = { ...cur, found };
      setSave((s) => (s.found.includes(id) ? s : { ...s, found: [...s.found, id] }));
      const d = DISCOVERY_BY_ID[id];
      if (d.secret) sound.secret();
      else sound.discover();
      pushToast(
        { tone: d.secret ? "secret" : "find", tag: d.secret ? "Secret found" : "New in your notes", title: d.name, body: d.note },
        d.secret ? 5400 : 4200,
      );
      const plain = DISCOVERIES.filter((x) => !x.secret);
      const secretsLeft = DISCOVERIES.length - found.length;
      if (!d.secret && secretsLeft > 0 && plain.every((x) => found.includes(x.id))) {
        window.setTimeout(
          () =>
            pushToast(
              {
                tone: "note",
                tag: "The easy part is done",
                title: `${secretsLeft} ${secretsLeft === 1 ? "secret is" : "secrets are"} still hiding.`,
                body: "Look low, look behind things, and try the room after dark. Your field notes have clues.",
              },
              7500,
            ),
          2600,
        );
      }
      if (found.length === DISCOVERIES.length) {
        window.setTimeout(() => {
          sound.complete();
          sceneRef.current?.celebrate();
          pushToast(
            {
              tone: "reward",
              tag: "Every corner explored",
              title: "You know this room by heart.",
              body: "Nothing left to find. Plenty left to finish.",
            },
            8000,
          );
        }, 1800);
      }
      return true;
    },
    [pushToast],
  );

  /* ---------------------------------------------------------------- */
  /* Rest, Focus, Exercise, To-Do & Avatar                             */
  /* ---------------------------------------------------------------- */

  const finishExercise = useCallback(
    (standUp = true) => {
      const cur = activityRef.current;
      if (!isExercise(cur)) return;
      const dur = exSecRef.current;
      if (dur >= 3) {
        const entry = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          kind: cur,
          seconds: dur,
          date: localDateKey(),
        };
        setSave((s) => ({
          ...s,
          exerciseTotalSec: s.exerciseTotalSec + dur,
          exerciseLog: [entry, ...s.exerciseLog].slice(0, 40),
          energy: dur >= 10 ? clampEnergy(s.energy + 6) : s.energy,
        }));
        sound.exerciseDone();
        pushToast(
          {
            tone: "reward",
            tag: "Workout logged",
            title: `${EXERCISE_LABELS[cur]} · ${formatDuration(dur)}`,
            body: dur >= 10 ? "Logged to your exercise history (+6 energy!)." : "Logged to your exercise history.",
          },
          4800,
        );
      } else if (standUp) {
        sound.pop();
      }
      setExSec(0);
      setExRunning(false);
      if (standUp) {
        setActivity("none");
        setPoufReading(false);
        setThirdPerson(false);
        setPanel((p) => (p === "avatar" ? null : p));
        sceneRef.current?.setActivity("none");
      }
    },
    [pushToast],
  );

  useEffect(() => {
    if (!isExercise(activity) || !exRunning) return;
    const id = window.setInterval(() => setExSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [activity, exRunning]);

  const startRest = useCallback(() => {
    if (restingRef.current) return;
    if (isExercise(activityRef.current)) finishExercise(false);
    if (activityRef.current !== "none") {
      setActivity("none");
      setPoufReading(false);
      setThirdPerson(false);
      sceneRef.current?.setActivity("none");
    }
    setResting(true);
    setPanel(null);
    sceneRef.current?.setResting(true);
    sound.lullaby();
  }, [finishExercise]);

  const wake = useCallback(() => {
    if (!restingRef.current) return;
    setResting(false);
    sceneRef.current?.setResting(false);
    sound.wake();
  }, []);

  useEffect(() => {
    if (!resting) return;
    const id = window.setInterval(() => addEnergy(1.6), 200);
    return () => window.clearInterval(id);
  }, [resting, addEnergy]);

  const full = save.energy >= 100;
  useEffect(() => {
    if (resting && full) {
      pushToast({ tone: "note", tag: "Fully rested", title: "Energy is back to full.", body: "Wake up whenever you like." }, 4200);
    }
  }, [resting, full, pushToast]);

  /* ---------------------------------------------------------------- */
  /* Pomodoro                                                          */
  /* ---------------------------------------------------------------- */

  const pomo = usePomodoro({
    onTick: (dt, mode, totalMs) => {
      // a full focus session costs 30 energy, however long it is
      if (mode === "focus" && !restingRef.current) addEnergy((-dt * 30) / Math.max(10, totalMs / 1000));
    },
    onFinish: (finished, long) => {
      if (finished === "focus") {
        const rested = saveRef.current.energy >= 50;
        const gain = rested ? 2 : 1;
        const stars = saveRef.current.stars + gain;
        setSave((s) => ({ ...s, stars: s.stars + gain }));
        sound.complete();
        sceneRef.current?.celebrate();
        sceneRef.current?.setStars(stars, true);
        const next = long ? "That makes four. Take the long break." : "Time for a break. The bed is free.";
        pushToast(
          {
            tone: "reward",
            tag: "Focus complete",
            title: gain === 2 ? "Two stars for the jar" : "One star for the jar",
            body: rested ? `Well-rested bonus. ${next}` : `${next} Rest up first and the next one earns two.`,
          },
          7000,
        );
        if (!restingRef.current) setPanel("timer");
      } else {
        sound.breakOver();
        pushToast({ tone: "note", tag: "Break is over", title: "Back to the desk.", body: "The timer is set for another round." }, 5000);
        wake();
      }
    },
  });

  const restForBreak = useCallback(() => {
    if (pomo.mode === "break" && !pomo.running) pomo.start();
    startRest();
  }, [pomo, startRest]);

  const enterActivity = useCallback(
    (mode: Exclude<ActivityMode, "none">, opts?: { reading?: boolean }) => {
      if (restingRef.current) wake();
      const prev = activityRef.current;
      if (isExercise(prev) && prev !== mode) {
        finishExercise(false);
      }
      if (prev === mode) {
        if (mode === "pouf" && opts?.reading && !poufReadingRef.current) {
          setPoufReading(true);
          sceneRef.current?.setPoufReading(true);
          sound.page();
        }
        return;
      }
      const reading = mode === "pouf" && !!opts?.reading;
      setActivity(mode);
      setPoufReading(reading);
      setThirdPerson(false);
      setPanel(null);
      sceneRef.current?.setActivity(mode, opts);

      if (mode === "desk") {
        sound.page();
        if (pomo.mode === "focus" && !pomo.running) pomo.start();
      } else if (mode === "pouf") {
        if (reading) sound.page();
        else sound.pop();
      } else {
        setExSec(0);
        setExRunning(true);
        sound.pop();
      }
    },
    [finishExercise, pomo, wake],
  );

  const exitActivity = useCallback(() => {
    const cur = activityRef.current;
    if (cur === "none") return;
    if (isExercise(cur)) {
      finishExercise(true);
      return;
    }
    setActivity("none");
    setPoufReading(false);
    setThirdPerson(false);
    setPanel((p) => (p === "avatar" ? null : p));
    sceneRef.current?.setActivity("none");
    sound.pop();
  }, [finishExercise]);

  const toggleThirdPerson = useCallback(() => {
    if (activityRef.current === "none") return;
    const next = !thirdPersonRef.current;
    setThirdPerson(next);
    sceneRef.current?.setThirdPerson(next);
    sound.click();
  }, []);

  const toggleModelPanel = useCallback(() => {
    if (activityRef.current === "none") return;
    if (panel === "avatar") {
      setPanel(null);
    } else {
      if (!thirdPersonRef.current) {
        setThirdPerson(true);
        sceneRef.current?.setThirdPerson(true);
      }
      setPanel("avatar");
    }
    sound.click();
  }, [panel]);

  const updateAvatarConfig = useCallback((next: AvatarConfig) => {
    setSave((s) => ({ ...s, avatar: next }));
    sceneRef.current?.setAvatarConfig(next);
  }, []);

  const addTodo = useCallback((text: string) => {
    setSave((s) => ({
      ...s,
      todos: [
        ...s.todos,
        { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, text, done: false },
      ],
    }));
    sound.pop();
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setSave((s) => ({
      ...s,
      todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
    sound.click();
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setSave((s) => ({
      ...s,
      todos: s.todos.filter((t) => t.id !== id),
    }));
  }, []);

  const clearDoneTodos = useCallback(() => {
    setSave((s) => ({
      ...s,
      todos: s.todos.filter((t) => !t.done),
    }));
    sound.pop();
  }, []);

  const toggleTodoPin = useCallback(() => {
    setSave((s) => ({ ...s, todoPinned: !s.todoPinned }));
    sound.click();
  }, []);

  const flipPage = useCallback(() => {
    sceneRef.current?.flipStudyPage();
    sound.page();
    const text = PAGES[page.current++ % PAGES.length];
    pushToast({ tone: "page", tag: `Page ${((page.current - 1) % PAGES.length) + 1}`, title: text }, 5200);
  }, [pushToast]);

  /* ---------------------------------------------------------------- */
  /* Scene                                                             */
  /* ---------------------------------------------------------------- */

  const onInteract = (e: SceneEvent) => {
    sound.unlock();
    switch (e.id) {
      case "timer":
        sound.pop();
        setPanel("timer");
        discover("timer");
        break;
      case "bed":
        if (!restingRef.current) startRest();
        else sound.pop();
        discover("bed");
        break;
      case "lamp":
      case "fairy":
        sound.click();
        discover(e.id);
        break;
      case "candle":
        sound.page();
        discover("candle");
        break;
      case "window":
        sound.whoosh();
        if (!discover("window") && e.phase) {
          pushToast({ tone: "note", tag: "Out the window", ...SKY_NAMES[e.phase] }, 2600);
        }
        break;
      case "cat":
        discover("cat");
        break;
      case "mug":
        // one sip per second counts; the cup is not bottomless
        if (performance.now() - lastSip.current > 1000) {
          lastSip.current = performance.now();
          addEnergy(4);
        }
        discover("mug");
        break;
      case "plant":
        sound.water();
        discover("plant");
        if (e.bloomed) window.setTimeout(() => discover("bloom"), 1100);
        break;
      case "radio":
        sound.click();
        setPanel((p) => (p === "radio" ? null : "radio"));
        discover("radio");
        break;
      case "book": {
        sound.page();
        const fresh = discover("book");
        const text = PAGES[page.current++ % PAGES.length];
        window.setTimeout(
          () => pushToast({ tone: "page", tag: `Page ${((page.current - 1) % PAGES.length) + 1}`, title: text }, 5200),
          fresh ? 900 : 250,
        );
        break;
      }
      case "study":
        if (activityRef.current === "desk") flipPage();
        else enterActivity("desk");
        break;
      case "pouf":
        if (activityRef.current === "pouf") sound.pop();
        else enterActivity("pouf", { reading: false });
        break;
      case "poufBook":
        if (activityRef.current === "pouf" && poufReadingRef.current) flipPage();
        else enterActivity("pouf", { reading: true });
        break;
      case "mat":
        if (activityRef.current !== "yoga") enterActivity("yoga");
        break;
      case "dumbbells":
        if (activityRef.current !== "weights") enterActivity("weights");
        break;
      case "bike":
        if (activityRef.current !== "bike") enterActivity("bike");
        break;
      case "todo":
        sound.pop();
        setPanel((p) => (p === "todo" ? null : "todo"));
        break;
      case "yarn":
      case "wand":
      case "scratcher":
      case "catBox":
      case "laser":
        break;
      case "globe":
        sound.spin();
        discover("globe");
        break;
      case "glowstars":
        if (e.glowing) {
          sound.sparkle();
          discover("glowstars");
        } else {
          sound.pop();
          pushToast(
            { tone: "note", tag: "Hm", title: "Pale little stickers.", body: "They might do something once it is dark." },
            3600,
          );
        }
        break;
      case "mouse":
        sound.squeak();
        discover("mouse");
        break;
      case "box":
        sound.page();
        discover("box");
        break;
    }
  };
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let scene: StudyScene;
    try {
      scene = new StudyScene(
        el,
        {
          onInteract: (e) => interactRef.current(e),
          onHover: setHover,
          onLockChange: setLocked,
          onMoveSfx: (kind, detail) => {
            sound.unlock();
            if (kind === "step") sound.step(!!detail?.running, !!detail?.crouched);
            else if (kind === "jump") sound.jump();
            else if (kind === "land") sound.land(detail?.strength);
          },
          onCatSfx: (kind) => {
            sound.unlock();
            if (kind === "meow") sound.meow();
            else if (kind === "trill") sound.trill();
            else if (kind === "purr") sound.purr();
            else if (kind === "hop") sound.catHop();
            else if (kind === "call") sound.callCat();
          },
          onMugSfx: (kind) => {
            sound.unlock();
            if (kind === "sip") sound.sip();
            else if (kind === "place") sound.mugPlace();
          },
          onToySfx: (kind) => {
            sound.unlock();
            if (kind === "bell") sound.bell();
            else if (kind === "scratch") sound.scratch();
            else if (kind === "yarn") sound.yarnBat();
            else if (kind === "laser") sound.laserBeep();
            else if (kind === "box") sound.boxRustle();
          },
          onReady: () => setReady(true),
        },
        touch,
      );
    } catch (err) {
      console.error(err);
      setGlError(true);
      setReady(true);
      return;
    }
    sceneRef.current = scene;
    scene.setStars(saveRef.current.stars);
    scene.setAvatarConfig(saveRef.current.avatar);
    scene.setTodos(saveRef.current.todos);
    scene.restore({ bloomed: saveRef.current.found.includes("bloom") });
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __cozy?: StudyScene }).__cozy = scene;
    }
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [touch]);

  const secs = Math.ceil(pomo.remaining / 1000);
  useEffect(() => {
    sceneRef.current?.setTimer({
      mode: pomo.mode,
      remainingMs: pomo.remaining,
      totalMs: pomo.total,
      running: pomo.running,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomo.mode, secs, pomo.total, pomo.running]);

  useEffect(() => {
    sceneRef.current?.setHints(hints, save.found);
  }, [hints, save.found]);

  useEffect(() => {
    sceneRef.current?.setTodos(save.todos);
  }, [save.todos]);

  useEffect(() => {
    sceneRef.current?.setUiOpen(
      panel === "timer" || panel === "journal" || panel === "todo" || panel === "exercise" || panel === "radio",
    );
  }, [panel]);

  useEffect(() => {
    sceneRef.current?.setRadioPlaying(radio.playing, radio.nowPlayingLabel);
  }, [radio.playing, radio.nowPlayingLabel]);

  useEffect(() => sound.setMuted(muted), [muted]);

  useEffect(() => {
    document.title = pomo.running ? `${formatTime(secs * 1000)} · ${pomo.mode === "focus" ? "Focus" : "Break"} · Cozy Study` : TITLE;
  }, [pomo.running, pomo.mode, secs]);

  // persist, but not five times a second while energy is moving
  const energyStep = Math.round(save.energy / 4);
  useEffect(() => {
    storeSave(saveRef.current);
  }, [save.found, save.stars, energyStep, save.avatar, save.todos, save.todoPinned, save.exerciseTotalSec, save.exerciseLog, save.radio]);

  /* a nudge for first-time visitors once the camera has settled */
  useEffect(() => {
    if (!ready || glError || saveRef.current.found.length > 0) return;
    const id = window.setTimeout(() => {
      if (saveRef.current.found.length === 0) {
        pushToast(
          {
            tone: "note",
            tag: "Welcome in",
            title: "Walk around — things in this room respond.",
            body: "Click the room for mouse look, WASD to walk, Shift to run, Space to jump, C to squat low and peek under things.",
          },
          7500,
        );
      }
    }, 3200);
    return () => window.clearTimeout(id);
  }, [ready, glError, pushToast]);

  /* ---------------------------------------------------------------- */
  /* Global input                                                      */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const toggleHints = useCallback(() => {
    setHints((h) => {
      if (!h) {
        const left = DISCOVERIES.filter((d) => !d.secret && !saveRef.current.found.includes(d.id)).length;
        pushToast(
          left
            ? { tone: "note", tag: "Hints on", title: `${left} ${left === 1 ? "sparkle marks" : "sparkles mark"} what you have not tried.`, body: "Secrets stay hidden. The field notes have clues." }
            : { tone: "note", tag: "Hints on", title: "Only secrets are left.", body: "Sparkles will not show those. Read the clues in your field notes." },
          4200,
        );
      }
      return !h;
    });
  }, [pushToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const onButton = (e.target as HTMLElement | null)?.closest?.("button, [role=tab], input, textarea");
      const k = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (panel) setPanel(null);
        else if (restingRef.current) wake();
        else if (activityRef.current !== "none") exitActivity();
      } else if (onButton) {
        return;
      } else if (k === "v" && activityRef.current !== "none") {
        toggleThirdPerson();
      } else if (k === "p") {
        e.preventDefault();
        pomo.toggle();
      } else if (k === "j") setPanel((p) => (p === "journal" ? null : "journal"));
      else if (k === "l") setPanel((p) => (p === "todo" ? null : "todo"));
      else if (k === "t") setPanel((p) => (p === "timer" ? null : "timer"));
      else if (k === "h") toggleHints();
      else if (k === "m") setMuted((m) => !m);
      else if (k === "r") sceneRef.current?.resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, pomo.toggle, wake, exitActivity, toggleThirdPerson, toggleHints]);

  const resetAll = async () => {
    await clearAllTrackBlobs();
    storeSave(FRESH);
    window.location.reload();
  };

  const foundCount = save.found.length;
  const undoneTodos = save.todos.filter((t) => !t.done).length;

  /* ---------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-night">
      <div ref={mountRef} className="absolute inset-0" />

      {glError && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="paper max-w-sm rounded-3xl p-6 text-center">
            <p className="font-display text-2xl font-semibold italic">The room could not be drawn.</p>
            <p className="mt-2 text-sm text-ink-soft">
              This browser has WebGL switched off, so the 3D corner is missing. The timer below still works.
            </p>
          </div>
        </div>
      )}

      {/* sleepy vignette */}
      <div
        className={cn("pointer-events-none absolute inset-0 transition-opacity duration-[1800ms]", resting ? "opacity-100" : "opacity-0")}
        style={{ background: "radial-gradient(ellipse at 50% 55%, transparent 38%, rgb(10 7 22 / 0.7) 100%)" }}
      />

      <div
        className="pointer-events-none absolute inset-0 flex flex-col"
        style={{
          padding:
            "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
        }}
      >
        {/* toasts sit beside the tool column on phones, top-centre on larger screens */}
        <div className="absolute left-3 right-[68px] top-[106px] z-30 sm:left-1/2 sm:right-auto sm:top-4 sm:w-[340px] sm:-translate-x-1/2">
          <Toasts items={toasts} />
        </div>

        {/* top */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col items-start">
            <Brand stars={save.stars} energy={save.energy} />
            {save.todoPinned && panel !== "todo" && (
              <PinnedTodo
                todos={save.todos}
                onToggle={toggleTodo}
                onOpenPanel={() => setPanel("todo")}
                onUnpin={toggleTodoPin}
              />
            )}
          </div>
          <nav className="pointer-events-auto flex flex-col gap-2 sm:flex-row" aria-label="Room tools">
            <IconButton
              icon="list"
              label={`To-do list, ${undoneTodos} remaining (L)`}
              onClick={() => setPanel((p) => (p === "todo" ? null : "todo"))}
              pressed={panel === "todo"}
              badge={undoneTodos || undefined}
            />
            <IconButton
              icon="book"
              label={`Field notes, ${foundCount} of ${DISCOVERIES.length} found (J)`}
              onClick={() => setPanel((p) => (p === "journal" ? null : "journal"))}
              pressed={panel === "journal"}
              badge={foundCount || undefined}
            />
            <IconButton icon="spark" label={hints ? "Hide hints (H)" : "Show hints (H)"} onClick={toggleHints} pressed={hints} />
            <IconButton icon={muted ? "mute" : "sound"} label={muted ? "Turn sound on (M)" : "Turn sound off (M)"} onClick={() => setMuted((m) => !m)} />
            <IconButton icon="home" label="Reset the view (R)" onClick={() => sceneRef.current?.resetView()} />
          </nav>
        </div>

        {/* middle: slide-in side panels */}
        <div className="relative min-h-0 flex-1">
          {panel === "journal" && (
            <div className="absolute inset-x-0 bottom-3 top-3 z-20 flex justify-end">
              <Journal found={save.found} stars={save.stars} onClose={() => setPanel(null)} onReset={resetAll} />
            </div>
          )}
          {panel === "todo" && (
            <div className="absolute inset-x-0 bottom-3 top-3 z-20 flex justify-end">
              <TodoPanel
                todos={save.todos}
                pinned={save.todoPinned}
                onAdd={addTodo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onClearDone={clearDoneTodos}
                onTogglePin={toggleTodoPin}
                onClose={() => setPanel(null)}
              />
            </div>
          )}
          {panel === "exercise" && (
            <div className="absolute inset-x-0 bottom-3 top-3 z-20 flex justify-end">
              <ExercisePanel
                totalSec={save.exerciseTotalSec}
                log={save.exerciseLog}
                onClose={() => setPanel(null)}
              />
            </div>
          )}
          <div
            aria-hidden={panel !== "radio"}
            inert={panel !== "radio"}
            className={
              panel === "radio"
                ? "absolute inset-x-0 bottom-3 top-3 z-20 flex justify-end"
                : "pointer-events-none fixed -left-[9999px] top-0 h-[560px] w-[384px] opacity-0"
            }
          >
            <RadioPanel
              open={panel === "radio"}
              prefs={save.radio}
              radio={radio}
              muted={muted}
              onUnmute={() => setMuted(false)}
              onClose={() => setPanel(null)}
            />
          </div>
        </div>

        {/* bottom */}
        <div className="flex flex-col items-center gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className={cn("self-start sm:self-end sm:justify-self-start", panel && "max-sm:hidden")}>
            <ControlsHint touch={touch} locked={locked} />
          </div>
          <div className="flex flex-col items-center gap-2">
            {panel === "avatar" && activity !== "none" && !resting && (
              <AvatarPanel config={save.avatar} onChange={updateAvatarConfig} onClose={() => setPanel(null)} />
            )}
            {resting && <RestCard energy={save.energy} onWake={wake} />}
            {(activity === "desk" || activity === "pouf") && !resting && (
              <FocusCard
                mode={activity}
                reading={activity === "desk" || poufReading}
                thirdPerson={thirdPerson}
                modelOpen={panel === "avatar"}
                onToggleView={toggleThirdPerson}
                onToggleModel={toggleModelPanel}
                onToggleReading={() => enterActivity("pouf", { reading: true })}
                onFlipPage={flipPage}
                onStand={exitActivity}
              />
            )}
            {isExercise(activity) && !resting && (
              <ExerciseCard
                label={EXERCISE_LABELS[activity]}
                seconds={exSec}
                running={exRunning}
                thirdPerson={thirdPerson}
                modelOpen={panel === "avatar"}
                historyOpen={panel === "exercise"}
                onToggleRun={() =>
                  setExRunning((r) => {
                    const next = !r;
                    sceneRef.current?.setExercisePaused(!next);
                    sound.click();
                    return next;
                  })
                }
                onToggleView={toggleThirdPerson}
                onToggleModel={toggleModelPanel}
                onToggleHistory={() => setPanel((p) => (p === "exercise" ? null : "exercise"))}
                onFinish={() => finishExercise(true)}
              />
            )}
            {panel === "timer" ? (
              <TimerPanel p={pomo} resting={resting} onClose={() => setPanel(null)} onRest={restForBreak} />
            ) : (
              <TimerDock p={pomo} onOpen={() => setPanel("timer")} />
            )}
          </div>
          <div className="max-sm:hidden" />
        </div>
      </div>

      {!touch && locked && <Crosshair label={hover} />}
      {!touch && !locked && !resting && activity === "none" && panel === null && ready && !glError && (
        <MouseLockPrompt onLock={() => sceneRef.current?.lockPointer()} />
      )}
      {!touch && !locked && (resting || activity !== "none" || panel !== null) && <CursorLabel text={hover} />}
      <Veil gone={ready} />
    </div>
  );
}
