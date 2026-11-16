import assert from 'node:assert/strict';
import test from 'node:test';
import { CHARGE_MS, FISH_TURN_MS, TRIP_MS, castStrength } from '../shared/content.ts';
import { advancePlayer, applyAction, cardEffect, fishIntent, gridSize, newPlayer, RuleError } from '../shared/game.ts';
import type { Action } from '../shared/types.ts';
import { approach, boatAt, castLanding, fishingTargets, launchPosition, onWater, waterDistance, zoneAt } from '../shared/navigation.ts';

function game() {
  const player = newPlayer('Проверка');
  let id = 0;
  function send(action: Action | Omit<Extract<Action, { type: 'play' }>, 'instance'>, now: number, random = 0) {
    advancePlayer(player, now, () => random);
    const battle = player.trip?.battle;
    const resolved = action.type === 'play' && !('instance' in action)
      ? { ...action, instance: battle?.hand.find(index => battle.deck[index] === action.card) ?? -1 } : action;
    applyAction(player, resolved, { now, random: () => random, nextId: () => String(++id) });
    if (action.type === 'hook' && player.trip?.battle) {
      // Fixed hand isolates the original quest, timing and effect tests from shuffle order.
      const fight = player.trip.battle;
      fight.hand = [1, 0, 2, 6, 10];
      fight.drawPile = fight.deck.map((_, index) => index).filter(index => !fight.hand.includes(index));
    }
  }
  function cast(start: number, hold: number) {
    send({ type: 'charge' }, start);
    send({ type: 'cast' }, start + hold);
    return player.trip!.bite!;
  }
  send({ type: 'start', spot: 'reeds', bait: 'worm' }, 0);
  return { player, cast, send };
}

test('лодка идёт по времени, меняет курс с текущей позиции и сохраняется', () => {
  const { player, send } = game();
  send({ type: 'move', x: .7, y: .4, aim: fishingTargets('reeds')[2] }, 100);
  const trip = player.trip!;
  assert.deepEqual(JSON.parse(JSON.stringify(trip)).aim, fishingTargets('reeds')[2]);
  const midpoint = (trip.voyage!.startedAt + trip.voyage!.arrivesAt) / 2;
  const halfway = boatAt(trip, midpoint);
  assert.ok(Math.abs(halfway.x - (launchPosition('reeds').x + .7) / 2) < 1e-9);
  assert.deepEqual(boatAt(JSON.parse(JSON.stringify(trip)), midpoint), halfway);
  send({ type: 'move', x: .4, y: .7 }, midpoint);
  assert.deepEqual(trip.voyage!.from, halfway);
  const at = midpoint + 200;
  const stopped = boatAt(trip, at);
  send({ type: 'stop' }, at);
  assert.deepEqual(boatAt(trip, at + 10000), stopped);
  assert.equal(trip.voyage, null);
  for (const x of [0, 1, NaN, Infinity]) assert.throws(() => send({ type: 'move', x, y: .5 }, at), RuleError);
});

test('географический заброс выбирает улов по точке падения во всех трёх участках', () => {
  for (const [index, aim] of fishingTargets('reeds').entries()) {
    const { player, send } = game();
    send({ type: 'move', ...approach(aim) }, 10);
    const arrived = player.trip!.voyage!.arrivesAt;
    const position = boatAt(player.trip!, arrived);
    const hold = (waterDistance(position, aim) - .025) / .20 * CHARGE_MS;
    send({ type: 'charge', aim }, arrived);
    assert.equal(player.trip!.voyage, null);
    assert.throws(() => send({ type: 'charge', aim }, arrived + 1), RuleError);
    send({ type: 'cast' }, arrived + hold);
    const bite = player.trip!.bite!;
    assert.equal(bite.zone, index);
    assert.ok(waterDistance(bite.position!, aim) < 1e-9);
    assert.throws(() => send({ type: 'move', x: .5, y: .5 }, arrived + hold + 1), RuleError);
    send({ type: 'hook' }, bite.opensAt, .99);
    assert.equal(player.trip!.battle!.species, ['crucian', 'perch', 'pike'][index]);
  }
});

