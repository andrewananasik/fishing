import type { BaitId, SpotId } from './content.ts';
import type { Point, Voyage } from './navigation.ts';
import type { Trip } from './types.ts';

export const ROOM_CAPACITY = 8;
export const RECONNECT_GRACE_MS = 15_000;
export type Appearance = { coat: number; hat: number; skin: number };
export const coatColors = ['#697b42', '#54869a', '#a35b45', '#9a8245', '#70678f', '#477d70'];
export const hatColors = ['#796044', '#48595e', '#a28a60', '#7e4940', '#4f6543'];
export const skinColors = ['#dca675', '#bb8255', '#8e5a3c', '#e8ba92'];

export function randomAppearance(random: () => number): Appearance {
  return { coat: Math.floor(random() * coatColors.length), hat: Math.floor(random() * hatColors.length), skin: Math.floor(random() * skinColors.length) };
}

export type FisherActivity = 'idle' | 'rowing' | 'casting' | 'fishing' | 'fighting' | 'catch';
export const activityLabels: Record<FisherActivity, string> = {
  idle: 'На воде', rowing: 'Гребёт', casting: 'Готовит заброс', fishing: 'Ловит', fighting: 'Вываживает', catch: 'Разбирает улов',
};
// Explicit public projection: never transmit a session, inventory, hand or profile.
export type Fisher = {
  id: string; nickname: string; appearance: Appearance; connected: boolean;
  spot: SpotId; boat: Point; heading: number; voyage: Voyage | null;
  bait: BaitId; bite: Trip['bite']; fightZone: number | null; activity: FisherActivity;
};
export type RoomSnapshot = {
  roomId: string; spot: SpotId; capacity: number; selfId: string;
  serverNow: number; fishers: Fisher[];
};

export function fisherActivity(trip: Trip, now: number): FisherActivity {
  if (trip.battle) return 'fighting';
  if (trip.pending || trip.outcome) return 'catch';
  if (trip.bite) return 'fishing';
  if (trip.chargingAt !== null) return 'casting';
  if (trip.voyage && now < trip.voyage.arrivesAt) return 'rowing';
  return 'idle';
}
