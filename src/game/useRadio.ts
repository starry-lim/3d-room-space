import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { RadioPrefs, RadioTab, RadioTrack } from "./data";
import { sound } from "./audio";
import { deleteTrackBlob, loadAllTrackBlobs, saveTrackBlob } from "./radioStore";

interface YTPlayer {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoData?(): { title?: string; video_id?: string };
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number | undefined>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

type YTWindow = Window & {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube player requires a browser window."));
  }
  const w = window as unknown as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      ytApiPromise = null;
      reject(new Error("Timed out loading YouTube player (check internet connection)."));
    }, 12000);

    const prevReady = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try {
        prevReady?.();
      } catch {
        /* ignored */
      }
      window.clearTimeout(timeout);
      if (w.YT?.Player) {
        resolve(w.YT);
      } else {
        ytApiPromise = null;
        reject(new Error("YouTube player API did not initialize."));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => {
        window.clearTimeout(timeout);
        ytApiPromise = null;
        reject(new Error("Could not reach YouTube (offline or blocked)."));
      };
      document.head.appendChild(s);
    }
  });

  return ytApiPromise;
}

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|webm)$/i;

export function extractYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const seg = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return YT_ID_RE.test(seg) ? seg : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && YT_ID_RE.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    if ((parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed") && parts[1] && YT_ID_RE.test(parts[1])) {
      return parts[1];
    }
  }
  return null;
}

function titleFromUrl(url: URL): string {
  const seg = url.pathname.split("/").filter(Boolean).pop();
  if (seg) {
    try {
      const decoded = decodeURIComponent(seg).replace(AUDIO_EXT_RE, "").replace(/[-_]+/g, " ").trim();
      if (decoded.length >= 2) return decoded.slice(0, 64);
    } catch {
      /* fall back to hostname */
    }
  }
  return url.hostname.replace(/^www\./, "");
}

export function parseSongUrl(
  raw: string,
  customTitle?: string,
): { ok: true; track: Omit<RadioTrack, "id"> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste a YouTube or audio URL first." };

  const ytId = extractYouTubeId(trimmed);
  const titleOverride = customTitle?.trim().slice(0, 80);
  if (ytId) {
    return {
      ok: true,
      track: {
        kind: "youtube",
        src: ytId,
        title: titleOverride || `YouTube · ${ytId}`,
      },
    };
  }

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.includes(".") && !/\s/.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return { ok: false, error: "Enter a valid YouTube link or http/https audio URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http:// and https:// audio links are supported." };
  }

  return {
    ok: true,
    track: {
      kind: "url",
      src: url.href,
      title: titleOverride || titleFromUrl(url),
    },
  };
}

function ytErrorText(code: number, isFile: boolean): string {
  if (isFile) {
    return "YouTube blocked playback from a local file (file://). Once hosted on GitHub Pages (https://) or localhost, YouTube plays normally — local audio files always work offline here.";
  }
  if (code === 101 || code === 150 || code === 153) {
    return "The video uploader restricted embedded playback for this YouTube video.";
  }
  if (code === 100) {
    return "This YouTube video is unavailable or set to private.";
  }
  return "Could not play this YouTube link right now.";
}

export interface RadioController {
  source: RadioTab;
  playing: boolean;
  activeTrack: RadioTrack | null;
  currentTime: number;
  duration: number;
  error: string | null;
  storageMode: "saved" | "session";
  isFileProtocol: boolean;
  ytSlotRef: RefObject<HTMLDivElement | null>;
  nowPlayingLabel: string | null;
  setTab: (tab: RadioTab) => void;
  toggleLofi: () => void;
  playTrack: (id: string) => void;
  togglePlaySong: () => void;
  nextTrack: (fromEnded?: boolean) => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleCozyFilter: () => void;
  addFiles: (files: FileList | File[]) => Promise<{ added: number; rejected: number }>;
  addUrl: (url: string, title?: string) => { ok: boolean; error?: string };
  removeTrack: (id: string) => void;
  clearError: () => void;
}