test('снасть можно убрать, а заброс останавливает лодку на середине маршрута', () => {
  const { player, send } = game();
  send({ type: 'move', x: .8, y: .5 }, 100);
  const at = 500;
  const position = boatAt(player.trip!, at);
  send({ type: 'charge', aim: fishingTargets('reeds')[1] }, at);
  assert.deepEqual(player.trip!.boat, position);
  assert.throws(() => send({ type: 'move', x: .5, y: .5 }, 510), RuleError);
  send({ type: 'cast' }, 900);
  send({ type: 'reel' }, 1000);
  assert.equal(player.trip!.bite, null);
  send({ type: 'move', x: .5, y: .5 }, 1100);
  assert.ok(player.trip!.voyage);
  send({ type: 'charge', aim: fishingTargets('reeds')[1] }, 1200);
  send({ type: 'reel' }, 1300);
  assert.equal(player.trip!.chargingAt, null);
});

test('любая точка воды имеет участок; дальность растёт и не выходит на берег', () => {
  const boat = { x: .5, y: .5 };
  const aim = { x: .7, y: .5 };
  assert.ok(waterDistance(boat, castLanding(boat, aim, 300)) < waterDistance(boat, castLanding(boat, aim, 1000)));
  for (const x of [.13, .4, .87]) for (const y of [.28, .5, .77]) {
    assert.ok([0, 1, 2].includes(zoneAt({ x, y }, 'reeds')));
    assert.ok(onWater(castLanding({ x, y }, aim, CHARGE_MS)));
  }
  assert.deepEqual(boatAt({ spot: 'reeds' }, 5000), launchPosition('reeds'));
});

test('дальность, ранняя подсечка и шанс рыбы в дальнем омуте', () => {
  const { player, cast, send } = game();
  const close = cast(100, 200);
  assert.equal(close.zone, 0);
  send({ type: 'hook' }, close.opensAt - 1);
  assert.match(player.trip!.message, /Ранняя подсечка/);

  assert.equal(castStrength(CHARGE_MS), 1);
  assert.equal(castStrength(CHARGE_MS * 1.5), .5);
  assert.equal(castStrength(CHARGE_MS * 2), 0);
  const descending = cast(close.opensAt + 500, 2_250);
  assert.equal(descending.zone, 1);
  send({ type: 'hook' }, descending.opensAt - 1);
  const distant = cast(descending.opensAt + 500, 1_200);
  assert.equal(distant.zone, 2);
  send({ type: 'hook' }, distant.opensAt + 10, 0.95);
  assert.equal(player.trip!.battle!.species, 'pike');
});

test('бой без таймера приостанавливает вылазку и ждёт передачи хода', () => {
  const { player, cast, send } = game();
  const bite = cast(100, 200);
  send({ type: 'hook' }, bite.opensAt);
  const pausedAt = player.trip!.pausedAt;
  assert.equal(advancePlayer(player, bite.opensAt + 600_000), false);
  assert.equal(player.trip!.battle!.phase, 'player');
  assert.equal(player.trip!.battle!.round, 0);
  assert.equal(player.trip!.pausedAt, pausedAt);
  send({ type: 'endTurn', round: 0 }, bite.opensAt + 600_000);
  assert.throws(() => send({ type: 'play', round: 0, card: 'reel' }, bite.opensAt + 600_001), RuleError);
  advancePlayer(player, bite.opensAt + 600_000 + FISH_TURN_MS);
  assert.equal(player.trip!.battle!.round, 1);
  assert.equal(player.trip!.battle!.line, 7);
  assert.throws(() => send({ type: 'play', round: 0, card: 'reel' }, bite.opensAt + 601_000), RuleError);
});

