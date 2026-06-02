// Global background music — one element, persists across route changes.
// Pauses when: user mutes via Settings, OR the tab/app is hidden (user leaves).
// Resumes automatically when the tab becomes visible again.

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

function shouldPlay() {
  if (userMuted) return false;
  if (typeof document !== "undefined" && document.hidden) return false;
  return true;
}

function tryPlay() {
  const a = audio;
  if (!a || !shouldPlay()) return;
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

    const onGesture = () => { tryPlay(); };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchstart", onGesture, { passive: true });

    // Pause when user leaves the app/tab, resume when they return.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (audio && !audio.paused) audio.pause();
      } else {
        tryPlay();
      }
    });
    window.addEventListener("blur", () => {
      if (audio && !audio.paused) audio.pause();
    });
    window.addEventListener("focus", () => { tryPlay(); });

    // Watchdog: keep music alive across route changes when the user is here.
    watchdog = setInterval(() => {
      if (audio && shouldPlay() && audio.paused) tryPlay();
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

export function _stopWatchdog() { if (watchdog) { clearInterval(watchdog); watchdog = null; } }
