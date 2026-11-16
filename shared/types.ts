import type { BaitId, CardId, FishId, SpotId, UpgradeId } from './content.ts';
import type { Difficulty, Point, Voyage } from './navigation.ts';

export type Catch = { id: string; species: FishId };
export type Placement = Catch & { x: number; y: number; rotated: boolean };

export type Battle = {
  species: FishId;
  zone: number | null;
  fishHealth: number;
  line: number;
  round: number;
  phase: 'player' | 'fish';
  energy: number;
  played: CardId[];
  deck: CardId[];
  hand: number[];
  drawPile: number[];
  discardPile: number[];
  shuffles: number;
  block: number;
  fishBlock: number;
  startedAt: number;
  deadline: number;
};

export type Trip = {
  boat?: Point;
  heading?: number;
  voyage?: Voyage | null;
  aim?: Point | null;
  pausedAt?: number | null;
  pausedMs?: number;
  outcome?: { species: FishId; win: boolean; message: string } | null;
  spot: SpotId;
  bait: BaitId;
  startedAt: number;
  deadline: number;
  chargingAt: number | null;
  bite: { zone: number; opensAt: number; closesAt: number; position?: Point; ring?: { startedAt: number; duration: number; difficulty: Difficulty } } | null;
  battle: Battle | null;
  pending: Catch | null;
  cargo: Placement[];
  message: string;
};

export type TripResult = {
  spot: SpotId;
  startedAt: number;
  seconds: number;
  cargo: Catch[];
  score: number;
  record: boolean;
  orderGold: number;
};

export type Roll = { id: string; species: FishId; card: CardId; duplicateGold: number };

export type Player = {
  activeQuest: { id: string; progress: number } | null;
  completedQuests: string[];
  nickname: string;
  revision: number;
  gold: number;
  collection: CardId[];
  deck: CardId[];
  upgrades: UpgradeId[];
  stock: Catch[];
  trip: Trip | null;
  result: TripResult | null;
  orderDone: boolean;
  bestScore: number | null;
  bestAt: number | null;
  lastRoll: Roll | null;
};

export type Action =
  | { type: 'takeQuest'; id: string }
  | { type: 'claimQuest' | 'ackOutcome' }
  | { type: 'start'; spot: SpotId; bait: BaitId }
  | { type: 'charge'; aim?: Point }
  | { type: 'fishAt'; zone: number }
  | { type: 'move'; x: number; y: number; aim?: Point }
  | { type: 'cast' | 'cancelCharge' | 'hook' | 'return' | 'stop' | 'reel' }
  | { type: 'play'; round: number; card: CardId; instance: number }
  | { type: 'endTurn'; round: number }
  | { type: 'place'; id: string; x: number; y: number; rotated: boolean }
  | { type: 'discard' | 'sell' | 'roll'; id: string }
  | { type: 'upgrade'; upgrade: UpgradeId }
  | { type: 'equip'; slot: number; card: CardId };

export type View = { player: Player | null; serverNow: number; error?: string };
export type Leader = { place: number; nickname: string; score: number; mine: boolean };
export type Ranking = { top: Leader[]; mine: Leader | null };