test('карты тратят энергию, а рыба применяет заявленный приём только после передачи хода', () => {
  const { player, cast, send } = game();
  const bite = cast(100, 200);
  const at = bite.opensAt;
  send({ type: 'hook' }, at);
  const battle = player.trip!.battle!;
  assert.deepEqual(fishIntent(battle), { attack: 3, block: 0 });
  send({ type: 'play', round: 0, card: 'ease' }, at + 100);
  assert.throws(() => send({ type: 'play', round: 0, card: 'ease' }, at + 110), RuleError);
  send({ type: 'play', round: 0, card: 'reel' }, at + 120);
  assert.throws(() => send({ type: 'play', round: 0, card: 'pull' }, at + 130), RuleError);
  assert.equal(battle.fishHealth, 11);
  assert.equal(battle.line, 10);
  assert.equal(battle.block, 4);
  assert.equal(battle.phase, 'player');
  send({ type: 'endTurn', round: 0 }, at + 200);
  advancePlayer(player, at + 200 + FISH_TURN_MS);
  assert.equal(battle.line, 10);
  assert.equal(battle.block, 0);
  assert.equal(battle.energy, 3);
  assert.deepEqual(fishIntent(battle), { attack: 0, block: 3 });
  send({ type: 'endTurn', round: 1 }, at + 900);
  advancePlayer(player, at + 900 + FISH_TURN_MS, () => 0);
  assert.equal(battle.fishBlock, 3);
  send({ type: 'play', round: 2, card: 'reel' }, at + 1_500);
  assert.equal(battle.fishBlock, 0);
  assert.equal(battle.fishHealth, 11);
});

test('улов учитывается только после размещения, а розыгрыш расходует рыбу один раз', () => {
  const { player, cast, send } = game();
  const bite = cast(100, 200);
  send({ type: 'hook' }, bite.opensAt);
  send({ type: 'play', round: 0, card: 'reel' }, bite.opensAt + 100);
  send({ type: 'play', round: 0, card: 'pull' }, bite.opensAt + 200);
  send({ type: 'endTurn', round: 0 }, bite.opensAt + 250);
  send({ type: 'play', round: 1, card: 'reel' }, bite.opensAt + 850);
  send({ type: 'play', round: 1, card: 'reel' }, bite.opensAt + 855);
  const id = player.trip!.pending!.id;
  assert.throws(() => send({ type: 'return' }, bite.opensAt + 860), RuleError);
  assert.throws(() => send({ type: 'place', id, x: 3, y: 0, rotated: false }, bite.opensAt + 870), RuleError);
  send({ type: 'place', id, x: 0, y: 0, rotated: false }, bite.opensAt + 880);
  send({ type: 'return' }, bite.opensAt + 900);
  assert.equal(player.bestScore, 10);
  assert.equal(player.gold, 0);
  assert.equal(player.activeQuest!.progress, 1);
  send({ type: 'claimQuest' }, bite.opensAt + 905);
  assert.equal(player.gold, 7);
  assert.throws(() => send({ type: 'claimQuest' }, bite.opensAt + 906), RuleError);
  assert.throws(() => send({ type: 'return' }, bite.opensAt + 910), RuleError);
  send({ type: 'roll', id }, bite.opensAt + 920, 0.93);
  assert.equal(player.lastRoll!.card, 'sharp');
  assert.equal(player.stock.length, 0);
  assert.throws(() => send({ type: 'sell', id }, bite.opensAt + 930), RuleError);
  send({ type: 'equip', slot: 0, card: 'sharp' }, bite.opensAt + 940);
  assert.equal(player.deck[0], 'sharp');
  assert.equal(player.bestScore, 10);
  send({ type: 'start', spot: 'reeds', bait: 'worm' }, bite.opensAt + 1_000);
  send({ type: 'return' }, bite.opensAt + 1_500);
  assert.equal(player.result!.record, false);
  assert.equal(player.bestScore, 10);
});

test('сохранённый бой из старой версии получает параметры нового хода', () => {
  const { player, cast, send } = game();
  const bite = cast(100, 200);
  send({ type: 'hook' }, bite.opensAt);
  const battle = player.trip!.battle!;
  for (const field of ['phase', 'energy', 'played', 'block', 'fishBlock', 'zone']) {
    Reflect.deleteProperty(battle, field);
  }
  assert.equal(advancePlayer(player, bite.opensAt + 1), true);
  assert.equal(battle.phase, 'player');
  assert.equal(battle.energy, 3);
  assert.equal(battle.line, 10);
});

