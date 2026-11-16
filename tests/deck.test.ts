import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, FISH_TURN_MS, HAND_LIMIT, HAND_SIZE, starterDeck, TURN_ENERGY } from '../shared/content.ts';
import { battleDeck, drawCards } from '../shared/deck.ts';
import { advancePlayer, applyAction, newPlayer } from '../shared/game.ts';
import type { Action, Battle } from '../shared/types.ts';

function setup(random = () => .99) {
  const player = newPlayer('Колода');
  let now = 0;
  const send = (action: Action) => applyAction(player, action, { now, random, nextId: () => 'catch' });
  send({ type: 'start', spot: 'reeds', bait: 'worm' });
  player.trip!.bite = { zone: 2, opensAt: 0, closesAt: 100 };
  send({ type: 'hook' });
  const battle = player.trip!.battle!;
  const end = () => {
    send({ type: 'endTurn', round: battle.round });
    now += FISH_TURN_MS;
    advancePlayer(player, now, random);
  };
  const play = (instance: number) => send({ type: 'play', card: battle.deck[instance], instance, round: battle.round });
  return { player, battle, send, play, end };
}

function assertConserved(battle: Battle) {
  const instances = [...battle.hand, ...battle.drawPile, ...battle.discardPile].sort((a, b) => a - b);
  assert.deepEqual(instances, battle.deck.map((_, index) => index));
}

test('12 карт перемешиваются перед боем; пять в руке, остальные в стопке, копии не теряются', () => {
  const first = setup(() => 0).battle;
  const second = setup(() => .99).battle;
  assert.equal(first.deck.length, 12);
  assert.equal(first.hand.length, HAND_SIZE);
  assert.equal(first.drawPile.length, 7);
  assert.equal(first.discardPile.length, 0);
  assert.equal(first.energy, TURN_ENERGY);
  assert.notDeepEqual(first.hand, second.hand);
  assertConserved(first);
  assertConserved(second);
});

test('можно сыграть две копии; повтор экземпляра, чужая карта и нехватка энергии отклоняются', () => {
  const { battle, play, send } = setup();
  const copies = battle.hand.filter(index => battle.deck[index] === 'reel');
  assert.equal(copies.length, 2);
  assert.throws(() => send({ type: 'play', round: 0, card: 'ease', instance: copies[0] }), /нет в руке/);
  play(copies[0]);
  assert.throws(() => play(copies[0]), /нет в руке/);
  play(copies[1]);
  assert.equal(battle.energy, 1);
  const pull = battle.hand.find(index => battle.deck[index] === 'pull')!;
  const before = structuredClone(battle);
  assert.throws(() => play(pull), /энергии/);
  assert.deepEqual(battle, before);
  assertConserved(battle);
});

test('в конце хода рука сбрасывается; новый добор сначала расходует остаток, потом мешает сброс', () => {
  const { player, battle, send } = setup();
  battle.line = 100;
  const opening = [...battle.hand];
  send({ type: 'endTurn', round: 0 });
  assert.deepEqual(battle.hand, []);
  assert.deepEqual(battle.discardPile, opening);
  assert.equal(battle.energy, 0);
  advancePlayer(player, FISH_TURN_MS, () => .99);
  assert.equal(battle.hand.length, 5);
  assert.equal(battle.drawPile.length, 2);
  assert.ok(battle.hand.every(index => !opening.includes(index)));
  const remainder = [...battle.drawPile];
  send({ type: 'endTurn', round: 1 });
  advancePlayer(player, FISH_TURN_MS * 2, () => .99);
  assert.deepEqual(battle.hand.slice(0, 2), remainder.reverse());
  assert.equal(battle.hand.length, 5);
  assert.equal(battle.drawPile.length, 7);
  assert.equal(battle.discardPile.length, 0);
  assert.equal(battle.shuffles, 1);
  assertConserved(battle);
});

