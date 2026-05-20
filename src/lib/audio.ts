// Global background music. Uses Web Audio API (no Media Session / system
// notification panel). Falls back to <audio> element if Web Audio is unavailable.
// Stops only when: user mutes via Settings, or the app/tab closes.

type Mode = "webaudio" | "fallback" | "none";

let mode: Mode = "none";
let started = false;
let userMuted = false;
let userVolume = 0.2; // 0..1, default 20%

// Web Audio bits
let ctx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
let buffer: AudioBuffer | null = null;
let loading = false;

// Fallback <audio>
let audioEl: HTMLAudioElement | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;

const TRACK = "/audio/background-track.mp3";

function effectiveVolume() {
  return userMuted ? 0 : userVolume;
}

function applyGain() {
  if (gainNode && ctx) {
    try { gainNode.gain.setValueAtTime(effectiveVolume(), ctx.currentTime); } catch { /* ignore */ }
  }
  if (audioEl) {
    audioEl.volume = effectiveVolume();
    audioEl.muted = userMuted;
  }
}

async function initWebAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!AC) return false;
  try {
    if (!ctx) ctx = new AC();
    if (!gainNode) {
      gainNode = ctx.createGain();
      gainNode.gain.value = effectiveVolume();
      gainNode.connect(ctx.destination);
    }
    if (!buffer && !loading) {
      loading = true;
      const res = await fetch(TRACK);
      const arr = await res.arrayBuffer();
      buffer = await ctx.decodeAudioData(arr);
      loading = false;
    }
    return !!buffer;
  } catch {
    loading = false;
    return false;
  }
}

function startSource() {
  if (!ctx || !gainNode || !buffer) return;
  try {
    if (source) { try { source.stop(); } catch { /* ignore */ } source.disconnect(); }
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    source.start(0);
  } catch { /* ignore */ }
}

async function tryPlayWebAudio() {
  if (!ctx) return;
  try { if (ctx.state === "suspended") await ctx.resume(); } catch { /* ignore */ }
  if (!source) startSource();
}

function initFallback() {
  if (audioEl) return;
  audioEl = new Audio(TRACK);
  audioEl.loop = true;
  audioEl.preload = "auto";
  audioEl.setAttribute("playsinline", "true");
  audioEl.volume = effectiveVolume();
}

function tryPlayFallback() {
  if (!audioEl || userMuted) return;
  const p = audioEl.play();
  if (p && typeof p.catch === "function") p.catch(() => { /* gesture required */ });
}

async function tryPlay() {
  if (mode === "webaudio") await tryPlayWebAudio();
  else if (mode === "fallback") tryPlayFallback();
}

export async function startBackgroundMusic(muted: boolean, volume?: number) {
  if (typeof window === "undefined") return;
  userMuted = muted;
  if (typeof volume === "number") userVolume = Math.max(0, Math.min(1, volume));

  if (mode === "none") {
    const ok = await initWebAudio();
    if (ok) mode = "webaudio";
    else { initFallback(); mode = "fallback"; }
  }
  applyGain();

  if (!started) {
    started = true;
    const onGesture = async () => { await tryPlay(); };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchstart", onGesture, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tryPlay(); });
    if (mode === "fallback") {
      watchdog = setInterval(() => {
        if (audioEl && !userMuted && audioEl.paused) tryPlayFallback();
      }, 1500);
    }
  }
  await tryPlay();
}

export function setMuted(muted: boolean) {
  userMuted = muted;
  applyGain();
  if (mode === "webaudio") {
    if (!muted) tryPlayWebAudio();
  } else if (mode === "fallback" && audioEl) {
    if (muted) audioEl.pause(); else tryPlayFallback();
  }
}

export function setVolume(v: number) {
  userVolume = Math.max(0, Math.min(1, v));
  applyGain();
}

export function getVolume() { return userVolume; }

export function _stopWatchdog() { if (watchdog) { clearInterval(watchdog); watchdog = null; } }
