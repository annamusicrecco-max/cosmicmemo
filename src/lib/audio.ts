// Global background music — one element, persists across route changes.
// Stops only when: user mutes via Settings, or the app/tab closes.

let audio: HTMLAudioElement | null = null;
let started = false;
let userMuted = false;
let watchdog: ReturnType<typeof setInterval> | null = null;

function ensure(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio("/audio/background-track.mp3");
    audio.loop = true;
    audio.volume = 0.3;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
  }
  return audio;
}

function tryPlay() {
  const a = audio;
  if (!a || userMuted) return;
  const p = a.play();
  if (p && typeof p.catch === "function") p.catch(() => { /* gesture needed */ });
}

export function startBackgroundMusic(muted: boolean) {
  const a = ensure();
  if (!a) return;
  userMuted = muted;
  a.muted = muted;

  if (!started) {
    started = true;

    // Resume on first user gesture (autoplay policy).
    const onGesture = () => { tryPlay(); };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchstart", onGesture, { passive: true });

    // Resume when tab becomes visible again.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tryPlay();
    });

    // Watchdog: if music gets paused by something (route change, focus loss),
    // restart it unless the user muted it.
    watchdog = setInterval(() => {
      if (audio && !userMuted && audio.paused) tryPlay();
    }, 1500);
  }

  tryPlay();
}

export function setMuted(muted: boolean) {
  userMuted = muted;
  const a = ensure();
  if (!a) return;
  a.muted = muted;
  if (muted) {
    a.pause();
  } else {
    tryPlay();
  }
}

// Prevent unused-variable lint while keeping handle available.
export function _stopWatchdog() { if (watchdog) { clearInterval(watchdog); watchdog = null; } }
