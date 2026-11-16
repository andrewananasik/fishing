import type { Action } from '../shared/types.ts';

// Recorded audio. Sources, licenses and checksums are in audio/sources.json.
export const soundClips = {
  click: { url: new URL('./audio/click.ogg', import.meta.url).href, volume: .5 },
  wood: { url: new URL('./audio/wood.ogg', import.meta.url).href, volume: .55 },
  workshop: { url: new URL('./audio/workshop.ogg', import.meta.url).href, volume: .65 },
  tackle: { url: new URL('./audio/tackle.ogg', import.meta.url).href, volume: .7 },
  leaderboard: { url: new URL('./audio/leaderboard.ogg', import.meta.url).href, volume: .4 },
  paper: { url: new URL('./audio/paper.ogg', import.meta.url).href, volume: .7 },
  coins: { url: new URL('./audio/coins.ogg', import.meta.url).href, volume: .6 },
  water: { url: new URL('./audio/water.ogg', import.meta.url).href, volume: .6 },
  card: { url: new URL('./audio/card.ogg', import.meta.url).href, volume: .7 },
  close: { url: new URL('./audio/close.ogg', import.meta.url).href, volume: .45 },
  cast: { url: new URL('./audio/cast.ogg', import.meta.url).href, volume: .6 },
  reel: { url: new URL('./audio/reel.ogg', import.meta.url).href, volume: .6 },
  bite: { url: new URL('./audio/bite.ogg', import.meta.url).href, volume: .85 },
  strike: { url: new URL('./audio/strike.ogg', import.meta.url).href, volume: .65 },
  guard: { url: new URL('./audio/guard.ogg', import.meta.url).href, volume: .65 },
  turn: { url: new URL('./audio/turn.ogg', import.meta.url).href, volume: .5 },
  win: { url: new URL('./audio/win.ogg', import.meta.url).href, volume: .8 },
  lose: { url: new URL('./audio/lose.ogg', import.meta.url).href, volume: .8 },
  fight: { url: new URL('./audio/fight.mp3', import.meta.url).href, volume: 1 },
};
export type Sound = keyof typeof soundClips;
type Mode = 'hover' | 'click' | 'event';
export const actionSounds: Partial<Record<Action['type'], Sound>> = {
  start: 'water', move: 'water', charge: 'tackle', cast: 'cast', fishAt: 'cast', reel: 'reel', return: 'wood',
  endTurn: 'turn', place: 'click', discard: 'water', sell: 'coins', roll: 'reel', upgrade: 'workshop',
  equip: 'card', takeQuest: 'paper', claimQuest: 'coins',
};

const STORAGE_KEY = 'fishing.sound';
let enabled = true;
try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { /* Storage may be unavailable. */ }
let context: AudioContext | undefined;
let master: GainNode | undefined;
let lastHover = -Infinity;
let lastClick = -Infinity;
let hoverUntil = 0;
let generation = 0;
let selection = 0;
const buffers = new Map<Sound, AudioBuffer>();
const loading = new Map<Sound, Promise<AudioBuffer | undefined>>();
const lastPlayed = new Map<Sound, number>();
const active = new Map<AudioBufferSourceNode, Mode>();
const listeners = new Set<() => void>();

export const soundEnabled = () => enabled;
export function subscribeSound(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

function stopAll(onlyHover = false) {
  if (!onlyHover) generation++;
  for (const [source, mode] of active) {
    if (onlyHover && mode !== 'hover') continue;
    try { source.stop(); } catch { /* Already ended. */ }
    active.delete(source);
  }
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  if (!value) stopAll();
  try { localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off'); } catch { /* Keep the session preference. */ }
  listeners.forEach(listener => listener());
  if (value) { unlockSound(); playSound('click'); }
}

function load(sound: Sound): Promise<AudioBuffer | undefined> {
  const audioContext = context;
  if (!audioContext) return Promise.resolve(undefined);
  const cached = buffers.get(sound);
  if (cached) return Promise.resolve(cached);
  const pending = loading.get(sound);
  if (pending) return pending;
  const request = fetch(soundClips[sound].url).then(response => {
    if (!response.ok) throw new Error('Sound unavailable');
    return response.arrayBuffer();
  }).then(data => audioContext.decodeAudioData(data)).then(buffer => {
    buffers.set(sound, buffer);
    return buffer;
  }).catch(() => undefined).finally(() => loading.delete(sound));
  loading.set(sound, request);
  return request;
}

// Unlock only from a real gesture. Load the small bank once, including FIGHT before combat.
export function unlockSound() {
  if (!enabled) return;
  try {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = .7;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -9;
      limiter.ratio.value = 6;
      master.connect(limiter).connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
    for (const sound of Object.keys(soundClips) as Sound[]) void load(sound);
  } catch { /* Audio is optional; unsupported browsers still run the game. */ }
}

export function playSound(sound: Sound, mode: Mode = 'event') {
  if (!enabled || !context || !master || document.hidden) return;
  // Hover never waits for a user gesture or a network request.
  if (mode === 'hover' && (context.state !== 'running' || !buffers.has(sound))) return;
  const now = context.currentTime;
  if (mode === 'hover') {
    if (now - lastHover < .16 || now - lastClick < .2 || now < hoverUntil) return;
    lastHover = now;
  } else {
    const cooldown = sound === 'water' ? .3 : .075;
    if (now - (lastPlayed.get(sound) ?? -Infinity) < cooldown) return;
    lastPlayed.set(sound, now);
    lastClick = now;
  }
  stopAll(true);
  const selected = ++selection;
  if (sound === 'fight') hoverUntil = now + 2.1;
  const token = generation;
  const requestedAt = performance.now();
  const start = (buffer: AudioBuffer | undefined) => {
    if (!buffer || !context || !master || !enabled || document.hidden || token !== generation || context.state !== 'running') return;
    if (mode === 'hover' && selected !== selection) return;
    if (performance.now() - requestedAt > (sound === 'fight' ? 550 : 250)) return;
    const source = context.createBufferSource();
    const envelope = context.createGain();
    source.buffer = buffer;
    const duration = mode === 'hover' ? Math.min(buffer.duration, .24) : buffer.duration;
    const at = context.currentTime;
    const volume = soundClips[sound].volume * (mode === 'hover' ? .25 : 1);
    envelope.gain.setValueAtTime(volume, at);
    envelope.gain.setValueAtTime(volume, at + Math.max(0, duration - .035));
    envelope.gain.linearRampToValueAtTime(0, at + duration);
    source.connect(envelope).connect(master);
    active.set(source, mode);
    source.onended = () => { active.delete(source); source.disconnect(); envelope.disconnect(); };
    source.start(at);
    source.stop(at + duration);
  };
  const cached = buffers.get(sound);
  if (cached) start(cached);
  else void load(sound).then(start);
}

export function suspendSound() {
  stopAll();
  if (context?.state === 'running') void context.suspend().catch(() => {});
}
