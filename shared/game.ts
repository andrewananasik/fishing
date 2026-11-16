import {
  FISH_TURN_MS, HAND_SIZE, LINE_MAX, TRIP_MS, TURN_ENERGY, cards, castZone, fish, fishIds, getSpot,
  oddsFor, rewardCards, starterDeck, upgrades,
} from './content.ts';
import type { CardId, Weights } from './content.ts';
import type { Action, Battle, Placement, Player, Trip } from './types.ts';
import { currentQuest, migratePlayer, quests } from './quests.ts';
import { battleDeck, drawCards, migrateDeck } from './deck.ts';
import { BOAT_SPEED, FISHING_RANGE, boatAt, castLanding, launchPosition, onWater, waterDistance, zoneAt, fishingTargets, fishingDifficulty, headingTo, ringTimings } from './navigation.ts';

export class RuleError extends Error {}

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}

export function newPlayer(nickname: string): Player {
  return {
    activeQuest: { id: 'first', progress: 0 }, completedQuests: [],
    nickname, revision: 0, gold: 0, collection: [...new Set(starterDeck)], deck: [...starterDeck],
    upgrades: [], stock: [], trip: null, result: null, orderDone: false,
    bestScore: null, bestAt: null, lastRoll: null,
  };
}

function weightedIndex(weights: Weights, random: () => number) {
  const roll = random() * 100;
  if (roll < weights[0]) return 0;
  return roll < weights[0] + weights[1] ? 1 : 2;
}

export function gridSize(player: Player) {
  return { width: 3, height: player.upgrades.includes('boat') ? 3 : 2 };
}

export function occupiedCells(item: Placement) {
  return Array.from({ length: fish[item.species].length }, (_, index) => ({
    x: item.x + (item.rotated ? 0 : index),
    y: item.y + (item.rotated ? index : 0),
  }));
}

export function placementFits(item: Placement, cargo: Placement[], width: number, height: number) {
  const occupied = cargo.filter((other) => other.id !== item.id).flatMap(occupiedCells);
  return occupiedCells(item).every(({ x, y }) =>
    x >= 0 && x < width && y >= 0 && y < height &&
    !occupied.some((cell) => cell.x === x && cell.y === y));
}

export function cardEffect(player: Player, id: CardId) {
  const { damage, guard } = cards[id];
  const upgraded = player.upgrades.includes('gear');
  return { damage: damage + Number(upgraded && damage > 0), guard: guard + Number(upgraded && guard > 0) };
}

export function fishIntent(battle: Battle) {
  const { moves } = fish[battle.species];
  return moves[battle.round % moves.length];
}

function finishTrip(player: Player, trip: Trip, now: number) {
  const cargo = trip.cargo.map(({ id, species }) => ({ id, species }));
  const score = cargo.reduce((total, item) => total + fish[item.species].points, 0);
  const record = player.bestScore === null || score > player.bestScore;
  const orderGold = 0;
  if (record) {
    player.bestScore = score;
    player.bestAt = now;
  }
  const quest = currentQuest(player);
  if (quest && player.activeQuest) {
    player.activeQuest.progress = Math.min(quest.count, player.activeQuest.progress + cargo.filter(item => !quest.species || item.species === quest.species).length);
  }
  player.stock.push(...cargo);
  player.result = {
    spot: trip.spot, startedAt: trip.startedAt, seconds: Math.floor((now - trip.startedAt - (trip.pausedMs ?? 0) - (trip.pausedAt != null ? now - trip.pausedAt : 0)) / 1_000), cargo, score, record, orderGold,
  };
  player.trip = null;
}

function resumeTrip(trip: Trip, now: number) {
  if (trip.pausedAt != null) {
    const paused = Math.max(0, now - trip.pausedAt);
    trip.deadline += paused;
    trip.pausedMs = (trip.pausedMs ?? 0) + paused;
    trip.pausedAt = null;
  }
}

function loseFish(trip: Trip, message: string) {
  if (trip.battle) trip.outcome = { species: trip.battle.species, win: false, message };
  trip.battle = null;
  trip.message = message;
}

function startFishTurn(battle: Battle, now: number) {
  battle.discardPile.push(...battle.hand);
  battle.hand = [];
  battle.energy = 0;
  battle.phase = 'fish';
  battle.deadline = now + FISH_TURN_MS;
}

