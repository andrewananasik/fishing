import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlayer, applyAction, advancePlayer } from '../shared/game.ts';
import { onWater, approach, fishingTargets } from '../shared/navigation.ts';
import { randomAppearance, RECONNECT_GRACE_MS, ROOM_CAPACITY } from '../shared/multiplayer.ts';
import type { Action, Player } from '../shared/types.ts';
import type { SpotId } from '../shared/content.ts';
import { FishingRooms } from '../server/rooms.ts';
import type { RoomClient } from '../server/rooms.ts';

function player(name: string, spot: SpotId = 'reeds') {
  const p = newPlayer(name);
  p.appearance = randomAppearance(() => .5);
  p.upgrades = ['boat', 'gear'];
  act(p, { type: 'start', spot, bait: 'worm' }, 1);
  return p;
}
function act(p: Player, action: Action, now: number) {
  applyAction(p, action, { now, random: () => 0, nextId: () => 'catch' });
}
function client() {
  const events: { event: string; value: unknown }[] = [];
  const sink: RoomClient = { send: (event, value) => { events.push({ event, value }); return true; }, close: () => {} };
  return { events, sink };
}

test('комнаты ограничены восемью игроками; разные локации изолированы, старые комнаты не перетасовываются', () => {
  const rooms = new FishingRooms();
  const players = Array.from({ length: 10 }, (_, i) => player(`Игрок ${i}`));
  players.forEach((p, i) => rooms.update(`secret-${i}`, p, 1, true));
  const first = rooms.snapshot('secret-0', 1)!;
  const second = rooms.snapshot('secret-8', 1)!;
  assert.equal(first.fishers.length, ROOM_CAPACITY);
  assert.equal(second.fishers.length, 2);
  assert.notEqual(first.roomId, second.roomId);
  assert.equal(new Set(first.fishers.map(f => `${f.boat.x}:${f.boat.y}`)).size, 8);
  assert.ok(first.fishers.every(f => onWater(f.boat)));
  rooms.update('deep', player('Глубина', 'deep'), 1, true);
  assert.equal(rooms.snapshot('deep', 1)!.fishers.length, 1);
  assert.ok(onWater(rooms.snapshot('deep', 1)!.fishers[0].boat));
  players[0].trip = null;
  rooms.saved('secret-0', players[0], 2);
  rooms.update('new', player('Новый'), 2, true);
  assert.equal(rooms.snapshot('new', 2)!.roomId, first.roomId);
  assert.equal(rooms.snapshot('secret-8', 2)!.roomId, second.roomId);
});

test('несколько вкладок дают одну лодку; переподключение сохраняет место, после таймаута лодка исчезает', () => {
  const rooms = new FishingRooms();
  const p = player('Рыбак');
  const one = client(), two = client(), neighbor = client();
  rooms.connect('a', p, one.sink, 1);
  rooms.connect('b', player('Сосед'), neighbor.sink, 1);
  const original = rooms.snapshot('a', 1)!;
  rooms.connect('a', p, two.sink, 2);
  assert.equal(rooms.snapshot('a', 2)!.fishers.length, 2);
  rooms.disconnect('a', one.sink, 3);
  assert.equal(rooms.snapshot('a', 3)!.fishers.find(f => f.id === original.selfId)!.connected, true);
  rooms.disconnect('a', two.sink, 4);
  assert.equal(rooms.snapshot('a', 4)!.fishers.find(f => f.id === original.selfId)!.connected, false);
  rooms.connect('a', p, one.sink, 5);
  assert.equal(rooms.snapshot('a', 5)!.selfId, original.selfId);
  rooms.disconnect('a', one.sink, 6);
  rooms.tick(6 + RECONNECT_GRACE_MS, () => {});
  assert.equal(rooms.snapshot('a', 6 + RECONNECT_GRACE_MS), null);
  assert.equal(rooms.snapshot('b', 6 + RECONNECT_GRACE_MS)!.fishers.length, 1);
});

test('публичное состояние не раскрывает сессии, карты, золото, коллекцию или личный улов', () => {
  const rooms = new FishingRooms();
  const p = player('Рыбак');
  p.gold = 987654;
  p.stock = [{ id: 'secret-catch', species: 'pike' }];
  rooms.update('SECRET-AUTH-TOKEN', p, 1);
  const payload = JSON.stringify(rooms.snapshot('SECRET-AUTH-TOKEN', 1));
  for (const secret of ['SECRET-AUTH-TOKEN', '987654', 'secret-catch', 'deck', 'hand', 'collection', 'stock', 'cargo', 'revision']) assert.ok(!payload.includes(secret), secret);
});

test('карточный бой одного игрока не меняет другого и не останавливает его вылазку', () => {
  const rooms = new FishingRooms();
  const a = player('Бой'), b = player('Рыбалка');
  const ca = client(), cb = client();
  rooms.connect('a', a, ca.sink, 1);
  rooms.connect('b', b, cb.sink, 1);
  act(a, { type: 'move', ...approach(fishingTargets('reeds')[0]) }, 2);
  const arrival = a.trip!.voyage!.arrivesAt;
  act(a, { type: 'fishAt', zone: 0 }, arrival);
  act(a, { type: 'hook' }, a.trip!.bite!.opensAt);
  rooms.saved('a', a, arrival + 3000);
  assert.equal(rooms.snapshot('b', arrival + 3000)!.fishers.find(f => f.nickname === 'Бой')!.activity, 'fighting');
  assert.equal(cb.events.filter(event => event.event === 'state').length, 1, 'чужие карты не поступают в личный канал');
  const hand = [...a.trip!.battle!.hand];
  act(b, { type: 'move', x: .55, y: .65 }, arrival + 3000);
  rooms.saved('b', b, arrival + 3000);
  assert.deepEqual(a.trip!.battle!.hand, hand);
  rooms.tick(400_000, (session, p) => { if (advancePlayer(p, 400_000)) rooms.saved(session, p, 400_000); });
  assert.ok(a.trip?.battle, 'личный бой остаётся на паузе');
  assert.equal(b.trip, null, 'чужой таймер продолжает идти');
  assert.equal(rooms.snapshot('a', 400_000)!.fishers.length, 1);
});

test('медленное соединение закрывается без накопления очереди и не затрагивает соседей', () => {
  const rooms = new FishingRooms();
  let closed = false;
  rooms.connect('slow', player('Медленный'), { send: () => false, close: () => { closed = true; } }, 1);
  const healthy = client();
  rooms.connect('ok', player('Быстрый'), healthy.sink, 1);
  assert.ok(closed);
  assert.equal(rooms.connections('slow'), 0);
  rooms.heartbeat(2);
  assert.ok(healthy.events.some(event => event.event === 'heartbeat'));
});