export function useRadio({
  prefs,
  onChangePrefs,
  muted,
}: {
  prefs: RadioPrefs;
  onChangePrefs: (updater: RadioPrefs | ((prev: RadioPrefs) => RadioPrefs)) => void;
  muted: boolean;
}): RadioController {
  const [source, setSource] = useState<RadioTab>("lofi");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<"saved" | "session">("saved");

  const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const onChangePrefsRef = useRef(onChangePrefs);
  onChangePrefsRef.current = onChangePrefs;

  const ytSlotRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytReadyRef = useRef(false);
  const ytLoadingRef = useRef(false);
  const cozyConnectedRef = useRef(false);

  const directAudioRef = useRef<HTMLAudioElement | null>(null);
  const filteredAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);

  // Prevents async ended/pause/error events from an old backend after switching
  const desiredBackendRef = useRef<"lofi" | "audio" | "youtube" | null>(null);
  const loadedAudioKeyRef = useRef<string>("");
  const loadedYtIdRef = useRef<string>("");
  const pendingYtPlayRef = useRef<{ videoId: string; seekTo?: number } | null>(null);
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  const activeTrack = useMemo(
    () => prefs.tracks.find((t) => t.id === prefs.activeTrackId) ?? prefs.tracks[0] ?? null,
    [prefs.tracks, prefs.activeTrackId],
  );
  const activeTrackRef = useRef(activeTrack);
  activeTrackRef.current = activeTrack;

  const stopAudioEls = useCallback((clearActive = true) => {
    for (const el of [directAudioRef.current, filteredAudioRef.current]) {
      if (el) {
        try {
          el.pause();
        } catch {
          /* ignored */
        }
      }
    }
    if (clearActive) activeAudioElRef.current = null;
  }, []);

  const stopYouTube = useCallback(() => {
    pendingYtPlayRef.current = null;
    const p = ytPlayerRef.current;
    if (p && ytReadyRef.current) {
      try {
        p.pauseVideo();
      } catch {
        /* ignored */
      }
    }
  }, []);

  const updateTrackMeta = useCallback((id: string, patch: Partial<RadioTrack>) => {
    onChangePrefsRef.current((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const nextTrackRef = useRef<(fromEnded?: boolean) => void>(() => {});

  /* Create both <audio> elements once & bind lifecycle events */
  useEffect(() => {
    const direct = new Audio();
    direct.preload = "metadata";
    const filtered = new Audio();
    filtered.preload = "metadata";
    directAudioRef.current = direct;
    filteredAudioRef.current = filtered;

    const bind = (el: HTMLAudioElement) => {
      const onLoadedMetadata = () => {
        if (activeAudioElRef.current !== el) return;
        const d = el.duration;
        if (Number.isFinite(d) && d > 0) {
          setDuration(d);
          const tr = activeTrackRef.current;
          if (tr && !tr.duration) updateTrackMeta(tr.id, { duration: Math.round(d) });
        } else {
          setDuration(0);
        }
      };
      const onEnded = () => {
        if (activeAudioElRef.current !== el || desiredBackendRef.current !== "audio") return;
        nextTrackRef.current(true);
      };
      const onError = () => {
        if (activeAudioElRef.current !== el || desiredBackendRef.current !== "audio") return;
        desiredBackendRef.current = null;
        setPlaying(false);
        setError("Could not play this audio file or stream (unsupported format, offline, or blocked by host).");
      };
      el.addEventListener("loadedmetadata", onLoadedMetadata);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
      return () => {
        el.removeEventListener("loadedmetadata", onLoadedMetadata);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onError);
      };
    };

    const unbindDirect = bind(direct);
    const unbindFiltered = bind(filtered);

    return () => {
      unbindDirect();
      unbindFiltered();
      direct.pause();
      filtered.pause();
      direct.removeAttribute("src");
      filtered.removeAttribute("src");
      direct.load();
      filtered.load();
      sound.setRadio(false);
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          /* ignored */
        }
        ytPlayerRef.current = null;
      }
      for (const url of blobUrlsRef.current.values()) URL.revokeObjectURL(url);
      blobUrlsRef.current.clear();
    };
  }, [updateTrackMeta]);

  /* Sync initial radio volume & hydrate persisted local audio blobs from IndexedDB */
  useEffect(() => {
    sound.setRadioVolume(prefsRef.current.volume);
    let cancelled = false;
    void loadAllTrackBlobs().then((blobs) => {
      if (cancelled) return;
      if (!blobs) {
        setStorageMode("session");
        // Drop orphaned saved file entries when IndexedDB cannot open
        if (prefsRef.current.tracks.some((t) => t.kind === "file")) {
          onChangePrefsRef.current((prev) => {
            const tracks = prev.tracks.filter((t) => t.kind !== "file");
            const activeTrackId = tracks.some((t) => t.id === prev.activeTrackId) ? prev.activeTrackId : (tracks[0]?.id ?? null);
            return { ...prev, tracks, activeTrackId };
          });
        }
        return;
      }
      const prevTracks = prefsRef.current.tracks;
      const missingIds: string[] = [];
      for (const t of prevTracks) {
        if (t.kind === "file") {
          const blob = blobs.get(t.id);
          if (blob) {
            blobUrlsRef.current.set(t.id, URL.createObjectURL(blob));
          } else {
            missingIds.push(t.id);
          }
        }
      }
      if (missingIds.length > 0) {
        const missSet = new Set(missingIds);
        onChangePrefsRef.current((prev) => {
          const tracks = prev.tracks.filter((t) => !missSet.has(t.id));
          const activeTrackId = tracks.some((t) => t.id === prev.activeTrackId) ? prev.activeTrackId : (tracks[0]?.id ?? null);
          return { ...prev, tracks, activeTrackId };
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Keep volume & mute synchronized across all backends */
  useEffect(() => {
    sound.setRadioVolume(prefs.volume);
    const direct = directAudioRef.current;
    if (direct) {
      direct.muted = muted;
      direct.volume = muted ? 0 : prefs.volume;
    }
    const filtered = filteredAudioRef.current;
    if (filtered) {
      if (cozyConnectedRef.current) {
        filtered.muted = false;
        filtered.volume = 1;
      } else {
        filtered.muted = muted;
        filtered.volume = muted ? 0 : prefs.volume;
      }
    }
    const yt = ytPlayerRef.current;
    if (yt && ytReadyRef.current) {
      try {
        if (muted) yt.mute();
        else {
          yt.unMute();
          yt.setVolume(Math.round(prefs.volume * 100));
        }
      } catch {
        /* ignored */
      }
    }
  }, [prefs.volume, muted]);

  const ensureYouTubePlayer = useCallback(async (videoId: string) => {
    if (ytPlayerRef.current && ytReadyRef.current) {
      if (loadedYtIdRef.current !== videoId) {
        loadedYtIdRef.current = videoId;
        ytPlayerRef.current.loadVideoById(videoId);
      } else {
        ytPlayerRef.current.playVideo();
      }
      return;
    }

    pendingYtPlayRef.current = { videoId };
    if (ytLoadingRef.current || ytPlayerRef.current) return;
    ytLoadingRef.current = true;

    try {
      const YT = await loadYouTubeApi();
      const slot = ytSlotRef.current;
      if (!slot) {
        ytLoadingRef.current = false;
        return;
      }
      const mount = document.createElement("div");
      mount.style.width = "100%";
      mount.style.height = "100%";
      slot.replaceChildren(mount);

      const initialId = pendingYtPlayRef.current?.videoId ?? videoId;
      loadedYtIdRef.current = initialId;

      const origin = window.location.origin;
      const playerVars: Record<string, string | number | undefined> = {
        autoplay: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
      };
      if (origin && origin !== "null" && /^https?:\/\//i.test(origin)) {
        playerVars.origin = origin;
      }

      ytPlayerRef.current = new YT.Player(mount, {
        width: "100%",
        height: "100%",
        videoId: initialId,
        playerVars,
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            ytLoadingRef.current = false;
            const p = ytPlayerRef.current;
            if (!p) return;
            try {
              if (mutedRef.current) p.mute();
              else {
                p.unMute();
                p.setVolume(Math.round(prefsRef.current.volume * 100));
              }
              const pending = pendingYtPlayRef.current;
              pendingYtPlayRef.current = null;
              if (desiredBackendRef.current === "youtube" && pending) {
                if (loadedYtIdRef.current !== pending.videoId) {
                  loadedYtIdRef.current = pending.videoId;
                  p.loadVideoById(pending.videoId);
                } else {
                  p.playVideo();
                }
              } else {
                p.pauseVideo();
              }
            } catch {
              /* ignored */
            }
          },
          onStateChange: (e) => {
            if (desiredBackendRef.current !== "youtube") return;
            if (e.data === 1) {
              // PLAYING
              setPlaying(true);
              setError(null);
              const p = ytPlayerRef.current;
              const tr = activeTrackRef.current;
              const metaTitle = p?.getVideoData?.()?.title?.trim();
              if (p && tr && tr.kind === "youtube" && metaTitle && tr.title.startsWith("YouTube · ")) {
                updateTrackMeta(tr.id, { title: metaTitle.slice(0, 80) });
              }
              const d = p?.getDuration?.() ?? 0;
              if (Number.isFinite(d) && d > 0) setDuration(d);
            } else if (e.data === 2) {
              // PAUSED by user inside YouTube controls
              setPlaying(false);
            } else if (e.data === 0) {
              // ENDED
              nextTrackRef.current(true);
            }
          },
          onError: (e) => {
            ytLoadingRef.current = false;
            if (desiredBackendRef.current !== "youtube") return;
            desiredBackendRef.current = null;
            setPlaying(false);
            setError(ytErrorText(e.data, window.location.protocol === "file:"));
          },
        },
      });
    } catch (err) {
      ytLoadingRef.current = false;
      if (desiredBackendRef.current === "youtube") {
        desiredBackendRef.current = null;
        setPlaying(false);
        setError(err instanceof Error ? err.message : "Could not load YouTube player.");
      }
    }
  }, [updateTrackMeta]);

  const chooseAudioEl = useCallback((track: RadioTrack): HTMLAudioElement | null => {
    const direct = directAudioRef.current;
    const filtered = filteredAudioRef.current;
    if (!direct || !filtered) return null;
    if (track.kind === "file" && prefsRef.current.cozyFilter) {
      const ok = sound.attachCozyAudio(filtered);
      if (ok) {
        cozyConnectedRef.current = true;
        filtered.muted = false;
        filtered.volume = 1;
        return filtered;
      }
    }
    direct.muted = mutedRef.current;
    direct.volume = mutedRef.current ? 0 : prefsRef.current.volume;
    return direct;
  }, []);

  const startTrack = useCallback(
    (track: RadioTrack, opts?: { resumeFrom?: number; restart?: boolean }) => {
      setError(null);
      setSource("songs");
      sourceRef.current = "songs";
      sound.setRadio(false);

      if (track.kind === "youtube") {
        stopAudioEls();
        const vid = track.src ?? "";
        if (!YT_ID_RE.test(vid)) {
          setPlaying(false);
          setError("Invalid YouTube video ID.");
          return;
        }
        desiredBackendRef.current = "youtube";
        setPlaying(true);
        if (opts?.restart) {
          loadedYtIdRef.current = "";
        }
        setCurrentTime(0);
        setDuration(track.duration ?? 0);
        void ensureYouTubePlayer(vid);
        return;
      }

      // Local file or direct audio URL
      stopYouTube();
      const targetUrl = track.kind === "file" ? blobUrlsRef.current.get(track.id) : track.src;
      if (!targetUrl) {
        desiredBackendRef.current = null;
        setPlaying(false);
        setError("Audio file data is unavailable in this browser session.");
        return;
      }

      const el = chooseAudioEl(track);
      if (!el) return;
      const other = el === directAudioRef.current ? filteredAudioRef.current : directAudioRef.current;
      if (other && !other.paused) {
        try {
          other.pause();
        } catch {
          /* ignored */
        }
      }

      const key = `${track.kind}:${track.id}:${targetUrl}:${el === filteredAudioRef.current ? "cozy" : "raw"}`;
      const sameLoaded = loadedAudioKeyRef.current === key && activeAudioElRef.current === el;
      activeAudioElRef.current = el;
      desiredBackendRef.current = "audio";

      if (!sameLoaded) {
        loadedAudioKeyRef.current = key;
        el.src = targetUrl;
        el.load();
      }
      if (opts?.restart) {
        try {
          el.currentTime = 0;
        } catch {
          /* ignored */
        }
      } else if (typeof opts?.resumeFrom === "number" && opts.resumeFrom > 0) {
        const applySeek = () => {
          try {
            el.currentTime = opts.resumeFrom!;
          } catch {
            /* ignored */
          }
        };
        if (el.readyState >= 1) applySeek();
        else el.addEventListener("loadedmetadata", applySeek, { once: true });
      }

      setDuration(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : (track.duration ?? 0));
      setCurrentTime(opts?.resumeFrom ?? (opts?.restart ? 0 : el.currentTime || 0));
      setPlaying(true);
      void el.play().catch(() => {
        if (desiredBackendRef.current === "audio" && activeAudioElRef.current === el) {
          setPlaying(false);
          setError("Playback blocked or unable to load this audio source.");
        }
      });
    },
    [chooseAudioEl, ensureYouTubePlayer, stopAudioEls, stopYouTube],
  );

  const playTrack = useCallback(
    (id: string) => {
      const tr = prefsRef.current.tracks.find((t) => t.id === id);
      if (!tr) return;
      onChangePrefsRef.current((prev) => ({ ...prev, activeTrackId: id }));
      startTrack(tr, { restart: tr.id !== activeTrackRef.current?.id });
    },
    [startTrack],
  );

  const toggleLofi = useCallback(() => {
    sound.unlock();
    setError(null);
    if (sourceRef.current === "lofi" && playingRef.current) {
      desiredBackendRef.current = null;
      sound.setRadio(false);
      setPlaying(false);
      return;
    }
    stopAudioEls();
    stopYouTube();
    desiredBackendRef.current = "lofi";
    setSource("lofi");
    sourceRef.current = "lofi";
    sound.setRadioVolume(prefsRef.current.volume);
    sound.setRadio(true);
    setPlaying(true);
  }, [stopAudioEls, stopYouTube]);

  const togglePlaySong = useCallback(() => {
    sound.unlock();
    const tr = activeTrackRef.current;
    if (!tr) return;
    if (sourceRef.current !== "songs") {
      startTrack(tr);
      return;
    }
    if (playingRef.current) {
      desiredBackendRef.current = null;
      stopAudioEls(false);
      stopYouTube();
      setPlaying(false);
      return;
    }
    startTrack(tr);
  }, [startTrack, stopAudioEls, stopYouTube]);

  const seek = useCallback((seconds: number) => {
    const tr = activeTrackRef.current;
    if (!tr || sourceRef.current !== "songs") return;
    const clamped = Math.max(0, seconds);
    setCurrentTime(clamped);
    if (tr.kind === "youtube") {
      const p = ytPlayerRef.current;
      if (p && ytReadyRef.current) {
        try {
          p.seekTo(clamped, true);
        } catch {
          /* ignored */
        }
      }
      return;
    }
    const el = activeAudioElRef.current;
    if (el) {
      try {
        el.currentTime = clamped;
      } catch {
        /* ignored */
      }
    }
  }, []);

  const nextTrack = useCallback(
    (fromEnded = false) => {
      const { tracks, shuffle, repeat } = prefsRef.current;
      if (tracks.length === 0) {
        desiredBackendRef.current = null;
        stopAudioEls();
        stopYouTube();
        setPlaying(false);
        return;
      }
      const cur = activeTrackRef.current;
      if (fromEnded && repeat === "one" && cur) {
        startTrack(cur, { restart: true });
        return;
      }
      const curIdx = cur ? tracks.findIndex((t) => t.id === cur.id) : 0;
      let nextIdx = (curIdx + 1) % tracks.length;
      if (shuffle && tracks.length > 1) {
        do {
          nextIdx = Math.floor(Math.random() * tracks.length);
        } while (nextIdx === curIdx);
      }
      const next = tracks[nextIdx];
      onChangePrefsRef.current((prev) => ({ ...prev, activeTrackId: next.id }));
      startTrack(next, { restart: true });
    },
    [startTrack, stopAudioEls, stopYouTube],
  );
  nextTrackRef.current = nextTrack;

  const prevTrack = useCallback(() => {
    const { tracks } = prefsRef.current;
    if (tracks.length === 0) return;
    const cur = activeTrackRef.current;
    if (sourceRef.current === "songs" && currentTimeRef.current > 3 && cur) {
      seek(0);
      return;
    }
    const curIdx = cur ? tracks.findIndex((t) => t.id === cur.id) : 0;
    const prevIdx = (curIdx - 1 + tracks.length) % tracks.length;
    const prev = tracks[prevIdx];
    onChangePrefsRef.current((p) => ({ ...p, activeTrackId: prev.id }));
    startTrack(prev, { restart: true });
  }, [seek, startTrack]);

  const setTab = useCallback((tab: RadioTab) => {
    onChangePrefsRef.current((prev) => ({ ...prev, tab }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.min(1, Math.max(0, vol));
    onChangePrefsRef.current((prev) => ({ ...prev, volume: clamped }));
  }, []);

  const toggleShuffle = useCallback(() => {
    onChangePrefsRef.current((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const cycleRepeat = useCallback(() => {
    onChangePrefsRef.current((prev): RadioPrefs => ({
      ...prev,
      repeat: prev.repeat === "all" ? "one" : "all",
    }));
  }, []);

  const toggleCozyFilter = useCallback(() => {
    const nextVal = !prefsRef.current.cozyFilter;
    const cur = activeTrackRef.current;
    const curEl = activeAudioElRef.current;
    const wasPlayingLocal =
      sourceRef.current === "songs" && playingRef.current && cur?.kind === "file" && !!curEl;
    const resumeAt = wasPlayingLocal ? curEl.currentTime : 0;

    onChangePrefsRef.current((prev) => ({ ...prev, cozyFilter: nextVal }));
    prefsRef.current = { ...prefsRef.current, cozyFilter: nextVal };

    if (wasPlayingLocal && cur) {
      startTrack(cur, { resumeFrom: resumeAt });
    }
  }, [startTrack]);

  const addFiles = useCallback(async (filesInput: FileList | File[]) => {
    const arr = Array.from(filesInput);
    const audioFiles = arr.filter((f) => f.type.startsWith("audio/") || AUDIO_EXT_RE.test(f.name));
    const rejected = arr.length - audioFiles.length;
    if (audioFiles.length === 0) {
      if (rejected > 0) setError("Please choose audio files (MP3, WAV, M4A, OGG, FLAC, or WebM).");
      return { added: 0, rejected };
    }

    setError(null);
    const created: { track: RadioTrack; file: File }[] = audioFiles.map((file, idx) => {
      const id = `tr-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      const title = file.name.replace(/\.[^/.]+$/, "").slice(0, 80) || "Local song";
      const objUrl = URL.createObjectURL(file);
      blobUrlsRef.current.set(id, objUrl);
      return {
        file,
        track: { id, title, kind: "file", ephemeral: false },
      };
    });

    onChangePrefsRef.current((prev) => ({
      ...prev,
      tab: "songs",
      tracks: [...prev.tracks, ...created.map((c) => c.track)].slice(0, 100),
      activeTrackId: prev.activeTrackId ?? created[0].track.id,
    }));

    const results = await Promise.all(created.map((c) => saveTrackBlob(c.track.id, c.file)));
    const failedIds = new Set(created.filter((_, i) => !results[i]).map((c) => c.track.id));
    if (failedIds.size > 0) {
      setStorageMode("session");
      onChangePrefsRef.current((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (failedIds.has(t.id) ? { ...t, ephemeral: true } : t)),
      }));
    }

    return { added: created.length, rejected };
  }, []);

  const addUrl = useCallback((url: string, title?: string) => {
    const parsed = parseSongUrl(url, title);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    setError(null);
    const id = `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const nextTrackItem: RadioTrack = { id, ...parsed.track };
    onChangePrefsRef.current((prev) => ({
      ...prev,
      tab: "songs",
      tracks: [...prev.tracks, nextTrackItem].slice(0, 100),
      activeTrackId: prev.activeTrackId ?? id,
    }));
    return { ok: true };
  }, []);

  const removeTrack = useCallback(
    (id: string) => {
      const wasActive = activeTrackRef.current?.id === id;
      const oldUrl = blobUrlsRef.current.get(id);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
        blobUrlsRef.current.delete(id);
      }
      void deleteTrackBlob(id);

      const remaining = prefsRef.current.tracks.filter((t) => t.id !== id);
      if (wasActive && sourceRef.current === "songs") {
        desiredBackendRef.current = null;
        stopAudioEls();
        stopYouTube();
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);
      }
      onChangePrefsRef.current((prev) => ({
        ...prev,
        tracks: remaining,
        activeTrackId: prev.activeTrackId === id ? (remaining[0]?.id ?? null) : prev.activeTrackId,
      }));
    },
    [stopAudioEls, stopYouTube],
  );

  const clearError = useCallback(() => setError(null), []);

  /* Poll playback progress while playing custom songs */
  useEffect(() => {
    if (!playing || source !== "songs") return;
    const id = window.setInterval(() => {
      const tr = activeTrackRef.current;
      if (!tr) return;
      if (tr.kind === "youtube") {
        const p = ytPlayerRef.current;
        if (p && ytReadyRef.current) {
          try {
            const ct = p.getCurrentTime();
            const d = p.getDuration();
            if (Number.isFinite(ct)) setCurrentTime(ct);
            if (Number.isFinite(d) && d > 0) setDuration(d);
          } catch {
            /* ignored */
          }
        }
        return;
      }
      const el = activeAudioElRef.current;
      if (el) {
        setCurrentTime(el.currentTime || 0);
        if (Number.isFinite(el.duration) && el.duration > 0) {
          setDuration(el.duration);
        }
      }
    }, 350);
    return () => window.clearInterval(id);
  }, [playing, source]);

  const nowPlayingLabel = useMemo(() => {
    if (!playing) return null;
    if (source === "lofi") return "Rhodes Drift";
    return activeTrack?.title ?? null;
  }, [playing, source, activeTrack]);

  return {
    source,
    playing,
    activeTrack,
    currentTime,
    duration,
    error,
    storageMode,
    isFileProtocol,
    ytSlotRef,
    nowPlayingLabel,
    setTab,
    toggleLofi,
    playTrack,
    togglePlaySong,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleCozyFilter,
    addFiles,
    addUrl,
    removeTrack,
    clearError,
  };
}