function resolveFishTurn(trip: Trip, battle: Battle, random: () => number) {
  const intent = fishIntent(battle);
  const damage = Math.max(0, intent.attack - battle.block);
  battle.line -= damage;
  if (battle.line <= 0) {
    loseFish(trip, 'Леска оборвалась. Рыба ушла.');
    return;
  }
  const attackMessage = intent.attack && (damage ? `Рывок рыбы: −${damage} прочности.` : 'Вы полностью заблокировали рывок.');
  const blockMessage = intent.block && `Рыба получила ${intent.block} блока.`;
  trip.message = [attackMessage, blockMessage].filter(Boolean).join(' ');
  battle.round += 1;
  battle.phase = 'player';
  battle.energy = TURN_ENERGY;
  battle.played = [];
  battle.block = 0;
  battle.fishBlock = intent.block;
  battle.deadline = 0;
  drawCards(battle, HAND_SIZE, random);
}

function requirePlayerTurn(battle: Battle | null | undefined, round: number): asserts battle is Battle {
  requireRule(battle, 'Рыба уже ушла или поймана.');
  requireRule(battle.round === round && battle.phase === 'player', 'Этот ход уже закончился.');
}

export function advancePlayer(player: Player, now: number, random = Math.random) {
  migratePlayer(player);
  let changed = migrateDeck(player, random);
  const trip = player.trip;
  if (!trip) return changed;
  if ((trip.battle || trip.outcome) && trip.pausedAt == null) { trip.pausedAt = now; changed = true; }
  if (trip.pausedAt == null && now >= trip.deadline) {
    finishTrip(player, trip, trip.deadline);
    return true;
  }
  if (trip.bite && now >= trip.bite.closesAt) {
    trip.bite = null;
    trip.message = 'Поздняя подсечка. Рыба ушла.';
    return true;
  }
  if (trip.battle && trip.battle.phase === undefined) {
    Object.assign(trip.battle, { zone: null, phase: 'player', energy: TURN_ENERGY, played: [], block: 0, fishBlock: 0 });
    changed = true;
  }
  if (trip.battle?.phase === 'fish' && now >= trip.battle.deadline) {
    resolveFishTurn(trip, trip.battle, random);
    changed = true;
  }
  return changed;
}

type GameContext = { now: number; random: () => number; nextId: () => string };

