import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// A scheduling double tests browser policy and cancellation without audio hardware.
const sources: FakeNode[] = [];
const storage = new Map<string, string>();
class FakeParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  gain = new FakeParam();
  threshold = new FakeParam(); ratio = new FakeParam();
  buffer: unknown; type = ''; started = false; stopped = false;
  onended?: () => void;
  connect(node: FakeNode) { return node; }
  disconnect() {}
  start() { this.started = true; sources.push(this); }
  stop(at?: number) { if (at === undefined) { this.stopped = true; this.onended?.(); } }
}
let audio: FakeContext;
let decode: (value: object) => void;
let fetches = 0;
class FakeContext {
  state = 'suspended'; currentTime = 10; sampleRate = 22050; destination = new FakeNode();
  constructor() { audio = this; }
  createGain() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  decodeAudioData(data: ArrayBuffer) {
    if (new Uint8Array(data)[0] === 1) return new Promise<object>(resolve => { decode = resolve; });
    return Promise.resolve({ duration: .7 });
  }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
}

test('звуки не копятся до жеста, ограничивают наведение, выключаются и не повторяют FIGHT', async () => {
  const originals = new Map(['AudioContext', 'localStorage', 'document', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const hidden = { hidden: false };
  Object.defineProperties(globalThis, {
    AudioContext: { configurable: true, value: FakeContext },
    localStorage: { configurable: true, value: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) } },
    document: { configurable: true, value: hidden },
    fetch: { configurable: true, value: async (url: string) => { fetches++; return { ok: true, arrayBuffer: async () => new Uint8Array([url.endsWith('/fight.mp3') ? 1 : 0]).buffer }; } },
  });
  try {
    const s = await import('../src/sound.ts');
    s.playSound('workshop', 'hover');
    assert.equal(sources.length, 0, 'no context before a user gesture');
    s.unlockSound();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fetches, Object.keys(s.soundClips).length);
    s.playSound('workshop', 'hover');
    const hovered = sources.length;
    assert.ok(hovered > 0);
    s.playSound('tackle', 'hover');
    assert.equal(sources.length, hovered, 'fast hovers do not overlap');
    audio.currentTime += .2;
    s.playSound('tackle', 'hover');
    assert.ok(sources.length > hovered);
    const selected = sources.length;
    s.playSound('workshop', 'click');
    assert.ok(sources.length > selected, 'a click is not suppressed by a hover');
    s.playSound('fight');
    const fight = sources.length;
    s.playSound('fight');
    assert.equal(sources.length, fight, 'same-frame FIGHT runs once');
    s.setSoundEnabled(false);
    assert.ok(sources.every(source => source.stopped), 'mute stops already scheduled sounds');
    decode({ duration: 1.933 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sources.length, fight, 'a late voice load cannot bypass mute');
    s.playSound('coins');
    assert.equal(sources.length, fight);
    assert.equal(storage.get('fishing.sound'), 'off');
    audio.currentTime += 2;
    s.setSoundEnabled(true);
    assert.equal(storage.get('fishing.sound'), 'on');
    audio.currentTime += 2;
    const beforeVoice = sources.length;
    s.playSound('fight');
    assert.equal(sources.length - beforeVoice, 1, 'FIGHT plays one original recording');
    hidden.hidden = true;
    const beforeHidden = sources.length;
    s.playSound('coins');
    assert.equal(sources.length, beforeHidden);
    s.suspendSound();
    assert.ok(sources.every(source => source.stopped));
    assert.equal(audio.state, 'suspended');
    assert.equal(fetches, Object.keys(s.soundClips).length, 'each recording is loaded once');
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('источники и контрольные суммы звуков сохранены; FIGHT взят из пользовательского файла', async () => {
  const { soundClips } = await import('../src/sound.ts');
  const manifest = JSON.parse(readFileSync(new URL('../src/audio/sources.json', import.meta.url), 'utf8')) as { cue: string; file: string; license: string; source: string; sha256: string }[];
  assert.deepEqual(manifest.map(entry => entry.cue).sort(), Object.keys(soundClips).sort());
  for (const entry of manifest) {
    const data = readFileSync(new URL('../src/audio/' + entry.file, import.meta.url));
    assert.deepEqual(readFileSync(new URL(soundClips[entry.cue as keyof typeof soundClips].url)), data);
    assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256);
    if (entry.cue === 'fight') {
      assert.equal(entry.license, 'user-provided');
      assert.equal(entry.file, 'fight.mp3');
      assert.deepEqual(data, readFileSync(new URL('../' + entry.source, import.meta.url)));
    } else {
      assert.equal(data.toString('ascii', 0, 4), 'OggS');
      assert.equal(entry.license, 'CC0-1.0');
      assert.match(entry.source, /^https:\/\/(kenney.nl|opengameart.org)\//);
    }
  }
});