test('дедлайн завершает вылазку, а бонус лодки открывает район', () => {
  const { player, send } = game();
  assert.equal(advancePlayer(player, TRIP_MS + 1_000), true);
  assert.equal(player.result!.seconds, 300);
  assert.equal(player.result!.score, 0);
  assert.throws(() => send({ type: 'start', spot: 'channel', bait: 'worm' }, TRIP_MS + 1_100), RuleError);
  player.gold = 30;
  send({ type: 'upgrade', upgrade: 'boat' }, TRIP_MS + 1_200);
  send({ type: 'upgrade', upgrade: 'gear' }, TRIP_MS + 1_300);
  assert.deepEqual(gridSize(player), { width: 3, height: 3 });
  assert.deepEqual(cardEffect(player, 'short'), { damage: 3, guard: 3 });
  send({ type: 'start', spot: 'channel', bait: 'worm' }, TRIP_MS + 1_400);
  assert.equal(player.trip!.spot, 'channel');
});


test('результат боя сохраняется, отсчёт возобновляется после подтверждения', () => {
  const { player, cast, send } = game();
  const bite = cast(100, 200);
  send({type:'hook'},bite.opensAt);
  const oldDeadline=player.trip!.deadline;
  player.trip!.battle!.fishHealth=1;
  send({type:'play',round:0,card:'reel'},bite.opensAt+600_000);
  assert.equal(player.trip!.outcome!.win,true);
  const restored=JSON.parse(JSON.stringify(player));
  assert.equal(advancePlayer(restored,bite.opensAt+700_000),false);
  assert.equal(restored.trip.outcome.win,true);
  send({type:'ackOutcome'},bite.opensAt+700_000);
  assert.equal(player.trip!.deadline,oldDeadline+700_000);
  assert.equal(player.trip!.pausedAt,null);
  send({type:'place',id:player.trip!.pending!.id,x:0,y:0,rotated:false},bite.opensAt+700_100);
  send({type:'return'},bite.opensAt+700_200);
  assert.equal(player.result!.seconds,Math.floor((bite.opensAt+200)/1000));
});

test('поражение сохраняет окно результата и не расходует время боя', () => {
  const { player, cast, send } = game();
  const bite=cast(100,200);send({type:'hook'},bite.opensAt);
  player.trip!.battle!.line=1;
  send({type:'endTurn',round:0},bite.opensAt+10);
  advancePlayer(player,bite.opensAt+10+FISH_TURN_MS);
  assert.equal(player.trip!.battle,null);
  assert.equal(player.trip!.outcome!.win,false);
  assert.throws(()=>send({type:'charge'},bite.opensAt+700),RuleError);
  send({type:'ackOutcome'},bite.opensAt+800);
  assert.equal(player.trip!.pausedAt,null);
  send({type:'charge'},bite.opensAt+900);
  assert.equal(player.trip!.chargingAt,bite.opensAt+900);
});

test('новый заказ считает только подходящую рыбу после принятия, награда одноразовая', () => {
  const { player,send }=game();
  send({type:'return'},100);
  assert.throws(()=>send({type:'claimQuest'},200),RuleError);
  player.activeQuest!.progress=1;
  send({type:'claimQuest'},300);
  send({type:'takeQuest',id:'perch'},400);
  assert.throws(()=>send({type:'takeQuest',id:'pike'},500),RuleError);
  send({type:'start',spot:'reeds',bait:'worm'},600);
  player.trip!.cargo=[{id:'carp',species:'crucian',x:0,y:0,rotated:false},{id:'perch',species:'perch',x:1,y:0,rotated:false}];
  send({type:'return'},700);
  assert.equal(player.activeQuest!.progress,1);
  assert.equal(player.gold,7);
  send({type:'claimQuest'},800);
  assert.equal(player.gold,25);
  assert.equal(player.stock.length,2);
  assert.throws(()=>send({type:'takeQuest',id:'perch'},900),RuleError);
});

test('старое сохранение сохраняет выданную награду и не выдаёт её повторно', () => {
  const player=newPlayer('Старый игрок');player.orderDone=true;player.gold=7;
  Reflect.deleteProperty(player,'activeQuest');Reflect.deleteProperty(player,'completedQuests');
  advancePlayer(player,0);
  assert.equal(player.activeQuest,null);
  assert.deepEqual(player.completedQuests,['first']);
  assert.equal(player.gold,7);
});