export function applyAction(player: Player, action: Action, { now, random, nextId }: GameContext) {
  migratePlayer(player);
  migrateDeck(player, random);
  const trip = player.trip;

  switch (action.type) {
    case 'takeQuest': {
      requireRule(!trip && !player.activeQuest, 'Сначала сдайте текущий заказ на причале.');
      const quest = quests.find(entry => entry.id === action.id);
      requireRule(quest && !player.completedQuests.includes(quest.id), 'Этот заказ уже выполнен или недоступен.');
      player.activeQuest = { id: quest.id, progress: 0 };
      return;
    }
    case 'claimQuest': {
      const quest = currentQuest(player);
      requireRule(!trip && quest && player.activeQuest && player.activeQuest.progress >= quest.count, 'Заказ ещё не готов к сдаче.');
      player.gold += quest.gold;
      player.completedQuests.push(quest.id);
      if (quest.id === 'first') player.orderDone = true;
      player.activeQuest = null;
      return;
    }
    case 'ackOutcome':
      requireRule(trip?.outcome, 'Результат боя уже закрыт.');
      trip.outcome = null;
      resumeTrip(trip, now);
      return;
    case 'start': {
      requireRule(!trip, 'Вылазка уже началась.');
      const { requires } = getSpot(action.spot);
      requireRule(!requires || player.upgrades.includes(requires), 'Эта точка ещё закрыта.');
      player.trip = {
        spot: action.spot, bait: action.bait, startedAt: now, deadline: now + TRIP_MS,
        chargingAt: null, bite: null, battle: null, pending: null, cargo: [], message: 'Приготовьтесь к забросу.',
        boat: launchPosition(action.spot), voyage: null, aim: null,
      };
      player.result = null;
      return;
    }
    case 'move': {
      requireRule(trip && !trip.bite && !trip.battle && !trip.pending && !trip.outcome && trip.chargingAt === null, 'Сначала вытащите снасть и завершите ловлю.');
      const to = { x: action.x, y: action.y };
      requireRule(onWater(to), 'Лодка может плыть только по открытой воде.');
      requireRule(!action.aim || onWater(action.aim), 'Выберите цель на воде.');
      const from = boatAt(trip, now);
      trip.boat = from;
      trip.aim = action.aim ?? to;
      if (waterDistance(from, to) > .001) trip.heading = headingTo(from, to);
      trip.voyage = { from, to, startedAt: now, arrivesAt: now + waterDistance(from, to) / BOAT_SPEED * 1000 };
      trip.message = 'Плывём к выбранному месту. Заброс остановит лодку.';
      return;
    }
    case 'fishAt': {
      requireRule(trip && !trip.bite && !trip.battle && !trip.pending && !trip.outcome && trip.chargingAt === null, 'Сначала завершите текущую ловлю.');
      const targets = fishingTargets(trip.spot);
      requireRule(Number.isInteger(action.zone) && action.zone >= 0 && action.zone < targets.length, 'Выберите участок ловли.');
      const position = boatAt(trip, now);
      const target = targets[action.zone];
      requireRule(waterDistance(position, target) <= FISHING_RANGE, 'Сначала подплывите ближе к этому участку.');
      requireRule(!trip.voyage || now >= trip.voyage.arrivesAt, 'Дождитесь остановки лодки.');
      const difficulty = fishingDifficulty(trip.spot, action.zone, trip.bait);
      const timing = ringTimings[difficulty];
      trip.boat = position;
      trip.voyage = null;
      trip.aim = target;
      trip.heading = headingTo(position, target);
      // The server owns both the cast target and the success interval.
      trip.bite = { zone: action.zone, position: { ...target }, opensAt: now + timing.windup,
        closesAt: now + timing.windup + timing.window,
        ring: { startedAt: now, duration: timing.duration, difficulty } };
      trip.message = 'Дождитесь, когда кольцо войдёт в светлую полосу, и нажмите «Тянуть».';
      return;
    }
    case 'stop':
      requireRule(trip, 'Сначала начните вылазку.');
      trip.boat = boatAt(trip, now);
      trip.voyage = null;
      return;
    case 'reel':
      requireRule(trip && !trip.battle && !trip.pending && !trip.outcome, 'Сначала завершите текущую ловлю.');
      trip.bite = null;
      trip.chargingAt = null;
      trip.message = 'Снасть в лодке. Можно выбрать новое место.';
      return;
    case 'charge':
      requireRule(trip && !trip.bite && !trip.battle && !trip.pending && !trip.outcome, 'Сначала завершите текущую ловлю.');
      requireRule(trip.chargingAt === null, 'Заброс уже готовится.');
      requireRule(!action.aim || onWater(action.aim), 'Выберите цель на воде.');
      trip.boat = boatAt(trip, now);
      trip.voyage = null;
      trip.aim = action.aim ?? null;
      trip.chargingAt = now;
      return;
    case 'cancelCharge':
      requireRule(trip, 'Сначала начните вылазку.');
      trip.chargingAt = null;
      return;
    case 'cast': {
      requireRule(trip && trip.chargingAt !== null, 'Зажмите кнопку, чтобы задать силу заброса.');
      // Legacy trips without an aim retain their original distance-based casting.
      const position = trip.aim ? castLanding(boatAt(trip, now), trip.aim, now - trip.chargingAt) : undefined;
      const zone = position ? zoneAt(position, trip.spot) : castZone(now - trip.chargingAt);
      const opensAt = now + 800 + Math.floor(random() * 600);
      trip.bite = { zone, opensAt, closesAt: opensAt + [1_250, 1_100, 950][zone], position };
      trip.chargingAt = null;
      trip.message = `Заброс в участок «${getSpot(trip.spot).zones[zone].name}». Ждите поклёвку.`;
      return;
    }
    case 'hook': {
      requireRule(trip?.bite, 'Дождитесь поклёвки.');
      const { zone, opensAt, closesAt } = trip.bite;
      trip.bite = null;
      if (now < opensAt || now >= closesAt) {
        trip.message = now < opensAt ? 'Ранняя подсечка. Рыба ушла.' : 'Поздняя подсечка. Рыба ушла.';
        return;
      }
      const species = fishIds[weightedIndex(oddsFor(getSpot(trip.spot).zones[zone], trip.bait), random)];
      trip.battle = {
        species, zone, fishHealth: fish[species].health, line: LINE_MAX, round: 0,
        phase: 'player', energy: TURN_ENERGY, played: [], block: 0, fishBlock: 0,
        ...battleDeck(player.deck, random),
        startedAt: now, deadline: 0,
      };
      trip.pausedAt = now;
      trip.message = 'Рыба на крючке.';
      return;
    }
    case 'play': {
      const battle = trip?.battle;
      requirePlayerTurn(battle, action.round);
      requireRule(trip, 'Сначала начните вылазку.');
      requireRule(battle.hand.includes(action.instance) && battle.deck[action.instance] === action.card, 'Этой карты нет в руке.');
      const card = cards[action.card];
      requireRule(battle.energy >= card.cost, 'Не хватает энергии для этой карты.');
      battle.hand = battle.hand.filter(index => index !== action.instance);
      const { damage, guard } = cardEffect(player, action.card);
      const absorbed = Math.min(damage, battle.fishBlock);
      battle.fishBlock -= absorbed;
      battle.fishHealth -= damage - absorbed;
      battle.block += guard;
      battle.played.push(action.card);
      battle.energy -= card.cost;
      // A card being resolved cannot draw itself when the discard pile is shuffled.
      drawCards(battle, card.draw, random);
      battle.discardPile.push(action.instance);
      if (battle.fishHealth <= 0) {
        trip.outcome = { species: battle.species, win: true, message: 'Рыба утомлена. Ваш улов!' };
        trip.pending = { id: nextId(), species: battle.species };
        trip.battle = null;
        trip.message = `${fish[battle.species].name} пойман. Найдите место в трюме.`;
      } else {
        const effects = [damage && `урон ${damage - absorbed}`, guard && `блок +${guard}`, card.draw && `добор ${card.draw}`].filter(Boolean).join(' · ');
        trip.message = `${cards[action.card].name}: ${effects}.`;
      }
      return;
    }
    case 'endTurn': {
      const battle = trip?.battle;
      requirePlayerTurn(battle, action.round);
      requireRule(trip, 'Сначала начните вылазку.');
      startFishTurn(battle, now);
      trip.message = 'Ход рыбы.';
      return;
    }
    case 'place': {
      requireRule(trip && !trip.battle, 'Разбирайте трюм после завершения боя.');
      const item = trip.pending?.id === action.id ? trip.pending : trip.cargo.find((entry) => entry.id === action.id);
      requireRule(item, 'Эта рыба больше не в трюме.');
      const placement: Placement = { ...item, x: action.x, y: action.y, rotated: action.rotated };
      const { width, height } = gridSize(player);
      requireRule(placementFits(placement, trip.cargo, width, height), 'Здесь рыба не помещается.');
      trip.cargo = [...trip.cargo.filter((entry) => entry.id !== item.id), placement];
      if (trip.pending?.id === item.id) trip.pending = null;
      trip.outcome = null;
      resumeTrip(trip, now);
      trip.message = `${fish[item.species].name} в трюме.`;
      return;
    }
    case 'discard':
      requireRule(trip && !trip.battle, 'Разбирайте трюм после завершения боя.');
      requireRule(trip.pending?.id === action.id || trip.cargo.some((item) => item.id === action.id), 'Эта рыба уже отпущена.');
      if (trip.pending?.id === action.id) trip.pending = null;
      trip.outcome = null;
      resumeTrip(trip, now);
      trip.cargo = trip.cargo.filter((item) => item.id !== action.id);
      trip.message = 'Рыба отпущена.';
      return;
    case 'return':
      requireRule(trip, 'Вылазка уже завершена.');
      requireRule(!trip.battle && !trip.pending && !trip.outcome, 'Сначала закончите вываживание и разберите улов.');
      finishTrip(player, trip, now);
      return;
    case 'sell':
    case 'roll': {
      requireRule(!trip, 'Рынок доступен на причале.');
      const item = player.stock.find((entry) => entry.id === action.id);
      requireRule(item, 'Эта рыба уже израсходована.');
      if (action.type === 'sell') {
        player.gold += fish[item.species].gold;
      } else {
        const card = rewardCards[weightedIndex(fish[item.species].rewards, random)];
        const duplicateGold = player.collection.includes(card) ? 3 : 0;
        if (duplicateGold) player.gold += duplicateGold;
        else player.collection.push(card);
        player.lastRoll = { id: nextId(), species: item.species, card, duplicateGold };
      }
      player.stock = player.stock.filter((entry) => entry.id !== item.id);
      return;
    }
    case 'upgrade': {
      requireRule(!trip, 'Улучшения доступны на причале.');
      const upgrade = upgrades[action.upgrade];
      requireRule(!player.upgrades.includes(action.upgrade), 'Улучшение уже куплено.');
      requireRule(player.gold >= upgrade.price, 'Не хватает золота.');
      player.gold -= upgrade.price;
      player.upgrades.push(action.upgrade);
      return;
    }
    case 'equip': {
      requireRule(!trip, 'Менять набор можно на причале.');
      requireRule(player.collection.includes(action.card), 'Этой карты нет в коллекции.');
      requireRule(Number.isInteger(action.slot) && action.slot >= 0 && action.slot < player.deck.length, 'Выберите место в колоде.');
      const limit = Math.max(1, starterDeck.filter(id => id === action.card).length);
      requireRule(player.deck[action.slot] === action.card || player.deck.filter(id => id === action.card).length < limit, 'Все копии этой карты уже в колоде.');
      player.deck[action.slot] = action.card;
      return;
    }
  }
}
