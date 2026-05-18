// LoFi background track manager. Drop a real file at /audio/background-track.mp3 to enable.

let audio: HTMLAudioElement | null = null;
let started = false;

function ensure(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio("/audio/background-track.mp3");
    audio.loop = true;
    audio.volume = 0.3;
    audio.preload = "auto";
  }
  return audio;
}

export function startBackgroundMusic(muted: boolean) {
  const a = ensure();
  if (!a) return;
  a.muted = muted;
  if (started) return;
  started = true;
  // Play on first user gesture; modern browsers block autoplay otherwise.
  const tryPlay = () => { a.play().catch(() => {}); };
  tryPlay();
  const onGesture = () => { tryPlay(); window.removeEventListener("pointerdown", onGesture); window.removeEventListener("keydown", onGesture); };
  window.addEventListener("pointerdown", onGesture, { once: true });
  window.addEventListener("keydown", onGesture, { once: true });
}

export function setMuted(muted: boolean) {
  const a = ensure();
  if (a) a.muted = muted;
}
