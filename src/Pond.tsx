import type { CSSProperties, ReactNode, PointerEvent } from 'react';
import type { SpotId } from '../shared/content.ts';
import { fishingTargets } from '../shared/navigation.ts';
import type { Point } from '../shared/navigation.ts';
export { FishingRig } from './BoatCanvas.tsx';

export function targetPosition(spot: SpotId, index: number): CSSProperties {
  const { x, y } = fishingTargets(spot)[index];
  return { '--target-x': `${x * 100}%`, '--target-y': `${y * 100}%` } as CSSProperties;
}
export function FishingWater({ spot, children, onNavigate }: { spot: SpotId; children: ReactNode; onNavigate?: (point: Point) => void }) {
  function navigate(event: PointerEvent<HTMLDivElement>) {
    if (!onNavigate || event.button !== 0 || (event.target as Element).closest('button, .zone-odds, .zone-cast-menu')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onNavigate({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  }
  return <div className="water" data-spot={spot} aria-label="Пруд и участки ловли"><div className="water-world scene-frame" onPointerDown={navigate}>{children}</div></div>;
}
