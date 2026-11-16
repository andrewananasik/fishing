import { castStrength, getSpot, oddsFor } from './content.ts';
import type { BaitId, SpotId } from './content.ts';
import type { Trip } from './types.ts';

export type Point = { x: number; y: number };
export type Voyage = { from: Point; to: Point; startedAt: number; arrivesAt: number };
// Coordinates match the painted habitats in each location's background.
// Shared by rendering, navigation and the server's casting/range checks.
const waters: Record<SpotId, { targets: readonly [Point, Point, Point]; launch: Point }> = {
  reeds: { targets: [{ x: .28, y: .58 }, { x: .53, y: .38 }, { x: .77, y: .57 }], launch: { x: .21, y: .72 } },
  bend: { targets: [{ x: .72, y: .56 }, { x: .34, y: .43 }, { x: .62, y: .32 }], launch: { x: .21, y: .72 } },
  deep: { targets: [{ x: .27, y: .38 }, { x: .72, y: .40 }, { x: .49, y: .63 }], launch: { x: .78, y: .72 } },
  channel: { targets: [{ x: .32, y: .62 }, { x: .68, y: .51 }, { x: .47, y: .31 }], launch: { x: .20, y: .72 } },
};
export function fishingTargets(spot: SpotId) { return waters[spot].targets; }
export function launchPosition(spot: SpotId): Point { return { ...waters[spot].launch }; }
export const BOAT_SPEED = .105;
export const FISHING_RANGE = .105;
export type Difficulty = 'easy' | 'medium' | 'hard';
export const ringTimings = {
  easy: { label: 'Легко', windup: 2200, window: 1300, duration: 4300 },
  medium: { label: 'Средне', windup: 1700, window: 700, duration: 3000 },
  hard: { label: 'Сложно', windup: 1250, window: 380, duration: 2150 },
} as const;
export function fishingDifficulty(spot: SpotId, zone: number, bait: BaitId): Difficulty {
  const odds = oddsFor(getSpot(spot).zones[zone], bait);
  return odds[2] ? 'hard' : odds[1] ? 'medium' : 'easy';
}
export function nearbyZone(position: Point, spot: SpotId): number | null {
  const index = zoneAt(position, spot);
  return waterDistance(position, fishingTargets(spot)[index]) <= FISHING_RANGE ? index : null;
}
export function headingTo(from: Point, to: Point) {
  return Math.atan2((to.y - from.y) * 9 / 16, to.x - from.x);
}
export function headingFrame(heading: number) {
  return (Math.round(heading / (Math.PI / 4)) % 8 + 8) % 8;
}
export const WATER = { left: .13, right: .87, top: .28, bottom: .77 };

export function onWater(p: Point) {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= WATER.left && p.x <= WATER.right && p.y >= WATER.top && p.y <= WATER.bottom;
}
export function clampWater(p: Point): Point {
  return { x: Math.max(WATER.left, Math.min(WATER.right, p.x)), y: Math.max(WATER.top, Math.min(WATER.bottom, p.y)) };
}
export function waterDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 9 / 16);
}
export function boatAt(trip: Pick<Trip, 'spot' | 'boat' | 'voyage'>, now: number): Point {
  const v = trip.voyage;
  if (!v) return trip.boat ?? launchPosition(trip.spot);
  const t = Math.max(0, Math.min(1, (now - v.startedAt) / Math.max(1, v.arrivesAt - v.startedAt)));
  return { x: v.from.x + (v.to.x - v.from.x) * t, y: v.from.y + (v.to.y - v.from.y) * t };
}
export function zoneAt(point: Point, spot: SpotId) {
  const targets = fishingTargets(spot);
  return targets.reduce((best, target, index) => waterDistance(point, target) < waterDistance(point, targets[best]) ? index : best, 0);
}
export function castLanding(boat: Point, aim: Point, heldMs: number): Point {
  const distance = waterDistance(boat, aim);
  const reach = .025 + castStrength(heldMs) * .20;
  if (distance < .001) return clampWater({ x: boat.x + reach, y: boat.y });
  return clampWater({ x: boat.x + (aim.x - boat.x) * reach / distance, y: boat.y + (aim.y - boat.y) * reach / distance });
}
export function approach(aim: Point): Point {
  return clampWater({ x: aim.x - .075, y: aim.y + .08 });
}
