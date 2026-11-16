import assert from 'node:assert/strict';
import test from 'node:test';
import { advancePlayer, applyAction, newPlayer, RuleError } from '../shared/game.ts';
import { approach, fishingTargets, nearbyZone, ringTimings, headingFrame, headingTo } from '../shared/navigation.ts';
import type { Action } from '../shared/types.ts';

function setup() {
  const player = newPlayer('Кольцо');
  function send(action: Action, now: number) {
    advancePlayer(player, now);
    applyAction(player, action, { now, random: () => .99, nextId: () => 'fish' });
  }
  send({ type: 'start', spot: 'reeds', bait: 'worm' }, 0);
  function sail(zone: number, at = 10) {
    send({ type: 'move', ...approach(fishingTargets('reeds')[zone]) }, at);
    return player.trip!.voyage!.arrivesAt;
  }
  return { player, send, sail };
}

test('ловля доступна только у близкого участка после остановки', () => {
  const { player, send, sail } = setup();
  assert.equal(nearbyZone(player.trip!.boat!, player.trip!.spot), null);
  assert.throws(() => send({ type: 'fishAt', zone: 2 }, 1), /подплывите/);
  const arrived = sail(1);
  assert.throws(() => send({ type: 'fishAt', zone: 1 }, arrived - 100), /остановки/);
  send({ type: 'fishAt', zone: 1 }, arrived);
  assert.deepEqual(player.trip!.bite!.position, fishingTargets('reeds')[1]);
  assert.equal(player.trip!.voyage, null);
  assert.throws(() => send({ type: 'move', x: .4, y: .4 }, arrived + 1), RuleError);
  assert.throws(() => send({ type: 'fishAt', zone: 1 }, arrived + 2), RuleError);
});

test('три режима кольца: точное попадание начинает бой с рыбой выбранного участка', () => {
  for (const zone of [0, 1, 2]) {
    const { player, send, sail } = setup();
    const arrived = sail(zone);
    send({ type: 'fishAt', zone }, arrived);
    const bite = player.trip!.bite!;
    const difficulty = ['easy', 'medium', 'hard'][zone] as keyof typeof ringTimings;
    assert.equal(bite.ring!.difficulty, difficulty);
    assert.equal(bite.closesAt - bite.opensAt, ringTimings[difficulty].window);
    assert.deepEqual(JSON.parse(JSON.stringify(player.trip)).bite, bite);
    send({ type: 'hook' }, bite.opensAt);
    assert.equal(player.trip!.battle!.species, ['crucian', 'perch', 'pike'][zone]);
    assert.equal(player.trip!.battle!.zone, zone);
    assert.equal(player.trip!.bite, null);
    assert.ok(player.trip!.pausedAt);
  }
  assert.ok(ringTimings.easy.window > ringTimings.medium.window && ringTimings.medium.window > ringTimings.hard.window);
  assert.ok(ringTimings.easy.duration > ringTimings.medium.duration && ringTimings.medium.duration > ringTimings.hard.duration);
});

test('раннее нажатие, пропуск окна и отмена не запускают карточный бой; повтор доступен', () => {
  const { player, send, sail } = setup();
  let at = sail(0);
  send({ type: 'fishAt', zone: 0 }, at);
  at = player.trip!.bite!.opensAt - 1;
  send({ type: 'hook' }, at);
  assert.equal(player.trip!.battle, null);
  assert.match(player.trip!.message, /Ранняя/);
  send({ type: 'fishAt', zone: 0 }, at + 1);
  at = player.trip!.bite!.closesAt;
  advancePlayer(player, at);
  assert.equal(player.trip!.bite, null);
  assert.equal(player.trip!.battle, null);
  assert.match(player.trip!.message, /Поздняя/);
  send({ type: 'fishAt', zone: 0 }, at + 1);
  send({ type: 'reel' }, at + 2);
  assert.equal(player.trip!.bite, null);
  send({ type: 'move', x: .6, y: .5 }, at + 3);
  assert.ok(player.trip!.voyage);
});

test('неверный участок отклоняется; повороты сохраняются после остановки', () => {
  const { player, send } = setup();
  for (const zone of [-1, 3, .5, NaN]) assert.throws(() => send({ type: 'fishAt', zone }, 1), RuleError);
  const from = player.trip!.boat!;
  send({ type: 'move', x: .7, y: .5 }, 10);
  assert.equal(player.trip!.heading, headingTo(from, { x: .7, y: .5 }));
  const heading = player.trip!.heading;
  send({ type: 'stop' }, 500);
  assert.equal(player.trip!.heading, heading);
  for (let i = 0; i < 8; i++) assert.equal(headingFrame(i * Math.PI / 4), i);
  assert.equal(headingFrame(-Math.PI / 4), 7);
});
