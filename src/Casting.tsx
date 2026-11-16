import { useEffect, useRef, useState } from 'react';
import { fish, fishIds, getSpot, oddsFor } from '../shared/content.ts';
import type { Player, Trip } from '../shared/types.ts';
import { approach, boatAt, clampWater, fishingDifficulty, fishingTargets, nearbyZone, onWater, ringTimings } from '../shared/navigation.ts';
import type { Point } from '../shared/navigation.ts';
import { useNow } from './api.ts';
import type { SendAction } from './api.ts';
import { FishingRig, FishingWater, targetPosition } from './Pond.tsx';
import { zoneRisk } from './GameArt.tsx';
import { RoomDialog } from './Dialog.tsx';
import { playSound } from './sound.ts';
import type { Appearance, RoomSnapshot } from '../shared/multiplayer.ts';
import { OtherFishers } from './Multiplayer.tsx';

type Props = { trip: Trip; busy: boolean; send: SendAction; offset: number; openCargo: () => void; appearance?: Appearance; room?: RoomSnapshot | null };

function HookGame({ trip, zone, busy, send, offset, close }: Omit<Props, 'openCargo'> & { zone: number; close: () => void }) {
  const [attempted, setAttempted] = useState(Boolean(trip.bite));
  const inFlight = useRef(false);
  const now = useNow(offset, 16, Boolean(trip.bite));
  const bite = trip.bite;
  const difficulty = bite?.ring?.difficulty ?? fishingDifficulty(trip.spot, zone, trip.bait);
  const timing = ringTimings[difficulty];
  const starts = bite?.ring?.startedAt ?? (bite ? bite.opensAt - timing.windup : now);
  const duration = bite?.ring?.duration ?? timing.duration;
  const opens = bite ? bite.opensAt - starts : timing.windup;
  const closes = bite ? bite.closesAt - starts : timing.windup + timing.window;
  const outer = 112 - 84 * opens / duration;
  const inner = 112 - 84 * closes / duration;
  const progress = bite ? Math.max(0, Math.min(1, (now - starts) / duration)) : 0;
  const canPull = Boolean(bite && now >= bite.opensAt && now < bite.closesAt);
  const missed = attempted && !bite;
  const sounded = useRef<number | null>(null);
  useEffect(() => {
    if (canPull && bite && sounded.current !== bite.opensAt) { sounded.current = bite.opensAt; playSound('bite'); }
  }, [canPull, bite]);

  async function act() {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    const result = await send(bite ? { type: 'hook' } : { type: 'fishAt', zone });
    if (result) setAttempted(true);
    inFlight.current = false;
  }
  const actRef = useRef(act);
  actRef.current = act;
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat || (event.target as HTMLElement).closest('input, textarea')) return;
      event.preventDefault();
      void actRef.current();
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return <RoomDialog title={getSpot(trip.spot).zones[zone].name} className="hook-game" close={busy ? undefined : close}>
    <div className="hook-game-meta"><span data-difficulty={difficulty}>{timing.label}</span><span>{difficulty === 'easy' ? 'Широкое окно · спокойный темп' : difficulty === 'medium' ? 'Уже окно · быстрее кольцо' : 'Узкое окно · быстрый темп'}</span></div>
    <div className="hook-ring" data-ready={canPull} data-missed={missed}>
      <svg viewBox="0 0 260 260" aria-hidden="true">
        <circle className="ring-orbit" cx="130" cy="130" r="112" />
        <circle className="ring-band" cx="130" cy="130" r={(outer + inner) / 2} strokeWidth={outer - inner} />
        <circle className="ring-edge" cx="130" cy="130" r={outer} />
        <circle className="ring-edge" cx="130" cy="130" r={inner} />
        {bite && <circle className="ring-traveller" cx="130" cy="130" r={112 - progress * 84} />}
        <path className="ring-hook" d="M130 111v28a12 12 0 0 0 24 0v-8l-7 7M125 111a5 5 0 1 1 10 0a5 5 0 1 1-10 0" />
      </svg>
      <span className="ring-cue">{canPull ? 'ТЯНИТЕ!' : bite ? 'ЖДИТЕ…' : missed ? 'РЫБА УШЛА' : 'ГОТОВЫ?'}</span>
    </div>
    <p className="hook-instruction" role="status">{canPull ? 'Кольцо в светлой полосе. Нажимайте сейчас!' : bite ? 'Нажмите «Тянуть», когда сужающееся кольцо войдёт в светлую полосу.' : missed ? trip.message : 'Забросьте снасть. Затем поймайте момент, когда кольцо войдёт в светлую полосу.'}</p>
    <button className="primary ring-action" data-sound-click="none" data-biting={canPull} disabled={busy} onClick={() => void act()}>{bite ? 'Тянуть' : missed ? 'Попробовать ещё' : 'Забросить снасть'} <kbd>Пробел</kbd></button>
    <p className="hook-footnote">Точное попадание начнёт карточное вываживание.</p>
  </RoomDialog>;
}

