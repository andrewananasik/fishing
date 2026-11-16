export const TRIP_MS = 300_000;
export const FISH_TURN_MS = 560;
export const TURN_ENERGY = 3;
export const HAND_SIZE = 5;
export const HAND_LIMIT = 10;
export const CHARGE_MS = 1_500;
export const LINE_MAX = 10;

export const cards = {
  reel: { name: 'Подмотка', rarity: 'Стартовая', damage: 3, guard: 0, cost: 1, draw: 0 },
  ease: { name: 'Ослабить леску', rarity: 'Стартовая', damage: 0, guard: 4, cost: 1, draw: 0 },
  short: { name: 'Короткая тяга', rarity: 'Стартовая', damage: 2, guard: 2, cost: 1, draw: 0 },
  pull: { name: 'Силовая тяга', rarity: 'Стартовая', damage: 7, guard: 0, cost: 2, draw: 0 },
  brace: { name: 'Упор удилищем', rarity: 'Стартовая', damage: 0, guard: 7, cost: 2, draw: 0 },
  scout: { name: 'Смена тактики', rarity: 'Стартовая', damage: 0, guard: 0, cost: 1, draw: 2 },
  steady: { name: 'Осторожная тяга', rarity: 'Обычная', damage: 1, guard: 3, cost: 1, draw: 0 },
  sharp: { name: 'Резкая подмотка', rarity: 'Редкая', damage: 5, guard: 0, cost: 1, draw: 0 },
  firm: { name: 'Уверенная подмотка', rarity: 'Сильная', damage: 4, guard: 4, cost: 1, draw: 0 },
} as const;

export type CardId = keyof typeof cards;
export const starterDeck: CardId[] = ['reel', 'ease', 'short', 'reel', 'reel', 'ease', 'pull', 'reel', 'brace', 'pull', 'scout', 'reel'];
export const rewardCards = ['steady', 'sharp', 'firm'] as const;

export const fish = {
  crucian: {
    name: 'Карась', difficulty: 'Лёгкая', symbol: 'К', health: 14,
    length: 1, points: 10, gold: 8, moves: [{ attack: 3, block: 0 }, { attack: 0, block: 3 }, { attack: 4, block: 0 }], rewards: [80, 20, 0],
  },
  perch: {
    name: 'Окунь', difficulty: 'Средняя', symbol: 'О', health: 22,
    length: 2, points: 25, gold: 13, moves: [{ attack: 5, block: 0 }, { attack: 2, block: 3 }, { attack: 7, block: 0 }], rewards: [55, 40, 5],
  },
  pike: {
    name: 'Щука', difficulty: 'Сложная', symbol: 'Щ', health: 28,
    length: 3, points: 45, gold: 22, moves: [{ attack: 7, block: 0 }, { attack: 2, block: 4 }, { attack: 8, block: 2 }, { attack: 6, block: 0 }], rewards: [25, 55, 20],
  },
} as const;

export type FishId = keyof typeof fish;
export const fishIds: FishId[] = ['crucian', 'perch', 'pike'];
export type Weights = readonly [number, number, number];
export type Zone = { name: string; weights: Weights };
const shallows: Zone = { name: 'Камыши', weights: [100, 0, 0] };

type Spot = {
  name: string;
  zones: readonly [Zone, Zone, Zone];
  requires?: UpgradeId;
};

export const spots = {
  reeds: {
    name: 'Край камышей',
    zones: [shallows, { name: 'Коряги', weights: [70, 30, 0] }, { name: 'Омут', weights: [25, 45, 30] }],
  },
  bend: {
    name: 'Поворот протоки',
    zones: [shallows, { name: 'Затонувший ствол', weights: [50, 50, 0] }, { name: 'Тёмная яма', weights: [15, 40, 45] }],
  },
  deep: {
    name: 'Глубокая заводь', requires: 'gear',
    zones: [{ name: 'Берег', weights: [75, 25, 0] }, { name: 'Обрыв', weights: [35, 45, 20] }, { name: 'Глубина', weights: [10, 35, 55] }],
  },
  channel: {
    name: 'Узкий проход', requires: 'boat',
    zones: [{ name: 'Мель', weights: [60, 40, 0] }, { name: 'Плесо', weights: [30, 45, 25] }, { name: 'Русло', weights: [0, 40, 60] }],
  },
} satisfies Record<string, Spot>;

export type SpotId = keyof typeof spots;
export const districts: { name: string; spots: SpotId[]; risk: string }[] = [
  { name: 'Тихая заводь', spots: ['reeds', 'bend', 'deep'], risk: 'Низкий риск у берега' },
  { name: 'Топкая протока', spots: ['channel'], risk: 'Сложная рыба встречается чаще' },
];

export const baits = {
  worm: { name: 'Червь', description: 'Обычные шансы поклёвки.' },
  lure: { name: 'Блесна', description: 'Повышает шанс на более сложную рыбу, если она водится на участке.' },
};

export type BaitId = keyof typeof baits;
export const upgrades = {
  boat: { name: 'Мелкосидящая лодка', price: 15, description: 'Трюм 3 × 3. Открывает Топкую протоку.' },
  gear: { name: 'Усиленная снасть', price: 15, description: '+1 к урону и защите карт с подходящим эффектом. Открывает Глубокую заводь.' },
};

export type UpgradeId = keyof typeof upgrades;

export function getSpot(id: SpotId): Spot {
  return spots[id];
}

export function oddsFor(zone: Zone, bait: BaitId): Weights {
  const [light, medium, hard] = zone.weights;
  if (bait === 'worm' || !light || (!medium && !hard)) return zone.weights;
  const shift = Math.min(light, 10);
  return hard ? [light - shift, medium, hard + shift] : [light - shift, medium + shift, 0];
}

export function castStrength(heldMs: number) {
  const cycle = Math.max(0, heldMs) % (2 * CHARGE_MS);
  return Math.min(cycle, 2 * CHARGE_MS - cycle) / CHARGE_MS;
}

export function castZone(heldMs: number) {
  return Math.min(2, Math.floor(castStrength(heldMs) * 3));
}