test('случайная рука может не содержать защиты; заявленный рывок повреждает леску', () => {
  let seed = 17;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  let undefended = 0;
  const combinations = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const { battle, end } = setup(random);
    combinations.add(battle.hand.map(index => battle.deck[index]).sort().join(','));
    if (battle.hand.every(index => cards[battle.deck[index]].guard === 0)) {
      undefended++;
      const line = battle.line;
      end();
      assert.ok(battle.line < line);
    }
  }
  assert.ok(undefended >= 5 && undefended < 60, `Рук без защиты: ${undefended}`);
  assert.ok(combinations.size > 30);
});

test('добор пересекает границу стопок и не возвращает разыгрываемую карту', () => {
  const { battle, play } = setup();
  const scout = battle.deck.indexOf('scout');
  battle.hand = [scout];
  battle.drawPile = [0];
  battle.discardPile = battle.deck.map((_, index) => index).filter(index => index !== scout && index !== 0);
  play(scout);
  assert.equal(battle.energy, 2);
  assert.equal(battle.hand.length, 2);
  assert.equal(battle.hand[0], 0);
  assert.ok(!battle.hand.includes(scout));
  assert.deepEqual(battle.discardPile, [scout]);
  assert.equal(battle.shuffles, 1);
  assertConserved(battle);
});

test('защита исчезает после ответа рыбы, рука сохраняется при перезагрузке', () => {
  const { player, battle, play, end } = setup();
  play(battle.deck.indexOf('brace'));
  assert.equal(battle.block, 7);
  end();
  assert.equal(battle.line, 10);
  assert.equal(battle.block, 0);
  const restored = JSON.parse(JSON.stringify(player));
  assert.equal(advancePlayer(restored, 50_000), false);
  assert.deepEqual(restored.trip.battle, battle);
});

test('лимит руки и пустые стопки не создают карты и не зацикливают добор', () => {
  const { battle } = setup();
  Object.assign(battle, battleDeck(starterDeck, () => .5));
  drawCards(battle, 100, () => .5);
  assert.equal(battle.hand.length, HAND_LIMIT);
  assertConserved(battle);
  battle.hand = [];
  battle.drawPile = [];
  battle.discardPile = [];
  drawCards(battle, 100, () => .5);
  assert.deepEqual(battle.hand, []);
});

test('старый профиль и текущий бой мигрируют один раз, сохраняя награды и потраченную энергию', () => {
  const { player, battle } = setup();
  player.deck = ['sharp', 'ease', 'firm'];
  player.collection = ['reel', 'ease', 'short', 'sharp', 'firm'];
  battle.energy = 1;
  battle.played = ['sharp'];
  for (const field of ['deck', 'hand', 'drawPile', 'discardPile', 'shuffles']) Reflect.deleteProperty(battle, field);
  assert.equal(advancePlayer(player, 1, () => .99), true);
  assert.deepEqual(player.deck.slice(0, 3), ['sharp', 'ease', 'firm']);
  assert.equal(player.deck.length, 12);
  assert.ok(player.collection.includes('scout'));
  assert.equal(battle.energy, 1);
  assert.ok(battle.discardPile.includes(0));
  assertConserved(battle);
  const saved = JSON.stringify(player);
  assert.equal(advancePlayer(player, 2, () => 0), false);
  assert.equal(JSON.stringify(player), saved);
});

test('редактор заменяет любой из 12 слотов и не размножает наградные карты', () => {
  const player = newPlayer('Снасти');
  player.collection.push('firm');
  const equip = (slot: number, card: 'firm' | 'reel') => applyAction(player, { type: 'equip', slot, card }, { now: 0, random: () => 0, nextId: () => '' });
  equip(11, 'firm');
  assert.equal(player.deck[11], 'firm');
  assert.throws(() => equip(10, 'firm'), /копии/);
  equip(11, 'reel');
  assert.equal(player.deck.length, 12);
  for (const slot of [-1, 12, .5]) assert.throws(() => equip(slot, 'firm'), /место/);
});