export function Casting({ trip, busy, send, offset, openCargo, appearance, room }: Props) {
  const [miniZone, setMiniZone] = useState<number | null>(trip.bite?.zone ?? null);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState('');
  const moveRequest = useRef<Promise<Player | null> | null>(null);
  const now = useNow(offset, 32, Boolean(trip.voyage && Date.now() + offset < trip.voyage.arrivesAt));
  const position = boatAt(trip, now);
  const moving = Boolean(trip.voyage && now < trip.voyage.arrivesAt);
  const nearby = nearbyZone(position, trip.spot);
  const locked = Boolean(trip.battle || trip.pending || trip.outcome || miniZone !== null);
  const zones = getSpot(trip.spot).zones;
  useEffect(() => { if (trip.battle || trip.outcome || trip.pending) setMiniZone(null); }, [trip.battle, trip.outcome, trip.pending]);

  function navigate(point: Point, zone?: number) {
    if (busy || locked) return;
    if (trip.bite || trip.chargingAt !== null) { setNotice('Сначала уберите снасть.'); return; }
    if (!onWater(point)) { setNotice('Лодка плывёт по открытой воде.'); return; }
    setNotice('');
    moveRequest.current = send({ type: 'move', ...(zone === undefined ? point : approach(point)), aim: point });
  }
  async function stop() {
    if (moveRequest.current) await moveRequest.current;
    await controls.current.send({ type: 'stop' });
  }
  function openFishing() {
    if (!busy && !moving && !locked && nearby !== null) { setNotice(''); setMiniZone(nearby); }
  }
  async function closeFishing() {
    if (busy) return;
    if ((trip.bite || trip.chargingAt !== null) && !await send({ type: 'reel' })) return;
    setMiniZone(null);
  }
  const controls = useRef({ navigate, stop, send, position, locked, openFishing });
  controls.current = { navigate, stop, send, position, locked, openFishing };
  useEffect(() => {
    const directions: Record<string, Point> = { KeyW: { x: 0, y: -.09 }, ArrowUp: { x: 0, y: -.09 }, KeyS: { x: 0, y: .09 }, ArrowDown: { x: 0, y: .09 }, KeyA: { x: -.06, y: 0 }, ArrowLeft: { x: -.06, y: 0 }, KeyD: { x: .06, y: 0 }, ArrowRight: { x: .06, y: 0 } };
    const held = new Set<string>();
    function keydown(event: KeyboardEvent) {
      if (document.querySelector('dialog[open]') || (event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;
      const c = controls.current;
      if (c.locked) return;
      const delta = directions[event.code];
      if (delta) { event.preventDefault(); held.add(event.code); c.navigate(clampWater({ x: c.position.x + delta.x, y: c.position.y + delta.y })); }
      else if (event.code === 'Space' && !event.repeat) { event.preventDefault(); c.openFishing(); }
    }
    function keyup(event: KeyboardEvent) { if (held.delete(event.code) && !held.size) void controls.current.stop(); }
    function blur() { if (held.size) { held.clear(); void controls.current.stop(); } }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, []);

  return <section className="casting" aria-label="Лодка и рыбалка">
    <FishingWater spot={trip.spot} onNavigate={navigate}>
      {moving && trip.voyage && <svg className="voyage-route" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><path d={`M${position.x * 1600} ${position.y * 900}L${trip.voyage.to.x * 1600} ${trip.voyage.to.y * 900}`} /><ellipse cx={trip.voyage.to.x * 1600} cy={trip.voyage.to.y * 900} rx="18" ry="9" /></svg>}
      <OtherFishers room={room ?? null} offset={offset} />
      <FishingRig spot={trip.spot} position={position} heading={trip.heading ?? -Math.PI / 4} moving={moving} bite={trip.bite} fightZone={trip.battle?.zone ?? null} bait={trip.bait} offset={offset} appearance={appearance} room={room} />
      <button className="boat-inventory" style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }} aria-label="Открыть трюм лодки" onClick={openCargo}><span>Трюм</span></button>
      {zones.map((zone, index) => {
        const odds = oddsFor(zone, trip.bait);
        const target = fishingTargets(trip.spot)[index];
        const available = nearby === index && !moving && !locked;
        return <div className="zone-anchor" key={zone.name} style={targetPosition(trip.spot, index)} data-zone={index} data-edge={target.x < .34 ? 'left' : target.x > .66 ? 'right' : 'center'} data-risk={zoneRisk(odds)} data-selected={nearby === index} data-available={available}>
          <button className="zone-marker" aria-label={`Подплыть: ${zone.name}`} onClick={() => navigate(target, index)}><span className="zone-dot" /><span>{zone.name}<small>{ringTimings[fishingDifficulty(trip.spot, index, trip.bait)].label}</small></span></button>
          {available ? <div className="zone-cast-menu"><span>{odds.map((value, i) => value > 0 ? `${fish[fishIds[i]].name} ${value}%` : '').filter(Boolean).join(' · ')}</span><button className="primary" onClick={openFishing}>Закинуть <kbd>Пробел</kbd></button></div> : <div className="zone-odds">{odds.map((value, i) => value > 0 && <div key={i}>{fish[fishIds[i]].name}<b>{value}%</b></div>)}</div>}
        </div>;
      })}
    </FishingWater>
    <div className="water-controls"><p role="status">{notice || (moving ? 'Гребём к выбранной точке…' : nearby !== null ? `Рядом: ${zones[nearby].name}. Можно закинуть снасть.` : 'Подплывите к участку, чтобы начать рыбалку.')}</p><div>{moving && <button disabled={busy} onClick={() => void stop()}>Стоп</button>}{(trip.chargingAt !== null || trip.bite) && miniZone === null && <button disabled={busy} onClick={() => void send({ type: 'reel' })}>Убрать снасть</button>}<button aria-expanded={help} onClick={() => setHelp(!help)}>Управление</button></div>
      {help && <div className="navigation-help"><p><kbd>Клик / касание</kbd> — плыть к точке. Нажмите название участка, чтобы подплыть к нему.</p><p><kbd>WASD / стрелки</kbd> — управление лодкой.</p><p>Рядом с участком появится «Закинуть». В мини-игре нажмите «Тянуть» или пробел, когда кольцо войдёт в светлую полосу.</p><p>На мелководье попасть проще. В глубине потребуется более точная реакция.</p></div>}
    </div>
    {miniZone !== null && !trip.battle && !trip.outcome && !trip.pending && <HookGame trip={trip} zone={miniZone} busy={busy} send={send} offset={offset} close={() => void closeFishing()} />}
  </section>;
}
