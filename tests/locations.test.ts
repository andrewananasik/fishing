import assert from 'node:assert/strict';
import test from 'node:test';
import { CHARGE_MS, spots } from '../shared/content.ts';
import type { SpotId } from '../shared/content.ts';
import { advancePlayer, applyAction, newPlayer } from '../shared/game.ts';
import { approach, boatAt, fishingTargets, launchPosition, nearbyZone, onWater, waterDistance, zoneAt } from '../shared/navigation.ts';
import type { Action } from '../shared/types.ts';

const locations = Object.keys(spots) as SpotId[];

function expedition(spot: SpotId) {
  const player = newPlayer('Проверка локаций');
  player.upgrades = ['boat', 'gear'];
  function send(action: Action, now: number) {
    advancePlayer(player, now);
    applyAction(player, action, { now, random: () => .99, nextId: () => 'catch' });
  }
  send({ type: 'start', spot, bait: 'worm' }, 0);
  return { player, send };
}

test('у каждой локации своя схема; все участки и подходы доступны с воды', () => {
  const layouts = locations.map(spot => JSON.stringify(fishingTargets(spot)));
  assert.equal(new Set(layouts).size, locations.length);
  for (const spot of locations) {
    const { player } = expedition(spot);
    assert.equal(fishingTargets(spot).length, spots[spot].zones.length);
    assert.deepEqual(player.trip!.boat, launchPosition(spot));
    assert.deepEqual(boatAt({ spot }, 0), launchPosition(spot));
    assert.ok(onWater(launchPosition(spot)));
    assert.equal(nearbyZone(launchPosition(spot), spot), null);
    for (const [zone, target] of fishingTargets(spot).entries()) {
      assert.ok(onWater(target));
      assert.ok(onWater(approach(target)));
      assert.equal(zoneAt(target, spot), zone);
      assert.equal(nearbyZone(approach(target), spot), zone);
    }
  }
});

test('сервер разрешает ловлю у всех 12 участков и направляет снасть к их координатам', () => {
  for (const spot of locations) for (const [zone, target] of fishingTargets(spot).entries()) {
    const { player, send } = expedition(spot);
    assert.throws(() => send({ type: 'fishAt', zone }, 1), /подплывите/);
    send({ type: 'move', ...approach(target), aim: target }, 10);
    const arrived = player.trip!.voyage!.arrivesAt;
    send({ type: 'fishAt', zone }, arrived);
    const bite = player.trip!.bite!;
    assert.equal(bite.zone, zone);
    assert.deepEqual(bite.position, target);
    assert.deepEqual(player.trip!.aim, target);
    send({ type: 'hook' }, bite.opensAt);
    assert.equal(player.trip!.battle!.zone, zone);
  }
});

test('старые координаты другой локации не дают ловить на удалённом участке', () => {
  for (const spot of locations.filter(id => id !== 'reeds')) {
    const { player, send } = expedition(spot);
    send({ type: 'move', ...fishingTargets('reeds')[2] }, 10);
    const arrived = player.trip!.voyage!.arrivesAt;
    assert.throws(() => send({ type: 'fishAt', zone: 2 }, arrived), /подплывите/);
  }
});

test('географический заброс определяет участок по текущей локации', () => {
  for (const spot of locations) for (const [zone, target] of fishingTargets(spot).entries()) {
    const { player, send } = expedition(spot);
    send({ type: 'move', ...approach(target) }, 10);
    const arrived = player.trip!.voyage!.arrivesAt;
    const hold = (waterDistance(boatAt(player.trip!, arrived), target) - .025) / .20 * CHARGE_MS;
    send({ type: 'charge', aim: target }, arrived);
    send({ type: 'cast' }, arrived + hold);
    assert.equal(player.trip!.bite!.zone, zone);
    assert.ok(waterDistance(player.trip!.bite!.position!, target) < 1e-9);
  }
});
