import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, Player, View } from '../shared/types.ts';
import type { RoomSnapshot } from '../shared/multiplayer.ts';
import { actionSounds, playSound } from './sound.ts';

export type SendAction = (action: Action) => Promise<Player | null>;

export function useGame() {
  const [view, setView] = useState<View | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef<View | null>(null);
  const inFlight = useRef(false);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'online' | 'reconnecting'>('connecting');

  const acceptView = useCallback((result: View) => {
    const previous = latest.current?.player;
    if (previous && result.player && result.player.revision < previous.revision) return;
    latest.current = result;
    setView(result);
    if (!result.player?.trip) setRoom(null);
  }, []);

  const request = useCallback(async (path: string, payload?: object) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    if (payload) {
      setBusy(true);
      setError('');
    }
    try {
      const sentAt = Date.now();
      const response = await fetch(path, {
        signal: AbortSignal.timeout(8_000),
        ...(payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
      });
      const result = await response.json() as View;
      if (response.status >= 500) throw new Error(result.error);
      setOffset(result.serverNow - (sentAt + Date.now()) / 2);
      acceptView(result);
      setError(result.error ?? '');
      return response.ok ? result : null;
    } catch {
      setError('Связь с сервером прервалась. Обновите состояние и попробуйте ещё раз.');
      return null;
    } finally {
      inFlight.current = false;
      if (payload) setBusy(false);
    }
  }, [acceptView]);

  const refresh = useCallback(() => request('/api/state'), [request]);
  const join = (nickname: string) => request('/api/join', { nickname });
  const send: SendAction = async (action) => {
    const revision = latest.current?.player?.revision;
    const result = await request('/api/action', { ...action, revision });
    const sound = actionSounds[action.type];
    if (result?.player && sound) playSound(sound);
    return result?.player ?? null;
  };

  useEffect(() => { void refresh(); }, [refresh]);

  const loggedIn = Boolean(view?.player);
  useEffect(() => {
    if (!loggedIn) return;
    let source: EventSource;
    let lastMessage = Date.now();
    let connected = false;
    function open() {
      source?.close();
      source = new EventSource('/api/events');
      setConnection(connected ? 'reconnecting' : 'connecting');
      lastMessage = Date.now();
      const alive = () => { lastMessage = Date.now(); connected = true; setConnection('online'); };
      source.addEventListener('state', (event) => {
        alive();
        acceptView(JSON.parse(event.data) as View);
      });
      source.addEventListener('room', (event) => {
        alive();
        setRoom(JSON.parse(event.data) as RoomSnapshot);
      });
      source.addEventListener('heartbeat', alive);
      source.onerror = () => { setConnection('reconnecting'); setRoom(null); };
    }
    open();
    // Also recover from silently stalled proxy/network connections.
    const watchdog = setInterval(() => {
      if (Date.now() - lastMessage > 25_000) { setRoom(null); open(); }
    }, 5_000);
    return () => { source.close(); clearInterval(watchdog); };
  }, [loggedIn, acceptView]);

  const trip = view?.player?.trip;
  const nextDeadline = trip && Math.min(
    trip.pausedAt != null ? Infinity : trip.deadline,
    trip.bite?.closesAt ?? Infinity,
    trip.battle?.phase === 'fish' ? trip.battle.deadline : Infinity,
  );

  useEffect(() => {
    if (!nextDeadline || !Number.isFinite(nextDeadline)) return;
    let retry: ReturnType<typeof setTimeout>;
    let active = true;
    async function fetchAtDeadline() {
      const fresh = await refresh();
      if (!fresh && active) retry = setTimeout(fetchAtDeadline, 500);
    }
    retry = setTimeout(fetchAtDeadline, Math.max(40, nextDeadline - offset - Date.now() + 40));
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [nextDeadline, offset, refresh, view]);

  return { view, offset, busy, error, refresh, join, send, room: room?.spot === trip?.spot ? room : null, connection };
}

export function useNow(offset: number, interval: number, active = true) {
  const [localNow, setLocalNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setLocalNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval, active]);
  return Math.max(localNow, Date.now() - interval) + offset;
}
