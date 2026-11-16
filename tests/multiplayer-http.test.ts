import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { Action, View } from '../shared/types.ts';
import type { RoomSnapshot } from '../shared/multiplayer.ts';
import { approach, fishingTargets } from '../shared/navigation.ts';

test('HTTP + SSE: настоящие сессии видят движение, заброс и выход; профили и ревизии изолированы', { timeout: 30_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'fishing-multiplayer-'));
  const server = spawn(process.execPath, ['server/index.ts'], {
    cwd: process.cwd(), env: { ...process.env, PORT: '0', HOST: '127.0.0.1', FISHING_DB: join(directory, 'test.sqlite') }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const base = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Сервер не запустился')), 8_000);
    let output = '';
    server.stdout.on('data', chunk => {
      output += String(chunk);
      const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Сервер завершился: ${code}`)); });
  });
  const unauthorized = await fetch(`${base}/api/events`);
  assert.equal(unauthorized.status, 401);

  async function joinPlayer(nickname: string) {
    const response = await fetch(`${base}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }) });
    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const view = await response.json() as View;
    return { cookie, view };
  }
  async function state(cookie: string) {
    return await (await fetch(`${base}/api/state`, { headers: { Cookie: cookie } })).json() as View;
  }
  async function action(cookie: string, action: Action) {
    const before = await state(cookie);
    const response = await fetch(`${base}/api/action`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, revision: before.player!.revision }),
    });
    const view = await response.json() as View;
    assert.equal(response.status, 200, view.error ?? 'Действие должно завершиться успешно');
    return view;
  }
  async function stream(cookie: string) {
    const controller = new AbortController();
    t.after(() => controller.abort());
    const response = await fetch(`${base}/api/events`, { headers: { Cookie: cookie }, signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, /text\/event-stream/);
    const reader = response.body!.getReader();
    const records: { event: string; data: unknown }[] = [];
    const decoding = (async () => {
      const decoder = new TextDecoder();
      let pending = '';
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        let end: number;
        while ((end = pending.indexOf('\n\n')) >= 0) {
          const block = pending.slice(0, end); pending = pending.slice(end + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (event && data) records.push({ event, data: JSON.parse(data) });
        }
      }
    })().catch(() => {});
    t.after(async () => { controller.abort(); await decoding; });
    return {
      records, close: () => controller.abort(),
      async wait<T>(event: string, predicate: (data: T) => boolean): Promise<T> {
        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline) {
          const record = records.find(record => record.event === event && predicate(record.data as T));
          if (record) return record.data as T;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error(`Не получено событие ${event}`);
      },
    };
  }
  const a = await joinPlayer('Аня'), b = await joinPlayer('Борис');
  const sa = await stream(a.cookie), sb = await stream(b.cookie);
  await action(a.cookie, { type: 'start', spot: 'reeds', bait: 'worm' });
  await action(b.cookie, { type: 'start', spot: 'reeds', bait: 'worm' });
  const roomA = await sa.wait<RoomSnapshot>('room', data => data.fishers.length === 2);
  const roomB = await sb.wait<RoomSnapshot>('room', data => data.fishers.length === 2);
  assert.equal(roomA.roomId, roomB.roomId);
  assert.notEqual(roomA.selfId, roomB.selfId);
  assert.ok(!JSON.stringify(roomA).includes(a.cookie.slice('fishing='.length)));
  const duplicate = await stream(a.cookie);
  assert.equal((await duplicate.wait<RoomSnapshot>('room', data => data.fishers.length === 2)).selfId, roomA.selfId);
  const appearance = (await state(a.cookie)).player!.appearance;
  assert.deepEqual(appearance, a.view.player!.appearance);
  const bRevision = (await state(b.cookie)).player!.revision;
  await action(a.cookie, { type: 'move', ...approach(fishingTargets('reeds')[0]) });
  const moving = await sb.wait<RoomSnapshot>('room', data => data.fishers.some(f => f.nickname === 'Аня' && f.activity === 'rowing'));
  const fisher = moving.fishers.find(f => f.nickname === 'Аня')!;
  assert.ok(fisher.voyage);
  assert.equal((await state(b.cookie)).player!.revision, bRevision);
  const arrivalDelay = Math.max(0, fisher.voyage.arrivesAt - Date.now() + 40);
  await new Promise(resolve => setTimeout(resolve, arrivalDelay));
  await action(a.cookie, { type: 'fishAt', zone: 0 });
  await sb.wait<RoomSnapshot>('room', data => data.fishers.some(f => f.nickname === 'Аня' && f.bite !== null));
  await action(a.cookie, { type: 'reel' });
  const last = await action(a.cookie, { type: 'return' });
  await duplicate.wait<View>('state', data => data.player?.revision === last.player!.revision && !data.player.trip);
  await sb.wait<RoomSnapshot>('room', data => data.fishers.length === 1 && data.fishers[0].nickname === 'Борис');
  assert.deepEqual((await state(a.cookie)).player!.appearance, appearance);
  assert.ok(sb.records.filter(event => event.event === 'state').every(event => (event.data as View).player!.nickname === 'Борис'));
  duplicate.close(); sa.close(); sb.close();
});
